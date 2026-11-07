import asyncio
import re
import sys
import logging
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from config import get_settings
from auth import TokenPayload, get_current_user, get_raw_jwt, verify_jwt
from websocket.handler import handle_interview_websocket
from services.deepgram import DeepgramKeyRejected, mint_stt_token
from services.keys import (
    PROVIDERS as KEY_PROVIDERS,
    KeyStoreUnavailable,
    ResolvedKeys,
    delete_key,
    key_status,
    resolve_keys,
    save_key,
)
from services.supabase_client import create_session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class RedactTokens(logging.Filter):
    """uvicorn logs websocket URLs in full, and ours carry the user's JWT as ?token=."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "token=" in message:
            record.msg = re.sub(r"token=[^\s&\"']+", "token=[redacted]", message)
            record.args = None
        return True


for _name in ("uvicorn.error", "uvicorn.access"):
    logging.getLogger(_name).addFilter(RedactTokens())

settings = get_settings()

# Validate that SUPABASE_SERVICE_ROLE_KEY looks like a service_role key
# (starts with "eyJ" and is long enough), not the anon key.
_service_key = settings.supabase_service_role_key
if not _service_key.startswith("eyJ") or len(_service_key) < 100:
    print(
        "\n*** WARNING: SUPABASE_SERVICE_ROLE_KEY looks incorrect.\n"
        "    Make sure you copied the **service_role** key (NOT the anon key)\n"
        "    from Project Settings → API in the Supabase dashboard.\n"
        "    The service_role key starts with 'eyJ' and is ~400 chars long.\n",
        file=sys.stderr,
    )

app = FastAPI(title="LeeView Backend", version="0.1.0")

if settings.llm_provider.lower() == "mock":
    logger.warning("LLM_PROVIDER=mock: interviewer replies and debriefs are canned sample data, not real evaluations")
elif settings.llm_provider.lower() == "nvidia_nim":
    logger.info("LLM provider: nvidia_nim (%s)", settings.nvidia_nim_model)
else:
    logger.info("LLM provider: %s", settings.llm_provider)

_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateSessionRequest(BaseModel):
    # Deprecated and ignored: the owner is always the verified token's subject.
    user_id: Optional[str] = None
    # Bounded so one request cannot bloat every prompt of the session (and its token bill).
    leetcode_slug: str = Field(max_length=200)
    leetcode_title: str = Field(max_length=300)
    problem_difficulty: Optional[str] = Field(default=None, max_length=20)
    problem_description: str = Field(default="", max_length=20_000)
    problem_topics: list[Annotated[str, Field(max_length=80)]] = Field(default=[], max_length=30)
    problem_language: str = Field(default="python", max_length=40)


class CreateSessionResponse(BaseModel):
    session_id: str


class SaveKeyRequest(BaseModel):
    key: str = Field(max_length=1024)


def _keys_for(user_id: str) -> ResolvedKeys:
    """The user's keys, or the HTTP error the dashboard and extension know how to explain."""
    try:
        return resolve_keys(user_id)
    except KeyStoreUnavailable:
        logger.error("KEY_ENCRYPTION_KEY is not configured; user keys cannot be read")
        raise HTTPException(status_code=503, detail={"code": "KEY_STORE_UNAVAILABLE", "message": "Key storage is not configured on the server."})


def _require_keys(keys: ResolvedKeys, needs_llm: bool = True) -> None:
    missing = keys.missing()
    if not needs_llm or settings.llm_provider.lower() == "mock":
        missing = [m for m in missing if m != "llm"]
    if missing:
        raise HTTPException(
            status_code=412,
            detail={"code": "KEYS_MISSING", "missing": missing, "message": "Add your API keys in your LeeView profile."},
        )


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/me/keys")
async def list_my_keys(user: TokenPayload = Depends(get_current_user)):
    """Which keys the user has saved, masked. Stored keys are never returned."""
    try:
        status = await asyncio.to_thread(key_status, user.sub)
    except Exception as exc:
        logger.error(f"Could not read key status: {exc}")
        raise HTTPException(status_code=502, detail="Could not load your keys")
    return {"keys": status, "server_keys_allowed": settings.allow_server_keys}


@app.put("/me/keys/{provider}")
async def save_my_key(provider: str, req: SaveKeyRequest, user: TokenPayload = Depends(get_current_user)):
    if provider not in KEY_PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    try:
        await asyncio.to_thread(save_key, user.sub, provider, req.key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except KeyStoreUnavailable:
        raise HTTPException(status_code=503, detail="Key storage is not configured on the server.")
    except Exception as exc:
        logger.error(f"Could not save a {provider} key: {type(exc).__name__}")
        raise HTTPException(status_code=502, detail="Could not save your key")
    return {"keys": await asyncio.to_thread(key_status, user.sub)}


@app.delete("/me/keys/{provider}")
async def delete_my_key(provider: str, user: TokenPayload = Depends(get_current_user)):
    if provider not in KEY_PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    try:
        await asyncio.to_thread(delete_key, user.sub, provider)
    except Exception as exc:
        logger.error(f"Could not delete a {provider} key: {type(exc).__name__}")
        raise HTTPException(status_code=502, detail="Could not remove your key")
    return {"keys": await asyncio.to_thread(key_status, user.sub)}


@app.post("/stt/token")
async def stt_token(user: TokenPayload = Depends(get_current_user)):
    """A short-lived Deepgram token for the extension's speech-to-text socket, minted from the user's key."""
    keys = await asyncio.to_thread(_keys_for, user.sub)
    _require_keys(keys, needs_llm=False)
    try:
        return await mint_stt_token(keys.deepgram, settings.stt_token_ttl_s)
    except DeepgramKeyRejected:
        raise HTTPException(
            status_code=412,
            detail={"code": "KEY_REJECTED", "missing": ["deepgram"], "message": "Deepgram rejected your key. Check it in your LeeView profile."},
        )
    except Exception as exc:
        logger.error(f"Could not mint a Deepgram token: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="Speech recognition is unavailable right now")


@app.post("/sessions", response_model=CreateSessionResponse)
async def create_interview_session(
    req: CreateSessionRequest,
    token: str = Depends(get_raw_jwt),
    user: TokenPayload = Depends(get_current_user),
):
    # Checked up front, so a user without keys learns it before the mic opens, not mid-interview.
    _require_keys(await asyncio.to_thread(_keys_for, user.sub))
    try:
        result = await asyncio.to_thread(
            create_session,
            user_jwt=token,
            user_id=user.sub,
            leetcode_slug=req.leetcode_slug,
            leetcode_title=req.leetcode_title,
            problem_difficulty=req.problem_difficulty,
            problem_description=req.problem_description,
            problem_topics=req.problem_topics,
            problem_language=req.problem_language,
        )
    except Exception as exc:
        logger.error(f"Failed to insert interview session: {exc}")
        # A signed JWT outlives its account, so a deleted user's token still verifies until it expires.
        if isinstance(exc, APIError) and exc.code == "23503" and "interview_sessions_user_id_fkey" in (exc.message or ""):
            raise HTTPException(status_code=401, detail="This account no longer exists. Sign in again.")
        raise HTTPException(status_code=502, detail="Could not create interview session")

    if not result.data:
        logger.error("Session insert returned no rows")
        raise HTTPException(status_code=502, detail="Could not create interview session")

    return CreateSessionResponse(session_id=result.data[0]["id"])


@app.websocket("/ws/interview/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str, token: str = Query(...)):
    # Verify the token to ensure the connection is authenticated
    try:
        user = verify_jwt(token)
    except Exception:
        await websocket.close(code=1008, reason="Invalid authentication token")
        return

    await handle_interview_websocket(websocket, session_id, token, user.sub)

import asyncio
import re
import sys
import logging
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import get_settings
from auth import TokenPayload, get_current_user, get_raw_jwt, verify_jwt
from websocket.handler import handle_interview_websocket
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
    leetcode_slug: str
    leetcode_title: str
    problem_difficulty: Optional[str] = None
    problem_description: str = ""
    problem_topics: list[str] = []
    problem_language: str = "python"


class CreateSessionResponse(BaseModel):
    session_id: str


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/sessions", response_model=CreateSessionResponse)
async def create_interview_session(
    req: CreateSessionRequest,
    token: str = Depends(get_raw_jwt),
    user: TokenPayload = Depends(get_current_user),
):
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
        raise HTTPException(status_code=502, detail="Could not create interview session")

    if not result.data:
        logger.error("Session insert returned no rows")
        raise HTTPException(status_code=502, detail="Could not create interview session")

    return CreateSessionResponse(session_id=result.data[0]["id"])


@app.websocket("/ws/interview/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str, token: str = Query(...)):
    # Verify the token to ensure the connection is authenticated
    try:
        verify_jwt(token)
    except Exception:
        await websocket.close(code=1008, reason="Invalid authentication token")
        return

    await handle_interview_websocket(websocket, session_id, token)

import sys
import logging
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import get_settings
from src.websocket.handler import handle_interview_websocket
from src.services.supabase_client import create_session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateSessionRequest(BaseModel):
    user_id: str
    leetcode_slug: str
    leetcode_title: str
    problem_difficulty: str = "Medium"


class CreateSessionResponse(BaseModel):
    session_id: str


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/sessions", response_model=CreateSessionResponse)
async def create_interview_session(req: CreateSessionRequest):
    result = create_session(
        user_id=req.user_id,
        leetcode_slug=req.leetcode_slug,
        leetcode_title=req.leetcode_title,
        problem_difficulty=req.problem_difficulty,
    )
    session_id = result.data[0]["id"]
    return CreateSessionResponse(session_id=session_id)


@app.websocket("/ws/interview/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str):
    await handle_interview_websocket(websocket, session_id)

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import get_settings
from src.websocket.handler import handle_interview_websocket
from src.services.supabase_client import create_session

settings = get_settings()

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

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.websocket.handler import handle_interview_websocket

settings = get_settings()

app = FastAPI(title="LeeView Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.websocket("/ws/interview/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str):
    await handle_interview_websocket(websocket, session_id)

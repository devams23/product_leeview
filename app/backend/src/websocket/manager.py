from typing import Dict, Optional
from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.attach(session_id, websocket)

    def attach(self, session_id: str, websocket: WebSocket):
        """Route the session's messages to this socket. Called once the connection has been allowed in."""
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str, websocket: Optional[WebSocket] = None):
        """Forget the session's socket. Given a socket, only if it is still the current one:
        after a reconnect, the old connection's cleanup must not unregister the new one."""
        if websocket is not None and self.active_connections.get(session_id) is not websocket:
            return
        self.active_connections.pop(session_id, None)

    async def send_to_session(self, session_id: str, message: dict):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_json(message)

    async def send_bytes(self, session_id: str, data: bytes):
        """Raw binary frame, used for audio. The caller keeps frames at an even length."""
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_bytes(data)


manager = ConnectionManager()

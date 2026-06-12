import asyncio
import websockets
import json


async def test_full_interview():
    """Simulate a basic interview flow via WebSocket."""
    session_id = "test-session-001"
    ws_url = f"ws://localhost:8000/ws/interview/{session_id}"

    async with websockets.connect(ws_url) as ws:
        print("Waiting for INTRO audio...")
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "AUDIO_CHUNK"
        print("INTRO audio received")

        await ws.send(json.dumps({
            "type": "USER_UTTERANCE",
            "text": "Hi, I'm ready to start",
            "current_code": "",
            "language": "python",
        }))

        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "AUDIO_CHUNK"
        print("AI response audio received")

        await ws.send(json.dumps({"type": "INTERRUPT"}))
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "DEBRIEF_READY"
        print("Debrief ready")

    print("E2E test passed!")


if __name__ == "__main__":
    asyncio.run(test_full_interview())

import json
from venv import logger
import websockets
from typing import AsyncIterator

from src.config import get_settings

settings = get_settings()


class DeepgramTTSClient:
    """Streams TTS audio from Deepgram given a text."""

    def __init__(self):
        self.api_key = settings.deepgram_api_key
        self.ws_url = "wss://api.deepgram.com/v1/speak?encoding=linear16&sample_rate=24000"

    async def stream_tts(self, text: str) -> AsyncIterator[bytes]:
        logger.info("received text to synthesize: %s", text)
        """Yields PCM audio chunks."""
        headers = {"Authorization": f"Token {self.api_key}"}
        async with websockets.connect(self.ws_url, additional_headers=headers) as ws:
            await ws.send(json.dumps({"text": text}))
            await ws.send(json.dumps({"type": "Speak.Finalize"}))

            async for message in ws:
                if isinstance(message, bytes):
                    yield message
                else:
                    data = json.loads(message)
                    if data.get("type") == "Results":
                        break

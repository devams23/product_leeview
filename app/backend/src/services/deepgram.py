import json
import logging
import websockets
from typing import AsyncIterator

from src.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class DeepgramTTSClient:
    """Streams TTS audio from Deepgram given a text."""

    def __init__(self):
        self.api_key = settings.deepgram_api_key
        self.ws_url = "wss://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=24000"

    async def stream_tts(self, text: str) -> AsyncIterator[bytes]:
        logger.info("received text to synthesize: %s", text)

        """Yields PCM audio chunks."""
        async with websockets.connect(self.ws_url, subprotocols=["token", self.api_key]) as ws:
            # Send text to synthesize
            await ws.send(json.dumps({"type": "Speak", "text": text}))
            # Flush to signal end of text
            await ws.send(json.dumps({"type": "Flush"}))

            async for message in ws:
                if isinstance(message, bytes):
                    yield message
                else:
                    data = json.loads(message)
                    logger.debug("Deepgram TTS message: %s", data)
                    if data.get("type") == "Flushed":
                        logger.info("Deepgram TTS flushed, ending stream")
                        break
                    elif data.get("type") == "Error":
                        logger.error("Deepgram TTS error: %s", data)
                        break
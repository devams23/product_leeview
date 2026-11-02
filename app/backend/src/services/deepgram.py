import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import websockets

from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

OPEN_TIMEOUT_S = 5.0
RECV_TIMEOUT_S = 10.0


class TTSSession:
    """One Aura socket for one turn. Sentences go in as they are produced; audio comes out in order.

    Each speak() is followed by a Flush, and Deepgram answers each Flush with a Flushed message.
    audio() ends once end() has been called and every flush has been answered.
    """

    def __init__(self, ws):
        self._ws = ws
        self._flushes = 0
        self._flushed = 0
        self._ended = False
        self._wake = asyncio.Event()

    async def speak(self, text: str) -> None:
        logger.info("received text to synthesize: %s", text)
        await self._ws.send(json.dumps({"type": "Speak", "text": text}))
        await self._ws.send(json.dumps({"type": "Flush"}))
        self._flushes += 1
        self._wake.set()

    async def end(self) -> None:
        """No more text is coming for this turn."""
        self._ended = True
        self._wake.set()

    async def audio(self) -> AsyncIterator[bytes]:
        """Yields PCM audio until the last flush has been answered after end()."""
        while True:
            if self._flushed == self._flushes:
                if self._ended:
                    return
                # Nothing is outstanding: wait for speak() or end() rather than receiving.
                await self._wake.wait()
                self._wake.clear()
                continue
            try:
                message = await asyncio.wait_for(self._ws.recv(), RECV_TIMEOUT_S)
            except asyncio.TimeoutError as e:
                logger.error("Deepgram TTS timed out: %s", e)
                raise RuntimeError("Deepgram TTS timed out") from e
            except websockets.ConnectionClosedOK:
                return
            if isinstance(message, bytes):
                yield message
                continue
            data = json.loads(message)
            logger.debug("Deepgram TTS message: %s", data)
            if data.get("type") == "Flushed":
                self._flushed += 1
            elif data.get("type") == "Error":
                logger.error("Deepgram TTS error: %s", data)
                raise RuntimeError(f"Deepgram TTS error: {data.get('description') or data}")


class DeepgramTTSClient:
    """Speaks text through Deepgram Aura."""

    def __init__(self):
        self.api_key = settings.deepgram_api_key
        self.ws_url = "wss://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=24000"

    @asynccontextmanager
    async def session(self):
        """Open one socket for a turn. It is closed on exit, including when the turn is cancelled."""
        async with websockets.connect(
            self.ws_url, subprotocols=["token", self.api_key], open_timeout=OPEN_TIMEOUT_S
        ) as ws:
            yield TTSSession(ws)

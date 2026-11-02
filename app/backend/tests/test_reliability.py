import asyncio
import os
import time
from contextlib import asynccontextmanager

import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")

import auth
import services.deepgram as deepgram
import websocket.handler as handler
from services.llm.base import LLMProvider
from state_machine.machine import StateMachine


class HungTTSSocket:
    """A Deepgram socket that accepts the request and then never sends audio."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def send(self, message):
        return None

    async def recv(self):
        await asyncio.sleep(10)


def test_tts_recv_timeout(monkeypatch):
    monkeypatch.setattr(deepgram, "RECV_TIMEOUT_S", 0.05)
    monkeypatch.setattr(deepgram.websockets, "connect", lambda *args, **kwargs: HungTTSSocket())

    async def consume():
        async with deepgram.DeepgramTTSClient().session() as tts:
            await tts.speak("hi")
            await tts.end()
            async for _ in tts.audio():
                pass

    started = time.monotonic()
    with pytest.raises(RuntimeError, match="timed out"):
        asyncio.run(consume())
    assert time.monotonic() - started < 1


def test_supabase_client_cached(monkeypatch):
    auth.supabase_for_user.cache_clear()
    monkeypatch.setattr(auth, "create_client", lambda *args, **kwargs: object())
    first = auth.supabase_for_user("jwt-a")
    assert auth.supabase_for_user("jwt-a") is first
    assert auth.supabase_for_user("jwt-b") is not first
    auth.supabase_for_user.cache_clear()


class FakeLLM(LLMProvider):
    """Records each streamed request and replies with a one-sentence answer."""

    def __init__(self):
        self.calls = []
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "fake"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("the interview turns use stream")

    async def stream(self, messages, temperature=0.6, max_tokens=400):
        self.calls.append({"messages": messages})
        yield "STATE: AWAITING_CLARIFICATION\nThat is a fair question to ask."

    def usage_snapshot(self):
        return (0, 0, 0)


class FakeTTSSession:
    async def speak(self, text):
        return None

    async def end(self):
        return None

    async def audio(self):
        for chunk in ():
            yield chunk


class FakeTTS:
    @asynccontextmanager
    async def session(self):
        yield FakeTTSSession()


def test_history_keeps_only_text(monkeypatch):
    async def send_to_session(session_id, message):
        return None

    async def no_op(fn, *args, **kwargs):
        return None

    monkeypatch.setattr(handler.manager, "send_to_session", send_to_session)
    monkeypatch.setattr(handler, "_safe", no_op)

    llm = FakeLLM()
    ctx = handler._InterviewContext(
        session_id="s",
        token="t",
        sm=StateMachine(),
        llm=llm,
        tts=FakeTTS(),
        problem_context={"title": "T", "difficulty": "Easy", "description": "d", "topics": [], "language": "python"},
    )

    asyncio.run(handler._handle_user_utterance(ctx, {"text": "hi", "current_code": "print(1)"}))

    user_turns = [m for m in ctx.conversation_history if m["role"] == "user"]
    assert user_turns == [{"role": "user", "content": "Candidate: hi"}]
    assert "print(1)" in llm.calls[0]["messages"][-1]["content"]
    assert ctx.conversation_history[-1] == {"role": "assistant", "content": "That is a fair question to ask."}

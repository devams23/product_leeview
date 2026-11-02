import asyncio
import os
import time

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
        async for _ in deepgram.DeepgramTTSClient().stream_tts("hi"):
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
    """Records each structured request and replies with whatever next_state it was given."""

    def __init__(self):
        self.calls = []
        self.next_state = ""
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "fake"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("the interview turns use generate_structured")

    async def generate_structured(self, messages, json_schema, temperature=0.5, max_attempts=3):
        self.calls.append({"messages": messages, "max_attempts": max_attempts})
        return {"response_text": "ok", "next_state": self.next_state}

    def usage_snapshot(self):
        return (0, 0, 0)


def test_history_keeps_only_text(monkeypatch):
    async def send_to_session(session_id, message):
        return None

    async def no_op(fn, *args, **kwargs):
        return None

    async def speak(ctx, text, state):
        return (None, 0)

    monkeypatch.setattr(handler.manager, "send_to_session", send_to_session)
    monkeypatch.setattr(handler, "_safe", no_op)
    monkeypatch.setattr(handler, "_speak", speak)

    llm = FakeLLM()
    ctx = handler._InterviewContext(
        session_id="s",
        token="t",
        sm=StateMachine(),
        llm=llm,
        tts=None,
        problem_context={"title": "T", "difficulty": "Easy", "description": "d", "topics": [], "language": "python"},
    )
    llm.next_state = ctx.sm.current_state.value

    asyncio.run(handler._handle_user_utterance(ctx, {"text": "hi", "current_code": "print(1)"}))

    user_turns = [m for m in ctx.conversation_history if m["role"] == "user"]
    assert user_turns == [{"role": "user", "content": "Candidate: hi"}]
    assert "print(1)" in llm.calls[0]["messages"][-1]["content"]
    assert llm.calls[0]["max_attempts"] == 2

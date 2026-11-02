import asyncio
import os
from types import SimpleNamespace

import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")

from fastapi import WebSocketDisconnect

import websocket.handler as handler
from services.llm.base import LLMProvider


class FakeWebSocket:
    """Queued client messages in, sent server messages out. A WebSocketDisconnect in the queue ends the socket."""

    def __init__(self, incoming):
        self.queue: asyncio.Queue = asyncio.Queue()
        for item in incoming:
            self.queue.put_nowait(item)
        self.sent: list = []

    async def receive_json(self):
        item = await self.queue.get()
        if isinstance(item, WebSocketDisconnect):
            raise item
        return item

    async def send_json(self, payload):
        self.sent.append(payload)


class ScriptedLLM(LLMProvider):
    """The first call (the intro) returns at once. Every later call blocks until it is cancelled."""

    def __init__(self):
        self.calls = 0
        self.blocked = False
        self.cancelled = False
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "fake"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("the interview turns use generate_structured")

    async def generate_structured(self, messages, json_schema, temperature=0.5, max_attempts=3):
        self.calls += 1
        if self.calls == 1:
            return {"response_text": "Hello there.", "next_state": "AWAITING_CLARIFICATION"}
        self.blocked = True
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.cancelled = True
            raise
        return {"response_text": "never", "next_state": "AWAITING_CLARIFICATION"}

    def usage_snapshot(self):
        return (0, 0, 0)


class FakeTTS:
    async def stream_tts(self, text):
        yield b"\x00\x00"


def noop(*args, **kwargs):
    return None


def run_session(monkeypatch, incoming, llm):
    fake_ws = FakeWebSocket(incoming)
    debriefs = []

    async def connect(websocket, session_id):
        return None

    async def send_to_session(session_id, message):
        fake_ws.sent.append(message)

    async def run_debrief(ctx):
        debriefs.append(ctx)

    monkeypatch.setattr(handler.manager, "connect", connect)
    monkeypatch.setattr(handler.manager, "send_to_session", send_to_session)
    monkeypatch.setattr(handler, "get_session", lambda token, sid: SimpleNamespace(data={"leetcode_title": "T"}))
    for name in (
        "update_session", "log_transcript", "log_state_transition", "save_turn_metrics",
        "upsert_session_usage", "save_code_snapshot",
    ):
        monkeypatch.setattr(handler, name, noop)
    monkeypatch.setattr(handler, "create_llm_provider", lambda: llm)
    monkeypatch.setattr(handler, "DeepgramTTSClient", FakeTTS)
    monkeypatch.setattr(handler, "_run_debrief", run_debrief)

    asyncio.run(asyncio.wait_for(handler.handle_interview_websocket(fake_ws, "s", "t"), 2))
    return fake_ws, debriefs


def test_interrupt_cancels_running_turn(monkeypatch):
    llm = ScriptedLLM()
    fake_ws, debriefs = run_session(
        monkeypatch,
        [{"type": "USER_UTTERANCE", "text": "my answer"}, {"type": "INTERRUPT"}],
        llm,
    )

    assert len(debriefs) == 1
    assert llm.blocked
    assert llm.cancelled


def test_ping_pong(monkeypatch):
    llm = ScriptedLLM()
    fake_ws, _ = run_session(monkeypatch, [{"type": "PING"}, WebSocketDisconnect()], llm)

    assert {"type": "PONG"} in fake_ws.sent


def test_ping_answered_while_turn_is_blocked(monkeypatch):
    llm = ScriptedLLM()
    fake_ws, debriefs = run_session(
        monkeypatch,
        [{"type": "USER_UTTERANCE", "text": "my answer"}, {"type": "PING"}, WebSocketDisconnect()],
        llm,
    )

    assert llm.blocked
    assert {"type": "PONG"} in fake_ws.sent
    assert llm.cancelled
    assert debriefs == []


def test_cap_speaks_closing_line_and_runs_debrief(monkeypatch):
    import websocket.clock as clock

    monkeypatch.setattr(clock, "CAP_AT_S", 0)
    llm = ScriptedLLM()
    fake_ws, debriefs = run_session(monkeypatch, [], llm)

    assert len(debriefs) == 1
    assert llm.calls == 1  # only the intro; the cap line is fixed text
    spoken = [m["text"] for m in fake_ws.sent if m.get("type") == "AI_TEXT"]
    assert spoken[-1] == handler.CAP_TEXT

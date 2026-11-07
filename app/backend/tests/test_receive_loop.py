import asyncio
import os
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")

from fastapi import WebSocketDisconnect

import websocket.handler as handler
from services.keys import ResolvedKeys
from services.llm.base import LLMProvider


class AfterSent:
    """Marker: the next client message is delivered only once the server has sent `count` messages of this type."""

    def __init__(self, msg_type, count=1):
        self.msg_type = msg_type
        self.count = count


class FakeWebSocket:
    """Queued client messages in, sent server messages out. A WebSocketDisconnect in the queue ends the socket."""

    def __init__(self, incoming):
        self.queue: asyncio.Queue = asyncio.Queue()
        for item in incoming:
            self.queue.put_nowait(item)
        self.sent: list = []
        self.audio: list = []
        self.accepted = False
        self.closed = None

    async def receive_json(self):
        item = await self.queue.get()
        if isinstance(item, AfterSent):
            while sum(1 for m in self.sent if m.get("type") == item.msg_type) < item.count:
                await asyncio.sleep(0.001)
            item = await self.queue.get()
        if isinstance(item, WebSocketDisconnect):
            raise item
        return item

    async def send_json(self, payload):
        self.sent.append(payload)

    async def send_bytes(self, data):
        self.audio.append(data)

    async def accept(self):
        self.accepted = True

    async def close(self, code=1000, reason=None):
        self.closed = (code, reason)


class ScriptedLLM(LLMProvider):
    """The first stream (the intro) finishes at once. Every later stream blocks until it is cancelled."""

    def __init__(self):
        self.calls = 0
        self.blocked = False
        self.cancelled = False
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "fake"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("the interview turns use stream")

    async def stream(self, messages, temperature=0.6, max_tokens=400):
        self.calls += 1
        if self.calls == 1:
            yield "STATE: AWAITING_CLARIFICATION\nHello there, welcome along. "
            return
        self.blocked = True
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.cancelled = True
            raise
        yield "never"

    def usage_snapshot(self):
        return (0, 0, 0)


class InstantLLM(LLMProvider):
    """Every reply finishes at once. Records whether the client was closed."""

    def __init__(self):
        self.closed = False
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "fake"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("the interview turns use stream")

    async def stream(self, messages, temperature=0.6, max_tokens=400):
        yield "STATE: AWAITING_CLARIFICATION\nThat makes sense. "

    def usage_snapshot(self):
        return (0, 0, 0)

    async def aclose(self):
        self.closed = True


class FakeTTSSession:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()

    async def speak(self, text):
        self.queue.put_nowait(b"\x00\x00")

    async def end(self):
        self.queue.put_nowait(None)

    async def audio(self):
        while True:
            item = await self.queue.get()
            if item is None:
                return
            yield item


class FakeTTS:
    def __init__(self, *args, **kwargs):
        pass

    @asynccontextmanager
    async def session(self):
        yield FakeTTSSession()


def noop(*args, **kwargs):
    return None


def run_session(monkeypatch, incoming, llm):
    fake_ws = FakeWebSocket(incoming)
    debriefs = []

    async def send_to_session(session_id, message):
        fake_ws.sent.append(message)

    async def run_debrief(ctx):
        debriefs.append(ctx)

    monkeypatch.setattr(handler, "_LIVE", {})
    monkeypatch.setattr(handler.get_settings(), "resume_grace_s", 0)
    monkeypatch.setattr(handler, "resolve_keys", lambda user_id: ResolvedKeys("nv", "or", "dg"))
    monkeypatch.setattr(handler.manager, "send_to_session", send_to_session)
    monkeypatch.setattr(handler, "get_session", lambda token, sid: SimpleNamespace(data={"leetcode_title": "T"}))
    for name in (
        "update_session", "log_transcript", "log_state_transition", "save_turn_metrics",
        "upsert_session_usage", "save_code_snapshot",
    ):
        monkeypatch.setattr(handler, name, noop)
    monkeypatch.setattr(handler, "create_llm_provider", lambda *a, **k: llm)
    monkeypatch.setattr(handler, "DeepgramTTSClient", FakeTTS)
    monkeypatch.setattr(handler, "_run_debrief", run_debrief)

    asyncio.run(asyncio.wait_for(handler.handle_interview_websocket(fake_ws, "s", "t", "u"), 2))
    return fake_ws, debriefs


def test_interrupt_cancels_running_turn(monkeypatch):
    llm = ScriptedLLM()
    fake_ws, debriefs = run_session(
        monkeypatch,
        [AfterSent("AUDIO_FINISHED"), {"type": "USER_UTTERANCE", "text": "my answer"}, {"type": "INTERRUPT"}],
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
        [AfterSent("AUDIO_FINISHED"), {"type": "USER_UTTERANCE", "text": "my answer"}, {"type": "PING"}, WebSocketDisconnect()],
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


def test_dropped_after_three_turns_runs_debrief(monkeypatch):
    llm = InstantLLM()
    fake_ws, debriefs = run_session(
        monkeypatch,
        [
            AfterSent("AUDIO_FINISHED", 1), {"type": "USER_UTTERANCE", "text": "one"},
            AfterSent("AUDIO_FINISHED", 2), {"type": "USER_UTTERANCE", "text": "two"},
            AfterSent("AUDIO_FINISHED", 3), {"type": "USER_UTTERANCE", "text": "three"},
            AfterSent("AUDIO_FINISHED", 4), WebSocketDisconnect(),
        ],
        llm,
    )

    assert len(debriefs) == 1
    assert debriefs[0].user_turns == 3
    assert llm.closed


def test_dropped_after_one_turn_skips_debrief(monkeypatch):
    llm = InstantLLM()
    fake_ws, debriefs = run_session(
        monkeypatch,
        [AfterSent("AUDIO_FINISHED", 1), {"type": "USER_UTTERANCE", "text": "one"}, AfterSent("AUDIO_FINISHED", 2), WebSocketDisconnect()],
        llm,
    )

    assert debriefs == []
    assert llm.closed

import asyncio
import os
from contextlib import asynccontextmanager

import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")

import websocket.handler as handler
from services.llm.base import LLMProvider
from state_machine.machine import StateMachine
from state_machine.states import InterviewState

MESSAGES = [{"role": "system", "content": "You are an interviewer."}, {"role": "user", "content": "Hi."}]
SENTENCE_REPLY = "STATE: AWAITING_APPROACH\nFirst sentence is right here. Second one follows now. "


class FakeLLM(LLMProvider):
    """Streams the reply in 7-character pieces. Logs when the stream finishes, so ordering can be checked."""

    def __init__(self, log, reply=SENTENCE_REPLY, stream_error=None, fallback=None):
        self.log = log
        self.reply = reply
        self.stream_error = stream_error
        self.fallback = fallback or {"response_text": "Fallback line here.", "next_state": "AWAITING_CLARIFICATION"}
        self.structured_calls = []
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "fake"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("the interview turns use stream or generate_structured")

    async def stream(self, messages, temperature=0.6, max_tokens=400):
        if self.stream_error is not None:
            raise self.stream_error
        for i in range(0, len(self.reply), 7):
            yield self.reply[i:i + 7]
        self.log.append(("llm-done",))

    async def generate_structured(self, messages, json_schema, temperature=0.5, max_attempts=3):
        self.structured_calls.append(max_attempts)
        return self.fallback

    def usage_snapshot(self):
        return (0, 0, 0)


class FakeSession:
    """Each speak yields one 3-byte audio chunk; end() lets audio() finish once the queue is drained."""

    def __init__(self, log):
        self.log = log
        self.queue: asyncio.Queue = asyncio.Queue()

    async def speak(self, text):
        self.log.append(("speak", text))
        self.queue.put_nowait(b"\x01\x02\x03")

    async def end(self):
        self.queue.put_nowait(None)

    async def audio(self):
        while True:
            item = await self.queue.get()
            if item is None:
                return
            yield item


class FakeTTS:
    def __init__(self, log):
        self.log = log
        self.closed = False

    @asynccontextmanager
    async def session(self):
        try:
            yield FakeSession(self.log)
        finally:
            self.closed = True


def make_ctx(llm, tts, state=InterviewState.AWAITING_CLARIFICATION):
    return handler._InterviewContext(
        session_id="s",
        token="t",
        sm=StateMachine(state),
        llm=llm,
        tts=tts,
        problem_context={"title": "T", "difficulty": "Easy", "description": "d", "topics": [], "language": "python"},
    )


@pytest.fixture
def wire(monkeypatch):
    """Record every frame and JSON message the turn sends, and skip persistence."""
    sent = {"json": [], "bytes": []}

    async def send_to_session(session_id, message):
        sent["json"].append(message)

    async def send_bytes(session_id, data):
        sent["bytes"].append(data)

    async def no_op(fn, *args, **kwargs):
        return None

    monkeypatch.setattr(handler.manager, "send_to_session", send_to_session)
    monkeypatch.setattr(handler.manager, "send_bytes", send_bytes)
    monkeypatch.setattr(handler, "_safe", no_op)
    return sent


def test_speaks_each_sentence_before_the_stream_ends(wire):
    log = []
    llm = FakeLLM(log)
    ctx = make_ctx(llm, FakeTTS(log))

    text, next_state = asyncio.run(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))

    assert text == "First sentence is right here. Second one follows now."
    assert next_state == "AWAITING_APPROACH"
    speaks = [i for i, e in enumerate(log) if e[0] == "speak"]
    done = log.index(("llm-done",))
    assert len(speaks) == 2
    assert speaks[0] < done
    assert ctx.sm.current_state == InterviewState.AWAITING_APPROACH


def test_audio_is_sent_as_even_length_binary_frames(wire):
    log = []
    ctx = make_ctx(FakeLLM(log), FakeTTS(log))

    asyncio.run(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))

    assert wire["bytes"]
    assert all(len(frame) % 2 == 0 for frame in wire["bytes"])
    assert sum(len(frame) for frame in wire["bytes"]) == 6  # two 3-byte chunks, nothing lost to framing
    assert {"type": "AUDIO_FINISHED"} in wire["json"]


def test_ai_text_grows_with_each_sentence(wire):
    log = []
    ctx = make_ctx(FakeLLM(log), FakeTTS(log))

    asyncio.run(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))

    texts = [m["text"] for m in wire["json"] if m.get("type") == "AI_TEXT"]
    assert texts[0] == "First sentence is right here."
    assert texts[-1] == "First sentence is right here. Second one follows now."


def test_silence_in_awaiting_code_speaks_nothing_and_is_recorded(wire):
    log = []
    llm = FakeLLM(log, reply="STATE: AWAITING_CODE\n")
    ctx = make_ctx(llm, FakeTTS(log), state=InterviewState.AWAITING_CODE)

    text, next_state = asyncio.run(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))

    assert text == ""
    assert next_state == "AWAITING_CODE"
    assert not [e for e in log if e[0] == "speak"]
    assert llm.structured_calls == []
    assert {"type": "AUDIO_FINISHED"} in wire["json"]
    assert ctx.conversation_history[-1] == {"role": "assistant", "content": "(listens quietly)"}


def test_empty_reply_outside_awaiting_code_falls_back_to_structured(wire):
    log = []
    llm = FakeLLM(log, reply="STATE: AWAITING_APPROACH\n")
    ctx = make_ctx(llm, FakeTTS(log))

    text, _ = asyncio.run(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))

    assert llm.structured_calls == [1]
    assert text == "Fallback line here."
    assert ("speak", "Fallback line here.") in log


def test_stream_error_before_any_text_falls_back_to_structured(wire):
    log = []
    llm = FakeLLM(log, stream_error=RuntimeError("upstream down"))
    ctx = make_ctx(llm, FakeTTS(log))

    text, next_state = asyncio.run(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))

    assert llm.structured_calls == [1]
    assert text == "Fallback line here."
    assert next_state == "AWAITING_CLARIFICATION"
    assert ("speak", "Fallback line here.") in log


def test_cancelling_a_streaming_turn_closes_the_tts_socket(wire):
    log = []

    class BlockingLLM(FakeLLM):
        async def stream(self, messages, temperature=0.6, max_tokens=400):
            yield "STATE: AWAITING_APPROACH\nFirst sentence is right here. "
            await asyncio.Event().wait()

    tts = FakeTTS(log)
    ctx = make_ctx(BlockingLLM(log), tts)

    async def run():
        task = asyncio.create_task(handler._stream_turn(ctx, MESSAGES, ctx.sm.current_state, "reply"))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    assert tts.closed
    assert ("speak", "First sentence is right here.") in log


def test_speak_fixed_speaks_text_and_records_history(wire):
    log = []
    tts = FakeTTS(log)
    ctx = make_ctx(FakeLLM(log), tts)

    asyncio.run(handler._speak_fixed(ctx, "Quick heads-up.", InterviewState.AWAITING_CODE, "notice"))

    assert ("speak", "Quick heads-up.") in log
    assert ctx.conversation_history == [{"role": "assistant", "content": "Quick heads-up."}]
    assert ctx.turn_index == 1
    assert tts.closed
    assert {"type": "AUDIO_FINISHED"} in wire["json"]

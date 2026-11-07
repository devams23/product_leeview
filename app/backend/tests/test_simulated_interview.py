"""Whole interviews driven through the real WebSocket handler, with every external service scripted.

The LLM calls go through the real NVIDIA NIM and OpenRouter providers and the fallback chain, but
their HTTP lands on a MockTransport. TTS and Supabase are fakes. No test here makes a network call.
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi import WebSocketDisconnect

import websocket.handler as handler
from config import get_settings
from services.keys import ResolvedKeys
from services.llm import factory
from services.llm.base import LLMProvider
from tests.fakes import ScriptedAPI, completion, down, sse
from tests.test_receive_loop import AfterSent, FakeTTS, FakeWebSocket

CODE = "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n"

INTERVIEWER = [
    "STATE: AWAITING_CLARIFICATION\nHi, I'm your interviewer today. We're doing Two Sum. Any questions before you start?",
    "STATE: AWAITING_APPROACH\nYes, negative numbers can appear in the input. How would you approach it?",
    "STATE: AWAITING_CODE\nA hash map of complements sounds right to me. Go ahead and code it up.",
    "STATE: AWAITING_WALKTHROUGH\nLooks complete from here. Walk me through it and its complexity, please.",
    "STATE: CONCLUDING\nThat's a clear explanation of the linear solution. Any questions for me?",
    "STATE: GENERATING_DEBRIEF\nThanks for your time today, it was good talking with you. Goodbye.",
]
CANDIDATE = [
    {"text": "Can the numbers be negative?"},
    {"text": "I'd keep a hash map from value to index and look up each complement."},
    {"text": "Okay, I'm done coding.", "current_code": CODE, "language": "python"},
    {"text": "One pass, so linear time and linear space for the map.", "current_code": CODE},
    {"text": "No questions, thank you."},
]
SCORES = {
    "approach_score": 8, "communication_score": 7, "code_correctness_score": 9,
    "code_quality_score": 8, "time_management_score": 7, "overall_score": 8,
    "actionable_feedback": ["State edge cases before coding."], "similar_problems": ["3Sum"],
    "summary": "Solid hash-map solution.", "headline": "Clean and quick",
}
REAL_WORLD = {
    "real_world_scenario": "Matching payments to invoices.", "real_world_naive_approach": "Nested loops.",
    "real_world_why_wins": "One pass.", "senior_follow_up": "What if the data does not fit in memory?",
}


class Persistence:
    """Every Supabase write the handler makes, in memory."""

    def __init__(self, status="PREPARING", saved=None):
        self.status = status
        self.saved = saved
        self.calls: list[tuple] = []

    def install(self, monkeypatch):
        def recorder(name):
            return lambda *args, **kwargs: self.calls.append((name, args, kwargs))

        for name in (
            "update_session", "log_transcript", "log_state_transition", "save_turn_metrics",
            "upsert_session_usage", "save_code_snapshot", "save_debrief",
        ):
            monkeypatch.setattr(handler, name, recorder(name))
        monkeypatch.setattr(handler, "get_session", lambda token, sid: SimpleNamespace(data={
            "leetcode_title": "Two Sum", "problem_difficulty": "Easy", "problem_description": "Find two numbers.",
            "problem_topics": ["Array", "Hash Table"], "problem_language": "python",
            "status": self.status, "started_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
        }))
        monkeypatch.setattr(handler, "load_resume_state", lambda token, sid: self.saved or {"transcript": []})

    def named(self, name):
        return [(args, kwargs) for n, args, kwargs in self.calls if n == name]


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(handler, "_LIVE", {})
    monkeypatch.setattr(handler.manager, "active_connections", {})
    monkeypatch.setattr(handler, "DeepgramTTSClient", FakeTTS)
    monkeypatch.setattr(handler, "resolve_keys", lambda user_id: ResolvedKeys("nim-key", "or-key", "dg-key"))
    monkeypatch.setattr(get_settings(), "llm_provider", "nvidia_nim")
    monkeypatch.setattr(get_settings(), "resume_grace_s", 0)
    store = Persistence()
    store.install(monkeypatch)
    return store


def connect(ws, user="u1"):
    return handler.handle_interview_websocket(ws, "s1", "jwt", user)


def utterance(i):
    return {"type": "USER_UTTERANCE", **CANDIDATE[i]}


def test_full_interview_with_nim_down_runs_on_openrouter_and_ends_in_a_debrief(env, monkeypatch):
    nim_api = ScriptedAPI(down(503))
    replies = iter(INTERVIEWER)

    def openrouter(body):
        if body.get("stream"):
            return httpx.Response(200, text=sse(next(replies), usage={"prompt_tokens": 50, "completion_tokens": 20}))
        real_world = "senior_follow_up" in json.dumps(body["messages"])
        return httpx.Response(200, json=completion(json.dumps(REAL_WORLD if real_world else SCORES)))

    or_api = ScriptedAPI(openrouter)
    built = []

    def create(keys=None):
        llm = factory.create_llm_provider(keys)
        nim, router = llm.providers
        nim_api.attach(nim)
        or_api.attach(router)
        built.append(llm)
        return llm

    monkeypatch.setattr(handler, "create_llm_provider", create)
    incoming = []
    for i in range(len(CANDIDATE)):
        incoming += [AfterSent("AUDIO_FINISHED", i + 1), utterance(i)]
    ws = FakeWebSocket(incoming)

    asyncio.run(asyncio.wait_for(connect(ws), 5))

    states = [m["state"] for m in ws.sent if m["type"] == "STATE_CHANGED"]
    assert states == [
        "AWAITING_CLARIFICATION", "AWAITING_APPROACH", "AWAITING_CODE",
        "AWAITING_WALKTHROUGH", "CONCLUDING", "GENERATING_DEBRIEF",
    ]
    ready = [m for m in ws.sent if m["type"] == "DEBRIEF_READY"]
    assert len(ready) == 1 and ready[0]["data"]["overall_score"] == 8
    assert ready[0]["data"]["real_world_scenario"] == REAL_WORLD["real_world_scenario"]
    assert ws.audio, "the interviewer's audio reached the client as binary frames"

    # NIM failed once, then sat out its cooldown; OpenRouter answered every call with the user's key.
    assert len(nim_api.requests) == 1
    assert len(or_api.requests) == len(INTERVIEWER) + 2
    assert set(or_api.auth) == {"Bearer or-key"}
    assert nim_api.auth == ["Bearer nim-key"]

    # The code rides only on the newest message, never repeated through the history.
    for body in or_api.requests:
        if body.get("stream"):
            assert sum(CODE in m["content"] for m in body["messages"]) <= 1

    assert any(kw.get("status") == "COMPLETED" for _, kw in env.named("update_session"))
    assert env.named("save_debrief")[0][0][2]["overall_score"] == 8
    assert len(built) == 1


class RecordingLLM(LLMProvider):
    """Replies at once and keeps every prompt it was sent."""

    def __init__(self):
        self.prompts: list[list[dict]] = []
        self.closed = False
        self.last_attempts = 1

    @property
    def provider_name(self):
        return "recording"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        raise AssertionError("turns stream")

    async def stream(self, messages, temperature=0.6, max_tokens=400):
        self.prompts.append(messages)
        yield "STATE: AWAITING_CLARIFICATION\nThat makes sense to me, please go on. "

    def usage_snapshot(self):
        return (0, 0, 0)

    async def aclose(self):
        self.closed = True


@pytest.fixture
def recorded(env, monkeypatch):
    llm = RecordingLLM()
    created = []
    debriefs = []

    def create(keys=None):
        created.append(keys)
        return llm

    async def run_debrief(ctx):
        debriefs.append(ctx)

    monkeypatch.setattr(handler, "create_llm_provider", create)
    monkeypatch.setattr(handler, "_run_debrief", run_debrief)
    return SimpleNamespace(llm=llm, created=created, debriefs=debriefs, store=env)


def spoken(ws):
    return [m["text"] for m in ws.sent if m["type"] == "AI_TEXT"]


def test_dropped_socket_resumes_the_same_interview(recorded, monkeypatch):
    monkeypatch.setattr(get_settings(), "resume_grace_s", 5)
    first = FakeWebSocket([
        AfterSent("AUDIO_FINISHED", 1), {"type": "USER_UTTERANCE", "text": "My first answer is here."},
        AfterSent("AUDIO_FINISHED", 2), WebSocketDisconnect(1006),
    ])
    second = FakeWebSocket([
        AfterSent("AUDIO_FINISHED", 1), {"type": "USER_UTTERANCE", "text": "And my second answer."},
        AfterSent("AUDIO_FINISHED", 2), {"type": "INTERRUPT"},
    ])

    async def scenario():
        await connect(first)
        assert handler._LIVE["s1"].running is False  # parked, waiting for the candidate
        await connect(second)

    asyncio.run(asyncio.wait_for(scenario(), 5))

    assert handler.RESUME_TEXT in spoken(second)[0]
    assert {"type": "STATE_CHANGED", "state": "AWAITING_CLARIFICATION"} in second.sent
    # One provider for the whole interview, and the second connection's prompt remembers the first.
    assert len(recorded.created) == 1
    last_prompt = " ".join(m["content"] for m in recorded.llm.prompts[-1])
    assert "My first answer is here." in last_prompt
    assert len(recorded.llm.prompts) == 3  # intro, first answer, second answer: no second intro
    assert len(recorded.debriefs) == 1 and recorded.debriefs[0].user_turns == 2
    assert "s1" not in handler._LIVE


def test_new_connection_takes_over_a_half_open_one(recorded, monkeypatch):
    monkeypatch.setattr(get_settings(), "resume_grace_s", 5)
    first = FakeWebSocket([AfterSent("AUDIO_FINISHED", 1), {"type": "USER_UTTERANCE", "text": "An answer before the wifi died."}])
    second = FakeWebSocket([AfterSent("AUDIO_FINISHED", 1), {"type": "INTERRUPT"}])

    async def scenario():
        old = asyncio.create_task(connect(first))
        while sum(m["type"] == "AUDIO_FINISHED" for m in first.sent) < 2:
            await asyncio.sleep(0.005)
        await connect(second)
        await asyncio.wait_for(old, 1)  # the old loop stepped aside instead of hanging

    asyncio.run(asyncio.wait_for(scenario(), 5))

    assert handler.RESUME_TEXT in spoken(second)[0]
    assert len(recorded.debriefs) == 1 and recorded.debriefs[0].user_turns == 1
    assert not [m for m in first.sent if m["type"] == "DEBRIEF_GENERATING"]


def test_no_reconnect_within_the_grace_period_wraps_up(recorded, monkeypatch):
    monkeypatch.setattr(get_settings(), "resume_grace_s", 0.05)
    incoming = []
    for i in range(3):
        incoming += [AfterSent("AUDIO_FINISHED", i + 1), {"type": "USER_UTTERANCE", "text": f"Answer number {i}."}]
    incoming += [AfterSent("AUDIO_FINISHED", 4), WebSocketDisconnect(1006)]
    ws = FakeWebSocket(incoming)

    async def scenario():
        await connect(ws)
        assert recorded.debriefs == []  # still waiting for a reconnect
        await asyncio.sleep(0.2)

    asyncio.run(asyncio.wait_for(scenario(), 5))

    assert len(recorded.debriefs) == 1
    assert recorded.llm.closed
    assert "s1" not in handler._LIVE
    statuses = [kw.get("status") for _, kw in recorded.store.named("update_session")]
    assert statuses[-1] == "INTERRUPTED"


def test_after_a_restart_the_interview_is_rebuilt_from_supabase(recorded):
    recorded.store.status = "INTERRUPTED"
    recorded.store.saved = {
        "transcript": [
            {"speaker": "AI", "text": "Welcome, let's do Two Sum."},
            {"speaker": "USER", "text": "I'll use a hash map."},
        ],
        "state": "AWAITING_CODE",
        "code": {"code": CODE, "language": "python"},
    }
    ws = FakeWebSocket([AfterSent("AUDIO_FINISHED", 1), {"type": "USER_UTTERANCE", "text": "Done now."}, AfterSent("AUDIO_FINISHED", 2), {"type": "INTERRUPT"}])

    asyncio.run(asyncio.wait_for(connect(ws), 5))

    assert ws.sent[0] == {"type": "STATE_CHANGED", "state": "AWAITING_CODE"}
    assert handler.RESUME_TEXT in spoken(ws)[0]
    prompt = " ".join(m["content"] for m in recorded.llm.prompts[0])
    assert "I'll use a hash map." in prompt and "Welcome, let's do Two Sum." in prompt
    ctx = recorded.debriefs[0]
    assert ctx.user_turns == 2 and ctx.last_code == CODE


def test_completed_session_is_refused(recorded):
    recorded.store.status = "COMPLETED"
    ws = FakeWebSocket([])
    asyncio.run(asyncio.wait_for(connect(ws), 2))
    assert ws.sent == [{"type": "ERROR", "code": "SESSION_ENDED", "message": "This interview has already ended."}]
    assert ws.closed[0] == 1008
    assert recorded.created == []


def test_missing_keys_are_reported_before_anything_runs(recorded, monkeypatch):
    monkeypatch.setattr(handler, "resolve_keys", lambda user_id: ResolvedKeys(deepgram="dg"))
    ws = FakeWebSocket([])
    asyncio.run(asyncio.wait_for(connect(ws), 2))
    assert ws.sent[0]["code"] == "KEYS_MISSING"
    assert ws.closed[0] == 1008
    assert recorded.created == []


def test_someone_else_cannot_claim_a_parked_session(recorded, monkeypatch):
    monkeypatch.setattr(get_settings(), "resume_grace_s", 5)
    first = FakeWebSocket([AfterSent("AUDIO_FINISHED", 1), WebSocketDisconnect(1006)])
    intruder = FakeWebSocket([])

    async def scenario():
        await connect(first)
        await connect(intruder, user="u2")
        assert handler._LIVE["s1"].running is False

    asyncio.run(asyncio.wait_for(scenario(), 5))
    assert intruder.sent[0]["code"] == "SESSION_UNAVAILABLE"


def test_oversized_input_is_capped_before_the_prompt(recorded):
    huge_code = "x = 1\n" * 20_000
    ws = FakeWebSocket([
        AfterSent("AUDIO_FINISHED", 1),
        {"type": "USER_UTTERANCE", "text": "word " * 5_000, "current_code": huge_code},
        AfterSent("AUDIO_FINISHED", 2), {"type": "INTERRUPT"},
    ])
    asyncio.run(asyncio.wait_for(connect(ws), 5))

    newest = recorded.llm.prompts[-1][-1]["content"]
    assert len(newest) < handler.MAX_UTTERANCE_CHARS + handler.MAX_CODE_CHARS + 200


def test_prompt_history_is_windowed():
    history = [{"role": "user", "content": f"m{i}"} for i in range(200)]
    messages = handler.build_interview_prompt(handler.InterviewState.AWAITING_CODE, {}, history, "now", "")
    assert len(messages) == 1 + handler.HISTORY_WINDOW + 1
    assert messages[1]["content"] == f"m{200 - handler.HISTORY_WINDOW}"

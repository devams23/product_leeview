import asyncio
import logging
import os

import httpx
import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")

from main import RedactTokens
from services.llm.base import LLMProvider
from services.llm.structured import StructuredOutputError, extract_json, schema_errors, with_json_instructions
from state_machine.machine import StateMachine
from state_machine.states import InterviewState
from websocket.handler import _apply_llm_transition, build_interview_prompt, interview_schema

GOOD = '{"response_text": "Go on.", "next_state": "AWAITING_CODE"}'
SCHEMA = interview_schema(InterviewState.AWAITING_APPROACH)
MESSAGES = [
    {"role": "system", "content": "You are an interviewer."},
    {"role": "assistant", "content": "What's your approach?"},
    {"role": "user", "content": "Candidate: a hash map."},
]


def http_error(status: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://test")
    return httpx.HTTPStatusError(str(status), request=request, response=httpx.Response(status, request=request))


class Scripted(LLMProvider):
    """Plays back replies, raising any that are exceptions, and records every request."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.requests = []

    @property
    def provider_name(self):
        return "scripted"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        self.requests.append({"messages": messages, "response_format": response_format})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch):
    async def instant(_):
        return None
    monkeypatch.setattr("services.llm.base.asyncio.sleep", instant)


def structured(llm):
    return asyncio.run(llm.generate_structured(MESSAGES, SCHEMA))


def test_reminder_comes_after_the_prose_history():
    messages = with_json_instructions(MESSAGES, SCHEMA)
    assert sum(m["role"] == "system" for m in messages) == 1
    assert "Reply with only a JSON object" in messages[-1]["content"]
    assert "Candidate: a hash map." in messages[-1]["content"]
    assert "Reply" not in MESSAGES[-1]["content"]


def test_prompt_with_no_user_turn_still_ends_with_a_reminder():
    messages = with_json_instructions(build_interview_prompt(InterviewState.INTRO, {}, []), SCHEMA)
    assert messages[-1]["role"] == "user"


def test_requests_schema_enforcement():
    llm = Scripted(GOOD)
    assert structured(llm)["next_state"] == "AWAITING_CODE"
    assert llm.requests[0]["response_format"]["json_schema"]["schema"] == SCHEMA


def test_prose_retry_tells_the_model_what_went_wrong():
    llm = Scripted("That sounds good. Walk me through it.", GOOD)
    assert structured(llm)["response_text"] == "Go on."
    retry = llm.requests[1]["messages"]
    assert retry[-2] == {"role": "assistant", "content": "That sounds good. Walk me through it."}
    assert "no JSON object" in retry[-1]["content"]


def test_illegal_next_state_is_retried():
    llm = Scripted('{"response_text": "Bye", "next_state": "COMPLETED"}', GOOD)
    assert structured(llm)["next_state"] == "AWAITING_CODE"
    assert "next_state" in llm.requests[1]["messages"][-1]["content"]


def test_gives_up_with_a_clear_error():
    with pytest.raises(StructuredOutputError):
        structured(Scripted("prose", "prose", "prose"))


def test_model_without_response_format_falls_back_to_the_prompt():
    llm = Scripted(http_error(400), GOOD, GOOD)
    structured(llm)
    structured(llm)
    assert [r["response_format"] is None for r in llm.requests] == [False, True, True]


@pytest.mark.parametrize("error", [http_error(429), http_error(503), httpx.ReadTimeout("slow")])
def test_transient_failures_are_retried(error):
    assert structured(Scripted(error, GOOD))["response_text"] == "Go on."


def test_auth_failures_are_not_retried():
    llm = Scripted(http_error(401), GOOD)
    with pytest.raises(httpx.HTTPStatusError):
        structured(llm)
    assert len(llm.requests) == 1


@pytest.mark.parametrize("text", [
    GOOD,
    f"```json\n{GOOD}\n```",
    f"Sure! Here it is:\n{GOOD}\nHope that helps {{smile}}",
    f"<think>maybe {{not this}}</think>{GOOD}",
])
def test_extract_json_finds_the_object(text):
    assert extract_json(text)["next_state"] == "AWAITING_CODE"


def test_empty_response_text_is_rejected():
    assert schema_errors({"response_text": " ", "next_state": "AWAITING_CODE"}, SCHEMA)


def test_intro_must_move_on_but_later_phases_can_stay():
    assert interview_schema(InterviewState.INTRO)["properties"]["next_state"]["enum"] == ["AWAITING_CLARIFICATION"]
    assert "AWAITING_CODE" in interview_schema(InterviewState.AWAITING_CODE)["properties"]["next_state"]["enum"]


def test_staying_put_does_not_skip_a_phase():
    sm = StateMachine(InterviewState.AWAITING_CODE)
    assert _apply_llm_transition(sm, "AWAITING_CODE", "s") is None
    assert sm.current_state == InterviewState.AWAITING_CODE


def test_illegal_move_stays_put():
    sm = StateMachine(InterviewState.CONCLUDING)
    assert _apply_llm_transition(sm, "AWAITING_CODE", "s") is None
    assert sm.current_state == InterviewState.CONCLUDING


def test_legal_move_is_applied():
    sm = StateMachine(InterviewState.AWAITING_CODE)
    moved = _apply_llm_transition(sm, "AWAITING_WALKTHROUGH", "s")
    assert moved == (InterviewState.AWAITING_CODE, InterviewState.AWAITING_WALKTHROUGH, "LLM_SUGGESTION")


def test_jwt_is_redacted_from_websocket_logs():
    record = logging.LogRecord(
        "uvicorn.error", logging.INFO, "", 0, '%s - "WebSocket %s" [accepted]',
        ("127.0.0.1", "/ws/interview/abc?token=eyJhbGci.payload.sig"), None,
    )
    RedactTokens().filter(record)
    assert "eyJ" not in record.getMessage()
    assert "token=[redacted]" in record.getMessage()

"""Run real interview and debrief prompts through the configured LLM and report schema failures.

Run from app/backend:  .venv/Scripts/python scripts/check_llm_output.py [rounds]
Uses the backend's own provider and .env. Prints models, timings and replies, never the key.
"""
import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
# auth.py insists on this at import time; nothing here verifies a token.
os.environ.setdefault("SUPABASE_JWT_SECRET", "unused-by-this-check")

import httpx  # noqa: E402

from debrief.prompts import DEBRIEF_JSON_SCHEMA, DEBRIEF_SCORING_PROMPT, REAL_WORLD_PROMPT  # noqa: E402
from services.llm import create_llm_provider  # noqa: E402
from services.llm.structured import schema_errors  # noqa: E402
from state_machine.states import InterviewState  # noqa: E402
from websocket.handler import build_interview_prompt, interview_schema  # noqa: E402

REAL_WORLD_SCHEMA = {
    "type": "object",
    "properties": {k: {"type": "string"} for k in (
        "real_world_scenario", "real_world_naive_approach", "real_world_why_wins", "senior_follow_up",
    )},
    "required": ["real_world_scenario", "real_world_naive_approach", "real_world_why_wins", "senior_follow_up"],
}

PROBLEM = {
    "title": "Two Sum",
    "difficulty": "Easy",
    "language": "python",
    "topics": ["Array", "Hash Table"],
    "description": (
        "Given an array of integers nums and an integer target, return indices of the two numbers such that "
        "they add up to target. You may assume that each input would have exactly one solution, and you may "
        'not use the same element twice.\n\nExample 1:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n'
        'Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].'
    ),
}

CODE = (
    "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n"
    '        seen = {}  # value -> "index"\n        for i, n in enumerate(nums):\n'
    "            if target - n in seen:\n                return [seen[target - n], i]\n"
    "            seen[n] = i\n"
)

HISTORY = [
    {"role": "assistant", "content": "Hi, thanks for joining. Let's look at Two Sum. Any questions about it?"},
    {"role": "user", "content": "Candidate: Can the array contain duplicates, and is it sorted?"},
    {"role": "assistant", "content": "It can contain duplicates and it is not sorted. What's your approach?"},
    {"role": "user", "content": f"Candidate: I'd use a hash map of value to index.\n\n[Code Snapshot]:\n{CODE}"},
    {"role": "assistant", "content": "Good. Walk me through it, and what's the complexity?"},
]

TURNS = [
    ("intro", InterviewState.INTRO, [], "", ""),
    ("clarify", InterviewState.AWAITING_CLARIFICATION, HISTORY[:1], "Can the array contain duplicates?", ""),
    ("approach", InterviewState.AWAITING_APPROACH, HISTORY[:3], "I'd use a hash map of value to index.", ""),
    ("code", InterviewState.AWAITING_CODE, HISTORY[:4], "Okay, I've finished coding it.", CODE),
    ("walkthrough", InterviewState.AWAITING_WALKTHROUGH, HISTORY, "It's O(n) time and O(n) space.", CODE),
    ("concluding", InterviewState.CONCLUDING, HISTORY, "No more questions from me, thanks.", CODE),
]

DEBRIEF_DATA = {
    **PROBLEM,
    "transcript": json.dumps(HISTORY),
    "code_snapshots": CODE,
    "time_per_state": "INTRO: 12s, AWAITING_APPROACH: 90s, AWAITING_CODE: 240s",
    "state_transitions": "INTRO -> AWAITING_CLARIFICATION (LLM_SUGGESTION)",
    "algorithm": "Array",
}


class Recorder:
    """Wraps provider.generate to count attempts and capture why each reply ended."""

    def __init__(self, provider):
        self.provider = provider
        self.calls: list[dict] = []
        provider.generate = self.generate

    async def generate(self, messages, temperature=0.7, **kwargs):
        payload = {
            "model": self.provider.model, "messages": messages, "temperature": temperature, "max_tokens": 1024,
            **kwargs,
        }
        start = time.time()
        async with httpx.AsyncClient(timeout=self.provider.timeout) as client:
            r = await client.post(
                f"{self.provider.base_url}/chat/completions", headers=self.provider.headers, json=payload,
            )
        if r.is_error:
            raise httpx.HTTPStatusError(f"HTTP {r.status_code}: {r.text[:200]}", request=r.request, response=r)
        choice = r.json()["choices"][0]
        text = choice["message"].get("content") or ""
        self.calls.append({
            "seconds": round(time.time() - start, 1),
            "finish": choice.get("finish_reason"),
            "text": text,
        })
        return text


async def probe(provider, recorder, name, messages, schema) -> dict:
    recorder.calls.clear()
    start = time.time()
    outcome, detail, parsed = "ok", "", None
    try:
        parsed = await provider.generate_structured(messages, schema)
        problems = schema_errors(parsed, schema)
        if problems:
            outcome, detail = "SCHEMA", "; ".join(problems)
    except Exception as e:
        outcome, detail = "FAILED", f"{type(e).__name__}: {str(e)[:160]}"
    attempts = len(recorder.calls)
    finishes = ",".join(str(c["finish"]) for c in recorder.calls)
    flag = " RETRIED" if attempts > 1 else ""
    print(f"{outcome:7s} {name:12s} attempts={attempts} {time.time() - start:5.1f}s finish={finishes}{flag} {detail}")
    if outcome != "ok" or attempts > 1:
        for c in recorder.calls:
            print(f"        raw[{len(c['text'])} chars]: {c['text'][:400]!r}")
            if len(c["text"]) > 400:
                print(f"        ...tail: {c['text'][-120:]!r}")
    elif "next_state" in (parsed or {}):
        print(f"        next_state={parsed['next_state']}  says: {str(parsed['response_text'])[:110]!r}")
    return {"name": name, "outcome": outcome, "attempts": attempts}


async def main() -> None:
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    provider = create_llm_provider()
    print(f"provider={provider.provider_name} model={getattr(provider, 'model', '?')} rounds={rounds}\n")
    recorder = Recorder(provider)
    results = []
    for i in range(rounds):
        print(f"--- round {i + 1}")
        for name, state, history, text, code in TURNS:
            messages = build_interview_prompt(state, PROBLEM, history, text, code)
            results.append(await probe(provider, recorder, name, messages, interview_schema(state)))
        scoring = [
            {"role": "system", "content": "You are an expert technical interviewer. Return JSON only."},
            {"role": "user", "content": DEBRIEF_SCORING_PROMPT.format(**DEBRIEF_DATA)},
        ]
        results.append(await probe(provider, recorder, "debrief", scoring, DEBRIEF_JSON_SCHEMA))
        real_world = [{"role": "user", "content": REAL_WORLD_PROMPT.format(**DEBRIEF_DATA)}]
        results.append(await probe(provider, recorder, "real_world", real_world, REAL_WORLD_SCHEMA))

    bad = [r for r in results if r["outcome"] != "ok"]
    retried = [r for r in results if r["attempts"] > 1]
    print(f"\n{len(results)} calls: {len(bad)} failed or off-schema, {len(retried)} needed a retry")


if __name__ == "__main__":
    asyncio.run(main())

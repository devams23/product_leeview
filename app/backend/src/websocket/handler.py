import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import WebSocket, WebSocketDisconnect

from websocket.manager import manager
from state_machine.machine import StateMachine
from state_machine.states import InterviewState
from services.llm import create_llm_provider
from services.deepgram import DeepgramTTSClient
from services.supabase_client import (
    get_session,
    log_state_transition,
    log_transcript,
    save_code_snapshot,
    save_debrief,
    update_session,
)
from debrief.engine import DebriefEngine

logger = logging.getLogger(__name__)

INTERVIEW_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "response_text": {"type": "string"},
        "next_state": {"type": "string", "enum": [s.value for s in InterviewState]},
    },
    "required": ["response_text", "next_state"],
    "additionalProperties": False,
}

# Forward step used when the LLM suggests an invalid transition.
VALID_FALLBACK = {
    InterviewState.INTRO: InterviewState.AWAITING_CLARIFICATION,
    InterviewState.AWAITING_CLARIFICATION: InterviewState.AWAITING_APPROACH,
    InterviewState.AWAITING_APPROACH: InterviewState.AWAITING_CODE,
    InterviewState.AWAITING_CODE: InterviewState.AWAITING_WALKTHROUGH,
    InterviewState.AWAITING_WALKTHROUGH: InterviewState.CONCLUDING,
    InterviewState.CONCLUDING: InterviewState.GENERATING_DEBRIEF,
}

DEBRIEF_SCORE_KEYS = [
    "approach_score", "communication_score", "code_correctness_score",
    "code_quality_score", "time_management_score", "overall_score",
]

# Only these keys are written to the debriefs table; anything else the LLM
# returns would make the insert fail on an unknown column.
DEBRIEF_COLUMNS = DEBRIEF_SCORE_KEYS + [
    "actionable_feedback", "similar_problems", "summary",
    "real_world_scenario", "real_world_naive_approach", "real_world_why_wins",
    "senior_follow_up",
]


@dataclass
class _InterviewContext:
    session_id: str
    token: str
    sm: StateMachine
    llm: Any
    tts: DeepgramTTSClient
    problem_context: dict
    conversation_history: list = field(default_factory=list)
    last_code: str = ""
    language: str = "python"
    transitions: list = field(default_factory=list)  # (from_state, to_state, triggered_by)
    started_at: float = field(default_factory=time.monotonic)
    stage_entries: list = field(default_factory=list)  # (state, monotonic time it was entered)


async def _safe(fn, *args, **kwargs):
    """Run a persistence helper off the event loop. Failures are logged and swallowed."""
    try:
        return await asyncio.to_thread(fn, *args, **kwargs)
    except Exception as e:
        logger.error(f"Persistence call {getattr(fn, '__name__', fn)} failed: {e}")
        return None


async def _try_send(session_id: str, message: dict):
    """Send without letting a closed socket break the interview flow."""
    try:
        await manager.send_to_session(session_id, message)
    except Exception as e:
        logger.warning(f"[{session_id}] Could not send {message.get('type')}: {e}")


def _duration_seconds(ctx: _InterviewContext, until: Optional[float] = None) -> int:
    return int((until if until is not None else time.monotonic()) - ctx.started_at)


def _time_per_state(ctx: _InterviewContext, until: float) -> str:
    """Seconds spent in each stage, from the recorded transition times."""
    entries = [(InterviewState.INTRO, ctx.started_at)] + ctx.stage_entries
    totals: dict[str, int] = {}
    for (state, entered), nxt in zip(entries, entries[1:] + [(None, until)]):
        if state == InterviewState.GENERATING_DEBRIEF:
            continue
        totals[state.value] = totals.get(state.value, 0) + max(0, int(nxt[1] - entered))
    return ", ".join(f"{state}: {secs}s" for state, secs in totals.items()) or "N/A"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _save_code_snapshot(ctx: _InterviewContext):
    if ctx.last_code.strip():
        await _safe(save_code_snapshot, ctx.token, ctx.session_id, ctx.last_code, ctx.language)


async def _on_transition(ctx: _InterviewContext, from_state: InterviewState, to_state: InterviewState, triggered_by: str):
    ctx.transitions.append((from_state, to_state, triggered_by))
    ctx.stage_entries.append((to_state, time.monotonic()))
    await _try_send(ctx.session_id, {"type": "STATE_CHANGED", "state": to_state.value})
    await _safe(log_state_transition, ctx.token, ctx.session_id, from_state.value, to_state.value, triggered_by)
    if to_state == InterviewState.AWAITING_WALKTHROUGH:
        await _save_code_snapshot(ctx)


def _apply_llm_transition(sm: StateMachine, next_state_str: Optional[str], session_id: str):
    """Apply the LLM-suggested state, falling back to the default forward step.

    Returns (from_state, to_state, triggered_by) when the state actually changed, else None.
    """
    if not next_state_str:
        return None

    from_state = sm.current_state
    try:
        target = InterviewState(next_state_str)
    except ValueError:
        target = None

    if target is not None and sm.transition(target):
        triggered_by = "LLM_SUGGESTION"
    else:
        logger.warning(f"[{session_id}] Invalid state transition: {from_state} -> {next_state_str}, using fallback")
        fallback = VALID_FALLBACK.get(from_state)
        if fallback is None or not sm.transition(fallback):
            return None
        triggered_by = "BACKEND_OVERRIDE"

    if sm.current_state == from_state:
        return None
    return from_state, sm.current_state, triggered_by


async def _speak(ctx: _InterviewContext, text: str, state: InterviewState):
    """Log and show an AI turn, then stream its audio."""
    sid = ctx.session_id
    await _safe(log_transcript, ctx.token, sid, "AI", text, state.value)
    await _try_send(sid, {"type": "AI_TEXT", "text": text})

    try:
        chunk_count = 0
        async for chunk in ctx.tts.stream_tts(text):
            chunk_count += 1
            await manager.send_to_session(sid, {
                "type": "AUDIO_CHUNK",
                "data": chunk.hex(),
            })
        logger.info(f"[{sid}] TTS complete, sent {chunk_count} chunks")
    except Exception as e:
        logger.error(f"[{sid}] TTS failed: {e}")
        await _try_send(sid, {
            "type": "ERROR",
            "code": "TTS_FAILED",
            "message": "The interviewer's voice failed to play.",
        })

    await _try_send(sid, {"type": "AUDIO_FINISHED"})


async def send_intro(ctx: _InterviewContext):
    """Send the INTRO turn and move the state machine out of INTRO."""
    sid = ctx.session_id
    logger.info(f"[{sid}] Generating intro...")
    messages = build_interview_prompt(InterviewState.INTRO, ctx.problem_context, ctx.conversation_history, "", "")

    try:
        parsed = await ctx.llm.generate_structured(messages, INTERVIEW_RESPONSE_SCHEMA)
        response_text = parsed["response_text"]
        next_state_str = parsed.get("next_state")
    except Exception as e:
        logger.error(f"[{sid}] Intro LLM call failed: {e}")
        await _try_send(sid, {"type": "ERROR", "code": "LLM_FAILED", "message": "The interviewer could not start. Please try again."})
        await _try_send(sid, {"type": "STATE_CHANGED", "state": ctx.sm.current_state.value})
        await _try_send(sid, {"type": "AUDIO_FINISHED"})
        return

    ctx.conversation_history.append({"role": "assistant", "content": response_text})

    transition = _apply_llm_transition(ctx.sm, next_state_str, sid)
    if transition:
        await _on_transition(ctx, *transition)
    else:
        await _try_send(sid, {"type": "STATE_CHANGED", "state": ctx.sm.current_state.value})

    await _speak(ctx, response_text, ctx.sm.current_state)
    logger.info(f"[{sid}] Intro complete, state: {ctx.sm.current_state}")


async def _handle_user_utterance(ctx: _InterviewContext, data: dict):
    sid = ctx.session_id
    text = (data.get("text") or "").strip()
    if not text:
        return

    current_code = data.get("current_code") or ""
    if current_code.strip():
        ctx.last_code = current_code
    if data.get("language"):
        ctx.language = data["language"]

    state_before = ctx.sm.current_state
    logger.info(f"[{sid}] User utterance: '{text[:100]}' (state: {state_before})")

    await _try_send(sid, {"type": "AI_THINKING"})
    await _safe(log_transcript, ctx.token, sid, "USER", text, state_before.value)

    messages = build_interview_prompt(state_before, ctx.problem_context, ctx.conversation_history, text, current_code)
    try:
        parsed = await ctx.llm.generate_structured(messages, INTERVIEW_RESPONSE_SCHEMA)
        response_text = parsed["response_text"]
        next_state_str = parsed.get("next_state")
    except Exception as e:
        logger.error(f"[{sid}] LLM call failed: {e}")
        await _try_send(sid, {"type": "ERROR", "code": "LLM_FAILED", "message": "The interviewer could not respond. Please try again."})
        await _try_send(sid, {"type": "AUDIO_FINISHED"})
        return

    logger.info(f"[{sid}] LLM response: '{response_text[:100]}' next_state: {next_state_str}")

    user_msg_content = f"Candidate: {text}"
    if current_code:
        user_msg_content += f"\n\n[Code Snapshot]:\n{current_code}"
    ctx.conversation_history.append({"role": "user", "content": user_msg_content})
    ctx.conversation_history.append({"role": "assistant", "content": response_text})

    transition = _apply_llm_transition(ctx.sm, next_state_str, sid)
    if transition:
        await _on_transition(ctx, *transition)

    await _speak(ctx, response_text, ctx.sm.current_state)


def _debrief_row(debrief: dict) -> dict:
    row = {}
    for key in DEBRIEF_COLUMNS:
        value = debrief.get(key)
        if value is None:
            continue
        if key in DEBRIEF_SCORE_KEYS:
            try:
                value = max(1, min(10, int(round(float(value)))))
            except (TypeError, ValueError):
                continue
        row[key] = value
    return row


async def _run_debrief(ctx: _InterviewContext):
    sid = ctx.session_id
    await _try_send(sid, {"type": "DEBRIEF_GENERATING"})
    # The interview ends here; debrief generation time is not practice time.
    ended_at = time.monotonic()
    duration = _duration_seconds(ctx, ended_at)

    transitions_text = "\n".join(f"{f} -> {t} ({by})" for f, t, by in ctx.transitions) or "N/A"
    interview_data = {
        "title": ctx.problem_context.get("title", ""),
        "difficulty": ctx.problem_context.get("difficulty", ""),
        "description": ctx.problem_context.get("description", ""),
        "topics": ctx.problem_context.get("topics", []),
        "language": ctx.problem_context.get("language", ""),
        "transcript": json.dumps(ctx.conversation_history),
        "code_snapshots": ctx.last_code.strip() or "(no code was written)",
        "time_per_state": _time_per_state(ctx, ended_at),
        "state_transitions": transitions_text,
        "algorithm": ctx.problem_context.get("topics", ["Algorithm"])[0] if ctx.problem_context.get("topics") else "Algorithm",
    }

    try:
        logger.info(f"[{sid}] Generating debrief...")
        debrief_result = await DebriefEngine().run(interview_data)
    except Exception as e:
        logger.error(f"[{sid}] Failed to generate debrief: {e}")
        await _try_send(sid, {"type": "DEBRIEF_FAILED", "message": "The debrief could not be generated."})
        await _safe(
            update_session, ctx.token, sid,
            status="INTERRUPTED", completed_at=_now_iso(), total_duration_seconds=duration,
        )
        return

    await _try_send(sid, {"type": "DEBRIEF_READY", "data": debrief_result, "session_id": sid})
    logger.info(f"[{sid}] Sent DEBRIEF_READY")

    await _safe(save_debrief, ctx.token, sid, _debrief_row(debrief_result))
    await _safe(
        update_session, ctx.token, sid,
        status="COMPLETED", completed_at=_now_iso(), total_duration_seconds=duration,
    )


async def handle_interview_websocket(websocket: WebSocket, session_id: str, token: str):
    """Main WebSocket handler for a single interview session."""
    await manager.connect(websocket, session_id)
    sm = StateMachine()
    llm = create_llm_provider()
    tts = DeepgramTTSClient()

    logger.info(f"[{session_id}] WebSocket connected, starting interview")

    # Fetch static problem context once
    try:
        session_data = get_session(token, session_id).data
        problem_context = {
            "title": session_data.get("leetcode_title"),
            "difficulty": session_data.get("problem_difficulty"),
            "description": session_data.get("problem_description"),
            "topics": session_data.get("problem_topics"),
            "language": session_data.get("problem_language")
        }
    except Exception as e:
        logger.error(f"[{session_id}] Failed to fetch session context: {e}")
        problem_context = {}

    ctx = _InterviewContext(
        session_id=session_id,
        token=token,
        sm=sm,
        llm=llm,
        tts=tts,
        problem_context=problem_context,
        language=problem_context.get("language") or "python",
    )

    await _safe(update_session, token, session_id, status="ACTIVE")

    disconnected = False
    try:
        await send_intro(ctx)

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            logger.info(f"[{session_id}] Received WS message: {msg_type}")

            if msg_type == "USER_UTTERANCE":
                await _handle_user_utterance(ctx, data)
                if sm.current_state == InterviewState.GENERATING_DEBRIEF:
                    logger.info(f"[{session_id}] Reached GENERATING_DEBRIEF naturally")
                    break

            elif msg_type == "AUDIO_FINISHED_ACK":
                logger.debug(f"[{session_id}] Received AUDIO_FINISHED_ACK")

            elif msg_type == "INTERRUPT":
                logger.info(f"[{session_id}] Received INTERRUPT")
                from_state = sm.current_state
                sm.force_transition(InterviewState.GENERATING_DEBRIEF)
                await _on_transition(ctx, from_state, InterviewState.GENERATING_DEBRIEF, "USER_ACTION")
                break

    except WebSocketDisconnect:
        logger.info(f"[{session_id}] WebSocket disconnected")
        disconnected = True
    except Exception as e:
        logger.error(f"[{session_id}] Interview loop failed: {e}", exc_info=True)
        disconnected = True

    await _save_code_snapshot(ctx)

    if disconnected:
        manager.disconnect(session_id)
        await _safe(
            update_session, token, session_id,
            status="INTERRUPTED", completed_at=_now_iso(), total_duration_seconds=_duration_seconds(ctx),
        )
        return

    await _run_debrief(ctx)
    manager.disconnect(session_id)


def build_interview_prompt(state: InterviewState, problem_context: dict, conversation_history: list, user_text: str = "", current_code: str = "") -> list[dict]:
    """Construct the LLM prompt based on current state, static problem context, and conversation history."""
    system_content = (
        f"You are a senior software engineer conducting a technical interview. "
        f"Current phase: {state.value}. "
        f"Respond naturally as an interviewer. Keep your responses conversational and concise.\n"
        f"Also return a 'next_state' field indicating where the conversation should go.\n\n"
        f"--- PROBLEM CONTEXT ---\n"
        f"Title: {problem_context.get('title')}\n"
        f"Difficulty: {problem_context.get('difficulty')}\n"
        f"Language: {problem_context.get('language')}\n"
        f"Topics: {', '.join(problem_context.get('topics') or [])}\n"
        f"Description:\n{problem_context.get('description')}\n"
        f"-----------------------\n"
    )

    system_prompt = {
        "role": "system",
        "content": system_content,
    }

    messages = [system_prompt]
    messages.extend(conversation_history)

    if user_text:
        user_content = f"Candidate: {user_text}"
        if current_code:
            user_content += f"\n\n[Current Code Snapshot]:\n{current_code}"

        messages.append({
            "role": "user",
            "content": user_content,
        })

    return messages

import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import WebSocket, WebSocketDisconnect

from config import get_settings
from websocket.manager import manager
from state_machine.machine import StateMachine
from state_machine.states import InterviewState
from state_machine.transitions import VALID_TRANSITIONS
from metrics import SessionUsage, TurnMetrics
from websocket.clock import timed_action
from services.llm import create_llm_provider
from services.llm.streaming import ReplyParser, interview_stream_instructions
from services.deepgram import DeepgramTTSClient
from services.supabase_client import (
    get_session,
    log_state_transition,
    log_transcript,
    save_code_snapshot,
    save_debrief,
    save_turn_metrics,
    update_session,
    upsert_session_usage,
)
from debrief.engine import DebriefEngine

logger = logging.getLogger(__name__)

PHASE_GUIDE = {
    InterviewState.INTRO: "Greet the candidate briefly, name the problem and invite clarifying questions.",
    InterviewState.AWAITING_CLARIFICATION: (
        "Answer clarifying questions. Stay in AWAITING_CLARIFICATION while they have more, "
        "and move to AWAITING_APPROACH when they are ready to discuss a solution."
    ),
    InterviewState.AWAITING_APPROACH: (
        "Probe their approach without giving it away. Stay in AWAITING_APPROACH while it needs work, "
        "and move to AWAITING_CODE once it is sound."
    ),
    InterviewState.AWAITING_CODE: (
        "Let them code and only nudge if they are stuck. Stay in AWAITING_CODE until they say they "
        "have finished, then move to AWAITING_WALKTHROUGH."
    ),
    InterviewState.AWAITING_WALKTHROUGH: (
        "Have them explain the code, its complexity and its edge cases. Stay in AWAITING_WALKTHROUGH "
        "until that is covered, then move to CONCLUDING."
    ),
    InterviewState.CONCLUDING: (
        "Answer any final questions. Stay in CONCLUDING while they have some. When they have nothing "
        "more, say a short goodbye and move to GENERATING_DEBRIEF."
    ),
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


def _allowed_states(state: InterviewState) -> list[str]:
    """States a turn may move to: a legal move, or staying put (INTRO cannot stay put)."""
    return [
        s.value for s in InterviewState
        if s in VALID_TRANSITIONS[state] or (s == state and state != InterviewState.INTRO)
    ]


def interview_schema(state: InterviewState) -> dict:
    """Response schema for one turn: next_state may only be a legal move, or staying put."""
    return {
        "type": "object",
        "properties": {
            "response_text": {"type": "string"},
            "next_state": {"type": "string", "enum": _allowed_states(state)},
        },
        "required": ["response_text", "next_state"],
        "additionalProperties": False,
    }


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
    usage: SessionUsage = field(default_factory=SessionUsage)
    turn_index: int = 0
    turn_task: Optional[asyncio.Task] = None  # the AI turn currently running, if any
    last_activity: float = field(default_factory=time.monotonic)  # set by ACTIVITY messages
    user_turns: int = 0
    warned: bool = False  # the five-minutes-left line has been said
    nudges_in_row: int = 0  # check-ins since the candidate last spoke


# How often the receive loop wakes with no message, for timed checks.
CLOCK_TICK_S = 5.0

# A dropped interview gets a debrief only once the candidate has answered this many times.
MIN_TURNS_FOR_DEBRIEF = 3

WARN_TEXT = "Quick heads-up: we have about five minutes left."
CAP_TEXT = "We're at time, so let's stop here. I'll put together your feedback now."


async def _run_turn(coro):
    """A turn's own failure is logged here, so it cannot end the receive loop."""
    try:
        await coro
    except Exception as e:
        logger.error(f"Turn failed: {e}", exc_info=True)


async def _safe(fn, *args, **kwargs):
    """Run a persistence helper off the event loop. Failures are logged and swallowed."""
    try:
        return await asyncio.to_thread(fn, *args, **kwargs)
    except Exception as e:
        logger.error(f"Persistence call {getattr(fn, '__name__', fn)} failed: {e}")
        return None


# Strong references to background persistence tasks, so they are not garbage-collected mid-write.
_BACKGROUND: set = set()


def _bg(fn, *args, **kwargs) -> None:
    """Persist off the turn path: schedule _safe(fn, ...) and keep it alive until it finishes."""
    task = asyncio.create_task(_safe(fn, *args, **kwargs))
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)


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
    _bg(log_state_transition, ctx.token, ctx.session_id, from_state.value, to_state.value, triggered_by)
    if to_state == InterviewState.AWAITING_WALKTHROUGH and ctx.last_code.strip():
        _bg(save_code_snapshot, ctx.token, ctx.session_id, ctx.last_code, ctx.language)


def _apply_llm_transition(sm: StateMachine, next_state_str: Optional[str], session_id: str):
    """Apply the LLM-suggested state. Staying put is normal; an illegal move also stays put,
    because guessing a forward step would skip part of the interview.

    Returns (from_state, to_state, triggered_by) when the state actually changed, else None.
    """
    from_state = sm.current_state
    if not next_state_str or next_state_str == from_state.value:
        return None

    try:
        target = InterviewState(next_state_str)
    except ValueError:
        target = None

    if target is None or not sm.transition(target):
        logger.warning(f"[{session_id}] Invalid state transition: {from_state} -> {next_state_str}, staying")
        return None

    if sm.current_state == from_state:
        return None
    return from_state, sm.current_state, "LLM_SUGGESTION"


def _elapsed_ms(since: float) -> int:
    return int((time.monotonic() - since) * 1000)


def _turn_metrics(
    ctx: _InterviewContext, kind: str, state: InterviewState, t0: float, before: tuple[int, int, int],
    llm_ms: int, *, first_token_ms: Optional[int] = None, tts_first_audio_ms: Optional[int] = None,
    first_audio_ms: Optional[int] = None, tts_chars: int = 0, error: Optional[str] = None,
) -> TurnMetrics:
    """One row per AI turn: time and characters for the LLM and TTS, and the tokens the LLM used.

    first_audio_ms is measured from the turn's start to the first audio frame sent.
    """
    after = ctx.llm.usage_snapshot()
    return TurnMetrics(
        turn_index=ctx.turn_index,
        state=state.value,
        kind=kind,
        llm_ms=llm_ms,
        llm_first_token_ms=first_token_ms,
        tts_first_audio_ms=tts_first_audio_ms,
        first_audio_ms=first_audio_ms,
        total_ms=_elapsed_ms(t0),
        tts_chars=tts_chars,
        input_tokens=after[0] - before[0],
        output_tokens=after[1] - before[1],
        llm_attempts=ctx.llm.last_attempts,
        error=error,
    )


async def _record_turn(ctx: _InterviewContext, m: TurnMetrics):
    ctx.usage.add_turn(m)
    ctx.turn_index += 1
    logger.info("turn_metrics %s", json.dumps(asdict(m)))
    _bg(save_turn_metrics, ctx.session_id, asdict(m))


async def _save_session_usage(ctx: _InterviewContext):
    """Upsert the session's totals. The mic stream is open for the whole session, so its length stands in for STT time."""
    settings = get_settings()
    stt_seconds = _duration_seconds(ctx)
    row = {
        **asdict(ctx.usage),
        "stt_seconds": stt_seconds,
        "cost_usd": ctx.usage.cost_usd(
            stt_seconds, settings.llm_input_price_per_mtok, settings.llm_output_price_per_mtok,
        ),
    }
    await _safe(upsert_session_usage, ctx.session_id, row)


SILENCE_IN_HISTORY = "(listens quietly)"


async def _send_tts_failed(sid: str):
    await _try_send(sid, {
        "type": "ERROR",
        "code": "TTS_FAILED",
        "message": "The interviewer's voice failed to play.",
    })


class _TurnSpeech:
    """What one turn says on its TTS socket: sentences go in, even-length audio frames come out.

    A TTS failure is reported once and the turn carries on, so the text still reaches the transcript.
    """

    def __init__(self, sid: str, tts, t0: float):
        self.sid = sid
        self.tts = tts
        self.t0 = t0
        self.sentences: list[str] = []
        self.speak_at: Optional[float] = None
        self.tts_first_audio_ms: Optional[int] = None
        self.first_audio_ms: Optional[int] = None
        self.tts_failed = False

    @property
    def text(self) -> str:
        return " ".join(self.sentences)

    async def say(self, sentence: str):
        self.sentences.append(sentence)
        if self.speak_at is None:
            self.speak_at = time.monotonic()
        if not self.tts_failed:
            try:
                await self.tts.speak(sentence)
            except Exception as e:
                await self._fail(e)
        await _try_send(self.sid, {"type": "AI_TEXT", "text": self.text})

    async def play(self):
        """Send the audio. An odd trailing byte waits for the next chunk, so every frame holds whole samples."""
        carry = b""
        try:
            async for chunk in self.tts.audio():
                data = carry + chunk
                even = len(data) - len(data) % 2
                carry = data[even:]
                if not even:
                    continue
                if self.first_audio_ms is None:
                    self.first_audio_ms = _elapsed_ms(self.t0)
                    if self.speak_at is not None:
                        self.tts_first_audio_ms = int((time.monotonic() - self.speak_at) * 1000)
                await manager.send_bytes(self.sid, data[:even])
        except Exception as e:
            await self._fail(e)

    async def _fail(self, e: Exception):
        if not self.tts_failed:
            self.tts_failed = True
            logger.error(f"[{self.sid}] TTS failed: {e}")
            await _send_tts_failed(self.sid)


async def _stream_turn(
    ctx: _InterviewContext, messages: list[dict], state: InterviewState, kind: str,
) -> tuple[str, Optional[str]]:
    """Stream one AI reply. Each sentence goes to TTS as soon as the model has written it, and the audio goes out as binary frames.

    `messages` is the prompt without a reply-format rule; this adds the streaming format.
    Returns (the spoken text, the next state as the reply named it). Records the turn's metrics,
    and raises if the reply could not be made, so the caller can report it.
    """
    sid = ctx.session_id
    t0 = time.monotonic()
    before = ctx.llm.usage_snapshot()
    allowed = _allowed_states(state)
    silence_ok = state == InterviewState.AWAITING_CODE
    stream_messages = _with_reply_format(messages, interview_stream_instructions(allowed, silence_ok))
    parser = ReplyParser(allowed, state.value)

    speech: Optional[_TurnSpeech] = None
    first_token_ms: Optional[int] = None
    llm_ms: Optional[int] = None
    stream_error: Optional[Exception] = None
    state_applied = False
    returned_state: Optional[str] = None

    async def apply_state(name: Optional[str]):
        transition = _apply_llm_transition(ctx.sm, name, sid)
        if transition:
            await _on_transition(ctx, *transition)

    async def produce(tts):
        nonlocal first_token_ms, llm_ms, stream_error, state_applied, returned_state
        try:
            try:
                async for piece in ctx.llm.stream(stream_messages):
                    if first_token_ms is None:
                        first_token_ms = _elapsed_ms(t0)
                    sentences = parser.feed(piece)
                    # The state is applied before the first sentence is spoken, so the client hears the new phase.
                    if not state_applied and parser.header_known:
                        state_applied = True
                        await apply_state(parser.state)
                    for sentence in sentences:
                        await speech.say(sentence)
            except Exception as e:
                stream_error = e
                logger.error(f"[{sid}] LLM stream failed: {e}")

            returned_state = parser.state
            if stream_error is None:
                remainder = parser.finish()
                if not state_applied:
                    state_applied = True
                    await apply_state(parser.state)
                for sentence in remainder:
                    await speech.say(sentence)

            # Nothing was spoken: silence is allowed only while the candidate is coding, anything else falls back.
            if not speech.sentences and (stream_error is not None or not silence_ok):
                logger.warning(f"[{sid}] Streamed reply was empty, falling back to structured output")
                parsed = await ctx.llm.generate_structured(messages, interview_schema(state), max_attempts=1)
                returned_state = parsed.get("next_state")
                await apply_state(returned_state)
                await speech.say(parsed["response_text"])
        finally:
            llm_ms = _elapsed_ms(t0)
            await tts.end()

    try:
        async with ctx.tts.session() as tts:
            speech = _TurnSpeech(sid, tts, t0)
            producer = asyncio.create_task(produce(tts))
            consumer = asyncio.create_task(speech.play())
            try:
                await asyncio.gather(producer, consumer)
            finally:
                # A failed producer must not leave the consumer waiting on audio that will never come.
                for task in (producer, consumer):
                    task.cancel()
                await asyncio.gather(producer, consumer, return_exceptions=True)
    except Exception as e:
        error_code = "LLM_FAILED" if speech is not None else "TTS_FAILED"
        logger.error(f"[{sid}] {kind} turn failed ({error_code}): {e}")
        await _record_turn(ctx, _turn_metrics(
            ctx, kind, ctx.sm.current_state, t0, before, _elapsed_ms(t0), error=error_code,
        ))
        raise

    text = speech.text
    ctx.conversation_history.append({"role": "assistant", "content": text or SILENCE_IN_HISTORY})
    final_state = ctx.sm.current_state
    if text:
        _bg(log_transcript, ctx.token, sid, "AI", text, final_state.value)
        await _try_send(sid, {"type": "AI_TEXT", "text": text})
    await _try_send(sid, {"type": "AUDIO_FINISHED"})

    await _record_turn(ctx, _turn_metrics(
        ctx, kind, final_state, t0, before, llm_ms,
        first_token_ms=first_token_ms,
        tts_first_audio_ms=speech.tts_first_audio_ms,
        first_audio_ms=speech.first_audio_ms,
        tts_chars=len(text),
        error="LLM_STREAM_FAILED" if stream_error is not None else None,
    ))
    return text, returned_state


def _with_reply_format(messages: list[dict], instructions: str) -> list[dict]:
    """A copy of the prompt with the streaming reply format added to the system message."""
    result = [dict(m) for m in messages]
    if result and result[0]["role"] == "system":
        result[0]["content"] = f"{result[0]['content']}\n\n{instructions}"
    else:
        result.insert(0, {"role": "system", "content": instructions})
    return result


async def send_intro(ctx: _InterviewContext):
    """Send the INTRO turn and move the state machine out of INTRO."""
    sid = ctx.session_id
    logger.info(f"[{sid}] Generating intro...")
    messages = build_interview_prompt(InterviewState.INTRO, ctx.problem_context, ctx.conversation_history, "", "")

    try:
        await _stream_turn(ctx, messages, InterviewState.INTRO, "intro")
    except Exception as e:
        logger.error(f"[{sid}] Intro LLM call failed: {e}")
        await _try_send(sid, {"type": "ERROR", "code": "LLM_FAILED", "message": "The interviewer could not start. Please try again."})
        await _try_send(sid, {"type": "STATE_CHANGED", "state": ctx.sm.current_state.value})
        await _try_send(sid, {"type": "AUDIO_FINISHED"})
        return

    # A transition already sent STATE_CHANGED. Without one, the client still needs to hear the state.
    if ctx.sm.current_state == InterviewState.INTRO:
        await _try_send(sid, {"type": "STATE_CHANGED", "state": ctx.sm.current_state.value})
    logger.info(f"[{sid}] Intro complete, state: {ctx.sm.current_state}")


async def _handle_user_utterance(ctx: _InterviewContext, data: dict):
    sid = ctx.session_id
    text = (data.get("text") or "").strip()
    if not text:
        return
    ctx.user_turns += 1
    ctx.nudges_in_row = 0

    current_code = data.get("current_code") or ""
    if current_code.strip():
        ctx.last_code = current_code
    if data.get("language"):
        ctx.language = data["language"]

    state_before = ctx.sm.current_state
    logger.info(f"[{sid}] User utterance: '{text[:100]}' (state: {state_before})")

    await _try_send(sid, {"type": "AI_THINKING"})
    _bg(log_transcript, ctx.token, sid, "USER", text, state_before.value)

    messages = build_interview_prompt(state_before, ctx.problem_context, ctx.conversation_history, text, current_code)

    # Recorded before the call: a failed reply must not erase what the candidate said from the debrief.
    # Code is only sent with the newest message (build_interview_prompt); history keeps the words.
    ctx.conversation_history.append({"role": "user", "content": f"Candidate: {text}"})

    try:
        await _stream_turn(ctx, messages, state_before, "reply")
    except Exception as e:
        logger.error(f"[{sid}] LLM call failed: {e}")
        await _try_send(sid, {"type": "ERROR", "code": "LLM_FAILED", "message": "The interviewer could not respond. Please try again."})
        await _try_send(sid, {"type": "AUDIO_FINISHED"})


async def _speak_fixed(ctx: _InterviewContext, text: str, state: InterviewState, kind: str):
    """Speak a fixed line through one TTS socket, without an LLM call. It joins the transcript and gets its own metrics row."""
    sid = ctx.session_id
    t0 = time.monotonic()
    ctx.conversation_history.append({"role": "assistant", "content": text})
    speech: Optional[_TurnSpeech] = None
    try:
        async with ctx.tts.session() as tts:
            speech = _TurnSpeech(sid, tts, t0)
            await speech.say(text)
            await tts.end()
            await speech.play()
    except Exception as e:
        logger.error(f"[{sid}] Fixed line could not be spoken: {e}")
        await _send_tts_failed(sid)

    _bg(log_transcript, ctx.token, sid, "AI", text, state.value)
    await _try_send(sid, {"type": "AUDIO_FINISHED"})
    await _record_turn(ctx, TurnMetrics(
        turn_index=ctx.turn_index,
        state=state.value,
        kind=kind,
        tts_first_audio_ms=speech.tts_first_audio_ms if speech else None,
        first_audio_ms=speech.first_audio_ms if speech else None,
        total_ms=_elapsed_ms(t0),
        tts_chars=len(text),
    ))


async def _nudge_turn(ctx: _InterviewContext, idle_s: float):
    """A gentle check-in while the candidate is quiet. The note to the model is not stored as the candidate's words."""
    sid = ctx.session_id
    state = ctx.sm.current_state
    ctx.nudges_in_row += 1

    note = (
        f"(No reply from the candidate for about {int(idle_s)} seconds. Check in briefly and kindly, "
        "offering a small hint only if they seem stuck.)"
    )
    if ctx.last_code.strip():
        note += f"\n\n[Current Code Snapshot]:\n{ctx.last_code}"
    messages = build_interview_prompt(state, ctx.problem_context, ctx.conversation_history)
    messages.append({"role": "user", "content": note})
    logger.info(f"[{sid}] Check-in after {int(idle_s)}s of silence (state: {state})")

    try:
        await _stream_turn(ctx, messages, state, "nudge")
    except Exception as e:
        # A missed check-in is harmless: the candidate is simply left to think.
        logger.error(f"[{sid}] Check-in LLM call failed: {e}")


async def _timed_turn(ctx: _InterviewContext, action: str, idle_s: float):
    if action == "warn":
        ctx.warned = True
        await _speak_fixed(ctx, WARN_TEXT, ctx.sm.current_state, "notice")
    elif action == "cap":
        # The transition comes after the closing line; the receive loop ends the session once this task is done.
        await _speak_fixed(ctx, CAP_TEXT, ctx.sm.current_state, "notice")
        from_state = ctx.sm.current_state
        ctx.sm.force_transition(InterviewState.GENERATING_DEBRIEF)
        await _on_transition(ctx, from_state, InterviewState.GENERATING_DEBRIEF, "TIMEOUT")
    else:
        await _nudge_turn(ctx, idle_s)


def _start_clock_action(ctx: _InterviewContext):
    """Run the timed action that is due, if any. Called only when no AI turn is running."""
    now = time.monotonic()
    idle_s = now - ctx.last_activity
    action = timed_action(
        ctx.sm.current_state, now - ctx.started_at, idle_s, ctx.warned, ctx.nudges_in_row,
    )
    if action is None:
        return
    logger.info(f"[{ctx.session_id}] Timed action: {action}")
    ctx.turn_task = asyncio.create_task(_run_turn(_timed_turn(ctx, action, idle_s)))


def _clean_list(items) -> list:
    """The model occasionally emits an entry that is only punctuation, such as ":"."""
    if not isinstance(items, list):
        return []
    return [item.strip() for item in items if isinstance(item, str) and any(c.isalnum() for c in item)]


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
        elif key in ("actionable_feedback", "similar_problems"):
            value = _clean_list(value)
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

    row = _debrief_row(debrief_result)
    await _try_send(sid, {"type": "DEBRIEF_READY", "data": {**debrief_result, **row}, "session_id": sid})
    logger.info(f"[{sid}] Sent DEBRIEF_READY")

    await _safe(save_debrief, ctx.token, sid, row)
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
        session_data = (await asyncio.to_thread(get_session, token, session_id)).data
        problem_context = {
            "title": session_data.get("leetcode_title"),
            "difficulty": session_data.get("problem_difficulty"),
            "description": session_data.get("problem_description"),
            "topics": session_data.get("problem_topics"),
            "language": session_data.get("problem_language")
        }
    except Exception as e:
        # Unknown session or someone else's (RLS hides it): there is no problem to interview on.
        logger.error(f"[{session_id}] Failed to fetch session context: {e}")
        await _try_send(session_id, {"type": "ERROR", "code": "SESSION_UNAVAILABLE", "message": "This interview session could not be loaded."})
        manager.disconnect(session_id)
        await websocket.close(code=1008, reason="Session unavailable")
        return

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
    recv = None
    try:
        # Turns run as tasks beside this loop, so End, pings and activity are handled while the model is still working.
        ctx.turn_task = asyncio.create_task(_run_turn(send_intro(ctx)))
        recv = asyncio.create_task(websocket.receive_json())

        while True:
            waiters = {recv} if ctx.turn_task is None else {recv, ctx.turn_task}
            done, _ = await asyncio.wait(waiters, timeout=CLOCK_TICK_S, return_when=asyncio.FIRST_COMPLETED)

            if ctx.turn_task is not None and ctx.turn_task.done():
                ctx.turn_task = None
                ctx.last_activity = time.monotonic()
                if sm.current_state == InterviewState.GENERATING_DEBRIEF:
                    logger.info(f"[{session_id}] Reached GENERATING_DEBRIEF naturally")
                    break

            if ctx.turn_task is None:
                _start_clock_action(ctx)

            if recv not in done:
                continue

            data = recv.result()  # raises WebSocketDisconnect on a closed socket
            recv = asyncio.create_task(websocket.receive_json())
            msg_type = data.get("type")
            logger.info(f"[{session_id}] Received WS message: {msg_type}")

            if msg_type == "USER_UTTERANCE":
                if ctx.turn_task is not None:
                    logger.info(f"[{session_id}] Utterance ignored, a turn is still running")
                else:
                    ctx.turn_task = asyncio.create_task(_run_turn(_handle_user_utterance(ctx, data)))

            elif msg_type == "PING":
                await _try_send(session_id, {"type": "PONG"})

            elif msg_type == "ACTIVITY":
                ctx.last_activity = time.monotonic()

            elif msg_type == "AUDIO_FINISHED_ACK":
                logger.debug(f"[{session_id}] Received AUDIO_FINISHED_ACK")

            elif msg_type == "INTERRUPT":
                logger.info(f"[{session_id}] Received INTERRUPT")
                if ctx.turn_task is not None:
                    ctx.turn_task.cancel()
                    await asyncio.wait({ctx.turn_task})
                    ctx.turn_task = None
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
    finally:
        pending = [t for t in (recv, ctx.turn_task) if t is not None and not t.done()]
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.wait(pending)

    await _save_code_snapshot(ctx)

    if disconnected:
        manager.disconnect(session_id)
        await _safe(
            update_session, token, session_id,
            status="INTERRUPTED", completed_at=_now_iso(), total_duration_seconds=_duration_seconds(ctx),
        )
        if ctx.user_turns >= MIN_TURNS_FOR_DEBRIEF:
            # The socket is gone, so the debrief's sends go nowhere. On success it sets the final status.
            try:
                await _run_debrief(ctx)
            except Exception as e:
                logger.error(f"[{session_id}] Debrief after disconnect failed: {e}", exc_info=True)
        await _save_session_usage(ctx)
        await _close_llm(llm)
        return

    await _run_debrief(ctx)
    await _save_session_usage(ctx)
    manager.disconnect(session_id)
    await _close_llm(llm)


async def _close_llm(llm: Any):
    """Release the provider's HTTP connections. A failure here must not affect the interview's end."""
    try:
        await llm.aclose()
    except Exception as e:
        logger.warning(f"Could not close the LLM client: {e}")


def build_interview_prompt(state: InterviewState, problem_context: dict, conversation_history: list, user_text: str = "", current_code: str = "") -> list[dict]:
    """Construct the LLM prompt based on current state, static problem context, and conversation history."""
    system_content = (
        f"You are a senior software engineer conducting a technical interview. "
        f"Current phase: {state.value}. "
        f"{PHASE_GUIDE.get(state, '')}\n"
        f"Respond naturally as an interviewer. Keep your responses conversational and concise. "
        f"What you say is read aloud, so use plain spoken words with no markdown, LaTeX or code.\n\n"
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

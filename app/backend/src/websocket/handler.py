import json
import logging
from fastapi import WebSocket, WebSocketDisconnect

from src.websocket.manager import manager
from src.state_machine.machine import StateMachine
from src.state_machine.states import InterviewState
from src.services.llm import create_llm_provider
from src.services.deepgram import DeepgramTTSClient

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


async def handle_interview_websocket(websocket: WebSocket, session_id: str):
    """Main WebSocket handler for a single interview session."""
    await manager.connect(websocket, session_id)
    sm = StateMachine()
    llm = create_llm_provider()
    tts = DeepgramTTSClient()

    logger.info(f"[{session_id}] WebSocket connected, starting interview")

    # Send initial INTRO message on connect
    await send_intro(session_id, sm, llm, tts)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            logger.info(f"[{session_id}] Received WS message: {msg_type}")
            if msg_type == "USER_UTTERANCE":
                text = data.get("text")
                current_code = data.get("current_code", "")
                logger.info(f"[{session_id}] User utterance: '{text[:100]}...' (state: {sm.current_state})")

                # Build the prompt with full conversation history + state
                messages = build_interview_prompt(sm.current_state, text, current_code)

                # Call LLM provider with structured output
                logger.info(f"[{session_id}] Calling LLM...")
                parsed = await llm.generate_structured(messages, INTERVIEW_RESPONSE_SCHEMA)
                response_text = parsed["response_text"]
                next_state_str = parsed.get("next_state")
                logger.info(f"[{session_id}] LLM response: '{response_text[:100]}...' next_state: {next_state_str}")

                # Validate and transition
                if next_state_str:
                    next_state = InterviewState(next_state_str)
                    transitioned = sm.transition(next_state)
                    if not transitioned:
                        logger.warning(f"[{session_id}] Invalid state transition: {sm.current_state} -> {next_state}")
                    else:
                        logger.info(f"[{session_id}] State transition: {sm.current_state}")

                # Stream TTS audio to the extension
                logger.info(f"[{session_id}] Starting TTS streaming...")
                chunk_count = 0
                async for chunk in tts.stream_tts(response_text):
                    chunk_count += 1
                    await manager.send_to_session(session_id, {
                        "type": "AUDIO_CHUNK",
                        "data": chunk.hex(),
                    })
                logger.info(f"[{session_id}] TTS complete, sent {chunk_count} chunks")

                await manager.send_to_session(session_id, {"type": "AUDIO_FINISHED"})
                logger.info(f"[{session_id}] Sent AUDIO_FINISHED")

            elif msg_type == "AUDIO_FINISHED_ACK":
                logger.debug(f"[{session_id}] Received AUDIO_FINISHED_ACK")

            elif msg_type == "INTERRUPT":
                logger.info(f"[{session_id}] Received INTERRUPT")
                sm.force_transition(InterviewState.GENERATING_DEBRIEF)
                break

    except WebSocketDisconnect:
        logger.info(f"[{session_id}] WebSocket disconnected")
        manager.disconnect(session_id)
    finally:
        manager.disconnect(session_id)


async def send_intro(session_id: str, sm: StateMachine, llm, tts: DeepgramTTSClient):
    """Send initial INTRO prompt and stream TTS response."""
    logger.info(f"[{session_id}] Generating intro...")
    messages = build_interview_prompt(InterviewState.INTRO, "", "")

    parsed = await llm.generate_structured(messages, INTERVIEW_RESPONSE_SCHEMA)
    response_text = parsed["response_text"]
    next_state_str = parsed.get("next_state")
    logger.info(f"[{session_id}] Intro text: '{response_text[:100]}...'")

    if next_state_str:
        next_state = InterviewState(next_state_str)
        sm.transition(next_state)
        logger.info(f"[{session_id}] Initial state: {sm.current_state}")

    # Stream TTS audio to the extension
    logger.info(f"[{session_id}] Streaming intro TTS...")
    chunk_count = 0
    async for chunk in tts.stream_tts(response_text):
        chunk_count += 1
        await manager.send_to_session(session_id, {
            "type": "AUDIO_CHUNK",
            "data": chunk.hex(),
        })
    logger.info(f"[{session_id}] Intro TTS complete, sent {chunk_count} chunks")

    await manager.send_to_session(session_id, {"type": "AUDIO_FINISHED"})
    logger.info(f"[{session_id}] Sent intro AUDIO_FINISHED")


def build_interview_prompt(state: InterviewState, user_text: str, current_code: str) -> list[dict]:
    """Construct the LLM prompt based on current state."""
    system_prompt = {
        "role": "system",
        "content": (
            f"You are a senior software engineer conducting a technical interview. "
            f"Current phase: {state.value}. "
            f"Respond naturally as an interviewer. "
            f"Also return a 'next_state' field indicating where the conversation should go."
        ),
    }
    user_message = {
        "role": "user",
        "content": f"Candidate: {user_text}\n\nCurrent code:\n{current_code}",
    }
    return [system_prompt, user_message]

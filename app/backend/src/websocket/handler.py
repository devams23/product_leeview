import json
from venv import logger
from fastapi import WebSocket, WebSocketDisconnect

from src.websocket.manager import manager
from src.state_machine.machine import StateMachine
from src.state_machine.states import InterviewState
from src.services.llm import create_llm_provider
from src.services.deepgram import DeepgramTTSClient


async def handle_interview_websocket(websocket: WebSocket, session_id: str):
    """Main WebSocket handler for a single interview session."""
    await manager.connect(websocket, session_id)
    sm = StateMachine()
    llm = create_llm_provider()
    tts = DeepgramTTSClient()

    # Send initial INTRO message on connect
    await send_intro(session_id, sm, llm, tts)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            logger.info(f"Received WS message for session {session_id}: {msg_type}")
            if msg_type == "USER_UTTERANCE":
                text = data.get("text")
                current_code = data.get("current_code", "")

                # Build the prompt with full conversation history + state
                messages = build_interview_prompt(sm.current_state, text, current_code)

                # Call LLM provider
                response = await llm.generate(messages)
                # Parse response_text and next_state (expecting JSON from LLM)
                parsed = json.loads(response)
                response_text = parsed["response_text"]
                next_state_str = parsed.get("next_state")

                # Validate and transition
                if next_state_str:
                    next_state = InterviewState(next_state_str)
                    transitioned = sm.transition(next_state)
                    if not transitioned:
                        pass

                # Stream TTS audio to the extension
                audio_chunks = []
                async for chunk in tts.stream_tts(response_text):
                    audio_chunks.append(chunk)
                    await manager.send_to_session(session_id, {
                        "type": "AUDIO_CHUNK",
                        "data": chunk.hex(),
                    })

                await manager.send_to_session(session_id, {"type": "AUDIO_FINISHED"})

            elif msg_type == "AUDIO_FINISHED_ACK":
                pass

            elif msg_type == "INTERRUPT":
                sm.force_transition(InterviewState.GENERATING_DEBRIEF)
                break

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    finally:
        manager.disconnect(session_id)


async def send_intro(session_id: str, sm: StateMachine, llm, tts: DeepgramTTSClient):
    """Send initial INTRO prompt and stream TTS response."""
    messages = build_interview_prompt(InterviewState.INTRO, "", "")

    response = await llm.generate(messages)
    parsed = json.loads(response)
    response_text = parsed["response_text"]
    next_state_str = parsed.get("next_state")

    if next_state_str:
        next_state = InterviewState(next_state_str)
        sm.transition(next_state)

    # Stream TTS audio to the extension
    async for chunk in tts.stream_tts(response_text):
        await manager.send_to_session(session_id, {
            "type": "AUDIO_CHUNK",
            "data": chunk.hex(),
        })

    await manager.send_to_session(session_id, {"type": "AUDIO_FINISHED"})


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

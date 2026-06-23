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


from src.services.supabase_client import get_session, save_debrief

async def handle_interview_websocket(websocket: WebSocket, session_id: str):
    """Main WebSocket handler for a single interview session."""
    await manager.connect(websocket, session_id)
    sm = StateMachine()
    llm = create_llm_provider()
    tts = DeepgramTTSClient()

    logger.info(f"[{session_id}] WebSocket connected, starting interview")

    # Fetch static problem context once
    try:
        session_data = get_session(session_id).data
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

    conversation_history = []

    # Send initial INTRO message on connect
    await send_intro(session_id, sm, llm, tts, problem_context, conversation_history)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            logger.info(f"[{session_id}] Received WS message: {msg_type}")
            
            if msg_type == "USER_UTTERANCE":
                text = data.get("text")
                current_code = data.get("current_code", "")
                logger.info(f"[{session_id}] User utterance: '{text[:100]}...' (state: {sm.current_state})")

                # Build the prompt with static context + conversation history + dynamic code snapshot
                messages = build_interview_prompt(sm.current_state, problem_context, conversation_history, text, current_code)

                # Call LLM provider with structured output
                logger.info(f"[{session_id}] Calling LLM...")
                parsed = await llm.generate_structured(messages, INTERVIEW_RESPONSE_SCHEMA)
                logger.info(f"[{session_id}] LLM raw parsed: {parsed}")
                response_text = parsed["response_text"]
                next_state_str = parsed.get("next_state")
                logger.info(f"[{session_id}] LLM response: '{response_text[:100]}...' next_state: {next_state_str}")

                # Update conversation memory
                user_msg_content = f"Candidate: {text}"
                if current_code:
                    user_msg_content += f"\n\n[Code Snapshot]:\n{current_code}"
                conversation_history.append({"role": "user", "content": user_msg_content})
                conversation_history.append({"role": "assistant", "content": response_text})

                # Validate and transition
                if next_state_str:
                    next_state = InterviewState(next_state_str)
                    transitioned = sm.transition(next_state)
                    if not transitioned:
                        logger.warning(f"[{session_id}] Invalid state transition: {sm.current_state} -> {next_state}, defaulting to valid transition")
                        valid_next = {
                            InterviewState.INTRO: InterviewState.AWAITING_CLARIFICATION,
                            InterviewState.AWAITING_CLARIFICATION: InterviewState.AWAITING_APPROACH,
                            InterviewState.AWAITING_APPROACH: InterviewState.AWAITING_CODE,
                            InterviewState.AWAITING_CODE: InterviewState.AWAITING_WALKTHROUGH,
                            InterviewState.AWAITING_WALKTHROUGH: InterviewState.CONCLUDING,
                            InterviewState.CONCLUDING: InterviewState.GENERATING_DEBRIEF,
                        }
                        if sm.current_state in valid_next:
                            fallback = valid_next[sm.current_state]
                            sm.transition(fallback)
                            logger.info(f"[{session_id}] Fallback transition: {sm.current_state}")
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

                if sm.current_state == InterviewState.GENERATING_DEBRIEF:
                    logger.info(f"[{session_id}] Reached GENERATING_DEBRIEF naturally")
                    break

            elif msg_type == "AUDIO_FINISHED_ACK":
                logger.debug(f"[{session_id}] Received AUDIO_FINISHED_ACK")

            elif msg_type == "INTERRUPT":
                logger.info(f"[{session_id}] Received INTERRUPT")
                sm.force_transition(InterviewState.GENERATING_DEBRIEF)
                break

    except WebSocketDisconnect:
        logger.info(f"[{session_id}] WebSocket disconnected")
        manager.disconnect(session_id)
        return

    if sm.current_state == InterviewState.GENERATING_DEBRIEF:
        try:
            logger.info(f"[{session_id}] Generating debrief...")
            from src.debrief.engine import DebriefEngine
            engine = DebriefEngine()
            
            interview_data = {
                "title": problem_context.get("title", ""),
                "difficulty": problem_context.get("difficulty", ""),
                "description": problem_context.get("description", ""),
                "topics": problem_context.get("topics", []),
                "language": problem_context.get("language", ""),
                "transcript": json.dumps(conversation_history),
                "code_snapshots": "N/A", 
                "time_per_state": "N/A",
                "state_transitions": "N/A",
                "algorithm": problem_context.get("topics", ["Algorithm"])[0] if problem_context.get("topics") else "Algorithm"
            }
            debrief_result = await engine.run(interview_data)
            await manager.send_to_session(session_id, {
                "type": "DEBRIEF_READY",
                "data": debrief_result
            })
            # Save the debrief to Supabase
            try:
                # convert scores to integers before saving to avoid check constraint errors if floats are passed
                db_debrief = {**debrief_result}
                for key in ["approach_score", "communication_score", "code_correctness_score", "code_quality_score", "time_management_score", "overall_score"]:
                    if key in db_debrief and db_debrief[key] is not None:
                        db_debrief[key] = int(round(float(db_debrief[key])))
                save_debrief(session_id, db_debrief)
                logger.info(f"[{session_id}] Debrief saved to database")
            except Exception as e:
                logger.error(f"[{session_id}] Failed to save debrief to database: {e}")

            logger.info(f"[{session_id}] Sent DEBRIEF_READY")
        except Exception as e:
            logger.error(f"[{session_id}] Failed to generate debrief: {e}")

    manager.disconnect(session_id)


async def send_intro(session_id: str, sm: StateMachine, llm, tts: DeepgramTTSClient, problem_context: dict, conversation_history: list):
    """Send initial INTRO prompt and stream TTS response."""
    logger.info(f"[{session_id}] Generating intro...")
    messages = build_interview_prompt(InterviewState.INTRO, problem_context, conversation_history, "", "")

    parsed = await llm.generate_structured(messages, INTERVIEW_RESPONSE_SCHEMA)
    response_text = parsed["response_text"]
    next_state_str = parsed.get("next_state")
    logger.info(f"[{session_id}] Intro text: '{response_text[:100]}...'")

    conversation_history.append({"role": "assistant", "content": response_text})

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

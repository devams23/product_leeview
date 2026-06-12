from supabase import create_client, Client
from src.config import get_settings

settings = get_settings()

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_session(user_id: str, leetcode_slug: str, leetcode_title: str, problem_difficulty: str):
    return supabase.table("interview_sessions").insert({
        "user_id": user_id,
        "leetcode_slug": leetcode_slug,
        "leetcode_title": leetcode_title,
        "problem_difficulty": problem_difficulty,
    }).execute()


def log_transcript(session_id: str, speaker: str, text: str, state_at_time: str):
    return supabase.table("transcript_logs").insert({
        "session_id": session_id,
        "speaker": speaker,
        "text": text,
        "state_at_time": state_at_time,
    }).execute()


def save_code_snapshot(session_id: str, code: str, language: str):
    return supabase.table("code_snapshots").insert({
        "session_id": session_id,
        "code": code,
        "language": language,
    }).execute()


def log_state_transition(session_id: str, from_state: str, to_state: str, triggered_by: str):
    return supabase.table("state_transitions").insert({
        "session_id": session_id,
        "from_state": from_state,
        "to_state": to_state,
        "triggered_by": triggered_by,
    }).execute()


def save_debrief(session_id: str, debrief_data: dict):
    return supabase.table("debriefs").insert({
        "session_id": session_id,
        **debrief_data,
    }).execute()

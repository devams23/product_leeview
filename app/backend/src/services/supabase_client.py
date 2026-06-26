from supabase import create_client, Client
from config import get_settings
from auth import supabase_for_user

settings = get_settings()

# We still keep the service role client for specific admin tasks if absolutely necessary,
# but normal operations should use the per-user client.
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_session(
    user_jwt: str,
    user_id: str, 
    leetcode_slug: str, 
    leetcode_title: str, 
    problem_difficulty: str,
    problem_description: str = "",
    problem_topics: list[str] = None,
    problem_language: str = "python"
):
    client = supabase_for_user(user_jwt)
    return client.table("interview_sessions").insert({
        "user_id": user_id,
        "leetcode_slug": leetcode_slug,
        "leetcode_title": leetcode_title,
        "problem_difficulty": problem_difficulty,
        "problem_description": problem_description,
        "problem_topics": problem_topics or [],
        "problem_language": problem_language,
    }).execute()

def get_session(user_jwt: str, session_id: str):
    client = supabase_for_user(user_jwt)
    return client.table("interview_sessions").select("*").eq("id", session_id).single().execute()

def log_transcript(user_jwt: str, session_id: str, speaker: str, text: str, state_at_time: str):
    client = supabase_for_user(user_jwt)
    return client.table("transcript_logs").insert({
        "session_id": session_id,
        "speaker": speaker,
        "text": text,
        "state_at_time": state_at_time,
    }).execute()


def save_code_snapshot(user_jwt: str, session_id: str, code: str, language: str):
    client = supabase_for_user(user_jwt)
    return client.table("code_snapshots").insert({
        "session_id": session_id,
        "code": code,
        "language": language,
    }).execute()


def log_state_transition(user_jwt: str, session_id: str, from_state: str, to_state: str, triggered_by: str):
    client = supabase_for_user(user_jwt)
    return client.table("state_transitions").insert({
        "session_id": session_id,
        "from_state": from_state,
        "to_state": to_state,
        "triggered_by": triggered_by,
    }).execute()


def save_debrief(user_jwt: str, session_id: str, debrief_data: dict):
    client = supabase_for_user(user_jwt)
    return client.table("debriefs").insert({
        "session_id": session_id,
        **debrief_data,
    }).execute()

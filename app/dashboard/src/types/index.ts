export type SessionStatus = "PREPARING" | "ACTIVE" | "COMPLETED" | "INTERRUPTED";
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Debrief {
  id: string;
  session_id: string;
  generated_at: string | null;
  approach_score: number | null;
  communication_score: number | null;
  code_correctness_score: number | null;
  code_quality_score: number | null;
  time_management_score: number | null;
  overall_score: number | null;
  summary: string | null;
  actionable_feedback: string[];
  similar_problems: string[];
  real_world_scenario: string | null;
  real_world_naive_approach: string | null;
  real_world_why_wins: string | null;
  senior_follow_up: string | null;
}

export interface TranscriptLog {
  id: string;
  session_id: string;
  speaker: "USER" | "AI";
  text: string;
  timestamp: string;
  state_at_time: string;
}

export interface CodeSnapshot {
  id: string;
  session_id: string;
  code: string;
  language: string;
  captured_at: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  leetcode_slug: string;
  leetcode_title: string;
  problem_difficulty: string | null;
  status: SessionStatus;
  started_at: string;
  completed_at: string | null;
  total_duration_seconds: number | null;
  problem_description: string | null;
  problem_topics: string[] | null;
  problem_language: string | null;
  /** Normalised: PostgREST may return the 1:1 relation as an object or a 1-element array. */
  debriefs: Debrief | null;
  transcript_logs: TranscriptLog[];
  code_snapshots: CodeSnapshot[];
}

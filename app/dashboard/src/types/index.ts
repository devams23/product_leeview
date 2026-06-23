export interface Debrief {
  id: string;
  session_id: string;
  generated_at: string;
  summary?: string;
  overall_score?: number;
  approach_score?: number;
  communication_score?: number;
  code_correctness_score?: number;
  code_quality_score?: number;
  time_management_score?: number;
  actionable_feedback?: string[];
  similar_problems?: string[];
  real_world_scenario?: string;
  real_world_naive_approach?: string;
  real_world_why_wins?: string;
  senior_follow_up?: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  leetcode_slug: string;
  leetcode_title: string;
  problem_difficulty: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_duration_seconds?: number;
  problem_description: string;
  problem_topics: string[];
  problem_language: string;
  debriefs?: Debrief; // Note: Single object due to UNIQUE constraint, not array
  transcript_logs?: any[];
  code_snapshots?: any[];
}

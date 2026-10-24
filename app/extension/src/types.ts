export type Phase =
  | "IDLE" | "PREFLIGHT" | "CONNECTING" | "AI_SPEAKING" | "LISTENING" | "THINKING"
  | "GENERATING_DEBRIEF" | "DEBRIEF_READY" | "ERROR";
export type Stage = "INTRO" | "AWAITING_CLARIFICATION" | "AWAITING_APPROACH" | "AWAITING_CODE"
  | "AWAITING_WALKTHROUGH" | "CONCLUDING" | "GENERATING_DEBRIEF" | "COMPLETED";
export type ErrorCode = "MIC_DENIED" | "MIC_UNAVAILABLE" | "BACKEND_UNREACHABLE" | "AUTH_EXPIRED"
  | "STT_FAILED" | "CONNECTION_LOST" | "DEBRIEF_FAILED" | "DEBRIEF_TIMEOUT" | "TURN_FAILED" | "UNKNOWN";
export interface InterviewError { code: ErrorCode; message: string; retryable: boolean }
export interface Caption { speaker: "AI" | "USER"; text: string; final: boolean }
export interface Debrief {
  approach_score?: number; communication_score?: number; code_correctness_score?: number;
  code_quality_score?: number; time_management_score?: number; overall_score?: number;
  summary?: string; actionable_feedback?: string[]; similar_problems?: string[];
  real_world_scenario?: string; real_world_naive_approach?: string;
  real_world_why_wins?: string; senior_follow_up?: string;
}
export interface Problem { title: string; slug: string; difficulty: string; description: string;
  code: string; language: string; topics: string[] }
export type AuthStatus = "loading" | "signed_out" | "signed_in" | "expired";
export interface AuthState { status: AuthStatus; email: string | null; userId: string | null; token: string | null }

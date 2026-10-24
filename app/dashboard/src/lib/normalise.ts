import type { CodeSnapshot, Debrief, InterviewSession, TranscriptLog } from "../types";

type MaybeMany<T> = T | T[] | null | undefined;

/** Raw row shape as returned by `select("*, debriefs(*), ...")`. */
export interface RawSession extends Omit<InterviewSession, "debriefs" | "transcript_logs" | "code_snapshots"> {
  debriefs?: MaybeMany<Debrief>;
  transcript_logs?: TranscriptLog[] | null;
  code_snapshots?: CodeSnapshot[] | null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normaliseDebrief(raw: MaybeMany<Debrief>): Debrief | null {
  const d = Array.isArray(raw) ? raw[0] : raw;
  if (!d) return null;
  return {
    ...d,
    generated_at: d.generated_at ?? null,
    approach_score: asScore(d.approach_score),
    communication_score: asScore(d.communication_score),
    code_correctness_score: asScore(d.code_correctness_score),
    code_quality_score: asScore(d.code_quality_score),
    time_management_score: asScore(d.time_management_score),
    overall_score: asScore(d.overall_score),
    summary: d.summary || null,
    actionable_feedback: asStringArray(d.actionable_feedback),
    similar_problems: asStringArray(d.similar_problems),
    real_world_scenario: d.real_world_scenario || null,
    real_world_naive_approach: d.real_world_naive_approach || null,
    real_world_why_wins: d.real_world_why_wins || null,
    senior_follow_up: d.senior_follow_up || null,
  };
}

export function normaliseSession(raw: RawSession): InterviewSession {
  const { debriefs, transcript_logs, code_snapshots, ...rest } = raw;
  return {
    ...rest,
    debriefs: normaliseDebrief(debriefs),
    transcript_logs: transcript_logs ?? [],
    code_snapshots: code_snapshots ?? [],
  };
}

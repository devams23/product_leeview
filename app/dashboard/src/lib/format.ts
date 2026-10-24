import type { User } from "@supabase/supabase-js";
import type { InterviewSession } from "../types";

export const SKILLS = [
  {
    key: "approach_score",
    label: "Approach",
    tip: "Name the brute force first, then the trade-off, before you optimise.",
  },
  {
    key: "communication_score",
    label: "Communication",
    tip: "Say what you are about to do before you do it. Short sentences land better out loud.",
  },
  {
    key: "code_correctness_score",
    label: "Correctness",
    tip: "Walk through edge cases (empty input, duplicates, one element) before you call it done.",
  },
  {
    key: "code_quality_score",
    label: "Code quality",
    tip: "Name variables for what they hold, and pull out helpers before the interviewer asks.",
  },
  {
    key: "time_management_score",
    label: "Time",
    tip: "Set a checkpoint. A working solution by minute 15 leaves room to refine it.",
  },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];

export type Tone = "danger" | "warn" | "signal" | "ok" | "muted";

/** Score scale from the design spec: <5 danger, 5-6.9 warn, 7-8.4 signal, >=8.5 ok. */
export function scoreTone(score: number | null | undefined): Tone {
  if (score == null) return "muted";
  if (score < 5) return "danger";
  if (score < 7) return "warn";
  if (score < 8.5) return "signal";
  return "ok";
}

export const toneText: Record<Tone, string> = {
  danger: "text-danger",
  warn: "text-warn",
  signal: "text-signal",
  ok: "text-ok",
  muted: "text-text-3",
};

export const toneBg: Record<Tone, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  signal: "bg-signal",
  ok: "bg-ok",
  muted: "bg-text-3",
};

export const toneSoft: Record<Tone, string> = {
  danger: "bg-danger-soft",
  warn: "bg-warn-soft",
  signal: "bg-signal-soft",
  ok: "bg-ok-soft",
  muted: "bg-ink-3",
};

export const toneBorder: Record<Tone, string> = {
  danger: "border-danger/20",
  warn: "border-warn/20",
  signal: "border-signal/20",
  ok: "border-ok/20",
  muted: "border-line",
};

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Session length: "23 min", "1 h 4 min". Returns null when unknown so the UI can hide it. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Compact total for stat tiles: "42 min" or "3.3 h". */
export function formatTotalTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/** Uses total_duration_seconds, else completed_at - started_at, else null (hide). */
export function sessionDurationSeconds(session: InterviewSession): number | null {
  if (session.total_duration_seconds != null) return session.total_duration_seconds;
  if (session.completed_at && session.started_at) {
    const diff = (Date.parse(session.completed_at) - Date.parse(session.started_at)) / 1000;
    if (Number.isFinite(diff) && diff > 0) return Math.round(diff);
  }
  return null;
}

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined): string {
  const d = validDate(iso);
  if (!d) return "Unknown date";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  const d = validDate(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(iso: string | null | undefined): string {
  const d = validDate(iso);
  if (!d) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Whole calendar days between two dates, ignoring time of day and DST. */
function dayDiff(a: Date, b: Date): number {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((A - B) / 86_400_000);
}

export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  const d = validDate(iso);
  if (!d) return "Unknown date";
  const days = dayDiff(now, d);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 35) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  return formatDate(iso);
}

/** Local calendar day key, used for streaks. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const STAGE_LABELS: Record<string, string> = {
  INTRO: "Intro",
  AWAITING_CLARIFICATION: "Clarify",
  AWAITING_APPROACH: "Approach",
  AWAITING_CODE: "Code",
  AWAITING_WALKTHROUGH: "Walkthrough",
  CONCLUDING: "Wrap-up",
  GENERATING_DEBRIEF: "Debrief",
  COMPLETED: "Complete",
};

export function stageLabel(state: string): string {
  if (STAGE_LABELS[state]) return STAGE_LABELS[state];
  const words = state.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${encodeURIComponent(slug)}/`;
}

export function leetcodeSearchUrl(query: string): string {
  return `https://leetcode.com/problemset/?search=${encodeURIComponent(query)}`;
}

export function firstName(user: User | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const full = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  if (full) return full.trim().split(/\s+/)[0];
  return user?.email?.split("@")[0] ?? "there";
}

export function initialOf(user: User | null): string {
  return firstName(user).charAt(0).toUpperCase() || "?";
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

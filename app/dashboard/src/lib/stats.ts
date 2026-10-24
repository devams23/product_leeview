import type { InterviewSession } from "../types";
import { SKILLS, dayKey, formatShortDate, sessionDurationSeconds, type SkillKey } from "./format";

export interface TrendPoint {
  id: string;
  label: string;
  date: string;
  score: number;
  title: string;
}

export interface SkillStat {
  key: SkillKey;
  label: string;
  tip: string;
  average: number | null;
  count: number;
}

export interface Summary {
  total: number;
  completed: number;
  scored: number;
  avgScore: number | null;
  totalSeconds: number;
  streak: number;
  lastActivity: string | null;
  trend: TrendPoint[];
  skills: SkillStat[];
  weakest: SkillStat | null;
}

const TREND_WINDOW = 20;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The moment a session "happened": completion if we have it, otherwise start. */
export function activityDate(session: InterviewSession): string | null {
  const iso = session.completed_at ?? session.started_at;
  return iso && !Number.isNaN(Date.parse(iso)) ? iso : null;
}

export function computeSummary(sessions: InterviewSession[], now: Date = new Date()): Summary {
  const overall = sessions
    .map((s) => s.debriefs?.overall_score)
    .filter((v): v is number => typeof v === "number");
  const avgScore = overall.length ? round1(overall.reduce((a, b) => a + b, 0) / overall.length) : null;

  const totalSeconds = sessions.reduce((acc, s) => acc + (sessionDurationSeconds(s) ?? 0), 0);

  // Streak: consecutive local days with activity, counting back from today (or from yesterday
  // when today has none yet).
  const activeDays = new Set<string>();
  for (const s of sessions) {
    const iso = activityDate(s);
    if (iso) activeDays.add(dayKey(new Date(iso)));
  }
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const trend: TrendPoint[] = sessions
    .filter((s) => s.status === "COMPLETED" && typeof s.debriefs?.overall_score === "number")
    .map((s) => ({ s, iso: activityDate(s) ?? s.started_at }))
    .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso))
    .slice(-TREND_WINDOW)
    .map(({ s, iso }) => ({
      id: s.id,
      label: formatShortDate(iso),
      date: iso,
      score: s.debriefs?.overall_score ?? 0,
      title: s.leetcode_title,
    }));

  const skills: SkillStat[] = SKILLS.map((skill) => {
    const values = sessions
      .map((s) => s.debriefs?.[skill.key])
      .filter((v): v is number => typeof v === "number");
    return {
      key: skill.key,
      label: skill.label,
      tip: skill.tip,
      average: values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null,
      count: values.length,
    };
  });
  const weakest =
    skills
      .filter((s): s is SkillStat & { average: number } => s.average !== null)
      .sort((a, b) => a.average - b.average)[0] ?? null;

  const lastActivity = sessions
    .map(activityDate)
    .filter((v): v is string => v !== null)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  return {
    total: sessions.length,
    completed: sessions.filter((s) => s.status === "COMPLETED").length,
    scored: overall.length,
    avgScore,
    totalSeconds,
    streak,
    lastActivity,
    trend,
    skills,
    weakest,
  };
}

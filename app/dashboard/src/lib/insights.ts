import type { InterviewSession } from "../types";
import { SKILLS, dayKey, formatScore, leetcodeSearchUrl, leetcodeUrl, type SkillKey } from "./format";
import { activityDate } from "./stats";

/** Interviews a week. A weekly goal survives a missed day, which a daily streak does not. */
export const WEEKLY_GOAL = 3;

const ACTIVITY_WEEKS = 18;
const COMPARE_WINDOW = 3;
const NOTICED_LIMIT = 3;
const UNLOCK_NOTICED_AT = 3;
const STALE_INTERRUPT_DAYS = 7;
const LOW_SCORE = 7;
const DAY_MS = 86_400_000;
const PROBLEMSET_URL = "https://leetcode.com/problemset/";

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Scored {
  session: InterviewSession;
  score: number;
  iso: string;
}

/** Scored interviews, oldest first. */
function scoredInterviews(sessions: InterviewSession[]): Scored[] {
  return sessions
    .flatMap((session) => {
      const score = session.debriefs?.overall_score;
      const iso = activityDate(session);
      return typeof score === "number" && iso ? [{ session, score, iso }] : [];
    })
    .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));
}

export interface Change {
  recent: number;
  /** Null until there is an earlier interview to compare with. */
  delta: number | null;
  /** How many interviews sit on each side of the comparison. */
  window: number;
}

/** Latest interviews against the same number before them, so one good day doesn't read as a trend. */
function changeIn(values: number[]): Change | null {
  if (values.length === 0) return null;
  if (values.length === 1) return { recent: values[0], delta: null, window: 1 };
  const window = Math.min(COMPARE_WINDOW, Math.floor(values.length / 2));
  const recent = mean(values.slice(-window));
  const previous = mean(values.slice(-window * 2, -window));
  return { recent: round1(recent), delta: round1(recent - previous), window };
}

export interface SkillChange extends Change {
  key: SkillKey;
  label: string;
  tip: string;
}

function skillChanges(scored: Scored[]): SkillChange[] {
  return SKILLS.flatMap((skill) => {
    const values = scored
      .map(({ session }) => session.debriefs?.[skill.key])
      .filter((v): v is number => typeof v === "number");
    const change = changeIn(values);
    return change ? [{ ...change, key: skill.key, label: skill.label, tip: skill.tip }] : [];
  });
}

export interface ActivityDay {
  date: Date;
  count: number;
  future: boolean;
}

export interface Rhythm {
  thisWeek: number;
  daysLeft: number;
  /** Weeks in a row at the goal. This week only counts once it is met, so it never resets early. */
  weekStreak: number;
  /** Oldest week first, Monday first within each week. */
  weeks: ActivityDay[][];
}

function startOfWeek(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7);
}

export function weeklyRhythm(sessions: InterviewSession[], now: Date = new Date()): Rhythm {
  const perDay = new Map<string, number>();
  const perWeek = new Map<string, number>();
  for (const session of sessions) {
    const iso = activityDate(session);
    if (session.status !== "COMPLETED" || !iso) continue;
    const date = new Date(iso);
    const day = dayKey(date);
    const week = dayKey(startOfWeek(date));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }

  const monday = startOfWeek(now);
  const thisWeek = perWeek.get(dayKey(monday)) ?? 0;

  const cursor = new Date(monday);
  if (thisWeek < WEEKLY_GOAL) cursor.setDate(cursor.getDate() - 7);
  let weekStreak = 0;
  while ((perWeek.get(dayKey(cursor)) ?? 0) >= WEEKLY_GOAL) {
    weekStreak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  const weeks = Array.from({ length: ACTIVITY_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d - (ACTIVITY_WEEKS - 1 - w) * 7);
      return { date, count: perDay.get(dayKey(date)) ?? 0, future: date.getTime() > now.getTime() };
    }),
  );

  return { thisWeek, daysLeft: 7 - (now.getDay() + 6) % 7, weekStreak, weeks };
}

export interface NextInterview {
  title: string;
  url: string;
  reason: string;
}

function problemFromSuggestion(suggestion: string) {
  const isSlug = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(suggestion);
  if (!isSlug) return { title: suggestion, url: leetcodeSearchUrl(suggestion) };
  const title = suggestion.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return { title, url: leetcodeUrl(suggestion) };
}

const comparable = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** In order: finish what was left, then the last debrief's suggestion, then redo a low score. */
function pickNext(sessions: InterviewSession[], scored: Scored[], now: Date): NextInterview {
  const latest = sessions
    .filter((s) => s.status !== "PREPARING" && activityDate(s))
    .sort((a, b) => Date.parse(activityDate(b)!) - Date.parse(activityDate(a)!))[0];
  if (
    latest?.status === "INTERRUPTED" &&
    now.getTime() - Date.parse(activityDate(latest)!) < STALE_INTERRUPT_DAYS * DAY_MS
  ) {
    return {
      title: latest.leetcode_title,
      url: leetcodeUrl(latest.leetcode_slug),
      reason: "You left this one early. Finish it to get your debrief.",
    };
  }

  const attempted = new Set(sessions.flatMap((s) => [comparable(s.leetcode_title), comparable(s.leetcode_slug)]));
  const newest = scored[scored.length - 1];
  const suggestion = newest?.session.debriefs?.similar_problems.find((p) => !attempted.has(comparable(p)));
  if (newest && suggestion) {
    return {
      ...problemFromSuggestion(suggestion),
      reason: `Suggested after ${newest.session.leetcode_title}, where you scored ${newest.score}.`,
    };
  }

  const retake = scored.slice(-5).filter(({ score }) => score < LOW_SCORE).sort((a, b) => a.score - b.score)[0];
  if (retake) {
    return {
      title: retake.session.leetcode_title,
      url: leetcodeUrl(retake.session.leetcode_slug),
      reason: `You scored ${retake.score} here. Go again and see what changes.`,
    };
  }

  return { title: "Pick your next problem", url: PROBLEMSET_URL, reason: "Any LeetCode problem works." };
}

export interface Reminder {
  heading: string;
  body: string;
}

/** What to keep in mind next time: the latest debrief's own advice, or the weakest skill's tip. */
function pickReminder(scored: Scored[], focus: SkillChange | null): Reminder | null {
  const newest = scored[scored.length - 1];
  const feedback = newest?.session.debriefs?.actionable_feedback[0];
  if (newest && feedback) return { heading: `From your ${newest.session.leetcode_title} debrief`, body: feedback };
  return focus ? { heading: `Work on ${focus.label.toLowerCase()}`, body: focus.tip } : null;
}

export interface Noticed {
  id: string;
  mood: "up" | "down" | "neutral";
  title: string;
  detail: string;
}

const interviews = (n: number) => `${n} interview${n === 1 ? "" : "s"}`;

function groupAverages(scored: Scored[], keysOf: (s: Scored) => string[]) {
  const groups = new Map<string, number[]>();
  for (const item of scored) {
    for (const key of keysOf(item)) groups.set(key, [...(groups.get(key) ?? []), item.score]);
  }
  return [...groups].filter(([, scores]) => scores.length >= 2).map(([name, scores]) => ({ name, average: round1(mean(scores)), count: scores.length }));
}

function noticePatterns(sessions: InterviewSession[], scored: Scored[], skills: SkillChange[]): Noticed[] {
  const noticed: Noticed[] = [];

  const newest = scored[scored.length - 1];
  const earlierBest = Math.max(...scored.slice(0, -1).map(({ score }) => score));
  if (scored.length >= 3 && newest.score > earlierBest) {
    noticed.push({
      id: "best",
      mood: "up",
      title: `${newest.score}/10 is your best score yet`,
      detail: `You set it on ${newest.session.leetcode_title}.`,
    });
  }

  const retake = [...new Set(scored.map(({ session }) => session.leetcode_slug))]
    .map((slug) => scored.filter(({ session }) => session.leetcode_slug === slug))
    .filter((runs) => runs.length >= 2 && runs[runs.length - 1].score > runs[0].score)
    .pop();
  if (retake) {
    const first = retake[0];
    const last = retake[retake.length - 1];
    noticed.push({
      id: "retake",
      mood: "up",
      title: `${last.session.leetcode_title} went from ${first.score} to ${last.score}`,
      detail: "Repeating a problem out loud is paying off.",
    });
  }

  const compared = skills.filter((s): s is SkillChange & { delta: number } => s.delta !== null);
  const gain = [...compared].sort((a, b) => b.delta - a.delta)[0];
  if (gain && gain.delta >= 0.5) {
    noticed.push({
      id: "gain",
      mood: "up",
      title: `${gain.label} is your biggest gain`,
      detail: `Up ${formatScore(gain.delta)} to ${formatScore(gain.recent)} across your latest ${interviews(gain.window)}.`,
    });
  }
  const slip = [...compared].sort((a, b) => a.delta - b.delta)[0];
  if (slip && slip.delta <= -0.5) {
    noticed.push({
      id: "slip",
      mood: "down",
      title: `${slip.label} has slipped`,
      detail: `Down ${formatScore(-slip.delta)} to ${formatScore(slip.recent)}. ${slip.tip}`,
    });
  }

  const finished = sessions.filter((s) => s.status === "COMPLETED" || s.status === "INTERRUPTED").slice(0, 6);
  const leftEarly = finished.filter((s) => s.status === "INTERRUPTED").length;
  if (leftEarly >= 2) {
    noticed.push({
      id: "left-early",
      mood: "down",
      title: `You left ${leftEarly} of your last ${finished.length} early`,
      detail: "Debriefs only come from finished interviews, so stick with the hard part.",
    });
  }

  const topics = groupAverages(scored, ({ session }) => session.problem_topics ?? []).sort((a, b) => a.average - b.average);
  if (topics.length >= 2 && topics[topics.length - 1].average - topics[0].average >= 1) {
    noticed.push({
      id: "topic",
      mood: "neutral",
      title: `${topics[0].name} is your weakest topic`,
      detail: `You average ${formatScore(topics[0].average)} across ${interviews(topics[0].count)}, against ${formatScore(topics[topics.length - 1].average)} on ${topics[topics.length - 1].name}.`,
    });
  }

  const levels = groupAverages(scored, ({ session }) => (session.problem_difficulty ? [session.problem_difficulty] : []));
  const easy = levels.find((l) => l.name === "Easy");
  const harder = levels.find((l) => l.name === "Hard") ?? levels.find((l) => l.name === "Medium");
  if (easy && harder && easy.average - harder.average >= 1) {
    noticed.push({
      id: "difficulty",
      mood: "neutral",
      title: `${harder.name} problems cost you ${formatScore(round1(easy.average - harder.average))} points`,
      detail: `You average ${formatScore(easy.average)} on Easy and ${formatScore(harder.average)} on ${harder.name}.`,
    });
  }

  return noticed.slice(0, NOTICED_LIMIT);
}

export interface Insights {
  scoredCount: number;
  overall: Change | null;
  skills: SkillChange[];
  /** The weakest skill right now, judged on recent interviews. */
  focus: SkillChange | null;
  best: number | null;
  next: NextInterview;
  reminder: Reminder | null;
  noticed: Noticed[];
  /** Scored interviews still needed before patterns can be called. */
  noticedRemaining: number;
}

export function computeInsights(sessions: InterviewSession[], now: Date = new Date()): Insights {
  const scored = scoredInterviews(sessions);
  const skills = skillChanges(scored);
  const focus = [...skills].sort((a, b) => a.recent - b.recent)[0] ?? null;

  return {
    scoredCount: scored.length,
    overall: changeIn(scored.map(({ score }) => score)),
    skills,
    focus,
    best: scored.length ? Math.max(...scored.map(({ score }) => score)) : null,
    next: pickNext(sessions, scored, now),
    reminder: pickReminder(scored, focus),
    noticed: scored.length >= UNLOCK_NOTICED_AT ? noticePatterns(sessions, scored, skills) : [],
    noticedRemaining: Math.max(0, UNLOCK_NOTICED_AT - scored.length),
  };
}

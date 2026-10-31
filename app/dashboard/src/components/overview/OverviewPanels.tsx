import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { DifficultyChip } from "../ui/Chip";
import { buttonClass } from "../ui/Button";
import { TrendChart } from "../charts/TrendChart";
import {
  WEEKLY_GOAL,
  type ActivityDay,
  type Change,
  type Insights,
  type Noticed,
  type Rhythm,
  type SkillChange,
} from "../../lib/insights";
import type { TrendPoint } from "../../lib/stats";
import { formatDate, formatRelative, scoreTone, toneText } from "../../lib/format";
import { activityDate } from "../../lib/stats";
import type { InterviewSession } from "../../types";

const RECENT_LIMIT = 4;

const oneDecimal = (n: number) => n.toFixed(1);

function Delta({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="text-[13px] text-text-3">{value === 0 ? "No change" : ""}</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] tabular-nums ${up ? "text-signal" : "text-warn"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" className={up ? "" : "rotate-180"}>
        <path d="M5 1.5 9 8H1z" />
      </svg>
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {oneDecimal(Math.abs(value))}
    </span>
  );
}

export function UpNext({ next, reminder }: Pick<Insights, "next" | "reminder">) {
  return (
    <section aria-labelledby="up-next" className="flex flex-col rounded-shell border border-line-2 bg-ink-1 p-6 sm:p-8">
      <p id="up-next" className="text-[14px] font-medium text-signal">
        Up next
      </p>
      <h2 className="mt-3 text-balance font-display text-[34px] leading-[1.06] tracking-[-0.02em] text-text-1 sm:text-[44px]">
        {next.title}
      </h2>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-text-2">{next.reason}</p>

      {reminder && (
        <div className="mt-6 rounded-card bg-ink-2 p-4 sm:p-5">
          <p className="text-[13px] text-text-3">{reminder.heading}</p>
          <p className="mt-1 max-w-[60ch] text-[15px] leading-relaxed text-text-1">{reminder.body}</p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-7">
        <a href={next.url} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
          Start this interview
        </a>
        <p className="text-[13px] text-text-3">Opens on LeetCode, about 20 minutes</p>
      </div>
    </section>
  );
}

function dayLabel({ date, count }: ActivityDay) {
  return `${formatDate(date.toISOString())}: ${count === 0 ? "no interviews" : `${count} interview${count === 1 ? "" : "s"}`}`;
}

function ActivityGrid({ weeks }: { weeks: Rhythm["weeks"] }) {
  const total = weeks.flat().reduce((n, day) => n + day.count, 0);
  return (
    <div role="img" aria-label={`${total} interviews in the last ${weeks.length} weeks`} className="flex justify-between gap-[3px]">
      {weeks.map((week, w) => (
        <div key={w} className="flex flex-1 flex-col gap-[3px]">
          {week.map((day) => (
            <span
              key={day.date.getTime()}
              title={day.future ? undefined : dayLabel(day)}
              className={`aspect-square w-full rounded-[3px] ${
                day.future ? "" : day.count === 0 ? "bg-ink-3" : day.count === 1 ? "bg-signal/55" : "bg-signal"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ThisWeek({ rhythm }: { rhythm: Rhythm }) {
  const { thisWeek, daysLeft, weekStreak } = rhythm;
  const remaining = WEEKLY_GOAL - thisWeek;
  const message =
    remaining <= 0
      ? "Goal hit. Anything more is a bonus."
      : daysLeft === 1
        ? `${remaining} to go, and today is the last day.`
        : `${remaining} to go, ${daysLeft} days left.`;

  return (
    <Card className="flex flex-col rounded-shell p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-medium text-text-1">This week</h2>
        {weekStreak > 0 && (
          <p className="text-[13px] text-text-2">
            {weekStreak} week{weekStreak === 1 ? "" : "s"} running
          </p>
        )}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-[52px] leading-none tabular-nums text-text-1">{thisWeek}</span>
        <span className="text-[15px] text-text-3">of {WEEKLY_GOAL}</span>
      </p>
      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: WEEKLY_GOAL }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < thisWeek ? "bg-signal" : "bg-ink-3"}`} />
        ))}
      </div>
      <p className="mt-3 text-[14px] text-text-2">{message}</p>
      <div className="mt-auto pt-6">
        <p className="mb-2 text-[13px] text-text-3">Last {rhythm.weeks.length} weeks</p>
        <ActivityGrid weeks={rhythm.weeks} />
      </div>
    </Card>
  );
}

function trendHeadline(overall: Change | null): string {
  if (!overall) return "Your first score sets the baseline";
  if (overall.delta === null) return `You started at ${oneDecimal(overall.recent)}`;
  const average = `Averaging ${oneDecimal(overall.recent)}`;
  if (overall.delta >= 0.3) return `${average}, up ${oneDecimal(overall.delta)}`;
  if (overall.delta <= -0.3) return `${average}, down ${oneDecimal(-overall.delta)}`;
  return `${average}, holding steady`;
}

function trendBasis(overall: Change | null): string | null {
  if (overall?.delta == null) return null;
  return overall.window === 1
    ? "Your latest interview against the one before"
    : `Your last ${overall.window} interviews against the ${overall.window} before`;
}

function SkillRow({ skill, focus }: { skill: SkillChange; focus: boolean }) {
  return (
    <li className={`flex items-center gap-3 ${focus ? "-mx-3 rounded-btn bg-ink-2 px-3 py-2.5" : "py-1"}`}>
      <span className={`flex-1 text-[14px] ${focus ? "text-text-1" : "text-text-2"}`}>
        {skill.label}
        {focus && <span className="ml-2 text-[13px] text-text-3">Your focus</span>}
      </span>
      <Delta value={skill.delta} />
      <span className="w-9 text-right font-display text-[20px] leading-none tabular-nums text-text-1">
        {oneDecimal(skill.recent)}
      </span>
    </li>
  );
}

export function Progress({ insights, trend }: { insights: Insights; trend: TrendPoint[] }) {
  const { overall, skills, focus, best } = insights;
  return (
    <Card className="grid rounded-shell lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="flex flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="font-display text-[26px] leading-tight tracking-[-0.02em] text-text-1">{trendHeadline(overall)}</h2>
          {best !== null && <p className="text-[13px] text-text-3">Best score {best}</p>}
        </div>
        {trendBasis(overall) && <p className="mt-1 text-[13px] text-text-3">{trendBasis(overall)}</p>}
        <div className="mt-5 min-h-0 flex-1">
          {trend.length >= 2 ? (
            <TrendChart data={trend} />
          ) : (
            <p className="text-[14px] text-text-2">Your score line starts after your second scored interview.</p>
          )}
        </div>
      </div>
      <div className="border-t border-line p-6 sm:p-7 lg:border-l lg:border-t-0">
        <h2 className="text-[14px] font-medium text-text-1">Skills</h2>
        <p className="mt-1 text-[13px] text-text-3">Recent average, and how it moved</p>
        {skills.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {skills.map((skill) => (
              <SkillRow key={skill.key} skill={skill} focus={skill.key === focus?.key} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-text-2">Skills appear after your first scored debrief.</p>
        )}
        {focus && <p className="mt-4 text-[14px] leading-relaxed text-text-2">{focus.tip}</p>}
      </div>
    </Card>
  );
}

const moodMark: Record<Noticed["mood"], string> = {
  up: "bg-signal",
  down: "bg-warn",
  neutral: "bg-ai",
};

export function WhatWeNoticed({ noticed, remaining }: { noticed: Noticed[]; remaining: number }) {
  if (remaining > 0) {
    return (
      <section aria-labelledby="noticed">
        <h2 id="noticed" className="font-display text-[26px] leading-tight tracking-[-0.02em] text-text-1">
          Patterns take a few interviews
        </h2>
        <p className="mt-2 text-[15px] text-text-2">
          {remaining} more scored interview{remaining === 1 ? "" : "s"} and LeeView starts showing what your scores have
          in common.
        </p>
      </section>
    );
  }
  if (noticed.length === 0) return null;

  return (
    <section aria-labelledby="noticed">
      <h2 id="noticed" className="font-display text-[26px] leading-tight tracking-[-0.02em] text-text-1">
        What we noticed
      </h2>
      <ul className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-3">
        {noticed.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${moodMark[item.mood]}`} />
            <div>
              <p className="text-[15px] font-medium leading-snug text-text-1">{item.title}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RecentInterviews({ sessions }: { sessions: InterviewSession[] }) {
  const recent = sessions.filter((s) => s.status !== "PREPARING").slice(0, RECENT_LIMIT);
  return (
    <section aria-labelledby="recent">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent" className="font-display text-[26px] leading-tight tracking-[-0.02em] text-text-1">
          Recent interviews
        </h2>
        <Link to="/history" className="text-[14px] text-text-2 transition-colors duration-150 hover:text-text-1">
          View all
        </Link>
      </div>
      <Card className="mt-4 overflow-hidden">
        <ul className="flex flex-col divide-y divide-line">
          {recent.map((session) => {
            const score = session.debriefs?.overall_score;
            return (
              <li key={session.id}>
                <Link
                  to={`/session/${session.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-ink-2 focus-visible:bg-ink-2 sm:px-5"
                >
                  <span
                    aria-label={score == null ? "No score" : `Score ${score} out of 10`}
                    className={`w-7 font-display text-[22px] leading-none tabular-nums ${toneText[scoreTone(score)]}`}
                  >
                    {score ?? "–"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] text-text-1">{session.leetcode_title}</span>
                  <span className="hidden sm:block">
                    <DifficultyChip value={session.problem_difficulty} />
                  </span>
                  <span className="shrink-0 text-[13px] text-text-3">{formatRelative(activityDate(session))}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

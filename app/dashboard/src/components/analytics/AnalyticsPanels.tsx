import { Card } from "../ui/Card";
import { TrendChart } from "../charts/TrendChart";
import type { ActivityDay, Change, Insights, Noticed, Rhythm, SkillChange } from "../../lib/insights";
import type { Summary, TrendPoint } from "../../lib/stats";
import { formatDate, formatScore, formatTotalTime } from "../../lib/format";

const oneDecimal = (n: number) => n.toFixed(1);

const dayShade = ({ count }: ActivityDay) => (count === 0 ? "bg-ink-3" : count === 1 ? "bg-signal/55" : "bg-signal");

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <dt className="text-[13px] text-text-2">{label}</dt>
      <dd className="mt-1.5 font-display text-[30px] leading-none tabular-nums text-text-1">{value}</dd>
    </div>
  );
}

/** The all-time totals, read as one strip rather than four cards. */
export function StatStrip({ summary, best }: { summary: Summary; best: number | null }) {
  return (
    <Card>
      <dl className="grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line lg:[&>*:nth-child(n+3)]:border-t-0">
        <Stat label="Interviews" value={String(summary.total)} />
        <Stat label="Average score" value={summary.avgScore !== null ? formatScore(summary.avgScore) : "–"} />
        <Stat label="Best score" value={best !== null ? formatScore(best) : "–"} />
        <Stat label="Time practiced" value={summary.totalSeconds > 0 ? formatTotalTime(summary.totalSeconds) : "–"} />
      </dl>
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
  const { overall, skills, focus } = insights;
  return (
    <Card className="grid rounded-shell lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="flex flex-col p-6 sm:p-7">
        <h2 className="font-display text-[26px] leading-tight tracking-[-0.02em] text-text-1">{trendHeadline(overall)}</h2>
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

function dayLabel({ date, count }: ActivityDay) {
  return `${formatDate(date.toISOString())}: ${count === 0 ? "no interviews" : `${count} interview${count === 1 ? "" : "s"}`}`;
}

export function Activity({ rhythm }: { rhythm: Rhythm }) {
  const { weeks, weekStreak } = rhythm;
  const total = weeks.flat().reduce((n, day) => n + day.count, 0);
  return (
    <Card className="flex flex-col rounded-shell p-6 sm:p-7">
      <h2 className="text-[14px] font-medium text-text-1">Activity</h2>
      <p className="mt-1 text-[13px] text-text-3">
        {total} interview{total === 1 ? "" : "s"} in {weeks.length} weeks
        {weekStreak > 0 ? `, goal hit ${weekStreak} week${weekStreak === 1 ? "" : "s"} running` : ""}
      </p>
      <div role="img" aria-label={`${total} interviews in the last ${weeks.length} weeks`} className="mt-5 flex gap-[3px]">
        {weeks.map((week, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <span
                key={day.date.getTime()}
                title={day.future ? undefined : dayLabel(day)}
                className={`h-[14px] w-[14px] rounded-[3px] ${day.future ? "" : dayShade(day)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-3 text-[12px] text-text-3" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-ink-3" />None</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-signal/55" />One</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-signal" />Two or more</span>
      </p>
    </Card>
  );
}

const moodMark: Record<Noticed["mood"], string> = {
  up: "bg-signal",
  down: "bg-warn",
  neutral: "bg-ai",
};

export function WhatWeNoticed({ noticed, remaining }: { noticed: Noticed[]; remaining: number }) {
  return (
    <Card className="rounded-shell p-6 sm:p-7">
      {remaining > 0 ? (
        <>
          <h2 className="text-[14px] font-medium text-text-1">Patterns take a few interviews</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-text-2">
            {remaining} more scored interview{remaining === 1 ? "" : "s"} and LeeView starts showing what your scores have
            in common.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-[14px] font-medium text-text-1">What we noticed</h2>
          {noticed.length === 0 ? (
            <p className="mt-2 text-[15px] text-text-2">No clear pattern in your recent scores yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-5">
              {noticed.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${moodMark[item.mood]}`} />
                  <div>
                    <p className="text-[15px] font-medium leading-snug text-text-1">{item.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-text-2">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { DifficultyChip } from "../ui/Chip";
import { buttonClass } from "../ui/Button";
import { WEEKLY_GOAL, type Insights, type Rhythm } from "../../lib/insights";
import { formatRelative, scoreTone, toneText } from "../../lib/format";
import { activityDate } from "../../lib/stats";
import type { InterviewSession } from "../../types";

const RECENT_LIMIT = 4;

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
      <Link
        to="/analytics"
        className="mt-auto pt-6 text-[14px] text-text-2 transition-colors duration-150 hover:text-text-1"
      >
        View analytics
      </Link>
    </Card>
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

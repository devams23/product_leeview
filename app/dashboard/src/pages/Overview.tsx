import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useInterviews } from "../hooks/useInterviews";
import { computeSummary } from "../lib/stats";
import { firstName, formatRelative, formatScore, formatTotalTime, greeting, scoreTone, toneText } from "../lib/format";
import { Card, CardHeader } from "../components/ui/Card";
import { StatTile } from "../components/ui/StatTile";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { OverviewSkeleton } from "../components/ui/Skeleton";
import { buttonClass } from "../components/ui/Button";
import { TrendChart } from "../components/charts/TrendChart";
import { SkillBar } from "../components/SkillBar";
import { SessionsTable } from "../components/SessionsTable";
import { SKILLS } from "../lib/format";

const ONBOARDING_LINK = "https://leetcode.com/problems/two-sum/";

export function Overview() {
  const { user } = useAuth();
  const { interviews, loading, error, reload } = useInterviews();
  const summary = useMemo(() => computeSummary(interviews), [interviews]);
  const hasSessions = interviews.length > 0;

  const subline = loading
    ? null
    : hasSessions && summary.lastActivity
      ? `Last practiced ${formatRelative(summary.lastActivity)}.`
      : "Your practice history will appear here.";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[40px] leading-[1.05] text-text-1 sm:text-[52px]">
          {greeting()}, {firstName(user)}.
        </h1>
        {subline ? (
          <p className="text-[15px] text-text-2">{subline}</p>
        ) : (
          <div className="h-5 w-48 animate-pulse rounded-chip bg-ink-2" aria-hidden="true" />
        )}
      </header>

      {error && <ErrorBanner title="Your interviews did not load" message={error} onRetry={reload} />}

      {loading ? (
        <OverviewSkeleton />
      ) : !hasSessions ? (
        error ? null : <Onboarding />
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label="Interviews"
              value={summary.total}
              sub={`${summary.completed} completed`}
            />
            <StatTile
              label="Avg score"
              value={summary.avgScore == null ? "-" : summary.avgScore.toFixed(1)}
              tone={scoreTone(summary.avgScore)}
              sub={summary.scored ? `Across ${summary.scored} debrief${summary.scored === 1 ? "" : "s"}` : "No debriefs yet"}
            />
            <StatTile
              label="Practice time"
              value={summary.totalSeconds > 0 ? formatTotalTime(summary.totalSeconds) : "0 min"}
              sub="Spoken, across all interviews"
            />
            <StatTile
              label="Day streak"
              value={summary.streak}
              sub={summary.streak > 0 ? "Days in a row" : "Practise today to start one"}
            />
          </section>

          <section aria-label="Progress" className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 sm:p-6 lg:col-span-2">
              <CardHeader
                title="Score trend"
                description={
                  summary.trend.length > 0
                    ? `Your last ${summary.trend.length} scored interview${summary.trend.length === 1 ? "" : "s"}`
                    : "Overall score for each completed interview"
                }
              />
              {summary.trend.length >= 2 ? (
                <TrendChart data={summary.trend} />
              ) : summary.trend.length === 1 ? (
                <p className="py-10 text-[14px] text-text-2">
                  Your first score is{" "}
                  <span className={`font-medium ${toneText[scoreTone(summary.trend[0].score)]}`}>
                    {summary.trend[0].score}/10
                  </span>
                  . Finish one more scored interview to see the trend.
                </p>
              ) : (
                <p className="py-10 text-[14px] text-text-2">
                  Finish a scored interview to start your trend line.
                </p>
              )}
            </Card>

            <Card className="flex flex-col p-5 sm:p-6">
              <CardHeader title="Skill averages" description="Across all scored debriefs" />
              {summary.weakest ? (
                <ul className="flex flex-col gap-5">
                  {SKILLS.map((skill) => {
                    const stat = summary.skills.find((s) => s.key === skill.key);
                    return <SkillBar key={skill.key} label={skill.label} value={stat?.average ?? null} />;
                  })}
                </ul>
              ) : (
                <p className="text-[14px] text-text-2">Skill averages appear after your first scored debrief.</p>
              )}
              {summary.weakest && (
                <div className="mt-6 rounded-btn border border-warn/25 bg-warn-soft p-4">
                  <p className="font-mono text-[11px] text-warn">Focus area</p>
                  <p className="mt-1.5 text-[14px] font-medium text-text-1">
                    {summary.weakest.label}, averaging {formatScore(summary.weakest.average ?? 0)}/10
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-2">{summary.weakest.tip}</p>
                </div>
              )}
            </Card>
          </section>

          <section aria-labelledby="recent-heading">
            <Card className="p-5 sm:p-6">
              <div className="mb-4">
                <CardHeader title="Recent sessions" description="Select a row to replay the transcript and code." />
              </div>
              <SessionsTable sessions={interviews} limit={8} />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function Onboarding() {
  const steps = [
    { done: true, title: "Sign in", body: "You are signed in to LeeView." },
    {
      done: false,
      title: "Install the LeeView extension",
      body: "Add it to Chrome and pin it to your toolbar so the panel is one click away.",
    },
    {
      done: false,
      title: "Do your first interview",
      body: "Open any LeetCode problem and start the panel. About 20 minutes, spoken, with a scored debrief at the end.",
    },
  ];

  return (
    <Card className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_1.1fr] md:items-start">
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-[32px] leading-tight text-text-1">Do your first interview</h2>
        <p className="max-w-[40ch] text-[15px] leading-relaxed text-text-2">
          Talk through a real problem out loud. Your scores, transcript and progress will collect here as you go.
        </p>
        <a
          href={ONBOARDING_LINK}
          target="_blank"
          rel="noreferrer"
          className={buttonClass("primary", "md", "w-fit")}
        >
          Open Two Sum on LeetCode
        </a>
      </div>
      <ul className="flex flex-col">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 border-t border-line py-5 first:border-t-0 first:pt-0">
            <span
              aria-hidden="true"
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                step.done ? "border-ok/40 bg-ok-soft text-ok" : "border-line-2 text-text-3"
              }`}
            >
              {step.done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 4 4 10-10" />
                </svg>
              ) : (
                <span className="font-mono text-[11px]">{i + 1}</span>
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-[15px] font-medium ${step.done ? "text-text-2" : "text-text-1"}`}>
                {step.title}
                {step.done && <span className="sr-only"> (done)</span>}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-text-2">{step.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

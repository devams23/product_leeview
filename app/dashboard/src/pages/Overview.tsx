import { useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useInterviews } from "../hooks/useInterviews";
import { computeSummary, type Summary } from "../lib/stats";
import { computeInsights, weeklyRhythm, type Insights } from "../lib/insights";
import { firstName, formatRelative, formatScore, greeting } from "../lib/format";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { OverviewSkeleton } from "../components/ui/Skeleton";
import { buttonClass } from "../components/ui/Button";
import {
  Progress,
  RecentInterviews,
  ThisWeek,
  UpNext,
  WhatWeNoticed,
} from "../components/overview/OverviewPanels";
import { useExtensionInstalled } from "../hooks/useExtensionInstalled";

const ONBOARDING_LINK = "https://leetcode.com/problems/two-sum/";
const WELCOME_BACK_DAYS = 5;

/** The greeting's one line: a nudge after time away, otherwise the latest change in their scores. */
function headline(summary: Summary, insights: Insights, now: Date = new Date()): string {
  if (!summary.lastActivity) return "Your practice history will appear here.";
  const away = Math.floor((now.getTime() - Date.parse(summary.lastActivity)) / 86_400_000);
  if (away >= WELCOME_BACK_DAYS) return `It's been ${away} days. A short interview today picks things back up.`;

  const overall = insights.overall;
  if (overall?.delta != null) {
    const span = overall.window === 1 ? "your last interview" : `your last ${overall.window} interviews`;
    if (overall.delta >= 0.3) return `You're up ${formatScore(overall.delta)} over ${span}.`;
    if (overall.delta <= -0.3) return `The last few dipped a little. Your next one can turn it around.`;
    return `You're holding steady at ${formatScore(overall.recent)}.`;
  }
  return `Last practiced ${formatRelative(summary.lastActivity).toLowerCase()}.`;
}

export function Overview() {
  const { user } = useAuth();
  const { interviews, loading, error, reload } = useInterviews();
  const summary = useMemo(() => computeSummary(interviews), [interviews]);
  const insights = useMemo(() => computeInsights(interviews), [interviews]);
  const rhythm = useMemo(() => weeklyRhythm(interviews), [interviews]);
  const hasSessions = summary.total > 0;

  const subline = loading ? null : headline(summary, insights);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <UpNext next={insights.next} reminder={insights.reminder} />
            <ThisWeek rhythm={rhythm} />
          </div>
          <Progress insights={insights} trend={summary.trend} />
          <WhatWeNoticed noticed={insights.noticed} remaining={insights.noticedRemaining} />
          <RecentInterviews sessions={interviews} />
        </>
      )}
    </div>
  );
}

function Onboarding() {
  const installed = useExtensionInstalled();
  const steps = [
    { done: true, emphasis: false, title: "Sign in", body: "You are signed in to LeeView." },
    installed
      ? { done: true, emphasis: false, title: "Extension installed", body: "LeeView is in Chrome and ready on LeetCode." }
      : {
          done: false,
          emphasis: true,
          title: "Add the extension",
          body: "Add it to Chrome and pin it to your toolbar so the panel is one click away.",
        },
    {
      done: false,
      emphasis: false,
      title: "Do your first interview",
      body: "Open any LeetCode problem and start the panel. About 20 minutes, spoken, with a scored debrief at the end.",
    },
  ].map((step) => ({
    ...step,
    titleClass: step.done ? "text-text-2" : "text-text-1",
  }));

  // The installed-extension step is the one exception: it reads as a success.
  if (installed) steps[1].titleClass = "text-ok";

  return (
    <Card className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_1.1fr] md:items-start">
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-[28px] leading-tight text-text-1">Do your first interview</h2>
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
                step.done
                  ? "border-ok/40 bg-ok-soft text-ok"
                  : step.emphasis
                    ? "border-signal/60 bg-signal-soft text-signal"
                    : "border-line-2 text-text-3"
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
              <p className={`text-[15px] font-medium ${step.titleClass}`}>
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

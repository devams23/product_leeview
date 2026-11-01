import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInterviews } from "../hooks/useInterviews";
import { computeSummary } from "../lib/stats";
import { computeInsights, weeklyRhythm } from "../lib/insights";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { AnalyticsSkeleton } from "../components/ui/Skeleton";
import { buttonClass } from "../components/ui/Button";
import { Activity, Progress, StatStrip, WhatWeNoticed } from "../components/analytics/AnalyticsPanels";

export function Analytics() {
  const { interviews, loading, error, reload } = useInterviews();
  const summary = useMemo(() => computeSummary(interviews), [interviews]);
  const insights = useMemo(() => computeInsights(interviews), [interviews]);
  const rhythm = useMemo(() => weeklyRhythm(interviews), [interviews]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">Analytics</h1>

      {error && <ErrorBanner title="Your interviews did not load" message={error} onRetry={reload} />}

      {loading ? (
        <AnalyticsSkeleton />
      ) : summary.total === 0 ? (
        error ? null : (
          <Card>
            <EmptyState
              title="Nothing to measure yet"
              action={
                <Link to="/dashboard" className={buttonClass("secondary")}>
                  Go to Overview
                </Link>
              }
            >
              Your scores and patterns appear here after your first interview.
            </EmptyState>
          </Card>
        )
      ) : (
        <>
          <StatStrip summary={summary} best={insights.best} />
          <Progress insights={insights} trend={summary.trend} />
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <Activity rhythm={rhythm} />
            <WhatWeNoticed noticed={insights.noticed} remaining={insights.noticedRemaining} />
          </div>
        </>
      )}
    </div>
  );
}

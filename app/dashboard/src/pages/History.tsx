import { useMemo } from "react";
import { useInterviews } from "../hooks/useInterviews";
import { computeSummary } from "../lib/stats";
import { formatTotalTime } from "../lib/format";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { TableSkeleton } from "../components/ui/Skeleton";
import { SessionsTable } from "../components/SessionsTable";

export function History() {
  const { interviews, loading, error, reload } = useInterviews();
  const summary = useMemo(() => computeSummary(interviews), [interviews]);

  const subline =
    summary.total === 0
      ? "Every interview you finish is kept here."
      : `${summary.total} interview${summary.total === 1 ? "" : "s"}${
          summary.totalSeconds > 0 ? ` and ${formatTotalTime(summary.totalSeconds)} of practice so far.` : " so far."
        }`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">History</h1>
        {!loading && <p className="text-[15px] text-text-2">{subline}</p>}
      </header>

      {error && <ErrorBanner title="Your history did not load" message={error} onRetry={reload} />}

      {loading ? (
        <Card className="p-5 sm:p-6">
          <TableSkeleton />
        </Card>
      ) : (
        !error && <SessionsTable sessions={interviews} />
      )}
    </div>
  );
}

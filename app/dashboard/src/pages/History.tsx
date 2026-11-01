import { useHistoryPage } from "../hooks/useHistoryPage";
import { formatTotalTime } from "../lib/format";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { TableSkeleton } from "../components/ui/Skeleton";
import { SessionsTable } from "../components/SessionsTable";

export function History() {
  const history = useHistoryPage();
  const { data, error, reload } = history;

  const count = data?.practice_count ?? 0;
  const seconds = data?.practice_seconds ?? 0;
  const subline =
    count === 0
      ? "Every interview you finish is kept here."
      : `${count} interview${count === 1 ? "" : "s"}${
          seconds > 0 ? ` and ${formatTotalTime(seconds)} of practice so far.` : " so far."
        }`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">History</h1>
        {data && <p className="text-[15px] text-text-2">{subline}</p>}
      </header>

      {error && <ErrorBanner title="Your history did not load" message={error} onRetry={reload} />}

      {data ? (
        <SessionsTable history={history} page={data} />
      ) : (
        !error && (
          <Card className="p-5 sm:p-6">
            <TableSkeleton />
          </Card>
        )
      )}
    </div>
  );
}

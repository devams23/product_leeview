import { useInterviews } from "../hooks/useInterviews";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { TableSkeleton } from "../components/ui/Skeleton";
import { SessionsTable } from "../components/SessionsTable";

export function History() {
  const { interviews, loading, error, reload } = useInterviews();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">History</h1>
        <p className="text-[15px] text-text-2">Every interview you have run, newest first.</p>
      </header>

      {error && <ErrorBanner title="Your history did not load" message={error} onRetry={reload} />}

      <Card className="p-5 sm:p-6">
        {loading ? <TableSkeleton /> : <SessionsTable sessions={interviews} />}
      </Card>
    </div>
  );
}

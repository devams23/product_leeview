import { Card } from "./Card";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-chip bg-ink-2 ${className}`} />;
}

/** Full-screen placeholder shown while the auth session is resolving. */
export function AppSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-screen bg-ink-0">
      <aside className="hidden w-60 shrink-0 flex-col gap-8 border-r border-line px-6 py-6 lg:flex">
        <Skeleton className="h-7 w-28" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </aside>
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8">
          <Skeleton className="h-14 w-72 max-w-full" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading your overview" className="flex flex-col gap-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="flex min-h-[360px] flex-col gap-4 rounded-shell p-6 sm:p-8">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-[min(420px,90%)]" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="mt-auto h-10 w-40" />
        </Card>
        <Card className="flex flex-col gap-4 rounded-shell p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-14 w-24" />
          <Skeleton className="mt-auto h-24 w-full" />
        </Card>
      </div>
      <Card className="rounded-shell p-6 sm:p-7">
        <Skeleton className="mb-6 h-6 w-56" />
        <Skeleton className="h-[220px] w-full" />
      </Card>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading sessions" className="flex flex-col gap-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-56 max-w-[70%]" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SessionSkeleton() {
  return (
    <div role="status" aria-label="Loading interview" className="flex flex-col gap-8">
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-[min(560px,90%)]" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <Card className="flex flex-col gap-4 p-6 sm:p-8">
        <Skeleton className="h-28 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

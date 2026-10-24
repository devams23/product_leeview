import { Button } from "./Button";

export function ErrorBanner({
  title = "We could not load this",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-medium text-text-1">{title}</p>
        <p className="mt-0.5 text-sm text-text-2">
          {message ? `${message}. ` : ""}Check your connection, then try again.
        </p>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0 self-start sm:self-auto">
          Retry
        </Button>
      )}
    </div>
  );
}

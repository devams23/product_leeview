import { useMemo, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useInterviews } from "../hooks/useInterviews";
import { computeSummary } from "../lib/stats";
import { formatDate, formatRelative, formatScore, formatTotalTime, initialOf, scoreTone, toneText } from "../lib/format";
import { Card, CardHeader } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Skeleton } from "../components/ui/Skeleton";
import { buttonClass } from "../components/ui/Button";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-[13px] text-text-2">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] tabular-nums text-text-1">{children}</dd>
    </div>
  );
}

const DASH = <span className="text-text-3">—</span>;

export function Profile() {
  const { user, signOut } = useAuth();
  const { interviews, loading, error, reload } = useInterviews();
  const summary = useMemo(() => computeSummary(interviews), [interviews]);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : null;
  const provider = typeof user?.app_metadata?.provider === "string" ? user.app_metadata.provider : null;

  const scored = summary.skills.filter((s) => s.average !== null);
  const strongest = [...scored].sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0] ?? null;

  return (
    <div className="flex max-w-[760px] flex-col gap-8">
      <header className="flex items-center gap-5">
        {avatar ? (
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-ai-soft font-display text-[28px] text-ai">
            {initialOf(user)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-[32px] leading-[1.1] tracking-[-0.02em] text-text-1">
            {fullName ?? user?.email?.split("@")[0] ?? "Your profile"}
          </h1>
          <p className="truncate text-[14px] text-text-2">{user?.email}</p>
        </div>
      </header>

      <Card className="p-6">
        <CardHeader title="Account" />
        <dl className="divide-y divide-line">
          <Row label="Email">{user?.email ?? DASH}</Row>
          <Row label="Signed in with">{provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : DASH}</Row>
          <Row label="Member since">{user?.created_at ? formatDate(user.created_at) : DASH}</Row>
        </dl>
      </Card>

      {error && <ErrorBanner title="Your practice stats did not load" message={error} onRetry={reload} />}

      <Card className="p-6">
        <CardHeader title="Practice" description="Calculated from your interviews." />
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : (
          <dl className="divide-y divide-line">
            <Row label="Interviews">
              {summary.total} <span className="text-text-3">· {summary.completed} completed</span>
            </Row>
            <Row label="Average score">
              {summary.avgScore !== null ? (
                <span className={toneText[scoreTone(summary.avgScore)]}>{formatScore(summary.avgScore)}/10</span>
              ) : (
                DASH
              )}
            </Row>
            <Row label="Time practiced">{summary.totalSeconds > 0 ? formatTotalTime(summary.totalSeconds) : DASH}</Row>
            <Row label="Current streak">
              {summary.streak > 0 ? `${summary.streak} day${summary.streak === 1 ? "" : "s"}` : DASH}
            </Row>
            <Row label="Strongest skill">
              {strongest ? `${strongest.label} · ${formatScore(strongest.average!)}` : DASH}
            </Row>
            <Row label="Needs work">
              {summary.weakest && summary.weakest !== strongest
                ? `${summary.weakest.label} · ${formatScore(summary.weakest.average!)}`
                : DASH}
            </Row>
            <Row label="Last practiced">{summary.lastActivity ? formatRelative(summary.lastActivity) : DASH}</Row>
          </dl>
        )}
      </Card>

      <div>
        <button type="button" onClick={() => void signOut()} className={buttonClass("secondary", "md")}>
          Sign out
        </button>
      </div>
    </div>
  );
}

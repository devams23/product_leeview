import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useInterviews } from "../hooks/useInterviews";
import { computeSummary } from "../lib/stats";
import { formatDate, formatRelative, formatScore } from "../lib/format";
import { Avatar } from "../components/ui/Avatar";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Skeleton } from "../components/ui/Skeleton";
import { buttonClass } from "../components/ui/Button";
import { ExtensionAction } from "../components/ExtensionAction";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-5 py-3.5 sm:px-6">
      <dt className="text-[14px] text-text-2">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] tabular-nums text-text-1">{children}</dd>
    </div>
  );
}

/** A settings block: what it is on the left, its contents on the right. */
function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line pt-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-[15px] font-medium text-text-1">{title}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-text-3">{description}</p>
      </div>
      {children}
    </section>
  );
}

const DASH = <span className="text-text-3">—</span>;

export function Profile() {
  const { user, signOut } = useAuth();
  const { interviews, loading, error, reload } = useInterviews();
  const summary = useMemo(() => computeSummary(interviews), [interviews]);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  const provider = typeof user?.app_metadata?.provider === "string" ? user.app_metadata.provider : null;

  const scored = summary.skills.filter((s) => s.average !== null);
  const strongest = [...scored].sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0] ?? null;

  return (
    <div className="flex max-w-[860px] flex-col gap-8">
      <header className="flex items-center gap-5">
        <Avatar user={user} size={72} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-[32px] leading-[1.1] tracking-[-0.02em] text-text-1 sm:text-[36px]">
            {fullName ?? user?.email?.split("@")[0] ?? "Your profile"}
          </h1>
          {user?.created_at && (
            <p className="mt-1 text-[14px] text-text-2">Practicing since {formatDate(user.created_at)}</p>
          )}
        </div>
      </header>

      {error && <ErrorBanner title="Your practice stats did not load" message={error} onRetry={reload} />}

      <Section title="Account" description="How you sign in to LeeView.">
        <Card>
          <dl className="divide-y divide-line">
            <Row label="Email">{user?.email ?? DASH}</Row>
            <Row label="Signed in with">{provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : DASH}</Row>
          </dl>
        </Card>
      </Section>

      <Section title="Extension" description="Interviews run in a panel on LeetCode.">
        <Card className="flex items-center justify-between gap-6 px-5 py-2 sm:px-6">
          <p className="text-[14px] text-text-2">LeeView for Chrome</p>
          <ExtensionAction />
        </Card>
      </Section>

      <Section title="Practice" description="Where you stand right now.">
        <div>
          <Card>
            {loading ? (
              <div className="flex flex-col gap-4 p-5 sm:p-6">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <dl className="divide-y divide-line">
                <Row label="Strongest skill">
                  {strongest ? `${strongest.label}, ${formatScore(strongest.average!)}` : DASH}
                </Row>
                <Row label="Needs work">
                  {summary.weakest && summary.weakest !== strongest
                    ? `${summary.weakest.label}, ${formatScore(summary.weakest.average!)}`
                    : DASH}
                </Row>
                <Row label="Current streak">
                  {summary.streak > 0 ? `${summary.streak} day${summary.streak === 1 ? "" : "s"}` : DASH}
                </Row>
                <Row label="Last practiced">{summary.lastActivity ? formatRelative(summary.lastActivity) : DASH}</Row>
              </dl>
            )}
          </Card>
          <Link
            to="/analytics"
            className="mt-3 inline-block text-[14px] text-text-2 transition-colors duration-150 hover:text-text-1"
          >
            View analytics
          </Link>
        </div>
      </Section>

      <Section title="Session" description="Signs you out on this browser.">
        <div>
          <button type="button" onClick={() => void signOut()} className={buttonClass("secondary", "md")}>
            Sign out
          </button>
        </div>
      </Section>
    </div>
  );
}

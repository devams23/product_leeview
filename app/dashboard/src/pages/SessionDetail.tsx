import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { Card } from "../components/ui/Card";
import { DifficultyChip, StatusChip } from "../components/ui/Chip";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { SessionSkeleton } from "../components/ui/Skeleton";
import { Tabs, type TabItem } from "../components/ui/Tabs";
import { buttonClass } from "../components/ui/Button";
import { DebriefView } from "../components/session/DebriefView";
import { TranscriptView } from "../components/session/TranscriptView";
import { CodeView } from "../components/session/CodeView";
import { RealWorldView } from "../components/session/RealWorldView";
import { formatDate, formatDuration, leetcodeUrl, sessionDurationSeconds } from "../lib/format";
import type { SessionStatus } from "../types";

type TabId = "transcript" | "code" | "real-world";

const TABS: TabItem<TabId>[] = [
  { id: "transcript", label: "Transcript" },
  { id: "code", label: "Code" },
  { id: "real-world", label: "Real-world" },
];

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex w-fit items-center gap-1.5 rounded-chip text-sm text-text-2 transition-colors duration-150 hover:text-text-1"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      Overview
    </Link>
  );
}

export function SessionDetail() {
  const { sessionId } = useParams();
  const { session, loading, error, notFound, reload } = useSession(sessionId);
  const [tab, setTab] = useState<TabId>("transcript");

  if (loading) return <SessionSkeleton />;

  if (notFound) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <Card>
          <EmptyState
            title="We could not find that interview"
            action={
              <Link to="/history" className={buttonClass("secondary")}>
                Go to history
              </Link>
            }
          >
            It may have been deleted, or the link is for a different account.
          </EmptyState>
        </Card>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <ErrorBanner title="This interview did not load" message={error ?? undefined} onRetry={reload} />
      </div>
    );
  }

  const url = leetcodeUrl(session.leetcode_slug);
  const duration = formatDuration(sessionDurationSeconds(session));
  const debrief = session.debriefs;

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="break-words font-display text-[40px] leading-[1.05] text-text-1 sm:text-[52px]">
            {session.leetcode_title}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-text-2">
            <DifficultyChip value={session.problem_difficulty} />
            <StatusChip status={session.status} />
            <span className="px-1">{formatDate(session.started_at)}</span>
            {duration && <span className="font-mono text-[12px]">{duration}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            Open on LeetCode
          </a>
          <a href={url} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
            Practice again
          </a>
        </div>
      </header>

      {debrief ? (
        <DebriefView debrief={debrief} />
      ) : (
        <NoDebriefNotice status={session.status} />
      )}

      <section aria-label="Interview record" className="flex flex-col gap-6">
        <Tabs items={TABS} value={tab} onChange={setTab} label="Interview record" />
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="min-h-[200px] pt-2"
        >
          {tab === "transcript" && <TranscriptView logs={session.transcript_logs} />}
          {tab === "code" && <CodeView snapshots={session.code_snapshots} />}
          {tab === "real-world" && <RealWorldView debrief={debrief} />}
        </div>
      </section>

    </div>
  );
}

function NoDebriefNotice({ status }: { status: SessionStatus }) {
  const copy =
    status === "INTERRUPTED"
      ? {
          title: "Interview ended early",
          body: "No debrief was generated. The transcript and any code captured before you left are still below.",
          warn: true,
        }
      : status === "COMPLETED"
        ? {
            title: "Debrief unavailable",
            body: "This interview finished, but its debrief was not saved. The transcript and code are still below.",
            warn: true,
          }
        : {
            title: "No debrief yet",
            body: "The debrief appears here once the interview is finished.",
            warn: false,
          };

  return (
    <div
      role="status"
      className={`rounded-card border p-5 sm:p-6 ${
        copy.warn ? "border-warn/25 bg-warn-soft" : "border-line bg-ink-1"
      }`}
    >
      <p className="text-[15px] font-medium text-text-1">{copy.title}</p>
      <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-text-2">{copy.body}</p>
    </div>
  );
}

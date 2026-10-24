import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonClass } from "./ui/Button";
import { DifficultyChip, StatusChip } from "./ui/Chip";
import { ScoreBadge } from "./ui/ScoreBadge";
import { formatDate, formatDuration, formatRelative, sessionDurationSeconds } from "../lib/format";
import type { InterviewSession, SessionStatus } from "../types";

type DifficultyFilter = "all" | "Easy" | "Medium" | "Hard";
type StatusFilter = "all" | SessionStatus;

const GRID =
  "md:grid-cols-[minmax(0,2.6fr)_0.9fr_1fr_0.8fr_0.9fr_1fr]";

const inputClass =
  "h-10 rounded-btn border border-line-2 bg-ink-2 px-3 text-sm text-text-1 transition-colors duration-150 focus:border-signal/60 focus:outline-none";

export function SessionsTable({
  sessions,
  limit,
}: {
  sessions: InterviewSession[];
  /** Show only the first N matching rows, with a link to the full History. */
  limit?: number;
}) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        (!q || s.leetcode_title.toLowerCase().includes(q) || s.leetcode_slug.toLowerCase().includes(q)) &&
        (difficulty === "all" || s.problem_difficulty === difficulty) &&
        (status === "all" || s.status === status),
    );
  }, [sessions, query, difficulty, status]);

  const visible = limit ? filtered.slice(0, limit) : filtered;
  const filtering = query.trim() !== "" || difficulty !== "all" || status !== "all";

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <h3 className="font-display text-2xl text-text-1">No interviews yet</h3>
        <p className="max-w-md text-[14px] leading-relaxed text-text-2">
          Open any LeetCode problem with the LeeView panel and start an interview. Each one is saved here with its
          transcript and debrief.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search sessions</span>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems"
            className={`${inputClass} w-full pl-9 placeholder:text-text-3`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <select
            aria-label="Filter by difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
            className={inputClass}
          >
            <option value="all">All difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={inputClass}
          >
            <option value="all">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="INTERRUPTED">Interrupted</option>
            <option value="ACTIVE">In progress</option>
            <option value="PREPARING">Not started</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-text-2">No sessions match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDifficulty("all");
              setStatus("all");
            }}
            className={buttonClass("secondary", "sm")}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div
            className={`hidden grid-cols-[minmax(0,2.6fr)_0.9fr_1fr_0.8fr_0.9fr_1fr] gap-4 border-b border-line px-4 pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 md:grid`}
          >
            <span>Problem</span>
            <span>Difficulty</span>
            <span>Date</span>
            <span>Duration</span>
            <span>Score</span>
            <span>Status</span>
          </div>
          <ul className="-mx-1 flex flex-col">
            {visible.map((s) => {
              const duration = formatDuration(sessionDurationSeconds(s));
              const when = s.completed_at ?? s.started_at;
              return (
                <li key={s.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={`/session/${s.id}`}
                    className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-chip px-3 py-3.5 transition-colors duration-150 hover:bg-ink-2 focus-visible:bg-ink-2 md:px-4 ${GRID} md:gap-y-0`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-text-1">{s.leetcode_title}</p>
                      <p className="mt-0.5 truncate font-mono text-[12px] text-text-2 md:hidden">
                        {formatRelative(when)}
                        {duration ? `, ${duration}` : ""}
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <DifficultyChip value={s.problem_difficulty} />
                    </div>
                    <span className="hidden text-[13px] text-text-2 md:block" title={formatDate(when)}>
                      {formatRelative(when)}
                    </span>
                    <span className="hidden font-mono text-[12px] text-text-2 md:block">{duration ?? "—"}</span>
                    <div className="hidden md:block">
                      <ScoreBadge score={s.debriefs?.overall_score} />
                    </div>
                    <div className="hidden md:block">
                      <StatusChip status={s.status} />
                    </div>
                    <div className="row-span-2 self-center justify-self-end md:hidden">
                      <ScoreBadge score={s.debriefs?.overall_score} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {limit && filtered.length > limit && !filtering && (
            <Link
              to="/history"
              className="self-start text-sm text-text-2 transition-colors duration-150 hover:text-text-1"
            >
              View all {filtered.length} sessions
            </Link>
          )}
        </>
      )}
    </div>
  );
}

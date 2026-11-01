import { useMemo } from "react";
import { Link } from "react-router-dom";
import { buttonClass } from "./ui/Button";
import { Card } from "./ui/Card";
import { Pagination } from "./ui/Pagination";
import { DifficultyChip, StatusChip } from "./ui/Chip";
import { Select, type SelectOption } from "./ui/Select";
import {
  HISTORY_PAGE_SIZE,
  type DifficultyFilter,
  type HistorySort,
  type HistoryView,
  type StatusFilter,
} from "../hooks/useHistoryPage";
import { formatDuration, formatRelative, formatScore, scoreTone, toneText } from "../lib/format";
import type { HistoryPage, HistoryRow } from "../types";

const DIFFICULTY_LABELS: [DifficultyFilter, string][] = [
  ["all", "All difficulties"],
  ["Easy", "Easy"],
  ["Medium", "Medium"],
  ["Hard", "Hard"],
];

const STATUS_LABELS: [StatusFilter, string][] = [
  ["all", "All statuses"],
  ["COMPLETED", "Completed"],
  ["INTERRUPTED", "Interrupted"],
  ["ACTIVE", "In progress"],
  ["PREPARING", "Not started"],
];

const SORT_OPTIONS: SelectOption<HistorySort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "lowest", label: "Lowest score" },
  { value: "highest", label: "Highest score" },
];

function firstSentence(text: string): string {
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
}

function monthTitle(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface Group {
  key: string | null;
  sessions: HistoryRow[];
}

function SessionRow({ session }: { session: HistoryRow }) {
  const score = session.overall_score;
  const duration = formatDuration(session.duration_seconds);
  const when = formatRelative(session.activity_at);

  return (
    <li>
      <Link
        to={`/session/${session.id}`}
        className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 px-4 py-4 transition-colors duration-150 hover:bg-ink-2 focus-visible:bg-ink-2 sm:px-5 md:grid-cols-[48px_minmax(0,1fr)_auto_124px]"
      >
        <span
          aria-label={score == null ? "No score" : `Score ${score} out of 10`}
          className={`font-display text-[30px] leading-none tabular-nums ${toneText[scoreTone(score)]}`}
        >
          {score ?? "–"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-text-1">{session.leetcode_title}</p>
          <p className="mt-0.5 truncate text-[13px] text-text-2">
            {session.summary ? firstSentence(session.summary) : "No debrief for this interview."}
          </p>
          <p className="mt-1 text-[13px] text-text-3 md:hidden">
            {when}
            {duration ? `, ${duration}` : ""}
          </p>
        </div>
        <div className="hidden items-center justify-end gap-2 md:flex">
          {session.status !== "COMPLETED" && <StatusChip status={session.status} />}
          <DifficultyChip value={session.problem_difficulty} />
        </div>
        <div className="hidden text-right md:block">
          <p className="text-[13px] text-text-2">{when}</p>
          {duration && <p className="mt-0.5 text-[13px] text-text-3">{duration}</p>}
        </div>
      </Link>
    </li>
  );
}

export function SessionsTable({ history, page }: { history: HistoryView; page: HistoryPage }) {
  const { query, setQuery, filters, updateFilters, clearFilters, loading } = history;

  const difficultyOptions = DIFFICULTY_LABELS.flatMap(([value, label]) => {
    const count = value === "all" ? page.all_count : page.difficulty_counts[value] ?? 0;
    return value === "all" || count > 0 ? [{ value, label, count }] : [];
  });
  const statusOptions = STATUS_LABELS.flatMap(([value, label]) => {
    const count = value === "all" ? page.all_count : page.status_counts[value] ?? 0;
    return value === "all" || count > 0 ? [{ value, label, count }] : [];
  });

  const groups = useMemo<Group[]>(() => {
    if (filters.sort !== "newest") return [{ key: null, sessions: page.rows }];
    const months: Group[] = [];
    for (const session of page.rows) {
      const last = months[months.length - 1];
      if (last?.key === session.month_key) last.sessions.push(session);
      else months.push({ key: session.month_key, sessions: [session] });
    }
    return months;
  }, [page.rows, filters.sort]);

  const goToPage = (next: number) => {
    history.setPage(next);
    window.scrollTo({ top: 0 });
  };

  if (page.all_count === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <h3 className="font-display text-2xl text-text-1">No interviews yet</h3>
        <p className="max-w-md text-[14px] leading-relaxed text-text-2">
          Open any LeetCode problem with the LeeView panel and start an interview. Each one is saved here with its
          transcript and debrief.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search interviews</span>
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
            className="h-10 w-full rounded-btn border border-line bg-ink-1 pl-9 pr-3 text-[14px] text-text-1 transition-colors duration-150 placeholder:text-text-3 hover:bg-ink-2 focus:border-line-2 focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex">
          <Select
            label="Difficulty"
            value={filters.difficulty}
            options={difficultyOptions}
            neutralValue="all"
            onChange={(difficulty) => updateFilters({ difficulty })}
          />
          <Select
            label="Status"
            value={filters.status}
            options={statusOptions}
            neutralValue="all"
            onChange={(status) => updateFilters({ status })}
          />
          <Select
            label="Newest first"
            value={filters.sort}
            options={SORT_OPTIONS}
            neutralValue="newest"
            onChange={(sort) => updateFilters({ sort })}
            align="right"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      {page.total === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-text-2">No interviews match these filters.</p>
          <button type="button" onClick={clearFilters} className={buttonClass("secondary", "sm")}>
            Clear filters
          </button>
        </Card>
      ) : (
        <div className={`flex flex-col gap-6 transition-opacity duration-150 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {groups.map((group) => {
            const average = group.key ? page.month_averages[group.key] : undefined;
            const title = group.key ? monthTitle(group.key) : null;
            return (
              <section key={group.key ?? "ranked"} aria-label={title ?? "Interviews by score"} className="flex flex-col gap-2">
                {title && (
                  <div className="flex items-baseline justify-between px-1 text-[13px]">
                    <h2 className="font-medium text-text-2">{title}</h2>
                    {average !== undefined && <p className="text-text-3">Average {formatScore(average)}</p>}
                  </div>
                )}
                <Card className="overflow-hidden">
                  <ul className="flex flex-col divide-y divide-line">
                    {group.sessions.map((session) => (
                      <SessionRow key={session.id} session={session} />
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
          <Pagination page={history.page} pageSize={HISTORY_PAGE_SIZE} total={page.total} onChange={goToPage} />
        </div>
      )}
    </div>
  );
}

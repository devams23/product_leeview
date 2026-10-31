import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonClass } from "./ui/Button";
import { Card } from "./ui/Card";
import { DifficultyChip, StatusChip } from "./ui/Chip";
import { Select, type SelectOption } from "./ui/Select";
import { formatDuration, formatRelative, formatScore, scoreTone, sessionDurationSeconds, toneText } from "../lib/format";
import { activityDate } from "../lib/stats";
import type { InterviewSession, SessionStatus } from "../types";

type DifficultyFilter = "all" | "Easy" | "Medium" | "Hard";
type StatusFilter = "all" | SessionStatus;
type Sort = "newest" | "lowest" | "highest";

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

const SORT_OPTIONS: SelectOption<Sort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "lowest", label: "Lowest score" },
  { value: "highest", label: "Highest score" },
];

const whenOf = (s: InterviewSession) => activityDate(s) ?? s.started_at;

function firstSentence(text: string): string {
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
}

function monthOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface Group {
  title: string | null;
  sessions: InterviewSession[];
}

function averageScore(sessions: InterviewSession[]): number | null {
  const scores = sessions.flatMap((s) => (typeof s.debriefs?.overall_score === "number" ? [s.debriefs.overall_score] : []));
  return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
}

function SessionRow({ session }: { session: InterviewSession }) {
  const score = session.debriefs?.overall_score;
  const duration = formatDuration(sessionDurationSeconds(session));
  const summary = session.debriefs?.summary;

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
            {summary ? firstSentence(summary) : "No debrief for this interview."}
          </p>
          <p className="mt-1 text-[13px] text-text-3 md:hidden">
            {formatRelative(whenOf(session))}
            {duration ? `, ${duration}` : ""}
          </p>
        </div>
        <div className="hidden items-center justify-end gap-2 md:flex">
          {session.status !== "COMPLETED" && <StatusChip status={session.status} />}
          <DifficultyChip value={session.problem_difficulty} />
        </div>
        <div className="hidden text-right md:block">
          <p className="text-[13px] text-text-2">{formatRelative(whenOf(session))}</p>
          {duration && <p className="mt-0.5 text-[13px] text-text-3">{duration}</p>}
        </div>
      </Link>
    </li>
  );
}

export function SessionsTable({ sessions }: { sessions: InterviewSession[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const difficultyOptions = DIFFICULTY_LABELS.flatMap(([value, label]) => {
    const count = value === "all" ? sessions.length : sessions.filter((s) => s.problem_difficulty === value).length;
    return value === "all" || count > 0 ? [{ value, label, count }] : [];
  });
  const statusOptions = STATUS_LABELS.flatMap(([value, label]) => {
    const count = value === "all" ? sessions.length : sessions.filter((s) => s.status === value).length;
    return value === "all" || count > 0 ? [{ value, label, count }] : [];
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        (!q || s.leetcode_title.toLowerCase().includes(q) || s.leetcode_slug.toLowerCase().includes(q)) &&
        (difficulty === "all" || s.problem_difficulty === difficulty) &&
        (status === "all" || s.status === status),
    );
  }, [sessions, query, difficulty, status]);

  const groups = useMemo<Group[]>(() => {
    if (sort === "newest") {
      const months: Group[] = [];
      for (const session of filtered) {
        const title = monthOf(whenOf(session));
        const last = months[months.length - 1];
        if (last?.title === title) last.sessions.push(session);
        else months.push({ title, sessions: [session] });
      }
      return months;
    }
    // Unscored interviews have nothing to rank on, so they stay out of a score order.
    const direction = sort === "lowest" ? 1 : -1;
    const ranked = filtered
      .filter((s) => typeof s.debriefs?.overall_score === "number")
      .sort((a, b) => direction * ((a.debriefs?.overall_score ?? 0) - (b.debriefs?.overall_score ?? 0)));
    return [{ title: null, sessions: ranked }];
  }, [filtered, sort]);

  const shown = groups.reduce((n, group) => n + group.sessions.length, 0);

  if (sessions.length === 0) {
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
          <Select label="Difficulty" value={difficulty} options={difficultyOptions} neutralValue="all" onChange={setDifficulty} />
          <Select label="Status" value={status} options={statusOptions} neutralValue="all" onChange={setStatus} />
          <Select
            label="Newest first"
            value={sort}
            options={SORT_OPTIONS}
            neutralValue="newest"
            onChange={setSort}
            align="right"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      {shown === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-text-2">No interviews match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDifficulty("all");
              setStatus("all");
              setSort("newest");
            }}
            className={buttonClass("secondary", "sm")}
          >
            Clear filters
          </button>
        </Card>
      ) : (
        groups.map((group) => {
          const average = averageScore(group.sessions);
          return (
            <section key={group.title ?? "ranked"} aria-label={group.title ?? "Interviews by score"} className="flex flex-col gap-2">
              {group.title && (
                <div className="flex items-baseline justify-between px-1 text-[13px]">
                  <h2 className="font-medium text-text-2">{group.title}</h2>
                  {average !== null && <p className="text-text-3">Average {formatScore(average)}</p>}
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
        })
      )}
    </div>
  );
}

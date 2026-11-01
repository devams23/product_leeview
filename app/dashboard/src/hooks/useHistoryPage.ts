import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import type { HistoryPage, SessionStatus } from "../types";

export const HISTORY_PAGE_SIZE = 10;

export type DifficultyFilter = "all" | "Easy" | "Medium" | "Hard";
export type StatusFilter = "all" | SessionStatus;
export type HistorySort = "newest" | "lowest" | "highest";

export interface HistoryFilters {
  difficulty: DifficultyFilter;
  status: StatusFilter;
  sort: HistorySort;
}

const NO_FILTERS: HistoryFilters = { difficulty: "all", status: "all", sort: "newest" };
const SEARCH_DELAY_MS = 250;

interface State {
  data: HistoryPage | null;
  loading: boolean;
  error: string | null;
}

export function useHistoryPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  // Waits for a pause in typing, so a word costs one request rather than one per letter.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    supabase
      .rpc("history_page", {
        p_search: search,
        p_difficulty: filters.difficulty === "all" ? null : filters.difficulty,
        p_status: filters.status === "all" ? null : filters.status,
        p_sort: filters.sort,
        p_limit: HISTORY_PAGE_SIZE,
        p_offset: (page - 1) * HISTORY_PAGE_SIZE,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ data: null, loading: false, error: error.message });
          return;
        }
        const next = data as HistoryPage;
        // The last row of the last page may have gone since the page was opened.
        if (next.rows.length === 0 && next.total > 0) {
          setPage(Math.ceil(next.total / HISTORY_PAGE_SIZE));
          return;
        }
        setState({ data: next, loading: false, error: null });
      });

    return () => {
      active = false;
    };
  }, [search, filters, page, attempt]);

  const updateFilters = useCallback((change: Partial<HistoryFilters>) => {
    setFilters((current) => ({ ...current, ...change }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSearch("");
    setFilters(NO_FILTERS);
    setPage(1);
  }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, query, setQuery, filters, updateFilters, clearFilters, page, setPage, reload };
}

export type HistoryView = ReturnType<typeof useHistoryPage>;

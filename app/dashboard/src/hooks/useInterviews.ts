import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { normaliseSession, type RawSession } from "../lib/normalise";
import type { InterviewSession } from "../types";

// The overview pages only need scores and practice facts, not problem statements or debrief prose.
const SESSION_COLUMNS = `
  id, leetcode_slug, leetcode_title, problem_difficulty, problem_topics, status,
  started_at, completed_at, total_duration_seconds,
  debriefs (
    approach_score, communication_score, code_correctness_score, code_quality_score, time_management_score,
    overall_score, actionable_feedback, similar_problems
  )
`;

interface State {
  interviews: InterviewSession[];
  loading: boolean;
  error: string | null;
}

export function useInterviews() {
  const [state, setState] = useState<State>({ interviews: [], loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    supabase
      .from("interview_sessions")
      .select(SESSION_COLUMNS)
      .order("started_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ interviews: [], loading: false, error: error.message });
          return;
        }
        const rows = (data ?? []) as RawSession[];
        setState({ interviews: rows.map(normaliseSession), loading: false, error: null });
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { interviews: state.interviews, loading: state.loading, error: state.error, reload };
}

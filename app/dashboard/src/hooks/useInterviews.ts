import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { normaliseSession, type RawSession } from "../lib/normalise";
import type { InterviewSession } from "../types";

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
      .select("*, debriefs(*)")
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

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { normaliseSession, type RawSession } from "../lib/normalise";
import type { InterviewSession } from "../types";

interface State {
  session: InterviewSession | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
}

/** Loads one session with its debrief, transcript (by timestamp) and code snapshots (by capture time). */
export function useSession(id: string | undefined) {
  const [state, setState] = useState<State>({ session: null, loading: true, error: null, notFound: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ session: null, loading: false, error: null, notFound: true });
      return;
    }
    let active = true;
    setState({ session: null, loading: true, error: null, notFound: false });

    supabase
      .from("interview_sessions")
      .select("*, debriefs(*), transcript_logs(*), code_snapshots(*)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        // 22P02 = malformed uuid in the URL: treat as not found rather than an outage.
        if (error && error.code === "22P02") {
          setState({ session: null, loading: false, error: null, notFound: true });
          return;
        }
        if (error) {
          setState({ session: null, loading: false, error: error.message, notFound: false });
          return;
        }
        if (!data) {
          setState({ session: null, loading: false, error: null, notFound: true });
          return;
        }
        const session = normaliseSession(data as RawSession);
        session.transcript_logs.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        session.code_snapshots.sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at));
        setState({ session, loading: false, error: null, notFound: false });
      });

    return () => {
      active = false;
    };
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, reload };
}

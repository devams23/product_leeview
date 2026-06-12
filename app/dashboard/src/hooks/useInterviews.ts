import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export function useInterviews() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("interview_sessions")
      .select("*, debriefs(*)")
      .order("started_at", { ascending: false })
      .then(({ data }) => {
        setInterviews(data || []);
        setLoading(false);
      });
  }, []);

  return { interviews, loading };
}

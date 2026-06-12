import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { DebriefCard } from "../components/DebriefCard";

export function SessionDetail() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase
      .from("interview_sessions")
      .select("*, debriefs(*), transcript_logs(*), code_snapshots(*)")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => setSession(data));
  }, [sessionId]);

  if (!session) return <div style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace", fontSize: "12px" }}>Loading...</div>;

  return (
    <div style={{ padding: "28px 32px", color: "rgba(255,255,255,0.88)" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 24px" }}>{session.leetcode_title}</h1>
      <DebriefCard debrief={session.debriefs?.[0] || {}} />
    </div>
  );
}

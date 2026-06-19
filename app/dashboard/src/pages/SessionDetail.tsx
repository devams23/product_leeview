import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { DebriefCard } from "../components/DebriefCard";
import { ScoreRadarChart } from "../components/ScoreRadarChart";

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

  if (!session) return <div className="text-textSecondary font-mono text-xs p-8">Loading...</div>;

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <a href="/dashboard" className="text-xs font-mono text-textSecondary hover:text-textPrimary transition-colors no-underline mb-4 inline-block">
          ← Back to Dashboard
        </a>
        <h1 className="font-sans text-2xl font-medium text-textPrimary m-0">{session.leetcode_title || "Session Detail"}</h1>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Radar Chart Panel - 4 columns */}
        <div className="col-span-12 md:col-span-4 h-full">
          <ScoreRadarChart data={session.debriefs?.[0] || {}} />
        </div>

        {/* Debrief Content - 8 columns */}
        <div className="col-span-12 md:col-span-8 h-full">
          <DebriefCard debrief={session.debriefs?.[0] || {}} />
        </div>
      </div>
    </div>
  );
}

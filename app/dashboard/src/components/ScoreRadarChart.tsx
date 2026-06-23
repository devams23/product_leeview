import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Debrief } from "../types";

export function ScoreRadarChart({ data }: { data: Partial<Debrief> }) {
  const chartData = [
    { subject: "Approach", score: data.approach_score || 0 },
    { subject: "Communication", score: data.communication_score || 0 },
    { subject: "Correctness", score: data.code_correctness_score || 0 },
    { subject: "Quality", score: data.code_quality_score || 0 },
    { subject: "Time Mgmt", score: data.time_management_score || 0 },
  ];

  return (
    <div className="glass-panel w-full h-full p-5 flex flex-col">
      <h2 className="text-[11px] font-medium text-textSecondary uppercase tracking-[0.1em] m-0 mb-4">Radar</h2>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "monospace" }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
            <Radar dataKey="score" stroke="rgba(255,255,255,0.35)" fill="rgba(255,255,255,0.1)" fillOpacity={0.4} dot={{ r: 4, fill: "rgba(255,255,255,0.7)" }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

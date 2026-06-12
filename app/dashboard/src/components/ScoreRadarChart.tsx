import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

export function ScoreRadarChart({ data }: { data: any }) {
  const chartData = [
    { subject: "Approach", score: data.approach_score },
    { subject: "Communication", score: data.communication_score },
    { subject: "Correctness", score: data.code_correctness_score },
    { subject: "Quality", score: data.code_quality_score },
    { subject: "Time Mgmt", score: data.time_management_score },
  ];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.12)",
        outline: "1px solid rgba(0,0,0,0.3)",
        borderRadius: "20px",
        padding: "20px",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <RadarChart cx={150} cy={130} outerRadius={90} width={300} height={280} data={chartData}>
        <PolarGrid stroke="rgba(255,255,255,0.06)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "monospace" }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
        <Radar dataKey="score" stroke="rgba(255,255,255,0.35)" fill="rgba(255,255,255,0.1)" fillOpacity={0.4} dot={{ r: 4, fill: "rgba(255,255,255,0.7)" }} />
      </RadarChart>
    </div>
  );
}

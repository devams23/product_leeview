import { ScoreRadarChart } from "./ScoreRadarChart";

export function DebriefCard({ debrief }: { debrief: any }) {
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
        maxWidth: "700px",
        color: "rgba(255,255,255,0.88)",
      }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 20px" }}>Debrief</h2>
      <ScoreRadarChart data={debrief} />
      <h3 style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "24px" }}>Real-World Scenario</h3>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontFamily: "monospace", lineHeight: 1.6 }}>{debrief.real_world_scenario}</p>
      <h3 style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "20px" }}>Actionable Feedback</h3>
      <ul style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontFamily: "monospace", lineHeight: 1.6, paddingLeft: "20px" }}>
        {debrief.actionable_feedback?.map((item: string, idx: number) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

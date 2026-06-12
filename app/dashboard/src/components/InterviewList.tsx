import { useInterviews } from "../hooks/useInterviews";

export function InterviewList() {
  const { interviews, loading } = useInterviews();

  if (loading) return <div style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace", fontSize: "12px" }}>Loading...</div>;

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
      }}
    >
      <h2 style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 16px" }}>Past Interviews</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {interviews.map((i) => (
          <li
            key={i.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              height: "40px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <a
              href={`/session/${i.id}`}
              style={{ color: "rgba(255,255,255,0.88)", textDecoration: "none", fontSize: "13px" }}
            >
              {i.leetcode_title} — {i.status}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

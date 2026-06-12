import { useAuth } from "../hooks/useAuth";
import { InterviewList } from "../components/InterviewList";

export function Dashboard() {
  const { user, signOut } = useAuth();
  return (
    <div style={{ padding: "28px 32px", color: "rgba(255,255,255,0.88)", backgroundColor: "#1a1b1e", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>LeeView Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "rgba(255,255,255,0.45)" }}>{user?.email}</span>
          <button
            onClick={signOut}
            style={{
              padding: "8px 16px",
              borderRadius: "30px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.88)",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "monospace",
              fontWeight: 500,
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
      <InterviewList />
    </div>
  );
}

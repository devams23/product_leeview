import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

const BACKEND_URL = "http://localhost:8000";
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:5173";

function Popup() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<string>("checking...");

  const checkAuth = () => {
    chrome.storage.local.get(["user"], (result) => {
      setUser(result.user || null);
      setLoading(false);
    });
  };

  useEffect(() => {
    checkAuth();
    fetch(`${BACKEND_URL}/health`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("offline"));
  }, []);

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  };

  const handleClear = () => {
    chrome.storage.local.remove(["user", "userId"], () => {
      setUser(null);
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    checkAuth();
  };

  return (
    <div style={{
      width: "320px",
      minHeight: "200px",
      background: "#1a1b1e",
      color: "rgba(255,255,255,0.88)",
      fontFamily: "'system-ui', sans-serif",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      boxSizing: "border-box"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Fira+Code:wght@400;500&display=swap');
        body { margin: 0; padding: 0; background: #1a1b1e; }
        .glass-panel {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          outline: 1px solid rgba(0,0,0,0.3);
          border-radius: 20px;
          padding: 20px;
        }
        .glass-inner {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 12px;
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 500, margin: 0 }}>
          LeeView
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: backendStatus === "ok" ? "rgba(255,255,255,0.8)" : "rgba(255,100,100,0.8)"
          }} />
          <span style={{ fontSize: "10px", fontFamily: "'Fira Code', monospace", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
            {backendStatus}
          </span>
        </div>
      </div>

      <div className="glass-panel">
        {loading ? (
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontFamily: "'Fira Code', monospace" }}>Loading...</p>
        ) : user ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
                Active Profile
              </p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.88)", margin: 0, fontFamily: "'Fira Code', monospace" }}>
                {user.email}
              </p>
            </div>
            <div className="glass-inner">
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", margin: 0, fontFamily: "'Fira Code', monospace" }}>
                Ready to mock interview.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                onClick={handleOpenDashboard}
                style={{
                  flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.9)", color: "#111",
                  border: "none", borderRadius: "30px", fontSize: "11px", fontWeight: 500, cursor: "pointer"
                }}
              >
                Dashboard
              </button>
              <button
                onClick={handleClear}
                style={{
                  flex: 1, padding: "8px 0", background: "rgba(255,100,100,0.1)", color: "rgba(255,100,100,0.8)",
                  border: "1px solid rgba(255,100,100,0.2)", borderRadius: "30px", fontSize: "11px", fontWeight: 500, cursor: "pointer"
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.5 }}>
              Authenticate via the dashboard to begin mock interviews.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleOpenDashboard}
                style={{
                  flex: 2, padding: "8px 0", background: "rgba(255,255,255,0.9)", color: "#111",
                  border: "none", borderRadius: "30px", fontSize: "11px", fontWeight: 500, cursor: "pointer"
                }}
              >
                Login
              </button>
              <button
                onClick={handleRefresh}
                style={{
                  flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.88)",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: "30px", fontSize: "11px", cursor: "pointer"
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Popup />);

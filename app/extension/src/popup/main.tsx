import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

const BACKEND_URL = "http://localhost:8000";

function Popup() {
  const [userId, setUserId] = useState<string>("");
  const [savedUserId, setSavedUserId] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<string>("checking...");

  useEffect(() => {
    chrome.storage.local.get(["userId"], (result) => {
      if (result.userId) {
        setSavedUserId(result.userId);
        setUserId(result.userId);
      }
    });
    fetch(`${BACKEND_URL}/health`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("offline"));
  }, []);

  const handleSave = () => {
    chrome.storage.local.set({ userId }, () => {
      setSavedUserId(userId);
    });
  };

  const handleClear = () => {
    chrome.storage.local.remove(["userId"], () => {
      setSavedUserId(null);
      setUserId("");
    });
  };

  return (
    <div style={{ width: "280px", padding: "16px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "16px", fontWeight: 500, margin: "0 0 4px" }}>LeeView</h1>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px" }}>AI Mock Interview</p>

      <div style={{ fontSize: "11px", marginBottom: "12px" }}>
        Backend: <span style={{ color: backendStatus === "ok" ? "#22c55e" : "#ef4444" }}>{backendStatus}</span>
      </div>

      {savedUserId ? (
        <div>
          <p style={{ fontSize: "12px", color: "#333", margin: "0 0 8px" }}>
            User: <strong>{savedUserId}</strong>
          </p>
          <p style={{ fontSize: "11px", color: "#22c55e" }}>
            ✓ Ready — open a LeetCode problem to start
          </p>
          <button
            onClick={handleClear}
            style={{
              marginTop: "8px", padding: "6px 12px", fontSize: "11px",
              background: "#ef4444", color: "#fff", border: "none",
              borderRadius: "6px", cursor: "pointer",
            }}
          >
            Clear User
          </button>
        </div>
      ) : (
        <div>
          <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px" }}>
            Supabase User ID
          </label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Paste your Supabase user ID"
            style={{
              width: "100%", padding: "8px", fontSize: "12px",
              border: "1px solid #ddd", borderRadius: "6px",
              boxSizing: "border-box", marginBottom: "8px",
            }}
          />
          <button
            onClick={handleSave}
            disabled={!userId}
            style={{
              padding: "8px 16px", fontSize: "12px",
              background: userId ? "#2563eb" : "#ccc", color: "#fff",
              border: "none", borderRadius: "6px", cursor: userId ? "pointer" : "default",
            }}
          >
            Save
          </button>
          <p style={{ fontSize: "10px", color: "#999", marginTop: "8px" }}>
            Get your User ID from your Supabase dashboard &rarr; Authentication &rarr; Users
          </p>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Popup />);

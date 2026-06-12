import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
const BACKEND_URL = "http://localhost:8000";
const DASHBOARD_URL = "http://localhost:5173";
function Popup() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [backendStatus, setBackendStatus] = useState("checking...");
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
    if (loading) {
        return (_jsx("div", { style: { width: "280px", padding: "16px", fontFamily: "system-ui" }, children: _jsx("p", { style: { fontSize: "12px", color: "#666" }, children: "Loading..." }) }));
    }
    return (_jsxs("div", { style: { width: "280px", padding: "16px", fontFamily: "system-ui" }, children: [_jsx("h1", { style: { fontSize: "16px", fontWeight: 500, margin: "0 0 4px" }, children: "LeeView" }), _jsx("p", { style: { fontSize: "12px", color: "#666", margin: "0 0 12px" }, children: "AI Mock Interview" }), _jsxs("div", { style: { fontSize: "11px", marginBottom: "12px" }, children: ["Backend:", " ", _jsx("span", { style: { color: backendStatus === "ok" ? "#22c55e" : "#ef4444" }, children: backendStatus })] }), user ? (_jsxs("div", { children: [_jsxs("div", { style: {
                            background: "#f0fdf4", borderRadius: "8px", padding: "10px",
                            marginBottom: "12px", border: "1px solid #bbf7d0",
                        }, children: [_jsx("p", { style: { fontSize: "11px", color: "#16a34a", margin: "0 0 2px" }, children: "\u2713 Signed in" }), _jsx("p", { style: { fontSize: "11px", color: "#333", margin: 0, wordBreak: "break-all" }, children: user.email })] }), _jsx("p", { style: { fontSize: "11px", color: "#22c55e", margin: "0 0 8px" }, children: "\u2713 Ready \u2014 open a LeetCode problem to start" }), _jsx("button", { onClick: handleClear, style: {
                            padding: "6px 12px", fontSize: "11px",
                            background: "rgba(255,100,100,0.1)", color: "rgba(255,100,100,0.8)",
                            border: "1px solid rgba(255,100,100,0.2)", borderRadius: "30px",
                            cursor: "pointer",
                        }, children: "Sign Out" })] })) : (_jsxs("div", { children: [_jsx("div", { style: {
                            background: "#fff7ed", borderRadius: "8px", padding: "10px",
                            marginBottom: "12px", border: "1px solid #fed7aa",
                        }, children: _jsx("p", { style: { fontSize: "11px", color: "#c2410c", margin: 0 }, children: "Not signed in. Log in to the dashboard first." }) }), _jsx("button", { onClick: handleOpenDashboard, style: {
                            padding: "8px 16px", fontSize: "12px",
                            background: "#2563eb", color: "#fff",
                            border: "none", borderRadius: "6px", cursor: "pointer",
                            width: "100%",
                        }, children: "Open Dashboard to Login" }), _jsx("button", { onClick: handleRefresh, style: {
                            marginTop: "8px", padding: "6px 12px", fontSize: "11px",
                            background: "none", color: "#666",
                            border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer",
                            width: "100%",
                        }, children: "Refresh" })] }))] }));
}
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(Popup, {}));

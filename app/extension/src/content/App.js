import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { StartPill } from "../components/StartPill";
import { InterviewOverlay } from "../components/InterviewOverlay";
import { useInterview } from "../hooks/useInterview";
export default function App() {
    const [started, setStarted] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userEmail, setUserEmail] = useState(null);
    const [ready, setReady] = useState(false);
    const { phase, startInterview, stopInterview } = useInterview();
    useEffect(() => {
        chrome.runtime.sendMessage({ type: "GET_AUTH" }, (result) => {
            if (result?.userId) {
                setUserId(result.userId);
                setUserEmail(result.user?.email || null);
            }
            setReady(true);
        });
    }, []);
    const handleStart = () => {
        if (!userId)
            return;
        setStarted(true);
        startInterview(userId);
    };
    if (!ready)
        return null;
    if (!userId) {
        return (_jsx("div", { style: {
                position: "fixed", top: "20px", right: "20px", zIndex: 9999,
                padding: "20px", borderRadius: "20px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.22)",
                outline: "1px solid rgba(0,0,0,0.18)",
                backdropFilter: "blur(20px)",
                color: "rgba(255,255,255,0.88)", minWidth: "250px",
            }, children: _jsx("p", { style: { margin: "0 0 8px", fontSize: "13px" }, children: "Click the LeeView icon in your toolbar, then log in via the dashboard." }) }));
    }
    return (_jsxs(_Fragment, { children: [!started && _jsx(StartPill, { onClick: handleStart }), started && _jsx(InterviewOverlay, { phase: phase, onStop: stopInterview })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Waveform } from "./Waveform";
export function InterviewOverlay({ phase, onStop, }) {
    const isListening = phase === "LISTENING";
    const isSpeaking = phase === "SPEAKING";
    const dotColor = isSpeaking ? "rgba(255,255,255,0.8)" : isListening ? "rgba(255,100,100,0.65)" : "rgba(255,255,255,0.45)";
    return (_jsxs("div", { style: {
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "20px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.22)",
            outline: "1px solid rgba(0,0,0,0.18)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            color: "rgba(255,255,255,0.88)",
            minWidth: "250px",
        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("div", { style: {
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: dotColor,
                            animation: isSpeaking ? "pulse 1.5s infinite" : "none",
                        } }), _jsx("span", { style: { fontWeight: "500" }, children: isSpeaking ? "Interviewer Speaking..." : isListening ? "Listening..." : phase })] }), isListening && _jsx(Waveform, {}), _jsx("button", { onClick: onStop, style: {
                    marginTop: "12px",
                    padding: "8px 16px",
                    borderRadius: "30px",
                    background: "rgba(255,100,100,0.1)",
                    border: "1px solid rgba(255,100,100,0.2)",
                    color: "rgba(255,100,100,0.8)",
                    cursor: "pointer",
                    fontWeight: "500",
                    fontFamily: "monospace",
                    fontSize: "11px",
                }, children: "End Interview" })] }));
}

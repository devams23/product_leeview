import { jsx as _jsx } from "react/jsx-runtime";
export function StartPill({ onClick }) {
    return (_jsx("button", { onClick: onClick, style: {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "12px 24px",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,0.9)",
            color: "#111",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }, children: "Start Mock Interview" }));
}

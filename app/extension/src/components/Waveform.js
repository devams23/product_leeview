import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Waveform() {
    return (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "2px", height: "20px", marginTop: "8px" }, children: [Array.from({ length: 20 }).map((_, i) => (_jsx("div", { style: {
                    width: "2px",
                    height: "100%",
                    backgroundColor: "rgba(255,255,255,0.5)",
                    animation: `wave 1s ease-in-out infinite ${i * 0.05}s`,
                    borderRadius: "1px",
                } }, i))), _jsx("style", { children: `
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      ` })] }));
}

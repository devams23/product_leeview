/** @type {import('tailwindcss').Config} */
// "Studio" tokens. Values must match the extension (app/extension) exactly.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 0: "#0A0B0D", 1: "#111216", 2: "#17181D", 3: "#1F2027" },
        line: "rgba(255,255,255,0.08)",
        "line-2": "rgba(255,255,255,0.14)",
        "text-1": "#EDEDF0",
        "text-2": "#A1A2AB",
        "text-3": "#6B6C76",
        signal: "#D4FF3F",
        "signal-ink": "#0A0B0D",
        "signal-soft": "rgba(212,255,63,0.12)",
        ai: "#B9A6FF",
        "ai-soft": "rgba(185,166,255,0.14)",
        danger: "#FF6B5E",
        "danger-soft": "rgba(255,107,94,0.12)",
        warn: "#FFB547",
        "warn-soft": "rgba(255,181,71,0.12)",
        ok: "#4ADE80",
        "ok-soft": "rgba(74,222,128,0.12)",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        chip: "6px",
        btn: "10px",
        card: "14px",
        shell: "20px",
      },
    },
  },
  plugins: [],
};

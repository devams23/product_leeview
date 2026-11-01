/** @type {import('tailwindcss').Config} */
// "Layer" tokens: LeetCode's dark surfaces and orange, so the product reads as part of the page it sits on. Values must match the extension (app/extension) exactly.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 0: "#1A1A1A", 1: "#282828", 2: "#323232", 3: "#3E3E3E" },
        line: "rgba(255,255,255,0.10)",
        "line-2": "rgba(255,255,255,0.16)",
        "text-1": "#F7F7F7",
        "text-2": "#C4C4C4",
        "text-3": "#9A9A9A",
        signal: "#FFA116",
        "signal-hover": "#FFB547",
        "signal-ink": "#1A1A1A",
        "signal-soft": "rgba(255,161,22,0.12)",
        ai: "#B9A6FF",
        "ai-soft": "rgba(185,166,255,0.14)",
        danger: "#FF6B6B",
        "danger-soft": "rgba(255,107,107,0.12)",
        warn: "#FFC01E",
        "warn-soft": "rgba(255,192,30,0.12)",
        ok: "#1CC8B4",
        "ok-soft": "rgba(28,200,180,0.12)",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Instrument Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
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

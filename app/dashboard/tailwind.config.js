/** @type {import('tailwindcss').Config} */
// "Dusk" tokens: lifted indigo surfaces that lighten with elevation. Values must match the extension (app/extension) exactly.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 0: "#1A1C2B", 1: "#222436", 2: "#2A2D42", 3: "#34374F" },
        line: "rgba(255,255,255,0.10)",
        "line-2": "rgba(255,255,255,0.18)",
        "text-1": "#F3F2F7",
        "text-2": "#C2C2D3",
        "text-3": "#9C9DB4",
        signal: "#CFF25A",
        "signal-hover": "#DDF77F",
        "signal-ink": "#14151F",
        "signal-soft": "rgba(207,242,90,0.12)",
        ai: "#C4B5FF",
        "ai-soft": "rgba(196,181,255,0.14)",
        danger: "#FF8F80",
        "danger-soft": "rgba(255,143,128,0.12)",
        warn: "#FFC46B",
        "warn-soft": "rgba(255,196,107,0.12)",
        ok: "#4EDDB4",
        "ok-soft": "rgba(78,221,180,0.12)",
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

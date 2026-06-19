/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bgBase: '#1a1b1e',
        bgPanel: 'rgba(255,255,255,0.07)',
        bgPanelInner: 'rgba(255,255,255,0.04)',
        bgInput: 'rgba(255,255,255,0.06)',
        borderGlass: 'rgba(255,255,255,0.12)',
        borderGlassInner: 'rgba(255,255,255,0.07)',
        borderGlassStrong: 'rgba(255,255,255,0.2)',
        outlineDepth: 'rgba(0,0,0,0.3)',
        textPrimary: 'rgba(255,255,255,0.88)',
        textSecondary: 'rgba(255,255,255,0.45)',
        textMuted: 'rgba(255,255,255,0.2)',
        accent: 'rgba(255,255,255,0.75)',
        accentText: '#111',
      },
      fontFamily: {
        sans: ['"Playfair Display"', 'serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      borderRadius: {
        panel: '20px',
        inner: '12px',
        pill: '30px',
      }
    },
  },
  plugins: [],
};

/** mm:ss for the interview timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Score on the 1–10 scale, or an em dash when the backend did not provide one. Never invented. */
export function formatScore(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  return String(Math.round(score * 10) / 10);
}

/** Difficulty chip classes; unknown difficulty falls back to the neutral chip. */
export function difficultyChipClass(difficulty: string): string {
  const key = difficulty.trim().toLowerCase();
  return key === "easy" || key === "medium" || key === "hard"
    ? `lv-chip lv-chip--${key}`
    : "lv-chip";
}

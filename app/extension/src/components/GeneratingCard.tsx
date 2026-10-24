import { useEffect, useState } from "react";

const LINES = ["Scoring your approach…", "Reviewing your code…", "Writing feedback…"];
const CYCLE_MS = 2400;

/** Shown between ending the interview and the debrief arriving. */
export function GeneratingCard() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % LINES.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lv-stack">
      <span className="lv-eyebrow">Debrief</span>
      <p className="lv-status-line" role="status">Writing your debrief</p>
      <div className="lv-skeleton lv-skeleton--tall" aria-hidden="true" />
      <div className="lv-skeleton" aria-hidden="true" />
      <div className="lv-skeleton lv-skeleton--short" aria-hidden="true" />
      <p className="lv-muted" aria-hidden="true">{LINES[index]}</p>
    </div>
  );
}

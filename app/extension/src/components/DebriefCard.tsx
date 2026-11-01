import { useEffect, useState } from "react";
import type { Debrief } from "../types";
import { ExternalIcon } from "./Icons";
import { formatScore } from "./format";

const COUNT_MS = 900;

interface DebriefCardProps {
  debrief: Debrief | null;
  sessionId: string | null;
  onViewFull: () => void;
  onPractice: () => void;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The model's headline, or the summary's first sentence when there is none. */
function oneLiner(debrief: Debrief | null): string | null {
  const headline = debrief?.headline?.trim();
  if (headline) return headline;
  const summary = debrief?.summary?.trim();
  return summary?.match(/^.+?[.!?](?=\s|$)/s)?.[0] ?? summary ?? null;
}

/** Counts up to the score once, easing out so it settles on the final number. */
function useCountUp(target: number | null): number | null {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === null) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - started) / COUNT_MS);
      setValue(t < 1 ? Math.floor(target * (1 - (1 - t) ** 3)) : target);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return target === null ? null : value;
}

/** One score and one line: the rest of the debrief is the reason to open the dashboard. */
export function DebriefCard({ debrief, sessionId, onViewFull, onPractice }: DebriefCardProps) {
  const overall = numeric(debrief?.overall_score);
  const shown = useCountUp(overall);
  const line = oneLiner(debrief);

  return (
    <div className="lv-verdict">
      <p className="lv-score" aria-label={overall === null ? "No score" : `${formatScore(overall)} out of 10`}>
        <span className={overall === null ? "lv-score-big lv-score-big--empty" : "lv-score-big"} aria-hidden="true">
          {formatScore(shown)}
        </span>
        <span className="lv-score-denom" aria-hidden="true">/10</span>
      </p>

      {line ? <p className="lv-verdict-line">{line}</p> : null}

      <div className="lv-verdict-actions">
        <button
          type="button"
          className="lv-btn lv-btn--primary lv-btn--block"
          onClick={onViewFull}
          disabled={!sessionId}
        >
          <ExternalIcon />
          View full debrief
        </button>
        <button type="button" className="lv-btn lv-btn--quiet lv-btn--block" onClick={onPractice}>
          Practice again
        </button>
      </div>
    </div>
  );
}

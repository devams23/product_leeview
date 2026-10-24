import type { Debrief } from "../types";
import { ExternalIcon } from "./Icons";
import { formatScore } from "./format";

interface DebriefCardProps {
  debrief: Debrief | null;
  sessionId: string | null;
  onViewFull: () => void;
  onPractice: () => void;
}

const SKILLS: ReadonlyArray<{ label: string; key: keyof Debrief }> = [
  { label: "Approach", key: "approach_score" },
  { label: "Communication", key: "communication_score" },
  { label: "Correctness", key: "code_correctness_score" },
  { label: "Code quality", key: "code_quality_score" },
  { label: "Time", key: "time_management_score" },
];

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Scores come straight from the backend; a missing score shows an em dash, never a guess. */
export function DebriefCard({ debrief, sessionId, onViewFull, onPractice }: DebriefCardProps) {
  const overall = numeric(debrief?.overall_score);
  const feedback = (debrief?.actionable_feedback ?? [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 2);

  return (
    <div className="lv-stack">
      <span className="lv-eyebrow">Debrief ready</span>

      <div className="lv-score-hero">
        <span className={overall === null ? "lv-score-big lv-score-big--empty" : "lv-score-big"}>
          {formatScore(overall)}
        </span>
        <span className="lv-score-denom">/ 10 overall</span>
      </div>

      <div className="lv-skills">
        {SKILLS.map(({ label, key }) => {
          const value = numeric(debrief?.[key]);
          const width = value === null ? 0 : Math.min(10, Math.max(0, value)) * 10;
          return (
            <div className="lv-skill" key={key}>
              <span className="lv-skill-name">{label}</span>
              <span className={value === null ? "lv-skill-value lv-skill-value--empty" : "lv-skill-value"}>
                {formatScore(value)}
              </span>
              <div className="lv-skill-track" aria-hidden="true">
                <div className="lv-skill-fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {feedback.length > 0 ? (
        <div className="lv-section">
          <span className="lv-eyebrow">What to work on</span>
          <ol className="lv-feedback">
            {feedback.map((item, i) => (
              <li key={i}>
                <span className="lv-feedback-n">{String(i + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="lv-stack">
        <button
          type="button"
          className="lv-btn lv-btn--primary lv-btn--block"
          onClick={onViewFull}
          disabled={!sessionId}
        >
          <ExternalIcon />
          View full debrief
        </button>
        <button type="button" className="lv-btn lv-btn--ghost lv-btn--block" onClick={onPractice}>
          Practice again
        </button>
      </div>
    </div>
  );
}

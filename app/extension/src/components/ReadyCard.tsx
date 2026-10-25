import { difficultyChipClass } from "./format";
import { InfoIcon, MicIcon } from "./Icons";

interface ReadyCardProps {
  problemTitle: string;
  difficulty: string;
  hasProblem: boolean;
  onStart: () => void;
}

export function ReadyCard({ problemTitle, difficulty, hasProblem, onStart }: ReadyCardProps) {
  return (
    <div className="lv-stack">
      <div className="lv-stack lv-stack--tight">
        <h2 className="lv-problem-title">{problemTitle || "Open a problem"}</h2>
        <div className="lv-row">
          {difficulty ? <span className={difficultyChipClass(difficulty)}>{difficulty}</span> : null}
          <span className="lv-meta">Voice interview · about 20 min</span>
        </div>
      </div>

      <button
        type="button"
        className="lv-btn lv-btn--primary lv-btn--block"
        onClick={onStart}
        disabled={!hasProblem}
      >
        <MicIcon />
        Start interview
      </button>

      <p className="lv-hint">
        <InfoIcon />
        {hasProblem ? "Chrome asks for your microphone the first time." : "Open a LeetCode problem to start."}
      </p>
    </div>
  );
}

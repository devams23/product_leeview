import { difficultyChipClass } from "./format";
import { MicIcon } from "./Icons";

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
        <h2 className="lv-problem-title">{problemTitle || "Open a LeetCode problem"}</h2>
        {difficulty ? <span className={difficultyChipClass(difficulty)}>{difficulty}</span> : null}
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
    </div>
  );
}

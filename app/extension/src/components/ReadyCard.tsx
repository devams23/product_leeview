import { difficultyChipClass } from "./format";
import { InfoIcon, MicIcon } from "./Icons";

interface ReadyCardProps {
  problemTitle: string;
  difficulty: string;
  hasProblem: boolean;
  onStart: () => void;
}

const EXPECT = [
  "Talk it through out loud, the way you would in a real interview.",
  "The interviewer asks follow-ups and listens while you code.",
  "You get a scored debrief at the end, about 20 minutes in.",
];

export function ReadyCard({ problemTitle, difficulty, hasProblem, onStart }: ReadyCardProps) {
  return (
    <div className="lv-stack">
      <span className="lv-eyebrow">Ready when you are</span>
      <div className="lv-stack">
        <h2 className="lv-problem-title">{problemTitle || "Current problem"}</h2>
        <div className="lv-row">
          {difficulty ? <span className={difficultyChipClass(difficulty)}>{difficulty}</span> : null}
          <span className="lv-meta">Voice · about 20 min</span>
        </div>
      </div>

      <button
        type="button"
        className="lv-btn lv-btn--primary lv-btn--lg lv-btn--block"
        onClick={onStart}
        disabled={!hasProblem}
      >
        <MicIcon />
        Start interview
      </button>

      <p className="lv-hint">
        <InfoIcon />
        {hasProblem
          ? "Your browser will ask for microphone access the first time."
          : "Open a LeetCode problem to start an interview."}
      </p>

      <div className="lv-section">
        <span className="lv-eyebrow">What to expect</span>
        <ul className="lv-list">
          {EXPECT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

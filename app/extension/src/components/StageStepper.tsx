import type { Stage } from "../types";

export const STAGE_LABELS = ["Clarify", "Approach", "Code", "Walkthrough", "Wrap-up"] as const;

/** Maps the backend interview state onto the five visible stages. */
export function stageIndex(stage: Stage | null): number {
  switch (stage) {
    case "AWAITING_APPROACH":
      return 1;
    case "AWAITING_CODE":
      return 2;
    case "AWAITING_WALKTHROUGH":
      return 3;
    case "CONCLUDING":
    case "GENERATING_DEBRIEF":
    case "COMPLETED":
      return 4;
    case "INTRO":
    case "AWAITING_CLARIFICATION":
    default:
      return 0;
  }
}

interface StageStepperProps {
  stage: Stage | null;
}

export function StageStepper({ stage }: StageStepperProps) {
  const current = stageIndex(stage);
  return (
    <div className="lv-stepper">
      <ol className="lv-stepper-track" aria-label="Interview stages">
        {STAGE_LABELS.map((label, i) => {
          const state = i < current ? "lv-step lv-step--done" : i === current ? "lv-step lv-step--current" : "lv-step";
          return (
            <li
              key={label}
              className={state}
              title={label}
              aria-current={i === current ? "step" : undefined}
            />
          );
        })}
      </ol>
      <div className="lv-stepper-caption">
        <strong>{STAGE_LABELS[current]}</strong>
        <span>
          {current + 1} / {STAGE_LABELS.length}
        </span>
      </div>
    </div>
  );
}

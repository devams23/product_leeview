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

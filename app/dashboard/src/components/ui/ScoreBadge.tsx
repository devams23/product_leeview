import { scoreTone, toneBorder, toneSoft, toneText } from "../../lib/format";

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <span
        aria-label="No score"
        className="inline-flex h-7 items-center rounded-chip border border-line px-2 font-mono text-[12px] text-text-3"
      >
        No score
      </span>
    );
  }
  const tone = scoreTone(score);
  return (
    <span
      aria-label={`Score ${score} out of 10`}
      className={`inline-flex h-7 items-baseline gap-0.5 rounded-chip border px-2 ${toneSoft[tone]} ${toneBorder[tone]}`}
    >
      <span className={`font-display text-[18px] leading-none tabular-nums ${toneText[tone]}`}>{score}</span>
      <span className="font-mono text-[11px] text-text-3">/10</span>
    </span>
  );
}

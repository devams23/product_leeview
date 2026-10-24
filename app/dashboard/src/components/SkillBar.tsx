import { formatScore, scoreTone, toneBg } from "../lib/format";

export function SkillBar({ label, value }: { label: string; value: number | null | undefined }) {
  const tone = scoreTone(value);
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value * 10));
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-text-2">{label}</span>
        <span className={`font-mono tabular-nums ${value == null ? "text-text-3" : "text-text-1"}`}>
          {value == null ? "Not scored" : `${formatScore(value)} / 10`}
        </span>
      </div>
      <div
        role="img"
        aria-label={value == null ? `${label}: not scored` : `${label}: ${formatScore(value)} out of 10`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-3"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneBg[tone]} ${
            value == null ? "opacity-0" : ""
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

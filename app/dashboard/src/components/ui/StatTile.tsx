import type { ReactNode } from "react";
import { toneText, type Tone } from "../../lib/format";
import { Card } from "./Card";

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="flex min-h-[132px] flex-col justify-between gap-4 p-5 transition-colors duration-150 hover:border-line-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-2">{label}</span>
      <div className="flex flex-col gap-1.5">
        <span
          className={`font-display text-[40px] leading-none tabular-nums sm:text-[48px] ${
            tone ? toneText[tone] : "text-text-1"
          }`}
        >
          {value}
        </span>
        {sub && <span className="text-[13px] text-text-2">{sub}</span>}
      </div>
    </Card>
  );
}

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

export interface RadarDatum {
  subject: string;
  /** Plotted value; unscored skills plot at 0. */
  value: number;
  /** The real score, or null when the skill was not scored. */
  raw: number | null;
}

interface TooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: RadarDatum }>;
}

function RadarTooltip({ active, payload }: TooltipProps) {
  const datum = active ? payload?.[0]?.payload : undefined;
  if (!datum) return null;
  return (
    <div className="rounded-chip border border-line-2 bg-ink-2 px-3 py-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
      <p className="text-[12px] text-text-2">{datum.subject}</p>
      <p className="mt-0.5 font-mono text-[13px] tabular-nums text-text-1">
        {datum.raw == null ? "Not scored" : `${datum.raw} / 10`}
      </p>
    </div>
  );
}

export function SkillRadar({ data }: { data: RadarDatum[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#A1A2AB", fontSize: 11, fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
          />
          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke="#D4FF3F"
            strokeWidth={1.5}
            fill="#D4FF3F"
            fillOpacity={0.12}
            dot={{ r: 3, fill: "#D4FF3F", stroke: "#0A0B0D", strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
          <Tooltip content={RadarTooltip} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

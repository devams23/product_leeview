import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "../../lib/format";
import type { TrendPoint } from "../../lib/stats";

const AXIS_TICK = { fill: "#A1A2AB", fontSize: 11, fontFamily: "JetBrains Mono, ui-monospace, monospace" };

interface TooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: TrendPoint }>;
}

function TrendTooltip({ active, payload }: TooltipProps) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="max-w-[220px] rounded-chip border border-line-2 bg-ink-2 px-3 py-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
      <p className="font-mono text-[11px] text-text-3">{formatDate(point.date)}</p>
      <p className="mt-1 font-display text-[22px] leading-none tabular-nums text-signal">
        {point.score}
        <span className="font-mono text-[11px] text-text-3"> / 10</span>
      </p>
      <p className="mt-1.5 truncate text-[12px] text-text-2">{point.title}</p>
    </div>
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lv-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4FF3F" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#D4FF3F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            dy={8}
          />
          <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
          <Tooltip content={TrendTooltip} cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#D4FF3F"
            strokeWidth={2}
            fill="url(#lv-trend-fill)"
            dot={{ r: 3, fill: "#0A0B0D", stroke: "#D4FF3F", strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: "#D4FF3F", stroke: "#0A0B0D", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type VisualMode = "listening" | "muted" | "ai" | "thinking";

const BAR_COUNT = 20;
// Fixed per-bar weights so the bars look like a waveform instead of a flat block.
const WEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => 0.45 + 0.55 * Math.abs(Math.sin((i + 1) * 1.7)));

interface VoiceVisualizerProps {
  mode: VisualMode;
  /** Mic level 0..1; only used in `listening` mode. */
  level: number;
}

/** Decorative: the status label carries the meaning, so this is hidden from assistive tech. */
export function VoiceVisualizer({ mode, level }: VoiceVisualizerProps) {
  if (mode === "thinking") {
    return (
      <div className="lv-visualizer lv-visualizer--think" aria-hidden="true">
        <span className="lv-think-dot" />
        <span className="lv-think-dot" />
        <span className="lv-think-dot" />
      </div>
    );
  }

  if (mode === "listening") {
    const clamped = Math.min(1, Math.max(0, level));
    return (
      <div className="lv-visualizer" aria-hidden="true">
        {WEIGHTS.map((weight, i) => (
          <span
            key={i}
            className="lv-bar"
            style={{ height: `${Math.round(3 + clamped * 26 * weight)}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`lv-visualizer lv-visualizer--${mode}`} aria-hidden="true">
      {WEIGHTS.map((_, i) => (
        <span key={i} className="lv-bar" />
      ))}
    </div>
  );
}

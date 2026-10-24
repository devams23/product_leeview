import type { MutableRefObject, PointerEvent } from "react";
import type { PositionStyle } from "../hooks/usePersistentPosition";
import { formatClock } from "./format";

interface LauncherProps {
  shellRef: MutableRefObject<HTMLElement | null>;
  style: PositionStyle;
  dragging: boolean;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onExpand: () => void;
  problemTitle: string;
  live: boolean;
  elapsedSeconds: number;
}

/** Collapsed pill. The grip (not a button) drags it; the label button expands the panel. */
export function Launcher({
  shellRef, style, dragging, onPointerDown, onExpand, problemTitle, live, elapsedSeconds,
}: LauncherProps) {
  const clock = formatClock(elapsedSeconds);
  return (
    <section
      ref={shellRef}
      className={dragging ? "lv-launcher lv-shell--dragging" : "lv-launcher"}
      style={style}
      aria-label="LeeView"
    >
      <span className="lv-grip" onPointerDown={onPointerDown} aria-hidden="true" />
      <button
        type="button"
        className="lv-launcher-main"
        onClick={onExpand}
        aria-label={live ? `Show LeeView, interview live, ${clock} elapsed` : "Show LeeView"}
        title="Show LeeView"
      >
        <span className={live ? "lv-signal-dot lv-signal-dot--live" : "lv-signal-dot"} aria-hidden="true" />
        <span className="lv-launcher-label">LeeView</span>
        {live ? (
          <span className="lv-launcher-detail lv-launcher-detail--timer">{clock}</span>
        ) : problemTitle ? (
          <span className="lv-launcher-detail">{problemTitle}</span>
        ) : null}
      </button>
    </section>
  );
}

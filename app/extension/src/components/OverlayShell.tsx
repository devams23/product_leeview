import type { MutableRefObject, PointerEvent, ReactNode } from "react";
import type { PositionStyle } from "../hooks/usePersistentPosition";
import { MinusIcon } from "./Icons";
import { BrandMark } from "./BrandMark";

interface OverlayShellProps {
  shellRef: MutableRefObject<HTMLElement | null>;
  style: PositionStyle;
  dragging: boolean;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onCollapse: () => void;
  live?: boolean;
  children: ReactNode;
}

/** Expanded panel: draggable header (wordmark, minimise) and a body that swaps per state. */
export function OverlayShell({
  shellRef, style, dragging, onPointerDown, onCollapse, live, children,
}: OverlayShellProps) {
  return (
    <section
      ref={shellRef}
      className={dragging ? "lv-shell lv-shell--dragging" : "lv-shell"}
      style={style}
      aria-label="LeeView interview panel"
    >
      <header className="lv-header" onPointerDown={onPointerDown}>
        <BrandMark live={live} />
        <span className="lv-wordmark">LeeView</span>
        <button
          type="button"
          className="lv-icon-btn"
          aria-label="Minimise LeeView"
          title="Minimise"
          onClick={onCollapse}
        >
          <MinusIcon />
        </button>
      </header>
      {children}
    </section>
  );
}

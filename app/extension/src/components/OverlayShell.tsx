import type { MutableRefObject, PointerEvent, ReactNode } from "react";
import type { PositionStyle } from "../hooks/usePersistentPosition";
import { MinusIcon } from "./Icons";

interface OverlayShellProps {
  shellRef: MutableRefObject<HTMLElement | null>;
  style: PositionStyle;
  dragging: boolean;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onCollapse: () => void;
  meta?: string;
  children: ReactNode;
}

/** Expanded panel: draggable header (wordmark, meta, minimise) and a body that swaps per state. */
export function OverlayShell({
  shellRef, style, dragging, onPointerDown, onCollapse, meta, children,
}: OverlayShellProps) {
  return (
    <section
      ref={shellRef}
      className={dragging ? "lv-shell lv-shell--dragging" : "lv-shell"}
      style={style}
      aria-label="LeeView interview panel"
    >
      <header className="lv-header" onPointerDown={onPointerDown}>
        <span className="lv-mark" aria-hidden="true" />
        <span className="lv-wordmark">LeeView</span>
        {meta ? <span className="lv-header-meta">{meta}</span> : null}
        <button
          type="button"
          className="lv-icon-btn"
          style={meta ? undefined : { marginLeft: "auto" }}
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

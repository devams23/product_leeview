import { useCallback, useEffect, useRef, useState } from "react";

const POSITION_KEY = "overlayPos";
const COLLAPSED_KEY = "overlayCollapsed";
const DEFAULT_RIGHT = 24;
const DEFAULT_BOTTOM = 88;
// Keep at least this many px of the shell (its header) inside the viewport.
const MIN_VISIBLE_HEIGHT = 48;

interface Point {
  x: number;
  y: number;
}

export type PositionStyle = { left: number; top: number } | { right: number; bottom: number };

function clampPoint(p: Point, width: number): Point {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - MIN_VISIBLE_HEIGHT);
  return {
    x: Math.min(Math.max(p.x, 0), maxX),
    y: Math.min(Math.max(p.y, 0), maxY),
  };
}

/**
 * Draggable overlay position, persisted in chrome.storage.local (`overlayPos`).
 *
 * Usage: attach `shellRef` to the positioned shell element (position: fixed) and apply
 * `style` to it; attach `onPointerDown` to the drag handle (header). Drags starting on
 * `button` or `[data-no-drag]` are ignored. Until the user drags, the default is
 * bottom-right (`right: 24px; bottom: 88px`).
 */
export function usePersistentPosition(defaultWidth = 320): {
  style: PositionStyle;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  dragging: boolean;
  shellRef: React.MutableRefObject<HTMLElement | null>;
} {
  const [pos, setPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const shellRef = useRef<HTMLElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const measureWidth = () => shellRef.current?.getBoundingClientRect().width || defaultWidth;

  // Load the saved position once; clamp it to the current viewport.
  useEffect(() => {
    let alive = true;
    try {
      chrome.storage.local.get(POSITION_KEY, (res) => {
        const saved = res?.[POSITION_KEY];
        if (alive && saved && typeof saved.x === "number" && typeof saved.y === "number") {
          setPos(clampPoint({ x: saved.x, y: saved.y }, defaultWidth));
        }
      });
    } catch {
      // storage unavailable — keep the default position
    }
    return () => {
      alive = false;
    };
  }, [defaultWidth]);

  // Keep the overlay on-screen when the window shrinks.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPoint(p, measureWidth()) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // measureWidth only reads refs and defaultWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultWidth]);

  // Remove drag listeners if unmounted mid-drag.
  useEffect(() => () => dragCleanupRef.current?.(), []);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as Element | null;
    if (target?.closest?.("button, [data-no-drag]")) return;

    const shell = shellRef.current;
    if (!shell) return;

    const rect = shell.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const width = rect.width;
    let latest: Point = { x: rect.left, y: rect.top };
    let moved = false;

    e.preventDefault();
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; // ignore jitter on click
      moved = true;
      latest = clampPoint({ x: rect.left + dx, y: rect.top + dy }, width);
      setPos(latest);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      dragCleanupRef.current = null;
    };

    const onUp = () => {
      cleanup();
      setDragging(false);
      if (moved) {
        try {
          chrome.storage.local.set({ [POSITION_KEY]: latest });
        } catch {
          // storage unavailable — position applies for this session only
        }
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    dragCleanupRef.current = cleanup;
  };

  const style: PositionStyle = pos
    ? { left: pos.x, top: pos.y }
    : { right: DEFAULT_RIGHT, bottom: DEFAULT_BOTTOM };

  return { style, onPointerDown, dragging, shellRef };
}

/** Persisted collapsed flag (`overlayCollapsed`). Returns [collapsed, setCollapsed]. */
export function useCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    let alive = true;
    try {
      chrome.storage.local.get(COLLAPSED_KEY, (res) => {
        const saved = res?.[COLLAPSED_KEY];
        if (alive && typeof saved === "boolean") setCollapsedState(saved);
      });
    } catch {
      // storage unavailable — default to expanded
    }
    return () => {
      alive = false;
    };
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      chrome.storage.local.set({ [COLLAPSED_KEY]: next });
    } catch {
      // storage unavailable — applies for this session only
    }
  }, []);

  return [collapsed, setCollapsed];
}

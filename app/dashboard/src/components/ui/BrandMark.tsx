/** The LeeView L mark: signal tile, ink L and dot. Same mark as the extension. `live` pulses the dot. */
export function BrandMark({ size = 22, live = false }: { size?: number; live?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="6 6 88 88"
      width={size}
      height={size}
      className="block shrink-0 text-signal"
    >
      <rect x="6" y="6" width="88" height="88" rx="22" fill="currentColor" />
      <path
        d="M33 28V70H57"
        className="stroke-ink-0"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx="72"
        cy="70"
        r="6.5"
        className={`fill-ink-0 ${live ? "animate-pulse" : ""}`}
      />
    </svg>
  );
}

/** "LeeView" set in the display face; sized to sit beside a mark of `size`. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-display font-bold leading-none tracking-[-0.02em] text-text-1"
      style={{ fontSize: Math.max(16, Math.round(size * 0.7)) }}
    >
      LeeView
    </span>
  );
}

/** Mark and wordmark on one line. */
export function Brand({ size = 22, live = false }: { size?: number; live?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: Math.round(size * 0.36) }}>
      <BrandMark size={size} live={live} />
      <Wordmark size={size} />
    </span>
  );
}

/** Signal tile with a centred ink dot. Same mark as the extension. `live` pulses the dot. */
export function BrandMark({ size = 22, live = false }: { size?: number; live?: boolean }) {
  const dot = Math.round(size * 0.36);
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center bg-signal"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
    >
      <span
        className={`block rounded-full bg-ink-0 ${live ? "animate-pulse" : ""}`}
        style={{ width: dot, height: dot }}
      />
    </span>
  );
}

export function Wordmark() {
  return <span className="font-display text-[16px] font-bold leading-none tracking-[-0.02em] text-text-1">LeeView</span>;
}

/** Mark and wordmark on one line. */
export function Brand({ size = 22, live = false }: { size?: number; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark size={size} live={live} />
      <Wordmark />
    </span>
  );
}

/** The LeeView L mark, same as the dashboard and the toolbar icon. `live` pulses the dot. */
export function BrandMark({ live = false }: { live?: boolean }) {
  return (
    <svg className={live ? "lv-mark lv-mark--live" : "lv-mark"} viewBox="6 6 88 88" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="22" fill="var(--signal)" />
      <path
        d="M33 28V70H57"
        stroke="var(--ink-0)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle className="lv-mark-dot" cx="72" cy="70" r="6.5" fill="var(--ink-0)" />
    </svg>
  );
}

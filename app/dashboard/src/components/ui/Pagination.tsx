/** Page numbers to show: both ends and the current page's neighbours, with a gap wherever pages are skipped. */
export function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - 1, total - 3));
  const end = Math.min(total - 1, Math.max(current + 1, 4));
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return [1, ...(start > 2 ? (["gap"] as const) : []), ...middle, ...(end < total - 1 ? (["gap"] as const) : []), total];
}

const CELL = "grid h-9 min-w-9 place-items-center rounded-btn px-2 text-[14px] tabular-nums transition-colors duration-150";
const ARROW = `${CELL} text-text-2 enabled:hover:bg-ink-2 enabled:hover:text-text-1 disabled:text-text-3 disabled:opacity-50`;

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" className={flip ? "rotate-180" : ""}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <p className="text-[13px] tabular-nums text-text-3">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onChange(page - 1)} className={ARROW}>
          <Chevron />
        </button>
        {pageNumbers(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className={`${CELL} text-text-3`}>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => onChange(n)}
              className={`${CELL} ${n === page ? "bg-ink-3 text-text-1" : "text-text-2 hover:bg-ink-2 hover:text-text-1"}`}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" aria-label="Next page" disabled={page === pages} onClick={() => onChange(page + 1)} className={ARROW}>
          <Chevron flip />
        </button>
      </div>
    </nav>
  );
}

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Rows this choice would show, so an empty choice can be seen before picking it. */
  count?: number;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** The value that means "not filtering": the control stays quiet while it is selected. */
  neutralValue?: T;
  align?: "left" | "right";
  className?: string;
}

/** A listbox in the app's own style, following the ARIA select-only combobox keys. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  neutralValue,
  align = "left",
  className = "",
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const baseId = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const applied = neutralValue !== undefined && value !== neutralValue;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function openList() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, options.length - 1),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: options.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1) {
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match >= 0) setActive(match);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${baseId}-list`}
        aria-activedescendant={open ? `${baseId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-btn border bg-ink-1 px-3 text-[14px] transition-colors duration-150 hover:bg-ink-2 ${
          open || applied ? "border-line-2 text-text-1" : "border-line text-text-2"
        }`}
      >
        <span className="whitespace-nowrap">
          {applied ? options[selectedIndex].label : label}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-text-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={`${baseId}-list`}
          role="listbox"
          aria-label={label}
          className={`lv-pop absolute top-[calc(100%+6px)] z-30 flex min-w-full flex-col gap-0.5 rounded-card border border-line-2 bg-ink-2 p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] sm:min-w-[200px] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((option, i) => {
            const selected = i === selectedIndex;
            return (
              <li
                key={option.value}
                id={`${baseId}-${i}`}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex h-9 cursor-pointer items-center gap-3 rounded-[8px] px-2.5 text-[14px] ${
                  i === active ? "bg-ink-3" : ""
                } ${selected ? "text-text-1" : "text-text-2"}`}
              >
                <span className="flex-1 whitespace-nowrap">{option.label}</span>
                {option.count !== undefined && <span className="tabular-nums text-[13px] text-text-3">{option.count}</span>}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={selected ? "text-signal" : "invisible"}>
                  <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

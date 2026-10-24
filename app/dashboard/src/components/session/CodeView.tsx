import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { formatTime } from "../../lib/format";
import type { CodeSnapshot } from "../../types";

export function CodeView({ snapshots }: { snapshots: CodeSnapshot[] }) {
  const [copied, setCopied] = useState(false);
  const last = snapshots[snapshots.length - 1];

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!last) {
    return (
      <EmptyState title="No code captured">
        Code is saved when the interview reaches the walkthrough. This interview ended before that point.
      </EmptyState>
    );
  }

  const lines = last.code.replace(/\r\n/g, "\n").split("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(last.code);
      setCopied(true);
    } catch {
      // Clipboard can be blocked in some contexts; the code stays selectable below.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Chip>{last.language}</Chip>
          <span className="font-mono text-[12px] text-text-2">Captured {formatTime(last.captured_at)}</span>
          {snapshots.length > 1 && (
            <span className="font-mono text-[12px] text-text-2">Showing the final of {snapshots.length} snapshots</span>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={copy} aria-live="polite">
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      <div className="overflow-auto rounded-card border border-line bg-ink-0">
        <div className="min-w-max py-4 font-mono text-[13px] leading-6">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-12 shrink-0 select-none pr-4 text-right text-text-3">{i + 1}</span>
              <span className="whitespace-pre pr-6 text-text-1">{line || " "}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

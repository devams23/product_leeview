import type { ReactNode } from "react";
import { type Difficulty } from "../../types";

export type ChipTone = "neutral" | "signal" | "ai" | "ok" | "warn" | "danger";

const tones: Record<ChipTone, string> = {
  neutral: "bg-ink-3 text-text-2 border-line",
  signal: "bg-signal-soft text-signal border-signal/20",
  ai: "bg-ai-soft text-ai border-ai/20",
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Chip({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 font-mono text-[11px] leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const difficultyTone: Record<Difficulty, ChipTone> = {
  Easy: "ok",
  Medium: "warn",
  Hard: "danger",
};

export function DifficultyChip({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const tone = difficultyTone[value as Difficulty] ?? "neutral";
  return <Chip tone={tone}>{value}</Chip>;
}

const statusMeta: Record<string, { label: string; tone: ChipTone }> = {
  COMPLETED: { label: "Completed", tone: "ok" },
  INTERRUPTED: { label: "Interrupted", tone: "warn" },
  ACTIVE: { label: "In progress", tone: "signal" },
  PREPARING: { label: "Not started", tone: "neutral" },
};

export function StatusChip({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status.toLowerCase(), tone: "neutral" as ChipTone };
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}

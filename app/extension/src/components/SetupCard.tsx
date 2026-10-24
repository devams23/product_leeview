import { MicIcon } from "./Icons";

interface SetupCardProps {
  phase: "PREFLIGHT" | "CONNECTING";
}

/** Shown while the mic permission is pending (PREFLIGHT) and while the session connects. */
export function SetupCard({ phase }: SetupCardProps) {
  if (phase === "PREFLIGHT") {
    return (
      <div className="lv-stack lv-center">
        <span className="lv-card-icon" aria-hidden="true">
          <MicIcon />
        </span>
        <p className="lv-title" role="status">Allow microphone access to begin</p>
        <p className="lv-muted">Choose Allow in the browser prompt to continue.</p>
      </div>
    );
  }

  return (
    <div className="lv-stack">
      <span className="lv-eyebrow">Connecting</span>
      <p className="lv-status-line" role="status">Setting up your interviewer…</p>
      <div className="lv-skeleton" aria-hidden="true" />
      <div className="lv-skeleton lv-skeleton--short" aria-hidden="true" />
      <div className="lv-skeleton lv-skeleton--tall" aria-hidden="true" />
    </div>
  );
}

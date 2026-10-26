import { useEffect, useState } from "react";
import type { Phase, Stage } from "../types";
import { formatClock } from "./format";
import { MicIcon, MicOffIcon, StopIcon } from "./Icons";
import { STAGE_LABELS, stageIndex } from "./stages";
import { VoiceOrb, type OrbMode } from "./VoiceOrb";

const CONFIRM_MS = 4000;

interface LiveCardProps {
  phase: Phase;
  stage: Stage | null;
  elapsedSeconds: number;
  voiceLevel: number;
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
}

interface StatusInfo {
  text: string;
  className: string;
}

function orbModeFor(phase: Phase, muted: boolean): OrbMode {
  if (phase === "AI_SPEAKING") return "ai";
  if (phase === "THINKING") return "thinking";
  return muted ? "muted" : "listening";
}

function statusFor(phase: Phase, muted: boolean): StatusInfo {
  if (phase === "AI_SPEAKING") return { text: "Interviewer speaking", className: "lv-status lv-status--ai" };
  if (phase === "THINKING") return { text: "Thinking…", className: "lv-status lv-status--think" };
  if (muted) return { text: "Muted", className: "lv-status lv-status--muted" };
  return { text: "Your turn", className: "lv-status lv-status--you" };
}

/** Live interview: the voice orb, who is talking, where we are, and two controls. */
export function LiveCard({ phase, stage, elapsedSeconds, voiceLevel, muted, onToggleMute, onEnd }: LiveCardProps) {
  // Only mounted while live, so the confirm state never outlives the live session.
  const [confirming, setConfirming] = useState(false);

  // The End confirmation reverts on its own after a few seconds, and Esc cancels it.
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [confirming]);

  const status = statusFor(phase, muted);
  const current = stageIndex(stage);

  return (
    <div className="lv-live">
      <VoiceOrb mode={orbModeFor(phase, muted)} level={voiceLevel} />

      <div className="lv-live-meta">
        <p className={status.className} aria-live="polite">{status.text}</p>
        <p className="lv-live-sub">
          {STAGE_LABELS[current]} · {current + 1}/{STAGE_LABELS.length}
          <span className="lv-live-sep" aria-hidden="true">·</span>
          <span className="lv-timer">{formatClock(elapsedSeconds)}</span>
        </p>
      </div>

      <div className="lv-controls">
        <button
          type="button"
          className="lv-icon-btn lv-icon-btn--mute"
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone (M)" : "Mute microphone (M)"}
          title={muted ? "Unmute (M)" : "Mute (M)"}
          onClick={onToggleMute}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>

        {confirming ? (
          <button
            type="button"
            className="lv-btn lv-btn--confirm lv-btn--sm"
            onClick={onEnd}
            aria-label="Confirm: end interview and get debrief"
          >
            End &amp; get debrief
          </button>
        ) : (
          <button
            type="button"
            className="lv-btn lv-btn--danger lv-btn--sm"
            onClick={() => setConfirming(true)}
            aria-label="End interview"
          >
            <StopIcon />
            End
          </button>
        )}
      </div>
    </div>
  );
}

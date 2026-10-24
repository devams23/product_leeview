import { useEffect, useState } from "react";
import type { Caption, Phase, Stage } from "../types";
import { CaptionStrip } from "./CaptionStrip";
import { formatClock } from "./format";
import { MicIcon, MicOffIcon, StopIcon } from "./Icons";
import { StageStepper } from "./StageStepper";
import { VoiceVisualizer, type VisualMode } from "./VoiceVisualizer";

const CONFIRM_MS = 4000;

interface LiveCardProps {
  phase: Phase;
  stage: Stage | null;
  elapsedSeconds: number;
  micLevel: number;
  muted: boolean;
  onToggleMute: () => void;
  aiCaption: Caption | null;
  userCaption: Caption | null;
  onEnd: () => void;
}

interface StatusInfo {
  text: string;
  className: string;
}

function visualModeFor(phase: Phase, muted: boolean): VisualMode {
  if (phase === "AI_SPEAKING") return "ai";
  if (phase === "THINKING") return "thinking";
  return muted ? "muted" : "listening";
}

function statusFor(phase: Phase, muted: boolean): StatusInfo {
  if (phase === "AI_SPEAKING") return { text: "Interviewer speaking", className: "lv-status lv-status--ai" };
  if (phase === "THINKING") return { text: "Thinking…", className: "lv-status" };
  if (muted) return { text: "Muted", className: "lv-status lv-status--muted" };
  return { text: "Your turn — speak", className: "lv-status lv-status--you" };
}

/** Live interview: stage, visualiser, status, optional captions, and controls. */
export function LiveCard({
  phase, stage, elapsedSeconds, micLevel, muted, onToggleMute, aiCaption, userCaption, onEnd,
}: LiveCardProps) {
  // Only mounted while live, so the confirm state never outlives the live session.
  const [captionsOn, setCaptionsOn] = useState(false);
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

  const mode = visualModeFor(phase, muted);
  const status = statusFor(phase, muted);

  return (
    <div className="lv-stack">
      <div className="lv-live-top">
        <span className="lv-rec">
          <span className={muted ? "lv-rec-dot lv-rec-dot--off" : "lv-rec-dot"} aria-hidden="true" />
          Live
        </span>
        <span className="lv-timer">{formatClock(elapsedSeconds)}</span>
      </div>

      <StageStepper stage={stage} />

      <VoiceVisualizer mode={mode} level={micLevel} />

      <p className={status.className} aria-live="polite">{status.text}</p>

      <CaptionStrip visible={captionsOn} aiCaption={aiCaption} userCaption={userCaption} />

      <div className="lv-controls">
        <button
          type="button"
          className="lv-btn lv-btn--ghost lv-btn--end lv-btn--mute"
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          title={muted ? "Unmute (M)" : "Mute (M)"}
          onClick={onToggleMute}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
          {muted ? "Unmute" : "Mute"}
          <kbd className="lv-kbd">M</kbd>
        </button>

        <button
          type="button"
          className="lv-cc-btn"
          aria-pressed={captionsOn}
          aria-label={captionsOn ? "Hide captions" : "Show captions"}
          title="Captions"
          onClick={() => setCaptionsOn((on) => !on)}
        >
          CC
        </button>

        {confirming ? (
          <button
            type="button"
            className="lv-btn lv-btn--confirm lv-btn--end lv-controls-end"
            onClick={onEnd}
            aria-label="Confirm: end interview and get debrief"
          >
            End &amp; get debrief?
          </button>
        ) : (
          <button
            type="button"
            className="lv-btn lv-btn--danger lv-btn--end lv-controls-end"
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

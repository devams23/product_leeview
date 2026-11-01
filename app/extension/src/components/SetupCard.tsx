import { MicIcon } from "./Icons";
import { VoiceOrb } from "./VoiceOrb";

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
        <p className="lv-title" role="status">Allow microphone access</p>
      </div>
    );
  }

  return (
    <div className="lv-live">
      <VoiceOrb mode="thinking" level={0} />
      <p className="lv-status lv-status--think" role="status">Connecting</p>
    </div>
  );
}

import { VoiceOrb } from "./VoiceOrb";

/** Shown between ending the interview and the debrief arriving. */
export function GeneratingCard() {
  return (
    <div className="lv-live">
      <VoiceOrb mode="thinking" level={0} />
      <p className="lv-status lv-status--think" role="status">Scoring your interview</p>
    </div>
  );
}

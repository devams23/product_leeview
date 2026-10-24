import type { Caption } from "../types";

interface CaptionStripProps {
  visible: boolean;
  aiCaption: Caption | null;
  userCaption: Caption | null;
}

/** Optional transcript strip (CC). Off by default: the interview is voice-first. */
export function CaptionStrip({ visible, aiCaption, userCaption }: CaptionStripProps) {
  if (!visible) return null;

  const hasAny = Boolean(aiCaption?.text || userCaption?.text);
  return (
    <div className="lv-captions" aria-label="Captions">
      {aiCaption?.text ? (
        <div className="lv-caption">
          <span className="lv-caption-who lv-caption-who--ai">Interviewer</span>
          <p className="lv-caption-text">{aiCaption.text}</p>
        </div>
      ) : null}
      {userCaption?.text ? (
        <div className="lv-caption">
          <span className="lv-caption-who lv-caption-who--you">You</span>
          <p className={userCaption.final ? "lv-caption-text" : "lv-caption-text lv-caption-text--interim"}>
            {userCaption.text}
          </p>
        </div>
      ) : null}
      {hasAny ? null : <p className="lv-caption-text lv-caption-text--interim">Captions appear here as you talk.</p>}
    </div>
  );
}

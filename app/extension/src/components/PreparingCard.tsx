interface PreparingCardProps {
  onCancel: () => void;
}

/** Shown after the socket opens, until the interviewer's opening audio starts. The mic stays off. */
export function PreparingCard({ onCancel }: PreparingCardProps) {
  return (
    <div className="lv-stack lv-center">
      <span className="lv-breathe" aria-hidden="true" />
      <p className="lv-title" role="status">Take a breath</p>
      <p className="lv-muted">
        Settle in. Your interviewer will open the conversation — just listen, then reply when it's your turn.
      </p>
      <p className="lv-live-sub">Your mic stays off until then.</p>
      <button type="button" className="lv-btn lv-btn--quiet lv-btn--sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

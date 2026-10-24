import { UserIcon } from "./Icons";

interface SignedOutCardProps {
  expired: boolean;
  onSignIn: () => void;
}

/** Signed out, or session expired. Sign-in happens on the dashboard, so this only opens it. */
export function SignedOutCard({ expired, onSignIn }: SignedOutCardProps) {
  return (
    <div className="lv-stack lv-center">
      <span className="lv-card-icon" aria-hidden="true">
        <UserIcon />
      </span>
      <p className="lv-title">
        {expired ? "Your session expired" : "Sign in to start practicing"}
      </p>
      <p className="lv-muted">
        {expired
          ? "Reconnect your account in one click."
          : "Your interviews and debriefs are saved to your dashboard."}
      </p>
      <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onSignIn}>
        Sign in
      </button>
      <p className="lv-meta">Opens your LeeView dashboard</p>
    </div>
  );
}

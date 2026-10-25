import { useEffect, useState } from "react";

/** How long a silent reconnect may run before the plain "Sign in" button takes over. */
const RECONNECT_TIMEOUT_MS = 12_000;

export type ReconnectPhase = "idle" | "reconnecting" | "stalled";

interface SignedOutCardProps {
  expired: boolean;
  onSignIn: () => void;
  onReconnect: () => void;
  /** Starting phase; only the gallery harness needs anything but "idle". */
  initialPhase?: ReconnectPhase;
}

/** Signed out, or session expired. Expired sessions try a silent reconnect first; sign-in opens the dashboard. */
export function SignedOutCard({ expired, onSignIn, onReconnect, initialPhase = "idle" }: SignedOutCardProps) {
  const [phase, setPhase] = useState<ReconnectPhase>(initialPhase);

  useEffect(() => {
    if (phase !== "reconnecting") return;
    const id = window.setTimeout(() => setPhase("stalled"), RECONNECT_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (!expired) {
    return (
      <div className="lv-stack">
        <p className="lv-title">Sign in to start practicing</p>
        <p className="lv-muted">Your interviews and debriefs save to your dashboard.</p>
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onSignIn}>
          Sign in
        </button>
        <p className="lv-meta">You'll come right back here after.</p>
      </div>
    );
  }

  if (phase === "reconnecting") {
    return (
      <div className="lv-stack">
        <p className="lv-title">Your session expired</p>
        <p className="lv-muted" role="status">Reconnecting in the background.</p>
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" disabled aria-busy="true">
          <span className="lv-spinner" aria-hidden="true" />
          Reconnecting…
        </button>
      </div>
    );
  }

  if (phase === "stalled") {
    return (
      <div className="lv-stack">
        <p className="lv-title">Your session expired</p>
        <p className="lv-muted">Sign in again to keep practicing.</p>
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onSignIn}>
          Sign in
        </button>
        <p className="lv-meta">Opens your LeeView dashboard</p>
      </div>
    );
  }

  return (
    <div className="lv-stack">
      <p className="lv-title">Your session expired</p>
      <p className="lv-muted">Reconnect your account in one click.</p>
      <button
        type="button"
        className="lv-btn lv-btn--primary lv-btn--block"
        onClick={() => {
          setPhase("reconnecting");
          onReconnect();
        }}
      >
        Reconnect
      </button>
    </div>
  );
}

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
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    );
  }

  if (phase === "reconnecting") {
    return (
      <div className="lv-stack">
        <p className="lv-title">Your session expired</p>
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
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="lv-stack">
      <p className="lv-title">Your session expired</p>
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

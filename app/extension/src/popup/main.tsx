import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
// Latin subsets only, declared as @font-face so the popup bundle stays small.
import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2";
import instrumentSansLatin from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./popup.css";
import { BACKEND_URL } from "../config";
import { decodeJwtExp } from "../utils/jwt";

const fontStyle = document.createElement("style");
fontStyle.textContent = [
  `@font-face{font-family:'Bricolage Grotesque Variable';font-style:normal;font-display:swap;font-weight:200 800;src:url(${bricolageLatin}) format('woff2');}`,
  `@font-face{font-family:'Instrument Sans Variable';font-style:normal;font-display:swap;font-weight:400 700;src:url(${instrumentSansLatin}) format('woff2');}`,
].join("\n");
document.head.appendChild(fontStyle);

const AUTH_KEYS = ["user", "userId", "token"] as const;

type AuthView =
  | { status: "loading" }
  | { status: "signed_out"; expired: boolean }
  | { status: "signed_in"; email: string | null };

type Health = "checking" | "online" | "offline";

interface StoredAuth {
  user?: { email?: string } | null;
  userId?: string | null;
  token?: string | null;
}

function toView(stored: StoredAuth): AuthView {
  const token = stored.token || null;
  const userId = stored.userId || null;
  if (!token || !userId) return { status: "signed_out", expired: false };
  const exp = decodeJwtExp(token);
  if (exp !== null && exp * 1000 < Date.now()) return { status: "signed_out", expired: true };
  return { status: "signed_in", email: stored.user?.email ?? null };
}

/** Opens a dashboard page through the background worker, which owns tab handling. */
function openDashboardPath(path: string) {
  try {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD", path });
  } catch {
    // Extension context invalidated; nothing to do.
  }
}

function useStoredAuth(): [AuthView, () => void] {
  const [view, setView] = useState<AuthView>({ status: "loading" });

  const refresh = () => {
    try {
      chrome.storage.local.get([...AUTH_KEYS], (res) => {
        setView(toView((res ?? {}) as StoredAuth));
      });
    } catch {
      setView({ status: "signed_out", expired: false });
    }
  };

  useEffect(() => {
    refresh();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && AUTH_KEYS.some((k) => k in changes)) refresh();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
    // refresh only reads chrome.storage and calls the state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [view, refresh];
}

function useBackendHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND_URL}/health`)
      .then((res) => {
        if (alive) setHealth(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (alive) setHealth("offline");
      });
    return () => {
      alive = false;
    };
  }, []);

  return health;
}

function SignedOut({ expired }: { expired: boolean }) {
  return (
    <section className="pop-card">
      <h1 className="pop-display">
        {expired ? "Your session expired." : "Practice the interview, not just the problem."}
      </h1>
      <p className="pop-muted">
        {expired
          ? "Reconnect in one click to keep practicing."
          : "Talk through any LeetCode problem with an AI interviewer, then get a scored debrief."}
      </p>
      <button
        type="button"
        className="pop-btn pop-btn--primary"
        onClick={() => openDashboardPath("/login?from=extension")}
      >
        Sign in
      </button>
      <p className="pop-hint">Open any LeetCode problem to start.</p>
    </section>
  );
}

function SignedIn({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <section className="pop-card">
      <span className="pop-eyebrow">Signed in as</span>
      <p className="pop-email">{email ?? "Signed in"}</p>
      <p className="pop-hint">Open a LeetCode problem to start an interview.</p>
      <div className="pop-actions">
        <button type="button" className="pop-btn pop-btn--primary" onClick={() => openDashboardPath("/dashboard")}>
          Open dashboard
        </button>
        <button type="button" className="pop-btn pop-btn--ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}

const HEALTH_LABEL: Record<Health, string> = {
  checking: "Checking",
  online: "Online",
  offline: "Offline",
};

function Popup() {
  const [auth] = useStoredAuth();
  const health = useBackendHealth();

  const signOut = () => {
    try {
      chrome.storage.local.remove([...AUTH_KEYS]);
    } catch {
      // storage unavailable; nothing to clear
    }
  };

  return (
    <main className="pop">
      <header className="pop-head">
        <div className="pop-brand">
          <span className="pop-mark" aria-hidden="true" />
          <span className="pop-wordmark">LeeView</span>
        </div>
        <span className={`pop-status pop-status--${health}`} role="status">
          <span className="pop-status-dot" aria-hidden="true" />
          {HEALTH_LABEL[health]}
        </span>
      </header>

      {auth.status === "loading" ? null : auth.status === "signed_in" ? (
        <SignedIn email={auth.email} onSignOut={signOut} />
      ) : (
        <SignedOut expired={auth.expired} />
      )}
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);

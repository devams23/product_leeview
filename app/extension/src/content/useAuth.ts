import { useCallback, useEffect, useState } from "react";
import type { AuthState, AuthStatus } from "../types";

// Treat tokens expiring within this window as already expired.
const EXPIRY_MARGIN_MS = 30_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

const SIGNED_OUT: AuthState = { status: "signed_out", email: null, userId: null, token: null };

interface StoredAuth {
  user?: { email?: string } | null;
  userId?: string | null;
  token?: string | null;
}

/** Returns the JWT `exp` claim in seconds, or null if it cannot be decoded. */
export function decodeJwtExp(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function useAuth(): AuthState & { openSignIn(): void } {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    email: null,
    userId: null,
    token: null,
  });

  useEffect(() => {
    let alive = true;
    let expiryTimer: number | undefined;

    const refresh = () => {
      try {
        chrome.runtime.sendMessage({ type: "GET_AUTH" }, (result: StoredAuth | undefined) => {
          apply(chrome.runtime.lastError ? undefined : result);
        });
      } catch {
        // Extension context invalidated (e.g. extension reloaded) — treat as signed out.
        apply(undefined);
      }
    };

    const apply = (stored: StoredAuth | undefined) => {
      if (!alive) return;
      window.clearTimeout(expiryTimer);

      const token = stored?.token || null;
      const userId = stored?.userId || null;
      if (!token || !userId) {
        setState(SIGNED_OUT);
        return;
      }

      const email = stored?.user?.email || null;
      const exp = decodeJwtExp(token);
      const expired = exp !== null && exp * 1000 < Date.now() + EXPIRY_MARGIN_MS;
      const status: AuthStatus = expired ? "expired" : "signed_in";
      setState({ status, email, userId, token });

      if (exp !== null && !expired) {
        const delay = Math.min(exp * 1000 - EXPIRY_MARGIN_MS - Date.now(), MAX_TIMEOUT_MS);
        expiryTimer = window.setTimeout(refresh, Math.max(delay, 0));
      }
    };

    const onChanged = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== "local") return;
      if ("user" in changes || "userId" in changes || "token" in changes) refresh();
    };

    refresh();
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      alive = false;
      window.clearTimeout(expiryTimer);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const openSignIn = useCallback(() => {
    try {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD", path: "/login" });
    } catch {
      // Extension context invalidated; nothing to do.
    }
  }, []);

  return { ...state, openSignIn };
}

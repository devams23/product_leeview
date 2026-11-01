import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

interface AuthValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * getSession only reads local storage, so an account deleted on the server still looks signed in here and
 * keeps handing the extension a dead token. Ask the server, and only drop the session on a definite rejection.
 */
async function dropSessionIfAccountIsGone() {
  const { error } = await supabase.auth.getUser();
  if (error?.status && [401, 403, 404].includes(error.status)) {
    await supabase.auth.signOut({ scope: "local" });
  }
}

/** Tells the extension bridge (content script) that the session may have changed. Carries no tokens. */
function pingExtension() {
  window.postMessage({ source: "leeview-dashboard", type: "AUTH_CHANGED" }, window.location.origin);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
        pingExtension();
        if (data.session) void dropSessionIfAccountIsGone();
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      pingExtension();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, authError, signInWithGoogle, signOut }),
    [user, loading, authError, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

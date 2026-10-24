// Injected on http://localhost:5173/* to read Supabase session from localStorage
// and relay it to the extension's background script.

function readSupabaseSession(): { id: string; email: string; token: string } | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const user = parsed?.user;
        if (user?.id) {
          return { id: user.id, email: user.email || "", token: parsed.access_token };
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function sendAuthToBackground() {
  const session = readSupabaseSession();
  try {
    chrome.runtime.sendMessage(
      { type: "AUTH_STATE", user: session },
      () => {} // ignore response
    );
  } catch {
    // Extension context invalidated (extension reloaded while this page stayed open).
  }
}

// Lets the dashboard detect that the extension is installed.
document.documentElement.dataset.leeviewExtension = "installed";

// Send on load
sendAuthToBackground();

// Listen for localStorage changes (catches login/logout)
window.addEventListener("storage", (event) => {
  if (event.key?.startsWith("sb-") && event.key?.endsWith("-auth-token")) {
    sendAuthToBackground();
  }
});

// The dashboard posts this after every Supabase auth event (sign-in, token refresh, sign-out).
window.addEventListener("message", (event) => {
  if (event.source === window && event.data?.source === "leeview-dashboard" && event.data.type === "AUTH_CHANGED") {
    sendAuthToBackground();
  }
});

// Same-tab OAuth redirects and background token refreshes don't fire `storage`, so re-check on focus and periodically.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sendAuthToBackground();
});

window.setInterval(() => {
  if (document.visibilityState === "visible") sendAuthToBackground();
}, 60_000);

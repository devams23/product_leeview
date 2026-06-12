// Injected on http://localhost:5173/* to read Supabase session from localStorage
// and relay it to the extension's background script.

function readSupabaseSession(): { id: string; email: string } | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const user = parsed?.user;
        if (user?.id) {
          return { id: user.id, email: user.email || "" };
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
  chrome.runtime.sendMessage(
    { type: "AUTH_STATE", user: session },
    () => {} // ignore response
  );
}

// Send on load
sendAuthToBackground();

// Listen for localStorage changes (catches login/logout)
window.addEventListener("storage", (event) => {
  if (event.key?.startsWith("sb-") && event.key?.endsWith("-auth-token")) {
    sendAuthToBackground();
  }
});

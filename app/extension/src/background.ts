import { DASHBOARD_URL } from "./config";
import { decodeJwtExp } from "./utils/jwt";

// Session-scoped journey state. Cleared when the browser session ends.
const PENDING_SIGN_IN_KEY = "pendingSignIn";
const SILENT_RECONNECT_KEY = "silentReconnect";

/** A login tab opened from an overlay; when it signs in, the overlay's tab is brought back. */
interface PendingSignIn { loginTabId: number; returnTabId: number }
/** A hidden dashboard tab that tries to refresh the session on the user's behalf. */
interface SilentReconnect { silentTabId: number; returnTabId: number; startedAt: number }

interface AuthUser { id: string; email?: string; token?: string }

async function readSession<T>(key: string): Promise<T | undefined> {
  try {
    const res = await chrome.storage.session.get(key);
    return res[key] as T | undefined;
  } catch {
    return undefined;
  }
}

async function writeSession(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: value });
  } catch {
    // Session storage unavailable; the journey falls back to the plain behaviour.
  }
}

async function clearSession(key: string): Promise<void> {
  try {
    await chrome.storage.session.remove(key);
  } catch {
    // Nothing to clear.
  }
}

/** Brings a tab and its window to the front. The tab may have been closed meanwhile. */
async function focusTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // Tab or window is gone.
  }
}

async function removeTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // Already closed.
  }
}

function isLiveToken(token: string | undefined): boolean {
  if (!token) return false;
  const exp = decodeJwtExp(token);
  return exp === null || exp * 1000 > Date.now();
}

/** Decides what the auth report from a dashboard tab means for the journey tabs it belongs to. */
async function settleJourney(user: AuthUser | null, tabId: number): Promise<void> {
  const silent = await readSession<SilentReconnect>(SILENT_RECONNECT_KEY);
  if (silent && tabId === silent.silentTabId) {
    if (user && isLiveToken(user.token)) {
      await clearSession(SILENT_RECONNECT_KEY);
      await removeTab(tabId);
      return;
    }
    // An expired token is not success yet: the dashboard may still be refreshing it.
    if (!user) {
      await clearSession(SILENT_RECONNECT_KEY);
      await focusTab(tabId);
      await writeSession(PENDING_SIGN_IN_KEY, { loginTabId: tabId, returnTabId: silent.returnTabId } satisfies PendingSignIn);
    }
    return;
  }

  const pending = await readSession<PendingSignIn>(PENDING_SIGN_IN_KEY);
  if (pending && tabId === pending.loginTabId && user) {
    await clearSession(PENDING_SIGN_IN_KEY);
    await focusTab(pending.returnTabId);
  }
}

// Listen for auth state from the dashboard content script and answer overlay requests.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_STATE") {
    if (message.user) {
      chrome.storage.local.set({ user: message.user, userId: message.user.id, token: message.user.token });
    } else {
      chrome.storage.local.remove(["user", "userId", "token"]);
    }
    if (sender.tab?.id !== undefined) void settleJourney(message.user ?? null, sender.tab.id);
  }
  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["user", "userId", "token"], (result) => {
      sendResponse(result);
    });
    return true; // keep channel open for async response
  }
  if (message.type === "OPEN_DASHBOARD") {
    const path = typeof message.path === "string" && message.path.startsWith("/") ? message.path : "/";
    const url = `${DASHBOARD_URL}${path}`;
    const senderTabId = sender.tab?.id;

    if (message.silent && senderTabId !== undefined) {
      chrome.tabs.create({ url, active: false }).then((tab) => {
        if (tab.id === undefined) return;
        const reconnect: SilentReconnect = { silentTabId: tab.id, returnTabId: senderTabId, startedAt: Date.now() };
        return writeSession(SILENT_RECONNECT_KEY, reconnect);
      }).catch(() => {});
    } else if (message.returnToSender && senderTabId !== undefined) {
      // A stalled silent reconnect would otherwise leave its hidden tab behind.
      void readSession<SilentReconnect>(SILENT_RECONNECT_KEY).then((stale) => {
        if (!stale) return;
        void clearSession(SILENT_RECONNECT_KEY);
        void removeTab(stale.silentTabId);
      });
      chrome.tabs.create({ url, active: true }).then((tab) => {
        if (tab.id === undefined) return;
        const pending: PendingSignIn = { loginTabId: tab.id, returnTabId: senderTabId };
        return writeSession(PENDING_SIGN_IN_KEY, pending);
      }).catch(() => {});
    } else {
      chrome.tabs.create({ url }).catch(() => {});
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // console.log("LeeView extension installed.");
});

/** Asks the background worker to open a dashboard page in a new tab. */
export function openDashboard(path: string): void {
  try {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD", path });
  } catch {
    // Extension context invalidated (extension reloaded); nothing to do.
  }
}

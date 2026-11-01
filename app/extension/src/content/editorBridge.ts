// Runs in LeetCode's own page world, because content scripts can't see window.monaco.
// Answers the content script with the code currently in the editor.

import { EDITOR_BRIDGE_SOURCE, readMonacoCode, type MonacoLike } from "../utils/editorCode";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== EDITOR_BRIDGE_SOURCE || event.data.type !== "READ") return;

  let snapshot = null;
  try {
    snapshot = readMonacoCode((window as unknown as { monaco?: MonacoLike }).monaco);
  } catch {
    // Monaco's internals aren't ours; the content script falls back on a null answer.
  }
  window.postMessage({ source: EDITOR_BRIDGE_SOURCE, type: "CODE", id: event.data.id, snapshot }, window.location.origin);
});

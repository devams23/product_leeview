// Listen for auth state from the dashboard content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTH_STATE") {
    if (message.user) {
      chrome.storage.local.set({ user: message.user, userId: message.user.id });
    } else {
      chrome.storage.local.remove(["user", "userId"]);
    }
  }
  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["user", "userId"], (result) => {
      sendResponse(result);
    });
    return true; // keep channel open for async response
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("LeeView extension installed.");
});

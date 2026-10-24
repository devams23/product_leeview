import { useEffect, useState } from "react";

/** True when the LeeView extension has marked the page (authBridge sets this attribute on load). */
function isInstalled() {
  return document.documentElement.dataset.leeviewExtension === "installed";
}

export function useExtensionInstalled(): boolean {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    // The content script may inject after first paint, so check once more.
    const timer = window.setTimeout(() => setInstalled(isInstalled()), 500);
    return () => window.clearTimeout(timer);
  }, []);

  return installed;
}

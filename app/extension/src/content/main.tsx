import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import overlayCss from "../styles/overlay.css?inline";
// Fonts must be declared at document level, so their @font-face CSS is injected into <head>.
// Latin subsets only: the full subset CSS inlines every script and bloats content.js.
import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2";
import instrumentSansLatin from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2";
import mono400Latin from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2";
import mono500Latin from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2";

const FONTS = [
  { family: "Bricolage Grotesque Variable", src: bricolageLatin, weight: "200 800" },
  { family: "Instrument Sans Variable", src: instrumentSansLatin, weight: "400 700" },
  { family: "JetBrains Mono", src: mono400Latin, weight: "400" },
  { family: "JetBrains Mono", src: mono500Latin, weight: "500" },
];

const HOST_ID = "leeview-root";
const FONT_STYLE_ID = "leeview-fonts";

/** The build inlines fonts as data URIs; this turns one back into bytes. */
function dataUriToBytes(uri: string): ArrayBuffer | null {
  if (!uri.startsWith("data:")) return null;
  const binary = atob(uri.slice(uri.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function injectFonts() {
  if (document.getElementById(FONT_STYLE_ID)) return;

  // Fallback path: plain @font-face, which works unless the page's CSP blocks data: fonts.
  const style = document.createElement("style");
  style.id = FONT_STYLE_ID;
  style.textContent = FONTS.map(
    (f) => `@font-face{font-family:'${f.family}';font-style:normal;font-display:swap;font-weight:${f.weight};src:url(${f.src}) format('woff2');}`,
  ).join("\n");
  document.head.appendChild(style);

  // Byte-sourced faces are never fetched, so font-src CSP (LeetCode's included) cannot block them.
  for (const f of FONTS) {
    try {
      const bytes = dataUriToBytes(f.src);
      if (!bytes) continue;
      const face = new FontFace(f.family, bytes, { weight: f.weight, style: "normal", display: "swap" });
      document.fonts.add(face);
      void face.load().catch(() => {});
    } catch {
      // The @font-face fallback above still applies.
    }
  }
}

function mount() {
  // Guard against double injection (e.g. the script re-running in the same page).
  if (document.getElementById(HOST_ID)) return;

  injectFonts();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483000;";
  document.body.appendChild(host);

  // Open shadow root keeps LeetCode's CSS out of the overlay and vice versa.
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = overlayCss;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.setAttribute("data-lv-root", "");
  shadow.appendChild(container);

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

mount();

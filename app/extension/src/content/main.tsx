import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import overlayCss from "../styles/overlay.css?inline";
// Fonts must be declared at document level, so their @font-face CSS is injected into <head>.
// Latin subsets only: the full subset CSS inlines every script and bloats content.js.
import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2";
import instrumentSansLatin from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2";
import monoCss from "@fontsource/jetbrains-mono/latin-400.css?inline";
import mono500Css from "@fontsource/jetbrains-mono/latin-500.css?inline";

const displayCss = `@font-face{font-family:'Bricolage Grotesque Variable';font-style:normal;font-display:swap;font-weight:200 800;src:url(${bricolageLatin}) format('woff2');}`;
const sansCss = `@font-face{font-family:'Instrument Sans Variable';font-style:normal;font-display:swap;font-weight:400 700;src:url(${instrumentSansLatin}) format('woff2');}`;

const HOST_ID = "leeview-root";
const FONT_STYLE_ID = "leeview-fonts";

function injectFonts() {
  if (document.getElementById(FONT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FONT_STYLE_ID;
  style.textContent = [displayCss, sansCss, monoCss, mono500Css].join("\n");
  document.head.appendChild(style);
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

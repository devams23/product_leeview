# LeeView — Unified brand, new type, login redesign, smoother sign-in journey

Date: 2026-10-24. Follows the Studio redesign (2026-10 spec). Same tokens/colors; this changes **type, brand mark, shared components, login layout, and the extension↔dashboard sign-in journey**.

## Why
User feedback after the Studio pass:
1. Login page: the logo floats mid-page (no header; left column is vertically centered against a taller right column). On large screens the layout feels messy; the CTA row is loose.
2. Instrument Serif headline feels dated / "every site uses this". Want something unique, interesting, simple.
3. The extension feels like "another universe" vs the dashboard. A user must feel they're in one product.
4. Make the user journey smoother.

## Type system (decided)
| Role | Family | Package | Usage |
|---|---|---|---|
| Display | **Bricolage Grotesque** (variable, has `opsz` + `wght`) | `@fontsource-variable/bricolage-grotesque` | page titles, hero, wordmark, big score numerals, empty-state titles. Weight 600 for headings, 700 for wordmark; letter-spacing `-0.025em` at ≥32px, `-0.01em` below. `font-variation-settings: "opsz" 96` for ≥40px. |
| UI / body | **Instrument Sans** (variable) | `@fontsource-variable/instrument-sans` | all body/UI text. 400 body, 500 labels/buttons, 600 card titles. |
| Data | JetBrains Mono (unchanged) | `@fontsource/jetbrains-mono` | timers, scores "/10", codes, eyebrows. |

Remove Instrument Serif and Inter everywhere (deps, Google Fonts link, CSS). Fonts are bundled via fontsource (no Google Fonts CDN in the dashboard any more). Latin subset only in the extension.

CSS family names (must be identical in both apps):
- `--font-display: "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif;`
- `--font-sans: "Instrument Sans Variable", ui-sans-serif, system-ui, sans-serif;`
- `--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;`

## Brand mark (identical in both apps)
- **Mark**: 22×22px (dashboard header may use 28px) rounded square, radius 7px (9px at 28), background `#D4FF3F` (signal), containing a centered 8×8 (10×10 at 28) circle of `#0A0B0D`. When "live", the dot pulses (opacity).
- **Wordmark**: "LeeView", display font, weight 700, 16px (15px in extension header), letter-spacing `-0.02em`, color text-1.
- Gap between mark and wordmark: 8px. Mark and wordmark vertically centered (`align-items:center`, wordmark `line-height:1`).
- Replaces: dashboard dot-in-dark-tile (AppShell + Login), extension `.lv-signal-dot` + serif `.lv-wordmark` in header/launcher, popup brand.

## Shared component language (both apps must match)
- Buttons: height 40 (lg 48), radius 10, Instrument Sans 500 14px (extension 13px). Primary = signal bg / ink text, hover `#E2FF6E`. Ghost = ink-2 bg + inset 1px line-2. Same in dashboard `Button`.
- Eyebrow labels: JetBrains Mono 11px, uppercase, letter-spacing 0.08em, text-3.
- Stage stepper: **segmented bars** (5 equal segments, 3px tall, 4px gap, radius full; done+current = signal, rest = ink-3), caption below: current stage name in Instrument Sans 600 12px text-1 + mono "2 / 5" text-3. Extension LiveCard uses it; the Login example overlay uses the same visual.
- Big score numerals: display font 600, tabular-nums, signal (or tone color).
- Card: ink-1, 1px line border, radius 14 (extension shell 20).

## Login page (dashboard `/login`) — layout
Container `max-w-[1200px] mx-auto px-5 sm:px-8`.
1. **Header bar** (h-16, `flex items-center justify-between`, border-bottom line): brand mark+wordmark left; right: small text link "How it works" (anchors to #how) + ghost Button "Sign in" (same handler). Sticky not required.
2. **Hero** (`py-16 lg:py-24`, grid `lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center`; on lg the two columns have similar height so centering is visually correct):
   - Left: eyebrow chip "Voice mock interviews for LeetCode" (mono, signal-soft bg, signal text, pill). H1 display 600 `text-[44px] sm:text-[60px] lg:text-[68px] leading-[0.98] tracking-[-0.03em]`: "Practice the interview, not just the problem." with "the interview" in signal color. Subhead 17–18px text-2 max-w-[48ch], ≤2 sentences. CTA row: primary lg Button with Google "G" icon (inline SVG, monochrome ink) "Continue with Google"; beside it (sm+) a ghost lg Button "See how it works" → #how. Below CTA a single trust line in text-3 13px: "Free while in beta · Works on any LeetCode problem · No credit card".
   - Right: **one composed visual** — the overlay mock card (matches the real extension LiveCard: header with brand mark + "TWO SUM" meta, segmented stepper, AI bars, caption) with a smaller debrief card overlapping its lower-left corner (absolute, translate, rotate 0). Height capped (~440px) so the hero fits one desktop viewport. On < lg: stack, overlay card only (hide the overlapping debrief or put it below at full width).
3. **How it works** (`id="how"`, border-top line, py-16): eyebrow + h2 display 32px "Three steps, then you're talking." and a 3-column grid of bordered cells (`grid sm:grid-cols-3`, cells divided by 1px line, each cell p-6: mono "01" signal, title 16px 600, body 14px text-2). Step 1 "Add the extension" mentions pinning; step 2 "Open any problem"; step 3 "Talk it through".
4. **Footer**: border-top, py-8, text-3 13px: "© LeeView" left, "Built for interview prep" right.
- `authError` renders under the CTA row.
- Sign-in from extension: if URL has `?from=extension`, set `sessionStorage["lv:from-extension"]="1"` and show under the H1 eyebrow a small signal-soft note "Sign in to connect the LeeView extension." (so the user knows why they're here).

## Sign-in journey (contracts — both sides must match exactly)
Current problems: (a) the bridge only re-reads the Supabase session on page load / cross-tab `storage` event, so after the OAuth redirect in the same tab the extension may never learn about the session (and never learns of token refreshes); (b) after signing in, the user is stranded on the dashboard and must find their LeetCode tab; (c) access tokens expire hourly, so a returning user hits "Session expired" each day and must manually visit the dashboard; (d) the dashboard can't tell whether the extension is installed.

Fixes:
1. **Dashboard → bridge auth ping.** In dashboard `AuthProvider`, on every `onAuthStateChange` event (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, INITIAL_SESSION) call
   `window.postMessage({ source: "leeview-dashboard", type: "AUTH_CHANGED" }, window.location.origin)`.
   Extension `authBridge.ts` listens for `message` events where `event.source === window && event.data?.source === "leeview-dashboard" && event.data.type === "AUTH_CHANGED"` and re-sends auth to background. Also re-send on `visibilitychange` (visible) and every 60s while the page is visible. Never read/forward anything but `{id,email,token}` (unchanged).
2. **Extension-installed flag.** `authBridge.ts` sets `document.documentElement.dataset.leeviewExtension = "installed"` on load. Dashboard reads it via a hook `useExtensionInstalled()` (check attribute on mount and again after 500ms; return boolean). Overview empty-state "Do your first interview": if not installed, step 1 shows "Add the extension" with a primary-styled emphasis; if installed, step 1 shows a ✓ "Extension installed" (ok color) and the primary CTA is "Open Two Sum on LeetCode".
3. **Return to LeetCode after sign-in.** Extension content script `openSignIn` sends `{type:"OPEN_DASHBOARD", path:"/login?from=extension", returnToSender:true}`. Background: when `returnToSender` and `sender.tab?.id`, store `{returnTabId, loginTabId}` in `chrome.storage.session` key `pendingSignIn`. On `AUTH_STATE` with a non-null user coming from `sender.tab.id === loginTabId`: `chrome.tabs.update(returnTabId,{active:true})`, `chrome.windows.update(returnTab.windowId,{focused:true})`, then clear `pendingSignIn`. (Wrap in try/catch; tab may be closed.) Leave the dashboard tab open.
   Dashboard: if `sessionStorage["lv:from-extension"]==="1"` when the signed-in AppShell mounts, show a dismissible banner at top of main content (signal-soft bg, signal border/20, radius 10): "Extension connected. Your LeetCode tab is ready — start your interview there." + quiet "Dismiss"; clear the key on dismiss or after showing once.
4. **One-click silent reconnect when expired.** Extension: in the `expired` state the overlay CTA becomes "Reconnect" and sends `{type:"OPEN_DASHBOARD", path:"/dashboard", silent:true}`. Background: `chrome.tabs.create({url, active:false})`, store `silentTabId` in `chrome.storage.session` key `silentReconnect` with `startedAt`. On `AUTH_STATE` from `sender.tab.id === silentTabId`: if user non-null and token not expired → `chrome.tabs.remove(silentTabId)` and clear; if user null → `chrome.tabs.update(silentTabId,{active:true})` (user must sign in) and convert to a pendingSignIn with returnTabId = the overlay's tab. Fallback: `chrome.alarms` not needed — in the content overlay, if still expired 12s after clicking Reconnect, show the normal "Sign in" button that opens the login tab actively. While reconnecting the overlay shows a spinner state "Reconnecting…" (button disabled, label changes).
   Rationale: Supabase rotates refresh tokens with reuse detection, so the extension must NOT refresh tokens itself; letting the dashboard (which owns the refresh token) refresh is safe.
5. Popup: "Sign in" uses the same `OPEN_DASHBOARD` message with path `/login?from=extension` (no return tab). Popup header uses the new brand mark.

## Extension visual alignment
- Replace serif wordmark + dot in `OverlayShell` header and `Launcher` with the brand mark + display wordmark (launcher: mark only + "LeeView" 13px display 700; live state: mark dot pulses + mono timer).
- `--font-serif` removed; add `--font-display`. Any `font-family: var(--font-serif)` (debrief big score at overlay.css ~437, popup display) → `var(--font-display)` weight 600.
- StageStepper → segmented bars per the shared spec (keep component API & `stageIndex`).
- Card titles (`.lv-title`) Instrument Sans 600 15px; headings feel identical to dashboard card titles.
- Popup: same tokens, brand mark, display font for its headline (24px, 600, tracking -0.02em).
- Keep everything else (states, behaviour, keyboard M, a11y) unchanged.

## Non-goals
- No color/token changes. No new pages besides what's listed. No backend changes. No token refresh inside the extension.

## Verification
- `npm run build` + `npx tsc --noEmit` (extension) and `npm run build` (dashboard) pass.
- Visual harnesses (`app/dashboard/.shots`, `app/extension/.shots`) re-shot at desktop 1440 and mobile 390: login header aligned, hero fits viewport on 1440×900, no horizontal scroll at 390.

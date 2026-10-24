# LeeView UX Overhaul — Implementation Plan

Spec: `docs/superpowers/specs/2026-10-24-ux-overhaul-design.md` (read it fully first — tokens,
copy, states and protocol are defined there; this plan defines file ownership and contracts).

Execution: Wave 1 = T1, T2, T3 in parallel (disjoint files). Wave 2 = T4 (needs T2).
Agents do NOT commit; the coordinator reviews and commits. Never touch files owned by another task.

---

## T1 — Backend: startup, persistence, protocol, security  (owns `app/backend/**`, `supabase/migrations/006_ux_persistence.sql`)

1. `src/main.py`: import `Depends`, `Query` at top (remove late imports). `/sessions` must
   take user id from the verified token (`get_current_user` → `sub`), ignore/remove
   `user_id` from the request body (keep field optional for backward compat, unused).
   Return 502 with JSON `{"detail": "..."}` if session insert fails. CORS: read allowed
   origins from setting `CORS_ORIGINS` (comma-separated, default `*` for dev).
2. `src/auth.py`: call `load_dotenv()` before reading `SUPABASE_JWT_SECRET`. Add `PyJWT>=2.8`
   and `python-dotenv` to `pyproject.toml` dependencies. Add `SUPABASE_JWT_SECRET=` and
   `CORS_ORIGINS=` to `app/backend/.env.example`.
3. `src/services/supabase_client.py`: add `update_session(user_jwt, session_id, **fields)`.
   Every persistence helper used from the handler must be wrapped by a `_safe(fn, *a)` in the
   handler that logs and swallows exceptions.
4. `src/websocket/handler.py` — implement spec §6 exactly:
   - on connect: status ACTIVE; send `STATE_CHANGED` after intro transition.
   - per USER_UTTERANCE: send `AI_THINKING`; log USER transcript; LLM call in try/except →
     on failure send `ERROR {code:"LLM_FAILED", message}` and `AUDIO_FINISHED`, continue loop;
     on transition send `STATE_CHANGED` and `log_state_transition` (triggered_by
     `LLM_SUGGESTION` or `BACKEND_OVERRIDE` for fallback); log AI transcript; send `AI_TEXT`
     then TTS chunks (TTS failure → `ERROR {code:"TTS_FAILED"}` + `AUDIO_FINISHED`).
   - save code snapshot when entering AWAITING_WALKTHROUGH and when the loop ends (last
     non-empty code seen; language from message `language` or problem context).
   - INTERRUPT: `log_state_transition(..., "USER_ACTION")`, then debrief.
   - debrief: send `DEBRIEF_GENERATING`; on success send `DEBRIEF_READY {data, session_id}`,
     save, update session `status=COMPLETED, completed_at, total_duration_seconds`; on failure
     send `DEBRIEF_FAILED {message}`, status INTERRUPTED.
   - WebSocketDisconnect before debrief → status INTERRUPTED, duration set.
   - Pass real `code_snapshots` (last code) and `state_transitions` summary into debrief data
     instead of "N/A" where available.
5. Migration `supabase/migrations/006_ux_persistence.sql` per spec §6 (use
   `DROP POLICY IF EXISTS` before each CREATE; idempotent).
6. Verify: create venv `py -3.12 -m venv .venv` in `app/backend` if missing, `pip install -e ".[dev]"`,
   run `python -m pytest tests -q` and
   `SUPABASE_JWT_SECRET=x python -c "import sys; sys.path.insert(0,'src'); import main"` (with a
   dummy env if needed — do not edit the real `.env`). Report outputs.

---

## T2 — Extension core (logic only, no visual components)
Owns: `app/extension/src/config.ts` (new), `src/content/main.tsx`, `src/content/useInterview.ts`,
`src/content/useAuth.ts` (new), `src/content/useProblem.ts` (new), `src/background.ts`,
`src/content/authBridge.ts`, `src/services/**`, `src/utils/**`, `src/hooks/**`, `src/styles/**` (new),
`src/types.ts` (new), `vite*.config.ts`, `package.json`, `manifest.json`, `.env.example`.
Must NOT edit `src/components/**`, `src/content/App.tsx`, `src/popup/**` (T4 owns them).

1. `src/config.ts`: `BACKEND_URL` (from `VITE_BACKEND_URL`, default `http://localhost:8000`),
   `WS_URL` derived (http→ws, https→wss), `DASHBOARD_URL` (`VITE_DASHBOARD_URL`, default
   `http://localhost:5173`). Define these in all three vite configs. Update `.env.example`.
2. `src/types.ts` — export exactly:
```ts
export type Phase =
  | "IDLE" | "PREFLIGHT" | "CONNECTING" | "AI_SPEAKING" | "LISTENING" | "THINKING"
  | "GENERATING_DEBRIEF" | "DEBRIEF_READY" | "ERROR";
export type Stage = "INTRO" | "AWAITING_CLARIFICATION" | "AWAITING_APPROACH" | "AWAITING_CODE"
  | "AWAITING_WALKTHROUGH" | "CONCLUDING" | "GENERATING_DEBRIEF" | "COMPLETED";
export type ErrorCode = "MIC_DENIED" | "MIC_UNAVAILABLE" | "BACKEND_UNREACHABLE" | "AUTH_EXPIRED"
  | "STT_FAILED" | "CONNECTION_LOST" | "DEBRIEF_FAILED" | "DEBRIEF_TIMEOUT" | "TURN_FAILED" | "UNKNOWN";
export interface InterviewError { code: ErrorCode; message: string; retryable: boolean }
export interface Caption { speaker: "AI" | "USER"; text: string; final: boolean }
export interface Debrief {
  approach_score?: number; communication_score?: number; code_correctness_score?: number;
  code_quality_score?: number; time_management_score?: number; overall_score?: number;
  summary?: string; actionable_feedback?: string[]; similar_problems?: string[];
  real_world_scenario?: string; real_world_naive_approach?: string;
  real_world_why_wins?: string; senior_follow_up?: string;
}
export interface Problem { title: string; slug: string; difficulty: string; description: string;
  code: string; language: string; topics: string[] }
export type AuthStatus = "loading" | "signed_out" | "signed_in" | "expired";
export interface AuthState { status: AuthStatus; email: string | null; userId: string | null; token: string | null }
```
3. `src/content/useAuth.ts`: `useAuth(): AuthState & { openSignIn(): void }`. Reads storage via
   background `GET_AUTH`; listens to `chrome.storage.onChanged` for live updates; decodes JWT
   `exp` (base64url) → `expired` if `exp*1000 < Date.now()+30s`. `openSignIn` sends
   `{type:"OPEN_DASHBOARD", path:"/login"}` to background (background opens tab with
   `chrome.tabs.create`). Background also handles `OPEN_DASHBOARD` with any path.
4. `src/content/useProblem.ts`: `useProblem(): { slug: string | null; title: string; difficulty: string }`
   — light scrape (title/difficulty) that re-runs when the URL path changes (LeetCode SPA:
   poll `location.pathname` every 1000ms or patch history; MutationObserver on `<title>` is fine).
5. `src/content/useInterview.ts` — export:
```ts
export function useInterview(auth: AuthState): {
  phase: Phase; stage: Stage | null; elapsedSeconds: number; micLevel: number; // 0..1
  muted: boolean; toggleMute(): void;
  aiCaption: Caption | null; userCaption: Caption | null;
  debrief: Debrief | null; sessionId: string | null; error: InterviewError | null;
  start(): Promise<void>; end(): void; reset(): void; // reset → IDLE, full cleanup
}
```
   Behaviour (spec §5, §6): start → PREFLIGHT (getUserMedia; NotAllowedError→MIC_DENIED,
   NotFoundError→MIC_UNAVAILABLE) → CONNECTING (scrape problem, createSession; network fail→
   BACKEND_UNREACHABLE, 401→AUTH_EXPIRED; connect WS + Deepgram; Deepgram fail→STT_FAILED) →
   LISTENING until first AUDIO_CHUNK → AI_SPEAKING; AUDIO_FINISHED → LISTENING after queued
   audio drains; AI_THINKING → THINKING; STATE_CHANGED → stage; AI_TEXT → aiCaption;
   DEBRIEF_GENERATING → GENERATING_DEBRIEF (start 90s timeout → DEBRIEF_TIMEOUT);
   DEBRIEF_READY → debrief + DEBRIEF_READY; DEBRIEF_FAILED → error DEBRIEF_FAILED; server
   ERROR → keep going, set aiCaption to "Sorry, something glitched — could you repeat that?"
   style message and return to LISTENING; WS close unexpectedly during live → CONNECTION_LOST.
   `end()` sends INTERRUPT, stops mic + audio playback immediately, phase GENERATING_DEBRIEF.
   Timer: elapsedSeconds resets on start, ticks only in live phases. Mute stops sending audio.
   Half-duplex + utterance buffering per spec §5. Send current code with each utterance
   (full `getProblemData()` scrape). All resources cleaned up on reset/unmount; if `slug`
   of the page changes mid-interview, call reset (export nothing extra — App passes slug? No:
   useInterview watches `location.pathname` itself).
6. `src/services/deepgramStt.ts`: query params per spec §5; callbacks
   `onTranscript(text, isFinal, speechFinal)`, `onUtteranceEnd()`; `keepAlive()`, `pause()/resume()`.
   `src/services/websocket.ts`: use config URLs; `createSession` throws typed errors
   (`{code:"AUTH_EXPIRED"}` on 401/403, `BACKEND_UNREACHABLE` on network/5xx); WS exposes
   `onClose` callback; token URL-encoded.
7. `src/utils/domScraper.ts`: fix newline join (`"\n"`), keep IndexedDB path.
8. `src/content/main.tsx`: mount into a Shadow DOM (`attachShadow({mode:"open"})`) on a host
   `<div id="leeview-root">` with `all: initial; position: fixed; z-index: 2147483000`.
   Inject the shared stylesheet `src/styles/overlay.css` (import with `?inline`) into the
   shadow root. Fonts: add `@fontsource-variable/inter`, `@fontsource/instrument-serif`,
   `@fontsource/jetbrains-mono` (400,500) to dependencies; inject their `@font-face` CSS into
   `document.head` (fonts must be declared at document level). Set `build.assetsInlineLimit`
   to 1_000_000 in `vite.content.config.ts` so font files inline as data URIs.
   `overlay.css` contains ONLY the spec §3 tokens as CSS custom properties on `:host` plus a
   minimal reset (`*{box-sizing:border-box}` , button reset, focus-visible ring
   `0 0 0 2px var(--signal)`), keyframes `lv-pulse`, `lv-fade-in`, `lv-shimmer`, `lv-dot`,
   and `@media (prefers-reduced-motion: reduce)` disabling animations. T4 adds component styles
   below a `/* components */` marker — T2 must leave that marker at the end of the file.
9. `src/hooks/usePersistentPosition.ts`: draggable with position persisted in
   `chrome.storage.local` key `overlayPos`, clamped to viewport on load/resize; export
   `{ style: {left,top} | {right,bottom}, onPointerDown, dragging }` using pointer events,
   ignoring targets inside `button, [data-no-drag]`. Also `useCollapsed()` persisted boolean
   key `overlayCollapsed`. Delete old `useDraggable.ts` only if nothing else imports it
   (T4 will stop using it; leave it in place).
10. `manifest.json`: add `"tabs"` not needed (chrome.tabs.create works without it from
    background); add `"icons"` only if files exist (skip). Keep host perms; add
    `"https://*/*"`? NO. Leave permissions as is.
11. Verify: `npm install` then `npx tsc --noEmit` — errors are allowed ONLY inside files T4
    owns (components/App/popup) because they still use the old API; report them. Run
    `npx vite build --config vite.content.config.ts` may fail for the same reason; report.

---

## T3 — Dashboard redesign  (owns `app/dashboard/**`)
Implement spec §3 + §7 entirely.
- `index.html`: Google Fonts (Instrument Serif ital/regular, Inter 400/500/600, JetBrains Mono
  400/500), `<meta name="theme-color" content="#0A0B0D">`, inline `style="background:#0A0B0D"`
  on `<html>` to prevent white flash, favicon as inline SVG data URI (signal dot).
- `tailwind.config.js`: replace tokens with spec names (`ink-0..3`, `line`, `line-2`, `text-1..3`,
  `signal`, `signal-ink`, `signal-soft`, `ai`, `ai-soft`, `danger`, `warn`, `ok`); fonts
  `display: Instrument Serif`, `sans: Inter`, `mono: JetBrains Mono`.
- Structure: `src/lib/` (format.ts — durations, relative dates, score colour; stats.ts —
  totals, avg, streak (consecutive local days with ≥1 session ending today or yesterday),
  per-skill averages, weakest skill, trend series), `src/components/ui/` (Button, Card, Chip,
  ScoreBadge, Skeleton, StatTile, Tabs, EmptyState, ErrorBanner), `src/components/layout/AppShell.tsx`,
  pages Login, Overview (`/dashboard`), SessionDetail, NotFound.
- Data: `useInterviews` returns `{interviews, loading, error, reload}`; `useSession(id)` with
  `transcript_logs` ordered by timestamp and `code_snapshots` ordered by captured_at; handle
  `debriefs` being object OR array (normalise). Type `TranscriptLog`, `CodeSnapshot`.
- Router: `Link`/`useNavigate` only; `*` → NotFound. App-level loading = full-screen skeleton
  (not text).
- Login keeps the `useAuth` + `signInWithOAuth({provider:"google", options:{redirectTo: window.location.origin + "/dashboard"}})`.
- Example mock on login is static JSX; label "Example debrief".
- Keep `localhost:5173` dev port (extension auth bridge depends on it).
- Verify: `npm install && npm run build` must pass with zero TS errors. Report output.

---

## T4 — Extension UI  (Wave 2; owns `src/components/**`, `src/content/App.tsx`, `src/popup/**`, `index.html`, and the `/* components */` section of `src/styles/overlay.css`)
Implement spec §4 visual states using the T2 hooks (`useAuth`, `useProblem`, `useInterview`,
`usePersistentPosition`, `useCollapsed`) and types. Styling via class names in `overlay.css`
(no inline style soup except dynamic values like bar heights). Components:
`OverlayShell`, `Launcher` (collapsed), `SignedOutCard`, `ReadyCard`, `LiveCard`
(`StageStepper`, `VoiceVisualizer` driven by `micLevel`/phase, `CaptionStrip`, controls with
two-step End confirm), `GeneratingCard`, `DebriefCard`, `ErrorCard` (copy + action per
ErrorCode). Remove fake fallback scores. "View full debrief" → `OPEN_DASHBOARD` path
`/session/<sessionId>`. Keyboard `M` toggles mute only while live and when focus is not in an
editor (`document.activeElement` not contenteditable/textarea/input — LeetCode's editor!).
Popup: rewrite per spec §4 with a `popup.css` using the same tokens; Sign out clears
`user,userId,token`; fonts from Google Fonts link in `index.html` is fine for the popup.
Delete `Waveform.tsx`, `StartPill.tsx`, `InterviewOverlay.tsx`, `useDraggable.ts` when unused.
Verify: `npm run build` passes with zero errors; report.

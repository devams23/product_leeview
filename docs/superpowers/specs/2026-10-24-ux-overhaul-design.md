# LeeView UX Overhaul — Design

Date: 2026-10-24 · Status: approved by owner ("don't ask, build the best for the user")

## 1. Intent

LeeView launches next week. A first-time user must: install → sign in once → open a LeetCode
problem → have a natural spoken interview → get a debrief that feels worth coming back for.
Today that path breaks in many places (see §2) and the visuals read as a prototype.

Goal of this pass: **fix every UX bug on the core loop, give the product one distinctive,
professional visual identity, and make the dashboard a place people want to return to**
(progress, streaks, weak spots, replayable transcripts).

Non-goals (this pass): moving the Deepgram key server-side, payments, production deploy
URLs, new interview features (hints, pause, retry-same-problem flow beyond a link).
Anti-goals: fake/placeholder data shown as real, dead buttons, UI that fights LeetCode's own
page, anything that makes the interview feel less like talking to a person.

## 2. UX bugs found (audit)

### Core loop (extension + backend)
| # | Bug | Effect on user |
|---|-----|----------------|
| B1 | Deepgram query params commented out → default endpointing; every `is_final` fragment sent as its own `USER_UTTERANCE` | AI answers half-sentences, talks over the user, multiple replies queue up |
| B2 | Mic keeps streaming while AI audio plays | AI hears itself through speakers, responds to its own voice |
| B3 | `getUserMedia` rejection not handled | Mic denied → stuck on "Listening" forever |
| B4 | `createSession` ignores HTTP errors; backend down → `undefined` session id | Silent failure / opaque ERROR with no UI |
| B5 | `ERROR` phase has no UI (overlay shows "Listening") | User never learns something broke |
| B6 | Debrief failure never reported; no timeout | Stuck on "Processing" forever |
| B7 | Debrief card shows hard-coded fake scores/feedback when data missing; labels wrong (code_correctness labelled "Edge cases", quality "Complexity") | Misleading results |
| B8 | No indication of what stage the interview is in, or that AI is thinking | Long silent gaps feel broken |
| B9 | Timer never resets between interviews | Second interview starts at old time |
| B10 | "End" is instant, no confirmation, easy to mis-click | Interviews lost |
| B11 | Overlay not isolated (no Shadow DOM); LeetCode CSS leaks in; light-mode LeetCode makes text unreadable | Broken look |
| B12 | LeetCode is an SPA — navigating to another problem keeps the old session/overlay | Interview about wrong problem |
| B13 | DOM code fallback joins with literal `'\\n'` | AI sees garbled code |
| B14 | Popup "Sign out" doesn't remove the token; no token-expiry handling | Confusing auth, silent 401s |
| B15 | Logged-out prompt says "click the toolbar icon" with no button | Dead end on first run |
| B16 | Backend never persists transcripts, code, state transitions, status, duration; RLS has no INSERT policies for child tables (debrief save likely fails under per-user JWT) | Dashboard empty / always "PREPARING" |
| B17 | `main.py` uses `Depends` before import; PyJWT not a dependency; `SUPABASE_JWT_SECRET` read before `.env` loaded | Backend won't start |
| B18 | `/sessions` trusts `user_id` from body | Can create sessions for other users (also a security bug) |
| B19 | Backend URL hard-coded in two places | Can't ship to prod |

### Dashboard
| # | Bug |
|---|-----|
| D1 | Plain `Loading...` text, no skeletons; unstyled white flash before CSS |
| D2 | `<a href>` instead of router `Link` → full page reloads |
| D3 | Transcript & code are fetched but never shown |
| D4 | No progress information: no stats, trend, streak, skill averages, weakest area |
| D5 | Interrupted / no-debrief sessions render "No scenario available" and a zero radar |
| D6 | Serif (Playfair) used as body font; low contrast greys (0.2 alpha) for real text |
| D7 | No 404, no error states for failed queries, no route for `/session/:id` when not found |
| D8 | Login page is a bare button — no explanation of what LeeView is or next step |

## 3. Design system — "Studio"

Metaphor: a recording studio / on-air booth. Calm graphite room, one electric **signal**
colour that means *live / you / act now*. Editorial serif only for big numbers & headlines,
crisp sans for UI, mono for code and metadata.

### Tokens (shared by extension + dashboard — keep values identical)
```
--ink-0:   #0A0B0D   page background
--ink-1:   #111216   surface (cards, overlay)
--ink-2:   #17181D   raised surface / inputs
--ink-3:   #1F2027   hover / active
--line:    rgba(255,255,255,0.08)   hairline borders
--line-2:  rgba(255,255,255,0.14)   strong border / focus
--text-1:  #EDEDF0   primary text
--text-2:  #A1A2AB   secondary text (min for readable copy)
--text-3:  #6B6C76   meta / captions only
--signal:  #D4FF3F   accent (primary buttons, live mic, focus ring, "you")
--signal-ink: #0A0B0D text on signal
--signal-soft: rgba(212,255,63,0.12)
--ai:      #B9A6FF   interviewer voice / AI speaking
--ai-soft: rgba(185,166,255,0.14)
--danger:  #FF6B5E   --danger-soft: rgba(255,107,94,0.12)
--warn:    #FFB547
--ok:      #4ADE80
Difficulty: Easy #4ADE80, Medium #FFB547, Hard #FF6B5E
Score scale (1–10): <5 danger, 5–6.9 warn, 7–8.4 signal, ≥8.5 ok
```
Radius: 6 (chips), 10 (buttons/inputs), 14 (cards), 20 (overlay shell), 999 (pills).
Spacing scale 4/8/12/16/20/24/32/48. Shadows: overlay only —
`0 20px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px var(--line)`.
Motion: 150ms ease-out for hover, 240ms `cubic-bezier(.2,.8,.2,1)` for panels; respect
`prefers-reduced-motion` (disable pulses/waveform animation, keep static level).

### Type
- **Instrument Serif** (400, italic) — display: big scores, page titles, hero line.
- **Inter** (400/500/600; variable OK) — all UI and body. 14px base dashboard, 13px overlay.
- **JetBrains Mono** (400/500) — code, timers, metadata labels (11px, uppercase, 0.08em tracking).
Dashboard loads from Google Fonts. Extension bundles fonts (no network dependency on LeetCode's CSP);
fallbacks: `Inter, ui-sans-serif, system-ui` / `ui-monospace, SFMono-Regular, Menlo`.

## 4. Extension experience

Overlay lives in a **Shadow DOM** root, fixed bottom-right by default (above LeetCode's
console bar: `bottom: 88px; right: 24px`), draggable by its header, position persisted in
`chrome.storage.local`. Width 320px. Dark always (independent of LeetCode theme).

States (one shell, content swaps with a 240ms crossfade):
1. **Signed out** — "Sign in to start practicing" + primary button "Sign in" (opens dashboard).
2. **Session expired** — same, copy: "Your session expired. Reconnect in one click."
3. **Idle / ready** — problem title + difficulty chip (scraped), a single big signal button
   "Start interview" with mic icon, sub-line "~20 min · voice · you'll get a scored debrief".
   Small minimise button collapses to a 48px round launcher (signal dot) — remembered.
4. **Preflight** — requesting mic: "Allow microphone access to begin".
5. **Connecting** — shimmer + "Setting up your interviewer…".
6. **Live** — header: REC dot + mm:ss timer (mono) + stage stepper (5 dots:
   Clarify · Approach · Code · Walkthrough · Wrap-up, current one labelled).
   Centre: a voice orb / bar visualiser driven by **real** levels:
   - AI speaking → `--ai` colour, label "Interviewer speaking"
   - Listening → `--signal`, bars follow mic level, label "Your turn — think out loud"
   - Thinking → 3-dot pulse in `--ai`, label "Interviewer is thinking"
   - Muted → grey, label "Muted"
   Caption strip (toggle "CC", default **off** — respects the voice-first decision; when on,
   shows the interviewer's last line and your live interim transcript).
   Controls: Mute (M), CC, End (requires confirm: button turns to "End & get debrief?" for 3s).
7. **Generating debrief** — progress copy cycling ("Scoring your approach…", "Reviewing your
   code…", "Writing feedback…"); 90s timeout → error state.
8. **Debrief ready** — overall score big serif with score-scale colour, 5 mini bars with
   correct labels (Approach, Communication, Correctness, Code quality, Time), top 1 feedback
   item, buttons "View full debrief" (opens dashboard `/session/:id`) and "New interview".
9. **Error** — icon + human title + one-line fix + primary action (Retry / Open settings /
   Sign in) by error code. Codes: MIC_DENIED, MIC_UNAVAILABLE, BACKEND_UNREACHABLE,
   AUTH_EXPIRED, STT_FAILED, CONNECTION_LOST, DEBRIEF_FAILED, DEBRIEF_TIMEOUT, UNKNOWN.

Keyboard: `M` mute, `Esc` collapse confirm. All buttons have `aria-label`s and visible focus ring.

Popup (toolbar): 340px, same tokens. Header logo + backend status dot ("Online"/"Offline").
Signed-in: avatar initial + email, last score if available, buttons "Open dashboard",
"Sign out" (clears user, userId, token). Signed-out: one-line pitch + "Sign in with Google".
Hint row: "Open any LeetCode problem to start".

## 5. Speech & turn-taking (fixes B1/B2)
- Deepgram URL params: `model=nova-3, language=en-US, smart_format=true, interim_results=true,
  endpointing=300, utterance_end_ms=1500, vad_events=true`. (MediaRecorder webm — do not set
  encoding/sample_rate.)
- Accumulate `is_final` segments into a buffer; send ONE `USER_UTTERANCE` when an
  `UtteranceEnd` message arrives, or when `speech_final` is true and no new words for 1200ms.
- Half-duplex: while phase is AI_SPEAKING or THINKING, drop mic chunks (don't send) and
  send Deepgram `{"type":"KeepAlive"}` every 5s so the socket stays open. Resume on LISTENING.
- Mic level: AnalyserNode RMS → 0..1, throttled to ~20fps state updates.

## 6. Backend ↔ extension protocol (additive)
Server → client, new messages:
```
{type:"STATE_CHANGED", state:"<InterviewState>"}   after every transition (and initial)
{type:"AI_THINKING"}                               on receiving USER_UTTERANCE, before LLM
{type:"AI_TEXT", text}                             before TTS streaming of each AI turn
{type:"DEBRIEF_GENERATING"}                        when debrief generation starts
{type:"DEBRIEF_READY", data, session_id}           (session_id added)
{type:"DEBRIEF_FAILED", message}
{type:"ERROR", code, message}                      turn failed (LLM/TTS); loop continues
```
Existing AUDIO_CHUNK / AUDIO_FINISHED unchanged.

Persistence (B16): log each USER and AI turn to `transcript_logs` with state; log each
transition to `state_transitions`; save code snapshot on entering AWAITING_WALKTHROUGH and
at end; update `interview_sessions.status` → ACTIVE on connect, COMPLETED when debrief saved,
INTERRUPTED on disconnect without debrief; set `completed_at` and `total_duration_seconds`.
All persistence calls wrapped so a DB failure never breaks the live interview.
Migration `006_ux_persistence.sql`: INSERT policies for transcript_logs, code_snapshots,
state_transitions, debriefs (session must belong to `auth.uid()`); UPDATE policy on
interview_sessions for own rows; tighten sessions INSERT back to `user_id = auth.uid()`.

## 7. Dashboard

Shell: left rail on ≥1024px (logo, Overview, History, Settings-less; user menu at bottom),
top bar on mobile. Max content width 1200px. Router `Link`s everywhere.

**/login (landing)** — split hero: left "Practice the interview, not just the problem."
(Instrument Serif), sub-copy, "Continue with Google" signal button, 3-step strip
(Install extension → Open any LeetCode problem → Talk it through, get scored). Right: a
static mock of the overlay + debrief card built from real components with sample data
clearly labelled "Example".

**/dashboard (overview)**
- Greeting with first name from Google metadata; "Last practiced 2 days ago".
- 4 stat tiles: Interviews, Avg score (serif, scale colour), Practice time, Day streak.
- Score trend (Recharts line/area, last 20 completed, signal stroke) + skill averages (5
  horizontal bars) with a "Focus area" callout naming the weakest skill and its average.
- Recent sessions table: problem, difficulty chip, date (relative), duration, score badge,
  status chip; search box + difficulty filter + status filter; row → session detail.
- Empty state: onboarding checklist (Signed in ✓ · Install extension · Do first interview)
  with link to leetcode.com/problems/two-sum.
- Skeleton loaders for all blocks; error banner with Retry.

**/session/:id**
- Header: back link, title, difficulty chip, date, duration, "Open on LeetCode" + "Practice
  again" (both → leetcode.com/problems/<slug>).
- No-debrief states: INTERRUPTED → "Interview ended early — no debrief generated", still
  show transcript/code.
- Score hero: overall score (big serif), summary paragraph.
- Radar + 5 labelled score bars side by side.
- "What to work on" — actionable feedback as numbered cards.
- Tabs: **Transcript** (chat timeline, AI left in `--ai-soft`, You right in `--signal-soft`,
  stage dividers from `state_at_time`, timestamps) · **Code** (final snapshot, mono, line
  numbers, copy button) · **Real-world** (scenario, naive approach, why it wins, senior follow-up).
- Similar problems as chips linking to LeetCode search.
- 404 page and not-found session state.

## 8. Decisions made by the builder (owner may revisit)
- Accent colour lime `#D4FF3F` + violet `#B9A6FF` for AI; fonts Instrument Serif / Inter / JetBrains Mono.
- Captions exist but default off (keeps the original voice-only decision as default).
- Overlay default position bottom-right, collapsible to a launcher.
- Deepgram key stays client-side for this pass — must move server-side before public launch.

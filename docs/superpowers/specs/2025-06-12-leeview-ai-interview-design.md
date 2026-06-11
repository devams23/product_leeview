# LeeView AI Mock Interview — Design Spec

**Date:** 2025-06-12
**Status:** Draft
**Author:** Devam

---

## 1. Overview

LeeView is a Chrome extension that transforms any LeetCode problem page into a real-time AI mock interview session. The user clicks a start button, speaks their thought process aloud, and an AI interviewer guides them through clarification, approach discussion, coding, and a final walkthrough. After the session, a debrief engine evaluates their performance and maps the problem to a real-world engineering scenario.

A separate React dashboard (Vite, Google OAuth) allows users to review past interviews, transcripts, scores, and progress over time.

---

## 2. Goals

- Simulate a real technical interview environment directly on the LeetCode page with minimal context switching
- Force the candidate to practice thinking out loud via always-on voice interaction
- Provide a high-quality debrief with actionable feedback, scores, and a real-world scenario mapping
- Store interview history for long-term progress tracking via a dedicated dashboard

## 3. Non-Goals

- Code execution or auto-grading against LeetCode test cases (user submits their own code on LeetCode separately)
- Subscription billing or payment processing
- Support for platforms other than LeetCode (initially)
- In-interview transcript visible to user (purely voice-based experience)

---

## 4. Architecture

### 4.1 Components

- **Chrome Extension (Manifest V3)** — Injected overlay on LeetCode, mic capture, Deepgram STT streaming, WebSocket client, visual status indicators
- **FastAPI Backend** — Interview state machine orchestration, NVIDIA NIM API calls, TTS audio streaming, debrief engine
- **Supabase (Postgres)** — User profiles, interview sessions, transcripts, debriefs, code snapshots
- **React Dashboard (Vite)** — Separate web app for viewing interview history, transcripts, debrief reports, progress metrics
- **Deepgram** — Real-time STT and TTS

### 4.2 High-Level Flow

```
User opens LeetCode problem
        |
        v
Extension injects "Start Mock Interview" pill
        |
        v
User clicks -> Extension scrapes problem data
        |
        v
Extension opens WebSocket to FastAPI backend
        |
        v
Backend creates session in Supabase, state = INTRO
        |
        v
Backend sends intro prompt to NVIDIA NIM -> gets response + next_state
        |
        v
Backend sends response to Deepgram TTS -> streams audio to Extension
        |
        v
Extension plays audio, shows visual "Interviewer Speaking"
        |
        v
Audio finishes -> Extension shows "Listening"
        |
        v
User speaks -> Extension streams to Deepgram STT -> forwards transcript to Backend
        |
        v
Backend accumulates transcript, detects end of turn -> sends to NVIDIA NIM
        |
        v
 ... (state transitions continue) ...
        |
        v
Interview concludes -> Backend triggers debrief engine
        |
        v
Debrief stored in Supabase -> Extension notifies user -> "Debrief Ready"
        |
        v
User clicks -> Redirected to React Dashboard to view full debrief
```

---

## 5. Tech Stack & Justifications

| Layer | Tech | Why |
|-------|------|-----|
| STT | Deepgram Streaming | ~300ms latency, excellent technical vocabulary handling, real-time streaming |
| TTS | Deepgram (Nova) | Low latency, consistent with STT provider, good expressiveness |
| LLM | NVIDIA NIM API | User preference; good reasoning quality for interviewer persona and debrief |
| Backend | FastAPI + Uvicorn | Native async/await, built-in WebSocket support, Python AI ecosystem |
| DB | Supabase (Postgres) | Auth built-in (Google OAuth), real-time subscriptions, vector storage for future RAG |
| Extension | Manifest V3 + React | Modern Chrome extension, React for overlay UI complexity |
| Dashboard | React + Vite | Fast builds, modern DX, optimized for a rich data-visualization frontend |
| Real-time | WebSocket (FastAPI) | Lower latency than HTTP for voice interaction |

---

## 6. Interview State Machine

### 6.1 States

| State | Description |
|-------|-------------|
| INTRO | AI introduces itself, sets expectations, encourages thinking out loud |
| AWAITING_CLARIFICATION | User asks about constraints, edge cases, input format |
| AWAITING_APPROACH | User discusses algorithm choice, trade-offs, complexity |
| AWAITING_CODE | User writes code while narrating thoughts |
| AWAITING_WALKTHROUGH | User walks through their code with a test case |
| CONCLUDING | AI thanks the user, signals debrief generation |
| GENERATING_DEBRIEF | Backend runs evaluation and real-world scenario mapping |
| COMPLETED | Debrief stored, user redirected to dashboard |

### 6.2 State Transition Logic

The backend maintains the canonical state. On each user turn:

1. Backend sends the full conversation history to NVIDIA NIM, including the current state
2. NVIDIA NIM returns a `response_text` and a suggested `next_state`
3. Backend validates the suggested `next_state` against allowed transitions
4. If valid: backend updates state and notifies the extension
5. If invalid: backend blocks the transition, keeps the current state, and (optionally) regenerates the response to fit the current state

**Validation Rules:**
- INTRO can only transition to AWAITING_CLARIFICATION
- AWAITING_CLARIFICATION can transition to AWAITING_APPROACH or stay
- AWAITING_APPROACH can transition to AWAITING_CODE or back to AWAITING_CLARIFICATION
- AWAITING_CODE can transition to AWAITING_WALKTHROUGH or back to AWAITING_APPROACH
- AWAITING_WALKTHROUGH can transition to CONCLUDING
- CONCLUDING transitions to GENERATING_DEBRIEF automatically

### 6.3 End-of-Turn Detection

Backend detects the user has finished speaking via:
- Silence threshold from Deepgram (configurable, default 1.5s of no speech)
- Sentence/utterance completion markers

### 6.4 Timeout & Interrupt

- Max interview duration: 60 minutes (auto-triggers CONCLUDING)
- User can click "Stop Interview" at any time (immediately triggers GENERATING_DEBRIEF with `interrupted: true` flag)

---

## 7. Extension UI / UX

The extension UI is purely visual — no transcript is shown during the interview. The goal is to keep the user focused on thinking out loud.

### 7.1 Visual Elements

- **Start Pill** — Floating button in bottom-right of LeetCode page: "Start Mock Interview"
- **Active Overlay** — Appears on top-right or bottom-left of the page (non-blocking, draggable)
- **Waveform Visualization** — Real-time audio waveform of the user's speech while listening
- **Interviewer Avatar / Icon** — Animated subtle pulsing when the interviewer is "speaking"
- **State Indicator** — Small text label below the icon (e.g., "Clarification Phase", "Coding Phase")
- **Progress Ring** — A thin circular progress indicator showing how far the interview has progressed overall
- **Timer** — Subtle elapsed time display
- **Stop Button** — Red X to end the interview early

### 7.2 States

- **Idle**: Start pill visible, no overlay
- **Connecting**: "Starting session..." spinner
- **Interviewer Speaking**: Avatar pulses, waveform is flat, "Interviewer Speaking" label
- **Listening**: Waveform animates with live mic input, "Listening..." label
- **Processing**: Brief spinner between turns (should be <300ms ideally),
- **Debrief Ready**: Green checkmark, "Debrief Ready — Click to View"

---

## 8. Data Flow (Detailed)

### Phase 1: Initiation

1. User on LeetCode problem page (e.g., `/problems/two-sum`)
2. Content script detects URL pattern and injects the "Start Mock Interview" pill
3. On click, content script scrapes: title, description, constraints, examples, current editor code, selected language
4. Content script opens WebSocket to `wss://api.leeview.com/interview`
5. Backend creates a row in `interview_sessions` (status: PREPARING)
6. Backend returns `session_id` and transitions to INTRO state
7. Extension opens Deepgram STT WebSocket connection
8. Extension captures mic via `getUserMedia` and streams to Deepgram

### Phase 2: Audio Loop (One Turn)

1. Deepgram sends transcript chunks to extension
2. Extension forwards completed utterances to backend via WebSocket
3. Backend appends to in-memory `conversation_history` array
4. Backend detects end of turn (silence threshold)
5. Backend constructs prompt for NVIDIA NIM:
   - Current state (e.g., AWAITING_CLARIFICATION)
   - Full conversation history
   - Problem context
   - System prompt defining interviewer persona
6. NVIDIA NIM returns `response_text` and `next_state`
7. Backend validates `next_state`
8. Backend sends `response_text` to Deepgram TTS
9. Deepgram returns audio; backend chunks and streams to extension
10. Extension plays audio, shows "Interviewer Speaking" visual state
11. On audio finish, extension sends `AUDIO_FINISHED` to backend
12. Backend updates state if transition was valid
13. Extension shows "Listening" with live waveform

### Phase 3: Code Snapshots

- The extension always includes the **latest code** from the LeetCode editor in every `USER_UTTERANCE` message sent to the backend.
- Backend keeps the latest code in **memory** (per WebSocket session) for AI context — this is cheap and real-time.
- Backend persists a `code_snapshot` to the database **only on state transitions**:
  1. When transitioning into `AWAITING_CODE`
  2. When transitioning into `AWAITING_WALKTHROUGH`
  3. When the interview ends (`CONCLUDING` or `INTERRUPTED`)

This ensures the LLM always sees fresh code without database overhead, while the debrief engine still has milestone snapshots to evaluate code evolution.

### Phase 4: Debrief Generation

1. Interview concludes (CONCLUDING -> GENERATING_DEBRIEF)
2. Backend assembles:
   - Full conversation transcript
   - Code snapshots
   - State transition history
   - Time spent per state
   - Turn counts
3. Backend sends a structured prompt to NVIDIA NIM with the above data
4. NVIDIA NIM returns a JSON with evaluation scores and feedback
5. Backend triggers a second prompt for "Real-World Engineering Context"
6. Both responses are stored in the `debriefs` table
7. Backend sends `DEBRIEF_READY` event to the extension
8. Extension updates UI: "Debrief Ready — Click to View"
9. On click, user is redirected to the React dashboard

---

## 9. Database Schema

### Auth (Supabase)
- Uses built-in `auth.users` table for Google OAuth.
- `interview_sessions.user_id` is a foreign key to `auth.users(id)`.
- No custom `users` table needed for v1.

### Table: `interview_sessions`
- id (UUID, PK)
- user_id (UUID, FK -> auth.users(id) ON DELETE CASCADE)
- leetcode_slug (string)
- leetcode_title (string)
- problem_difficulty (string)
- status (enum: PREPARING, ACTIVE, COMPLETED, INTERRUPTED)
- started_at (timestamp)
- completed_at (timestamp)
- total_duration_seconds (integer)

### Table: `transcript_logs`
- id (UUID, PK)
- session_id (UUID, FK -> interview_sessions)
- speaker (enum: USER, AI)
- text (text)
- timestamp (timestamp)
- state_at_time (string) — the interview state when this utterance occurred

### Table: `code_snapshots`
- id (UUID, PK)
- session_id (UUID, FK -> interview_sessions)
- code (text)
- language (string)
- captured_at (timestamp)

### Table: `state_transitions`
- id (UUID, PK)
- session_id (UUID, FK -> interview_sessions)
- from_state (string)
- to_state (string)
- transitioned_at (timestamp)
- triggered_by (enum: LLM_SUGGESTION, USER_ACTION, TIMEOUT, BACKEND_OVERRIDE)

### Table: `debriefs`
- id (UUID, PK)
- session_id (UUID, FK -> interview_sessions, unique)
- approach_score (integer, 1-10)
- communication_score (integer, 1-10)
- code_correctness_score (integer, 1-10)
- code_quality_score (integer, 1-10)
- time_management_score (integer, 1-10)
- overall_score (integer, 1-10)
- actionable_feedback (JSON array of strings)
- similar_problems (JSON array of strings)
- real_world_scenario (text)
- real_world_naive_approach (text)
- real_world_why_wins (text)
- senior_follow_up (text)
- generated_at (timestamp)

---

## 10. Debrief Engine

### 10.1 Scoring Prompt

Backend sends to NVIDIA NIM:

```
Given the following interview data:
- Problem: {title} ({difficulty}, {tags})
- Full transcript: {conversation_history}
- Code snapshots at each stage
- Time spent per state
- State transition history

Evaluate the candidate on a scale of 1-10 for:
1. Approach: Did they clarify edge cases? Discuss trade-offs? Justify their algorithm?
2. Communication: How clearly did they think out loud? Did they pause silently for too long? Were they tangential or focused?
3. Code Correctness: Does their final code handle the problem correctly and edge cases?
4. Code Quality: Naming, structure, readability, DRY principles
5. Time Management: Did they spend too long on approach vs. coding?

Also provide:
- 3-5 specific, actionable feedback items
- 2-3 similar LeetCode problems they should practice next
- An overall summary paragraph

Return as a structured JSON object.
```

### 10.2 Real-World Scenario Mapping Prompt

```
Given:
- Problem: {title}
- Core algorithm detected: {algorithm}
- User's approach summary

Generate a "Real-World Engineering Context" section with:
1. Core Concept: Abstract algorithm name
2. Scenario: A concrete, specific production story (e.g., at a company like Netflix, Amazon, or a startup) where this exact algorithm applies
3. Why It Wins: Why the naive approach fails at scale and why this algorithm is the right tool
4. Senior Follow-Up: One extension question a staff engineer would ask

Make it engaging, specific, and directly tied to the algorithm. No generic advice.
```

---

## 11. Dashboard (React + Vite)

### 11.1 Routes

- `/login` — Google OAuth sign-in (via Supabase Auth)
- `/dashboard` — Main dashboard with interview history, stats, and progress charts
- `/session/:sessionId` — Detailed view of a single interview:
  - Full transcript (expandable per turn)
  - Code evolution (diff view between snapshots)
  - Debrief report (radar chart of scores, feedback cards)
  - Real-world scenario card
- `/profile` — User profile and settings

### 11.2 Key Features

- **Interview History Table** — Sortable, filterable list of all past sessions
- **Score Radar Chart** — Visual comparison of the 5 metrics
- **Progress Over Time** — Line chart showing average scores across sessions
- **Code Diff Viewer** — Side-by-side comparison of code snapshots
- **Transcript Player** — Can replay the interview turn-by-turn (read-only, not actual audio)
- **Similar Problems** — Quick links to LeetCode based on debrief recommendations

### 11.3 Tech

- Vite for fast dev and build
- Tailwind CSS for styling
- Recharts or Chart.js for data visualization
- Supabase client for auth and data fetching

---

## 12. Auth

- Google OAuth via Supabase Auth
- No custom email/password (to keep it simple for v1)
- JWT tokens stored in HTTP-only cookies (handled by Supabase)
- Protected routes on dashboard check auth state

---

## 13. Error Handling

| Scenario | Behavior |
|----------|----------|
| Deepgram STT disconnects mid-interview | Extension retries connection 3x, then shows "Connection Lost" and stores partial transcript so far |
| NVIDIA NIM timeout or 5xx | Backend retries with exponential backoff (max 3). If all fail, uses a fallback " gentle nudge" prompt |
| User closes browser mid-interview | Backend detects WebSocket disconnect after 30s, marks session as INTERRUPTED, still generates a partial debrief |
| Extension fails to inject on LeetCode | Log error, show a browser notification to the user: "LeeView could not load on this page. Please refresh." |
| Mic permission denied | Show an inline guide asking the user to enable mic permissions for the site |

---

## 14. Future Considerations

- **Code Execution**: Run user code against hidden test cases in an isolated sandbox for more accurate scoring
- **LeetCode Graph Integration**: Use the problem difficulty graph to recommend problems at the right level
- **Multiplayer / Peer Mode**: Allow two users to interview each other with AI moderation
- **Video Mode**: Optional camera on the user to track nervousness (future AI analysis)
- **Company-Specific Interviews**: Tune the AI persona to match specific company styles (FAANG, startups, etc.)
- **RAG on Past Interviews**: Use vector search to find similar past mistakes and recommend targeted practice

---

## 15. Open Questions

- Do we need to store raw audio, or just transcripts? (Transcripts only for v1 to save cost)
- Should the debrief engine run synchronously or asynchronously (queue via Celery/Redis)? For v1, synchronous with a 30s timeout is acceptable.
- Do we need a `payments` or `credits` table for future monetization? Out of scope for v1.

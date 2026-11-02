# Voice Reliability, Metrics and "Get Ready" Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop interviews from freezing, cut time to first sound, record what each interview costs, and open every interview with a short, silent "take a breath" screen, after which the interviewer speaks first.

**Architecture:** The pipeline stays as it is: client-side Deepgram STT, then the FastAPI WebSocket, then the LLM, then Deepgram Aura TTS. Each stage gets timeouts and watchdogs. The backend streams LLM tokens into sentence-sized TTS requests and sends binary PCM frames. Per-turn and per-session metrics go to two service-role tables. The client STT moves to Deepgram Flux (the v2 endpoint, using the existing WebM/Opus stream) and falls back to Nova-3.

**Tech Stack:** FastAPI, websockets, httpx, supabase-py, pytest; React 19 + TypeScript 7 + Vite 8 MV3 extension, node:test.

**Spec:** the analysis report from this session, plus the user's request. Decisions:
- Pipecat and LiveKit are deferred. STT is client-side, and these fixes cover their main benefits. Revisit after Task 1's metrics exist.
- Flux is adopted.
- The interviewer speaks first, after a calm screen.

## Global Constraints

- No new runtime dependencies. If one becomes unavoidable, check the latest version (`npm view <pkg> version` / PyPI) and install that exact version.
- No security work in this plan: auth, key handling and RLS hardening are out of scope. New metrics tables are service-role only.
- Commits: one per task, no Claude/Anthropic names, no `Co-Authored-By` trailers.
- Backend tests: `cd app/backend && .venv/Scripts/python -m pytest -q`. Extension: `cd app/extension && npm test && npm run build`.
- Animations must be gated behind `@media (prefers-reduced-motion: no-preference)`. The dev machine reports reduced motion.
- Copy is plain and calm, with no exclamation marks.

## Review Focus

1. The LLM or TTS hangs mid-turn: the user must get the floor back within 45s and never see an endless "Thinking…" (Tasks 2, 5).
2. The user clicks End while the interviewer is thinking: the debrief must start immediately and not wait for the turn (Task 3).
3. The intro arrives before or after the calm period: audio must never play during the calm screen and must never be lost (Task 4).
4. Speech heard while the interviewer talks: with Flux always streaming, an echo or an early turn must not be sent as the user's answer (Task 7).
5. The user goes silent for minutes: the interviewer checks in at most twice in a row, and the 45-minute cap still ends the interview with a debrief (Task 8).

---

### Task 1: Per-turn and per-session cost metrics

**Files:**
- Create: `app/backend/src/metrics.py`, `supabase/migrations/009_usage_metrics.sql`, `app/backend/tests/test_metrics.py`
- Modify: `app/backend/src/services/llm/base.py`, `nvidia_nim.py`, `openrouter.py`, `app/backend/src/config.py`, `app/backend/src/services/supabase_client.py`, `app/backend/src/websocket/handler.py`

**Interfaces:**
- Produces:
  - `metrics.PRICE_STT_PER_MIN = 0.0077`, `metrics.PRICE_TTS_PER_1K_CHARS = 0.030`
  - `@dataclass TurnMetrics(turn_index:int, state:str, kind:str, llm_ms:int|None=None, llm_first_token_ms:int|None=None, tts_first_audio_ms:int|None=None, first_audio_ms:int|None=None, total_ms:int|None=None, tts_chars:int=0, input_tokens:int=0, output_tokens:int=0, llm_attempts:int=0, error:str|None=None)`. `kind` is `"intro" | "reply" | "nudge" | "notice"`.
  - `@dataclass SessionUsage(turns:int=0, tts_characters:int=0, llm_input_tokens:int=0, llm_output_tokens:int=0, llm_calls:int=0)` with `add_turn(t: TurnMetrics) -> None` and `cost_usd(stt_seconds: float, in_price_per_mtok: float, out_price_per_mtok: float) -> float`, rounded to 6 places.
  - `LLMProvider.record_usage(usage: dict | None) -> None` adds `prompt_tokens`/`completion_tokens` and increments `calls`. `LLMProvider.usage_snapshot() -> tuple[int, int, int]` returns (input, output, calls). Both work without an `__init__` in the base: use `getattr(self, "_in_tokens", 0)` etc.
  - `LLMProvider.last_attempts: int`, set by `generate_structured`.
  - `Settings.llm_input_price_per_mtok: float = 0.0`, `Settings.llm_output_price_per_mtok: float = 0.0`
  - `supabase_client.save_turn_metrics(session_id: str, row: dict)` and `supabase_client.upsert_session_usage(session_id: str, row: dict)`. Both use the module's service-role `supabase` client.
  - `_InterviewContext.usage: SessionUsage` and `_InterviewContext.turn_index: int = 0`
  - `handler._speak(...)` now returns `tuple[int | None, int]`: (ms from call to first audio chunk, characters sent to TTS).

- [ ] **Step 1: Write failing tests** in `tests/test_metrics.py`:
  - `test_cost_usd`: `SessionUsage(tts_characters=1000, llm_input_tokens=1_000_000, llm_output_tokens=500_000).cost_usd(600, 0.2, 0.4) == 0.507`
  - `test_add_turn`: two TurnMetrics, (tts_chars=10, input_tokens=5, output_tokens=2) and (20, 1, 1), give turns=2, tts_characters=30, llm_input_tokens=6, llm_output_tokens=3.
  - `test_record_usage`: a minimal `LLMProvider` subclass gets `record_usage({"prompt_tokens":10,"completion_tokens":5})` twice and then `record_usage(None)`; `usage_snapshot() == (20, 10, 3)`.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_metrics.py -q`. Expected: FAIL (ImportError).
- [ ] **Step 3: Implement** `metrics.py` and the base-class usage methods. In both providers, call `self.record_usage(data.get("usage"))` after parsing the response. In `generate_structured`, set `self.last_attempts = attempt` on success and on final failure.
- [ ] **Step 4: Migration `009_usage_metrics.sql`:**
  - `turn_metrics`: id uuid pk default `gen_random_uuid()`; session_id uuid FK to `interview_sessions(id)` on delete cascade; one column per TurnMetrics field; created_at timestamptz default now(). Add an index on session_id.
  - `session_usage`: session_id uuid pk with the same FK; turns, tts_characters, llm_input_tokens, llm_output_tokens and llm_calls as int; stt_seconds int; cost_usd numeric(10,6); updated_at timestamptz default now().
  - Enable RLS on both tables with no policies. Add the comment "internal metrics: service role only".
- [ ] **Step 5: Wire into `handler.py`.**
  - In `send_intro` and `_handle_user_utterance`:
    - take `t0 = time.monotonic()` and `before = ctx.llm.usage_snapshot()`;
    - time the LLM call as `llm_ms`;
    - fill TurnMetrics, using the token deltas and `last_attempts`, the `_speak` return values, `first_audio_ms = llm_ms + tts_first_audio_ms` and `total_ms`;
    - set `error="LLM_FAILED"` on failure;
    - then `ctx.usage.add_turn(m)`, `ctx.turn_index += 1`, `logger.info("turn_metrics %s", json.dumps(asdict(m)))`, and persist with `_safe(save_turn_metrics, ctx.session_id, asdict(m))`.
  - At every session end (debrief, cap, disconnect), call `_safe(upsert_session_usage, ...)`. It writes the usage fields, `stt_seconds = _duration_seconds(ctx)` (approximation: the mic stream is open for the whole session), and `cost_usd` from the settings prices.
- [ ] **Step 6:** Run the full backend suite. Expected: all pass.
- [ ] **Step 7:** Commit with "Metrics: per-turn latency, tokens and TTS characters, and a per-session cost row".

### Task 2: Backend timeouts and a lighter hot path

**Files:**
- Modify: `app/backend/src/services/deepgram.py`, `services/llm/base.py`, `services/llm/structured.py`, `nvidia_nim.py`, `openrouter.py`, `app/backend/src/auth.py`, `websocket/handler.py`
- Test: `app/backend/tests/test_reliability.py`

**Interfaces:**
- Produces:
  - `deepgram.OPEN_TIMEOUT_S = 5.0` and `deepgram.RECV_TIMEOUT_S = 10.0`. On a stall, `stream_tts` raises `RuntimeError("Deepgram TTS timed out")`.
  - `LLMProvider.generate_structured(messages, json_schema, temperature=0.5, max_attempts: int = MAX_ATTEMPTS)`. The backoff sleep becomes `0.5 * attempt`.
  - Providers keep one `httpx.AsyncClient` per instance, created lazily in `self._client`, with `httpx.Timeout(20.0, connect=5.0)`.
  - `supabase_for_user` is wrapped in `functools.lru_cache(maxsize=128)`.
  - `handler._bg(fn, *args, **kwargs) -> None` schedules `_safe(fn, ...)` as a task and keeps a reference in a module-level `set` until it finishes.

- [ ] **Step 1: Write failing tests:**
  - `test_tts_recv_timeout`: monkeypatch `deepgram.RECV_TIMEOUT_S = 0.05` and `websockets.connect` with a fake async context manager whose `send` is a no-op and whose `recv` sleeps 10s. Consuming `stream_tts("hi")` raises `RuntimeError` matching "timed out" in under 1s.
  - `test_supabase_client_cached`: monkeypatch `auth.create_client` to return `object()`. The same JWT twice gives the identical object (`is`); a different JWT gives a different object. Call `auth.supabase_for_user.cache_clear()` first.
  - `test_history_keeps_only_text`: run `_handle_user_utterance` with:
    - a fake LLM whose `generate_structured(messages, schema, max_attempts=...)` records messages and returns `{"response_text":"ok","next_state":ctx.sm.current_state.value}`;
    - `usage_snapshot` returning (0,0,0) and `last_attempts=1`;
    - `_speak` patched to an async function returning `(None, 0)`;
    - `manager.send_to_session` and `_safe` patched to no-ops.

    Send data `{"text":"hi","current_code":"print(1)"}`. Assert:
    - the history has a user message with content exactly `"Candidate: hi"`;
    - the last message the LLM saw contains `"print(1)"`;
    - `max_attempts == 2` was passed.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - TTS: open with `websockets.connect(url, subprotocols=[...], open_timeout=OPEN_TIMEOUT_S)`. Replace `async for` with a `while True` loop around `await asyncio.wait_for(ws.recv(), RECV_TIMEOUT_S)`, and map `asyncio.TimeoutError` to the RuntimeError.
  - Interview turns (intro and reply) pass `max_attempts=2`; the debrief keeps the default.
  - Store user turns in history as `Candidate: {text}` only. `build_interview_prompt` still adds the current code to the newest message.
  - Use `_bg` for `log_transcript`, `log_state_transition` and code snapshots inside turns. Keep the end-of-session `_save_code_snapshot` awaited.
- [ ] **Step 4:** Run the full suite. Expected: PASS.
- [ ] **Step 5:** Commit with "Backend: TTS and LLM timeouts, shared HTTP and Supabase clients, persistence off the turn path, code only in the newest prompt".

### Task 3: Receive loop that stays responsive during a turn

**Files:**
- Modify: `app/backend/src/websocket/handler.py`
- Test: `app/backend/tests/test_receive_loop.py`

**Interfaces:**
- Consumes: Task 1 (`_InterviewContext`).
- Produces:
  - `_InterviewContext.turn_task: asyncio.Task | None = None`, `last_activity: float` (default `time.monotonic()`), and `user_turns: int = 0`. `user_turns` is incremented per accepted USER_UTTERANCE.
  - Client→server `{"type":"PING"}` is answered with server→client `{"type":"PONG"}`.
  - Client→server `{"type":"ACTIVITY"}` sets `last_activity`.
  - A USER_UTTERANCE that arrives while a turn is running is logged and ignored.

- [ ] **Step 1: Write failing tests** with a `FakeWebSocket`. Its `receive_json` awaits an `asyncio.Queue`, and putting a `WebSocketDisconnect()` instance raises it. `sent` collects `send_json` payloads.
  - Monkeypatch:
    - `handler.manager.connect` to store the fake, and `manager.send_to_session` to append to `fake.sent`;
    - `handler.get_session` to return an object with `.data` containing title fields;
    - `handler.update_session`, `log_transcript`, `log_state_transition`, `save_turn_metrics` and `upsert_session_usage` to no-ops;
    - `handler.DeepgramTTSClient` to a fake whose `stream_tts` yields one `b"\x00\x00"`;
    - `handler._run_debrief` to an async recorder.
  - `test_interrupt_cancels_running_turn`: the fake LLM returns the intro instantly and blocks forever on the second call. Queue USER_UTTERANCE and then INTERRUPT. Under `asyncio.wait_for(..., 2)`, the handler returns, `_run_debrief` was called once, and the blocked call saw `CancelledError`.
  - `test_ping_pong`: queue PING, then a disconnect. `{"type":"PONG"}` is in `sent`.
- [ ] **Step 2:** Run the tests. Expected: FAIL (timeout).
- [ ] **Step 3: Implement the loop.** Run the intro itself as the first `turn_task`.

```python
recv = asyncio.create_task(websocket.receive_json())
while True:
    waiters = {recv}
    if ctx.turn_task and not ctx.turn_task.done():
        waiters.add(ctx.turn_task)
    done, _ = await asyncio.wait(waiters, timeout=CLOCK_TICK_S, return_when=asyncio.FIRST_COMPLETED)
    if ctx.turn_task and ctx.turn_task.done():
        ctx.turn_task = None
        if sm.current_state == InterviewState.GENERATING_DEBRIEF:
            recv.cancel(); break
    if recv in done:
        data = recv.result()          # raises WebSocketDisconnect -> existing except
        ...dispatch...                # INTERRUPT: cancel + await turn_task (suppress CancelledError), then force transition, break
        recv = asyncio.create_task(websocket.receive_json())
```

  - `CLOCK_TICK_S = 5.0`, where Task 8 hooks in. Cancel `recv` and `turn_task` in a `finally`.
  - The turn's own exceptions are logged, not raised: wrap the turn coroutines in `_run_turn(coro)`, which catches `Exception` and logs it.
- [ ] **Step 4:** Run the full suite. Expected: PASS.
- [ ] **Step 5:** Commit with "Backend: turns run beside the receive loop, so End and pings are handled mid-turn".

### Task 4: "Take a breath" opening; the interviewer speaks first

**Files:**
- Create: `app/extension/src/content/introGate.ts`, `app/extension/src/components/PreparingCard.tsx`, `app/extension/tests/introGate.test.ts`
- Modify: `app/extension/src/types.ts` (add `"PREPARING"` to `Phase`), `app/extension/src/content/useInterview.ts`, `app/extension/src/content/App.tsx`, `app/extension/src/styles/overlay.css`

**Interfaces:**
- Produces:
  - `export const MIN_CALM_MS = 5000`
  - `export class IntroGate<T> { offer(msg: T): boolean; open(): T[]; get isOpen(): boolean }`
    - `offer` returns true and holds `msg` while closed; once open, it returns false.
    - `open` returns held messages in arrival order exactly once (a later `open` returns `[]`).
  - `PreparingCard({ onCancel }: { onCancel: () => void })`
  - Phase `PREPARING` is entered right after the interview socket opens and lasts until the first intro audio plays.

- [ ] **Step 1: Write failing tests** in `tests/introGate.test.ts` (node:test plus `assert`):
  - Offering a, b while closed returns true, true; `open()` deep-equals `["a","b"]`.
  - After `open()`, `offer("c")` returns false and `isOpen` is true.
  - A second `open()` returns `[]`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `IntroGate`.**
- [ ] **Step 4: Wire into `useInterview.ts`.**
  - Add the timer key `"calm"` and a `gateRef`.
  - Before `ws.connect`, create a new `IntroGate`. The socket callback becomes `(msg) => { if (!gateRef.current?.offer(msg)) handleServerMessage(msg); }`.
  - Right after `ws.connect` resolves, call `applyPhase("PREPARING")`, then `setTimer("calm", openGate, MIN_CALM_MS)`. `openGate` replays `gate.open()` through `handleServerMessage`.
  - Delete `if (phaseRef.current === "CONNECTING") applyPhase("LISTENING")`.
  - Add `"PREPARING"` to `AUDIO_PHASES`.
  - In `AUDIO_FINISHED`, treat `PREPARING` like `THINKING`: hand the floor back.
  - In `handleSocketClose`, fail on `PREPARING` as well.
  - The mic stays closed because `syncSending` only sends in `LISTENING`.
- [ ] **Step 5: Create `PreparingCard`** and map `PREPARING` to it in `App.tsx`.
  - Layout:
    - a soft ring, `<span className="lv-breathe" aria-hidden="true" />`;
    - a title, role `status`: **Take a breath**;
    - body text: "Settle in. Your interviewer will open the conversation — just listen, then reply when it's your turn.";
    - a muted line: "Your mic stays off until then.";
    - a text button **Cancel** that calls `onCancel` (App passes `interview.reset`).
  - CSS: `.lv-breathe` is a 72px circle with the accent colour at low opacity. Inside `@media (prefers-reduced-motion: no-preference)` it runs the `lv-breathe` keyframes: 8s ease-in-out infinite, scale 0.85 to 1.1 and back. Reuse the existing tokens in `overlay.css`.
- [ ] **Step 6:** Run `npm test && npm run build`. Expected: PASS, build OK.
- [ ] **Step 7:** Commit with "Opening: a calm Take a breath screen, then the interviewer speaks first".

### Task 5: Client watchdogs, heartbeat, steadier playback

**Files:**
- Create: `app/extension/src/content/watchdog.ts`, `app/extension/tests/watchdog.test.ts`
- Modify: `app/extension/src/content/useInterview.ts`, `app/extension/src/components/LiveCard.tsx`, `app/extension/src/content/App.tsx`

**Interfaces:**
- Consumes: Task 3 (PONG), Task 4 (PREPARING).
- Produces:
  - `THINKING_SLOW_MS = 12_000`, `THINKING_TIMEOUT_MS = 45_000`, `SPEAKING_STALL_MS = 10_000`, `PREPARE_TIMEOUT_MS = 30_000`, `HEARTBEAT_MS = 10_000`, `SERVER_SILENCE_MS = 30_000`
  - `watchdogDelay(phase: Phase): number | null`: THINKING maps to THINKING_TIMEOUT_MS, AI_SPEAKING to SPEAKING_STALL_MS, PREPARING to PREPARE_TIMEOUT_MS, and everything else to null.
  - `useInterview` additionally returns `slow: boolean`. LiveCard takes `slow` and shows "Taking a moment…" instead of "Thinking…" when it is true.

- [ ] **Step 1: Write failing tests** for `watchdogDelay` covering all four branches.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the timer keys `"watchdog"`, `"slow"` and `"heartbeat"`.
  - `applyPhase` re-arms `"watchdog"` from `watchdogDelay(next)`, or clears it, and clears `slow`. On THINKING it also arms `"slow"` (THINKING_SLOW_MS) to set `slow` to true.
  - Each binary or AUDIO_CHUNK message re-arms the AI_SPEAKING watchdog. `AUDIO_FINISHED` clears it.
  - When the watchdog fires while still in that phase:
    - set the AI caption to `SORRY_TEXT`;
    - stop playback sources but keep the context, so add `stopSources()` split out of `stopPlayback`;
    - `applyPhase("LISTENING")`.
  - Heartbeat: every HEARTBEAT_MS, send `{type:"PING"}`. If `Date.now() - lastServerMsgRef.current > SERVER_SILENCE_MS` while in a live phase or PREPARING, fail with `CONNECTION_LOST`. `lastServerMsgRef` is updated on every server message, including PONG and before gating.
  - Change the playback prebuffer from `0.05` to `0.12`.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit with "Client: watchdogs hand the floor back after a stall, a heartbeat detects dead sockets, and a larger playback prebuffer".

### Task 6: Streaming LLM primitives

**Files:**
- Create: `app/backend/src/services/llm/streaming.py`, `app/backend/tests/test_streaming.py`
- Modify: `services/llm/base.py`, `nvidia_nim.py`, `openrouter.py`, `mock.py`

**Interfaces:**
- Produces:
  - `parse_sse_line(line: str) -> dict | None`. Returns parsed JSON for `data: {...}`, and None for blank lines, comments, `data: [DONE]` and bad JSON.
  - `class ThinkFilter: feed(text: str) -> str`. Drops everything between `<think>` and `</think>`, including when the tags are split across chunks.
  - `class ReplyParser(allowed_states: list[str], current_state: str)`:
    - `feed(text) -> list[str]` returns completed spoken sentences;
    - `finish() -> list[str]` returns the remainder, if it contains any non-whitespace;
    - `.state` holds the parsed state.
    - The first line must match `^STATE:\s*([A-Z_]+)\s*$`. A value not in `allowed_states` gives `current_state`.
    - If the first non-empty line is not a STATE line, `.state = current_state` and that line counts as speech.
    - A sentence ends at `.`, `?` or `!` followed by whitespace, once the buffered sentence is at least 24 characters.
    - `.text` holds all spoken text, stripped.
  - `LLMProvider.stream(messages, temperature=0.6, max_tokens=400) -> AsyncIterator[str]`. The default implementation yields `await self.generate(...)` once. NIM and OpenRouter override it with `self._client.stream("POST", url, json={..., "stream": True, "stream_options": {"include_usage": True}})`. They yield `choices[0].delta.content` (passed through ThinkFilter for NIM) and call `record_usage` on the chunk with `usage`.
  - `interview_stream_instructions(allowed: list[str], allow_silence: bool) -> str` gives the system-prompt suffix:
    - "Reply in this exact format. First line: STATE: <one of ...>. Then, on the next lines, what you say aloud in plain spoken words."
    - When `allow_silence` is true, it adds: "If the candidate is just thinking aloud while coding and nothing needs saying, write nothing after the STATE line."

- [ ] **Step 1: Write failing tests:**
  - `parse_sse_line`: valid, `[DONE]`, blank, `: comment`.
  - `ThinkFilter`: the chunks `"<thi"`, `"nk>x</th"`, `"ink>Hello"` give `"Hello"` in total.
  - `ReplyParser`:
    - (a) `"STATE: AWAITING_APPROACH\nGreat question. The input is sorted, so think about two pointers. "` fed in 5-char slices gives state AWAITING_APPROACH and the sentences `["Great question. The input is sorted, so think about two pointers."]` (the short first fragment is merged into the next sentence);
    - (b) an unknown state falls back to current;
    - (c) no STATE line means the whole text is speech;
    - (d) `"STATE: AWAITING_CODE\n"` with silence gives `.text == ""` and `finish() == []`.
  - `test_default_stream`: a provider whose `generate` returns "abc" streams `["abc"]`.
- [ ] **Step 2:** Run `pytest tests/test_streaming.py`. Expected: FAIL.
- [ ] **Step 3:** Implement. `mock.py` keeps the default `stream`, but its `generate` output for interview turns must still parse; if the mock returns JSON, the handler fallback in Task 7 covers it.
- [ ] **Step 4:** Run the full suite. Expected: PASS.
- [ ] **Step 5:** Commit with "LLM: streaming chat completions with usage, think-tag filter and a sentence parser for spoken replies".

### Task 7: Speak while the model is still writing; binary audio frames

**Files:**
- Modify: `app/backend/src/services/deepgram.py`, `websocket/manager.py`, `websocket/handler.py`; `app/extension/src/services/websocket.ts`, `app/extension/src/content/useInterview.ts`
- Test: `app/backend/tests/test_speak_stream.py`

**Interfaces:**
- Consumes: Task 6 (`ReplyParser`, `LLMProvider.stream`, `interview_stream_instructions`), Task 1 (`TurnMetrics`), Task 3 (turn tasks).
- Produces:
  - `DeepgramTTSClient.session() -> TTSSession`, an async context manager with one Aura socket per turn:
    - `async speak(text: str)` sends `Speak` and `Flush` and counts flushes;
    - `async end()` marks that no more text is coming;
    - `async audio() -> AsyncIterator[bytes]` yields audio until `end()` was called and `Flushed` count == flushes sent. It uses Task 2's RECV_TIMEOUT_S per receive.
  - `manager.send_bytes(session_id: str, data: bytes)`. Audio frames go to the client as raw binary of even length; an odd trailing byte is carried into the next frame.
  - JSON `AUDIO_CHUNK` is removed on both sides.
  - Server→client `AI_TEXT` is sent after each sentence with the accumulated text, and once at the end.
  - `handler._stream_turn(ctx, messages, state, kind) -> tuple[str, str | None]` returns (spoken text, next_state).
  - Client: `InterviewWebSocket.connect(sessionId, token, onMessage, onClose)`. Binary frames arrive in `onMessage` as `{ type: "AUDIO_CHUNK", pcm: ArrayBuffer }`; set `ws.binaryType = "arraybuffer"`. `playChunk(pcm: ArrayBuffer)`.

- [ ] **Step 1: Write failing tests** in `test_speak_stream.py`, with a fake LLM whose `stream` yields `"STATE: AWAITING_APPROACH\nFirst sentence is right here. Second one follows now. "` in 7-char chunks, and a fake TTSSession recording `speak` calls and yielding `b"\x01\x02\x03"` per speak:
  - `speak` was called twice, the first before the LLM stream finished (record the order of events);
  - `send_bytes` received only even-length frames;
  - it returns `("First sentence is right here. Second one follows now.", "AWAITING_APPROACH")`.
  - In a silent AWAITING_CODE case (`"STATE: AWAITING_CODE\n"`), there are no speak calls, `AUDIO_FINISHED` is sent, and the history gets an assistant entry `"(listens quietly)"`.
  - If the stream raises before any text, the turn falls back to `generate_structured(max_attempts=1)` and speaks its `response_text`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Backend.**
  - `_stream_turn` runs the producer and the consumer with `asyncio.gather`:
    - producer: `async for` tokens, then `parser.feed`, then `tts.speak` per sentence, then `parser.finish()` and `tts.end()`;
    - consumer: `async for` audio, then `send_bytes` with even-length framing.
  - The prompt is `build_interview_prompt` with `interview_stream_instructions(...)` appended to the system message, instead of the JSON instructions.
  - Silence is allowed only in AWAITING_CODE. Elsewhere an empty reply counts as a failure, and the turn falls back to structured output.
  - Metrics: `llm_first_token_ms`, `tts_first_audio_ms` and `first_audio_ms` (turn start to first frame sent), and tts_chars.
  - Apply the transition when `parser.state` is known, before speaking, and send `AUDIO_FINISHED` at the end.
  - `send_intro` and `_handle_user_utterance` both use `_stream_turn`. Delete the old `_speak` body, but keep a `_speak_fixed(ctx, text, state, kind)` helper that speaks fixed text through a `TTSSession`; Task 8 uses it.
- [ ] **Step 4: Client.**
  - In the `websocket.ts` onmessage: `event.data instanceof ArrayBuffer` gives `onMessage({type:"AUDIO_CHUNK", pcm:event.data})`; otherwise parse JSON as before.
  - In `useInterview.ts`, `playChunk` takes an `ArrayBuffer` (`new Int16Array(pcm, 0, pcm.byteLength >> 1)`). Delete `hexToBytes`.
- [ ] **Step 5:** Run the backend suite, then `npm test && npm run build`. Expected: PASS.
- [ ] **Step 6:** Commit with "Voice: stream the reply sentence by sentence into one TTS socket, binary audio frames, quiet turns while coding".

### Task 8: Deepgram Flux turn detection with Nova-3 fallback

**Files:**
- Create: `app/extension/src/services/stt.ts`, `app/extension/src/services/fluxStt.ts`, `app/extension/tests/flux.test.ts`
- Modify: `app/extension/src/services/deepgramStt.ts`, `app/extension/src/content/useInterview.ts`

**Interfaces:**
- Produces:
  - `stt.ts`:
    - `export interface SttCallbacks { onTranscript(text: string, isFinal: boolean, speechFinal: boolean): void; onUtteranceEnd(): void; onSpeechStarted(): void; onClose(): void }`, the same names as today's DeepgramSTT callbacks;
    - `export interface SttClient { connect(cb: SttCallbacks): Promise<void>; sendAudio(blob: Blob): void; keepAlive(): void; pause(): void; resume(): void; configure(stage: Stage): void; disconnect(): void }`.
  - `DeepgramSTT implements SttClient`, with a no-op `configure`.
  - `fluxStt.ts`:
    - `FLUX_URL = "wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.7&eot_timeout_ms=5000"`. Omit `encoding` and `sample_rate`: the stream is containerized WebM/Opus. Auth uses the same `["token", key]` subprotocol as v1.
    - `export type FluxEvent = { kind: "start" | "partial" | "end" | "ignore"; turnIndex: number; transcript: string }`
    - `export function parseFlux(msg: any): FluxEvent`. For `type === "TurnInfo"`: `StartOfTurn` is start; `Update`, `TurnResumed` and `EagerEndOfTurn` are partial; `EndOfTurn` is end. Anything else is ignore with turnIndex -1.
    - `export function fluxConfigureFor(stage: Stage | null): { type: "Configure"; thresholds: { eot_threshold: number; eot_timeout_ms: number } }`. AWAITING_CODE gives (0.8, 12000); AWAITING_APPROACH and AWAITING_WALKTHROUGH give (0.75, 7000); everything else (0.7, 5000).
    - `export class DeepgramFluxSTT implements SttClient`.
      - Audio is always sent, even while paused, because Flux has no KeepAlive message and an unknown message closes the stream. `keepAlive()` is a no-op.
      - While paused, events are dropped. `resume()` sets `turnFloor = lastTurnIndex + (turnOpen ? 1 : 0)`, and events with `turnIndex < turnFloor` are dropped.
      - Mapping: start calls `onSpeechStarted()`; partial calls `onTranscript(t, false, false)`; end calls `onTranscript(t, true, true)` and then `onUtteranceEnd()`.
      - `configure(stage)` sends `fluxConfigureFor(stage)` once the socket is open.
      - `disconnect()` sends `{"type":"CloseStream"}`, then closes.

- [ ] **Step 1: Write failing tests** for `parseFlux`: each event name; a non-TurnInfo message is ignore. Add `fluxConfigureFor` tests for the three stage groups and null.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `stt.ts`, `fluxStt.ts` and the `DeepgramSTT` changes. Copy the connect and timeout structure from `deepgramStt.ts`, reading the API key the same way.
- [ ] **Step 4: Wire into `useInterview.ts`.**
  - Type `sttRef` as `SttClient`.
  - `connectStt(callbacks)` tries `new DeepgramFluxSTT().connect(...)` first and falls back to `new DeepgramSTT()` on rejection, logging `console.warn("[LeeView] Flux unavailable, using Nova-3")`.
  - Change the `MediaRecorder` timeslice from 250 to 100ms.
  - On `STATE_CHANGED`, call `sttRef.current?.configure(state)`.
  - Throttle sends of `{type:"ACTIVITY"}` to one per 2s inside `onSpeechStarted`.
  - STT drop: when the STT `onClose` fires while live, try to reconnect up to 3 times per interview. Reconnect means a new client of the same class, then stop the old recorder and start a new one, because a new socket needs a fresh WebM header. Only after that fails, call `fail(STT_FAILED)`.
- [ ] **Step 5:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 6:** Commit with "STT: Deepgram Flux turn detection with stage-aware patience, Nova-3 fallback, and reconnect on drop".

### Task 9: Check-ins when the candidate goes quiet, and the 45-minute cap

**Files:**
- Create: `app/backend/src/websocket/clock.py`, `app/backend/tests/test_clock.py`
- Modify: `app/backend/src/websocket/handler.py`

**Interfaces:**
- Consumes: Task 3 (loop tick and `last_activity`), Task 7 (`_stream_turn`, `_speak_fixed`).
- Produces:
  - `clock.IDLE_NUDGE_S = 75`, `CODING_IDLE_NUDGE_S = 180`, `MAX_NUDGES_IN_ROW = 2`, `WARN_AT_S = 40 * 60`, `CAP_AT_S = 45 * 60`
  - `clock.timed_action(state: InterviewState, elapsed_s: float, idle_s: float, warned: bool, nudges_in_row: int) -> Literal["cap","warn","nudge"] | None`
    - It returns None in INTRO, GENERATING_DEBRIEF and COMPLETED.
    - Priority is cap, then warn, then nudge.
    - The nudge threshold is `CODING_IDLE_NUDGE_S` in AWAITING_CODE and `IDLE_NUDGE_S` otherwise. There is no nudge once `nudges_in_row >= MAX_NUDGES_IN_ROW`.
  - `_InterviewContext.warned: bool = False` and `nudges_in_row: int = 0`. A user utterance resets `nudges_in_row`.

- [ ] **Step 1: Write failing tests** for `timed_action`:
  - (AWAITING_APPROACH, 100, 80, False, 0) gives `"nudge"`;
  - (AWAITING_CODE, 100, 80, False, 0) gives None;
  - (AWAITING_CODE, 100, 200, False, 0) gives `"nudge"`;
  - nudges_in_row=2 gives None;
  - elapsed 2400 with warned False gives `"warn"`;
  - elapsed 2700 gives `"cap"`, even when idle;
  - INTRO gives None.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** `clock.py`. In the handler loop, after each wait, when no turn is running, call `timed_action`:
  - **nudge:** start a turn `_stream_turn` (kind `"nudge"`) whose newest message is the user-role note `"(No reply from the candidate for about N seconds. Check in briefly and kindly, offering a small hint only if they seem stuck.)"`. This note is not stored in history as the candidate. Then `nudges_in_row += 1`.
  - **warn:** `_speak_fixed(ctx, "Quick heads-up: we have about five minutes left.", state, "notice")` and `warned = True`.
  - **cap:** `_speak_fixed(ctx, "We're at time, so let's stop here. I'll put together your feedback now.", state, "notice")`, then `force_transition(GENERATING_DEBRIEF)` and `_on_transition(..., "TIMEOUT")`. The loop's natural end then runs the debrief.
  - Set `last_activity = time.monotonic()` when any turn finishes.
- [ ] **Step 4:** Run the full suite. Expected: PASS.
- [ ] **Step 5:** Commit with "Interview: gentle check-ins after long silence, a five-minute warning and a 45-minute cap".

### Task 10: Debrief for dropped interviews; drop the unused SDK

**Files:**
- Modify: `app/backend/src/websocket/handler.py`, `app/extension/package.json` and `package-lock.json` (via npm)
- Test: `app/backend/tests/test_receive_loop.py` (extend)

**Interfaces:**
- Consumes: Task 3 (`user_turns`).
- Produces: `handler.MIN_TURNS_FOR_DEBRIEF = 3`. On disconnect with `ctx.user_turns >= 3`, `_run_debrief(ctx)` runs (its sends fail quietly); otherwise the session is INTERRUPTED as today.

- [ ] **Step 1: Write failing tests:**
  - 3 USER_UTTERANCEs (the fake LLM answers instantly), then a disconnect: `_run_debrief` is called once.
  - 1 utterance, then a disconnect: it is not called.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** In `app/extension`, run `npm uninstall @deepgram/sdk`; `grep -r "@deepgram/sdk" src` must return nothing. Then run `npm test && npm run build`.
- [ ] **Step 5:** Run the full backend suite. Expected: PASS.
- [ ] **Step 6:** Commit with "Debrief: score interviews that drop after real progress; remove the unused Deepgram SDK".

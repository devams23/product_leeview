import { useEffect, useRef, useState } from "react";
import type { AuthState, Caption, Debrief, InterviewError, Phase, Stage } from "../types";
import { InterviewWebSocket, createSession, rejectionError } from "../services/websocket";
import { DeepgramSTT } from "../services/deepgramStt";
import { DeepgramFluxSTT } from "../services/fluxStt";
import type { SttCallbacks, SttClient } from "../services/stt";
import { fetchSttToken } from "../services/sttToken";
import { TypedError, makeError, toInterviewError } from "../services/errors";
import { getProblemData, slugFromPath } from "../utils/domScraper";
import { IntroGate, MIN_CALM_MS } from "./introGate";
import {
  HEARTBEAT_MS,
  SERVER_SILENCE_MS,
  SPEAKING_STALL_MS,
  THINKING_SLOW_MS,
  watchdogDelay,
} from "./watchdog";

const PLAYBACK_SAMPLE_RATE = 24000;
// Audio scheduled this far ahead of "now" so the first chunks don't underrun.
const PLAYBACK_PREBUFFER_S = 0.12;
// Silence after the last final segment before the utterance is sent (spec §5).
const FLUSH_DELAY_MS = 1200;
const KEEPALIVE_MS = 5000;
// Audio chunk size sent to STT; small enough that a turn's end is noticed quickly.
const RECORDER_TIMESLICE_MS = 100;
// Candidate-activity pings to the backend, so its idle check-ins don't cut in mid-sentence.
const ACTIVITY_MS = 2000;
// Across the whole interview, not per drop.
const STT_RECONNECT_LIMIT = 3;
const ELAPSED_TICK_MS = 1000;
const LEVEL_TICK_MS = 50;
const DRAIN_PADDING_MS = 150;
const DEBRIEF_TIMEOUT_MS = 90_000;
const SLUG_POLL_MS = 1000;
const SORRY_TEXT = "Sorry, something glitched — could you repeat that?";
const PREPARE_FALLBACK_TEXT = "Whenever you're ready, say hello and we'll begin.";

// Server ERROR codes that come just before it closes the socket with code 1008.
const REFUSALS: ReadonlySet<string> = new Set([
  "KEYS_MISSING", "SESSION_ENDED", "SESSION_BUSY", "SESSION_UNAVAILABLE",
]);

const LIVE_PHASES: ReadonlySet<Phase> = new Set<Phase>(["LISTENING", "AI_SPEAKING", "THINKING"]);
// Phases in which server audio is still played.
const AUDIO_PHASES: ReadonlySet<Phase> = new Set<Phase>(["CONNECTING", "PREPARING", "LISTENING", "AI_SPEAKING", "THINKING"]);
const STAGES: ReadonlySet<string> = new Set<string>([
  "INTRO", "AWAITING_CLARIFICATION", "AWAITING_APPROACH", "AWAITING_CODE",
  "AWAITING_WALKTHROUGH", "CONCLUDING", "GENERATING_DEBRIEF", "COMPLETED",
]);

type TimerKey = "flush" | "drain" | "elapsed" | "keepAlive" | "level" | "debrief" | "calm"
  | "watchdog" | "slow" | "heartbeat";

type SttKind = "flux" | "nova";
/** Holds the client once connected, so its close callback can tell whether it is still current. */
type SttConnection = { client: SttClient | null };

function joinText(a: string, b: string): string {
  return [a.trim(), b.trim()].filter(Boolean).join(" ");
}

function micError(err: unknown): InterviewError {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return makeError("MIC_DENIED");
  return makeError("MIC_UNAVAILABLE");
}

/**
 * Drives one voice interview: mic -> Deepgram STT -> backend WebSocket -> streamed PCM playback.
 *
 * Phase is mirrored in `phaseRef` so async callbacks (socket, STT, timers) always read the
 * current value instead of a stale closure. Every async step checks a generation counter
 * so a reset/unmount mid-connect cannot resurrect a torn-down interview.
 */
export function useInterview(auth: AuthState): {
  phase: Phase; stage: Stage | null; elapsedSeconds: number; voiceLevel: number; // 0..1
  muted: boolean; toggleMute(): void;
  aiCaption: Caption | null; userCaption: Caption | null;
  debrief: Debrief | null; sessionId: string | null; error: InterviewError | null;
  slow: boolean; // the interviewer has been thinking for a while
  start(): Promise<void>; end(): void; reset(): void; // reset -> IDLE, full cleanup
} {
  const [phase, setPhaseState] = useState<Phase>("IDLE");
  const [stage, setStage] = useState<Stage | null>(null);
  const [elapsedSeconds, setElapsed] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [aiCaption, setAiCaption] = useState<Caption | null>(null);
  const [userCaption, setUserCaption] = useState<Caption | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<InterviewError | null>(null);
  const [slow, setSlow] = useState(false);

  const phaseRef = useRef<Phase>("IDLE");
  // Time of the last message from the server, including PONG; drives the dead-socket check.
  const lastServerMsgRef = useRef(0);
  const mutedRef = useRef(false);
  const authRef = useRef(auth);
  authRef.current = auth;
  const generationRef = useRef(0);
  const slugRef = useRef<string | null>(null);

  const wsRef = useRef<InterviewWebSocket | null>(null);
  // Holds the opening audio until the calm screen has been shown for MIN_CALM_MS.
  const gateRef = useRef<IntroGate<any> | null>(null);
  const sttRef = useRef<SttClient | null>(null);
  const sttKindRef = useRef<SttKind>("flux");
  const sttReconnectsRef = useRef(0);
  const lastActivityRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const micCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const levelRef = useRef(0);

  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  // Sits between TTS playback and the speakers so the orb can follow the interviewer's voice.
  const playAnalyserRef = useRef<AnalyserNode | null>(null);

  // Final transcript segments waiting to be sent as one utterance, plus the live interim tail.
  const bufferRef = useRef("");
  const interimRef = useRef("");

  const timersRef = useRef<Partial<Record<TimerKey, number>>>({});

  // ---- phase -------------------------------------------------------------

  function syncSending() {
    const sending = phaseRef.current === "LISTENING" && !mutedRef.current;
    if (sending) sttRef.current?.resume();
    else sttRef.current?.pause();
    // Flux gets audio even while paused, so the calm opening also mutes the mic itself.
    const micOn = !mutedRef.current && phaseRef.current !== "PREPARING";
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }

  function applyPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
    if (next !== "LISTENING") {
      // Anything half-heard is stale once the mic is closed for a turn.
      bufferRef.current = "";
      interimRef.current = "";
      clearTimer("flush");
      setUserCaption((c) => (c && c.final ? c : null));
    }
    clearTimer("slow");
    setSlow(false);
    armWatchdog(next);
    if (next === "THINKING") setTimer("slow", () => setSlow(true), THINKING_SLOW_MS);
    syncSending();
  }

  /** Arms the phase's watchdog, or clears it for phases that have none. */
  function armWatchdog(phase: Phase) {
    clearTimer("watchdog");
    const delay = watchdogDelay(phase);
    if (delay === null) return;
    setTimer("watchdog", () => onWatchdog(phase), delay);
  }

  /** A phase outlived its timeout: apologise, stop the audio, and hand the floor back. */
  function onWatchdog(expected: Phase) {
    if (phaseRef.current !== expected) return;
    clearTimer("drain");
    // A stalled opening has nothing to apologise for yet: invite the candidate to start instead.
    const text = expected === "PREPARING" ? PREPARE_FALLBACK_TEXT : SORRY_TEXT;
    setAiCaption({ speaker: "AI", text, final: true });
    stopSources();
    applyPhase("LISTENING");
  }

  // ---- timers ------------------------------------------------------------

  function clearTimer(key: TimerKey) {
    const id = timersRef.current[key];
    if (id === undefined) return;
    window.clearTimeout(id);
    window.clearInterval(id);
    delete timersRef.current[key];
  }

  function clearAllTimers() {
    (Object.keys(timersRef.current) as TimerKey[]).forEach(clearTimer);
  }

  function setTimer(key: TimerKey, fn: () => void, ms: number, repeat = false) {
    clearTimer(key);
    timersRef.current[key] = repeat
      ? window.setInterval(fn, ms)
      : window.setTimeout(() => {
          delete timersRef.current[key];
          fn();
        }, ms);
  }

  // ---- teardown ----------------------------------------------------------

  /** Stops queued and playing audio but keeps the playback context alive. */
  function stopSources() {
    sourcesRef.current.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // already stopped
      }
    });
    sourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
  }

  function stopPlayback() {
    stopSources();
    const ctx = playCtxRef.current;
    playCtxRef.current = null;
    playAnalyserRef.current = null;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
  }

  function stopRecorder() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onerror = null;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
    }
  }

  function teardownMedia() {
    stopRecorder();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    analyserRef.current = null;
    samplesRef.current = null;
    levelRef.current = 0;
    const micCtx = micCtxRef.current;
    micCtxRef.current = null;
    if (micCtx && micCtx.state !== "closed") micCtx.close().catch(() => {});

    stopPlayback();
  }

  function teardownNetwork() {
    const ws = wsRef.current;
    wsRef.current = null;
    ws?.disconnect();
    const stt = sttRef.current;
    sttRef.current = null;
    stt?.disconnect();
  }

  /** Stops everything and bumps the generation so in-flight start() steps abort. */
  function cleanupAll() {
    generationRef.current += 1;
    clearAllTimers();
    gateRef.current = null;
    teardownNetwork();
    teardownMedia();
    bufferRef.current = "";
    interimRef.current = "";
  }

  function fail(err: InterviewError) {
    cleanupAll();
    setVoiceLevel(0);
    setError(err);
    applyPhase("ERROR");
  }

  // ---- speech in ---------------------------------------------------------

  function flushUtterance() {
    clearTimer("flush");
    const text = bufferRef.current.trim();
    bufferRef.current = "";
    interimRef.current = "";
    if (!text || phaseRef.current !== "LISTENING") return;

    setUserCaption({ speaker: "USER", text, final: true });
    // Half-duplex: the mic is closed from this moment until the AI turn finishes.
    applyPhase("THINKING");

    const gen = generationRef.current;
    getProblemData()
      .catch(() => ({ code: "", language: "python" }))
      .then((data: { code: string; language: string }) => {
        if (gen !== generationRef.current) return;
        wsRef.current?.send({
          type: "USER_UTTERANCE",
          text,
          current_code: data.code,
          language: data.language,
        });
      });
  }

  function onTranscript(text: string, isFinal: boolean, speechFinal: boolean) {
    if (phaseRef.current !== "LISTENING") return;
    const t = text.trim();
    if (!t) return;

    // Any new words mean the speaker is still going: cancel a pending flush.
    clearTimer("flush");
    if (isFinal) {
      bufferRef.current = joinText(bufferRef.current, t);
      interimRef.current = "";
    } else {
      interimRef.current = t;
      noteActivity();
    }
    setUserCaption({
      speaker: "USER",
      text: joinText(bufferRef.current, interimRef.current),
      final: false,
    });

    if (isFinal && speechFinal) {
      setTimer("flush", flushUtterance, FLUSH_DELAY_MS);
    }
  }

  function onUtteranceEnd() {
    if (phaseRef.current === "LISTENING" && bufferRef.current.trim()) {
      flushUtterance();
    }
  }

  function onSpeechStarted() {
    clearTimer("flush");
    noteActivity();
  }

  /** Tells the backend the candidate is still talking, at most once per ACTIVITY_MS. */
  function noteActivity() {
    if (phaseRef.current !== "LISTENING") return;
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_MS) return;
    lastActivityRef.current = now;
    wsRef.current?.send({ type: "ACTIVITY" });
  }

  // ---- speech out --------------------------------------------------------

  function playChunk(pcm: ArrayBuffer) {
    const ctx = playCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    const sampleCount = pcm.byteLength >> 1;
    if (sampleCount === 0) return;
    const int16 = new Int16Array(pcm, 0, sampleCount);

    const float32 = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, sampleCount, PLAYBACK_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(playAnalyserRef.current ?? ctx.destination);

    const now = ctx.currentTime;
    if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now + PLAYBACK_PREBUFFER_S;
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;

    sourcesRef.current.add(source);
    source.onended = () => {
      sourcesRef.current.delete(source);
    };
  }

  // ---- server messages ---------------------------------------------------

  function startDebriefTimer() {
    setTimer("debrief", () => {
      if (phaseRef.current === "GENERATING_DEBRIEF") fail(makeError("DEBRIEF_TIMEOUT"));
    }, DEBRIEF_TIMEOUT_MS);
  }

  function handleServerMessage(msg: any) {
    switch (msg?.type) {
      case "AUDIO_CHUNK": {
        const p = phaseRef.current;
        if (!AUDIO_PHASES.has(p)) return;
        clearTimer("drain");
        if (p !== "AI_SPEAKING") applyPhase("AI_SPEAKING");
        else armWatchdog("AI_SPEAKING"); // audio is still flowing: restart the stall timer
        playChunk(msg.pcm);
        return;
      }

      case "AUDIO_FINISHED": {
        clearTimer("drain");
        clearTimer("watchdog");
        const p = phaseRef.current;
        if (p === "THINKING" || p === "PREPARING") {
          // Turn ended without audio (e.g. LLM failure, or an opening that had none): hand the floor back.
          applyPhase("LISTENING");
        } else if (p === "AI_SPEAKING") {
          // Wait for queued audio to drain before listening again.
          const ctx = playCtxRef.current;
          const remainingMs = ctx
            ? Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000)
            : 0;
          setTimer("drain", () => {
            if (phaseRef.current === "AI_SPEAKING") applyPhase("LISTENING");
          }, remainingMs + DRAIN_PADDING_MS);
        }
        return;
      }

      case "AI_THINKING":
        if (LIVE_PHASES.has(phaseRef.current)) applyPhase("THINKING");
        return;

      case "AI_TEXT":
        if (typeof msg.text === "string") {
          setAiCaption({ speaker: "AI", text: msg.text, final: true });
        }
        return;

      case "STATE_CHANGED":
        if (typeof msg.state === "string" && STAGES.has(msg.state)) {
          setStage(msg.state as Stage);
          sttRef.current?.configure(msg.state as Stage);
        }
        return;

      case "ERROR":
        console.warn("[LeeView] server error:", msg.code, msg.message);
        // A refused session: the close that follows carries the reason, handled there.
        if (REFUSALS.has(msg.code)) return;
        setAiCaption({ speaker: "AI", text: SORRY_TEXT, final: true });
        if (phaseRef.current === "THINKING") applyPhase("LISTENING");
        return;

      case "DEBRIEF_GENERATING": {
        const p = phaseRef.current;
        if (p === "DEBRIEF_READY" || p === "ERROR" || p === "IDLE") return;
        applyPhase("GENERATING_DEBRIEF");
        startDebriefTimer();
        return;
      }

      case "DEBRIEF_READY":
        clearTimer("debrief");
        setDebrief((msg.data ?? null) as Debrief | null);
        if (typeof msg.session_id === "string") setSessionId(msg.session_id);
        teardownNetwork();
        setVoiceLevel(0);
        applyPhase("DEBRIEF_READY");
        return;

      case "DEBRIEF_FAILED":
        clearTimer("debrief");
        console.warn("[LeeView] debrief failed:", msg.message);
        fail(makeError("DEBRIEF_FAILED"));
        return;

      default:
        return;
    }
  }

  function handleSocketClose(ws: InterviewWebSocket, ev: CloseEvent) {
    if (wsRef.current !== ws) return;
    wsRef.current = null;
    const p = phaseRef.current;
    if (ev.code === 1008 && p !== "DEBRIEF_READY" && p !== "IDLE" && p !== "ERROR") {
      fail(toInterviewError(rejectionError(ev.reason), "UNKNOWN"));
    } else if (p === "GENERATING_DEBRIEF") {
      fail(makeError("DEBRIEF_FAILED", "The connection closed before your debrief was ready."));
    } else if (p === "PREFLIGHT" || p === "CONNECTING" || p === "PREPARING" || LIVE_PHASES.has(p)) {
      fail(makeError("CONNECTION_LOST"));
    }
  }

  // ---- heartbeat ---------------------------------------------------------

  function heartbeatTick() {
    wsRef.current?.send({ type: "PING" });
    const p = phaseRef.current;
    const awaitingServer = LIVE_PHASES.has(p) || p === "PREPARING";
    if (awaitingServer && Date.now() - lastServerMsgRef.current > SERVER_SILENCE_MS) {
      fail(makeError("CONNECTION_LOST"));
    }
  }

  // ---- mic ---------------------------------------------------------------

  function startLevelMeter(stream: MediaStream) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      micCtxRef.current = ctx;
      analyserRef.current = analyser;
      samplesRef.current = new Float32Array(analyser.fftSize);
      ctx.resume().catch(() => {});
    } catch {
      // The level meter is cosmetic; the interview works without it.
    }
  }

  function tickLevel() {
    // Follow whoever is talking: the mic while listening, TTS playback while the interviewer speaks.
    const phase = phaseRef.current;
    const analyser = phase === "AI_SPEAKING"
      ? playAnalyserRef.current
      : phase === "LISTENING" && !mutedRef.current ? analyserRef.current : null;
    const samples = samplesRef.current;
    let target = 0;
    if (analyser && samples && samples.length === analyser.fftSize) {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      target = Math.min(1, Math.sqrt(sum / samples.length) * 4);
    }
    levelRef.current = levelRef.current * 0.6 + target * 0.4;
    const next = Math.round(levelRef.current * 100) / 100;
    setVoiceLevel((prev) => (Math.abs(prev - next) < 0.02 ? prev : next));
  }

  function startRecorder(stream: MediaStream, stt: SttClient) {
    stopRecorder();
    const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined;
    const recorder = new MediaRecorder(stream, options);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && sttRef.current === stt) stt.sendAudio(event.data);
    };
    // A new recorder writes a fresh WebM header, which a new socket needs before any audio.
    recorder.start(RECORDER_TIMESLICE_MS);
  }

  // ---- speech-to-text connection -----------------------------------------

  function sttCallbacks(gen: number, conn: SttConnection): SttCallbacks {
    return {
      onTranscript,
      onUtteranceEnd,
      onSpeechStarted,
      onClose: () => handleSttClose(gen, conn),
    };
  }

  /** A fresh short-lived Deepgram token per socket, minted by the backend from the user's key. */
  function sttToken(): Promise<string> {
    const token = authRef.current.token;
    if (!token) return Promise.reject(new TypedError("AUTH_EXPIRED"));
    return fetchSttToken(token);
  }

  /** Flux first; Nova-3 only when Flux fails to connect at all. Reconnects keep the same class. */
  async function connectStt(
    callbacks: SttCallbacks,
    kind: SttKind,
  ): Promise<{ client: SttClient; kind: SttKind }> {
    if (kind === "nova") {
      const nova = new DeepgramSTT(await sttToken());
      await nova.connect(callbacks);
      return { client: nova, kind: "nova" };
    }
    // Token errors (missing or rejected key, expired sign-in) are not a reason to try Nova-3.
    const flux = new DeepgramFluxSTT(await sttToken());
    try {
      await flux.connect(callbacks);
      return { client: flux, kind: "flux" };
    } catch {
      console.warn("[LeeView] Flux unavailable, using Nova-3");
      const nova = new DeepgramSTT(await sttToken());
      await nova.connect(callbacks);
      return { client: nova, kind: "nova" };
    }
  }

  function needsStt(p: Phase): boolean {
    return p === "PREPARING" || LIVE_PHASES.has(p);
  }

  function handleSttClose(gen: number, conn: SttConnection) {
    if (gen !== generationRef.current || !conn.client || sttRef.current !== conn.client) return;
    sttRef.current = null;
    stopRecorder();
    if (needsStt(phaseRef.current)) void reconnectStt(gen);
  }

  /** Retries a dropped STT socket with a fresh recorder, until the interview's budget runs out. */
  async function reconnectStt(gen: number) {
    while (gen === generationRef.current && sttReconnectsRef.current < STT_RECONNECT_LIMIT) {
      sttReconnectsRef.current += 1;
      const conn: SttConnection = { client: null };
      try {
        const { client, kind } = await connectStt(sttCallbacks(gen, conn), sttKindRef.current);
        const stream = streamRef.current;
        if (gen !== generationRef.current || !stream || !needsStt(phaseRef.current)) {
          client.disconnect();
          return;
        }
        conn.client = client;
        sttRef.current = client;
        sttKindRef.current = kind;
        syncSending();
        startRecorder(stream, client);
        return;
      } catch (err) {
        // Keys or sign-in problems will not fix themselves on a retry.
        if (err instanceof TypedError && !err.retryable) {
          if (gen === generationRef.current) fail(toInterviewError(err, "STT_FAILED"));
          return;
        }
        // Otherwise try again while the budget lasts.
      }
    }
    if (gen === generationRef.current && needsStt(phaseRef.current)) {
      fail(makeError("STT_FAILED"));
    }
  }

  // ---- public API --------------------------------------------------------

  function reset() {
    cleanupAll();
    phaseRef.current = "IDLE";
    setPhaseState("IDLE");
    setStage(null);
    setElapsed(0);
    setVoiceLevel(0);
    setMuted(false);
    mutedRef.current = false;
    setAiCaption(null);
    setUserCaption(null);
    setDebrief(null);
    setSessionId(null);
    setError(null);
    setSlow(false);
  }

  async function start(): Promise<void> {
    const current = phaseRef.current;
    if (current !== "IDLE" && current !== "ERROR" && current !== "DEBRIEF_READY") return;

    cleanupAll();
    const gen = generationRef.current;
    const isStale = () => gen !== generationRef.current;

    slugRef.current = slugFromPath(window.location.pathname);
    sttReconnectsRef.current = 0;
    sttKindRef.current = "flux";
    setDebrief(null);
    setSessionId(null);
    setError(null);
    setSlow(false);
    setAiCaption(null);
    setUserCaption(null);
    setStage(null);
    setElapsed(0);
    setVoiceLevel(0);
    setMuted(false);
    mutedRef.current = false;
    setTimer("elapsed", () => {
      if (LIVE_PHASES.has(phaseRef.current)) setElapsed((s) => s + 1);
    }, ELAPSED_TICK_MS, true);

    const { token, status } = authRef.current;
    if (status !== "signed_in" || !token) {
      fail(makeError("AUTH_EXPIRED"));
      return;
    }

    // Created synchronously inside the click so Chrome's autoplay policy allows it.
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const playback: AudioContext = new Ctx();
      playCtxRef.current = playback;
      const playAnalyser = playback.createAnalyser();
      playAnalyser.fftSize = 1024;
      playAnalyser.connect(playback.destination);
      playAnalyserRef.current = playAnalyser;
      nextPlayTimeRef.current = 0;
      playback.resume().catch(() => {});
    } catch {
      playCtxRef.current = null;
      playAnalyserRef.current = null;
    }

    applyPhase("PREFLIGHT");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (!isStale()) fail(micError(err));
      return;
    }
    if (isStale()) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (streamRef.current === stream && LIVE_PHASES.has(phaseRef.current)) {
          fail(makeError("MIC_UNAVAILABLE", "Your microphone was disconnected."));
        }
      });
    });
    startLevelMeter(stream);
    setTimer("level", tickLevel, LEVEL_TICK_MS, true);

    applyPhase("CONNECTING");
    try {
      const problem = await getProblemData();
      if (isStale()) return;

      const newSessionId = await createSession(
        token,
        problem.slug,
        problem.title,
        problem.difficulty,
        problem.description,
        problem.topics,
        problem.language,
      );
      if (isStale()) return;
      setSessionId(newSessionId);

      // The gate is in place before the socket opens, so no opening message can slip past it.
      const gate = new IntroGate<any>();
      gateRef.current = gate;
      const ws = new InterviewWebSocket();
      wsRef.current = ws;
      await ws.connect(
        newSessionId,
        token,
        (msg) => {
          lastServerMsgRef.current = Date.now();
          if (!gateRef.current?.offer(msg)) handleServerMessage(msg);
        },
        (ev) => handleSocketClose(ws, ev),
      );
      if (isStale()) return;

      lastServerMsgRef.current = Date.now();
      setTimer("heartbeat", heartbeatTick, HEARTBEAT_MS, true);
      applyPhase("PREPARING");
      setTimer("calm", () => {
        if (isStale()) return;
        gate.open().forEach(handleServerMessage);
      }, MIN_CALM_MS);

      const conn: SttConnection = { client: null };
      const { client: stt, kind } = await connectStt(sttCallbacks(gen, conn), "flux");
      if (isStale()) {
        stt.disconnect();
        return;
      }

      conn.client = stt;
      sttRef.current = stt;
      sttKindRef.current = kind;
      syncSending();
      startRecorder(stream, stt);
      setTimer("keepAlive", () => sttRef.current?.keepAlive(), KEEPALIVE_MS, true);
    } catch (err) {
      if (isStale()) return;
      fail(toInterviewError(err, "UNKNOWN"));
    }
  }

  function end() {
    const p = phaseRef.current;
    if (p === "GENERATING_DEBRIEF" || p === "DEBRIEF_READY") return;
    if (!LIVE_PHASES.has(p)) {
      reset();
      return;
    }

    // Keep the socket open: the backend answers INTERRUPT with the debrief.
    wsRef.current?.send({ type: "INTERRUPT" });
    clearAllTimers();
    const stt = sttRef.current;
    sttRef.current = null;
    stt?.disconnect();
    teardownMedia();
    setVoiceLevel(0);
    applyPhase("GENERATING_DEBRIEF");
    startDebriefTimer();
  }

  function toggleMute() {
    if (!LIVE_PHASES.has(phaseRef.current)) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      // Muted means "not listening": discard whatever was half-heard.
      bufferRef.current = "";
      interimRef.current = "";
      clearTimer("flush");
      setUserCaption((c) => (c && c.final ? c : null));
    }
    syncSending();
  }

  // Watch the page: a different problem invalidates the interview.
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = phaseRef.current;
      if (p === "IDLE" || p === "DEBRIEF_READY" || p === "GENERATING_DEBRIEF") return;
      if (slugFromPath(window.location.pathname) !== slugRef.current) reset();
    }, SLUG_POLL_MS);
    return () => window.clearInterval(id);
    // reset only touches refs and state setters, so the first-render closure is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Release everything on unmount.
  useEffect(() => () => cleanupAll(), []);

  return {
    phase,
    stage,
    elapsedSeconds,
    voiceLevel,
    muted,
    toggleMute,
    aiCaption,
    userCaption,
    debrief,
    sessionId,
    error,
    slow,
    start,
    end,
    reset,
  };
}

import type { Stage } from "../types";
import type { SttCallbacks, SttClient } from "./stt";

// Type-only imports above, so this module can be loaded by node:test without Vite's env.
// The API key is passed in by the caller for the same reason.

export const FLUX_URL =
  "wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.7&eot_timeout_ms=5000";
const CONNECT_TIMEOUT_MS = 10_000;

export type FluxEvent = { kind: "start" | "partial" | "end" | "ignore"; turnIndex: number; transcript: string };

const IGNORED: FluxEvent = { kind: "ignore", turnIndex: -1, transcript: "" };

export function parseFlux(msg: any): FluxEvent {
  if (msg?.type !== "TurnInfo") return IGNORED;
  const turnIndex = Number.isInteger(msg.turn_index) ? (msg.turn_index as number) : -1;
  if (turnIndex < 0) return IGNORED;
  const transcript = typeof msg.transcript === "string" ? msg.transcript : "";
  switch (msg.event) {
    case "StartOfTurn":
      return { kind: "start", turnIndex, transcript };
    case "Update":
    case "TurnResumed":
    case "EagerEndOfTurn":
      return { kind: "partial", turnIndex, transcript };
    case "EndOfTurn":
      return { kind: "end", turnIndex, transcript };
    default:
      return IGNORED;
  }
}

/** Patience per stage: longer while the candidate is likely still working out code. */
export function fluxConfigureFor(stage: Stage | null): {
  type: "Configure";
  thresholds: { eot_threshold: number; eot_timeout_ms: number };
} {
  let eot_threshold = 0.7;
  let eot_timeout_ms = 5000;
  if (stage === "AWAITING_CODE") {
    eot_threshold = 0.8;
    eot_timeout_ms = 12000;
  } else if (stage === "AWAITING_APPROACH" || stage === "AWAITING_WALKTHROUGH") {
    eot_threshold = 0.75;
    eot_timeout_ms = 7000;
  }
  return { type: "Configure", thresholds: { eot_threshold, eot_timeout_ms } };
}

export class DeepgramFluxSTT implements SttClient {
  private socket: WebSocket | null = null;
  private callbacks: SttCallbacks | null = null;
  // Set once the server sends Connected.
  private ready = false;
  private closedByUs = false;
  private stage: Stage | null = null;
  // Audio is held back from events while paused; the turn bookkeeping below still runs.
  private paused = true;
  private turnOpen = false;
  private lastTurnIndex = -1;
  // Events for turns below this index began before the last resume and are dropped.
  private turnFloor = 0;
  private readonly apiKey: string;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey || "";
  }

  connect(callbacks: SttCallbacks): Promise<void> {
    this.callbacks = callbacks;
    if (!this.apiKey) {
      return Promise.reject(new Error("Missing Deepgram key"));
    }

    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(FLUX_URL, ["token", this.apiKey]);
      this.socket = socket;
      let connected = false;

      const timeoutId = window.setTimeout(() => {
        if (!connected) fail("Flux did not connect in time");
      }, CONNECT_TIMEOUT_MS);

      const fail = (reason: string) => {
        window.clearTimeout(timeoutId);
        reject(new Error(reason));
        if (this.socket === socket) {
          this.socket = null;
          this.ready = false;
        }
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };

      socket.onmessage = (event) => {
        let msg: any;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!connected) {
          if (msg?.type === "Connected") {
            connected = true;
            window.clearTimeout(timeoutId);
            this.ready = true;
            if (this.stage !== null) this.sendConfigure();
            resolve();
          } else if (msg?.type === "Error") {
            fail("Flux reported an error before connecting");
          }
          return;
        }
        this.handleMessage(msg);
      };

      socket.onerror = () => {
        // onclose always follows; handled there.
      };

      socket.onclose = () => {
        window.clearTimeout(timeoutId);
        if (this.socket === socket) {
          this.socket = null;
          this.ready = false;
        }
        if (!connected) {
          reject(new Error("Flux socket closed before connecting"));
          return;
        }
        if (!this.closedByUs) this.callbacks?.onClose();
      };
    });
  }

  private handleMessage(msg: any) {
    if (msg?.type === "ConfigureFailure") {
      console.warn("[LeeView] Flux rejected configure:", msg);
      return;
    }
    if (msg?.type === "Error") {
      // The server closes the stream after an Error; onclose reports it.
      console.warn("[LeeView] Flux error:", msg);
      return;
    }

    const ev = parseFlux(msg);
    if (ev.kind === "ignore") return;

    if (ev.kind === "end") {
      this.turnOpen = false;
    } else {
      this.turnOpen = true;
    }
    this.lastTurnIndex = ev.turnIndex;

    if (this.paused || ev.turnIndex < this.turnFloor) return;
    const cb = this.callbacks;
    if (!cb) return;

    if (ev.kind === "start") {
      cb.onSpeechStarted();
    } else if (ev.kind === "partial") {
      cb.onTranscript(ev.transcript, false, false);
    } else {
      cb.onTranscript(ev.transcript, true, true);
      cb.onUtteranceEnd();
    }
  }

  private sendConfigure() {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(fluxConfigureFor(this.stage)));
    }
  }

  /**
   * Always forwards the blob, even while paused: Flux has no KeepAlive, so the stream must
   * keep flowing. Pausing only stops the events from reaching the interview.
   */
  sendAudio(blob: Blob) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(blob);
  }

  /** Flux has no KeepAlive message; audio always flows, so there is nothing to send. */
  keepAlive() {}

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    // A turn still open from the paused period began earlier than now: drop it and everything before it.
    this.turnFloor = this.lastTurnIndex + (this.turnOpen ? 1 : 0);
  }

  configure(stage: Stage) {
    this.stage = stage;
    this.sendConfigure();
  }

  disconnect() {
    this.closedByUs = true;
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    if (!socket) return;
    socket.onmessage = null;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "CloseStream" }));
    }
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }
}

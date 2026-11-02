import { DEEPGRAM_API_KEY } from "../env";
import type { Stage } from "../types";
import { TypedError } from "./errors";
import type { SttCallbacks, SttClient } from "./stt";

const CONNECT_TIMEOUT_MS = 10_000;

export class DeepgramSTT implements SttClient {
  private socket: WebSocket | null = null;
  private paused = false;
  private hasSentHeader = false;
  private closedByUs = false;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = DEEPGRAM_API_KEY || "";
  }

  static buildUrl(): string {
    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-3");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("endpointing", "300");
    url.searchParams.set("utterance_end_ms", "1500");
    url.searchParams.set("vad_events", "true");
    return url.toString();
  }

  connect(callbacks: SttCallbacks): Promise<void> {
    if (!this.apiKey) {
      return Promise.reject(
        new TypedError("STT_FAILED", "Speech recognition isn't configured (missing Deepgram key)."),
      );
    }

    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(DeepgramSTT.buildUrl(), ["token", this.apiKey]);
      this.socket = socket;
      let opened = false;

      const timeoutId = window.setTimeout(() => {
        if (!opened) socket.close();
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        opened = true;
        window.clearTimeout(timeoutId);
        resolve();
      };

      socket.onmessage = (event) => this.handleMessage(event.data, callbacks);

      socket.onerror = () => {
        // onclose always follows; handled there.
      };

      socket.onclose = () => {
        window.clearTimeout(timeoutId);
        if (this.socket === socket) this.socket = null;
        if (!opened) {
          reject(new TypedError("STT_FAILED"));
          return;
        }
        if (!this.closedByUs) callbacks.onClose();
      };
    });
  }

  private handleMessage(raw: unknown, cb: SttCallbacks) {
    let data: any;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }
    switch (data?.type) {
      case "Results": {
        const transcript: string = data.channel?.alternatives?.[0]?.transcript ?? "";
        if (transcript) {
          cb.onTranscript(transcript, data.is_final === true, data.speech_final === true);
        }
        break;
      }
      case "UtteranceEnd":
        cb.onUtteranceEnd();
        break;
      case "SpeechStarted":
        cb.onSpeechStarted();
        break;
      default:
        break;
    }
  }

  /**
   * Forwards one MediaRecorder blob. While paused, blobs are dropped (half-duplex).
   * The very first blob carries the WebM container header and always goes through,
   * otherwise Deepgram cannot decode the rest of the stream.
   */
  sendAudio(chunk: Blob | ArrayBuffer) {
    if (this.paused && this.hasSentHeader) return;
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.hasSentHeader = true;
    this.socket.send(chunk);
  }

  keepAlive() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "KeepAlive" }));
    }
  }

  /** Nova-3 has no stage-aware endpointing; the stage is ignored here. */
  configure(_stage: Stage) {}

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  disconnect() {
    this.closedByUs = true;
    const socket = this.socket;
    this.socket = null;
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

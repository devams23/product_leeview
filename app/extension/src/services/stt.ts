import type { Stage } from "../types";

export interface SttCallbacks {
  onTranscript(text: string, isFinal: boolean, speechFinal: boolean): void;
  onUtteranceEnd(): void;
  onSpeechStarted(): void;
  /** Unexpected close after a successful connect. */
  onClose(): void;
}

/** A speech-to-text socket: Deepgram Flux, or Nova-3 as the fallback. */
export interface SttClient {
  connect(cb: SttCallbacks): Promise<void>;
  sendAudio(blob: Blob): void;
  keepAlive(): void;
  pause(): void;
  resume(): void;
  configure(stage: Stage): void;
  disconnect(): void;
}

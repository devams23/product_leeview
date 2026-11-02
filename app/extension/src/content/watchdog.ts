import type { Phase } from "../types";

/** A thinking turn shows "Taking a moment…" after this long. */
export const THINKING_SLOW_MS = 12_000;
/** A thinking turn gives the floor back after this long. */
export const THINKING_TIMEOUT_MS = 45_000;
/** Audio that stops arriving for this long while speaking hands the floor back. */
export const SPEAKING_STALL_MS = 10_000;
/** The opening must start (audio or AUDIO_FINISHED) within this long of PREPARING. */
export const PREPARE_TIMEOUT_MS = 30_000;
/** Interval between PING frames on the interview socket. */
export const HEARTBEAT_MS = 10_000;
/** No server message for this long on a live socket means the connection is dead. */
export const SERVER_SILENCE_MS = 30_000;

/** How long a phase may last before the client gives the floor back; null when it has no watchdog. */
export function watchdogDelay(phase: Phase): number | null {
  switch (phase) {
    case "THINKING":
      return THINKING_TIMEOUT_MS;
    case "AI_SPEAKING":
      return SPEAKING_STALL_MS;
    case "PREPARING":
      return PREPARE_TIMEOUT_MS;
    default:
      return null;
  }
}

import type { ErrorCode, InterviewError } from "../types";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  MIC_DENIED: "Microphone access was blocked.",
  MIC_UNAVAILABLE: "No usable microphone was found.",
  BACKEND_UNREACHABLE: "Can't reach the LeeView server.",
  AUTH_EXPIRED: "Your session expired.",
  STT_FAILED: "Speech recognition couldn't connect.",
  CONNECTION_LOST: "The connection to your interviewer was lost.",
  DEBRIEF_FAILED: "Couldn't generate your debrief.",
  DEBRIEF_TIMEOUT: "Your debrief is taking longer than expected.",
  TURN_FAILED: "The interviewer couldn't respond.",
  UNKNOWN: "Something went wrong.",
};

/** Error carrying a typed code; thrown by services and mapped by the hook. */
export class TypedError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message?: string, retryable?: boolean) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "TypedError";
    this.code = code;
    this.retryable = retryable ?? code !== "AUTH_EXPIRED";
  }
}

export function makeError(code: ErrorCode, message?: string): InterviewError {
  return {
    code,
    message: message ?? DEFAULT_MESSAGES[code],
    retryable: code !== "AUTH_EXPIRED",
  };
}

export function toInterviewError(err: unknown, fallback: ErrorCode): InterviewError {
  if (err instanceof TypedError) {
    return { code: err.code, message: err.message, retryable: err.retryable };
  }
  console.error("[LeeView]", err);
  return makeError(fallback);
}

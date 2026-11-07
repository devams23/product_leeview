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
  KEYS_MISSING: "Add your API keys in your LeeView profile.",
  SESSION_ENDED: "This interview has already ended.",
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
    this.retryable = retryable ?? isRetryable(code);
  }
}

export function makeError(code: ErrorCode, message?: string): InterviewError {
  return {
    code,
    message: message ?? DEFAULT_MESSAGES[code],
    retryable: isRetryable(code),
  };
}

/** Errors the user has to fix elsewhere (sign in, add keys) are not offered a plain retry. */
function isRetryable(code: ErrorCode): boolean {
  return code !== "AUTH_EXPIRED" && code !== "KEYS_MISSING";
}

export function toInterviewError(err: unknown, fallback: ErrorCode): InterviewError {
  if (err instanceof TypedError) {
    return { code: err.code, message: err.message, retryable: err.retryable };
  }
  console.error("[LeeView]", err);
  return makeError(fallback);
}

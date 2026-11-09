import type { ErrorCode } from "../types";

/** What went wrong, as the panel will show it. `message` is the server's own wording, when it sent one. */
export interface ServerProblem {
  code: ErrorCode;
  message?: string;
}

/** ERROR codes the server sends just before it refuses the interview socket with close code 1008. */
export const REFUSAL_CODES: ReadonlySet<string> = new Set([
  "KEYS_MISSING", "KEY_STORE_UNAVAILABLE", "SESSION_ENDED", "SESSION_BUSY", "SESSION_UNAVAILABLE",
]);

/**
 * A REST error about the user's keys: missing (412), rejected by the provider (412), or the
 * server cannot read keys at all (503). Returns null for any other failure.
 */
export function keyProblem(status: number, body: unknown): ServerProblem | null {
  const detail = (body as { detail?: { code?: unknown; message?: unknown } } | null)?.detail;
  const message = typeof detail?.message === "string" ? detail.message : undefined;
  const code = typeof detail?.code === "string" ? detail.code : "";
  if (code === "KEY_REJECTED") return { code: "KEY_REJECTED", message };
  if (code === "KEY_STORE_UNAVAILABLE") return { code: "SERVER_SETUP", message };
  if (code === "KEYS_MISSING" || status === 412) return { code: "KEYS_MISSING", message };
  return null;
}

/**
 * Why the server refused the interview socket. `reason` is the close reason (the refusal code);
 * `message` is the text of the ERROR that came just before, which names the missing key.
 */
export function refusalProblem(reason: string, message?: string): ServerProblem {
  switch (reason) {
    case "KEYS_MISSING":
      return { code: "KEYS_MISSING", message };
    case "KEY_STORE_UNAVAILABLE":
      return { code: "SERVER_SETUP", message };
    case "SESSION_ENDED":
      return { code: "SESSION_ENDED" };
    case "SESSION_BUSY":
      return { code: "CONNECTION_LOST", message: "This interview is open in another tab." };
    case "SESSION_UNAVAILABLE":
      return { code: "BACKEND_UNREACHABLE" };
    default:
      // Without a known reason, 1008 means the sign-in token was not accepted.
      return { code: "AUTH_EXPIRED" };
  }
}

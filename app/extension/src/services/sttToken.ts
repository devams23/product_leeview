import { BACKEND_URL } from "../config";
import { TypedError } from "./errors";

/**
 * A short-lived Deepgram token for one speech-to-text socket, minted by the backend from the
 * user's own Deepgram key. The key itself never reaches the browser.
 */
export async function fetchSttToken(token: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/stt/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new TypedError("BACKEND_UNREACHABLE");
  }
  if (res.status === 401 || res.status === 403) throw new TypedError("AUTH_EXPIRED");
  if (res.status === 412) throw await keysError(res);
  if (!res.ok) throw new TypedError("STT_FAILED");

  const data = await res.json().catch(() => null);
  if (typeof data?.access_token !== "string" || !data.access_token) throw new TypedError("STT_FAILED");
  return data.access_token;
}

/** A 412 from the backend: the user's keys are missing or were rejected by the provider. */
export async function keysError(res: Response): Promise<TypedError> {
  const body = await res.json().catch(() => null);
  const message = typeof body?.detail?.message === "string" ? body.detail.message : undefined;
  return new TypedError("KEYS_MISSING", message, false);
}

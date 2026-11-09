import { BACKEND_URL } from "../config";
import { TypedError } from "./errors";
import { keyProblem } from "./serverErrors";

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
  if (!res.ok) throw (await keysError(res)) ?? new TypedError("STT_FAILED");

  const data = await res.json().catch(() => null);
  if (typeof data?.access_token !== "string" || !data.access_token) throw new TypedError("STT_FAILED");
  return data.access_token;
}

/**
 * A failed response that is about the user's keys (missing, rejected, or the server cannot read
 * them), carrying the server's message that names the key. Null for any other failure.
 */
export async function keysError(res: Response): Promise<TypedError | null> {
  if (res.status !== 412 && res.status !== 503) return null;
  const body = await res.json().catch(() => null);
  const problem = keyProblem(res.status, body);
  return problem ? new TypedError(problem.code, problem.message) : null;
}

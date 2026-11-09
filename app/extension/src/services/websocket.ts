import { BACKEND_URL, WS_URL } from "../config";
import { TypedError } from "./errors";
import { keysError } from "./sttToken";
import { REFUSAL_CODES, refusalProblem } from "./serverErrors";

export class InterviewWebSocket {
  private ws: WebSocket | null = null;
  private closedByUs = false;
  /** The server's explanation when it refuses the socket; the close frame only carries a code. */
  refusalMessage: string | undefined;

  /**
   * Opens the interview socket. Resolves once open; rejects with a TypedError if the
   * socket closes before opening. `onClose` fires only for unexpected closes.
   */
  connect(
    sessionId: string,
    token: string,
    onMessage: (msg: any) => void,
    onClose?: (ev: CloseEvent) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `${WS_URL}/ws/interview/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`,
      );
      this.ws = ws;
      ws.binaryType = "arraybuffer";
      let opened = false;

      ws.onopen = () => {
        opened = true;
        resolve();
      };
      ws.onmessage = (event) => {
        try {
          // Binary frames are raw PCM audio; JSON frames are everything else.
          if (event.data instanceof ArrayBuffer) {
            onMessage({ type: "AUDIO_CHUNK", pcm: event.data });
            return;
          }
          const msg = JSON.parse(event.data);
          if (msg?.type === "ERROR" && REFUSAL_CODES.has(msg.code) && typeof msg.message === "string") {
            this.refusalMessage = msg.message;
          }
          onMessage(msg);
        } catch (e) {
          console.error("[LeeView] WS message error:", e);
        }
      };
      ws.onerror = () => {
        // onclose always follows; handled there.
      };
      ws.onclose = (ev) => {
        if (this.ws === ws) this.ws = null;
        if (!opened) {
          reject(ev.code === 1008 ? rejectionError(ev.reason, this.refusalMessage) : new TypedError("BACKEND_UNREACHABLE"));
          return;
        }
        if (!this.closedByUs) onClose?.(ev);
      };
    });
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /** Intentional close: no onClose callback fires afterwards. */
  disconnect() {
    this.closedByUs = true;
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onmessage = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }
}

/**
 * The backend refuses a socket with close code 1008 and the refusal code as the close reason.
 * `message` is the ERROR text sent just before, e.g. which key is missing.
 */
export function rejectionError(reason: string, message?: string): TypedError {
  const problem = refusalProblem(reason, message);
  return new TypedError(problem.code, problem.message);
}

export async function createSession(
  token: string,
  slug: string,
  title: string,
  difficulty: string | null,
  description: string = "",
  topics: string[] = [],
  language: string = "python",
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        leetcode_slug: slug,
        leetcode_title: title,
        problem_difficulty: difficulty,
        problem_description: description,
        problem_topics: topics,
        problem_language: language,
      }),
    });
  } catch {
    throw new TypedError("BACKEND_UNREACHABLE");
  }

  if (res.status === 401 || res.status === 403) {
    throw new TypedError("AUTH_EXPIRED");
  }
  if (!res.ok) {
    const keys = await keysError(res);
    if (keys) throw keys;
    if (res.status >= 500) throw new TypedError("BACKEND_UNREACHABLE");
    throw new TypedError("UNKNOWN");
  }

  const data = await res.json().catch(() => null);
  if (!data?.session_id) {
    throw new TypedError("BACKEND_UNREACHABLE");
  }
  return data.session_id as string;
}

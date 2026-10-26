import { BACKEND_URL, WS_URL } from "../config";
import { TypedError } from "./errors";

export class InterviewWebSocket {
  private ws: WebSocket | null = null;
  private closedByUs = false;

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
      let opened = false;

      ws.onopen = () => {
        opened = true;
        resolve();
      };
      ws.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data));
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
          reject(
            ev.code === 1008
              ? new TypedError("AUTH_EXPIRED")
              : new TypedError("BACKEND_UNREACHABLE"),
          );
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
    if (res.status >= 500) throw new TypedError("BACKEND_UNREACHABLE");
    throw new TypedError("UNKNOWN");
  }

  const data = await res.json().catch(() => null);
  if (!data?.session_id) {
    throw new TypedError("BACKEND_UNREACHABLE");
  }
  return data.session_id as string;
}

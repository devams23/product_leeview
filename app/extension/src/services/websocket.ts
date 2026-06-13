const BACKEND_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";

export class InterviewWebSocket {
  private ws: WebSocket | null = null;

  connect(sessionId: string, onMessage: (msg: any) => void) {
    this.ws = new WebSocket(`${WS_URL}/ws/interview/${sessionId}`);
    this.ws.onopen = () => console.log("WS connected");
    this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
    this.ws.onerror = (err) => console.error("WS error", err);
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

export async function createSession(userId: string, slug: string, title: string, difficulty: string) {
  const res = await fetch(`${BACKEND_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, leetcode_slug: slug, leetcode_title: title, problem_difficulty: difficulty }),
  });
  const data = await res.json();
  return data.session_id as string;
}
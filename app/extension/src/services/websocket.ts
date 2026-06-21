const BACKEND_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";

export class InterviewWebSocket {
  private ws: WebSocket | null = null;

  connect(sessionId: string, onMessage: (msg: any) => void) {
    this.ws = new WebSocket(`${WS_URL}/ws/interview/${sessionId}`);
    this.ws.onopen = () => { /* console.log("[Extension] WS connected to backend"); */ };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // console.log(`[Extension] WS recv: ${msg.type}`);
        // console.log("[Extension] Calling onMessage callback...");
        onMessage(msg);
        // console.log("[Extension] onMessage callback returned");
      } catch (e) {
        console.error("[Extension] WS parse error:", e);
      }
    };
    this.ws.onerror = (err) => console.error("[Extension] WS error:", err);
    this.ws.onclose = (e) => { /* console.log("[Extension] WS closed:", e.code, e.reason); */ };
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

export async function createSession(
  userId: string, 
  slug: string, 
  title: string, 
  difficulty: string,
  description: string = "",
  topics: string[] = [],
  language: string = "python"
) {
  const res = await fetch(`${BACKEND_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id: userId, 
      leetcode_slug: slug, 
      leetcode_title: title, 
      problem_difficulty: difficulty,
      problem_description: description,
      problem_topics: topics,
      problem_language: language
    }),
  });
  const data = await res.json();
  return data.session_id as string;
}
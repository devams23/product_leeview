const BACKEND_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";
export class InterviewWebSocket {
    constructor() {
        this.ws = null;
    }
    connect(sessionId, onMessage) {
        this.ws = new WebSocket(`${WS_URL}/ws/interview/${sessionId}`);
        this.ws.onopen = () => console.log("WS connected");
        this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
        this.ws.onerror = (err) => console.error("WS error", err);
    }
    send(data) {
        this.ws?.send(JSON.stringify(data));
    }
    disconnect() {
        this.ws?.close();
    }
}
export async function createSession(userId, slug, title, difficulty) {
    const res = await fetch(`${BACKEND_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, leetcode_slug: slug, leetcode_title: title, problem_difficulty: difficulty }),
    });
    const data = await res.json();
    return data.session_id;
}

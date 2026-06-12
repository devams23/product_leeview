export class InterviewWebSocket {
  private ws: WebSocket | null = null;

  connect(sessionId: string, onMessage: (msg: any) => void) {
    this.ws = new WebSocket(`wss://api.leeview.com/ws/interview/${sessionId}`);
    this.ws.onopen = () => console.log("WS connected");
    this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
    this.ws.onerror = (err) => console.error("WS error", err);
  }

  send(data: object) {
    this.ws?.send(JSON.stringify(data));
  }

  disconnect() {
    this.ws?.close();
  }
}

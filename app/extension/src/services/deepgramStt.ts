export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  connect(onTranscript: (text: string, isFinal: boolean) => void) {
    this.ws = new WebSocket(
      "wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true",
      ["token", this.apiKey]
    );

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final;
      if (transcript) onTranscript(transcript, isFinal);
    };
  }

  sendAudio(chunk: Blob) {
    this.ws?.send(chunk);
  }

  disconnect() {
    this.ws?.send(JSON.stringify({ type: "CloseStream" }));
    this.ws?.close();
  }
}

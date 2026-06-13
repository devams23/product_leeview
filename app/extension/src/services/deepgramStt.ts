export class DeepgramSTT {
  private socket: WebSocket | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async connect(onTranscript: (text: string, isFinal: boolean) => void): Promise<void> {
    if (!this.apiKey) {
      console.warn("Deepgram STT: no API key — skipping connection");
      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        // const wsUrl = new URL("");
        // wsUrl.searchParams.set("model", "nova-3");
        // wsUrl.searchParams.set("language", "en-US");
        // wsUrl.searchParams.set("smart_format", "true");
        // wsUrl.searchParams.set("interim_results", "true");
        // wsUrl.searchParams.set("endpointing", "10");
        // wsUrl.searchParams.set("punctuate", "true");
        // wsUrl.searchParams.set("encoding", "linear16");
        // wsUrl.searchParams.set("sample_rate", "16000");

        this.socket = new WebSocket('wss://api.deepgram.com/v1/listen', ['token', this.apiKey]);

        // Setup connection timeout
        const timeoutId = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            this.disconnect();
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        this.socket.onopen = () => {
          clearTimeout(timeoutId);
          console.log("DG OPEN");
          resolve(); // Resolve the connection promise here safely
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const alt = data.channel?.alternatives?.[0];
            const transcript = alt?.transcript;
            const isFinal = data.is_final;
            if (transcript) onTranscript(transcript, isFinal);
          } catch (err) {
            console.error("Failed to parse Deepgram message:", err);
          }
        };

        this.socket.onclose = (e: CloseEvent) => {
          console.log("DG CLOSE", e.code, e.reason);
        };

        this.socket.onerror = (e: Event) => {
          clearTimeout(timeoutId);
          console.error("DG ERROR", e);
          reject(new Error("WebSocket connection failed"));
        };

      } catch (err) {
        console.error("Failed to setup Deepgram WebSocket:", err);
        reject(err);
      }
    });
  }

  sendAudio(chunk: ArrayBuffer | Blob) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(chunk);
    }
  }

  disconnect() {
    if (this.socket) {
      // Deepgram prefers an empty JSON close message to end streams cleanly
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "CloseStream" }));
      }
      this.socket.close();
      this.socket = null;
    }
  }
}

import { DEEPGRAM_API_KEY } from "../env";

export class DeepgramSTT {
  private socket: WebSocket | null = null;
  private apiKey: string;

  constructor() {
    this.apiKey = DEEPGRAM_API_KEY || "";
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
          // console.log("[DeepgramSTT] Connected");
          resolve(); // Resolve the connection promise here safely
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // console.log("[DeepgramSTT] Message:", data.type || "transcript");
            const alt = data.channel?.alternatives?.[0];
            const transcript = alt?.transcript;
            const isFinal = data.is_final;
            if (transcript) {
              // console.log(`[DeepgramSTT] Transcript: "${transcript}" (final: ${isFinal})`);
              onTranscript(transcript, isFinal);
            }
          } catch (err) {
            console.error("[DeepgramSTT] Parse error:", err);
          }
        };

        this.socket.onclose = (e: CloseEvent) => {
          // console.log("[DeepgramSTT] Closed:", e.code, e.reason);
        };

        this.socket.onerror = (e: Event) => {
          clearTimeout(timeoutId);
          console.error("[DeepgramSTT] Error:", e);
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
      const size = chunk instanceof Blob ? chunk.size : chunk.byteLength;
      // console.log(`[DeepgramSTT] Sending audio: ${size} bytes`);
      this.socket.send(chunk);
    } else {
      console.warn("[DeepgramSTT] Cannot send audio, socket not open:", this.socket?.readyState);
    }
  }

  disconnect() {
    // console.log("[DeepgramSTT] Disconnecting...");
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

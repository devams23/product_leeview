import { DeepgramClient } from "@deepgram/sdk";

export class DeepgramSTT {
  private socket: any = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async connect(onTranscript: (text: string, isFinal: boolean) => void) {
    if (!this.apiKey) {
      console.warn("Deepgram STT: no API key — skipping connection");
      return;
    }

    try {
      const deepgram = new DeepgramClient({ apiKey: this.apiKey });
      this.socket = await deepgram.listen.v1.connect({
        model: "nova-3",
        language: "en-US",
        smart_format: "true",
        interim_results: "true",
        endpointing: 10,
        punctuate: "true",
        Authorization: this.apiKey,
      });

      this.socket.on("message", (data: any) => {
        const alt = data.channel?.alternatives?.[0];
        const transcript = alt?.transcript;
        const isFinal = data.is_final;
        if (transcript) onTranscript(transcript, isFinal);
      });

      this.socket.on("error", (err: any) => console.error("Deepgram STT error:", err));
      this.socket.on("close", () => console.log("Deepgram STT connection closed"));

      this.socket.connect();
      await this.socket.waitForOpen();
    } catch (err) {
      console.error("Failed to connect to Deepgram STT:", err);
      throw err;
    }
  }

  sendAudio(chunk: Blob) {
    if (this.socket?.readyState === 1) {
      this.socket.sendMedia(chunk);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
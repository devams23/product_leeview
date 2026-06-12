export class DeepgramSTT {
    constructor(apiKey) {
        this.ws = null;
        this.apiKey = apiKey;
    }
    connect(onTranscript) {
        this.ws = new WebSocket("wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true", ["token", this.apiKey]);
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            const isFinal = data.is_final;
            if (transcript)
                onTranscript(transcript, isFinal);
        };
    }
    sendAudio(chunk) {
        this.ws?.send(chunk);
    }
    disconnect() {
        this.ws?.send(JSON.stringify({ type: "CloseStream" }));
        this.ws?.close();
    }
}

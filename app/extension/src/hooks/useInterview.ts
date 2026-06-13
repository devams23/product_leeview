import { useState, useRef, useCallback } from "react";
import { InterviewWebSocket, createSession } from "../services/websocket";
import { DeepgramSTT } from "../services/deepgramStt";
import { getProblemData } from "../utils/domScraper";

type InterviewPhase = "IDLE" | "CONNECTING" | "SPEAKING" | "LISTENING" | "PROCESSING" | "DEBRIEF_READY" | "ERROR";

export function useInterview() {
  const [phase, setPhase] = useState<InterviewPhase>("IDLE");
  const wsRef = useRef<InterviewWebSocket | null>(null);
  const sttRef = useRef<DeepgramSTT | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      console.log("[Extension] Audio queue empty, stopping playback");
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    console.log(`[Extension] Playing audio chunk, queue remaining: ${audioQueueRef.current.length}`);
    
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      console.log("[Extension] Created AudioContext at 24kHz");
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
      console.log("[Extension] AudioContext resumed");
    }
    
    try {
      const audioBuffer = await audioCtx.decodeAudioData(chunk.slice(0));
      console.log(`[Extension] Decoded audio: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => playNextChunk();
      source.start(0);
    } catch (e) {
      console.error("[Extension] Failed to decode/play audio:", e);
      playNextChunk();
    }
  }, []);

  const handleAudioChunk = useCallback((hexData: string) => {
    const bytes = new Uint8Array(hexData.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    console.log(`[Extension] Received AUDIO_CHUNK: ${bytes.length} bytes (hex: ${hexData.length} chars)`);
    audioQueueRef.current.push(bytes.buffer);
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  const startInterview = useCallback(async (userId: string) => {
    console.log("[Extension] Starting interview...");
    setPhase("CONNECTING");

    try {
      const problem = getProblemData();
      console.log(`[Extension] Problem: ${problem.title} (${problem.slug})`);
      const sessionId = await createSession(userId, problem.slug, problem.title, problem.difficulty);
      console.log(`[Extension] Session created: ${sessionId}`);

      const ws = new InterviewWebSocket();
      ws.connect(sessionId, (msg) => {
        console.log(`[Extension] WS message: ${msg.type}`);
        if (msg.type === "AUDIO_CHUNK") {
          handleAudioChunk(msg.data);
        } else if (msg.type === "AUDIO_FINISHED") {
          console.log("[Extension] AUDIO_FINISHED received, setting phase to LISTENING");
          setPhase("LISTENING");
        } else if (msg.type === "DEBRIEF_READY") {
          console.log("[Extension] DEBRIEF_READY received");
          setPhase("DEBRIEF_READY");
        }
      });
      wsRef.current = ws;

      const stt = new DeepgramSTT();
      console.log("[Extension] Connecting to Deepgram STT...");
      await stt.connect((text, isFinal) => {
        console.log(`[Extension] STT transcript: "${text}" (final: ${isFinal})`);
        if (isFinal) {
          ws.send({ type: "USER_UTTERANCE", text, current_code: "" });
          console.log(`[Extension] Sent USER_UTTERANCE to backend`);
        }
      });
      sttRef.current = stt;

      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        console.log("[Extension] Microphone access granted");
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            console.log(`[Extension] MediaRecorder chunk: ${event.data.size} bytes`);
            stt.sendAudio(event.data);
          }
        };
        mediaRecorder.start(250);
        console.log("[Extension] MediaRecorder started (250ms intervals)");
      });

      setPhase("SPEAKING");
      console.log("[Extension] Phase set to SPEAKING");
    } catch (err) {
      console.error("[Extension] Failed to start interview:", err);
      setPhase("ERROR");
    }
  }, [handleAudioChunk]);

  const stopInterview = useCallback(() => {
    console.log("[Extension] Stopping interview...");
    wsRef.current?.send({ type: "INTERRUPT" });
    wsRef.current?.disconnect();
    sttRef.current?.disconnect();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setPhase("IDLE");
    console.log("[Extension] Interview stopped, phase set to IDLE");
  }, []);

  return { phase, startInterview, stopInterview };
}

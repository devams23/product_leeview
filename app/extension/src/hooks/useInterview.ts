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
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    
    const audioBuffer = await audioCtx.decodeAudioData(chunk.slice(0));
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = () => playNextChunk();
    source.start(0);
  }, []);

  const handleAudioChunk = useCallback((hexData: string) => {
    const bytes = new Uint8Array(hexData.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    audioQueueRef.current.push(bytes.buffer);
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  const startInterview = useCallback(async (userId: string) => {
    setPhase("CONNECTING");

    try {
      const problem = getProblemData();
      const sessionId = await createSession(userId, problem.slug, problem.title, problem.difficulty);

      const ws = new InterviewWebSocket();
      ws.connect(sessionId, (msg) => {
        if (msg.type === "AUDIO_CHUNK") {
          handleAudioChunk(msg.data);
        } else if (msg.type === "AUDIO_FINISHED") {
          setPhase("LISTENING");
        } else if (msg.type === "DEBRIEF_READY") {
          setPhase("DEBRIEF_READY");
        }
      });
      wsRef.current = ws;

      const stt = new DeepgramSTT();
      await stt.connect((text, isFinal) => {
        if (isFinal) {
          ws.send({ type: "USER_UTTERANCE", text, current_code: "" });
        }
      });
      sttRef.current = stt;

      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            stt.sendAudio(event.data);
          }
        };
        mediaRecorder.start(250);
      });

      setPhase("SPEAKING");
    } catch (err) {
      console.error("Failed to start interview:", err);
      setPhase("ERROR");
    }
  }, [handleAudioChunk]);

  const stopInterview = useCallback(() => {
    wsRef.current?.send({ type: "INTERRUPT" });
    wsRef.current?.disconnect();
    sttRef.current?.disconnect();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setPhase("IDLE");
  }, []);

  return { phase, startInterview, stopInterview };
}

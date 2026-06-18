import { useState, useRef, useCallback } from "react";
import { InterviewWebSocket, createSession } from "../services/websocket";
import { DeepgramSTT } from "../services/deepgramStt";
import { getProblemData } from "../utils/domScraper";

type InterviewPhase = "IDLE" | "CONNECTING" | "SPEAKING" | "LISTENING" | "PROCESSING" | "DEBRIEF_READY" | "ERROR";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;



function hexToBytes(hexData: string): Uint8Array {
  const cleanHex = hexData.replace(/[^0-9a-fA-F]/g, "");
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

export function useInterview() {
  const [phase, setPhase] = useState<InterviewPhase>("IDLE");
  const wsRef = useRef<InterviewWebSocket | null>(null);
  const sttRef = useRef<DeepgramSTT | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleAudioChunk = useCallback((hexData: string) => {
    if (!audioContextRef.current) return;

    const bytes = hexToBytes(hexData);
    const pcmData = bytes.buffer as ArrayBuffer;

    // Convert 16-bit PCM to Float32 for Web Audio API
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = audioContextRef.current.createBuffer(CHANNELS, float32.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    // Ensure playback starts slightly in the future or queues perfectly after the last chunk
    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.05; // 50ms buffer to prevent jitter on first chunk
    }

    source.start(nextStartTimeRef.current);
    sourceNodesRef.current.push(source);

    nextStartTimeRef.current += audioBuffer.duration;
  }, []);

  const startInterview = useCallback(async (userId: string) => {
    console.log("[Extension] Starting interview...");
    setPhase("CONNECTING");

    try {
      const problem = await getProblemData();
      console.log(`[Extension] Problem: ${problem.title} (${problem.slug})`);
      const sessionId = await createSession(
        userId, 
        problem.slug, 
        problem.title, 
        problem.difficulty,
        problem.description,
        problem.topics,
        problem.language
      );
      console.log(`[Extension] Session created: ${sessionId}`);

      const ws = new InterviewWebSocket();
      ws.connect(sessionId, (msg) => {
        if (msg.type === "AUDIO_CHUNK") {
          setPhase((prev) => {
            if (prev !== "SPEAKING") return "SPEAKING";
            return prev;
          });
          handleAudioChunk(msg.data);
        } else if (msg.type === "AUDIO_FINISHED") {
          if (audioContextRef.current) {
            const timeRemaining = nextStartTimeRef.current - audioContextRef.current.currentTime;
            if (timeRemaining > 0) {
              setTimeout(() => {
                setPhase("LISTENING");
                // Clear out played source nodes periodically
                sourceNodesRef.current = [];
              }, timeRemaining * 1000);
            } else {
              setPhase("LISTENING");
              sourceNodesRef.current = [];
            }
          } else {
            setPhase("LISTENING");
          }
        } else if (msg.type === "DEBRIEF_READY") {
          setPhase("DEBRIEF_READY");
        }
      });
      wsRef.current = ws;

      const stt = new DeepgramSTT();
      console.log("[Extension] Connecting to Deepgram STT...");
      await stt.connect(async (text, isFinal) => {
        console.log(`[Extension] STT transcript: "${text}" (final: ${isFinal})`);
        if (isFinal) {
          const currentData = await getProblemData();
          ws.send({ 
            type: "USER_UTTERANCE", 
            text, 
            current_code: currentData.code,
            language: currentData.language 
          });
          console.log(`[Extension] Sent USER_UTTERANCE to backend with latest code snapshot`);
        }
      });
      sttRef.current = stt;

      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        console.log("[Extension] Microphone access granted");
        streamRef.current = stream;

        // Initialize AudioContext on user interaction
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass({ sampleRate: SAMPLE_RATE });
        } else if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
        nextStartTimeRef.current = audioContextRef.current.currentTime;
        sourceNodesRef.current = [];

        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && sttRef.current) {
            console.log(`[Extension] MediaRecorder chunk: ${event.data.size} bytes`);
            sttRef.current.sendAudio(event.data);
          }
        };
        mediaRecorder.start(250);
        console.log("[Extension] MediaRecorder started (250ms intervals)");
      });

      setPhase("LISTENING"); // Start in LISTENING phase, waiting for first AUDIO_CHUNK to switch to SPEAKING
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
    wsRef.current = null;
    sttRef.current?.disconnect();
    sttRef.current = null;

    // Stop recording and close mic
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clean up audio playback
    sourceNodesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) { }
    });
    sourceNodesRef.current = [];
    nextStartTimeRef.current = 0;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    setPhase((currentPhase) => {
      if (currentPhase !== "DEBRIEF_READY" && currentPhase !== "IDLE") {
        console.log("[Extension] Transitioning to DEBRIEF_READY...");
        setTimeout(() => {
          setPhase("DEBRIEF_READY");
        }, 1500);
        return "PROCESSING";
      }
      console.log("[Extension] Interview stopped, phase set to IDLE");
      return "IDLE";
    });
  }, []);

  return { phase, startInterview, stopInterview };
}

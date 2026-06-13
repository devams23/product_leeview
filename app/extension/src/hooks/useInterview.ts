import { useState, useRef, useCallback } from "react";
import { InterviewWebSocket, createSession } from "../services/websocket";
import { DeepgramSTT } from "../services/deepgramStt";
import { getProblemData } from "../utils/domScraper";

type InterviewPhase = "IDLE" | "CONNECTING" | "SPEAKING" | "LISTENING" | "PROCESSING" | "DEBRIEF_READY" | "ERROR";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function createWavHeader(dataLength: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  // RIFF header
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, 36 + dataLength, true); // file size - 8
  view.setUint8(8, 0x57); // 'W'
  view.setUint8(9, 0x41); // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'
  
  // fmt chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6D); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, CHANNELS, true); // channels
  view.setUint32(24, SAMPLE_RATE, true); // sample rate
  view.setUint32(28, SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8, true); // byte rate
  view.setUint16(32, CHANNELS * BITS_PER_SAMPLE / 8, true); // block align
  view.setUint16(34, BITS_PER_SAMPLE, true); // bits per sample
  
  // data chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataLength, true); // data size
  
  return header;
}

function pcmToWav(pcmData: ArrayBuffer): ArrayBuffer {
  const header = createWavHeader(pcmData.byteLength);
  const wav = new ArrayBuffer(header.byteLength + pcmData.byteLength);
  const view = new Uint8Array(wav);
  view.set(new Uint8Array(header), 0);
  view.set(new Uint8Array(pcmData), header.byteLength);
  return wav;
}

export function useInterview() {
  const [phase, setPhase] = useState<InterviewPhase>("IDLE");
  const wsRef = useRef<InterviewWebSocket | null>(null);
  const sttRef = useRef<DeepgramSTT | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const playAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.log("[Extension] No audio chunks to play");
      return;
    }
    
    console.log(`[Extension] Combining ${audioChunksRef.current.length} chunks for playback`);
    
    // Combine all PCM chunks
    const totalLength = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedPcm = new ArrayBuffer(totalLength);
    const combinedView = new Uint8Array(combinedPcm);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      combinedView.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    // Create WAV and play
    const wavData = pcmToWav(combinedPcm);
    
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      console.log("[Extension] Created AudioContext at 24kHz");
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
      console.log("[Extension] AudioContext resumed");
    }
    
    try {
      const audioBuffer = await audioCtx.decodeAudioData(wavData);
      console.log(`[Extension] Decoded WAV: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        console.log("[Extension] Playback finished");
        audioChunksRef.current = [];
        isPlayingRef.current = false;
      };
      source.start(0);
      isPlayingRef.current = true;
    } catch (e) {
      console.error("[Extension] Failed to decode/play audio:", e);
      audioChunksRef.current = [];
      isPlayingRef.current = false;
    }
  }, []);

  const handleAudioChunk = useCallback((hexData: string) => {
    const bytes = new Uint8Array(hexData.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    console.log(`[Extension] Received AUDIO_CHUNK: ${bytes.length} bytes`);
    audioChunksRef.current.push(bytes.buffer);
  }, []);

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
          console.log("[Extension] AUDIO_FINISHED received, playing audio...");
          playAudio();
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
    audioChunksRef.current = [];
    isPlayingRef.current = false;
    setPhase("IDLE");
    console.log("[Extension] Interview stopped, phase set to IDLE");
  }, []);

  return { phase, startInterview, stopInterview };
}

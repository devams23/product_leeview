import { useState, useRef, useCallback } from "react";
import { InterviewWebSocket, createSession } from "../services/websocket";
import { DeepgramSTT } from "../services/deepgramStt";
import { getProblemData } from "../utils/domScraper";

type InterviewPhase = "IDLE" | "CONNECTING" | "SPEAKING" | "LISTENING" | "PROCESSING" | "DEBRIEF_READY" | "ERROR";

export function useInterview() {
  const [phase, setPhase] = useState<InterviewPhase>("IDLE");
  const wsRef = useRef<InterviewWebSocket | null>(null);
  const sttRef = useRef<DeepgramSTT | null>(null);

  const startInterview = useCallback(async (userId: string) => {
    setPhase("CONNECTING");

    try {
      const problem = getProblemData();
      const sessionId = await createSession(userId, problem.slug, problem.title, problem.difficulty);

      const ws = new InterviewWebSocket();
      ws.connect(sessionId, (msg) => {
        if (msg.type === "AUDIO_FINISHED") {
          setPhase("LISTENING");
        }
        if (msg.type === "DEBRIEF_READY") {
          setPhase("DEBRIEF_READY");
        }
      });
      wsRef.current = ws;

      const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY || "";
      console.log("DG KEY", deepgramKey?.slice(0, 8));
console.log("DG LEN", deepgramKey?.length);
      const stt = new DeepgramSTT(deepgramKey);
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
  }, []);

  const stopInterview = useCallback(() => {
    wsRef.current?.send({ type: "INTERRUPT" });
    wsRef.current?.disconnect();
    sttRef.current?.disconnect();
    setPhase("IDLE");
  }, []);

  return { phase, startInterview, stopInterview };
}

import { useState } from "react";
import { StartPill } from "../components/StartPill";
import { InterviewOverlay } from "../components/InterviewOverlay";
import { useInterview } from "../hooks/useInterview";

export default function App() {
  const [started, setStarted] = useState(false);
  const { phase, startInterview, stopInterview } = useInterview();

  const handleStart = () => {
    setStarted(true);
    startInterview("session-id", "deepgram-api-key");
  };

  return (
    <>
      {!started && <StartPill onClick={handleStart} />}
      {started && <InterviewOverlay phase={phase} onStop={stopInterview} />}
    </>
  );
}

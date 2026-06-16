import { Waveform } from "./Waveform";
import { useMemo } from "react";

const PHASE_CONFIG = {
  SPEAKING: {
    label: "Interviewer Speaking",
    dotColor: "rgba(255,255,255,0.9)",
    ringColor: "rgba(255,255,255,0.3)",
    panelBg: "rgba(255,255,255,0.12)",
    showWaveform: false,
  },
  LISTENING: {
    label: "Listening",
    dotColor: "rgba(255,100,100,0.9)",
    ringColor: "rgba(255,100,100,0.3)",
    panelBg: "rgba(0,0,0,0.35)",
    showWaveform: true,
  },
  CONNECTING: {
    label: "Connecting",
    dotColor: "rgba(255,255,255,0.5)",
    ringColor: "rgba(255,255,255,0.15)",
    panelBg: "rgba(255,255,255,0.12)",
    showWaveform: false,
  },
  PROCESSING: {
    label: "Processing",
    dotColor: "rgba(255,180,80,0.9)",
    ringColor: "rgba(255,180,80,0.25)",
    panelBg: "rgba(255,255,255,0.12)",
    showWaveform: false,
  },
  DEBRIEF_READY: {
    label: "Debrief Ready",
    dotColor: "rgba(112,168,136,0.9)",
    ringColor: "rgba(112,168,136,0.3)",
    panelBg: "rgba(255,255,255,0.12)",
    showWaveform: false,
  },
  ERROR: {
    label: "Connection Error",
    dotColor: "rgba(255,100,100,0.8)",
    ringColor: "rgba(255,100,100,0.2)",
    panelBg: "rgba(255,255,255,0.12)",
    showWaveform: false,
  },
  IDLE: {
    label: "Ready",
    dotColor: "rgba(255,255,255,0.45)",
    ringColor: "rgba(255,255,255,0.1)",
    panelBg: "rgba(255,255,255,0.12)",
    showWaveform: false,
  },
} as const;

type Phase = keyof typeof PHASE_CONFIG;

function StatusRing({ color, ringColor, isSpeaking }: { color: string; ringColor: string; isSpeaking: boolean }) {
  return (
    <div style={{ position: "relative", width: "28px", height: "28px" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `2px solid ${ringColor}`,
          animation: isSpeaking ? "ringPulse 1.5s ease-out infinite" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "6px",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`,
        }}
      />
      <style>{`
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function InterviewOverlay({
  phase,
  onStop,
}: {
  phase: string;
  onStop: () => void;
}) {
  const config = useMemo(() => PHASE_CONFIG[phase as Phase] || PHASE_CONFIG.IDLE, [phase]);
  const isListening = phase === "LISTENING";
  const isSpeaking = phase === "SPEAKING";

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        padding: "18px 20px",
        borderRadius: "20px",
        background: config.panelBg,
        border: "1px solid rgba(255,255,255,0.22)",
        outline: "1px solid rgba(0,0,0,0.18)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        color: "rgba(255,255,255,0.88)",
        minWidth: "220px",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <StatusRing
          color={config.dotColor}
          ringColor={config.ringColor}
          isSpeaking={isSpeaking}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontWeight: "500",
              fontSize: "13px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            {config.label}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {phase}
          </span>
        </div>
      </div>

      {config.showWaveform && <Waveform />}

      <button
        onClick={onStop}
        style={{
          marginTop: "14px",
          padding: "10px 20px",
          borderRadius: "30px",
          background: "rgba(255,100,100,0.1)",
          border: "1px solid rgba(255,100,100,0.2)",
          color: "rgba(255,100,100,0.85)",
          cursor: "pointer",
          fontWeight: "500",
          fontFamily: "monospace",
          fontSize: "11px",
          letterSpacing: "0.05em",
          width: "100%",
          transition: "background 0.2s, border-color 0.2s, color 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,100,100,0.18)";
          e.currentTarget.style.borderColor = "rgba(255,100,100,0.35)";
          e.currentTarget.style.color = "rgba(255,100,100,1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,100,100,0.1)";
          e.currentTarget.style.borderColor = "rgba(255,100,100,0.2)";
          e.currentTarget.style.color = "rgba(255,100,100,0.85)";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.98)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        End Interview
      </button>
    </div>
  );
}

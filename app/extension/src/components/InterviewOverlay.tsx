import { useMemo, useState, useEffect } from "react";
import { useDraggable } from "../hooks/useDraggable";
import { Waveform } from "./Waveform";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function InterviewOverlay({
  phase,
  debriefData,
  onStop,
}: {
  phase: string;
  debriefData?: any;
  onStop: () => void;
}) {
  const { offset, handleMouseDown, isDragging } = useDraggable();
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (phase !== "IDLE" && phase !== "DEBRIEF_READY" && phase !== "ERROR") {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  const isDebrief = phase === "DEBRIEF_READY";

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none"
      }}
      onMouseDown={handleMouseDown}
    >
      <style>{`
        @keyframes wv { 0%,100%{transform:scaleY(1);opacity:.8} 50%{transform:scaleY(0.3);opacity:0.3} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>

      <div style={{
        fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
        color: "#3a3a4a", fontFamily: "monospace", textAlign: "center"
      }}>
        {isDebrief ? "debrief" : "recording"}
      </div>

      {!isDebrief ? (
        <div style={{
          width: "280px", background: "#221e1e", borderRadius: "20px", border: "1px solid #2e2424", overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
        }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 16px 0" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "7px", background: "#2e1f1f",
              border: "1px solid #4a2828", color: "#c07070", borderRadius: "30px",
              padding: "7px 16px", fontSize: "12px", fontWeight: "500", fontFamily: "monospace",
              letterSpacing: "0.02em"
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#804040", animation: "blink 1.2s infinite" }}></div>
              {phase === "SPEAKING" ? "Interviewer speaking" : phase === "CONNECTING" ? "Connecting" : phase === "PROCESSING" ? "Processing" : "Listening"}
            </div>
          </div>
          <div style={{ background: "#1a1616", borderRadius: "14px", margin: "8px 0 0", padding: "10px 12px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "38px", marginBottom: "2px" }}>
              {(phase === "LISTENING" || phase === "SPEAKING") && <Waveform />}
            </div>
            <div style={{ fontSize: "11px", color: "#3a3a4a", textAlign: "center", fontFamily: "monospace", marginBottom: "8px" }}>
              {formatTime(timer)}
            </div>
            <div className="no-drag" style={{ display: "flex", justifyContent: "space-around" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0b0b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1a3.5 3.5 0 0 0 -3.5 -3.5z"></path><path d="M8.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1a3.5 3.5 0 0 0 -3.5 -3.5z"></path><path d="M17.5 16a3.5 3.5 0 0 0 0 7h-11a3.5 3.5 0 0 0 0 -7"></path><path d="M3 8a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v5a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z"></path></svg>
                <span style={{ fontSize: "10px", color: "#b0b0b0", fontFamily: "monospace", fontWeight: "500" }}>Problem</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"></path><path d="M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"></path></svg>
                <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>Pause</span>
              </div>
              <div onClick={onStop} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b06060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"></path></svg>
                <span style={{ fontSize: "10px", color: "#b06060", fontFamily: "monospace" }}>End</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z"></path><path d="M5 21v-7"></path></svg>
                <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>Flag</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          width: "280px", background: "#252525", borderRadius: "20px", border: "1px solid #2e2e2e", overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
        }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 16px 0" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "7px", background: "#1e2a24",
              border: "1px solid #2a3d30", color: "#70a888", borderRadius: "30px",
              padding: "7px 16px", fontSize: "12px", fontWeight: "500", fontFamily: "monospace",
              letterSpacing: "0.02em"
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"></path><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"></path><path d="M9 14l2 2l4 -4"></path><path d="M12 9l-3 -3"></path><path d="M12 15l-3 -3"></path></svg>
              Debrief ready
            </div>
          </div>
          <div style={{ background: "#1e1e1e", borderRadius: "14px", margin: "8px 0 0", padding: "10px 12px 12px" }}>
            <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
              <div style={{ flex: 1, background: "#252525", borderRadius: "8px", padding: "7px 4px", textAlign: "center", border: "1px solid #2e2e2e" }}>
                <div style={{ fontSize: "14px", fontWeight: "500", fontFamily: "monospace", color: "#b0b0b0" }}>{debriefData?.approach_score ?? "8.2"}</div>
                <div style={{ fontSize: "10px", color: "#606068", fontFamily: "monospace", marginTop: "3px" }}>Approach</div>
              </div>
              <div style={{ flex: 1, background: "#252525", borderRadius: "8px", padding: "7px 4px", textAlign: "center", border: "1px solid #2e2e2e" }}>
                <div style={{ fontSize: "14px", fontWeight: "500", fontFamily: "monospace", color: "#b0b0b0" }}>{debriefData?.communication_score ?? "6.5"}</div>
                <div style={{ fontSize: "10px", color: "#606068", fontFamily: "monospace", marginTop: "3px" }}>Clarity</div>
              </div>
              <div style={{ flex: 1, background: "#252525", borderRadius: "8px", padding: "7px 4px", textAlign: "center", border: "1px solid #2e2e2e" }}>
                <div style={{ fontSize: "14px", fontWeight: "500", fontFamily: "monospace", color: "#b0b0b0" }}>{debriefData?.code_correctness_score ?? "4.1"}</div>
                <div style={{ fontSize: "10px", color: "#606068", fontFamily: "monospace", marginTop: "3px" }}>Edge cases</div>
              </div>
              <div style={{ flex: 1, background: "#252525", borderRadius: "8px", padding: "7px 4px", textAlign: "center", border: "1px solid #2e2e2e" }}>
                <div style={{ fontSize: "14px", fontWeight: "500", fontFamily: "monospace", color: "#b0b0b0" }}>{debriefData?.code_quality_score ?? "7.8"}</div>
                <div style={{ fontSize: "10px", color: "#606068", fontFamily: "monospace", marginTop: "3px" }}>Complexity</div>
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "#707078", background: "#222222", borderLeft: "2px solid #404040", borderRadius: "0 8px 8px 0", padding: "8px 10px", fontFamily: "monospace", lineHeight: "1.55", marginBottom: "10px" }}>
              {debriefData?.actionable_feedback?.[0] ? (
                 <span style={{ color: "#a0a0a8" }}>{debriefData.actionable_feedback[0]}</span>
              ) : (
                <>
                  <b style={{ color: "#a0a0a8", fontWeight: "500" }}>Jumped to code early</b> — no clarification on constraints before optimizing.
                </>
              )}
            </div>
            <div style={{ fontSize: "10px", color: "#606068", textAlign: "center", marginBottom: "10px", fontFamily: "monospace" }}>
              Visit the dashboard from your profile for detailed insights!
            </div>
            <div className="no-drag" style={{ display: "flex", justifyContent: "space-around" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0b0b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="M20 18v3"></path><path d="M16 16v5"></path><path d="M12 13v8"></path><path d="M8 16v5"></path><path d="M3 11c6 0 5 -5 9 -5s3 5 9 5"></path></svg>
                <span style={{ fontSize: "10px", color: "#b0b0b0", fontFamily: "monospace", fontWeight: "500" }}>Scores</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9h8"></path><path d="M8 13h6"></path><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"></path></svg>
                <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>Transcript</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5"></path></svg>
                <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>Retry</span>
              </div>
              <div onClick={onStop} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b06060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg>
                <span style={{ fontSize: "10px", color: "#b06060", fontFamily: "monospace" }}>Close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

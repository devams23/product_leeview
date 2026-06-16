import { useDraggable } from "../hooks/useDraggable";

export function StartPill({ onClick }: { onClick: () => void }) {
  const { offset, handleMouseDown, isDragging } = useDraggable();

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
      <div style={{
        fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
        color: "#3a3a4a", fontFamily: "monospace", textAlign: "center"
      }}>
        idle
      </div>
      <div style={{
        width: "280px", background: "#252525", borderRadius: "20px", border: "1px solid #2e2e2e", overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 16px 0" }}>
          <button
            onClick={onClick}
            style={{
              display: "flex", alignItems: "center", gap: "7px", background: "#2e2e2e",
              border: "1px solid #3a3a3a", color: "#c8c8c8", borderRadius: "30px",
              padding: "7px 16px", fontSize: "12px", fontWeight: "500", fontFamily: "monospace",
              letterSpacing: "0.02em", cursor: "pointer", transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#3a3a3a";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#2e2e2e";
              e.currentTarget.style.color = "#c8c8c8";
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z"></path><path d="M5 10a7 7 0 0 0 14 0"></path><path d="M8 21l8 0"></path><path d="M12 17l0 4"></path></svg>
            Begin interview
          </button>
        </div>
        <div style={{ background: "#1e1e1e", borderRadius: "14px", margin: "8px 0 0", padding: "10px 12px 12px" }}>
          <div className="no-drag" style={{ display: "flex", justifyContent: "space-around" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0b0b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1a3.5 3.5 0 0 0 -3.5 -3.5z"></path><path d="M8.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1a3.5 3.5 0 0 0 -3.5 -3.5z"></path><path d="M17.5 16a3.5 3.5 0 0 0 0 7h-11a3.5 3.5 0 0 0 0 -7"></path><path d="M3 8a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v5a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z"></path></svg>
              <span style={{ fontSize: "10px", color: "#b0b0b0", fontFamily: "monospace", fontWeight: "500" }}>Problem</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"></path><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"></path><path d="M9 14l2 2l4 -4"></path></svg>
              <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>History</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path></svg>
              <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>Config</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", padding: "5px 8px", borderRadius: "10px", minWidth: "52px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path><path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855"></path></svg>
              <span style={{ fontSize: "10px", color: "#3a3a4a", fontFamily: "monospace" }}>Profile</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

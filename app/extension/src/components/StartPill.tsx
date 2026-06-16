export function StartPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        padding: "14px 28px",
        borderRadius: "30px",
        background: "rgba(255,255,255,0.9)",
        color: "#111",
        border: "1px solid rgba(255,255,255,0.22)",
        outline: "1px solid rgba(0,0,0,0.18)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        cursor: "pointer",
        fontWeight: "500",
        fontSize: "13px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: "0.02em",
        transition: "background 0.2s, border-color 0.2s, transform 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,1)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.9)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
      }}
    >
      Start Mock Interview
    </button>
  );
}

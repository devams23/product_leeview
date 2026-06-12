export function Waveform() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "20px", marginTop: "8px" }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "2px",
            height: "100%",
            backgroundColor: "rgba(255,255,255,0.5)",
            animation: `wave 1s ease-in-out infinite ${i * 0.05}s`,
            borderRadius: "1px",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

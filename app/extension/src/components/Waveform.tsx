export function Waveform() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "3px",
        height: "28px",
        marginTop: "10px",
        padding: "0 4px",
      }}
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "3px",
            flex: 1,
            maxWidth: "6px",
            height: "100%",
            background: `linear-gradient(180deg, rgba(255,100,100,0.9) 0) 0%, rgba(255,180,80,0.8) 100%)`,
            animation: `wave 1.1s ease-in-out infinite ${i * 0.045}s`,
            borderRadius: "2px",
            boxShadow: "0 0 4px rgba(255,100,100,0.4)",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.15); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

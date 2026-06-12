import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signInWithGoogle, user } = useAuth();

  if (user) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center", height: "100vh",
        backgroundColor: "#1a1b1e", color: "rgba(255,255,255,0.88)", fontFamily: "system-ui",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "20px", padding: "32px", maxWidth: "400px", width: "100%",
        }}>
          <h1 style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 8px" }}>Logged In</h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", margin: "0 0 16px" }}>
            {user.email}
          </p>
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px", padding: "14px", marginBottom: "16px",
          }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", margin: "0 0 4px" }}>
              Your Supabase User ID
            </p>
            <code style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", wordBreak: "break-all" }}>
              {user.id}
            </code>
          </div>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: "0" }}>
            Copy this ID into the LeeView extension popup to authenticate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center", height: "100vh",
      backgroundColor: "#1a1b1e",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "20px", padding: "32px", textAlign: "center",
      }}>
        <h1 style={{ fontSize: "18px", fontWeight: 500, color: "rgba(255,255,255,0.88)", margin: "0 0 16px" }}>
          LeeView Dashboard
        </h1>
        <button
          onClick={signInWithGoogle}
          style={{
            padding: "12px 24px", borderRadius: "30px", fontSize: "13px",
            background: "rgba(255,255,255,0.9)", color: "#111",
            border: "none", cursor: "pointer", fontWeight: 500,
          }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

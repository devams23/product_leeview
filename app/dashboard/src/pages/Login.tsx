import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signInWithGoogle } = useAuth();
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
    </div>
  );
}

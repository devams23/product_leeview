import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signInWithGoogle, user } = useAuth();

  if (user) {
    return (
      <div className="flex justify-center items-center h-screen bg-bgBase text-textPrimary">
        <div className="glass-panel p-8 max-w-[400px] w-full mx-4 text-center">
          <h1 className="font-sans text-xl font-medium mb-2">Logged In</h1>
          <p className="text-sm text-textSecondary mb-6 font-mono">
            {user.email}
          </p>
          <div className="glass-inner p-4 mb-4 text-left">
            <p className="text-[10px] text-textMuted uppercase tracking-widest mb-1">
              Your Supabase User ID
            </p>
            <code className="text-xs text-textPrimary/80 break-all font-mono">
              {user.id}
            </code>
          </div>
          <p className="text-xs text-textSecondary">
            Head to the dashboard to see your interviews.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen bg-bgBase p-4">
      <div className="glass-panel p-10 text-center max-w-sm w-full">
        <h1 className="font-sans text-2xl font-medium text-textPrimary mb-6">
          LeeView
        </h1>
        <button
          onClick={signInWithGoogle}
          className="px-6 py-3 rounded-pill text-sm bg-accent text-accentText font-medium hover:opacity-90 transition-opacity"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

import type { ErrorCode, InterviewError } from "../types";
import { AlertIcon, RetryIcon } from "./Icons";
import { openDashboard } from "./openDashboard";

interface ErrorCardProps {
  error: InterviewError;
  onRetry: () => void;
  onSignIn: () => void;
  onDismiss: () => void;
}

const COPY: Record<ErrorCode, { title: string; fix: string }> = {
  MIC_DENIED: {
    title: "Microphone is blocked",
    fix: "Click the lock icon in the address bar, open Site settings, set Microphone to Allow, then try again.",
  },
  MIC_UNAVAILABLE: {
    title: "No microphone found",
    fix: "Connect a microphone and check that Chrome can use it in your system sound settings.",
  },
  BACKEND_UNREACHABLE: {
    title: "Can't reach LeeView",
    fix: "The LeeView server isn't responding. Check your connection, then try again.",
  },
  AUTH_EXPIRED: {
    title: "Your session expired",
    fix: "Reconnect your account in one click to keep going.",
  },
  STT_FAILED: {
    title: "Speech recognition dropped",
    fix: "Your speech couldn't be transcribed. Check your connection and try again.",
  },
  CONNECTION_LOST: {
    title: "Connection lost",
    fix: "The link to your interviewer dropped mid-session. Start again to reconnect.",
  },
  DEBRIEF_FAILED: {
    title: "Debrief didn't generate",
    fix: "Something went wrong writing your feedback. Start a new interview to try again.",
  },
  DEBRIEF_TIMEOUT: {
    title: "Debrief is taking too long",
    fix: "Your feedback didn't arrive in time. Start a new interview to try again.",
  },
  KEYS_MISSING: {
    title: "Add your API keys",
    fix: "LeeView runs on your own NVIDIA NIM or OpenRouter key and a Deepgram key. Add them on your profile, then try again.",
  },
  KEY_REJECTED: {
    title: "An API key was rejected",
    fix: "One of your keys was turned down by its provider. Check it or paste a new one on your profile, then try again.",
  },
  SERVER_SETUP: {
    title: "The server isn't set up yet",
    fix: "This LeeView server can't read saved API keys. Whoever runs it needs to set KEY_ENCRYPTION_KEY and restart it.",
  },
  SESSION_ENDED: {
    title: "This interview has ended",
    fix: "Start a new interview to practice again.",
  },
  TURN_FAILED: {
    title: "The interviewer couldn't respond",
    fix: "Try again. The interview will restart from the beginning.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    fix: "Try again. If it keeps happening, reload the page.",
  },
};

/** One clear next step per error code: sign in, retry, or dismiss. */
export function ErrorCard({ error, onRetry, onSignIn, onDismiss }: ErrorCardProps) {
  const copy = COPY[error.code] ?? COPY.UNKNOWN;
  const isAuth = error.code === "AUTH_EXPIRED";

  if (error.code === "KEYS_MISSING" || error.code === "KEY_REJECTED") {
    // The server's message says which key is missing or was rejected.
    return (
      <div className="lv-stack lv-center">
        <span className="lv-card-icon lv-card-icon--danger" aria-hidden="true">
          <AlertIcon />
        </span>
        <p className="lv-title" role="alert">{copy.title}</p>
        <p className="lv-muted">{error.message || copy.fix}</p>
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={() => openDashboard("/profile")}>
          Open profile
        </button>
        <button type="button" className="lv-btn lv-btn--ghost lv-btn--block" onClick={onRetry}>
          <RetryIcon />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="lv-stack lv-center">
      <span className="lv-card-icon lv-card-icon--danger" aria-hidden="true">
        <AlertIcon />
      </span>
      <p className="lv-title" role="alert">{copy.title}</p>
      <p className="lv-muted">{error.code === "SERVER_SETUP" ? error.message || copy.fix : copy.fix}</p>

      {isAuth ? (
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onSignIn}>
          Sign in
        </button>
      ) : error.retryable ? (
        <button type="button" className="lv-btn lv-btn--primary lv-btn--block" onClick={onRetry}>
          <RetryIcon />
          Try again
        </button>
      ) : (
        <button type="button" className="lv-btn lv-btn--ghost lv-btn--block" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

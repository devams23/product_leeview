import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import { useProblem } from "./useProblem";
import { useInterview } from "./useInterview";
import { useCollapsed, usePersistentPosition } from "../hooks/usePersistentPosition";
import type { Phase } from "../types";
import { OverlayShell } from "../components/OverlayShell";
import { Launcher } from "../components/Launcher";
import { SignedOutCard } from "../components/SignedOutCard";
import { ReadyCard } from "../components/ReadyCard";
import { SetupCard } from "../components/SetupCard";
import { LiveCard } from "../components/LiveCard";
import { GeneratingCard } from "../components/GeneratingCard";
import { DebriefCard } from "../components/DebriefCard";
import { ErrorCard } from "../components/ErrorCard";
import { openDashboard } from "../components/openDashboard";

const SHELL_WIDTH = 340;
const LIVE_PHASES: ReadonlySet<Phase> = new Set<Phase>(["LISTENING", "AI_SPEAKING", "THINKING"]);

/** The focused element, looking through our own shadow root when focus is inside the overlay. */
function activeElementDeep(): Element | null {
  let el: Element | null = document.activeElement;
  while (el instanceof HTMLElement && el.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

/** True when keystrokes belong to a text field (LeetCode's Monaco editor is a textarea). */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const role = el.getAttribute("role");
  return role === "textbox" || el.getAttribute("contenteditable") === "true";
}

export default function App() {
  const auth = useAuth();
  const problem = useProblem();
  const interview = useInterview(auth);
  const [collapsed, setCollapsed] = useCollapsed();
  const position = usePersistentPosition(SHELL_WIDTH);

  const {
    phase, stage, elapsedSeconds, micLevel, muted, toggleMute, aiCaption, userCaption,
    debrief, sessionId, error, start, end, reset,
  } = interview;
  const live = LIVE_PHASES.has(phase);

  // The keydown listener is registered once per live session; it reads the latest toggle here.
  const toggleRef = useRef(toggleMute);
  toggleRef.current = toggleMute;

  // "M" mutes while live, but never while the user is typing (LeetCode's editor included).
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== "m") return;
      if (isTypingTarget(activeElementDeep())) return;
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live]);

  // Wait for the stored sign-in state before deciding what to show.
  if (auth.status === "loading" && phase === "IDLE") return null;

  if (collapsed) {
    return (
      <Launcher
        shellRef={position.shellRef}
        style={position.style}
        dragging={position.dragging}
        onPointerDown={position.onPointerDown}
        onExpand={() => setCollapsed(false)}
        problemTitle={problem.title}
        live={live}
        elapsedSeconds={elapsedSeconds}
      />
    );
  }

  let key: string;
  let body: ReactNode;

  if (phase === "ERROR" && error) {
    key = "error";
    body = (
      <ErrorCard
        error={error}
        onRetry={() => {
          reset();
          void start();
        }}
        onSignIn={() => {
          auth.openSignIn();
          reset();
        }}
        onDismiss={reset}
      />
    );
  } else if (phase === "DEBRIEF_READY") {
    key = "debrief";
    body = (
      <DebriefCard
        debrief={debrief}
        sessionId={sessionId}
        onViewFull={() => {
          if (sessionId) openDashboard(`/session/${sessionId}`);
        }}
        onPractice={reset}
      />
    );
  } else if (phase === "GENERATING_DEBRIEF") {
    key = "generating";
    body = <GeneratingCard />;
  } else if (phase === "PREFLIGHT" || phase === "CONNECTING") {
    key = phase === "PREFLIGHT" ? "preflight" : "connecting";
    body = <SetupCard phase={phase} />;
  } else if (live) {
    key = "live";
    body = (
      <LiveCard
        phase={phase}
        stage={stage}
        elapsedSeconds={elapsedSeconds}
        micLevel={micLevel}
        muted={muted}
        onToggleMute={toggleMute}
        aiCaption={aiCaption}
        userCaption={userCaption}
        onEnd={end}
      />
    );
  } else if (auth.status === "signed_in") {
    key = "ready";
    body = (
      <ReadyCard
        problemTitle={problem.title}
        difficulty={problem.difficulty}
        hasProblem={Boolean(problem.slug)}
        onStart={() => {
          void start();
        }}
      />
    );
  } else {
    key = auth.status === "expired" ? "expired" : "signed_out";
    body = (
      <SignedOutCard
        expired={auth.status === "expired"}
        onSignIn={auth.openSignIn}
        onReconnect={auth.reconnect}
      />
    );
  }

  return (
    <OverlayShell
      shellRef={position.shellRef}
      style={position.style}
      dragging={position.dragging}
      onPointerDown={position.onPointerDown}
      onCollapse={() => setCollapsed(true)}
      meta={problem.title || undefined}
    >
      <div key={key} className="lv-body">
        {body}
      </div>
    </OverlayShell>
  );
}

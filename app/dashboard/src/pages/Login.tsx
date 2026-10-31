import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Brand } from "../components/ui/BrandMark";
import { InterviewOrb, useInterviewScript } from "../components/landing/InterviewOrb";
import { ExtensionAction } from "../components/ExtensionAction";

const SETUP_STEPS = [
  { title: "Add LeeView to Chrome", body: "Install it from the Chrome Web Store." },
  { title: "Pin it to your toolbar", body: "Click the puzzle piece beside the address bar, then the pin next to LeeView." },
  { title: "Sign in", body: "Click the LeeView icon and sign in, so every interview saves to your account." },
];

const STEPS = [
  {
    title: "Open a problem",
    body: "Go to any LeetCode problem and press Start interview in the LeeView panel beside it.",
    visual: <ProblemVisual />,
  },
  {
    title: "Explain your approach",
    body: "Allow your microphone the first time, then reason out loud. The interviewer listens and pushes back.",
    visual: <VoiceVisual />,
  },
  {
    title: "Code as you normally do",
    body: "Write in the LeetCode editor. The interviewer sees your code and asks about it.",
    visual: <CodeVisual />,
  },
  {
    title: "Get scored",
    body: "Finish, and every part of the interview is scored while it's fresh.",
    visual: <ScoreVisual />,
  },
];

const EXAMPLE_SCORES = [
  { label: "Approach", score: 8 },
  { label: "Communication", score: 6 },
  { label: "Correctness", score: 9 },
  { label: "Code quality", score: 7 },
  { label: "Time", score: 7 },
];
const EXAMPLE_WEAKEST = Math.min(...EXAMPLE_SCORES.map(({ score }) => score));
const EXAMPLE_NEXT = ["3Sum", "Group Anagrams"];

const VOICE_BARS = [10, 22, 34, 18, 44, 28, 52, 30, 16, 38, 24, 46, 20, 12, 30, 40, 22, 14];

function ProblemVisual() {
  return (
    <div className="w-full max-w-[210px] rounded-card border border-line-2 bg-ink-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-text-1">Two Sum</span>
        <span className="rounded-chip bg-ok/15 px-2 py-0.5 text-[11px] text-ok">Easy</span>
      </div>
      <span className="mt-3 block h-1.5 w-full rounded-full bg-ink-3" />
      <span className="mt-2 block h-1.5 w-2/3 rounded-full bg-ink-3" />
    </div>
  );
}

function VoiceVisual() {
  return (
    <div className="flex h-14 items-center gap-1" aria-hidden="true">
      {VOICE_BARS.map((height, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${i < 9 ? "bg-ai" : "bg-signal"}`}
          style={{ height }}
        />
      ))}
    </div>
  );
}

function CodeVisual() {
  return (
    <pre className="w-full max-w-[210px] overflow-hidden rounded-card border border-line-2 bg-ink-2 py-3 font-mono text-[12px] leading-6 text-text-3">
      <code>
        <span className="block px-4">for i, n in nums:</span>
        <span className="block bg-signal-soft px-4 text-signal">  if target - n in seen:</span>
        <span className="block px-4">    return [seen[...], i]</span>
      </code>
    </pre>
  );
}

function ScoreVisual() {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-display text-[72px] leading-none tabular-nums text-signal">7</span>
      <span className="text-[16px] text-text-3">/10</span>
    </div>
  );
}

function WaveGlyph() {
  return (
    <span className="flex h-3.5 items-center gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="lv-wave-bar h-full w-[2px] rounded-full bg-signal" style={{ animationDelay: `${i * -0.22}s` }} />
      ))}
    </span>
  );
}

function ExampleDebrief() {
  return (
    <div className="rounded-shell border border-line-2 bg-ink-1 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] text-text-3">Example debrief for Two Sum</p>
          <p className="mt-3 max-w-[20ch] font-display text-[26px] leading-[1.12] tracking-[-0.02em] text-text-1 sm:text-[30px]">
            Strong approach, then you went quiet.
          </p>
        </div>
        <span className="flex shrink-0 items-baseline gap-1">
          <span className="font-display text-[56px] leading-none tabular-nums text-text-1">7</span>
          <span className="text-[13px] text-text-3">/10</span>
        </span>
      </div>

      <dl className="mt-8 flex flex-wrap gap-x-7 gap-y-5 sm:justify-between">
        {EXAMPLE_SCORES.map(({ label, score }) => (
          <div key={label} className="flex flex-col-reverse gap-1">
            <dt className={`text-[13px] ${score === EXAMPLE_WEAKEST ? "text-text-1" : "text-text-3"}`}>{label}</dt>
            <dd
              className={`font-display text-[28px] leading-none tabular-nums ${
                score === EXAMPLE_WEAKEST ? "text-signal" : "text-text-2"
              }`}
            >
              {score}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 rounded-card bg-ink-2 p-5">
        <p className="text-[13px] font-medium text-signal">Work on your communication</p>
        <p className="mt-2 text-[16px] leading-relaxed text-text-1">
          You stopped talking once you started coding. Say what you're about to write before you write it.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-text-3">
        <span className="mr-1">Practice next</span>
        {EXAMPLE_NEXT.map((problem) => (
          <span key={problem} className="rounded-chip border border-line-2 px-2.5 py-1 text-text-2">
            {problem}
          </span>
        ))}
      </div>
    </div>
  );
}

interface StartActionProps {
  onStart: () => void;
  busy: boolean;
  error: string | null;
  className?: string;
}

function StartAction({ onStart, busy, error, className = "" }: StartActionProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="group inline-flex h-[52px] items-center gap-4 rounded-[14px] bg-signal pl-6 pr-1.5 text-[15px] font-semibold text-signal-ink transition-colors hover:bg-[#E2FF6E] disabled:pointer-events-none disabled:opacity-40"
      >
        Start a mock interview
        <span className="grid h-10 w-10 place-items-center rounded-btn bg-ink-0 text-signal transition-transform duration-200 group-hover:translate-x-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          Sign-in did not complete: {error}
        </p>
      )}
      <p className="text-[13px] text-text-3">
        Free while in beta.{" "}
        <a href="#install" className="text-text-2 underline underline-offset-4 transition-colors hover:text-text-1">
          See how to install
        </a>
      </p>
    </div>
  );
}

export function Login() {
  const { signInWithGoogle, authError } = useAuth();
  const [params] = useSearchParams();
  const fromExtension = params.get("from") === "extension";
  const [busy, setBusy] = useState(false);
  // A failed sign-in is reported beside the button that started it.
  const [startedFromClose, setStartedFromClose] = useState(false);
  const { line, spoken, phase } = useInterviewScript();
  const speakerLit = (speaker: string) => (phase !== "thinking" && line.speaker === speaker ? "opacity-100" : "opacity-0");

  useEffect(() => {
    if (!fromExtension) return;
    try {
      sessionStorage.setItem("lv:from-extension", "1");
    } catch {
      // Storage unavailable: the connected banner will not show.
    }
  }, [fromExtension]);

  async function handleSignIn() {
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-0">
      <header className="relative z-20">
        <div className="mx-auto grid h-[72px] max-w-[1200px] grid-cols-[1fr_auto] items-center px-5 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
          <a href="#top" aria-label="LeeView home" className="justify-self-start">
            <Brand size={28} />
          </a>
          <nav aria-label="Page" className="hidden rounded-full border border-line-2 bg-ink-1/80 p-1 sm:flex">
            {[["Install", "#install"], ["How it works", "#how"], ["Debrief", "#debrief"]].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-1.5 text-[14px] text-text-2 transition-colors hover:bg-ink-3 hover:text-text-1"
              >
                {label}
              </a>
            ))}
          </nav>
          <Button variant="ghost" size="md" onClick={handleSignIn} disabled={busy} className="justify-self-end">
            Sign in
          </Button>
        </div>
      </header>

      <main id="top" className="relative">
        <section className="mx-auto flex max-w-[1000px] flex-col items-center px-5 pt-14 text-center sm:px-8 sm:pt-20">
          <div className="lv-rise relative z-10 flex flex-col items-center gap-5">
            <p className="flex items-center gap-2.5 text-[14px] text-text-2">
              <WaveGlyph />
              Voice mock interviews for LeetCode
            </p>
            {fromExtension && (
              <p role="note" className="rounded-btn bg-signal-soft px-3 py-2 text-[13px] text-signal">
                Sign in to connect the LeeView extension.
              </p>
            )}
            <h1 className="font-display text-balance text-[46px] leading-[1] tracking-[-0.02em] text-text-1 [font-variation-settings:'opsz'_96] sm:text-[72px] lg:text-[84px]">
              Practice the interview, not just the problem.
            </h1>
            <p className="max-w-[52ch] text-pretty text-[17px] leading-relaxed text-text-2 sm:text-[18px]">
              LeeView sits beside any LeetCode problem and questions you out loud, the way a real interviewer would.
            </p>
            <StartAction
              onStart={() => {
                setStartedFromClose(false);
                void handleSignIn();
              }}
              busy={busy}
              error={startedFromClose ? null : authError}
              className="mt-2 items-center"
            />
          </div>

          <figure className="lv-orb-in relative mt-4 flex w-full flex-col items-center" aria-label="Example of an interview">
            {/* Light fans out from the orb beside the copy, in the colour of whoever is speaking. */}
            <div className="lv-rays" aria-hidden="true">
              <span className={`lv-ray lv-ray--ai ${speakerLit("interviewer")}`} />
              <span className={`lv-ray lv-ray--signal ${speakerLit("you")}`} />
            </div>
            <InterviewOrb speaker={line.speaker} phase={phase} spoken={spoken} />
            <figcaption className="relative -mt-3 min-h-[92px] w-full max-w-[46ch] text-left sm:min-h-[76px]">
              <div key={line.text}>
                <p
                  className={`text-[13px] font-medium transition-colors duration-500 ${
                    phase === "thinking" ? "text-text-3" : line.speaker === "you" ? "text-signal" : "text-ai"
                  }`}
                >
                  {phase === "thinking" ? "Interviewer is thinking" : line.speaker === "you" ? "You" : "Interviewer"}
                </p>
                <p className="mt-1 text-pretty text-[16px] leading-snug text-text-1">
                  {line.text.split(" ").map((word, i) => (
                    <Fragment key={i}>
                      <span className={`lv-word ${i < spoken ? "lv-word--said" : ""}`}>{word}</span>{" "}
                    </Fragment>
                  ))}
                </p>
              </div>
            </figcaption>
          </figure>
        </section>

        <section id="install" className="mx-auto mt-24 max-w-[1200px] scroll-mt-24 px-5 sm:mt-32 sm:px-8">
          <div className="grid gap-10 rounded-shell border border-line-2 bg-ink-1 p-6 sm:p-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div className="flex flex-col items-start">
              <h2 className="max-w-[14ch] font-display text-[32px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">
                Set up once, then just practice.
              </h2>
              <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-text-2">
                LeeView runs in Chrome, right on the LeetCode page, so there's nothing else to open.
              </p>
              <div className="mt-auto pt-8">
                <ExtensionAction />
                <p className="mt-3 text-[13px] text-text-3">For Chrome on desktop, with a microphone</p>
              </div>
            </div>
            <ol className="flex flex-col">
              {SETUP_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-5 border-t border-line py-6 first:border-t-0 first:pt-0 last:pb-0">
                  <span aria-hidden="true" className="font-display text-[28px] leading-none tabular-nums text-text-3">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[17px] font-semibold text-text-1">{step.title}</p>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="how" className="mx-auto mt-24 max-w-[1200px] scroll-mt-24 px-5 sm:mt-32 sm:px-8">
          <h2 className="max-w-[20ch] font-display text-[32px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">
            Every interview, from problem to scorecard.
          </h2>
          <ol className="mt-10 grid overflow-hidden rounded-shell border border-line-2 bg-ink-1 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex flex-col border-line-2 p-6 [&:not(:last-child)]:border-b sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r"
              >
                <span className="text-[13px] tabular-nums text-text-3">{String(i + 1).padStart(2, "0")}</span>
                <div className="grid h-[176px] place-items-center">{step.visual}</div>
                <p className="text-[17px] font-semibold text-text-1">{step.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-text-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="debrief"
          className="mx-auto mt-24 grid max-w-[1200px] scroll-mt-24 items-center gap-10 px-5 sm:mt-32 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-20"
        >
          <div>
            <h2 className="max-w-[16ch] font-display text-[32px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">
              Solving it was only half the score.
            </h2>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-text-2">
              Interviewers grade how you think, not just whether the tests pass. LeeView scores both, then tells you
              what to change before your next one.
            </p>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-text-2">
              Every session keeps its transcript, so you can read back exactly what you said.
            </p>
          </div>
          <ExampleDebrief />
        </section>
      </main>

      <footer className="mt-28 border-t border-line sm:mt-40">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="grid gap-10 pb-20 pt-20 sm:pb-28 sm:pt-28 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <h2 className="max-w-[13ch] text-balance font-display text-[52px] leading-[1] tracking-[-0.02em] text-text-1 [font-variation-settings:'opsz'_96] sm:text-[84px] lg:text-[104px]">
              Say it out loud before it counts.
            </h2>
            <StartAction
              onStart={() => {
                setStartedFromClose(true);
                void handleSignIn();
              }}
              busy={busy}
              error={startedFromClose ? authError : null}
              className="items-start lg:items-end lg:pb-3"
            />
          </div>
          <div className="flex items-center justify-between pb-8 text-[13px] text-text-3">
            <Brand size={22} />
            <span>© 2026 LeeView</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

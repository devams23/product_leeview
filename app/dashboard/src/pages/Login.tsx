import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Brand } from "../components/ui/BrandMark";
import { InterviewOrb, useInterviewScript } from "../components/landing/InterviewOrb";

const STEPS = [
  {
    title: "Open a problem",
    body: "Start LeeView on any LeetCode problem. It reads the question and your language.",
    visual: <ProblemVisual />,
  },
  {
    title: "Explain your approach",
    body: "Ask questions and reason out loud. The interviewer listens and pushes back.",
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
  { label: "Code correctness", score: 9 },
  { label: "Code quality", score: 7 },
  { label: "Time management", score: 7 },
];

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-text-3">Example debrief</p>
          <p className="mt-1 text-[16px] font-semibold text-text-1">Two Sum</p>
        </div>
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[44px] leading-none tabular-nums text-signal">7</span>
          <span className="text-[13px] text-text-3">/10</span>
        </span>
      </div>

      <dl className="mt-7 flex flex-col gap-4">
        {EXAMPLE_SCORES.map(({ label, score }) => (
          <div key={label}>
            <div className="flex items-baseline justify-between text-[14px]">
              <dt className="text-text-2">{label}</dt>
              <dd className="tabular-nums text-text-1">{score}</dd>
            </div>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-ink-3">
              <span className="block h-full rounded-full bg-text-2" style={{ width: `${score * 10}%` }} />
            </span>
          </div>
        ))}
      </dl>

      <p className="mt-7 border-t border-line pt-5 text-[14px] leading-relaxed text-text-2">
        You went quiet for most of the coding stage. Say what you're about to write before you write it.
      </p>
    </div>
  );
}

export function Login() {
  const { signInWithGoogle, authError } = useAuth();
  const [params] = useSearchParams();
  const fromExtension = params.get("from") === "extension";
  const [busy, setBusy] = useState(false);
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
            {[["How it works", "#how"], ["Debrief", "#debrief"]].map(([label, href]) => (
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
            <div className="mt-2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleSignIn}
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
              {authError && (
                <p role="alert" className="text-sm text-danger">
                  Sign-in did not complete: {authError}
                </p>
              )}
              <p className="text-[13px] text-text-3">Free while in beta</p>
            </div>
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

        <section id="how" className="mx-auto mt-24 max-w-[1200px] scroll-mt-24 px-5 sm:mt-32 sm:px-8">
          <h2 className="max-w-[20ch] font-display text-[32px] leading-[1.05] tracking-[-0.03em] text-text-1 sm:text-[44px]">
            From problem to scorecard in one sitting.
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
              the one thing to do differently next time.
            </p>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-text-2">
              Every session keeps its transcript, so you can read back exactly what you said.
            </p>
          </div>
          <ExampleDebrief />
        </section>
      </main>

      <footer className="mx-auto mt-24 max-w-[1200px] px-5 pb-10 text-[13px] text-text-3 sm:mt-32 sm:px-8">
        <div className="border-t border-line pt-6">© LeeView</div>
      </footer>
    </div>
  );
}

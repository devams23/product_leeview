import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button, buttonClass } from "../components/ui/Button";
import { Brand } from "../components/ui/BrandMark";

const STEPS = [
  {
    title: "Add the extension",
    body: "Add LeeView to Chrome and pin it to your toolbar so the panel is one click away.",
  },
  {
    title: "Open any problem",
    body: "Go to any LeetCode problem and open the LeeView panel.",
  },
  {
    title: "Talk it through",
    body: "Explain your approach out loud. You get a scored debrief when you finish.",
  },
];

const STAGES = ["Clarify", "Approach", "Code", "Walkthrough", "Wrap-up"];
const CURRENT_STAGE = 1;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.64 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96s2.63-5.96 5.85-5.96c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 4.2 14.6 3.3 12 3.3 6.97 3.3 2.9 7.37 2.9 12.5S6.97 21.7 12 21.7c5.3 0 8.8-3.72 8.8-8.96 0-.6-.07-1.06-.15-1.54z" />
    </svg>
  );
}

/** Static sample of the extension overlay, matching the real LiveCard. Clearly labelled as an example. */
function ExampleOverlay() {
  return (
    <div className="w-full rounded-shell border border-line-2 bg-ink-1 p-5 pb-12 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between">
        <Brand size={22} live />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-2">Two Sum · 12:04</span>
      </div>

      <ol className="mt-6 flex gap-1" aria-label="Interview stage">
        {STAGES.map((stage, i) => (
          <li key={stage} className="flex-1">
            <span className={`block h-[3px] rounded-full ${i <= CURRENT_STAGE ? "bg-signal" : "bg-ink-3"}`} />
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-text-1">{STAGES[CURRENT_STAGE]}</span>
        <span className="font-mono text-[11px] text-text-3">{CURRENT_STAGE + 1} / {STAGES.length}</span>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4 py-4">
        <div className="flex h-10 items-center gap-1" aria-hidden="true">
          {[10, 18, 26, 14, 30, 20, 12, 24, 16].map((h, i) => (
            <span key={i} className="w-1 rounded-full bg-ai" style={{ height: h }} />
          ))}
        </div>
        <p className="text-sm text-ai">Interviewer speaking</p>
      </div>

      <p className="rounded-btn border border-line bg-ink-2 p-3 text-[13px] leading-relaxed text-text-2">
        Walk me through how your hash map handles duplicate values.
      </p>
    </div>
  );
}

/** Compact sample debrief that tucks under the overlay's empty bottom padding. */
function ExampleDebrief() {
  return (
    <div className="flex w-[280px] max-w-full items-center gap-4 rounded-card border border-line-2 bg-ink-2 p-4 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]">
      <span className="flex items-baseline gap-1">
        <span className="font-display text-[44px] leading-none tabular-nums text-signal">7</span>
        <span className="font-mono text-[12px] text-text-3">/10</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">Example debrief</span>
        <span className="text-[13px] leading-snug text-text-2">Strong approach, quiet while coding.</span>
      </span>
    </div>
  );
}

export function Login() {
  const { signInWithGoogle, authError } = useAuth();
  const [params] = useSearchParams();
  const fromExtension = params.get("from") === "extension";
  const [busy, setBusy] = useState(false);

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
    <div className="min-h-screen bg-ink-0">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <header className="flex h-16 items-center justify-between border-b border-line">
          <Brand size={28} />
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#how" className="text-[14px] text-text-2 transition-colors hover:text-text-1">
              How it works
            </a>
            <Button variant="ghost" size="md" onClick={handleSignIn} disabled={busy}>
              Sign in
            </Button>
          </div>
        </header>

        <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col items-start gap-3">
              <span className="inline-flex items-center rounded-full bg-signal-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-signal">
                Voice mock interviews for LeetCode
              </span>
              {fromExtension && (
                <p role="note" className="rounded-btn bg-signal-soft px-3 py-2 text-[13px] text-signal">
                  Sign in to connect the LeeView extension.
                </p>
              )}
            </div>

            <h1 className="font-display text-balance text-[44px] leading-[0.98] tracking-[-0.03em] text-text-1 [font-variation-settings:'opsz'_96] sm:text-[60px] lg:text-[68px]">
              Practice <span className="text-signal">the interview</span>, not just the problem.
            </h1>

            <p className="max-w-[48ch] text-[17px] leading-relaxed text-text-2 sm:text-[18px]">
              LeeView sits beside any LeetCode problem and talks you through it out loud, the way a real interviewer
              would. Afterwards you get a scored debrief and a transcript to replay.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="primary" size="lg" onClick={handleSignIn} disabled={busy} className="w-full sm:w-auto">
                  <GoogleIcon />
                  Continue with Google
                </Button>
                <a href="#how" className={buttonClass("ghost", "lg", "hidden sm:inline-flex")}>
                  See how it works
                </a>
              </div>
              {authError && (
                <p role="alert" className="text-sm text-danger">
                  Sign-in did not complete: {authError}
                </p>
              )}
              <p className="text-[13px] text-text-3">
                Free while in beta · Works on any LeetCode problem · No credit card
              </p>
            </div>
          </div>

          <div aria-label="Example of the product" className="relative mx-auto w-full max-w-[400px] lg:mx-0 lg:ml-auto">
            <ExampleOverlay />
            <div className="relative -mt-8 flex justify-end pr-4 sm:pr-6">
              <ExampleDebrief />
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-8 border-t border-line py-16">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">How it works</span>
          <h2 className="mt-3 font-display text-[28px] leading-tight tracking-[-0.025em] text-text-1 sm:text-[32px]">
            Three steps, then you're talking.
          </h2>
          <ol className="mt-8 grid divide-y divide-line overflow-hidden rounded-card border border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3 p-6">
                <span className="font-mono text-[12px] text-signal">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-[16px] font-semibold text-text-1">{step.title}</p>
                <p className="text-[14px] leading-relaxed text-text-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-col gap-2 border-t border-line py-8 text-[13px] text-text-3 sm:flex-row sm:justify-between">
          <span>© LeeView</span>
          <span>Built for interview prep</span>
        </footer>
      </div>
    </div>
  );
}

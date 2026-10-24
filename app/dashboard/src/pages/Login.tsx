import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { Card } from "../components/ui/Card";

import { SkillBar } from "../components/SkillBar";

const STEPS = [
  {
    title: "Install the extension",
    body: "Add LeeView to Chrome and pin it to your toolbar.",
  },
  {
    title: "Open any problem",
    body: "Go to a LeetCode problem and open the LeeView panel.",
  },
  {
    title: "Talk it through",
    body: "Explain your approach out loud. You get a scored debrief when you finish.",
  },
];

const STAGES = ["Clarify", "Approach", "Code", "Walkthrough", "Wrap-up"];

/** Static sample of the extension overlay. Clearly labelled as an example. */
function ExampleOverlay() {
  const current = 1;
  return (
    <div className="w-full max-w-[360px] rounded-shell border border-line-2 bg-ink-1 p-5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[12px] text-text-2">
          <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
          12:04
        </span>
        <span className="truncate pl-3 font-mono text-[11px] text-text-3">Two Sum</span>
      </div>

      <ol className="mt-5 flex gap-1.5" aria-label="Interview stage">
        {STAGES.map((stage, i) => (
          <li key={stage} className="flex-1">
            <span
              className={`block h-[3px] rounded-full ${
                i < current ? "bg-signal" : i === current ? "bg-signal" : "bg-ink-3"
              }`}
            />
            <span className={`mt-2 block h-4 font-mono text-[10px] ${i === current ? "text-text-1" : "invisible"}`}>
              {stage}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-col items-center gap-4 py-4">
        <div className="flex h-10 items-center gap-1" aria-hidden="true">
          {[10, 18, 26, 14, 30, 20, 12, 24, 16].map((h, i) => (
            <span key={i} className="w-1 rounded-full bg-ai" style={{ height: h }} />
          ))}
        </div>
        <p className="text-sm text-ai">Interviewer speaking</p>
      </div>

      <p className="rounded-inner border border-line bg-ink-2 p-3 text-[13px] leading-relaxed text-text-2">
        Walk me through how your hash map handles duplicate values.
      </p>
    </div>
  );
}

/** Static sample of the debrief. Clearly labelled as an example. */
function ExampleDebrief() {
  const skills = [
    { label: "Approach", value: 8 },
    { label: "Communication", value: 7 },
    { label: "Correctness", value: 8 },
    { label: "Code quality", value: 6 },
    { label: "Time", value: 6 },
  ];
  return (
    <Card className="w-full max-w-[460px] p-6 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-2">Example debrief</span>
        <Chip>Two Sum</Chip>
      </div>
      <div className="mt-5 flex items-end gap-4">
        <span className="font-display text-[88px] leading-none tabular-nums text-signal">7</span>
        <p className="pb-2 text-sm text-text-2">Overall, out of 10</p>
      </div>
      <ul className="mt-6 flex flex-col gap-4">
        {skills.map((s) => (
          <SkillBar key={s.label} label={s.label} value={s.value} />
        ))}
      </ul>
      <p className="mt-6 rounded-btn border border-warn/25 bg-warn-soft p-4 text-[13px] leading-relaxed text-text-1">
        Name the trade-off before you write the loop: one pass with a hash map trades memory for time.
      </p>
    </Card>
  );
}

export function Login() {
  const { signInWithGoogle, authError } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-ink-0">
      <div className="mx-auto grid min-h-screen max-w-[1200px] grid-cols-1 items-center gap-12 px-5 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10">
        <section className="flex min-w-0 flex-col gap-10">
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] border border-line-2 bg-ink-3">
              <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_12px_rgba(212,255,63,0.6)]" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-text-1">LeeView</span>
          </span>

          <div className="flex flex-col gap-5">
            <h1 className="font-display text-[46px] leading-[1.02] text-balance text-text-1 sm:text-[64px]">
              Practice the interview, not just the problem.
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-text-2">
              LeeView sits beside any LeetCode problem and talks you through it out loud, the way a real interviewer
              would. Afterwards you get a scored debrief and a transcript to replay.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="primary" onClick={handleSignIn} disabled={busy} className="h-12 px-6 text-[15px]">
                Continue with Google
              </Button>
              <p className="text-sm text-text-2">Sign in once. The extension stays signed in.</p>
            </div>
            {authError && (
              <p role="alert" className="text-sm text-danger">
                Sign-in did not complete: {authError}
              </p>
            )}
          </div>

          <ol className="grid gap-6 border-t border-line pt-8 sm:grid-cols-3 sm:gap-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="font-mono text-[12px] text-signal">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-[15px] font-medium text-text-1">{step.title}</p>
                <p className="text-[14px] leading-relaxed text-text-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Example of the product" className="flex min-w-0 flex-col items-center gap-6 lg:items-end">
          <ExampleOverlay />
          <ExampleDebrief />
        </section>
      </div>
    </div>
  );
}

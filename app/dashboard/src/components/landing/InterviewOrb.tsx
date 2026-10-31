import { useEffect, useRef, useState } from "react";

export type Speaker = "interviewer" | "you";
export type Phase = "thinking" | "speaking" | "listening";

type Rgb = [number, number, number];

// Same colours as the extension's orb: lime is the candidate, violet the interviewer.
const PALETTE: Record<Speaker | "thinking", [Rgb, Rgb]> = {
  you: [[212, 255, 63], [74, 222, 128]],
  interviewer: [[185, 166, 255], [110, 132, 255]],
  thinking: [[161, 162, 171], [90, 92, 104]],
};

export const SCRIPT: { speaker: Speaker; text: string }[] = [
  { speaker: "interviewer", text: "How would you find the pair without checking every combination?" },
  { speaker: "you", text: "I'd keep a hash map of what I've seen and look up the complement as I go." },
  { speaker: "interviewer", text: "Good. What happens if the same number appears twice?" },
  { speaker: "you", text: "I check before I store, so an element never pairs with itself." },
];

const THINK_MS = 1300;
const HOLD_MS = 1100;
const SIZE = 280;
const POINTS = 120;
const LAYERS = 3;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, alpha: number): string {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha})`;
}

/** Roughly how long a word takes to say, with a beat after punctuation. */
function wordMs(word: string) {
  return 120 + word.length * 36 + (/[,.?]$/.test(word) ? 240 : 0);
}

/**
 * Plays the sample conversation word by word, with no audio.
 * `spoken` is how many words of the current line have been said so far.
 */
export function useInterviewScript() {
  const [view, setView] = useState({ index: 0, spoken: 0, phase: "thinking" as Phase });

  useEffect(() => {
    let timer = 0;
    let index = 0;

    const say = (word: number) => {
      const words = SCRIPT[index].text.split(" ");
      if (word === words.length) {
        setView({ index, spoken: word, phase: "listening" });
        timer = window.setTimeout(nextLine, HOLD_MS);
        return;
      }
      setView({ index, spoken: word + 1, phase: "speaking" });
      timer = window.setTimeout(() => say(word + 1), wordMs(words[word]));
    };

    const nextLine = () => {
      index = (index + 1) % SCRIPT.length;
      if (SCRIPT[index].speaker === "you") {
        say(0);
        return;
      }
      setView({ index, spoken: 0, phase: "thinking" });
      timer = window.setTimeout(() => say(0), THINK_MS);
    };

    timer = window.setTimeout(() => say(0), THINK_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return { line: SCRIPT[view.index], spoken: view.spoken, phase: view.phase };
}

interface InterviewOrbProps {
  speaker: Speaker;
  phase: Phase;
  spoken: number;
}

/** The extension's voice orb at hero size, pulsing on each scripted word instead of the microphone. */
export function InterviewOrb({ speaker, phase, spoken }: InterviewOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The draw loop runs once per mount and reads the latest props from here.
  const voiceRef = useRef({ speaker, phase, pulse: 0 });
  voiceRef.current.speaker = speaker;
  voiceRef.current.phase = phase;

  useEffect(() => {
    if (spoken > 0) voiceRef.current.pulse = 1;
  }, [spoken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const reduceMotion = prefersReducedMotion();
    const voice = voiceRef.current;
    const start = performance.now();
    let inner: Rgb = [...PALETTE.thinking[0]];
    let outer: Rgb = [...PALETTE.thinking[1]];
    let shownLevel = 0;
    let onScreen = true;
    let frame = 0;

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    observer.observe(canvas);

    const render = (t: number, level: number) => {
      // Ease colour and level so speaker changes blend instead of snapping.
      const [targetInner, targetOuter] = PALETTE[voice.phase === "thinking" ? "thinking" : voice.speaker];
      inner = mix(inner, targetInner, 0.06);
      outer = mix(outer, targetOuter, 0.06);
      shownLevel += (level - shownLevel) * 0.2;

      const c = SIZE / 2;
      const base = SIZE * 0.27 * (1 + Math.sin(t * 1.2) * 0.015 + shownLevel * 0.14);
      const ripple = 0.022 + shownLevel * 0.045;

      ctx.clearRect(0, 0, SIZE, SIZE);

      const halo = ctx.createRadialGradient(c, c, base * 0.6, c, c, SIZE / 2);
      halo.addColorStop(0, rgba(outer, 0.24 + shownLevel * 0.2));
      halo.addColorStop(1, rgba(outer, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < LAYERS; k++) {
        const phase = k * 2.1;
        const speed = 1 + k * 0.35;
        ctx.beginPath();
        for (let i = 0; i <= POINTS; i++) {
          const a = (i / POINTS) * Math.PI * 2;
          const wave =
            Math.sin(a * 3 + t * 1.3 * speed + phase) * 0.5 +
            Math.sin(a * 5 - t * 1.7 * speed + phase * 1.6) * 0.3 +
            Math.sin(a * 2 + t * 0.8 * speed - phase) * 0.2;
          const r = base * (1 - k * 0.07) * (1 + ripple * wave);
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const fill = ctx.createRadialGradient(c - base * 0.3, c - base * 0.35, base * 0.1, c, c, base * 1.1);
        fill.addColorStop(0, rgba(inner, 0.42));
        fill.addColorStop(0.65, rgba(outer, 0.32));
        fill.addColorStop(1, rgba(outer, 0.08));
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const draw = (now: number) => {
      if (onScreen) {
        const t = (now - start) / 1000;
        voice.pulse *= 0.9;
        const syllables = Math.abs(Math.sin(t * 9));
        const level = voice.phase === "speaking" ? 0.22 + voice.pulse * 0.6 + syllables * 0.16 : 0.04;
        // With reduced motion the orb swells with the words but its outline holds still.
        render(reduceMotion ? 0 : t, level);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]" aria-hidden="true" />;
}

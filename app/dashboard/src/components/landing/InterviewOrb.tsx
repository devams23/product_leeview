import { useEffect, useRef, useState } from "react";

export type Speaker = "interviewer" | "you";

type Rgb = [number, number, number];

// Same colours as the extension's orb: lime is the candidate, violet the interviewer.
const PALETTE: Record<Speaker, [Rgb, Rgb]> = {
  you: [[212, 255, 63], [74, 222, 128]],
  interviewer: [[185, 166, 255], [110, 132, 255]],
};

export const SCRIPT: { speaker: Speaker; text: string }[] = [
  { speaker: "interviewer", text: "How would you find the pair without checking every combination?" },
  { speaker: "you", text: "I'd keep a hash map of what I've seen and look up the complement as I go." },
  { speaker: "interviewer", text: "Good. What happens if the same number appears twice?" },
  { speaker: "you", text: "I check before I store, so an element never pairs with itself." },
];

const LINE_MS = 4800;
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

/** Steps through the sample conversation. Stays on the first line when motion is reduced. */
export function useInterviewScript() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SCRIPT.length), LINE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return SCRIPT[index];
}

/** The extension's voice orb at hero size, driven by a simulated voice instead of the microphone. */
export function InterviewOrb({ speaker }: { speaker: Speaker }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The draw loop runs once per mount and reads the latest speaker from here.
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const reduceMotion = prefersReducedMotion();
    const start = performance.now();
    let inner: Rgb = [...PALETTE[speakerRef.current][0]];
    let outer: Rgb = [...PALETTE[speakerRef.current][1]];
    let shownLevel = 0;
    let onScreen = true;
    let frame = 0;

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    observer.observe(canvas);

    const render = (t: number, level: number) => {
      // Ease colour and level so speaker changes blend instead of snapping.
      const [targetInner, targetOuter] = PALETTE[speakerRef.current];
      inner = mix(inner, targetInner, 0.05);
      outer = mix(outer, targetOuter, 0.05);
      shownLevel += (level - shownLevel) * 0.14;

      const c = SIZE / 2;
      const base = SIZE * 0.27 * (1 + Math.sin(t * 1.2) * 0.015 + shownLevel * 0.14);
      const ripple = 0.028 + shownLevel * 0.11;

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

    if (reduceMotion) {
      render(0, 0.25);
      return () => observer.disconnect();
    }

    const draw = (now: number) => {
      if (onScreen) {
        const t = (now - start) / 1000;
        // Syllable-like pulses inside slower phrases; a pause falls where the two envelopes dip.
        const voice = Math.abs(Math.sin(t * 6.3) * Math.sin(t * 2.1));
        render(t, 0.2 + voice * 0.65);
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

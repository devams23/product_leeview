import { useEffect, useRef } from "react";

export type OrbMode = "listening" | "muted" | "ai" | "thinking";

type Rgb = [number, number, number];

// Inner and outer colour per mode: lime is the candidate, violet the interviewer.
const PALETTE: Record<OrbMode, [Rgb, Rgb]> = {
  listening: [[212, 255, 63], [74, 222, 128]],
  ai: [[185, 166, 255], [110, 132, 255]],
  thinking: [[161, 162, 171], [90, 92, 104]],
  muted: [[107, 108, 118], [52, 53, 61]],
};

const SIZE = 132;
const POINTS = 90;
const LAYERS = 3;

interface VoiceOrbProps {
  mode: OrbMode;
  /** Voice level 0..1 of whoever is speaking. */
  level: number;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, alpha: number): string {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha})`;
}

/** A soft, breathing orb whose edge ripples with the voice and whose colour follows the speaker. */
export function VoiceOrb({ mode, level }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The draw loop runs once per mount and reads the latest props from here.
  const targetRef = useRef({ mode, level });
  targetRef.current = { mode, level };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const start = performance.now();
    let inner: Rgb = [...PALETTE[targetRef.current.mode][0]];
    let outer: Rgb = [...PALETTE[targetRef.current.mode][1]];
    let shownLevel = 0;
    let frame = 0;

    const draw = (now: number) => {
      const { mode: m, level: l } = targetRef.current;
      const t = reduceMotion ? 0 : (now - start) / 1000;

      // Ease colour and level so speaker changes blend instead of snapping.
      inner = mix(inner, PALETTE[m][0], 0.08);
      outer = mix(outer, PALETTE[m][1], 0.08);
      const live = m === "listening" || m === "ai" ? Math.min(1, Math.max(0, l)) : 0;
      shownLevel += (live - shownLevel) * 0.18;

      const c = SIZE / 2;
      const breathe = m === "thinking" ? Math.sin(t * 2.4) * 0.035 : Math.sin(t * 1.2) * 0.015;
      const base = SIZE * 0.27 * (1 + breathe + shownLevel * 0.16);
      const ripple = m === "muted" ? 0.008 : 0.028 + shownLevel * 0.13;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Halo
      const halo = ctx.createRadialGradient(c, c, base * 0.6, c, c, SIZE / 2);
      halo.addColorStop(0, rgba(outer, 0.22 + shownLevel * 0.2));
      halo.addColorStop(1, rgba(outer, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < LAYERS; k++) {
        const phase = k * 2.1;
        const speed = m === "thinking" ? 0.6 : 1 + k * 0.35;
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

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Decorative: the status line carries the meaning.
  return <canvas ref={canvasRef} className="lv-orb" style={{ width: SIZE, height: SIZE }} aria-hidden="true" />;
}

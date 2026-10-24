import { useEffect, useState } from "react";
import { scrapeProblemHeader } from "../utils/domScraper";

export interface ProblemHeader {
  slug: string | null;
  title: string;
  difficulty: string;
}

const POLL_MS = 1000;

function same(a: ProblemHeader, b: ProblemHeader): boolean {
  return a.slug === b.slug && a.title === b.title && a.difficulty === b.difficulty;
}

/**
 * Tracks the current LeetCode problem. LeetCode is an SPA, so the URL and DOM are
 * re-read every second and state only updates when a value actually changes.
 */
export function useProblem(): ProblemHeader {
  const [problem, setProblem] = useState<ProblemHeader>(() => scrapeProblemHeader());

  useEffect(() => {
    const tick = () => {
      const next = scrapeProblemHeader();
      setProblem((prev) => (same(prev, next) ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  return problem;
}

import { Card } from "../ui/Card";
import { SkillBar } from "../SkillBar";
import { EmptyState } from "../ui/EmptyState";
import { formatScore, scoreTone, SKILLS, suggestedProblem, toneText } from "../../lib/format";
import type { Debrief } from "../../types";

export function DebriefView({ debrief }: { debrief: Debrief }) {
  const overall = debrief.overall_score;
  const tone = scoreTone(overall);

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid rounded-shell lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <p className="flex items-baseline gap-2">
            <span className={`font-display text-[88px] leading-[0.9] tabular-nums sm:text-[104px] ${toneText[tone]}`}>
              {overall ?? "—"}
            </span>
            <span className="text-[15px] text-text-3">out of 10</span>
          </p>
          {debrief.summary ? (
            <p className="max-w-[62ch] text-[16px] leading-relaxed text-text-1">{debrief.summary}</p>
          ) : (
            <p className="text-[15px] text-text-2">No summary was written for this interview.</p>
          )}
        </div>
        <ul className="flex flex-col justify-center gap-5 border-t border-line p-6 sm:p-8 lg:border-l lg:border-t-0">
          {SKILLS.map((skill) => (
            <SkillBar key={skill.key} label={skill.label} value={debrief[skill.key]} />
          ))}
        </ul>
      </Card>

      <section aria-labelledby="work-on" className="flex flex-col gap-4">
        <h2 id="work-on" className="text-[15px] font-medium text-text-1">
          What to work on
        </h2>
        {debrief.actionable_feedback.length === 0 ? (
          <p className="text-[14px] text-text-2">No specific feedback was generated for this interview.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {debrief.actionable_feedback.map((item, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-card border border-line bg-ink-1 p-5 transition-colors duration-150 hover:border-line-2"
              >
                <span className="font-mono text-[13px] text-signal">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-[14.5px] leading-relaxed text-text-1">{item}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {debrief.similar_problems.length > 0 && (
        <section aria-labelledby="similar" className="flex flex-col gap-3">
          <h2 id="similar" className="text-[15px] font-medium text-text-1">
            Practice next
          </h2>
          <ul className="flex flex-wrap gap-2">
            {debrief.similar_problems.map(suggestedProblem).map((problem) => (
              <li key={problem.url}>
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-chip border border-line-2 bg-ink-2 px-3 text-[13px] text-text-1 transition-colors duration-150 hover:border-signal/50 hover:bg-ink-3"
                >
                  {problem.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overall == null && !debrief.summary && (
        <EmptyState title="Scores not available" className="py-6">
          This debrief was saved without scores. The transcript and code below are still available.
        </EmptyState>
      )}
      {/* Keeps the number formatter used in the bars in one place for screen readers. */}
      <span className="sr-only">Overall score {overall == null ? "not available" : formatScore(overall)}</span>
    </div>
  );
}

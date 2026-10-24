import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import type { Debrief } from "../../types";

export function RealWorldView({ debrief }: { debrief: Debrief | null }) {
  const blocks = [
    { title: "Scenario", body: debrief?.real_world_scenario },
    { title: "The naive approach", body: debrief?.real_world_naive_approach },
    { title: "Why the better approach wins", body: debrief?.real_world_why_wins },
  ].filter((b): b is { title: string; body: string } => Boolean(b.body));
  const followUp = debrief?.senior_follow_up;

  if (blocks.length === 0 && !followUp) {
    return (
      <EmptyState title="No real-world context">
        This debrief does not include a real-world scenario.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {blocks.map((block) => (
        <Card key={block.title} className="p-5 transition-colors duration-150 hover:border-line-2">
          <h3 className="text-[13px] font-medium text-text-2">{block.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-text-1">{block.body}</p>
        </Card>
      ))}
      {followUp && (
        <div className="rounded-card border border-ai/25 bg-ai-soft p-5 md:col-span-2">
          <h3 className="text-[13px] font-medium text-ai">Senior follow-up</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-text-1">{followUp}</p>
        </div>
      )}
    </div>
  );
}

export function DebriefCard({ debrief }: { debrief: any }) {
  return (
    <div className="glass-panel w-full h-full p-6 text-textPrimary flex flex-col gap-6">
      <h2 className="font-sans text-xl font-medium m-0">Debrief</h2>
      
      <div>
        <h3 className="text-[11px] font-medium text-textSecondary uppercase tracking-[0.1em] mb-2">Real-World Scenario</h3>
        <p className="text-sm text-textSecondary font-mono leading-relaxed m-0 p-4 glass-inner">
          {debrief.real_world_scenario || "No scenario available."}
        </p>
      </div>

      <div>
        <h3 className="text-[11px] font-medium text-textSecondary uppercase tracking-[0.1em] mb-2">Actionable Feedback</h3>
        <ul className="text-sm text-textSecondary font-mono leading-relaxed p-4 glass-inner m-0 list-disc list-inside flex flex-col gap-2">
          {debrief.actionable_feedback?.map((item: string, idx: number) => (
            <li key={idx} className="pl-1 marker:text-textMuted">{item}</li>
          )) || <li>No feedback available.</li>}
        </ul>
      </div>
    </div>
  );
}

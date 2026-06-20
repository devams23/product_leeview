import { useInterviews } from "../hooks/useInterviews";

export function InterviewList() {
  const { interviews, loading } = useInterviews();

  if (loading) return <div className="text-textSecondary font-mono text-xs">Loading...</div>;

  return (
    <div className="glass-panel w-full">
      <div className="px-5 py-4 border-b border-borderGlassInner bg-bgPanelInner rounded-t-inner">
        <h2 className="text-[11px] font-medium text-textSecondary uppercase tracking-[0.1em] m-0">Past Interviews</h2>
      </div>
      <div className="flex flex-col">
        {interviews.length === 0 ? (
          <div className="p-8 text-center text-textMuted font-mono text-sm">
            No interviews found. Try starting one from the Chrome Extension.
          </div>
        ) : (
          interviews.map((i) => (
            <a
              key={i.id}
              href={`/session/${i.id}`}
              className="group flex items-center justify-between px-5 py-3 border-b border-borderGlassInner h-[50px] decoration-none hover:bg-bgPanelInner border-l-2 border-l-transparent hover:border-l-borderGlassStrong transition-colors last:border-b-0"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-textPrimary font-sans">{i.leetcode_title || "Untitled Problem"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-textMuted font-mono bg-bgInput px-2 py-1 rounded-pill uppercase">
                  {i.status}
                </span>
                <span className="text-[11px] text-textSecondary font-mono min-w-[120px] text-right">
                  {i.problem_language} "dssdadssd"
                </span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

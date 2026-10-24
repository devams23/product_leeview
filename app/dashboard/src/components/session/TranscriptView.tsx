import { EmptyState } from "../ui/EmptyState";
import { formatTime, stageLabel } from "../../lib/format";
import type { TranscriptLog } from "../../types";

export function TranscriptView({ logs }: { logs: TranscriptLog[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState title="No transcript saved">
        This interview did not record any turns, so there is nothing to replay.
      </EmptyState>
    );
  }

  const items = logs.map((log, i) => ({
    log,
    newStage: i === 0 || logs[i - 1].state_at_time !== log.state_at_time,
  }));

  return (
    <ol className="mx-auto flex max-w-3xl flex-col gap-4" aria-label="Transcript">
      {items.map(({ log, newStage }) => {
        const isUser = log.speaker === "USER";
        return (
          <li key={log.id} className="flex flex-col gap-4">
            {newStage && (
              <div className="flex items-center gap-3 pt-4" role="separator">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] text-text-2">{stageLabel(log.state_at_time)}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-card border px-4 py-3 sm:max-w-[75%] ${
                  isUser ? "border-signal/20 bg-signal-soft" : "border-ai/20 bg-ai-soft"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 font-mono text-[11px]">
                  <span className={isUser ? "text-signal" : "text-ai"}>{isUser ? "You" : "Interviewer"}</span>
                  <span className="text-text-3">{formatTime(log.timestamp)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-text-1">{log.text}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

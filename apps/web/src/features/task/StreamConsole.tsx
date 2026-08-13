import type { Task } from "@agent-console/contracts";
import { Loader2, Terminal } from "lucide-react";

interface StreamConsoleProps {
  text: string;
  status: Task["status"];
}

export function StreamConsole({ text, status }: StreamConsoleProps) {
  const streaming = status === "planning" || status === "running";

  return (
    <section className="reveal terminal-bg terminal-shadow overflow-hidden rounded-md border border-ink-700/30">
      <div className="flex items-center gap-3 border-b border-ink-700/25 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint-500/80" />
        </div>
        <div className="ml-2 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[var(--terminal-accent)]" />
          <span className="display-label text-sm text-[var(--terminal-text)]">运行输出</span>
        </div>
        {streaming ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-signal-500/25 bg-signal-500/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--terminal-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse-dot" />
            流式输出中
          </span>
        ) : null}
      </div>
      <pre
        className={`max-h-[520px] min-h-[220px] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-sm leading-6 text-[var(--terminal-text)] ${
          streaming ? "cursor-blink" : ""
        }`}
      >
        {text || "等待 Agent 输出..."}
      </pre>
      {streaming ? (
        <div className="flex items-center gap-2 border-t border-ink-700/25 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.08em] text-[var(--terminal-muted)]">
          <Loader2 className="h-3 w-3 animate-spin text-[var(--terminal-accent)]" />
          正在接收事件
        </div>
      ) : null}
    </section>
  );
}

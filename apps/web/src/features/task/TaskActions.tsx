import type { Task, TaskAction } from "@agent-console/contracts";
import { Loader2, Pause, Play, RotateCcw, XCircle } from "lucide-react";

interface TaskActionsProps {
  task: Task;
  onAction: (action: TaskAction) => void;
  isPending: boolean;
}

export function TaskActions({ task, onAction, isPending }: TaskActionsProps) {
  const canPause = task.status === "running" || task.status === "planning";
  const canResume = task.status === "paused";
  const canCancel = ["queued", "planning", "running", "paused"].includes(task.status);
  const canRerun = ["completed", "failed", "cancelled"].includes(task.status);

  const baseClass =
    "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className="reveal reveal-delay-1 flex flex-wrap items-center gap-2 rounded-md border border-ink-700/25 bg-ink-900/60 p-2">
      <span className="px-2 font-mono text-xs uppercase tracking-[0.08em] text-ink-400">
        任务控制
      </span>
      <button
        type="button"
        className={`${baseClass} border-ink-700/30 bg-ink-700/5 text-ink-300 hover:border-signal-500/25 hover:text-signal-300`}
        disabled={!canPause || isPending}
        onClick={() => onAction("pause")}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
        暂停
      </button>
      <button
        type="button"
        className={`${baseClass} border-ink-700/30 bg-ink-700/5 text-ink-300 hover:border-signal-500/25 hover:text-signal-300`}
        disabled={!canResume || isPending}
        onClick={() => onAction("resume")}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        继续
      </button>
      <button
        type="button"
        className={`${baseClass} border-rose-500/20 bg-rose-500/[0.06] text-rose-300 hover:border-rose-500/35 hover:bg-rose-500/10`}
        disabled={!canCancel || isPending}
        onClick={() => onAction("cancel")}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
        取消
      </button>
      <button
        type="button"
        className={`${baseClass} ml-auto border-signal-500/30 bg-signal-500/10 text-signal-300 hover:bg-signal-500/20`}
        disabled={!canRerun || isPending}
        onClick={() => onAction("rerun")}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        重跑
      </button>
    </div>
  );
}

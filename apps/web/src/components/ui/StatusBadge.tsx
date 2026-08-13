/**
 * 任务状态徽标：根据状态展示中文标签、颜色与呼吸圆点。
 */
import type { Task } from "@agent-console/contracts";

const LABELS: Record<Task["status"], string> = {
  queued: "排队中",
  planning: "规划中",
  running: "执行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STYLES: Record<Task["status"], string> = {
  queued: "border-ink-700/30 text-ink-300",
  planning: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  running: "border-signal-500/30 bg-signal-500/10 text-signal-300",
  paused: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  completed: "border-mint-500/25 bg-mint-500/10 text-mint-300",
  failed: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  cancelled: "border-ink-700/30 text-ink-400",
};

const DOTS: Record<Task["status"], string> = {
  queued: "bg-ink-400",
  planning: "bg-cyan-400",
  running: "bg-signal-400 animate-pulse-dot",
  paused: "bg-amber-400",
  completed: "bg-mint-400",
  failed: "bg-rose-400",
  cancelled: "bg-ink-500",
};

export function StatusBadge({ status }: { status: Task["status"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[status]}`} />
      {LABELS[status]}
    </span>
  );
}

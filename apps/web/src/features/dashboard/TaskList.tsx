import type { Task, Workspace } from "@agent-console/contracts";
import { ListTodo, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { DeleteTaskButton } from "../../components/domain/DeleteTaskButton";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tooltip } from "../../components/ui/Tooltip";

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  workspaces: Workspace[];
  rerunning: boolean;
  deleting: boolean;
  onRerun: (task: Task) => void;
  onDelete: (taskId: string, goal: string) => void;
}

export function TaskList({
  tasks,
  isLoading,
  workspaces,
  rerunning,
  deleting,
  onRerun,
  onDelete,
}: TaskListProps) {
  if (isLoading) {
    return (
      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <ListTodo className="h-4 w-4 text-signal-400" />
            <h2 className="text-sm font-semibold text-ink-100">任务台账</h2>
          </div>
          <span className="font-mono text-xs text-ink-400">加载中</span>
        </div>
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="skeleton h-14 rounded-md" />
          ))}
        </div>
      </section>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="还没有任务"
        description="输入一个目标，创建你的第一个 Agent 任务"
      />
    );
  }

  return (
    <section className="panel reveal reveal-delay-3 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <ListTodo className="h-4 w-4 text-signal-400" />
          <h2 className="text-sm font-semibold text-ink-100">任务台账</h2>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {tasks.length} 个任务
        </span>
      </div>

      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] items-center gap-4 border-b border-ink-700/25 bg-ink-700/5 px-5 py-2.5 sm:grid">
        <span className="eyebrow">目标</span>
        <span className="eyebrow">状态 / 进度</span>
        <span className="eyebrow">时间 / 耗时</span>
        <span className="w-[76px] text-right">操作</span>
      </div>

      <ul className="divide-y divide-ink-700/25">
        {tasks.map((task) => (
          <li key={task.id}>
            <div className="flex items-stretch">
              <Link
                to={`/tasks/${task.id}`}
                className="ledger-row group grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-6 text-ink-100">
                    {task.goal}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-xs text-ink-400">
                    <span className="rounded border border-ink-700/30 bg-ink-700/10 px-1.5 py-0.5">
                      {workspaces.find((item) => item.id === task.workspaceId)?.name ??
                        task.workspaceId}
                    </span>
                    <span className="rounded border border-ink-700/30 bg-ink-700/10 px-1.5 py-0.5 uppercase">
                      {task.model}
                    </span>
                    <span>{task.id.slice(0, 8)}</span>
                    {task.error ? (
                      <span className="break-words text-rose-400">{task.error}</span>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 sm:items-start">
                  <StatusBadge status={task.status} />
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[13px] text-ink-300">
                      {task.currentStep}/{task.totalSteps}
                    </span>
                    <div className="h-1 w-full min-w-[44px] max-w-[84px] overflow-hidden rounded-full bg-ink-700/20">
                      <div
                        className="h-full rounded-full bg-signal-500"
                        style={{
                          width: `${task.totalSteps > 0 ? (task.currentStep / task.totalSteps) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="hidden flex-col gap-1.5 font-mono text-[13px] leading-5 text-ink-400 sm:flex">
                  <span className="break-words">
                    {new Date(task.createdAt).toLocaleString("zh-CN")}
                  </span>
                  <span>耗时 {formatDuration(task.startedAt, task.finishedAt)}</span>
                </div>
              </Link>

              <div className="flex w-[76px] shrink-0 items-center justify-end gap-1.5 border-l border-ink-700/20 px-2.5">
                {["completed", "failed", "cancelled"].includes(task.status) ? (
                  <Tooltip content="重跑该任务">
                    <button
                      type="button"
                      aria-label={`重跑任务 ${task.goal}`}
                      disabled={rerunning}
                      onClick={() => onRerun(task)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400 transition hover:border-signal-500/45 hover:bg-signal-500/20 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {rerunning ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-signal-500/30 border-t-signal-400" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </button>
                  </Tooltip>
                ) : null}

                <DeleteTaskButton
                  taskId={task.id}
                  goal={task.goal}
                  disabled={deleting}
                  onDelete={onDelete}
                  className="h-8 w-8"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) {
    return "--";
  }
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (durationMs < 0) {
    return "--";
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

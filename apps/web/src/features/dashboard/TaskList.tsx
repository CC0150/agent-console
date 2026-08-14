import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BatchTaskAction,
  Task,
  TaskSortField,
  Workspace,
} from "@agent-console/contracts";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DeleteTaskButton } from "../../components/domain/DeleteTaskButton";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorBanner, toErrorMessage } from "../../components/ui/ErrorBanner";
import { SelectField } from "../../components/ui/SelectField";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDebouncedInput } from "../../hooks/useDebounce";
import { api } from "../../lib/api";
import { useTaskListQuery, type TaskStatusFilter } from "./taskListQuery";

interface TaskListProps {
  tasks: Task[];
  total: number;
  isLoading: boolean;
  workspaces: Workspace[];
}

const STATUS_OPTIONS: Array<{ value: Task["status"]; label: string }> = [
  { value: "queued", label: "排队中" },
  { value: "planning", label: "规划中" },
  { value: "running", label: "执行中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
];

const SORT_OPTIONS: Array<{ value: TaskSortField; label: string }> = [
  { value: "createdAt", label: "创建时间" },
  { value: "updatedAt", label: "更新时间" },
  { value: "status", label: "状态" },
  { value: "currentStep", label: "进度" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const ACTIVE_STATUSES: Task["status"][] = ["queued", "planning", "running", "paused"];
const TERMINAL_STATUSES: Task["status"][] = ["completed", "failed", "cancelled"];

export function TaskList({ tasks, total, isLoading, workspaces }: TaskListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state: query, update } = useTaskListQuery();
  const [searchInput, setSearchInput] = useDebouncedInput(
    query.q,
    (value) => update({ q: value }),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{
    taskIds: string[];
    label: string;
  } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const hasFilters = query.q.trim().length > 0 || query.status !== "all";

  useEffect(() => {
    const visible = new Set(tasks.map((task) => task.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < tasks.length;
    }
  }, [selectedIds, tasks.length]);

  useEffect(() => {
    if (query.page > totalPages) {
      update({ page: totalPages });
    }
  }, [query.page, totalPages, update]);

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedIds.has(task.id)),
    [tasks, selectedIds],
  );
  const canPause = selectedTasks.some(
    (task) => task.status === "running" || task.status === "planning",
  );
  const canResume = selectedTasks.some((task) => task.status === "paused");
  const canCancel = selectedTasks.some((task) => ACTIVE_STATUSES.includes(task.status));
  const canRerun = selectedTasks.some((task) => TERMINAL_STATUSES.includes(task.status));

  const batchMutation = useMutation({
    mutationFn: ({ action, taskIds }: { action: BatchTaskAction; taskIds: string[] }) =>
      api.batchAction(action, taskIds),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
  const rerunMutation = useMutation({
    mutationFn: (task: Task) => api.action(task.id, "rerun"),
    onSuccess: ({ task }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      navigate(`/tasks/${task.id}`);
    },
  });
  const retryMutation = useMutation({
    mutationFn: (task: Task) => api.action(task.id, "retry"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (taskIds: string[]) => api.batchAction("delete", taskIds),
    onSuccess: () => {
      setPendingDelete(null);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

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

  const mutationError =
    batchMutation.error ?? retryMutation.error ?? rerunMutation.error ?? deleteMutation.error;
  const isBatchPending = batchMutation.isPending || deleteMutation.isPending;
  const batchButtonClass =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <section className="panel reveal reveal-delay-3 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <ListTodo className="h-4 w-4 text-signal-400" />
          <h2 className="text-sm font-semibold text-ink-100">任务台账</h2>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {total} 个任务
        </span>
      </div>

      <div className="flex flex-col gap-2.5 border-b border-ink-700/25 bg-ink-950/30 p-3.5 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索目标或任务 ID"
            aria-label="搜索任务"
            className="h-9 w-full rounded-md border border-ink-700/30 bg-ink-950/70 pl-9 pr-3 text-sm text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-signal-500/60 focus:ring-2 focus:ring-signal-500/15"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            value={query.status}
            onValueChange={(value) => update({ status: value as TaskStatusFilter })}
            options={[{ value: "all", label: "全部状态" }, ...STATUS_OPTIONS]}
            label="状态筛选"
          />
          <SelectField
            value={query.sort}
            onValueChange={(value) => update({ sort: value as TaskSortField })}
            options={SORT_OPTIONS}
            label="排序字段"
          />
          <Tooltip content={query.order === "desc" ? "切换为升序" : "切换为降序"}>
            <button
              type="button"
              aria-label={query.order === "desc" ? "切换为升序" : "切换为降序"}
              onClick={() => update({ order: query.order === "desc" ? "asc" : "desc" })}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink-700/30 bg-ink-950/70 text-ink-300 transition hover:border-signal-500/40 hover:text-signal-300"
            >
              {query.order === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
          <SelectField
            value={String(query.pageSize)}
            onValueChange={(value) => update({ pageSize: Number(value) })}
            options={PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: `${size} 条/页`,
            }))}
            label="每页条数"
          />
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/25 bg-signal-500/[0.06] px-4 py-2.5">
          <span className="font-mono text-xs text-ink-300">
            已选当前页 {selectedIds.size} 个任务
          </span>
          {isBatchPending ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-signal-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 处理中…
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!canPause || isBatchPending}
              onClick={() =>
                batchMutation.mutate({ action: "pause", taskIds: [...selectedIds] })
              }
              className={`${batchButtonClass} border-ink-700/30 bg-ink-700/5 text-ink-200 hover:border-signal-500/30 hover:text-signal-300`}
            >
              <Pause className="h-3.5 w-3.5" /> 暂停
            </button>
            <button
              type="button"
              disabled={!canResume || isBatchPending}
              onClick={() =>
                batchMutation.mutate({ action: "resume", taskIds: [...selectedIds] })
              }
              className={`${batchButtonClass} border-ink-700/30 bg-ink-700/5 text-ink-200 hover:border-signal-500/30 hover:text-signal-300`}
            >
              <Play className="h-3.5 w-3.5" /> 继续
            </button>
            <button
              type="button"
              disabled={!canCancel || isBatchPending}
              onClick={() =>
                batchMutation.mutate({ action: "cancel", taskIds: [...selectedIds] })
              }
              className={`${batchButtonClass} border-rose-500/25 bg-rose-500/[0.06] text-rose-300 hover:border-rose-500/45 hover:bg-rose-500/10`}
            >
              <XCircle className="h-3.5 w-3.5" /> 取消
            </button>
            <button
              type="button"
              disabled={!canRerun || isBatchPending}
              onClick={() =>
                batchMutation.mutate({ action: "rerun", taskIds: [...selectedIds] })
              }
              className={`${batchButtonClass} border-signal-500/30 bg-signal-500/10 text-signal-300 hover:bg-signal-500/20`}
            >
              <RotateCcw className="h-3.5 w-3.5" /> 重跑
            </button>
            <button
              type="button"
              disabled={isBatchPending}
              onClick={() =>
                setPendingDelete({
                  taskIds: [...selectedIds],
                  label: `${selectedIds.size} 个任务`,
                })
              }
              className={`${batchButtonClass} border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`}
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </button>
          </div>
        </div>
      ) : null}

      {mutationError ? (
        <ErrorBanner
          message={`操作失败：${toErrorMessage(mutationError)}`}
          className="mx-4 mt-4"
        />
      ) : null}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-t border-dashed border-ink-700/25 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400">
            <ListTodo className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink-100">
            {hasFilters ? "没有匹配的任务" : "还没有任务"}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {hasFilters
              ? "调整搜索或筛选条件后重试"
              : "输入一个目标，创建你的第一个 Agent 任务"}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[44px_minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] items-center gap-4 border-b border-ink-700/25 bg-ink-700/5 px-5 py-2.5 sm:grid">
            <span className="flex items-center">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={tasks.length > 0 && selectedIds.size === tasks.length}
                onChange={(event) => {
                  setSelectedIds(
                    event.target.checked ? new Set(tasks.map((task) => task.id)) : new Set(),
                  );
                }}
                aria-label="选择当前页全部任务"
                className="h-4 w-4 accent-signal-500"
              />
            </span>
            <span className="eyebrow">目标</span>
            <span className="eyebrow">状态 / 进度</span>
            <span className="eyebrow">时间 / 耗时</span>
            <span className="w-[108px] text-right">操作</span>
          </div>

          <ul className="divide-y divide-ink-700/25">
            {tasks.map((task) => (
              <li key={task.id}>
                <div className="flex items-stretch">
                  <div className="flex w-[44px] shrink-0 items-center justify-center border-r border-ink-700/20 px-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={(event) => {
                        const next = new Set(selectedIds);
                        if (event.target.checked) {
                          next.add(task.id);
                        } else {
                          next.delete(task.id);
                        }
                        setSelectedIds(next);
                      }}
                      aria-label={`选择任务 ${task.goal}`}
                      className="h-4 w-4 accent-signal-500"
                    />
                  </div>
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

                  <div className="flex w-[108px] shrink-0 items-center justify-end gap-1.5 border-l border-ink-700/20 px-2.5">
                    {task.status === "failed" ? (
                      <Tooltip content="从失败处续跑">
                        <button
                          type="button"
                          aria-label={`续跑任务 ${task.goal}`}
                          disabled={retryMutation.isPending}
                          onClick={() => retryMutation.mutate(task)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400 transition hover:border-signal-500/45 hover:bg-signal-500/20 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {retryMutation.isPending ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-signal-500/30 border-t-signal-400" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                      </Tooltip>
                    ) : null}
                    {TERMINAL_STATUSES.includes(task.status) ? (
                      <Tooltip content="重跑该任务">
                        <button
                          type="button"
                          aria-label={`重跑任务 ${task.goal}`}
                          disabled={rerunMutation.isPending}
                          onClick={() => rerunMutation.mutate(task)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400 transition hover:border-signal-500/45 hover:bg-signal-500/20 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {rerunMutation.isPending ? (
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
                      disabled={deleteMutation.isPending}
                      onDelete={(taskId, goal) =>
                        setPendingDelete({ taskIds: [taskId], label: goal })
                      }
                      className="h-8 w-8"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/25 px-4 py-3">
        <span className="font-mono text-xs text-ink-400">共 {total} 条记录</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={query.page <= 1}
            onClick={() => update({ page: query.page - 1 })}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-700/30 bg-ink-700/5 px-2.5 text-xs font-medium text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> 上一页
          </button>
          <span className="font-mono text-xs text-ink-300">
            第 {query.page} / {totalPages} 页
          </span>
          <button
            type="button"
            disabled={query.page >= totalPages}
            onClick={() => update({ page: query.page + 1 })}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-700/30 bg-ink-700/5 px-2.5 text-xs font-medium text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-35"
          >
            下一页 <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="删除任务"
        description={
          pendingDelete
            ? pendingDelete.taskIds.length > 1
              ? `确定删除选中的 ${pendingDelete.taskIds.length} 个任务吗？删除后不可恢复。`
              : `确定删除任务“${pendingDelete.label}”吗？删除后不可恢复。`
            : ""
        }
        confirmLabel="删除"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.taskIds);
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
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

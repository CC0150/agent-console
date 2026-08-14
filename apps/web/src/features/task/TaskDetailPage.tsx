import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskAction } from "@agent-console/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  Hash,
  History,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorBanner, toErrorMessage } from "../../components/ui/ErrorBanner";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { api } from "../../lib/api";
import {
  extractPlan,
  extractStreamText,
  extractToolCalls,
  mergeEvents,
} from "../../lib/taskEvents";
import { useRunStore } from "../../stores/runStore";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { ConversationView } from "./ConversationView";
import { EventLog } from "./EventLog";
import { PlanTimeline } from "./PlanTimeline";
import { StreamConsole } from "./StreamConsole";
import { TaskActions } from "./TaskActions";
import { ToolCallCard } from "./ToolCallCard";

export function TaskDetailPage() {
  const { taskId = "" } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { events: liveEvents, connect, disconnect } = useRunStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.getTask(taskId),
    enabled: Boolean(taskId),
    refetchInterval: 2_000,
  });
  const historyQuery = useQuery({
    queryKey: ["events", taskId],
    queryFn: () => api.getEvents(taskId),
    enabled: Boolean(taskId),
    refetchInterval: 2_000,
  });
  const artifactsQuery = useQuery({
    queryKey: ["artifacts", taskId],
    queryFn: () => api.listArtifacts(taskId),
    enabled: Boolean(taskId),
    refetchInterval: 2_000,
  });
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.listWorkspaces,
  });

  useEffect(() => {
    if (!taskId) {
      return;
    }
    connect(taskId);
    return () => disconnect();
  }, [taskId, connect, disconnect]);

  const task = taskQuery.data?.task;
  const workspace = workspacesQuery.data?.workspaces.find(
    (item) => item.id === task?.workspaceId,
  );
  const terminal = task != null && ["completed", "failed", "cancelled"].includes(task.status);

  useEffect(() => {
    if (terminal) {
      disconnect();
    }
  }, [terminal, disconnect]);

  const allEvents = useMemo(
    () => mergeEvents(historyQuery.data?.events ?? [], liveEvents),
    [historyQuery.data, liveEvents],
  );
  const plan = useMemo(() => extractPlan(allEvents), [allEvents]);
  const toolCalls = useMemo(() => extractToolCalls(allEvents), [allEvents]);
  const streamText = useMemo(() => extractStreamText(allEvents), [allEvents]);

  const actionMutation = useMutation({
    mutationFn: (action: TaskAction) => api.action(taskId, action),
    onSuccess: ({ task: nextTask }, action) => {
      if (action === "rerun") {
        navigate(`/tasks/${nextTask.id}`);
        return;
      }
      queryClient.setQueryData(["task", taskId], { task: nextTask });
      queryClient.invalidateQueries({ queryKey: ["events", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(taskId),
    onSuccess: () => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      navigate("/");
    },
  });

  if (taskQuery.isLoading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-signal-400" />
      </div>
    );
  }

  if (!task) {
    if (taskQuery.error) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="任务加载失败"
          description={toErrorMessage(taskQuery.error)}
          action={
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["task", taskId] })}
              className="inline-flex h-9 items-center rounded-md border border-signal-500/30 bg-signal-500/10 px-4 text-sm font-medium text-signal-300 transition hover:bg-signal-500/20"
            >
              重新加载
            </button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={ArrowLeft}
        title="任务不存在"
        description="返回任务总览重新选择一个任务"
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="reveal">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-700/30 bg-ink-700/10 px-3 text-sm font-medium text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <button
            type="button"
            title="删除任务"
            aria-label="删除当前任务"
            disabled={deleteMutation.isPending}
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-500/25 bg-rose-500/[0.06] px-3 text-sm font-medium text-rose-300 transition hover:border-rose-500/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            删除
          </button>
          <Link
            to={`/tasks/${task.id}/replay`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/[0.06] px-3 text-sm font-medium text-cyan-300 transition hover:border-cyan-500/45 hover:bg-cyan-500/10"
          >
            <History className="h-4 w-4" />
            事件回放
          </Link>
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1 text-signal-400">任务详情 / {task.id.slice(0, 8)}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold text-ink-100">{task.goal}</h1>
              <StatusBadge status={task.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] text-ink-400">
              <span className="inline-flex items-center rounded border border-ink-700/30 bg-ink-700/10 px-2 py-0.5">
                {workspace?.name ?? task.workspaceId}
              </span>
              <span>
                {new Date(task.createdAt).toLocaleString("zh-CN")} · {task.model}
              </span>
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {task.id}
              </span>
            </div>
          </div>
        </div>
      </header>

      {actionMutation.error || deleteMutation.error ? (
        <ErrorBanner
          message={`操作失败：${toErrorMessage(
            actionMutation.error ?? deleteMutation.error,
          )}`}
        />
      ) : null}

      {task.status === "failed" && task.error ? (
        <ErrorBanner
          message={`任务执行失败：${task.error}`}
          onRetry={() => actionMutation.mutate("retry")}
        />
      ) : null}

      <TaskActions
        task={task}
        isPending={actionMutation.isPending}
        onAction={actionMutation.mutate}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-4">
          <PlanTimeline plan={plan} status={task.status} toolCalls={toolCalls} />
          <section className="panel min-w-0 overflow-hidden">
            <div className="panel-header">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-ink-100">工具调用</h2>
              </div>
              <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-[13px] text-ink-300">
                {toolCalls.length} 次调用
              </span>
            </div>
            {toolCalls.length === 0 ? (
              <div className="border-t border-dashed border-ink-700/30 px-4 py-8 text-center text-sm text-ink-400">
                暂无工具调用
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {toolCalls.map((toolCall) => (
                  <ToolCallCard key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-5 xl:col-span-8">
          <ConversationView
            events={allEvents}
            goal={task.goal}
            createdAt={task.createdAt}
            status={task.status}
          />
          <StreamConsole text={streamText} status={task.status} />
          <ArtifactsPanel
            taskId={task.id}
            artifacts={artifactsQuery.data?.artifacts ?? []}
            isLoading={artifactsQuery.isLoading}
          />
          <EventLog events={allEvents} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title="删除任务"
        description={`确定删除任务“${task.goal}”吗？删除后不可恢复。`}
        confirmLabel="删除"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

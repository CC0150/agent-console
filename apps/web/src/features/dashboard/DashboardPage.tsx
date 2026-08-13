import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Task } from "@agent-console/contracts";
import { api } from "../../lib/api";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorBanner, toErrorMessage } from "../../components/ui/ErrorBanner";
import { WorkspaceSelect } from "../../components/domain/WorkspaceSelect";
import { EnvPanel } from "./EnvPanel";
import { StatsPanel } from "./StatsPanel";
import { TaskList } from "./TaskList";
import { ToolsPanel } from "./ToolsPanel";

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [goal, setGoal] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    taskId: string;
    goal: string;
  } | null>(null);
  const selectedWorkspace = searchParams.get("workspace") ?? "all";

  const tasksQuery = useQuery({
    queryKey: ["tasks", selectedWorkspace],
    queryFn: () =>
      api.listTasks(selectedWorkspace === "all" ? undefined : selectedWorkspace),
    refetchInterval: 3_000,
  });
  const statsQuery = useQuery({
    queryKey: ["stats", selectedWorkspace],
    queryFn: () => api.getStats(selectedWorkspace === "all" ? undefined : selectedWorkspace),
    refetchInterval: 3_000,
  });
  const runtimeQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.listWorkspaces,
  });

  const createMutation = useMutation({
    mutationFn: (value: { goal: string; workspaceId?: string }) =>
      api.createTask(value.goal, value.workspaceId),
    onSuccess: ({ task }) => {
      setGoal("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      navigate(`/tasks/${task.id}`);
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
  const deleteMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: string }) => api.deleteTask(taskId),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const queryError =
    tasksQuery.error ??
    statsQuery.error ??
    workspacesQuery.error ??
    runtimeQuery.error;
  const mutationError = createMutation.error ?? rerunMutation.error ?? deleteMutation.error;

  return (
    <div className="space-y-5">
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5 text-signal-400">任务控制平面 / 工作台</p>
          <h1 className="display-label text-4xl leading-none text-ink-100">
            任务总览
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-400">
          提交目标，编排 Agent 计划、工具调用与流式输出。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-mint-500/20 bg-mint-500/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.08em] text-mint-300">
          <Sparkles className="h-3.5 w-3.5" />
          {runtimeQuery.data?.llm?.provider === "openai"
            ? `${runtimeQuery.data.llm.model} 已就绪`
            : "本地模拟 LLM 就绪"}
        </div>
      </header>

      {queryError ? (
        <ErrorBanner
          message={`服务连接异常：${toErrorMessage(queryError)}`}
          onRetry={() => queryClient.invalidateQueries()}
        />
      ) : null}

      {mutationError ? (
        <ErrorBanner message={`操作失败：${toErrorMessage(mutationError)}`} />
      ) : null}

      <section className="panel reveal reveal-delay-1">
        <div className="panel-header">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink-100">新建 Agent 任务</h2>
              <p className="eyebrow mt-0.5">命令 / 新建任务</p>
            </div>
          </div>
        </div>

        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const value = goal.trim();
            if (value) {
              createMutation.mutate({
                goal: value,
                workspaceId: selectedWorkspace === "all" ? undefined : selectedWorkspace,
              });
            }
          }}
        >
          <label htmlFor="goal-input" className="eyebrow mb-2 block">
            目标描述
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <WorkspaceSelect
              workspaces={workspacesQuery.data?.workspaces ?? []}
              value={selectedWorkspace}
              onValueChange={(next) => {
                if (next === "all") {
                  setSearchParams({});
                } else {
                  setSearchParams({ workspace: next });
                }
              }}
              label="选择工作区"
              size="md"
            />
            <input
              id="goal-input"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="例如：整理杭州前端岗位要求"
              className="h-12 min-w-0 flex-1 rounded-md border border-ink-700/30 bg-ink-950/70 px-4 text-sm text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-signal-500/60 focus:ring-2 focus:ring-signal-500/15"
            />
            <button
              type="submit"
              disabled={!goal.trim() || createMutation.isPending}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-signal-500 px-5 text-sm font-semibold text-[var(--button-ink)] shadow-[0_8px_24px_rgba(240,165,46,0.18)] transition hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              启动任务
            </button>
          </div>
          <p className="mt-2 font-mono text-xs text-ink-500">
            示例：搜索杭州前端岗位要求
          </p>
        </form>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="reveal reveal-delay-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">当前范围</p>
              <p className="mt-0.5 text-sm font-semibold text-ink-200">
                {selectedWorkspace === "all"
                  ? "全部工作区"
                  : (workspacesQuery.data?.workspaces.find(
                      (item) => item.id === selectedWorkspace,
                    )?.name ?? selectedWorkspace)}
              </p>
            </div>
            <WorkspaceSelect
              workspaces={workspacesQuery.data?.workspaces ?? []}
              value={selectedWorkspace}
              onValueChange={(next) => {
                if (next === "all") {
                  setSearchParams({});
                } else {
                  setSearchParams({ workspace: next });
                }
              }}
              label="筛选工作区"
              size="sm"
            />
          </div>
          <StatsPanel stats={statsQuery.data} isLoading={statsQuery.isLoading} />
          <TaskList
            tasks={tasksQuery.data?.tasks ?? []}
            isLoading={tasksQuery.isLoading}
            workspaces={workspacesQuery.data?.workspaces ?? []}
            rerunning={rerunMutation.isPending}
            deleting={deleteMutation.isPending}
            onRerun={rerunMutation.mutate}
            onDelete={(taskId, goal) => setPendingDelete({ taskId, goal })}
          />
        </div>
        <aside className="min-w-0 space-y-5">
          <ToolsPanel />
          <EnvPanel />
        </aside>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="删除任务"
        description={`确定删除任务“${pendingDelete?.goal ?? ""}”吗？删除后不可恢复。`}
        confirmLabel="删除"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate({ taskId: pendingDelete.taskId });
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

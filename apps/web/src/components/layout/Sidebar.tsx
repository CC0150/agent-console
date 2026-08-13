/**
 * 侧边栏布局：导航、工作区管理、最近任务与运行状态入口。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@agent-console/contracts";
import {
  Boxes,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DeleteTaskButton } from "../domain/DeleteTaskButton";
import { Logo } from "./Logo";
import { RuntimeBadge } from "./RuntimeBadge";
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip } from "../ui/Tooltip";

const STATUS_META: Record<Task["status"], { label: string; dot: string }> = {
  queued: { label: "排队中", dot: "bg-ink-400" },
  planning: { label: "规划中", dot: "bg-cyan-400" },
  running: { label: "执行中", dot: "bg-signal-400 animate-pulse-dot" },
  paused: { label: "已暂停", dot: "bg-amber-400" },
  completed: { label: "已完成", dot: "bg-mint-400" },
  failed: { label: "失败", dot: "bg-rose-400" },
  cancelled: { label: "已取消", dot: "bg-ink-500" },
};

export function Sidebar() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "task"; taskId: string; goal: string }
    | { kind: "workspace"; workspaceId: string; name: string }
    | null
  >(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("agent-console-sidebar-collapsed") === "1",
  );
  const selectedWorkspace =
    new URLSearchParams(location.search).get("workspace") ?? "all";
  const statsQuery = useQuery({
    queryKey: ["stats", selectedWorkspace],
    queryFn: () => api.getStats(selectedWorkspace === "all" ? undefined : selectedWorkspace),
    refetchInterval: 3_000,
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.listTasks(),
    refetchInterval: 3_000,
  });
  const toolsQuery = useQuery({
    queryKey: ["tools"],
    queryFn: api.listTools,
  });
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.listWorkspaces,
  });

  const stats = statsQuery.data;
  const tasks = tasksQuery.data?.tasks ?? [];
  const tools = toolsQuery.data?.tools ?? [];
  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const recentTasks = tasks.slice(0, 3);
  const workspaceCounts = tasks.reduce<Record<string, number>>((counts, task) => {
    counts[task.workspaceId] = (counts[task.workspaceId] ?? 0) + 1;
    return counts;
  }, {});
  const successRate =
    stats?.successRate == null ? "…" : `${Math.round(stats.successRate * 100)}%`;

  useEffect(() => {
    localStorage.setItem("agent-console-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const rerunMutation = useMutation({
    mutationFn: (task: Task) => api.action(task.id, "rerun"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
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
  const createWorkspaceMutation = useMutation({
    mutationFn: (name: string) => api.createWorkspace({ name }),
    onSuccess: () => {
      setWorkspaceName("");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
  const deleteWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) => api.deleteWorkspace(workspaceId),
    onSuccess: (_data, workspaceId) => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (location.search === `?workspace=${workspaceId}`) {
        navigate("/");
      }
    },
  });

  return (
    <aside
      className={`hidden h-dvh shrink-0 flex-col overflow-x-hidden border-r border-ink-700/30 bg-ink-900 transition-[width] duration-200 ease-out md:flex ${
        collapsed ? "w-[68px]" : "w-72"
      }`}
    >
      <div
        className={`relative flex h-[72px] shrink-0 items-center border-b border-ink-700/30 ${
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        }`}
      >
        {collapsed ? (
          <Tooltip content="展开侧边栏">
            <button
              type="button"
              aria-label="展开侧边栏"
              onClick={() => setCollapsed(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-700/30 bg-ink-900 text-ink-400 transition hover:border-signal-500/30 hover:text-signal-300"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : (
          <>
            <Logo />
            <div className="min-w-0">
              <p className="display-label truncate text-[17px] leading-5 text-ink-100">
                Agent Console
              </p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                任务控制平面
              </p>
            </div>
            <Tooltip content="折叠侧边栏">
              <button
                type="button"
                aria-label="折叠侧边栏"
                onClick={() => setCollapsed(true)}
                className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-700/30 text-ink-400 transition hover:border-signal-500/30 hover:text-signal-300"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto ${
          collapsed ? "scroll-active px-2 py-4" : "scroll-active px-3 py-5"
        }`}
      >
        {collapsed ? (
          <div className="mb-6 space-y-1">
            <Tooltip content="任务总览">
              <NavLink
                to="/"
                end
                aria-label="任务总览"
                className={`flex h-10 items-center justify-center rounded-md border transition ${
                  location.pathname === "/"
                    ? "border-signal-500/25 bg-signal-500/10 text-signal-300"
                    : "border-transparent text-ink-400 hover:bg-ink-700/20 hover:text-ink-100"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </NavLink>
            </Tooltip>
          </div>
        ) : (
          <div className="mb-6">
            <p className="eyebrow px-3 pb-2">导航</p>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex h-10 items-center gap-3 rounded-md border px-3 text-sm font-medium transition ${
                  isActive
                    ? "border-signal-500/25 bg-signal-500/10 text-signal-300"
                    : "border-transparent text-ink-400 hover:bg-ink-700/20 hover:text-ink-100"
                }`
              }
            >
              <LayoutGrid className="h-4 w-4" />
              任务总览
              <span className="ml-auto rounded border border-ink-700/30 px-1.5 py-0.5 font-mono text-[11px] text-ink-400">
                {stats?.total ?? "…"}
              </span>
            </NavLink>
          </div>
        )}

        {!collapsed ? (
          <div className="mb-6">
            <p className="eyebrow px-3 pb-2">运行状态</p>
            <div className="overflow-hidden rounded-md border border-ink-700/25 bg-ink-950/45">
              <div className="grid grid-cols-3 divide-x divide-ink-700/20">
                <div className="px-3 py-3">
                  <p className="eyebrow">总计</p>
                  <p className="mt-1 text-xl font-semibold leading-6 text-ink-100">
                    {stats?.total ?? "…"}
                  </p>
                </div>
                <div className="px-3 py-3">
                  <p className="eyebrow">执行中</p>
                  <p className="mt-1 text-xl font-semibold leading-6 text-signal-300">
                    {stats?.byStatus.running ?? "…"}
                  </p>
                </div>
                <div className="px-3 py-3">
                  <p className="eyebrow">成功率</p>
                  <p className="mt-1 text-xl font-semibold leading-6 text-mint-300">
                    {successRate}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-ink-700/20 px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
                  <Boxes className="h-3.5 w-3.5" />
                  已接入工具
                </span>
                <span className="font-mono text-xs text-mint-300">
                  {toolsQuery.isLoading ? "…" : `${tools.length} 在线`}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-6">
          {collapsed ? (
            <ul className="space-y-1">
              {workspaces.slice(0, 4).map((workspace) => {
                const active =
                  workspace.id === "default"
                    ? location.search === "?workspace=default"
                    : location.search === `?workspace=${workspace.id}`;
                return (
                  <li key={workspace.id}>
                    <Tooltip content={workspace.name}>
                      <Link
                        to={`/?workspace=${workspace.id}`}
                        aria-label={`工作区 ${workspace.name}`}
                        className={`flex h-10 items-center justify-center rounded-md border transition ${
                          active
                            ? "border-signal-500/25 bg-signal-500/10 text-signal-300"
                            : "border-transparent text-ink-400 hover:bg-ink-700/20 hover:text-ink-100"
                        }`}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Link>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <p className="eyebrow px-3 pb-2">工作区</p>
              <ul className="space-y-1">
                {workspaces.map((workspace) => {
                  const active =
                    workspace.id === "default"
                      ? location.search === "?workspace=default"
                      : location.search === `?workspace=${workspace.id}`;
                  return (
                    <li key={workspace.id} className="flex items-center gap-1">
                      <Link
                        to={`/?workspace=${workspace.id}`}
                        className={`flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md border px-2.5 text-sm font-medium transition ${
                          active
                            ? "border-signal-500/25 bg-signal-500/10 text-signal-300"
                            : "border-transparent text-ink-400 hover:bg-ink-700/20 hover:text-ink-100"
                        }`}
                      >
                        <FolderOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">{workspace.name}</span>
                        <span className="ml-auto rounded border border-ink-700/30 px-1.5 py-0.5 font-mono text-[11px] text-ink-400">
                          {workspaceCounts[workspace.id] ?? 0}
                        </span>
                      </Link>
                      {workspace.id !== "default" ? (
                        <Tooltip content="删除工作区">
                          <button
                            type="button"
                            aria-label={`删除工作区 ${workspace.name}`}
                            disabled={deleteWorkspaceMutation.isPending}
                            onClick={() =>
                              setPendingDelete({
                                kind: "workspace",
                                workspaceId: workspace.id,
                                name: workspace.name,
                              })
                            }
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-ink-500 transition hover:border-rose-500/25 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <form
                className="mt-2 flex gap-2 px-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = workspaceName.trim();
                  if (name) {
                    createWorkspaceMutation.mutate(name);
                  }
                }}
              >
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="新建工作区"
                  aria-label="新建工作区名称"
                  className="h-9 min-w-0 flex-1 rounded-md border border-ink-700/30 bg-ink-950/60 px-3 text-sm text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-signal-500/60"
                />
                <Tooltip content="创建工作区">
                  <button
                    type="submit"
                    disabled={!workspaceName.trim() || createWorkspaceMutation.isPending}
                    aria-label="创建工作区"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-signal-500/30 bg-signal-500/10 text-signal-400 transition hover:bg-signal-500/20 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </Tooltip>
              </form>
            </>
          )}
        </div>

        {!collapsed ? (
          <div>
            <p className="eyebrow px-3 pb-2">最近任务</p>
            {recentTasks.length === 0 ? (
              <div className="rounded-md border border-dashed border-ink-700/30 px-3 py-6 text-center text-xs text-ink-500">
                暂无任务
              </div>
            ) : (
              <ul className="space-y-2">
                {recentTasks.map((task) => (
                  <li key={task.id}>
                    <div className="group flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-2 transition hover:border-ink-700/30 hover:bg-ink-700/15">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2.5"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[task.status].dot}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink-200 group-hover:text-ink-100">
                            {task.goal}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                            {STATUS_META[task.status].label} · {task.id.slice(0, 8)}
                          </p>
                        </div>
                      </Link>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-500 transition group-hover:text-signal-400" />
                      {["completed", "failed", "cancelled"].includes(task.status) ? (
                        <Tooltip content="重跑该任务">
                          <button
                            type="button"
                            aria-label={`重跑任务 ${task.goal}`}
                            disabled={rerunMutation.isPending}
                            onClick={() => rerunMutation.mutate(task)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-transparent text-ink-500 transition hover:border-signal-500/30 hover:bg-signal-500/10 hover:text-signal-400 disabled:opacity-40"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      ) : null}
                      <DeleteTaskButton
                        taskId={task.id}
                        goal={task.goal}
                        disabled={deleteMutation.isPending}
                        onDelete={(taskId, goal) => setPendingDelete({ kind: "task", taskId, goal })}
                        className="h-6 w-6 shrink-0"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={`shrink-0 space-y-3 border-t border-ink-700/30 ${
          collapsed ? "flex flex-col items-center px-2 py-4" : "px-5 py-4"
        }`}
      >
        {collapsed ? (
          <>
            <ThemeToggle compact />
            <RuntimeBadge compact />
          </>
        ) : (
          <>
            <ThemeToggle />
            <RuntimeBadge />
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === "task" ? "删除任务" : "删除工作区"}
        description={
          pendingDelete?.kind === "task"
            ? `确定删除任务“${pendingDelete.goal}”吗？删除后不可恢复。`
            : pendingDelete
              ? `确定删除工作区“${pendingDelete.name}”吗？其中的任务会移动到默认工作区。`
              : ""
        }
        tone="danger"
        confirmLabel="确认"
        isLoading={
          (pendingDelete?.kind === "task" && deleteMutation.isPending) ||
          (pendingDelete?.kind === "workspace" && deleteWorkspaceMutation.isPending)
        }
        onConfirm={() => {
          if (pendingDelete?.kind === "task") {
            deleteMutation.mutate({ taskId: pendingDelete.taskId });
          } else if (pendingDelete?.kind === "workspace") {
            deleteWorkspaceMutation.mutate(pendingDelete.workspaceId);
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </aside>
  );
}

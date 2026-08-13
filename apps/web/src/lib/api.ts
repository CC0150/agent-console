import type {
  ApprovalDecision,
  ApprovalRequest,
  Task,
  TaskAction,
  TaskEvent,
  ToolDefinition,
  Workspace,
} from "@agent-console/contracts";

export interface TaskStats {
  total: number;
  byStatus: Record<Task["status"], number>;
  avgDurationMs: number | null;
  successRate: number | null;
}

export interface HealthResponse {
  ok: boolean;
  llm: {
    provider: "mock" | "openai";
    model: string;
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `请求失败: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  listTasks: (workspaceId?: string) =>
    request<{ tasks: Task[] }>(
      workspaceId ? `/tasks?workspaceId=${encodeURIComponent(workspaceId)}` : "/tasks",
    ),
  listTools: () => request<{ tools: ToolDefinition[] }>("/tools"),
  listWorkspaces: () => request<{ workspaces: Workspace[] }>("/workspaces"),
  createWorkspace: (input: { name: string; description?: string }) =>
    request<{ workspace: Workspace }>("/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteWorkspace: (workspaceId: string) =>
    fetch(`/api/workspaces/${workspaceId}`, {
      method: "DELETE",
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`删除工作区失败: ${response.status}`);
      }
    }),
  getTask: (taskId: string) => request<{ task: Task }>(`/tasks/${taskId}`),
  createTask: (goal: string, workspaceId?: string) =>
    request<{ task: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ goal, workspaceId }),
    }),
  getEvents: (taskId: string) => request<{ events: TaskEvent[] }>(`/tasks/${taskId}/events`),
  getPendingApprovals: (taskId: string) =>
    request<{ approvals: ApprovalRequest[] }>(`/tasks/${taskId}/approvals`),
  resolveApproval: (taskId: string, approvalId: string, decision: ApprovalDecision) =>
    request<{ ok: boolean }>(`/tasks/${taskId}/approvals`, {
      method: "POST",
      body: JSON.stringify({ approvalId, decision }),
    }),
  getStats: (workspaceId?: string) =>
    request<TaskStats>(
      workspaceId ? `/stats?workspaceId=${encodeURIComponent(workspaceId)}` : "/stats",
    ),
  deleteTask: (taskId: string) =>
    fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`删除任务失败: ${response.status}`);
      }
    }),
  action: (taskId: string, action: TaskAction) =>
    request<{ task: Task }>(`/tasks/${taskId}/actions`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
};

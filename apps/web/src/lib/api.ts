import type {
  BatchTaskAction,
  Task,
  TaskAction,
  TaskArtifact,
  TaskEvent,
  TaskSortField,
  TaskSortOrder,
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

export interface TaskListParams {
  workspaceId?: string;
  q?: string;
  status?: Task["status"];
  sort?: TaskSortField;
  order?: TaskSortOrder;
  page?: number;
  pageSize?: number;
}

export interface TaskListResult {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BatchActionResult {
  ok: boolean;
  processed: number;
  skipped: number;
  tasks?: Task[];
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
  listTasks: (params: TaskListParams = {}) => {
    const search = new URLSearchParams();
    if (params.workspaceId) {
      search.set("workspaceId", params.workspaceId);
    }
    if (params.q) {
      search.set("q", params.q);
    }
    if (params.status) {
      search.set("status", params.status);
    }
    if (params.sort) {
      search.set("sort", params.sort);
    }
    if (params.order) {
      search.set("order", params.order);
    }
    if (params.page != null) {
      search.set("page", String(params.page));
    }
    if (params.pageSize != null) {
      search.set("pageSize", String(params.pageSize));
    }
    const query = search.toString();
    return request<TaskListResult>(query ? `/tasks?${query}` : "/tasks");
  },
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
  listArtifacts: (taskId: string) =>
    request<{ artifacts: TaskArtifact[] }>(`/tasks/${taskId}/artifacts`),
  getArtifactContent: async (taskId: string, artifactId: string) => {
    const response = await fetch(
      `/api/tasks/${taskId}/artifacts/${artifactId}/content`,
    );
    if (!response.ok) {
      throw new Error(`读取产出物失败: ${response.status}`);
    }
    return response.text();
  },
  artifactDownloadUrl: (taskId: string, artifactId: string) =>
    `/api/tasks/${taskId}/artifacts/${artifactId}/content?download=1`,
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
  batchAction: (action: BatchTaskAction, taskIds: string[]) =>
    request<BatchActionResult>("/tasks/batch/actions", {
      method: "POST",
      body: JSON.stringify({ action, taskIds }),
    }),
};

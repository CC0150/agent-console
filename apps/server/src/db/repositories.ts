import { randomUUID } from "node:crypto";
import {
  ApprovalRequest,
  ApprovalStatus,
  TaskStatus,
  type Task,
  type TaskEvent,
  type TaskListQuery,
  type TaskSortField,
  type TaskStatus as TaskStatusType,
  type ApprovalRequest as ApprovalRequestType,
  type ApprovalStatus as ApprovalStatusType,
  type Workspace,
} from "@agent-console/contracts";
import { db } from "./client";

interface TaskRow {
  id: string;
  goal: string;
  workspace_id: string;
  status: string;
  model: string;
  current_step: number;
  total_steps: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface EventRow {
  id: string;
  task_id: string;
  seq: number;
  type: string;
  payload: string;
  created_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ApprovalRow {
  id: string;
  task_id: string;
  tool_call_id: string;
  tool_name: string;
  input: string;
  reason: string;
  status: string;
  requested_at: string;
  resolved_at: string | null;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    "status" | "model" | "currentStep" | "totalSteps" | "error" | "startedAt" | "finishedAt"
  >
>;

export interface TaskStats {
  total: number;
  byStatus: Record<TaskStatusType, number>;
  avgDurationMs: number | null;
  successRate: number | null;
}

export interface TaskListResult {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TASK_SORT_COLUMNS: Record<TaskSortField, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  status: "status",
  currentStep: "current_step",
};

export function withTransaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    goal: row.goal,
    workspaceId: row.workspace_id,
    status: TaskStatus.parse(row.status),
    model: row.model,
    currentStep: row.current_step,
    totalSteps: row.total_steps,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export const taskRepository = {
  create(input: { goal: string; model: string; workspaceId?: string }): Task {
    const now = new Date().toISOString();
    const id = randomUUID();
    const workspaceId = input.workspaceId ?? "default";
    db.prepare(
      `INSERT INTO tasks
        (id, goal, workspace_id, status, model, current_step, total_steps, error, created_at, updated_at, started_at, finished_at)
       VALUES (?, ?, ?, 'queued', ?, 0, 0, NULL, ?, ?, NULL, NULL)`,
    ).run(id, input.goal, workspaceId, input.model, now, now);
    const created = this.findById(id);
    if (!created) {
      throw new Error("任务创建失败");
    }
    return created;
  },

  findById(id: string): Task | null {
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
    return row ? mapTask(row) : null;
  },

  list(workspaceId?: string): Task[] {
    const rows = workspaceId
      ? (db
          .prepare("SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC")
          .all(workspaceId) as unknown as TaskRow[])
      : (db
          .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
          .all() as unknown as TaskRow[]);
    return rows.map(mapTask);
  },

  query(input: TaskListQuery = { page: 1, pageSize: 20 }): TaskListResult {
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    const workspaceId = input.workspaceId?.trim();
    const keyword = input.q?.trim();

    if (workspaceId) {
      conditions.push("workspace_id = ?");
      params.push(workspaceId);
    }
    if (input.status) {
      conditions.push("status = ?");
      params.push(input.status);
    }
    if (keyword) {
      conditions.push("(goal LIKE ? OR id LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereSql = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const countRow = db
      .prepare(`SELECT COUNT(*) AS count FROM tasks${whereSql}`)
      .get(...params) as { count: number };
    const total = countRow.count;
    const pageSize = input.pageSize ?? 20;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(input.page ?? 1, totalPages);
    const sortColumn = TASK_SORT_COLUMNS[input.sort ?? "createdAt"];
    const order = input.order === "asc" ? "ASC" : "DESC";

    const rows = db
      .prepare(
        `SELECT * FROM tasks${whereSql}
         ORDER BY ${sortColumn} ${order}, created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize) as unknown as TaskRow[];

    return {
      tasks: rows.map(mapTask),
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  remove(id: string): boolean {
    return db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
  },

  update(id: string, patch: TaskPatch): Task | null {
    const current = this.findById(id);
    if (!current) {
      return null;
    }
    const next: Task = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    db.prepare(
      `UPDATE tasks
       SET status = ?, model = ?, current_step = ?, total_steps = ?, error = ?,
           updated_at = ?, started_at = ?, finished_at = ?
       WHERE id = ?`,
    ).run(
      next.status,
      next.model,
      next.currentStep,
      next.totalSteps,
      next.error,
      next.updatedAt,
      next.startedAt,
      next.finishedAt,
      id,
    );
    return this.findById(id);
  },

  stats(workspaceId?: string): TaskStats {
    const totalRow = workspaceId
      ? (db
          .prepare("SELECT COUNT(*) AS count FROM tasks WHERE workspace_id = ?")
          .get(workspaceId) as { count: number })
      : (db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number });
    const statusRows = workspaceId
      ? (db
          .prepare("SELECT status, COUNT(*) AS count FROM tasks WHERE workspace_id = ? GROUP BY status")
          .all(workspaceId) as unknown as Array<{ status: TaskStatusType; count: number }>)
      : (db
          .prepare("SELECT status, COUNT(*) AS count FROM tasks GROUP BY status")
          .all() as unknown as Array<{ status: TaskStatusType; count: number }>);

    const byStatus = Object.fromEntries(
      TaskStatus.options.map((status) => [status, 0]),
    ) as Record<TaskStatusType, number>;
    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }

    const finished = this.list(workspaceId).filter((task) => task.finishedAt);
    const started = finished.filter((task) => task.startedAt);
    const durations = started.map(
      (task) => new Date(task.finishedAt as string).getTime() - new Date(task.startedAt as string).getTime(),
    );
    const avgDurationMs =
      durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    const completed = finished.filter((task) => task.status === "completed").length;
    const successRate = finished.length > 0 ? completed / finished.length : null;

    return {
      total: totalRow.count,
      byStatus,
      avgDurationMs,
      successRate,
    };
  },
};

export const eventRepository = {
  nextSeq(taskId: string): number {
    const row = db
      .prepare("SELECT MAX(seq) AS max_seq FROM task_events WHERE task_id = ?")
      .get(taskId) as { max_seq: number | null };
    return (row.max_seq ?? 0) + 1;
  },

  insert(event: TaskEvent): void {
    db.prepare(
      `INSERT INTO task_events (id, task_id, seq, type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      event.id,
      event.taskId,
      event.seq,
      event.type,
      JSON.stringify(event.payload),
      event.createdAt,
    );
  },

  listByTask(taskId: string): TaskEvent[] {
    const rows = db
      .prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY seq ASC")
      .all(taskId) as unknown as EventRow[];
    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      seq: row.seq,
      type: row.type,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload),
    })) as TaskEvent[];
  },
};

export const workspaceRepository = {
  list(): Workspace[] {
    const rows = db
      .prepare("SELECT * FROM workspaces ORDER BY created_at ASC")
      .all() as unknown as WorkspaceRow[];
    return rows.map(mapWorkspace);
  },

  findById(id: string): Workspace | null {
    const row = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as
      | WorkspaceRow
      | undefined;
    return row ? mapWorkspace(row) : null;
  },

  create(input: { name: string; description: string }): Workspace {
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO workspaces (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, input.name, input.description, now, now);
    const created = this.findById(id);
    if (!created) {
      throw new Error("工作区创建失败");
    }
    return created;
  },

  taskCount(id: string): number {
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE workspace_id = ?")
      .get(id) as { count: number };
    return row.count;
  },

  remove(id: string): boolean {
    if (id === "default") {
      return false;
    }
    const removed = db
      .transaction(() => {
        db.prepare("UPDATE tasks SET workspace_id = 'default' WHERE workspace_id = ?").run(id);
        return db.prepare("DELETE FROM workspaces WHERE id = ?").run(id).changes;
      })();
    return removed > 0;
  },
};

export const approvalRepository = {
  create(input: Omit<ApprovalRequestType, "id" | "status" | "requestedAt" | "resolvedAt">): ApprovalRequestType {
    const now = new Date().toISOString();
    const approval: ApprovalRequestType = {
      ...input,
      id: randomUUID(),
      status: "pending",
      requestedAt: now,
      resolvedAt: null,
    };
    db.prepare(
      `INSERT INTO approvals
        (id, task_id, tool_call_id, tool_name, input, reason, status, requested_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      approval.id,
      approval.taskId,
      approval.toolCallId,
      approval.toolName,
      JSON.stringify(approval.input),
      approval.reason,
      approval.status,
      approval.requestedAt,
    );
    return approval;
  },

  listPendingByTask(taskId: string): ApprovalRequestType[] {
    const rows = db
      .prepare(
        `SELECT * FROM approvals
         WHERE task_id = ? AND status = 'pending'
         ORDER BY requested_at ASC`,
      )
      .all(taskId) as unknown as ApprovalRow[];
    return rows.map(mapApproval);
  },

  findById(id: string): ApprovalRequestType | null {
    const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as
      | ApprovalRow
      | undefined;
    return row ? mapApproval(row) : null;
  },

  resolve(id: string, status: ApprovalStatusType): ApprovalRequestType | null {
    const resolvedAt = new Date().toISOString();
    const changed = db
      .prepare(
        `UPDATE approvals
         SET status = ?, resolved_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(status, resolvedAt, id).changes;
    if (changed === 0) {
      return null;
    }
    const approval = this.findById(id);
    return approval ? { ...approval, resolvedAt } : null;
  },

  cancelPendingByTask(taskId: string): number {
    const resolvedAt = new Date().toISOString();
    return db
      .prepare(
        `UPDATE approvals
         SET status = 'cancelled', resolved_at = ?
         WHERE task_id = ? AND status = 'pending'`,
      )
      .run(resolvedAt, taskId).changes;
  },
};

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapApproval(row: ApprovalRow): ApprovalRequestType {
  return ApprovalRequest.parse({
    id: row.id,
    taskId: row.task_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    input: JSON.parse(row.input),
    reason: row.reason,
    status: ApprovalStatus.parse(row.status),
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
  });
}

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  TaskStatus,
  TaskArtifact,
  type Task,
  type TaskEvent,
  type TaskListQuery,
  type TaskSortField,
  type TaskStatus as TaskStatusType,
  type Workspace,
} from "@agent-console/contracts";
import { config } from "../config";
import { prisma } from "./client";

interface TaskRow {
  id: string;
  goal: string;
  workspaceId: string;
  status: string;
  model: string;
  currentStep: number;
  totalSteps: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

interface EventRow {
  id: string;
  taskId: string;
  seq: number;
  type: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

interface WorkspaceRow {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ArtifactRow {
  id: string;
  taskId: string;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
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

const TASK_SORT_FIELDS: Record<TaskSortField, keyof Prisma.TaskOrderByWithRelationInput> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  status: "status",
  currentStep: "currentStep",
};

const transactionContext = new AsyncLocalStorage<Prisma.TransactionClient>();

export function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => transactionContext.run(tx, () => fn()));
}

function client(): Prisma.TransactionClient | PrismaClient {
  return transactionContext.getStore() ?? prisma;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    goal: row.goal,
    workspaceId: row.workspaceId,
    status: TaskStatus.parse(row.status),
    model: row.model,
    currentStep: row.currentStep,
    totalSteps: row.totalSteps,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: toIso(row.startedAt),
    finishedAt: toIso(row.finishedAt),
  };
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapArtifact(row: ArtifactRow): TaskArtifact {
  return {
    id: row.id,
    taskId: row.taskId,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapEvent(row: EventRow): TaskEvent {
  return {
    id: row.id,
    taskId: row.taskId,
    seq: row.seq,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload as unknown as TaskEvent["payload"],
  } as TaskEvent;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export const taskRepository = {
  async create(input: { goal: string; model: string; workspaceId?: string }): Promise<Task> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const workspaceId = input.workspaceId ?? "default";
    await client().task.create({
      data: {
        id,
        goal: input.goal,
        workspaceId,
        status: "queued",
        model: input.model,
        currentStep: 0,
        totalSteps: 0,
        error: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        finishedAt: null,
      },
    });
    const created = await this.findById(id);
    if (!created) {
      throw new Error("任务创建失败");
    }
    return created;
  },

  async findById(id: string): Promise<Task | null> {
    const row = await client().task.findUnique({ where: { id } });
    return row ? mapTask(row) : null;
  },

  async list(workspaceId?: string): Promise<Task[]> {
    const rows = await client().task.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapTask);
  },

  async query(input: TaskListQuery = { page: 1, pageSize: 20 }): Promise<TaskListResult> {
    const where: Prisma.TaskWhereInput = {};
    const workspaceId = input.workspaceId?.trim();
    const keyword = input.q?.trim();

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    if (input.status) {
      where.status = input.status;
    }
    if (keyword) {
      where.OR = [
        { goal: { contains: keyword } },
        { id: { contains: keyword } },
      ];
    }

    const total = await client().task.count({ where });
    const pageSize = input.pageSize ?? 20;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(input.page ?? 1, totalPages);
    const sortField = TASK_SORT_FIELDS[input.sort ?? "createdAt"];
    const order = input.order === "asc" ? "asc" : "desc";
    const rows = await client().task.findMany({
      where,
      orderBy: [
        { [sortField]: order },
        { createdAt: "desc" },
        { id: "desc" },
      ] as Prisma.TaskOrderByWithRelationInput[],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      tasks: rows.map(mapTask),
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async remove(id: string): Promise<boolean> {
    try {
      await client().task.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw error;
    }
  },

  async update(id: string, patch: TaskPatch): Promise<Task | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }
    const next: Task = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await client().task.update({
      where: { id },
      data: {
        status: next.status,
        model: next.model,
        currentStep: next.currentStep,
        totalSteps: next.totalSteps,
        error: next.error,
        updatedAt: next.updatedAt,
        startedAt: next.startedAt,
        finishedAt: next.finishedAt,
      },
    });
    return this.findById(id);
  },

  async stats(workspaceId?: string): Promise<TaskStats> {
    const where: Prisma.TaskWhereInput = workspaceId ? { workspaceId } : {};
    const total = await client().task.count({ where });
    const statusRows = await client().task.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const byStatus = Object.fromEntries(
      TaskStatus.options.map((status) => [status, 0]),
    ) as Record<TaskStatusType, number>;
    for (const row of statusRows) {
      byStatus[row.status as TaskStatusType] = row._count._all;
    }

    const finished = (await this.list(workspaceId)).filter((task) => task.finishedAt);
    const started = finished.filter((task) => task.startedAt);
    const durations = started.map(
      (task) =>
        new Date(task.finishedAt as string).getTime() -
        new Date(task.startedAt as string).getTime(),
    );
    const avgDurationMs =
      durations.length > 0
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : null;
    const completed = finished.filter((task) => task.status === "completed").length;
    const successRate = finished.length > 0 ? completed / finished.length : null;

    return {
      total,
      byStatus,
      avgDurationMs,
      successRate,
    };
  },
};

export const eventRepository = {
  async nextSeq(taskId: string): Promise<number> {
    const result = await client().taskEvent.aggregate({
      where: { taskId },
      _max: { seq: true },
    });
    return (result._max.seq ?? 0) + 1;
  },

  async insert(event: TaskEvent): Promise<void> {
    await client().taskEvent.create({
      data: {
        id: event.id,
        taskId: event.taskId,
        seq: event.seq,
        type: event.type,
        payload: event.payload as unknown as Prisma.InputJsonValue,
        createdAt: event.createdAt,
      },
    });
  },

  async listByTask(taskId: string): Promise<TaskEvent[]> {
    const rows = await client().taskEvent.findMany({
      where: { taskId },
      orderBy: { seq: "asc" },
    });
    return rows.map(mapEvent);
  },

  async deleteByTask(taskId: string): Promise<number> {
    const result = await client().taskEvent.deleteMany({ where: { taskId } });
    return result.count;
  },
};

export const workspaceRepository = {
  async list(): Promise<Workspace[]> {
    const rows = await client().workspace.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapWorkspace);
  },

  async findById(id: string): Promise<Workspace | null> {
    const row = await client().workspace.findUnique({ where: { id } });
    return row ? mapWorkspace(row) : null;
  },

  async create(input: { name: string; description: string }): Promise<Workspace> {
    const now = new Date().toISOString();
    const id = randomUUID();
    await client().workspace.create({
      data: {
        id,
        name: input.name,
        description: input.description,
        createdAt: now,
        updatedAt: now,
      },
    });
    const created = await this.findById(id);
    if (!created) {
      throw new Error("工作区创建失败");
    }
    return created;
  },

  async taskCount(id: string): Promise<number> {
    return client().task.count({ where: { workspaceId: id } });
  },

  async remove(id: string): Promise<boolean> {
    if (id === "default") {
      return false;
    }
    return withTransaction(async () => {
      await client().task.updateMany({
        where: { workspaceId: id },
        data: { workspaceId: "default" },
      });
      try {
        await client().workspace.delete({ where: { id } });
        return true;
      } catch (error) {
        if (isRecordNotFound(error)) {
          return false;
        }
        throw error;
      }
    });
  },
};

/**
 * 产出物仓储：负责把工具生成的文件写入 reports 目录，
 * 同时在数据库中登记元数据，便于任务详情页预览和下载。
 */
export const artifactRepository = {
  async save(input: {
    taskId: string;
    fileName: string;
    content: string;
    mimeType: string;
  }): Promise<TaskArtifact> {
    const safeName = sanitizeFileName(input.fileName);
    const storageKey = `${input.taskId}/${randomUUID()}-${safeName}`;
    const filePath = resolveArtifactPath(storageKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, input.content, "utf8");

    const artifact: TaskArtifact = {
      id: randomUUID(),
      taskId: input.taskId,
      name: safeName,
      mimeType: input.mimeType,
      sizeBytes: fs.statSync(filePath).size,
      createdAt: new Date().toISOString(),
    };
    await client().artifact.create({
      data: {
        id: artifact.id,
        taskId: artifact.taskId,
        name: artifact.name,
        storageKey,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        createdAt: artifact.createdAt,
      },
    });
    return artifact;
  },

  async listByTask(taskId: string): Promise<TaskArtifact[]> {
    const rows = await client().artifact.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapArtifact);
  },

  async findById(id: string): Promise<TaskArtifact | null> {
    const row = await client().artifact.findUnique({ where: { id } });
    return row ? mapArtifact(row) : null;
  },

  async readContent(id: string): Promise<{ artifact: TaskArtifact; content: string } | null> {
    const row = await client().artifact.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    try {
      const filePath = resolveArtifactPath(row.storageKey);
      return {
        artifact: mapArtifact(row),
        content: fs.readFileSync(filePath, "utf8"),
      };
    } catch {
      return null;
    }
  },

  async deleteByTask(taskId: string): Promise<number> {
    const rows = await client().artifact.findMany({
      where: { taskId },
      select: { storageKey: true },
    });
    for (const row of rows) {
      try {
        fs.rmSync(resolveArtifactPath(row.storageKey), { force: true });
      } catch {
        // 文件已不存在时无需中断删除任务
      }
    }
    const result = await client().artifact.deleteMany({ where: { taskId } });
    return result.count;
  },
};

function sanitizeFileName(raw: string): string {
  const normalized = raw.replace(/\\/g, "/");
  const base = path.basename(normalized).trim();
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 120);
  return safe || "report";
}

function resolveArtifactPath(storageKey: string): string {
  const root = path.resolve(config.artifact.reportsDir);
  const filePath = path.resolve(root, storageKey);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("非法的产出物存储路径");
  }
  return filePath;
}

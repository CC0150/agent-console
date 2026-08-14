import { z } from "zod";

export const TaskStatus = z.enum([
  "queued",
  "planning",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export type TaskStatus = z.infer<typeof TaskStatus>;

export const Task = z.object({
  id: z.string().min(1),
  goal: z.string().min(1),
  workspaceId: z.string().min(1),
  status: TaskStatus,
  model: z.string(),
  currentStep: z.number().int().min(0),
  totalSteps: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

export type Task = z.infer<typeof Task>;

export const CreateTaskInput = z.object({
  goal: z.string().min(1).max(2000),
  workspaceId: z.string().min(1).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const TaskAction = z.enum(["pause", "resume", "cancel", "retry", "rerun"]);

export type TaskAction = z.infer<typeof TaskAction>;

export const TaskActionInput = z.object({
  action: TaskAction,
});

export type TaskActionInput = z.infer<typeof TaskActionInput>;

export const TaskSortField = z.enum(["createdAt", "updatedAt", "status", "currentStep"]);

export type TaskSortField = z.infer<typeof TaskSortField>;

export const TaskSortOrder = z.enum(["asc", "desc"]);

export type TaskSortOrder = z.infer<typeof TaskSortOrder>;

export const TaskListQuery = z.object({
  workspaceId: z.string().min(1).optional(),
  q: z.string().max(200).optional(),
  status: TaskStatus.optional(),
  sort: TaskSortField.optional(),
  order: TaskSortOrder.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});

export type TaskListQuery = z.infer<typeof TaskListQuery>;

export const BatchTaskAction = z.enum(["pause", "resume", "cancel", "rerun", "delete"]);

export type BatchTaskAction = z.infer<typeof BatchTaskAction>;

export const BatchTaskActionInput = z.object({
  action: BatchTaskAction,
  taskIds: z.array(z.string().min(1)).min(1).max(500),
});

export type BatchTaskActionInput = z.infer<typeof BatchTaskActionInput>;

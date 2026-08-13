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

export const TaskAction = z.enum(["pause", "resume", "cancel", "rerun"]);

export type TaskAction = z.infer<typeof TaskAction>;

export const TaskActionInput = z.object({
  action: TaskAction,
});

export type TaskActionInput = z.infer<typeof TaskActionInput>;

import { z } from "zod";

export const ToolCallState = z.enum([
  "pending",
  "running",
  "requires_approval",
  "rejected",
  "succeeded",
  "failed",
]);

export type ToolCallState = z.infer<typeof ToolCallState>;

export const ToolCall = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  // 关联助手消息中请求的工具调用 id，旧数据没有该字段时按顺序兜底匹配
  assistantCallId: z.string().optional(),
  toolName: z.string().min(1),
  input: z.record(z.unknown()),
  state: ToolCallState,
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
});

export type ToolCall = z.infer<typeof ToolCall>;

export const AssistantToolCall = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.record(z.unknown()),
});

export type AssistantToolCall = z.infer<typeof AssistantToolCall>;

export const PlanStep = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  toolName: z.string().min(1),
  input: z.record(z.unknown()),
});

export type PlanStep = z.infer<typeof PlanStep>;

export const ToolDefinition = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.unknown()).optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinition>;

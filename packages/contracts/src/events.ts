import { z } from "zod";
import { Task, TaskStatus } from "./task";
import { ApprovalRequest } from "./approval";
import { AssistantToolCall, PlanStep, ToolCall } from "./tools";
import { Usage } from "./llm";

export const TASK_EVENT_TYPES = [
  "task.created",
  "task.plan_updated",
  "task.status_changed",
  "tool.started",
  "tool.finished",
  "approval.requested",
  "approval.resolved",
  "message.delta",
  "message.assistant",
  "task.completed",
  "task.failed",
] as const;

export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

const EventBase = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  seq: z.number().int().min(1),
  createdAt: z.string(),
});

export const TaskCreatedEvent = EventBase.extend({
  type: z.literal("task.created"),
  payload: z.object({
    task: Task,
  }),
});

export const PlanUpdatedEvent = EventBase.extend({
  type: z.literal("task.plan_updated"),
  payload: z.object({
    plan: z.array(PlanStep),
  }),
});

export const StatusChangedEvent = EventBase.extend({
  type: z.literal("task.status_changed"),
  payload: z.object({
    from: TaskStatus,
    to: TaskStatus,
  }),
});

export const ToolStartedEvent = EventBase.extend({
  type: z.literal("tool.started"),
  payload: z.object({
    toolCall: ToolCall,
  }),
});

export const ToolFinishedEvent = EventBase.extend({
  type: z.literal("tool.finished"),
  payload: z.object({
    toolCall: ToolCall,
  }),
});

export const ApprovalRequestedEvent = EventBase.extend({
  type: z.literal("approval.requested"),
  payload: z.object({
    approval: ApprovalRequest,
  }),
});

export const ApprovalResolvedEvent = EventBase.extend({
  type: z.literal("approval.resolved"),
  payload: z.object({
    approval: ApprovalRequest,
  }),
});

export const MessageDeltaEvent = EventBase.extend({
  type: z.literal("message.delta"),
  payload: z.object({
    delta: z.string(),
  }),
});

export const MessageAssistantEvent = EventBase.extend({
  type: z.literal("message.assistant"),
  payload: z.object({
    content: z.string(),
    toolCalls: z.array(AssistantToolCall),
    // 兼容旧事件，真实模型返回结束原因和 token 用量后才会写入
    finishReason: z.string().optional(),
    usage: Usage.optional(),
  }),
});

export const TaskCompletedEvent = EventBase.extend({
  type: z.literal("task.completed"),
  payload: z.object({
    summary: z.string(),
  }),
});

export const TaskFailedEvent = EventBase.extend({
  type: z.literal("task.failed"),
  payload: z.object({
    error: z.string(),
  }),
});

export const TaskEvent = z.discriminatedUnion("type", [
  TaskCreatedEvent,
  PlanUpdatedEvent,
  StatusChangedEvent,
  ToolStartedEvent,
  ToolFinishedEvent,
  ApprovalRequestedEvent,
  ApprovalResolvedEvent,
  MessageDeltaEvent,
  MessageAssistantEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
]);

export type TaskEvent = z.infer<typeof TaskEvent>;

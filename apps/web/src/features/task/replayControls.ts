import type {
  PlanStep,
  Task,
  TaskEvent,
  TaskEventType,
  ToolCall,
} from "@agent-console/contracts";
import { TASK_EVENT_TYPES } from "@agent-console/contracts";
import { EVENT_TYPE_LABELS, summarizeEvent } from "./EventLog";

export type ReplayFilter = TaskEventType | "all";

export const REPLAY_FILTER_OPTIONS: Array<{
  value: ReplayFilter;
  label: string;
}> = [
  { value: "all", label: "全部事件" },
  ...TASK_EVENT_TYPES.map((type) => ({
    value: type,
    label: EVENT_TYPE_LABELS[type],
  })),
];

export interface ReplayFilters {
  type: ReplayFilter;
  query: string;
}

export function filterReplayEvents(
  events: TaskEvent[],
  filters: ReplayFilters,
): TaskEvent[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return events.filter((event) => {
    if (filters.type !== "all" && event.type !== filters.type) {
      return false;
    }
    if (!query) {
      return true;
    }
    const searchable = [
      event.id,
      String(event.seq),
      event.type,
      EVENT_TYPE_LABELS[event.type],
      summarizeEvent(event),
      JSON.stringify(event.payload),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return searchable.includes(query);
  });
}

export function findEventIndexBySeq(
  events: TaskEvent[],
  seq: number,
): number | null {
  const index = events.findIndex((event) => event.seq === seq);
  return index === -1 ? null : index;
}

interface ReplayReportContext {
  task: Task;
  workspaceName?: string;
  events: TaskEvent[];
  plan: PlanStep[];
  toolCalls: ToolCall[];
  streamText: string;
}

const STATUS_LABELS: Record<Task["status"], string> = {
  queued: "排队中",
  planning: "规划中",
  running: "执行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const TOOL_STATE_LABELS: Record<ToolCall["state"], string> = {
  requires_approval: "待审批",
  pending: "等待中",
  running: "执行中",
  rejected: "已拒绝",
  succeeded: "成功",
  failed: "失败",
};

export function buildReplayReport({
  task,
  workspaceName,
  events,
  plan,
  toolCalls,
  streamText,
}: ReplayReportContext): string {
  return [
    "# Agent Console 回放报告",
    "",
    "## 任务信息",
    "",
    `- 目标：${task.goal}`,
    `- 任务 ID：${task.id}`,
    `- 工作区：${workspaceName ?? task.workspaceId}`,
    `- 模型：${task.model}`,
    `- 状态：${STATUS_LABELS[task.status] ?? task.status}`,
    `- 创建时间：${formatDateTime(task.createdAt)}`,
    `- 开始时间：${task.startedAt ? formatDateTime(task.startedAt) : "-"}`,
    `- 结束时间：${task.finishedAt ? formatDateTime(task.finishedAt) : "-"}`,
    `- 事件总数：${events.length}`,
    "",
    "## 执行计划",
    "",
    ...(plan.length > 0
      ? plan.map((step, index) => `${index + 1}. ${step.title}（${step.toolName}）`)
      : ["- 无执行计划"]),
    "",
    "## 工具调用",
    "",
    ...(toolCalls.length > 0
      ? toolCalls.flatMap((call, index) => buildToolCallLines(call, index + 1))
      : ["- 无工具调用"]),
    "",
    "## 流式输出",
    "",
    streamText ? streamText : "- 无流式输出",
    "",
    "## 事件时间线",
    "",
    ...events.map(
      (event) =>
        `- \`#${event.seq}\` \`${formatClock(event.createdAt)}\` **${EVENT_TYPE_LABELS[event.type]}**：${summarizeEvent(event)}`,
    ),
    "",
  ].join("\n");
}

function buildToolCallLines(call: ToolCall, index: number): string[] {
  const duration =
    call.durationMs == null
      ? ""
      : `（耗时 ${(call.durationMs / 1000).toFixed(1)}s）`;
  const outputText =
    typeof call.output === "string"
      ? call.output
      : JSON.stringify(call.output, null, 2);

  return [
    `### ${index}. ${call.toolName}`,
    "",
    `- 状态：${TOOL_STATE_LABELS[call.state] ?? call.state}${duration}`,
    "- 输入：",
    "",
    "```json",
    JSON.stringify(call.input, null, 2),
    "```",
    "",
    "- 输出：",
    "",
    "```text",
    outputText ?? "-",
    "```",
    ...(call.error ? ["", `- 错误：${call.error}`, ""] : [""]),
  ];
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatClock(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

import type { TaskEvent } from "@agent-console/contracts";
import { ListOrdered } from "lucide-react";

export const EVENT_TYPE_STYLES: Record<TaskEvent["type"], string> = {
  "task.created": "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  "task.plan_updated": "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
  "task.status_changed": "border-signal-500/20 bg-signal-500/10 text-signal-300",
  "tool.started": "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  "tool.finished": "border-mint-500/20 bg-mint-500/10 text-mint-300",
  "approval.requested": "border-amber-500/25 bg-amber-500/10 text-amber-300",
  "approval.resolved": "border-violet-500/25 bg-violet-500/10 text-violet-300",
  "message.delta": "border-ink-700/30 bg-ink-700/10 text-ink-300",
  "message.assistant": "border-ink-600/30 bg-ink-700/10 text-ink-200",
  "artifact.created": "border-violet-500/25 bg-violet-500/10 text-violet-300",
  "task.completed": "border-mint-500/20 bg-mint-500/10 text-mint-300",
  "task.failed": "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

export const EVENT_TYPE_LABELS: Record<TaskEvent["type"], string> = {
  "task.created": "任务创建",
  "task.plan_updated": "计划更新",
  "task.status_changed": "状态变更",
  "tool.started": "工具启动",
  "tool.finished": "工具结束",
  "approval.requested": "审批请求",
  "approval.resolved": "审批完成",
  "message.delta": "增量输出",
  "message.assistant": "助手消息",
  "artifact.created": "产出物",
  "task.completed": "任务完成",
  "task.failed": "任务失败",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  planning: "规划中",
  running: "执行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const TOOL_STATE_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "执行中",
  requires_approval: "待审批",
  rejected: "已拒绝",
  succeeded: "成功",
  failed: "失败",
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: "待处理",
  approved: "已批准",
  rejected: "已拒绝",
  cancelled: "已取消",
  expired: "已超时",
};

export function EventLog({ events }: { events: TaskEvent[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <ListOrdered className="h-4 w-4 text-signal-400" />
          <div>
            <h2 className="text-sm font-semibold text-ink-100">事件流</h2>
            <p className="eyebrow mt-0.5">实时事件</p>
          </div>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {events.length} 条事件
        </span>
      </div>

      <div className="max-h-[420px] overflow-auto">
        {events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-400">暂无事件</p>
        ) : (
          <ul className="divide-y divide-ink-700/25">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-ink-700/15"
              >
                <span className="w-9 shrink-0 font-mono text-xs text-ink-500">
                  #{event.seq}
                </span>
                <span
                  className={`w-32 shrink-0 rounded border px-2 py-0.5 text-center font-mono text-[11px] font-medium ${EVENT_TYPE_STYLES[event.type]}`}
                >
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-400">
                  {summarizeEvent(event)}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-ink-500 sm:block">
                  {new Date(event.createdAt).toLocaleTimeString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function summarizeEvent(event: TaskEvent): string {
  switch (event.type) {
    case "message.delta":
      return `增量输出：${event.payload.delta}`;
    case "message.assistant":
      return event.payload.toolCalls.length > 0
        ? `助手消息：请求 ${event.payload.toolCalls.length} 个工具调用`
        : `助手消息：${event.payload.content}`;
    case "tool.started":
      return `启动工具：${event.payload.toolCall.toolName}`;
    case "tool.finished":
      return `${event.payload.toolCall.toolName} ${TOOL_STATE_LABELS[event.payload.toolCall.state] ?? event.payload.toolCall.state}`;
    case "approval.requested":
      return `等待审批：${event.payload.approval.toolName}`;
    case "approval.resolved":
      return `${event.payload.approval.toolName} ${APPROVAL_LABELS[event.payload.approval.status] ?? event.payload.approval.status}`;
    case "task.status_changed":
      return `${STATUS_LABELS[event.payload.from] ?? event.payload.from} -> ${STATUS_LABELS[event.payload.to] ?? event.payload.to}`;
    case "task.completed":
      return "任务完成";
    case "artifact.created":
      return `生成产出物：${event.payload.artifact.name}`;
    case "task.failed":
      return `失败：${event.payload.error}`;
    case "task.created":
      return `创建任务：${event.payload.task.goal}`;
    case "task.plan_updated":
      return `更新计划：${event.payload.plan.length} 步`;
  }
}

import { useVirtualizer } from "@tanstack/react-virtual";
import type { TaskEvent } from "@agent-console/contracts";
import { ListOrdered } from "lucide-react";
import { useEffect, useRef } from "react";
import { EmptyState } from "../../components/ui/EmptyState";

const EVENT_ROW_HEIGHT = 40;
const BOTTOM_SCROLL_THRESHOLD = 80;

export const EVENT_TYPE_STYLES: Record<TaskEvent["type"], string> = {
  "task.created": "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  "task.plan_updated": "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
  "task.status_changed": "border-signal-500/20 bg-signal-500/10 text-signal-300",
  "tool.started": "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  "tool.finished": "border-mint-500/20 bg-mint-500/10 text-mint-300",
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
  rejected: "已拒绝",
  succeeded: "成功",
  failed: "失败",
};

export function EventLog({ events }: { events: TaskEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => EVENT_ROW_HEIGHT,
    getItemKey: (index) => events[index].id,
    overscan: 12,
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || events.length === 0) {
      return;
    }
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom <= BOTTOM_SCROLL_THRESHOLD) {
      element.scrollTop = element.scrollHeight;
    }
  }, [events.length]);

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

      <div ref={scrollRef} className="max-h-[420px] overflow-auto">
        {events.length === 0 ? (
          <EmptyState
            compact
            icon={ListOrdered}
            title="暂无事件"
            description="任务运行后会在这里展示实时事件"
          />
        ) : (
          <ul
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = events[virtualRow.index];
              return (
                <li
                  key={event.id}
                  aria-posinset={virtualRow.index + 1}
                  aria-setsize={events.length}
                  className="absolute flex w-full items-center gap-3 border-b border-ink-700/25 px-4 py-2.5 transition hover:bg-ink-700/15"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className="w-9 shrink-0 font-mono text-xs text-ink-500">
                    #{event.seq}
                  </span>
                  <span
                    className={`w-24 shrink-0 rounded border px-2 py-0.5 text-center font-mono text-[11px] font-medium sm:w-32 ${EVENT_TYPE_STYLES[event.type]}`}
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
              );
            })}
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

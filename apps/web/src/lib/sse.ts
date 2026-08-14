import type { TaskEvent } from "@agent-console/contracts";

const TASK_EVENT_TYPES = [
  "task.created",
  "task.plan_updated",
  "task.status_changed",
  "tool.started",
  "tool.finished",
  "message.delta",
  "message.assistant",
  "task.completed",
  "task.failed",
] as const;

export function openTaskStream(
  taskId: string,
  onEvent: (event: TaskEvent) => void,
): EventSource {
  const source = new EventSource(`/api/tasks/${taskId}/stream`);
  const handler = (message: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(message.data) as TaskEvent);
    } catch {
      // 忽略格式异常的帧
    }
  };
  for (const type of TASK_EVENT_TYPES) {
    source.addEventListener(type, handler);
  }
  return source;
}

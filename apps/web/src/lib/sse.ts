import { TASK_EVENT_TYPES, type TaskEvent } from "@agent-console/contracts";

export function openTaskStream(
  taskId: string,
  onEvent: (event: TaskEvent) => void,
  onEnd?: () => void,
): EventSource {
  const source = new EventSource(`/api/tasks/${taskId}/stream`);
  let ended = false;
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
  source.addEventListener("stream.end", () => {
    if (ended) {
      return;
    }
    ended = true;
    source.close();
    onEnd?.();
  });
  return source;
}

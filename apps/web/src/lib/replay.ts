import type { TaskEvent, TaskStatus } from "@agent-console/contracts";

export function deriveReplayStatus(
  events: TaskEvent[],
  initial: TaskStatus = "queued",
): TaskStatus {
  let status = initial;
  for (const event of events) {
    if (event.type === "task.status_changed") {
      status = event.payload.to;
    } else if (event.type === "task.completed") {
      status = "completed";
    } else if (event.type === "task.failed") {
      status = "failed";
    }
  }
  return status;
}

import type { Task, TaskEvent, TaskStatus } from "@agent-console/contracts";
import {
  eventRepository,
  taskRepository,
  withTransaction,
} from "../db/repositories";
import { createEvent, publishEvent } from "./events";

const INTERRUPTED_STATUSES: TaskStatus[] = ["planning", "running", "paused"];
const RECOVERY_ERROR = "服务重启，任务已中断，请重新执行";
const RECOVERY_TOOL_ERROR = "服务重启，工具执行已中断";

type ToolStartedEvent = Extract<TaskEvent, { type: "tool.started" }>;
type ToolFinishedEvent = Extract<TaskEvent, { type: "tool.finished" }>;

/**
 * 服务启动时恢复未完成任务：
 * - planning/running 标记为 failed，并补全中断的工具事件；
 * - paused 保持暂停，等待用户手动续跑，中断的工具同样补全。
 * 所有写库操作在单个事务内完成，重复启动不会重复写入恢复事件。
 */
export async function recoverInterruptedTasks(): Promise<number> {
  const interrupted = (await taskRepository.list())
    .filter((task) => INTERRUPTED_STATUSES.includes(task.status));
  let recovered = 0;

  for (const task of interrupted) {
    if (await recoverTask(task)) {
      recovered += 1;
    }
  }
  return recovered;
}

async function recoverTask(task: Task): Promise<boolean> {
  const events = await eventRepository.listByTask(task.id);
  const interruptedToolEvents = findInterruptedTools(events);
  const failed = task.status !== "paused";

  if (interruptedToolEvents.length === 0 && !failed) {
    return false;
  }

  const now = new Date().toISOString();
  let finishedToolCount = 0;
  const created: TaskEvent[] = await withTransaction(async () => {
    const nextEvents: TaskEvent[] = [];

    const finishInterruptedTool = async (
      startedEvent: ToolStartedEvent,
      error: string,
    ) => {
      finishedToolCount += 1;
      nextEvents.push(
        await createEvent(task.id, "tool.finished", {
          toolCall: {
            ...startedEvent.payload.toolCall,
            state: "failed",
            error,
            output: null,
            finishedAt: now,
            durationMs: null,
          },
        }),
      );
    };

    for (const startedEvent of interruptedToolEvents) {
      await finishInterruptedTool(startedEvent, RECOVERY_TOOL_ERROR);
    }

    if (finishedToolCount > 0) {
      await taskRepository.update(task.id, {
        currentStep: task.currentStep + finishedToolCount,
      });
    }

    if (failed) {
      await taskRepository.update(task.id, {
        status: "failed",
        error: RECOVERY_ERROR,
        finishedAt: now,
      });
      nextEvents.push(
        await createEvent(task.id, "task.status_changed", {
          from: task.status,
          to: "failed",
        }),
        await createEvent(task.id, "task.failed", { error: RECOVERY_ERROR }),
      );
    }

    return nextEvents;
  });

  for (const event of created) {
    publishEvent(event);
  }
  return true;
}

function findInterruptedTools(events: TaskEvent[]): ToolStartedEvent[] {
  const finished = new Set(
    events
      .filter(isToolFinishedEvent)
      .map((event) => event.payload.toolCall.id),
  );
  return events
    .filter(isToolStartedEvent)
    .filter((event) => !finished.has(event.payload.toolCall.id));
}

function isToolStartedEvent(
  event: TaskEvent,
): event is ToolStartedEvent {
  return event.type === "tool.started";
}

function isToolFinishedEvent(
  event: TaskEvent,
): event is ToolFinishedEvent {
  return event.type === "tool.finished";
}

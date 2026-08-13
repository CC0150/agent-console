import { Router } from "express";
import type { ServerResponse } from "node:http";
import type { TaskEvent, TaskStatus } from "@agent-console/contracts";
import { eventRepository, taskRepository } from "../db/repositories";
import { AppError } from "../errors";
import { eventBus } from "../services/event-bus";

const TERMINAL_STATUSES: TaskStatus[] = ["completed", "failed", "cancelled"];

function writeEvent(res: ServerResponse, event: TaskEvent): void {
  res.write(`id: ${event.seq}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export const streamRouter = Router({ mergeParams: true });

streamRouter.get("/", (req, res) => {
  const taskId = (req.params as Record<string, string>).id;
  const task = taskRepository.findById(taskId);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");

  const lastEventId = Number(req.headers["last-event-id"] ?? 0) || 0;
  const history = eventRepository.listByTask(taskId).filter((event) => event.seq > lastEventId);
  for (const event of history) {
    writeEvent(res, event);
  }

  if (TERMINAL_STATUSES.includes(task.status)) {
    res.write('event: stream.end\ndata: {}\n\n');
    res.end();
    return;
  }

  const unsubscribe = eventBus.subscribe(task.id, (event) => {
    writeEvent(res, event);
    const terminal =
      event.type === "task.completed" ||
      event.type === "task.failed" ||
      (event.type === "task.status_changed" &&
        event.payload.to === "cancelled");
    if (terminal) {
      res.write('event: stream.end\ndata: {}\n\n');
      res.end();
      unsubscribe();
    }
  });
  req.on("close", unsubscribe);
});

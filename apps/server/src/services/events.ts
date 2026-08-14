import { randomUUID } from "node:crypto";
import type { TaskEvent } from "@agent-console/contracts";
import { eventRepository } from "../db/repositories";
import { eventBus } from "./event-bus";

const eventQueues = new Map<string, Promise<unknown>>();

export function createEvent(
  taskId: string,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): Promise<TaskEvent> {
  return enqueue(taskId, async () => {
    const event = {
      id: randomUUID(),
      taskId,
      seq: await eventRepository.nextSeq(taskId),
      createdAt: new Date().toISOString(),
      type,
      payload,
    } as TaskEvent;
    await eventRepository.insert(event);
    return event;
  });
}

export function publishEvent(event: TaskEvent): void {
  eventBus.publish(event);
}

export async function emitEvent(
  taskId: string,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): Promise<TaskEvent> {
  const event = await createEvent(taskId, type, payload);
  publishEvent(event);
  return event;
}

function enqueue<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
  const previous = eventQueues.get(taskId) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  eventQueues.set(taskId, tail);
  void tail.finally(() => {
    if (eventQueues.get(taskId) === tail) {
      eventQueues.delete(taskId);
    }
  });
  return run;
}

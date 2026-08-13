import { randomUUID } from "node:crypto";
import type { TaskEvent } from "@agent-console/contracts";
import { eventRepository } from "../db/repositories";
import { eventBus } from "./event-bus";

export function createEvent(
  taskId: string,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): TaskEvent {
  const event = {
    id: randomUUID(),
    taskId,
    seq: eventRepository.nextSeq(taskId),
    createdAt: new Date().toISOString(),
    type,
    payload,
  } as TaskEvent;
  eventRepository.insert(event);
  return event;
}

export function publishEvent(event: TaskEvent): void {
  eventBus.publish(event);
}

export function emitEvent(
  taskId: string,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): TaskEvent {
  const event = createEvent(taskId, type, payload);
  publishEvent(event);
  return event;
}

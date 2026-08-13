import type { TaskEvent } from "@agent-console/contracts";
import { describe, expect, it } from "vitest";
import { deriveReplayStatus } from "./replay";

const base = {
  id: "event-1",
  taskId: "task-1",
  createdAt: "2026-08-13T00:00:00.000Z",
};

function makeEvent(seq: number, type: TaskEvent["type"]): TaskEvent {
  if (type === "task.status_changed") {
    return {
      ...base,
      id: `event-${seq}`,
      seq,
      type,
      payload: { from: "queued", to: "running" },
    } as TaskEvent;
  }
  if (type === "task.completed") {
    return {
      ...base,
      id: `event-${seq}`,
      seq,
      type,
      payload: { summary: "done" },
    } as TaskEvent;
  }
  if (type === "task.failed") {
    return {
      ...base,
      id: `event-${seq}`,
      seq,
      type,
      payload: { error: "boom" },
    } as TaskEvent;
  }
  return {
    ...base,
    id: `event-${seq}`,
    seq,
    type,
    payload: { delta: "" },
  } as TaskEvent;
}

describe("deriveReplayStatus", () => {
  it("starts from queued before any event", () => {
    expect(deriveReplayStatus([])).toBe("queued");
  });

  it("follows status changes", () => {
    expect(
      deriveReplayStatus([makeEvent(1, "task.status_changed")]),
    ).toBe("running");
  });

  it("treats completed and failed events as terminal states", () => {
    expect(deriveReplayStatus([makeEvent(1, "task.completed")])).toBe("completed");
    expect(deriveReplayStatus([makeEvent(1, "task.failed")])).toBe("failed");
  });
});

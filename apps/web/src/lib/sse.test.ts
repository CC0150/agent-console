import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  TASK_EVENT_TYPES,
  type TaskEvent,
} from "@agent-console/contracts";
import { openTaskStream } from "./sse";

class FakeEventSource {
  readonly url: string;
  readonly listeners = new Map<
    string,
    Set<(message: MessageEvent<string>) => void>
  >();
  closed = false;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(
    type: string,
    listener: (message: MessageEvent<string>) => void,
  ): void {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(listener);
    this.listeners.set(type, handlers);
  }

  dispatch(type: string, data: string): void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }
    const message = { data } as MessageEvent<string>;
    for (const handler of handlers) {
      handler(message);
    }
  }

  close(): void {
    this.closed = true;
  }
}

function taskEvent(
  seq: number,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): TaskEvent {
  return {
    id: `event-${seq}`,
    taskId: "task-1",
    seq,
    createdAt: "2026-08-14T00:00:00.000Z",
    type,
    payload,
  } as TaskEvent;
}

describe("sse", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("注册契约中的全部任务事件类型，包括 artifact.created", () => {
    const source = openTaskStream(
      "task-1",
      vi.fn(),
    ) as unknown as FakeEventSource;

    expect(source.url).toBe("/api/tasks/task-1/stream");
    for (const type of TASK_EVENT_TYPES) {
      expect(source.listeners.has(type)).toBe(true);
    }
  });

  it("stream.end 后关闭连接，且只触发一次 onEnd", () => {
    const onEvent = vi.fn();
    const onEnd = vi.fn();
    const source = openTaskStream(
      "task-1",
      onEvent,
      onEnd,
    ) as unknown as FakeEventSource;
    const event = taskEvent(1, "task.status_changed", {
      from: "queued",
      to: "running",
    });

    source.dispatch("task.status_changed", JSON.stringify(event));
    source.dispatch("stream.end", "{}");
    source.dispatch("stream.end", "{}");

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(source.closed).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

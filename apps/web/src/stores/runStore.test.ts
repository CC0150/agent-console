import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { TaskEvent } from "@agent-console/contracts";
import { openTaskStream } from "../lib/sse";
import { useRunStore } from "./runStore";

vi.mock("../lib/sse", () => ({
  openTaskStream: vi.fn(),
}));

function fakeSource(): EventSource {
  return {
    close: vi.fn(),
    onopen: null,
    onerror: null,
  } as unknown as EventSource;
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

describe("runStore", () => {
  beforeEach(() => {
    useRunStore.getState().disconnect();
    vi.mocked(openTaskStream).mockReset();
    useRunStore.setState({ events: [], connection: "idle" });
  });

  it("stream.end 后关闭连接并进入 ended 状态", () => {
    const source = fakeSource();
    vi.mocked(openTaskStream).mockReturnValue(source);

    useRunStore.getState().connect("task-1");
    const [taskId, , onEnd] = vi.mocked(openTaskStream).mock.calls[0];

    expect(taskId).toBe("task-1");
    expect(useRunStore.getState().connection).toBe("connecting");

    onEnd?.();

    expect(source.close).toHaveBeenCalledTimes(1);
    expect(useRunStore.getState().connection).toBe("ended");
  });

  it("实时事件按 id 去重并按 seq 排序", () => {
    vi.mocked(openTaskStream).mockReturnValue(fakeSource());
    useRunStore.getState().connect("task-1");
    const onEvent = vi.mocked(openTaskStream).mock.calls[0][1];
    const first = taskEvent(2, "message.delta", { delta: "好" });
    const second = taskEvent(1, "task.status_changed", {
      from: "queued",
      to: "planning",
    });

    onEvent(first);
    onEvent(second);
    onEvent(first);

    expect(useRunStore.getState().events).toEqual([second, first]);
  });

  it("disconnect 关闭当前连接并回到 idle", () => {
    const source = fakeSource();
    vi.mocked(openTaskStream).mockReturnValue(source);

    useRunStore.getState().connect("task-1");
    useRunStore.getState().disconnect();

    expect(source.close).toHaveBeenCalledTimes(1);
    expect(useRunStore.getState().connection).toBe("idle");
  });
});

import { describe, expect, it } from "vitest";
import type { TaskEvent } from "@agent-console/contracts";
import {
  extractPlan,
  extractStreamText,
  mergeEvents,
} from "./taskEvents";

function event(seq: number, type: TaskEvent["type"], payload: TaskEvent["payload"]): TaskEvent {
  return {
    id: `event-${seq}`,
    taskId: "task-1",
    seq,
    createdAt: "2026-08-12T00:00:00.000Z",
    type,
    payload,
  } as TaskEvent;
}

describe("taskEvents", () => {
  it("合并历史事件和实时事件并按 seq 去重排序", () => {
    const status = event(1, "task.status_changed", { from: "queued", to: "planning" });
    const first = event(2, "message.delta", { delta: "你" });
    const second = event(3, "message.delta", { delta: "好" });

    const merged = mergeEvents([status, second], [first, second]);

    expect(merged.map((item) => item.seq)).toEqual([1, 2, 3]);
  });

  it("从事件流中提取流式输出", () => {
    const events = [
      event(1, "message.delta", { delta: "你" }),
      event(2, "message.delta", { delta: "好" }),
    ];

    expect(extractStreamText(events)).toBe("你好");
  });

  it("从事件流中提取最新执行计划", () => {
    const planEvent = event(1, "task.plan_updated", {
      plan: [
        {
          id: "step-1",
          title: "检索杭州前端岗位",
          toolName: "write_report",
          input: { city: "杭州", keywords: ["前端"], limit: 5 },
        },
      ],
    });

    expect(extractPlan([planEvent])).toHaveLength(1);
    expect(extractPlan([])).toEqual([]);
  });
});

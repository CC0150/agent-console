import { describe, expect, it } from "vitest";
import type { TaskEvent } from "@agent-console/contracts";
import {
  extractPlan,
  extractStreamText,
  extractToolCalls,
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
          toolName: "search_jobs",
          input: { city: "杭州", keywords: ["前端"], limit: 5 },
        },
      ],
    });

    expect(extractPlan([planEvent])).toHaveLength(1);
    expect(extractPlan([])).toEqual([]);
  });

  it("根据审批事件覆盖工具调用的待审批状态", () => {
    const started = event(1, "tool.started", {
      toolCall: {
        id: "call-1",
        taskId: "task-1",
        toolName: "search_jobs",
        input: { city: "杭州" },
        state: "running",
        output: null,
        error: null,
        startedAt: "2026-08-12T00:00:00.000Z",
        finishedAt: null,
        durationMs: null,
      },
    });
    const requested = event(2, "approval.requested", {
      approval: {
        id: "approval-1",
        taskId: "task-1",
        toolCallId: "call-1",
        toolName: "search_jobs",
        input: { city: "杭州" },
        reason: "需要人工确认",
        status: "pending",
        requestedAt: "2026-08-12T00:00:00.000Z",
        resolvedAt: null,
      },
    });

    expect(extractToolCalls([started, requested])[0].state).toBe("requires_approval");
  });

  it("审批拒绝后工具调用进入已拒绝状态", () => {
    const started = event(1, "tool.started", {
      toolCall: {
        id: "call-2",
        taskId: "task-1",
        toolName: "search_jobs",
        input: { city: "杭州" },
        state: "running",
        output: null,
        error: null,
        startedAt: "2026-08-12T00:00:00.000Z",
        finishedAt: null,
        durationMs: null,
      },
    });
    const requested = event(2, "approval.requested", {
      approval: {
        id: "approval-2",
        taskId: "task-1",
        toolCallId: "call-2",
        toolName: "search_jobs",
        input: { city: "杭州" },
        reason: "需要人工确认",
        status: "pending",
        requestedAt: "2026-08-12T00:00:00.000Z",
        resolvedAt: null,
      },
    });
    const resolved = event(3, "approval.resolved", {
      approval: {
        id: "approval-2",
        taskId: "task-1",
        toolCallId: "call-2",
        toolName: "search_jobs",
        input: { city: "杭州" },
        reason: "需要人工确认",
        status: "rejected",
        requestedAt: "2026-08-12T00:00:00.000Z",
        resolvedAt: "2026-08-12T00:00:01.000Z",
      },
    });

    expect(extractToolCalls([started, requested, resolved])[0].state).toBe("rejected");
  });
});

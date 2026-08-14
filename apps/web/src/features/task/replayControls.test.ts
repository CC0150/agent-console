import type {
  PlanStep,
  Task,
  TaskEvent,
  ToolCall,
} from "@agent-console/contracts";
import { describe, expect, it } from "vitest";
import {
  buildReplayReport,
  filterReplayEvents,
  findEventIndexBySeq,
} from "./replayControls";

function event(
  seq: number,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): TaskEvent {
  return {
    id: `event-${seq}`,
    taskId: "task-1",
    seq,
    createdAt: "2026-08-13T00:00:00.000Z",
    type,
    payload,
  } as TaskEvent;
}

function fakeTask(goal: string): Task {
  return {
    id: "task-1",
    goal,
    workspaceId: "ws-1",
    status: "completed",
    model: "mock",
    currentStep: 1,
    totalSteps: 1,
    error: null,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:01.000Z",
    startedAt: "2026-08-13T00:00:00.000Z",
    finishedAt: "2026-08-13T00:00:01.000Z",
  };
}

function fakeToolCall(id: string): ToolCall {
  return {
    id,
    taskId: "task-1",
    toolName: "write_report",
    input: { title: "岗位调研报告" },
    state: "succeeded",
    output: { count: 3 },
    error: null,
    startedAt: "2026-08-13T00:00:00.100Z",
    finishedAt: "2026-08-13T00:00:01.300Z",
    durationMs: 1200,
  };
}

describe("replayControls", () => {
  it("按事件类型筛选回放时间线", () => {
    const events = [
      event(1, "message.delta", { delta: "你好" }),
      event(2, "tool.started", { toolCall: fakeToolCall("call-1") }),
      event(3, "task.status_changed", { from: "queued", to: "planning" }),
    ];

    const filtered = filterReplayEvents(events, {
      type: "tool.started",
      query: "",
    });

    expect(filtered.map((item) => item.seq)).toEqual([2]);
  });

  it("按关键词搜索事件内容", () => {
    const events = [
      event(1, "task.created", { task: fakeTask("搜索杭州前端岗位") }),
      event(2, "message.delta", { delta: "杭州岗位要求如下" }),
      event(3, "task.status_changed", { from: "queued", to: "planning" }),
    ];

    const filtered = filterReplayEvents(events, {
      type: "all",
      query: "杭州",
    });

    expect(filtered.map((item) => item.seq)).toEqual([1, 2]);
  });

  it("类型和关键词可以组合筛选", () => {
    const events = [
      event(1, "task.created", { task: fakeTask("搜索杭州前端岗位") }),
      event(2, "message.delta", { delta: "杭州岗位要求如下" }),
      event(3, "message.delta", { delta: "北京岗位要求如下" }),
    ];

    const filtered = filterReplayEvents(events, {
      type: "message.delta",
      query: "杭州",
    });

    expect(filtered.map((item) => item.seq)).toEqual([2]);
  });

  it("通过事件 seq 找到回放时间线中的原始索引", () => {
    const events = [
      event(1, "task.created", { task: fakeTask("搜索杭州前端岗位") }),
      event(2, "message.delta", { delta: "杭州岗位要求如下" }),
      event(3, "task.completed", { summary: "完成" }),
    ];

    expect(findEventIndexBySeq(events, 3)).toBe(2);
    expect(findEventIndexBySeq(events, 99)).toBeNull();
  });

  it("生成包含任务、计划和事件时间线的 Markdown 报告", () => {
    const events = [
      event(1, "task.created", { task: fakeTask("搜索杭州前端岗位") }),
      event(2, "tool.started", { toolCall: fakeToolCall("call-1") }),
      event(3, "task.completed", { summary: "完成" }),
    ];
    const plan: PlanStep[] = [
      {
        id: "step-1",
        title: "检索岗位",
        toolName: "write_report",
        input: { title: "岗位调研报告" },
      },
    ];

    const report = buildReplayReport({
      task: fakeTask("搜索杭州前端岗位"),
      workspaceName: "默认工作区",
      events,
      plan,
      toolCalls: [fakeToolCall("call-1")],
      streamText: "杭州岗位要求如下",
    });

    expect(report).toContain("# Agent Console 回放报告");
    expect(report).toContain("搜索杭州前端岗位");
    expect(report).toContain("默认工作区");
    expect(report).toContain("检索岗位");
    expect(report).toContain("write_report");
    expect(report).toContain("杭州岗位要求如下");
    expect(report).toContain("`#3`");
  });
});

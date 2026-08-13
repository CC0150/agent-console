import type {
  ApprovalRequest,
  TaskEvent,
  ToolCall,
} from "@agent-console/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationView } from "./ConversationView";
import { buildConversation, toDisplayToolCall } from "./conversation";

const CREATED_AT = "2026-08-13T00:00:00.000Z";
const GOAL = "查找杭州岗位";

function event(
  seq: number,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): TaskEvent {
  return {
    id: `event-${seq}`,
    taskId: "task-1",
    seq,
    createdAt: CREATED_AT,
    type,
    payload,
  } as TaskEvent;
}

function assistantToolCall(id: string) {
  return { id, name: "search_jobs", arguments: { city: "杭州" } };
}

function toolCall(id: string, options: Partial<ToolCall> = {}): ToolCall {
  return {
    id,
    taskId: "task-1",
    toolName: "search_jobs",
    input: { city: "杭州" },
    state: "succeeded",
    output: "职位列表",
    error: null,
    startedAt: CREATED_AT,
    finishedAt: CREATED_AT,
    durationMs: 100,
    ...options,
  };
}

function approval(
  id: string,
  toolCallId: string,
  status: ApprovalRequest["status"],
  reason: string,
): ApprovalRequest {
  return {
    id,
    taskId: "task-1",
    toolCallId,
    toolName: "search_jobs",
    input: { city: "杭州" },
    reason,
    status,
    requestedAt: CREATED_AT,
    resolvedAt: CREATED_AT,
  };
}

describe("buildConversation", () => {
  it("任务目标作为首条用户消息", () => {
    const conversation = buildConversation([], GOAL, CREATED_AT);

    expect(conversation).toHaveLength(1);
    expect(conversation[0]).toMatchObject({
      kind: "user",
      content: GOAL,
      seq: 0,
    });
  });

  it("通过 assistantCallId 将助手请求与工具结果配对", () => {
    const conversation = buildConversation(
      [
        event(1, "message.assistant", {
          content: "开始查询",
          toolCalls: [assistantToolCall("assistant-1")],
        }),
        event(2, "tool.finished", {
          toolCall: toolCall("exec-1", {
            assistantCallId: "assistant-1",
            output: "结果 A",
          }),
        }),
      ],
      GOAL,
    );

    const assistant = conversation.find((item) => item.kind === "assistant");
    expect(assistant?.toolCalls?.[0].execution?.id).toBe("exec-1");
    expect(conversation.filter((item) => item.kind === "tool")).toHaveLength(0);
  });

  it("旧事件没有 assistantCallId 时按请求顺序兜底配对", () => {
    const conversation = buildConversation(
      [
        event(1, "message.assistant", {
          content: "并行查询",
          toolCalls: [
            assistantToolCall("assistant-1"),
            assistantToolCall("assistant-2"),
          ],
        }),
        event(2, "tool.finished", {
          toolCall: toolCall("exec-1", { output: "结果 1" }),
        }),
        event(3, "tool.finished", {
          toolCall: toolCall("exec-2", { output: "结果 2" }),
        }),
      ],
      GOAL,
    );

    const assistant = conversation.find((item) => item.kind === "assistant");
    expect(assistant?.toolCalls?.[0].execution?.id).toBe("exec-1");
    expect(assistant?.toolCalls?.[1].execution?.id).toBe("exec-2");
  });

  it("未结束的 delta 合并为流式助手消息", () => {
    const conversation = buildConversation(
      [
        event(1, "message.delta", { delta: "正在" }),
        event(2, "message.delta", { delta: "查询职位" }),
      ],
      GOAL,
    );

    const streaming = conversation.find((item) => item.kind === "assistant");
    expect(streaming).toMatchObject({
      streaming: true,
      content: "正在查询职位",
    });
  });

  it("历史任务已结束时，未配对的 delta 不再显示为流式中", () => {
    const conversation = buildConversation(
      [
        event(1, "message.delta", { delta: "正在查询职位" }),
        event(2, "task.completed", { summary: "查询完成" }),
      ],
      GOAL,
    );

    const assistant = conversation.find((item) => item.kind === "assistant");
    expect(assistant).toMatchObject({
      streaming: false,
      content: "正在查询职位",
    });
  });

  it("传入终态状态时，未配对的 delta 不再显示为流式中", () => {
    const conversation = buildConversation(
      [event(1, "message.delta", { delta: "正在查询职位" })],
      GOAL,
      CREATED_AT,
      "completed",
    );

    const assistant = conversation.find((item) => item.kind === "assistant");
    expect(assistant?.streaming).toBe(false);
  });

  it("审批拒绝后工具调用状态为已拒绝并带回原因", () => {
    const display = toDisplayToolCall({
      request: assistantToolCall("assistant-1"),
      execution: toolCall("exec-1", {
        assistantCallId: "assistant-1",
        state: "running",
        output: null,
        startedAt: CREATED_AT,
        finishedAt: null,
        durationMs: null,
      }),
      approval: approval("approval-1", "exec-1", "rejected", "该操作不允许"),
    });

    expect(display.state).toBe("rejected");
    expect(display.error).toBe("该操作不允许");
  });
});

describe("ConversationView", () => {
  it("审批拒绝后工具调用显示为已拒绝", () => {
    const html = renderToStaticMarkup(
      <ConversationView
        events={[
          event(1, "message.assistant", {
            content: "请求审批",
            toolCalls: [assistantToolCall("assistant-1")],
          }),
          event(2, "tool.started", {
            toolCall: toolCall("exec-1", {
              assistantCallId: "assistant-1",
              state: "running",
              output: null,
              startedAt: CREATED_AT,
              finishedAt: null,
              durationMs: null,
            }),
          }),
          event(3, "approval.resolved", {
            approval: approval("approval-1", "exec-1", "rejected", "该操作不允许"),
          }),
        ]}
        goal={GOAL}
        createdAt={CREATED_AT}
      />,
    );

    expect(html).toContain("已拒绝");
  });
});

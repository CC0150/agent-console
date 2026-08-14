import type {
  TaskEvent,
  ToolCall,
} from "@agent-console/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationView } from "./ConversationView";
import { buildConversation } from "./conversation";

const CREATED_AT = "2026-08-13T00:00:00.000Z";
const GOAL = "生成前端岗位调研报告";

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
  return { id, name: "write_report", arguments: { title: "岗位调研报告" } };
}

function toolCall(id: string, options: Partial<ToolCall> = {}): ToolCall {
  return {
    id,
    taskId: "task-1",
    toolName: "write_report",
    input: { title: "岗位调研报告" },
    state: "succeeded",
    output: "报告已生成",
    error: null,
    startedAt: CREATED_AT,
    finishedAt: CREATED_AT,
    durationMs: 100,
    ...options,
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

});

describe("ConversationView", () => {
  it("渲染助手请求与工具执行结果", () => {
    const html = renderToStaticMarkup(
      <ConversationView
        events={[
          event(1, "message.assistant", {
            content: "开始生成报告",
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
          event(3, "tool.finished", {
            toolCall: toolCall("exec-1", {
              assistantCallId: "assistant-1",
              output: "报告已生成",
            }),
          }),
        ]}
        goal={GOAL}
        createdAt={CREATED_AT}
      />,
    );

    expect(html).toContain("write_report");
    expect(html).toContain("成功");
  });
});

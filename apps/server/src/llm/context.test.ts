import { describe, expect, it } from "vitest";
import { trimMessages } from "./context";
import type { ChatMessage } from "./provider";

function assistant(content: string, callId: string): ChatMessage {
  return {
    role: "assistant",
    content,
    toolCalls: [
      { id: callId, name: "write_report", arguments: { title: "岗位调研报告" } },
    ],
  };
}

function tool(content: string, callId: string): ChatMessage {
  return {
    role: "tool",
    content,
    toolCallId: callId,
  };
}

const messages: ChatMessage[] = [
  { role: "system", content: "系统提示" },
  { role: "user", content: "生成前端岗位调研报告" },
  assistant("第一轮", "call-1"),
  tool("结果一", "call-1"),
  assistant("第二轮", "call-2"),
  tool("结果二", "call-2"),
  assistant("第三轮", "call-3"),
  tool("结果三", "call-3"),
];

describe("trimMessages", () => {
  it("预算充足时原样返回", () => {
    expect(
      trimMessages(messages, {
        maxContextTokens: 10_000,
        maxHistoryMessages: 100,
      }),
    ).toEqual(messages);
  });

  it("按最大消息条数裁剪最早轮次", () => {
    const trimmed = trimMessages(messages, {
      maxContextTokens: 10_000,
      maxHistoryMessages: 4,
    });

    expect(trimmed.map((message) => message.content)).toEqual([
      "系统提示",
      "生成前端岗位调研报告",
      "第二轮",
      "结果二",
      "第三轮",
      "结果三",
    ]);
  });

  it("按 token 预算保留最新轮次并保持助手/工具配对", () => {
    const trimmed = trimMessages(messages, {
      maxContextTokens: 0,
      maxHistoryMessages: 100,
    });

    expect(trimmed.map((message) => message.content)).toEqual([
      "系统提示",
      "生成前端岗位调研报告",
      "第三轮",
      "结果三",
    ]);
  });
});

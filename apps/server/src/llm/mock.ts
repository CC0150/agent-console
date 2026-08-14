import { randomUUID } from "node:crypto";
import type { Usage } from "@agent-console/contracts";
import type { AgentChatOptions, AgentChatResult, LLMProvider } from "./provider";

interface WriteReportOutput {
  ok: boolean;
  artifact: {
    name: string;
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async chat({ messages, onDelta }: AgentChatOptions): Promise<AgentChatResult> {
    await delay(400);
    const hasToolResult = messages.some((message) => message.role === "tool");
    const goal = messages.find((message) => message.role === "user")?.content ?? "";
    if (!hasToolResult) {
      const content = "我将把任务目标整理成 Markdown 报告并保存为任务产出物。";
      onDelta?.(content);
      return {
        content,
        toolCalls: [
          {
            id: `call_${randomUUID()}`,
            name: "write_report",
            arguments: buildReportArguments(goal),
          },
        ],
        finishReason: "tool_calls",
        usage: estimateUsage(messages, content),
      };
    }

    const latestToolOutput = getLatestToolOutput(messages);
    if (isFailedOutput(latestToolOutput)) {
      const failedSummary = `报告生成失败：${String(
        (latestToolOutput as { error?: unknown }).error ?? "未知错误",
      )}，请检查产出物工具配置后重试。`;
      for (const chunk of splitIntoChunks(failedSummary, 24)) {
        onDelta?.(chunk);
      }
      return {
        content: failedSummary,
        toolCalls: [],
        finishReason: "stop",
        usage: estimateUsage(messages, failedSummary),
      };
    }

    if (!hasArtifact(latestToolOutput)) {
      const content = "我将重新生成 Markdown 报告并保存为任务产出物。";
      onDelta?.(content);
      return {
        content,
        toolCalls: [
          {
            id: `call_${randomUUID()}`,
            name: "write_report",
            arguments: buildReportArguments(goal),
          },
        ],
        finishReason: "tool_calls",
        usage: estimateUsage(messages, content),
      };
    }

    const summary = [
      `已基于「${goal}」完成任务调研，报告已保存为「${latestToolOutput.artifact.name}」。`,
      "",
      "可在任务详情页预览或下载该报告。",
    ].join("\n");
    for (const chunk of splitIntoChunks(summary, 24)) {
      onDelta?.(chunk);
    }
    return {
      content: summary,
      toolCalls: [],
      finishReason: "stop",
      usage: estimateUsage(messages, summary),
    };
  }
}

function estimateUsage(messages: AgentChatOptions["messages"], completion: string): Usage {
  const prompt = messages
    .map((message) => {
      if (message.role === "assistant") {
        return `${message.content} ${JSON.stringify(message.toolCalls ?? [])}`;
      }
      return message.content;
    })
    .join("\n");
  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(completion);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2));
}

function getLatestToolOutput(
  messages: Array<{ role: string; content: string }>,
): unknown {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "tool") {
      continue;
    }
    try {
      return JSON.parse(message.content) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

function hasArtifact(output: unknown): output is WriteReportOutput {
  return (
    typeof output === "object" &&
    output !== null &&
    "artifact" in output &&
    typeof (output as { artifact?: unknown }).artifact === "object"
  );
}

function isFailedOutput(output: unknown): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as { ok?: unknown }).ok === false
  );
}

function buildReportArguments(goal: string): Record<string, unknown> {
  return {
    title: "岗位调研报告",
    filename: "岗位调研报告.md",
    content: `# 岗位调研报告

> 目标：${goal}

本报告由 Agent 根据任务目标自动生成，记录了调研过程、关键信息整理与结论建议。

## 调研结论

当前任务已按目标完成信息整理，报告作为任务产出物保存，可在任务详情页预览或下载。`,
  };
}

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

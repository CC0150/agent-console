import { randomUUID } from "node:crypto";
import type { Usage } from "@agent-console/contracts";
import type { AgentChatOptions, AgentChatResult, LLMProvider } from "./provider";

interface JobRow {
  title: string;
  requirements: string;
  salary: string | null;
}

interface SearchOutput {
  total: number;
  jobs: JobRow[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async chat({ messages, onDelta }: AgentChatOptions): Promise<AgentChatResult> {
    await delay(400);
    const hasToolResult = messages.some((message) => message.role === "tool");
    if (!hasToolResult) {
      const content = "我将先检索杭州前端岗位。";
      onDelta?.(content);
      return {
        content,
        toolCalls: [
          {
            id: `call_${randomUUID()}`,
            name: "search_jobs",
            arguments: { city: "杭州", keywords: ["前端"], limit: 5 },
          },
        ],
        finishReason: "tool_calls",
        usage: estimateUsage(messages, content),
      };
    }

    const goal = messages.find((message) => message.role === "user")?.content ?? "";
    const jobs = collectJobs(messages);
    if (jobs.length === 0) {
      const emptySummary = `针对「${goal}」，当前职位库中没有检索到匹配岗位，可以调整关键词后重试。`;
      for (const chunk of splitIntoChunks(emptySummary, 24)) {
        onDelta?.(chunk);
      }
      return {
        content: emptySummary,
        toolCalls: [],
        finishReason: "stop",
        usage: estimateUsage(messages, emptySummary),
      };
    }

    const lines = jobs.map((job, index) => {
      const salary = job.salary ? `，${job.salary}` : "";
      return `${index + 1}. ${job.title}${salary}\n   要求：${job.requirements}`;
    });

    const summary = [
      `已基于「${goal}」完成检索，共匹配 ${jobs.length} 个岗位：`,
      "",
      lines.join("\n\n"),
      "",
      "以上内容来自本地职位库，可继续扩展更多工具来接入外部数据源。",
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

function collectJobs(messages: Array<{ role: string; content: string }>): JobRow[] {
  const jobs: JobRow[] = [];
  for (const message of messages) {
    if (message.role !== "tool") {
      continue;
    }
    try {
      const output = JSON.parse(message.content) as SearchOutput | undefined;
      if (output && Array.isArray(output.jobs)) {
        jobs.push(...output.jobs);
      }
    } catch {
      // 忽略无法解析的工具结果
    }
  }
  return jobs;
}

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

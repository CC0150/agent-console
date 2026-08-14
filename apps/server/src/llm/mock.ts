import { randomUUID } from "node:crypto";
import type { Usage } from "@agent-console/contracts";
import type { AgentChatOptions, AgentChatResult, LLMProvider } from "./provider";

interface JobRow {
  title: string;
  company: string;
  city: string;
  requirements: string;
  salary: string | null;
  sourceUrl: string | null;
}

interface SearchOutput {
  total: number;
  jobs: JobRow[];
}

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
    const latestToolOutput = getLatestToolOutput(messages);
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
      const content = "我将把检索结果整理成 Markdown 报告并保存为任务产出物。";
      onDelta?.(content);
      return {
        content,
        toolCalls: [
          {
            id: `call_${randomUUID()}`,
            name: "write_report",
            arguments: {
              title: "杭州前端岗位调研报告",
              filename: "杭州前端岗位调研报告.md",
              content: buildReportContent(jobs, goal),
            },
          },
        ],
        finishReason: "tool_calls",
        usage: estimateUsage(messages, content),
      };
    }

    const summary = [
      `已基于「${goal}」完成检索，共匹配 ${jobs.length} 个岗位：`,
      "",
      `报告已保存为「${latestToolOutput.artifact.name}」，可在任务详情页预览或下载。`,
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

function buildReportContent(jobs: JobRow[], goal: string): string {
  const sections = jobs.map((job, index) => {
    return [
      `## ${index + 1}. ${job.title}`,
      `- 公司：${job.company}`,
      `- 城市：${job.city}`,
      `- 薪资：${job.salary ?? "面议"}`,
      `- 要求：${job.requirements}`,
      `- 来源：${job.sourceUrl ?? "本地职位库"}`,
    ].join("\n");
  });
  return [
    "# 岗位调研报告",
    "",
    `> 目标：${goal}`,
    "",
    `共匹配 ${jobs.length} 个岗位。`,
    "",
    sections.join("\n\n"),
    "",
  ].join("\n");
}

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

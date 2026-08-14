import { Usage, type ToolDefinition } from "@agent-console/contracts";
import type { LLMConfig } from "../config";
import type {
  AgentChatOptions,
  AgentChatResult,
  AssistantToolCall,
  ChatMessage,
  LLMProvider,
} from "./provider";

interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: ToolCallDelta[];
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ToolCallFragment {
  id: string;
  name: string;
  arguments: string;
}

class LLMRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "LLMRequestError";
    this.retryable = retryable;
  }
}

class LLMDataError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "LLMDataError";
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";

  constructor(private readonly llmConfig: LLMConfig) {}

  async chat(options: AgentChatOptions): Promise<AgentChatResult> {
    let attempt = 0;
    while (true) {
      try {
        return await this.requestOnce(options);
      } catch (error) {
        if (options.signal?.aborted || !isRetryable(error)) {
          throw error;
        }
        if (attempt >= this.llmConfig.maxRetries) {
          throw error;
        }
        attempt += 1;
        await delay(backoffDelay(this.llmConfig, attempt));
      }
    }
  }

  private async requestOnce(options: AgentChatOptions): Promise<AgentChatResult> {
    let response: Response;
    try {
      response = await fetch(chatCompletionsUrl(this.llmConfig.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.llmConfig.model,
          messages: options.messages.map(toWireMessage),
          tools: options.tools.map(toOpenAITool),
          temperature: 0.2,
          stream: true,
        }),
        signal: combineSignals(options.signal, this.llmConfig.requestTimeoutMs),
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const cause =
        error instanceof Error && error.cause instanceof Error
          ? (error.cause as Error & { code?: string | number })
          : null;
      const detail = cause
        ? `${cause.message}${cause.code ? ` (${cause.code})` : ""}`
        : message;
      throw new LLMRequestError(`LLM 网络请求失败: ${detail}`, true);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500;
      throw new LLMRequestError(
        `LLM 请求失败: ${response.status} ${detail.slice(0, 200)}`,
        retryable,
      );
    }

    if (!response.body) {
      throw new LLMRequestError("LLM 响应没有流式内容", true);
    }

    try {
      return await readStream(response.body, options);
    } catch (error) {
      if (options.signal?.aborted || error instanceof LLMDataError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMRequestError(`LLM 流式响应中断: ${message}`, true);
    }
  }
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
  options: AgentChatOptions,
): Promise<AgentChatResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const fragments = new Map<number, ToolCallFragment>();
  let finishReason = "";
  let usage: Usage | undefined;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      return;
    }
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") {
      return;
    }
    let chunk: ChatCompletionChunk;
    try {
      chunk = JSON.parse(data) as ChatCompletionChunk;
    } catch {
      return;
    }
    const parsedUsage = parseUsage(chunk.usage);
    if (parsedUsage) {
      usage = parsedUsage;
    }
    const choice = chunk.choices?.[0];
    if (!choice) {
      return;
    }
    const delta = choice.delta ?? {};
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      options.onDelta?.(delta.content);
    }
    for (const part of delta.tool_calls ?? []) {
      const index = part.index ?? 0;
      const current = fragments.get(index) ?? { id: "", name: "", arguments: "" };
      if (part.id) {
        current.id = part.id;
      }
      if (part.function?.name) {
        current.name += part.function.name;
      }
      if (part.function?.arguments) {
        current.arguments += part.function.arguments;
      }
      fragments.set(index, current);
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      handleLine(line);
    }
  }
  if (buffer.trim()) {
    handleLine(buffer);
  }

  return {
    content,
    toolCalls: [...fragments.values()].map(toAssistantToolCall),
    finishReason,
    usage,
  };
}

function toWireMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content || null,
      ...(message.toolCalls && message.toolCalls.length > 0
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            })),
          }
        : {}),
    };
  }
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }
  return {
    role: message.role,
    content: message.content,
  };
}

function toOpenAITool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters ?? { type: "object" },
    },
  };
}

function toAssistantToolCall(fragment: ToolCallFragment): AssistantToolCall {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(fragment.arguments || "{}") as Record<string, unknown>;
  } catch {
    throw new LLMDataError(
      `工具参数不是合法 JSON: ${fragment.arguments.slice(0, 200)}`,
    );
  }
  return {
    id: fragment.id || `call_${Date.now()}`,
    name: fragment.name,
    arguments: args,
  };
}

function parseUsage(raw: ChatCompletionChunk["usage"]): Usage | undefined {
  if (!raw) {
    return undefined;
  }
  const promptTokens = raw.prompt_tokens ?? 0;
  const completionTokens = raw.completion_tokens ?? 0;
  const parsed = Usage.safeParse({
    promptTokens,
    completionTokens,
    totalTokens: raw.total_tokens ?? promptTokens + completionTokens,
  });
  return parsed.success ? parsed.data : undefined;
}

function chatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
}

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function isRetryable(error: unknown): boolean {
  return error instanceof LLMRequestError && error.retryable;
}

function backoffDelay(llmConfig: LLMConfig, attempt: number): number {
  const exponential = llmConfig.retryBaseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * Math.min(200, exponential));
  return Math.min(exponential + jitter, 30_000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

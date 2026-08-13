import type { AssistantToolCall, ToolDefinition, Usage } from "@agent-console/contracts";
import type { LLMConfig } from "../config";
import { MockLLMProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai-compatible";

export type { AssistantToolCall } from "@agent-console/contracts";

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AssistantToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

export interface AgentChatResult {
  content: string;
  toolCalls: AssistantToolCall[];
  finishReason: string;
  usage?: Usage;
}

export interface AgentChatOptions {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

export interface LLMProvider {
  name: string;
  chat(options: AgentChatOptions): Promise<AgentChatResult>;
}

export function createLLMProvider(llmConfig: LLMConfig): LLMProvider {
  if (llmConfig.provider === "openai") {
    return new OpenAICompatibleProvider(llmConfig);
  }
  return new MockLLMProvider();
}

import type { ChatMessage } from "./provider";

export interface TrimMessagesOptions {
  maxContextTokens: number;
  maxHistoryMessages: number;
}

interface MessageRound {
  messages: ChatMessage[];
  tokens: number;
}

/**
 * 调用 LLM 前裁剪消息历史：
 * - system 与最后一个 user 消息始终保留；
 * - 其余消息按“助手请求 + 工具结果”成组，优先保留最近轮次；
 * - 同时受消息条数和 token 预算约束。
 */
export function trimMessages(
  messages: ChatMessage[],
  options: TrimMessagesOptions,
): ChatMessage[] {
  const system = messages.filter((message) => message.role === "system");
  const users = messages.filter((message) => message.role === "user");
  const lastUser = users.length > 0 ? users[users.length - 1] : null;
  const core = [...system, ...(lastUser ? [lastUser] : [])];
  const coreTokens = totalTokens(core);
  let rounds = splitRounds(
    messages.filter((message) => message.role !== "system" && message.role !== "user"),
  );

  if (options.maxHistoryMessages > 0) {
    while (rounds.length > 1 && countMessages(rounds) > options.maxHistoryMessages) {
      rounds = rounds.slice(1);
    }
  }

  const available = Math.max(0, options.maxContextTokens - coreTokens);
  if (rounds.length > 0) {
    const kept: MessageRound[] = [];
    let usedTokens = 0;
    for (let index = rounds.length - 1; index >= 0; index -= 1) {
      const round = rounds[index];
      if (kept.length === 0 || usedTokens + round.tokens <= available) {
        kept.unshift(round);
        usedTokens += round.tokens;
      }
    }
    rounds = kept;
  }

  return [...core, ...rounds.flatMap((round) => round.messages)];
}

function splitRounds(messages: ChatMessage[]): MessageRound[] {
  const rounds: MessageRound[] = [];
  for (const message of messages) {
    if (message.role === "assistant") {
      rounds.push({ messages: [message], tokens: messageTokens(message) });
    } else if (
      message.role === "tool" &&
      rounds.length > 0 &&
      rounds[rounds.length - 1].messages[0].role === "assistant"
    ) {
      const round = rounds[rounds.length - 1];
      round.messages.push(message);
      round.tokens += messageTokens(message);
    } else {
      rounds.push({ messages: [message], tokens: messageTokens(message) });
    }
  }
  return rounds;
}

function countMessages(rounds: MessageRound[]): number {
  return rounds.reduce((count, round) => count + round.messages.length, 0);
}

function totalTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + messageTokens(message), 0);
}

function messageTokens(message: ChatMessage): number {
  const toolCallsText =
    message.role === "assistant" ? JSON.stringify(message.toolCalls ?? []) : "";
  return estimateTokens(message.content) + estimateTokens(toolCallsText) + 4;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2));
}

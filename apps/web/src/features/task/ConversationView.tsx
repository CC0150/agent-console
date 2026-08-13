import type { TaskEvent } from "@agent-console/contracts";
import {
  Bot,
  Clock,
  Loader2,
  MessageSquareText,
  User,
} from "lucide-react";
import { useMemo } from "react";
import { ToolCallCard } from "./ToolCallCard";
import {
  buildConversation,
  toDisplayToolCall,
  type ConversationItem,
} from "./conversation";

interface ConversationViewProps {
  events: TaskEvent[];
  goal: string;
  createdAt?: string;
  status?: string;
}

export function ConversationView({
  events,
  goal,
  createdAt,
  status,
}: ConversationViewProps) {
  const conversation = useMemo(
    () => buildConversation(events, goal, createdAt, status),
    [events, goal, createdAt, status],
  );

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-100">对话记录</h2>
            <p className="eyebrow mt-0.5">助手 / 工具</p>
          </div>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {conversation.length} 条
        </span>
      </div>

      <div className="max-h-[560px] min-h-[220px] overflow-y-auto scroll-active px-4 py-4 sm:px-5">
        {conversation.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">暂无对话记录</p>
        ) : (
          <div className="space-y-4">
            {conversation.map((item) => renderItem(item))}
          </div>
        )}
      </div>
    </section>
  );
}

function renderItem(item: ConversationItem) {
  if (item.kind === "user") {
    return (
      <div key={item.id} data-conversation-user="true" className="flex justify-end">
        <div className="max-w-[85%] min-w-0 rounded-md border border-signal-500/25 bg-signal-500/[0.08] px-4 py-3">
          <div className="mb-1.5 flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-signal-400" />
            <span className="eyebrow text-signal-300">用户</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-ink-100">
            {item.content}
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === "assistant") {
    return (
      <div key={item.id} data-conversation-assistant="true" className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <span className="eyebrow text-ink-400">助手</span>
          {item.streaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
          ) : (
            <span className="font-mono text-xs text-ink-500">
              {new Date(item.createdAt).toLocaleTimeString("zh-CN")}
            </span>
          )}
        </div>

        {item.content ? (
          <div className="whitespace-pre-wrap break-words rounded-md border border-ink-700/25 bg-ink-950/60 px-4 py-3 text-[15px] leading-6 text-ink-200">
            {item.content}
          </div>
        ) : null}

        {item.finishReason || item.usage ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-500">
            {item.finishReason ? (
              <span className="rounded border border-ink-700/30 bg-ink-700/10 px-2 py-0.5">
                结束原因 {item.finishReason}
              </span>
            ) : null}
            {item.usage ? (
              <span className="rounded border border-ink-700/30 bg-ink-700/10 px-2 py-0.5">
                Token {item.usage.promptTokens} / {item.usage.completionTokens} /{" "}
                {item.usage.totalTokens}
              </span>
            ) : null}
          </div>
        ) : null}

        {item.toolCalls?.length ? (
          <div className="mt-3 space-y-3">
            {item.toolCalls.map((call) => (
              <ToolCallCard
                key={call.request.id}
                toolCall={toDisplayToolCall(call)}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (item.toolCall) {
    return (
      <div key={item.id} data-conversation-tool="true" className="min-w-0">
        <ToolCallCard toolCall={item.toolCall} />
      </div>
    );
  }

  if (item.approval) {
    return (
      <div
        key={item.id}
        data-conversation-tool="true"
        className="flex items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-300"
      >
        <Clock className="h-3.5 w-3.5" />
        审批 {item.approval.status}
      </div>
    );
  }

  return null;
}

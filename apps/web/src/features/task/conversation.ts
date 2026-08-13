import type {
  ApprovalRequest,
  AssistantToolCall,
  TaskEvent,
  ToolCall,
  Usage,
} from "@agent-console/contracts";

export interface ConversationToolCall {
  request: AssistantToolCall;
  execution?: ToolCall;
  approval?: ApprovalRequest;
}

export interface ConversationItem {
  id: string;
  seq: number;
  createdAt: string;
  kind: "user" | "assistant" | "tool";
  content?: string;
  streaming?: boolean;
  finishReason?: string;
  usage?: Usage;
  toolCalls?: ConversationToolCall[];
  toolCall?: ToolCall;
  approval?: ApprovalRequest;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

/**
 * 把任务事件流组装为对话视图：
 * - 任务目标作为首条用户消息；
 * - 助手消息携带请求的工具调用，工具执行/审批结果回填到对应调用；
 * - 尚未结束的 message.delta 合并为一条流式助手消息；
 * - 已进入终态的任务即使缺少收尾的 message.assistant，也不再显示流式转圈。
 */
export function buildConversation(
  events: TaskEvent[],
  goal: string,
  createdAt = events[0]?.createdAt ?? new Date().toISOString(),
  status?: string,
): ConversationItem[] {
  const items: ConversationItem[] = [
    { id: "user", seq: 0, createdAt, kind: "user", content: goal },
  ];
  let activeAssistant: ConversationItem | null = null;
  let pendingSeq = 0;
  let pendingCreatedAt = "";
  const pendingDeltas: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case "message.delta": {
        pendingDeltas.push(event.payload.delta);
        pendingSeq = event.seq;
        pendingCreatedAt = event.createdAt;
        break;
      }
      case "message.assistant": {
        const assistant: ConversationItem = {
          id: event.id,
          seq: event.seq,
          createdAt: event.createdAt,
          kind: "assistant",
          content:
            event.payload.content ||
            (pendingDeltas.length > 0 ? pendingDeltas.join("") : ""),
          streaming: false,
          finishReason: event.payload.finishReason,
          usage: event.payload.usage,
          toolCalls: event.payload.toolCalls.map((request) => ({ request })),
        };
        items.push(assistant);
        activeAssistant = assistant;
        pendingDeltas.length = 0;
        break;
      }
      case "tool.started": {
        const toolCall = event.payload.toolCall;
        const target = findRequestedCall(activeAssistant, toolCall);
        if (target) {
          target.execution = toolCall;
        } else {
          items.push({
            id: event.id,
            seq: event.seq,
            createdAt: event.createdAt,
            kind: "tool",
            toolCall,
          });
        }
        break;
      }
      case "tool.finished": {
        const toolCall = event.payload.toolCall;
        const target =
          findExecutedCall(activeAssistant, toolCall.id) ??
          findRequestedCall(activeAssistant, toolCall);
        if (target) {
          target.execution = toolCall;
        } else {
          items.push({
            id: event.id,
            seq: event.seq,
            createdAt: event.createdAt,
            kind: "tool",
            toolCall,
          });
        }
        break;
      }
      case "approval.requested":
      case "approval.resolved": {
        const approval = event.payload.approval;
        const target = findExecutedCall(activeAssistant, approval.toolCallId);
        if (target) {
          target.approval = approval;
        } else {
          items.push({
            id: event.id,
            seq: event.seq,
            createdAt: event.createdAt,
            kind: "tool",
            approval,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  if (pendingDeltas.length > 0) {
    items.push({
      id: `stream-${pendingSeq}`,
      seq: pendingSeq,
      createdAt: pendingCreatedAt,
      kind: "assistant",
      content: pendingDeltas.join(""),
      streaming: !hasTerminalStatus(events, status),
      toolCalls: [],
    });
  }

  return items;
}

/**
 * 判断任务是否已进入终态：优先使用外部传入的任务状态，
 * 兼容旧事件记录中只有 task.completed / task.failed / task.status_changed 的情况。
 */
function hasTerminalStatus(events: TaskEvent[], status?: string): boolean {
  if (status && TERMINAL_STATUSES.has(status)) {
    return true;
  }
  return events.some(
    (event) =>
      event.type === "task.completed" ||
      event.type === "task.failed" ||
      (event.type === "task.status_changed" &&
        TERMINAL_STATUSES.has(event.payload.to)),
  );
}

/**
 * 把“助手请求 + 执行记录 + 审批结果”合并为可展示的 ToolCall，
 * 审批待处理时标记为待审批，拒绝时标记为已拒绝并带回原因。
 */
export function toDisplayToolCall(call: ConversationToolCall): ToolCall {
  const pending: ToolCall = {
    id: call.request.id,
    taskId: "",
    assistantCallId: call.request.id,
    toolName: call.request.name,
    input: call.request.arguments,
    state: "pending",
    output: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
  };
  const base = call.execution ?? pending;
  let state = base.state;
  let error = base.error;
  if (call.approval?.status === "pending" && state === "running") {
    state = "requires_approval";
  } else if (call.approval?.status === "rejected" && state === "running") {
    state = "rejected";
    error = error || call.approval.reason;
  }
  return { ...base, state, error };
}

function findRequestedCall(
  assistant: ConversationItem | null,
  toolCall: ToolCall,
): ConversationToolCall | null {
  if (!assistant?.toolCalls) {
    return null;
  }
  if (toolCall.assistantCallId) {
    return (
      assistant.toolCalls.find(
        (call) => call.request.id === toolCall.assistantCallId,
      ) ?? null
    );
  }
  // 旧事件没有 assistantCallId，按执行顺序匹配第一个未关联的请求
  return assistant.toolCalls.find((call) => !call.execution) ?? null;
}

function findExecutedCall(
  assistant: ConversationItem | null,
  toolCallId: string,
): ConversationToolCall | null {
  return (
    assistant?.toolCalls?.find((call) => call.execution?.id === toolCallId) ?? null
  );
}

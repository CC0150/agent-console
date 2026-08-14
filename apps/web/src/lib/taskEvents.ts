import type { PlanStep, TaskEvent, ToolCall } from "@agent-console/contracts";

export function mergeEvents(...lists: TaskEvent[][]): TaskEvent[] {
  const byId = new Map<string, TaskEvent>();
  for (const list of lists) {
    for (const event of list) {
      byId.set(event.id, event);
    }
  }
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

export function extractPlan(events: TaskEvent[]): PlanStep[] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "task.plan_updated") {
      return event.payload.plan;
    }
  }
  return [];
}

export function extractToolCalls(events: TaskEvent[]): ToolCall[] {
  const calls = new Map<string, ToolCall>();
  const approvalStates = new Map<
    string,
    "requires_approval" | "approved" | "rejected" | "cancelled" | "expired"
  >();
  for (const event of events) {
    if (event.type === "tool.started") {
      calls.set(event.payload.toolCall.id, event.payload.toolCall);
    }
    if (event.type === "tool.finished") {
      calls.set(event.payload.toolCall.id, event.payload.toolCall);
    }
    if (event.type === "approval.requested") {
      approvalStates.set(event.payload.approval.toolCallId, "requires_approval");
    }
    if (event.type === "approval.resolved") {
      if (event.payload.approval.status !== "pending") {
        approvalStates.set(
          event.payload.approval.toolCallId,
          event.payload.approval.status,
        );
      }
    }
  }
  for (const call of calls.values()) {
    const approvalState = approvalStates.get(call.id);
    if (!approvalState) {
      continue;
    }
    if (["succeeded", "failed", "rejected"].includes(call.state)) {
      continue;
    }
    if (approvalState === "requires_approval") {
      call.state = "requires_approval";
    } else if (approvalState === "approved") {
      call.state = "running";
    } else {
      call.state = "rejected";
    }
  }
  return [...calls.values()];
}

export function extractStreamText(events: TaskEvent[]): string {
  return events
    .filter((event) => event.type === "message.delta")
    .map((event) => event.payload.delta)
    .join("");
}

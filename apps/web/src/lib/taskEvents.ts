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
  for (const event of events) {
    if (event.type === "tool.started") {
      calls.set(event.payload.toolCall.id, event.payload.toolCall);
    }
    if (event.type === "tool.finished") {
      calls.set(event.payload.toolCall.id, event.payload.toolCall);
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

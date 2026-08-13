import type { TaskStatus } from "@agent-console/contracts";

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["planning", "running", "failed", "cancelled"],
  planning: ["running", "paused", "failed", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export class StateTransitionError extends Error {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(`非法状态迁移: ${from} -> ${to}`);
    this.name = "StateTransitionError";
  }
}

export function assertTransition(from: TaskStatus, to: TaskStatus): true {
  if (!canTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
  return true;
}

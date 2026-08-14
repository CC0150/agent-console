import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  PlanStep,
  Task,
  TaskEvent,
  TaskStatus,
  ToolCall,
} from "@agent-console/contracts";
import { TaskArtifact } from "@agent-console/contracts";
import { config } from "../config";
import {
  approvalRepository,
  eventRepository,
  taskRepository,
  withTransaction,
  type TaskPatch,
} from "../db/repositories";
import {
  createLLMProvider,
  type AssistantToolCall,
  type ChatMessage,
} from "../llm/provider";
import { trimMessages } from "../llm/context";
import { createEvent, emitEvent, publishEvent } from "../services/events";
import { toolRegistry } from "../tools/registry";
import { assertTransition } from "./state-machine";

const TERMINAL_STATUSES: TaskStatus[] = ["completed", "failed", "cancelled"];
const MAX_AGENT_ITERATIONS = 30;
const SYSTEM_PROMPT = [
  "你是 Agent 控制台中的执行 Agent。",
  "根据用户目标自主决定调用工具，完成目标后给出简洁的中文总结。",
  "工具调用失败时，根据错误信息调整参数后重试，不要重复完全相同的错误调用。",
  "不要编造工具输出，所有结论必须来自工具返回结果。",
].join("\n");

export interface RunnerRecoveryState {
  plan: PlanStep[];
  executedSteps: number;
  messages: ChatMessage[];
}

type ApprovalOutcome = {
  decision: "approved" | "rejected" | "cancelled";
  reason: string;
};

export class TaskRunner {
  private static readonly activeRunners = new Map<string, TaskRunner>();
  private static readonly pendingApprovals = new Map<
    string,
    (outcome: ApprovalOutcome) => void
  >();

  private readonly abortController = new AbortController();
  private readonly pendingApprovalIds = new Set<string>();
  private readonly approvalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pauseRequested = false;
  private resumeWaiter: (() => void) | null = null;
  private readonly plan: PlanStep[] = [];
  private executedSteps = 0;
  private readonly messages: ChatMessage[];

  private constructor(
    private readonly taskId: string,
    private readonly goal: string,
    private readonly llm: ReturnType<typeof createLLMProvider>,
    initialState: RunnerRecoveryState,
  ) {
    this.plan = initialState.plan;
    this.executedSteps = initialState.executedSteps;
    this.messages = initialState.messages;
  }

  static start(task: Task): TaskRunner {
    const existing = TaskRunner.activeRunners.get(task.id);
    if (existing) {
      return existing;
    }
    const runner = new TaskRunner(
      task.id,
      task.goal,
      createLLMProvider(config.llm),
      initialRunnerState(task),
    );
    TaskRunner.activeRunners.set(task.id, runner);
    void runner.runFresh().finally(() => TaskRunner.activeRunners.delete(task.id));
    return runner;
  }

  static resume(task: Task): TaskRunner {
    const existing = TaskRunner.activeRunners.get(task.id);
    if (existing) {
      return existing;
    }
    const runner = new TaskRunner(
      task.id,
      task.goal,
      createLLMProvider(config.llm),
      rebuildRunnerState(task, eventRepository.listByTask(task.id)),
    );
    TaskRunner.activeRunners.set(task.id, runner);
    void runner.runResumed().finally(() => TaskRunner.activeRunners.delete(task.id));
    return runner;
  }

  static get(taskId: string): TaskRunner | null {
    return TaskRunner.activeRunners.get(taskId) ?? null;
  }

  static resolveApproval(approvalId: string, decision: "approve" | "reject"): boolean {
    const resolve = TaskRunner.pendingApprovals.get(approvalId);
    if (!resolve) {
      return false;
    }
    resolve({
      decision: decision === "approve" ? "approved" : "rejected",
      reason: "用户已处理审批",
    });
    return true;
  }

  static async shutdown(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (const runner of [...TaskRunner.activeRunners.values()]) {
      runner.cancel();
    }
    while (TaskRunner.activeRunners.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  pause(): void {
    this.pauseRequested = true;
  }

  resume(): void {
    if (!this.pauseRequested) {
      return;
    }
    this.pauseRequested = false;
    this.resumeWaiter?.();
    this.resumeWaiter = null;
  }

  cancel(): void {
    this.pauseRequested = true;
    this.resumeWaiter?.();
    this.resumeWaiter = null;
    for (const approvalId of this.pendingApprovalIds) {
      const resolve = TaskRunner.pendingApprovals.get(approvalId);
      if (resolve) {
        TaskRunner.pendingApprovals.delete(approvalId);
        resolve({ decision: "cancelled", reason: "任务已取消" });
      }
    }
    this.pendingApprovalIds.clear();
    for (const timer of this.approvalTimers.values()) {
      clearTimeout(timer);
    }
    this.approvalTimers.clear();
    this.abortController.abort();
  }

  private async runFresh(): Promise<void> {
    await this.run("fresh");
  }

  private async runResumed(): Promise<void> {
    await this.run("resumed");
  }

  private async run(mode: "fresh" | "resumed"): Promise<void> {
    try {
      if (mode === "fresh") {
        await this.transition("planning");
      } else {
        const current = taskRepository.findById(this.taskId);
        if (!current || current.status !== "paused") {
          throw new Error(`任务不是可恢复的暂停状态: ${this.taskId}`);
        }
        await this.transition("running");
      }

      for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
        await this.waitAtSafeBoundary();
        if (this.abortController.signal.aborted) {
          await this.finishCancelled();
          return;
        }

        const result = await this.llm.chat({
          messages: trimMessages(this.messages, {
            maxContextTokens: config.llm.maxContextTokens,
            maxHistoryMessages: config.llm.maxHistoryMessages,
          }),
          tools: toolRegistry.list(),
          signal: this.abortController.signal,
          onDelta: (delta) => {
            this.emit("message.delta", { delta });
          },
        });
        if (this.abortController.signal.aborted) {
          await this.finishCancelled();
          return;
        }

        if (this.plan.length === 0) {
          await this.transition("running");
        }

        this.messages.push({
          role: "assistant",
          content: result.content,
          toolCalls: result.toolCalls,
        });
        await this.emit("message.assistant", {
          content: result.content,
          toolCalls: result.toolCalls,
          finishReason: result.finishReason,
          usage: result.usage,
        });

        if (result.toolCalls.length > 0) {
          await this.recordPlan(result.toolCalls);

          for (const toolCall of result.toolCalls) {
            await this.waitAtSafeBoundary();
            if (this.abortController.signal.aborted) {
              await this.finishCancelled();
              return;
            }

            const output = await this.executeToolCall(toolCall);
            this.messages.push({
              role: "tool",
              content: JSON.stringify(output),
              toolCallId: toolCall.id,
            });
          }
          continue;
        }

        const summary = result.content.trim() || "任务已完成";
        await this.transition("completed");
        await this.emit("task.completed", { summary });
        return;
      }

      throw new Error(`Agent 超过最大轮次限制（${MAX_AGENT_ITERATIONS}）`);
    } catch (error) {
      if (this.abortController.signal.aborted) {
        await this.finishCancelled();
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.transition("failed", { error: message });
      await this.emit("task.failed", { error: message });
    }
  }

  private async recordPlan(toolCalls: AssistantToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      this.plan.push({
        id: `step-${this.plan.length + 1}`,
        title: toolCallTitle(call),
        toolName: call.name,
        input: call.arguments,
      });
    }
    const event = withTransaction(() => {
      taskRepository.update(this.taskId, { totalSteps: this.plan.length });
      return createEvent(this.taskId, "task.plan_updated", { plan: this.plan });
    });
    publishEvent(event);
  }

  private async executeToolCall(toolCall: AssistantToolCall): Promise<unknown> {
    const startedAt = new Date().toISOString();
    const record: ToolCall = {
      id: randomUUID(),
      taskId: this.taskId,
      assistantCallId: toolCall.id,
      toolName: toolCall.name,
      input: toolCall.arguments,
      state: "running",
      output: null,
      error: null,
      startedAt,
      finishedAt: null,
      durationMs: null,
    };
    await this.emit("tool.started", { toolCall: record });

    try {
      const tool = toolRegistry.get(toolCall.name);
      if (tool.requiresApproval) {
        const requested = withTransaction(() => {
          const approval = approvalRepository.create({
            taskId: this.taskId,
            toolCallId: record.id,
            toolName: toolCall.name,
            input: toolCall.arguments,
            reason: tool.approvalReason ?? `工具 ${toolCall.name} 需要人工审批`,
          });
          const event = createEvent(this.taskId, "approval.requested", { approval });
          return { approval, event };
        });
        publishEvent(requested.event);

        const outcome = await this.waitForApproval(requested.approval);
        const resolvedEvent = withTransaction(() => {
          const resolved = approvalRepository.resolve(requested.approval.id, outcome.decision);
          if (!resolved) {
            return null;
          }
          return createEvent(this.taskId, "approval.resolved", { approval: resolved });
        });
        if (resolvedEvent) {
          publishEvent(resolvedEvent);
        }

        if (outcome.decision === "rejected" || outcome.decision === "cancelled") {
          const rejectedCall: ToolCall = {
            ...record,
            state: "rejected",
            error:
              outcome.decision === "rejected"
                ? "用户拒绝了工具调用"
                : outcome.reason,
            finishedAt: new Date().toISOString(),
            durationMs: 0,
          };
          await this.finishToolCall(rejectedCall);
          return { ok: false, error: rejectedCall.error };
        }
      }

      const output = await toolRegistry.run(toolCall.name, toolCall.arguments, {
        taskId: this.taskId,
        signal: this.abortController.signal,
      });
      const artifactOutput = TaskArtifact.safeParse(
        (output as { artifact?: unknown } | null)?.artifact,
      );
      if (artifactOutput.success) {
        await this.emit("artifact.created", { artifact: artifactOutput.data });
      }
      const finishedCall: ToolCall = {
        ...record,
        state: "succeeded",
        output,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
      };
      await this.finishToolCall(finishedCall);
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedCall: ToolCall = {
        ...record,
        state: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
      };
      await this.finishToolCall(failedCall);
      return { ok: false, error: message };
    }
  }

  private async finishToolCall(toolCall: ToolCall): Promise<void> {
    this.executedSteps += 1;
    const event = withTransaction(() => {
      taskRepository.update(this.taskId, { currentStep: this.executedSteps });
      return createEvent(this.taskId, "tool.finished", { toolCall });
    });
    publishEvent(event);
  }

  private waitForApproval(approval: ApprovalRequest): Promise<ApprovalOutcome> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (outcome: ApprovalOutcome) => {
        if (settled) {
          return;
        }
        settled = true;
        const timer = this.approvalTimers.get(approval.id);
        if (timer) {
          clearTimeout(timer);
          this.approvalTimers.delete(approval.id);
        }
        TaskRunner.pendingApprovals.delete(approval.id);
        this.pendingApprovalIds.delete(approval.id);
        resolve(outcome);
      };
      const timer = setTimeout(() => {
        settle({ decision: "cancelled", reason: "审批超时，已自动取消" });
      }, config.approvalTimeoutMs);
      timer.unref?.();
      this.approvalTimers.set(approval.id, timer);
      TaskRunner.pendingApprovals.set(approval.id, settle);
      this.pendingApprovalIds.add(approval.id);
    });
  }

  private async transition(to: TaskStatus, extra: TaskPatch = {}): Promise<void> {
    const current = taskRepository.findById(this.taskId);
    if (!current) {
      throw new Error(`任务不存在: ${this.taskId}`);
    }
    assertTransition(current.status, to);

    const now = new Date().toISOString();
    const patch: TaskPatch = { ...extra, status: to };
    if (to === "running" && !current.startedAt) {
      patch.startedAt = now;
    }
    if (TERMINAL_STATUSES.includes(to)) {
      patch.finishedAt = now;
    }

    const event = withTransaction(() => {
      const updated = taskRepository.update(this.taskId, patch);
      if (!updated) {
        throw new Error(`任务不存在: ${this.taskId}`);
      }
      return createEvent(this.taskId, "task.status_changed", {
        from: current.status,
        to,
      });
    });
    publishEvent(event);
  }

  private async waitAtSafeBoundary(): Promise<void> {
    if (!this.pauseRequested) {
      return;
    }
    const current = taskRepository.findById(this.taskId);
    if (current && current.status !== "paused") {
      await this.transition("paused");
    }
    await new Promise<void>((resolve) => {
      this.resumeWaiter = resolve;
    });
    if (!this.abortController.signal.aborted) {
      const resumed = taskRepository.findById(this.taskId);
      if (resumed && resumed.status === "paused") {
        await this.transition("running");
      }
    }
  }

  private async finishCancelled(): Promise<void> {
    const current = taskRepository.findById(this.taskId);
    if (!current || TERMINAL_STATUSES.includes(current.status)) {
      return;
    }
    await this.transition("cancelled");
  }

  private emit(type: TaskEvent["type"], payload: TaskEvent["payload"]): Promise<TaskEvent> {
    return Promise.resolve(emitEvent(this.taskId, type, payload));
  }
}

function initialRunnerState(task: Task): RunnerRecoveryState {
  return {
    plan: [],
    executedSteps: 0,
    messages: initialMessages(task),
  };
}

function rebuildRunnerState(task: Task, events: TaskEvent[]): RunnerRecoveryState {
  return {
    plan: rebuildPlan(events),
    executedSteps: task.currentStep,
    messages: rebuildMessages(task, events),
  };
}

function initialMessages(task: Task): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `任务目标：${task.goal}` },
  ];
}

function rebuildPlan(events: TaskEvent[]): PlanStep[] {
  let plan: PlanStep[] = [];
  for (const event of events) {
    if (event.type === "task.plan_updated") {
      plan = event.payload.plan;
    }
  }
  return plan;
}

function rebuildMessages(task: Task, events: TaskEvent[]): ChatMessage[] {
  const messages = initialMessages(task);
  for (const event of events) {
    if (event.type === "message.assistant") {
      messages.push({
        role: "assistant",
        content: event.payload.content,
        toolCalls: event.payload.toolCalls,
      });
    } else if (event.type === "tool.finished") {
      const call = event.payload.toolCall;
      if (call.state === "running" || call.state === "requires_approval") {
        continue;
      }
      messages.push({
        role: "tool",
        content: JSON.stringify(toolOutputForMessage(call)),
        toolCallId: call.assistantCallId ?? call.id,
      });
    }
  }
  return messages;
}

function toolOutputForMessage(call: ToolCall): unknown {
  if (call.state === "succeeded") {
    return call.output;
  }
  return { ok: false, error: call.error ?? "工具调用未完成" };
}

function toolCallTitle(toolCall: AssistantToolCall): string {
  if (toolCall.name === "search_jobs") {
    return "检索岗位";
  }
  return `调用 ${toolCall.name}`;
}

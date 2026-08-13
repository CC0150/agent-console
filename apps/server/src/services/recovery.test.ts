import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TaskEvent, ToolCall } from "@agent-console/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let taskRepository: Awaited<typeof import("../db/repositories")>["taskRepository"];
let eventRepository: Awaited<typeof import("../db/repositories")>["eventRepository"];
let approvalRepository: Awaited<typeof import("../db/repositories")>["approvalRepository"];
let createEvent: typeof import("../services/events")["createEvent"];
let recoverInterruptedTasks: () => number;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-console-recovery-"));
  process.env.DATABASE_PATH = path.join(tempDir, "test.db");

  const { migrate } = await import("../db/schema");
  migrate();

  const repositories = await import("../db/repositories");
  taskRepository = repositories.taskRepository;
  eventRepository = repositories.eventRepository;
  approvalRepository = repositories.approvalRepository;

  const eventsService = await import("../services/events");
  createEvent = eventsService.createEvent;

  const recovery = await import("./recovery");
  recoverInterruptedTasks = recovery.recoverInterruptedTasks;
});

beforeEach(() => {
  for (const task of taskRepository.list()) {
    taskRepository.remove(task.id);
  }
});

afterAll(async () => {
  const { closeDatabase } = await import("../db/client");
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("服务重启恢复", () => {
  it("将进行中的任务标记为失败，暂停任务保持暂停", () => {
    const running = taskRepository.create({ goal: "运行中任务", model: "mock" });
    taskRepository.update(running.id, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    const paused = taskRepository.create({ goal: "暂停任务", model: "mock" });
    taskRepository.update(paused.id, { status: "paused" });
    const completed = taskRepository.create({ goal: "已完成任务", model: "mock" });
    taskRepository.update(completed.id, { status: "completed" });

    const recovered = recoverInterruptedTasks();
    expect(recovered).toBe(1);

    const recoveredRunning = taskRepository.findById(running.id);
    expect(recoveredRunning?.status).toBe("failed");
    expect(recoveredRunning?.error).toContain("服务重启");
    expect(recoveredRunning?.finishedAt).not.toBeNull();

    const recoveredPaused = taskRepository.findById(paused.id);
    expect(recoveredPaused?.status).toBe("paused");
    expect(recoveredPaused?.error).toBeNull();

    const untouched = taskRepository.findById(completed.id);
    expect(untouched?.status).toBe("completed");

    const events = eventRepository.listByTask(running.id);
    expect(events.some((event) => event.type === "task.failed")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "task.status_changed" &&
          event.payload.to === "failed",
      ),
    ).toBe(true);
  });

  it("恢复暂停任务时补发中断工具的结束事件且不改变状态", () => {
    const task = taskRepository.create({ goal: "中断工具任务", model: "mock" });
    taskRepository.update(task.id, { status: "paused" });
    createEvent(task.id, "tool.started", {
      toolCall: startedToolCall(task.id, "call-interrupted"),
    });

    expect(recoverInterruptedTasks()).toBe(1);

    const recovered = taskRepository.findById(task.id);
    expect(recovered?.status).toBe("paused");
    expect(recovered?.currentStep).toBe(1);

    const events = eventRepository.listByTask(task.id);
    const finished = events
      .filter(isToolFinishedEvent)
      .find((event) => event.payload.toolCall.id === "call-interrupted");
    expect(finished?.payload.toolCall).toMatchObject({
      state: "failed",
      error: "服务重启，工具执行已中断",
    });

    expect(recoverInterruptedTasks()).toBe(0);
  });

  it("恢复时取消待处理审批并补发对应工具结束事件", () => {
    const task = taskRepository.create({ goal: "审批中断任务", model: "mock" });
    taskRepository.update(task.id, { status: "running" });
    createEvent(task.id, "tool.started", {
      toolCall: startedToolCall(task.id, "call-approval"),
    });
    const approval = approvalRepository.create({
      taskId: task.id,
      toolCallId: "call-approval",
      toolName: "http_request",
      input: { url: "https://example.com" },
      reason: "测试审批",
    });
    createEvent(task.id, "approval.requested", { approval });
    createEvent(task.id, "message.assistant", {
      content: "需要调用外部接口",
      toolCalls: [
        {
          id: "call-approval",
          name: "http_request",
          arguments: { url: "https://example.com" },
        },
      ],
    });

    expect(recoverInterruptedTasks()).toBe(1);

    const recovered = taskRepository.findById(task.id);
    expect(recovered?.status).toBe("failed");
    expect(recovered?.currentStep).toBe(1);
    expect(approvalRepository.findById(approval.id)?.status).toBe("cancelled");

    const events = eventRepository.listByTask(task.id);
    expect(
      events.some(
        (event) =>
          event.type === "approval.resolved" &&
          event.payload.approval.id === approval.id &&
          event.payload.approval.status === "cancelled",
      ),
    ).toBe(true);

    const finished = events
      .filter(isToolFinishedEvent)
      .filter((event) => event.payload.toolCall.id === "call-approval");
    expect(finished).toHaveLength(1);
    expect(finished[0].payload.toolCall).toMatchObject({
      state: "rejected",
      error: "服务重启，审批已取消",
    });
  });
});

function startedToolCall(taskId: string, id: string): ToolCall {
  return {
    id,
    taskId,
    toolName: "search_jobs",
    input: { city: "杭州" },
    state: "running",
    output: null,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
  };
}

function isToolFinishedEvent(
  event: TaskEvent,
): event is Extract<TaskEvent, { type: "tool.finished" }> {
  return event.type === "tool.finished";
}

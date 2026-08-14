import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TaskEvent, ToolCall } from "@agent-console/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestData } from "../db/test-helpers";

let tempDir: string;
let taskRepository: Awaited<typeof import("../db/repositories")>["taskRepository"];
let eventRepository: Awaited<typeof import("../db/repositories")>["eventRepository"];
let createEvent: typeof import("../services/events")["createEvent"];
let recoverInterruptedTasks: () => Promise<number>;
const testData = new TestData();

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-console-recovery-"));

  const { migrate } = await import("../db/schema");
  await migrate();

  await testData.createWorkspace("恢复测试工作区");

  const repositories = await import("../db/repositories");
  taskRepository = repositories.taskRepository;
  eventRepository = repositories.eventRepository;

  const eventsService = await import("../services/events");
  createEvent = eventsService.createEvent;

  const recovery = await import("./recovery");
  recoverInterruptedTasks = recovery.recoverInterruptedTasks;
});

beforeEach(async () => {
  await testData.removeCreatedTasks();
});

afterAll(async () => {
  await testData.cleanup();
  const { closeDatabase } = await import("../db/client");
  await closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("服务重启恢复", () => {
  it("将进行中的任务标记为失败，暂停任务保持暂停", async () => {
    const running = await testData.createTask({ goal: "运行中任务" });
    await taskRepository.update(running.id, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    const paused = await testData.createTask({ goal: "暂停任务" });
    await taskRepository.update(paused.id, { status: "paused" });
    const completed = await testData.createTask({ goal: "已完成任务" });
    await taskRepository.update(completed.id, { status: "completed" });

    const recovered = await recoverInterruptedTasks();
    expect(recovered).toBe(1);

    const recoveredRunning = await taskRepository.findById(running.id);
    expect(recoveredRunning?.status).toBe("failed");
    expect(recoveredRunning?.error).toContain("服务重启");
    expect(recoveredRunning?.finishedAt).not.toBeNull();

    const recoveredPaused = await taskRepository.findById(paused.id);
    expect(recoveredPaused?.status).toBe("paused");
    expect(recoveredPaused?.error).toBeNull();

    const untouched = await taskRepository.findById(completed.id);
    expect(untouched?.status).toBe("completed");

    const events = await eventRepository.listByTask(running.id);
    expect(events.some((event) => event.type === "task.failed")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "task.status_changed" &&
          event.payload.to === "failed",
      ),
    ).toBe(true);
  });

  it("恢复暂停任务时补发中断工具的结束事件且不改变状态", async () => {
    const task = await testData.createTask({ goal: "中断工具任务" });
    await taskRepository.update(task.id, { status: "paused" });
    await createEvent(task.id, "tool.started", {
      toolCall: startedToolCall(task.id, "call-interrupted"),
    });

    expect(await recoverInterruptedTasks()).toBe(1);

    const recovered = await taskRepository.findById(task.id);
    expect(recovered?.status).toBe("paused");
    expect(recovered?.currentStep).toBe(1);

    const events = await eventRepository.listByTask(task.id);
    const finished = events
      .filter(isToolFinishedEvent)
      .find((event) => event.payload.toolCall.id === "call-interrupted");
    expect(finished?.payload.toolCall).toMatchObject({
      state: "failed",
      error: "服务重启，工具执行已中断",
    });

    expect(await recoverInterruptedTasks()).toBe(0);
  });

});

function startedToolCall(taskId: string, id: string): ToolCall {
  return {
    id,
    taskId,
    toolName: "write_report",
    input: { title: "岗位调研报告" },
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

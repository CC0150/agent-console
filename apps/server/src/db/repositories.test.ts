import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Workspace } from "@agent-console/contracts";
import { taskRepository } from "./repositories";
import { TestData } from "./test-helpers";

let tempDir: string;
let workspaceA: Workspace;
let workspaceB: Workspace;
const testData = new TestData();

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-console-repositories-"));
  process.env.REPORTS_DIR = path.join(tempDir, "reports");

  const { migrate } = await import("./schema");
  await migrate();

  workspaceA = await testData.createWorkspace("测试工作区 A");
  workspaceB = await testData.createWorkspace("测试工作区 B");
});

beforeEach(async () => {
  await testData.removeCreatedTasks();
});

afterAll(async () => {
  await testData.cleanup();
  const { closeDatabase } = await import("./client");
  await closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("taskRepository.query", () => {
  it("filters by workspace, status and keyword", async () => {
    const matched = await testData.createTask({
      goal: "整理杭州前端岗位",
      workspaceId: workspaceA.id,
    });
    await taskRepository.update(matched.id, { status: "running", currentStep: 2 });

    const otherWorkspace = await testData.createTask({
      goal: "整理杭州前端岗位",
      workspaceId: workspaceB.id,
    });
    await taskRepository.update(otherWorkspace.id, { status: "running", currentStep: 2 });

    const otherStatus = await testData.createTask({
      goal: "整理杭州前端岗位",
      workspaceId: workspaceA.id,
    });
    await taskRepository.update(otherStatus.id, { status: "completed", currentStep: 3 });

    const result = await taskRepository.query({
      workspaceId: workspaceA.id,
      status: "running",
      q: "杭州",
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.tasks.map((task) => task.id)).toEqual([matched.id]);
  });

  it("sorts by currentStep in ascending and descending order", async () => {
    const low = await testData.createTask({ goal: "low", workspaceId: workspaceA.id });
    await taskRepository.update(low.id, { currentStep: 1 });
    const high = await testData.createTask({ goal: "high", workspaceId: workspaceA.id });
    await taskRepository.update(high.id, { currentStep: 5 });
    const middle = await testData.createTask({ goal: "middle", workspaceId: workspaceA.id });
    await taskRepository.update(middle.id, { currentStep: 3 });

    const ascending = await taskRepository.query({
      workspaceId: workspaceA.id,
      sort: "currentStep",
      order: "asc",
      page: 1,
      pageSize: 10,
    });
    expect(ascending.tasks.map((task) => task.id)).toEqual([low.id, middle.id, high.id]);

    const descending = await taskRepository.query({
      workspaceId: workspaceA.id,
      sort: "currentStep",
      order: "desc",
      page: 1,
      pageSize: 10,
    });
    expect(descending.tasks.map((task) => task.id)).toEqual([high.id, middle.id, low.id]);
  });

  it("paginates and clamps an out-of-range page to the last page", async () => {
    for (let index = 0; index < 12; index += 1) {
      await testData.createTask({
        goal: `任务 ${index + 1}`,
        workspaceId: workspaceA.id,
      });
    }

    const firstPage = await taskRepository.query({
      workspaceId: workspaceA.id,
      page: 1,
      pageSize: 5,
    });
    expect(firstPage.total).toBe(12);
    expect(firstPage.tasks).toHaveLength(5);
    expect(firstPage.totalPages).toBe(3);

    const lastPage = await taskRepository.query({
      workspaceId: workspaceA.id,
      page: 3,
      pageSize: 5,
    });
    expect(lastPage.tasks).toHaveLength(2);
    expect(lastPage.page).toBe(3);

    const clamped = await taskRepository.query({
      workspaceId: workspaceA.id,
      page: 99,
      pageSize: 5,
    });
    expect(clamped.page).toBe(3);
    expect(clamped.tasks).toHaveLength(2);
  });
});

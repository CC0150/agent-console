import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let repository: Awaited<typeof import("./repositories")>["taskRepository"];

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-console-repositories-"));
  process.env.DATABASE_PATH = path.join(tempDir, "test.db");

  const { migrate } = await import("./schema");
  migrate();

  repository = (await import("./repositories")).taskRepository;
});

beforeEach(() => {
  for (const task of repository.list()) {
    repository.remove(task.id);
  }
});

afterAll(async () => {
  const { closeDatabase } = await import("./client");
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("taskRepository.query", () => {
  it("filters by workspace, status and keyword", () => {
    const matched = repository.create({
      goal: "整理杭州前端岗位",
      model: "mock",
      workspaceId: "ws-a",
    });
    repository.update(matched.id, { status: "running", currentStep: 2 });

    const otherWorkspace = repository.create({
      goal: "整理杭州前端岗位",
      model: "mock",
      workspaceId: "ws-b",
    });
    repository.update(otherWorkspace.id, { status: "running", currentStep: 2 });

    const otherStatus = repository.create({
      goal: "整理杭州前端岗位",
      model: "mock",
      workspaceId: "ws-a",
    });
    repository.update(otherStatus.id, { status: "completed", currentStep: 3 });

    const result = repository.query({
      workspaceId: "ws-a",
      status: "running",
      q: "杭州",
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.tasks.map((task) => task.id)).toEqual([matched.id]);
  });

  it("sorts by currentStep in ascending and descending order", () => {
    const low = repository.create({ goal: "low", model: "mock" });
    repository.update(low.id, { currentStep: 1 });
    const high = repository.create({ goal: "high", model: "mock" });
    repository.update(high.id, { currentStep: 5 });
    const middle = repository.create({ goal: "middle", model: "mock" });
    repository.update(middle.id, { currentStep: 3 });

    const ascending = repository.query({
      sort: "currentStep",
      order: "asc",
      page: 1,
      pageSize: 10,
    });
    expect(ascending.tasks.map((task) => task.id)).toEqual([low.id, middle.id, high.id]);

    const descending = repository.query({
      sort: "currentStep",
      order: "desc",
      page: 1,
      pageSize: 10,
    });
    expect(descending.tasks.map((task) => task.id)).toEqual([high.id, middle.id, low.id]);
  });

  it("paginates and clamps an out-of-range page to the last page", () => {
    for (let index = 0; index < 12; index += 1) {
      repository.create({ goal: `任务 ${index + 1}`, model: "mock" });
    }

    const firstPage = repository.query({ page: 1, pageSize: 5 });
    expect(firstPage.total).toBe(12);
    expect(firstPage.tasks).toHaveLength(5);
    expect(firstPage.totalPages).toBe(3);

    const lastPage = repository.query({ page: 3, pageSize: 5 });
    expect(lastPage.tasks).toHaveLength(2);
    expect(lastPage.page).toBe(3);

    const clamped = repository.query({ page: 99, pageSize: 5 });
    expect(clamped.page).toBe(3);
    expect(clamped.tasks).toHaveLength(2);
  });
});

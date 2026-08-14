import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestData } from "../db/test-helpers";

let tempDir: string;
let reportsDir: string;
let taskId: string;
let writeReportTool: Awaited<typeof import("./write-report")>["writeReportTool"];
let taskRepository: Awaited<typeof import("../db/repositories")>["taskRepository"];
let artifactRepository: Awaited<
  typeof import("../db/repositories")
>["artifactRepository"];
let testData: TestData;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-console-report-"));
  reportsDir = path.join(tempDir, "reports");
  process.env.REPORTS_DIR = reportsDir;

  const { TestData } = await import("../db/test-helpers");
  testData = new TestData();
  const { migrate } = await import("../db/schema");
  await migrate();

  const repositories = await import("../db/repositories");
  taskRepository = repositories.taskRepository;
  artifactRepository = repositories.artifactRepository;
  taskId = (await testData.createTask({ goal: "整理杭州前端岗位" })).id;

  writeReportTool = (await import("./write-report")).writeReportTool;
});

afterAll(async () => {
  await artifactRepository.deleteByTask(taskId);
  await testData.cleanup();
  const { closeDatabase } = await import("../db/client");
  await closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("write_report tool", () => {
  it("写入报告文件并登记产出物元数据", async () => {
    const rawResult = await writeReportTool.execute(
      {
        title: "杭州前端岗位调研报告",
        filename: "杭州前端岗位调研报告.md",
        content: "# 杭州前端岗位调研报告\n\n共匹配 5 个岗位。",
        format: "markdown",
      },
      { taskId, signal: new AbortController().signal },
    );
    const result = rawResult as {
      ok: boolean;
      artifact: { id: string; name: string; mimeType: string; sizeBytes: number };
    };

    expect(result.ok).toBe(true);
    expect(result.artifact.name).toBe("杭州前端岗位调研报告.md");
    expect(result.artifact.mimeType).toBe("text/markdown");
    expect(result.artifact.sizeBytes).toBeGreaterThan(0);

    const artifacts = await artifactRepository.listByTask(taskId);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].name).toBe("杭州前端岗位调研报告.md");

    const content = await artifactRepository.readContent(result.artifact.id);
    expect(content?.content).toContain("共匹配 5 个岗位");
    expect(fs.existsSync(path.join(reportsDir, taskId))).toBe(true);

    await artifactRepository.deleteByTask(taskId);
    expect(await artifactRepository.listByTask(taskId)).toHaveLength(0);
  });

  it("对文件名做路径安全处理", async () => {
    const rawResult = await writeReportTool.execute(
      {
        title: "安全报告",
        filename: "../../恶意报告.md",
        content: "# 安全报告",
        format: "markdown",
      },
      { taskId, signal: new AbortController().signal },
    );
    const result = rawResult as {
      ok: boolean;
      artifact: { id: string; name: string; mimeType: string; sizeBytes: number };
    };

    expect(result.artifact.name).not.toContain("..");
    expect(await artifactRepository.listByTask(taskId)).toHaveLength(1);
  });
});

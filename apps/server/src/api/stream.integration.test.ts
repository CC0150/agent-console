import { once } from "node:events";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { TaskEvent } from "@agent-console/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

interface StreamEndEvent {
  type: "stream.end";
}

let tempDir: string;
let baseUrl: string;
let server: Server;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-console-integration-"));
  process.env.REPORTS_DIR = path.join(tempDir, "reports");
  process.env.LLM_PROVIDER = "mock";

  const { createApp } = await import("../app");
  const { migrate } = await import("../db/schema");
  await migrate();
  await import("../tools");

  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server?.close();
  const { closeDatabase } = await import("../db/client");
  await closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("SSE 流接口", () => {
  it("通过 /api/tasks/:id/stream 推送完整事件并支持 Last-Event-ID 断点续传", async () => {
    const created = await postJson("/api/tasks", { goal: "生成前端岗位调研报告" });
    expect(created.status).toBe(201);
    const task = (await created.json()) as { task: { id: string } };
    const taskId = task.task.id;

    const streamResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/stream`, {
      headers: { Accept: "text/event-stream" },
    });
    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");

    const events = await readStreamUntilTerminal(streamResponse, taskId);
    expect(events.some((event) => event.type === "task.created")).toBe(true);
    expect(events.some((event) => event.type === "task.plan_updated")).toBe(true);
    expect(events.some((event) => event.type === "tool.started")).toBe(true);
    expect(events.some((event) => event.type === "tool.finished")).toBe(true);
    expect(events.some((event) => event.type === "message.delta")).toBe(true);
    expect(events.some((event) => event.type === "message.assistant")).toBe(true);
    expect(events.some((event) => event.type === "task.completed")).toBe(true);

    const assistantEvent = events.find(
      (event): event is Extract<TaskEvent, { type: "message.assistant" }> =>
        event.type === "message.assistant",
    );
    expect(assistantEvent?.payload.finishReason).toBeTruthy();
    expect(assistantEvent?.payload.usage?.totalTokens).toBeGreaterThan(0);

    const finishedEvent = events.find(
      (event): event is Extract<TaskEvent, { type: "tool.finished" }> =>
        event.type === "tool.finished",
    );
    expect(finishedEvent?.payload.toolCall.assistantCallId).toBeTruthy();

    const seqs = events.map((event) => event.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toEqual(Array.from({ length: seqs.length }, (_, index) => index + 1));

    const lastSeq = seqs[seqs.length - 1];
    const replay = await fetch(`${baseUrl}/api/tasks/${taskId}/stream`, {
      headers: { Accept: "text/event-stream", "Last-Event-ID": String(lastSeq) },
    });
    const replayed = await readStreamUntilTerminal(replay, taskId);
    expect(replayed).toEqual([]);

    const taskResponse = await fetch(`${baseUrl}/api/tasks/${taskId}`);
    const taskBody = (await taskResponse.json()) as { task: { status: string } };
    expect(taskBody.task.status).toBe("completed");

    const artifactsResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/artifacts`);
    const artifactsBody = (await artifactsResponse.json()) as {
      artifacts: Array<{ id: string; name: string }>;
    };
    expect(artifactsBody.artifacts).toHaveLength(1);

    const artifact = artifactsBody.artifacts[0];
    const artifactResponse = await fetch(
      `${baseUrl}/api/tasks/${taskId}/artifacts/${artifact.id}/content`,
    );
    expect(artifactResponse.status).toBe(200);
    expect(await artifactResponse.text()).toContain("岗位调研报告");

    await fetch(`${baseUrl}/api/tasks/${taskId}`, { method: "DELETE" });
  });

  it("重跑复用原任务，不新增台账记录并清除旧事件与产出物", async () => {
    const created = await postJson("/api/tasks", { goal: "重跑任务台账测试" });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { task: { id: string } };
    const taskId = createdBody.task.id;

    const firstStream = await fetch(`${baseUrl}/api/tasks/${taskId}/stream`, {
      headers: { Accept: "text/event-stream" },
    });
    const firstEvents = await readStreamUntilTerminal(firstStream, taskId);
    const oldEventIds = new Set(firstEvents.map((event) => event.id));

    const beforeListResponse = await fetch(
      `${baseUrl}/api/tasks?q=${encodeURIComponent(taskId)}`,
    );
    const beforeList = (await beforeListResponse.json()) as { total: number };
    const beforeArtifactsResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/artifacts`);
    const beforeArtifacts = (await beforeArtifactsResponse.json()) as {
      artifacts: Array<{ id: string }>;
    };
    const oldArtifactIds = new Set(beforeArtifacts.artifacts.map((artifact) => artifact.id));
    expect(oldArtifactIds.size).toBeGreaterThan(0);

    const rerunResponse = await postJson(`/api/tasks/${taskId}/actions`, {
      action: "rerun",
    });
    expect(rerunResponse.status).toBe(201);
    const rerunBody = (await rerunResponse.json()) as {
      task: {
        id: string;
        status: string;
        currentStep: number;
        totalSteps: number;
        error: string | null;
        startedAt: string | null;
        finishedAt: string | null;
      };
    };
    expect(rerunBody.task.id).toBe(taskId);
    expect(rerunBody.task.status).toBe("queued");
    expect(rerunBody.task.currentStep).toBe(0);
    expect(rerunBody.task.totalSteps).toBe(0);
    expect(rerunBody.task.error).toBeNull();
    expect(rerunBody.task.startedAt).toBeNull();
    expect(rerunBody.task.finishedAt).toBeNull();

    const afterListResponse = await fetch(
      `${baseUrl}/api/tasks?q=${encodeURIComponent(taskId)}`,
    );
    const afterList = (await afterListResponse.json()) as { total: number };
    expect(afterList.total).toBe(beforeList.total);

    const rerunStream = await fetch(`${baseUrl}/api/tasks/${taskId}/stream`, {
      headers: { Accept: "text/event-stream" },
    });
    const rerunEvents = await readStreamUntilTerminal(rerunStream, taskId);
    expect(rerunEvents[0]?.type).toBe("task.created");
    expect(rerunEvents[0]?.seq).toBe(1);
    expect(rerunEvents.some((event) => oldEventIds.has(event.id))).toBe(false);
    expect(rerunEvents.some((event) => event.type === "task.completed")).toBe(true);

    const afterArtifactsResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/artifacts`);
    const afterArtifacts = (await afterArtifactsResponse.json()) as {
      artifacts: Array<{ id: string }>;
    };
    expect(afterArtifacts.artifacts.some((artifact) => oldArtifactIds.has(artifact.id))).toBe(
      false,
    );

    await fetch(`${baseUrl}/api/tasks/${taskId}`, { method: "DELETE" });
  });

  it("任务不存在时返回 404", async () => {
    const response = await fetch(`${baseUrl}/api/tasks/not-found/stream`);
    expect(response.status).toBe(404);
  });

  it("创建任务时拒绝不存在的工作区", async () => {
    const response = await postJson("/api/tasks", {
      goal: "测试任务",
      workspaceId: "not-exist",
    });
    expect(response.status).toBe(400);
  });

});

async function postJson(urlPath: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readStreamUntilTerminal(
  response: Response,
  taskId: string,
): Promise<TaskEvent[]> {
  if (!response.body) {
    throw new Error("SSE 响应没有可读流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: TaskEvent[] = [];
  let buffer = "";
  let sawEnd = false;

  while (!sawEnd) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseBlock(block);
      if (parsed?.type === "stream.end") {
        sawEnd = true;
      } else if (parsed) {
        events.push(parsed);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  return events;
}

function parseSseBlock(block: string): TaskEvent | StreamEndEvent | null {
  const lines = block.split("\n");
  let type = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      type = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }
  if (!data) {
    return null;
  }
  if (type === "stream.end") {
    return { type: "stream.end" };
  }
  return JSON.parse(data) as TaskEvent;
}

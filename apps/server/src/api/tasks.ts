import { Router } from "express";
import {
  BatchTaskActionInput,
  CreateTaskInput,
  TaskActionInput,
  TaskListQuery,
  type Task,
} from "@agent-console/contracts";
import { TaskRunner } from "../agent/runner";
import { config } from "../config";
import {
  artifactRepository,
  eventRepository,
  taskRepository,
  workspaceRepository,
  withTransaction,
} from "../db/repositories";
import { AppError } from "../errors";
import { createEvent, publishEvent } from "../services/events";
import { streamRouter } from "./stream";

export const tasksRouter = Router();

const ACTIVE_STATUSES: Task["status"][] = ["queued", "planning", "running", "paused"];
const TERMINAL_STATUSES: Task["status"][] = ["completed", "failed", "cancelled"];

tasksRouter.get("/", async (req, res) => {
  const parsed = TaskListQuery.safeParse({
    workspaceId: queryString(req.query.workspaceId),
    q: queryString(req.query.q),
    status: queryString(req.query.status),
    sort: queryString(req.query.sort),
    order: queryString(req.query.order),
    page: queryString(req.query.page),
    pageSize: queryString(req.query.pageSize),
  });
  if (!parsed.success) {
    throw new AppError(400, "invalid_task_query", "任务查询参数不合法", {
      issues: parsed.error.flatten(),
    });
  }
  res.json(await taskRepository.query(parsed.data));
});

tasksRouter.post("/", async (req, res) => {
  const parsed = CreateTaskInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_goal", "目标不能为空", {
      issues: parsed.error.flatten(),
    });
  }
  if (
    parsed.data.workspaceId &&
    !(await workspaceRepository.findById(parsed.data.workspaceId))
  ) {
    throw new AppError(400, "workspace_not_found", "工作区不存在");
  }

  const model = config.llm.provider === "openai" ? config.llm.model : "mock";
  const created = await withTransaction(async () => {
    const task = await taskRepository.create({
      goal: parsed.data.goal,
      model,
      workspaceId: parsed.data.workspaceId,
    });
    const event = await createEvent(task.id, "task.created", { task });
    return { task, event };
  });
  publishEvent(created.event);
  TaskRunner.start(created.task);
  res.status(201).json({ task: created.task });
});

tasksRouter.post("/batch/actions", async (req, res) => {
  const parsed = BatchTaskActionInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_batch_action", "批量操作参数不合法", {
      issues: parsed.error.flatten(),
    });
  }

  const { action, taskIds } = parsed.data;
  const tasks: Task[] = [];
  for (const id of taskIds) {
    const task = await taskRepository.findById(id);
    if (!task) {
      throw new AppError(404, "task_not_found", `任务不存在：${id}`);
    }
    tasks.push(task);
  }

  let processed = 0;
  let skipped = 0;
  const rerunTasks: Task[] = [];

  if (action === "delete") {
    for (const task of tasks) {
      await deleteTask(task);
      processed += 1;
    }
  } else if (action === "rerun") {
    for (const task of tasks) {
      if (!TERMINAL_STATUSES.includes(task.status)) {
        skipped += 1;
        continue;
      }
      rerunTasks.push(await resetTaskForRerun(task));
      processed += 1;
    }
  } else {
    for (const task of tasks) {
      const applied =
        action === "cancel"
          ? await cancelTask(task)
          : action === "pause"
            ? await pauseTask(task)
            : await resumeTask(task);
      if (applied) {
        processed += 1;
      } else {
        skipped += 1;
      }
    }
  }

  res.json({
    ok: true,
    processed,
    skipped,
    ...(action === "rerun" ? { tasks: rerunTasks } : {}),
  });
});

tasksRouter.get("/:id", async (req, res) => {
  const task = await taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ task });
});

tasksRouter.get("/:id/events", async (req, res) => {
  const task = await taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ events: await eventRepository.listByTask(task.id) });
});

tasksRouter.get("/:id/artifacts", async (req, res) => {
  const task = await taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ artifacts: await artifactRepository.listByTask(task.id) });
});

tasksRouter.get("/:id/artifacts/:artifactId/content", async (req, res) => {
  const task = await taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  const result = await artifactRepository.readContent(req.params.artifactId);
  if (!result || result.artifact.taskId !== task.id) {
    throw new AppError(404, "artifact_not_found", "产出物不存在");
  }

  res.setHeader("Content-Type", result.artifact.mimeType);
  res.setHeader("Content-Length", result.artifact.sizeBytes);
  if (req.query.download === "1") {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(result.artifact.name)}`,
    );
  }
  res.send(result.content);
});

tasksRouter.delete("/:id", async (req, res) => {
  const task = await taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  await deleteTask(task);
  res.status(204).end();
});

tasksRouter.post("/:id/actions", async (req, res) => {
  const parsed = TaskActionInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_action", "任务操作不合法", {
      issues: parsed.error.flatten(),
    });
  }

  const task = await taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  const action = parsed.data.action;
  if (action === "rerun") {
    if (!TERMINAL_STATUSES.includes(task.status)) {
      throw new AppError(409, "task_cannot_rerun", "只有已完成、失败或已取消的任务可以重跑");
    }
    res.status(201).json({ task: await resetTaskForRerun(task) });
    return;
  }

  if (action === "retry") {
    if (task.status !== "failed") {
      throw new AppError(409, "task_cannot_retry", "只有失败的任务可以续跑");
    }
    await retryTask(task);
  } else if (action === "pause") {
    if (!ACTIVE_STATUSES.includes(task.status) || task.status === "paused") {
      throw new AppError(409, "task_cannot_pause", "当前任务状态不能暂停");
    }
    if (!TaskRunner.get(task.id)) {
      throw new AppError(409, "task_not_running", "任务当前没有运行中的执行器");
    }
    await pauseTask(task);
  } else if (action === "resume") {
    if (task.status !== "paused") {
      throw new AppError(409, "task_not_paused", "任务当前不是暂停状态");
    }
    await resumeTask(task);
  } else if (action === "cancel") {
    if (!ACTIVE_STATUSES.includes(task.status)) {
      throw new AppError(409, "task_cannot_cancel", "当前任务状态不能取消");
    }
    await cancelTask(task);
  }

  res.json({ task: await taskRepository.findById(task.id) });
});

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function deleteTask(task: Task): Promise<void> {
  const runner = TaskRunner.get(task.id);
  if (runner) {
    runner.cancel();
  }
  await artifactRepository.deleteByTask(task.id);
  await taskRepository.remove(task.id);
}

async function cancelTask(task: Task): Promise<boolean> {
  if (!ACTIVE_STATUSES.includes(task.status)) {
    return false;
  }
  const runner = TaskRunner.get(task.id);
  if (!runner) {
    const event = await withTransaction(async () => {
      await taskRepository.update(task.id, {
        status: "cancelled",
        finishedAt: new Date().toISOString(),
      });
      return await createEvent(task.id, "task.status_changed", {
        from: task.status,
        to: "cancelled",
      });
    });
    publishEvent(event);
    return true;
  }
  runner.cancel();
  return true;
}

async function pauseTask(task: Task): Promise<boolean> {
  if (task.status !== "running" && task.status !== "planning") {
    return false;
  }
  const runner = TaskRunner.get(task.id);
  if (!runner) {
    return false;
  }
  runner.pause();
  return true;
}

async function resumeTask(task: Task): Promise<boolean> {
  if (task.status !== "paused") {
    return false;
  }
  const runner = TaskRunner.get(task.id) ?? (await TaskRunner.resume(task));
  runner.resume();
  return true;
}

async function retryTask(task: Task): Promise<boolean> {
  if (task.status !== "failed") {
    return false;
  }
  const runner = TaskRunner.get(task.id) ?? (await TaskRunner.resume(task));
  runner.resume();
  return true;
}

async function resetTaskForRerun(task: Task): Promise<Task> {
  const reset = await withTransaction(async () => {
    await artifactRepository.deleteByTask(task.id);
    await eventRepository.deleteByTask(task.id);
    const updated = await taskRepository.update(task.id, {
      status: "queued",
      currentStep: 0,
      totalSteps: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    if (!updated) {
      throw new Error(`任务不存在: ${task.id}`);
    }
    const event = await createEvent(task.id, "task.created", { task: updated });
    return { task: updated, event };
  });
  publishEvent(reset.event);
  TaskRunner.start(reset.task);
  return reset.task;
}

tasksRouter.use("/:id/stream", streamRouter);

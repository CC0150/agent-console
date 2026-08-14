import { Router } from "express";
import {
  ApprovalDecisionInput,
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
  approvalRepository,
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

tasksRouter.get("/", (req, res) => {
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
  res.json(taskRepository.query(parsed.data));
});

tasksRouter.post("/", (req, res) => {
  const parsed = CreateTaskInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_goal", "目标不能为空", {
      issues: parsed.error.flatten(),
    });
  }
  if (parsed.data.workspaceId && !workspaceRepository.findById(parsed.data.workspaceId)) {
    throw new AppError(400, "workspace_not_found", "工作区不存在");
  }

  const model = config.llm.provider === "openai" ? config.llm.model : "mock";
  const created = withTransaction(() => {
    const task = taskRepository.create({
      goal: parsed.data.goal,
      model,
      workspaceId: parsed.data.workspaceId,
    });
    const event = createEvent(task.id, "task.created", { task });
    return { task, event };
  });
  publishEvent(created.event);
  TaskRunner.start(created.task);
  res.status(201).json({ task: created.task });
});

tasksRouter.post("/batch/actions", (req, res) => {
  const parsed = BatchTaskActionInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_batch_action", "批量操作参数不合法", {
      issues: parsed.error.flatten(),
    });
  }

  const { action, taskIds } = parsed.data;
  const tasks = taskIds.map((id) => {
    const task = taskRepository.findById(id);
    if (!task) {
      throw new AppError(404, "task_not_found", `任务不存在：${id}`);
    }
    return task;
  });

  let processed = 0;
  let skipped = 0;
  const createdTasks: Task[] = [];

  if (action === "delete") {
    for (const task of tasks) {
      deleteTask(task);
      processed += 1;
    }
  } else if (action === "rerun") {
    for (const task of tasks) {
      if (!TERMINAL_STATUSES.includes(task.status)) {
        skipped += 1;
        continue;
      }
      createdTasks.push(createRerunTask(task));
      processed += 1;
    }
  } else {
    for (const task of tasks) {
      const applied =
        action === "cancel"
          ? cancelTask(task)
          : action === "pause"
            ? pauseTask(task)
            : resumeTask(task);
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
    ...(action === "rerun" ? { tasks: createdTasks } : {}),
  });
});

tasksRouter.get("/:id", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ task });
});

tasksRouter.get("/:id/events", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ events: eventRepository.listByTask(task.id) });
});

tasksRouter.get("/:id/artifacts", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ artifacts: artifactRepository.listByTask(task.id) });
});

tasksRouter.get("/:id/artifacts/:artifactId/content", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  const result = artifactRepository.readContent(req.params.artifactId);
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

tasksRouter.delete("/:id", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  deleteTask(task);
  res.status(204).end();
});

tasksRouter.post("/:id/actions", (req, res) => {
  const parsed = TaskActionInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_action", "任务操作不合法", {
      issues: parsed.error.flatten(),
    });
  }

  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  const action = parsed.data.action;
  if (action === "rerun") {
    res.status(201).json({ task: createRerunTask(task) });
    return;
  }

  if (action === "pause") {
    if (!ACTIVE_STATUSES.includes(task.status) || task.status === "paused") {
      throw new AppError(409, "task_cannot_pause", "当前任务状态不能暂停");
    }
    if (!TaskRunner.get(task.id)) {
      throw new AppError(409, "task_not_running", "任务当前没有运行中的执行器");
    }
    pauseTask(task);
  } else if (action === "resume") {
    if (task.status !== "paused") {
      throw new AppError(409, "task_not_paused", "任务当前不是暂停状态");
    }
    resumeTask(task);
  } else if (action === "cancel") {
    if (!ACTIVE_STATUSES.includes(task.status)) {
      throw new AppError(409, "task_cannot_cancel", "当前任务状态不能取消");
    }
    cancelTask(task);
  }

  res.json({ task: taskRepository.findById(task.id) });
});

tasksRouter.get("/:id/approvals", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }
  res.json({ approvals: approvalRepository.listPendingByTask(task.id) });
});

tasksRouter.post("/:id/approvals", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  const parsed = ApprovalDecisionInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_approval_decision", "审批参数不合法", {
      issues: parsed.error.flatten(),
    });
  }
  const approval = approvalRepository.findById(parsed.data.approvalId);
  if (!approval || approval.taskId !== task.id) {
    throw new AppError(404, "approval_not_found", "审批记录不存在");
  }

  const resolvedByRunner = TaskRunner.resolveApproval(
    parsed.data.approvalId,
    parsed.data.decision,
  );
  if (resolvedByRunner) {
    res.json({ ok: true });
    return;
  }

  const resolvedEvent = withTransaction(() => {
    const resolved = approvalRepository.resolve(
      parsed.data.approvalId,
      parsed.data.decision === "approve" ? "approved" : "rejected",
    );
    if (!resolved) {
      return null;
    }
    return createEvent(task.id, "approval.resolved", { approval: resolved });
  });
  if (!resolvedEvent) {
    throw new AppError(409, "approval_not_pending", "审批已处理或已过期");
  }
  publishEvent(resolvedEvent);

  res.json({ ok: true });
});

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function deleteTask(task: Task): void {
  const runner = TaskRunner.get(task.id);
  if (runner) {
    runner.cancel();
  }
  artifactRepository.deleteByTask(task.id);
  taskRepository.remove(task.id);
}

function cancelTask(task: Task): boolean {
  if (!ACTIVE_STATUSES.includes(task.status)) {
    return false;
  }
  const runner = TaskRunner.get(task.id);
  if (!runner) {
    const event = withTransaction(() => {
      taskRepository.update(task.id, {
        status: "cancelled",
        finishedAt: new Date().toISOString(),
      });
      return createEvent(task.id, "task.status_changed", {
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

function pauseTask(task: Task): boolean {
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

function resumeTask(task: Task): boolean {
  if (task.status !== "paused") {
    return false;
  }
  const runner = TaskRunner.get(task.id) ?? TaskRunner.resume(task);
  runner.resume();
  return true;
}

function createRerunTask(task: Task): Task {
  const created = withTransaction(() => {
    const nextTask = taskRepository.create({
      goal: task.goal,
      model: task.model,
      workspaceId: task.workspaceId,
    });
    const event = createEvent(nextTask.id, "task.created", { task: nextTask });
    return { task: nextTask, event };
  });
  publishEvent(created.event);
  TaskRunner.start(created.task);
  return created.task;
}

tasksRouter.use("/:id/stream", streamRouter);

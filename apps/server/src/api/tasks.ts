import { Router } from "express";
import {
  ApprovalDecisionInput,
  CreateTaskInput,
  TaskActionInput,
  type Task,
} from "@agent-console/contracts";
import { TaskRunner } from "../agent/runner";
import { config } from "../config";
import {
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

tasksRouter.get("/", (_req, res) => {
  const workspaceId =
    typeof _req.query.workspaceId === "string" ? _req.query.workspaceId : undefined;
  res.json({ tasks: taskRepository.list(workspaceId) });
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

tasksRouter.delete("/:id", (req, res) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    throw new AppError(404, "task_not_found", "任务不存在");
  }

  const runner = TaskRunner.get(task.id);
  if (runner) {
    runner.cancel();
  }

  taskRepository.remove(task.id);
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
    res.status(201).json({ task: created.task });
    return;
  }

  const runner = TaskRunner.get(task.id);

  if (action === "pause") {
    if (!ACTIVE_STATUSES.includes(task.status) || task.status === "paused") {
      throw new AppError(409, "task_cannot_pause", "当前任务状态不能暂停");
    }
    if (!runner) {
      throw new AppError(409, "task_not_running", "任务当前没有运行中的执行器");
    }
    runner.pause();
  } else if (action === "resume") {
    if (task.status !== "paused") {
      throw new AppError(409, "task_not_paused", "任务当前不是暂停状态");
    }
    const resumedRunner = runner ?? TaskRunner.resume(task);
    resumedRunner.resume();
  } else if (action === "cancel") {
    if (!ACTIVE_STATUSES.includes(task.status)) {
      throw new AppError(409, "task_cannot_cancel", "当前任务状态不能取消");
    }
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
      res.json({ task: taskRepository.findById(task.id) });
      return;
    }
    runner.cancel();
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

tasksRouter.use("/:id/stream", streamRouter);

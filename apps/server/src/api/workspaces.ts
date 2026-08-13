import { Router } from "express";
import { CreateWorkspaceInput } from "@agent-console/contracts";
import { workspaceRepository } from "../db/repositories";
import { AppError } from "../errors";

export const workspacesRouter = Router();

workspacesRouter.get("/", (_req, res) => {
  res.json({ workspaces: workspaceRepository.list() });
});

workspacesRouter.post("/", (req, res) => {
  const parsed = CreateWorkspaceInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "invalid_workspace", "工作区参数不合法", {
      issues: parsed.error.flatten(),
    });
  }
  const workspace = workspaceRepository.create({
    name: parsed.data.name,
    description: parsed.data.description,
  });
  res.status(201).json({ workspace });
});

workspacesRouter.delete("/:id", (req, res) => {
  const workspace = workspaceRepository.findById(req.params.id);
  if (!workspace) {
    throw new AppError(404, "workspace_not_found", "工作区不存在");
  }
  if (workspace.id === "default") {
    throw new AppError(409, "default_workspace_cannot_delete", "默认工作区不能删除");
  }
  workspaceRepository.remove(workspace.id);
  res.status(204).end();
});

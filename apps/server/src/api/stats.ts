import { Router } from "express";
import { taskRepository } from "../db/repositories";

export const statsRouter = Router();

statsRouter.get("/", async (req, res) => {
  const workspaceId =
    typeof req.query.workspaceId === "string" && req.query.workspaceId.length > 0
      ? req.query.workspaceId
      : undefined;
  res.json(await taskRepository.stats(workspaceId));
});

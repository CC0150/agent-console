import { Router } from "express";
import { toolRegistry } from "../tools/registry";

export const toolsRouter = Router();

toolsRouter.get("/", (_req, res) => {
  res.json({ tools: toolRegistry.list() });
});

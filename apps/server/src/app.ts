import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { statsRouter } from "./api/stats";
import { tasksRouter } from "./api/tasks";
import { toolsRouter } from "./api/tools";
import { workspacesRouter } from "./api/workspaces";
import { config } from "./config";
import { isDatabaseOpen } from "./db/client";
import { AppError } from "./errors";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      llm: {
        provider: config.llm.provider,
        model: config.llm.model,
      },
    });
  });
  app.get("/api/health/live", (_req, res) => {
    res.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });
  app.get("/api/health/ready", (_req, res) => {
    if (!isDatabaseOpen()) {
      res.status(503).json({
        ok: false,
        ready: false,
        error: { code: "database_not_ready", message: "数据库未就绪" },
      });
      return;
    }
    res.json({ ok: true, ready: true });
  });

  app.use("/api/tasks", tasksRouter);
  app.use("/api/workspaces", workspacesRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/tools", toolsRouter);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = (res.locals.requestId as string | undefined) ?? "unknown";
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        requestId,
      });
      return;
    }
    if (error instanceof SyntaxError && isBodyParseError(error)) {
      res.status(400).json({
        error: { code: "invalid_json", message: "请求体不是合法 JSON" },
        requestId,
      });
      return;
    }
    console.error(`[agent-console] unhandled error (request ${requestId})`, error);
    res.status(500).json({
      error: { code: "internal_error", message: "服务器内部错误" },
      requestId,
    });
  });

  return app;
}

function isBodyParseError(error: SyntaxError): boolean {
  return (
    "status" in error &&
    (error as { status?: number }).status === 400 &&
    "body" in error
  );
}

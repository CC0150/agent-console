import type { Server } from "node:http";
import { createApp } from "./app";
import { TaskRunner } from "./agent/runner";
import { config } from "./config";
import { closeDatabase } from "./db/client";
import { migrate } from "./db/schema";
import { logger } from "./logger";
import { recoverInterruptedTasks } from "./services/recovery";
import "./tools";

let server: Server | undefined;

async function main(): Promise<void> {
  await migrate();
  const recovered = await recoverInterruptedTasks();
  if (recovered > 0) {
    logger.info("已恢复中断任务", { recovered });
  }

  const app = createApp();
  server = app.listen(config.port, () => {
    logger.info("服务已启动", {
      url: `http://localhost:${config.port}`,
      provider: config.llm.provider,
    });
  });
}

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info("服务正在关闭");

  const closed = new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
  await TaskRunner.shutdown(10_000);
  server?.closeAllConnections?.();
  await closed;
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

void main().catch((error) => {
  logger.error("服务启动失败", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

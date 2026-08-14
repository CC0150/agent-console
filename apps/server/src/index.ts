import { createApp } from "./app";
import { TaskRunner } from "./agent/runner";
import { config } from "./config";
import { closeDatabase } from "./db/client";
import { migrate } from "./db/schema";
import { logger } from "./logger";
import { recoverInterruptedTasks } from "./services/recovery";
import "./tools";

migrate();
const recovered = recoverInterruptedTasks();
if (recovered > 0) {
  logger.info("已恢复中断任务", { recovered });
}

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info("服务已启动", {
    url: `http://localhost:${config.port}`,
    provider: config.llm.provider,
  });
});

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info("服务正在关闭");

  const closed = new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await TaskRunner.shutdown(10_000);
  server.closeAllConnections?.();
  await closed;
  closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

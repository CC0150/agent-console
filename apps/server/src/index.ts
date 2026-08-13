import { createApp } from "./app";
import { TaskRunner } from "./agent/runner";
import { config } from "./config";
import { closeDatabase } from "./db/client";
import { migrate } from "./db/schema";
import { recoverInterruptedTasks } from "./services/recovery";
import "./tools";

migrate();
const recovered = recoverInterruptedTasks();
if (recovered > 0) {
  console.log(`[agent-console] recovered ${recovered} interrupted task(s)`);
}

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[agent-console] server listening on http://localhost:${config.port}`);
});

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log("[agent-console] shutting down");

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

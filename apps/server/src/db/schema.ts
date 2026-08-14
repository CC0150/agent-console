import { db } from "./client";

const schema = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'mock',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
`;

const indexes = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_events_task_seq
  ON task_events(task_id, seq);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_created
  ON tasks(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artifacts_task_created
  ON artifacts(task_id, created_at DESC);
`;

export function migrate(): void {
  db.exec(schema);

  ensureTaskWorkspaceColumn();
  dedupeTaskEventSeqs();
  db.exec(indexes);

  const defaultWorkspace = db
    .prepare("SELECT COUNT(*) AS count FROM workspaces WHERE id = 'default'")
    .get() as { count: number };
  if (defaultWorkspace.count === 0) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO workspaces (id, name, description, created_at, updated_at)
       VALUES ('default', '默认工作区', '系统默认工作区', ?, ?)`,
    ).run(now, now);
  }
}

function ensureTaskWorkspaceColumn(): void {
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "workspace_id")) {
    return;
  }
  db.exec("ALTER TABLE tasks ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'");
}

function dedupeTaskEventSeqs(): void {
  db.exec(`
    DELETE FROM task_events
    WHERE id NOT IN (
      SELECT MIN(id) FROM task_events GROUP BY task_id, seq
    );
  `);
}

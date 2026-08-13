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

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  city TEXT NOT NULL,
  requirements TEXT NOT NULL,
  salary TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL
);
`;

const indexes = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_events_task_seq
  ON task_events(task_id, seq);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_created
  ON tasks(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approvals_task_status
  ON approvals(task_id, status);
`;

const seedJobs = [
  {
    title: "高级前端开发工程师",
    company: "杭州某电商平台",
    city: "杭州",
    requirements:
      "熟悉 React/TypeScript/Vite，掌握状态管理与前端工程化，有复杂后台或数据可视化经验加分。",
    salary: "25-40K·14薪",
    sourceUrl: "https://example.com/jobs/1",
  },
  {
    title: "前端工程师（React）",
    company: "杭州某 SaaS 公司",
    city: "杭州",
    requirements:
      "React、TypeScript、Tailwind 熟练，理解组件库建设与前端工程化，了解 Node.js 或全栈优先。",
    salary: "20-35K·13薪",
    sourceUrl: "https://example.com/jobs/2",
  },
  {
    title: "Web 前端开发（校招）",
    company: "杭州某互联网公司",
    city: "杭州",
    requirements:
      "计算机基础扎实，熟悉 HTML/CSS/JavaScript，有 Vue 或 React 项目经验，了解 HTTP 与浏览器原理。",
    salary: "200-300/天",
    sourceUrl: "https://example.com/jobs/3",
  },
  {
    title: "前端开发工程师（AI 应用方向）",
    company: "杭州某 AI 公司",
    city: "杭州",
    requirements:
      "React 与 TypeScript，理解 LLM API、Agent 或 RAG 应用，熟悉 SSE 与流式渲染优先。",
    salary: "30-50K·15薪",
    sourceUrl: "https://example.com/jobs/4",
  },
];

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

  const row = db.prepare("SELECT COUNT(*) AS count FROM job_postings").get() as {
    count: number;
  };
  if (row.count > 0) {
    return;
  }

  const insert = db.prepare(
    `INSERT INTO job_postings (title, company, city, requirements, salary, source_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  const seed = db.transaction(() => {
    for (const job of seedJobs) {
      insert.run(job.title, job.company, job.city, job.requirements, job.salary, job.sourceUrl, now);
    }
  });
  seed();
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

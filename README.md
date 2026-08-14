# Agent Console

Agent 任务执行与回放控制台。输入一个目标，Agent 生成执行计划、调用工具、流式输出结果；任务详情页按对话维度展示助手消息、工具调用和工具结果，回放页也可以随进度逐步查看同一份对话。你可以按工作区组织任务，暂停、继续、取消、重跑，并查看完整事件回放和统计。

## 技术栈

- Web：React 19 + TypeScript + Vite + Tailwind CSS
- 服务端：Node.js + Express + TypeScript
- 数据：SQLite + better-sqlite3
- 状态：TanStack Query（服务端状态）+ Zustand（流式瞬时状态）
- 实时：SSE + `Last-Event-ID` 断线重连
- Agent：自研 Agent Loop + ToolRegistry，默认 Mock LLM，可切换 OpenAI 兼容接口
- 协作：工作区分组、任务暂停与续跑

## 快速开始

```bash
npm.cmd install
npm.cmd run dev
```

打开 http://localhost:5173 ，服务端运行在 http://localhost:3001 。

如果本机 PowerShell 禁止执行 `npm.ps1`，统一使用 `npm.cmd` 命令。

## 环境变量

默认使用 Mock LLM，不需要任何 Key 即可跑通完整链路。复制 `apps/server/.env.example` 为 `apps/server/.env` 后填入真实配置，可切换到 OpenAI 兼容接口：

```env
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your-key
LLM_MODEL=gpt-4.1-mini
LLM_MAX_CONTEXT_TOKENS=16000
LLM_MAX_HISTORY_MESSAGES=80
```

真实模型支持流式输出、多轮 tool calling 和 token usage 记录；上下文接近上限时，服务端会保留 system 与最后一个 user 消息，并按最近轮次裁剪历史。

## 目录结构

```text
agent-console/
├─ apps/
│  ├─ web/          # React 前端
│  └─ server/       # Express + Agent Loop + 工具
├─ packages/
│  └─ contracts/    # zod schema 与共享类型
├─ docs/            # 架构与 API 文档
├─ package.json     # npm workspaces
└─ .gitignore
```

## 常用命令

```bash
npm.cmd run dev          # 同时启动服务端和前端
npm.cmd run dev:server   # 只启动服务端
npm.cmd run dev:web      # 只启动前端
npm.cmd run typecheck    # 全仓类型检查
npm.cmd run test         # 全仓测试
npm.cmd run build        # 构建服务端和前端
```

## 内置工具

- `http_request`：调用外部 HTTP(S) API，支持自定义方法、查询参数、请求头和 JSON body
- `write_report`：生成 Markdown 或文本报告并保存为任务产出物

`http_request` 默认允许访问任意 http/https 地址。可通过 `.env` 中的 `HTTP_TOOL_ALLOWED_HOSTS` 配置白名单，使用 `,` 分隔，支持 `*.example.com` 通配符；`HTTP_TOOL_TIMEOUT_MS` 和 `HTTP_TOOL_MAX_RESPONSE_BYTES` 控制超时与响应大小。

## 下一步路线

- 增加更多本地工具：`read_file`、`export_markdown`
- 接入 MCP Server，动态发现外部工具
- 事件回放增加按时间轴拖动与批量跳转
- 增加任务统计趋势图和工具调用耗时分布
- 接入 PostgreSQL、Docker Compose 与 CI

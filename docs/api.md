# API 文档

基础路径：`http://localhost:3001/api`

## REST 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET | `/tasks?workspaceId=xxx` | 任务列表，可按工作区筛选 |
| POST | `/tasks` | 创建任务，body 为 `{ "goal": "...", "workspaceId": "..." }` |
| GET | `/tasks/:id` | 任务详情 |
| GET | `/tasks/:id/events` | 任务事件列表，用于历史回放 |
| POST | `/tasks/:id/actions` | 任务控制，body 为 `{ "action": "pause" \| "resume" \| "cancel" \| "rerun" }` |
| GET | `/workspaces` | 工作区列表 |
| POST | `/workspaces` | 创建工作区，body 为 `{ "name": "...", "description": "..." }` |
| DELETE | `/workspaces/:id` | 删除工作区，任务自动移到默认工作区 |
| GET | `/stats` | 任务统计 |
| GET | `/tools` | 已注册工具列表 |

## SSE 接口

`GET /api/tasks/:id/stream`

服务端按标准 SSE 格式推送事件，每条事件包含 `id`、`event`、`data` 三行：

```text
id: 4
event: tool.started
data: {"id":"...","taskId":"...","seq":4,"createdAt":"...","type":"tool.started","payload":{"toolCall":{...}}}
```

任务进入终态后，SSE 会推送 `stream.end` 并关闭连接。

浏览器 `EventSource` 会自动维护 `Last-Event-ID`，重连时从断点之后的事件继续推送。

任务进入终态后，服务端发送 `stream.end` 并关闭连接。

## 创建任务示例

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"goal":"搜索杭州前端岗位要求"}'
```

返回：

```json
{
  "task": {
    "id": "...",
    "goal": "搜索杭州前端岗位要求",
    "status": "queued",
    "model": "mock"
  }
}
```

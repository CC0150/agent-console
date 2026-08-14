import type { TaskEvent } from "@agent-console/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReplayTimeline } from "./ReplayTimeline";

function event(
  seq: number,
  type: TaskEvent["type"],
  payload: TaskEvent["payload"],
): TaskEvent {
  return {
    id: `event-${seq}`,
    taskId: "task-1",
    seq,
    createdAt: "2026-08-13T00:00:00.000Z",
    type,
    payload,
  } as TaskEvent;
}

const events = [
  event(1, "message.delta", { delta: "杭州岗位要求如下" }),
  event(2, "tool.started", {
    toolCall: {
      id: "call-1",
      taskId: "task-1",
      toolName: "write_report",
      input: { title: "岗位调研报告" },
      state: "running",
      output: null,
      error: null,
      startedAt: "2026-08-13T00:00:00.100Z",
      finishedAt: null,
      durationMs: null,
    },
  }),
] as TaskEvent[];

function countReplayEvents(html: string): number {
  return (html.match(/data-replay-event="true"/g) ?? []).length;
}

describe("ReplayTimeline", () => {
  it("按事件类型渲染筛选后的时间线", () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline
        events={events}
        cursor={0}
        onSeek={() => undefined}
        filter="message.delta"
        query=""
        onFilterChange={() => undefined}
        onQueryChange={() => undefined}
      />,
    );

    expect(countReplayEvents(html)).toBe(1);
    expect(html).toContain("1 / 2 条事件");
  });

  it("按关键词渲染筛选后的时间线", () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline
        events={events}
        cursor={0}
        onSeek={() => undefined}
        filter="all"
        query="岗位"
        onFilterChange={() => undefined}
        onQueryChange={() => undefined}
      />,
    );

    expect(countReplayEvents(html)).toBe(2);
  });

  it("没有匹配事件时展示空态", () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline
        events={events}
        cursor={0}
        onSeek={() => undefined}
        filter="all"
        query="不存在的关键词"
        onFilterChange={() => undefined}
        onQueryChange={() => undefined}
      />,
    );

    expect(countReplayEvents(html)).toBe(0);
    expect(html).toContain("没有匹配的事件");
  });
});

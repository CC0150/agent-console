import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@agent-console/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  History,
  Link2,
  ListVideo,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorBanner, toErrorMessage } from "../../components/ui/ErrorBanner";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tooltip } from "../../components/ui/Tooltip";
import { api } from "../../lib/api";
import {
  extractPlan,
  extractStreamText,
  extractToolCalls,
  mergeEvents,
} from "../../lib/taskEvents";
import { deriveReplayStatus } from "../../lib/replay";
import { useRunStore } from "../../stores/runStore";
import { ConversationView } from "./ConversationView";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_STYLES,
  summarizeEvent,
} from "./EventLog";
import { PlanTimeline } from "./PlanTimeline";
import { ReplayTimeline } from "./ReplayTimeline";
import {
  buildReplayReport,
  findEventIndexBySeq,
  type ReplayFilter,
} from "./replayControls";
import { StreamConsole } from "./StreamConsole";
import { TaskPageSkeleton } from "./TaskPageSkeleton";
import { ToolCallCard } from "./ToolCallCard";

type ReplaySpeed = 1 | 2 | 4 | 8;

const REPLAY_SPEEDS: ReplaySpeed[] = [1, 2, 4, 8];
const TERMINAL_STATUSES: Task["status"][] = ["completed", "failed", "cancelled"];

function isTerminalTask(task: Task | undefined): boolean {
  return task != null && TERMINAL_STATUSES.includes(task.status);
}

export function TaskReplayPage() {
  const { taskId = "" } = useParams<{ taskId: string }>();
  const queryClient = useQueryClient();
  const { events: liveEvents, connection, connect, disconnect } = useRunStore();
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(2);
  const [filter, setFilter] = useState<ReplayFilter>("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const deepLinkApplied = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkSeq = searchParams.get("event");

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.getTask(taskId),
    enabled: Boolean(taskId),
    refetchInterval: (query) =>
      connection === "ended" || isTerminalTask(query.state.data?.task)
        ? false
        : 2_000,
  });
  const task = taskQuery.data?.task;
  const terminal = isTerminalTask(task);
  const historyQuery = useQuery({
    queryKey: ["events", taskId],
    queryFn: () => api.getEvents(taskId),
    enabled: Boolean(taskId),
    refetchInterval:
      connection === "open" || connection === "ended" || terminal
        ? false
        : 2_000,
  });
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.listWorkspaces,
  });

  useEffect(() => {
    if (!taskId) {
      return;
    }
    connect(taskId);
    return () => disconnect();
  }, [taskId, connect, disconnect]);

  const workspace = workspacesQuery.data?.workspaces.find(
    (item) => item.id === task?.workspaceId,
  );

  useEffect(() => {
    if (terminal) {
      disconnect();
    }
  }, [terminal, disconnect]);

  useEffect(() => {
    if (connection !== "ended") {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["events", taskId] });
  }, [connection, taskId, queryClient]);

  const allEvents = useMemo(
    () => mergeEvents(historyQuery.data?.events ?? [], liveEvents),
    [historyQuery.data, liveEvents],
  );

  useEffect(() => {
    deepLinkApplied.current = false;
  }, [taskId, deepLinkSeq]);

  useEffect(() => {
    if (deepLinkApplied.current || allEvents.length === 0) {
      return;
    }
    const seq = Number(deepLinkSeq);
    if (!Number.isInteger(seq) || seq <= 0) {
      return;
    }
    const index = findEventIndexBySeq(allEvents, seq);
    if (index == null) {
      return;
    }
    setPlaying(false);
    setCursor(index + 1);
    deepLinkApplied.current = true;
  }, [allEvents, deepLinkSeq]);

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [taskId]);

  useEffect(() => {
    if (cursor > allEvents.length) {
      setCursor(allEvents.length);
    }
  }, [allEvents.length, cursor]);

  useEffect(() => {
    if (!playing || cursor >= allEvents.length) {
      if (playing && cursor >= allEvents.length) {
        setPlaying(false);
      }
      return;
    }
    const timer = window.setTimeout(
      () => {
        setCursor((value) => Math.min(value + 1, allEvents.length));
      },
      Math.max(110, Math.round(950 / speed)),
    );
    return () => window.clearTimeout(timer);
  }, [playing, cursor, allEvents.length, speed]);

  const visibleEvents = useMemo(() => allEvents.slice(0, cursor), [allEvents, cursor]);
  const replayStatus = deriveReplayStatus(visibleEvents);
  const waitingForPlan =
    (historyQuery.isLoading && allEvents.length === 0) ||
    (playing &&
      cursor > 0 &&
      ["queued", "planning", "running", "paused"].includes(replayStatus));
  const plan = useMemo(() => extractPlan(visibleEvents), [visibleEvents]);
  const toolCalls = useMemo(() => extractToolCalls(visibleEvents), [visibleEvents]);
  const streamText = useMemo(() => extractStreamText(visibleEvents), [visibleEvents]);
  const currentEvent = cursor > 0 ? allEvents[cursor - 1] : undefined;

  const syncEventLink = (seq: number | null) => {
    setSearchParams(seq == null ? {} : { event: String(seq) }, { replace: true });
  };

  const togglePlayback = () => {
    if (cursor >= allEvents.length) {
      setCursor(0);
      syncEventLink(null);
    }
    setPlaying((value) => !value);
  };
  const restart = () => {
    setPlaying(false);
    setCursor(0);
    syncEventLink(null);
  };
  const stepBack = () => {
    setPlaying(false);
    const next = Math.max(0, cursor - 1);
    setCursor(next);
    syncEventLink(next > 0 ? allEvents[next - 1]?.seq ?? null : null);
  };
  const stepForward = () => {
    setPlaying(false);
    const next = Math.min(allEvents.length, cursor + 1);
    setCursor(next);
    syncEventLink(next > 0 ? allEvents[next - 1]?.seq ?? null : null);
  };
  const seekToEvent = (index: number) => {
    setPlaying(false);
    setCursor(index + 1);
    syncEventLink(allEvents[index]?.seq ?? null);
  };

  const copyEventLink = async () => {
    if (!currentEvent) {
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?event=${currentEvent.seq}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  };

  const exportReport = () => {
    if (!task) {
      return;
    }
    const markdown = buildReplayReport({
      task,
      workspaceName: workspace?.name,
      events: allEvents,
      plan,
      toolCalls,
      streamText,
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agent-replay-${task.id.slice(0, 8)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (taskQuery.isLoading) {
    return <TaskPageSkeleton />;
  }

  if (!task) {
    if (taskQuery.error) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="任务加载失败"
          description={toErrorMessage(taskQuery.error)}
          action={
            <button
              type="button"
              onClick={() => taskQuery.refetch()}
              className="inline-flex h-9 items-center rounded-md border border-signal-500/30 bg-signal-500/10 px-4 text-sm font-medium text-signal-300 transition hover:bg-signal-500/20"
            >
              重新加载
            </button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={ArrowLeft}
        title="任务不存在"
        description="返回任务总览重新选择一个任务"
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="reveal space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/tasks/${task.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-700/30 bg-ink-700/10 px-3 text-sm font-medium text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300"
          >
            <ArrowLeft className="h-4 w-4" />
            任务详情
          </Link>
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-700/30 bg-ink-700/10 px-3 text-sm font-medium text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300"
          >
            任务总览
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-signal-500/25 bg-signal-500/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.08em] text-signal-300">
            <History className="h-3.5 w-3.5" />
            事件回放
          </span>
        </div>

        <div>
          <p className="eyebrow mb-1 text-signal-400">
            任务回放 / {task.id.slice(0, 8)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-bold text-ink-100">
              {task.goal}
            </h1>
            <StatusBadge status={replayStatus} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] text-ink-400">
            <span className="inline-flex items-center rounded border border-ink-700/30 bg-ink-700/10 px-2 py-0.5">
              {workspace?.name ?? task.workspaceId}
            </span>
            <span>{new Date(task.createdAt).toLocaleString("zh-CN")}</span>
          </div>
        </div>
      </header>

      {taskQuery.error ? (
        <ErrorBanner
          message={`任务加载异常：${toErrorMessage(taskQuery.error)}`}
          onRetry={() => taskQuery.refetch()}
        />
      ) : null}

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400">
              <ListVideo className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink-100">回放控制台</h2>
              <p className="eyebrow mt-0.5">播放 / 步进 / 进度</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
              {cursor} / {allEvents.length}
            </span>
            <Tooltip content="复制当前事件链接">
              <button
                type="button"
                disabled={!currentEvent}
                onClick={copyEventLink}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink-700/30 bg-ink-700/10 px-2.5 text-xs font-medium text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {copied ? "已复制" : "复制链接"}
                </span>
              </button>
            </Tooltip>
            <Tooltip content="导出 Markdown 回放报告">
              <button
                type="button"
                onClick={exportReport}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-signal-500/25 bg-signal-500/10 px-2.5 text-xs font-medium text-signal-300 transition hover:border-signal-500/40 hover:bg-signal-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">导出报告</span>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip content="重新开始">
              <button
                type="button"
                aria-label="重新开始"
                disabled={allEvents.length === 0}
                onClick={restart}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink-700/30 bg-ink-700/10 text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip content="后退一步">
              <button
                type="button"
                aria-label="后退一步"
                disabled={cursor === 0}
                onClick={stepBack}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink-700/30 bg-ink-700/10 text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <SkipBack className="h-4 w-4" />
              </button>
            </Tooltip>
            <button
              type="button"
              disabled={allEvents.length === 0}
              onClick={togglePlayback}
              className="inline-flex h-9 min-w-[92px] items-center justify-center gap-2 rounded-md bg-signal-500 px-4 text-sm font-semibold text-[var(--button-ink)] shadow-[0_8px_24px_rgba(240,165,46,0.18)] transition hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {playing
                ? "暂停"
                : cursor >= allEvents.length && allEvents.length > 0
                  ? "重新播放"
                  : "播放"}
            </button>
            <Tooltip content="前进一步">
              <button
                type="button"
                aria-label="前进一步"
                disabled={cursor >= allEvents.length}
                onClick={stepForward}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink-700/30 bg-ink-700/10 text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </Tooltip>

            <div className="ml-auto flex items-center gap-1 rounded-md border border-ink-700/30 bg-ink-950/60 p-1">
              <span className="eyebrow px-2">速度</span>
              {REPLAY_SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeed(value)}
                  className={`h-7 rounded px-2.5 font-mono text-xs transition ${
                    speed === value
                      ? "bg-signal-500 text-[var(--button-ink)]"
                      : "text-ink-400 hover:bg-ink-700/15 hover:text-ink-200"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="w-12 shrink-0 text-right font-mono text-xs text-ink-400">
              {cursor}
            </span>
            <input
              type="range"
              aria-label="回放进度"
              min={0}
              max={Math.max(0, allEvents.length)}
              step={1}
              value={cursor}
              onChange={(event) => {
                setPlaying(false);
                const next = Number(event.target.value);
                setCursor(next);
                syncEventLink(
                  next > 0 ? allEvents[next - 1]?.seq ?? null : null,
                );
              }}
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink-700/30 accent-[var(--color-signal-500)]"
            />
            <span className="w-12 shrink-0 font-mono text-xs text-ink-400">
              {allEvents.length}
            </span>
          </div>

          <div
            data-replay-current="true"
            className="mt-4 min-h-[54px] rounded-md border border-ink-700/25 bg-ink-950/50 px-4 py-3"
          >
            {currentEvent ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] font-medium ${EVENT_TYPE_STYLES[currentEvent.type]}`}
                >
                  {EVENT_TYPE_LABELS[currentEvent.type]}
                </span>
                <span className="font-mono text-xs text-ink-500">
                  #{currentEvent.seq}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-300">
                  {summarizeEvent(currentEvent)}
                </span>
                <span className="shrink-0 font-mono text-xs text-ink-500">
                  {new Date(currentEvent.createdAt).toLocaleTimeString("zh-CN")}
                </span>
              </div>
            ) : (
              <span className="text-sm text-ink-400">
                尚未开始回放，点击播放或时间线事件查看过程
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-7">
          <ReplayTimeline
            events={allEvents}
            cursor={cursor}
            onSeek={seekToEvent}
            filter={filter}
            query={query}
            onFilterChange={setFilter}
            onQueryChange={setQuery}
          />
          <ConversationView
            events={visibleEvents}
            goal={task.goal}
            createdAt={task.createdAt}
            status={replayStatus}
          />
        </div>

        <div className="min-w-0 space-y-5 xl:col-span-5">
          <PlanTimeline
            plan={plan}
            status={replayStatus}
            toolCalls={toolCalls}
            waiting={waitingForPlan}
            idleMessage={
              cursor > 0
                ? "回放已暂停，点击播放继续查看"
                : "尚未开始回放，点击播放查看执行计划"
            }
          />

          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                  <Wrench className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">当前工具</h2>
                  <p className="eyebrow mt-0.5">快照 / 工具调用</p>
                </div>
              </div>
              <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
                {toolCalls.length} 次调用
              </span>
            </div>
            {toolCalls.length === 0 ? (
              <EmptyState
                compact
                icon={Wrench}
                title="暂无工具调用"
                description="回放到对应事件时会在这里展示工具快照"
              />
            ) : (
              <div className="max-h-[340px] space-y-3 overflow-y-auto scroll-active p-4">
                {toolCalls.map((toolCall) => (
                  <ToolCallCard key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            )}
          </section>

          <StreamConsole text={streamText} status={replayStatus} />
        </div>
      </div>
    </div>
  );
}

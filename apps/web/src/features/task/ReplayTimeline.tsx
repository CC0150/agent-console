import type { TaskEvent } from "@agent-console/contracts";
import { useDebouncedInput } from "../../hooks/useDebounce";
import { Tooltip } from "../../components/ui/Tooltip";
import { ListFilter, ListVideo, Search, X } from "lucide-react";
import { useMemo } from "react";
import { SelectField } from "../../components/ui/SelectField";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_STYLES,
  summarizeEvent,
} from "./EventLog";
import {
  filterReplayEvents,
  REPLAY_FILTER_OPTIONS,
  type ReplayFilter,
} from "./replayControls";

interface ReplayTimelineProps {
  events: TaskEvent[];
  cursor: number;
  onSeek: (index: number) => void;
  filter: ReplayFilter;
  query: string;
  onFilterChange: (filter: ReplayFilter) => void;
  onQueryChange: (query: string) => void;
}

export function ReplayTimeline({
  events,
  cursor,
  onSeek,
  filter,
  query,
  onFilterChange,
  onQueryChange,
}: ReplayTimelineProps) {
  const [searchInput, setSearchInput] = useDebouncedInput(query, onQueryChange);
  const visibleEvents = useMemo(
    () => filterReplayEvents(events, { type: filter, query }),
    [events, filter, query],
  );
  const indexBySeq = useMemo(
    () => new Map(events.map((event, index) => [event.seq, index])),
    [events],
  );
  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400">
            <ListVideo className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-100">回放时间轴</h2>
            <p className="eyebrow mt-0.5">事件 / 执行轨迹</p>
          </div>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {visibleEvents.length} / {events.length} 条事件
        </span>
      </div>

      <div className="border-b border-ink-700/25 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            value={filter}
            onValueChange={(value) => onFilterChange(value as ReplayFilter)}
            options={REPLAY_FILTER_OPTIONS}
            label="事件类型筛选"
            icon={<ListFilter className="h-3.5 w-3.5" />}
          />

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索事件内容"
              aria-label="搜索事件内容"
              className="h-9 w-full rounded-md border border-ink-700/30 bg-ink-950/70 pl-9 pr-8 text-sm text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-signal-500/60 focus:ring-2 focus:ring-signal-500/15"
            />
            {searchInput ? (
              <Tooltip content="清除搜索">
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ink-400 transition hover:bg-ink-700/20 hover:text-ink-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-h-[620px] min-h-[300px] overflow-y-auto scroll-active">
        {visibleEvents.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-400">
            没有符合筛选条件的事件
          </p>
        ) : (
          <ol className="px-4 py-3">
            {visibleEvents.map((event) => {
              const index = indexBySeq.get(event.seq) ?? 0;
              const played = index < cursor;
              const current = index === cursor - 1;
              return (
                <li key={event.id} data-replay-event="true" className="relative">
                  <span
                    className={`absolute bottom-0 left-[15px] top-9 w-px ${
                      index < events.length - 1 ? "bg-ink-700/25" : "bg-transparent"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onSeek(index)}
                    className={`relative z-10 flex w-full items-start gap-3 rounded-md py-3 pl-1 pr-3 text-left transition ${
                      current
                        ? "bg-signal-500/[0.08]"
                        : "hover:bg-ink-700/15"
                    } ${played ? "" : "opacity-45"}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${
                        current
                          ? "border-signal-500/60 bg-signal-500/20 text-signal-300"
                          : "border-ink-700/30 bg-ink-900 text-ink-500"
                      }`}
                    >
                      {event.seq}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[11px] font-medium ${EVENT_TYPE_STYLES[event.type]}`}
                        >
                          {EVENT_TYPE_LABELS[event.type]}
                        </span>
                        <span className="font-mono text-[11px] text-ink-500">
                          {formatTime(event.createdAt)}
                        </span>
                        {current ? (
                          <span className="rounded-full border border-signal-500/30 bg-signal-500/10 px-2 py-0.5 font-mono text-[11px] text-signal-300">
                            当前
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`mt-1.5 block truncate text-sm leading-5 ${
                          played ? "text-ink-300" : "text-ink-500"
                        }`}
                      >
                        {summarizeEvent(event)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

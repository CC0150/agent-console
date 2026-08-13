import type { ToolCall } from "@agent-console/contracts";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const STATE_LABELS: Record<ToolCall["state"], string> = {
  pending: "等待中",
  running: "执行中",
  requires_approval: "待审批",
  rejected: "已拒绝",
  succeeded: "成功",
  failed: "失败",
};

const STATE_STYLES: Record<ToolCall["state"], string> = {
  pending: "border-ink-700/30 text-ink-300",
  running: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  requires_approval: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  rejected: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  succeeded: "border-mint-500/25 bg-mint-500/10 text-mint-300",
  failed: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [open, setOpen] = useState(false);
  const duration =
    toolCall.durationMs == null ? null : `${(toolCall.durationMs / 1000).toFixed(1)}s`;

  return (
    <div
      data-tool-call="true"
      className="min-w-0 overflow-hidden rounded-md border border-ink-700/30 bg-ink-950/60"
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-ink-700/15"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-700/25 bg-ink-700/10 text-ink-300">
          <Wrench className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-ink-100">
            {toolCall.toolName}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-400">
            <span
              className={`rounded-full border px-2 py-0.5 ${STATE_STYLES[toolCall.state]}`}
            >
              {STATE_LABELS[toolCall.state]}
            </span>
            {duration ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {duration}
              </span>
            ) : null}
          </p>
        </div>
        {toolCall.state === "failed" ? (
          <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
        ) : toolCall.state === "rejected" ? (
          <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
        ) : toolCall.state === "requires_approval" ? (
          <Clock className="h-4 w-4 shrink-0 text-amber-400" />
        ) : toolCall.state === "succeeded" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-mint-400" />
        ) : null}
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
        )}
      </button>

      {open ? (
        <div className="min-w-0 space-y-3 border-t border-ink-700/30 bg-ink-900/60 px-3.5 py-3">
          <div className="min-w-0">
            <p className="eyebrow mb-1.5">输入</p>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-md border border-ink-700/30 bg-ink-950 p-3 font-mono text-sm leading-6 text-ink-200">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output != null ? (
            <div className="min-w-0">
              <p className="eyebrow mb-1.5">输出</p>
              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-md border border-ink-700/30 bg-ink-950 p-3 font-mono text-sm leading-6 text-ink-200">
                {typeof toolCall.output === "string"
                  ? toolCall.output
                  : JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          ) : null}
          {toolCall.error ? (
            <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm leading-6 text-rose-300">
              错误：{toolCall.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

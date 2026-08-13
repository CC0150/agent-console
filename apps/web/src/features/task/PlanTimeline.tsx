import type { PlanStep, Task, ToolCall } from "@agent-console/contracts";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Wrench,
  XCircle,
} from "lucide-react";

interface PlanTimelineProps {
  plan: PlanStep[];
  status: Task["status"];
  toolCalls: ToolCall[];
  waiting?: boolean;
  idleMessage?: string;
}

export function PlanTimeline({
  plan,
  status,
  toolCalls,
  waiting,
  idleMessage,
}: PlanTimelineProps) {
  if (plan.length === 0) {
    const waitingForPlan =
      waiting ?? ["queued", "planning", "running", "paused"].includes(status);
    if (waitingForPlan) {
      return (
        <section className="panel border-dashed px-4 py-10 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-signal-400" />
          <p className="mt-3 text-sm font-medium text-ink-300">
            等待 Agent 生成执行计划
          </p>
        </section>
      );
    }

    const idle = status === "queued";
    const finished = status === "completed";
    return (
      <section className="panel border-dashed px-4 py-10 text-center">
        {idle ? (
          <Play className="mx-auto h-5 w-5 text-signal-400" />
        ) : finished ? (
          <CheckCircle2 className="mx-auto h-5 w-5 text-mint-400" />
        ) : (
          <XCircle className="mx-auto h-5 w-5 text-rose-400" />
        )}
        <p className="mt-3 text-sm font-medium text-ink-300">
          {idle
            ? idleMessage ?? "尚未开始回放，点击播放查看执行计划"
            : finished
              ? "本次任务未调用工具"
              : "任务未生成工具执行计划"}
        </p>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400">
            <Wrench className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-100">执行计划</h2>
            <p className="eyebrow mt-0.5">计划 / 步骤</p>
          </div>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {plan.length} 步
        </span>
      </div>

      <ol className="px-5 py-5">
        {plan.map((step, index) => {
          const state = toolCalls[index]?.state ?? "pending";
          return (
            <li key={step.id} data-plan-step="true" className="relative flex gap-3 pb-5 last:pb-0">
              {index < plan.length - 1 ? (
                <span className="absolute bottom-0 left-[15px] top-9 w-px bg-ink-700/25" />
              ) : null}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-700/30 bg-ink-900">
                {renderState(state, index)}
              </div>
              <div className="min-w-0 flex-1 pt-1.5">
                <p className="text-[15px] font-semibold leading-6 text-ink-100">{step.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded border border-ink-700/30 bg-ink-700/10 px-1.5 py-0.5 font-mono text-xs text-ink-300">
                    {step.toolName}
                  </span>
                  <span className="font-mono text-xs text-ink-500">
                    步骤 {index + 1}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function renderState(state: ToolCall["state"] | "pending", index: number) {
  if (state === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />;
  }
  if (state === "requires_approval") {
    return <Clock className="h-4 w-4 text-amber-400" />;
  }
  if (state === "succeeded") {
    return <CheckCircle2 className="h-4 w-4 text-mint-400" />;
  }
  if (state === "failed" || state === "rejected") {
    return <XCircle className="h-4 w-4 text-rose-400" />;
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center font-mono text-xs font-bold text-ink-500">
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

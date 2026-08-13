import { Activity, CheckCircle2, Clock, Gauge } from "lucide-react";
import type { TaskStats } from "../../lib/api";

interface StatsPanelProps {
  stats?: TaskStats;
  isLoading: boolean;
}

export function StatsPanel({ stats, isLoading }: StatsPanelProps) {
  const items = [
    {
      label: "总任务",
      code: "总计",
      value: stats?.total ?? 0,
      icon: Activity,
      iconClass: "text-ink-300",
    },
    {
      label: "执行中",
      code: "执行中",
      value: stats?.byStatus.running ?? 0,
      icon: Clock,
      iconClass: "text-cyan-400",
    },
    {
      label: "已完成",
      code: "已完成",
      value: stats?.byStatus.completed ?? 0,
      icon: CheckCircle2,
      iconClass: "text-mint-400",
    },
    {
      label: "成功率",
      code: "成功率",
      value:
        stats?.successRate == null
          ? "—"
          : `${Math.round(stats.successRate * 100)}%`,
      icon: Gauge,
      iconClass: "text-signal-400",
    },
  ];

  return (
    <section className="reveal reveal-delay-2 overflow-hidden rounded-md border border-ink-700/25 bg-ink-900/70">
      <div className="grid grid-cols-2 divide-ink-700/25 lg:grid-cols-4 lg:divide-x">
        {items.map((item) => (
          <div key={item.code} className="flex items-center gap-3.5 px-5 py-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-700/25 bg-ink-700/10 ${item.iconClass}`}>
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{item.code}</p>
              <p className="mt-0.5 truncate text-2xl font-semibold leading-7 text-ink-100">
                {isLoading ? "…" : item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

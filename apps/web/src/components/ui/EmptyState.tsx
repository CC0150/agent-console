/**
 * 空状态占位组件：用于列表无数据、无任务等场景的统一提示。
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact
          ? "border-t border-dashed border-ink-700/25 px-6 py-10"
          : "panel border-dashed px-6 py-12"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400 ${
          compact ? "h-9 w-9" : "h-12 w-12"
        }`}
      >
        <Icon className={compact ? "h-4 w-4" : "h-6 w-6"} />
      </span>
      <p
        className={`mt-4 font-semibold text-ink-100 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {title}
      </p>
      <p className={`mt-1 text-ink-400 ${compact ? "text-[11px]" : "text-xs"}`}>
        {description}
      </p>
      {action ? <div className={compact ? "mt-3" : "mt-4"}>{action}</div> : null}
    </div>
  );
}

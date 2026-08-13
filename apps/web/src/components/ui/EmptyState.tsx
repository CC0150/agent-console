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
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="panel flex flex-col items-center justify-center border-dashed px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/10 text-signal-400">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink-100">{title}</p>
      <p className="mt-1 text-xs text-ink-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

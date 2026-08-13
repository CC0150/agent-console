/**
 * 任务删除按钮：仅负责触发删除动作，具体删除逻辑交由父组件处理。
 */
import { Trash2 } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";

interface DeleteTaskButtonProps {
  taskId: string;
  goal: string;
  disabled?: boolean;
  className?: string;
  onDelete: (taskId: string, goal: string) => void;
}

export function DeleteTaskButton({
  taskId,
  goal,
  disabled = false,
  className = "",
  onDelete,
}: DeleteTaskButtonProps) {
  return (
    <Tooltip content="删除任务">
      <button
        type="button"
        aria-label={`删除任务 ${goal}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onDelete(taskId, goal);
        }}
        className={`inline-flex items-center justify-center rounded border border-transparent text-ink-500 transition hover:border-rose-500/35 hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

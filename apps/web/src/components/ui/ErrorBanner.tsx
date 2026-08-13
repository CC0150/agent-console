/**
 * 错误提示条：展示请求错误信息，支持可选的重试按钮。
 */
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({
  message,
  onRetry,
  className = "",
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-md border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-300 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 break-words leading-6">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重试
        </button>
      ) : null}
    </div>
  );
}

/**
 * 将任意异常转换为可展示的中文错误文案。
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败，请稍后重试";
}

/**
 * 通用弹窗容器，支持标题、描述、自定义内容与底部操作区。
 * 打开期间锁定页面滚动，支持 ESC 和点击遮罩关闭。
 */
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalTone = "default" | "danger";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  tone?: ModalTone;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  icon,
  tone = "default",
}: ModalProps) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    // 弹窗打开期间监听 ESC 关闭，并锁定背景滚动
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const borderClass =
    tone === "danger" ? "border-rose-500/40" : "border-signal-500/40";
  const topLineClass =
    tone === "danger"
      ? "bg-gradient-to-r from-rose-500/80 via-rose-500/20 to-transparent"
      : "bg-gradient-to-r from-signal-500/80 via-signal-500/20 to-transparent";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm"
        onClick={() => onCloseRef.current()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full max-w-md overflow-hidden rounded-lg border bg-ink-900 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ${borderClass}`}
      >
        <div className={`h-px w-full ${topLineClass}`} />
        <div className="flex items-start gap-3 px-5 pb-4 pt-5">
          {icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-700/25 bg-ink-800/70 text-ink-300">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="break-words text-base font-semibold leading-6 text-ink-100"
            >
              {title}
            </h2>
            {description ? (
              <div className="mt-1.5 break-words text-sm leading-6 text-ink-400">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="关闭弹窗"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-ink-500 transition hover:border-ink-700/30 hover:bg-ink-800 hover:text-ink-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="px-5 pb-4">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700/25 bg-ink-950/40 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

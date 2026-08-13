/**
 * 确认弹窗：基于 Modal 组合确认 / 取消按钮，支持危险操作提示与加载态。
 */
import { AlertTriangle, Check, Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Modal, type ModalTone } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ModalTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "default",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const danger = tone === "danger";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      tone={tone}
      icon={
        danger ? (
          <AlertTriangle className="h-4 w-4 text-rose-400" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-signal-400" />
        )
      }
      footer={
        <>
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink-700/30 bg-ink-700/10 px-4 text-sm font-medium text-ink-300 transition hover:border-ink-600 hover:bg-ink-700/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
              danger
                ? "border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                : "border-signal-500/35 bg-signal-500/10 text-signal-300 hover:bg-signal-500/20"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

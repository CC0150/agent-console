/**
 * 基于 Radix Tooltip 封装的通用提示组件。
 * 鼠标悬停或键盘聚焦时显示简短说明，样式保持克制、不遮挡正文。
 */
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-[60] rounded border border-ink-600/60 bg-ink-800 px-2 py-1 text-xs leading-5 text-ink-200"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

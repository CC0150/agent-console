/**
 * 通用下拉选择器，基于 Radix Select 封装，替代原生 select 标签。
 */
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function SelectField({
  value,
  onValueChange,
  options,
  label,
  icon,
  size = "sm",
  className = "",
}: SelectFieldProps) {
  const current = options.find((option) => option.value === value);

  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        aria-label={label}
        className={`group inline-flex shrink-0 items-center justify-between gap-2 rounded-md border border-ink-700/30 bg-ink-950/70 text-ink-100 outline-none transition focus:border-signal-500/60 focus:ring-2 focus:ring-signal-500/15 data-[placeholder]:text-ink-500 ${
          size === "md" ? "h-12 px-3" : "h-9 px-3"
        } ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="shrink-0 text-ink-400 transition group-data-[state=open]:text-signal-400">
              {icon}
            </span>
          ) : null}
          <Select.Value asChild>
            <span
              className={`truncate font-medium ${
                size === "md" ? "text-sm" : "text-[13px]"
              }`}
            >
              {current?.label}
            </span>
          </Select.Value>
        </span>
        <Select.Icon className="shrink-0 text-ink-400 transition group-data-[state=open]:rotate-180 group-data-[state=open]:text-signal-400">
          <ChevronDown className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="start"
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-ink-600/50 bg-ink-850 p-1 shadow-[0_18px_48px_rgba(0,0,0,0.38)] data-[state=open]:animate-in"
        >
          <Select.Viewport className="p-0.5">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex h-9 cursor-pointer select-none items-center rounded border border-transparent pr-8 pl-8 text-[13px] font-medium text-ink-300 outline-none transition data-[highlighted]:border-signal-500/20 data-[highlighted]:bg-signal-500/10 data-[highlighted]:text-signal-300 data-[state=checked]:text-signal-300"
              >
                <Select.ItemIndicator className="absolute left-2.5 inline-flex items-center">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

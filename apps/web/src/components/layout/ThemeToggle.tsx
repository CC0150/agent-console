/**
 * 主题切换按钮：在浅色 / 深色模式之间切换并持久化到本地存储。
 */
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip } from "../ui/Tooltip";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  // 初始主题以 html 上的 data-theme 为准，保持与入口脚本写入的值一致
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    // 同步主题属性并持久化，供刷新后恢复
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("agent-console-theme", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#07080a" : "#f3f4f2");
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <Tooltip content={next === "light" ? "切换到浅色模式" : "切换到深色模式"}>
      <button
        type="button"
        aria-label={next === "light" ? "切换到浅色模式" : "切换到深色模式"}
        onClick={() => setTheme(next)}
        className={`inline-flex items-center justify-center gap-2 rounded-md border border-ink-700/30 bg-ink-700/10 text-ink-300 transition hover:border-signal-500/30 hover:text-signal-300 ${
          compact ? "h-8 w-8" : "h-8 w-full px-3"
        }`}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {!compact ? (
          <span className="text-xs font-medium">
            {next === "light" ? "浅色模式" : "深色模式"}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

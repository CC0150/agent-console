/**
 * 应用根组件：负责路由分发与全局滚动行为。
 */
import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Logo } from "../components/layout/Logo";
import { RuntimeBadge } from "../components/layout/RuntimeBadge";
import { Sidebar } from "../components/layout/Sidebar";
import { ThemeToggle } from "../components/layout/ThemeToggle";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { TaskDetailPage } from "../features/task/TaskDetailPage";
import { TaskReplayPage } from "../features/task/TaskReplayPage";

export function App() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      target.classList.add("scroll-active");
      const existing = timers.get(target);
      if (existing != null) {
        window.clearTimeout(existing);
      }
      timers.set(
        target,
        window.setTimeout(() => target.classList.remove("scroll-active"), 550),
      );
    };
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-950 text-ink-100">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-700/30 bg-ink-950/90 px-4 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Logo size="sm" />
            <div>
              <p className="display-label text-[15px] leading-4 text-ink-100">
                Agent Console
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                任务控制台
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle compact />
            <RuntimeBadge compact />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
              <Route path="/tasks/:taskId/replay" element={<TaskReplayPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

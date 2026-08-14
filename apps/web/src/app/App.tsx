/**
 * 应用根组件：负责路由分发与全局滚动行为。
 */
import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { Logo } from "../components/layout/Logo";
import { RuntimeBadge } from "../components/layout/RuntimeBadge";
import { Sidebar } from "../components/layout/Sidebar";
import { Skeleton } from "../components/ui/Skeleton";
import { ThemeToggle } from "../components/layout/ThemeToggle";

const DashboardPage = lazy(() =>
  import("../features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

const TaskDetailPage = lazy(() =>
  import("../features/task/TaskDetailPage").then((module) => ({
    default: module.TaskDetailPage,
  })),
);

const TaskReplayPage = lazy(() =>
  import("../features/task/TaskReplayPage").then((module) => ({
    default: module.TaskReplayPage,
  })),
);

export function App() {
  const location = useLocation();

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
    <>
      <a href="#main-content" className="skip-link">
        跳转到主内容
      </a>
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

          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
          >
            <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
              <ErrorBoundary resetKey={location.pathname}>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
                    <Route
                      path="/tasks/:taskId/replay"
                      element={<TaskReplayPage />}
                    />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

function RouteFallback() {
  return (
    <div className="space-y-5" role="status" aria-label="正在加载页面">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-9 w-64 max-w-full rounded" />
          <Skeleton className="h-4 w-80 max-w-full rounded" />
        </div>
        <Skeleton className="h-10 w-44 rounded-md" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Skeleton className="h-44 w-full rounded-md" />
          <Skeleton className="h-80 w-full rounded-md" />
        </div>
        <div className="min-w-0 space-y-5">
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-36 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

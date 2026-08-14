/**
 * 任务页加载骨架：保持与任务详情/回放页一致的双栏布局，避免加载时页面跳动。
 */
import { Skeleton } from "../../components/ui/Skeleton";

export function TaskPageSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="正在加载任务">
      <header className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-8 w-full max-w-2xl rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-4">
          <Skeleton className="h-64 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
        <div className="min-w-0 space-y-5 xl:col-span-8">
          <Skeleton className="h-72 w-full rounded-md" />
          <Skeleton className="h-56 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

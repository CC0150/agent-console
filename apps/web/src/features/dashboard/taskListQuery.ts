import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { Task, TaskSortField, TaskSortOrder } from "@agent-console/contracts";

export type TaskStatusFilter = Task["status"] | "all";

export interface TaskListQueryState {
  workspace: string;
  q: string;
  status: TaskStatusFilter;
  sort: TaskSortField;
  order: TaskSortOrder;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 10;

const STATUS_VALUES: TaskStatusFilter[] = [
  "all",
  "queued",
  "planning",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
];
const SORT_VALUES: TaskSortField[] = [
  "createdAt",
  "updatedAt",
  "status",
  "currentStep",
];
const ORDER_VALUES: TaskSortOrder[] = ["asc", "desc"];
const PAGE_SIZE_VALUES = [10, 20, 50];

/**
 * 从 URL 查询参数解析任务列表状态，并把筛选、排序、分页保存到地址栏。
 */
export function useTaskListQuery() {
  const [searchParams, setSearchParams] = useSearchParams();

  const update = useCallback(
    (patch: Partial<TaskListQueryState>) => {
      setSearchParams((prev) => {
        const current = parseTaskListQuery(prev);
        const next = { ...current, ...patch };
        if (!("page" in patch)) {
          next.page = 1;
        }
        return toSearchParams(next);
      });
    },
    [setSearchParams],
  );

  return {
    state: parseTaskListQuery(searchParams),
    update,
  };
}

function parseTaskListQuery(searchParams: URLSearchParams): TaskListQueryState {
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawPageSize = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const status = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = searchParams.get("order") ?? "desc";

  return {
    workspace: searchParams.get("workspace") ?? "all",
    q: searchParams.get("q") ?? "",
    status: STATUS_VALUES.includes(status as TaskStatusFilter)
      ? (status as TaskStatusFilter)
      : "all",
    sort: SORT_VALUES.includes(sort as TaskSortField) ? (sort as TaskSortField) : "createdAt",
    order: ORDER_VALUES.includes(order as TaskSortOrder)
      ? (order as TaskSortOrder)
      : "desc",
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    pageSize: PAGE_SIZE_VALUES.includes(rawPageSize)
      ? rawPageSize
      : DEFAULT_PAGE_SIZE,
  };
}

function toSearchParams(state: TaskListQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.workspace !== "all") {
    params.set("workspace", state.workspace);
  }
  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }
  if (state.status !== "all") {
    params.set("status", state.status);
  }
  if (state.sort !== "createdAt") {
    params.set("sort", state.sort);
  }
  if (state.order !== "desc") {
    params.set("order", state.order);
  }
  if (state.page !== 1) {
    params.set("page", String(state.page));
  }
  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize));
  }
  return params;
}

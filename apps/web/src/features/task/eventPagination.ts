/**
 * 事件日志分页：把大事件列表切成固定页大小，同时处理页数收缩后的越界回退。
 */
export const EVENT_LOG_PAGE_SIZE = 100;

export function clampEventPage(
  page: number,
  totalItems: number,
  pageSize = EVENT_LOG_PAGE_SIZE,
): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}

export function getEventPageItems<T>(
  items: readonly T[],
  page: number,
  pageSize = EVENT_LOG_PAGE_SIZE,
): T[] {
  const safePage = clampEventPage(page, items.length, pageSize);
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function getEventPageRange(
  page: number,
  totalItems: number,
  pageSize = EVENT_LOG_PAGE_SIZE,
): { start: number; end: number } {
  if (totalItems === 0) {
    return { start: 0, end: 0 };
  }
  const safePage = clampEventPage(page, totalItems, pageSize);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  return { start, end };
}

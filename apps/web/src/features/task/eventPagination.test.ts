import { describe, expect, it } from "vitest";
import {
  clampEventPage,
  getEventPageItems,
  getEventPageRange,
} from "./eventPagination";

describe("eventPagination", () => {
  it("按页大小切分事件，并修正越界页码", () => {
    const items = Array.from({ length: 250 }, (_, index) => index);

    expect(getEventPageItems(items, 1)).toHaveLength(100);
    expect(getEventPageItems(items, 3)).toHaveLength(50);
    expect(getEventPageItems(items, 99)).toHaveLength(50);
    expect(clampEventPage(0, items.length)).toBe(1);
    expect(clampEventPage(-2, items.length)).toBe(1);
  });

  it("事件总数收缩后回退到最后一页", () => {
    expect(clampEventPage(3, 150)).toBe(2);
    expect(getEventPageItems(Array.from({ length: 150 }, (_, i) => i), 3))
      .toHaveLength(50);
  });

  it("返回当前页可见范围，空列表返回空区间", () => {
    expect(getEventPageRange(2, 230)).toEqual({ start: 101, end: 200 });
    expect(getEventPageRange(3, 230)).toEqual({ start: 201, end: 230 });
    expect(getEventPageRange(1, 0)).toEqual({ start: 0, end: 0 });
  });
});

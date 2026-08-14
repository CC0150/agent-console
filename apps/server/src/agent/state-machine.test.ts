import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  StateTransitionError,
} from "./state-machine";

describe("任务状态机", () => {
  it("允许合法的状态迁移", () => {
    expect(canTransition("queued", "planning")).toBe(true);
    expect(canTransition("planning", "running")).toBe(true);
    expect(canTransition("running", "paused")).toBe(true);
    expect(canTransition("paused", "running")).toBe(true);
  });

  it("允许失败任务恢复运行", () => {
    expect(canTransition("failed", "running")).toBe(true);
    expect(() => assertTransition("failed", "running")).not.toThrow();
  });

  it("拒绝完成或取消状态回到运行态", () => {
    expect(canTransition("completed", "running")).toBe(false);
    expect(canTransition("cancelled", "running")).toBe(false);
    expect(() => assertTransition("completed", "running")).toThrow(
      StateTransitionError,
    );
  });
});

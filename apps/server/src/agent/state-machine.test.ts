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

  it("拒绝终态回到运行态", () => {
    expect(canTransition("completed", "running")).toBe(false);
    expect(() => assertTransition("failed", "running")).toThrow(StateTransitionError);
  });
});

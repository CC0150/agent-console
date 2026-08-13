import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolInputError, ToolRegistry } from "./registry";

describe("ToolRegistry", () => {
  it("按 schema 校验参数并执行工具", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "回显输入",
      inputSchema: z.object({ text: z.string() }),
      async execute(input) {
        return { echoed: input.text };
      },
    });

    await expect(
      registry.run("echo", { text: "hi" }, { taskId: "t1", signal: new AbortController().signal }),
    ).resolves.toEqual({ echoed: "hi" });
  });

  it("参数不合法时抛出 ToolInputError", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "回显输入",
      inputSchema: z.object({ text: z.string() }),
      async execute() {
        return null;
      },
    });

    await expect(
      registry.run("echo", { text: 123 }, { taskId: "t1", signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(ToolInputError);
  });
});

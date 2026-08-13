import type { ToolDefinition } from "@agent-console/contracts";
import { zodToJsonSchema } from "./json-schema";
import type { Tool, ToolExecutionContext } from "./types";

export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`未注册的工具: ${toolName}`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolInputError extends Error {
  readonly issues: unknown;

  constructor(toolName: string, issues: unknown) {
    super(`工具 ${toolName} 参数不合法`);
    this.name = "ToolInputError";
    this.issues = issues;
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具已注册: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(toolName: string): Tool {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    return tool;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema),
      ...(tool.requiresApproval ? { requiresApproval: true } : {}),
    }));
  }

  async run(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<unknown> {
    const tool = this.get(toolName);
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ToolInputError(toolName, parsed.error.flatten());
    }
    return tool.execute(parsed.data, ctx);
  }
}

export const toolRegistry = new ToolRegistry();

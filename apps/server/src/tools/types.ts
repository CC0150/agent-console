import type { z } from "zod";

export interface ToolExecutionContext {
  taskId: string;
  signal: AbortSignal;
}

export interface Tool<I = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I, any, any>;
  requiresApproval?: boolean;
  approvalReason?: string;
  execute(input: I, ctx: ToolExecutionContext): Promise<unknown>;
}

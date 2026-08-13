import { z } from "zod";

export const Usage = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export type Usage = z.infer<typeof Usage>;

export const PlanResponse = z.object({
  steps: z.array(
    z.object({
      title: z.string().min(1),
      toolName: z.string().min(1),
      input: z.record(z.unknown()),
    }),
  ),
});

export type PlanResponse = z.infer<typeof PlanResponse>;

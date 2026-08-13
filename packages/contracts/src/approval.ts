import { z } from "zod";

export const ApprovalStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const ApprovalDecision = z.enum(["approve", "reject"]);

export type ApprovalDecision = z.infer<typeof ApprovalDecision>;

export const ApprovalRequest = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  input: z.record(z.unknown()),
  reason: z.string(),
  status: ApprovalStatus,
  requestedAt: z.string(),
  resolvedAt: z.string().nullable(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequest>;

export const ApprovalDecisionInput = z.object({
  approvalId: z.string().min(1),
  decision: ApprovalDecision,
});

export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInput>;

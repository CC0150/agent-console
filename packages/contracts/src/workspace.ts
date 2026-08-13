import { z } from "zod";

export const Workspace = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Workspace = z.infer<typeof Workspace>;

export const CreateWorkspaceInput = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional().default(""),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInput>;

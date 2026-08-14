import { z } from "zod";

/**
 * 任务产出物：由工具生成并落盘的文件元数据。
 * 前端通过任务 ID 和产出物 ID 请求预览或下载内容。
 */
export const TaskArtifact = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type TaskArtifact = z.infer<typeof TaskArtifact>;

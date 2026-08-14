import { z } from "zod";
import { config } from "../config";
import { artifactRepository } from "../db/repositories";
import type { Tool } from "./types";

const WriteReportInput = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(1_000_000),
  filename: z.string().min(1).max(200).optional(),
  format: z.enum(["markdown", "text"]).default("markdown"),
});

type WriteReportInput = z.infer<typeof WriteReportInput>;

export const writeReportTool: Tool<WriteReportInput> = {
  name: "write_report",
  description:
    "生成 Markdown 或文本报告并保存为任务产出物，任务结束后可在详情页预览和下载",
  inputSchema: WriteReportInput,
  async execute(input, ctx) {
    if (ctx.signal.aborted) {
      throw new Error("任务已取消，取消生成报告");
    }

    const format = input.format === "markdown" ? "markdown" : "text";
    const extension = format === "markdown" ? ".md" : ".txt";
    const baseName = input.filename?.trim()
      ? ensureExtension(input.filename, extension)
      : `${input.title.trim()}${extension}`;
    const mimeType = format === "markdown" ? "text/markdown" : "text/plain";
    const contentBytes = Buffer.byteLength(input.content, "utf8");

    if (contentBytes > config.artifact.maxBytes) {
      throw new Error(
        `报告内容超过大小限制：${contentBytes} > ${config.artifact.maxBytes}`,
      );
    }

    const artifact = artifactRepository.save({
      taskId: ctx.taskId,
      fileName: baseName,
      content: input.content,
      mimeType,
    });

    return {
      ok: true,
      artifact,
    };
  },
};

function ensureExtension(name: string, extension: string): string {
  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`;
}

import { z } from "zod";
import { config } from "../config";
import { db } from "../db/client";
import type { Tool } from "./types";

const SearchJobsInput = z.object({
  city: z.string().min(1).default("杭州"),
  keywords: z.array(z.string()).optional().default([]),
  limit: z.number().int().min(1).max(50).default(10),
});

type SearchJobsInputType = z.infer<typeof SearchJobsInput>;

interface JobRow {
  id: number;
  title: string;
  company: string;
  city: string;
  requirements: string;
  salary: string | null;
  source_url: string | null;
}

export const searchJobsTool: Tool<SearchJobsInputType> = {
  name: "search_jobs",
  description: "按城市和关键词检索职位库中的岗位要求",
  inputSchema: SearchJobsInput,
  requiresApproval: config.approvalEnabled,
  approvalReason: "检索岗位数据前需要人工确认检索目标和城市",
  async execute(input) {
    const { city, keywords, limit } = input;
    const conditions = ["city = ?"];
    const params: Array<string | number> = [city];

    if (keywords.length > 0) {
      const likes = keywords.map(() => "title LIKE ? OR requirements LIKE ?").join(" OR ");
      conditions.push(`(${likes})`);
      for (const keyword of keywords) {
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
    }
    params.push(limit);

    const rows = db
      .prepare(
        `SELECT id, title, company, city, requirements, salary, source_url
         FROM job_postings
         WHERE ${conditions.join(" AND ")}
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(...params) as unknown as JobRow[];

    return {
      total: rows.length,
      jobs: rows.map((row) => ({
        id: row.id,
        title: row.title,
        company: row.company,
        city: row.city,
        requirements: row.requirements,
        salary: row.salary,
        sourceUrl: row.source_url,
      })),
    };
  },
};

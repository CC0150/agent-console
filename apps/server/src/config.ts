import "dotenv/config";
import path from "node:path";

export interface LLMConfig {
  provider: "mock" | "openai";
  baseUrl: string;
  apiKey: string;
  model: string;
  maxRetries: number;
  requestTimeoutMs: number;
  retryBaseDelayMs: number;
  maxContextTokens: number;
  maxHistoryMessages: number;
}

export interface HttpToolConfig {
  allowedHosts: string[];
  maxResponseBytes: number;
  timeoutMs: number;
}

const provider = process.env.LLM_PROVIDER ?? "mock";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "data/agent-console.db"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  approvalEnabled: process.env.APPROVAL_ENABLED === "true",
  approvalTimeoutMs: Number(process.env.APPROVAL_TIMEOUT_MS ?? 10 * 60 * 1000),
  httpTool: {
    allowedHosts: parseAllowedHosts(process.env.HTTP_TOOL_ALLOWED_HOSTS),
    maxResponseBytes: Number(process.env.HTTP_TOOL_MAX_RESPONSE_BYTES ?? 512 * 1024),
    timeoutMs: Number(process.env.HTTP_TOOL_TIMEOUT_MS ?? 10_000),
  } satisfies HttpToolConfig,
  llm: {
    provider: provider === "openai" ? "openai" : "mock",
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
    maxRetries: Number(process.env.LLM_MAX_RETRIES ?? 3),
    requestTimeoutMs: Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? 120_000),
    retryBaseDelayMs: Number(process.env.LLM_RETRY_BASE_DELAY_MS ?? 1_000),
    maxContextTokens: Number(process.env.LLM_MAX_CONTEXT_TOKENS ?? 16_000),
    maxHistoryMessages: Number(process.env.LLM_MAX_HISTORY_MESSAGES ?? 80),
  } satisfies LLMConfig,
};

function parseAllowedHosts(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

import { z } from "zod";
import { config } from "../config";
import type { Tool } from "./types";

const HttpRequestInput = z.object({
  url: z.string().url().max(2048),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().min(100).max(60_000).default(config.httpTool.timeoutMs),
});

type HttpRequestInput = z.infer<typeof HttpRequestInput>;

export const httpRequestTool: Tool<HttpRequestInput> = {
  name: "http_request",
  description: "调用外部 HTTP(S) API，返回状态码、响应头和解析后的 JSON 或文本内容",
  inputSchema: HttpRequestInput,
  requiresApproval: config.approvalEnabled,
  approvalReason: "调用外部 HTTP API，请确认目标地址、请求头和请求体",
  async execute(input, ctx) {
    assertAllowedHost(input.url);

    const url = new URL(input.url);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const headers = { ...(input.headers ?? {}) };
    if (
      input.body !== undefined &&
      !hasHeader(headers, "content-type") &&
      input.method !== "GET" &&
      input.method !== "DELETE"
    ) {
      headers["Content-Type"] = "application/json";
    }

    const timeoutSignal = AbortSignal.timeout(input.timeoutMs);
    const signal = ctx.signal
      ? AbortSignal.any([ctx.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(url, {
        method: input.method,
        headers,
        body: serializeBody(input.body),
        signal,
        redirect: "follow",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && isAbortError(error)) {
        throw new Error(`http_request timed out after ${input.timeoutMs}ms`);
      }
      throw new Error(`http_request failed: ${message}`);
    }

    const { text, truncated } = await readLimitedText(response, config.httpTool.maxResponseBytes);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: pickHeaders(response.headers),
      body: tryParseJson(text) ?? text,
      truncated,
    };
  },
};

function assertAllowedHost(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("http_request only supports http and https URLs");
  }
  if (config.httpTool.allowedHosts.length === 0) {
    return;
  }
  const host = url.hostname.toLowerCase();
  const allowed = config.httpTool.allowedHosts.some((pattern) => matchHost(host, pattern));
  if (!allowed) {
    throw new Error(`http_request host ${url.hostname} is not in the allowed hosts list`);
  }
}

function matchHost(host: string, pattern: string): boolean {
  if (pattern === host) {
    return true;
  }
  if (pattern.startsWith("*.") && host.endsWith(pattern.slice(1))) {
    return true;
  }
  return false;
}

function serializeBody(body: unknown): string | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

async function readLimitedText(
  response: Response,
  limit: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    return { text: "", truncated: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    text += decoder.decode(value, { stream: true });
    if (text.length > limit) {
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
  }

  return { text: text.slice(0, limit), truncated };
}

function tryParseJson(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function pickHeaders(headers: Headers): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of [
    "content-type",
    "content-length",
    "etag",
    "last-modified",
    "location",
    "x-request-id",
  ]) {
    const value = headers.get(name);
    if (value) {
      picked[name] = value;
    }
  }
  return picked;
}

function isAbortError(error: Error): boolean {
  return error.name === "AbortError" || error.name === "TimeoutError";
}

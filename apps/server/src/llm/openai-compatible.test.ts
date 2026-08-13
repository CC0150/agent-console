import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LLMConfig } from "../config";
import { OpenAICompatibleProvider } from "./openai-compatible";

let server: http.Server;
let baseUrl: string;
let receivedBody: Record<string, unknown> | undefined;

const llmConfig: LLMConfig = {
  provider: "openai",
  baseUrl: "",
  apiKey: "test-key",
  model: "test-model",
  maxRetries: 0,
  requestTimeoutMs: 5_000,
  retryBaseDelayMs: 100,
  maxContextTokens: 16_000,
  maxHistoryMessages: 80,
};

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      receivedBody = body ? JSON.parse(body) : undefined;
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      const chunks = [
        {
          choices: [{ delta: { content: "你好" }, finish_reason: null }],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    function: {
                      name: "search_jobs",
                      arguments: '{"city":"杭州"',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: {
                      arguments: ',"limit":5}',
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        },
        {
          usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
        },
      ];
      for (const chunk of chunks) {
        response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      response.write("data: [DONE]\n\n");
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("OpenAICompatibleProvider", () => {
  it("解析流式内容、工具调用、结束原因和 token 用量", async () => {
    const deltas: string[] = [];
    const provider = new OpenAICompatibleProvider({
      ...llmConfig,
      baseUrl,
    });

    const result = await provider.chat({
      messages: [
        { role: "system", content: "你是 Agent" },
        { role: "user", content: "搜索杭州前端岗位" },
      ],
      tools: [
        {
          name: "search_jobs",
          description: "检索岗位",
          parameters: { type: "object" },
        },
      ],
      onDelta: (delta) => deltas.push(delta),
    });

    expect(result.content).toBe("你好");
    expect(deltas).toEqual(["你好"]);
    expect(result.toolCalls).toEqual([
      {
        id: "call_1",
        name: "search_jobs",
        arguments: { city: "杭州", limit: 5 },
      },
    ]);
    expect(result.finishReason).toBe("tool_calls");
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 9,
      totalTokens: 21,
    });
    expect(receivedBody).toMatchObject({
      model: "test-model",
      stream: true,
      messages: [{ role: "system" }, { role: "user" }],
      tools: [{ type: "function" }],
    });
  });
});

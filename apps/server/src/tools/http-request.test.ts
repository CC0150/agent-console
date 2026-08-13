import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { httpRequestTool } from "./http-request";

let server: Server;
let baseUrl: string;

const ctx = {
  taskId: "t1",
  signal: new AbortController().signal,
};

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", baseUrl);
    if (url.pathname === "/echo") {
      let raw = "";
      req.on("data", (chunk: Buffer) => {
        raw += chunk.toString("utf8");
      });
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            method: req.method,
            query: Object.fromEntries(url.searchParams),
            body: raw ? JSON.parse(raw) : null,
            auth: req.headers.authorization ?? null,
          }),
        );
      });
      return;
    }
    if (url.pathname === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      }, 500);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("http_request tool", () => {
  it("calls an external HTTP API and returns parsed JSON", async () => {
    const result = await httpRequestTool.execute(
      {
        url: `${baseUrl}/echo?x=1`,
        method: "POST",
        headers: { Authorization: "Bearer test" },
        body: { hello: "world" },
        timeoutMs: 10_000,
      },
      ctx,
    );

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      body: {
        method: "POST",
        query: { x: "1" },
        body: { hello: "world" },
        auth: "Bearer test",
      },
    });
  });

  it("rejects non-http protocols", async () => {
    await expect(
      httpRequestTool.execute(
        { url: "file:///etc/passwd", method: "GET", timeoutMs: 10_000 },
        ctx,
      ),
    ).rejects.toThrow("only supports http and https");
  });

  it("fails with a timeout message when the server is slow", async () => {
    await expect(
      httpRequestTool.execute(
        { url: `${baseUrl}/slow`, method: "GET", timeoutMs: 100 },
        ctx,
      ),
    ).rejects.toThrow("timed out");
  });
});

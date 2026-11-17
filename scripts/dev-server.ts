/**
 * Local test server (development only, not deployed).
 *   GET  /                 -> playground/index.html
 *   POST /api/chat         -> the same handler as the Vercel function (CORS, rate limits, streaming)
 *   GET  /api/config       -> provider/model in use (local only)
 *   GET  /api/debug/prompt -> the generated system prompt (local only)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { getSystemPrompt } from "../src/agent.js";
import { handleChatRequest } from "../src/server/chat-handler.js";
import { getChatOptions } from "../src/server/context.js";

try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"));
} catch {
  // No .env file: rely on the environment.
}

const PORT = Number(process.env["PORT"] ?? 8787);
const PLAYGROUND = join(dirname(fileURLToPath(import.meta.url)), "..", "playground", "index.html");

const options = getChatOptions();
// The playground itself is always allowed to call the API.
const localOrigins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const chatOptions = { ...options, allowedOrigins: [...new Set([...options.allowedOrigins, ...localOrigins])] };

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Bridges Node's http request/response to the Web standard handler used on Vercel. */
async function toWebHandler(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", req.socket.remoteAddress ?? "local");

  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
  const request = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
    // Required by Node when streaming a request body.
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);

  const response = await handleChatRequest(request, chatOptions);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(res);
  else res.end();
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(PLAYGROUND));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/config") {
    const p = chatOptions.provider;
    sendJson(res, 200, p ? { ready: true, provider: p.name, model: p.model } : { ready: false, error: chatOptions.providerError });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/debug/prompt") {
    try {
      const prompt = getSystemPrompt();
      sendJson(res, 200, { prompt, chars: prompt.length, approxTokens: Math.round(prompt.length / 4) });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (url.pathname === "/api/chat") {
    toWebHandler(req, res, url).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
      else res.end();
    });
    return;
  }
  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  const p = chatOptions.provider;
  console.log(`Playground: http://localhost:${PORT}`);
  console.log(p ? `Provider: ${p.name} · model: ${p.model}` : `Warning: ${chatOptions.providerError}`);
  console.log(`Allowed origins: ${chatOptions.allowedOrigins.join(", ")}`);
  console.log(`Limits: ${JSON.stringify(chatOptions.limits)}`);
});

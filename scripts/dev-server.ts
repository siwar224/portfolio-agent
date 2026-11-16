/**
 * Local test server (development only, not deployed).
 *   GET  /                -> playground/index.html
 *   POST /api/chat        -> streams the agent's answer as NDJSON events
 *   GET  /api/debug/prompt -> the generated system prompt (local debugging)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ChatRequestSchema, createProvider, getSystemPrompt, ProviderError, streamChat } from "../src/agent.js";
import type { ChatProvider } from "../src/providers/types.js";

try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"));
} catch {
  // No .env file: rely on the environment.
}

const PORT = Number(process.env["PORT"] ?? 8787);
const PLAYGROUND = join(dirname(fileURLToPath(import.meta.url)), "..", "playground", "index.html");
const MAX_BODY = 200_000;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function errorMessage(err: unknown): string {
  if (err instanceof ProviderError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!provider) {
    sendJson(res, 500, { error: providerError });
    return;
  }

  let parsed;
  try {
    parsed = ChatRequestSchema.safeParse(JSON.parse(await readBody(req)));
  } catch (err) {
    sendJson(res, 400, { error: errorMessage(err) });
    return;
  }
  if (!parsed.success) {
    sendJson(res, 400, { error: z.prettifyError(parsed.error) });
    return;
  }

  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
  try {
    for await (const event of streamChat(provider, parsed.data)) {
      res.write(JSON.stringify(event) + "\n");
    }
  } catch (err) {
    console.error(err);
    res.write(JSON.stringify({ type: "error", message: errorMessage(err) }) + "\n");
  }
  res.end();
}

let provider: ChatProvider | null = null;
let providerError = "";
try {
  provider = createProvider();
} catch (err) {
  providerError = errorMessage(err);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(PLAYGROUND));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, provider
      ? { ready: true, provider: provider.name, model: provider.model }
      : { ready: false, error: providerError });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/debug/prompt") {
    try {
      const prompt = getSystemPrompt();
      sendJson(res, 200, { prompt, chars: prompt.length, approxTokens: Math.round(prompt.length / 4) });
    } catch (err) {
      sendJson(res, 500, { error: errorMessage(err) });
    }
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/chat") {
    void handleChat(req, res);
    return;
  }
  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Playground: http://localhost:${PORT}`);
  if (provider) console.log(`Provider: ${provider.name} · model: ${provider.model}`);
  else console.warn(`Warning: ${providerError}`);
});

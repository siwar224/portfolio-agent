/**
 * POST /api/chat, written against the Web standard Request/Response so the same code runs
 * in the Vercel function (api/chat.ts) and in the local dev server.
 *
 * Protections: CORS allow-list, request size limit, schema validation (message count/length),
 * rate limits per visitor (minute + day) and a global daily cap that protects the model quota.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { ChatRequestSchema, ProviderError, streamChat } from "../agent.js";
import type { ChatProvider } from "../providers/types.js";
import type { RateLimiter } from "./rate-limit.js";

export interface ChatHandlerOptions {
  provider: ChatProvider | null;
  providerError?: string;
  limiter: RateLimiter;
  /** Exact origins allowed to call the API from a browser, e.g. "https://siwar-msallem.vercel.app". */
  allowedOrigins: string[];
  limits: { perMinute: number; perDay: number; globalPerDay: number };
}

const MAX_BODY_CHARS = 100_000;

export function chatOptionsFromEnv(
  provider: ChatProvider | null,
  providerError: string,
  limiter: RateLimiter,
  env: NodeJS.ProcessEnv = process.env,
): ChatHandlerOptions {
  const num = (name: string, fallback: number) => {
    const v = Number(env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    provider,
    providerError,
    limiter,
    allowedOrigins: (env["ALLOWED_ORIGINS"] ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean),
    limits: {
      perMinute: num("RATE_LIMIT_PER_MINUTE", 6),
      perDay: num("RATE_LIMIT_PER_DAY", 40),
      globalPerDay: num("GLOBAL_DAILY_LIMIT", 500),
    },
  };
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return { vary: "Origin" };
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/** Visitor key: a hash of the client IP, so raw IPs are never stored. */
function visitorKey(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function handleChatRequest(req: Request, opts: ChatHandlerOptions): Promise<Response> {
  const origin = req.headers.get("origin")?.replace(/\/$/, "") ?? null;
  const cors = corsHeaders(origin, opts.allowedOrigins);

  // Browsers always send Origin on cross-site POSTs: refuse origins that are not allowed.
  if (origin && !opts.allowedOrigins.includes(origin)) {
    return json(403, { error: "Origin not allowed." }, cors);
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." }, { ...cors, allow: "POST, OPTIONS" });

  if (!opts.provider) return json(503, { error: opts.providerError || "The assistant is not configured." }, cors);

  // Rate limits: per visitor (minute, day) and a global daily cap.
  const key = visitorKey(req);
  const day = new Date().toISOString().slice(0, 10);
  try {
    const checks = [
      await opts.limiter.hit(`rl:m:${key}`, opts.limits.perMinute, 60),
      await opts.limiter.hit(`rl:d:${day}:${key}`, opts.limits.perDay, 86_400),
      await opts.limiter.hit(`rl:g:${day}`, opts.limits.globalPerDay, 86_400),
    ];
    const blocked = checks.find((c) => !c.allowed);
    if (blocked) {
      return json(
        429,
        { error: "Too many messages. Please wait a little before asking again." },
        { ...cors, "retry-after": String(blocked.retryAfterSec) },
      );
    }
  } catch (err) {
    // Fail open on limiter outages, but log it: availability for recruiters comes first.
    console.error("Rate limiter unavailable:", err);
  }

  // Body: size limit, JSON, schema.
  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return json(413, { error: "Request too large." }, cors);
  let parsed;
  try {
    parsed = ChatRequestSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { error: "Invalid JSON." }, cors);
  }
  if (!parsed.success) return json(400, { error: z.prettifyError(parsed.error) }, cors);

  const provider = opts.provider;
  const request = parsed.data;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of streamChat(provider, request)) send(event);
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ProviderError ? err.message : "The assistant is unavailable right now. Please try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: { ...cors, "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

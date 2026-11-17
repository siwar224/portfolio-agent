/**
 * Fixed-window rate limiting.
 * - MemoryRateLimiter: per process. Fine locally; on Vercel each instance has its own memory,
 *   so it only slows down abuse. Good enough to start.
 * - UpstashRateLimiter: shared across all instances through Upstash Redis (free tier), used
 *   automatically when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 */
export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const now = Date.now();
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowSec * 1000 };
      this.windows.set(key, w);
      if (this.windows.size > 10_000) this.prune(now);
    }
    w.count++;
    return { allowed: w.count <= limit, count: w.count, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }

  private prune(now: number): void {
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }
}

export class UpstashRateLimiter implements RateLimiter {
  constructor(private readonly url: string, private readonly token: string) {}

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["SET", key, "0", "EX", String(windowSec), "NX"],
        ["INCR", key],
        ["TTL", key],
      ]),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Upstash rate limit error ${res.status}`);
    const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(out[1]?.result ?? 0);
    const ttl = Number(out[2]?.result ?? windowSec);
    return { allowed: count <= limit, count, retryAfterSec: ttl > 0 ? ttl : windowSec };
  }
}

export function createRateLimiter(env: NodeJS.ProcessEnv = process.env): RateLimiter {
  const url = env["UPSTASH_REDIS_REST_URL"];
  const token = env["UPSTASH_REDIS_REST_TOKEN"];
  return url && token ? new UpstashRateLimiter(url, token) : new MemoryRateLimiter();
}

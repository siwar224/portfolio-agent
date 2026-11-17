import { createProvider } from "../agent.js";
import type { ChatProvider } from "../providers/types.js";
import { chatOptionsFromEnv, type ChatHandlerOptions } from "./chat-handler.js";
import { createRateLimiter } from "./rate-limit.js";

let cached: ChatHandlerOptions | undefined;

/** Provider, rate limiter and limits, created once per process from environment variables. */
export function getChatOptions(env: NodeJS.ProcessEnv = process.env): ChatHandlerOptions {
  if (cached) return cached;
  let provider: ChatProvider | null = null;
  let providerError = "";
  try {
    provider = createProvider(env);
  } catch (err) {
    providerError = err instanceof Error ? err.message : String(err);
    console.error(`Assistant not configured: ${providerError}`);
  }
  cached = chatOptionsFromEnv(provider, providerError, createRateLimiter(env), env);
  return cached;
}

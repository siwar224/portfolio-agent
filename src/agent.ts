import { z } from "zod";
import { loadKnowledge } from "./data.js";
import { buildSystemPrompt } from "./prompt.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GeminiProvider } from "./providers/gemini.js";
import type { ChatEvent, ChatProvider } from "./providers/types.js";

export type { ChatEvent } from "./providers/types.js";
export { ProviderError } from "./providers/types.js";

/** Conversation sent by a client. Limits keep cost and abuse bounded. */
export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(6000),
      }),
    )
    .min(1)
    .max(30)
    .refine((m) => m[0]?.role === "user" && m.at(-1)?.role === "user", {
      message: "Conversation must start and end with a user message",
    }),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export function getSystemPrompt(): string {
  // Reloaded on each call so edits to data/ show up without restarting the dev server.
  return buildSystemPrompt(loadKnowledge());
}

/**
 * Picks the model provider from the environment:
 *   AGENT_PROVIDER = "gemini" | "anthropic" (default: gemini if GEMINI_API_KEY is set, else anthropic)
 *   AGENT_MODEL    = optional model id for that provider
 * Throws with a readable message when the matching key is missing.
 */
export function createProvider(env: NodeJS.ProcessEnv = process.env): ChatProvider {
  const name = env["AGENT_PROVIDER"] || (env["GEMINI_API_KEY"] ? "gemini" : "anthropic");
  const model = env["AGENT_MODEL"] || undefined;

  if (name === "gemini") {
    const key = env["GEMINI_API_KEY"];
    if (!key) throw new Error("AGENT_PROVIDER=gemini but GEMINI_API_KEY is missing in .env.");
    return new GeminiProvider(key, model);
  }
  if (name === "anthropic") {
    if (!env["ANTHROPIC_API_KEY"] && !env["ANTHROPIC_AUTH_TOKEN"]) {
      throw new Error("No API key: set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in .env, then restart.");
    }
    return new AnthropicProvider(model);
  }
  throw new Error(`Unknown AGENT_PROVIDER "${name}". Use "gemini" or "anthropic".`);
}

/** Streams the agent's answer as text deltas, then a final "done" event with usage. */
export function streamChat(provider: ChatProvider, request: ChatRequest): AsyncGenerator<ChatEvent> {
  return provider.stream(getSystemPrompt(), request.messages);
}

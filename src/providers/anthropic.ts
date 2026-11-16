import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type ChatEvent, type ChatMessage, type ChatProvider } from "./types.js";

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";
// Models that accept the server-side refusal fallback.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"]);

/** Anthropic Claude (paid). Uses prompt caching on the system prompt. */
export class AnthropicProvider implements ChatProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(readonly model: string = ANTHROPIC_DEFAULT_MODEL) {
    this.client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  }

  async *stream(system: string, messages: ChatMessage[]): AsyncGenerator<ChatEvent> {
    // On a safety refusal, the API re-runs the request on a fallback model (models that support it).
    const fallback = FALLBACK_MODELS.has(this.model)
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {};

    try {
      const stream = this.client.beta.messages.stream({
        ...fallback,
        model: this.model,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      yield {
        type: "done",
        provider: this.name,
        model: final.model,
        stopReason: final.stop_reason,
        usage: {
          input: final.usage.input_tokens,
          output: final.usage.output_tokens,
          cacheRead: final.usage.cache_read_input_tokens ?? 0,
          cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (err) {
      throw toProviderError(err);
    }
  }
}

function toProviderError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) return new ProviderError("Invalid Anthropic API key (check ANTHROPIC_API_KEY in .env).");
  if (err instanceof Anthropic.RateLimitError) return new ProviderError("Rate limited by the Claude API. Try again in a moment.");
  if (err instanceof Anthropic.BadRequestError) return new ProviderError(`Bad request to the Claude API: ${err.message}`);
  if (err instanceof Anthropic.APIError) return new ProviderError(`Claude API error ${err.status ?? ""}: ${err.message}`);
  return err instanceof Error ? err : new Error(String(err));
}

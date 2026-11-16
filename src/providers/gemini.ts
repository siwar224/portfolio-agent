import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from "@google/genai";
import { ProviderError, type ChatEvent, type ChatMessage, type ChatProvider } from "./types.js";

// Measured on 2026-11-16 with the full system prompt (free tier):
//   gemini-3.5-flash + low thinking : ~1.6 s, good answers   <- default
//   gemini-3.5-flash (default)      : ~7.4 s (thinks ~700 tokens first)
//   gemini-3.5-flash-lite           : ~1.2 s                 <- fallback
//   gemini-3.8-flash                : 503 "high demand" or no answer at all
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
// Used when the main model stays overloaded, rate-limited or silent.
export const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

/** Give up on an attempt if no text arrives within this delay (the free tier sometimes hangs). */
const FIRST_CHUNK_TIMEOUT_MS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class FirstChunkTimeout extends Error {}

/**
 * Google Gemini (free tier available in Google AI Studio).
 * Note: on the free tier, Google may use prompts and answers to improve its products.
 */
export class GeminiProvider implements ChatProvider {
  readonly name = "gemini";
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string, readonly model: string = GEMINI_DEFAULT_MODEL) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Opens the stream and waits for the first chunk. Overload (503), rate limit (429), server
   * errors and silent hangs are retried once, then the fallback model gets one try.
   */
  private async open(system: string, messages: ChatMessage[]) {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const plan =
      this.model === GEMINI_FALLBACK_MODEL
        ? [{ model: this.model, attempts: 2 }]
        : [{ model: this.model, attempts: 2 }, { model: GEMINI_FALLBACK_MODEL, attempts: 1 }];
    let lastError: unknown;

    for (const { model, attempts } of plan) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(new FirstChunkTimeout()), FIRST_CHUNK_TIMEOUT_MS);
        try {
          const response = await this.ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: system,
              maxOutputTokens: 8192,
              abortSignal: ctrl.signal,
              // "Lite" models answer fast without thinking; full Flash models think a lot by default.
              ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
            },
          });
          const iterator = response[Symbol.asyncIterator]();
          const first = await iterator.next();
          clearTimeout(timer);
          return { iterator, first, model };
        } catch (err) {
          clearTimeout(timer);
          lastError = ctrl.signal.aborted ? new FirstChunkTimeout() : err;
          const retryable =
            ctrl.signal.aborted ||
            (err instanceof ApiError && (err.status === 503 || err.status === 429 || err.status === 500));
          if (!retryable) throw toProviderError(err);
          if (attempt < attempts - 1) await sleep(1000);
        }
      }
    }
    throw toProviderError(lastError);
  }

  async *stream(system: string, messages: ChatMessage[]): AsyncGenerator<ChatEvent> {
    const { iterator, first, model: usedModel } = await this.open(system, messages);

    let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    let stopReason: string | null = null;
    let modelVersion = usedModel;

    const handle = (chunk: GenerateContentResponse): string | undefined => {
      const u = chunk.usageMetadata;
      if (u) {
        const cached = u.cachedContentTokenCount ?? 0;
        usage = {
          input: (u.promptTokenCount ?? 0) - cached,
          output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
          cacheRead: cached,
          cacheWrite: 0,
        };
      }
      stopReason = chunk.candidates?.[0]?.finishReason ?? stopReason;
      modelVersion = chunk.modelVersion ?? modelVersion;
      return chunk.text;
    };

    try {
      let next = first;
      while (!next.done) {
        const text = handle(next.value);
        if (text) yield { type: "text", text };
        next = await iterator.next();
      }
    } catch (err) {
      throw toProviderError(err);
    }

    yield { type: "done", provider: this.name, model: modelVersion, stopReason, usage };
  }
}

function toProviderError(err: unknown): Error {
  if (err instanceof FirstChunkTimeout) {
    return new ProviderError("Gemini did not answer in time (free tier overloaded). Try again in a minute.");
  }
  if (err instanceof ApiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return new ProviderError("Invalid Gemini API key (check GEMINI_API_KEY in .env).");
    if (err.status === 403) return new ProviderError("Gemini API key refused (403). Check the key and that the Gemini API is enabled.");
    if (err.status === 404) return new ProviderError(`Gemini model not found. Check AGENT_MODEL in .env. (${err.message})`);
    if (err.status === 429) return new ProviderError("Gemini free-tier limit reached. Wait a minute, or check your quota in Google AI Studio.");
    if (err.status === 503) return new ProviderError("Gemini is overloaded right now (free tier, high demand). Try again in a minute.");
    return new ProviderError(`Gemini API error ${err.status}: ${err.message}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

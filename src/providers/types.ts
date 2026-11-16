/** One message of the conversation, provider-neutral. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "done"; provider: string; model: string; stopReason: string | null; usage: Usage };

/** A model backend. Each provider turns (system prompt + messages) into a stream of ChatEvents. */
export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  stream(system: string, messages: ChatMessage[]): AsyncGenerator<ChatEvent>;
}

/** Thrown for errors that should be shown to the user as-is (bad key, rate limit...). */
export class ProviderError extends Error {}

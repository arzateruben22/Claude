import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { extractCitations } from "./citations";
import { SYSTEM_PROMPT, buildMessages, type HistoryTurn } from "./prompt";
import type { CoachSnapshot, Metric } from "./types";

/**
 * ANTHROPIC provider for open-ended Advisor questions. The client is injectable so tests use a fake
 * and never touch the network; production builds the official SDK client only when
 * ANTHROPIC_API_KEY is set.
 */

export const COACH_MODEL = "claude-opus-5-5";

/** The one SDK method the provider uses; `new Anthropic()` satisfies it, and so does a test fake. */
export type LlmClient = {
  beta: {
    messages: {
      create(body: MessageCreateParamsNonStreaming, options?: { timeout?: number; maxRetries?: number }): PromiseLike<BetaMessage>;
    };
  };
};

/** The SDK client when an API key is configured, otherwise null (the Advisor then uses RULES). */
export function defaultLlmClient(): LlmClient | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic(); // reads ANTHROPIC_API_KEY
}

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type LlmFailureReason = "refusal" | "auth" | "rate_limit" | "bad_request" | "api_error" | "empty" | "unknown";

export type LlmOutcome =
  | { ok: true; text: string; citations: string[]; model: string }
  | { ok: false; reason: LlmFailureReason; status?: number; notice: string };

const NOTICES: Record<LlmFailureReason, string> = {
  refusal: "Claude declined this request, so the built-in rules engine answered instead.",
  auth: "The Anthropic API key was rejected, so the built-in rules engine answered instead. Check ANTHROPIC_API_KEY.",
  rate_limit: "The Anthropic API is rate-limiting requests right now, so the built-in rules engine answered instead.",
  bad_request: "The Anthropic API rejected the request, so the built-in rules engine answered instead.",
  api_error: "The Anthropic API is unavailable right now, so the built-in rules engine answered instead.",
  empty: "Claude returned an empty answer, so the built-in rules engine answered instead.",
  unknown: "Claude couldn't be reached, so the built-in rules engine answered instead.",
};

export function failureNotice(reason: LlmFailureReason, status?: number): string {
  return reason === "api_error" && status ? NOTICES.api_error.replace("right now", `right now (HTTP ${status})`) : NOTICES[reason];
}

/** Request timeout and retry policy for one chat turn (SDK request options, not API parameters). */
const REQUEST_OPTIONS = { timeout: 120_000, maxRetries: 1 };

export async function askClaude(
  client: LlmClient,
  args: { snapshot: CoachSnapshot; history: readonly HistoryTurn[]; question: string; extraMetrics?: readonly Metric[] },
): Promise<LlmOutcome> {
  const messages = buildMessages(args.snapshot, args.history, args.question, args.extraMetrics);
  // `fallbacks` + the server-side-fallback beta let the API retry a policy refusal on its default
  // fallback model; `output_config.effort` sets the thinking depth (thinking is always adaptive on
  // this model, so `thinking` and sampling parameters are deliberately not sent).
  const params: MessageCreateParamsNonStreaming = {
    model: COACH_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages,
  };
  let response: BetaMessage;
  try {
    response = await client.beta.messages.create(params, REQUEST_OPTIONS);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "auth", status: err.status, notice: failureNotice("auth") };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "rate_limit", status: err.status, notice: failureNotice("rate_limit") };
    if (err instanceof Anthropic.BadRequestError) return { ok: false, reason: "bad_request", status: err.status, notice: failureNotice("bad_request") };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: "api_error", status: err.status, notice: failureNotice("api_error", err.status) };
    return { ok: false, reason: "unknown", notice: failureNotice("unknown") };
  }
  if (response.stop_reason === "refusal") return { ok: false, reason: "refusal", notice: failureNotice("refusal") };
  let text = "";
  for (const block of response.content) if (block.type === "text") text += block.text;
  if (!text.trim()) return { ok: false, reason: "empty", notice: failureNotice("empty") };
  const known = new Set([...args.snapshot.metrics.map((m) => m.id), ...(args.extraMetrics ?? []).map((m) => m.id)]);
  const cleaned = extractCitations(text.trim(), (id) => known.has(id));
  return { ok: true, text: cleaned.text, citations: cleaned.citations, model: response.model };
}

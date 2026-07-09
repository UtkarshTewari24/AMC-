import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";

/**
 * Server-side AI helper (v2). Resolves the Anthropic key and model from the
 * request headers the client attaches (the user's own key entered in
 * Settings), falling back to the server ANTHROPIC_API_KEY env var. Nothing is
 * persisted and no prompt content is logged.
 */

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-opus-4-8",
  "claude-haiku-4-5",
]);

export interface AIContext {
  client: Anthropic;
  model: string;
}

export class NoKeyError extends Error {}

export function aiFromRequest(req: NextRequest): AIContext {
  const headerKey = req.headers.get("x-anthropic-key")?.trim();
  const key = headerKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new NoKeyError(
      "No Anthropic API key. Add your key in Settings to use AI features."
    );
  }
  const requested = req.headers.get("x-anthropic-model")?.trim();
  const model =
    requested && ALLOWED_MODELS.has(requested)
      ? requested
      : "claude-sonnet-4-6";
  return { client: new Anthropic({ apiKey: key }), model };
}

/** Join all text blocks of a message response into one string. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * Extract the first JSON value (object or array) from a model response,
 * tolerating ```json fences and surrounding prose.
 */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model response");
  // find the matching close by scanning bracket depth (string-aware)
  const open = candidate[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error("unterminated JSON in model response");
}

/** Map an error to a user-facing message + HTTP status. */
export function aiErrorResponse(error: unknown): { message: string; status: number } {
  if (error instanceof NoKeyError) {
    return { message: error.message, status: 400 };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { message: "That API key was rejected — check it in Settings.", status: 401 };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { message: "Rate limited by the API — try again in a moment.", status: 429 };
  }
  if (error instanceof Anthropic.APIError) {
    return { message: "The AI request failed. Try again.", status: 502 };
  }
  return { message: "Unexpected error generating a response.", status: 500 };
}

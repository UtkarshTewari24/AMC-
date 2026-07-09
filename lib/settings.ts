"use client";

/**
 * Client-side settings (v2): the user's own Anthropic API key and preferred
 * model, stored in localStorage. The key is sent to our own Next.js API
 * routes via a request header (over HTTPS) and used server-side per request;
 * it is never persisted on the server and the AI routes log no content.
 */

const KEY = "amc10.anthropic_key";
const MODEL = "amc10.anthropic_model";

export const MODELS = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    note: "Fast, capable — recommended default",
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    note: "Highest quality, slower and pricier",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    note: "Fastest and cheapest",
  },
] as const;

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(value: string) {
  try {
    if (value) window.localStorage.setItem(KEY, value.trim());
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function getModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    return window.localStorage.getItem(MODEL) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setModel(value: string) {
  try {
    window.localStorage.setItem(MODEL, value);
  } catch {
    /* storage blocked */
  }
}

/** Headers to attach the user's key + model to an AI API request. */
export function aiHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = getApiKey();
  if (key) h["x-anthropic-key"] = key;
  h["x-anthropic-model"] = getModel();
  return h;
}

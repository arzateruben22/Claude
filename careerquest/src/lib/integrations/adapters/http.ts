/**
 * Small HTTP helpers for adapters. Every call goes through the injected fetch, has a timeout, and turns
 * provider failures into typed errors without echoing response bodies (which can contain personal data).
 */
import type { z } from "zod";
import { IntegrationAuthError, IntegrationHttpError, type FetchLike, type TokenSource } from "./types";

export const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout(init: RequestInit = {}): RequestInit {
  if (init.signal) return init;
  try {
    return { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  } catch {
    return init;
  }
}

async function send(fetchFn: FetchLike, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchFn(url, withTimeout(init));
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const msg = name === "TimeoutError" || name === "AbortError" ? "The provider did not answer in time." : "Could not reach the provider.";
    throw new IntegrationHttpError(msg, 0);
  }
}

function describeStatus(status: number): string {
  if (status === 401) return "The provider rejected the access token.";
  if (status === 403) return "The provider refused access (permission not granted or API disabled).";
  if (status === 404) return "Not found at the provider.";
  if (status === 429) return "The provider is rate-limiting requests; the next sync will continue.";
  if (status >= 500) return `The provider had an internal error (HTTP ${status}).`;
  return `The provider answered HTTP ${status}.`;
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new IntegrationHttpError("The provider returned a response that is not JSON.", res.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new IntegrationHttpError("The provider returned an unexpected response shape.", res.status);
  return parsed.data;
}

/** Unauthenticated JSON GET (public APIs). */
export async function getPublicJson<T>(fetchFn: FetchLike, url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await send(fetchFn, url, { method: "GET", headers: { Accept: "application/json" } });
  if (!res.ok) throw new IntegrationHttpError(describeStatus(res.status), res.status);
  return parseJson(res, schema);
}

/**
 * Bearer-authenticated JSON GET. On 401 the token is refreshed once and the call retried; a second
 * 401 (or a failed refresh) becomes an IntegrationAuthError so the connection is marked for reconnect.
 */
export async function getAuthorizedJson<T>(
  fetchFn: FetchLike,
  tokens: TokenSource,
  url: string,
  schema: z.ZodType<T>,
  headers: Record<string, string> = {},
): Promise<T> {
  const call = (token: string) =>
    send(fetchFn, url, { method: "GET", headers: { Accept: "application/json", ...headers, Authorization: `Bearer ${token}` } });
  let res = await call(await tokens.get());
  if (res.status === 401) {
    const fresh = await tokens.refresh();
    res = await call(fresh);
    if (res.status === 401) throw new IntegrationAuthError("Access was revoked or expired; reconnect to resume syncing.");
  }
  if (!res.ok) throw new IntegrationHttpError(describeStatus(res.status), res.status);
  return parseJson(res, schema);
}

/** Message safe to persist in SyncRun.errors / lastError (no raw provider bodies). */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof IntegrationHttpError || err instanceof IntegrationAuthError) return err.message;
  if (err instanceof Error && err.name === "NotSupportedError") return err.message;
  return "Unexpected error while processing this item.";
}

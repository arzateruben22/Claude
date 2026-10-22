/**
 * Reads the integration-related environment. Kept separate so pure code (registry, OAuth URL
 * builders) takes the values as parameters and tests can pass their own.
 */
import type { IntegrationEnv } from "./registry";

export type ServerIntegrationEnv = IntegrationEnv & { CRON_SECRET?: string | null };

export function readIntegrationEnv(source: Record<string, string | undefined> = process.env): ServerIntegrationEnv {
  const pick = (k: string) => {
    const v = source[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    GOOGLE_CLIENT_ID: pick("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: pick("GOOGLE_CLIENT_SECRET"),
    MICROSOFT_CLIENT_ID: pick("MICROSOFT_CLIENT_ID"),
    MICROSOFT_CLIENT_SECRET: pick("MICROSOFT_CLIENT_SECRET"),
    MICROSOFT_TENANT: pick("MICROSOFT_TENANT"),
    APP_URL: pick("APP_URL"),
    CRON_SECRET: pick("CRON_SECRET"),
  };
}

/** APP_URL without a trailing slash (path prefixes are kept), or null when unset/invalid. */
export function appBaseUrl(env: IntegrationEnv): string | null {
  if (!env.APP_URL) return null;
  try {
    const u = new URL(env.APP_URL);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Absolute URL for an app path, preferring APP_URL over the request URL (which can be internal behind proxies). */
export function appUrl(path: string, env: IntegrationEnv, requestUrl?: string): string {
  const base = appBaseUrl(env);
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return new URL(path, requestUrl ?? "http://localhost:3000").toString();
}

/**
 * Request guards for state-changing integration endpoints reached with the session cookie.
 * A cross-site form POST does not carry the SameSite=Lax session cookie, and these checks also reject
 * any request whose Origin (or Fetch Metadata) says it came from another site.
 */
import { appBaseUrl } from "./env";
import type { IntegrationEnv } from "./registry";

export function isSameOriginRequest(req: Request, env: IntegrationEnv): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // Older clients omit Origin on same-origin POSTs; Fetch Metadata covers modern ones.
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    // ignore
  }
  const base = appBaseUrl(env);
  if (base) allowed.add(new URL(base).origin);
  return allowed.has(origin);
}

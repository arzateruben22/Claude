/**
 * CORS policy for the browser-extension API (pure, unit-tested).
 *
 * The extension's service worker normally reaches CareerQuest through an optional host permission,
 * which bypasses CORS. When that permission is not granted (or for a non-loopback http origin Chrome
 * cannot grant), the request is a real cross-origin request from `chrome-extension://<id>` and needs
 * these headers. Only Chrome extension origins and the app's own origin (APP_URL) are ever echoed;
 * credentials are never allowed (the API is bearer-token only, cookies are ignored).
 */

/** Chrome (and Chromium-based) extension ids are 32 characters in the range a–p. */
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS";
export const CORS_ALLOWED_HEADERS = "authorization, content-type";
export const CORS_MAX_AGE_SECONDS = 600;

/** Origin (scheme://host[:port]) of APP_URL, or null when unset or not http(s). */
export function appOrigin(appUrl: string | null | undefined): string | null {
  if (!appUrl) return null;
  try {
    const u = new URL(appUrl.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** True for a `chrome-extension://<32 a–p>` origin or exactly the APP_URL origin. */
export function isAllowedOrigin(origin: string | null | undefined, appUrl: string | null | undefined): boolean {
  if (!origin) return false;
  if (EXTENSION_ORIGIN.test(origin)) return true;
  const app = appOrigin(appUrl);
  return app !== null && origin === app;
}

/**
 * Headers for a response to a request carrying `origin`. Disallowed or missing origins get only
 * `Vary: Origin` (the browser then blocks the cross-origin read). Preflight responses also carry the
 * allowed methods/headers and a cache lifetime.
 */
export function corsHeaders(
  origin: string | null | undefined,
  appUrl: string | null | undefined,
  opts: { preflight?: boolean } = {},
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (!origin || !isAllowedOrigin(origin, appUrl)) return headers;
  headers["Access-Control-Allow-Origin"] = origin;
  if (opts.preflight) {
    headers["Access-Control-Allow-Methods"] = CORS_ALLOWED_METHODS;
    headers["Access-Control-Allow-Headers"] = CORS_ALLOWED_HEADERS;
    headers["Access-Control-Max-Age"] = String(CORS_MAX_AGE_SECONDS);
  } else {
    headers["Access-Control-Expose-Headers"] = "Retry-After";
  }
  return headers;
}

/** APP_URL without a trailing slash (a path prefix is kept), or null when unset/invalid. */
export function appBaseFromEnv(appUrl: string | null | undefined): string | null {
  if (!appUrl) return null;
  try {
    const u = new URL(appUrl.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Absolute link to an application's detail page. */
export function applicationDetailUrl(appBase: string, applicationId: string): string {
  return `${appBase.replace(/\/+$/, "")}/applications/${encodeURIComponent(applicationId)}`;
}

/**
 * Minimal CareerQuest extension API client (pure: fetch is injected).
 *
 * Every method throws an {@link ApiError} with a stable `code`:
 *   not_configured | insecure | unauthorized | rate_limited | server | network | timeout | bad_response | http
 */

import { API_TIMEOUT_MS } from "./constants.js";
import { isLoopbackHost } from "./url.js";

export class ApiError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ status?: number, retryAfterSeconds?: number }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = extra.status ?? 0;
    this.retryAfterSeconds = extra.retryAfterSeconds;
  }
}

/** Whether a failed request should be queued and retried later. */
export function isRetryable(error) {
  return error instanceof ApiError && (error.code === "rate_limited" || error.code === "server" || error.code === "network" || error.code === "timeout");
}

/**
 * @typedef {object} ApiSettings
 * @property {string} apiBaseUrl
 * @property {string} token
 */

/**
 * @param {object} deps
 * @param {typeof fetch} deps.fetchImpl
 * @param {() => Promise<ApiSettings>} deps.getSettings
 * @param {number} [deps.timeoutMs]
 */
export function createApiClient({ fetchImpl, getSettings, timeoutMs = API_TIMEOUT_MS }) {
  /**
   * @param {string} method
   * @param {string} path
   * @param {{ body?: object, settings?: ApiSettings, query?: Record<string, string | undefined> }} [opts]
   */
  async function request(method, path, opts = {}) {
    const settings = opts.settings ?? (await getSettings());
    if (!settings?.apiBaseUrl || !settings?.token) {
      throw new ApiError("not_configured", "Connect the extension to CareerQuest in the options page.");
    }
    const url = new URL(settings.apiBaseUrl.replace(/\/+$/, "") + path);
    // Defence in depth (settings are validated when saved): the token never
    // travels over plain http except to this machine.
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
      throw new ApiError("insecure", "CareerQuest must be reached over https:// (plain http is allowed only for localhost).");
    }
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${settings.token}`,
          Accept: "application/json",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
    } catch (err) {
      clearTimeout(timer);
      if (err && err.name === "AbortError") throw new ApiError("timeout", "CareerQuest did not respond in time.");
      throw new ApiError("network", "Could not reach CareerQuest. Check the API base URL and that the app is running.");
    }
    clearTimeout(timer);

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (res.ok) throw new ApiError("bad_response", "CareerQuest returned a non-JSON response.", { status: res.status });
      }
    }
    if (res.status === 401) throw new ApiError("unauthorized", data?.error || "Token rejected. Reconnect in the options page.", { status: 401 });
    if (res.status === 429) {
      const retryAfterSeconds = Number(data?.retryAfterSeconds ?? res.headers.get("retry-after") ?? 60) || 60;
      throw new ApiError("rate_limited", data?.error || "Rate limited.", { status: 429, retryAfterSeconds });
    }
    if (res.status >= 500) throw new ApiError("server", data?.error || `Server error (${res.status}).`, { status: res.status });
    if (!res.ok) throw new ApiError("http", data?.error || `Request failed (${res.status}).`, { status: res.status });
    return data;
  }

  return {
    /** @param {ApiSettings} [settings] */
    me: (settings) => request("GET", "/api/extension/me", { settings }),
    /** @param {{ url?: string, company?: string, title?: string, requisitionId?: string }} params */
    lookup: (params) => request("GET", "/api/extension/lookup", { query: params }),
    /** @param {object} payload */
    createCapture: (payload) => request("POST", "/api/extension/captures", { body: payload }),
  };
}

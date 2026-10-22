/**
 * URL helpers (pure, no chrome.* calls).
 */

/**
 * Loopback hosts: the only hosts the developer token may be sent to over plain
 * http (a CareerQuest dev server on this machine).
 * @param {string} hostname
 */
export function isLoopbackHost(hostname) {
  const h = String(hostname || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || /^127(?:\.\d{1,3}){3}$/.test(h) || h === "::1";
}

/** @param {string} raw */
function parseWithDefaultScheme(raw) {
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme) return new URL(raw);
  // No scheme typed: http only for a local dev server, https for everything else.
  const guess = new URL(`http://${raw}`);
  return new URL(`${isLoopbackHost(guess.hostname) ? "http" : "https"}://${raw}`);
}

/**
 * Why a user-entered API base URL cannot be used, or null when it is fine.
 * @param {string} input
 * @returns {string | null}
 */
export function baseUrlError(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "Enter the CareerQuest URL.";
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme && !/^https?$/i.test(scheme[1])) return "Enter an http(s) URL for CareerQuest.";
  let u;
  try {
    u = parseWithDefaultScheme(raw);
  } catch {
    return "Enter a valid http(s) URL for CareerQuest.";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Enter an http(s) URL for CareerQuest.";
  if (u.username || u.password) return "Do not put a user name or password in the URL.";
  if (u.protocol === "http:" && !isLoopbackHost(u.hostname)) {
    return "Use https:// — the developer token is only sent over plain http to localhost.";
  }
  return null;
}

/**
 * Normalises a user-entered API base URL: trims, adds a scheme when missing
 * (http for localhost, https otherwise), drops trailing slashes. Returns null
 * when the value is not a usable URL — including plain http to a non-loopback
 * host, which would expose the developer token on the network.
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeBaseUrl(input) {
  if (baseUrlError(input)) return null;
  const u = parseWithDefaultScheme(String(input).trim());
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

/**
 * Converts an origin into the match pattern used for optional host permissions,
 * e.g. "http://localhost:3000" → "http://localhost/*" (match patterns ignore ports).
 * @param {string} baseUrl
 * @returns {string | null}
 */
export function hostPatternFor(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

/** @param {string} pattern */
function splitPattern(pattern) {
  const m = String(pattern || "").match(/^(\*|https?):\/\/([^/]*)(\/.*)$/);
  return m ? { scheme: m[1], host: m[2], path: m[3] } : null;
}

/**
 * Whether the match pattern `general` covers every URL of `specific`
 * (both "scheme://host/path"; enough for "scheme://host/*" origins).
 * @param {string} general
 * @param {string} specific
 */
export function patternCovers(general, specific) {
  const g = splitPattern(general);
  const s = splitPattern(specific);
  if (!g || !s) return false;
  if (g.scheme !== "*" && g.scheme !== s.scheme) return false;
  if (g.scheme === "*" && s.scheme === "*") return false;
  const hostOk = g.host === "*" || g.host === s.host || (g.host.startsWith("*.") && (s.host === g.host.slice(2) || s.host.endsWith(g.host.slice(1))));
  if (!hostOk) return false;
  return g.path === "/*" || g.path === s.path;
}

/**
 * Whether Chrome can grant `pattern` at runtime (it must be covered by the
 * manifest's optional_host_permissions).
 * @param {string} pattern
 * @param {{ optional_host_permissions?: string[] }} manifest
 */
export function isGrantableOrigin(pattern, manifest) {
  return (manifest?.optional_host_permissions || []).some((g) => patternCovers(g, pattern));
}

/**
 * Previously granted CareerQuest origins that are no longer needed: exact
 * "scheme://host/*" origins covered by optional_host_permissions, other than
 * `keepPattern`, and never one of the content-script (required) patterns.
 * @param {string[]} grantedOrigins chrome.permissions.getAll().origins
 * @param {string | null} keepPattern
 * @param {{ optional_host_permissions?: string[], content_scripts?: Array<{ matches?: string[] }> }} manifest
 */
export function staleHostOrigins(grantedOrigins, keepPattern, manifest) {
  const required = new Set((manifest?.content_scripts || []).flatMap((c) => c.matches || []));
  return (grantedOrigins || []).filter((origin) => {
    if (origin === keepPattern || required.has(origin)) return false;
    const p = splitPattern(origin);
    if (!p || p.path !== "/*" || p.host.includes("*") || p.scheme === "*") return false;
    return isGrantableOrigin(origin, manifest);
  });
}

/**
 * Strips the fragment from a URL and returns it unchanged otherwise.
 * @param {string} url
 */
export function stripFragment(url) {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

/**
 * URL helpers (pure, no chrome.* calls).
 */

/**
 * Normalises a user-entered API base URL: trims, adds a scheme when missing,
 * drops trailing slashes. Returns null when the value is not a valid http(s) URL.
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeBaseUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
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

/**
 * Strips the fragment from a URL and returns it unchanged otherwise.
 * @param {string} url
 */
export function stripFragment(url) {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

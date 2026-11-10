// Request protection that does not depend on who is asking (docs/API.md §2, items 1-3):
// the Host check, the Origin check, the content-type rule and the fixed response headers.
//
// Rules protected here:
//   * The server answers for exactly one origin. A request addressed to any other host
//     name (DNS rebinding, a stray proxy, a preview link) is refused before routing.
//   * A state-changing request must come from the app's own page. Browsers always send
//     Origin on such requests, so a missing header is treated like a wrong one.
//   * No Access-Control-* header is ever sent: no other origin may read a response.
//   * Every response carries the same security headers, errors and static files included.

/** The exact policy from docs/API.md §2. The UI must fit it: no inline script, style or handler. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' https://accounts.google.com/gsi/style",
  'frame-src https://accounts.google.com/gsi/',
  "connect-src 'self' https://accounts.google.com/gsi/",
  "img-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const ALWAYS = Object.freeze({
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Sign in with Google opens a popup that must be able to hand the result back.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
});

// Sent only when the app is served over https: on plain http://localhost it would be
// ignored at best, and at worst remembered for a host name other projects share.
const TRANSPORT = Object.freeze({ 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' });

// API answers are personal and change with every action: never cached, never embedded
// by another origin.
const API_ONLY = Object.freeze({ 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'same-origin' });

/**
 * @param {{ secureOrigin: boolean, api: boolean }} options  `api` is true for a path under /api/
 * @returns {Record<string, string>}
 */
export function securityHeaders({ secureOrigin, api }) {
  return { ...ALWAYS, ...(secureOrigin ? TRANSPORT : {}), ...(api ? API_ONLY : {}) };
}

/**
 * True when the request names exactly the host (and port) of APP_ORIGIN, once.
 * Node keeps only the first of several Host headers; a request that sends more than one
 * is refused, because a proxy in front may have routed on a different one.
 * @param {import('node:http').IncomingMessage} req
 * @param {string} expectedHost  config.expectedHost
 */
export function hostMatches(req, expectedHost) {
  const hosts = req.headersDistinct?.host ?? [];
  return hosts.length === 1 && hosts[0].toLowerCase() === expectedHost;
}

/** True when the Origin header is exactly APP_ORIGIN. */
export function originMatches(req, appOrigin) {
  return req.headers.origin === appOrigin;
}

/** True for `application/json`, with or without parameters such as a charset. */
export function isJsonContentType(header) {
  if (typeof header !== 'string') return false;
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

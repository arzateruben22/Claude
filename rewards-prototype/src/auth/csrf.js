// CSRF token for state-changing requests (docs/API.md §2 item 3 and §3).
//
//   token = base64url(HMAC-SHA256(key = the raw session token, message = "csrf"))
//
// It is derived, never stored: the server recomputes it from the session cookie on every
// request. A page on another site can make the browser SEND the cookie but can neither
// read it nor read GET /api/session, so it cannot produce the matching X-CSRF-Token.
// Because the key is the session token, the CSRF token changes with every sign-in and
// dies with the session.

import { createHmac } from 'node:crypto';
import { safeEqual } from '../lib/ids.js';

const isSessionToken = (value) => typeof value === 'string' && value.length > 0;

/**
 * @param {string} sessionToken  the raw session token (the cookie value), never its hash
 * @returns {string} 43 base64url characters
 */
export function csrfTokenFor(sessionToken) {
  // An empty key would give every visitor the same, publicly computable token.
  if (!isSessionToken(sessionToken)) throw new TypeError('csrfTokenFor: a session token is required');
  return createHmac('sha256', sessionToken).update('csrf').digest('base64url');
}

/**
 * Constant-time check of the X-CSRF-Token header against the session's token.
 * False for anything that is not a string, and when there is no session token.
 * @param {unknown} sessionToken
 * @param {unknown} presented  the header value as received
 * @returns {boolean}
 */
export function verifyCsrf(sessionToken, presented) {
  if (!isSessionToken(sessionToken) || typeof presented !== 'string') return false;
  return safeEqual(csrfTokenFor(sessionToken), presented);
}

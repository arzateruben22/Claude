// The two cookies this server sets, and reading the Cookie header (docs/API.md §1 and §3).
//
// Names and the Secure attribute follow APP_ORIGIN, never NODE_ENV:
//
//   https://…                      __Host-sid     __Host-nonce     with Secure
//   http://localhost | 127.0.0.1   rewards_sid    rewards_nonce    without Secure
//          | [::1]
//
// The `__Host-` prefix makes the browser itself refuse the cookie unless it is Secure,
// has Path=/ and has no Domain attribute, so no sibling subdomain can plant or shadow it.
// Plain http is for local development only, where Safari does not reliably keep Secure
// cookies; any other http origin is refused outright rather than given a cookie that
// would travel in clear text.
//
// Both cookies are HttpOnly: page script never needs them. The session cookie is
// SameSite=Lax so that following a link to the app keeps you signed in; the nonce cookie
// is SameSite=Strict because only the app's own page ever needs to send it.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// RFC 6265: a cookie name is an HTTP token; a value is a run of "cookie octets".
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_VALUE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;
// What this server ever puts in a cookie: a base64url token. Checked before building a
// header so that nothing can smuggle a ";" or a line break into Set-Cookie.
const TOKEN_VALUE = /^[A-Za-z0-9_-]{16,256}$/;

function profileFor(appOrigin) {
  let url;
  try {
    url = new URL(appOrigin);
  } catch {
    throw new TypeError('cookies: appOrigin must be an origin such as https://rewards.example.test');
  }
  if (url.protocol === 'https:') return { secure: true, session: '__Host-sid', nonce: '__Host-nonce' };
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) return { secure: false, session: 'rewards_sid', nonce: 'rewards_nonce' };
  throw new TypeError('cookies: appOrigin must be https, or http on localhost, 127.0.0.1 or [::1]');
}

/**
 * The cookie names in use for this origin.
 * @param {string} appOrigin  APP_ORIGIN
 * @returns {{ session: string, nonce: string }}
 */
export function cookieNames(appOrigin) {
  const { session, nonce } = profileFor(appOrigin);
  return { session, nonce };
}

function build({ name, value, secure, sameSite, maxAgeSeconds }) {
  return [`${name}=${value}`, ...(secure ? ['Secure'] : []), 'HttpOnly', `SameSite=${sameSite}`, 'Path=/', `Max-Age=${maxAgeSeconds}`].join('; ');
}

function assertSettable(caller, value, maxAgeSeconds) {
  if (typeof value !== 'string' || !TOKEN_VALUE.test(value)) throw new TypeError(`${caller}: the value must be a base64url token`);
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1) throw new TypeError(`${caller}: maxAgeSeconds must be a positive whole number`);
}

/**
 * Set-Cookie value for a new session.
 * @param {string} appOrigin
 * @param {{ token: string, maxAgeSeconds: number }} input  both as returned by createSession()
 * @returns {string}
 */
export function sessionCookie(appOrigin, { token, maxAgeSeconds }) {
  assertSettable('sessionCookie', token, maxAgeSeconds);
  const { secure, session } = profileFor(appOrigin);
  return build({ name: session, value: token, secure, sameSite: 'Lax', maxAgeSeconds });
}

/**
 * Set-Cookie value that removes the session cookie (sign-out, erasure). It repeats the
 * original attributes: a browser only replaces a `__Host-` cookie with one that still
 * satisfies the prefix rules.
 */
export function clearSessionCookie(appOrigin) {
  const { secure, session } = profileFor(appOrigin);
  return build({ name: session, value: '', secure, sameSite: 'Lax', maxAgeSeconds: 0 });
}

/**
 * Set-Cookie value for the one-time sign-in nonce.
 * @param {string} appOrigin
 * @param {{ nonce: string, maxAgeSeconds: number }} input  `maxAgeSeconds` is the nonce lifetime (600)
 * @returns {string}
 */
export function nonceCookie(appOrigin, { nonce, maxAgeSeconds }) {
  assertSettable('nonceCookie', nonce, maxAgeSeconds);
  const profile = profileFor(appOrigin);
  return build({ name: profile.nonce, value: nonce, secure: profile.secure, sameSite: 'Strict', maxAgeSeconds });
}

/** Set-Cookie value that removes the nonce cookie, sent once a sign-in attempt has used the nonce. */
export function clearNonceCookie(appOrigin) {
  const profile = profileFor(appOrigin);
  return build({ name: profile.nonce, value: '', secure: profile.secure, sameSite: 'Strict', maxAgeSeconds: 0 });
}

/**
 * Parses a Cookie request header into a map of name -> value.
 *
 * The header is attacker-controlled, so:
 *   * the map has no prototype: a cookie named `__proto__` or `constructor` is an ordinary
 *     entry and can neither pollute anything nor be mistaken for an inherited property;
 *   * pairs that are not well-formed (no "=", an empty or illegal name, an illegal value)
 *     are skipped rather than repaired;
 *   * when a name occurs more than once the FIRST occurrence wins, so appending a second
 *     copy to the header never changes what the server reads.
 * Values are returned as sent (surrounding double quotes removed); they are not
 * percent-decoded, because this server only ever sets base64url values.
 * @param {unknown} header  the raw Cookie header, or undefined
 * @returns {Record<string, string>} an object created with Object.create(null)
 */
export function parseCookieHeader(header) {
  const cookies = Object.create(null);
  if (typeof header !== 'string') return cookies;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    let value = pair.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!COOKIE_NAME.test(name) || !COOKIE_VALUE.test(value)) continue;
    if (!Object.hasOwn(cookies, name)) cookies[name] = value;
  }
  return cookies;
}

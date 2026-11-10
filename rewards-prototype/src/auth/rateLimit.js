// In-memory rate limiting (docs/API.md §2 item 5).
//
// A fixed window per key: the first request from a key opens a window of `windowMs`;
// `limit` requests are allowed inside it and the rest are refused until it closes. The
// HTTP layer builds one limiter per rule: sign-in attempts per client (key from
// clientKey() below) and sign-in attempts overall (one constant key).
//
// Fixed, not sliding: a client that times it well can fit the end of one window and the
// start of the next into a short stretch (at most 2 x limit - 1 requests). For slowing
// down sign-in attempts that is acceptable, and it keeps one small record per key.
//
// Memory is bounded. At most `maxKeys` windows are held; beyond that the oldest is
// dropped. Someone who can present that many different keys can therefore forget their
// own window early, which is exactly why the "overall" limit exists alongside the
// per-client one.
//
// Counts are lost on restart. That is acceptable for these limits, and it is why the dev
// sign-in lock (src/auth/devLogin.js) does not rely on this module.

import { isIP } from 'node:net';

const positiveInteger = (value) => Number.isInteger(value) && value >= 1;

/**
 * @param {{ clock: { now(): Date }, limit: number, windowMs: number, maxKeys?: number }} options
 */
export function createRateLimiter({ clock, limit, windowMs, maxKeys = 10_000 }) {
  if (typeof clock?.now !== 'function') throw new TypeError('createRateLimiter: clock is required');
  if (!positiveInteger(limit)) throw new TypeError('createRateLimiter: limit must be a positive whole number');
  if (!positiveInteger(windowMs)) throw new TypeError('createRateLimiter: windowMs must be a positive whole number');
  if (!positiveInteger(maxKeys)) throw new TypeError('createRateLimiter: maxKeys must be a positive whole number');

  // key -> { startedAt, count }. A key is (re)inserted whenever its window opens, so the
  // Map's order is the order in which windows opened, and therefore in which they close.
  const windows = new Map();

  function dropClosed(nowMs) {
    for (const [key, window] of windows) {
      if (nowMs - window.startedAt < windowMs) break;
      windows.delete(key);
    }
  }

  return Object.freeze({
    /**
     * Counts one request for `key` and says whether it may proceed.
     * @param {string} key
     * @returns {{ allowed: boolean, retryAfterSeconds: number }} `retryAfterSeconds` is 0 when
     *          allowed, otherwise the whole seconds until the key's window closes (at least 1)
     */
    check(key) {
      if (typeof key !== 'string' || key.length === 0) throw new TypeError('rate limiter: key must be a non-empty string');
      const nowMs = clock.now().getTime();
      let window = windows.get(key);
      if (!window || nowMs - window.startedAt >= windowMs) {
        windows.delete(key);
        dropClosed(nowMs);
        while (windows.size >= maxKeys) windows.delete(windows.keys().next().value);
        window = { startedAt: nowMs, count: 0 };
        windows.set(key, window);
      }
      if (window.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.startedAt + windowMs - nowMs) / 1000)) };
      }
      window.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },

    /** How many keys are being tracked right now. Never more than `maxKeys`. */
    get size() {
      return windows.size;
    },
  });
}

/**
 * The address a request is rate-limited under (docs/API.md §2 item 5).
 *
 *   trustProxyHops = 0      the socket address. X-Forwarded-For is ignored completely:
 *                           with no proxy in front, the client wrote that header itself.
 *   trustProxyHops = n > 0  the n-th address from the RIGHT of X-Forwarded-For. Each
 *                           trusted proxy appends the address it saw, so the last n
 *                           entries were written by our own proxies and everything to
 *                           their left is whatever the client chose to send.
 *
 * If the header has fewer than n entries, or the entry in that position is not an IP
 * address, the socket address is used. That errs towards several people sharing one
 * limit, never towards a client choosing its own key.
 * @param {{ remoteAddress?: string, forwardedFor?: string|string[], trustProxyHops: number }} input
 *        `forwardedFor` is the raw X-Forwarded-For header value
 * @returns {string}
 */
export function clientKey({ remoteAddress, forwardedFor, trustProxyHops }) {
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 3) {
    throw new TypeError('clientKey: trustProxyHops must be a whole number from 0 to 3');
  }
  // A socket that has already closed has no address; those requests share one key.
  const socketAddress = typeof remoteAddress === 'string' && remoteAddress.length > 0 ? remoteAddress.toLowerCase() : 'unknown';
  if (trustProxyHops === 0) return socketAddress;

  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  if (typeof header !== 'string') return socketAddress;
  const entries = header.split(',');
  if (entries.length < trustProxyHops) return socketAddress;
  const candidate = entries[entries.length - trustProxyHops].trim().toLowerCase();
  return isIP(candidate) ? candidate : socketAddress;
}

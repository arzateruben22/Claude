// One-time nonces for Sign in with Google (docs/API.md §3).
//
// GET /api/auth/config issues a nonce, puts it in an HttpOnly cookie and gives it to the
// page, which passes it to the Google button; Google copies it into the ID token. A token
// is accepted only if its nonce equals the cookie AND is still outstanding here. That
// ties a token to one browser and to one sign-in this server started, so a captured or
// replayed token is useless.
//
// Single use is absolute: consume() removes the nonce the first time it is presented,
// whether or not the rest of the sign-in then succeeds. A failed attempt therefore needs
// a fresh nonce (a page reload), and nothing can be retried against the same one.
//
// In memory on purpose: nonces live ten minutes and a restart simply makes people reload
// the sign-in page. The store is bounded so that an unauthenticated route cannot be used
// to grow it without limit.

import { randomToken } from '../lib/ids.js';

/**
 * @param {{ clock: { now(): Date }, ttlMs?: number, max?: number }} options
 *        `ttlMs` how long a nonce may be redeemed (default ten minutes);
 *        `max` how many may be outstanding at once (default 1000)
 */
export function createNonceStore({ clock, ttlMs = 600_000, max = 1000 }) {
  if (typeof clock?.now !== 'function') throw new TypeError('createNonceStore: clock is required');
  if (!Number.isInteger(ttlMs) || ttlMs < 1) throw new TypeError('createNonceStore: ttlMs must be a positive whole number');
  if (!Number.isInteger(max) || max < 1) throw new TypeError('createNonceStore: max must be a positive whole number');

  // nonce -> expiry in ms. A Map iterates in insertion order and every entry has the same
  // lifetime, so the first entry is always both the oldest and the first to expire.
  const outstanding = new Map();

  function pruneExpired(nowMs) {
    for (const [nonce, expiresAt] of outstanding) {
      if (expiresAt > nowMs) break;
      outstanding.delete(nonce);
    }
  }

  return Object.freeze({
    /** @returns {string} a fresh 256-bit nonce, redeemable once within the lifetime */
    issue() {
      const nowMs = clock.now().getTime();
      pruneExpired(nowMs);
      // At capacity the OLDEST goes: it is the one most likely to have been abandoned.
      while (outstanding.size >= max) outstanding.delete(outstanding.keys().next().value);
      const nonce = randomToken(32);
      outstanding.set(nonce, nowMs + ttlMs);
      return nonce;
    },

    /**
     * Redeems a nonce. True exactly once per issued nonce, and only before it expires;
     * false for anything unknown, already used, expired, evicted or not a string.
     * @param {unknown} nonce
     * @returns {boolean}
     */
    consume(nonce) {
      if (typeof nonce !== 'string') return false;
      const expiresAt = outstanding.get(nonce);
      if (expiresAt === undefined) return false;
      outstanding.delete(nonce);
      return expiresAt > clock.now().getTime();
    },

    /** How many nonces are held right now (expired ones are dropped lazily, on the next issue). */
    get size() {
      return outstanding.size;
    },
  });
}

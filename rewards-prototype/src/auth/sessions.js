// Server-side sessions (docs/API.md §3, "Sessions").
//
// The cookie holds a random 256-bit token. The database holds only its SHA-256, so a copy
// of the database file (a backup, a leak) cannot be replayed as a sign-in.
//
// A session is honoured only while ALL of these hold, checked on every request:
//   * its row exists
//   * it has not expired, compared as ISO text against the application clock (never
//     against SQLite's datetime('now'), which writes a different format)
//   * it was created by the sign-in mode the server is running in NOW, so a dev session
//     is worthless the moment the same database is served with Google sign-in
//   * its account is still active
// Changing an account's role, status or member link deletes its sessions in the same
// statement (schema trigger sessions_end_on_privilege_change); deleting the account
// cascades.
//
// Lifetime is fixed at creation and never extended by use. The CSRF token is not stored:
// src/auth/csrf.js derives it from the raw token on each request.

import { unauthorized } from '../lib/errors.js';
import { randomToken, sha256Hex } from '../lib/ids.js';
import { nowIso } from '../domain/context.js';
import { getActiveUser } from '../domain/users.js';

export const AUTH_METHODS = Object.freeze(['google', 'dev']);
/** Upper bound of SESSION_TTL_HOURS (30 days). */
export const MAX_SESSION_TTL_HOURS = 720;

const TOKEN_BYTES = 32;
// 32 random bytes in base64url are always exactly 43 characters. Anything else cannot be
// one of our tokens, so it is neither hashed nor looked up.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const HOUR_MS = 60 * 60 * 1000;
// `last_seen_at` is informational. Refreshing it at most this often keeps ordinary page
// loads read-only.
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

const isToken = (token) => typeof token === 'string' && TOKEN_SHAPE.test(token);

function assertAuthMethod(caller, authMethod) {
  if (!AUTH_METHODS.includes(authMethod)) throw new TypeError(`${caller}: auth method must be "google" or "dev"`);
}

/**
 * Starts a session for an active account. The raw token exists only in the return value
 * (and then in the person's cookie); it cannot be read back from the database.
 *
 * Signing in never reuses a token: the caller first ends the session named by any
 * incoming cookie with destroySession().
 * @param {{ userId: string, authMethod: 'google'|'dev', ttlHours: number }} input
 *        `ttlHours` is SESSION_TTL_HOURS, a whole number from 1 to 720
 * @returns {{ token: string, expiresAt: string, maxAgeSeconds: number }}
 */
export function createSession(ctx, { userId, authMethod, ttlHours }) {
  assertAuthMethod('createSession', authMethod);
  if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > MAX_SESSION_TTL_HOURS) {
    throw new TypeError(`createSession: ttlHours must be a whole number from 1 to ${MAX_SESSION_TTL_HOURS}`);
  }
  const token = randomToken(TOKEN_BYTES);
  const now = ctx.clock.now();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlHours * HOUR_MS).toISOString();
  // The row is written only if the account is active at this very moment. The privilege
  // trigger ends sessions when a status CHANGES; it would not notice one created for an
  // account that was already disabled.
  const inserted = ctx.db.run(
    `INSERT INTO sessions (token_hash, user_id, auth_method, created_at, expires_at, last_seen_at)
     SELECT ?, id, ?, ?, ?, ? FROM users WHERE id = ? AND status = 'active'`,
    [sha256Hex(token), authMethod, createdAt, expiresAt, createdAt, userId],
  );
  if (inserted.changes !== 1) throw unauthorized();
  return { token, expiresAt, maxAgeSeconds: ttlHours * 3600 };
}

/**
 * Looks up the session a cookie names. Returns null for anything that is not a live
 * session of an active account in the configured sign-in mode; it never throws for a bad
 * token, because cookies are attacker-controlled input.
 * @param {unknown} token  the raw cookie value
 * @param {{ authMode: 'google'|'dev' }} options  the configured AUTH_MODE
 * @returns {{ user: object, session: { authMethod: string, createdAt: string, expiresAt: string, lastSeenAt: string } } | null}
 *          `user` is the account view from domain/users.js getActiveUser
 */
export function resolveSession(ctx, token, { authMode } = {}) {
  assertAuthMethod('resolveSession', authMode);
  if (!isToken(token)) return null;
  const tokenHash = sha256Hex(token);
  const row = ctx.db.get('SELECT user_id, auth_method, created_at, expires_at, last_seen_at FROM sessions WHERE token_hash = ?', [tokenHash]);
  if (!row) return null;

  const now = ctx.clock.now();
  // Valid strictly BEFORE the expiry instant. An expired row is of no further use to anyone.
  if (row.expires_at <= now.toISOString()) {
    ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }
  if (row.auth_method !== authMode) return null;
  const user = getActiveUser(ctx, row.user_id);
  if (!user) return null;

  let lastSeenAt = row.last_seen_at;
  if (now.getTime() - Date.parse(lastSeenAt) >= LAST_SEEN_REFRESH_MS) {
    lastSeenAt = now.toISOString();
    ctx.db.run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', [lastSeenAt, tokenHash]);
  }
  return { user, session: { authMethod: row.auth_method, createdAt: row.created_at, expiresAt: row.expires_at, lastSeenAt } };
}

/**
 * Ends the session a cookie names (sign-out, and before every new sign-in).
 * @returns {boolean} whether a session was ended
 */
export function destroySession(ctx, token) {
  if (!isToken(token)) return false;
  return ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256Hex(token)]).changes === 1;
}

/**
 * Signs an account out everywhere.
 * @returns {number} how many sessions were ended
 */
export function destroySessionsForUser(ctx, userId) {
  return ctx.db.run('DELETE FROM sessions WHERE user_id = ?', [userId]).changes;
}

/**
 * Start-up housekeeping: removes every session whose time is up.
 * @returns {number} how many rows were removed
 */
export function purgeExpiredSessions(ctx) {
  return ctx.db.run('DELETE FROM sessions WHERE expires_at <= ?', [nowIso(ctx)]).changes;
}

/**
 * Start-up housekeeping: removes every session created by one sign-in method. In
 * `google` mode the server calls this with 'dev', so no simulated sign-in survives into
 * a database that is being served for real.
 * @param {'google'|'dev'} authMethod
 * @returns {number} how many rows were removed
 */
export function purgeSessionsByMethod(ctx, authMethod) {
  assertAuthMethod('purgeSessionsByMethod', authMethod);
  return ctx.db.run('DELETE FROM sessions WHERE auth_method = ?', [authMethod]).changes;
}

// Every domain function takes a context as its first argument:
//
//   ctx.db         Db handle (src/db/sqlite.js)
//   ctx.clock      { now(): Date }
//   ctx.actor      who is doing this: { userId, role, memberId } or SYSTEM_ACTOR
//   ctx.requestId  optional correlation id, copied into audit rows
//
// Domain code never reads process.env, never touches HTTP objects and never calls
// Date.now() directly.

import { systemClock } from '../lib/clock.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SYSTEM_ACTOR = Object.freeze({ userId: null, role: 'system', memberId: null });

/**
 * @param {{ db: import('../db/sqlite.js').Db, clock?: { now(): Date },
 *           actor?: { userId: string|null, role: 'admin'|'member'|'system', memberId: string|null },
 *           requestId?: string|null }} input
 */
export function createContext({ db, clock = systemClock, actor = SYSTEM_ACTOR, requestId = null }) {
  if (!db) throw new TypeError('createContext: db is required');
  return Object.freeze({ db, clock, actor, requestId });
}

/** Same context acting as someone else (used by the HTTP layer once the session is known). */
export function withActor(ctx, actor) {
  return Object.freeze({ ...ctx, actor });
}

export const nowIso = (ctx) => ctx.clock.now().toISOString();

export const isAdmin = (ctx) => ctx.actor.role === 'admin';
export const isSystem = (ctx) => ctx.actor.role === 'system';

/** Admin-only operations. The system actor (seed scripts, boot tasks) is also allowed. */
export function requireAdmin(ctx) {
  if (ctx.actor.role === 'admin' || ctx.actor.role === 'system') return;
  if (!ctx.actor.userId) throw unauthorized();
  throw forbidden('admin_only', 'Only an admin can do that.');
}

/**
 * A real, signed-in admin account. The system actor is NOT enough: ledger entries and
 * claim decisions must record which person made them.
 */
export function requireAdminUser(ctx) {
  if (ctx.actor.role === 'admin' && ctx.actor.userId) return;
  if (ctx.actor.role === 'system') throw forbidden('admin_account_required', 'This needs a signed-in admin account, so the audit trail can say who did it.');
  if (!ctx.actor.userId) throw unauthorized();
  throw forbidden('admin_only', 'Only an admin can do that.');
}

/** Any signed-in user (or the system actor). */
export function requireSignedIn(ctx) {
  if (ctx.actor.role === 'system') return;
  if (!ctx.actor.userId) throw unauthorized();
}

/**
 * The caller must be an admin, or be the member in question.
 * Ownership always comes from the session's user row, never from a request field.
 */
export function requireSelfOrAdmin(ctx, memberId) {
  requireSignedIn(ctx);
  if (ctx.actor.role === 'admin' || ctx.actor.role === 'system') return;
  if (ctx.actor.memberId && ctx.actor.memberId === memberId) return;
  throw forbidden('not_yours', 'You can only do that for your own profile.');
}

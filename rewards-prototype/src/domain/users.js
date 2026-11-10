// Users: who may sign in. Access is by allowlist — an admin adds an e-mail address first.
//
// Identity rules (see docs/PLATFORM_CAPABILITIES.md §3):
//   * After the first sign-in the Google `sub` is the identity. E-mail is never a key again.
//   * The first sign-in may bind an allowlisted e-mail to a `sub` only when Google is
//     authoritative for that address (@gmail.com, or a Workspace `hd` matching the domain)
//     and reports it verified.

import { conflict, forbidden, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import * as v from '../lib/validate.js';
import { isUniqueViolation } from '../db/sqlite.js';
import { nowIso, requireAdmin } from './context.js';
import { recordAudit } from './audit.js';

const view = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  member_id: row.member_id,
  status: row.status,
  signed_in_before: row.google_sub !== null,
  created_at: row.created_at,
  last_login_at: row.last_login_at,
});

function load(ctx, userId) {
  const row = ctx.db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row) throw notFound('user_not_found', 'That account does not exist.');
  return row;
}

// "An admin who can actually sign in": active, and has signed in at least once. An
// allowlisted admin row that has never been used does not count (it may be a typo).
const isWorkingAdmin = (row) => row.role === 'admin' && row.status === 'active' && row.last_login_at !== null;
const otherWorkingAdmins = (ctx, exceptId) =>
  ctx.db.get("SELECT COUNT(*) AS n FROM users WHERE id <> ? AND role = 'admin' AND status = 'active' AND last_login_at IS NOT NULL", [exceptId]).n;
const lastAdmin = () => conflict('last_admin', 'This is the only admin who can sign in. Add another admin and have them sign in first.');

function assertMemberLinkable(ctx, memberId) {
  if (memberId === null) return;
  if (!ctx.db.get('SELECT 1 AS ok FROM members WHERE id = ?', [memberId])) throw notFound('member_not_found', 'That member does not exist.');
}

function translateUnique(error) {
  if (isUniqueViolation(error, 'users.email')) return conflict('email_taken', 'An account with that e-mail address already exists.');
  if (isUniqueViolation(error, 'users.member_id')) return conflict('member_already_linked', 'That member already has a sign-in account.');
  return error;
}

export function listUsers(ctx) {
  requireAdmin(ctx);
  return ctx.db.all('SELECT * FROM users ORDER BY role, email').map(view);
}

/** The session layer's lookup. Returns null for unknown or disabled accounts. */
export function getActiveUser(ctx, userId) {
  const row = ctx.db.get("SELECT * FROM users WHERE id = ? AND status = 'active'", [userId]);
  return row ? view(row) : null;
}

export function createUser(ctx, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['email', 'role', 'member_id']);
  const email = v.email(data.email);
  const role = v.oneOf(data.role, 'role', ['admin', 'member']);
  const memberId = data.member_id === undefined || data.member_id === null ? null : v.string(data.member_id, 'member_id', { max: 64 });
  if (role === 'member' && memberId === null) throw conflict('member_required', 'A member account must be attached to a member.');
  const id = newId('usr');
  return ctx.db.tx(() => {
    assertMemberLinkable(ctx, memberId);
    try {
      ctx.db.run('INSERT INTO users (id, email, role, member_id, created_at) VALUES (?, ?, ?, ?, ?)', [id, email, role, memberId, nowIso(ctx)]);
    } catch (error) {
      throw translateUnique(error);
    }
    recordAudit(ctx, { action: 'user.create', entityType: 'user', entityId: id, subjectMemberId: memberId, detail: { role } });
    return view(load(ctx, id));
  });
}

/**
 * Changes role, status or the attached member. Any change signs the account out
 * everywhere (schema trigger), so a demotion or a disable takes effect immediately.
 * An admin cannot change their OWN role, status or member link: that would let them
 * unlink from a member, approve that member's claim, and link back.
 */
export function updateUser(ctx, userId, input) {
  requireAdmin(ctx);
  if (ctx.actor.userId && ctx.actor.userId === userId) {
    throw forbidden('cannot_edit_self', 'You cannot change your own role, status or member link. Ask another admin.');
  }
  const data = v.only(input, ['role', 'status', 'member_id']);
  const role = v.optional(data.role, (x) => v.oneOf(x, 'role', ['admin', 'member']));
  const status = v.optional(data.status, (x) => v.oneOf(x, 'status', ['active', 'disabled']));
  const memberId = v.nullable(data.member_id, (x) => v.string(x, 'member_id', { max: 64 }));
  return ctx.db.tx(() => {
    const before = load(ctx, userId);
    const after = {
      role: role ?? before.role,
      status: status ?? before.status,
      member_id: memberId === undefined ? before.member_id : memberId,
    };
    if (after.role === 'member' && after.member_id === null) throw conflict('member_required', 'A member account must be attached to a member.');
    const staysActiveAdmin = after.role === 'admin' && after.status === 'active';
    if (isWorkingAdmin(before) && !staysActiveAdmin && otherWorkingAdmins(ctx, userId) === 0) throw lastAdmin();
    const changed = ['role', 'status', 'member_id'].filter((key) => before[key] !== after[key]);
    if (changed.length > 0) {
      if (changed.includes('member_id')) assertMemberLinkable(ctx, after.member_id);
      try {
        ctx.db.run('UPDATE users SET role = ?, status = ?, member_id = ? WHERE id = ?', [after.role, after.status, after.member_id, userId]);
      } catch (error) {
        throw translateUnique(error);
      }
      recordAudit(ctx, {
        action: 'user.update',
        entityType: 'user',
        entityId: userId,
        subjectMemberId: after.member_id,
        detail: { fields: changed, role: after.role, status: after.status },
      });
    }
    return view(load(ctx, userId));
  });
}

/** Removes a sign-in account (not the member's dashboard data — see erasure.js for that). */
export function deleteUser(ctx, userId) {
  requireAdmin(ctx);
  return ctx.db.tx(() => {
    const before = load(ctx, userId);
    if (isWorkingAdmin(before) && otherWorkingAdmins(ctx, userId) === 0) throw lastAdmin();
    ctx.db.run('DELETE FROM users WHERE id = ?', [userId]); // sessions cascade
    recordAudit(ctx, { action: 'user.delete', entityType: 'user', entityId: userId, subjectMemberId: before.member_id, detail: { role: before.role } });
    return { deleted: true };
  });
}

/** Is Google the authority for this e-mail address? Only then may an e-mail match bind an account. */
export function isGoogleAuthoritative({ email, emailVerified, hostedDomain }) {
  if (emailVerified !== true || typeof email !== 'string') return false;
  const domain = email.toLowerCase().split('@')[1] ?? '';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return true;
  return typeof hostedDomain === 'string' && hostedDomain.length > 0 && hostedDomain.toLowerCase() === domain;
}

/**
 * Maps a verified Google identity to an account, or returns null (deny).
 * The caller has ALREADY verified the ID token; `identity` holds its claims.
 * @param {{ sub: string, email?: string, emailVerified?: boolean, hostedDomain?: string }} identity
 * @returns {{ user: object, firstSignIn: boolean } | null}
 */
export function resolveSignIn(ctx, identity) {
  if (typeof identity?.sub !== 'string' || identity.sub.length === 0 || identity.sub.length > 255) return null;
  return ctx.db.tx(() => {
    const at = nowIso(ctx);
    const known = ctx.db.get('SELECT * FROM users WHERE google_sub = ?', [identity.sub]);
    if (known) {
      if (known.status !== 'active') return null;
      ctx.db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [at, known.id]);
      return { user: view({ ...known, last_login_at: at }), firstSignIn: false };
    }
    if (!isGoogleAuthoritative(identity)) return null;
    const email = identity.email.toLowerCase();
    // Only an account that has never been bound can be claimed by e-mail.
    const invited = ctx.db.get("SELECT * FROM users WHERE email = ? AND google_sub IS NULL AND status = 'active'", [email]);
    if (!invited) return null;
    const bound = ctx.db.run('UPDATE users SET google_sub = ?, last_login_at = ? WHERE id = ? AND google_sub IS NULL', [identity.sub, at, invited.id]);
    if (bound.changes !== 1) return null;
    recordAudit(ctx, { action: 'user.first_sign_in', entityType: 'user', entityId: invited.id, subjectMemberId: invited.member_id });
    return { user: view({ ...invited, google_sub: identity.sub, last_login_at: at }), firstSignIn: true };
  });
}

/** An allowlisted, active account by e-mail. A plain lookup: it records nothing. */
export function findActiveUserByEmail(ctx, email) {
  const row = ctx.db.get("SELECT * FROM users WHERE email = ? AND status = 'active'", [String(email).trim().toLowerCase()]);
  return row ? view(row) : null;
}

/**
 * Dev-mode sign-in (never used with AUTH_MODE=google): the allowlisted, active account
 * for this e-mail, with the sign-in time recorded. Recording it matters: the rule that
 * the last admin who can sign in cannot be removed (P9) counts only accounts that HAVE
 * signed in, so without this the rule would never engage in dev mode.
 * The caller has already checked the dev sign-in code.
 * @returns {object|null}
 */
export function resolveDevSignIn(ctx, email) {
  if (typeof email !== 'string') return null;
  return ctx.db.tx(() => {
    const row = ctx.db.get("SELECT * FROM users WHERE email = ? AND status = 'active'", [email.trim().toLowerCase()]);
    if (!row) return null;
    const at = nowIso(ctx);
    ctx.db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [at, row.id]);
    return view({ ...row, last_login_at: at });
  });
}

/**
 * First start only: when the database has NO admin account at all, create one per
 * configured e-mail address. On every later start this does nothing, so the environment
 * can never re-create an erased person or restore a demoted or disabled admin.
 * @returns {number} how many accounts were created
 */
export function bootstrapAdmins(ctx, emails) {
  let created = 0;
  ctx.db.tx(() => {
    if (ctx.db.get("SELECT 1 AS present FROM users WHERE role = 'admin' LIMIT 1")) return;
    for (const raw of emails) {
      const email = v.email(raw);
      if (ctx.db.get('SELECT 1 AS ok FROM users WHERE email = ?', [email])) continue;
      const id = newId('usr');
      ctx.db.run("INSERT INTO users (id, email, role, created_at) VALUES (?, ?, 'admin', ?)", [id, email, nowIso(ctx)]);
      recordAudit(ctx, { action: 'user.bootstrap_admin', entityType: 'user', entityId: id });
      created += 1;
    }
  });
  return created;
}

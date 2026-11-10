// The point ledger. Append-only: balances are always SUM() over ledger_entries, and every
// correction is a new entry. Virtual points only: no currency, no redemption.
//
// Entry kinds
//   task_award  written when a reviewed claim is approved. Writing it IS the approval:
//               a schema trigger flips the claim to "approved". One per claim, ever.
//   bonus       admin-granted, bucket 'bonus'.
//   adjustment  admin correction. May take points away from either bucket; may add them
//               only to 'bonus' ("earned" grows only through a reviewed claim).
//   reversal    exact negative of one earlier entry, counted in that entry's month. An
//               entry can be reversed once. Reversing an award revokes its claim (trigger).
//
// Every positive non-reversal entry counts toward the monthly cap and budget.
// Every entry records the admin account that wrote it; the system actor cannot write here.

import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { isTriggerAbort, isUniqueViolation } from '../db/sqlite.js';
import { nowIso, requireAdminUser, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';
import { assertWithinCaps, currentPeriod } from './caps.js';
import { assertRewardableText } from './policy.js';

const MAX_ABS = 100000;
const BUCKETS = ['earned', 'bonus'];

const ENTRY_COLUMNS = `e.id, e.member_id, e.kind, e.bucket, e.points, e.xp, e.claim_id, e.reverses_entry_id,
  e.competition_id, e.reason, e.actor_user_id, e.period, e.created_at,
  (SELECT r.id FROM ledger_entries r WHERE r.reverses_entry_id = e.id) AS reversed_by_entry_id`;

export function getEntry(ctx, entryId) {
  return ctx.db.get(`SELECT ${ENTRY_COLUMNS} FROM ledger_entries e WHERE e.id = ?`, [Number(entryId)]) ?? null;
}

function getEntryByKey(ctx, idempotencyKey) {
  return ctx.db.get(`SELECT ${ENTRY_COLUMNS} FROM ledger_entries e WHERE e.idempotency_key = ?`, [idempotencyKey]) ?? null;
}

const ZERO = Object.freeze({ earned: 0, bonus: 0, total: 0, xp: 0 });

/**
 * Balances for every member that has at least one entry.
 * @returns {Map<string, { earned: number, bonus: number, total: number, xp: number }>}
 */
export function allBalances(ctx) {
  const rows = ctx.db.all(
    `SELECT member_id,
            COALESCE(SUM(CASE WHEN bucket = 'earned' THEN points END), 0) AS earned,
            COALESCE(SUM(CASE WHEN bucket = 'bonus' THEN points END), 0) AS bonus,
            COALESCE(SUM(points), 0) AS total,
            COALESCE(SUM(xp), 0) AS xp
       FROM ledger_entries GROUP BY member_id`,
  );
  return new Map(rows.map((row) => [row.member_id, { earned: row.earned, bonus: row.bonus, total: row.total, xp: row.xp }]));
}

/** { earned, bonus, total, xp } for one member (zeros when they have no entries). */
export function balanceOf(ctx, memberId) {
  return allBalances(ctx).get(memberId) ?? { ...ZERO };
}

function assertMemberExists(ctx, memberId) {
  const member = ctx.db.get('SELECT id, status FROM members WHERE id = ?', [memberId]);
  if (!member) throw notFound('member_not_found', 'That member does not exist.');
  return member;
}

function cleanReason(reason) {
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
    throw unprocessable('reason_required', 'Give a reason of 3–500 characters. It is kept with the entry.');
  }
  const value = reason.trim();
  assertRewardableText('reason', value);
  return value;
}

function cleanAmount(field, value, { allowNegative }) {
  if (!Number.isInteger(value) || Math.abs(value) > MAX_ABS || (!allowNegative && value < 0)) {
    throw unprocessable('invalid_amount', `"${field}" must be a whole number${allowNegative ? '' : ' of zero or more'} within ±${MAX_ABS}.`, { field });
  }
  return value;
}

/** P8, checked here for a clear message; the schema enforces it regardless. */
function assertNotSelfCredit(ctx, memberId, { points, xp }) {
  if ((points > 0 || xp > 0) && ctx.actor.memberId && ctx.actor.memberId === memberId) {
    throw forbidden('self_credit_forbidden', 'You cannot add points or XP to your own profile. Another admin has to.');
  }
}

/** P11, checked here for a helpful message; the schema enforces it regardless. */
function assertStaysNonNegative(ctx, memberId, { bucket, points, xp }) {
  const balance = balanceOf(ctx, memberId);
  if (balance[bucket] + points < 0 || balance.xp + xp < 0) {
    const blockers = ctx.db
      .all(
        `SELECT e.id FROM ledger_entries e
          WHERE e.member_id = ? AND e.kind = 'adjustment' AND (e.points < 0 OR e.xp < 0)
            AND NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.reverses_entry_id = e.id)
          ORDER BY e.id DESC LIMIT 20`,
        [memberId],
      )
      .map((row) => row.id);
    throw conflict('would_go_negative', 'This would take a balance below zero. Nothing was changed. Undo the earlier deductions listed first, if that is what you intend.', {
      bucket,
      bucket_balance: balance[bucket],
      xp_balance: balance.xp,
      points,
      xp,
      unreversed_deduction_entry_ids: blockers,
    });
  }
}

/** Turns the schema's guard-trigger messages into API errors. */
function translate(error) {
  if (isTriggerAbort(error, 'would_go_negative')) return conflict('would_go_negative', 'This would take a balance below zero. Nothing was changed.');
  if (isTriggerAbort(error, 'cannot credit the member it is linked to')) {
    return forbidden('self_credit_forbidden', 'You cannot add points or XP to your own profile. Another admin has to.');
  }
  if (isTriggerAbort(error, 'an erasure is in progress')) return conflict('erasure_in_progress', 'An erasure is in progress. Try again in a moment.');
  return error;
}

function insertEntry(ctx, entry) {
  try {
    const result = ctx.db.run(
      `INSERT INTO ledger_entries
         (member_id, kind, bucket, points, xp, claim_id, reverses_entry_id, competition_id, idempotency_key, reason, actor_user_id, period, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.memberId,
        entry.kind,
        entry.bucket,
        entry.points,
        entry.xp,
        entry.claimId ?? null,
        entry.reversesEntryId ?? null,
        entry.competitionId ?? null,
        entry.idempotencyKey,
        entry.reason,
        ctx.actor.userId,
        entry.period ?? currentPeriod(ctx),
        nowIso(ctx),
      ],
    );
    return getEntry(ctx, result.lastInsertRowid);
  } catch (error) {
    throw translate(error);
  }
}

/**
 * Writes the single award for a PENDING, reviewed claim — which approves it (schema
 * trigger). MUST be called by claims.js inside its transaction.
 * Throws 409 cap_exceeded if a monthly limit would be passed.
 * @param {{ id: string, member_id: string, points_snapshot: number, xp_snapshot: number }} claim
 * @param {string} reason
 */
export function awardForClaim(ctx, claim, reason) {
  requireAdminUser(ctx);
  if (!ctx.db.inTransaction) throw new Error('awardForClaim must run inside the approval transaction');
  if (ctx.db.get("SELECT 1 AS present FROM ledger_entries WHERE claim_id = ? AND kind = 'task_award'", [claim.id])) {
    throw conflict('already_awarded', 'This submission has already been credited.');
  }
  assertNotSelfCredit(ctx, claim.member_id, { points: claim.points_snapshot, xp: claim.xp_snapshot });
  const period = currentPeriod(ctx);
  assertWithinCaps(ctx, { memberId: claim.member_id, points: claim.points_snapshot, period });
  let entry;
  try {
    entry = insertEntry(ctx, {
      memberId: claim.member_id,
      kind: 'task_award',
      bucket: 'earned',
      points: claim.points_snapshot,
      xp: claim.xp_snapshot,
      claimId: claim.id,
      idempotencyKey: `award:${claim.id}`,
      reason,
      period,
    });
  } catch (error) {
    if (isUniqueViolation(error) || isTriggerAbort(error, 'append-only')) throw conflict('already_awarded', 'This submission has already been credited.');
    throw error;
  }
  // Every ledger entry has its own audit row (integrity.js checks this).
  recordAudit(ctx, {
    action: 'ledger.award',
    entityType: 'ledger_entry',
    entityId: entry.id,
    subjectMemberId: claim.member_id,
    detail: { claim_id: claim.id, points: entry.points, xp: entry.xp, period },
  });
  return entry;
}

/** Client keys live in their own namespace, per admin: 'req:<admin user id>:<client key>'. */
function requestKey(ctx, key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{8,100}$/.test(key)) {
    throw badRequest('idempotency_key_required', 'Send an Idempotency-Key header (8–100 letters, digits, dots, dashes, underscores or colons).');
  }
  return `req:${ctx.actor.userId}:${key}`;
}

/** Returns the earlier entry when the key was already used with the same payload; 409 if the payload differs. */
function replayOrNull(ctx, key, expected) {
  const existing = getEntryByKey(ctx, key);
  if (!existing) return null;
  const same =
    existing.member_id === expected.memberId &&
    existing.kind === expected.kind &&
    existing.bucket === expected.bucket &&
    existing.points === expected.points &&
    existing.xp === expected.xp &&
    existing.reason === expected.reason &&
    (existing.competition_id ?? null) === (expected.competitionId ?? null);
  if (!same) throw conflict('idempotency_conflict', 'That Idempotency-Key was already used for a different request.');
  return existing;
}

/**
 * Admin-granted bonus points/XP (competition result, streak, surprise). Counts toward the caps.
 * For a competition result use the client key `competition:<competition id>:<member id>`, so a
 * second grant for the same competition and member is a replay, not a new entry.
 * @returns {{ entry: object, replayed: boolean }}
 */
export function grantBonus(ctx, { memberId, points = 0, xp = 0, reason, competitionId = null, idempotencyKey }) {
  requireAdminUser(ctx);
  const key = requestKey(ctx, idempotencyKey);
  const cleanPoints = cleanAmount('points', points, { allowNegative: false });
  const cleanXp = cleanAmount('xp', xp, { allowNegative: false });
  if (cleanPoints === 0 && cleanXp === 0) throw unprocessable('invalid_amount', 'A bonus needs points or XP.');
  const cleanedReason = cleanReason(reason);
  return ctx.db.tx(() => {
    const expected = { memberId, kind: 'bonus', bucket: 'bonus', points: cleanPoints, xp: cleanXp, reason: cleanedReason, competitionId };
    const replay = replayOrNull(ctx, key, expected);
    if (replay) return { entry: replay, replayed: true };
    const member = assertMemberExists(ctx, memberId);
    if (member.status !== 'active') throw conflict('member_not_active', 'That member is archived.');
    if (competitionId && !ctx.db.get('SELECT 1 AS ok FROM competitions WHERE id = ?', [competitionId])) {
      throw notFound('competition_not_found', 'That competition does not exist.');
    }
    assertNotSelfCredit(ctx, memberId, expected);
    const period = currentPeriod(ctx);
    assertWithinCaps(ctx, { memberId, points: cleanPoints, period });
    const entry = insertEntry(ctx, { ...expected, idempotencyKey: key, period });
    recordAudit(ctx, {
      action: 'ledger.bonus',
      entityType: 'ledger_entry',
      entityId: entry.id,
      subjectMemberId: memberId,
      detail: { points: cleanPoints, xp: cleanXp, competition_id: competitionId, period },
    });
    return { entry, replayed: false };
  });
}

/**
 * Manual correction. Taking away: either bucket. Adding: the bonus bucket only, and it
 * counts toward the caps like any other credit. Reversible.
 * @returns {{ entry: object, replayed: boolean }}
 */
export function adjust(ctx, { memberId, points = 0, xp = 0, bucket = 'earned', reason, idempotencyKey }) {
  requireAdminUser(ctx);
  const key = requestKey(ctx, idempotencyKey);
  if (!BUCKETS.includes(bucket)) throw unprocessable('invalid_bucket', 'Bucket must be "earned" or "bonus".');
  const cleanPoints = cleanAmount('points', points, { allowNegative: true });
  const cleanXp = cleanAmount('xp', xp, { allowNegative: true });
  if (cleanPoints === 0 && cleanXp === 0) throw unprocessable('invalid_amount', 'An adjustment needs points or XP.');
  if ((cleanPoints > 0 && cleanXp < 0) || (cleanPoints < 0 && cleanXp > 0)) {
    throw unprocessable('invalid_amount', 'Points and XP in one adjustment must move in the same direction. Make two adjustments.');
  }
  const adding = cleanPoints > 0 || cleanXp > 0;
  if (adding && bucket === 'earned') {
    throw unprocessable('earned_only_by_review', '"Earned" grows only through an approved submission. Put a positive correction in the bonus bucket.', { field: 'bucket' });
  }
  const cleanedReason = cleanReason(reason);
  return ctx.db.tx(() => {
    const expected = { memberId, kind: 'adjustment', bucket, points: cleanPoints, xp: cleanXp, reason: cleanedReason, competitionId: null };
    const replay = replayOrNull(ctx, key, expected);
    if (replay) return { entry: replay, replayed: true };
    assertMemberExists(ctx, memberId);
    assertNotSelfCredit(ctx, memberId, expected);
    const period = currentPeriod(ctx);
    if (adding) assertWithinCaps(ctx, { memberId, points: cleanPoints, period });
    else assertStaysNonNegative(ctx, memberId, expected);
    const entry = insertEntry(ctx, { ...expected, idempotencyKey: key, period });
    recordAudit(ctx, {
      action: 'ledger.adjust',
      entityType: 'ledger_entry',
      entityId: entry.id,
      subjectMemberId: memberId,
      detail: { bucket, points: cleanPoints, xp: cleanXp, period },
    });
    return { entry, replayed: false };
  });
}

/**
 * Undoes one entry by writing its exact negative, counted in the original entry's month.
 * An entry can be reversed once; a reversal cannot be reversed (write a new adjustment
 * instead). Reversing a task award revokes its claim in the same transaction (schema
 * trigger). Calling it again for an already-reversed entry returns the existing reversal.
 * @returns {{ entry: object, replayed: boolean }}
 */
export function reverseEntry(ctx, { entryId, reason }) {
  requireAdminUser(ctx);
  const cleanedReason = cleanReason(reason);
  return ctx.db.tx(() => {
    const target = getEntry(ctx, entryId);
    if (!target) throw notFound('entry_not_found', 'That ledger entry does not exist.');
    if (target.kind === 'reversal') {
      throw conflict('cannot_reverse_reversal', 'A reversal cannot be reversed. Make a new adjustment instead.');
    }
    if (target.reversed_by_entry_id) {
      return { entry: getEntry(ctx, target.reversed_by_entry_id), replayed: true };
    }
    const mirror = { bucket: target.bucket, points: -target.points, xp: -target.xp };
    assertNotSelfCredit(ctx, target.member_id, mirror);
    assertStaysNonNegative(ctx, target.member_id, mirror);
    const entry = insertEntry(ctx, {
      memberId: target.member_id,
      kind: 'reversal',
      ...mirror,
      reversesEntryId: target.id,
      competitionId: target.competition_id,
      idempotencyKey: `reversal:${target.id}`,
      reason: cleanedReason,
      period: target.period,
    });
    if (target.kind === 'task_award') {
      const claim = ctx.db.get('SELECT decision FROM claims WHERE id = ?', [target.claim_id]);
      if (claim?.decision !== 'revoked') throw new Error(`ledger/claim mismatch: reversing award ${target.id} did not revoke its claim`);
      recordAudit(ctx, {
        action: 'claim.revoke',
        entityType: 'claim',
        entityId: target.claim_id,
        subjectMemberId: target.member_id,
        detail: { ledger_entry_id: target.id, reversal_entry_id: entry.id },
      });
    }
    recordAudit(ctx, {
      action: 'ledger.reverse',
      entityType: 'ledger_entry',
      entityId: entry.id,
      subjectMemberId: target.member_id,
      detail: { reverses_entry_id: target.id, reversed_kind: target.kind, points: entry.points, xp: entry.xp, period: entry.period },
    });
    return { entry, replayed: false };
  });
}

/**
 * Entries newest first, keyset-paginated. An admin may list anyone (or everyone). A
 * member may list only their own entries: reasons can be personal ("deducted for a
 * copied submission"), so they are nobody else's business. What other members may see
 * of someone's activity comes from leaderboard.js.
 * @param {{ memberId?: string, limit?: number, beforeId?: number }} [filter]
 */
export function listEntries(ctx, { memberId, limit = 50, beforeId } = {}) {
  requireSignedIn(ctx);
  const staff = ctx.actor.role === 'admin' || ctx.actor.role === 'system';
  if (!staff) {
    if (!ctx.actor.memberId) throw forbidden('not_yours', 'There is no ledger to show for this account.');
    if (memberId && memberId !== ctx.actor.memberId) throw forbidden('not_yours', 'You can only see your own ledger.');
    memberId = ctx.actor.memberId;
  }
  const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const where = [];
  const params = [];
  if (memberId) {
    where.push('e.member_id = ?');
    params.push(memberId);
  }
  if (beforeId !== undefined && beforeId !== null) {
    where.push('e.id < ?');
    params.push(Number(beforeId));
  }
  const rows = ctx.db.all(
    `SELECT ${ENTRY_COLUMNS} FROM ledger_entries e ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.id DESC LIMIT ?`,
    [...params, size + 1],
  );
  const items = rows.slice(0, size).map((row) => (staff ? { ...row } : { ...row, actor_user_id: undefined }));
  return { items, nextBeforeId: rows.length > size ? items[items.length - 1].id : null };
}

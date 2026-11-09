import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, insertMember, insertTaskType, insertClaim, count, expectAppError } from '../helpers.js';
import { adjust, allBalances, awardForClaim, balanceOf, grantBonus, listEntries, reverseEntry } from '../../src/domain/ledger.js';
import { capStatus, currentPeriod } from '../../src/domain/caps.js';
import { updateSettings } from '../../src/domain/settings.js';
import { listAudit } from '../../src/domain/audit.js';

const key = (n) => `test-key-${String(n).padStart(4, '0')}`;

function approveAndAward(world, memberId, taskTypeId, opts = {}) {
  const claim = insertClaim(world.db, { memberId, taskTypeId, state: 'approved', ...opts });
  const entry = world.db.tx(() => awardForClaim(world.admin, claim, 'Approved: Constructive feedback'));
  return { claim, entry };
}

test('an award credits points and XP exactly once', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db, { name: 'Ada' });
  const taskTypeId = insertTaskType(world.db);
  const { claim, entry } = approveAndAward(world, memberId, taskTypeId);

  assert.equal(entry.kind, 'task_award');
  assert.equal(entry.bucket, 'earned');
  assert.equal(entry.period, '2026-11');
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });

  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.admin, claim, 'again')), 'already_awarded', 409);
  assert.equal(count(world.db, 'ledger_entries'), 1);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });
});

test('awardForClaim refuses to run outside a transaction and for unapproved claims', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  const approved = insertClaim(world.db, { memberId, taskTypeId, state: 'approved' });
  assert.throws(() => awardForClaim(world.admin, approved, 'x'), /inside the approval transaction/);

  const pending = insertClaim(world.db, { memberId, taskTypeId, state: 'pending' });
  assert.throws(() => world.db.tx(() => awardForClaim(world.admin, pending, 'x')), /requires an approved and reviewed claim/);
  assert.equal(count(world.db, 'ledger_entries'), 0);
});

test('adjustments are idempotent, audited, and refuse a different payload under the same key', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);

  const first = adjust(world.admin, { memberId, points: 40, xp: 10, reason: 'Correcting a missed entry', idempotencyKey: key(1) });
  assert.equal(first.replayed, false);
  const replay = adjust(world.admin, { memberId, points: 40, xp: 10, reason: 'Correcting a missed entry', idempotencyKey: key(1) });
  assert.equal(replay.replayed, true);
  assert.equal(replay.entry.id, first.entry.id);
  assert.equal(count(world.db, 'ledger_entries'), 1);

  expectAppError(assert, () => adjust(world.admin, { memberId, points: 41, xp: 10, reason: 'Correcting a missed entry', idempotencyKey: key(1) }), 'idempotency_conflict', 409);
  expectAppError(assert, () => adjust(world.admin, { memberId, points: 5, reason: 'No key supplied' }), 'idempotency_key_required', 400);

  const audit = listAudit(world.admin, { action: 'ledger.adjust' }).items;
  assert.equal(audit.length, 1, 'a replay must not write a second audit row');
  assert.equal(audit[0].subject_member_id, memberId);
  assert.equal(audit[0].detail.points, 40);
});

test('adjustments validate amounts, buckets, reasons and wording', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const base = { memberId, idempotencyKey: key(2), reason: 'A valid reason' };
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 0, xp: 0 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 1.5 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 1000001 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, bucket: 'cash' }), 'invalid_bucket', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, reason: 'x' }), 'reason_required', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, reason: '25 points per like' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, reason: 'Payout for November' }), 'money_wording_not_allowed', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, memberId: 'mbr_missing', points: 5 }), 'member_not_found', 404);
  assert.equal(count(world.db, 'ledger_entries'), 0);
});

test('only admins can adjust, grant bonuses or reverse', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const member = world.as({ userId: 'usr_member', role: 'member', memberId });
  const anonymous = world.as({ userId: null, role: 'member', memberId: null });
  expectAppError(assert, () => adjust(member, { memberId, points: 5, reason: 'Self-serve points', idempotencyKey: key(3) }), 'admin_only', 403);
  expectAppError(assert, () => grantBonus(member, { memberId, points: 5, reason: 'Self-serve bonus', idempotencyKey: key(4) }), 'admin_only', 403);
  expectAppError(assert, () => reverseEntry(member, { entryId: 1, reason: 'Undo something' }), 'admin_only', 403);
  expectAppError(assert, () => adjust(anonymous, { memberId, points: 5, reason: 'Anonymous points', idempotencyKey: key(5) }), 'not_signed_in', 401);
  assert.equal(count(world.db, 'ledger_entries'), 0);
});

test('a reversal mirrors its target, happens at most once, and cannot itself be reversed', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const { entry } = adjust(world.admin, { memberId, points: 30, xp: 12, bucket: 'bonus', reason: 'Manual bonus correction', idempotencyKey: key(6) });

  const reversal = reverseEntry(world.admin, { entryId: entry.id, reason: 'Entered by mistake' });
  assert.equal(reversal.replayed, false);
  assert.equal(reversal.entry.kind, 'reversal');
  assert.equal(reversal.entry.points, -30);
  assert.equal(reversal.entry.xp, -12);
  assert.equal(reversal.entry.bucket, 'bonus');
  assert.equal(reversal.entry.reverses_entry_id, entry.id);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 0, total: 0, xp: 0 });

  const again = reverseEntry(world.admin, { entryId: entry.id, reason: 'Entered by mistake' });
  assert.equal(again.replayed, true);
  assert.equal(again.entry.id, reversal.entry.id);
  assert.equal(count(world.db, 'ledger_entries'), 2);

  expectAppError(assert, () => reverseEntry(world.admin, { entryId: reversal.entry.id, reason: 'Undo the undo' }), 'cannot_reverse_reversal', 409);
  expectAppError(assert, () => reverseEntry(world.admin, { entryId: 9999, reason: 'No such entry' }), 'entry_not_found', 404);

  const listed = listEntries(world.admin, { memberId }).items;
  assert.equal(listed.find((item) => item.id === entry.id).reversed_by_entry_id, reversal.entry.id);
});

test('reversing a task award revokes its claim in the same transaction', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  const { claim, entry } = approveAndAward(world, memberId, taskTypeId);

  reverseEntry(world.admin, { entryId: entry.id, reason: 'Submission turned out to be copied' });
  const after = world.db.get('SELECT decision, decided_by, decision_note FROM claims WHERE id = ?', [claim.id]);
  assert.equal(after.decision, 'revoked');
  assert.equal(after.decided_by, world.adminUserId);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 0, total: 0, xp: 0 });
  assert.equal(listAudit(world.admin, { action: 'claim.revoke' }).items.length, 1);
  assert.equal(listAudit(world.admin, { action: 'ledger.reverse' }).items.length, 1);

  // A revoked claim can never be credited again.
  assert.throws(() => world.db.tx(() => awardForClaim(world.admin, claim, 'again')));
  assert.equal(count(world.db, 'ledger_entries'), 2);
});

test('no bucket and no XP total can go below zero', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  const { entry: award } = approveAndAward(world, memberId, taskTypeId);

  expectAppError(assert, () => adjust(world.admin, { memberId, points: -26, reason: 'Too large a correction', idempotencyKey: key(7) }), 'would_go_negative', 409);
  expectAppError(assert, () => adjust(world.admin, { memberId, points: -1, bucket: 'bonus', reason: 'Wrong bucket correction', idempotencyKey: key(8) }), 'would_go_negative', 409);
  expectAppError(assert, () => adjust(world.admin, { memberId, xp: -26, reason: 'Too large an XP correction', idempotencyKey: key(9) }), 'would_go_negative', 409);

  adjust(world.admin, { memberId, points: -25, reason: 'Correction to zero', idempotencyKey: key(10) });
  // The award can no longer be reversed until the correction is undone: the admin has to be explicit.
  expectAppError(assert, () => reverseEntry(world.admin, { entryId: award.id, reason: 'Revoke the award' }), 'would_go_negative', 409);
  assert.equal(world.db.get('SELECT decision FROM claims WHERE id = ?', [award.claim_id]).decision, 'approved');
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 0, total: 0, xp: 25 });
});

test('bonuses land in the bonus bucket, are idempotent and count toward caps', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const first = grantBonus(world.admin, { memberId, points: 50, xp: 5, reason: 'Monthly challenge winner', idempotencyKey: key(11) });
  const replay = grantBonus(world.admin, { memberId, points: 50, xp: 5, reason: 'Monthly challenge winner', idempotencyKey: key(11) });
  assert.equal(first.entry.bucket, 'bonus');
  assert.equal(replay.replayed, true);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 50, total: 50, xp: 5 });
  assert.equal(capStatus(world.admin, memberId).member.used, 50);
  expectAppError(assert, () => grantBonus(world.admin, { memberId, points: -5, reason: 'Negative bonus attempt', idempotencyKey: key(12) }), 'invalid_amount', 422);
  expectAppError(assert, () => grantBonus(world.admin, { memberId, points: 5, competitionId: 'cmp_missing', reason: 'Unknown competition', idempotencyKey: key(13) }), 'competition_not_found', 404);
});

test('the per-member monthly cap blocks an award without changing anything', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  updateSettings(world.admin, { monthly_cap_per_member: 40, monthly_budget_total: 1000 });
  approveAndAward(world, memberId, taskTypeId); // 25 of 40 used

  const second = insertClaim(world.db, { memberId, taskTypeId, state: 'pending' });
  assert.throws(
    () =>
      world.db.tx(() => {
        world.db.run(
          `UPDATE claims SET decision = 'approved', decided_at = ?, verification_status = 'manually_reviewed',
                  verification_source = 'admin_review', verified_at = ? WHERE id = ?`,
          [second.created_at, second.created_at, second.id],
        );
        awardForClaim(world.admin, { ...second, decision: 'approved' }, 'Approved');
      }),
    (error) => {
      assert.equal(error.code, 'cap_exceeded');
      assert.equal(error.status, 409);
      assert.deepEqual(error.details, { scope: 'member', period: '2026-11', limit: 40, used: 25, remaining: 15, requested: 25 });
      return true;
    },
  );
  // The approval was rolled back together with the refused award.
  assert.equal(world.db.get('SELECT decision FROM claims WHERE id = ?', [second.id]).decision, 'pending');
  assert.equal(count(world.db, 'ledger_entries'), 1);
});

test('the monthly budget is shared across members, and reversed awards free their room', () => {
  const world = makeWorld();
  const taskTypeId = insertTaskType(world.db);
  const a = insertMember(world.db, { name: 'Ada' });
  const b = insertMember(world.db, { name: 'Bo' });
  updateSettings(world.admin, { monthly_cap_per_member: 100, monthly_budget_total: 40 });

  const { entry: first } = approveAndAward(world, a, taskTypeId);
  const blocked = insertClaim(world.db, { memberId: b, taskTypeId, state: 'approved' });
  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.admin, blocked, 'Approved')), 'cap_exceeded', 409);

  reverseEntry(world.admin, { entryId: first.id, reason: 'Revoked for the test' });
  assert.equal(capStatus(world.admin, a).budget.used, 0);
  world.db.tx(() => awardForClaim(world.admin, blocked, 'Approved'));
  assert.deepEqual(balanceOf(world.admin, b), { earned: 25, bonus: 0, total: 25, xp: 25 });
});

test('caps follow the calendar month in the configured time zone, and adjustments do not count', () => {
  // 2026-12-01T07:30Z is still 30 November in Los Angeles.
  const world = makeWorld({ at: '2026-12-01T07:30:00.000Z' });
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  updateSettings(world.admin, { monthly_cap_per_member: 25, monthly_budget_total: 1000 });
  assert.equal(currentPeriod(world.admin), '2026-11');

  const { entry } = approveAndAward(world, memberId, taskTypeId);
  assert.equal(entry.period, '2026-11');
  adjust(world.admin, { memberId, points: 500, reason: 'Manual correction outside caps', idempotencyKey: key(14) });
  assert.equal(capStatus(world.admin, memberId).member.used, 25);

  const next = insertClaim(world.db, { memberId, taskTypeId, state: 'approved' });
  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.admin, next, 'Approved')), 'cap_exceeded', 409);

  world.clock.set('2026-12-01T08:00:00.000Z'); // midnight in Los Angeles: a new month
  assert.equal(currentPeriod(world.admin), '2026-12');
  const december = world.db.tx(() => awardForClaim(world.admin, next, 'Approved'));
  assert.equal(december.period, '2026-12');

  // Changing the zone later does not move old entries between months.
  updateSettings(world.admin, { time_zone: 'UTC' });
  assert.equal(world.db.get('SELECT period FROM ledger_entries WHERE id = ?', [entry.id]).period, '2026-11');
});

test('balances are grouped per member and members only see non-sensitive entry fields', () => {
  const world = makeWorld();
  const a = insertMember(world.db, { name: 'Ada' });
  const b = insertMember(world.db, { name: 'Bo' });
  adjust(world.admin, { memberId: a, points: 10, reason: 'Seed correction for Ada', idempotencyKey: key(15) });
  adjust(world.admin, { memberId: b, points: 7, xp: 3, bucket: 'bonus', reason: 'Seed correction for Bo', idempotencyKey: key(16) });
  const balances = allBalances(world.admin);
  assert.deepEqual(balances.get(a), { earned: 10, bonus: 0, total: 10, xp: 0 });
  assert.deepEqual(balances.get(b), { earned: 0, bonus: 7, total: 7, xp: 3 });

  const asMember = world.as({ userId: 'usr_member', role: 'member', memberId: a });
  const seen = listEntries(asMember, { memberId: b }).items;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].actor_user_id, undefined);
  assert.equal(listEntries(world.admin, { memberId: b }).items[0].actor_user_id, world.adminUserId);

  const page1 = listEntries(world.admin, { limit: 1 });
  assert.equal(page1.items.length, 1);
  assert.ok(page1.nextBeforeId);
  const page2 = listEntries(world.admin, { limit: 1, beforeId: page1.nextBeforeId });
  assert.equal(page2.items.length, 1);
  assert.equal(page2.nextBeforeId, null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, insertMember, insertMemberWithUser, insertTaskType, insertClaim, markReviewed, count, expectAppError } from '../helpers.js';
import { adjust, allBalances, awardForClaim, balanceOf, grantBonus, listEntries, reverseEntry } from '../../src/domain/ledger.js';
import { capStatus, currentPeriod } from '../../src/domain/caps.js';
import { updateSettings } from '../../src/domain/settings.js';
import { listAudit } from '../../src/domain/audit.js';

const key = (n) => `test-key-${String(n).padStart(4, '0')}`;
const decisionOf = (world, claimId) => world.db.get('SELECT decision FROM claims WHERE id = ?', [claimId]).decision;

/** A reviewed claim plus its award (which approves it). */
function awardNew(world, memberId, taskTypeId) {
  const claim = insertClaim(world.db, { memberId, taskTypeId, state: 'reviewed' });
  const entry = world.db.tx(() => awardForClaim(world.admin, claim, 'Approved: Constructive feedback'));
  return { claim, entry };
}

test('writing the award credits points and XP exactly once, and is what approves the claim', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db, { name: 'Ada' });
  const taskTypeId = insertTaskType(world.db);
  const claim = insertClaim(world.db, { memberId, taskTypeId, state: 'reviewed' });
  assert.equal(decisionOf(world, claim.id), 'pending');

  const entry = world.db.tx(() => awardForClaim(world.admin, claim, 'Approved: Constructive feedback'));
  assert.equal(entry.kind, 'task_award');
  assert.equal(entry.bucket, 'earned');
  assert.equal(entry.period, '2026-11');
  assert.equal(entry.actor_user_id, world.adminUserId);
  assert.equal(decisionOf(world, claim.id), 'approved');
  assert.equal(world.db.get('SELECT decided_by FROM claims WHERE id = ?', [claim.id]).decided_by, world.adminUserId);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });

  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.admin, claim, 'again')), 'already_awarded', 409);
  assert.equal(count(world.db, 'ledger_entries'), 1);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });
});

test('an award needs a transaction, a reviewed claim and a real admin account', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  const reviewed = insertClaim(world.db, { memberId, taskTypeId, state: 'reviewed' });
  assert.throws(() => awardForClaim(world.admin, reviewed, 'x'), /inside the approval transaction/);
  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.system, reviewed, 'x')), 'admin_account_required', 403);

  const unreviewed = insertClaim(world.db, { memberId, taskTypeId, state: 'pending' });
  assert.throws(() => world.db.tx(() => awardForClaim(world.admin, unreviewed, 'x')), /requires a pending, reviewed claim/);
  assert.equal(count(world.db, 'ledger_entries'), 0);
  assert.equal(decisionOf(world, unreviewed.id), 'pending');
});

test('adjustments are idempotent per admin, audited, and refuse a different payload under the same key', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const payload = { memberId, points: 40, xp: 10, bucket: 'bonus', reason: 'Correcting a missed entry', idempotencyKey: key(1) };

  const first = adjust(world.admin, payload);
  assert.equal(first.replayed, false);
  const replay = adjust(world.admin, payload);
  assert.equal(replay.replayed, true);
  assert.equal(replay.entry.id, first.entry.id);
  assert.equal(count(world.db, 'ledger_entries'), 1);

  expectAppError(assert, () => adjust(world.admin, { ...payload, points: 41 }), 'idempotency_conflict', 409);
  expectAppError(assert, () => adjust(world.admin, { ...payload, idempotencyKey: undefined }), 'idempotency_key_required', 400);
  expectAppError(assert, () => adjust(world.admin, { ...payload, idempotencyKey: 'short' }), 'idempotency_key_required', 400);

  // The stored key is namespaced, so it can never collide with a server-owned key.
  assert.equal(world.db.get('SELECT idempotency_key FROM ledger_entries').idempotency_key, `req:${world.adminUserId}:${key(1)}`);
  adjust(world.admin, { ...payload, idempotencyKey: 'award:clm_someclaim' }); // a client key that looks like a server key is harmless

  const audit = listAudit(world.admin, { action: 'ledger.adjust' }).items;
  assert.equal(audit.length, 2, 'one row per real entry; a replay writes none');
  assert.ok(audit.every((row) => row.subject_member_id === memberId));
  assert.ok(!JSON.stringify(audit).includes('Correcting'), 'reasons are not copied into the audit trail');
});

test('adjustments validate amounts, buckets, reasons and wording', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const base = { memberId, bucket: 'bonus', idempotencyKey: key(2), reason: 'A valid reason' };
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 0, xp: 0 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 1.5 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 1000001 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, xp: -5 }), 'invalid_amount', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, bucket: 'cash' }), 'invalid_bucket', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, reason: 'x' }), 'reason_required', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, reason: '25 points per like' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, points: 5, reason: 'Payout for November' }), 'money_wording_not_allowed', 422);
  expectAppError(assert, () => adjust(world.admin, { ...base, memberId: 'mbr_missing', points: 5 }), 'member_not_found', 404);
  assert.equal(count(world.db, 'ledger_entries'), 0);
});

test('"earned" grows only through a reviewed claim: a positive adjustment there is refused', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  expectAppError(assert, () => adjust(world.admin, { memberId, points: 5, bucket: 'earned', reason: 'Unreviewed credit', idempotencyKey: key(3) }), 'earned_only_by_review', 422);
  expectAppError(assert, () => adjust(world.admin, { memberId, xp: 5, reason: 'Unreviewed XP, default bucket', idempotencyKey: key(4) }), 'earned_only_by_review', 422);
  // The schema refuses too.
  assert.throws(
    () =>
      world.db.run(
        `INSERT INTO ledger_entries (member_id, kind, bucket, points, xp, idempotency_key, reason, actor_user_id, period, created_at)
         VALUES (?, 'adjustment', 'earned', 5, 0, 'req:raw:12345678', 'raw', ?, '2026-11', '2026-11-09T20:00:00.000Z')`,
        [memberId, world.adminUserId],
      ),
    /CHECK constraint failed/,
  );
  assert.equal(count(world.db, 'ledger_entries'), 0);
});

test('only a signed-in admin account can adjust, grant bonuses or reverse', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const member = world.as({ userId: 'usr_member', role: 'member', memberId });
  const anonymous = world.as({ userId: null, role: 'member', memberId: null });
  const args = { memberId, points: 5, bucket: 'bonus', reason: 'Self-serve points' };
  expectAppError(assert, () => adjust(member, { ...args, idempotencyKey: key(5) }), 'admin_only', 403);
  expectAppError(assert, () => grantBonus(member, { ...args, idempotencyKey: key(6) }), 'admin_only', 403);
  expectAppError(assert, () => reverseEntry(member, { entryId: 1, reason: 'Undo something' }), 'admin_only', 403);
  expectAppError(assert, () => adjust(anonymous, { ...args, idempotencyKey: key(7) }), 'not_signed_in', 401);
  expectAppError(assert, () => adjust(world.system, { ...args, idempotencyKey: key(8) }), 'admin_account_required', 403);
  assert.equal(count(world.db, 'ledger_entries'), 0);
});

test('a reversal mirrors its target, happens at most once, and cannot itself be reversed', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const { entry } = adjust(world.admin, { memberId, points: 30, xp: 12, bucket: 'bonus', reason: 'Manual bonus correction', idempotencyKey: key(9) });

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

test('reversing a task award revokes its claim in the same transaction, for good', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  const { claim, entry } = awardNew(world, memberId, taskTypeId);

  reverseEntry(world.admin, { entryId: entry.id, reason: 'Submission turned out to be copied' });
  const after = world.db.get('SELECT decision, decided_by, decision_note FROM claims WHERE id = ?', [claim.id]);
  assert.equal(after.decision, 'revoked');
  assert.equal(after.decided_by, world.adminUserId);
  assert.equal(after.decision_note, 'Submission turned out to be copied');
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 0, total: 0, xp: 0 });
  assert.equal(listAudit(world.admin, { action: 'claim.revoke' }).items.length, 1);
  assert.equal(listAudit(world.admin, { action: 'ledger.reverse' }).items.length, 1);

  // A revoked claim can never be credited again, by any route.
  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.admin, claim, 'again')), 'already_awarded', 409);
  assert.throws(() => world.db.run("UPDATE claims SET decision = 'approved' WHERE id = ?", [claim.id]), /illegal claim transition/);
  assert.throws(() => world.db.run("UPDATE claims SET decision = 'pending' WHERE id = ?", [claim.id]), /illegal claim transition|CHECK constraint failed/);
  assert.equal(count(world.db, 'ledger_entries'), 2);
});

test('no bucket and no XP total can go below zero; the refusal says what is in the way', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  const { entry: award } = awardNew(world, memberId, taskTypeId);

  expectAppError(assert, () => adjust(world.admin, { memberId, points: -26, reason: 'Too large a correction', idempotencyKey: key(10) }), 'would_go_negative', 409);
  expectAppError(assert, () => adjust(world.admin, { memberId, points: -1, bucket: 'bonus', reason: 'Wrong bucket correction', idempotencyKey: key(11) }), 'would_go_negative', 409);
  expectAppError(assert, () => adjust(world.admin, { memberId, xp: -26, reason: 'Too large an XP correction', idempotencyKey: key(12) }), 'would_go_negative', 409);

  const deduction = adjust(world.admin, { memberId, points: -25, reason: 'Correction to zero', idempotencyKey: key(13) });
  // The award can no longer be reversed until the deduction is undone: the admin has to be explicit.
  assert.throws(
    () => reverseEntry(world.admin, { entryId: award.id, reason: 'Revoke the award' }),
    (error) => {
      assert.equal(error.code, 'would_go_negative');
      assert.deepEqual(error.details.unreversed_deduction_entry_ids, [deduction.entry.id]);
      return true;
    },
  );
  assert.equal(decisionOf(world, award.claim_id), 'approved');
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 0, total: 0, xp: 25 });

  // Undoing the deduction clears the way.
  reverseEntry(world.admin, { entryId: deduction.entry.id, reason: 'Deduction was premature' });
  reverseEntry(world.admin, { entryId: award.id, reason: 'Revoke the award' });
  assert.equal(decisionOf(world, award.claim_id), 'revoked');
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 0, total: 0, xp: 0 });

  // The schema refuses a negative balance even with raw SQL.
  assert.throws(
    () =>
      world.db.run(
        `INSERT INTO ledger_entries (member_id, kind, bucket, points, xp, idempotency_key, reason, actor_user_id, period, created_at)
         VALUES (?, 'adjustment', 'earned', -1, 0, 'req:raw:12345678', 'raw', ?, '2026-11', '2026-11-09T20:00:00.000Z')`,
        [memberId, world.adminUserId],
      ),
    /would_go_negative/,
  );
});

test('bonuses land in the bonus bucket, are idempotent and count toward caps', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const args = { memberId, points: 50, xp: 5, reason: 'Monthly challenge winner', idempotencyKey: key(14) };
  const first = grantBonus(world.admin, args);
  const replay = grantBonus(world.admin, args);
  assert.equal(first.entry.bucket, 'bonus');
  assert.equal(replay.replayed, true);
  assert.deepEqual(balanceOf(world.admin, memberId), { earned: 0, bonus: 50, total: 50, xp: 5 });
  assert.equal(capStatus(world.admin, memberId).member.used, 50);
  expectAppError(assert, () => grantBonus(world.admin, { ...args, points: -5, idempotencyKey: key(15) }), 'invalid_amount', 422);
  expectAppError(assert, () => grantBonus(world.admin, { ...args, competitionId: 'cmp_missing', idempotencyKey: key(16) }), 'competition_not_found', 404);
  const archived = insertMember(world.db, { name: 'Gone', status: 'archived' });
  expectAppError(assert, () => grantBonus(world.admin, { ...args, memberId: archived, idempotencyKey: key(17) }), 'member_not_active', 409);
});

test('the per-member monthly cap blocks an approval without changing anything', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  updateSettings(world.admin, { monthly_cap_per_member: 40, monthly_budget_total: 1000 });
  awardNew(world, memberId, taskTypeId); // 25 of 40 used

  const second = insertClaim(world.db, { memberId, taskTypeId, state: 'pending' });
  assert.throws(
    () =>
      world.db.tx(() => {
        markReviewed(world.db, second.id);
        awardForClaim(world.admin, second, 'Approved');
      }),
    (error) => {
      assert.equal(error.code, 'cap_exceeded');
      assert.equal(error.status, 409);
      assert.deepEqual(error.details, { scope: 'member', period: '2026-11', limit: 40, used: 25, remaining: 15, requested: 25 });
      return true;
    },
  );
  // The review mark was rolled back together with the refused award.
  const after = world.db.get('SELECT decision, verification_status FROM claims WHERE id = ?', [second.id]);
  assert.deepEqual({ ...after }, { decision: 'pending', verification_status: 'unverified' });
  assert.equal(count(world.db, 'ledger_entries'), 1);
});

test('the monthly budget is shared across members, and reversed awards free their room', () => {
  const world = makeWorld();
  const taskTypeId = insertTaskType(world.db);
  const a = insertMember(world.db, { name: 'Ada' });
  const b = insertMember(world.db, { name: 'Bo' });
  updateSettings(world.admin, { monthly_cap_per_member: 100, monthly_budget_total: 40 });

  const { entry: first } = awardNew(world, a, taskTypeId);
  const blocked = insertClaim(world.db, { memberId: b, taskTypeId, state: 'reviewed' });
  assert.throws(() => world.db.tx(() => awardForClaim(world.admin, blocked, 'Approved')), (error) => error.code === 'cap_exceeded' && error.details.scope === 'budget');

  reverseEntry(world.admin, { entryId: first.id, reason: 'Revoked for the test' });
  assert.equal(capStatus(world.admin, a).budget.used, 0);
  world.db.tx(() => awardForClaim(world.admin, blocked, 'Approved'));
  assert.deepEqual(balanceOf(world.admin, b), { earned: 25, bonus: 0, total: 25, xp: 25 });
});

test('caps follow the calendar month in the configured time zone; every credit counts, deductions do not', () => {
  // 2026-12-01T07:30Z is still 30 November in Los Angeles.
  const world = makeWorld({ at: '2026-12-01T07:30:00.000Z' });
  const memberId = insertMember(world.db);
  const taskTypeId = insertTaskType(world.db);
  updateSettings(world.admin, { monthly_cap_per_member: 30, monthly_budget_total: 1000 });
  assert.equal(currentPeriod(world.admin), '2026-11');

  const { entry } = awardNew(world, memberId, taskTypeId);
  assert.equal(entry.period, '2026-11');
  // A positive correction is a credit like any other: it counts, and is refused past the cap.
  adjust(world.admin, { memberId, points: 5, bucket: 'bonus', reason: 'Small manual credit', idempotencyKey: key(18) });
  assert.equal(capStatus(world.admin, memberId).member.used, 30);
  expectAppError(assert, () => adjust(world.admin, { memberId, points: 1, bucket: 'bonus', reason: 'One more credit', idempotencyKey: key(19) }), 'cap_exceeded', 409);
  // A deduction does not give cap room back.
  adjust(world.admin, { memberId, points: -5, bucket: 'bonus', reason: 'Deduction', idempotencyKey: key(20) });
  assert.equal(capStatus(world.admin, memberId).member.used, 30);

  const next = insertClaim(world.db, { memberId, taskTypeId, state: 'reviewed' });
  expectAppError(assert, () => world.db.tx(() => awardForClaim(world.admin, next, 'Approved')), 'cap_exceeded', 409);

  world.clock.set('2026-12-01T08:00:00.000Z'); // midnight in Los Angeles: a new month
  assert.equal(currentPeriod(world.admin), '2026-12');
  const december = world.db.tx(() => awardForClaim(world.admin, next, 'Approved'));
  assert.equal(december.period, '2026-12');

  // A reversal made in December of a November entry counts in November, not December.
  const reversal = reverseEntry(world.admin, { entryId: entry.id, reason: 'Late correction' });
  assert.equal(reversal.entry.period, '2026-11');
  assert.equal(capStatus(world.admin, memberId, '2026-11').member.used, 5);
  assert.equal(capStatus(world.admin, memberId, '2026-12').member.used, 25);

  // Changing the zone later does not move old entries between months.
  updateSettings(world.admin, { time_zone: 'UTC' });
  assert.equal(world.db.get('SELECT period FROM ledger_entries WHERE id = ?', [december.id]).period, '2026-12');
});

test('balances are per member; a member sees only their own ledger, without who wrote it', () => {
  const world = makeWorld();
  const a = insertMemberWithUser(world.db, 'Ada');
  const b = insertMemberWithUser(world.db, 'Bo');
  adjust(world.admin, { memberId: a.memberId, points: 10, bucket: 'bonus', reason: 'Seed correction for the first', idempotencyKey: key(21) });
  adjust(world.admin, { memberId: b.memberId, points: 7, xp: 3, bucket: 'bonus', reason: 'Seed correction for the second', idempotencyKey: key(22) });
  const balances = allBalances(world.admin);
  assert.deepEqual(balances.get(a.memberId), { earned: 0, bonus: 10, total: 10, xp: 0 });
  assert.deepEqual(balances.get(b.memberId), { earned: 0, bonus: 7, total: 7, xp: 3 });

  const asA = world.as(a.actor);
  const own = listEntries(asA).items;
  assert.equal(own.length, 1);
  assert.equal(own[0].member_id, a.memberId);
  assert.equal(own[0].actor_user_id, undefined);
  expectAppError(assert, () => listEntries(asA, { memberId: b.memberId }), 'not_yours', 403);
  assert.equal(listEntries(world.admin, { memberId: b.memberId }).items[0].actor_user_id, world.adminUserId);

  const page1 = listEntries(world.admin, { limit: 1 });
  assert.equal(page1.items.length, 1);
  assert.ok(page1.nextBeforeId);
  const page2 = listEntries(world.admin, { limit: 1, beforeId: page1.nextBeforeId });
  assert.equal(page2.items.length, 1);
  assert.equal(page2.nextBeforeId, null);
});

test('nobody credits themselves: an admin linked to a member cannot award, bonus, adjust or un-deduct for that member', () => {
  const world = makeWorld();
  const taskTypeId = insertTaskType(world.db);
  const self = insertMemberWithUser(world.db, 'Ada');
  world.db.run("UPDATE users SET role = 'admin' WHERE id = ?", [self.userId]);
  const selfAdmin = world.as({ userId: self.userId, role: 'admin', memberId: self.memberId });
  const credit = { memberId: self.memberId, points: 5, bucket: 'bonus' };

  expectAppError(assert, () => adjust(selfAdmin, { ...credit, reason: 'Topping myself up', idempotencyKey: key(23) }), 'self_credit_forbidden', 403);
  expectAppError(assert, () => grantBonus(selfAdmin, { ...credit, reason: 'A bonus for me', idempotencyKey: key(24) }), 'self_credit_forbidden', 403);
  const claim = insertClaim(world.db, { memberId: self.memberId, taskTypeId, state: 'reviewed' });
  expectAppError(assert, () => world.db.tx(() => awardForClaim(selfAdmin, claim, 'Approving my own')), 'self_credit_forbidden', 403);

  // The schema refuses even if the application checks are bypassed.
  const rawInsert = (kind, bucket, extra = {}) =>
    world.db.run(
      `INSERT INTO ledger_entries (member_id, kind, bucket, points, xp, claim_id, idempotency_key, reason, actor_user_id, period, created_at)
       VALUES (?, ?, ?, 25, 25, ?, ?, 'raw', ?, '2026-11', '2026-11-09T20:00:00.000Z')`,
      [self.memberId, kind, bucket, extra.claimId ?? null, extra.key ?? 'req:raw:12345678', self.userId],
    );
  assert.throws(() => rawInsert('bonus', 'bonus'), /cannot credit the member it is linked to/);
  assert.throws(() => rawInsert('task_award', 'earned', { claimId: claim.id, key: `award:${claim.id}` }), /cannot credit the member it is linked to|reviewer who is not linked/);
  assert.equal(count(world.db, 'ledger_entries'), 0);
  assert.equal(decisionOf(world, claim.id), 'pending');

  // The same admin may still credit OTHER members, and another admin may credit theirs.
  const other = insertMember(world.db, { name: 'Bo' });
  adjust(selfAdmin, { memberId: other, points: 5, bucket: 'bonus', reason: 'Correction for someone else', idempotencyKey: key(25) });
  adjust(world.admin, { ...credit, reason: 'Correction by another admin', idempotencyKey: key(26) });
  // Taking points from one's own member is allowed; undoing that (a credit) is not.
  const deduction = adjust(selfAdmin, { memberId: self.memberId, points: -5, bucket: 'bonus', reason: 'Removing my own points', idempotencyKey: key(27) });
  expectAppError(assert, () => reverseEntry(selfAdmin, { entryId: deduction.entry.id, reason: 'Undo my own removal' }), 'self_credit_forbidden', 403);
  assert.equal(reverseEntry(world.admin, { entryId: deduction.entry.id, reason: 'Undone by another admin' }).entry.points, 5);
});

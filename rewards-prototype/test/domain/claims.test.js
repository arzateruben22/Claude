import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, insertMemberWithUser, insertTaskType, insertUser, count, expectAppError, T0 } from '../helpers.js';
import { getClaim, listClaims, pendingPointsByMember, reviewClaim, revokeClaim, runApiCheck, submitClaim, withdrawClaim } from '../../src/domain/claims.js';
import { balanceOf } from '../../src/domain/ledger.js';
import { createVideo } from '../../src/domain/videos.js';
import { linkYoutubeChannel } from '../../src/domain/members.js';
import { updateSettings } from '../../src/domain/settings.js';
import { listAudit } from '../../src/domain/audit.js';
import { checkIntegrity } from '../../src/domain/integrity.js';
import { createPlatformRegistry } from '../../src/platforms/registry.js';
import { demoChannelId, youtubeDemoUrl } from '../../src/platforms/mockData.js';

const FEEDBACK = 'The opening ten seconds hook well, but the middle section drags; consider cutting the second b-roll montage and tightening the captions.';
const feedback = (n) => `${FEEDBACK} (note ${n})`;

/** Three members, a feedback task that needs a video, a creative task with an ownership check, and two tracked videos. */
function setup(options) {
  const world = makeWorld(options);
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const cy = insertMemberWithUser(world.db, 'Cy');
  const feedbackTask = insertTaskType(world.db, { key: 'constructive_feedback', label: 'Constructive feedback', requiresVideo: 1 });
  const creativeTask = insertTaskType(world.db, { key: 'creative_submission', label: 'Original creative submission', points: 25, xp: 40, apiCheck: 'video_ownership' });
  const video1 = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoLong001', kind: 'video', title: 'Sample long video', owner_member_id: ada.memberId });
  const video2 = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoShort02', kind: 'short', title: 'Sample short', owner_member_id: bo.memberId });
  const registry = createPlatformRegistry({ mode: 'mock', clock: world.clock });
  return { world, ada, bo, cy, feedbackTask, creativeTask, video1, video2, registry, asAda: world.as(ada.actor), asBo: world.as(bo.actor), asCy: world.as(cy.actor) };
}

const ledgerCount = (world, memberId) => count(world.db, 'ledger_entries', 'member_id = ?', [memberId]);
const integrityOk = (world) => assert.deepEqual(checkIntegrity(world.db).violations, []);

test('ACCEPTANCE: approving a task creates exactly one ledger entry and updates the balance', () => {
  const s = setup();
  const claim = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  assert.equal(claim.decision, 'pending');
  assert.equal(claim.verification_status, 'unverified');
  assert.equal(claim.points, 25);
  assert.deepEqual(pendingPointsByMember(s.world.admin).get(s.bo.memberId), { points: 25, xp: 25, claims: 1 });
  assert.equal(ledgerCount(s.world, s.bo.memberId), 0);

  const result = reviewClaim(s.world.admin, claim.id, { outcome: 'approve' });
  assert.equal(result.already_applied, false);
  assert.equal(result.claim.decision, 'approved');
  assert.equal(result.claim.verification_status, 'manually_reviewed', 'a human approval is "manually reviewed", never "verified"');
  assert.equal(result.claim.verification_source, 'admin_review');
  assert.equal(result.claim.simulated, false);
  assert.equal(result.entry.kind, 'task_award');
  assert.equal(result.entry.reason, 'Approved: Constructive feedback');
  assert.equal(ledgerCount(s.world, s.bo.memberId), 1);
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });
  assert.equal(pendingPointsByMember(s.world.admin).has(s.bo.memberId), false);

  // Approving again is a no-op that reports the same entry.
  const again = reviewClaim(s.world.admin, claim.id, { outcome: 'approve' });
  assert.equal(again.already_applied, true);
  assert.equal(again.entry.id, result.entry.id);
  assert.equal(ledgerCount(s.world, s.bo.memberId), 1);
  expectAppError(assert, () => reviewClaim(s.world.admin, claim.id, { outcome: 'reject', note: 'Changed my mind' }), 'claim_not_pending', 409);
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });
  integrityOk(s.world);
});

test('ACCEPTANCE: a duplicate submission cannot double-credit', () => {
  const s = setup();
  const first = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });

  // While the first is pending.
  assert.throws(
    () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(2) }),
    (error) => {
      assert.equal(error.code, 'duplicate_claim');
      assert.equal(error.status, 409);
      assert.deepEqual(error.details, { existing_claim_id: first.id, existing_decision: 'pending' });
      return true;
    },
  );
  // And after it has been approved.
  reviewClaim(s.world.admin, first.id, { outcome: 'approve' });
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(3) }), 'duplicate_claim', 409);
  // An admin entering it on the member's behalf is blocked the same way.
  expectAppError(assert, () => submitClaim(s.world.admin, { member_id: s.bo.memberId, task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(4) }), 'duplicate_claim', 409);

  assert.equal(count(s.world.db, 'claims', 'member_id = ?', [s.bo.memberId]), 1);
  assert.equal(ledgerCount(s.world, s.bo.memberId), 1);
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });
  // Each blocked attempt was recorded (and that record survived the refusal).
  assert.equal(listAudit(s.world.admin, { action: 'claim.duplicate_blocked' }).items.length, 3);

  // The same video for a different member, or a different video for the same member, is not a duplicate.
  submitClaim(s.asCy, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(5) });
  submitClaim(s.asCy, { task_type_id: s.feedbackTask, video_id: s.video2.id, evidence_text: feedback(6) });
  integrityOk(s.world);
});

test('the schema itself refuses a second live claim, a second award and a forged approval', () => {
  const s = setup();
  const claim = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  const raw = s.world.db;
  assert.throws(
    () =>
      raw.run(
        `INSERT INTO claims (id, member_id, task_type_id, video_id, subject_key, evidence_text, points_snapshot, xp_snapshot, submitted_by_role, created_at)
         VALUES ('clm_forged', ?, ?, ?, ?, 'x', 25, 25, 'member', ?)`,
        [s.bo.memberId, s.feedbackTask, s.video1.id, 'video:youtube:demoLong001', T0],
      ),
    /duplicate_claim|UNIQUE constraint failed/,
  );
  // Another video's subject on this video is refused: a tracked video has exactly one subject.
  assert.throws(
    () =>
      raw.run(
        `INSERT INTO claims (id, member_id, task_type_id, video_id, subject_key, evidence_text, points_snapshot, xp_snapshot, submitted_by_role, created_at)
         VALUES ('clm_forged', ?, ?, ?, 'video:youtube:someOtherId', 'x', 25, 25, 'member', ?)`,
        [s.bo.memberId, s.feedbackTask, s.video1.id, T0],
      ),
    /the subject of a claim about a tracked video/,
  );
  // A video link cannot hide under a text or url subject.
  assert.throws(
    () =>
      raw.run(
        `INSERT INTO claims (id, member_id, task_type_id, subject_key, evidence_text, evidence_hash, evidence_url, points_snapshot, xp_snapshot, submitted_by_role, created_at)
         VALUES ('clm_forged', ?, ?, 'text:abc', 'x', 'abc', 'https://www.youtube.com/watch?v=demoLong001', 25, 40, 'member', ?)`,
        [s.bo.memberId, s.creativeTask, T0],
      ),
    /a link to a platform video must use the video subject/,
  );
  // A different subject string for the same video is refused too.
  assert.throws(
    () =>
      raw.run(
        `INSERT INTO claims (id, member_id, task_type_id, video_id, subject_key, evidence_text, points_snapshot, xp_snapshot, submitted_by_role, created_at)
         VALUES ('clm_forged', ?, ?, ?, 'url:other-spelling', 'x', 25, 25, 'member', ?)`,
        [s.bo.memberId, s.feedbackTask, s.video1.id, T0],
      ),
    /CHECK constraint failed|the subject of a claim about a tracked video/,
  );
  // A claim worth more than its task is refused.
  assert.throws(
    () =>
      raw.run(
        `INSERT INTO claims (id, member_id, task_type_id, video_id, subject_key, evidence_text, points_snapshot, xp_snapshot, submitted_by_role, created_at)
         VALUES ('clm_forged', ?, ?, ?, ?, 'x', 1000, 25, 'member', ?)`,
        [s.cy.memberId, s.feedbackTask, s.video1.id, 'video:youtube:demoLong001', T0],
      ),
    /must snapshot an active task type/,
  );
  // Approval without the award, and "verified" without a platform, are impossible.
  assert.throws(() => raw.run("UPDATE claims SET decision = 'approved', decided_by = ?, decided_at = ? WHERE id = ?", [s.world.adminUserId, T0, claim.id]), /CHECK constraint failed|approved only by inserting its task_award/);
  assert.throws(() => raw.run("UPDATE claims SET verification_status = 'verified', verification_source = 'youtube_api', verified_at = ? WHERE id = ?", [T0, claim.id]), /verified requires an api-checkable task/);
  assert.throws(() => raw.run("UPDATE claims SET verification_status = 'verified', verification_source = 'admin_review', verified_at = ? WHERE id = ?", [T0, claim.id]), /CHECK constraint failed|verified requires an api-checkable task/);
  assert.throws(() => raw.run('DELETE FROM claims WHERE id = ?', [claim.id]), /deleted only by member erasure/);

  reviewClaim(s.world.admin, claim.id, { outcome: 'approve' });
  assert.throws(() => raw.run("UPDATE claims SET evidence_text = 'rewritten after approval' WHERE id = ?", [claim.id]), /identity, evidence and value are immutable/);
  assert.throws(() => raw.run("UPDATE claims SET verification_detail = '{}' WHERE id = ?", [claim.id]), /a decided claim is frozen/);
  assert.throws(() => raw.run("UPDATE claims SET decision = 'revoked' WHERE id = ?", [claim.id]), /revoked only by reversing its task_award/);
  assert.equal(ledgerCount(s.world, s.bo.memberId), 1);
  integrityOk(s.world);
});

test('who may submit for whom', () => {
  const s = setup();
  const payload = { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) };
  expectAppError(assert, () => submitClaim(s.asBo, { ...payload, member_id: s.cy.memberId }), 'not_yours', 403);
  expectAppError(assert, () => submitClaim(s.asBo, { ...payload, exception_reason: 'Please count it twice' }), 'admin_only', 403);
  expectAppError(assert, () => submitClaim(s.world.admin, payload), 'member_required', 422);
  expectAppError(assert, () => submitClaim(s.world.as({ userId: null, role: 'member', memberId: null }), payload), 'not_signed_in', 401);
  expectAppError(assert, () => submitClaim(s.asBo, { ...payload, points_snapshot: 1000 }), 'unknown_field', 422);
  expectAppError(assert, () => submitClaim(s.asBo, { ...payload, decision: 'approved' }), 'unknown_field', 422);

  const own = submitClaim(s.asBo, { ...payload, member_id: s.bo.memberId });
  assert.equal(own.member_id, s.bo.memberId);
  const onBehalf = submitClaim(s.world.admin, { ...payload, member_id: s.cy.memberId });
  assert.equal(onBehalf.member_id, s.cy.memberId);
  const audit = listAudit(s.world.admin, { action: 'claim.submit' }).items;
  assert.deepEqual(audit.map((row) => row.detail.on_behalf), [true, false]);
  assert.equal(count(s.world.db, 'claims'), 2);
});

test('what a submission must contain', () => {
  const s = setup();
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, evidence_text: feedback(1) }), 'video_required', 422);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: 'Nice video!' }), 'evidence_too_short', 422);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id }), 'evidence_too_short', 422);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: 'vid_missing', evidence_text: feedback(1) }), 'video_not_found', 404);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: 'tsk_missing', video_id: s.video1.id, evidence_text: feedback(1) }), 'task_type_not_found', 404);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.creativeTask }), 'evidence_url_required', 422);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.creativeTask, evidence_url: 'https://example.org/my-video' }), 'invalid_input', 422);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.creativeTask, evidence_url: 'http://www.youtube.com/watch?v=demoOwnB001' }), 'invalid_input', 422);

  s.world.db.run('UPDATE task_types SET active = 0 WHERE id = ?', [s.feedbackTask]);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) }), 'task_not_active', 409);
  s.world.db.run('UPDATE task_types SET active = 1 WHERE id = ?', [s.feedbackTask]);
  s.world.db.run("UPDATE videos SET status = 'archived' WHERE id = ?", [s.video1.id]);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) }), 'video_not_active', 409);
  s.world.db.run("UPDATE members SET status = 'archived' WHERE id = ?", [s.bo.memberId]);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video2.id, evidence_text: feedback(1) }), 'member_not_active', 409);
  assert.equal(count(s.world.db, 'claims'), 0);
});

test("a member's own submissions are limited per local day; admin entries are not", () => {
  const s = setup(); // T0 is 12:00 in Los Angeles
  updateSettings(s.world.admin, { daily_claim_limit_per_member: 2 });
  const freeTask = insertTaskType(s.world.db, { key: 'script_notes', label: 'Script notes' });
  submitClaim(s.asBo, { task_type_id: freeTask, evidence_text: feedback(1) });
  submitClaim(s.asBo, { task_type_id: freeTask, evidence_text: feedback(2) });
  assert.throws(
    () => submitClaim(s.asBo, { task_type_id: freeTask, evidence_text: feedback(3) }),
    (error) => error.code === 'rate_limited' && error.status === 429 && error.details.limit === 2,
  );
  // Another member is unaffected, and so is an admin entering one for the limited member.
  submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(4) });
  submitClaim(s.world.admin, { member_id: s.bo.memberId, task_type_id: freeTask, evidence_text: feedback(5) });

  s.world.clock.advance(11 * 60 * 60 * 1000); // 23:00 the same local day
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: freeTask, evidence_text: feedback(6) }), 'rate_limited', 429);
  s.world.clock.advance(2 * 60 * 60 * 1000); // 01:00 the next local day
  submitClaim(s.asBo, { task_type_id: freeTask, evidence_text: feedback(7) });
});

test('rejecting needs a reason and frees the slot; the member can try again', () => {
  const s = setup();
  const first = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  expectAppError(assert, () => reviewClaim(s.world.admin, first.id, { outcome: 'reject' }), 'note_required', 422);
  expectAppError(assert, () => reviewClaim(s.world.admin, first.id, { outcome: 'maybe' }), 'invalid_input', 422);
  expectAppError(assert, () => reviewClaim(s.asCy, first.id, { outcome: 'approve' }), 'admin_only', 403);
  expectAppError(assert, () => reviewClaim(s.world.system, first.id, { outcome: 'approve' }), 'admin_account_required', 403);

  const rejected = reviewClaim(s.world.admin, first.id, { outcome: 'reject', note: 'Too general: say what to change.' });
  assert.equal(rejected.claim.decision, 'rejected');
  assert.equal(rejected.claim.verification_status, 'unverified');
  assert.equal(rejected.entry, null);
  assert.equal(ledgerCount(s.world, s.bo.memberId), 0);
  assert.equal(getClaim(s.asBo, first.id).decision_note, 'Too general: say what to change.');
  expectAppError(assert, () => reviewClaim(s.world.admin, first.id, { outcome: 'approve' }), 'claim_not_pending', 409);

  const second = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(2) });
  reviewClaim(s.world.admin, second.id, { outcome: 'approve', note: 'Specific and kind' });
  assert.equal(s.world.db.get('SELECT reason FROM ledger_entries WHERE claim_id = ?', [second.id]).reason, 'Approved: Constructive feedback — Specific and kind');
  assert.equal(ledgerCount(s.world, s.bo.memberId), 1);
  expectAppError(assert, () => reviewClaim(s.world.admin, submitClaim(s.asCy, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(3) }).id, { outcome: 'approve', note: 'Bonus for every comment' }), 'engagement_not_rewardable', 422);
  integrityOk(s.world);
});

test('withdrawing: only your own, only while pending', () => {
  const s = setup();
  const claim = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  expectAppError(assert, () => withdrawClaim(s.asCy, claim.id), 'not_yours', 403);
  assert.equal(withdrawClaim(s.asBo, claim.id).decision, 'withdrawn');
  assert.equal(withdrawClaim(s.asBo, claim.id).decision, 'withdrawn');
  expectAppError(assert, () => reviewClaim(s.world.admin, claim.id, { outcome: 'approve' }), 'claim_not_pending', 409);
  // The slot is free again.
  const again = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(2) });
  reviewClaim(s.world.admin, again.id, { outcome: 'approve' });
  expectAppError(assert, () => withdrawClaim(s.asBo, again.id), 'claim_not_pending', 409);
});

test('revoking reverses the award, is reversible only once, and lets the member resubmit', () => {
  const s = setup();
  const claim = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  expectAppError(assert, () => revokeClaim(s.world.admin, claim.id, { reason: 'Not approved yet' }), 'claim_not_approved', 409);
  reviewClaim(s.world.admin, claim.id, { outcome: 'approve' });
  expectAppError(assert, () => revokeClaim(s.asBo, claim.id, { reason: 'Members cannot revoke' }), 'admin_only', 403);
  expectAppError(assert, () => revokeClaim(s.world.admin, claim.id, {}), 'reason_required', 422);

  const revoked = revokeClaim(s.world.admin, claim.id, { reason: 'Copied from another submission' });
  assert.equal(revoked.claim.decision, 'revoked');
  assert.equal(revoked.entry.kind, 'reversal');
  assert.equal(revoked.replayed, false);
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 0, bonus: 0, total: 0, xp: 0 });
  const replay = revokeClaim(s.world.admin, claim.id, { reason: 'Copied from another submission' });
  assert.equal(replay.replayed, true);
  assert.equal(replay.entry.id, revoked.entry.id);
  assert.equal(ledgerCount(s.world, s.bo.memberId), 2);

  const fresh = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(2) });
  reviewClaim(s.world.admin, fresh.id, { outcome: 'approve' });
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 25, bonus: 0, total: 25, xp: 25 });
  integrityOk(s.world);
});

test('an exception is the only way to credit the same thing twice: admin-only, logged, and only after a credit', () => {
  const s = setup();
  const payload = { member_id: s.bo.memberId, task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) };
  expectAppError(assert, () => submitClaim(s.world.admin, { ...payload, exception_reason: 'Nothing was credited yet' }), 'exception_not_applicable', 409);

  const first = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  expectAppError(assert, () => submitClaim(s.world.admin, { ...payload, exception_reason: 'Still pending, not credited' }), 'exception_not_applicable', 409);
  reviewClaim(s.world.admin, first.id, { outcome: 'approve' });

  const exception = submitClaim(s.world.admin, { ...payload, evidence_text: feedback(2), exception_reason: 'Re-edited video, second round of feedback agreed' });
  assert.equal(exception.is_exception, true);
  expectAppError(assert, () => submitClaim(s.world.admin, { ...payload, evidence_text: feedback(3), exception_reason: 'A second exception while the first is pending' }), 'duplicate_claim', 409);
  reviewClaim(s.world.admin, exception.id, { outcome: 'approve' });
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 50, bonus: 0, total: 50, xp: 50 });
  assert.equal(listAudit(s.world.admin, { action: 'claim.exception_granted' }).items.length, 1);

  // The next exception takes the next number.
  const third = submitClaim(s.world.admin, { ...payload, evidence_text: feedback(4), exception_reason: 'Third round, agreed in advance' });
  assert.equal(s.world.db.get('SELECT exception_seq FROM claims WHERE id = ?', [third.id]).exception_seq, 2);
  assert.ok(listClaims(s.world.admin, { memberId: s.bo.memberId }).items.find((item) => item.id === third.id).flags.includes('admin_exception'));
  integrityOk(s.world);
});

test('nobody decides their own submission; another admin can', () => {
  const s = setup();
  s.world.db.run("UPDATE users SET role = 'admin', last_login_at = ? WHERE id = ?", [T0, s.bo.userId]);
  const boAsAdmin = s.world.as({ userId: s.bo.userId, role: 'admin', memberId: s.bo.memberId });
  const own = submitClaim(boAsAdmin, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  expectAppError(assert, () => reviewClaim(boAsAdmin, own.id, { outcome: 'approve' }), 'self_review_forbidden', 403);
  expectAppError(assert, () => reviewClaim(boAsAdmin, own.id, { outcome: 'reject', note: 'Rejecting my own' }), 'self_review_forbidden', 403);
  assert.equal(ledgerCount(s.world, s.bo.memberId), 0);

  // The same admin decides other members' submissions normally.
  const other = submitClaim(s.asCy, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(2) });
  assert.equal(reviewClaim(boAsAdmin, other.id, { outcome: 'approve' }).claim.decision, 'approved');
  assert.equal(reviewClaim(s.world.admin, own.id, { outcome: 'approve' }).claim.decision, 'approved');
  integrityOk(s.world);
});

test('a monthly cap refuses the approval and leaves the submission untouched', () => {
  const s = setup();
  updateSettings(s.world.admin, { monthly_cap_per_member: 30 });
  const a = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(1) });
  const b = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video2.id, evidence_text: feedback(2) });
  reviewClaim(s.world.admin, a.id, { outcome: 'approve' });
  assert.throws(() => reviewClaim(s.world.admin, b.id, { outcome: 'approve' }), (error) => error.code === 'cap_exceeded' && error.details.remaining === 5);
  const after = getClaim(s.world.admin, b.id);
  assert.equal(after.decision, 'pending');
  assert.equal(after.verification_status, 'unverified');
  assert.equal(ledgerCount(s.world, s.bo.memberId), 1);

  updateSettings(s.world.admin, { monthly_cap_per_member: 60 });
  assert.equal(reviewClaim(s.world.admin, b.id, { outcome: 'approve' }).claim.decision, 'approved');
  integrityOk(s.world);
});

test('ACCEPTANCE: "verified" comes only from a platform attestation; failures and unsupported checks are shown honestly', async () => {
  const s = setup();
  linkYoutubeChannel(s.world.system, { memberId: s.ada.memberId, channelId: demoChannelId(1), attestedBy: 'demo_seed' });

  // Attested: the submitted video is on the member's linked channel.
  const owned = submitClaim(s.asAda, { task_type_id: s.creativeTask, evidence_url: 'https://youtu.be/demoOwnA001?si=tracking' });
  assert.equal(owned.evidence_url, youtubeDemoUrl('demoOwnA001'));
  const attested = await runApiCheck(s.world.admin, owned.id, s.registry);
  assert.equal(attested.check.outcome, 'attested');
  assert.equal(attested.claim.verification_status, 'verified');
  assert.equal(attested.claim.verification_source, 'mock_adapter');
  assert.equal(attested.claim.simulated, true, 'a mock attestation must be labelled as simulated');
  assert.equal(attested.claim.decision, 'pending', 'a check never credits anything by itself');
  assert.equal(ledgerCount(s.world, s.ada.memberId), 0);
  const approved = reviewClaim(s.world.admin, owned.id, { outcome: 'approve' });
  assert.equal(approved.claim.verification_status, 'verified', 'approval keeps the platform attestation');
  assert.ok(listClaims(s.world.admin, { memberId: s.ada.memberId }).items[0].flags.includes('simulated_verification'));

  // Not attested: someone else's video.
  const notOwned = submitClaim(s.asAda, { task_type_id: s.creativeTask, evidence_url: youtubeDemoUrl('demoOwnB001') });
  const refused = await runApiCheck(s.world.admin, notOwned.id, s.registry);
  assert.equal(refused.check.outcome, 'not_attested');
  assert.equal(refused.claim.verification_status, 'unverified');
  assert.equal(refused.claim.verification_detail.outcome, 'not_attested');

  // Member has not linked a channel: nothing can be attested.
  const unlinked = submitClaim(s.asBo, { task_type_id: s.creativeTask, evidence_url: youtubeDemoUrl('demoOwnB001') });
  const noLink = await runApiCheck(s.world.admin, unlinked.id, s.registry);
  assert.equal(noLink.check.outcome, 'not_attested');
  assert.equal(noLink.check.evidence.member_linked, false);
  assert.equal(noLink.claim.verification_status, 'unverified');

  // API failure: reported as unavailable, stays unverified, can be retried.
  linkYoutubeChannel(s.world.system, { memberId: s.cy.memberId, channelId: demoChannelId(3), attestedBy: 'demo_seed' });
  const quota = submitClaim(s.asCy, { task_type_id: s.creativeTask, evidence_url: youtubeDemoUrl('demoQuota01') });
  const failed = await runApiCheck(s.world.admin, quota.id, s.registry);
  assert.equal(failed.check.outcome, 'unavailable');
  assert.equal(failed.check.evidence.error_code, 'quota_exceeded');
  assert.equal(failed.claim.verification_status, 'unverified');
  assert.match(failed.claim.verification_detail.reason, /quota/i);

  // TikTok: unsupported, said plainly.
  const tiktok = submitClaim(s.asCy, { task_type_id: s.creativeTask, evidence_url: 'https://www.tiktok.com/@sample.creator/video/7000000000000000001' });
  const unsupported = await runApiCheck(s.world.admin, tiktok.id, s.registry);
  assert.equal(unsupported.check.outcome, 'unsupported');
  assert.equal(unsupported.claim.verification_status, 'unverified');
  // A person can still review it: that makes it "manually reviewed", not "verified".
  assert.equal(reviewClaim(s.world.admin, tiktok.id, { outcome: 'approve' }).claim.verification_status, 'manually_reviewed');

  // Live mode with nothing connected: "not connected", never a guess.
  const live = createPlatformRegistry({ mode: 'live', clock: s.world.clock });
  const notConnected = await runApiCheck(s.world.admin, notOwned.id, live);
  assert.equal(notConnected.check.outcome, 'not_configured');
  assert.equal(notConnected.claim.verification_status, 'unverified');

  // Tasks reviewed by a person have nothing to check automatically.
  const text = submitClaim(s.asBo, { task_type_id: s.feedbackTask, video_id: s.video1.id, evidence_text: feedback(9) });
  await assert.rejects(() => runApiCheck(s.world.admin, text.id, s.registry), (error) => error.code === 'no_api_check');
  await assert.rejects(() => runApiCheck(s.asBo, unlinked.id, s.registry), (error) => error.code === 'admin_only');
  await assert.rejects(() => runApiCheck(s.world.admin, owned.id, s.registry), (error) => error.code === 'claim_not_pending');
  integrityOk(s.world);
});

test('a re-check can withdraw an earlier attestation while the claim is still pending', async () => {
  const s = setup();
  linkYoutubeChannel(s.world.system, { memberId: s.ada.memberId, channelId: demoChannelId(1), attestedBy: 'demo_seed' });
  const claim = submitClaim(s.asAda, { task_type_id: s.creativeTask, evidence_url: youtubeDemoUrl('demoOwnA001') });
  assert.equal((await runApiCheck(s.world.admin, claim.id, s.registry)).claim.verification_status, 'verified');
  // The member unlinks their channel; a new check can no longer attest ownership.
  s.world.db.run('UPDATE members SET youtube_channel_id = NULL, youtube_linked_at = NULL WHERE id = ?', [s.ada.memberId]);
  const second = await runApiCheck(s.world.admin, claim.id, s.registry);
  assert.equal(second.claim.verification_status, 'unverified');
  assert.equal(second.claim.verification_source, 'none');
  assert.equal(second.claim.verified_at, null);
});

test('one video is one subject, however its link is written and whether or not it is tracked yet', () => {
  const s = setup();
  // video1 (demoLong001) is on the tracked list. Submitting its link attaches the claim to that video.
  const viaLink = submitClaim(s.asAda, { task_type_id: s.creativeTask, evidence_url: 'https://youtu.be/demoLong001' });
  assert.equal(viaLink.video.id, s.video1.id);
  expectAppError(assert, () => submitClaim(s.asAda, { task_type_id: s.creativeTask, evidence_url: 'https://www.youtube.com/watch?v=demoLong001&t=10s' }), 'duplicate_claim', 409);
  expectAppError(assert, () => submitClaim(s.asAda, { task_type_id: s.creativeTask, evidence_url: 'https://m.youtube.com/watch?v=demoLong001' }), 'duplicate_claim', 409);
  expectAppError(assert, () => submitClaim(s.asAda, { task_type_id: s.creativeTask, video_id: s.video2.id, evidence_url: 'https://youtu.be/demoLong001' }), 'video_mismatch', 422);

  // An untracked video: every spelling of its link is the same subject too.
  const early = submitClaim(s.asBo, { task_type_id: s.creativeTask, evidence_url: 'https://youtu.be/demoOwnB001' });
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.creativeTask, evidence_url: 'https://www.youtube.com/watch?v=demoOwnB001&feature=share' }), 'duplicate_claim', 409);

  // REGRESSION: credited while the video was NOT tracked, then the video is put on the
  // tracked list. It is still the same subject, so it cannot be credited a second time.
  reviewClaim(s.world.admin, early.id, { outcome: 'approve' });
  const nowTracked = createVideo(s.world.admin, { url: 'https://www.youtube.com/watch?v=demoOwnB001', title: 'Now on the tracked list', owner_member_id: s.bo.memberId });
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.creativeTask, evidence_url: 'https://youtu.be/demoOwnB001' }), 'duplicate_claim', 409);
  expectAppError(assert, () => submitClaim(s.asBo, { task_type_id: s.creativeTask, video_id: nowTracked.id, evidence_url: 'https://youtu.be/demoOwnB001' }), 'duplicate_claim', 409);
  assert.deepEqual(balanceOf(s.world.admin, s.bo.memberId), { earned: 25, bonus: 0, total: 25, xp: 40 });
  assert.equal(count(s.world.db, 'claims', 'member_id = ?', [s.bo.memberId]), 1);

  // On a written task, a link to a video makes the claim about that video — tracked or not.
  const freeTask = insertTaskType(s.world.db, { key: 'script_notes', label: 'Script notes' });
  const attached = submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(1), evidence_url: 'https://www.youtube.com/watch?v=demoLong001' });
  assert.equal(attached.video.id, s.video1.id);
  expectAppError(assert, () => submitClaim(s.asCy, { task_type_id: freeTask, video_id: s.video1.id, evidence_text: feedback(2) }), 'duplicate_claim', 409);
  // A channel or profile link is not a video.
  expectAppError(assert, () => submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(3), evidence_url: 'https://www.youtube.com/@some.channel' }), 'video_link_required', 422);
  // Any other link is a subject by its normalised form.
  submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(4), evidence_url: 'https://example.org/notes?utm_source=share' });
  expectAppError(assert, () => submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(5), evidence_url: 'https://example.org/notes/' }), 'duplicate_claim', 409);
  // The same text twice is the same subject.
  submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(6) });
  expectAppError(assert, () => submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: `  ${feedback(6).toUpperCase()}  ` }), 'duplicate_claim', 409);
  integrityOk(s.world);
});

test('members see only their own submissions; admins see everything, with review flags', () => {
  const s = setup();
  const freeTask = insertTaskType(s.world.db, { key: 'script_notes', label: 'Script notes' });
  const bos = submitClaim(s.asBo, { task_type_id: freeTask, evidence_text: feedback(1) });
  const cys = submitClaim(s.asCy, { task_type_id: freeTask, evidence_text: feedback(1) }); // the same text as Bo's

  assert.deepEqual(listClaims(s.asBo).items.map((item) => item.id), [bos.id]);
  assert.equal(listClaims(s.asBo).items[0].evidence_text, feedback(1));
  assert.equal(listClaims(s.asBo).items[0].flags, undefined);
  expectAppError(assert, () => listClaims(s.asBo, { memberId: s.cy.memberId }), 'not_yours', 403);
  expectAppError(assert, () => getClaim(s.asBo, cys.id), 'claim_not_found', 404);
  assert.equal(getClaim(s.asBo, bos.id).submitted_by, undefined, 'internal ids are for admins only');

  const all = listClaims(s.world.admin).items;
  assert.equal(all.length, 2);
  assert.ok(all.every((item) => item.flags.includes('same_text_as_another_member')));
  assert.equal(listClaims(s.world.admin, { decision: 'approved' }).items.length, 0);
  expectAppError(assert, () => listClaims(s.world.admin, { decision: 'nonsense' }), 'invalid_input', 422);

  const page = listClaims(s.world.admin, { limit: 1 });
  assert.equal(page.items.length, 1);
  assert.equal(listClaims(s.world.admin, { limit: 1, before: page.next }).items.length, 1);

  // An admin with no member profile has no "own" list as a member would; a member-less non-admin is refused.
  expectAppError(assert, () => listClaims(s.world.as({ userId: insertUser(s.world.db, { email: 'x@example.test', role: 'admin' }), role: 'member', memberId: null })), 'not_yours', 403);
});

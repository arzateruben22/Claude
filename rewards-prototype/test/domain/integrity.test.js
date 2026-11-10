import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, insertMemberWithUser, insertTaskType, T0 } from '../helpers.js';
import { assertIntegrity, checkIntegrity } from '../../src/domain/integrity.js';
import { reviewClaim, submitClaim } from '../../src/domain/claims.js';
import { adjust } from '../../src/domain/ledger.js';
import { createVideo } from '../../src/domain/videos.js';

const TEXT = 'The hook lands in the first five seconds, but the captions cover the product; move them up and shorten the outro.';

function busyWorld() {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const task = insertTaskType(world.db, { requiresVideo: 1 });
  const video = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoLong001', kind: 'video', title: 'Sample', owner_member_id: ada.memberId });
  const claim = submitClaim(world.as(bo.actor), { task_type_id: task, video_id: video.id, evidence_text: TEXT });
  const { entry } = reviewClaim(world.admin, claim.id, { outcome: 'approve' });
  adjust(world.admin, { memberId: ada.memberId, points: 10, bucket: 'bonus', reason: 'Manual credit', idempotencyKey: 'integrity-0001' });
  return { world, ada, bo, task, video, claim, entry };
}

const checks = (db) => checkIntegrity(db).violations.map((item) => item.check);
const triggerSql = (db, name) => db.get("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?", [name]).sql;

/** Simulates someone editing the file with another tool: guards off, change, guards back exactly as they were. */
function tamper(db, triggers, change) {
  const saved = triggers.map((name) => [name, triggerSql(db, name)]);
  for (const [name] of saved) db.exec(`DROP TRIGGER ${name}`);
  change();
  for (const [, sql] of saved) db.exec(sql);
}

test('a database produced by normal use passes, and the report says which schema version was checked', () => {
  const { world } = busyWorld();
  const result = checkIntegrity(world.db);
  assert.deepEqual(result, { ok: true, checked_at_version: 1, violations: [] });
  assert.equal(assertIntegrity(world.db).ok, true);
});

test('a missing, altered or extra schema object is reported before anything else', () => {
  const { world } = busyWorld();
  const original = triggerSql(world.db, 'ledger_no_update');
  world.db.exec('DROP TRIGGER ledger_no_update');
  assert.deepEqual(checkIntegrity(world.db).violations, [{ check: 'schema_object_missing', count: 1, note: 'trigger:ledger_no_update' }]);
  assert.throws(() => assertIntegrity(world.db), /integrity check failed: schema_object_missing\(1\)/);

  world.db.exec(original.replace("'ledger_entries is append-only'", "'ledger_entries is append-only, honest'"));
  assert.deepEqual(checks(world.db), ['schema_object_changed']);
  world.db.exec('DROP TRIGGER ledger_no_update');
  world.db.exec(original);
  assert.equal(checkIntegrity(world.db).ok, true);

  world.db.exec('CREATE TABLE payouts (id INTEGER PRIMARY KEY, cents INTEGER)');
  assert.deepEqual(checkIntegrity(world.db).violations, [{ check: 'schema_object_unexpected', count: 1, note: 'table:payouts' }]);
});

test('connection settings the promises depend on are checked', () => {
  const { world } = busyWorld();
  world.db.exec('PRAGMA foreign_keys = OFF');
  assert.ok(checks(world.db).includes('pragma_foreign_keys'));
  world.db.exec('PRAGMA foreign_keys = ON; PRAGMA recursive_triggers = OFF');
  assert.ok(checks(world.db).includes('pragma_recursive_triggers'));
});

test('an approved claim whose award has vanished is caught', () => {
  const { world, claim, entry } = busyWorld();
  tamper(world.db, ['ledger_no_delete'], () => {
    world.db.run('DELETE FROM ledger_entries WHERE id = ?', [entry.id]);
  });
  const result = checkIntegrity(world.db);
  assert.deepEqual(result.violations.find((item) => item.check === 'approved_claim_without_live_award'), { check: 'approved_claim_without_live_award', count: 1, sample: [claim.id] });
});

test('an award that no longer matches its claim, and a negative balance, are caught', () => {
  const { world, entry, ada } = busyWorld();
  tamper(world.db, ['ledger_no_update'], () => {
    world.db.run('UPDATE ledger_entries SET points = 9000 WHERE id = ?', [entry.id]);
    world.db.run('UPDATE ledger_entries SET points = -10 WHERE member_id = ?', [ada.memberId]);
  });
  const found = checks(world.db);
  assert.ok(found.includes('award_differs_from_claim'));
  assert.ok(found.includes('negative_balance'));
});

test('a ledger entry with no audit row is caught', () => {
  const { world, ada } = busyWorld();
  world.db.run(
    `INSERT INTO ledger_entries (member_id, kind, bucket, points, xp, idempotency_key, reason, actor_user_id, period, created_at)
     VALUES (?, 'bonus', 'bonus', 5, 0, 'req:raw:off-the-books', 'Entered directly', ?, '2026-11', ?)`,
    [ada.memberId, world.adminUserId, T0],
  );
  const violation = checkIntegrity(world.db).violations.find((item) => item.check === 'ledger_entry_without_audit_row');
  assert.equal(violation.count, 1);
});

test('a half-finished erasure, a broken tier ladder and a lost admin are caught', () => {
  const { world, ada } = busyWorld();
  world.db.run('UPDATE erasure_guard SET member_id = ? WHERE id = 1', [ada.memberId]);
  assert.ok(checks(world.db).includes('erasure_guard_not_clear'));
  tamper(world.db, ['erasure_guard_clear'], () => world.db.run('UPDATE erasure_guard SET member_id = NULL WHERE id = 1'));
  assert.equal(checkIntegrity(world.db).ok, true);

  world.db.run('DELETE FROM tiers WHERE level = 5');
  assert.deepEqual(checks(world.db), ['tiers_not_five_ascending']);
  world.db.run("INSERT INTO tiers (level, name, min_xp, art_key, updated_at) VALUES (5, 'Stage 5', 10, 'stage-5', ?)", [T0]);
  assert.deepEqual(checks(world.db), ['tiers_not_five_ascending'], 'thresholds must climb');
  world.db.run('UPDATE tiers SET min_xp = 1000 WHERE level = 5');
  assert.equal(checkIntegrity(world.db).ok, true);

  tamper(world.db, ['users_keep_one_admin_on_update'], () => world.db.run("UPDATE users SET status = 'disabled' WHERE role = 'admin'"));
  assert.deepEqual(checks(world.db), ['no_working_admin']);
});

test('violations carry ids and counts only', () => {
  const { world, entry } = busyWorld();
  tamper(world.db, ['ledger_no_delete'], () => world.db.run('DELETE FROM ledger_entries WHERE id = ?', [entry.id]));
  const text = JSON.stringify(checkIntegrity(world.db));
  assert.ok(!text.includes('@') && !text.includes(TEXT) && !text.includes('Ada') && !text.includes('Bo"'));
});

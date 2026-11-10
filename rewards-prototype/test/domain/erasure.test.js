import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeWorld, insertMemberWithUser, insertTaskType, count, expectAppError, T0 } from '../helpers.js';
import { openDatabase } from '../../src/db/sqlite.js';
import { migrate } from '../../src/db/migrate.js';
import { appendTombstone, readTombstones } from '../../src/db/tombstones.js';
import { createContext, withActor } from '../../src/domain/context.js';
import { ensureDefaultTiers } from '../../src/domain/tiers.js';
import { ERASE_CONFIRMATION, eraseMember, eraseOwnAccount, exportMemberData, exportOwnAccount, replayErasures } from '../../src/domain/erasure.js';
import { reviewClaim, submitClaim } from '../../src/domain/claims.js';
import { adjust, balanceOf, reverseEntry } from '../../src/domain/ledger.js';
import { createVideo } from '../../src/domain/videos.js';
import { linkYoutubeChannel } from '../../src/domain/members.js';
import { listAudit } from '../../src/domain/audit.js';
import { checkIntegrity } from '../../src/domain/integrity.js';
import { fixedClock } from '../../src/lib/clock.js';

const SECRET_FEEDBACK = 'ZZ-PRIVATE-FEEDBACK-MARKER the intro runs long and the audio clips at the chorus; trim both and re-export please.';
const ABOUT_ADA = 'ZZ-ABOUT-ADA-MARKER the pacing in the second half of this one is excellent, keep that energy for the next upload.';

/** Ada owns two videos, has an approved claim, a deduction and a reversal; Bo has given feedback on one of Ada's videos. */
function populated(world) {
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const task = insertTaskType(world.db, { key: 'constructive_feedback', label: 'Constructive feedback', requiresVideo: 1 });
  const adasVideo = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoLong001', kind: 'video', title: 'ZZ-ADA-VIDEO-TITLE-MARKER', owner_member_id: ada.memberId });
  const adasOther = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoShort01', kind: 'short', title: 'ZZ-ADA-SECOND-VIDEO-MARKER', owner_member_id: ada.memberId });
  const bosVideo = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoShort02', kind: 'short', title: 'A short by the second member', owner_member_id: bo.memberId });
  linkYoutubeChannel(world.system, { memberId: ada.memberId, channelId: 'UC-demo-01', attestedBy: 'demo_seed' });

  const adasClaim = submitClaim(world.as(ada.actor), { task_type_id: task, video_id: bosVideo.id, evidence_text: SECRET_FEEDBACK });
  const award = reviewClaim(world.admin, adasClaim.id, { outcome: 'approve' }).entry;
  const deduction = adjust(world.admin, { memberId: ada.memberId, points: -5, reason: 'ZZ-REASON-MARKER late correction', idempotencyKey: 'erasure-test-0001' }).entry;
  reverseEntry(world.admin, { entryId: deduction.id, reason: 'ZZ-REASON-MARKER undone' });

  const bosClaim = submitClaim(world.as(bo.actor), { task_type_id: task, video_id: adasVideo.id, evidence_text: ABOUT_ADA });
  const bosAward = reviewClaim(world.admin, bosClaim.id, { outcome: 'approve' }).entry;
  world.db.run("INSERT INTO sessions (token_hash, user_id, auth_method, created_at, expires_at, last_seen_at) VALUES (?, ?, 'dev', ?, ?, ?)", ['c'.repeat(64), ada.userId, T0, '2026-11-16T20:00:00.000Z', T0]);
  return { ada, bo, task, adasVideo, adasOther, bosVideo, adasClaim, award, bosClaim, bosAward };
}

test('export contains everything about the member and nothing about anyone else', () => {
  const world = makeWorld();
  const p = populated(world);
  const data = exportMemberData(world.as(p.ada.actor), p.ada.memberId);
  assert.equal(data.member.display_name, 'Ada');
  assert.equal(data.member.youtube_channel_id, 'UC-demo-01');
  assert.equal(data.account.email, 'ada@example.test');
  assert.equal(data.account.google_sub, undefined);
  assert.equal(data.claims.length, 1);
  assert.equal(data.claims[0].evidence_text, SECRET_FEEDBACK);
  assert.equal(data.ledger_entries.length, 3);
  assert.equal(data.videos.length, 2);
  assert.ok(data.audit_trail.length >= 4);
  const text = JSON.stringify(data);
  assert.ok(!text.includes('bo@example.test') && !text.includes(ABOUT_ADA) && !text.includes('admin@example.test'));
  assert.equal(listAudit(world.admin, { action: 'member.export' }).items.length, 0, 'exporting your own data is not logged as an admin export');

  expectAppError(assert, () => exportMemberData(world.as(p.bo.actor), p.ada.memberId), 'not_yours', 403);
  exportMemberData(world.admin, p.ada.memberId);
  assert.equal(listAudit(world.admin, { action: 'member.export' }).items.length, 1);
  assert.equal(exportOwnAccount(world.admin).account.email, 'admin@example.test');
});

test('ACCEPTANCE: erasing a member really deletes their data and leaves everyone else intact', () => {
  const world = makeWorld();
  const p = populated(world);
  const bosBalance = balanceOf(world.admin, p.bo.memberId);

  expectAppError(assert, () => eraseMember(world.as(p.bo.actor), p.ada.memberId, { confirm: ERASE_CONFIRMATION }), 'not_yours', 403);
  expectAppError(assert, () => eraseMember(world.as(p.ada.actor), p.ada.memberId, { confirm: 'yes' }), 'confirmation_required', 422);
  expectAppError(assert, () => eraseMember(world.as(p.ada.actor), p.ada.memberId, {}), 'confirmation_required', 422);
  assert.equal(count(world.db, 'members'), 2);

  const result = eraseMember(world.as(p.ada.actor), p.ada.memberId, { confirm: ERASE_CONFIRMATION });
  assert.equal(result.erased, true);
  assert.deepEqual(result.counts, { other_claims_blanked: 1, ledger_entries: 3, claims: 1, videos_deleted: 1, videos_anonymised: 1, audit_rows_scrubbed: result.counts.audit_rows_scrubbed, accounts: 1, accounts_kept_as_last_admin: 0 });
  assert.ok(result.counts.audit_rows_scrubbed >= 4);

  for (const [table, where] of [['members', 'id = ?'], ['users', 'member_id = ?'], ['claims', 'member_id = ?'], ['ledger_entries', 'member_id = ?']]) {
    assert.equal(count(world.db, table, where, [p.ada.memberId]), 0, table);
  }
  assert.equal(count(world.db, 'sessions'), 0);
  assert.equal(count(world.db, 'users', 'email = ?', ['ada@example.test']), 0);

  // Nothing identifying survives anywhere in the database.
  const dump = JSON.stringify(Object.fromEntries(['members', 'users', 'sessions', 'videos', 'claims', 'ledger_entries', 'audit_log', 'settings'].map((table) => [table, world.db.all(`SELECT * FROM ${table}`)])));
  for (const marker of ['ZZ-PRIVATE-FEEDBACK-MARKER', 'ZZ-ABOUT-ADA-MARKER', 'ZZ-ADA-VIDEO-TITLE-MARKER', 'ZZ-ADA-SECOND-VIDEO-MARKER', 'ZZ-REASON-MARKER', 'ada@example.test', 'UC-demo-01', 'demoLong001', 'demoShort01', '"Ada"']) {
    assert.ok(!dump.includes(marker), `${marker} survived erasure`);
  }

  // The video another member's claim still points at is an anonymous, archived placeholder.
  const placeholder = world.db.get('SELECT * FROM videos WHERE id = ?', [p.adasVideo.id]);
  assert.equal(placeholder.title, '[removed]');
  assert.equal(placeholder.status, 'archived');
  assert.equal(placeholder.owner_member_id, null);
  assert.equal(count(world.db, 'videos', 'id = ?', [p.adasOther.id]), 0);

  // The other member keeps their credit; their feedback text about the erased member's video is blanked.
  assert.deepEqual(balanceOf(world.admin, p.bo.memberId), bosBalance);
  const bosClaim = world.db.get('SELECT decision, evidence_text, evidence_hash FROM claims WHERE id = ?', [p.bosClaim.id]);
  assert.deepEqual({ ...bosClaim }, { decision: 'approved', evidence_text: null, evidence_hash: null });

  // The erasure itself is on record, without the erased account's id, with counts only.
  const [record] = listAudit(world.admin, { action: 'member.erase' }).items;
  assert.equal(record.actor_role, 'system');
  assert.equal(record.actor_user_id, null);
  assert.equal(record.detail.self_erasure, true);
  assert.equal(record.detail.ledger_entries, 3);
  assert.ok(listAudit(world.admin, { subjectMemberId: p.ada.memberId }).items.filter((row) => row.action !== 'member.erase').every((row) => row.detail === null));

  assert.equal(world.db.get('SELECT member_id FROM erasure_guard').member_id, null);
  assert.deepEqual(checkIntegrity(world.db).violations, []);
  expectAppError(assert, () => eraseMember(world.admin, p.ada.memberId, { confirm: ERASE_CONFIRMATION }), 'member_not_found', 404);
});

test('ledger ids are never reused after an erasure', () => {
  const world = makeWorld();
  const p = populated(world);
  const highest = world.db.get('SELECT MAX(id) AS id FROM ledger_entries').id;
  eraseMember(world.admin, p.bo.memberId, { confirm: ERASE_CONFIRMATION });
  eraseMember(world.admin, p.ada.memberId, { confirm: ERASE_CONFIRMATION });
  assert.equal(count(world.db, 'ledger_entries'), 0);
  const cy = insertMemberWithUser(world.db, 'Cy');
  const next = adjust(world.admin, { memberId: cy.memberId, points: 5, bucket: 'bonus', reason: 'First entry after erasures', idempotencyKey: 'erasure-test-0002' }).entry;
  assert.ok(next.id > highest);
  assert.deepEqual(checkIntegrity(world.db).violations, []);
});

test('the erasure guard cannot be used to delete selectively, and a failed erasure changes nothing', () => {
  const world = makeWorld();
  const p = populated(world);
  const raw = world.db;
  // Outside an erasure nothing can be deleted.
  assert.throws(() => raw.run('DELETE FROM ledger_entries WHERE member_id = ?', [p.ada.memberId]), /append-only/);
  assert.throws(() => raw.run('DELETE FROM claims WHERE member_id = ?', [p.ada.memberId]), /deleted only by member erasure/);
  // Setting the guard, deleting one inconvenient row and clearing the guard is refused at the last step,
  // so the transaction cannot commit that way.
  assert.throws(
    () =>
      raw.tx(() => {
        raw.run('UPDATE erasure_guard SET member_id = ? WHERE id = 1', [p.ada.memberId]);
        // The member's newest entry (nothing refers to it), i.e. "one inconvenient row".
        const victim = raw.get('SELECT MAX(id) AS id FROM ledger_entries WHERE member_id = ?', [p.ada.memberId]).id;
        assert.equal(raw.run('DELETE FROM ledger_entries WHERE id = ?', [victim]).changes, 1);
        raw.run('UPDATE erasure_guard SET member_id = NULL WHERE id = 1');
      }),
    /the member still exists; erasure is all-or-nothing/,
  );
  assert.equal(count(raw, 'ledger_entries', 'member_id = ?', [p.ada.memberId]), 3);
  assert.throws(() => raw.run("UPDATE erasure_guard SET member_id = 'mbr_nobody' WHERE id = 1"), /no such member/);
  assert.throws(() => raw.run('DELETE FROM erasure_guard'), /permanent/);
  assert.throws(() => raw.run('INSERT INTO erasure_guard (id, member_id) VALUES (2, NULL)'), /permanent|CHECK constraint failed/);
  // The guard only opens the named member's rows.
  assert.throws(
    () =>
      raw.tx(() => {
        raw.run('UPDATE erasure_guard SET member_id = ? WHERE id = 1', [p.ada.memberId]);
        raw.run('DELETE FROM ledger_entries WHERE member_id = ?', [p.bo.memberId]);
      }),
    /append-only/,
  );
  assert.equal(raw.get('SELECT member_id FROM erasure_guard').member_id, null);
  assert.deepEqual(checkIntegrity(raw).violations, []);
});

test('the only admin who can sign in keeps the account when their member profile is erased', () => {
  const world = makeWorld();
  const owner = insertMemberWithUser(world.db, 'Owner');
  world.db.run("UPDATE users SET role = 'admin', last_login_at = ? WHERE id = ?", [T0, owner.userId]);
  world.db.run("UPDATE users SET status = 'disabled' WHERE id = ?", [world.adminUserId]); // the standing admin steps away
  const asOwner = world.as({ userId: owner.userId, role: 'admin', memberId: owner.memberId });

  const result = eraseMember(asOwner, owner.memberId, { confirm: ERASE_CONFIRMATION });
  assert.equal(result.counts.accounts, 0);
  assert.equal(result.counts.accounts_kept_as_last_admin, 1);
  assert.equal(count(world.db, 'members', 'id = ?', [owner.memberId]), 0);
  const account = world.db.get('SELECT role, status, member_id FROM users WHERE id = ?', [owner.userId]);
  assert.deepEqual({ ...account }, { role: 'admin', status: 'active', member_id: null });

  // Deleting the last admin ACCOUNT is what stays refused.
  const memberless = world.as({ userId: owner.userId, role: 'admin', memberId: null });
  expectAppError(assert, () => eraseOwnAccount(memberless, { confirm: ERASE_CONFIRMATION }), 'last_admin', 409);
  expectAppError(assert, () => eraseOwnAccount(memberless, {}), 'confirmation_required', 422);
  assert.equal(count(world.db, 'users', 'id = ?', [owner.userId]), 1);
});

test('an admin-only account can erase itself once another admin can sign in', () => {
  const world = makeWorld();
  const second = world.db.get("SELECT id FROM users WHERE role = 'admin'").id;
  world.db.run("INSERT INTO users (id, email, role, created_at, last_login_at) VALUES ('usr_second_admin', 'second@example.test', 'admin', ?, ?)", [T0, T0]);
  assert.deepEqual(eraseOwnAccount(world.admin, { confirm: ERASE_CONFIRMATION }), { erased: true });
  assert.equal(count(world.db, 'users', 'id = ?', [second]), 0);
  const member = insertMemberWithUser(world.db, 'Ada');
  expectAppError(assert, () => eraseOwnAccount(world.as(member.actor), { confirm: ERASE_CONFIRMATION }), 'use_member_erasure', 422);
});

test('ACCEPTANCE: after an erasure the database FILE holds no trace, and a restored backup is erased again', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rewards-erasure-'));
  try {
    const path = join(dir, 'rewards.db');
    const tombstones = join(dir, 'erasure-tombstones.jsonl');
    const clock = fixedClock(T0);
    const open = () => {
      const db = openDatabase(path);
      migrate(db);
      const system = createContext({ db, clock });
      ensureDefaultTiers(system);
      return { db, clock, system };
    };
    let { db, system } = open();
    db.run("INSERT INTO users (id, email, role, created_at, last_login_at) VALUES ('usr_file_admin', 'admin@example.test', 'admin', ?, ?)", [T0, T0]);
    const admin = withActor(system, { userId: 'usr_file_admin', role: 'admin', memberId: null });
    const world = { db, clock, system, admin, adminUserId: 'usr_file_admin', as: (actor) => withActor(system, actor) };
    const p = populated(world);

    // A backup is taken, then the member is erased.
    const backup = join(dir, 'backup.db');
    db.exec(`VACUUM INTO '${backup}'`);
    const result = eraseMember(admin, p.ada.memberId, { confirm: ERASE_CONFIRMATION });
    appendTombstone(tombstones, result.member_id, clock.now().toISOString());
    db.close();

    assert.deepEqual(readdirSync(dir).filter((name) => name.startsWith('rewards.db')).sort(), ['rewards.db'], 'no -wal or -journal file is left behind');
    const bytes = readFileSync(path).toString('latin1');
    for (const marker of ['ZZ-PRIVATE-FEEDBACK-MARKER', 'ZZ-ABOUT-ADA-MARKER', 'ZZ-ADA-VIDEO-TITLE-MARKER', 'ZZ-REASON-MARKER', 'ada@example.test']) {
      assert.ok(!bytes.includes(marker), `${marker} is still readable in the database file`);
    }

    // The old backup is restored over the live file: the erased member is back...
    rmSync(path);
    const restored = openDatabase(backup);
    assert.equal(count(restored, 'members', 'id = ?', [p.ada.memberId]), 1);
    // ...until the boot-time replay of the tombstones erases them again.
    const again = replayErasures(createContext({ db: restored, clock }), readTombstones(tombstones));
    assert.deepEqual(again, [p.ada.memberId]);
    assert.equal(count(restored, 'members', 'id = ?', [p.ada.memberId]), 0);
    assert.deepEqual(replayErasures(createContext({ db: restored, clock }), readTombstones(tombstones)), []);
    assert.deepEqual(checkIntegrity(restored).violations, []);
    restored.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tombstones hold opaque ids only and tolerate a damaged file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rewards-tombstones-'));
  try {
    const path = join(dir, 'nested', 'erasure-tombstones.jsonl');
    assert.deepEqual(readTombstones(path), []);
    appendTombstone(path, 'mbr_0123456789abcdefghjkmnpqrs', T0);
    appendTombstone(path, 'mbr_0123456789abcdefghjkmnpqrs', T0);
    appendTombstone(path, 'mbr_zzzzzzzzzzzzzzzzzzzzzzzzzz', T0);
    assert.throws(() => appendTombstone(path, 'ada@example.test', T0), /not a member id/);
    assert.deepEqual(readTombstones(path), ['mbr_0123456789abcdefghjkmnpqrs', 'mbr_zzzzzzzzzzzzzzzzzzzzzzzzzz']);
    assert.ok(!readFileSync(path, 'utf8').includes('@'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

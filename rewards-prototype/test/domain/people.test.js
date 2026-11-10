import { test } from 'node:test';
// Addresses here must not be anybody's real mailbox. Where the Gmail domain itself is under
// test, the local part is longer than Gmail allows and contains hyphens, so it cannot exist.
import assert from 'node:assert/strict';
import { makeWorld, insertMember, insertMemberWithUser, insertUser, count, expectAppError } from '../helpers.js';
import { createMember, getMember, linkYoutubeChannel, listMembers, unlinkYoutubeChannel, updateMember } from '../../src/domain/members.js';
import { bootstrapAdmins, createUser, deleteUser, findActiveUserByEmail, isGoogleAuthoritative, listUsers, resolveSignIn, updateUser } from '../../src/domain/users.js';
import { listAudit } from '../../src/domain/audit.js';
import { createContext } from '../../src/domain/context.js';
import { openDatabase } from '../../src/db/sqlite.js';
import { migrate } from '../../src/db/migrate.js';

test('members: create, update, archive, and field allow-listing', () => {
  const world = makeWorld();
  const created = createMember(world.admin, { display_name: '  Ada Lovelace ' });
  assert.equal(created.display_name, 'Ada Lovelace');
  assert.equal(created.slug, 'ada-lovelace');
  assert.equal(created.avatar_key, 'placeholder');
  expectAppError(assert, () => createMember(world.admin, { display_name: 'Ada Lovelace' }), 'slug_taken', 409);
  expectAppError(assert, () => createMember(world.admin, { display_name: 'X', youtube_channel_id: 'UCabcdef' }), 'unknown_field', 422);
  expectAppError(assert, () => createMember(world.admin, { display_name: '' }), 'invalid_input', 422);

  const updated = updateMember(world.admin, created.id, { display_name: 'Ada L.', status: 'archived' });
  assert.equal(updated.status, 'archived');
  assert.equal(listMembers(world.admin).length, 0);
  assert.equal(listMembers(world.admin, { includeArchived: true }).length, 1);
  expectAppError(assert, () => updateMember(world.admin, created.id, { id: 'mbr_other' }), 'unknown_field', 422);
  expectAppError(assert, () => updateMember(world.admin, 'mbr_missing', { display_name: 'Nobody' }), 'member_not_found', 404);

  const audit = listAudit(world.admin, { subjectMemberId: created.id }).items;
  assert.deepEqual(audit.map((row) => row.action), ['member.update', 'member.create']);
  assert.ok(!JSON.stringify(audit).includes('Ada'), 'names must not be written to the audit trail');
});

test('members: only admins manage members; a member sees others without their channel id', () => {
  const world = makeWorld();
  const a = insertMemberWithUser(world.db, 'Ada');
  const b = insertMemberWithUser(world.db, 'Bo');
  const asA = world.as(a.actor);
  expectAppError(assert, () => createMember(asA, { display_name: 'Mallory' }), 'admin_only', 403);
  expectAppError(assert, () => updateMember(asA, a.memberId, { display_name: 'Renamed' }), 'admin_only', 403);
  expectAppError(assert, () => listMembers(world.as({ userId: null, role: 'member', memberId: null })), 'not_signed_in', 401);

  linkYoutubeChannel(world.system, { memberId: b.memberId, channelId: 'UC-demo-02', attestedBy: 'demo_seed' });
  assert.equal(getMember(asA, b.memberId).youtube_linked, true);
  assert.equal(getMember(asA, b.memberId).youtube_channel_id, undefined);
  assert.equal(getMember(world.as(b.actor), b.memberId).youtube_channel_id, 'UC-demo-02');
  assert.equal(getMember(world.admin, b.memberId).youtube_channel_id, 'UC-demo-02');
});

test('members: a channel can be linked only by a trusted caller for self, and unlinked by self', () => {
  const world = makeWorld();
  const a = insertMemberWithUser(world.db, 'Ada');
  const b = insertMemberWithUser(world.db, 'Bo');
  expectAppError(assert, () => linkYoutubeChannel(world.as(a.actor), { memberId: b.memberId, channelId: 'UC-demo-09', attestedBy: 'oauth' }), 'not_yours', 403);
  assert.throws(() => linkYoutubeChannel(world.as(a.actor), { memberId: a.memberId, channelId: 'UC-demo-01', attestedBy: 'typed' }), /attestedBy/);
  assert.throws(() => linkYoutubeChannel(world.as(a.actor), { memberId: a.memberId, channelId: 'not a channel', attestedBy: 'oauth' }), /not a channel id/);

  linkYoutubeChannel(world.as(a.actor), { memberId: a.memberId, channelId: 'UC-demo-01', attestedBy: 'oauth' });
  expectAppError(assert, () => unlinkYoutubeChannel(world.as(b.actor), a.memberId), 'not_yours', 403);
  const after = unlinkYoutubeChannel(world.as(a.actor), a.memberId);
  assert.equal(after.youtube_linked, false);
  assert.equal(world.db.get('SELECT youtube_channel_id, youtube_linked_at FROM members WHERE id = ?', [a.memberId]).youtube_linked_at, null);
});

test('users: allowlist management, uniqueness and the member requirement', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db, { name: 'Ada' });
  const user = createUser(world.admin, { email: '  Ada.not-a-real-mailbox-for-tests-only@Gmail.com ', role: 'member', member_id: memberId });
  assert.equal(user.email, 'ada.not-a-real-mailbox-for-tests-only@gmail.com');
  assert.equal(user.signed_in_before, false);
  expectAppError(assert, () => createUser(world.admin, { email: 'ada.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin' }), 'email_taken', 409);
  expectAppError(assert, () => createUser(world.admin, { email: 'other.not-a-real-mailbox-for-tests-only@gmail.com', role: 'member', member_id: memberId }), 'member_already_linked', 409);
  expectAppError(assert, () => createUser(world.admin, { email: 'solo.not-a-real-mailbox-for-tests-only@gmail.com', role: 'member' }), 'member_required', 409);
  expectAppError(assert, () => createUser(world.admin, { email: 'ghost.not-a-real-mailbox-for-tests-only@gmail.com', role: 'member', member_id: 'mbr_missing' }), 'member_not_found', 404);
  expectAppError(assert, () => createUser(world.admin, { email: 'not-an-email', role: 'admin' }), 'invalid_input', 422);
  expectAppError(assert, () => createUser(world.admin, { email: 'x.not-a-real-mailbox-for-tests-only@gmail.com', role: 'owner' }), 'invalid_input', 422);
  expectAppError(assert, () => createUser(world.admin, { email: 'x.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin', google_sub: 'attacker' }), 'unknown_field', 422);
  assert.equal(listUsers(world.admin).length, 2);
  const audit = JSON.stringify(listAudit(world.admin).items);
  assert.ok(!audit.includes('gmail.com'), 'e-mail addresses must not be written to the audit trail');
});

test('users: the last admin who can sign in cannot be demoted, disabled or deleted', () => {
  const world = makeWorld();
  // A second admin exists on the allowlist but has never signed in: it does not count.
  const second = createUser(world.admin, { email: 'second.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin' });
  const asSecond = world.as({ userId: second.id, role: 'admin', memberId: null });
  const memberId = insertMember(world.db);
  expectAppError(assert, () => updateUser(asSecond, world.adminUserId, { status: 'disabled' }), 'last_admin', 409);
  expectAppError(assert, () => updateUser(asSecond, world.adminUserId, { role: 'member', member_id: memberId }), 'last_admin', 409);
  expectAppError(assert, () => deleteUser(asSecond, world.adminUserId), 'last_admin', 409);
  expectAppError(assert, () => deleteUser(world.admin, world.adminUserId), 'last_admin', 409);

  // The schema refuses too, if application checks are ever bypassed.
  assert.throws(() => world.db.run("UPDATE users SET status = 'disabled' WHERE id = ?", [world.adminUserId]), /at least one active, signed-in admin must remain/);
  assert.throws(() => world.db.run('DELETE FROM users WHERE id = ?', [world.adminUserId]), /at least one active, signed-in admin must remain/);

  // Once the second admin has signed in, the first can be disabled — and then the second is the last.
  resolveSignIn(world.system, { sub: 'second-sub', email: 'second.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true });
  assert.equal(updateUser(asSecond, world.adminUserId, { status: 'disabled' }).status, 'disabled');
  expectAppError(assert, () => deleteUser(world.admin, second.id), 'last_admin', 409);
  // A never-used admin row (for example a mistyped address) can always be removed.
  const typo = createUser(asSecond, { email: 'typo.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin' });
  assert.deepEqual(deleteUser(asSecond, typo.id), { deleted: true });
});

test('users: an admin cannot change their own role, status or member link', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db);
  for (const patch of [{ status: 'disabled' }, { role: 'member', member_id: memberId }, { member_id: memberId }, { member_id: null }]) {
    expectAppError(assert, () => updateUser(world.admin, world.adminUserId, patch), 'cannot_edit_self', 403);
  }
});

test('users: changing role or status signs the account out everywhere', () => {
  const world = makeWorld();
  const a = insertMemberWithUser(world.db, 'Ada');
  world.db.run("INSERT INTO sessions (token_hash, user_id, auth_method, created_at, expires_at, last_seen_at) VALUES (?, ?, 'dev', ?, ?, ?)", ['a'.repeat(64), a.userId, '2026-11-09T00:00:00.000Z', '2026-11-16T00:00:00.000Z', '2026-11-09T00:00:00.000Z']);
  updateUser(world.admin, a.userId, { status: 'active' }); // no change: session survives
  assert.equal(count(world.db, 'sessions'), 1);
  updateUser(world.admin, a.userId, { status: 'disabled' });
  assert.equal(count(world.db, 'sessions'), 0);
  assert.equal(findActiveUserByEmail(world.system, 'ada@example.test'), null);
});

test('sign-in: an allowlisted Gmail address binds on first sign-in, then only the Google id matters', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db, { name: 'Ada' });
  createUser(world.admin, { email: 'ada.not-a-real-mailbox-for-tests-only@gmail.com', role: 'member', member_id: memberId });

  const first = resolveSignIn(world.system, { sub: 'google-sub-1', email: 'Ada.not-a-real-mailbox-for-tests-only@Gmail.com', emailVerified: true });
  assert.equal(first.firstSignIn, true);
  assert.equal(first.user.member_id, memberId);

  // The e-mail later changes at Google: the same person still signs in.
  const again = resolveSignIn(world.system, { sub: 'google-sub-1', email: 'renamed.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true });
  assert.equal(again.firstSignIn, false);
  assert.equal(again.user.id, first.user.id);

  // A different Google account presenting the same e-mail cannot take the account over.
  assert.equal(resolveSignIn(world.system, { sub: 'google-sub-2', email: 'ada.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true }), null);
  assert.equal(world.db.get('SELECT google_sub FROM users WHERE id = ?', [first.user.id]).google_sub, 'google-sub-1');
});

test('sign-in: denied for unknown people, unverified or non-authoritative e-mail, and disabled accounts', () => {
  const world = makeWorld();
  createUser(world.admin, { email: 'pat@workspace.example.test', role: 'admin' });
  createUser(world.admin, { email: 'sam.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin' });

  assert.equal(resolveSignIn(world.system, { sub: 's1', email: 'stranger.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true }), null);
  assert.equal(resolveSignIn(world.system, { sub: 's2', email: 'sam.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: false }), null);
  // Not a Gmail address and no Workspace domain claim: Google is not the authority for it.
  assert.equal(resolveSignIn(world.system, { sub: 's3', email: 'pat@workspace.example.test', emailVerified: true }), null);
  assert.equal(resolveSignIn(world.system, { sub: 's3', email: 'pat@workspace.example.test', emailVerified: true, hostedDomain: 'evil.example' }), null);
  assert.ok(resolveSignIn(world.system, { sub: 's3', email: 'pat@workspace.example.test', emailVerified: true, hostedDomain: 'workspace.example.test' }));
  assert.equal(resolveSignIn(world.system, { sub: '', email: 'sam.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true }), null);
  assert.equal(resolveSignIn(world.system, { email: 'sam.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true }), null);

  const sam = resolveSignIn(world.system, { sub: 's4', email: 'sam.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true });
  updateUser(world.admin, sam.user.id, { status: 'disabled' });
  assert.equal(resolveSignIn(world.system, { sub: 's4', email: 'sam.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: true }), null);

  assert.equal(isGoogleAuthoritative({ email: 'a.not-a-real-mailbox-for-tests-only@googlemail.com', emailVerified: true }), true);
  assert.equal(isGoogleAuthoritative({ email: 'a.not-a-real-mailbox-for-tests-only@gmail.com.evil.test', emailVerified: true }), false);
  assert.equal(isGoogleAuthoritative({ email: 'a.not-a-real-mailbox-for-tests-only@gmail.com', emailVerified: 'true' }), false);
});

test('bootstrapAdmins only acts on a database with no admin at all', () => {
  // An admin already exists: the configured list is ignored, so the environment can
  // never re-create an erased person or restore a demoted one.
  const world = makeWorld();
  assert.equal(bootstrapAdmins(world.system, ['owner.not-a-real-mailbox-for-tests-only@gmail.com']), 0);
  assert.equal(listUsers(world.admin).length, 1);

  // A brand-new, empty database, as on first start.
  const db = openDatabase(':memory:');
  migrate(db);
  const system = createContext({ db, clock: world.clock });
  assert.equal(bootstrapAdmins(system, ['Owner.not-a-real-mailbox-for-tests-only@Gmail.com', 'owner.not-a-real-mailbox-for-tests-only@gmail.com', 'second.not-a-real-mailbox-for-tests-only@gmail.com']), 2);
  assert.equal(bootstrapAdmins(system, ['third.not-a-real-mailbox-for-tests-only@gmail.com']), 0);
  assert.deepEqual(db.all('SELECT email, role, google_sub FROM users ORDER BY email').map((row) => ({ ...row })), [
    { email: 'owner.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin', google_sub: null },
    { email: 'second.not-a-real-mailbox-for-tests-only@gmail.com', role: 'admin', google_sub: null },
  ]);

  const empty = openDatabase(':memory:');
  migrate(empty);
  assert.throws(() => bootstrapAdmins(createContext({ db: empty, clock: world.clock }), ['not-an-address']), (error) => error.status === 422);
  assert.equal(empty.get('SELECT COUNT(*) AS n FROM users').n, 0);
});

test('insertUser helper sanity: member accounts need a member (schema CHECK)', () => {
  const world = makeWorld();
  assert.throws(() => insertUser(world.db, { email: 'loose@example.test', role: 'member' }), /CHECK constraint failed/);
});

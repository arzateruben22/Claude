import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T0, makeWorld, insertMember, insertMemberWithUser, insertUser, count, expectAppError } from '../helpers.js';
import { randomToken, sha256Hex } from '../../src/lib/ids.js';
import { deleteUser, getActiveUser, resolveSignIn, updateUser } from '../../src/domain/users.js';
import {
  AUTH_METHODS,
  MAX_SESSION_TTL_HOURS,
  createSession,
  destroySession,
  destroySessionsForUser,
  purgeExpiredSessions,
  purgeSessionsByMethod,
  resolveSession,
} from '../../src/auth/sessions.js';

const DEV = { authMode: 'dev' };
const GOOGLE = { authMode: 'google' };
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const start = (world, userId, { authMethod = 'dev', ttlHours = 168 } = {}) => createSession(world.system, { userId, authMethod, ttlHours });
const rows = (world) => world.db.all('SELECT * FROM sessions ORDER BY created_at, token_hash');
/** Rows changed on this connection so far: lets a test prove that a read wrote nothing. */
const writes = (world) => world.db.get('SELECT total_changes() AS n').n;

/** A session row written directly, for states createSession() refuses to create. */
function insertRawSession(world, { userId, authMethod = 'dev', createdAt = T0, expiresAt = '2026-11-16T20:00:00.000Z' }) {
  const token = randomToken(32);
  world.db.run('INSERT INTO sessions (token_hash, user_id, auth_method, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)', [
    sha256Hex(token),
    userId,
    authMethod,
    createdAt,
    expiresAt,
    createdAt,
  ]);
  return token;
}

test('a session round-trips: create, then resolve to the account and the session facts', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const created = start(world, ada.userId);
  assert.match(created.token, TOKEN_SHAPE, '32 random bytes, base64url');
  assert.equal(created.expiresAt, '2026-11-16T20:00:00.000Z');
  assert.equal(created.maxAgeSeconds, 168 * 3600);
  assert.deepEqual(Object.keys(created).sort(), ['expiresAt', 'maxAgeSeconds', 'token']);

  const resolved = resolveSession(world.system, created.token, DEV);
  assert.deepEqual(resolved.user, getActiveUser(world.system, ada.userId));
  assert.equal(resolved.user.id, ada.userId);
  assert.equal(resolved.user.member_id, ada.memberId);
  assert.equal(resolved.user.role, 'member');
  assert.deepEqual(resolved.session, { authMethod: 'dev', createdAt: T0, expiresAt: '2026-11-16T20:00:00.000Z', lastSeenAt: T0 });

  // Every sign-in gets its own token, and each resolves to its own account.
  const again = start(world, ada.userId);
  const admin = start(world, world.adminUserId);
  assert.equal(new Set([created.token, again.token, admin.token]).size, 3);
  assert.equal(resolveSession(world.system, again.token, DEV).user.id, ada.userId);
  assert.equal(resolveSession(world.system, admin.token, DEV).user.role, 'admin');
  assert.equal(count(world.db, 'sessions'), 3);
});

test('only the SHA-256 of the token is stored', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const { token } = start(world, ada.userId);
  const [row] = rows(world);
  assert.equal(row.token_hash, sha256Hex(token));
  assert.match(row.token_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(row).sort(), ['auth_method', 'created_at', 'expires_at', 'last_seen_at', 'token_hash', 'user_id']);
  assert.ok(!JSON.stringify(rows(world)).includes(token), 'the raw token must not be in the table');
  assert.ok(!JSON.stringify(world.db.all('SELECT * FROM audit_log')).includes(token));

  // The stored hash is not itself a credential.
  assert.equal(resolveSession(world.system, row.token_hash, DEV), null);
  assert.equal(destroySession(world.system, row.token_hash), false);
  assert.equal(count(world.db, 'sessions'), 1);
});

test('a session is valid strictly before its expiry instant, and an expired row found on lookup is deleted', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const { token, expiresAt } = start(world, ada.userId, { ttlHours: 1 });
  assert.equal(expiresAt, '2026-11-09T21:00:00.000Z');

  world.clock.set('2026-11-09T20:59:59.999Z');
  assert.equal(resolveSession(world.system, token, DEV).user.id, ada.userId);
  assert.equal(count(world.db, 'sessions'), 1);

  world.clock.set('2026-11-09T21:00:00.000Z');
  assert.equal(resolveSession(world.system, token, DEV), null);
  assert.equal(count(world.db, 'sessions'), 0, 'the expired row is removed when it is looked up');

  // Turning the clock back does not bring it back.
  world.clock.set(T0);
  assert.equal(resolveSession(world.system, token, DEV), null);
});

test('expiry uses the application clock and ISO text, also across a year boundary', () => {
  const world = makeWorld({ at: '2026-12-31T23:30:00.000Z' });
  const ada = insertMemberWithUser(world.db, 'Ada');
  const { token, expiresAt } = start(world, ada.userId, { ttlHours: MAX_SESSION_TTL_HOURS });
  assert.equal(expiresAt, '2027-01-30T23:30:00.000Z');
  world.clock.set('2027-01-30T23:29:59.999Z');
  assert.ok(resolveSession(world.system, token, DEV));
  world.clock.advance(1);
  assert.equal(resolveSession(world.system, token, DEV), null);
});

test('a session is honoured only in the sign-in mode that created it', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const dev = start(world, ada.userId, { authMethod: 'dev' });
  const google = start(world, ada.userId, { authMethod: 'google' });

  assert.equal(resolveSession(world.system, dev.token, GOOGLE), null, 'a dev session must never work under Google sign-in');
  assert.equal(resolveSession(world.system, google.token, DEV), null);
  assert.equal(resolveSession(world.system, dev.token, DEV).session.authMethod, 'dev');
  assert.equal(resolveSession(world.system, google.token, GOOGLE).session.authMethod, 'google');

  // A missing or misspelt mode is a wiring mistake, and must be loud rather than match anything.
  assert.deepEqual(AUTH_METHODS, ['google', 'dev']);
  for (const options of [undefined, {}, { authMode: 'Google' }, { authMode: '' }, { authMode: null }]) {
    assert.throws(() => resolveSession(world.system, dev.token, options), /auth method must be/);
  }
  assert.throws(() => createSession(world.system, { userId: ada.userId, authMethod: 'password', ttlHours: 1 }), /auth method must be/);
  assert.equal(count(world.db, 'sessions'), 2);
});

test('a disabled or deleted account has no usable session', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const adaSession = start(world, ada.userId);
  const boSession = start(world, bo.userId);

  updateUser(world.admin, ada.userId, { status: 'disabled' });
  assert.equal(resolveSession(world.system, adaSession.token, DEV), null);
  assert.equal(resolveSession(world.system, boSession.token, DEV).user.id, bo.userId);

  // No session can be started for an account that is disabled or does not exist…
  expectAppError(assert, () => start(world, ada.userId), 'not_signed_in', 401);
  expectAppError(assert, () => start(world, 'usr_doesnotexist'), 'not_signed_in', 401);
  assert.equal(count(world.db, 'sessions', 'user_id = ?', [ada.userId]), 0);

  // …and even a row that exists for a disabled account is not honoured.
  const smuggled = insertRawSession(world, { userId: ada.userId });
  assert.equal(count(world.db, 'sessions', 'user_id = ?', [ada.userId]), 1);
  assert.equal(resolveSession(world.system, smuggled, DEV), null);

  deleteUser(world.admin, bo.userId);
  assert.equal(resolveSession(world.system, boSession.token, DEV), null);
  assert.equal(count(world.db, 'sessions', 'user_id = ?', [bo.userId]), 0, 'sessions go with the account');
});

test("changing role, status or member link ends that account's sessions at once (schema trigger)", () => {
  const world = makeWorld();
  assert.equal(world.db.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name = 'sessions_end_on_privilege_change'").n, 1);
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const boSession = start(world, bo.userId);
  const adaSessions = () => count(world.db, 'sessions', 'user_id = ?', [ada.userId]);

  // Raw SQL on purpose: nothing but the database itself can have removed the rows.
  let first = start(world, ada.userId);
  let second = start(world, ada.userId, { authMethod: 'google' });
  world.db.run("UPDATE users SET role = 'admin' WHERE id = ?", [ada.userId]);
  assert.equal(adaSessions(), 0, 'role change');
  assert.equal(resolveSession(world.system, first.token, DEV), null);
  assert.equal(resolveSession(world.system, second.token, GOOGLE), null);

  first = start(world, ada.userId);
  world.db.run('UPDATE users SET member_id = NULL WHERE id = ?', [ada.userId]);
  assert.equal(adaSessions(), 0, 'member link change');
  assert.equal(resolveSession(world.system, first.token, DEV), null);

  first = start(world, ada.userId);
  world.db.run("UPDATE users SET status = 'disabled' WHERE id = ?", [ada.userId]);
  assert.equal(adaSessions(), 0, 'status change');
  world.db.run("UPDATE users SET status = 'active' WHERE id = ?", [ada.userId]);
  assert.equal(resolveSession(world.system, first.token, DEV), null, 're-enabling an account does not revive its old sessions');

  // Updates that change nothing about what the account may do leave sessions alone.
  second = start(world, ada.userId);
  world.db.run("UPDATE users SET last_login_at = ?, role = 'admin', status = 'active' WHERE id = ?", [T0, ada.userId]);
  assert.equal(adaSessions(), 1);
  assert.equal(resolveSession(world.system, second.token, DEV).user.role, 'admin');

  // The same rule through the domain layer, for a demotion.
  updateUser(world.admin, ada.userId, { role: 'member', member_id: ada.memberId });
  assert.equal(adaSessions(), 0);
  assert.equal(resolveSession(world.system, second.token, DEV), null);

  // Nobody else was signed out along the way.
  assert.equal(resolveSession(world.system, boSession.token, DEV).user.id, bo.userId);
});

test('the first Google sign-in keeps the session that follows it; a changed Google identity would not', () => {
  const world = makeWorld();
  const memberId = insertMember(world.db, { name: 'Ada' });
  const userId = insertUser(world.db, { email: 'ada@example.test', role: 'member', memberId });
  // Binding the Google identity for the first time is not a privilege change.
  const dev = start(world, userId);
  const signedIn = resolveSignIn(world.system, { sub: 'google-sub-ada', email: 'ada@example.test', emailVerified: true, hostedDomain: 'example.test' });
  assert.equal(signedIn.firstSignIn, true);
  assert.equal(count(world.db, 'sessions', 'user_id = ?', [userId]), 1);
  const session = start(world, signedIn.user.id, { authMethod: 'google' });
  assert.equal(resolveSession(world.system, session.token, GOOGLE).user.signed_in_before, true);
  assert.ok(resolveSession(world.system, dev.token, DEV));

  // Detaching the Google identity changes who the account is: everything is signed out.
  world.db.run('UPDATE users SET google_sub = NULL WHERE id = ?', [userId]);
  assert.equal(count(world.db, 'sessions', 'user_id = ?', [userId]), 0);
  assert.equal(resolveSession(world.system, session.token, GOOGLE), null);
});

test('destroySession ends exactly one session; destroySessionsForUser signs an account out everywhere', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const phone = start(world, ada.userId);
  const laptop = start(world, ada.userId);
  const tablet = start(world, ada.userId);
  const other = start(world, bo.userId);

  assert.equal(destroySession(world.system, phone.token), true);
  assert.equal(destroySession(world.system, phone.token), false, 'already gone');
  assert.equal(resolveSession(world.system, phone.token, DEV), null);
  assert.ok(resolveSession(world.system, laptop.token, DEV));

  assert.equal(destroySessionsForUser(world.system, ada.userId), 2);
  assert.equal(destroySessionsForUser(world.system, ada.userId), 0);
  assert.equal(resolveSession(world.system, laptop.token, DEV), null);
  assert.equal(resolveSession(world.system, tablet.token, DEV), null);
  assert.equal(resolveSession(world.system, other.token, DEV).user.id, bo.userId);
  assert.equal(count(world.db, 'sessions'), 1);
});

test('purgeExpiredSessions removes what has expired (boundary included) and nothing else', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const oneHour = start(world, ada.userId, { ttlHours: 1 });
  const twoHours = start(world, ada.userId, { ttlHours: 2 });
  const week = start(world, ada.userId, { ttlHours: 168 });

  assert.equal(purgeExpiredSessions(world.system), 0);
  world.clock.set('2026-11-09T20:59:59.999Z');
  assert.equal(purgeExpiredSessions(world.system), 0);
  world.clock.set('2026-11-09T21:00:00.000Z');
  assert.equal(purgeExpiredSessions(world.system), 1, 'expired exactly now');
  assert.equal(resolveSession(world.system, oneHour.token, DEV), null);
  assert.ok(resolveSession(world.system, twoHours.token, DEV));

  world.clock.set('2026-11-10T09:00:00.000Z');
  assert.equal(purgeExpiredSessions(world.system), 1);
  assert.equal(purgeExpiredSessions(world.system), 0);
  assert.equal(count(world.db, 'sessions'), 1);
  assert.ok(resolveSession(world.system, week.token, DEV));
});

test('purgeSessionsByMethod removes every session of one sign-in method', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  start(world, ada.userId, { authMethod: 'dev' });
  start(world, bo.userId, { authMethod: 'dev' });
  const real = start(world, ada.userId, { authMethod: 'google' });

  assert.equal(purgeSessionsByMethod(world.system, 'dev'), 2);
  assert.equal(purgeSessionsByMethod(world.system, 'dev'), 0);
  assert.deepEqual(rows(world).map((row) => row.auth_method), ['google']);
  assert.ok(resolveSession(world.system, real.token, GOOGLE));
  assert.throws(() => purgeSessionsByMethod(world.system, 'all'), /auth method must be/);
  assert.throws(() => purgeSessionsByMethod(world.system), /auth method must be/);
  assert.equal(count(world.db, 'sessions'), 1);
});

test('last_seen_at is refreshed at most once every five minutes, so reads do not write', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const { token } = start(world, ada.userId);
  const stored = () => world.db.get('SELECT last_seen_at FROM sessions').last_seen_at;
  assert.equal(stored(), T0);

  let before = writes(world);
  for (const elapsed of [0, 1, 60_000, 4 * 60_000 + 59_998]) {
    world.clock.set(new Date(Date.parse(T0) + elapsed));
    assert.equal(resolveSession(world.system, token, DEV).session.lastSeenAt, T0);
  }
  assert.equal(writes(world), before, 'no write inside the five minutes');
  assert.equal(stored(), T0);

  world.clock.set('2026-11-09T20:04:59.999Z');
  assert.equal(resolveSession(world.system, token, DEV).session.lastSeenAt, T0);
  assert.equal(writes(world), before);

  world.clock.set('2026-11-09T20:05:00.000Z');
  assert.equal(resolveSession(world.system, token, DEV).session.lastSeenAt, '2026-11-09T20:05:00.000Z');
  assert.equal(stored(), '2026-11-09T20:05:00.000Z');
  assert.equal(writes(world), before + 1, 'exactly one row written');

  before = writes(world);
  world.clock.set('2026-11-09T20:09:59.999Z');
  assert.equal(resolveSession(world.system, token, DEV).session.lastSeenAt, '2026-11-09T20:05:00.000Z');
  assert.equal(writes(world), before);
  world.clock.set('2026-11-09T23:00:00.000Z');
  assert.equal(resolveSession(world.system, token, DEV).session.lastSeenAt, '2026-11-09T23:00:00.000Z');
  assert.equal(writes(world), before + 1);

  // Using a session never extends it.
  assert.equal(world.db.get('SELECT expires_at FROM sessions').expires_at, '2026-11-16T20:00:00.000Z');
});

test('anything that is not one of our tokens resolves to null, and is never even looked up', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const { token } = start(world, ada.userId);
  const before = writes(world);
  const malformed = [
    undefined,
    null,
    '',
    'x',
    42,
    true,
    {},
    [token],
    token.slice(0, -1),
    `${token}A`,
    ` ${token}`,
    `${token}\n`,
    token.replace(/.$/, '='),
    randomToken(64),
    sha256Hex(token),
    "' OR '1'='1",
    'A'.repeat(100_000),
  ];
  // A context whose database refuses to be used: a value that cannot be one of our tokens
  // must be turned away before any hashing or lookup is spent on it.
  const untouchable = {
    ...world.system,
    db: new Proxy(world.db, {
      get() {
        throw new assert.AssertionError({ message: 'the database must not be consulted for a value that is not a token' });
      },
    }),
  };
  for (const value of malformed) {
    assert.equal(resolveSession(untouchable, value, DEV), null);
    assert.equal(destroySession(untouchable, value), false);
  }

  // A well-formed token that was never issued is looked up, and is simply not there.
  const neverIssued = randomToken(32);
  assert.equal(resolveSession(world.system, neverIssued, DEV), null);
  assert.equal(destroySession(world.system, neverIssued), false);

  assert.equal(writes(world), before);
  assert.equal(count(world.db, 'sessions'), 1);
  assert.ok(resolveSession(world.system, token, DEV));
});

test('the lifetime is a whole number of hours from 1 to 720', () => {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  assert.equal(MAX_SESSION_TTL_HOURS, 720);
  for (const ttlHours of [0, -1, 721, 1.5, '168', null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createSession(world.system, { userId: ada.userId, authMethod: 'dev', ttlHours }), /ttlHours must be a whole number from 1 to 720/);
  }
  assert.equal(count(world.db, 'sessions'), 0);
  assert.equal(start(world, ada.userId, { ttlHours: 1 }).maxAgeSeconds, 3600);
  assert.equal(start(world, ada.userId, { ttlHours: 720 }).expiresAt, '2026-12-09T20:00:00.000Z');
});

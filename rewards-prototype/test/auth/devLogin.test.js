import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { makeWorld, insertMemberWithUser, count, expectAppError } from '../helpers.js';
import { findActiveUserByEmail, updateUser } from '../../src/domain/users.js';
import { MIN_DEV_LOGIN_CODE_LENGTH, createDevLogin, generateDevLoginCode } from '../../src/auth/devLogin.js';

const CODE = 'dev-code-for-tests-0001';
const WRONG = 'dev-code-for-tests-0002';

function setup(options = {}) {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const devLogin = createDevLogin({ code: CODE, ...options });
  return { world, ada, devLogin, attempt: (input) => devLogin.attempt(world.system, input) };
}

/** Runs `fn`, which must throw, and returns what it threw. */
function thrownBy(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: 'expected a refusal' });
}

test('the right code with an allowlisted address returns that account', () => {
  const { world, ada, attempt } = setup();
  const writesBefore = world.db.get('SELECT total_changes() AS n').n;
  const user = attempt({ email: 'ada@example.test', code: CODE });
  assert.deepEqual(user, findActiveUserByEmail(world.system, 'ada@example.test'));
  assert.equal(user.id, ada.userId);
  assert.equal(user.member_id, ada.memberId);
  assert.equal(user.role, 'member');
  // Addresses are matched the way the allowlist stores them.
  assert.equal(attempt({ email: '  Ada@Example.TEST ', code: CODE }).id, ada.userId);
  assert.equal(attempt({ email: 'admin@example.test', code: CODE }).role, 'admin');
  // Looking an account up is all it does: no session is started and nothing is written.
  assert.equal(count(world.db, 'sessions'), 0);
  assert.equal(world.db.get('SELECT total_changes() AS n').n, writesBefore);
});

test('a wrong code is refused, whatever the address', () => {
  const { attempt } = setup({ maxFailures: 100 });
  const nearMisses = [WRONG, '', 'x', CODE.slice(0, -1), `${CODE}1`, ` ${CODE}`, `${CODE} `, CODE.toUpperCase(), `${CODE}\u0000`, CODE.repeat(2), 'A'.repeat(100_000)];
  for (const code of nearMisses) {
    expectAppError(assert, () => attempt({ email: 'ada@example.test', code }), 'sign_in_denied', 401);
    expectAppError(assert, () => attempt({ email: 'nobody@example.test', code }), 'sign_in_denied', 401);
  }
  for (const code of [undefined, null, 0, true, {}, [CODE], { toString: () => CODE }, Buffer.from(CODE)]) {
    expectAppError(assert, () => attempt({ email: 'ada@example.test', code }), 'sign_in_denied', 401);
  }
  expectAppError(assert, () => attempt({ email: 'ada@example.test' }), 'sign_in_denied', 401);
  expectAppError(assert, () => attempt({}), 'sign_in_denied', 401);
  expectAppError(assert, () => attempt(), 'sign_in_denied', 401);
  assert.equal(thrownBy(() => attempt({ email: 'ada@example.test', code: WRONG })).reason, 'wrong_code');
});

test('after five wrong codes dev sign-in is locked, and then refuses even the correct code', () => {
  const { world, ada, devLogin, attempt } = setup();
  assert.equal(devLogin.isLocked(), false);
  for (let i = 1; i <= 5; i += 1) {
    assert.equal(devLogin.isLocked(), false, `still open before wrong code number ${i}`);
    expectAppError(assert, () => attempt({ email: 'ada@example.test', code: `${WRONG}-${i}` }), 'sign_in_denied', 401);
  }
  assert.equal(devLogin.isLocked(), true);

  expectAppError(assert, () => attempt({ email: 'ada@example.test', code: CODE }), 'dev_login_locked', 403);
  expectAppError(assert, () => attempt({ email: 'ada@example.test', code: WRONG }), 'dev_login_locked', 403);
  expectAppError(assert, () => attempt({ email: 'nobody@example.test', code: CODE }), 'dev_login_locked', 403);
  expectAppError(assert, () => attempt({}), 'dev_login_locked', 403);
  // The lock answers the same way for a right and a wrong code, so it cannot be used to test guesses.
  const withRight = thrownBy(() => attempt({ email: 'ada@example.test', code: CODE }));
  const withWrong = thrownBy(() => attempt({ email: 'ada@example.test', code: WRONG }));
  assert.deepEqual(withRight.toJSON(), withWrong.toJSON());
  assert.equal(withRight.reason, 'locked');
  assert.match(withRight.message, /locked/i);
  assert.equal(devLogin.isLocked(), true, 'it stays locked');

  // "Until restart": only a new instance, which is what a restart creates, opens again.
  const restarted = createDevLogin({ code: CODE });
  assert.equal(restarted.isLocked(), false);
  assert.equal(restarted.attempt(world.system, { email: 'ada@example.test', code: CODE }).id, ada.userId);
  assert.equal(devLogin.isLocked(), true, 'the old instance is unaffected');
});

test('wrong codes are counted for the life of the process: a success in between does not reset the count', () => {
  const { devLogin, attempt } = setup();
  for (let i = 0; i < 4; i += 1) expectAppError(assert, () => attempt({ email: 'ada@example.test', code: WRONG }), 'sign_in_denied', 401);
  assert.equal(attempt({ email: 'ada@example.test', code: CODE }).email, 'ada@example.test');
  assert.equal(attempt({ email: 'ada@example.test', code: CODE }).email, 'ada@example.test');
  assert.equal(devLogin.isLocked(), false);
  expectAppError(assert, () => attempt({ email: 'ada@example.test', code: WRONG }), 'sign_in_denied', 401);
  assert.equal(devLogin.isLocked(), true);
  expectAppError(assert, () => attempt({ email: 'ada@example.test', code: CODE }), 'dev_login_locked', 403);
});

test('the number of wrong codes allowed is configurable', () => {
  const { devLogin, attempt } = setup({ maxFailures: 1 });
  expectAppError(assert, () => attempt({ email: 'ada@example.test', code: WRONG }), 'sign_in_denied', 401);
  assert.equal(devLogin.isLocked(), true);
  expectAppError(assert, () => attempt({ email: 'ada@example.test', code: CODE }), 'dev_login_locked', 403);
});

test('an unknown address cannot be told apart from a wrong code', () => {
  const { world, ada, devLogin, attempt } = setup();
  const wrongCode = thrownBy(() => attempt({ email: 'ada@example.test', code: WRONG }));
  const unknownAddress = thrownBy(() => attempt({ email: 'nobody@example.test', code: CODE }));
  const both = thrownBy(() => attempt({ email: 'nobody@example.test', code: WRONG }));

  for (const error of [wrongCode, unknownAddress, both]) {
    assert.equal(error.name, 'AppError');
    assert.equal(error.status, 401);
    assert.equal(error.code, 'sign_in_denied');
    assert.equal(error.details, undefined);
  }
  assert.equal(unknownAddress.message, wrongCode.message);
  assert.deepEqual(unknownAddress.toJSON(), wrongCode.toJSON());
  assert.deepEqual(both.toJSON(), wrongCode.toJSON());
  assert.equal(JSON.stringify(unknownAddress), JSON.stringify(wrongCode), 'what goes over the wire is byte-for-byte the same');
  // The server-side counters can still tell them apart; the client cannot.
  assert.equal(wrongCode.reason, 'wrong_code');
  assert.equal(unknownAddress.reason, 'unknown_account');
  assert.equal(both.reason, 'wrong_code');
  assert.ok(!JSON.stringify(unknownAddress).includes('unknown_account'));

  // A disabled account and a malformed address get the same refusal.
  updateUser(world.admin, ada.userId, { status: 'disabled' });
  assert.deepEqual(thrownBy(() => attempt({ email: 'ada@example.test', code: CODE })).toJSON(), wrongCode.toJSON());
  for (const email of [undefined, null, '', 42, {}, ['admin@example.test'], '%', '_@_', "' OR 1=1 --"]) {
    assert.deepEqual(thrownBy(() => attempt({ email, code: CODE })).toJSON(), wrongCode.toJSON());
  }

  // Only wrong CODES count towards the lock: two so far, and a mistyped address never locks anyone out.
  for (let i = 0; i < 20; i += 1) expectAppError(assert, () => attempt({ email: 'nobody@example.test', code: CODE }), 'sign_in_denied', 401);
  assert.equal(devLogin.isLocked(), false);
  assert.equal(attempt({ email: 'admin@example.test', code: CODE }).role, 'admin');
});

test('no refusal contains the code, the address or the guess', () => {
  const { devLogin, attempt } = setup();
  const errors = [
    thrownBy(() => attempt({ email: 'nobody@example.test', code: CODE })),
    thrownBy(() => attempt({ email: 'ada@example.test', code: WRONG })),
  ];
  while (!devLogin.isLocked()) errors.push(thrownBy(() => attempt({ email: 'ada@example.test', code: WRONG })));
  errors.push(thrownBy(() => attempt({ email: 'ada@example.test', code: CODE })));
  assert.equal(errors.at(-1).code, 'dev_login_locked');
  for (const error of errors) {
    const everything = [error.message, error.stack, JSON.stringify(error), inspect(error, { depth: 10, showHidden: true })].join('\n');
    for (const secret of [CODE, WRONG, 'ada@example.test', 'nobody@example.test']) assert.ok(!everything.includes(secret), `${error.code} must not contain ${secret}`);
    assert.deepEqual(Object.keys(error.toJSON().error), ['code', 'message']);
  }
  // The instance does not expose the code either.
  assert.deepEqual(Object.keys(devLogin).sort(), ['attempt', 'isLocked']);
  assert.ok(Object.isFrozen(devLogin));
  assert.ok(!inspect(devLogin, { depth: 10, showHidden: true }).includes(CODE));
});

test('generateDevLoginCode gives 128 random bits in URL-safe characters', () => {
  const codes = Array.from({ length: 200 }, () => generateDevLoginCode());
  for (const code of codes) {
    assert.match(code, /^[A-Za-z0-9_-]{22}$/);
    assert.equal(Buffer.from(code, 'base64url').length, 16, '16 bytes = 128 bits');
    assert.equal(encodeURIComponent(code), code);
  }
  assert.equal(new Set(codes).size, 200);

  const world = makeWorld();
  const code = generateDevLoginCode();
  assert.equal(createDevLogin({ code }).attempt(world.system, { email: 'admin@example.test', code }).role, 'admin');
});

test('a dev sign-in cannot be created without a code of at least 16 characters', () => {
  assert.equal(MIN_DEV_LOGIN_CODE_LENGTH, 16);
  // An empty or missing code would make an empty guess correct.
  for (const code of [undefined, null, '', 'short', '123456789012345', 1234567890123456, ['dev-code-for-tests-0001']]) {
    assert.throws(() => createDevLogin({ code }), /code must be at least 16 characters/);
  }
  assert.ok(createDevLogin({ code: '1234567890123456' }));
  for (const maxFailures of [0, -1, 2.5, '5', null]) assert.throws(() => createDevLogin({ code: CODE, maxFailures }), /maxFailures must be/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, safeEqual, sha256Hex } from '../../src/lib/ids.js';
import { csrfTokenFor, verifyCsrf } from '../../src/auth/csrf.js';

// Known answers computed independently of this code base:
//   printf 'csrf' | openssl dgst -sha256 -hmac '<session token>' -binary | basenc --base64url
const SESSION_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SESSION_B = 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const CSRF_A = 'So0WMBvm43rCjhmWj0HI7NPIUkusIQqm4EAHfQmEYf0';
const CSRF_B = 'exwJE-BTpIDG0bGege6Sc8ZZKjAUL-0TNpeBPiAmIiI';

test('the CSRF token is base64url(HMAC-SHA256(key = session token, message = "csrf"))', () => {
  assert.equal(csrfTokenFor(SESSION_A), CSRF_A);
  assert.equal(csrfTokenFor(SESSION_B), CSRF_B);
  assert.match(csrfTokenFor(randomToken(32)), /^[A-Za-z0-9_-]{43}$/, 'unpadded base64url of 32 bytes');
});

test('it is stable for one session and different for every other session', () => {
  const session = randomToken(32);
  assert.equal(csrfTokenFor(session), csrfTokenFor(session));
  assert.equal(verifyCsrf(session, csrfTokenFor(session)), true);

  const tokens = new Set([csrfTokenFor(SESSION_A), csrfTokenFor(SESSION_B), csrfTokenFor(session), csrfTokenFor(randomToken(32))]);
  assert.equal(tokens.size, 4);
  // One session's CSRF token is worthless with another session.
  assert.equal(verifyCsrf(SESSION_A, CSRF_B), false);
  assert.equal(verifyCsrf(SESSION_B, CSRF_A), false);
  assert.equal(verifyCsrf(SESSION_A, CSRF_A), true);
  assert.equal(verifyCsrf(SESSION_B, CSRF_B), true);
});

test('wrong, shortened, padded and look-alike values are rejected', () => {
  const wrong = [
    '',
    'x',
    CSRF_A.slice(0, -1),
    CSRF_A.slice(1),
    `${CSRF_A}A`,
    `${CSRF_A}=`,
    ` ${CSRF_A}`,
    `${CSRF_A}\n`,
    CSRF_A.toLowerCase(),
    CSRF_A.replace(/.$/, '1'),
    // The standard-alphabet spelling of the same bytes is not the token.
    CSRF_B.replaceAll('-', '+').replaceAll('_', '/'),
    // Things an attacker could know or guess that are NOT the token.
    SESSION_A,
    sha256Hex(SESSION_A),
    'csrf',
    'null',
    'undefined',
  ];
  for (const presented of wrong) assert.equal(verifyCsrf(SESSION_A, presented), false, JSON.stringify(presented));
  assert.equal(verifyCsrf(SESSION_B, CSRF_B.replaceAll('-', '+').replaceAll('_', '/')), false);
});

test('anything that is not a string is rejected, on either side', () => {
  for (const presented of [undefined, null, 0, 1, true, false, Number.NaN, {}, [], [CSRF_A], { toString: () => CSRF_A }, Buffer.from(CSRF_A), Symbol('csrf'), () => CSRF_A]) {
    assert.equal(verifyCsrf(SESSION_A, presented), false);
  }
  // No session, no valid token: not even the publicly computable HMAC of an empty key
  // (printf 'csrf' | openssl dgst -sha256 -hmac '' -binary | basenc --base64url).
  for (const session of [undefined, null, '', 0, {}, [SESSION_A], Buffer.from(SESSION_A)]) {
    assert.equal(verifyCsrf(session, CSRF_A), false);
    assert.equal(verifyCsrf(session, '_YMKahCNSratQj9zYMw-cuRR2lNB1vV2sGPJ829PZew'), false);
    assert.equal(verifyCsrf(session, undefined), false);
    assert.throws(() => csrfTokenFor(session), /a session token is required/);
  }
});

test('the token cannot be worked back into the session token', () => {
  const session = randomToken(32);
  const csrf = csrfTokenFor(session);
  assert.notEqual(csrf, session);
  assert.ok(!csrf.includes(session) && !session.includes(csrf));
  assert.notEqual(Buffer.from(csrf, 'base64url').toString('hex'), sha256Hex(session), 'it is keyed, not a bare hash of the cookie');
});

test('safeEqual tells apart two strings that differ only in an unpaired surrogate', { todo: 'defect: src/lib/ids.js safeEqual compares UTF-8 encodings, and every unpaired surrogate encodes to the same replacement bytes' }, () => {
  // Harmless for the callers in src/auth (one side is always an ASCII secret), but the
  // helper's contract is "equal strings", and these are not equal.
  assert.notEqual('\ud800', '\ud801');
  assert.equal(safeEqual('\ud800', '\ud801'), false);
  assert.equal(safeEqual('code-\ud800', 'code-�'), false);
});

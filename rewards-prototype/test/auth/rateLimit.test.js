import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T0 } from '../helpers.js';
import { fixedClock } from '../../src/lib/clock.js';
import { clientKey, createRateLimiter } from '../../src/auth/rateLimit.js';

const MINUTE = 60_000;
const ALLOWED = { allowed: true, retryAfterSeconds: 0 };

test('allows `limit` requests in a window, then refuses with the time left to wait', () => {
  const clock = fixedClock(T0);
  const limiter = createRateLimiter({ clock, limit: 3, windowMs: MINUTE });
  assert.deepEqual(limiter.check('198.51.100.7'), ALLOWED);
  assert.deepEqual(limiter.check('198.51.100.7'), ALLOWED);
  assert.deepEqual(limiter.check('198.51.100.7'), ALLOWED);
  assert.deepEqual(limiter.check('198.51.100.7'), { allowed: false, retryAfterSeconds: 60 });

  clock.advance(1);
  assert.deepEqual(limiter.check('198.51.100.7'), { allowed: false, retryAfterSeconds: 60 }, 'rounded up to whole seconds');
  clock.advance(999);
  assert.deepEqual(limiter.check('198.51.100.7'), { allowed: false, retryAfterSeconds: 59 });
  clock.advance(58_000);
  assert.deepEqual(limiter.check('198.51.100.7'), { allowed: false, retryAfterSeconds: 1 });
  clock.advance(999);
  assert.deepEqual(limiter.check('198.51.100.7'), { allowed: false, retryAfterSeconds: 1 }, 'never tells a client to retry in 0 seconds while refusing');
});

test('the window rolls over exactly `windowMs` after its first request', () => {
  const clock = fixedClock(T0);
  const limiter = createRateLimiter({ clock, limit: 2, windowMs: MINUTE });
  limiter.check('k');
  clock.advance(30_000);
  limiter.check('k');
  assert.equal(limiter.check('k').allowed, false);

  // The window is measured from the FIRST request, not from the latest one or from a refusal.
  clock.set('2026-11-09T20:00:59.999Z');
  assert.equal(limiter.check('k').allowed, false);
  clock.set('2026-11-09T20:01:00.000Z');
  assert.deepEqual(limiter.check('k'), ALLOWED);
  assert.deepEqual(limiter.check('k'), ALLOWED);
  assert.deepEqual(limiter.check('k'), { allowed: false, retryAfterSeconds: 60 });

  // Hammering while refused does not extend the wait.
  clock.advance(59_000);
  for (let i = 0; i < 100; i += 1) assert.equal(limiter.check('k').allowed, false);
  clock.advance(1_000);
  assert.deepEqual(limiter.check('k'), ALLOWED);

  // A long silence leaves nothing behind.
  clock.advance(24 * 60 * MINUTE);
  assert.deepEqual(limiter.check('k'), ALLOWED);
  assert.equal(limiter.size, 1);
});

test('keys are isolated from one another', () => {
  const clock = fixedClock(T0);
  const limiter = createRateLimiter({ clock, limit: 2, windowMs: MINUTE });
  limiter.check('198.51.100.7');
  limiter.check('198.51.100.7');
  assert.equal(limiter.check('198.51.100.7').allowed, false);
  assert.deepEqual(limiter.check('198.51.100.8'), ALLOWED);
  assert.deepEqual(limiter.check('2001:db8::1'), ALLOWED);
  // Keys that merely look related, or that name object internals, are separate keys.
  for (const key of ['198.51.100.70', ' 198.51.100.7', '__proto__', 'constructor', 'toString']) {
    assert.deepEqual(limiter.check(key), ALLOWED, key);
    assert.deepEqual(limiter.check(key), ALLOWED, key);
    assert.equal(limiter.check(key).allowed, false, key);
  }
  assert.equal(limiter.check('198.51.100.8').allowed, true);
  assert.equal(limiter.check('198.51.100.8').allowed, false);

  // Windows open at different times and close independently.
  clock.advance(30_000);
  assert.deepEqual(limiter.check('203.0.113.9'), ALLOWED);
  clock.advance(30_000);
  assert.deepEqual(limiter.check('198.51.100.7'), ALLOWED);
  limiter.check('203.0.113.9');
  assert.deepEqual(limiter.check('203.0.113.9'), { allowed: false, retryAfterSeconds: 30 });
});

test('the 10-per-minute-per-client and 60-per-minute-overall rules of the API contract', () => {
  const clock = fixedClock(T0);
  const perClient = createRateLimiter({ clock, limit: 10, windowMs: MINUTE });
  const overall = createRateLimiter({ clock, limit: 60, windowMs: MINUTE });
  const attempt = (address) => perClient.check(address).allowed && overall.check('sign-in').allowed;

  for (let i = 0; i < 10; i += 1) assert.equal(attempt('198.51.100.7'), true);
  assert.equal(attempt('198.51.100.7'), false, 'the eleventh attempt from one client');

  // Fifty more attempts from fifty other addresses use up the overall allowance.
  for (let i = 0; i < 50; i += 1) assert.equal(attempt(`203.0.113.${i}`), true);
  assert.equal(attempt('203.0.113.200'), false, 'the sixty-first attempt overall, from a client that has made none');
  clock.advance(MINUTE);
  assert.equal(attempt('203.0.113.200'), true);
});

test('memory is bounded: closed windows are dropped first, then the oldest open one', () => {
  const clock = fixedClock(T0);
  const limiter = createRateLimiter({ clock, limit: 1, windowMs: MINUTE, maxKeys: 3 });
  limiter.check('a');
  clock.advance(1_000);
  limiter.check('b');
  clock.advance(1_000);
  limiter.check('c');
  assert.equal(limiter.size, 3);
  assert.equal(limiter.check('a').allowed, false);
  assert.equal(limiter.check('b').allowed, false);

  // A fourth key while three windows are open: the oldest window ("a") is forgotten.
  limiter.check('d');
  assert.equal(limiter.size, 3);
  assert.equal(limiter.check('b').allowed, false, 'b is still remembered');
  assert.equal(limiter.check('c').allowed, false);
  assert.equal(limiter.check('d').allowed, false);
  assert.deepEqual(limiter.check('a'), ALLOWED, 'a starts afresh (and b, now the oldest, makes room for it)');
  assert.equal(limiter.size, 3);

  // Once windows have closed, they are dropped instead of evicting anything still open.
  clock.advance(MINUTE);
  limiter.check('e');
  assert.equal(limiter.size, 1);

  // A flood of distinct keys never grows the table past its bound.
  const flooded = createRateLimiter({ clock, limit: 5, windowMs: MINUTE, maxKeys: 100 });
  for (let i = 0; i < 10_000; i += 1) flooded.check(`key-${i}`);
  assert.equal(flooded.size, 100);
  assert.equal(createRateLimiter({ clock, limit: 1, windowMs: 1 }).size, 0);
});

test('a limiter needs a clock, a limit, a window and string keys', () => {
  const clock = fixedClock(T0);
  assert.throws(() => createRateLimiter({ limit: 1, windowMs: 1 }), /clock is required/);
  for (const limit of [0, -1, 1.5, '10', undefined]) assert.throws(() => createRateLimiter({ clock, limit, windowMs: MINUTE }), /limit must be/);
  for (const windowMs of [0, -1, 0.5, '60000', undefined]) assert.throws(() => createRateLimiter({ clock, limit: 1, windowMs }), /windowMs must be/);
  for (const maxKeys of [0, -1, 1.5, '100', null]) assert.throws(() => createRateLimiter({ clock, limit: 1, windowMs: MINUTE, maxKeys }), /maxKeys must be/);
  const limiter = createRateLimiter({ clock, limit: 1, windowMs: MINUTE });
  for (const key of [undefined, null, '', 42, {}, ['198.51.100.7']]) assert.throws(() => limiter.check(key), /key must be a non-empty string/);
  assert.equal(limiter.size, 0);
});

test('clientKey with 0 trusted hops: the socket address, and X-Forwarded-For is ignored entirely', () => {
  const direct = (forwardedFor) => clientKey({ remoteAddress: '198.51.100.7', forwardedFor, trustProxyHops: 0 });
  assert.equal(direct(undefined), '198.51.100.7');
  // With no proxy in front, the header is whatever the client typed.
  for (const spoofed of ['203.0.113.99', '203.0.113.99, 10.0.0.1', '127.0.0.1', '::1', 'unknown', '', ['203.0.113.1', '203.0.113.2']]) {
    assert.equal(direct(spoofed), '198.51.100.7', JSON.stringify(spoofed));
  }
  assert.equal(clientKey({ remoteAddress: '2001:DB8::A', trustProxyHops: 0 }), '2001:db8::a', 'one spelling per address');
  assert.equal(clientKey({ remoteAddress: undefined, forwardedFor: '203.0.113.99', trustProxyHops: 0 }), 'unknown');
  assert.equal(clientKey({ remoteAddress: '', trustProxyHops: 0 }), 'unknown');
});

test('clientKey with 1 trusted hop: the address our proxy appended, whatever the client put before it', () => {
  const viaProxy = (forwardedFor) => clientKey({ remoteAddress: '10.0.0.5', forwardedFor, trustProxyHops: 1 });
  assert.equal(viaProxy('198.51.100.7'), '198.51.100.7');
  // The client sent its own X-Forwarded-For; the proxy appended the address it really saw.
  assert.equal(viaProxy('203.0.113.99, 198.51.100.7'), '198.51.100.7');
  assert.equal(viaProxy('127.0.0.1, 10.0.0.5, ::1,198.51.100.7'), '198.51.100.7');
  assert.equal(viaProxy('  203.0.113.99 ,   198.51.100.7  '), '198.51.100.7');
  assert.equal(viaProxy(['203.0.113.99', '198.51.100.7']), '198.51.100.7', 'repeated headers are one list');
  assert.equal(viaProxy('203.0.113.99, 2001:DB8::7'), '2001:db8::7');

  // No usable entry in that position: fall back to the socket, never to something the client chose.
  assert.equal(viaProxy(undefined), '10.0.0.5');
  assert.equal(viaProxy(''), '10.0.0.5');
  assert.equal(viaProxy('203.0.113.99, '), '10.0.0.5');
  assert.equal(viaProxy('203.0.113.99, not-an-address'), '10.0.0.5');
  assert.equal(viaProxy('203.0.113.99, 198.51.100.7:4711'), '10.0.0.5', 'an address with a port would give every connection its own key');
  assert.equal(viaProxy('203.0.113.99, unknown'), '10.0.0.5');
  assert.equal(viaProxy(42), '10.0.0.5');
});

test('clientKey with 2 trusted hops: the second address from the right', () => {
  const viaTwo = (forwardedFor) => clientKey({ remoteAddress: '10.0.0.5', forwardedFor, trustProxyHops: 2 });
  // client -> edge proxy (appends the client) -> inner proxy (appends the edge proxy) -> app
  assert.equal(viaTwo('198.51.100.7, 10.0.0.9'), '198.51.100.7');
  assert.equal(viaTwo('203.0.113.99, 198.51.100.7, 10.0.0.9'), '198.51.100.7');
  assert.equal(viaTwo('203.0.113.99, 203.0.113.98, 198.51.100.7, 10.0.0.9'), '198.51.100.7');
  // Padding the left-hand side with junk or empty entries cannot shift the position.
  assert.equal(viaTwo(',,,, 203.0.113.99,, 198.51.100.7, 10.0.0.9'), '198.51.100.7');

  // Header shorter than the number of trusted hops: the socket address.
  assert.equal(viaTwo('198.51.100.7'), '10.0.0.5');
  assert.equal(viaTwo(undefined), '10.0.0.5');
  assert.equal(viaTwo(' , 10.0.0.9'), '10.0.0.5');

  // Three hops, for completeness.
  assert.equal(clientKey({ remoteAddress: '10.0.0.5', forwardedFor: '203.0.113.99, 198.51.100.7, 10.0.0.8, 10.0.0.9', trustProxyHops: 3 }), '198.51.100.7');
  assert.equal(clientKey({ remoteAddress: '10.0.0.5', forwardedFor: '198.51.100.7, 10.0.0.9', trustProxyHops: 3 }), '10.0.0.5');
});

test('clientKey refuses a hop count outside 0 to 3', () => {
  for (const trustProxyHops of [-1, 4, 1.5, '1', null, undefined, Number.NaN]) {
    assert.throws(() => clientKey({ remoteAddress: '198.51.100.7', forwardedFor: '203.0.113.99', trustProxyHops }), /trustProxyHops must be a whole number from 0 to 3/);
  }
});

test('a spoofed header cannot buy a fresh rate-limit window', () => {
  const clock = fixedClock(T0);
  const limiter = createRateLimiter({ clock, limit: 10, windowMs: MINUTE });
  let allowed = 0;
  for (let i = 0; i < 200; i += 1) {
    // Direct connection, pretending to be a different client on every request.
    const key = clientKey({ remoteAddress: '198.51.100.7', forwardedFor: `203.0.113.${i}`, trustProxyHops: 0 });
    if (limiter.check(key).allowed) allowed += 1;
  }
  assert.equal(allowed, 10);

  allowed = 0;
  for (let i = 0; i < 200; i += 1) {
    // Behind one proxy, again with a different invented address in front each time.
    const key = clientKey({ remoteAddress: '10.0.0.5', forwardedFor: `203.0.113.${i}, 198.51.100.8`, trustProxyHops: 1 });
    if (limiter.check(key).allowed) allowed += 1;
  }
  assert.equal(allowed, 10);
});

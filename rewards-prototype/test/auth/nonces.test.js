import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T0 } from '../helpers.js';
import { fixedClock } from '../../src/lib/clock.js';
import { randomToken } from '../../src/lib/ids.js';
import { createNonceStore } from '../../src/auth/nonces.js';

const TEN_MINUTES = 600_000;

test('a nonce is redeemable exactly once', () => {
  const nonces = createNonceStore({ clock: fixedClock(T0) });
  const nonce = nonces.issue();
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/, '256 random bits, base64url');
  assert.equal(nonces.size, 1);

  assert.equal(nonces.consume(nonce), true);
  assert.equal(nonces.size, 0, 'removed on first presentation');
  assert.equal(nonces.consume(nonce), false, 'a second presentation is a replay');
  assert.equal(nonces.consume(nonce), false);
});

test('every nonce is different, and redeeming one leaves the others outstanding', () => {
  const nonces = createNonceStore({ clock: fixedClock(T0) });
  const issued = Array.from({ length: 50 }, () => nonces.issue());
  assert.equal(new Set(issued).size, 50);
  assert.equal(nonces.size, 50);
  assert.equal(nonces.consume(issued[20]), true);
  assert.equal(nonces.consume(issued[20]), false);
  assert.equal(nonces.size, 49);
  assert.equal(nonces.consume(issued[0]), true);
  assert.equal(nonces.consume(issued[49]), true);
});

test('a nonce expires after ten minutes: valid up to the last millisecond, refused from then on', () => {
  const clock = fixedClock(T0);
  const nonces = createNonceStore({ clock });
  const early = nonces.issue();
  const boundary = nonces.issue();
  const late = nonces.issue();

  clock.advance(TEN_MINUTES - 1);
  assert.equal(nonces.consume(early), true);

  clock.advance(1);
  assert.equal(nonces.consume(boundary), false, 'expired exactly at ten minutes');
  assert.equal(nonces.consume(boundary), false);

  clock.advance(60 * 60_000);
  assert.equal(nonces.consume(late), false);
  assert.equal(nonces.size, 0, 'an expired nonce is dropped when it is presented');
});

test('the lifetime is configurable and counts from the moment of issue', () => {
  const clock = fixedClock(T0);
  const nonces = createNonceStore({ clock, ttlMs: 1000 });
  const first = nonces.issue();
  clock.advance(600);
  const second = nonces.issue();
  clock.advance(400);
  assert.equal(nonces.consume(first), false);
  assert.equal(nonces.consume(second), true);
});

test('expired nonces are pruned lazily, when the next one is issued', () => {
  const clock = fixedClock(T0);
  const nonces = createNonceStore({ clock });
  const stale = [nonces.issue(), nonces.issue(), nonces.issue()];
  clock.advance(TEN_MINUTES / 2);
  const fresh = nonces.issue();
  clock.advance(TEN_MINUTES / 2);
  assert.equal(nonces.size, 4, 'nothing runs in the background');

  const newest = nonces.issue();
  assert.equal(nonces.size, 2, 'the three expired ones went; the two live ones stayed');
  for (const nonce of stale) assert.equal(nonces.consume(nonce), false);
  assert.equal(nonces.consume(fresh), true);
  assert.equal(nonces.consume(newest), true);
});

test('at capacity the oldest outstanding nonce is evicted, so the store cannot grow without limit', () => {
  const nonces = createNonceStore({ clock: fixedClock(T0), max: 3 });
  const [first, second, third] = [nonces.issue(), nonces.issue(), nonces.issue()];
  assert.equal(nonces.size, 3);

  const fourth = nonces.issue();
  assert.equal(nonces.size, 3);
  assert.equal(nonces.consume(first), false, 'the oldest was evicted');
  assert.equal(nonces.consume(second), true);
  assert.equal(nonces.consume(third), true);
  assert.equal(nonces.consume(fourth), true);

  // A flood never pushes the store past its bound; only the newest survive.
  const bounded = createNonceStore({ clock: fixedClock(T0), max: 5 });
  const flood = Array.from({ length: 1000 }, () => bounded.issue());
  assert.equal(bounded.size, 5);
  assert.deepEqual(flood.map((nonce) => bounded.consume(nonce)).filter(Boolean).length, 5);
  assert.equal(flood.slice(0, 995).some((nonce) => bounded.consume(nonce)), false);

  const defaults = createNonceStore({ clock: fixedClock(T0) });
  for (let i = 0; i < 1005; i += 1) defaults.issue();
  assert.equal(defaults.size, 1000, 'the default bound is 1000');
});

test('consume on anything unknown is false and changes nothing', () => {
  const nonces = createNonceStore({ clock: fixedClock(T0) });
  const real = nonces.issue();
  const oneCharacterOff = real.replace(/^./, (first) => (first === 'A' ? 'B' : 'A'));
  const unknown = [randomToken(32), '', 'x', real.slice(0, -1), `${real}A`, oneCharacterOff, ` ${real}`, '__proto__', 'constructor', 'size'];
  for (const nonce of unknown) assert.equal(nonces.consume(nonce), false, JSON.stringify(nonce));
  for (const nonce of [undefined, null, 0, true, {}, [real], { toString: () => real }, Buffer.from(real)]) assert.equal(nonces.consume(nonce), false);
  assert.equal(nonces.size, 1);
  assert.equal(nonces.consume(real), true, 'wrong guesses do not burn the real nonce');

  // A store that never issued anything knows nothing.
  assert.equal(createNonceStore({ clock: fixedClock(T0) }).consume(real), false);
});

test('two stores do not share nonces', () => {
  const clock = fixedClock(T0);
  const one = createNonceStore({ clock });
  const two = createNonceStore({ clock });
  const nonce = one.issue();
  assert.equal(two.consume(nonce), false);
  assert.equal(one.consume(nonce), true);
});

test('a store needs a clock and sensible bounds', () => {
  assert.throws(() => createNonceStore({}), /clock is required/);
  assert.throws(() => createNonceStore({ clock: {} }), /clock is required/);
  for (const ttlMs of [0, -1, 1.5, '600000', Number.NaN]) assert.throws(() => createNonceStore({ clock: fixedClock(T0), ttlMs }), /ttlMs must be/);
  for (const max of [0, -1, 2.5, '1000', Number.POSITIVE_INFINITY]) assert.throws(() => createNonceStore({ clock: fixedClock(T0), max }), /max must be/);
});

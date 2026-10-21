import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCruise, nextCruise } from '../cruise.mjs';

test('parse', () => {
  assert.deepEqual(parseCruise('Fri 20:00, sunday 18:30, nonsense, Mon 25:00'), [{ day: 5, h: 20, m: 0 }, { day: 0, h: 18, m: 30 }]);
  assert.equal(nextCruise(''), null);
});
test('the next one, in Pacific time, across the week and daylight saving', () => {
  // Wed Oct 21 2026 06:00 UTC = Tue Oct 20 23:00 PDT; the next Fri 20:00 PDT is Sat Oct 24 03:00 UTC
  assert.deepEqual(nextCruise('Fri 20:00', new Date('2026-10-21T06:00:00Z')), { at: '2026-10-24T03:00:00.000Z', live: false });
  // in December (PST, UTC-8): Fri Dec 4 20:00 PST = Sat Dec 5 04:00 UTC
  assert.deepEqual(nextCruise('Fri 20:00', new Date('2026-12-02T12:00:00Z')), { at: '2026-12-05T04:00:00.000Z', live: false });
  // during one: Fri 21:00 PDT counts as live (started an hour ago)
  const during = nextCruise('Fri 20:00, Sun 18:00', new Date('2026-10-24T04:00:00Z'));
  assert.equal(during.live, true); assert.equal(during.at, '2026-10-24T03:00:00.000Z');
  // the sooner of two
  assert.equal(nextCruise('Fri 20:00, Sun 18:00', new Date('2026-10-24T06:00:00Z')).at, '2026-10-26T01:00:00.000Z');
});

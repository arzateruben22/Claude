import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict, nextRung } from '../ladder.mjs';

const NOW = Date.parse('2026-11-01T12:00:00Z');
// a week of hours at a cap of 25: busy evenings, quiet nights
function week({ peakEvening = 25, cpuMs = 200000, dropped = 0, waited = 2, rss = 90 } = {}) {
  const rows = [];
  for (let d = 7; d >= 1; d--) for (let h = 0; h < 24; h++) {
    const t = new Date(NOW - d * 86400000 + h * 3600000);
    const evening = h >= 1 && h <= 5;            // 6-10 pm Pacific in UTC
    rows.push({ hour: t.toISOString().slice(0, 13), peak: evening ? peakEvening : 4, cap: 25, queuedPeak: evening ? 3 : 0, waited: evening ? waited : 0, posesIn: 36000, posesDropped: dropped, bytesOut: 2e8, cpuMs: evening ? cpuMs : 20000, rssMb: rss });
  }
  return rows;
}
test('the rungs', () => { assert.equal(nextRung(25), 50); assert.equal(nextRung(100), 200); assert.equal(nextRung(500), null); });
test('a full, healthy week says go up a rung', () => {
  const v = verdict(week(), 25, { now: NOW });
  assert.equal(v.ready, true, v.reasons.join('; ')); assert.equal(v.next, 50); assert.equal(v.summary.fullDays, 7);
});
test('a lobby that never filled says wait, and says why', () => {
  const v = verdict(week({ peakEvening: 18, waited: 0 }), 25, { now: NOW });
  assert.equal(v.ready, false);
  assert.ok(v.reasons.some((r) => /full on 0 days/.test(r)) && v.reasons.some((r) => /nobody has waited/.test(r)), v.reasons.join('; '));
});
test('a strained machine says wait: CPU, dropped poses, memory', () => {
  const v = verdict(week({ cpuMs: 2400000, dropped: 900, rss: 220 }), 25, { now: NOW });
  assert.equal(v.ready, false);
  assert.ok(v.reasons.some((r) => /CPU reached 67%/.test(r)), v.reasons.join('; '));
  assert.ok(v.reasons.some((r) => /2\.5% of poses dropped/.test(r)), v.reasons.join('; '));
  assert.ok(v.reasons.some((r) => /memory reached 220 MB/.test(r)), v.reasons.join('; '));
});
test('a short record says wait', () => {
  const v = verdict(week().slice(-48), 25, { now: NOW });
  assert.ok(v.reasons.some((r) => /only [1-3] of 7 days/.test(r)), v.reasons.join('; '));
});

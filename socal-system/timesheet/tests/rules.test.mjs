// SoCal Timesheet — rules engine tests.
// Zero dependencies. Run: node tests/rules.test.mjs
// Prints one line per case; exits 1 on any failure, 0 when green.

import { evaluateShift, validateOdometer, validateEA, FLAG_CODES } from '../rules.js';

// ---------------------------------------------------------------------------
// Tiny runner + assert helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`FAIL  ${name}\n      ${e && e.message ? e.message : e}`);
  }
}

function eq(actual, expected, label = 'value') {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function ok(cond, label = 'condition') {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

/** Canonical JSON: object keys sorted recursively so key order never matters. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
    return o;
  }
  return v;
}
function deepEq(actual, expected, label = 'value') {
  const a = JSON.stringify(canon(actual));
  const b = JSON.stringify(canon(expected));
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

function includes(text, needle, label = 'message') {
  if (typeof text !== 'string' || !text.includes(needle)) {
    throw new Error(`${label}: expected to contain ${JSON.stringify(needle)}, got ${JSON.stringify(text)}`);
  }
}

// Result helpers
const codes = (r) => r.flags.map((f) => f.code);
const findFlag = (r, code) => r.flags.find((f) => f.code === code);
function hasFlag(r, code, severity) {
  const f = findFlag(r, code);
  if (!f) throw new Error(`expected flag ${code}; flags = [${codes(r).join(', ')}]`);
  if (severity) eq(f.severity, severity, `${code} severity`);
  return f;
}
function noFlag(r, code) {
  if (findFlag(r, code)) throw new Error(`did not expect flag ${code}; flags = [${codes(r).join(', ')}]`);
}
function noErrors(r) {
  const errs = r.flags.filter((f) => f.severity === 'error').map((f) => f.code);
  if (errs.length) throw new Error(`expected no error flags, got [${errs.join(', ')}]`);
  eq(r.ok, true, 'ok');
}
const hours = (r, code) => {
  const t = r.tiers.find((x) => x.code === code);
  return t ? t.hours : 0;
};
const minutes = (r, code) => {
  const t = r.tiers.find((x) => x.code === code);
  return t ? t.minutes : 0;
};
/** Assert the tiers list is EXACTLY {code: hours} (order-insensitive, no extras). */
function tiersAre(r, expected, label = 'tiers') {
  const got = {};
  for (const t of r.tiers) got[t.code] = t.hours;
  const keys = Object.keys(expected).sort();
  const gotKeys = Object.keys(got).sort();
  deepEq(gotKeys, keys, `${label} codes`);
  for (const k of keys) eq(got[k], expected[k], `${label} ${k}`);
}
function tierListIs(list, expected, label) {
  const got = {};
  for (const t of list) got[t.code] = t.hours;
  deepEq(Object.keys(got).sort(), Object.keys(expected).sort(), `${label} codes`);
  for (const k of Object.keys(expected)) eq(got[k], expected[k], `${label} ${k}`);
}
const sumMinutes = (list) => list.reduce((s, t) => s + t.minutes, 0);

const B = (category, start, stop, jobRef) => (jobRef === undefined ? { category, start, stop } : { category, start, stop, jobRef });
const shift = (date, blocks, extra = {}) => evaluateShift({ date, blocks, ...extra });

// Calendar facts: 2026-07-29 Wed, 07-31 Fri, 08-01 Sat, 08-02 Sun, 08-03 Mon, 08-05 Wed, 08-06 Thu.
const WED = '2026-07-29';
const FRI = '2026-07-31';
const SAT = '2026-08-01';
const SUN = '2026-08-02';

// ---------------------------------------------------------------------------
// Golden vectors (real verified daily logs — ground truth)
// ---------------------------------------------------------------------------

test('golden 1: FC 2026-07-29 Wed 02:00-10:30 w/ lunch → 8.00 PW Regular', () => {
  const r = shift(WED, [B('work', '02:00', '05:00'), B('lunch', '05:00', '05:30'), B('work', '05:30', '10:30')]);
  eq(r.workedMinutes, 480, 'workedMinutes');
  eq(r.lunchMinutes, 30, 'lunchMinutes');
  eq(r.elapsedMinutes, 510, 'elapsedMinutes');
  eq(r.family, 'PW', 'family');
  includes(r.familyReason, '270', 'familyReason inside count');
  includes(r.familyReason, '210', 'familyReason outside count');
  tiersAre(r, { 'PW Regular': 8 });
  eq(r.split, null, 'split');
  noErrors(r);
  eq(r.timelineOk, true, 'timelineOk');
});

test('golden 2: EA 2026-08-06 Thu D8 00:30-10:00 → PWSS Regular 8.00 + PWSS 1.5 OT 1.00', () => {
  const r = shift('2026-08-06', [B('work', '00:30', '03:45'), B('lunch', '03:45', '04:15'), B('work', '04:15', '10:00')]);
  eq(r.workedMinutes, 540, 'workedMinutes');
  eq(r.family, 'PWSS', 'family');
  includes(r.familyReason, '300', 'familyReason outside count');
  includes(r.familyReason, '240', 'familyReason inside count');
  tiersAre(r, { 'PWSS Regular': 8, 'PWSS 1.5 OT': 1 });
  eq(r.split, null, 'split');
  noErrors(r);
});

test('golden 3: FC 2026-08-02 Sun 05:00-15:30 → PW 2.0 DT 10.00 (Sunday minimum)', () => {
  const r = shift(SUN, [B('work', '05:00', '08:00'), B('lunch', '08:00', '08:30'), B('work', '08:30', '15:30')]);
  eq(r.workedMinutes, 600, 'workedMinutes');
  eq(r.family, 'PW', 'family');
  includes(r.familyReason, '540', 'familyReason inside count');
  tiersAre(r, { 'PW 2.0 DT': 10 });
  noErrors(r);
  noFlag(r, FLAG_CODES.LUNCH2_WAIVABLE); // worked exactly 600 is not > 600
});

// ---------------------------------------------------------------------------
// Accrual ladder (weekday)
// ---------------------------------------------------------------------------

test('14h weekday ladder: 8 Regular + 4 @1.5 + 2 @2.0, both lunches on time', () => {
  const r = shift(WED, [
    B('work', '06:00', '10:30'), B('lunch', '10:30', '11:00'),
    B('work', '11:00', '15:30'), B('lunch', '15:30', '16:00'),
    B('work', '16:00', '21:00'),
  ]);
  eq(r.workedMinutes, 840, 'workedMinutes');
  eq(r.lunchMinutes, 60, 'lunchMinutes');
  eq(r.family, 'PW', 'family');
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 4, 'PW 2.0 DT': 2 });
  noErrors(r);
  noFlag(r, FLAG_CODES.LUNCH2_WAIVABLE);
});

test('14h weekday with NO second lunch → error LUNCH2_MISSING', () => {
  const r = shift(WED, [B('work', '06:00', '10:30'), B('lunch', '10:30', '11:00'), B('work', '11:00', '20:30')]);
  eq(r.workedMinutes, 840, 'workedMinutes');
  hasFlag(r, FLAG_CODES.LUNCH2_MISSING, 'error');
  eq(r.ok, false, 'ok');
  eq(r.timelineOk, true, 'timelineOk');
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 4, 'PW 2.0 DT': 2 });
});

test('14.5h weekday with second lunch at 10:00 elapsed → error LUNCH2_LATE', () => {
  const r = shift(WED, [
    B('work', '06:00', '10:30'), B('lunch', '10:30', '11:00'),
    B('work', '11:00', '16:00'), B('lunch', '16:00', '16:30'),
    B('work', '16:30', '21:30'),
  ]);
  eq(r.workedMinutes, 870, 'workedMinutes');
  const f = hasFlag(r, FLAG_CODES.LUNCH2_LATE, 'error');
  includes(f.message, '10:00');
  includes(f.message, '9:59');
  noFlag(r, FLAG_CODES.LUNCH2_MISSING);
});

test('second lunch at exactly 9:59 elapsed on a >12h shift is compliant', () => {
  const r = shift(WED, [
    B('work', '06:00', '10:30'), B('lunch', '10:30', '11:00'),
    B('work', '11:00', '15:59'), B('lunch', '15:59', '16:29'),
    B('work', '16:29', '21:30'),
  ]);
  ok(r.workedMinutes > 720, 'worked > 720');
  noFlag(r, FLAG_CODES.LUNCH2_LATE);
  noFlag(r, FLAG_CODES.LUNCH2_MISSING);
});

// ---------------------------------------------------------------------------
// First lunch
// ---------------------------------------------------------------------------

test('first lunch at 5:00 elapsed → error LUNCH1_LATE (message has 5:00 and 4:59)', () => {
  const r = shift(WED, [B('work', '06:00', '11:00'), B('lunch', '11:00', '11:30'), B('work', '11:30', '15:00')]);
  const f = hasFlag(r, FLAG_CODES.LUNCH1_LATE, 'error');
  includes(f.message, '5:00');
  includes(f.message, '4:59');
  eq(r.ok, false, 'ok');
  eq(r.timelineOk, true, 'timelineOk');
});

test('first lunch at exactly 4:59 elapsed is compliant', () => {
  const r = shift(WED, [B('work', '06:00', '10:59'), B('lunch', '10:59', '11:29'), B('work', '11:29', '15:00')]);
  noFlag(r, FLAG_CODES.LUNCH1_LATE);
  noFlag(r, FLAG_CODES.LUNCH1_MISSING);
  noErrors(r);
});

test('6h shift with no lunch → error LUNCH1_MISSING', () => {
  const r = shift(WED, [B('work', '06:00', '12:00')]);
  const f = hasFlag(r, FLAG_CODES.LUNCH1_MISSING, 'error');
  includes(f.message, '4:59');
  eq(r.ok, false, 'ok');
  eq(r.timelineOk, true, 'timelineOk (lunch errors are not timeline errors)');
  tiersAre(r, { 'PW Regular': 6 });
});

test('4:59 shift with no lunch → rule vacuous, no lunch flag', () => {
  const r = shift(WED, [B('work', '06:00', '10:59')]);
  eq(r.elapsedMinutes, 299, 'elapsed');
  noFlag(r, FLAG_CODES.LUNCH1_MISSING);
  noFlag(r, FLAG_CODES.LUNCH1_LATE);
  noErrors(r);
});

test('5:00 shift with no lunch → LUNCH1_MISSING (boundary at 300)', () => {
  const r = shift(WED, [B('work', '06:00', '11:00')]);
  eq(r.elapsedMinutes, 300, 'elapsed');
  hasFlag(r, FLAG_CODES.LUNCH1_MISSING, 'error');
});

// ---------------------------------------------------------------------------
// Second lunch waivable (600, 720]
// ---------------------------------------------------------------------------

test('11h worked, no second lunch → info LUNCH2_WAIVABLE, ok stays true', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '17:30')]);
  eq(r.workedMinutes, 660, 'workedMinutes');
  const f = hasFlag(r, FLAG_CODES.LUNCH2_WAIVABLE, 'info');
  includes(f.message, 'no waiver recorded');
  noErrors(r);
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 3 });
});

test('waivable info notes the waiver when options.secondLunchWaived is true (still info)', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '17:30')],
    { options: { secondLunchWaived: true } });
  const f = hasFlag(r, FLAG_CODES.LUNCH2_WAIVABLE, 'info');
  includes(f.message, 'waiver recorded');
  noErrors(r);
});

test('exactly 12h worked (720) with no second lunch → still waivable, not required', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '18:30')]);
  eq(r.workedMinutes, 720, 'workedMinutes');
  hasFlag(r, FLAG_CODES.LUNCH2_WAIVABLE, 'info');
  noFlag(r, FLAG_CODES.LUNCH2_MISSING);
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 4 });
});

test('721 worked minutes with no second lunch → LUNCH2_MISSING and 1 min of 2.0 DT', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '18:31')]);
  eq(r.workedMinutes, 721, 'workedMinutes');
  hasFlag(r, FLAG_CODES.LUNCH2_MISSING, 'error');
  noFlag(r, FLAG_CODES.LUNCH2_WAIVABLE);
  eq(minutes(r, 'PW 2.0 DT'), 1, '2.0 minutes');
  eq(hours(r, 'PW 2.0 DT'), 0.02, '2.0 hours rounded');
});

test('10h worked exactly (600) → no waivable info', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '16:30')]);
  eq(r.workedMinutes, 600, 'workedMinutes');
  noFlag(r, FLAG_CODES.LUNCH2_WAIVABLE);
});

// ---------------------------------------------------------------------------
// Saturday / Sunday minimums + open ruling
// ---------------------------------------------------------------------------

test('Saturday 8h → all PW 1.5 OT 8.00 + ruling SAT_RULING_2X', () => {
  const r = shift(SAT, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '14:30')]);
  eq(r.workedMinutes, 480, 'workedMinutes');
  tiersAre(r, { 'PW 1.5 OT': 8 });
  const f = hasFlag(r, FLAG_CODES.SAT_RULING_2X, 'ruling');
  includes(f.message, '2.0');
  includes(f.message, '1.5');
  noErrors(r);
});

test('Saturday 4h → PW 1.5 OT 4.00, no SAT ruling flag (not > 240)', () => {
  const r = shift(SAT, [B('work', '06:00', '10:00')]);
  tiersAre(r, { 'PW 1.5 OT': 4 });
  noFlag(r, FLAG_CODES.SAT_RULING_2X);
  noErrors(r);
});

test('Saturday 4h01 → SAT_RULING_2X appears (boundary)', () => {
  const r = shift(SAT, [B('work', '06:00', '10:01')]);
  hasFlag(r, FLAG_CODES.SAT_RULING_2X, 'ruling');
});

test('Saturday 13h → 720 min @1.5 + 60 min @2.0 (post-720 accrual still rolls to 2.0)', () => {
  const r = shift(SAT, [
    B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'),
    B('work', '10:30', '15:30'), B('lunch', '15:30', '16:00'),
    B('work', '16:00', '20:00'),
  ]);
  eq(r.workedMinutes, 780, 'workedMinutes');
  tiersAre(r, { 'PW 1.5 OT': 12, 'PW 2.0 DT': 1 });
  noErrors(r);
});

test('Sunday evening 4h → PWSS 2.0 DT 4.00 (Sunday minimum, PWSS family)', () => {
  const r = shift(SUN, [B('work', '18:00', '22:00')]);
  eq(r.family, 'PWSS', 'family');
  tiersAre(r, { 'PWSS 2.0 DT': 4 });
  noErrors(r);
});

test('Sunday with priorMinutes still all 2.0 DT', () => {
  const r = shift(SUN, [B('work', '08:00', '12:00')], { priorMinutes: 480 });
  tiersAre(r, { 'PW 2.0 DT': 4 });
});

// ---------------------------------------------------------------------------
// Overnight splits
// ---------------------------------------------------------------------------

test('overnight Fri→Sat: split dates, shiftChange, Sat minimum on day-two portion', () => {
  const r = shift(FRI, [B('work', '20:00', '23:00'), B('lunch', '23:00', '23:30'), B('work', '23:30', '04:00')]);
  eq(r.workedMinutes, 450, 'workedMinutes');
  eq(r.elapsedMinutes, 480, 'elapsedMinutes');
  eq(r.family, 'PWSS', 'family');
  tiersAre(r, { 'PWSS Regular': 3.5, 'PWSS 1.5 OT': 4 });
  ok(r.split, 'split present');
  eq(r.split.dayOne.date, '2026-07-31', 'dayOne.date');
  eq(r.split.dayTwo.date, '2026-08-01', 'dayTwo.date');
  eq(r.split.dayTwo.shiftChange, true, 'shiftChange');
  tierListIs(r.split.dayOne.tiers, { 'PWSS Regular': 3.5 }, 'dayOne');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS 1.5 OT': 4 }, 'dayTwo');
  noFlag(r, FLAG_CODES.SAT_RULING_2X); // Saturday paid = 240, not > 240
  noErrors(r);
});

test('overnight Fri→Sat: day-two minutes restart the ladder at 0 and are 1.5 by the Saturday minimum alone', () => {
  // Fri 16:00-20:00 (240) + 20:30-24:00 (210) = 450 Regular; Sat 00:00-01:30 = 90 from accrual 0 → Regular → Sat min 1.5
  const r = shift(FRI, [B('work', '16:00', '20:00'), B('lunch', '20:00', '20:30'), B('work', '20:30', '01:30')]);
  eq(r.workedMinutes, 540, 'workedMinutes');
  tiersAre(r, { 'PWSS Regular': 7.5, 'PWSS 1.5 OT': 1.5 });
  tierListIs(r.split.dayOne.tiers, { 'PWSS Regular': 7.5 }, 'dayOne');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS 1.5 OT': 1.5 }, 'dayTwo');
  noErrors(r);
});

test('overnight Fri→Sat 14h: Friday ladders to 1.5, Saturday portion restarts at 0 (1.5 by minimum, never 2.0)', () => {
  // Fri 12:00-16:00 (240) + 16:30-21:00 (270) + 21:30-24:00 (150) = 660 → 480 Reg + 180 @1.5;
  // Sat 00:00-03:00 = 180 from accrual 0 → Regular → Sat min 1.5. The retired
  // "one shift, one ladder" reading gave 1h @1.5 + 2h @2.0 on Saturday.
  const r = shift(FRI, [
    B('work', '12:00', '16:00'), B('lunch', '16:00', '16:30'),
    B('work', '16:30', '21:00'), B('lunch', '21:00', '21:30'),
    B('work', '21:30', '03:00'),
  ]);
  eq(r.workedMinutes, 840, 'workedMinutes');
  eq(r.family, 'PWSS', 'family');
  tiersAre(r, { 'PWSS Regular': 8, 'PWSS 1.5 OT': 6 });
  tierListIs(r.split.dayOne.tiers, { 'PWSS Regular': 8, 'PWSS 1.5 OT': 3 }, 'dayOne');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS 1.5 OT': 3 }, 'dayTwo');
  noErrors(r);
});

test('overnight Sun→Mon: Sunday portion 2.0, Monday portion is the plain Monday ladder from 0', () => {
  // Sun 18:00-22:30 (270) + 23:00-24:00 (60) = 330 @2.0; Mon 00:00-04:00 = 240 from accrual 0 → all Regular
  const r = shift(SUN, [B('work', '18:00', '22:30'), B('lunch', '22:30', '23:00'), B('work', '23:00', '04:00')]);
  eq(r.workedMinutes, 570, 'workedMinutes');
  eq(r.family, 'PWSS', 'family');
  tiersAre(r, { 'PWSS 2.0 DT': 5.5, 'PWSS Regular': 4 });
  eq(r.split.dayTwo.date, '2026-08-03', 'dayTwo.date');
  tierListIs(r.split.dayOne.tiers, { 'PWSS 2.0 DT': 5.5 }, 'dayOne');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS Regular': 4 }, 'dayTwo');
  noErrors(r);
});

test('overnight Thu→Fri 14h: Friday portion is the Friday workday (480 Regular + 30 OT), not hours 6–14 of Thursday', () => {
  // RULEBOOK "any hours past 8 in a day": Thu 18:00-22:00 (240) + 22:30-24:00 (90) = 330 Regular;
  // Fri 00:00-03:00 (180) + 03:30-09:00 (330) = 510 → 480 Regular + 30 @1.5. 2026-08-06 is a Thursday.
  const r = shift('2026-08-06', [
    B('work', '18:00', '22:00'), B('lunch', '22:00', '22:30'),
    B('work', '22:30', '03:00'), B('lunch', '03:00', '03:30'),
    B('work', '03:30', '09:00'),
  ]);
  eq(r.workedMinutes, 840, 'workedMinutes');
  eq(r.family, 'PWSS', 'family');
  tiersAre(r, { 'PWSS Regular': 13.5, 'PWSS 1.5 OT': 0.5 });
  eq(r.split.dayOne.date, '2026-08-06', 'dayOne.date');
  eq(r.split.dayTwo.date, '2026-08-07', 'dayTwo.date');
  tierListIs(r.split.dayOne.tiers, { 'PWSS Regular': 5.5 }, 'dayOne');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS Regular': 8, 'PWSS 1.5 OT': 0.5 }, 'dayTwo');
  noErrors(r);
});

test('priorMinutes seeds day one only: Thu 20:00–02:30 with 480 prior → Thu 4h @1.5, Fri 2h Regular', () => {
  const r = shift('2026-08-06', [B('work', '20:00', '00:00'), B('lunch', '00:00', '00:30'), B('work', '00:30', '02:30')], { priorMinutes: 480 });
  eq(r.workedMinutes, 360, 'workedMinutes');
  tiersAre(r, { 'PWSS 1.5 OT': 4, 'PWSS Regular': 2 });
  tierListIs(r.split.dayOne.tiers, { 'PWSS 1.5 OT': 4 }, 'dayOne');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS Regular': 2 }, 'dayTwo');
  noErrors(r);
});

test('day ledger consistency: overnight dayTwo coding + next entry seeded with the spill = one continuous Friday ladder', () => {
  const a = shift('2026-08-06', [
    B('work', '18:00', '22:00'), B('lunch', '22:00', '22:30'),
    B('work', '22:30', '03:00'), B('lunch', '03:00', '03:30'),
    B('work', '03:30', '09:00'),
  ]);
  const spill = sumMinutes(a.split.dayTwo.tiers);
  eq(spill, 510, 'Friday spill minutes (what the ledger prefills)');
  const b = shift('2026-08-07', [B('work', '10:00', '14:00')], { priorMinutes: spill });
  tiersAre(b, { 'PW 1.5 OT': 3.5, 'PW 2.0 DT': 0.5 });
  // Friday workday as a whole: 510 + 240 = 750 paid → 480 Regular + 240 @1.5 + 30 @2.0, family-agnostic.
  const byTier = {};
  for (const t of [...a.split.dayTwo.tiers, ...b.tiers]) {
    const name = t.code.replace(/^PW(SS)? /, '');
    byTier[name] = (byTier[name] || 0) + t.minutes;
  }
  deepEq(byTier, { 'Regular': 480, '1.5 OT': 240, '2.0 DT': 30 }, 'Friday workday ladder');
});

test('overnight Sat→Sun: Saturday portion 1.5, Sunday portion 2.0', () => {
  const r = shift(SAT, [B('work', '20:00', '23:00'), B('lunch', '23:00', '23:30'), B('work', '23:30', '02:30')]);
  eq(r.workedMinutes, 360, 'workedMinutes');
  tiersAre(r, { 'PWSS 1.5 OT': 3.5, 'PWSS 2.0 DT': 2.5 });
  eq(r.split.dayTwo.date, '2026-08-02', 'dayTwo.date');
  tierListIs(r.split.dayTwo.tiers, { 'PWSS 2.0 DT': 2.5 }, 'dayTwo');
  noFlag(r, FLAG_CODES.SAT_RULING_2X);
  noErrors(r);
});

test('top-level tiers equal dayOne + dayTwo merged', () => {
  const r = shift(FRI, [B('work', '16:00', '20:00'), B('lunch', '20:00', '20:30'), B('work', '20:30', '01:30')]);
  const merged = {};
  for (const t of [...r.split.dayOne.tiers, ...r.split.dayTwo.tiers]) merged[t.code] = (merged[t.code] || 0) + t.minutes;
  const top = {};
  for (const t of r.tiers) top[t.code] = t.minutes;
  deepEq(top, merged, 'merged minutes');
});

test('block ending exactly at midnight (stop 00:00) does not create a split', () => {
  const r = shift(FRI, [B('work', '20:00', '00:00')]);
  eq(r.workedMinutes, 240, 'workedMinutes');
  eq(r.split, null, 'split');
  tiersAre(r, { 'PWSS Regular': 4 });
});

test('stop "24:00" is accepted as end-of-day', () => {
  const r = shift(FRI, [B('work', '20:00', '24:00')]);
  eq(r.workedMinutes, 240, 'workedMinutes');
  eq(r.split, null, 'split');
});

test('single block crossing midnight Fri 22:00-02:00 splits 2h Regular / 2h Sat 1.5', () => {
  const r = shift(FRI, [B('work', '22:00', '02:00')]);
  eq(r.elapsedMinutes, 240, 'elapsed');
  tiersAre(r, { 'PWSS Regular': 2, 'PWSS 1.5 OT': 2 });
  ok(r.split && r.split.dayTwo.shiftChange === true, 'split.dayTwo.shiftChange');
});

// ---------------------------------------------------------------------------
// Family tie-breaker
// ---------------------------------------------------------------------------

test('exact 50/50 tie, shift starts outside window (04:00) → PWSS', () => {
  const r = shift(WED, [B('work', '04:00', '06:00'), B('work', '06:00', '08:00')]);
  eq(r.family, 'PWSS', 'family');
  includes(r.familyReason.toLowerCase(), 'tie');
  tiersAre(r, { 'PWSS Regular': 4 });
});

test('exact 50/50 tie, shift starts inside window (15:00) → PW', () => {
  const r = shift(WED, [B('work', '15:00', '17:00'), B('work', '17:00', '19:00')]);
  eq(r.family, 'PW', 'family');
  includes(r.familyReason.toLowerCase(), 'tie');
  tiersAre(r, { 'PW Regular': 4 });
});

test('family window is evaluated on real clock time after midnight', () => {
  // 03:00-06:00 outside (180), 06:00-10:00 inside (240) → PW despite a 03:00 start
  const r = shift(WED, [B('work', '03:00', '06:00'), B('lunch', '06:00', '06:30'), B('work', '06:30', '10:30')]);
  eq(r.family, 'PW', 'family');
});

// ---------------------------------------------------------------------------
// priorMinutes (second job / employer same day)
// ---------------------------------------------------------------------------

test('priorMinutes=480: a 4h second shift starts at 1.5 OT', () => {
  const r = shift(WED, [B('work', '13:00', '17:00')], { priorMinutes: 480 });
  tiersAre(r, { 'PW 1.5 OT': 4 });
  noErrors(r);
});

test('priorMinutes=600: 4h shift → 2h @1.5 then 2h @2.0', () => {
  const r = shift(WED, [B('work', '13:00', '17:00')], { priorMinutes: 600 });
  tiersAre(r, { 'PW 1.5 OT': 2, 'PW 2.0 DT': 2 });
});

test('Randy case: entry A 20:00-02:00 spills 120 paid minutes onto the next date', () => {
  const r = shift('2026-08-05', [B('work', '20:00', '02:00', 'JOB-A')]);
  ok(r.split, 'split');
  eq(r.split.dayTwo.date, '2026-08-06', 'dayTwo.date');
  eq(sumMinutes(r.split.dayTwo.tiers), 120, 'dayTwo paid minutes');
  eq(sumMinutes(r.split.dayOne.tiers), 240, 'dayOne paid minutes');
});

test('Randy case: entry B with priorMinutes=120, 06:00-14:00 + lunch → Regular 6.00 + 1.5 OT 1.50', () => {
  const r = shift('2026-08-06', [B('work', '06:00', '10:00', 'JOB-B'), B('lunch', '10:00', '10:30'), B('work', '10:30', '14:00', 'JOB-B')],
    { priorMinutes: 120 });
  eq(r.workedMinutes, 450, 'workedMinutes');
  tiersAre(r, { 'PW Regular': 6, 'PW 1.5 OT': 1.5 });
  noErrors(r);
});

test('Randy case: entry B 06:00-12:00 with priorMinutes=120 → exactly PW Regular 6.00', () => {
  const r = shift('2026-08-06', [B('work', '06:00', '12:00', 'JOB-B')], { priorMinutes: 120 });
  tiersAre(r, { 'PW Regular': 6 });
});

test('invalid / missing priorMinutes is treated as 0', () => {
  const a = shift(WED, [B('work', '06:00', '10:00')], { priorMinutes: 'abc' });
  const b = shift(WED, [B('work', '06:00', '10:00')], { priorMinutes: -50 });
  tiersAre(a, { 'PW Regular': 4 }, 'a');
  tiersAre(b, { 'PW Regular': 4 }, 'b');
});

// ---------------------------------------------------------------------------
// byJob allocation
// ---------------------------------------------------------------------------

test('byJob: per-jobRef tiers sum exactly to top-level tiers', () => {
  const r = shift(WED, [B('work', '06:00', '10:00', 'JOB-A'), B('lunch', '10:00', '10:30'), B('work', '10:30', '15:30', 'JOB-B')]);
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 1 });
  eq(r.byJob.length, 2, 'byJob length');
  const a = r.byJob.find((j) => j.jobRef === 'JOB-A');
  const b = r.byJob.find((j) => j.jobRef === 'JOB-B');
  tierListIs(a.tiers, { 'PW Regular': 4 }, 'JOB-A');
  tierListIs(b.tiers, { 'PW Regular': 4, 'PW 1.5 OT': 1 }, 'JOB-B');
  const sums = {};
  for (const j of r.byJob) for (const t of j.tiers) sums[t.code] = (sums[t.code] || 0) + t.minutes;
  const top = {};
  for (const t of r.tiers) top[t.code] = t.minutes;
  deepEq(sums, top, 'byJob sums vs tiers');
});

test('byJob: blocks without jobRef group under "" and travel/break are paid', () => {
  const r = shift(WED, [B('work', '06:00', '08:00'), B('travel', '08:00', '09:00', 'JOB-X'), B('break', '09:00', '09:10'), B('work', '09:10', '10:00')]);
  eq(r.workedMinutes, 240, 'workedMinutes');
  eq(r.breakMinutes, 10, 'breakMinutes');
  eq(r.lunchMinutes, 0, 'lunchMinutes');
  const blank = r.byJob.find((j) => j.jobRef === '');
  const x = r.byJob.find((j) => j.jobRef === 'JOB-X');
  eq(sumMinutes(blank.tiers), 180, 'blank jobRef minutes');
  eq(sumMinutes(x.tiers), 60, 'JOB-X minutes');
  eq(sumMinutes(r.tiers), 240, 'total minutes');
});

test('byJob on an overnight Sun→Mon shift still sums to tiers across tier codes', () => {
  const r = shift(SUN, [B('work', '18:00', '22:30', 'A'), B('lunch', '22:30', '23:00'), B('work', '23:00', '04:00', 'B')]);
  noErrors(r);
  const sums = {};
  for (const j of r.byJob) for (const t of j.tiers) sums[t.code] = (sums[t.code] || 0) + t.minutes;
  const top = {};
  for (const t of r.tiers) top[t.code] = t.minutes;
  deepEq(sums, top, 'byJob sums vs tiers');
  tierListIs(r.byJob.find((j) => j.jobRef === 'A').tiers, { 'PWSS 2.0 DT': 4.5 }, 'job A');
  // job B: 60 Sunday minutes @2.0, then 240 Monday minutes from accrual 0 → Regular
  tierListIs(r.byJob.find((j) => j.jobRef === 'B').tiers, { 'PWSS 2.0 DT': 1, 'PWSS Regular': 4 }, 'job B');
});

test('split halves carry their own byJob (date × tier × jobRef), each summing to that half\'s tiers', () => {
  // Fri 20:00 → Sat 03:00, two jobs, lunch at 23:00. Sat portion is 1.5 by day minimum.
  const r = evaluateShift({ date: '2026-08-07', blocks: [
    { category: 'work', start: '20:00', stop: '23:00', jobRef: 'JOB-1' },
    { category: 'lunch', start: '23:00', stop: '23:30' },
    { category: 'work', start: '23:30', stop: '03:00', jobRef: 'JOB-2' },
  ] });
  noErrors(r);
  ok(r.split, 'split present');
  deepEq(r.split.dayOne.byJob, [
    { jobRef: 'JOB-1', tiers: [{ code: 'PWSS Regular', minutes: 180, hours: 3 }] },
    { jobRef: 'JOB-2', tiers: [{ code: 'PWSS Regular', minutes: 30, hours: 0.5 }] },
  ], 'dayOne.byJob');
  deepEq(r.split.dayTwo.byJob, [
    { jobRef: 'JOB-2', tiers: [{ code: 'PWSS 1.5 OT', minutes: 180, hours: 3 }] },
  ], 'dayTwo.byJob');
  for (const half of [r.split.dayOne, r.split.dayTwo]) {
    const sums = {};
    for (const j of half.byJob) for (const t of j.tiers) sums[t.code] = (sums[t.code] || 0) + t.minutes;
    const top = {};
    for (const t of half.tiers) top[t.code] = t.minutes;
    deepEq(sums, top, half.date + ' byJob sums vs tiers');
  }
  // Top-level byJob is unchanged by the per-day breakdown.
  tierListIs(r.byJob.find((j) => j.jobRef === 'JOB-2').tiers, { 'PWSS Regular': 0.5, 'PWSS 1.5 OT': 3 }, 'JOB-2 total');
});

// ---------------------------------------------------------------------------
// Timeline validation
// ---------------------------------------------------------------------------

test('same-day overlap → error OVERLAP, timelineOk false', () => {
  const r = shift(WED, [B('work', '08:00', '12:00'), B('work', '11:00', '14:00')]);
  const f = hasFlag(r, FLAG_CODES.OVERLAP, 'error');
  includes(f.message, '11:00');
  eq(r.timelineOk, false, 'timelineOk');
  eq(r.ok, false, 'ok');
});

test('overlap on day two (after midnight) → error OVERLAP', () => {
  const r = shift(FRI, [B('work', '22:00', '02:00'), B('work', '01:00', '03:00')]);
  hasFlag(r, FLAG_CODES.OVERLAP, 'error');
  eq(r.timelineOk, false, 'timelineOk');
});

test('30-min gap → warn GAP (not paid), timelineOk true', () => {
  const r = shift(WED, [B('work', '08:00', '10:00'), B('work', '10:30', '14:00')]);
  const f = hasFlag(r, FLAG_CODES.GAP, 'warn');
  includes(f.message, '0:30');
  includes(f.message.toLowerCase(), 'not paid');
  eq(r.workedMinutes, 330, 'workedMinutes');
  eq(r.elapsedMinutes, 360, 'elapsedMinutes');
  eq(r.timelineOk, true, 'timelineOk');
});

test('contiguous blocks produce no GAP flag', () => {
  const r = shift(WED, [B('work', '08:00', '10:00'), B('work', '10:00', '12:00')]);
  noFlag(r, FLAG_CODES.GAP);
});

test('elapsed > 20h → error LONG_SHIFT', () => {
  const r = shift(WED, [
    B('work', '06:00', '12:00'), B('lunch', '12:00', '12:30'),
    B('work', '12:30', '17:00'), B('lunch', '17:00', '17:30'),
    B('work', '17:30', '02:30'),
  ]);
  eq(r.elapsedMinutes, 1230, 'elapsed');
  hasFlag(r, FLAG_CODES.LONG_SHIFT, 'error');
  eq(r.timelineOk, false, 'timelineOk');
});

test('elapsed exactly 20h → no LONG_SHIFT', () => {
  const r = shift(WED, [
    B('work', '06:00', '10:30'), B('lunch', '10:30', '11:00'),
    B('work', '11:00', '15:30'), B('lunch', '15:30', '16:00'),
    B('work', '16:00', '02:00'),
  ]);
  eq(r.elapsedMinutes, 1200, 'elapsed');
  noFlag(r, FLAG_CODES.LONG_SHIFT);
});

test('no blocks → error NO_BLOCKS with empty tiers', () => {
  const r = evaluateShift({ date: WED, blocks: [] });
  hasFlag(r, FLAG_CODES.NO_BLOCKS, 'error');
  eq(r.ok, false, 'ok');
  eq(r.timelineOk, false, 'timelineOk');
  deepEq(r.tiers, [], 'tiers');
  deepEq(r.byJob, [], 'byJob');
  eq(r.split, null, 'split');
  eq(r.workedMinutes, 0, 'workedMinutes');
});

test('missing blocks property → NO_BLOCKS, does not throw', () => {
  const r = evaluateShift({ date: WED });
  hasFlag(r, FLAG_CODES.NO_BLOCKS, 'error');
});

test('zero-length block → error BAD_BLOCK', () => {
  const r = shift(WED, [B('work', '08:00', '08:00')]);
  hasFlag(r, FLAG_CODES.BAD_BLOCK, 'error');
  eq(r.timelineOk, false, 'timelineOk');
});

test('unparseable time → BAD_BLOCK; valid blocks still computed', () => {
  const r = shift(WED, [B('work', '8am', '12:00'), B('work', '06:00', '10:00')]);
  hasFlag(r, FLAG_CODES.BAD_BLOCK, 'error');
  eq(r.workedMinutes, 240, 'workedMinutes from the valid block');
});

test('unknown category → BAD_BLOCK', () => {
  const r = shift(WED, [{ category: 'nap', start: '08:00', stop: '09:00' }]);
  hasFlag(r, FLAG_CODES.BAD_BLOCK, 'error');
});

test('auto-sort: blocks entered out of order (first row earliest) sort into a clean timeline', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('work', '10:30', '15:00'), B('lunch', '10:00', '10:30')]);
  noFlag(r, FLAG_CODES.GAP);
  noFlag(r, FLAG_CODES.OVERLAP);
  noErrors(r);
  eq(r.workedMinutes, 510, 'workedMinutes');
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 0.5 });
});

test('auto-sort: day-two blocks entered out of order still sort correctly', () => {
  const r = shift(FRI, [B('work', '20:00', '23:00'), B('lunch', '23:00', '23:30'), B('work', '02:00', '04:00'), B('work', '23:30', '02:00')]);
  noFlag(r, FLAG_CODES.GAP);
  noFlag(r, FLAG_CODES.OVERLAP);
  eq(r.workedMinutes, 450, 'workedMinutes');
  eq(r.elapsedMinutes, 480, 'elapsedMinutes');
});

// ---------------------------------------------------------------------------
// Rest-break advisory + rulings
// ---------------------------------------------------------------------------

test('continuous paid span of exactly 4h → no REST_BREAK_ADVISORY', () => {
  const r = shift(WED, [B('work', '06:00', '10:00')]);
  noFlag(r, FLAG_CODES.REST_BREAK_ADVISORY);
});

test('continuous paid span of 4h01 → warn REST_BREAK_ADVISORY', () => {
  const r = shift(WED, [B('work', '06:00', '08:00'), B('travel', '08:00', '10:01')]);
  hasFlag(r, FLAG_CODES.REST_BREAK_ADVISORY, 'warn');
});

test('a break block resets the continuous span (no advisory)', () => {
  // spans: 120 | break | 140 | lunch | 240 → longest 240, not > 240
  const r = shift(WED, [B('work', '06:00', '08:00'), B('break', '08:00', '08:10'), B('work', '08:10', '10:30'), B('lunch', '10:30', '11:00'), B('work', '11:00', '15:00')]);
  noFlag(r, FLAG_CODES.REST_BREAK_ADVISORY);
  noErrors(r);
  eq(r.breakMinutes, 10, 'breakMinutes');
  eq(r.workedMinutes, 510, 'workedMinutes');
});

test('a gap also ends the continuous span, and the advisory names the span length', () => {
  // 06:00-09:00 (180) | gap | 09:30-13:45 (255) → advisory for 4:15
  const r = shift(WED, [B('work', '06:00', '09:00'), B('work', '09:30', '13:45'), B('lunch', '13:45', '14:15'), B('work', '14:15', '15:00')]);
  const f = hasFlag(r, FLAG_CODES.REST_BREAK_ADVISORY, 'warn');
  includes(f.message, '4:15');
  hasFlag(r, FLAG_CODES.GAP, 'warn');
});

test('holiday option → ruling HOLIDAY_RULING, computed on the weekday ladder', () => {
  const r = shift(WED, [B('work', '06:00', '10:00'), B('lunch', '10:00', '10:30'), B('work', '10:30', '15:30')], { options: { holiday: true } });
  const f = hasFlag(r, FLAG_CODES.HOLIDAY_RULING, 'ruling');
  includes(f.message.toLowerCase(), 'ruling');
  tiersAre(r, { 'PW Regular': 8, 'PW 1.5 OT': 1 });
  noErrors(r);
});

test('no holiday option → no HOLIDAY_RULING', () => {
  const r = shift(WED, [B('work', '06:00', '10:00')]);
  noFlag(r, FLAG_CODES.HOLIDAY_RULING);
});

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

test('flags carry only the four severities and ruling items are not errors', () => {
  const r = shift(SAT, [B('work', '06:00', '12:00')], { options: { holiday: true } });
  const allowed = new Set(['error', 'warn', 'ruling', 'info']);
  for (const f of r.flags) {
    ok(allowed.has(f.severity), `severity ${f.severity}`);
    ok(typeof f.code === 'string' && f.code in FLAG_CODES, `code ${f.code} in FLAG_CODES`);
    ok(typeof f.message === 'string' && f.message.length > 0, 'message non-empty');
  }
  // LUNCH1_MISSING (error) is the only error here; rulings do not flip ok by themselves
  const errs = r.flags.filter((f) => f.severity === 'error').map((f) => f.code);
  deepEq(errs, [FLAG_CODES.LUNCH1_MISSING], 'error codes');
});

test('tier hours = minutes/60 rounded to 2 decimals', () => {
  const r = shift(WED, [B('work', '06:00', '07:40')]); // 100 min
  eq(hours(r, 'PW Regular'), 1.67, 'hours');
  eq(minutes(r, 'PW Regular'), 100, 'minutes');
});

test('FLAG_CODES enum is complete, self-named and frozen', () => {
  const expected = [
    'LUNCH1_MISSING', 'LUNCH1_LATE', 'LUNCH2_MISSING', 'LUNCH2_LATE', 'LUNCH2_WAIVABLE',
    'REST_BREAK_ADVISORY', 'SAT_RULING_2X', 'HOLIDAY_RULING', 'OVERNIGHT_RULING', 'OVERLAP', 'BAD_BLOCK',
    'GAP', 'LONG_SHIFT', 'NO_BLOCKS', 'ODO_NEGATIVE', 'MILES_MISMATCH', 'EA_FORMAT',
  ];
  deepEq(Object.keys(FLAG_CODES).sort(), [...expected].sort(), 'keys');
  for (const k of expected) eq(FLAG_CODES[k], k, k);
  ok(Object.isFrozen(FLAG_CODES), 'frozen');
});

// ---------------------------------------------------------------------------
// validateOdometer
// ---------------------------------------------------------------------------

test('odometer: 30560→30617 claimed 57 → miles 57, no flags', () => {
  const r = validateOdometer({ begin: 30560, end: 30617, claimedMiles: 57 });
  eq(r.miles, 57, 'miles');
  deepEq(r.flags, [], 'flags');
});

test('odometer: end < begin → error ODO_NEGATIVE', () => {
  const r = validateOdometer({ begin: 100, end: 90 });
  ok(r.flags.some((f) => f.code === FLAG_CODES.ODO_NEGATIVE && f.severity === 'error'), 'ODO_NEGATIVE error');
});

test('odometer: claimed miles differ → warn MILES_MISMATCH', () => {
  const r = validateOdometer({ begin: 100, end: 150, claimedMiles: 40 });
  eq(r.miles, 50, 'miles');
  ok(r.flags.some((f) => f.code === FLAG_CODES.MILES_MISMATCH && f.severity === 'warn'), 'MILES_MISMATCH warn');
});

test('odometer: string inputs and no claim → miles computed, no flags', () => {
  const r = validateOdometer({ begin: '30,560', end: '30617' });
  eq(r.miles, 57, 'miles');
  deepEq(r.flags, [], 'flags');
});

test('odometer: missing reading → miles null, no flags', () => {
  const r = validateOdometer({ begin: '', end: 100 });
  eq(r.miles, null, 'miles');
  deepEq(r.flags, [], 'flags');
});

// ---------------------------------------------------------------------------
// validateEA
// ---------------------------------------------------------------------------

test('EA: 105-Express 07-314524 ends in 4 → no flags', () => {
  deepEq(validateEA('105-Express', '07-314524'), [], 'flags');
});

test('EA: 105-Express ending in 3 → warn EA_FORMAT naming the rule', () => {
  const flags = validateEA('105-Express', '07-314523');
  eq(flags.length, 1, 'one flag');
  eq(flags[0].code, FLAG_CODES.EA_FORMAT, 'code');
  eq(flags[0].severity, 'warn', 'severity');
  includes(flags[0].message, '105-Express');
  includes(flags[0].message, '"4"');
});



test('EA: CTC has no suffix rule', () => {
  deepEq(validateEA('CTC', 'whatever-9'), [], 'flags');
  deepEq(validateEA('CTC', ''), [], 'flags empty');
});

test('EA: empty EA on D8 → warn EA_FORMAT citing the documented style', () => {
  const flags = validateEA('D8', '');
  eq(flags.length, 1, 'one flag');
  eq(flags[0].code, FLAG_CODES.EA_FORMAT, 'code');
  eq(flags[0].severity, 'warn', 'severity');
  includes(flags[0].message, 'D8');
  includes(flags[0].message, '1C08U4');
  deepEq(validateEA('D8', '   '), flags, 'whitespace-only is blank');
});

test('EA: empty EA on 105-Express → warn EA_FORMAT', () => {
  const flags = validateEA('105-Express', '');
  eq(flags.length, 1, 'one flag');
  eq(flags[0].code, FLAG_CODES.EA_FORMAT, 'code');
  includes(flags[0].message, 'no EA entered');
});

test('EA: D8 08-1C08U3 (Daily Report form style) → no flags', () => {
  deepEq(validateEA('D8', '08-1C08U3'), []);
});
test('EA: D8 1C08U4 (checklist style) → info EA_FORMAT noting both forms, never a warning', () => {
  const flags = validateEA('D8', '1C08U4');
  eq(flags.length, 1, 'flag count');
  eq(flags[0].severity, 'info', 'severity');
  includes(flags[0].message, '08-1C08U3');
});
test('EA: D8 ending in neither 3 nor 4 → warn EA_FORMAT', () => {
  const flags = validateEA('D8', '1C08U9');
  eq(flags[0].severity, 'warn', 'severity');
});
test('overnight: continuous reading differs → ruling OVERNIGHT_RULING with alternative hours', () => {
  const r = evaluateShift({ date: '2026-07-30', blocks: [
    { category: 'work', start: '21:30', stop: '01:00' },
    { category: 'lunch', start: '01:00', stop: '01:30' },
    { category: 'work', start: '01:30', stop: '07:30' },
  ] });
  tiersAre(r, { 'PWSS Regular': 9.5 });
  const f = hasFlag(r, 'OVERNIGHT_RULING', 'ruling');
  includes(f.message, 'PWSS 1.5 OT 1.50');
});
test('overnight: short night shift where both readings agree → no OVERNIGHT_RULING', () => {
  const r = evaluateShift({ date: '2026-07-30', blocks: [{ category: 'work', start: '22:00', stop: '02:00' }] });
  noFlag(r, 'OVERNIGHT_RULING');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`${passed + failed} cases: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failed: ' + failures.join(' | '));
  process.exit(1);
}
process.exit(0);

// The online board (board.mjs): built from accepted poses only. Each test drives a pretend car through record() on an
// in-memory database and reads the board back. Times are the server's clock, in ms; the car goes along x.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createBoard, dayKey, weekSince, KINDS } from '../board.mjs';

const T0 = Date.parse('2026-10-21T20:00:00Z');          // Wed Oct 21 2026, 13:00 PDT
const DAY0 = '2026-10-21';
const CEIL = 110;                                        // the default speed ceiling, m/s
const mk = (opts = {}) => createBoard(new DatabaseSync(':memory:'), { timerMs: 0, ...opts });
const start = (t = T0, x = 0) => ({ t, x });
// `seconds` of poses at `hz`, the car moving at `v` m/s while reporting `report` m/s (v unless said otherwise)
function drive(b, id, at, { v, seconds, hz = 10, report = v, name = 'driver_' + id }) {
  const dtMs = 1000 / hz, n = Math.round(seconds * hz);
  let { t, x } = at;
  for (let i = 0; i < n; i++) { t += dtMs; x += (v * dtMs) / 1000; b.record(id, { x, y: 10, z: 0, h: Math.PI / 2, v: report, b: 0 }, t, name); }
  return { t, x };
}
const pose = (b, id, at, v = 30) => b.record(id, { x: at.x, y: 10, z: 0, h: 0, v, b: 0 }, at.t, 'driver_' + id);
const find = (rows, id) => rows.find((r) => r.name === 'driver_' + id)?.value ?? 0;
// a player's value for one kind today, after writing their running state (the drive stays open, as while driving)
const read = (b, kind, id, now) => { b.flush(id, now); return find(b.top(kind, { now, limit: 100 }), id); };
// the same after 3 s of silence, which ends the drive the way a disconnect or a gap does
const readDone = (b, kind, id, now) => { b.flushAll(now + 3001); return find(b.top(kind, { now, limit: 100 }), id); };
const near = (v, want, tol) => Math.abs(v - want) <= tol;

test('distance comes from displacement; a teleport, a reconnect and a parked car reporting speed add nothing', () => {
  const b = mk();
  let at = drive(b, 1, start(), { v: 30, seconds: 10 });               // 99 steps of 3 m: the first pose has nothing before it
  const d1 = read(b, 'distance', 1, at.t);
  assert.ok(near(d1, 297, 1), `${d1} m for 10 s at 30 m/s`);
  // a teleport 5 km down the road in one step
  at = { t: at.t + 100, x: at.x + 5000 }; pose(b, 1, at);
  const d2 = read(b, 'distance', 1, at.t);
  assert.ok(d2 - d1 <= 3.01, `a teleport added ${(d2 - d1).toFixed(2)} m (one step's worth at most)`);
  // a reconnect 20 km away after 10 s of silence: nothing
  at = { t: at.t + 10000, x: at.x + 20000 }; pose(b, 1, at);
  assert.equal(read(b, 'distance', 1, at.t), d2);
  // parked for 20 s reporting 50 m/s: nothing, and nothing banked for a jump afterwards
  for (let i = 1; i <= 200; i++) pose(b, 1, { t: at.t + i * 100, x: at.x }, 50);
  at.t += 20000;
  assert.equal(read(b, 'distance', 1, at.t), d2, 'parked');
  at = { t: at.t + 100, x: at.x + 200 }; pose(b, 1, at, 50);
  const d3 = read(b, 'distance', 1, at.t);
  assert.ok(d3 - d2 <= 5.01, `a 200 m jump after parking added ${(d3 - d2).toFixed(2)} m`);
  // moving while reporting speed 0: one step's worth from the speed reported just before, then nothing
  at = drive(b, 1, at, { v: 30, seconds: 2, report: 0 });
  const d3b = read(b, 'distance', 1, at.t);
  assert.ok(d3b - d3 <= 3.01, `reported 0 while moving 60 m earned ${(d3b - d3).toFixed(2)} m`);
  // a pose older than the last is ignored
  const ignored = b.live().posesIgnored;
  pose(b, 1, { t: at.t - 5000, x: at.x - 100 });
  assert.equal(b.live().posesIgnored, ignored + 1);
  assert.equal(read(b, 'distance', 1, at.t), d3b);
  // a 2 s stall: the car kept going, the poses arrive in a burst, and the distance is kept (two seconds of carry)
  at = drive(b, 1, at, { v: 30, seconds: 5 });
  const d4 = read(b, 'distance', 1, at.t);
  for (let i = 0; i < 20; i++) { at.x += 3; pose(b, 1, { t: at.t + 2000 + i, x: at.x }); }
  at.t += 2019;
  const d5 = read(b, 'distance', 1, at.t);
  assert.ok(near(d5 - d4, 60, 0.5), `a 2 s stall kept ${(d5 - d4).toFixed(1)} of 60 m`);
  // elevation is not distance
  const c = mk();
  for (let i = 1; i <= 50; i++) c.record(1, { x: 0, y: 10 + i * 10, z: 0, h: 0, v: 40, b: 0 }, T0 + i * 100, 'driver_1');
  assert.equal(read(c, 'distance', 1, T0 + 5000), 0);
});

test('the 3 s sustained speed: a one-pose spike and a 2.9 s burst don\'t count, a 3 s hold does, and it is checked against the ground covered', () => {
  const b = mk();
  let at = drive(b, 1, start(), { v: 40, seconds: 5 });
  at = { t: at.t + 100, x: at.x + 4 }; pose(b, 1, at, 150);               // the spike: one pose at 150 m/s
  at = drive(b, 1, at, { v: 40, seconds: 4 });
  assert.equal(read(b, 'speed', 1, at.t), 40, 'a spike does not count');
  at = drive(b, 1, at, { v: 80, seconds: 2.9 });
  at = drive(b, 1, at, { v: 40, seconds: 4 });
  assert.equal(read(b, 'speed', 1, at.t), 40, 'a burst under 3 s stays off the board');
  at = drive(b, 1, at, { v: 60, seconds: 3.5 });
  at = drive(b, 1, at, { v: 40, seconds: 1 });
  assert.equal(read(b, 'speed', 1, at.t), 60, 'held for 3 s counts');
  // reporting 100 while covering ground at 40: the ground wins
  at = drive(b, 1, at, { v: 40, seconds: 6, report: 100 });
  assert.equal(read(b, 'speed', 1, at.t), 60);
  const c = mk(); const at2 = drive(c, 1, start(), { v: 40, seconds: 6, report: 100 });
  const s = read(c, 'speed', 1, at2.t);
  assert.ok(s >= 40 && s <= 42.5, `reported 100, moved at 40, the board says ${s}`);
  // the ceiling: 150 m/s reported and covered (the relay allows up to 200) reads as the ceiling
  const d = mk(); const at3 = drive(d, 1, start(), { v: 150, seconds: 6 });
  assert.equal(read(d, 'speed', 1, at3.t), CEIL);
  // parked and reporting 90 for a minute: no speed at all
  const e = mk();
  for (let i = 1; i <= 600; i++) pose(e, 1, { t: T0 + i * 100, x: 0 }, 90);
  assert.equal(read(e, 'speed', 1, T0 + 60000), 0);
});

test('the longest unbroken drive splits on a silence over 3 s and on a stop, not on a 2 s hiccup', () => {
  const b = mk();
  let at = drive(b, 1, start(), { v: 30, seconds: 20 });
  let v = read(b, 'drive', 1, at.t);
  assert.ok(v >= 16 && v <= 20, `still driving, the board shows what is proven so far: ${v} s`);
  v = readDone(b, 'drive', 1, at.t);
  assert.ok(near(v, 20, 0.5), `${v} s for a 20 s drive`);
  at = { t: at.t + 4000, x: at.x + 120 };                                  // 4 s of silence
  at = drive(b, 1, at, { v: 30, seconds: 8 });
  v = readDone(b, 'drive', 1, at.t);
  assert.ok(near(v, 20, 0.5), `after a gap the 8 s drive stands alone: ${v} s`);
  // a 2 s hiccup: the car kept going, the poses just came late; the drive runs through it
  const h = mk();
  let a1 = drive(h, 1, start(), { v: 30, seconds: 8 });
  a1 = { t: a1.t + 2000, x: a1.x + 60 };
  a1 = drive(h, 1, a1, { v: 30, seconds: 14 });
  v = readDone(h, 'drive', 1, a1.t);
  assert.ok(near(v, 24, 0.5), `8 + 2 + 14 s through a hiccup: ${v} s`);
  // a stop: 10 s of poses without displacement ends the drive; the next 10 s is a new one
  const c = mk();
  let a2 = drive(c, 1, start(), { v: 30, seconds: 10 });
  for (let i = 1; i <= 100; i++) pose(c, 1, { t: a2.t + i * 100, x: a2.x }, 0);
  a2.t += 10000;
  a2 = drive(c, 1, a2, { v: 30, seconds: 10 });
  v = readDone(c, 'drive', 1, a2.t);
  assert.ok(near(v, 10, 0.5), `a stop splits the drive: ${v} s`);
  // creeping under 1 m/s counts as stopped too, and doesn't pad the drive after it
  const d = mk();
  let a3 = drive(d, 1, start(), { v: 30, seconds: 10 });
  a3 = drive(d, 1, a3, { v: 0.5, seconds: 10 });
  a3 = drive(d, 1, a3, { v: 30, seconds: 10 });
  v = readDone(d, 'drive', 1, a3.t);
  assert.ok(near(v, 10, 0.5), `creeping splits the drive: ${v} s`);
  // a 2 s stop inside a drive is fine (every 3 s window still covers 3 m)
  const e = mk();
  let a4 = drive(e, 1, start(), { v: 30, seconds: 10 });
  for (let i = 1; i <= 20; i++) pose(e, 1, { t: a4.t + i * 100, x: a4.x }, 0);
  a4.t += 2000;
  a4 = drive(e, 1, a4, { v: 30, seconds: 10 });
  v = readDone(e, 'drive', 1, a4.t);
  assert.ok(near(v, 22, 0.5), `a 2 s stop is part of the drive: ${v} s`);
});

test('the Pacific day boundary, through both daylight-saving changes, puts poses on the right day', () => {
  // fall back, 2026-11-01: that Pacific day lasts 25 hours, from 07:00Z Nov 1 to 08:00Z Nov 2
  assert.equal(dayKey(Date.parse('2026-11-01T06:59:59Z')), '2026-10-31');
  assert.equal(dayKey(Date.parse('2026-11-01T07:00:00Z')), '2026-11-01');
  assert.equal(dayKey(Date.parse('2026-11-02T07:59:59Z')), '2026-11-01');
  assert.equal(dayKey(Date.parse('2026-11-02T08:00:00Z')), '2026-11-02');
  // spring forward, 2026-03-08: 23 hours, from 08:00Z Mar 8 to 07:00Z Mar 9
  assert.equal(dayKey(Date.parse('2026-03-08T07:59:59Z')), '2026-03-07');
  assert.equal(dayKey(Date.parse('2026-03-08T08:00:00Z')), '2026-03-08');
  assert.equal(dayKey(Date.parse('2026-03-09T06:59:59Z')), '2026-03-08');
  assert.equal(dayKey(Date.parse('2026-03-09T07:00:00Z')), '2026-03-09');
  assert.equal(weekSince(Date.parse('2026-11-04T20:00:00Z')), '2026-10-29', 'seven Pacific days ending Nov 4');
  // a drive across the fall-back midnight: 4 s each side at 30 m/s, each day gets its own row and its own drive
  const b = mk(), mid = Date.parse('2026-11-02T08:00:00Z');
  const at = drive(b, 1, start(mid - 4000), { v: 30, seconds: 8 });
  b.flushAll(at.t + 3001);
  const before = b.top('distance', { now: mid - 1 }), after = b.top('distance', { now: at.t });
  assert.ok(near(before[0].value, 114, 1), `Nov 1: ${before[0].value} m (38 steps)`);
  assert.ok(near(after[0].value, 123, 1), `Nov 2: ${after[0].value} m (41 steps, the one across midnight included)`);
  assert.equal(b.top('distance', { now: at.t, period: 'week' })[0].value, before[0].value + after[0].value);
  const dBefore = b.top('drive', { now: mid - 1 })[0].value, dAfter = b.top('drive', { now: at.t })[0].value;
  assert.ok(dBefore >= 3.5 && dBefore <= 4 && dAfter >= 4 && dAfter <= 4.5, `the drive is split at midnight: ${dBefore} s and ${dAfter} s`);
  assert.equal(b.snapshot({ now: mid - 1 }).day, '2026-11-01'); assert.equal(b.snapshot({ now: at.t }).day, '2026-11-02');
});

test('top() orders by value, limits, returns names only; banned and deleted accounts vanish once the players table is there', () => {
  const db = new DatabaseSync(':memory:'), b = createBoard(db, { timerMs: 0 });
  const yesterday = T0 - 86400000;
  drive(b, 1, start(yesterday), { v: 10, seconds: 10 });                   // 99 m on Oct 20
  drive(b, 1, start(), { v: 10, seconds: 10 });                            // 99 m on Oct 21
  const a2 = drive(b, 2, start(), { v: 30, seconds: 10 });                 // 297 m
  drive(b, 3, start(), { v: 20, seconds: 10 });                            // 198 m
  b.record(4, { x: 0, y: 10, z: 0, h: 0, v: 0, b: 0 }, T0 + 100, 'driver_4');   // connected, never moved
  const now = a2.t;
  b.flushAll(now + 3001);
  const rows = b.top('distance', { now });
  assert.deepEqual(rows.map((r) => r.name), ['driver_2', 'driver_3', 'driver_1'], 'ordered, and the one who never moved is not listed');
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  assert.deepEqual(Object.keys(rows[0]), ['rank', 'name', 'value']);
  assert.equal(b.top('distance', { now, limit: 2 }).length, 2);
  assert.deepEqual(b.top('speed', { now }).map((r) => [r.name, r.value]), [['driver_2', 30], ['driver_3', 20], ['driver_1', 10]]);
  assert.ok(b.top('drive', { now }).every((r) => near(r.value, 9.9, 0.2)), JSON.stringify(b.top('drive', { now })));
  // the week: Oct 20 and 21 for driver 1
  assert.equal(find(b.top('distance', { now, period: 'week' }), 1), 198);
  assert.equal(find(b.top('distance', { now }), 1), 99);
  // the snapshot: the three lists, the day, and (with `me`) where the caller stands; never an id
  const snap = b.snapshot({ now, me: 3 });
  assert.deepEqual(Object.keys(snap), ['day', 'since', 'period', 'tz', 'at', 'units', 'distance', 'speed', 'drive', 'you']);
  assert.equal(snap.day, DAY0); assert.equal(snap.since, DAY0); assert.equal(snap.tz, 'America/Los_Angeles');
  assert.deepEqual(snap.units, { distance: 'm', speed: 'm/s', drive: 's' });
  assert.deepEqual(snap.you.distance, { rank: 2, value: 198 }); assert.equal(snap.you.speed.rank, 2); assert.equal(snap.you.drive.rank, 1, 'a tie shares the rank');
  assert.ok(!/"player"|"id"|"email"|"x"|"z"/.test(JSON.stringify(snap)), 'names and numbers only');
  assert.equal(b.snapshot({ now, period: 'week' }).since, '2026-10-15');
  // with the live server's players table: the account's name, banned hidden, a deleted account gone
  db.exec('CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT NOT NULL, banned INTEGER NOT NULL DEFAULT 0)');
  db.exec("INSERT INTO players VALUES (1, 'Ruben_OC', 0), (2, 'driver_2', 1), (3, 'driver_3', 0)");
  assert.deepEqual(b.top('distance', { now }).map((r) => r.name), ['driver_3', 'Ruben_OC']);
  assert.equal(b.snapshot({ now, me: 1 }).you.distance.rank, 2, 'the banned driver is not counted above you');
  assert.deepEqual(b.top('distance', { now, period: 'week' }).map((r) => [r.name, r.value]), [['driver_3', 198], ['Ruben_OC', 198]], 'a tie goes by name, case ignored');
  assert.throws(() => b.top('streak', { now }), /unknown kind/);
  assert.equal(b.snapshot({ now, period: 'nonsense' }).period, 'today');
  assert.deepEqual(KINDS, ['distance', 'speed', 'drive']);
});

test('forget() removes every row and the running state', () => {
  const db = new DatabaseSync(':memory:'), b = createBoard(db, { timerMs: 0 });
  drive(b, 1, start(T0 - 86400000), { v: 20, seconds: 10 });
  const a1 = drive(b, 1, start(), { v: 20, seconds: 10 });
  const a2 = drive(b, 2, start(), { v: 20, seconds: 10 });
  b.flush(1, a1.t); b.flush(2, a2.t);
  const count = () => Number(db.prepare('SELECT COUNT(*) AS n FROM board_days WHERE player = 1').get().n);
  assert.equal(count(), 2); assert.equal(b.live().players, 2);
  b.forget(1);
  assert.equal(count(), 0); assert.equal(b.live().players, 1);
  assert.deepEqual(b.top('distance', { now: a2.t, period: 'week' }).map((r) => r.name), ['driver_2']);
  // back from zero if they return
  const a3 = drive(b, 1, { t: a1.t, x: 0 }, { v: 20, seconds: 5 });
  assert.ok(near(read(b, 'distance', 1, a3.t), 98, 1));
});

test('a bot inside the relay\'s limits is capped: speed at the ceiling, distance at the ceiling rate, then at the daily ceiling', () => {
  const b = mk();
  const at = drive(b, 1, start(), { v: 199, seconds: 3600 });              // 36,000 poses, 19.9 m each: under 200 m/s and the 240 m/s jump rule
  const dist = read(b, 'distance', 1, at.t), speed = read(b, 'speed', 1, at.t);
  assert.ok(dist <= CEIL * 3600 + 2 * CEIL && dist >= CEIL * 3600 - 300, `${dist} m in an hour; the ceiling allows ${CEIL * 3600}`);
  assert.equal(speed, CEIL);
  // at 15 Hz (the most the relay accepts) the rate is the same
  const c = mk(); const at2 = drive(c, 1, start(), { v: 199, seconds: 60, hz: 15 });
  const d15 = read(c, 'distance', 1, at2.t);
  assert.ok(d15 <= CEIL * 60 + 2 * CEIL, `${d15} m in a minute at 15 Hz`);
  // the daily ceiling (3,000 km for real; 5 km here): the day stops growing
  const d = mk({ dayMaxM: 5000 }); const at3 = drive(d, 1, start(), { v: 100, seconds: 120 });   // 12 km attempted
  assert.equal(read(d, 'distance', 1, at3.t), 5000);
  assert.equal(d.limits.dayMaxM, 5000); assert.equal(b.limits.dayMaxM, 3_000_000); assert.equal(b.limits.speedCeilMs, CEIL);
});

test('writes are bounded: about one per player per 5 s plus the flushes, not one per pose', () => {
  const db = new DatabaseSync(':memory:'), b = createBoard(db, { timerMs: 0 });
  let a1 = start(), a2 = start();
  for (let i = 0; i < 60; i++) { a1 = drive(b, 1, a1, { v: 30, seconds: 1 }); a2 = drive(b, 2, a2, { v: 25, seconds: 1 }); }   // 1,200 poses in 60 s
  const w = b.live().writes;
  assert.ok(w >= 22 && w <= 26, `${w} writes for 1,200 poses from two drivers over a minute`);
  assert.equal(Number(db.prepare('SELECT total_changes() AS n').get().n), w, 'the counter is the database\'s own count');
  b.flush(1, a1.t); b.flush(2, a2.t);
  assert.equal(b.live().writes, w + 2);
  b.flush(1, a1.t); b.flushAll(a1.t);
  assert.equal(b.live().writes, w + 2, 'nothing new, nothing written');
  // a dropped state never shrinks a row: the flush adds distance and keeps the best speed and drive
  b.flushAll(a1.t + 11 * 60000);                                           // 11 minutes of silence: the states are dropped
  assert.equal(b.live().players, 0);
  const before = find(b.top('distance', { now: a1.t }), 1), driveBefore = find(b.top('drive', { now: a1.t }), 1);
  assert.ok(near(driveBefore, 60, 0.5), `the whole minute counts once the silence closed it: ${driveBefore} s`);
  const a3 = drive(b, 1, { t: a1.t + 11 * 60000, x: 0 }, { v: 10, seconds: 3 }); b.flush(1, a3.t);
  const after = find(b.top('distance', { now: a3.t }), 1);
  assert.ok(near(after - before, 29, 1), `${before} then ${after}`);
  assert.equal(find(b.top('speed', { now: a3.t }), 1), 30, 'the best speed stands');
  assert.equal(find(b.top('drive', { now: a3.t }), 1), driveBefore, 'the longest drive stands');
});

test('the snapshot is memoised for 2 s; a day-old board is not today\'s', () => {
  const b = mk();
  const at = drive(b, 1, start(), { v: 30, seconds: 3 }); b.flush(1, at.t);
  const s1 = b.snapshot({ now: at.t });
  const a2 = drive(b, 2, { t: at.t, x: 0 }, { v: 30, seconds: 3 }); b.flush(2, a2.t);
  assert.equal(b.snapshot({ now: at.t + 1000 }).distance.length, 1, 'within 2 s the memo answers');
  assert.equal(b.snapshot({ now: at.t + 2000 }).distance.length, 2, 'after 2 s the new driver is there');
  assert.equal(s1.distance.length, 1);
  assert.deepEqual(b.snapshot({ now: at.t + 86400000 }).distance, [], 'tomorrow starts empty');
  b.close();
});

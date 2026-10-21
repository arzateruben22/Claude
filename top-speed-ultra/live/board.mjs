// The online board: built only from what the live server itself observed.
//
// The relay accepts a pose about ten times a second from each driver and keeps the ones it believes (on the map, under
// 200 m/s, no jump over 240 m/s between two poses, every field a number; server.mjs onPose). This module turns those
// accepted poses, with the server's own clock, into three numbers per driver per day. Nothing the client says about
// itself is used: no scores, no streaks, no client time. Speed Survival streaks and near misses depend on computer
// traffic that exists only on the phone, so they are not here at all.
//
// THE THREE KINDS, per driver per Pacific day (America/Los_Angeles, daylight saving included)
//   distance  metres driven while connected, from displacement between consecutive accepted poses (x, z on the map).
//   speed     the best speed held for 3 seconds: over every 3 s window of one unbroken drive, the lowest reported
//             speed in the window, cross-checked against the ground covered in the window; the board keeps the best
//             window. A one-pose spike never counts; neither does a parked car reporting speed.
//   drive     the longest unbroken drive: consecutive accepted poses never more than GAP_S apart, and the car covered
//             at least STILL_M in every STILL_S window (parked counts as stopped). Its length runs from the first
//             pose that moved to the last pose that moved. GAP_S is 3 s because that is the relay's own freshness
//             window (a pose older than 3 s is not shown to anyone, and a ghost not heard of for 3 s leaves the
//             renderer): when the relay stops showing your car, you are not driving live.
//
// WHAT record() DOES WITH ONE POSE (the server calls it right after it accepts the pose, with the time it took it)
//   1. A pose older than, or as old as, the player's last one is ignored (server time only; there is no client time).
//   2. The Pacific day of the pose is found. A new day closes the old day's drive, writes the old day's row, and
//      starts fresh accumulators (the day's distance so far is read back from the row, for the ceiling).
//   3. If the previous pose is more than GAP_S old: a break. No distance for the step (a reconnect, a tab switch, a
//      restart), the drive closes, the speed window empties. The relay lets a client reappear anywhere after 5 s, so
//      this is also what stops a reconnect across the map from counting as a drive.
//   4. Otherwise the step's displacement d = hypot(dx, dz) is credited through a small token bucket: on a step that
//      moved the car, credit accrues at min(SPEED_CEIL, the larger of the two reported speeds) metres per second of
//      server time since the previous pose, the bucket never holds more than BUCKET_S seconds' worth at that rate,
//      and the step takes min(d, bucket). This is "cap each step by speed × dt" with two seconds of carry, so the
//      jitter and short stalls of 10 Hz poses over a phone network don't clip honest driving (a stall's poses arrive
//      in a burst and are paid from the carry), while over any stretch the credit never exceeds reported speed ×
//      elapsed time plus the carry. A teleport inside the relay's limits earns one step's worth while driving
//      steadily, and at most the carry. A car that reports speed while not moving banks nothing (the bucket fills
//      only on steps that moved), and a pose that moves the car while reporting speed 0 earns nothing. The day's
//      distance stops at DAY_MAX_M.
//   5. The speed window: the last ~3.2 s of samples (time, reported |speed|, credited distance so far). Once the
//      window spans 3 s inside one unbroken drive, held = min(lowest reported speed in the window, ground speed over
//      the window × 1.05 + 0.5 m/s, SPEED_CEIL). The day's speed is the best held.
//   6. The drive: a step that credited distance at a ground speed of 1 m/s or more (STILL_M over STILL_S) opens a
//      drive at the previous pose's time if none was open. Once the window lies inside the drive, a window in which
//      the car covered under STILL_M closes it, ending it where that window began (so creeping under 1 m/s is
//      stopped, before and after). A gap or midnight closes it at the last pose that moved. The
//      day's drive is the longest one. An open drive counts only as far as it is proven: to the start of the latest
//      window that showed movement (about 3 s behind), so a row written mid-drive never has to shrink.
//   7. The row is written when the player's running state is dirty and FLUSH_MS have passed since its last write
//      (so at most one write per player per FLUSH_MS, not one per pose), and on flush(), flushAll() and a day change.
//      flushAll() runs every 10 s on its own timer (and on close()): it closes the drive of anyone silent for GAP_S
//      (the next pose would break it anyway) and writes whoever is dirty, so a drive that just ended shows its full
//      length within about 10 s of the disconnect. flush() on a disconnect keeps the state, so a reconnect within
//      GAP_S continues the drive.
//
// CEILINGS (the guards against a client that stays inside the relay's physics)
//   SPEED_CEIL  110 m/s (246 mph): the fastest car in the showroom, the Rossini Corsa, is gear-capped at 103.5 m/s
//               (232 mph, src/game/cars.ts figures()); 6% over that. Speed above it is clamped, and distance credit
//               never accrues faster than it. Raise it (createBoard's speedCeilMs) when a faster car ships.
//   DAY_MAX_M   3,000 km (1,864 mi) a day: 7.5 h flat out in the fastest car, or 12 h at 157 mph. Past it a day's
//               distance stops growing.
//   A drive cannot outlast the day it is in (it is split at midnight), so it is at most 25 h.
//
// STORAGE
//   One table, board_days, one row per player per day: name, dist_m, top_ms, drive_ms, updated. No positions, no
//   times of day, no ids beyond the player id that keys the row (never returned). Running state lives in memory:
//   about 3 KB per connected player (the last pose, the bucket, a window of up to ~50 samples, the day's numbers).
//   flushAll() also drops the state of players idle for 10 minutes and deletes rows older than KEEP_DAYS (35 days).
//   A flush adds the unwritten distance to the row and keeps the greater speed and drive, so a restart or a dropped
//   state never shrinks a row, and a crash loses at most FLUSH_MS of driving.
//
// WHAT top() AND snapshot() RETURN
//   Rows of { rank, name, value } only: the public driver name (the one on the ghost's plate), never ids, emails
//   or positions. 'today' is the current Pacific day; 'week' is the last seven Pacific days (distance summed, speed
//   and drive the best). Zero rows are left out (connecting without driving puts nobody on the board). Ties go by
//   name, case ignored. When the database has the live server's players table, a driver whose account is banned or gone is hidden
//   and the name shown is the account's current one; a bare database (the tests) lists what was recorded.
//   snapshot() is memoised for 2 s, so a client hammering GET /api/board costs three queries every 2 s at most.
//
// FOR THE OWNER
//   Names are already filtered at sign-up (names.mjs); banning a driver (POST /admin/ban) hides them from the board
//   at once; deleting an account (forget) removes every row. What this cannot catch: a modified client that drives
//   exactly like a perfect driver (a straight line at the ceiling for hours) is indistinguishable from one by poses
//   alone; the ceilings bound what it can post (the fastest car's speed, 3,000 km a day), the lobby cap means it
//   occupies a visible slot under its name for hours, and a ban removes it. Poses are not checked against the road
//   network (the relay doesn't either), heading is not checked against the direction of travel, and elevation (y)
//   is not used. Decisions left to the owner are listed in the handoff report.

const TZ = 'America/Los_Angeles';
export const KINDS = ['distance', 'speed', 'drive'];
export const PERIODS = ['today', 'week'];
const GAP_S = 3, STILL_S = 3, STILL_M = 3;              // a drive breaks on a 3 s silence, or under 3 m covered in 3 s
const MOVE_MIN = STILL_M / STILL_S;                      // and opens at a ground speed of 1 m/s or more
const WIN_S = 3, WIN_KEEP_MS = 3200;                     // the sustained-speed window, and how much is kept to always span it
const BUCKET_S = 2;                                      // the distance bucket holds two seconds of credit at most (under GAP_S)
const GROUND_TOL = 1.05, GROUND_SLACK = 0.5;            // reported speed may exceed ground speed by this much (network jitter at the window's ends)
const IDLE_DROP_MS = 10 * 60 * 1000;                     // state of a player silent this long is written and dropped
const MEMO_MS = 2000;
const UNITS = { distance: 'm', speed: 'm/s', drive: 's' };

// the Pacific calendar day of an instant, 'YYYY-MM-DD'; cached per minute (a day or a DST change only turns on a minute)
const DAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
let dayMin = NaN, dayMemo = '';
export function dayKey(tMs) {
  const m = Math.floor(tMs / 60000);
  if (m === dayMin) return dayMemo;
  const p = {};
  for (const x of DAY_FMT.formatToParts(new Date(tMs))) p[x.type] = x.value;
  dayMin = m; dayMemo = `${p.year}-${p.month}-${p.day}`;
  return dayMemo;
}
// the first of the seven Pacific days ending on the one holding `now` (stepping back an hour at a time: a day is
// 23, 24 or 25 hours long)
export function weekSince(now) {
  const seen = new Set([dayKey(now)]);
  let t = now, key = '';
  while (seen.size < 7) { t -= 3600000; key = dayKey(t); seen.add(key); }
  return [...seen].sort()[0];
}

export function createBoard(db, { speedCeilMs = 110, dayMaxM = 3_000_000, flushMs = 5000, keepDays = 35, timerMs = 10000 } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_days (
      player INTEGER NOT NULL,
      day TEXT NOT NULL,                       -- Pacific calendar day, YYYY-MM-DD
      name TEXT NOT NULL DEFAULT '',           -- the public driver name as last seen
      dist_m REAL NOT NULL DEFAULT 0,          -- metres driven that day
      top_ms REAL NOT NULL DEFAULT 0,          -- the best speed held for 3 s, m/s
      drive_ms INTEGER NOT NULL DEFAULT 0,     -- the longest unbroken drive, ms
      updated INTEGER NOT NULL,                -- server time of the last write
      PRIMARY KEY (player, day)
    );
    CREATE INDEX IF NOT EXISTS board_days_day ON board_days(day);
  `);
  const q = {
    upsert: db.prepare(`INSERT INTO board_days (player, day, name, dist_m, top_ms, drive_ms, updated) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player, day) DO UPDATE SET name = COALESCE(NULLIF(excluded.name, ''), name), dist_m = dist_m + excluded.dist_m,
      top_ms = MAX(top_ms, excluded.top_ms), drive_ms = MAX(drive_ms, excluded.drive_ms), updated = excluded.updated`),
    dayDist: db.prepare('SELECT dist_m FROM board_days WHERE player = ? AND day = ?'),
    forget: db.prepare('DELETE FROM board_days WHERE player = ?'),
    sweep: db.prepare('DELETE FROM board_days WHERE day < ?'),
    hasPlayers: db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'players'"),
  };
  const AGG = { distance: 'SUM(b.dist_m)', speed: 'MAX(b.top_ms)', drive: 'MAX(b.drive_ms) / 1000.0' };
  // the ranking queries, with and without the live server's players table (which carries the ban flag and the current
  // name); the joined ones are prepared on first use, once that table is there
  const rank = {};
  for (const k of KINDS) {
    rank[k] = {
      bare: db.prepare(`SELECT b.name AS name, ${AGG[k]} AS value FROM board_days b WHERE b.day BETWEEN ? AND ? AND b.name != '' GROUP BY b.player HAVING value > 0 ORDER BY value DESC, name COLLATE NOCASE ASC LIMIT ?`),
      joined: null,
      mine: db.prepare(`SELECT ${AGG[k]} AS value FROM board_days b WHERE b.player = ? AND b.day BETWEEN ? AND ?`),
      above: db.prepare(`SELECT COUNT(*) AS n FROM (SELECT ${AGG[k]} AS value FROM board_days b WHERE b.day BETWEEN ? AND ? GROUP BY b.player HAVING value > ?)`),
      aboveJoined: null,
    };
  }
  function listed(k) {
    if (!q.hasPlayers.get()) return { list: rank[k].bare, above: rank[k].above };
    rank[k].joined ??= db.prepare(`SELECT p.name AS name, ${AGG[k]} AS value FROM board_days b JOIN players p ON p.id = b.player WHERE p.banned = 0 AND b.day BETWEEN ? AND ? GROUP BY b.player HAVING value > 0 ORDER BY value DESC, name COLLATE NOCASE ASC LIMIT ?`);
    rank[k].aboveJoined ??= db.prepare(`SELECT COUNT(*) AS n FROM (SELECT ${AGG[k]} AS value FROM board_days b JOIN players p ON p.id = b.player WHERE p.banned = 0 AND b.day BETWEEN ? AND ? GROUP BY b.player HAVING value > ?)`);
    return { list: rank[k].joined, above: rank[k].aboveJoined };
  }

  const states = new Map();          // player id -> running state
  const stats = { writes: 0, posesIn: 0, posesIgnored: 0 };
  const memo = new Map();            // period:limit -> { at, lists }

  function fresh(playerId, name, day) {
    return { id: playerId, name, day, last: null, bucket: 0, win: [], cum: 0,
      dist: 0, dayDist: Number(q.dayDist.get(playerId, day)?.dist_m || 0), top: 0, drive: 0, segStart: -1, movedAt: 0, proven: 0, dirty: false, flushedAt: 0 };
  }
  function closeDrive(s, end) {
    if (s.segStart < 0) return;
    s.drive = Math.max(s.drive, end - s.segStart); s.dirty = true; s.segStart = -1;
  }
  const driveSoFar = (s) => Math.max(s.drive, s.segStart >= 0 ? s.proven - s.segStart : 0);
  function write(s, t) {
    q.upsert.run(s.id, s.day, s.name, s.dist, s.top, Math.round(driveSoFar(s)), t);
    stats.writes++; s.dist = 0; s.dirty = false; s.flushedAt = t;
  }

  // one accepted pose ({ x, y, z, h, v, b } as server.mjs keeps it), at the server's time it was accepted; name is
  // the public driver name (c.name), stored with the row so the board can list names without ids
  function record(playerId, pose, tMs, name = '') {
    stats.posesIn++;
    if (!pose || !Number.isFinite(tMs) || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !Number.isFinite(pose.v)) { stats.posesIgnored++; return; }
    const t = tMs, x = pose.x, z = pose.z, vAbs = Math.abs(pose.v);
    let s = states.get(playerId);
    if (!s) { s = fresh(playerId, name, dayKey(t)); states.set(playerId, s); }
    else if (name) s.name = name;
    if (s.last && t <= s.last.t) { stats.posesIgnored++; return; }       // older than the last one, or the same instant
    const day = dayKey(t);
    if (day !== s.day) {                                                  // midnight in Orange County: close the day
      closeDrive(s, s.movedAt);
      if (s.dirty) write(s, t);
      const keep = { last: s.last, bucket: s.bucket, win: s.win, cum: s.cum, name: s.name };
      s = Object.assign(fresh(playerId, keep.name, day), { last: keep.last, bucket: keep.bucket, win: keep.win, cum: keep.cum });
      states.set(playerId, s);
      q.sweep.run(dayKey(t - keepDays * 86400000));
    }
    let step = 0, dt = 0;
    if (s.last) {
      dt = (t - s.last.t) / 1000;
      if (dt > GAP_S) { closeDrive(s, s.movedAt); s.bucket = 0; s.win.length = 0; }
      else {
        const d = Math.hypot(x - s.last.x, z - s.last.z);
        if (d > 0) {
          const rate = Math.min(speedCeilMs, Math.max(Math.abs(s.last.v), vAbs));
          s.bucket = Math.min(s.bucket + rate * dt, rate * BUCKET_S);
          step = Math.min(d, s.bucket, Math.max(0, dayMaxM - s.dayDist));
          s.bucket = Math.max(0, s.bucket - step);
        }
      }
    }
    if (step > 0) {
      s.cum += step; s.dist += step; s.dayDist += step; s.dirty = true;
      if (s.segStart < 0 && step >= MOVE_MIN * dt) s.segStart = s.last.t;
      s.movedAt = t;
    }
    // the sustained-speed window and the stopped check, over the same ~3 s of samples, once they lie inside the drive
    s.win.push({ t, v: vAbs, cum: s.cum });
    while (s.win.length && s.win[0].t < t - WIN_KEEP_MS) s.win.shift();
    const first = s.win[0], span = (t - first.t) / 1000;
    if (span >= WIN_S && s.segStart >= 0 && first.t >= s.segStart) {
      const covered = s.cum - first.cum;
      if (covered < STILL_M) closeDrive(s, first.t);
      else {
        s.proven = first.t;
        let minV = Infinity;
        for (const w of s.win) if (w.v < minV) minV = w.v;
        const held = Math.min(minV, (covered / span) * GROUND_TOL + GROUND_SLACK, speedCeilMs);
        if (held > s.top) { s.top = held; s.dirty = true; }
      }
    }
    s.last = { t, x, z, v: pose.v };
    if (s.dirty && t - s.flushedAt >= flushMs) write(s, t);
  }
  // write a player's running state now (on disconnect); the state stays, so a brief reconnect continues the drive
  function flush(playerId, tMs = Date.now()) {
    const s = states.get(playerId);
    if (s && s.dirty) write(s, tMs);
  }
  // close the drive of anyone silent for GAP_S, write everyone, drop the state of players silent for IDLE_DROP_MS,
  // and delete rows past the retention (on a timer, and to be called on shutdown)
  function flushAll(tMs = Date.now()) {
    for (const s of states.values()) {
      if (s.last && tMs - s.last.t > GAP_S * 1000) closeDrive(s, s.movedAt);
      if (s.dirty) write(s, tMs);
      if (!s.last || tMs - s.last.t > IDLE_DROP_MS) states.delete(s.id);
    }
    q.sweep.run(dayKey(tMs - keepDays * 86400000));
  }
  // account deletion: every row and the running state
  function forget(playerId) {
    states.delete(playerId);
    q.forget.run(playerId);
    memo.clear();
  }
  const bounds = (period, now) => { const today = dayKey(now); return [period === 'week' ? weekSince(now) : today, today]; };
  // the ranking for one kind: [{ rank, name, value }], value in metres, m/s or seconds
  function top(kind, { period = 'today', limit = 10, now = Date.now() } = {}) {
    if (!KINDS.includes(kind)) throw new Error('unknown kind: ' + kind);
    const [since, today] = bounds(period, now), lim = Math.max(1, Math.min(100, Math.round(limit) || 10));
    return listed(kind).list.all(since, today, lim).map((r, i) => ({ rank: i + 1, name: String(r.name), value: round(kind, Number(r.value)) }));
  }
  // the whole board for GET /api/board; with `me` (the caller's own player id, from their session) adds where they stand
  function snapshot({ period = 'today', limit = 10, now = Date.now(), me = 0 } = {}) {
    const p = PERIODS.includes(period) ? period : 'today';
    const [since, today] = bounds(p, now), key = p + ':' + limit;
    let m = memo.get(key);
    if (!m || now - m.at >= MEMO_MS || m.at > now) {
      m = { at: now, lists: {} };
      for (const k of KINDS) m.lists[k] = top(k, { period: p, limit, now });
      memo.set(key, m);
    }
    const out = { day: today, since, period: p, tz: TZ, at: now, units: UNITS, ...m.lists };
    if (me) {
      const you = {};
      for (const k of KINDS) {
        const v = Number(rank[k].mine.get(me, since, today)?.value || 0);
        you[k] = v > 0 ? { rank: Number(listed(k).above.get(since, today, v).n) + 1, value: round(k, v) } : null;
      }
      out.you = you;
    }
    return out;
  }
  const round = (kind, v) => kind === 'speed' ? Math.round(v * 10) / 10 : Math.round(v);
  const timer = timerMs > 0 ? setInterval(() => flushAll(), timerMs) : null;
  if (timer && typeof timer.unref === 'function') timer.unref();
  function close() { if (timer) clearInterval(timer); flushAll(); }
  const live = () => ({ players: states.size, ...stats });

  return { record, flush, flushAll, forget, top, snapshot, dayKey, weekSince, close, live, limits: { speedCeilMs, dayMaxM, gapS: GAP_S, stillS: STILL_S, stillM: STILL_M, flushMs, keepDays } };
}

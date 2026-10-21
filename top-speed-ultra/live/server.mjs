// OC Ultra: the live server.
//
// One Node process, no build step, one dependency (ws). It does three things:
//   1. Accounts: sign up, log in, log out. Passwords are hashed with scrypt; sessions are random tokens stored hashed.
//   2. The lobby: at most MAX_PLAYERS drivers online at once (25 to start). Everyone past that waits in line, in
//      order, and is let in as slots free up. The cap can be raised while it runs (POST /admin/cap).
//   3. The relay: each driver sends their car's pose about ten times a second; the server checks it is sane and
//      sends every driver the poses of the drivers near them, ten times a second.
//
// It never scores anything: scores, credits and progress stay on the player's device, as before. A pose the server
// doesn't believe (off the map, faster than any car here, a jump) is dropped, and a player who keeps sending them is
// disconnected. There is no chat.
//
// Run:  MAX_PLAYERS=25 PORT=8791 node server.mjs      (see README.md and deploy/ for the real thing, behind Caddy)

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { createNow } from './now.mjs';
import { nameProblem } from './names.mjs';
import { verdict } from './ladder.mjs';

// ------------------------------------------------------------------------------------------------ configuration
const PORT = Number(process.env.PORT || 8791);
const HOST = process.env.HOST || '127.0.0.1';          // Caddy sits in front; bind to 0.0.0.0 only without it
const DB_PATH = process.env.DB_PATH || new URL('./data/live.db', import.meta.url).pathname;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';      // empty: the admin endpoints are off
const PUBLIC_DIR = process.env.PUBLIC_DIR || '';        // serve the built game from here at / (optional)
const PUBLIC_INDEX = process.env.PUBLIC_INDEX || 'index.html';   // the page served at / (the desks use dist/top-speed-ultra.html)
const CAP_MIN = 1, CAP_MAX = 500;
// the realistic mode's feeds (now.mjs): 'nws' / 'tomtom' for the real ones, 'mock' for a typical day, 'off'
const NOW_WEATHER = process.env.NOW_WEATHER || 'off', NOW_TRAFFIC = process.env.NOW_TRAFFIC || 'off', TOMTOM_KEY = process.env.TOMTOM_KEY || '';
let MAX_PLAYERS = clampInt(process.env.MAX_PLAYERS, CAP_MIN, CAP_MAX, 25);

const SESSION_DAYS = 30;
const TICK_MS = 100;                 // the relay's snapshot period (10 Hz)
const STATE_MAX_HZ = 15;             // a client may send poses up to this often; more are dropped
const NEAR_M = 3000;                 // a driver hears about drivers within this many metres
const NEAR_MAX = 32;                 // and about this many at most, the nearest first (keeps each snapshot's size flat)
const ROSTER_MS = 2000, ROSTER_MAX = 200;   // every 2 s, where everyone is on the map (coarse, nearest 200), for the map dots and the who's-on list
const WORLD_M = 120000;              // OC fits well inside ±120 km of the map origin
const SPEED_MAX = 200;               // m/s: nothing here does 447 mph
const JUMP_MAX = 240;                // m/s implied by two consecutive poses: beyond this the pose is a teleport
const STRIKES_MAX = 40;              // bad poses before a disconnect
const HELLO_MS = 8000;               // a socket must identify itself this fast
const PING_MS = 20000, DEAD_MS = 45000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000, LOGIN_MAX = 10;   // wrong passwords per name
const IP_MAX = clampInt(process.env.IP_MAX, 1, 1e6, 40);  // sign-ups or log-ins per IP in that window (a shared phone network needs room)
const BODY_MAX = 4096;

function clampInt(v, lo, hi, dflt) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; }

// ------------------------------------------------------------------------------------------------ the database
mkdirSync(new URL('.', 'file://' + DB_PATH).pathname, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,          -- lower-cased, for uniqueness and log-in
    email TEXT,                             -- optional; for password resets once email sending exists (TODO)
    pass TEXT NOT NULL,                     -- scrypt$N$salt$hash, base64url
    created INTEGER NOT NULL,
    last_seen INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    hash TEXT PRIMARY KEY,                  -- sha256 of the token the client holds
    player INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    last_seen INTEGER
  );
  CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player);
`);
db.exec(`CREATE TABLE IF NOT EXISTS hourly (
  hour TEXT PRIMARY KEY, peak INTEGER, cap INTEGER, queued_peak INTEGER, waited INTEGER, admitted INTEGER,
  poses_in INTEGER, poses_dropped INTEGER, bytes_out INTEGER, cpu_ms INTEGER, rss_mb INTEGER)`);
// added after the first release: an older database gets the column
try { db.exec('ALTER TABLE players ADD COLUMN banned INTEGER NOT NULL DEFAULT 0'); } catch { /* already there */ }
const q = {
  byName: db.prepare('SELECT id, name, pass, banned FROM players WHERE name_key = ?'),
  ban: db.prepare('UPDATE players SET banned = ? WHERE name_key = ?'),
  dropAll: db.prepare('DELETE FROM sessions WHERE player = ?'),
  byId: db.prepare('SELECT id, name, pass FROM players WHERE id = ?'),
  setPass: db.prepare('UPDATE players SET pass = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM players WHERE id = ?'),
  insert: db.prepare('INSERT INTO players (name, name_key, email, pass, created) VALUES (?, ?, ?, ?, ?)'),
  seen: db.prepare('UPDATE players SET last_seen = ? WHERE id = ?'),
  newSession: db.prepare('INSERT INTO sessions (hash, player, created, expires) VALUES (?, ?, ?, ?)'),
  session: db.prepare('SELECT s.player AS id, p.name AS name, s.expires AS expires, p.banned AS banned FROM sessions s JOIN players p ON p.id = s.player WHERE s.hash = ?'),
  touch: db.prepare('UPDATE sessions SET last_seen = ? WHERE hash = ?'),
  drop: db.prepare('DELETE FROM sessions WHERE hash = ?'),
  sweep: db.prepare('DELETE FROM sessions WHERE expires < ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM players'),
};

// ------------------------------------------------------------------------------------------------ passwords and tokens
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const b64 = (buf) => Buffer.from(buf).toString('base64url');
function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${SCRYPT.N}$${b64(salt)}$${b64(scryptSync(pw, salt, 32, SCRYPT))}`;
}
// a hash of a password nobody has: a failed log-in for an unknown name costs the same time as a wrong password
const DUMMY = hashPassword(b64(randomBytes(12)));
function checkPassword(pw, stored) {
  const [kind, N, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64url');
  const got = scryptSync(pw, Buffer.from(salt, 'base64url'), want.length, { ...SCRYPT, N: Number(N) });
  return want.length === got.length && timingSafeEqual(want, got);
}
const tokenHash = (t) => createHash('sha256').update(String(t)).digest('base64url');
function issueSession(playerId) {
  const token = b64(randomBytes(32)), now = Date.now();
  q.newSession.run(tokenHash(token), playerId, now, now + SESSION_DAYS * 86400000);
  return token;
}
function sessionFor(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const h = tokenHash(token), s = q.session.get(h);
  if (!s) return null;
  if (s.expires < Date.now() || s.banned) { q.drop.run(h); return null; }
  q.touch.run(Date.now(), h);
  return { id: Number(s.id), name: s.name, hash: h };
}
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

// ------------------------------------------------------------------------------------------------ rate limits
const attempts = new Map();          // key -> [timestamps]
function limited(key, max = LOGIN_MAX) {
  const now = Date.now(), list = (attempts.get(key) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  attempts.set(key, list);
  if (list.length >= max) return true;
  list.push(now);
  return false;
}
setInterval(() => { const now = Date.now(); for (const [k, l] of attempts) if (!l.some((t) => now - t < LOGIN_WINDOW_MS)) attempts.delete(k); q.sweep.run(now); }, 60000).unref();

// ------------------------------------------------------------------------------------------------ HTTP
const started = Date.now();
const stats = { peak: 0, admitted: 0, queuedEver: 0, posesIn: 0, posesDropped: 0, bytesOut: 0, kicked: 0 };
// this hour's record (the ladder): the peaks this hour, and the running totals as they stood when the hour began
const hourly = { key: '', peak: 0, queuedPeak: 0, base: { ...stats }, cpu: process.cpuUsage(), rss: 0 };
const hourKey = () => new Date().toISOString().slice(0, 13);
function recordHour() {
  const key = hourKey();
  if (key !== hourly.key) { if (hourly.key) writeHour(); Object.assign(hourly, { key, peak: online.size, queuedPeak: queue.length, base: { ...stats }, cpu: process.cpuUsage(), rss: 0 }); }
  hourly.peak = Math.max(hourly.peak, online.size); hourly.queuedPeak = Math.max(hourly.queuedPeak, queue.length);
  hourly.rss = Math.max(hourly.rss, Math.round(process.memoryUsage().rss / 1048576));
}
function writeHour() {
  const c = process.cpuUsage(hourly.cpu), b = hourly.base;
  db.prepare('INSERT OR REPLACE INTO hourly VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(hourly.key, hourly.peak, MAX_PLAYERS, hourly.queuedPeak,
    stats.queuedEver - b.queuedEver, stats.admitted - b.admitted, stats.posesIn - b.posesIn, stats.posesDropped - b.posesDropped, stats.bytesOut - b.bytesOut, Math.round((c.user + c.system) / 1000), hourly.rss);
}
const hoursSince = (days) => db.prepare('SELECT hour, peak, cap, queued_peak AS queuedPeak, waited, poses_in AS posesIn, poses_dropped AS posesDropped, bytes_out AS bytesOut, cpu_ms AS cpuMs, rss_mb AS rssMb FROM hourly WHERE hour >= ? ORDER BY hour')
  .all(new Date(Date.now() - days * 86400000).toISOString().slice(0, 13));
const PUBLIC_TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', webmanifest: 'application/manifest+json', woff2: 'font/woff2' };

function send(res, code, body, extra = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', ...extra });
  res.end(data);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > BODY_MAX) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
const ipOf = (req) => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';
// behind a local proxy that doesn't say who the client is, every request comes from loopback: one shared bucket would
// lock everyone out after a few sign-ups, so the per-address limit only applies to an address that names a client
const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;
const ipLimited = (req) => { const ip = ipOf(req); return !LOOPBACK.test(ip) && limited('ip:' + ip, IP_MAX); };
const bearer = (req) => { const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || '')); return m ? m[1] : ''; };
const now = createNow({ weather: NOW_WEATHER, traffic: NOW_TRAFFIC, tomtomKey: TOMTOM_KEY, log: (ev, d) => log(ev, d) });
const health = () => ({ ok: true, feeds: { weather: now.state.weather.source, traffic: now.state.traffic.source, trends: now.state.trends.list.length }, online: online.size, cap: MAX_PLAYERS, queued: queue.length, players: Number(q.count.get().n), uptimeS: Math.round((Date.now() - started) / 1000), ...stats });

// a static file, gzipped once per version (the game page is about 3.7 MB, 1.2 MB gzipped), with an ETag so a phone
// that has it already gets a 304
const fileCache = new Map();
function sendFile(req, res, file, type) {
  const st = statSync(file), key = file + ':' + st.mtimeMs + ':' + st.size;
  let c = fileCache.get(file);
  if (!c || c.key !== key) { const raw = readFileSync(file); c = { key, raw, gz: gzipSync(raw, { level: 9 }), etag: '"' + createHash('sha1').update(raw).digest('base64url').slice(0, 16) + '"' }; fileCache.set(file, c); }
  const head = { 'content-type': type, 'cache-control': 'no-cache', etag: c.etag, vary: 'accept-encoding' };
  if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, head); return res.end(); }
  const gz = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = gz ? c.gz : c.raw;
  res.writeHead(200, { ...head, 'content-length': body.length, ...(gz ? { 'content-encoding': 'gzip' } : {}) });
  return res.end(req.method === 'HEAD' ? undefined : body);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x'), path = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, '');
  try {
    if (path === '/health' || path === '/api/health') return send(res, 200, health());
    if (path === '/api/now') return send(res, 200, now.snapshot());
    if (path === '/api/ladder') { recordHour(); writeHour(); return send(res, 200, verdict(hoursSince(8), MAX_PLAYERS)); }
    if (path === '/api/traffic') return send(res, 200, now.snapshot().traffic);
    if (path === '/api/signup' && req.method === 'POST') {
      if (!LOOPBACK.test(ipOf(req)) && limited('signup:' + ipOf(req), IP_MAX)) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' });
      const b = await readJson(req);
      const name = String(b.name || '').trim(), pw = String(b.password || ''), email = b.email ? String(b.email).trim().toLowerCase() : null;
      if (!NAME_RE.test(name)) return send(res, 400, { error: 'A name is 3 to 16 letters, numbers or underscores.' });
      const bad = nameProblem(name);
      if (bad) return send(res, 400, { error: bad });
      if (pw.length < 8 || pw.length > 128) return send(res, 400, { error: 'A password is at least 8 characters.' });
      if (email && !EMAIL_RE.test(email)) return send(res, 400, { error: 'That email address doesn\'t look right.' });
      if (b.over13 !== true) return send(res, 400, { error: 'You must be 13 or older to make an account.' });
      if (q.byName.get(name.toLowerCase())) return send(res, 409, { error: 'That name is taken.' });
      const r = q.insert.run(name, name.toLowerCase(), email, hashPassword(pw), Date.now());
      const id = Number(r.lastInsertRowid);
      return send(res, 200, { token: issueSession(id), player: { id, name } });
    }
    if (path === '/api/login' && req.method === 'POST') {
      const b = await readJson(req);
      const name = String(b.name || '').trim(), pw = String(b.password || '');
      if (ipLimited(req) || limited('name:' + name.toLowerCase())) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' });
      const p = q.byName.get(name.toLowerCase());
      const ok = checkPassword(pw, p ? p.pass : DUMMY) && !!p;
      if (!ok) return send(res, 401, { error: 'Wrong name or password.' });
      if (p.banned) return send(res, 403, { error: 'This account is suspended.' });
      q.seen.run(Date.now(), p.id);
      return send(res, 200, { token: issueSession(Number(p.id)), player: { id: Number(p.id), name: p.name } });
    }
    if (path === '/api/logout' && req.method === 'POST') {
      const s = sessionFor(bearer(req));
      if (s) q.drop.run(s.hash);
      return send(res, 200, { ok: true });
    }
    // change the password (the old one is needed); every other session ends, this one gets a fresh token
    if (path === '/api/password' && req.method === 'POST') {
      const s = sessionFor(bearer(req));
      if (!s) return send(res, 401, { error: 'Not logged in.' });
      if (limited('pw:' + s.id)) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' });
      const b = await readJson(req), p = q.byId.get(s.id), next = String(b.next || '');
      if (!checkPassword(String(b.current || ''), p.pass)) return send(res, 401, { error: 'The current password is wrong.' });
      if (next.length < 8 || next.length > 128) return send(res, 400, { error: 'A password is at least 8 characters.' });
      q.setPass.run(hashPassword(next), s.id); q.dropAll.run(s.id);
      log('password', { id: s.id });
      return send(res, 200, { token: issueSession(s.id), player: { id: s.id, name: s.name } });
    }
    // delete the account and everything stored about it (the password is needed); the name becomes free again
    if (path === '/api/delete' && req.method === 'POST') {
      const s = sessionFor(bearer(req));
      if (!s) return send(res, 401, { error: 'Not logged in.' });
      if (limited('pw:' + s.id)) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' });
      const b = await readJson(req), p = q.byId.get(s.id);
      if (!checkPassword(String(b.password || ''), p.pass)) return send(res, 401, { error: 'The password is wrong.' });
      const c = online.get(s.id) || queue.find((o) => o.player && o.player.id === s.id);
      if (c) kick(c, 'Account deleted');
      q.remove.run(s.id);                                     // sessions go with it (ON DELETE CASCADE)
      log('deleted', { id: s.id });
      return send(res, 200, { ok: true });
    }
    if (path === '/api/me') {
      const s = sessionFor(bearer(req));
      if (!s) return send(res, 401, { error: 'Not logged in.' });
      return send(res, 200, { player: { id: s.id, name: s.name }, online: online.size, cap: MAX_PLAYERS, queued: queue.length });
    }
    if (path === '/admin/ban' && req.method === 'POST') {
      if (!ADMIN_TOKEN || bearer(req) !== ADMIN_TOKEN) return send(res, 404, 'not found');
      const b = await readJson(req), key = String(b.name || '').trim().toLowerCase(), on = b.banned !== false;
      const p = q.byName.get(key);
      if (!p) return send(res, 404, { error: 'No such driver.' });
      q.ban.run(on ? 1 : 0, key);
      if (on) {
        q.dropAll.run(p.id);                                     // signed out everywhere
        const c = online.get(Number(p.id)) || queue.find((o) => o.player && o.player.id === Number(p.id));
        if (c) kick(c, 'Account suspended');
      }
      log(on ? 'ban' : 'unban', { id: Number(p.id), name: p.name });
      return send(res, 200, { name: p.name, banned: on });
    }
    if (path === '/admin/cap' && req.method === 'POST') {
      if (!ADMIN_TOKEN || bearer(req) !== ADMIN_TOKEN) return send(res, 404, 'not found');
      const b = await readJson(req), cap = clampInt(b.cap, CAP_MIN, CAP_MAX, NaN);
      if (!Number.isFinite(cap)) return send(res, 400, { error: `cap must be ${CAP_MIN} to ${CAP_MAX}` });
      MAX_PLAYERS = cap; log('cap', { cap });
      admitFromQueue();
      return send(res, 200, health());
    }
    if (PUBLIC_DIR && (req.method === 'GET' || req.method === 'HEAD')) {
      const rel = path === '/' ? '/' + PUBLIC_INDEX : path;
      const file = PUBLIC_DIR + rel.replace(/\.\./g, '');
      const ext = file.split('.').pop();
      if (PUBLIC_TYPES[ext] && existsSync(file)) return sendFile(req, res, file, PUBLIC_TYPES[ext]);
    }
    return send(res, 404, 'not found');
  } catch (e) {
    return send(res, 400, { error: e.message === 'too big' || e.message === 'bad json' ? 'Bad request.' : 'Something went wrong.' });
  }
}

// ------------------------------------------------------------------------------------------------ the lobby
// online: player id -> client; queue: clients waiting, oldest first
const online = new Map();
const queue = [];
let nextClientId = 1;

function makeClient(ws, ip) {
  return { ws, ip, cid: nextClientId++, player: null, name: '', car: 'rossini-gt', paint: 0xa80d10, admitted: false, alive: true, lastPing: Date.now(),
    pose: null, poseAt: 0, poseTimes: [], strikes: 0, seen: new Set() };
}
const sendTo = (c, msg) => { if (c.ws.readyState === 1) { const s = JSON.stringify(msg); stats.bytesOut += s.length; c.ws.send(s); } };
const broadcast = (msg, except) => { for (const c of online.values()) if (c !== except) sendTo(c, msg); };
const roster = (c) => ({ id: c.player.id, name: c.name, car: c.car, paint: c.paint });

function admit(c) {
  c.admitted = true;
  online.set(c.player.id, c);
  stats.admitted++; stats.peak = Math.max(stats.peak, online.size); hourly.peak = Math.max(hourly.peak, online.size);
  sendTo(c, { t: 'welcome', id: c.player.id, name: c.name, cap: MAX_PLAYERS, online: online.size, peers: [...online.values()].filter((o) => o !== c).map(roster) });
  broadcast({ t: 'join', ...roster(c), online: online.size }, c);
  log('join', { id: c.player.id, name: c.name, online: online.size });
}
function admitFromQueue() {
  while (online.size < MAX_PLAYERS && queue.length) admit(queue.shift());
  queue.forEach((c, i) => sendTo(c, { t: 'queued', position: i + 1, cap: MAX_PLAYERS, online: online.size }));
}
function leave(c, why) {
  const qi = queue.indexOf(c);
  if (qi >= 0) queue.splice(qi, 1);
  if (c.admitted && online.get(c.player.id) === c) {
    online.delete(c.player.id);
    broadcast({ t: 'leave', id: c.player.id, online: online.size });
    log('leave', { id: c.player.id, name: c.name, why, online: online.size });
  }
  c.admitted = false;
  admitFromQueue();
}
// close codes: 4000 means don't come back on your own (logged out, signed in elsewhere, bad data); 4001 means the
// server is restarting, so the game reconnects by itself a few seconds later
function kick(c, why, code = 4000) { stats.kicked++; sendTo(c, { t: 'bye', why, retry: code === 4001 }); leave(c, why); try { c.ws.close(code, why); } catch { /* closing */ } }

function onHello(c, m) {
  const s = sessionFor(m.token);
  if (!s) return kick(c, 'Not logged in');
  c.player = s; c.name = s.name;
  if (typeof m.car === 'string' && /^[a-z0-9-]{1,24}$/.test(m.car)) c.car = m.car;
  if (Number.isInteger(m.paint) && m.paint >= 0 && m.paint <= 0xffffff) c.paint = m.paint;
  const other = online.get(s.id);
  if (other && other !== c) kick(other, 'Signed in somewhere else');     // one car per account
  const qd = queue.find((o) => o.player && o.player.id === s.id);
  if (qd && qd !== c) kick(qd, 'Signed in somewhere else');
  if (online.size < MAX_PLAYERS) admit(c);
  else { queue.push(c); stats.queuedEver++; sendTo(c, { t: 'queued', position: queue.length, cap: MAX_PLAYERS, online: online.size }); log('queued', { id: s.id, name: s.name, position: queue.length }); }
}
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
function onPose(c, m) {
  stats.posesIn++;
  const now = Date.now();
  c.poseTimes = c.poseTimes.filter((t) => now - t < 1000);
  if (c.poseTimes.length >= STATE_MAX_HZ) { stats.posesDropped++; return; }     // too chatty: dropped, no strike
  c.poseTimes.push(now);
  const ok = finite(m.x) && finite(m.y) && finite(m.z) && finite(m.h) && finite(m.v)
    && Math.abs(m.x) < WORLD_M && Math.abs(m.z) < WORLD_M && m.y > -200 && m.y < 3000 && Math.abs(m.v) <= SPEED_MAX;
  let jump = false;
  if (ok && c.pose) {
    const dt = Math.max(0.05, (now - c.poseAt) / 1000);
    jump = Math.hypot(m.x - c.pose.x, m.z - c.pose.z) / dt > JUMP_MAX && now - c.poseAt < 5000;   // after 5 s away, any place is fine (a restart)
  }
  if (!ok || jump) {
    stats.posesDropped++;
    if (++c.strikes >= STRIKES_MAX) kick(c, 'Bad data');
    return;
  }
  c.strikes = Math.max(0, c.strikes - 1);
  c.pose = { x: m.x, y: m.y, z: m.z, h: m.h, v: m.v, b: m.b ? 1 : 0 };
  c.poseAt = now;
}

// a honk: heard by the drivers within HONK_M of the one honking, at most one every HONK_MS each
const HONK_M = 500, HONK_MS = 1500;
function onHonk(c) {
  const now = Date.now();
  if (!c.pose || now - (c.honkAt || 0) < HONK_MS) return;
  c.honkAt = now;
  for (const o of online.values()) if (o !== c && o.pose && Math.hypot(o.pose.x - c.pose.x, o.pose.z - c.pose.z) <= HONK_M) sendTo(o, { t: 'e', k: 'honk', id: c.player.id });
}

// the relay: every TICK_MS, each driver gets the poses of the drivers near them: within NEAR_M, the nearest NEAR_MAX
// at most, so a snapshot never grows past a fixed size however full the lobby gets. Rows are built once a tick.
function tick() {
  const now = Date.now(), fresh = [];
  for (const o of online.values()) {
    if (!o.pose || now - o.poseAt > 3000) continue;
    const p = o.pose;
    fresh.push({ o, x: p.x, z: p.z, row: [o.player.id, r1(p.x), r1(p.y), r1(p.z), r3(p.h), r1(p.v), p.b] });
  }
  for (const c of online.values()) {
    let near = [];
    for (const f of fresh) {
      if (f.o === c) continue;
      const d = c.pose ? Math.hypot(f.x - c.pose.x, f.z - c.pose.z) : 0;
      if (d <= NEAR_M) near.push({ d, row: f.row });
    }
    if (near.length > NEAR_MAX) near = near.sort((a, b) => a.d - b.d).slice(0, NEAR_MAX);
    sendTo(c, { t: 'p', n: near.map((n) => n.row), online: online.size, cap: MAX_PLAYERS });
  }
}
// the roster: every ROSTER_MS, each driver gets where every other driver is (to the metre), wherever on the map
function rosterTick() {
  const now = Date.now(), fresh = [];
  for (const o of online.values()) if (o.pose && now - o.poseAt < 10000) fresh.push(o);
  for (const c of online.values()) {
    let rows = fresh.filter((o) => o !== c).map((o) => ({ d: c.pose ? Math.hypot(o.pose.x - c.pose.x, o.pose.z - c.pose.z) : 0, row: [o.player.id, Math.round(o.pose.x), Math.round(o.pose.z)] }));
    if (rows.length > ROSTER_MAX) rows = rows.sort((a, b) => a.d - b.d).slice(0, ROSTER_MAX);
    sendTo(c, { t: 'r', n: rows.map((r) => r.row) });
  }
}
const r1 = (v) => Math.round(v * 10) / 10, r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------------------------------------ sockets
const server = createServer(handle);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });
wss.on('connection', (ws, req) => {
  const c = makeClient(ws, ipOf(req));
  const helloTimer = setTimeout(() => { if (!c.player) kick(c, 'No hello'); }, HELLO_MS);
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') { if (!c.player) { clearTimeout(helloTimer); onHello(c, m); } return; }
    if (!c.admitted) return;
    if (m.t === 's') onPose(c, m);
    else if (m.t === 'e' && m.k === 'honk') onHonk(c);
    else if (m.t === 'leave') kick(c, 'Left');
  });
  ws.on('pong', () => { c.lastPing = Date.now(); });
  ws.on('close', () => { clearTimeout(helloTimer); leave(c, 'closed'); });
  ws.on('error', () => { clearTimeout(helloTimer); leave(c, 'error'); });
});
setInterval(() => {
  const now = Date.now();
  for (const c of [...online.values(), ...queue]) {
    if (now - c.lastPing > DEAD_MS) { kick(c, 'Timed out'); continue; }
    try { c.ws.ping(); } catch { /* closing */ }
  }
}, PING_MS).unref();
setInterval(tick, TICK_MS).unref();
setInterval(rosterTick, ROSTER_MS).unref();
setInterval(() => { recordHour(); writeHour(); }, 60000).unref();
setInterval(recordHour, 5000).unref();

function log(ev, data) { console.log(JSON.stringify({ at: new Date().toISOString(), ev, ...data })); }
now.start();
server.listen(PORT, HOST, () => log('listen', { host: HOST, port: PORT, cap: MAX_PLAYERS, db: DB_PATH, players: Number(q.count.get().n) }));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('stop', { sig }); try { recordHour(); writeHour(); } catch { /* best effort */ } for (const c of [...online.values(), ...queue]) kick(c, 'Server restarting', 4001); server.close(); db.close(); process.exit(0); });

// The live server's tests: accounts, the cap and the waiting line, the relay, and what it refuses.
//   node --test test/
// Each file starts its own server on a free port with a throw-away database.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CAP = 25;
let proc, base, ws, dir;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'oc-live-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  proc = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MAX_PLAYERS: String(CAP), DB_PATH: join(dir, 'test.db'), ADMIN_TOKEN: 'admin-secret', IP_MAX: '1000' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  base = `http://127.0.0.1:${port}`; ws = `ws://127.0.0.1:${port}/ws`;
  await new Promise((resolve, reject) => { proc.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) resolve(); }); proc.on('exit', reject); });
});
after(() => { proc.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); });

const post = async (path, body, token) => {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const get = async (path, token) => { const r = await fetch(base + path, { headers: token ? { authorization: 'Bearer ' + token } : {} }); return { status: r.status, body: await r.json() }; };
const signup = async (name) => { const r = await post('/api/signup', { name, password: 'correct horse battery', over13: true }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.token; };

// a test client: connects, says hello, and keeps the last message of each type
function connect(token, extra = {}) {
  const sock = new WebSocket(ws);
  const c = { sock, got: {}, all: [], closed: null, closeCode: 0 };
  sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); c.got[m.t] = m; c.all.push(m); });
  sock.addEventListener('close', (e) => { c.closed = e.reason; c.closeCode = e.code; });
  c.ready = new Promise((resolve) => sock.addEventListener('open', () => { sock.send(JSON.stringify({ t: 'hello', token, ...extra })); resolve(); }));
  c.until = async (t, timeout = 4000) => { const t0 = Date.now(); while (!c.got[t]) { if (Date.now() - t0 > timeout) throw new Error(`no ${t} within ${timeout} ms (saw ${c.all.map((m) => m.t).join(',')})`); await sleep(20); } return c.got[t]; };
  c.send = (m) => sock.send(JSON.stringify(m));
  return c;
}

test('sign-up rules: name, password, age gate, uniqueness', async () => {
  assert.equal((await post('/api/signup', { name: 'ab', password: 'longenough1', over13: true })).status, 400);
  assert.equal((await post('/api/signup', { name: 'has space', password: 'longenough1', over13: true })).status, 400);
  assert.equal((await post('/api/signup', { name: 'short_pw', password: 'short', over13: true })).status, 400);
  assert.equal((await post('/api/signup', { name: 'no_age', password: 'longenough1' })).status, 400);
  assert.equal((await post('/api/signup', { name: 'Ruben_OC', password: 'longenough1', over13: true })).status, 200);
  assert.equal((await post('/api/signup', { name: 'ruben_oc', password: 'longenough1', over13: true })).status, 409, 'names are unique ignoring case');
});

test('log in, me, log out', async () => {
  const bad = await post('/api/login', { name: 'Ruben_OC', password: 'wrong password' });
  assert.equal(bad.status, 401);
  const unknown = await post('/api/login', { name: 'nobody_here', password: 'wrong password' });
  assert.equal(unknown.status, 401, 'an unknown name reads the same as a wrong password');
  const ok = await post('/api/login', { name: 'ruben_oc', password: 'longenough1' });
  assert.equal(ok.status, 200);
  assert.match(ok.body.token, /^[A-Za-z0-9_-]{40,}$/);
  const me = await get('/api/me', ok.body.token);
  assert.equal(me.status, 200); assert.equal(me.body.player.name, 'Ruben_OC'); assert.equal(me.body.cap, CAP);
  assert.equal((await post('/api/logout', {}, ok.body.token)).status, 200);
  assert.equal((await get('/api/me', ok.body.token)).status, 401, 'a logged-out token is dead');
  assert.equal((await get('/api/me', 'made-up-token-that-is-long-enough')).status, 401);
});

test('log-in is rate limited per name', async () => {
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await post('/api/login', { name: 'limited_one', password: 'nope nope nope' })).status;
  assert.equal(last, 429);
});

test('the socket refuses a bad token and a silent connection', async () => {
  const c = connect('not-a-real-token-at-all-really');
  await c.ready; await c.until('bye');
  assert.equal(c.got.bye.why, 'Not logged in');
});

test(`the cap: ${CAP} drive, the rest wait in line in order, and move up when someone leaves`, async () => {
  const tokens = [];
  for (let i = 0; i < CAP + 5; i++) tokens.push(await signup('driver_' + i));
  const clients = [];
  for (let i = 0; i < CAP + 5; i++) { const c = connect(tokens[i], { car: 'rossini-gt', paint: 0xa80d10 }); await c.ready; await (i < CAP ? c.until('welcome') : c.until('queued')); clients.push(c); }
  const h = (await get('/health')).body;
  assert.equal(h.online, CAP); assert.equal(h.queued, 5); assert.equal(h.peak, CAP);
  assert.equal(clients[CAP].got.queued.position, 1); assert.equal(clients[CAP + 4].got.queued.position, 5);
  assert.equal(clients[CAP - 1].got.welcome.peers.length, CAP - 1, 'the last one in sees everyone before');
  // one driver leaves: the first in line is let in, the others move up
  clients[3].send({ t: 'leave' });
  await clients[CAP].until('welcome');
  await sleep(100);
  assert.equal(clients[CAP + 1].got.queued.position, 1);
  assert.equal((await get('/health')).body.online, CAP);
  // raising the cap at run time lets the line in
  assert.equal((await post('/admin/cap', { cap: CAP + 10 }, 'wrong')).status, 404, 'no admin token, no admin endpoint');
  const up = await post('/admin/cap', { cap: CAP + 10 }, 'admin-secret');
  assert.equal(up.status, 200); assert.equal(up.body.cap, CAP + 10);
  for (let i = CAP + 1; i < CAP + 5; i++) await clients[i].until('welcome');
  assert.equal((await get('/health')).body.online, CAP + 4);
  for (const c of clients) c.sock.close();
  await sleep(200);
  assert.equal((await get('/health')).body.online, 0);
});

test('the relay: near drivers see each other, far ones do not, bad poses are dropped', async () => {
  await post('/admin/cap', { cap: CAP }, 'admin-secret');
  const [a, b, far] = await Promise.all([signup('relay_a'), signup('relay_b'), signup('relay_far')]);
  const A = connect(a), B = connect(b), F = connect(far);
  await Promise.all([A.ready, B.ready, F.ready]); await Promise.all([A.until('welcome'), B.until('welcome'), F.until('welcome')]);
  const idA = A.got.welcome.id, idB = B.got.welcome.id;
  A.send({ t: 's', x: 1000, y: 20, z: -500, h: 1.2, v: 44 });
  B.send({ t: 's', x: 1100, y: 20, z: -520, h: 1.1, v: 40, b: 1 });
  F.send({ t: 's', x: 30000, y: 20, z: 30000, h: 0, v: 30 });
  await sleep(350);
  const pb = B.all.filter((m) => m.t === 'p' && m.n.length).at(-1);
  assert.ok(pb, 'B got a snapshot with A in it');
  assert.deepEqual(pb.n.find((r) => r[0] === idA).slice(0, 7), [idA, 1000, 20, -500, 1.2, 44, 0]);
  const pf = F.all.filter((m) => m.t === 'p').at(-1);
  assert.equal(pf.n.length, 0, 'the far driver sees nobody within 3 km');
  const pa = A.all.filter((m) => m.t === 'p' && m.n.length).at(-1);
  assert.equal(pa.n.find((r) => r[0] === idB)[6], 1, 'the brake light travels');
  // a teleport and nonsense are dropped, and the last good pose stands
  const h0 = (await get('/health')).body.posesDropped;
  A.send({ t: 's', x: 90000, y: 20, z: -500, h: 1.2, v: 44 });       // 89 km in a tenth of a second
  A.send({ t: 's', x: 1000, y: 20, z: -500, h: 1.2, v: 500 });       // 1,118 mph
  A.send({ t: 's', x: 'NaN', y: 20, z: -500, h: 1.2, v: 44 });
  await sleep(250);
  assert.equal((await get('/health')).body.posesDropped - h0, 3);
  const again = B.all.filter((m) => m.t === 'p' && m.n.length).at(-1);
  assert.equal(again.n.find((r) => r[0] === idA)[1], 1000);
  // a second log-in on the same account replaces the first
  const A2 = connect(a); await A2.ready; await A2.until('welcome');
  await A.until('bye');
  assert.equal(A.got.bye.why, 'Signed in somewhere else');
  for (const c of [A2, B, F]) c.sock.close();
});

test('behind a local proxy with no client address, sign-ups are not throttled as one shared address', async () => {
  // every request in this suite comes from 127.0.0.1 with no X-Forwarded-For: well past IP_MAX would be refused if
  // loopback counted as one client
  for (let i = 0; i < 12; i++) assert.equal((await post('/api/signup', { name: 'proxy_' + i, password: 'correct horse battery', over13: true })).status, 200);
});

test('a snapshot carries the nearest 32 drivers at most, nearest first', async () => {
  await post('/admin/cap', { cap: 60 }, 'admin-secret');
  const me = connect(await signup('crowd_me')); await me.ready; await me.until('welcome');
  me.send({ t: 's', x: 0, y: 10, z: 0, h: 0, v: 30 });
  const crowd = [];
  for (let i = 0; i < 40; i++) {
    const c = connect(await signup('crowd_' + i)); await c.ready; await c.until('welcome');
    c.send({ t: 's', x: 10 + i * 20, y: 10, z: 0, h: 0, v: 30 });      // 10 m, 30 m, ... 790 m away
    crowd.push(c);
  }
  // signing 40 up takes a few seconds (scrypt), longer than a pose stays fresh: everyone sends again
  me.send({ t: 's', x: 0, y: 10, z: 0, h: 0, v: 30 });
  crowd.forEach((c, i) => c.send({ t: 's', x: 10 + i * 20, y: 10, z: 0, h: 0, v: 30 }));
  await sleep(350);
  const last = me.all.filter((m) => m.t === 'p').at(-1);
  assert.equal(last.n.length, 32, `${last.n.length} rows`);
  const xs = last.n.map((r) => r[1]).sort((a, b) => a - b);
  assert.equal(xs[0], 10); assert.equal(xs[31], 10 + 31 * 20, 'the 32 nearest, the 8 farthest left out');
  for (const c of [me, ...crowd]) c.sock.close();
  await sleep(200);
  await post('/admin/cap', { cap: 25 }, 'admin-secret');
});

test('a restart closes sockets with a code the game reconnects on', async () => {
  // a second server of its own, so stopping it doesn't touch the others' tests
  const dir2 = mkdtempSync(join(tmpdir(), 'oc-live-r-')), port = 26000 + Math.floor(Math.random() * 4000);
  const p2 = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir2, 'r.db') }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => p2.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) r(); }));
  const r = await fetch(`http://127.0.0.1:${port}/api/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'restart_me', password: 'correct horse battery', over13: true }) });
  const { token } = await r.json();
  const sock = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const got = [];
  const closed = new Promise((res) => sock.addEventListener('close', (e) => res(e.code)));
  sock.addEventListener('message', (e) => got.push(JSON.parse(e.data)));
  await new Promise((res) => sock.addEventListener('open', res));
  sock.send(JSON.stringify({ t: 'hello', token }));
  while (!got.some((m) => m.t === 'welcome')) await sleep(20);
  p2.kill('SIGTERM');
  assert.equal(await closed, 4001);
  assert.deepEqual(got.find((m) => m.t === 'bye'), { t: 'bye', why: 'Server restarting', retry: true });
  rmSync(dir2, { recursive: true, force: true });
});

test('sign-up refuses a bad or reserved name', async () => {
  assert.deepEqual((await post('/api/signup', { name: 'Big_Ass', password: 'correct horse battery', over13: true })).body, { error: 'Pick a different name.' });
  assert.deepEqual((await post('/api/signup', { name: 'Admin', password: 'correct horse battery', over13: true })).body, { error: 'That name is reserved.' });
  assert.equal((await post('/api/signup', { name: 'Cockpit_Cam', password: 'correct horse battery', over13: true })).status, 200);
});

test('a ban kicks the driver off, ends every session, refuses log-in; an unban lets them back', async () => {
  const token = await signup('banned_one');
  const c = connect(token); await c.ready; await c.until('welcome');
  assert.equal((await post('/admin/ban', { name: 'banned_one' }, 'wrong')).status, 404);
  const r = await post('/admin/ban', { name: 'Banned_One' }, 'admin-secret');
  assert.deepEqual(r.body, { name: 'banned_one', banned: true });
  await c.until('bye');
  assert.equal(c.got.bye.why, 'Account suspended');
  assert.equal((await get('/api/me', token)).status, 401, 'the old token is dead');
  assert.equal((await post('/api/login', { name: 'banned_one', password: 'correct horse battery' })).status, 403);
  await post('/admin/ban', { name: 'banned_one', banned: false }, 'admin-secret');
  assert.equal((await post('/api/login', { name: 'banned_one', password: 'correct horse battery' })).status, 200);
});

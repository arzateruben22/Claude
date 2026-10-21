// The security review's findings (2026-10-21), each proven fixed. A server started as it runs behind Tailscale
// Funnel or Caddy: TRUST_PROXY on, small limits so they are quick to hit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect as tcp } from 'node:net';

let proc, base, port, dir;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'oc-hard-'));
  mkdirSync(join(dir, 'pub')); writeFileSync(join(dir, 'pub', 'index.html'), '<!doctype html>ok');
  writeFileSync(join(dir, 'outside.json'), '{"secret":1}'); symlinkSync(join(dir, 'outside.json'), join(dir, 'pub', 'link.json'));
  port = 27000 + Math.floor(Math.random() * 3000);
  proc = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir, 'h.db'), TRUST_PROXY: '1', IP_MAX: '6', SOCKETS_PER_IP: '3', IDLE_MS: '1500', QUEUE_MAX: '2', MAX_PLAYERS: '1', ADMIN_TOKEN: 'tok', PUBLIC_DIR: join(dir, 'pub') },
    stdio: ['ignore', 'pipe', 'inherit'] });
  base = `http://127.0.0.1:${port}`;
  await new Promise((r) => proc.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) r(); }));
});
after(() => { proc.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); });

const post = async (path, body, { ip = '10.0.0.1', token, xff } = {}) => {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': xff ?? ip, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const alive = async () => (await fetch(base + '/health')).ok;
// the lobby holds 1 here: wait until the last test's sockets have gone
const empty = async () => { for (let i = 0; i < 300; i++) { const h = await (await fetch(base + '/health')).json(); if (h.online === 0 && h.queued === 0) return; await sleep(50); } throw new Error('the lobby never emptied'); };
const signup = async (name, ip) => { const r = await post('/api/signup', { name, password: 'correct horse battery', over13: true }, { ip }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.token; };
function sock(token, ip) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { 'x-forwarded-for': ip } });
  const c = { ws, all: [], code: 0 };
  ws.addEventListener('message', (e) => c.all.push(JSON.parse(e.data)));
  ws.addEventListener('close', (e) => { c.code = e.code; });
  c.open = new Promise((r) => ws.addEventListener('open', () => { if (token) ws.send(JSON.stringify({ t: 'hello', token })); r(); }));
  c.until = async (t, ms = 4000) => { const t0 = Date.now(); while (!c.all.some((m) => m.t === t)) { if (Date.now() - t0 > ms) throw new Error('no ' + t + ' (saw ' + c.all.map((m) => m.t) + ', code ' + c.code + ')'); await sleep(20); } return c.all.find((m) => m.t === t); };
  return c;
}
const raw = (line) => new Promise((resolve) => { const s = tcp(port, '127.0.0.1', () => s.write(line + '\r\nHost: x\r\n\r\n')); let out = ''; s.on('data', (d) => (out += d)); s.on('close', () => resolve(out)); s.on('error', () => resolve(out)); setTimeout(() => { s.destroy(); resolve(out); }, 1500); });

test('1. malformed request targets get a 400 and the server stays up', async () => {
  for (const t of ['//[', '//%zz', '//a:99999/', 'http://[']) { const r = await raw(`GET ${t} HTTP/1.1`); assert.match(r, /^HTTP\/1\.1 400/, t); }
  assert.ok(await alive());
});
test('2. password hashing stays off the event loop: health answers fast during 20 log-ins', async () => {
  await signup('hash_load', '10.1.0.1');
  const logins = Array.from({ length: 20 }, (_, i) => post('/api/login', { name: 'nobody_' + i, password: 'x'.repeat(10) }, { ip: '10.2.0.' + i }));
  await sleep(30);
  const t0 = Date.now(); assert.ok(await alive()); const ms = Date.now() - t0;
  await Promise.all(logins);
  assert.ok(ms < 150, `/health took ${ms} ms`);
});
test('3. wrong passwords from elsewhere can\'t lock a driver out', async () => {
  await signup('locked_out', '10.3.0.1');
  for (let i = 0; i < 12; i++) await post('/api/login', { name: 'locked_out', password: 'wrong guess ' + i }, { ip: '10.4.0.' + i });
  assert.equal((await post('/api/login', { name: 'locked_out', password: 'correct horse battery' }, { ip: '10.3.0.1' })).status, 200);
  // but ten wrong from one address does stop that address
  for (let i = 0; i < 10; i++) await post('/api/login', { name: 'locked_out', password: 'wrong ' + i }, { ip: '10.5.0.1' });
  assert.equal((await post('/api/login', { name: 'locked_out', password: 'correct horse battery' }, { ip: '10.5.0.1' })).status, 429);
});
test('4. the address is the proxy\'s last X-Forwarded-For entry; none means refused; IPv6 counts by /64', async () => {
  assert.equal((await post('/api/signup', { name: 'no_header', password: 'correct horse battery', over13: true }, { xff: '' })).status, 400);
  let last = 0;
  for (let i = 0; i < 8; i++) last = (await post('/api/signup', { name: 'forged_' + i, password: 'correct horse battery', over13: true }, { xff: `127.0.0.${i}, 9.9.9.9` })).status;
  assert.equal(last, 429, 'a forged first entry doesn\'t dodge the limit');
  for (let i = 0; i < 8; i++) last = (await post('/api/signup', { name: 'six_' + i, password: 'correct horse battery', over13: true }, { xff: `2001:db8:1:2::${i + 1}` })).status;
  assert.equal(last, 429, 'one /64 is one client');
});
test('5. a driver who sits still loses the spot to someone waiting; one address holds 3 sockets at most', async () => {
  await empty();
  const [ta, tb] = [await signup('idle_a', '10.6.0.1'), await signup('idle_b', '10.6.0.2')];
  const a = sock(ta, '10.6.0.1'); await a.open; await a.until('welcome');
  const b = sock(tb, '10.6.0.2'); await b.open; await b.until('queued');
  await b.until('welcome', 8000);
  assert.equal(a.code, 4002);
  const many = [sock(null, '10.7.0.1'), sock(null, '10.7.0.1'), sock(null, '10.7.0.1'), sock(null, '10.7.0.1')];
  await Promise.all(many.map((m) => m.open));
  await sleep(300);
  assert.deepEqual(many.map((m) => m.code), [0, 0, 0, 4000]);
  for (const m of [b, ...many]) m.ws.close();
});
test('8. admin endpoints refuse anything that came through the proxy, even with the token', async () => {
  assert.equal((await post('/admin/cap', { cap: 5 }, { token: 'tok', xff: '1.2.3.4' })).status, 404);
  const local = await fetch(base + '/admin/cap', { method: 'POST', headers: { authorization: 'Bearer tok', 'content-type': 'application/json' }, body: '{"cap":1}' });
  assert.equal(local.status, 200);
  assert.equal((await fetch(base + '/api/ladder', { headers: { 'x-forwarded-for': '1.2.3.4' } })).status, 404, 'the ladder is local only');
});
test('11. the line has a length; past it, "full"', async () => {
  await empty();
  const toks = [];
  for (let i = 0; i < 4; i++) toks.push(await signup('line_' + i, '10.8.0.' + i));
  const cs = toks.map((t, i) => sock(t, '10.8.0.' + i));
  for (const c of cs) { await c.open; await sleep(80); }
  await sleep(400);
  const states = cs.map((c) => c.all.find((m) => m.t === 'welcome') ? 'online' : c.all.find((m) => m.t === 'queued') ? 'queued' : c.all.find((m) => m.t === 'bye')?.why);
  assert.deepEqual(states, ['online', 'queued', 'queued', 'The line is full. Try again soon.']);
  for (const c of cs) c.ws.close();
});
test('12. logging out ends the live socket', async () => {
  await empty();
  const t = await signup('logout_live', '10.9.0.1');
  const c = sock(t, '10.9.0.1'); await c.open; await c.until('welcome', 6000).catch(() => c.until('queued'));
  await post('/api/logout', {}, { token: t, ip: '10.9.0.1' });
  const bye = await c.until('bye'); assert.equal(bye.why, 'Logged out');
});
test('15. a symlink out of the public folder is not served', async () => {
  assert.equal((await fetch(base + '/link.json')).status, 404);
  assert.equal((await fetch(base + '/')).status, 200);
});

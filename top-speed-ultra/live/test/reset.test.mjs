// Password reset by email (MAIL_MODE=log writes the mail to the log, where this test reads the code).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let proc, base, dir, logs = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function start(env) {
  const port = 29000 + Math.floor(Math.random() * 900);
  const p = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir, Math.random() + '.db'), ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  p.stdout.on('data', (d) => { logs += d; });
  return new Promise((r) => p.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) r({ p, base: `http://127.0.0.1:${port}` }); }));
}
before(async () => { dir = mkdtempSync(join(tmpdir(), 'oc-reset-')); ({ p: proc, base } = await start({ MAIL_MODE: 'log' })); });
after(() => { proc.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); });
const post = async (b, path, body, token) => { const r = await fetch(b + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const lastCode = () => { const m = [...logs.matchAll(/"ev":"mail".*?is (\d{6})\./g)]; return m.length ? m.at(-1)[1] : null; };

test('a code goes to the account\'s email; the right code sets a new password and ends the old sessions', async () => {
  const s = await post(base, '/api/signup', { name: 'forgetful', password: 'old password 1', email: 'f@example.com', over13: true });
  const r = await post(base, '/api/reset/request', { name: 'Forgetful' });
  assert.deepEqual([r.status, r.body.ok], [200, true]);
  await sleep(100);
  const code = lastCode(); assert.match(code, /^\d{6}$/);
  assert.match(logs, /"to":"f@example.com"/);
  const wrong = code === '000000' ? '000001' : '000000';
  assert.equal((await post(base, '/api/reset/confirm', { name: 'forgetful', code: wrong, next: 'new password 22' })).status, 400);
  const ok = await post(base, '/api/reset/confirm', { name: 'forgetful', code, next: 'new password 22' });
  assert.equal(ok.status, 200); assert.ok(ok.body.token);
  assert.equal((await fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + s.body.token } })).status, 401, 'old session ended');
  assert.equal((await post(base, '/api/login', { name: 'forgetful', password: 'new password 22' })).status, 200);
  assert.equal((await post(base, '/api/reset/confirm', { name: 'forgetful', code, next: 'again again 3' })).status, 400, 'a code works once');
});
test('the same answer for a name with no email and a name that doesn\'t exist; no mail is sent', async () => {
  await post(base, '/api/signup', { name: 'no_email', password: 'some password 1', over13: true });
  const before = logs.length;
  const a = await post(base, '/api/reset/request', { name: 'no_email' }), b = await post(base, '/api/reset/request', { name: 'nobody_at_all' });
  assert.deepEqual(a.body, b.body);
  await sleep(100);
  assert.ok(!logs.slice(before).includes('"ev":"mail"'));
});
test('five wrong codes end the code', async () => {
  await post(base, '/api/signup', { name: 'guesser', password: 'some password 1', email: 'g@example.com', over13: true });
  await post(base, '/api/reset/request', { name: 'guesser' }); await sleep(100);
  const code = lastCode();
  for (let i = 0; i < 5; i++) await post(base, '/api/reset/confirm', { name: 'guesser', code: String((Number(code) + 1 + i) % 1000000).padStart(6, '0'), next: 'new password 22' });
  assert.equal((await post(base, '/api/reset/confirm', { name: 'guesser', code, next: 'new password 22' })).status, 400);
});
test('the account email can be set or cleared with the password', async () => {
  const s = (await post(base, '/api/signup', { name: 'mailer', password: 'some password 1', over13: true })).body.token;
  assert.equal((await post(base, '/api/email', { email: 'm@example.com', password: 'wrong one 1' }, s)).status, 401);
  assert.equal((await post(base, '/api/email', { email: 'not an email', password: 'some password 1' }, s)).status, 400);
  assert.deepEqual((await post(base, '/api/email', { email: 'M@Example.com', password: 'some password 1' }, s)).body, { ok: true, email: 'm@example.com' });
  const me = await (await fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + s } })).json();
  assert.equal(me.player.hasEmail, true); assert.equal(me.mail, true);
});
test('with no mail set up, the server says so', async () => {
  const { p, base: b2 } = await start({});
  try {
    const r = await post(b2, '/api/reset/request', { name: 'anyone' });
    assert.equal(r.body.mail, false); assert.match(r.body.error, /isn't set up/);
    assert.equal((await (await fetch(b2 + '/health')).json()).feeds.mail, false);
  } finally { p.kill('SIGTERM'); }
});

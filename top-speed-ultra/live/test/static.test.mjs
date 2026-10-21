// The game page served by the live server: the index name, gzip, the ETag, HEAD, and no path escapes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

let proc, base, dir;
const page = '<!doctype html><title>OC Ultra</title>' + 'x'.repeat(200000);
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'oc-static-'));
  writeFileSync(join(dir, 'top-speed-ultra.html'), page);
  writeFileSync(join(dir, 'secret.env'), 'TOKEN=nope');
  const port = 25000 + Math.floor(Math.random() * 5000);
  proc = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir, 's.db'), PUBLIC_DIR: dir, PUBLIC_INDEX: 'top-speed-ultra.html' }, stdio: ['ignore', 'pipe', 'inherit'] });
  base = `http://127.0.0.1:${port}`;
  await new Promise((r) => proc.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) r(); }));
});
after(() => { proc.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); });

test('/ serves the game page, gzipped when asked, with an ETag that answers 304', async () => {
  const plain = await fetch(base + '/', { headers: { 'accept-encoding': 'identity' } });
  assert.equal(plain.status, 200); assert.match(plain.headers.get('content-type'), /text\/html/);
  assert.equal(await plain.text(), page);
  // fetch() decompresses on its own; ask with node:http semantics instead via a raw request
  const { request } = await import('node:http');
  const raw = await new Promise((resolve) => request(base + '/', { headers: { 'accept-encoding': 'gzip' } }, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ res, body: Buffer.concat(c) })); }).end());
  assert.equal(raw.res.headers['content-encoding'], 'gzip');
  assert.ok(raw.body.length < page.length / 20, `${raw.body.length} bytes gzipped of ${page.length}`);
  assert.equal(gunzipSync(raw.body).toString(), page);
  const etag = plain.headers.get('etag');
  const again = await fetch(base + '/', { headers: { 'if-none-match': etag } });
  assert.equal(again.status, 304);
  const head = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
});

test('only known file types are served, and .. can\'t climb out', async () => {
  assert.equal((await fetch(base + '/secret.env')).status, 404);
  assert.equal((await fetch(base + '/../../etc/passwd')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/%2e%2e/etc/hostname')).status, 404);
});

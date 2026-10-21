// A load test: N pretend drivers on one server, each sending poses at 10 Hz from a spread of places on the map,
// for S seconds. Prints what the server relayed and how much CPU it used. Run it on the machine that will host it
// to see how far the cap can go there:
//   node test/load.mjs 100 20
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const N = Number(process.argv[2] || 50), S = Number(process.argv[3] || 15);
const dir = mkdtempSync(join(tmpdir(), 'oc-load-')), port = 23000 + Math.floor(Math.random() * 10000), base = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MAX_PLAYERS: String(N), IP_MAX: '100000', DB_PATH: join(dir, 'load.db') }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => proc.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) r(); }));
const cpu = () => { try { const f = require('node:fs').readFileSync(`/proc/${proc.pid}/stat`, 'utf8').split(' '); return (Number(f[13]) + Number(f[14])) / 100; } catch { return NaN; } };
const require = (await import('node:module')).createRequire(import.meta.url);
const t0 = Date.now(), c0 = cpu();
const clients = [];
let received = 0, rows = 0;
for (let i = 0; i < N; i++) {
  const r = await fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'load_' + i, password: 'correct horse battery', over13: true }) });
  const { token } = await r.json();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  // a few clusters a kilometre or two across, like drivers spread along a freeway
  const c = { ws, x: (i % 5) * 2500 + Math.random() * 1500, z: Math.random() * 1500, h: Math.random() * 6.28, v: 30 + Math.random() * 30, online: false };
  ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'hello', token, car: 'rossini-gt', paint: 0xa80d10 })));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'welcome') c.online = true; if (m.t === 'p') { received++; rows += m.n.length; } });
  clients.push(c);
}
await new Promise((r) => setTimeout(r, 1500));
const signupS = (Date.now() - t0) / 1000;
const ticker = setInterval(() => { for (const c of clients) { if (!c.online) continue; c.x += Math.sin(c.h) * c.v * 0.1; c.z += Math.cos(c.h) * c.v * 0.1; c.ws.send(JSON.stringify({ t: 's', x: c.x, y: 20, z: c.z, h: c.h, v: c.v })); } }, 100);
const t1 = Date.now(), c1 = cpu();
await new Promise((r) => setTimeout(r, S * 1000));
clearInterval(ticker);
const secs = (Date.now() - t1) / 1000, used = cpu() - c1;
const h = await (await fetch(base + '/health')).json();
console.log(JSON.stringify({ drivers: N, online: clients.filter((c) => c.online).length, seconds: Math.round(secs), signupS: Math.round(signupS * 10) / 10,
  serverCpuPct: Math.round((used / secs) * 1000) / 10, snapshotsPerS: Math.round(received / secs), peerRowsPerS: Math.round(rows / secs), avgPeersSeen: Math.round((rows / Math.max(1, received)) * 10) / 10,
  outMBperMin: Math.round((h.bytesOut / secs) * 60 / 1e6 * 10) / 10, posesIn: h.posesIn, dropped: h.posesDropped, rssMB: Math.round(Number(require('node:fs').readFileSync(`/proc/${proc.pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]) / 1024) }));
for (const c of clients) c.ws.close();
proc.kill('SIGTERM');
rmSync(dir, { recursive: true, force: true });

// The Ultra graphics tier's entitlement (decision 15), end to end: grant, revoke, restore. Three parts, nothing real
// contacted:
//   the server: the real create-checkout and stripe-webhook functions (index.ts, types stripped by Node) against a
//     throwaway local Postgres with every migration, through a small stand-in for Supabase's REST API that runs the
//     functions' requests as the service role and a player's requests as `authenticated` with that player's id, under
//     row-level security, as Supabase does; Stripe's API is answered here;
//   the game in a live build: the game's own store code (src/store, bundled with the esbuild the project already has
//     through Vite), its Supabase URL pointed at that stand-in, so Restore purchases reads the rows the webhook wrote;
//   the game in a test-mode build: the 4242 test card grants it on the device, signing out and in restores it, and
//     nothing leaves the "browser".
//
//   node server/supabase/tests/ultra-entitlement.mjs   (needs initdb, pg_ctl and psql: PG_BIN or /usr/lib/postgresql/16/bin)
//
// The live build is checked twice: as the catalog is (graphics-ultra 'hook', so a live build keeps Ultra unlocked for
// everyone and live Stripe keys refuse to sell it), and with that one status patched to 'ready' in the bundle (the
// owner's go-ahead), where an account without it is locked and draws High.
import { execFile, execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { chownSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const fnDir = join(here, '..', 'functions');
const bin = process.env.PG_BIN ?? '/usr/lib/postgresql/16/bin';
if (!existsSync(join(bin, 'initdb'))) { console.log(`SKIP: no Postgres at ${bin} (set PG_BIN)`); process.exit(3); }

const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`); };
const SKU = 'graphics-ultra', ENT = 'graphics-ultra';
const catalog = JSON.parse(readFileSync(join(root, 'src/store/catalog.json'), 'utf8'));
const ultraSku = catalog.find((s) => s.sku === SKU);
if (!ultraSku) { console.log(`FAIL: no ${SKU} sku in src/store/catalog.json`); process.exit(1); }

// ------------------------------------------------------------------------------------------- a throwaway Postgres
const tmp = mkdtempSync(join(tmpdir(), 'oc-ultra-'));
const port = 56000 + Math.floor(Math.random() * 900);
// Postgres refuses to run as root: as root, the server runs as the postgres user (and owns the throwaway directory)
const asRoot = process.getuid?.() === 0;
if (asRoot) { const uid = Number(execFileSync('id', ['-u', 'postgres'], { encoding: 'utf8' })), gid = Number(execFileSync('id', ['-g', 'postgres'], { encoding: 'utf8' })); chownSync(tmp, uid, gid); }
const pg = (args) => (asRoot
  ? execFileSync('runuser', ['-u', 'postgres', '--', join(bin, args[0]), ...args.slice(1)], { stdio: 'pipe' })
  : execFileSync(join(bin, args[0]), args.slice(1), { stdio: 'pipe' }));
const psqlBin = existsSync(join(bin, 'psql')) ? join(bin, 'psql') : 'psql';
let started = false;
const bundleDir = mkdtempSync(join(tmpdir(), 'oc-ultra-client-'));
process.on('exit', () => {
  if (started) { try { pg(['pg_ctl', '-D', join(tmp, 'data'), 'stop', '-m', 'fast']); } catch { /* already down */ } }
  rmSync(tmp, { recursive: true, force: true });
  rmSync(bundleDir, { recursive: true, force: true });
});
pg(['initdb', '-D', join(tmp, 'data'), '-A', 'trust', '-U', 'postgres']);
pg(['pg_ctl', '-D', join(tmp, 'data'), '-o', `-p ${port} -k ${tmp} -c listen_addresses=`, '-l', join(tmp, 'log'), '-w', 'start']);
started = true;
const PSQL = ['-h', tmp, '-p', String(port), '-U', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
const sqlSync = (sql, db = 'store') => execFileSync(psqlBin, [...PSQL, '-d', db, '-c', sql], { encoding: 'utf8', stdio: 'pipe' }).trim();
const sqlAsync = (sql) => new Promise((res) => execFile(psqlBin, [...PSQL, '-d', 'store', '-c', sql], { encoding: 'utf8' }, (err, out, errOut) => res(err ? { ok: false, error: (errOut || err.message).trim() } : { ok: true, out: out.trim() })));
const sqlErr = (sql) => { try { sqlSync(sql); return ''; } catch (e) { return String(e.stderr ?? e.message).trim(); } };
sqlSync('create database store', 'postgres');
const apply = (f) => execFileSync(psqlBin, [...PSQL, '-d', 'store', '-f', f], { stdio: 'pipe' });
apply(join(here, 'stub-supabase.sql'));
const migrations = readdirSync(join(here, '..', 'migrations')).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
for (let i = 0; i < 2; i++) for (const m of migrations) apply(join(here, '..', 'migrations', m));
check(`migrations run twice (${migrations.join(', ')})`, true);

const U = { A: '11111111-1111-1111-1111-111111111111', B: '22222222-2222-2222-2222-222222222222', C: '33333333-3333-3333-3333-333333333333' };
const TOKENS = { 'tok-A': U.A, 'tok-B': U.B, 'tok-C': U.C };
sqlSync(`insert into auth.users values ('${U.C}', 'c@example.com');
  insert into profiles (id, is_13_plus) values ('${U.A}', true), ('${U.B}', true), ('${U.C}', false)`);

// ------------------------------------------------------------------------------------------- a PostgREST stand-in
// The requests the functions and the game's store code make: GET with eq./is./in. filters, select and order; POST
// with on_conflict and Prefer resolution; PATCH with filters; POST rpc/<function>. Like Supabase, a request carrying a
// player's access token runs as `authenticated` with request.jwt.claims (row-level security applies); one with the
// service key runs as service_role; anything else as anon. GET /auth/v1/user answers for a player's token.
const SERVICE = 'service-role-test', ANON = 'anon-test';
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad identifier ' + s); return s; };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const dq = (json) => { if (json.includes('$J$')) throw new Error('payload holds $J$'); return `$J$${json}$J$`; };
function where(q) {
  const out = [];
  for (const [k, v] of q) {
    if (['select', 'order', 'on_conflict', 'limit'].includes(k)) continue;
    const col = ident(k);
    if (v.startsWith('eq.')) out.push(`${col} = ${lit(v.slice(3))}`);
    else if (v === 'is.null') out.push(`${col} is null`);
    else if (v.startsWith('in.(') && v.endsWith(')')) out.push(`${col} in (${v.slice(4, -1).split(',').map((x) => lit(x.replace(/^"|"$/g, ''))).join(', ')})`);
    else throw new Error(`filter ${k}=${v}`);
  }
  return out.length ? out.join(' and ') : 'true';
}
const orderBy = (q) => { const o = q.get('order'); if (!o) return ''; const [c, d = 'asc'] = o.split('.'); return ` order by ${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}`; };
const restLog = [];
const rest = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data)); };
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? '';
  const player = TOKENS[bearer] ?? null;
  const role = player ? 'authenticated' : req.headers.apikey === SERVICE ? 'service_role' : 'anon';
  restLog.push({ method: req.method, path: u.pathname, search: u.search, role, player });
  try {
    if (u.pathname === '/auth/v1/user') return player ? send(200, { id: player, email: `${Object.keys(U).find((k) => U[k] === player).toLowerCase()}@example.com` }) : send(401, { msg: 'invalid token' });
    if (!u.pathname.startsWith('/rest/v1/')) return send(404, { message: 'not stood in: ' + u.pathname });
    const name = u.pathname.replace(/^\/rest\/v1\//, '');
    let sql, status = 200, empty = false;
    if (name.startsWith('rpc/')) {
      const args = Object.entries(body ?? {}).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ');
      sql = `select to_json(public.${ident(name.slice(4))}(${args}))`;
    } else if (req.method === 'GET') {
      const cols = (u.searchParams.get('select') ?? '*').split(',').map((c) => (c === '*' ? c : ident(c))).join(', ');
      sql = `select coalesce(json_agg(t), '[]'::json) from (select ${cols} from public.${ident(name)} where ${where(u.searchParams)}${orderBy(u.searchParams)}) t`;
    } else if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body], cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].map(ident);
      const conflict = u.searchParams.get('on_conflict'), pref = req.headers.prefer ?? '';
      const on = !conflict ? '' : pref.includes('ignore-duplicates') ? ` on conflict (${conflict.split(',').map(ident).join(', ')}) do nothing`
        : ` on conflict (${conflict.split(',').map(ident).join(', ')}) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`;
      sql = `insert into public.${ident(name)} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_recordset(null::public.${ident(name)}, ${dq(JSON.stringify(rows))}::json)${on}`;
      status = 201; empty = true;
    } else if (req.method === 'PATCH') {
      const cols = Object.keys(body).map(ident);
      sql = `update public.${ident(name)} set (${cols.join(', ')}) = (select ${cols.join(', ')} from json_populate_record(null::public.${ident(name)}, ${dq(JSON.stringify(body))}::json)) where ${where(u.searchParams)}`;
      status = 204; empty = true;
    } else return send(405, { message: 'method' });
    const as = role === 'authenticated' ? `set role authenticated; set request.jwt.claims = ${lit(JSON.stringify({ sub: player, role: 'authenticated' }))};` : `set role ${role};`;
    const r = await sqlAsync(`${as} ${sql}`);
    if (!r.ok) return send(/permission denied|row-level security/.test(r.error) ? 403 : 400, { message: r.error });
    return send(status, empty ? undefined : r.out);
  } catch (e) { return send(400, { message: String(e.message) }); }
});
await new Promise((r) => rest.listen(0, '127.0.0.1', r));
const LOCAL = `http://127.0.0.1:${rest.address().port}`;

// ------------------------------------------------------------------------------------------- Stripe, and the network
// The game's live build talks to https://ultra-test.supabase.co, which this fetch sends to the stand-in; the functions
// get the stand-in's address directly. Stripe's API is answered here. Any other host fails the test.
const GAME_SB = 'https://ultra-test.supabase.co';
const stripeCalls = [], gameCalls = [], sessions = new Map();
let sessionN = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.hostname === 'api.stripe.com') {
    const body = String(init.body ?? ''), method = init.method ?? 'GET';
    stripeCalls.push({ path: url.pathname, method, body, key: init.headers?.['Idempotency-Key'] ?? null, auth: init.headers?.Authorization ?? '' });
    if (method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      const id = `cs_test_ultra${++sessionN}`;
      return reply(200, { id, object: 'checkout.session', url: `https://checkout.stripe.com/c/pay/${id}` });
    }
    if (method === 'GET' && url.pathname === '/v1/checkout/sessions') {
      const pi = url.searchParams.get('payment_intent');
      return reply(200, { object: 'list', data: sessions.has(pi) ? [sessions.get(pi)] : [], has_more: false });
    }
    if (method === 'POST' && url.pathname === '/v1/refunds') return reply(200, { id: 're_test_' + stripeCalls.length, object: 'refund', status: 'succeeded' });
    return reply(404, { error: { message: 'not answered here: ' + url.pathname } });
  }
  if (url.origin === GAME_SB) { gameCalls.push(`${init.method ?? 'GET'} ${url.pathname}`); return realFetch(LOCAL + url.pathname + url.search, init); }
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  throw new Error('the test tried to reach ' + url.hostname);
};

// ------------------------------------------------------------------------------------------- the two functions
const SECRET = 'whsec_test_ultra';
const ENV = { STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test_ultra', SITE_URL: 'https://game.test/', ALLOWED_ORIGINS: 'https://game.test', SUPABASE_URL: LOCAL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_ANON_KEY: ANON };
const served = [];
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { served.push(h); } };
await import(pathToFileURL(join(fnDir, 'stripe-webhook', 'index.ts')).href);
await import(pathToFileURL(join(fnDir, 'create-checkout', 'index.ts')).href);
if (served.length !== 2) throw new Error(`expected two Deno.serve calls, got ${served.length}`);
const [webhook, createCheckout] = served;

async function deliver(event) {
  const body = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const r = await webhook(new Request('http://localhost/functions/v1/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${sig}`, 'Content-Type': 'application/json' }, body }));
  return { status: r.status, ...(await r.json()) };
}
async function checkoutAs(token, body) {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://game.test', apikey: ANON };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await createCheckout(new Request('http://localhost/functions/v1/create-checkout', { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }));
  return { status: r.status, ...(await r.json()) };
}
const paid = (evt, user, session, pi, sku = SKU, amount = ultraSku.price_cents) => ({
  id: evt, type: 'checkout.session.completed', livemode: false, created: Math.floor(Date.now() / 1000),
  data: { object: { id: session, object: 'checkout.session', payment_status: 'paid', client_reference_id: user, metadata: { sku, user_id: user }, payment_intent: pi, amount_total: amount, currency: 'usd', created: Math.floor(Date.now() / 1000) } },
});
const refund = (evt, pi) => ({ id: evt, type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_' + pi, object: 'charge', refunded: true, payment_intent: pi } } });
const ultraRow = (user) => sqlSync(`select coalesce((select sku || ' ' || (case when revoked_at is null then 'live' else 'revoked' end) || ' serial ' || coalesce(serial::text, 'none') from entitlements where user_id = '${user}' and entitlement = '${ENT}'), 'no row')`);

// ------------------------------------------------------------------------------------------- the game's store code
// One bundle per build (live as the catalog is; live with graphics-ultra 'ready'; test mode), each loaded once per
// "device": a module instance with its own browser storage, as two phones would be.
const esbuild = (await import(pathToFileURL(join(root, 'node_modules', 'esbuild', 'lib', 'main.js')).href)).default;
const entry = join(bundleDir, 'entry.ts');
writeFileSync(entry, ['entitlements', 'account', 'payments', 'catalog', 'bus'].map((m) => `export * as ${m} from ${JSON.stringify(join(root, 'src/store', m + '.ts'))};`).join('\n'));
async function bundle(name, env, ready = false) {
  const out = join(bundleDir, name + '.mjs');
  await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent',
    plugins: [{
      name: 'oc-ultra-test', setup(b) {
        // the build's three store settings, as Vite would bake them in (src/store/config.ts reads import.meta.env)
        b.onLoad({ filter: /src[\\/]store[\\/]config\.ts$/ }, (a) => ({ loader: 'ts', contents: readFileSync(a.path, 'utf8').replace('import.meta.env', JSON.stringify(env)) }));
        // the owner's go-ahead, in this bundle only: graphics-ultra 'ready' (live Stripe keys may sell it; a live build locks it)
        if (ready) b.onLoad({ filter: /src[\\/]store[\\/]cosmetics\.json$/ }, (a) => { const c = JSON.parse(readFileSync(a.path, 'utf8')); c.entitlements.find((e) => e.id === ENT).status = 'ready'; return { loader: 'json', contents: JSON.stringify(c) }; });
      },
    }],
  });
  return out;
}
const LIVE_ENV = { VITE_PAYMENTS_LIVE: 'true', VITE_SUPABASE_URL: GAME_SB, VITE_SUPABASE_ANON_KEY: ANON };
const files = { live: await bundle('live', LIVE_ENV), ready: await bundle('live-ready', LIVE_ENV, true), test: await bundle('test', {}) };
// a browser's storage and address for one device
const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null }; };
const devices = new Map();
function use(dev) {
  const d = devices.get(dev);
  for (const k of ['localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, k, { value: d[k], configurable: true, writable: true });
  return d.m;
}
async function device(dev, build, user, hash = '') {
  const d = { localStorage: storage(), sessionStorage: storage(), location: { hash, search: '', pathname: '/index.html', origin: 'https://game.test', protocol: 'https:', href: 'https://game.test/index.html' + hash } };
  if (user) {
    d.localStorage.setItem('ocu.store.session', JSON.stringify({ userId: U[user], email: `${user.toLowerCase()}@example.com`, test: build === 'test', since: Date.now(), accessToken: `tok-${user}`, refreshToken: `rt-${user}`, expiresAt: Date.now() + 3600e3 }));
    d.localStorage.setItem('ocu.store.age', JSON.stringify({ ok13: true, at: Date.now() }));
  }
  devices.set(dev, d);
  use(dev);
  d.m = await import(pathToFileURL(files[build]).href + '?' + dev);
  await new Promise((r) => setTimeout(r, 300));          // the boot restore (live, signed in) has its moment
  return d.m;
}
const settle = () => new Promise((r) => setTimeout(r, 200));

// ------------------------------------------------------------------------------------------- the server
console.log('\nthe server: catalog, checkout line, webhook grant');
const onSale = await checkoutAs(null);
ENV.STRIPE_SECRET_KEY = 'sk_live_not_a_real_key';      // never sent anywhere: GET and a refused POST make no Stripe call
const onSaleLive = await checkoutAs(null);
const liveTry = await checkoutAs('tok-A', { sku: SKU, adult_or_guardian: true });
ENV.STRIPE_SECRET_KEY = 'sk_test_ultra';
check('test keys sell it; live keys refuse it while graphics-ultra is not "ready" (nothing can charge anyone)',
  onSale.on_sale.includes(SKU) && !onSaleLive.on_sale.includes(SKU) && liveTry.status === 409 && stripeCalls.length === 0,
  `test keys on sale: ${onSale.on_sale.includes(SKU)}; live keys on sale: ${onSaleLive.on_sale.includes(SKU)}, POST ${liveTry.status} "${liveTry.error}"; Stripe calls ${stripeCalls.length}`);

const co = await checkoutAs('tok-A', { sku: SKU, adult_or_guardian: true, price_cents: 1, amount_total: 1, unit_amount: 1 });
const sent = stripeCalls.find((c) => c.path === '/v1/checkout/sessions' && c.method === 'POST');
const form = new URLSearchParams(sent?.body ?? '');
const line = {
  mode: form.get('mode'), amount: form.get('line_items[0][price_data][unit_amount]'), currency: form.get('line_items[0][price_data][currency]'),
  name: form.get('line_items[0][price_data][product_data][name]'), productSku: form.get('line_items[0][price_data][product_data][metadata][sku]'),
  recurring: [...form.keys()].some((k) => k.includes('recurring')), quantity: form.get('line_items[0][quantity]'),
  sku: form.get('metadata[sku]'), user: form.get('client_reference_id'), piSku: form.get('payment_intent_data[metadata][sku]'), testKey: sent?.auth === 'Bearer sk_test_ultra',
};
check('the checkout line: one Ultra Graphics at the server\'s $5.00 (the page\'s price fields ignored), a one-time payment for this player',
  co.status === 200 && /^https:\/\/checkout\.stripe\.com\//.test(co.url) && line.mode === 'payment' && line.amount === String(ultraSku.price_cents) && line.currency === 'usd' && line.name === ultraSku.name && line.productSku === SKU && !line.recurring && line.quantity === '1' && line.sku === SKU && line.user === U.A && line.piSku === SKU && line.testKey,
  JSON.stringify(line));
const noToken = await checkoutAs(null, { sku: SKU, adult_or_guardian: true });
const under13 = await checkoutAs('tok-C', { sku: SKU, adult_or_guardian: true });
const noTick = await checkoutAs('tok-B', { sku: SKU, adult_or_guardian: false });
check('no sign-in, an under-13 profile and an unticked 18-or-guardian box are refused before Stripe',
  noToken.status === 401 && under13.status === 403 && noTick.status === 400 && stripeCalls.filter((c) => c.path === '/v1/checkout/sessions').length === 1,
  `${noToken.status} "${noToken.error}"; ${under13.status} "${under13.error}"; ${noTick.status} "${noTick.error}"`);

const g1 = await deliver(paid('evt_UA1', U.A, 'cs_test_ultraA1', 'pi_UA1'));
const g1again = await Promise.all([1, 2].map(() => deliver(paid('evt_UA1', U.A, 'cs_test_ultraA1', 'pi_UA1'))));
const rows = sqlSync(`select count(*) from entitlements where user_id = '${U.A}' and entitlement = '${ENT}'`);
const purchases = sqlSync(`select count(*) || ' ' || min(status) || ' ' || min(amount_cents) from purchases where stripe_session_id = 'cs_test_ultraA1'`);
const numbered = sqlSync(`select count(*) from serials where user_id = '${U.A}'`);
check('the webhook grants graphics-ultra once (two redeliveries change nothing), with no serial number',
  g1.status === 200 && g1.granted === 1 && g1.serial === undefined && g1again.every((r) => r.status === 200) && rows === '1' && purchases === `1 paid ${ultraSku.price_cents}` && numbered === '0' && ultraRow(U.A) === `${SKU} live serial none`,
  `${JSON.stringify(g1)}; row ${ultraRow(U.A)}; purchase ${purchases}; serials ${numbered}`);
const again = await checkoutAs('tok-A', { sku: SKU, adult_or_guardian: true });
check('a second checkout by the owner of it is refused: "already have everything"', again.status === 409 && /already have/.test(again.error ?? ''), `${again.status} "${again.error}"`);

// ------------------------------------------------------------------------------------------- restore, in the game's code
console.log('\nrestore: the game\'s store code in a live build, against the rows the webhook wrote');
const a1 = await device('A-phone', 'live', 'A');
const bootRead = gameCalls.filter((c) => c === 'GET /rest/v1/entitlements').length;
check('signed in at boot: the live build reads the account\'s rows by itself, and Ultra is "owned"',
  bootRead === 1 && a1.entitlements.has(ENT) && a1.entitlements.ultraState() === 'owned' && a1.entitlements.ultraUnlocked() && a1.entitlements.gateQuality('ultra') === 'ultra',
  `${bootRead} entitlements read(s) at boot; has ${a1.entitlements.has(ENT)}; state ${a1.entitlements.ultraState()}`);
const aR = await a1.entitlements.restore();
check('Restore purchases on a second device brings it back', aR.ok && aR.count === 1 && a1.entitlements.has(ENT), JSON.stringify(aR));

const b1 = await device('B-phone', 'ready', 'B');
const bR = await b1.entitlements.restore();
const bState = b1.entitlements.ultraState(), bGate = b1.entitlements.gateQuality('ultra'), bLow = b1.entitlements.gateQuality('low');
check('with the owner\'s go-ahead ("ready"), another account restores nothing of A\'s and is locked: a saved Ultra draws as High',
  bR.ok && bR.count === 0 && !b1.entitlements.has(ENT) && bState === 'locked' && !b1.entitlements.ultraUnlocked() && bGate === 'high' && bLow === 'low' && b1.entitlements.ultraForSale(),
  `restore ${JSON.stringify(bR)}; state ${bState}; ultra → ${bGate}, low → ${bLow}`);
globalThis.location.hash = '#owner';
const ownerOn = b1.entitlements.ultraState();
globalThis.location.hash = '#owner=0';
const ownerOff = b1.entitlements.ultraState();
globalThis.location.hash = '';
globalThis.localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'ultra', owner: true }));
const ownerSaved = b1.entitlements.ultraState();
globalThis.localStorage.setItem('tsu.settings', JSON.stringify({ quality: 'ultra', owner: false }));
const ownerSavedOff = b1.entitlements.ultraState(), passed = b1.entitlements.ultraState({ owner: true });
check('owner mode grants it: #owner, the saved owner setting, or { owner: true } from the caller; #owner=0 and owner off do not',
  ownerOn === 'owner' && ownerOff === 'locked' && ownerSaved === 'owner' && ownerSavedOff === 'locked' && passed === 'owner',
  `#owner ${ownerOn}; #owner=0 ${ownerOff}; saved on ${ownerSaved}; saved off ${ownerSavedOff}; passed ${passed}`);
const b2 = await device('B-laptop', 'live', 'B');
check('as the catalog is ("hook"), a live build never locks it: an account without it is "free", and draws Ultra',
  !b2.entitlements.has(ENT) && b2.entitlements.ultraState() === 'free' && b2.entitlements.ultraUnlocked() && b2.entitlements.gateQuality('ultra') === 'ultra' && !b2.entitlements.ultraForSale(),
  `state ${b2.entitlements.ultraState()}; for sale ${b2.entitlements.ultraForSale()}`);

console.log('\nrevoke: a refund takes it back, everywhere it is restored');
const r1 = await deliver(refund('evt_UA1r', 'pi_UA1'));
use('A-phone');
const aAfter = await a1.entitlements.restore();
const aReady = await device('A-tablet', 'ready', 'A');
check('the refund revokes the row; Restore takes Ultra off the device; with the go-ahead, A is locked again and draws High',
  r1.status === 200 && r1.refunded === SKU && ultraRow(U.A) === `${SKU} revoked serial none` && aAfter.ok && aAfter.count === 0 && !a1.entitlements.has(ENT) && aReady.entitlements.ultraState() === 'locked' && aReady.entitlements.gateQuality('ultra') === 'high',
  `${JSON.stringify(r1)}; row ${ultraRow(U.A)}; restore ${JSON.stringify(aAfter)}; go-ahead state ${aReady.entitlements.ultraState()}`);
const asA = (sql) => `set role authenticated; set request.jwt.claims = '{"sub":"${U.A}","role":"authenticated"}'; ${sql}`;
const denied = [
  `update entitlements set revoked_at = null where entitlement = '${ENT}'`,
  `insert into entitlements (user_id, entitlement, sku) values ('${U.A}', '${ENT}', '${SKU}') on conflict do nothing`,
  `insert into purchases (user_id, sku, stripe_session_id, amount_cents) values ('${U.A}', '${SKU}', 'cs_fake_ultra', 0)`,
].map((q) => sqlErr(asA(q)));
const anon = sqlErr(`set role anon; select count(*) from entitlements where entitlement = '${ENT}'`);
check('row-level security: a player can\'t undo the revoke, grant it to themselves or write a purchase; an anonymous visitor reads nothing',
  denied.every((e) => /permission denied/.test(e)) && /permission denied/.test(anon) && ultraRow(U.A) === `${SKU} revoked serial none`,
  [...denied, anon].map((e) => e.split('\n')[0].replace(/^.*ERROR:\s*/, '')).join(' | '));

console.log('\nbuying again, and a refund of something else');
const g2 = await deliver(paid('evt_UA2', U.A, 'cs_test_ultraA2', 'pi_UA2'));
const coast = catalog.find((s) => s.sku === 'paint-pack-coast');
const g3 = await deliver(paid('evt_CA1', U.A, 'cs_test_coastA1', 'pi_CA1', coast.sku, coast.price_cents));
const r3 = await deliver(refund('evt_CA1r', 'pi_CA1'));
use('A-phone');
const aBack = await a1.entitlements.restore();
check('buying again grants it on the same row; refunding the Coast Paint Pack leaves Ultra; Restore brings Ultra back',
  g2.granted === 1 && g3.granted === coast.grants.length && r3.refunded === coast.sku && ultraRow(U.A) === `${SKU} live serial none` && aBack.ok && a1.entitlements.has(ENT) && !coast.grants.some((g) => a1.entitlements.has(g)) && a1.entitlements.ultraState() === 'owned',
  `row ${ultraRow(U.A)}; restore ${JSON.stringify(aBack)}; Coast paints on the device ${coast.grants.filter((g) => a1.entitlements.has(g)).length}`);

// ------------------------------------------------------------------------------------------- a test-mode build
console.log('\na test-mode build: the 4242 test card, sign out, sign in');
const callsBefore = gameCalls.length, stripeBefore = stripeCalls.length;
const t = await device('T-phone', 'test', null);
const T = t.entitlements, P = t.payments, Acc = t.account;
const stateNoAccount = T.ultraState(), gateNoAccount = T.gateQuality('ultra');
await Acc.requestLink('tester@example.com');
Acc.answerAge(1990, 6);
const declined = await P.checkout({ sku: SKU, adultOrGuardian: true, garage: ['rossini-gt'] }, { number: '4000 0000 0000 0002', expiry: '12/30', cvc: '123' });
const realCard = await P.checkout({ sku: SKU, adultOrGuardian: true, garage: ['rossini-gt'] }, { number: '4111 1111 1111 1111', expiry: '12/30', cvc: '123' });
const afterDecline = T.has(ENT);
const bought = await P.checkout({ sku: SKU, adultOrGuardian: true, garage: ['rossini-gt'] }, { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' });
check('test mode: Ultra is unlocked for everyone, bought or not; a declined or a real card grants nothing; 4242 grants it at $5.00 with a test receipt',
  stateNoAccount === 'test' && gateNoAccount === 'ultra' && declined.ok === false && declined.code === 'declined' && realCard.ok === false && realCard.code === 'refused' && !afterDecline
    && bought.ok === true && bought.receipt.test && bought.receipt.amount_cents === ultraSku.price_cents && bought.receipt.grants.join() === ENT && /4242$/.test(bought.receipt.card) && T.has(ENT) && T.ultraState() === 'owned',
  `no account: ${stateNoAccount}; declined "${declined.message}"; real card "${realCard.message}"; receipt ${bought.ok ? `${bought.receipt.id} $${(bought.receipt.amount_cents / 100).toFixed(2)} ${bought.receipt.card}` : JSON.stringify(bought)}`);
await Acc.signOut();
await settle();
const outHas = T.has(ENT), outState = T.ultraState();
await Acc.requestLink('tester@example.com');
const inHas = T.has(ENT), tR = await T.restore();
const stored = JSON.stringify(Object.fromEntries([...Array(globalThis.localStorage.length)].map((_, i) => [globalThis.localStorage.key(i), globalThis.localStorage.getItem(globalThis.localStorage.key(i))])));
check('test mode: signing out takes it off the account (Ultra stays unlocked: a test build); signing in with the same email restores it; the card number is not stored',
  !outHas && outState === 'test' && inHas && tR.ok && tR.count === 1 && T.ultraState() === 'owned' && !/4242424242424242|4242 4242 4242 4242/.test(stored),
  `signed out: has ${outHas}, state ${outState}; signed in: has ${inHas}; restore "${tR.message}"`);
check('test mode sends nothing: no request to Supabase or Stripe', gameCalls.length === callsBefore && stripeCalls.length === stripeBefore, `${gameCalls.length - callsBefore} Supabase, ${stripeCalls.length - stripeBefore} Stripe`);

rest.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed. REST calls: ${restLog.length} (${restLog.filter((r) => r.role === 'authenticated').length} as a player, under row-level security). Stripe calls: ${stripeCalls.length}, all answered here.`);
process.exit(failed.length ? 1 : 0);

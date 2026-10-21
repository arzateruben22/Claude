// The Founder Edition's serial numbers, end to end: the real stripe-webhook function (index.ts, its types stripped by
// Node) against a throwaway local Postgres with migrations 0001 and 0002, through a small stand-in for Supabase's
// REST API (PostgREST) that turns the function's requests into SQL. Signed deliveries go in through the function's own
// Stripe-Signature check; Stripe's refund call is answered here. Nothing real is contacted.
//
//   node server/supabase/tests/serial-webhook.mjs     (needs initdb, pg_ctl and psql: PG_BIN or /usr/lib/postgresql/16/bin)
//
// It shows: one number per Checkout Session across retried, concurrent and second-event deliveries; numbers start at
// 0001; a refund retires a number, which is never issued again; a session created inside the founder window and paid
// after it is honoured; one created after the window grants nothing and is refunded once (also when a retry comes after
// Stripe has forgotten the idempotency key); No. 0000 can't be issued;
// and a player reads their own number but can't write it, issue one, or read anyone else's.
// Then the three cases a review reproduced (2026-10-19), each fixed in 0002 or the webhook:
//   one live number per player: a second checkout paid alongside the first is refused, refunded and never numbered,
//     and when a purchase is refunded the plaque goes back to the player's lowest live number (or none);
//   a refund delivered before its completion: recorded as refunded from the Checkout Session, so the completion that
//     follows grants and numbers nothing;
//   a refund racing the numbering, held open in another transaction both ways round: never a live number on a
//     refunded purchase.
import { execFile, execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { chownSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fnDir = join(here, '..', 'functions');
const bin = process.env.PG_BIN ?? '/usr/lib/postgresql/16/bin';
if (!existsSync(join(bin, 'initdb'))) { console.log(`SKIP: no Postgres at ${bin} (set PG_BIN)`); process.exit(3); }

const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`); };

// ------------------------------------------------------------------------------------------- a throwaway Postgres
const tmp = mkdtempSync(join(tmpdir(), 'oc-serial-'));
const port = 55000 + Math.floor(Math.random() * 900);
// Postgres refuses to run as root: as root, the server runs as the postgres user (and owns the throwaway directory)
const asRoot = process.getuid?.() === 0;
if (asRoot) { const uid = Number(execFileSync('id', ['-u', 'postgres'], { encoding: 'utf8' })), gid = Number(execFileSync('id', ['-g', 'postgres'], { encoding: 'utf8' })); chownSync(tmp, uid, gid); }
const pg = (args, opts = {}) => (asRoot
  ? execFileSync('runuser', ['-u', 'postgres', '--', join(bin, args[0]), ...args.slice(1)], { stdio: 'pipe', ...opts })
  : execFileSync(join(bin, args[0]), args.slice(1), { stdio: 'pipe', ...opts }));
const psqlBin = existsSync(join(bin, 'psql')) ? join(bin, 'psql') : 'psql';
let started = false;
function stop() {
  if (started) { try { pg(['pg_ctl', '-D', join(tmp, 'data'), 'stop', '-m', 'fast']); } catch { /* already down */ } }
  rmSync(tmp, { recursive: true, force: true });
}
process.on('exit', stop);
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
for (let i = 0; i < 2; i++) { apply(join(here, '..', 'migrations', '0001_oc_ultra_store.sql')); apply(join(here, '..', 'migrations', '0002_founder_serials.sql')); }
check('migrations 0001 and 0002 run twice', true);

// ------------------------------------------------------------------------------------------- a PostgREST stand-in
// Just the requests the webhook makes, as the service role: GET with eq./is./in. filters and select; POST with
// on_conflict and Prefer resolution; PATCH with filters; POST rpc/<function>.
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
const restLog = [];
// a test may run something just before the function's next rpc call reaches the database (a refund racing it)
let beforeRpc = null;
const rest = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data)); };
  try {
    const name = u.pathname.replace(/^\/rest\/v1\//, '');
    restLog.push(`${req.method} ${name}`);
    let sql, status = 200, empty = false;
    if (name.startsWith('rpc/')) {
      if (beforeRpc) { const h = beforeRpc; beforeRpc = null; await h(); }
      const args = Object.entries(body ?? {}).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ');
      sql = `select to_json(public.${ident(name.slice(4))}(${args}))`;
    } else if (req.method === 'GET') {
      const cols = (u.searchParams.get('select') ?? '*').split(',').map((c) => (c === '*' ? c : ident(c))).join(', ');
      sql = `select coalesce(json_agg(t), '[]'::json) from (select ${cols} from public.${ident(name)} where ${where(u.searchParams)}) t`;
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
    const r = await sqlAsync(`set role service_role; ${sql}`);
    if (!r.ok) return send(400, { message: r.error });
    return send(status, empty ? undefined : r.out);
  } catch (e) { return send(400, { message: String(e.message) }); }
});
await new Promise((r) => rest.listen(0, '127.0.0.1', r));

// ------------------------------------------------------------------------------------------- the function itself
const SECRET = 'whsec_test_serial_webhook';
const ENV = { STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test_serial', SUPABASE_URL: `http://127.0.0.1:${rest.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' };
let handler = null;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h; } };
const stripeCalls = [];
// Stripe's refunds as the webhook sees them: a known idempotency key replays its first answer; a new key for a payment
// already refunded is refused with charge_already_refunded (what a retry gets once Stripe has dropped a key after 24 h)
const stripeKeys = new Map(), refundedPI = new Set();
// Checkout Sessions by payment intent, for GET /v1/checkout/sessions?payment_intent= (a refund that arrives first);
// pi_fail stands for Stripe failing to answer
const sessions = new Map();
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname === 'api.stripe.com') {
    const key = init.headers?.['Idempotency-Key'] ?? null, body = String(init.body ?? '');
    stripeCalls.push({ path: url.pathname, key, body, method: init.method ?? 'GET', query: url.search });
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if ((init.method ?? 'GET') === 'GET' && url.pathname === '/v1/checkout/sessions') {
      const pi = url.searchParams.get('payment_intent');
      if (pi === 'pi_fail') return reply(500, { error: { type: 'api_error', message: 'test: Stripe did not answer' } });
      return reply(200, { object: 'list', data: sessions.has(pi) ? [sessions.get(pi)] : [], has_more: false });
    }
    if (key && stripeKeys.has(key)) return reply(...stripeKeys.get(key));
    const pi = new URLSearchParams(body).get('payment_intent');
    const answer = refundedPI.has(pi)
      ? [400, { error: { type: 'invalid_request_error', code: 'charge_already_refunded', message: `Charge ch_${pi} has already been refunded.` } }]
      : [200, { id: 're_test_' + stripeCalls.length, object: 'refund', status: 'succeeded' }];
    if (answer[0] === 200) refundedPI.add(pi);
    if (key) stripeKeys.set(key, answer);
    return reply(...answer);
  }
  if (url.hostname !== '127.0.0.1') throw new Error('the test tried to reach ' + url.hostname);
  return realFetch(input, init);
};
await import(pathToFileURL(join(fnDir, 'stripe-webhook', 'index.ts')).href);
if (!handler) throw new Error('stripe-webhook did not call Deno.serve');
const catalog = JSON.parse(readFileSync(join(fnDir, '_shared', 'catalog.json'), 'utf8'));
const UNTIL = Date.parse(catalog.founder_until);

// nowMs: the function's clock for this delivery (sequential deliveries only; the signature's time follows it)
async function deliver(event, nowMs) {
  const body = JSON.stringify(event), t = Math.floor((nowMs ?? Date.now()) / 1000);
  const sig = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const realNow = Date.now;
  if (nowMs !== undefined) Date.now = () => nowMs;
  try {
    const r = await handler(new Request('http://localhost/functions/v1/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${sig}`, 'Content-Type': 'application/json' }, body }));
    return { status: r.status, ...(await r.json()) };
  } finally { Date.now = realNow; }
}
const U = { A: '11111111-1111-1111-1111-111111111111', B: '22222222-2222-2222-2222-222222222222', C: '33333333-3333-3333-3333-333333333333', D: '44444444-4444-4444-4444-444444444444', E: '55555555-5555-5555-5555-555555555555' };
sqlSync(`insert into auth.users values ('${U.C}', 'c@example.com'), ('${U.D}', 'd@example.com'), ('${U.E}', 'e@example.com')`);
const paid = (evt, user, session, pi, createdMs = Date.now(), type = 'checkout.session.completed') => ({
  id: evt, type, livemode: false, created: Math.floor(Date.now() / 1000),
  data: { object: { id: session, object: 'checkout.session', payment_status: 'paid', client_reference_id: user, metadata: { sku: 'hypercar-founder', user_id: user }, payment_intent: pi, amount_total: 499, currency: 'usd', created: Math.floor(createdMs / 1000) } },
});
const refund = (evt, pi) => ({ id: evt, type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_' + pi, object: 'charge', refunded: true, payment_intent: pi } } });
const ledger = () => JSON.parse(sqlSync(`select coalesce(json_agg(t order by serial), '[]') from (select serial, user_id, retired_at is not null as retired from serials) t`));
const counter = () => Number(sqlSync(`select next from serial_counters where sku = 'hypercar-founder'`));
const entSerial = (user) => sqlSync(`select coalesce(serial::text, 'null') || ' ' || (revoked_at is null) from entitlements where user_id = '${user}' and entitlement = 'car-oc-hyper'`);

console.log('\nserial numbers through the stripe-webhook function');
const a1 = await deliver(paid('evt_A1', U.A, 'cs_test_hyperA1', 'pi_A1'));
check('the first sale is No. 0001', a1.status === 200 && a1.serial === 1, JSON.stringify(a1));
// Stripe retries a delivery it didn't see answered: three at once, one later, and the session's second success event
const again = await Promise.all([1, 2, 3].map(() => deliver(paid('evt_A1', U.A, 'cs_test_hyperA1', 'pi_A1'))));
const later = await deliver(paid('evt_A1', U.A, 'cs_test_hyperA1', 'pi_A1'));
const second = await deliver(paid('evt_A1b', U.A, 'cs_test_hyperA1', 'pi_A1', Date.now(), 'checkout.session.async_payment_succeeded'));
const seen = [...again, later, second].map((r) => r.serial);
check('a retried delivery (3 concurrent, 1 later) and the second success event keep No. 0001', seen.every((n) => n === 1) && ledger().length === 1 && counter() === 2, `serials ${seen.join(', ')}; ledger ${ledger().length} row; counter next ${counter()}`);
check('the number is on the buyer\'s entitlement row', entSerial(U.A) === '1 true', entSerial(U.A));
const b1 = await deliver(paid('evt_B1', U.B, 'cs_test_hyperB1', 'pi_B1'));
check('the next sale is No. 0002', b1.serial === 2, JSON.stringify(b1));

const r1 = await deliver(refund('evt_A1r', 'pi_A1'));
const r1again = await deliver(refund('evt_A1r', 'pi_A1'));
const L1 = ledger();
// the row keeps no number once its last live one is retired (the plaque never shows a retired number)
check('a refund retires No. 0001, clears it from the row and takes the car back', r1.retired === 1 && r1again.retired === 1 && L1[0].retired && !L1[1].retired && entSerial(U.A) === 'null false', `refund → ${JSON.stringify(r1)}; ledger ${JSON.stringify(L1.map((x) => [x.serial, x.retired]))}; A's row ${entSerial(U.A)}`);
const a1late = await deliver(paid('evt_A1', U.A, 'cs_test_hyperA1', 'pi_A1'));
check('a late redelivery of the refunded sale issues nothing', a1late.skipped === 'refunded' && ledger().length === 2 && counter() === 3, JSON.stringify(a1late));
const c1 = await deliver(paid('evt_C1', U.C, 'cs_test_hyperC1', 'pi_C1'));
check('a retired number is never reissued: the next sale is No. 0003', c1.serial === 3 && !ledger().some((x) => x.serial === 1 && x.user_id !== U.A), JSON.stringify(c1));
const a2 = await deliver(paid('evt_A2', U.A, 'cs_test_hyperA2', 'pi_A2'));
check('buying again after a refund gets a new number (No. 0004), restored on the same row', a2.serial === 4 && entSerial(U.A) === '4 true', `${JSON.stringify(a2)}; A's row ${entSerial(U.A)}`);

console.log('\nthe founder window, judged by when the session was created');
const e1 = await deliver(paid('evt_E1', U.E, 'cs_test_hyperE1', 'pi_E1', UNTIL - 60e3), UNTIL + 3600e3);
check('created a minute before the deadline, paid an hour after it: honoured (No. 0005)', e1.serial === 5, JSON.stringify(e1));
const d1 = await deliver(paid('evt_D1', U.D, 'cs_test_hyperD1', 'pi_D1', UNTIL + 60e3), UNTIL + 120e3);
const d1again = await deliver(paid('evt_D1', U.D, 'cs_test_hyperD1', 'pi_D1', UNTIL + 60e3), UNTIL + 180e3);
const dRows = sqlSync(`select status from purchases where stripe_session_id = 'cs_test_hyperD1'`), dEnts = sqlSync(`select count(*) from entitlements where user_id = '${U.D}'`);
const keys = stripeCalls.filter((c) => c.path === '/v1/refunds').map((c) => c.key);
check('created after the deadline: refused, nothing granted or numbered, refunded with one idempotency key', d1.refused && d1again.refused && dRows === 'refused' && dEnts === '0' && ledger().length === 5 && keys.length === 2 && keys.every((k) => k === 'founder-window-cs_test_hyperD1'),
  `${JSON.stringify(d1)}; purchase ${dRows}; ${dEnts} entitlements; refund calls ${keys.length} with key ${keys[0]}`);
stripeKeys.clear();                                    // a day on: Stripe no longer remembers the key
const d1late = await deliver(paid('evt_D1', U.D, 'cs_test_hyperD1', 'pi_D1', UNTIL + 60e3), UNTIL + 26 * 3600e3);
check('a redelivery after Stripe forgets the key finds it already refunded: 200, nothing granted, no second refund', d1late.status === 200 && d1late.refused && refundedPI.size === 1 && sqlSync(`select count(*) from entitlements where user_id = '${U.D}'`) === '0',
  `${JSON.stringify(d1late)}; ${refundedPI.size} payment refunded`);

console.log('\nthe ledger and row-level security');
check('No. 0000 is owner mode\'s and can never be issued', /violates check constraint/.test(sqlErr(`insert into serials (sku, serial, user_id) values ('hypercar-founder', 0, '${U.B}')`)) && /violates check constraint/.test(sqlErr(`update entitlements set serial = 0 where user_id = '${U.B}'`)));
check('numbers are unique per sku', /duplicate key/.test(sqlErr(`insert into serials (sku, serial, user_id) values ('hypercar-founder', 2, '${U.C}')`)));
const asA = (sql) => `set role authenticated; set request.jwt.claims = '{"sub":"${U.A}","role":"authenticated"}'; ${sql}`;
const aReads = sqlSync(asA(`select string_agg(serial || ':' || (retired_at is not null), ',' order by serial) from serials`));
const aEnt = sqlSync(asA(`select serial from entitlements where entitlement = 'car-oc-hyper'`));
const denied = [
  `update entitlements set serial = 1 where entitlement = 'car-oc-hyper'`,
  `insert into serials (sku, serial, user_id) values ('hypercar-founder', 99, '${U.A}')`,
  `update serials set retired_at = null`,
  `update serial_counters set next = 1`,
  `select assign_serial((select id from purchases where stripe_session_id = 'cs_test_hyperA2'))`,
].map((q) => sqlErr(asA(q)));
check('a player reads their own number and nothing else', aReads === '1:true,4:false' && aEnt === '4', `serials ${aReads}; entitlement serial ${aEnt}`);
check('a player can\'t write a number, issue one, or touch the counter', denied.every((e) => /permission denied/.test(e)), denied.map((e) => e.split('\n')[0].replace(/^.*ERROR:\s*/, '')).join(' | '));
check('the counter only went up: next is No. 0006', counter() === 6, `next ${counter()}`);

// ------------------------------------------------------------------------------------------- the review's three cases
for (const k of ['F', 'G', 'H', 'I', 'J']) U[k] = `${k === 'F' ? 'ffffffff' : k === 'G' ? '66666666' : k === 'H' ? '77777777' : k === 'I' ? '88888888' : '99999999'}-0000-4000-8000-000000000000`;
sqlSync(`insert into auth.users values ${['F', 'G', 'H', 'I', 'J'].map((k) => `('${U[k]}', '${k.toLowerCase()}@example.com')`).join(', ')}`);
const status = (session) => sqlSync(`select status from purchases where stripe_session_id = '${session}'`);
const liveSerials = (user) => sqlSync(`select coalesce(string_agg(serial::text, ',' order by serial), '') from serials where user_id = '${user}' and retired_at is null`);
const allSerials = (user) => sqlSync(`select coalesce(string_agg(serial || ':' || (case when retired_at is null then 'live' else 'retired' end), ',' order by serial), '') from serials where user_id = '${user}'`);
// the invariant the review broke: a refunded purchase never keeps a live number
const liveOnRefunded = () => Number(sqlSync(`select count(*) from serials s join purchases p on p.id = s.purchase_id where p.status = 'refunded' and s.retired_at is null`));

console.log('\none live number per player (two checkouts paid side by side)');
const n0 = counter();
const f1 = await deliver(paid('evt_F1', U.F, 'cs_test_hyperF1', 'pi_F1'));
const f2 = await deliver(paid('evt_F2', U.F, 'cs_test_hyperF2', 'pi_F2'));
const f2again = await deliver(paid('evt_F2', U.F, 'cs_test_hyperF2', 'pi_F2'));
const dupKeys = stripeCalls.filter((c) => c.path === '/v1/refunds' && c.key === 'founder-duplicate-cs_test_hyperF2').length;
check('the second one is refused, refunded with one idempotency key and never numbered; the first keeps its number',
  f1.serial === n0 && f2.status === 200 && /already holds/.test(f2.refused ?? '') && f2.refunded && f2again.refused && status('cs_test_hyperF2') === 'refused' && dupKeys === 2 && refundedPI.has('pi_F2') && counter() === n0 + 1 && liveSerials(U.F) === String(n0) && entSerial(U.F) === `${n0} true`,
  `first ${JSON.stringify(f1)}; second ${JSON.stringify(f2)}; purchase ${status('cs_test_hyperF2')}; refund calls ${dupKeys}; F's numbers ${allSerials(U.F)}; F's row ${entSerial(U.F)}; counter next ${counter()}`);
const f2r = await deliver(refund('evt_F2r', 'pi_F2'));
check('the refund of the second one lands: the plaque still shows the first number, and the car stays',
  f2r.status === 200 && status('cs_test_hyperF2') === 'refunded' && entSerial(U.F) === `${n0} true` && liveSerials(U.F) === String(n0),
  `refund ${JSON.stringify(f2r)}; F's row ${entSerial(U.F)}; F's numbers ${allSerials(U.F)}`);
// two live numbers for one player, as the pre-fix webhook issued them (the review's P1): the trigger repairs the plaque
const g1 = await deliver(paid('evt_G1', U.G, 'cs_test_hyperG1', 'pi_G1'));
sqlSync(`insert into purchases (user_id, sku, stripe_session_id, stripe_payment_intent, amount_cents, status) values ('${U.G}', 'hypercar-founder', 'cs_test_hyperG2', 'pi_G2', 499, 'paid');
  with n as (update serial_counters set next = next + 1 where sku = 'hypercar-founder' returning next - 1 as s)
  insert into serials (sku, serial, purchase_id, user_id) select 'hypercar-founder', s, (select id from purchases where stripe_session_id = 'cs_test_hyperG2'), '${U.G}' from n;
  update entitlements set serial = (select max(serial) from serials where user_id = '${U.G}') where user_id = '${U.G}' and sku = 'hypercar-founder'`);
const gBefore = `${allSerials(U.G)}; row ${entSerial(U.G)}`;
const g2r = await deliver(refund('evt_G2r', 'pi_G2'));
const gMid = entSerial(U.G), gMidLedger = allSerials(U.G);
const g1r = await deliver(refund('evt_G1r', 'pi_G1'));
check('a refund puts the plaque back to the lowest live number, and to none when the last one is refunded',
  g1.serial === n0 + 1 && g2r.retired === n0 + 2 && gMid === `${n0 + 1} true` && gMidLedger === `${n0 + 1}:live,${n0 + 2}:retired` && g1r.retired === n0 + 1 && entSerial(U.G) === 'null false' && liveSerials(U.G) === '',
  `planted ${gBefore}; refund No. ${g2r.retired} → row ${gMid}, ledger ${gMidLedger}; refund No. ${g1r.retired} → row ${entSerial(U.G)}, ledger ${allSerials(U.G)}`);

console.log('\na refund delivered before its completion');
const n1 = counter();
sessions.set('pi_H1', paid('evt_H1', U.H, 'cs_test_hyperH1', 'pi_H1').data.object);
const h1r = await deliver(refund('evt_H1r', 'pi_H1'));
const h1 = await deliver(paid('evt_H1', U.H, 'cs_test_hyperH1', 'pi_H1'));
const hEnts = sqlSync(`select count(*) from entitlements where user_id = '${U.H}' and revoked_at is null`);
check('the refund records the purchase as refunded from its Checkout Session; the completion then grants and numbers nothing',
  h1r.status === 200 && h1r.refunded === 'hypercar-founder' && status('cs_test_hyperH1') === 'refunded' && h1.status === 200 && h1.skipped === 'refunded' && hEnts === '0' && allSerials(U.H) === '' && counter() === n1,
  `refund first ${JSON.stringify(h1r)}; completion ${JSON.stringify(h1)}; purchase ${status('cs_test_hyperH1')}; ${hEnts} live entitlements; numbers "${allSerials(U.H)}"; counter next ${counter()}`);
const none = await deliver(refund('evt_X1r', 'pi_not_a_checkout'));
const down = await deliver(refund('evt_X2r', 'pi_fail'));
const strays = sqlSync(`select count(*) from purchases where stripe_payment_intent in ('pi_not_a_checkout', 'pi_fail')`);
check('a charge no Checkout Session made is ignored (200); a failed lookup is a 500, so Stripe retries; nothing written',
  none.status === 200 && /no checkout session/.test(none.ignored ?? '') && down.status === 500 && strays === '0',
  `${JSON.stringify(none)}; ${JSON.stringify(down)}; ${strays} purchases written`);

console.log('\na refund racing the numbering (held open in another transaction)');
const holdS = 2;
const holding = async (sqlText) => {
  const t = sqlAsync(`begin; set local role service_role; ${sqlText}; select pg_sleep(${holdS}); commit;`);
  // wait until that transaction is asleep: its write (and the row lock it takes) is done
  for (let i = 0; i < 150 && sqlSync(`select count(*) from pg_stat_activity where wait_event = 'PgSleep' and pid <> pg_backend_pid()`) === '0'; i++) await new Promise((r) => setTimeout(r, 20));
  return { done: t };                                  // wrapped: an async function would wait for the promise itself
};
// the completion has recorded the purchase, read it back as paid and granted the car; just before its assign_serial
// reaches the database, a refund marks the purchase refunded and holds its transaction open
const n2 = counter();
let refundTx = null, t0 = 0;
beforeRpc = async () => {
  refundTx = await holding(`update purchases set status = 'refunded', refunded_at = now() where stripe_session_id = 'cs_test_hyperI1'`);
  t0 = Date.now();
};
const i1 = await deliver(paid('evt_I1', U.I, 'cs_test_hyperI1', 'pi_I1'));
const waited = Date.now() - t0, rtx = refundTx ? await refundTx.done : { ok: false, error: 'the refund never ran' };
const i1again = await deliver(paid('evt_I1', U.I, 'cs_test_hyperI1', 'pi_I1'));
check('refund first: assign_serial waits for it, then refuses (500, Stripe retries); the retry grants nothing and takes back the car',
  rtx.ok && i1.status === 500 && waited >= 1000 && allSerials(U.I) === '' && counter() === n2 && liveOnRefunded() === 0 && i1again.skipped === 'refunded' && entSerial(U.I) === 'null false',
  `completion ${i1.status}, its assign_serial answered ${(waited / 1000).toFixed(1)} s after the refund began; retry ${JSON.stringify(i1again)}; numbers "${allSerials(U.I)}"; I's row ${entSerial(U.I)}; counter next ${counter()}; live numbers on refunded purchases ${liveOnRefunded()}`);
// the other way round: the number is being issued (its transaction held open) when the refund arrives
sqlSync(`insert into purchases (user_id, sku, stripe_session_id, stripe_payment_intent, amount_cents, status) values ('${U.J}', 'hypercar-founder', 'cs_test_hyperJ1', 'pi_J1', 499, 'paid');
  insert into entitlements (user_id, entitlement, sku) select '${U.J}', g, 'hypercar-founder' from unnest(array['car-oc-hyper', 'plaque-founder-edition', 'paint-oc-founder-silver']) g`);
const assignTx = await holding(`select assign_serial((select id from purchases where stripe_session_id = 'cs_test_hyperJ1'))`);
const t1 = Date.now();
const j1r = await deliver(refund('evt_J1r', 'pi_J1'));
const waited2 = Date.now() - t1, atx = await assignTx.done;
check('number first: the refund waits for it, then retires it; the plaque shows none and the car is taken back',
  atx.ok && j1r.status === 200 && waited2 >= 1000 && j1r.retired === n2 && allSerials(U.J) === `${n2}:retired` && entSerial(U.J) === 'null false' && liveOnRefunded() === 0,
  `refund ${JSON.stringify(j1r)} after ${(waited2 / 1000).toFixed(1)} s; numbers ${allSerials(U.J)}; J's row ${entSerial(U.J)}; live numbers on refunded purchases ${liveOnRefunded()}`);

rest.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed. REST calls made by the function: ${restLog.length}.`);
process.exit(failed.length ? 1 : 0);

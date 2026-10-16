// Checks src/store/catalog.json against src/store/cosmetics.json and the game code, with no dependencies:
//   node tools/store-check-catalog.mjs        (exit code 1 on any problem)
// What it checks (the rules in PROJECT_OC_MONETIZATION.md):
//   - every sku has the schema's fields; kind, mode, interval and currency take the allowed values
//   - prices are whole dollars and at least $2 (Stripe's fixed 30c makes smaller prices a bad deal)
//   - only the Founder Pack has a sales window, and its date parses
//   - every grant resolves to an entitlement in cosmetics.json, and every entitlement is granted by some sku
//   - an available sku grants nothing still marked 'build' (except the Founder and tip badges, built with the store)
//   - wheel styles match the WheelStyle type in src/preview/car-wheel.ts; no paid setup repeats a factory wheel
//   - the tip's custom amount sits above Stripe's $0.50 minimum
//   - no real brand word appears anywhere in either file
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const catalog = JSON.parse(read('src/store/catalog.json'));
const cosmetics = JSON.parse(read('src/store/cosmetics.json'));
const errs = [];
const ents = new Map(cosmetics.entitlements.map((e) => [e.id, e]));
if (ents.size !== cosmetics.entitlements.length) errs.push('duplicate entitlement ids');

const KINDS = new Set(['pack', 'livery', 'kit', 'style', 'tip', 'club']);
const FIELDS = ['sku', 'name', 'kind', 'price_cents', 'currency', 'mode', 'grants', 'description', 'available'];
const BADGES = new Set(['badge', 'frame', 'credits-roll']);
const used = new Set();
const skus = new Set();
for (const c of catalog) {
  const s = c.sku;
  if (skus.has(s)) errs.push(`${s}: duplicate sku`);
  skus.add(s);
  for (const k of FIELDS) if (!(k in c)) errs.push(`${s}: missing ${k}`);
  if (!KINDS.has(c.kind)) errs.push(`${s}: kind ${c.kind}`);
  if (c.currency !== 'usd') errs.push(`${s}: currency ${c.currency}`);
  if (c.mode !== 'payment' && c.mode !== 'subscription') errs.push(`${s}: mode ${c.mode}`);
  if (c.mode === 'subscription' && c.interval !== 'month' && c.interval !== 'year') errs.push(`${s}: interval`);
  if (c.mode === 'payment' && 'interval' in c) errs.push(`${s}: interval on a one-time item`);
  if (!Number.isInteger(c.price_cents) || c.price_cents % 100 !== 0) errs.push(`${s}: not a whole-dollar price`);
  if (c.price_cents < 200) errs.push(`${s}: under $2`);
  if (typeof c.available !== 'boolean') errs.push(`${s}: available must be true or false`);
  if (c.window) {
    if (s !== 'founder-pack-2026') errs.push(`${s}: only the Founder Pack has a window`);
    if (Number.isNaN(Date.parse(c.window.until))) errs.push(`${s}: window.until is not a date`);
  }
  if (c.kind === 'tip') {
    const a = c.custom_amount;
    if (!a || a.minimum_cents < 50 || a.minimum_cents > a.preset_cents || a.preset_cents > a.maximum_cents) errs.push(`${s}: custom_amount`);
  }
  for (const g of c.grants) {
    used.add(g);
    const e = ents.get(g);
    if (!e) { errs.push(`${s}: grant ${g} is not in cosmetics.json`); continue; }
    if (c.available && e.status === 'build' && !BADGES.has(e.type)) errs.push(`${s}: available but grants unbuilt ${g}`);
  }
}
for (const id of ents.keys()) if (!used.has(id)) errs.push(`entitlement ${id} is granted by no sku`);

const m = read('src/preview/car-wheel.ts').match(/export type WheelStyle = ([^;]+);/);
const codeStyles = new Set(m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : []);
const styles = new Set(Object.keys(cosmetics.wheel_styles).filter((k) => k !== 'note'));
if ([...styles].sort().join() !== [...codeStyles].sort().join()) errs.push(`wheel styles ${[...styles]} differ from car-wheel.ts ${[...codeStyles]}`);
for (const e of ents.values()) {
  if (e.type === 'wheels') {
    if (!codeStyles.has(e.style)) errs.push(`${e.id}: unknown style ${e.style}`);
    const f = cosmetics.factory_wheels[e.car];
    if (!f) errs.push(`${e.id}: unknown car ${e.car}`);
    else if (f.style === e.style) errs.push(`${e.id}: repeats the ${e.car} factory style`);
  }
  if (e.type === 'paint' && !(e.finish in cosmetics.paint_finishes)) errs.push(`${e.id}: unknown finish ${e.finish}`);
  for (const hex of JSON.stringify(e).match(/#[0-9A-Za-z]+/g) ?? []) if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) errs.push(`${e.id}: bad hex ${hex}`);
}

const BANNED = ['ferrari', 'porsche', 'lamborghini', 'mclaren', 'bmw', 'mercedes', 'rolex', 'omega', 'hot wheels',
  'golden road', 'crush', 'brembo', 'bbs', 'recaro', 'nike', 'supreme'];
const text = (JSON.stringify(catalog) + JSON.stringify(cosmetics)).toLowerCase();
for (const b of BANNED) if (text.includes(b)) errs.push(`real brand word: ${b}`);

const avail = catalog.filter((c) => c.available).length;
if (errs.length) { console.log(`catalog: ${errs.length} problem(s)`); for (const e of errs) console.log('  ' + e); process.exit(1); }
console.log(`catalog ok: ${catalog.length} skus (${avail} available), ${ents.size} entitlements`);

// Checks src/store/catalog.json against src/store/cosmetics.json and the game code, with no dependencies:
//   node tools/store-check-catalog.mjs        (exit code 1 on any problem)
// What it checks (the rules in PROJECT_OC_MONETIZATION.md):
//   - every sku has the schema's fields; kind, mode, interval and currency take the allowed values
//   - prices are whole dollars and at least $2 (Stripe's fixed 30c makes smaller prices a bad deal), except the
//     owner's one exception: the OC Hypercar Founder Edition at exactly $4.99 (PRICE_EXCEPTIONS below)
//   - only the two founder offers have a sales window, and it is the one constant FOUNDER_UNTIL (src/store/founder.json),
//     the last second of a Pacific day
//   - the two founder offers share no grant and no name (the Founder Pack doesn't include the car)
//   - a car the store grants (an entitlement with a `vehicle`) is sold only once that car is in src/game/cars.ts
//   - a numbered sku (`serial`) is a one-time payment with a serial counter seeded in a server migration
//   - an entitlement marked `exclusive: X` is granted by sku X only (the Founder Pack's badge, frame, roll and Founders
//     Sunset; the OC Hypercar Founder Edition's car, plaque and paint)
//   - a sku that grants a car (an entitlement with a `vehicle`) or a server-numbered item (`serial: 'server'`) is
//     numbered (`serial: true`) and sold in the founder window ("FOUNDER_UNTIL") only
//   - every grant resolves to an entitlement in cosmetics.json, and every entitlement is granted by some sku
//   - an available sku grants nothing still marked 'build' (except the Founder and tip badges, built with the store)
//   - every store wheel style (cosmetics.json wheel_styles) is in the WheelStyle type in car-wheel.ts (src/preview/, or
//     src/game/vehicle/ if it moves); a style in that type the store doesn't list is valid only as a car's own factory
//     wheel (a `wheel:` in car-shape.ts, like the OC Hypercar's 'multi'), and no paid setup uses it; no paid setup
//     repeats a factory wheel
//   - the tip's custom amount sits above Stripe's $0.50 minimum
//   - no real brand word appears anywhere in either file
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const catalog = JSON.parse(read('src/store/catalog.json'));
const cosmetics = JSON.parse(read('src/store/cosmetics.json'));
const { FOUNDER_UNTIL } = JSON.parse(read('src/store/founder.json'));
const errs = [];
// the owner's price exceptions to the whole-dollar rule (PROJECT_OC_MONETIZATION.md §5): this sku at this price only
const PRICE_EXCEPTIONS = { 'hypercar-founder': 499 };
const FOUNDER_SKUS = new Set(['founder-pack-2026', 'hypercar-founder']);
const until = Date.parse(FOUNDER_UNTIL);
if (Number.isNaN(until)) errs.push(`founder.json: FOUNDER_UNTIL ${FOUNDER_UNTIL} is not a date`);
else {
  // the window ends at the last second of a day in Pacific time ('2026-12-31' alone would be 4 pm Pacific on the 30th)
  const t = new Date(until).toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour12: false });
  if (t !== '23:59:59') errs.push(`founder.json: FOUNDER_UNTIL ends at ${t} Pacific, not 23:59:59`);
}
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
  const exception = PRICE_EXCEPTIONS[s] !== undefined && c.price_cents === PRICE_EXCEPTIONS[s];
  if (!Number.isInteger(c.price_cents) || (c.price_cents % 100 !== 0 && !exception)) errs.push(`${s}: not a whole-dollar price (${c.price_cents} cents)`);
  if (c.price_cents < 200) errs.push(`${s}: under $2`);
  if (typeof c.available !== 'boolean') errs.push(`${s}: available must be true or false`);
  if (c.window) {
    if (!FOUNDER_SKUS.has(s)) errs.push(`${s}: only the founder offers have a window`);
    if (c.window.until !== 'FOUNDER_UNTIL') errs.push(`${s}: window.until must be "FOUNDER_UNTIL" (the one constant in src/store/founder.json), not ${c.window.until}`);
  } else if (FOUNDER_SKUS.has(s)) errs.push(`${s}: a founder offer without the founder window`);
  if ('unavailable_reason' in c && (typeof c.unavailable_reason !== 'string' || !c.unavailable_reason || c.available)) errs.push(`${s}: unavailable_reason is for an unavailable item, in words`);
  if ('caveat' in c && (typeof c.caveat !== 'string' || !c.caveat)) errs.push(`${s}: caveat must be words`);
  if ('serial' in c) {
    if (c.serial !== true || c.mode !== 'payment') errs.push(`${s}: serial is for a one-time payment (serial: true)`);
    const seeded = readdirSync(join(root, 'server/supabase/migrations')).filter((f) => f.endsWith('.sql')).some((f) => new RegExp(`serial_counters[^;]*'${s}'`).test(read('server/supabase/migrations/' + f)));
    if (!seeded) errs.push(`${s}: numbered, but no migration seeds its serial counter`);
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
    if (e.exclusive && e.exclusive !== s) errs.push(`${s}: grants ${g}, which is exclusive to ${e.exclusive}`);
    if ((e.vehicle || e.serial === 'server') && (c.serial !== true || c.window?.until !== 'FOUNDER_UNTIL'))
      errs.push(`${s}: grants ${g} (${e.vehicle ? 'a store car' : 'a server-numbered item'}), so it must be numbered (serial: true) and sold in the founder window (window.until "FOUNDER_UNTIL")`);
  }
}
for (const id of ents.keys()) if (!used.has(id)) errs.push(`entitlement ${id} is granted by no sku`);

// the two founder offers stay apart: no shared grant, and no name of one inside a name of the other
const offers = [...FOUNDER_SKUS].map((id) => catalog.find((c) => c.sku === id)).filter(Boolean);
if (offers.length === 2) {
  const [a, b] = offers.map((o) => o.grants.map((g) => ents.get(g)).filter(Boolean));
  for (const x of a) for (const y of b) {
    if (x.id === y.id) errs.push(`founder offers share ${x.id}`);
    const nx = x.name.toLowerCase(), ny = y.name.toLowerCase();
    if (nx.includes(ny) || ny.includes(nx)) errs.push(`founder offers' names blur: "${x.name}" and "${y.name}"`);
  }
}
// a car the store grants exists in the game before it is sold (CLAUDE.md: nothing is sold before it exists)
const carsTs = read('src/game/cars.ts');
for (const c of catalog) for (const g of c.grants) {
  const e = ents.get(g);
  if (!e?.vehicle) continue;
  if (e.type !== 'car') errs.push(`${e.id}: a vehicle grant must be type car`);
  if (e.outside_slots !== true || e.sell_back !== false) errs.push(`${e.id}: a store car sits outside the slot count (outside_slots: true) and is never sold back (sell_back: false)`);
  if (c.available && !new RegExp(`id: '${e.vehicle}'`).test(carsTs)) errs.push(`${c.sku}: available, but ${e.vehicle} is not in src/game/cars.ts`);
}

// Wheel styles. The store's styles (cosmetics.json wheel_styles) must each exist in the code's WheelStyle type. The
// code may hold more: a style built for one car alone, like the OC Hypercar's 'multi', is that car's factory wheel and
// is not a store cosmetic, so it is valid without being listed, as long as some car in car-shape.ts wears it; a style
// no car wears and the store doesn't list is drift (a new style forgotten in cosmetics.json, or a dead one in the code).
// No paid wheel setup may use a car-only style.
const firstOf = (...ps) => ps.find((p) => existsSync(join(root, p))) ?? null;
const wheelTs = firstOf('src/preview/car-wheel.ts', 'src/game/vehicle/car-wheel.ts');
const shapeTs = firstOf('src/preview/car-shape.ts', 'src/game/vehicle/car-shape.ts');
const m = wheelTs ? read(wheelTs).match(/export type WheelStyle = ([^;]+);/) : null;
if (!m) errs.push(`no WheelStyle type found (car-wheel.ts in src/preview/ or src/game/vehicle/)`);
const codeStyles = new Set(m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : []);
// the styles cars wear from the factory: each car's `wheel: 'x'` in car-shape.ts, followed by a comma, a brace or the
// line's end (the type's own line, `wheel: 'twin5' | 'five' | ...;`, is followed by `|` or `;` and doesn't count)
const factoryStyles = new Set(shapeTs ? [...read(shapeTs).matchAll(/\bwheel:\s*'(\w+)'\s*(?=[,}\r\n])/g)].map((x) => x[1]) : []);
const styles = new Set(Object.keys(cosmetics.wheel_styles).filter((k) => k !== 'note'));
const carOnly = new Set([...codeStyles].filter((st) => !styles.has(st)));
for (const st of styles) if (!codeStyles.has(st)) errs.push(`wheel style ${st} is in cosmetics.json but not in the WheelStyle type in ${wheelTs ?? 'car-wheel.ts'}`);
for (const st of carOnly) if (!factoryStyles.has(st)) errs.push(`wheel style ${st} is in ${wheelTs}, but the store doesn't list it (cosmetics.json wheel_styles) and no car in ${shapeTs ?? 'car-shape.ts'} wears it`);
for (const e of ents.values()) {
  if (e.type === 'wheels') {
    if (carOnly.has(e.style)) errs.push(`${e.id}: ${e.style} is a car's own wheel (car-only), not a store style in cosmetics.json wheel_styles`);
    else if (!styles.has(e.style)) errs.push(`${e.id}: unknown style ${e.style}`);
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
console.log(`catalog ok: ${catalog.length} skus (${avail} available), ${ents.size} entitlements; wheel styles: ${styles.size} in the store${carOnly.size ? `, car-only ${[...carOnly].join(', ')}` : ''}`);

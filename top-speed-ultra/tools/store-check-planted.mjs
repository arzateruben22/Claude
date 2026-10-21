// Plants bad catalogs and checks that tools/store-check-catalog.mjs refuses each one, on scratch copies of the files
// it reads (a temporary folder, removed afterwards); nothing in the repo changes:
//   node tools/store-check-planted.mjs        (exit code 1 if any plant comes out unexpected)
// Today it covers the Ultra graphics tier's rules (decision 15) and the sku-level rules they lean on. Each plant names
// the text the checker must print, so a plant refused for some other reason doesn't count.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = readdirSync(join(ROOT, 'server/supabase/migrations')).filter((f) => f.endsWith('.sql')).map((f) => 'server/supabase/migrations/' + f);
const files = ['tools/store-check-catalog.mjs', 'src/store/catalog.json', 'src/store/cosmetics.json', 'src/store/founder.json',
  'src/store/entitlements.ts', 'src/store/catalog.ts', 'src/game/cars.ts', 'src/preview/car-wheel.ts', 'src/preview/car-shape.ts',
  'src/game/vehicle/car-wheel.ts', 'src/game/vehicle/car-shape.ts', ...migrations].filter((f) => existsSync(join(ROOT, f)));
const scratch = mkdtempSync(join(tmpdir(), 'oc-store-plant-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));

const ULTRA = 'graphics-ultra';
const edit = (d, f, from, to) => {
  const p = join(d, f), s = readFileSync(p, 'utf8');
  if (!s.includes(from)) throw new Error(`${f} has no "${from}" to plant over`);
  writeFileSync(p, s.replace(from, to));
};
function run(name, mutate, wantText) {
  const d = join(scratch, name.replace(/\W+/g, '-'));
  for (const f of files) { mkdirSync(join(d, f, '..'), { recursive: true }); cpSync(join(ROOT, f), join(d, f)); }
  const cat = JSON.parse(readFileSync(join(d, 'src/store/catalog.json'), 'utf8'));
  const cos = JSON.parse(readFileSync(join(d, 'src/store/cosmetics.json'), 'utf8'));
  const ctx = { cat, cos, ent: cos.entitlements.find((e) => e.id === ULTRA), sku: cat.find((s) => s.sku === ULTRA), d };
  mutate(ctx);
  writeFileSync(join(d, 'src/store/catalog.json'), JSON.stringify(ctx.cat));
  writeFileSync(join(d, 'src/store/cosmetics.json'), JSON.stringify(ctx.cos));
  let out = '', code = 0;
  try { out = execFileSync(process.execPath, [join(d, 'tools/store-check-catalog.mjs')], { encoding: 'utf8' }); } catch (e) { out = String(e.stdout); code = e.status; }
  const ok = wantText ? code === 1 && out.includes(wantText) : code === 0;
  console.log(`${ok ? 'AS EXPECTED' : 'UNEXPECTED'}  ${name}: exit ${code}; ${out.trim().split('\n').slice(0, 4).join(' / ')}`);
  return ok;
}

const r = [
  run('this branch as it is', () => {}, null),
  run('the Ultra entitlement for the HD tier', (c) => { c.ent.tier = 'hd'; }, "is tier 'ultra'"),
  run('free tiers missing HD', (c) => { c.ent.free_tiers = ['low']; }, 'free_tiers'),
  run('the Founder Pack also grants Ultra', (c) => { c.cat.find((s) => s.sku === 'founder-pack-2026').grants.push(ULTRA); }, `granted by founder-pack-2026, ${ULTRA}`),
  run('the Ultra sku also grants a paint', (c) => { c.sku.grants.push('paint-laguna-tidepool'); }, 'granting exactly'),
  run('the Ultra sku as a subscription', (c) => { c.sku.mode = 'subscription'; c.sku.interval = 'month'; }, 'one-time payment'),
  run('the Ultra sku in the founder window', (c) => { c.sku.window = { until: 'FOUNDER_UNTIL' }; }, 'only the founder offers have a window'),
  run('copy without "Low and HD are free"', (c) => { c.sku.description = 'The maximum graphics tier.'; }, 'Low and HD are free'),
  run('the flag renamed in entitlements.ts', (c) => edit(c.d, 'src/store/entitlements.ts', `ULTRA_ENTITLEMENT = '${ULTRA}'`, "ULTRA_ENTITLEMENT = 'ultra'"), 'ultra (ULTRA_ENTITLEMENT in src/store/entitlements.ts) is not in cosmetics.json'),
  run('a second graphics entitlement (a paid HD)', (c) => { c.cos.entitlements.push({ ...c.ent, id: 'graphics-hd', tier: 'hd' }); c.cat.push({ ...c.sku, sku: 'graphics-hd', grants: ['graphics-hd'] }); }, 'a second graphics entitlement'),
  run('Ultra at $4.99', (c) => { c.sku.price_cents = 499; }, 'whole-dollar'),
  run('Ultra marked build while available', (c) => { c.ent.status = 'build'; }, `available but grants unbuilt ${ULTRA}`),
  // the review of 2026-10-21: each of these passed the checker before
  run('the entitlement retyped (access) and the sku kind pack', (c) => { c.ent.type = 'access'; c.sku.kind = 'pack'; }, "the Ultra entitlement is type 'graphics', not access"),
  run('the sku renamed in catalog.json only', (c) => { c.sku.sku = 'ultra-graphics'; }, `${ULTRA} (ULTRA_SKU in src/store/catalog.ts) is not in catalog.json`),
  run('a second graphics sku that grants nothing', (c) => { c.cat.push({ ...c.sku, sku: 'graphics-extra', name: 'Extra Graphics', grants: [] }); }, 'graphics-extra: grants nothing'),
  run('ULTRA_SKU renamed in catalog.ts only', (c) => edit(c.d, 'src/store/catalog.ts', `ULTRA_SKU = '${ULTRA}'`, "ULTRA_SKU = 'ultra-graphics'"), 'ultra-graphics (ULTRA_SKU in src/store/catalog.ts) is not in catalog.json'),
  run('a pack that grants nothing', (c) => { c.cat.find((s) => s.sku === 'paint-pack-coast').grants = []; }, 'paint-pack-coast: grants nothing'),
  // owner mode: 'ready' (the owner's go-ahead) passes with this branch's gate, and fails once the gate is gone
  run("Ultra marked 'ready' (owner mode refuses live builds)", (c) => { c.ent.status = 'ready'; }, null),
  run("Ultra marked 'ready' with owner mode working in live builds", (c) => { c.ent.status = 'ready'; edit(c.d, 'src/store/entitlements.ts', '  if (CONFIG.live) return false;\n', ''); }, "doesn't refuse live builds"),
];
console.log(`${r.filter(Boolean).length}/${r.length} as expected`);
process.exit(r.every(Boolean) ? 0 : 1);

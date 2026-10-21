// Phase 1a checks for the on-foot page (PROJECT_OC_ON_FOOT.md, "Phase 1"). Drives dist/onfoot/index.html (build it
// with `npx vite build --config src/onfoot/vite.config.ts`) in headless Chromium with SwiftShader through the
// window.__onfoot hooks, and prints PASS or FAIL with the numbers each check saw. Screenshots: tests/out/onfoot/.
//
//   node tests/onfoot.mjs                     every group (desktop, landscape, portrait, walks, names)
//   node tests/onfoot.mjs --only=walks,names  some groups
//   node tests/onfoot.mjs --walks=1000        how many random walks (default 1000)
//
// One browser at a time (this machine is shared). A boot takes minutes in software rendering: be patient.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(ROOT, 'dist', 'onfoot', 'index.html');
const OUT = path.join(ROOT, 'tests', 'out', 'onfoot');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const WALKS = Number((process.argv.find((a) => a.startsWith('--walks=')) ?? '--walks=1000').slice(8));
const want = (g) => !only.length || only.includes(g);
if (!existsSync(PAGE)) { console.error(`No build at ${PAGE}. Run \`npx vite build --config src/onfoot/vite.config.ts\` first.`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try { const note = (await fn()) ?? ''; results.push({ name, ok: true, note }); console.log(`  PASS  ${name}  ${note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
  catch (e) { results.push({ name, ok: false, note: e.message }); console.log(`  FAIL  ${name}  ${e.message}`); }
}
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };
const T = 1500000;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(size, query, touch) {
  const ctx = await browser.newContext(touch ? { viewport: { width: size[0], height: size[1] }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto(pathToFileURL(PAGE).href + '?' + query);
  await page.waitForFunction(() => window.__onfoot?.ready || window.__onfootError, null, { timeout: T, polling: 500 });
  const err = await page.evaluate(() => window.__onfootError ?? null);
  if (err) errors.push('boot: ' + err);
  return { ctx, page, errors, bootS: Math.round((Date.now() - t0) / 1000) };
}
const frames = async (page, n = 2) => { const f0 = await page.evaluate(() => window.__onfoot.frames); await page.waitForFunction((k) => window.__onfoot.frames >= k, f0 + n, { timeout: T, polling: 200 }); };
async function shot(page, name) { await frames(page, 2); await page.screenshot({ path: path.join(OUT, name), timeout: 300000 }); return name; }
const H = (page, js) => page.evaluate(js);

/** the chip and the credit are on screen and readable */
async function hudVisible(page) {
  const h = await H(page, 'window.__onfoot.hud()'), vp = page.viewportSize();
  const inView = (r) => r && r.visible && r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1;
  expect(inView(h.crowd) && /Simulated crowd/.test(h.crowd.text), `crowd chip not visible: ${JSON.stringify(h.crowd)}`);
  expect(inView(h.credit) && /OpenStreetMap/.test(h.credit.text) && /Overture/.test(h.credit.text), `credit not visible: ${JSON.stringify(h.credit)}`);
  // the chip and the credit don't overlap the action button
  if (h.act?.visible) { const a = h.act, c = h.credit; expect(!(c.x < a.x + a.w && c.x + c.w > a.x && c.y < a.y + a.h && c.y + c.h > a.y), 'the credit overlaps the action button'); }
  return h;
}

// ------------------------------------------------------------------------------------------------ desktop
const summary = {};
if (want('desktop')) {
  console.log('desktop 1280x720, High');
  const { ctx, page, errors, bootS } = await open([1280, 720], 'quality=high&day=Sat&hour=14&hint=1', false);
  await check('desktop: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); return `boot ${bootS} s`; });
  await check('desktop: day screenshot, chip and credit visible', async () => {
    const n = await shot(page, 'onfoot-1280x720-day.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopDay = s;
    await H(page, 'window.__onfoot.hint(false)');
    return `${n}: ${s.calls} calls, ${s.triangles} tris, frame ${s.frameMs} ms, sim ${s.simMs} ms`;
  });
  await check('desktop: third person in the yard', async () => {
    await H(page, "window.__onfoot.go(-5098, -8362); window.__onfoot.look(205, -10); window.__onfoot.view('third')");
    await frames(page, 4);
    const n = await shot(page, 'onfoot-1280x720-third-day.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopThird = s;
    return `${n}: avatar LOD ${s.avatar?.lod}, ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: night screenshot (Sat 21:00), chip and credit visible', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5104, -8337); window.__onfoot.look(185, 4); window.__onfoot.setClock('Sat', 21)");
    const n = await shot(page, 'onfoot-1280x720-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopNight = s;
    return `${n}: ${s.crowd}, ${s.parkedCars} parked cars, ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: third person at night', async () => {
    await H(page, "window.__onfoot.go(-5108, -8380); window.__onfoot.look(150, -6); window.__onfoot.view('third')");
    const n = await shot(page, 'onfoot-1280x720-third-night.png'); await hudVisible(page);
    return n;
  });
  await check('desktop: inside the Shed at night', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.go(-5122, -8366); window.__onfoot.look(270, 0)");
    const n = await shot(page, 'onfoot-1280x720-shed-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopShed = s;
    return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  await check('desktop: Ultra preset at night (shadows 4096, ambient occlusion, bloom), no errors', async () => {
    const q = await H(page, "window.__onfoot.setQuality('ultra')");
    await H(page, "window.__onfoot.go(-5104, -8337); window.__onfoot.look(185, 4)");
    const n = await shot(page, 'onfoot-1280x720-ultra-night.png'); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary.desktopUltra = s;
    await H(page, "window.__onfoot.setQuality('high')");
    expect(q === 'ultra' && s.quality === 'ultra' && !errors.length, `quality ${q}/${s.quality}; ${errors.join(' | ')}`);
    return `${n}: ${s.calls} calls, ${s.triangles} tris, frame ${s.frameMs} ms`;
  });
  await check('desktop: tap a seat, walk there, sit, stand (tap to go and the action button)', async () => {
    await H(page, "window.__onfoot.view('first'); window.__onfoot.setClock('Sat', 21)");
    const seats = await H(page, 'window.__onfoot.seats()');
    const s = seats.find((x) => x.kind === 'bench');
    await H(page, `window.__onfoot.go(${s.approach.x + 3}, ${s.approach.z + 2})`);
    const r = await H(page, `(() => { const o = window.__onfoot; const t = o.tap(${s.approach.x}, ${s.approach.z}); o.sim(12); return { t, a: o.actions(), pos: o.pos() }; })()`);
    expect(r.t && r.a[0] === 'Sit', `no Sit offered after tap to go: ${JSON.stringify(r)}`);
    const sat = await H(page, 'window.__onfoot.act()');
    const p1 = await H(page, 'window.__onfoot.pos()');
    expect(sat.did === 'sit' && p1.sitting !== null, `didn't sit: ${JSON.stringify(sat)} ${JSON.stringify(p1)}`);
    await shot(page, 'onfoot-1280x720-seated-night.png');
    const st = await H(page, 'window.__onfoot.act()');
    const p2 = await H(page, 'window.__onfoot.pos()');
    expect(st.did === 'stand' && p2.sitting === null, `didn't stand: ${JSON.stringify(st)}`);
    return `seat ${p1.sitting} (${s.at}), path ${r.t.length} m`;
  });
  await check('desktop: reduced motion turns off head bob and transitions', async () => {
    await H(page, 'window.__onfoot.reducedMotion(false); window.__onfoot.go(-5104, -8337)');
    const bob = await H(page, 'window.__onfoot.bobRange()');
    const rm = await H(page, 'window.__onfoot.reducedMotion(true)');
    await H(page, 'window.__onfoot.go(-5104, -8337)');
    const bob2 = await H(page, 'window.__onfoot.bobRange()');
    const css = await H(page, "getComputedStyle(document.getElementById('toast')).transitionDuration");
    expect(bob > 0.015 && bob2 === 0 && rm.transitionsOff && /^0s/.test(css), `bob ${bob} -> ${bob2}, transitions ${css}`);
    await H(page, 'window.__onfoot.reducedMotion(false)');
    return `head bob ${(bob * 100).toFixed(1)} cm -> ${bob2} cm; toast transition ${css}`;
  });
  await ctx.close();
}

// ------------------------------------------------------------------------------------------------ phones
for (const [g, size, label] of [['landscape', [844, 390], '844x390'], ['portrait', [390, 844], '390x844']]) {
  if (!want(g)) continue;
  console.log(`phone ${label}, touch (the default preset for a coarse pointer)`);
  const { ctx, page, errors, bootS } = await open(size, 'day=Sat&hour=14&hint=1', true);
  await check(`${label}: boots with no console errors`, async () => { expect(!errors.length, errors.join(' | ')); const s = await H(page, 'window.__onfoot.stats()'); return `boot ${bootS} s, quality ${s.quality}`; });
  await check(`${label}: day screenshot, chip and credit visible`, async () => { const n = await shot(page, `onfoot-${label}-day.png`); await hudVisible(page); const s = await H(page, 'window.__onfoot.stats()'); summary[`${label}Day`] = s; await H(page, 'window.__onfoot.hint(false)'); return `${n}: ${s.calls} calls, ${s.triangles} tris`; });
  await check(`${label}: night screenshot, chip and credit visible`, async () => {
    await H(page, "window.__onfoot.go(-5104, -8337); window.__onfoot.look(185, 4); window.__onfoot.setClock('Sat', 21)");
    const n = await shot(page, `onfoot-${label}-night.png`); await hudVisible(page);
    const s = await H(page, 'window.__onfoot.stats()'); summary[`${label}Night`] = s; return `${n}: ${s.calls} calls, ${s.triangles} tris`;
  });
  if (g === 'landscape') {
    await check('Low preset: within 150 draw calls and 250k triangles in the busiest views', async () => {
      const views = [[-5104, -8337, 185, 4], [-5104, -8337, 0, -10], [-5150, -8300, 110, 0], [-5040, -8270, 300, -2], [-5100, -8405, 0, 0], [-5098, -8362, 205, -10]];
      let worst = { calls: 0, triangles: 0 }; const seen = [];
      for (const [x, z, yaw, pitch] of views) {
        await H(page, `window.__onfoot.go(${x}, ${z}); window.__onfoot.look(${yaw}, ${pitch})`);
        await frames(page, 2);
        const s = await H(page, 'window.__onfoot.stats()');
        seen.push(`${s.calls}/${Math.round(s.triangles / 1000)}k`);
        worst = { calls: Math.max(worst.calls, s.calls), triangles: Math.max(worst.triangles, s.triangles) };
      }
      await H(page, "window.__onfoot.view('third')"); await frames(page, 2);
      const s3 = await H(page, 'window.__onfoot.stats()'); seen.push(`third ${s3.calls}/${Math.round(s3.triangles / 1000)}k`);
      worst = { calls: Math.max(worst.calls, s3.calls), triangles: Math.max(worst.triangles, s3.triangles) };
      await H(page, "window.__onfoot.view('first')");
      summary.lowWorst = worst;
      expect(worst.calls <= 150 && worst.triangles <= 250000, `worst ${worst.calls} calls, ${worst.triangles} triangles (views: ${seen.join(', ')})`);
      return `worst ${worst.calls} calls, ${worst.triangles} triangles (calls/tris per view: ${seen.join(', ')})`;
    });
  }
  await ctx.close();
}

// ------------------------------------------------------------------------------------------------ random walks
if (want('walks')) {
  console.log(`random walks: ${WALKS}`);
  const { ctx, page, errors } = await open([640, 360], 'quality=low&day=Sat&hour=21', false);
  await check('walks: boots with no console errors', async () => { expect(!errors.length, errors.join(' | ')); });
  await H(page, 'window.__onfoot.freeze(true)');
  const cols = await H(page, 'window.__onfoot.colliders()'), region = await H(page, 'window.__onfoot.region()');
  const starts = await H(page, `window.__onfoot.randomFree(${WALKS * 2}, 5757)`);
  const R = 0.3, TOL = 0.02;
  // an independent checker: the colliders and the walkable region as plain data, tested here in Node
  const C = 4, hash = new Map(), key = (i, j) => i * 100003 + j;
  const bboxOf = (c) => c.k === 'circ' ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r] : c.k === 'seg' ? [Math.min(c.ax, c.bx) - c.r, Math.min(c.az, c.bz) - c.r, Math.max(c.ax, c.bx) + c.r, Math.max(c.az, c.bz) + c.r]
    : (() => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (let i = 0; i < c.pts.length; i += 2) { x0 = Math.min(x0, c.pts[i]); x1 = Math.max(x1, c.pts[i]); z0 = Math.min(z0, c.pts[i + 1]); z1 = Math.max(z1, c.pts[i + 1]); } return [x0, z0, x1, z1]; })();
  cols.forEach((c, n) => { const [x0, z0, x1, z1] = bboxOf(c); for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k = key(i, j); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(n); } });
  const nearby = (x0, z0, x1, z1) => { const s = new Set(); for (let i = Math.floor((x0 - 1) / C); i <= Math.floor((x1 + 1) / C); i++) for (let j = Math.floor((z0 - 1) / C); j <= Math.floor((z1 + 1) / C); j++) for (const n of hash.get(key(i, j)) ?? []) s.add(n); return [...s].map((n) => cols[n]); };
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const inPoly = (x, z, P) => { let ins = false; for (let i = 0, j = P.length / 2 - 1; i < P.length / 2; j = i++) { const xi = P[i * 2], zi = P[i * 2 + 1], xj = P[j * 2], zj = P[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const sdist = (c, x, z) => {
    if (c.k === 'circ') return Math.hypot(x - c.x, z - c.z) - c.r;
    if (c.k === 'seg') return segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r;
    let d = Infinity; const P = c.pts, n = P.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) d = Math.min(d, segDist(x, z, P[j * 2], P[j * 2 + 1], P[i * 2], P[i * 2 + 1]));
    return inPoly(x, z, P) ? -d : d;
  };
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => { const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax), d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx); return d1 * d2 < 0 && d3 * d4 < 0; };
  const rows = region.rows, inRegion = (x, z) => { const i = Math.floor((x - region.x0) / region.cell), j = Math.floor((z - region.z0) / region.cell); if (j < 0 || j >= region.nz) return false; const r = rows[j]; for (let k = 0; k < r.length; k += 2) if (i >= r[k] && i < r[k] + r[k + 1]) return true; return false; };
  const fails = []; let points = 0, steps = 0, metres = 0, tapWalks = 0, stickWalks = 0, noPath = 0;
  const verify = (path, label) => {
    for (let i = 0; i < path.length; i += 2) {
      const x = path[i], z = path[i + 1]; points++;
      for (const c of nearby(x - R, z - R, x + R, z + R)) { const d = sdist(c, x, z); if (d < R - TOL) { fails.push(`${label}: inside ${c.tag} (overlap ${(R - d).toFixed(3)} m) at ${x.toFixed(2)}, ${z.toFixed(2)}`); return; } }
      if (!inRegion(x, z)) { fails.push(`${label}: off the walkable area at ${x.toFixed(2)}, ${z.toFixed(2)}`); return; }
      if (i >= 2) {
        const ax = path[i - 2], az = path[i - 1]; steps++; metres += Math.hypot(x - ax, z - az);
        for (const c of nearby(Math.min(ax, x), Math.min(az, z), Math.max(ax, x), Math.max(az, z))) {
          if (c.k === 'seg' && cross(ax, az, x, z, c.ax, c.az, c.bx, c.bz)) { fails.push(`${label}: crossed ${c.tag} between ${ax.toFixed(2)},${az.toFixed(2)} and ${x.toFixed(2)},${z.toFixed(2)}`); return; }
          if (c.k === 'poly') { const P = c.pts, n = P.length / 2; for (let a = 0, b = n - 1; a < n; b = a++) if (cross(ax, az, x, z, P[b * 2], P[b * 2 + 1], P[a * 2], P[a * 2 + 1])) { fails.push(`${label}: crossed the edge of ${c.tag} at ${x.toFixed(2)},${z.toFixed(2)}`); return; } }
        }
      }
    }
  };
  // the checker must be able to fail: a made-up path straight through the Shed's west wall, one into a table, and
  // one into the road away from a crosswalk, each has to be caught
  {
    const before = fails.length;
    verify([-5150, -8370, -5149.2, -8370, -5148.4, -8370, -5147.6, -8370, -5146.8, -8370], 'self-test wall');
    verify([-5112.6, -8383, -5112, -8383], 'self-test table');
    verify([-5060, -8402.5, -5060, -8410], 'self-test road');
    const caught = fails.splice(before);
    await check('walks: the independent checker catches a path through a wall, into a table and onto the road', async () => {
      expect(caught.length === 3, `caught ${caught.length} of 3: ${caught.join(' | ')}`);
      return caught.map((c) => c.split(': ')[1]).join('; ');
    });
    points = 0; steps = 0; metres = 0;
  }
  const B = 20;
  for (let w0 = 0; w0 < WALKS; w0 += B) {
    const batch = [];
    for (let w = w0; w < Math.min(WALKS, w0 + B); w++) {
      const s = starts[w % starts.length], t = starts[(w * 7 + 3) % starts.length], seed = w * 2654435761 % 1000;
      batch.push(w % 2 ? { kind: 'tap', s, t } : { kind: 'stick', s, legs: [0, 1, 2, 3].map((k) => ({ yaw: ((seed * 37 + k * 97) % 360), sx: (((seed + k * 13) % 21) - 10) / 10, sy: (((seed * 3 + k * 7) % 21) - 10) / 10, run: (seed + k) % 3 === 0 })) });
    }
    const res = await H(page, `(() => { const o = window.__onfoot, out = [];
      for (const b of ${JSON.stringify(batch)}) {
        const st = o.go(b.s.x, b.s.z); let path = [st.x, st.z], info = '';
        if (b.kind === 'tap') {
          const dx = b.t.x - b.s.x, dz = b.t.z - b.s.z, d = Math.hypot(dx, dz), k = d > 60 ? 60 / d : 1;
          const p = o.tap(b.s.x + dx * k, b.s.z + dz * k);
          if (!p) { out.push({ kind: 'tap', path, nopath: true }); continue; }
          const r = o.sim(Math.min(45, p.length / 1.3 + 4)); path = path.concat(r.path); info = p.length;
        } else for (const L of b.legs) { o.look(L.yaw, 0); const r = o.walk(L.sx, L.sy, 1.5, L.run); path = path.concat(r.path); }
        out.push({ kind: b.kind, path, info, end: o.pos() });
      }
      return out; })()`);
    for (const [i, r] of res.entries()) {
      if (r.kind === 'tap') tapWalks++; else stickWalks++;
      if (r.nopath) { noPath++; continue; }
      verify(r.path, `walk ${w0 + i} (${r.kind})`);
    }
    if (fails.length > 20) break;
  }
  summary.walks = { walks: tapWalks + stickWalks, tapWalks, stickWalks, noPath, points, steps, metres: Math.round(metres), colliders: cols.length, fails: fails.length };
  await check(`walks: ${WALKS} random walks never end inside a collider, leave the walkable area or cross a wall`, async () => {
    expect(!fails.length, `${fails.length} failures: ${fails.slice(0, 6).join(' | ')}`);
    return `${tapWalks} tap-to-go walks + ${stickWalks} stick walks, ${points} positions over ${Math.round(metres)} m checked against ${cols.length} colliders and the region (${noPath} taps had no path)`;
  });
  await ctx.close();
}
await browser.close();

// ------------------------------------------------------------------------------------------------ names
if (want('names')) {
  await check("names: the real venue's name appears nowhere in src/onfoot or the shipped data", async () => {
    const files = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
    walk(path.join(ROOT, 'src', 'onfoot'));
    walk(path.join(ROOT, 'src', 'data', 'anaheim'));
    files.push(PAGE);
    const re = /golden[\s_-]*road/i, hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(!hits.length, `found in ${hits.join(', ')}`);
    return `${files.length} files clean (src/onfoot, every file in src/data/anaheim, dist/onfoot/index.html)`;
  });
  await check('names: our own names are on the page (Lot 57, Two Lane Tacos, Night Shift Noodles)', async () => {
    const html = readFileSync(PAGE, 'utf8');
    for (const n of ['LOT 57', 'TWO LANE TACOS', 'NIGHT SHIFT', 'Simulated crowd', 'OpenStreetMap']) expect(html.includes(n), `missing ${n}`);
    for (const w of ['people here now', 'real-time']) expect(!html.toLowerCase().includes(w), `the page says "${w}"`);
  });
}

writeFileSync(path.join(OUT, 'onfoot-checks.json'), JSON.stringify({ when: new Date().toISOString(), results, summary }, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Details in tests/out/onfoot/onfoot-checks.json`);
process.exit(failed.length ? 1 : 0);

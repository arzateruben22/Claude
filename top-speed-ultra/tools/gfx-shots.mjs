// The graphics sweep: one seeded Free Drive in the OC Hypercar (owner mode), rendered at a chosen quality preset
// from each camera at each time of day, with the frame time and the draw calls measured on the same frames.
//
//   node tools/gfx-shots.mjs --tag=before --quality=ultra [--html=dist/top-speed-ultra.html] [--size=1280x720]
//        [--times=day,golden,night] [--cams=cockpit,hood,chase] [--perf=6 [--perfat=day]] [--seed=4242] [--ahead=8] [--hdr]
//        [--eval="js run in the page before the shots, with g = window.__game"] [--hud] [--tones=agx,aces] [--pin]
//
// --pin: put the car back where Free Drive starts it (I-405 North at 12%, lane 2, standing) and reseed Math.random
// once paused, so the frames before the pause (their number depends on the machine's load) can't move the car or
// the random draws: two runs of the same build then render the same frames.
//
// --tones: after each shot, the same frame again with each of these tone mappings in the output pass (only the
// tone map changes, the scene and the exposure stay), saved as <tag>-<quality>-<time>-<cam>-<tone>.png, then the
// preset's own tone mapping is put back.
// --alts=noao,nobloom [--altcams=chase]: the same frame again with the AO pass or the bloom pass switched off (then
// back on), saved as <tag>-<quality>-<time>-<cam>-<alt>.png: what each pass adds, measured on identical frames.
//
// Shots go to tests/out/gfx/<tag>-<quality>-<time>-<cam>.png and the numbers to tests/out/gfx/<tag>-<quality>.json.
// Everything that moves is pinned so two builds can be compared frame for frame: Math.random is seeded before the
// page loads, the traffic is reseeded after the start, the drive is the autopilot's for a fixed time, the game is
// paused, and the camera's smoothing is run to its fixed point before each shot. SwiftShader renders in software
// (a frame with post-processing can take a minute here), so the frame times are only good for comparing presets
// and builds on this machine, not for what a GPU does.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const HTML = path.resolve(opt('html', path.join(ROOT, 'dist', 'top-speed-ultra.html')));
const TAG = opt('tag', 'shot'), QUALITY = opt('quality', 'high');
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const TIMES = opt('times', 'day,golden,night').split(',').filter(Boolean);
const CAMS = opt('cams', 'cockpit,hood,chase').split(',').filter(Boolean);
const PERF = Number(opt('perf', '0')), PERF_AT = opt('perfat', '').split(',').filter(Boolean);   // --perfat=day: time only those
const SEED = Number(opt('seed', '4242')), AHEAD = Number(opt('ahead', '8'));
const EVAL = opt('eval', ''), PIN = flag('pin');
const ALTS = opt('alts', '').split(',').filter(Boolean), ALT_CAMS = opt('altcams', '').split(',').filter(Boolean);
const ALT_PASS = { noao: 'gtao', nobloom: 'bloom' };
const TONES = opt('tones', '').split(',').filter(Boolean), TONE_ID = { none: 0, linear: 1, reinhard: 2, cineon: 3, aces: 4, agx: 6 };   // three 0.160's tone maps
const OUT = path.resolve(opt('out', path.join(ROOT, 'tests', 'out', 'gfx')));
const TIME_PRESET = { day: 'day', golden: 'sunset', night: 'night', sunrise: 'sunrise' };
mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(({ seed, quality }) => {
  // a seeded Math.random (mulberry32), so the stars, the traffic and everything else random come out the same
  let s = seed >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  localStorage.setItem('tsu.settings', JSON.stringify({ quality, adaptive: false, density: 'moderate', time: 'day', weather: 'clear', start: 'I-405 North', exit: '', corner: 'off', owner: true, tiers: 2 }));
}, { seed: SEED, quality: QUALITY });
const page = await ctx.newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(pathToFileURL(HTML).href + '#owner');
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 600000 });
log('menu');
const game = (fn, arg) => page.evaluate(fn, arg);
await game(() => window.__game.chooseOwnerCar('oc-hyper'));
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 600000 });
log('driving');
const setup = await game(({ seed, ahead, pin }) => {
  const g = window.__game;
  g.setPaused(true);
  if (pin) {
    let r = seed >>> 0;
    Math.random = () => { r = (r + 0x6d2b79f5) >>> 0; let t = r; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const m = g.findMain('I-405 North');
    g.placeCar(m, m.len * 0.12, Math.min(1, m.lanes - 1), 0);      // as Game.start does for Free Drive
    g.time = 0; g.acc = 0;
  }
  g.traffic.reseed(seed); g.traffic.fill(g.view());
  g.fastForward(ahead, {}, 30);
  for (let i = 0; i < 400 && g.roads.update(g.phys.x, g.phys.z, Math.sin(g.phys.psi), Math.cos(g.phys.psi), 6) + g.terrain.update(g.phys.x, g.phys.z, 3) > 0; i++) { /* build what's in view */ }
  // from here on nothing random: the body's engine buzz (PlayerCar.update) draws from Math.random every frame, and
  // the number of frames before a shot depends on the machine's load
  Math.random = () => 0.5;
  return { car: g.driving, road: g.path.label, s: Math.round(g.phys.s), mph: Math.round(g.phys.vx * 2.236936), cars: g.traffic.cars.length, roads: g.stats.roads, tiles: g.stats.tiles };
}, { seed: SEED, ahead: AHEAD, pin: PIN });
log('set up', JSON.stringify(setup));
if (EVAL) await game((src) => { const g = window.__game; return (0, eval)(`(g) => { ${src} }`)(g); }, EVAL);
// only the 3D view in the picture (no pause panel, no HUD) unless --hud
await page.addStyleTag({ content: flag('hud') ? '.overlay { visibility: hidden !important; }' : '#root * { visibility: hidden !important; } #root canvas.game-canvas { visibility: visible !important; }' });
// count every draw call in a frame (the composer's passes, the shadow map, the mirrors), and time each frame
await game(() => {
  const g = window.__game, orig = g.frame;
  window.__perf = [];
  g.renderer.info.autoReset = false;
  g.frame = (now) => {
    const r = g.renderer; r.info.reset();
    const a = performance.now(); orig(now); const b = performance.now();
    window.__perf.push({ now, cpu: b - a, calls: r.info.render.calls, tris: r.info.render.triangles });
  };
});
const frames = async (n) => { const f0 = await game(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 900000, polling: 250 }); };
const settle = (cam) => game((c) => {
  const g = window.__game;
  g.setCam(c); g.camBlend = 1;
  g.car.update(0, 1, g.phys, false, g.time, g.path);     // the car where the physics has it (a paused frame does this)
  for (let i = 0; i < 4; i++) g.updateCamera(10);       // the camera's smoothing, run to its fixed point
}, cam);
const sky = (time) => game((t) => { const g = window.__game; g.updateSettings({ ...g.settings, time: t, weather: 'clear' }); for (let i = 0; i < 150; i++) g.weatherTick(0.1); }, time);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

const result = { tag: TAG, quality: QUALITY, size: `${W}x${H}`, html: path.relative(ROOT, HTML), pinned: PIN, tones: TONES, alts: ALTS, setup, shots: [], perf: [] };
for (const time of TIMES) {
  await sky(TIME_PRESET[time] ?? time);
  for (const cam of CAMS) {
    await settle(cam);
    await frames(2);
    const file = path.join(OUT, `${TAG}-${QUALITY}-${time}-${cam}.png`);
    await page.screenshot({ path: file, timeout: 900000 });
    const last = await game(() => window.__perf[window.__perf.length - 1]);
    result.shots.push({ time, cam, file: path.relative(ROOT, file), calls: last?.calls, tris: last?.tris });
    log('shot', path.basename(file), `calls ${last?.calls}`);
    for (const tone of TONES) {
      const was = await game((t) => { const r = window.__game.renderer, w = r.toneMapping; r.toneMapping = t; return w; }, TONE_ID[tone]);
      await frames(2);
      const tf = path.join(OUT, `${TAG}-${QUALITY}-${time}-${cam}-${tone}.png`);
      await page.screenshot({ path: tf, timeout: 900000 });
      await game((w) => { window.__game.renderer.toneMapping = w; }, was);
      result.shots[result.shots.length - 1][tone] = path.relative(ROOT, tf);
      log('shot', path.basename(tf));
    }
    for (const alt of ALT_CAMS.length && !ALT_CAMS.includes(cam) ? [] : ALTS) {
      const had = await game((k) => { const p = window.__game[k]; if (!p) return false; p.enabled = false; return true; }, ALT_PASS[alt]);
      if (!had) { log('no pass for', alt); continue; }
      await frames(2);
      const af = path.join(OUT, `${TAG}-${QUALITY}-${time}-${cam}-${alt}.png`);
      await page.screenshot({ path: af, timeout: 900000 });
      await game((k) => { window.__game[k].enabled = true; }, ALT_PASS[alt]);
      result.shots[result.shots.length - 1][alt] = path.relative(ROOT, af);
      log('shot', path.basename(af));
    }
    if (flag('hdr')) {
      // the scene's linear colour before the AO, the bloom and the tone map (what the bloom's threshold is against):
      // two frames with those passes off (the render pass's target is then what the output pass reads), copied into
      // a float target and read back. The bottom 15% of rows of the read-back (the top of the picture) is mostly sky.
      const off = await game(() => { const g = window.__game, k = ['gtao', 'bloom'].filter((n) => g[n] && g[n].enabled); for (const n of k) g[n].enabled = false; return k; });
      await frames(2);
      const hdr = await game(() => {
        const g = window.__game, r = g.renderer, c = g.composer;
        if (!c) return null;
        const src = c.readBuffer, w = src.width, h = src.height;
        // three's classes from objects the game already has (it doesn't put THREE on window); the mountain ring is a
        // plain Mesh on a plain BufferGeometry
        const RT = src.constructor, Mesh = g.env.mountains.constructor, Geo = g.env.mountains.geometry.constructor, Attr = g.env.mountains.geometry.attributes.position.constructor;
        const Shader = g.env.stars.material.constructor, Scene = g.scene.constructor, Ortho = g.env.flareCam.constructor;
        const dst = new RT(w, h, { type: 1015 /* FloatType */ });
        const geo = new Geo(); geo.setAttribute('position', new Attr(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
        const quad = new Mesh(geo, new Shader({ uniforms: { t: { value: src.texture } }, vertexShader: 'varying vec2 u; void main() { u = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'uniform sampler2D t; varying vec2 u; void main() { gl_FragColor = texture2D(t, u); }', depthTest: false, depthWrite: false }));
        quad.frustumCulled = false;
        const sc = new Scene(); sc.add(quad);
        const cam = new Ortho(-1, 1, 1, -1, 0, 1), ac = r.autoClear, tm = r.toneMapping;
        r.setRenderTarget(dst); r.render(sc, cam); r.setRenderTarget(null); r.autoClear = ac; r.toneMapping = tm;
        const px = new Float32Array(w * h * 4); r.readRenderTargetPixels(dst, 0, 0, w, h, px); dst.dispose(); geo.dispose(); quad.material.dispose();
        const lum = new Float32Array(w * h), sky = [];
        for (let i = 0; i < w * h; i++) { lum[i] = 0.2125 * px[i * 4] + 0.7154 * px[i * 4 + 1] + 0.0721 * px[i * 4 + 2]; if (Math.floor(i / w) >= h * 0.85) sky.push(lum[i]); }
        const pct = (a, q) => { const s = Float32Array.from(a).sort(); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * q))] * 1000) / 1000; };
        const over = (t) => { let n = 0; for (const v of lum) if (v > t) n++; return n; };
        return { p50: pct(lum, 0.5), p99: pct(lum, 0.99), p999: pct(lum, 0.999), max: pct(lum, 1), sky50: pct(sky, 0.5), sky99: pct(sky, 0.99), skyMax: pct(sky, 1),
          over: Object.fromEntries([0.92, 1.5, 2, 2.2, 3, 4, 6].map((t) => [t, over(t)])), exposure: r.toneMappingExposure };
      });
      await game((k) => { const g = window.__game; for (const n of k) g[n].enabled = true; }, off);
      result.shots[result.shots.length - 1].hdr = hdr;
      log('hdr', JSON.stringify(hdr));
    }
    if (PERF > 0 && (!PERF_AT.length || PERF_AT.includes(time))) {
      await game(() => { window.__perf.length = 0; });
      await frames(PERF + 1);
      const p = await game(() => window.__perf.slice());
      const gaps = p.slice(1).map((x, i) => x.now - p[i].now);
      const row = { time, cam, frameMs: Math.round(median(gaps)), cpuMs: Math.round(median(p.map((x) => x.cpu)) * 10) / 10, calls: median(p.map((x) => x.calls)), tris: median(p.map((x) => x.tris)), n: gaps.length };
      result.perf.push(row);
      log('perf', JSON.stringify(row));
    }
  }
}
result.info = await game(() => {
  const g = window.__game, r = g.renderer, gl = r.getContext();
  return { pixelRatio: r.getPixelRatio(), buffer: `${r.domElement.width}x${r.domElement.height}`, toneMapping: r.toneMapping, maxAniso: r.capabilities.getMaxAnisotropy(), maxSamples: r.capabilities.maxSamples,
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), shadowMap: g.env.sun.shadow.mapSize.x, far: g.camera.far, textures: r.info.memory.textures, geometries: r.info.memory.geometries,
    roads: g.stats.roads, tiles: g.stats.tiles, traffic: g.stats.traffic, ultra: g.gfxInfo ? g.gfxInfo() : null };
});
result.errors = errors;
result.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(path.join(OUT, `${TAG}-${QUALITY}.json`), JSON.stringify(result, null, 2));
log('done', JSON.stringify(result.info), errors.length ? `errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
await browser.close();

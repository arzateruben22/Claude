// The graphics sweep: one seeded Free Drive in the OC Hypercar (owner mode), rendered at a chosen quality preset
// from each camera at each time of day, with the frame time and the draw calls measured on the same frames.
//
//   node tools/gfx-shots.mjs --tag=before --quality=ultra [--html=dist/top-speed-ultra.html] [--size=1280x720]
//        [--times=day,golden,night] [--cams=cockpit,hood,chase] [--perf=6 [--perfat=day]] [--seed=4242] [--ahead=8]
//        [--pin] [--tones=agx] [--alts=nobloom,noao [--altcams=chase]] [--bloomvar=B:max:2.2:0.5:0.3] [--hdr] [--probe]
//        [--ablate=day:chase [--abperf=2]]
//        [--eval="js run in the page before the shots, with g = window.__game"] [--hud] [--leak=ultra,2]
//
// --stream=40,130 [--streamq=veryhigh,ultra]: at the end, 40 s at 130 m/s along I-405 North from where Free Drive
// starts it, as the 60 fps frame loop streams it (one road chunk and one terrain tile a frame), without rendering, at
// this preset or at each one listed: each frame's streaming time and, every second, the backlog of unbuilt road chunks
// and terrain tiles (the streaming budget). The car is moved along the lane at a steady speed rather than driven, so
// traffic and curves can't hold it back.
// --leak=ultra,2: at the end, two round trips from this preset to Ultra and back (a rendered frame on each), counting
// the live GPU textures and geometries after each: what switching presets leaves behind.
// --pin: put the car back where Free Drive starts it (I-405 North at 12%, lane 2, standing) and reseed Math.random
// once paused, so the frames before the pause (their number depends on the machine's load) can't move the car or
// the random draws: two runs of the same build then render the same frames.
//
// The variants below reuse the frame just shot instead of rendering the scene again (a held frame: the game's own
// loop draws nothing while it runs, so the canvas keeps what the variant drew until the screenshot):
// --tones=agx,aces: the same frame through the output pass with each of these tone mappings (only the tone map
//   changes; the scene, the AO, the bloom and the exposure stay), saved as <tag>-<quality>-<time>-<cam>-<tone>.png.
// --alts=nobloom,noao [--altcams=chase]: the same frame without the bloom (the bloom's input, snapshotted inside the
//   frame, through the output pass) or without the AO (the bloom over the AO's input, the raw scene render), saved as
//   <tag>-<quality>-<time>-<cam>-<alt>.png: what each pass adds. noao needs a preset with AO.
// --bloomvar: the same, with the bloom set another way over a copy of its input (see below).
// --probe: for each time of day, what the reflections see: the scene's environment map as the background, behind a
//   mirror sphere, a white clear-coated sphere and a black gloss sphere, saved as <tag>-<quality>-<time>-probe.png.
// --hdr: the bloom's input (the scene's linear colour after the AO, before the bloom and the tone map: what its
//   threshold is compared against) read back on each shot's frame: luminance percentiles over the frame and over its
//   top 15% (mostly sky), and how many pixels pass each threshold. Uses the bloom pass's own luma weights.
// --ablate=day:chase [--abperf=2]: at that time and camera, what each part of the frame costs on this machine, pass
//   by pass (see below): the scene with and without the sun's shadow map, at 4K, without MSAA; the AO, the bloom, the
//   output pass; the environment map's rebuild with and without the clouds and the mountains.
//
// Shots go to tests/out/gfx/<tag>-<quality>-<time>-<cam>.png and the numbers to tests/out/gfx/<tag>-<quality>.json.
// Everything that moves is pinned so two builds can be compared frame for frame: Math.random is seeded before the
// page loads, the traffic is reseeded after the start, the drive is the autopilot's for a fixed time, the game is
// paused, and the camera's smoothing is run to its fixed point before each shot. SwiftShader renders in software
// (a frame with post-processing can take minutes here), so the frame times are only good for comparing presets
// and builds on this machine, not for what a GPU does.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const list = (k) => opt(k, '').split(',').filter(Boolean);
const HTML = path.resolve(opt('html', path.join(ROOT, 'dist', 'top-speed-ultra.html')));
const TAG = opt('tag', 'shot'), QUALITY = opt('quality', 'high');
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const TIMES = opt('times', 'day,golden,night').split(',').filter(Boolean);
const CAMS = opt('cams', 'cockpit,hood,chase').split(',').filter(Boolean);
const PERF = Number(opt('perf', '0')), PERF_AT = list('perfat');   // --perfat=day: time only those
const SEED = Number(opt('seed', '4242')), AHEAD = Number(opt('ahead', '8'));
const EVAL = opt('eval', ''), PIN = flag('pin'), HDR = flag('hdr'), PROBE = flag('probe');
const ALTS = list('alts'), ALT_CAMS = list('altcams');
// --bloomvar=name:key:threshold:knee:strength[:clamp],... (key 'luma' = three's high pass, 'max' = the brightest
// channel with a soft knee, only the light over the threshold, capped at clamp): the same frame with the bloom set so
const BLOOMVARS = list('bloomvar').map((v) => { const [name, key, t, k, st, cl] = v.split(':'); return { name, key, threshold: +t, knee: +k, strength: +st, clamp: cl ? +cl : 1e4 }; });
const TONES = list('tones'), TONE_ID = { none: 0, linear: 1, reinhard: 2, cineon: 3, aces: 4, agx: 6 };   // three 0.160's tone maps
const [AB_TIME, AB_CAM] = opt('ablate', ':').split(':'), AB_PERF = Number(opt('abperf', '2'));
const [STREAM_S, STREAM_V] = opt('stream', '0,0').split(',').map(Number);
const STREAM_Q = list('streamq');
const [LEAK_Q, LEAK_N] = [opt('leak', '').split(',')[0], Number(opt('leak', ',2').split(',')[1] || 2)];
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
page.setDefaultTimeout(900000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(pathToFileURL(HTML).href + '#owner');
await page.waitForFunction(() => window.__game?.net && document.querySelector('.overlay.menu'), null, { timeout: 900000 });
log('menu');
const game = (fn, arg) => page.evaluate(fn, arg);
await game(() => window.__game.chooseOwnerCar('oc-hyper'));
await page.getByRole('radio', { name: /Free Drive/ }).click();
await page.getByRole('button', { name: 'Drive', exact: true }).click();
await page.waitForFunction(() => !window.__game.inAttract && !document.querySelector('.loadbar'), null, { timeout: 900000 });
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
// the page side: every draw call in a frame counted (the composer's passes, the shadow map, the mirrors) and each
// frame timed; held frames for the variants; the bloom's input read back on request
await game(() => {
  const g = window.__game, orig = g.frame;
  window.__perf = [];
  window.__job = null; window.__holding = false;
  g.renderer.info.autoReset = false;
  g.frame = (now) => {
    if (window.__holding) {
      g.raf = requestAnimationFrame(g.frame);
      const j = window.__job; window.__job = null;
      if (j) { let out; try { out = j.fn(); } catch (e) { out = { error: String(e && e.stack || e) }; } j.res(out ?? true); }
      return;
    }
    // the frame's wall time with the GPU's work in it: a 1-pixel read of the canvas waits for everything the frame
    // drew (without it, the first frames after a pause queue their commands and return in milliseconds)
    const r = g.renderer, gl = r.getContext(); r.info.reset();
    const a = performance.now(); orig(now); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px ??= new Uint8Array(4)); const b = performance.now();
    window.__perf.push({ now, ms: b - a, calls: r.info.render.calls, tris: r.info.render.triangles });
  };
  // run fn in the next animation frame instead of the game's frame, and hold the canvas until __release()
  window.__inFrame = (fn) => new Promise((res) => { window.__job = { fn, res }; window.__holding = true; });
  window.__release = () => { window.__holding = false; };
  // three's classes, from objects the game already has (it doesn't put THREE on window)
  const K = window.__K = {
    RT: g.composer ? g.composer.renderTarget1.constructor : null, Mesh: g.env.mountains.constructor, Geo: g.env.mountains.geometry.constructor,
    Attr: g.env.mountains.geometry.attributes.position.constructor, Shader: g.env.stars.material.constructor, Scene: g.scene.constructor,
    Ortho: g.env.flareCam.constructor, Sphere: g.env.clouds.geometry.constructor, Phys: null,
  };
  g.car.root.traverse((o) => { if (!K.Phys && o.material && o.material.isMeshPhysicalMaterial) K.Phys = o.material.constructor; });
  // the linear colour in a render target, as luminance statistics (the bloom's weights: 0.299, 0.587, 0.114)
  window.__measure = (r, src) => {
    const w = src.width, h = src.height, prev = r.getRenderTarget();
    const dst = new K.RT(w, h, { type: 1015 /* FloatType */ });
    const geo = new K.Geo(); geo.setAttribute('position', new K.Attr(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const quad = new K.Mesh(geo, new K.Shader({ uniforms: { t: { value: src.texture } }, vertexShader: 'varying vec2 u; void main() { u = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'uniform sampler2D t; varying vec2 u; void main() { gl_FragColor = texture2D(t, u); }', depthTest: false, depthWrite: false }));
    quad.frustumCulled = false;
    const sc = new K.Scene(); sc.add(quad);
    const ac = r.autoClear; r.autoClear = true;
    r.setRenderTarget(dst); r.render(sc, new K.Ortho(-1, 1, 1, -1, 0, 1)); r.setRenderTarget(prev); r.autoClear = ac;
    const px = new Float32Array(w * h * 4); r.readRenderTargetPixels(dst, 0, 0, w, h, px); dst.dispose(); geo.dispose(); quad.material.dispose();
    // luminance (what the bloom keys on) and the brightest channel (what a saturated lamp has: a red one is bright in
    // red but dim in luminance), over the frame and over its top 15% (mostly sky)
    const lum = new Float32Array(w * h), mx = new Float32Array(w * h), sky = [], skyMx = [];
    for (let i = 0; i < w * h; i++) {
      lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; mx[i] = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      if (Math.floor(i / w) >= h * 0.85) { sky.push(lum[i]); skyMx.push(mx[i]); }
    }
    const pct = (a, q) => { const s = Float32Array.from(a).sort(); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * q))] * 1000) / 1000; };
    const over = (a, t) => { let n = 0; for (const v of a) if (v > t) n++; return n; };
    const T = [0.92, 1.5, 2.2, 3, 6];
    return { w, h, p50: pct(lum, 0.5), p99: pct(lum, 0.99), p999: pct(lum, 0.999), max: pct(lum, 1), sky50: pct(sky, 0.5), sky99: pct(sky, 0.99), skyMax: pct(sky, 1),
      over: Object.fromEntries(T.map((t) => [t, over(lum, t)])), skyOver: Object.fromEntries(T.map((t) => [t, over(sky, t)])),
      maxc: { p999: pct(mx, 0.999), max: pct(mx, 1), skyMax: pct(skyMx, 1), over: Object.fromEntries(T.map((t) => [t, over(mx, t)])), skyOver: Object.fromEntries(T.map((t) => [t, over(skyMx, t)])) },
      exposure: r.toneMappingExposure };
  };
  // the bloom's high pass keyed on luminance (three's) or on the brightest channel with a soft knee (Ultra's lights-only
  // key: src/game/gfx/ultra.ts lightsOnlyBloom, the same GLSL)
  window.__bloomKey = (b, key, knee, clampTo = 1e4) => {
    const m = b.materialHighPassFilter;
    m.__orig ??= m.fragmentShader;
    // three's own high pass (the build's Ultra bloom has its lights-only body: put three's back first), then the
    // lights-only body over it for 'max'
    const LUMA = 'vec3 luma = vec3( 0.299, 0.587, 0.114 );\n\t\t\tfloat v = dot( texel.xyz, luma );\n\t\t\tvec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );\n\t\t\tfloat alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );\n\t\t\tgl_FragColor = mix( outputColor, texel, alpha );';
    const MAX = 'float b = max( texel.r, max( texel.g, texel.b ) );\n\t\t\tfloat soft = clamp( b - luminosityThreshold + knee, 0.0, 2.0 * knee );\n\t\t\tsoft = soft * soft / ( 4.0 * knee + 1e-4 );\n\t\t\tvec3 c = texel.rgb * ( max( soft, b - luminosityThreshold ) / max( b, 1e-4 ) );\n\t\t\tc *= min( 1.0, bloomClamp / max( max( c.r, max( c.g, c.b ) ), 1e-4 ) );\n\t\t\tgl_FragColor = vec4( c, 1.0 );';
    let base = m.__orig.replace(/float b = max\( texel\.r[\s\S]*gl_FragColor = vec4\( c, 1\.0 \);/, LUMA);
    if (!base.includes('uniform float bloomClamp;')) base = base.replace('uniform float smoothWidth;', 'uniform float smoothWidth;\n\t\tuniform float knee;\n\t\tuniform float bloomClamp;');
    if (!/vec3 luma[\s\S]*gl_FragColor = mix\( outputColor, texel, alpha \);/.test(base)) return false;
    m.fragmentShader = key === 'max' ? base.replace(/vec3 luma[\s\S]*gl_FragColor = mix\( outputColor, texel, alpha \);/, MAX) : base;
    m.uniforms.knee = { value: knee }; m.uniforms.bloomClamp = { value: clampTo }; m.needsUpdate = true;
    return true;
  };
  // a texture copied into a render target of its own (half float, the composer's size), and a render target drawn
  // through the output pass to the screen
  window.__copy = (r, tex, dst) => {
    const w = tex.image.width, h = tex.image.height, prev = r.getRenderTarget();
    dst ??= new K.RT(w, h, { type: 1016 /* HalfFloatType */, depthBuffer: false });
    const geo = new K.Geo(); geo.setAttribute('position', new K.Attr(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const quad = new K.Mesh(geo, new K.Shader({ uniforms: { t: { value: tex } }, vertexShader: 'varying vec2 u; void main() { u = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'uniform sampler2D t; varying vec2 u; void main() { gl_FragColor = texture2D(t, u); }', depthTest: false, depthWrite: false }));
    quad.frustumCulled = false;
    const sc = new K.Scene(); sc.add(quad);
    const ac = r.autoClear; r.autoClear = true;
    r.setRenderTarget(dst); r.render(sc, new K.Ortho(-1, 1, 1, -1, 0, 1)); r.setRenderTarget(prev); r.autoClear = ac;
    geo.dispose(); quad.material.dispose();
    return dst;
  };
  window.__show = (rt) => { const g = window.__game, c = g.composer, out = c.passes[c.passes.length - 1]; out.render(g.renderer, null, rt, 0, false); g.env.renderFlare(); };
  // snapshots taken inside a real frame, for the variants: the AO's input (the raw scene render) and the bloom's input
  // (the scene after the AO); the bloom's input is also what --hdr measures
  window.__hdr = null; window.__snapWant = false; window.__snap = { raw: null, pre: null };
  if (g.gtao) {
    const a = g.gtao, ar = a.render;
    a.render = function (r, wb, rb, dt, mask) { if (window.__snapWant) window.__snap.raw = window.__copy(r, rb.texture, window.__snap.raw); return ar.call(this, r, wb, rb, dt, mask); };
  }
  if (g.bloom) {
    const b = g.bloom, br = b.render;
    b.render = function (r, wb, rb, dt, mask) {
      if (window.__snapWant) { window.__snapWant = false; window.__snap.pre = window.__copy(r, rb.texture, window.__snap.pre); if (window.__hdrOn) window.__hdr = window.__measure(r, rb); }
      return br.call(this, r, wb, rb, dt, mask);
    };
  }
});
const frames = async (n) => { const f0 = await game(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 1800000, polling: 250 }); };
const settle = (cam) => game((c) => {
  const g = window.__game;
  g.setCam(c); g.camBlend = 1;
  g.car.update(0, 1, g.phys, false, g.time, g.path);     // the car where the physics has it (a paused frame does this)
  for (let i = 0; i < 4; i++) g.updateCamera(10);       // the camera's smoothing, run to its fixed point
}, cam);
const sky = (time) => game((t) => { const g = window.__game; g.updateSettings({ ...g.settings, time: t, weather: 'clear' }); for (let i = 0; i < 150; i++) g.weatherTick(0.1); }, time);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const perf = async (n) => {
  await game(() => { window.__perf.length = 0; });
  await frames(n);
  const p = await game(() => window.__perf.slice());
  const gaps = p.slice(1).map((x, i) => x.now - p[i].now);
  // frameMs: the frame's own time, GPU included (the median); gapMs: from one frame's start to the next's
  return { frameMs: Math.round(median(p.map((x) => x.ms))), gapMs: Math.round(median(gaps)), calls: median(p.map((x) => x.calls)), tris: median(p.map((x) => x.tris)), n: p.length, all: p.map((x) => Math.round(x.ms)) };
};

const result = { tag: TAG, quality: QUALITY, size: `${W}x${H}`, html: path.relative(ROOT, HTML), pinned: PIN, tones: TONES, alts: ALTS, setup, shots: [], perf: [], probes: [], ablate: null };
for (const time of TIMES) {
  await sky(TIME_PRESET[time] ?? time);
  for (const cam of CAMS) {
    await settle(cam);
    await game((hdr) => { window.__hdr = null; window.__hdrOn = hdr; window.__snapWant = true; }, HDR);
    await frames(2);
    const file = path.join(OUT, `${TAG}-${QUALITY}-${time}-${cam}.png`);
    await page.screenshot({ path: file, timeout: 900000 });
    const last = await game(() => window.__perf[window.__perf.length - 1]);
    const shot = { time, cam, file: path.relative(ROOT, file), calls: last?.calls, tris: last?.tris };
    result.shots.push(shot);
    log('shot', path.basename(file), `calls ${last?.calls}`);
    if (HDR) { shot.hdr = await game(() => window.__hdr); log('hdr', JSON.stringify(shot.hdr)); }
    // the same frame through the output pass with another tone map (after a full frame the output pass's input is the
    // composer's write buffer: swap, run the output pass, swap back), then the flare over it as the game draws it
    for (const tone of TONES) {
      const r = await game((t) => window.__inFrame(() => {
        const g = window.__game, rr = g.renderer, c = g.composer;
        if (!c) return { error: 'no composer' };
        const out = c.passes[c.passes.length - 1], was = rr.toneMapping;
        rr.toneMapping = t; c.swapBuffers(); out.render(rr, c.writeBuffer, c.readBuffer, 0, false); c.swapBuffers();
        g.env.renderFlare(); rr.toneMapping = was;
      }), TONE_ID[tone]);
      if (r?.error) { log('tone', tone, r.error); await game(() => window.__release()); continue; }
      const tf = path.join(OUT, `${TAG}-${QUALITY}-${time}-${cam}-${tone}.png`);
      await page.screenshot({ path: tf, timeout: 900000 });
      await game(() => window.__release());
      shot[tone] = path.relative(ROOT, tf);
      log('shot', path.basename(tf));
    }
    // the frame without the bloom (the bloom's input through the output pass), without the AO (the bloom on the raw scene
    // render), and with other bloom settings (on a copy of the bloom's input): from this frame's snapshots, no re-render
    const variant = async (name, fn, arg) => {
      const r = await game(({ src, arg }) => window.__inFrame(() => (0, eval)(src)(window.__game, arg)), { src: fn.toString(), arg });
      if (r?.error) { log('variant', name, r.error); await game(() => window.__release()); return null; }
      const vf = path.join(OUT, `${TAG}-${QUALITY}-${time}-${cam}-${name}.png`);
      await page.screenshot({ path: vf, timeout: 900000 });
      await game(() => window.__release());
      shot[name] = path.relative(ROOT, vf);
      log('shot', path.basename(vf), arg ? JSON.stringify({ ...arg, wb: undefined }) : '');
      return vf;
    };
    const withBloom = (g, v) => {
      // the bloom (as set, or with v's key, threshold, knee and strength) over a copy of `from`, then the output pass
      const c = g.composer, b = g.bloom, r = g.renderer, from = window.__snap[v.from];
      if (!c || !b || !from) return { error: `no bloom pass or no ${v.from} snapshot` };
      const keep = { strength: b.strength, threshold: b.threshold, src: b.materialHighPassFilter.fragmentShader, knee: b.materialHighPassFilter.uniforms.knee };
      if (v.key && !window.__bloomKey(b, v.key, v.knee, v.clamp)) return { error: 'the high-pass shader did not match' };
      if (v.key) { b.strength = v.strength; b.threshold = v.threshold; }
      const tmp = window.__copy(r, from.texture);
      b.renderToScreen = false; b.render(r, null, tmp, 0, false);
      window.__show(tmp); tmp.dispose();
      const m = b.materialHighPassFilter; m.fragmentShader = keep.src; if (keep.knee) m.uniforms.knee = keep.knee; else delete m.uniforms.knee; m.needsUpdate = true;
      b.strength = keep.strength; b.threshold = keep.threshold;
    };
    if (!ALT_CAMS.length || ALT_CAMS.includes(cam)) {
      for (const alt of ALTS) {
        if (alt === 'nobloom') await variant(alt, (g) => { if (!window.__snap.pre) return { error: 'no bloom snapshot' }; window.__show(window.__snap.pre); });
        else if (alt === 'noao') await variant(alt, (g, v) => (0, eval)(v.wb)(g, v), { from: 'raw', wb: withBloom.toString() });
        else log('no such alt', alt);
      }
      for (const v of BLOOMVARS) await variant('bloom' + v.name, (g, vv) => (0, eval)(vv.wb)(g, vv), { ...v, from: 'pre', wb: withBloom.toString() });
    }
    if (PERF > 0 && (!PERF_AT.length || PERF_AT.includes(time))) {
      const row = { time, cam, ...(await perf(PERF)) };
      result.perf.push(row);
      log('perf', JSON.stringify(row));
    }
    if (time === AB_TIME && cam === AB_CAM) {
      // what each part of the frame costs, timed pass by pass on this frame in held frames (each run waits for the GPU
      // with a 1-pixel read): the scene render without and with the sun's shadow map (at the preset's size and at 4K),
      // without MSAA, then the AO, the bloom and the output pass, and the environment map's rebuild with and without
      // the clouds and the mountains. Medians of AB_PERF runs.
      const job = (src, arg) => game(async ({ src, arg }) => { const r = await window.__inFrame(() => (0, eval)(src)(window.__game, arg)); window.__release(); return r; }, { src, arg });
      const lib = `(g, n) => {
        const r = g.renderer, gl = r.getContext(), px = new Uint8Array(4);
        const sync = () => { r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
        window.__T = (fn) => { const ts = []; for (let i = 0; i < n; i++) { sync(); const a = performance.now(); fn(); sync(); ts.push(performance.now() - a); } ts.sort((x, y) => x - y); return Math.round(ts[Math.floor(ts.length / 2)]); };
        return true; }`;
      await job(lib, AB_PERF);
      const ab = { runs: AB_PERF };
      const steps = {
        sceneNoShadowMs: `(g) => { const c = g.composer, sm = g.renderer.shadowMap; if (!c) return null; sm.autoUpdate = false; const t = window.__T(() => c.passes[0].render(g.renderer, null, c.readBuffer)); sm.autoUpdate = true; return t; }`,
        sceneShadowMs: `(g) => { const c = g.composer; if (!c || !g.renderer.shadowMap.enabled) return null; return window.__T(() => c.passes[0].render(g.renderer, null, c.readBuffer)); }`,
        sceneShadow4kMs: `(g) => { const c = g.composer, s = g.env.sun.shadow, k = s.mapSize.x; if (!c || !g.renderer.shadowMap.enabled || k === 4096) return null;
          const set = (v) => { s.mapSize.set(v, v); s.map?.dispose(); s.map = null; };
          set(4096); c.passes[0].render(g.renderer, null, c.readBuffer); const t = window.__T(() => c.passes[0].render(g.renderer, null, c.readBuffer)); set(k); return t; }`,
        sceneNoShadowNoMsaaMs: `(g) => { const c = g.composer, sm = g.renderer.shadowMap, k = c ? c.renderTarget1.samples : 0; if (!c || !k) return null;
          const set = (v) => { const t = c.renderTarget1; t.samples = v; t.dispose(); };   // the scene's target (Ultra's second buffer has none)
          sm.autoUpdate = false; set(0); c.passes[0].render(g.renderer, null, c.readBuffer); const t = window.__T(() => c.passes[0].render(g.renderer, null, c.readBuffer)); set(k); sm.autoUpdate = true; return t; }`,
        aoMs: `(g) => { const c = g.composer; if (!c || !g.gtao) return null; c.passes[0].render(g.renderer, null, c.readBuffer); return window.__T(() => g.gtao.render(g.renderer, c.writeBuffer, c.readBuffer)); }`,
        bloomMs: `(g) => { const c = g.composer; if (!c || !g.bloom) return null; return window.__T(() => g.bloom.render(g.renderer, c.writeBuffer, c.readBuffer, 0, false)); }`,
        outputMs: `(g) => { const c = g.composer; if (!c) return null; const o = c.passes[c.passes.length - 1]; return window.__T(() => o.render(g.renderer, c.writeBuffer, c.readBuffer, 0, false)); }`,
        envDetailMs: `(g) => { const e = g.env, was = e.envInfo.detail; e.setEnvDetail(true); const t = window.__T(() => e.rebuildEnv()); e.setEnvDetail(was); return t; }`,
        envPlainMs: `(g) => { const e = g.env, was = e.envInfo.detail; e.setEnvDetail(false); const t = window.__T(() => e.rebuildEnv()); e.setEnvDetail(was); return t; }`,
      };
      for (const [name, src] of Object.entries(steps)) {
        const t = await job(src);
        ab[name] = t && typeof t === 'object' && t.error ? t.error : t;
        log('ablate', name, JSON.stringify(ab[name]));
      }
      await job(`(g) => { g.env.rebuildEnv(); return true; }`);
      result.ablate = ab;
    }
  }
  if (PROBE) {
    // what the reflections see at this time of day: the environment map as the background (its sharpest level), a
    // mirror sphere, a white clear-coated sphere (the paint) and a black gloss sphere (the glass), from the chase camera
    // (no frame needed: this time of day's shots already rendered, so its environment map is built)
    await settle('chase');
    const r = await game(() => window.__inFrame(() => {
      const g = window.__game, K = window.__K, rr = g.renderer, cam = g.camera, env = g.scene.environment;
      if (!env || !K.Phys) return { error: 'no environment map or no physical material to copy' };
      cam.updateMatrixWorld();
      const sc = new K.Scene(); sc.background = env; sc.environment = env; sc.backgroundBlurriness = 0;
      const geo = new K.Sphere(1, 96, 48), mats = [
        new K.Phys({ color: 0xffffff, metalness: 1, roughness: 0 }),
        new K.Phys({ color: 0xf2f2f4, metalness: 0, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.03 }),
        new K.Phys({ color: 0x0b0d10, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }),
      ];
      const fwd = cam.getWorldDirection(cam.position.clone()), right = fwd.clone().cross(cam.up).normalize();
      mats.forEach((m, i) => { const s = new K.Mesh(geo, m); s.position.copy(cam.position).addScaledVector(fwd, 7).addScaledVector(right, (i - 1) * 2.5); s.position.y -= 0.6; sc.add(s); });
      rr.setRenderTarget(null); rr.render(sc, cam);
      geo.dispose(); for (const m of mats) m.dispose();
      return { envBuilds: g.env.envInfo.builds, layers: g.env.envInfo.layers };
    }));
    const pf = path.join(OUT, `${TAG}-${QUALITY}-${time}-probe.png`);
    if (r?.error) log('probe', r.error);
    else { await page.screenshot({ path: pf, timeout: 900000 }); result.probes.push({ time, file: path.relative(ROOT, pf), ...r }); log('probe', path.basename(pf), JSON.stringify(r)); }
    await game(() => window.__release());
  }
}
if (STREAM_S > 0) {
  // the streaming budget at speed, without rendering: STREAM_S seconds at STREAM_V m/s along I-405 North from Free
  // Drive's start (lane 2), the car moved a 60th of a second at a time as the frame loop sees it, then the frame's
  // streaming (Game.stream(1): one road chunk and one terrain tile). Each frame's building is timed and, every second,
  // the road chunks still unbuilt within the draw distance and the terrain tiles still missing or not yet at full detail
  // within the full-detail radius are counted. Each preset starts with everything in view built (as a preset switch does).
  result.stream = [];
  for (const q of STREAM_Q.length ? STREAM_Q : [QUALITY]) {
    const r = await game(({ secs, v, q }) => {
      const g = window.__game;
      if (g.settings.quality !== q) g.updateSettings({ ...g.settings, quality: q });
      const info = g.gfxInfo ? g.gfxInfo() : { quality: q, drawDistance: 0, lodNear: 520 }, TILE = 480, tKey = (tx, tz) => (tx + 512) * 1024 + (tz + 512);
      const R = info.drawDistance + 300, near = info.lodNear;
      const terrainBacklog = () => {
        const x = g.phys.x, z = g.phys.z; let all = 0, lod0 = 0;
        for (let tx = Math.floor((x - R) / TILE); tx <= Math.floor((x + R) / TILE); tx++) for (let tz = Math.floor((z - R) / TILE); tz <= Math.floor((z + R) / TILE); tz++) {
          const d = Math.max(0, Math.hypot((tx + 0.5) * TILE - x, (tz + 0.5) * TILE - z) - TILE * 0.71);
          if (d > R) continue;
          const lod = d < near ? 0 : 1, have = g.terrain.tiles.get(tKey(tx, tz));
          if (!have || have.lod > lod) { all++; if (lod === 0) lod0++; }
        }
        return { all, lod0 };
      };
      let path = g.findMain('I-405 North'), s = path.len * 0.12;
      const lane = () => path.laneCenter(Math.min(1, path.lanes - 1));
      g.placeCar(path, s, 1, v);
      for (let i = 0; i < 600 && g.roads.update(g.phys.x, g.phys.z, Math.sin(g.phys.psi), Math.cos(g.phys.psi), 6) + g.terrain.update(g.phys.x, g.phys.z, 3) > 0; i++) { /* all in view */ }
      const ms = [], rows = [];
      let f = 0;
      for (; f < secs * 60; f++) {
        s += v / 60;
        while (s > path.len && path.next) { s -= path.len; path = path.next; }
        if (s > path.len) break;
        g.phys.placeAt(path, s, lane(), v); g.path = path;
        const a = performance.now(); g.stream(1); ms.push(performance.now() - a);
        if (f % 60 === 59) rows.push({ t: (f + 1) / 60, road: path.label, roadsPending: g.roads.pending(g.phys.x, g.phys.z), terrain: terrainBacklog() });
      }
      const so = [...ms].sort((x, y) => x - y), pc = (p) => Math.round(so[Math.min(so.length - 1, Math.floor(so.length * p))] * 10) / 10;
      const worst = rows.reduce((m, r) => ({ roads: Math.max(m.roads, r.roadsPending), lod0: Math.max(m.lod0, r.terrain.lod0), all: Math.max(m.all, r.terrain.all) }), { roads: 0, lod0: 0, all: 0 });
      const tail = rows.slice(Math.floor(rows.length / 2));      // the second half, once the first view's backlog is gone
      const mean = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : 0;
      return { secs: f / 60, v, quality: info.quality, drawDistance: info.drawDistance, lodNear: near, km: Math.round(f / 60 * v / 100) / 10,
        frameBuildMs: { p50: pc(0.5), p95: pc(0.95), p99: pc(0.99), max: pc(1), mean: mean(ms) }, worst,
        steady: { roads: mean(tail.map((r) => r.roadsPending)), lod0: mean(tail.map((r) => r.terrain.lod0)), all: mean(tail.map((r) => r.terrain.all)) },
        chunks: g.stats.roads, tiles: g.stats.tiles, rows };
    }, { secs: STREAM_S, v: STREAM_V, q });
    result.stream.push(r);
    log('stream', JSON.stringify({ ...r, rows: undefined }));
  }
}
if (LEAK_Q) {
  // preset round trips: to LEAK_Q and back, a rendered frame on each, and the live GPU textures and geometries counted
  // back on this preset each time (the old switch left the passes' render targets behind)
  const count = () => game(() => { const m = window.__game.renderer.info.memory; return { textures: m.textures, geometries: m.geometries }; });
  const to = (q) => game((qq) => { const g = window.__game; g.updateSettings({ ...g.settings, quality: qq }); }, q);
  const rows = [await count()];
  for (let i = 0; i < LEAK_N; i++) {
    await to(LEAK_Q); await frames(1);
    await to(QUALITY); await frames(1);
    rows.push(await count());
    log('leak', i + 1, JSON.stringify(rows[rows.length - 1]));
  }
  result.leak = { via: LEAK_Q, rows };
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

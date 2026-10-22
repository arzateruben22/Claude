// Test page for the people builder. Views (?view=): bodies, lineup, faces, talk, walk.
//   faces: &only=reference,casual &expr=neutral,smile &dist=0.55 &dy=0.045 (aim below the eyes) &cy=0 (camera height)
//   node tools/preview-shoot.mjs src/onfoot/test-people.ts tests/out/onfoot/people-<view>.png --size=960x540 --query="view=<view>"
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildPerson, Person, preset, PresetName, randomPerson, PersonOptions, PRESETS, lodFor } from './people';

declare global { interface Window { __previewReady?: boolean; __previewError?: string; __people?: unknown } }
addEventListener('error', (e) => { window.__previewError = String(e.message || e); });
addEventListener('unhandledrejection', (e) => { window.__previewError = String((e as PromiseRejectionEvent).reason); });

const q = new URLSearchParams(location.search);
if (q.get('cdbg')) (globalThis as { __clothDbg?: number }).__clothDbg = Number(q.get('cdbg'));
const view = q.get('view') ?? 'bodies';
const quality = (q.get('quality') ?? 'high') as 'high' | 'phone';

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
document.body.style.margin = '0';
document.body.style.background = '#000';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
let frameMs = 0;
const info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0, frameMs, ...extra });
const extra: Record<string, unknown> = {};
(window as unknown as { __stage: { info(): unknown } }).__stage = { info };   // (typed locally: src/preview declares its own)
renderer.info.autoReset = false;

function studio() {
  scene.background = new THREE.Color(0x2a2724);
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x3a3028, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(3, 5, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 4, bottom: -1, near: 0.5, far: 30 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9); rim.position.set(-4, 3, -5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
}

// ------------------------------------------------------------------------------------------------ the patio at dusk
// Our own fictional lot (Lot 57): pavers, a dark back wall with sconces, string lights on poles, tables. All in code.
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function patio(o: { lights?: boolean } = {}) {
  scene.background = canvasTex(4, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0d1424'); gr.addColorStop(0.45, '#26304c'); gr.addColorStop(0.7, '#5a4a5a'); gr.addColorStop(0.86, '#b06a48'); gr.addColorStop(1, '#2a1c16');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  });
  scene.fog = new THREE.Fog(0x2a2430, 14, 40);
  // a small environment for reflections and catchlights: dark, warm bulbs above, a cool street glow to one side
  const env = new THREE.Scene(); env.background = new THREE.Color(0x0c0a0c);
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc27a).multiplyScalar(6) });
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bulb); b.position.set(-4 + i, 2.2 + Math.sin(i) * 0.3, -2 + (i % 3)); env.add(b); }
  const street = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7a96c8).multiplyScalar(0.9), side: THREE.DoubleSide }));
  street.position.set(-5, 0.6, 1); street.rotation.y = Math.PI / 2; env.add(street);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ color: 0x3a4466, side: THREE.DoubleSide }));
  sky.position.set(0, 4, 0); sky.rotation.x = Math.PI / 2; env.add(sky);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.add(new THREE.HemisphereLight(0x5a6c98, 0x2a1e16, 0.75));
  const street2 = new THREE.DirectionalLight(0x9ab4ff, 0.5); street2.position.set(-6, 3, 4); scene.add(street2);
  const pavers = canvasTex(512, 512, (g) => {
    g.fillStyle = '#5b5550'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 80 + ((x * 7 + y * 13) % 5) * 5; g.fillStyle = `rgb(${v + 6},${v},${v - 6})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    }
  });
  pavers.wrapS = pavers.wrapT = THREE.RepeatWrapping; pavers.repeat.set(20, 20);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: pavers, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(24, 4.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9 }));
  wall.position.set(0, 2.1, -7.5); scene.add(wall);
  const sconceM = new THREE.MeshStandardMaterial({ color: 0x221a14, emissive: 0xffb060, emissiveIntensity: 3 });
  const keyLights: THREE.PointLight[] = [];
  for (const x of [-4.5, 0, 4.5]) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.28, 12), sconceM); sc.position.set(x, 2.3, -7.3); scene.add(sc);
    const L = new THREE.PointLight(0xffa850, 6, 9, 2); L.position.set(x, 2.3, -7.0); scene.add(L);
  }
  // string lights: catenaries between poles, warm bulbs, a few real lights along them
  const poleM = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.6, metalness: 0.4 });
  const bulbM = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffc070, emissiveIntensity: 4 });
  const ends: [number, number][] = [[-6, -6], [6, -6], [6, 4], [-6, 4]];
  for (const [x, z] of ends) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), poleM); p.position.set(x, 1.7, z); scene.add(p); }
  const bulbs: THREE.Vector3[] = [];
  for (let s2 = 0; s2 < 4; s2++) {
    const a = ends[s2], b = ends[(s2 + 1) % 4];
    for (let i = 1; i < 16; i++) { const t = i / 16; bulbs.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, 3.3 - Math.sin(Math.PI * t) * 0.55, a[1] + (b[1] - a[1]) * t)); }
  }
  for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9; bulbs.push(new THREE.Vector3(-6 + 12 * t, 3.3 - Math.sin(Math.PI * t) * 0.7, -1)); }
  const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), bulbM, bulbs.length);
  bulbs.forEach((p, i) => bi.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(bi);
  if (o.lights !== false) for (const p of [[-3, 2.8, -1], [3, 2.8, -1], [0, 2.9, 3]]) {
    const L = new THREE.PointLight(0xffb868, 10, 12, 2); L.position.set(p[0], p[1], p[2]); scene.add(L); keyLights.push(L);
  }
  const tableM = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.55 });
  const table = (x: number, z: number) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), tableM); t.position.set(x, 0.74, z); t.castShadow = true; scene.add(t);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 8), poleM); l.position.set(x, 0.36, z); scene.add(l);
  };
  const chair = (x: number, z: number, ry: number) => {
    const c = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.42), tableM); seat.position.y = 0.44; c.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.03), tableM); back.position.set(0, 0.66, -0.2); c.add(back);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.03), poleM); l.position.set(lx, 0.22, lz); c.add(l); }
    c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c);
  };
  return { table, chair, keyLights };
}

/** build people at spots; lod 0 when nearer than `near` to the camera point */
function crowd(spots: { o: PersonOptions; x: number; z: number; ry?: number; anim?: 'idle' | 'talk' | 'sit' | 'laugh'; look?: number }[], cam: THREE.Vector3, near: number) {
  const out: Person[] = [];
  for (const s2 of spots) {
    s2.o.quality = quality; s2.o.lod = Math.hypot(s2.x - cam.x, s2.z - cam.z) < near ? 0 : 1;
    const p = buildPerson(s2.o); p.group.position.set(s2.x, 0, s2.z); p.group.rotation.y = s2.ry ?? 0;
    p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; } });
    scene.add(p.group); p.play(s2.anim ?? 'idle'); out.push(p);
  }
  spots.forEach((s2, i) => { if (s2.look !== undefined) out[i].lookAt(out[s2.look].eyes()); });
  return out;
}
const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

async function main() {
  // let the page finish loading first: building people is heavy, synchronous work
  await new Promise((r) => setTimeout(r, 50));
  const people: Person[] = [];
  // one frame's numbers (the page renders three frames; info.autoReset is off for the composer views)
  let render = () => { renderer.info.reset(); renderer.render(scene, camera); };
  if (view === 'bodies' || view === 'clothes') {
    studio();
    if (view === 'clothes') { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; }
    const all: PresetName[] = ['thin', 'petite', 'casual', 'tall', 'stocky', 'curvy', 'muscular', 'pear', 'beerBelly', 'hourglass', 'obese', 'broad', 'heavy', 'olderWoman', 'elder'];
    const names = q.get('only') ? (q.get('only')!.split(',') as PresetName[]) : view === 'clothes' ? (['reference', 'casual', 'beerBelly', 'broad', 'elder'] as PresetName[]) : all;
    const t0 = performance.now();
    names.forEach((n, i) => {
      const o = preset(n); o.quality = quality; o.lod = view === 'clothes' ? 0 : 1;
      const p = buildPerson(o);
      p.group.position.set((i - (names.length - 1) / 2) * (view === 'clothes' ? 0.9 : 0.78), 0, 0);
      scene.add(p.group); people.push(p);
    });
    extra.buildMs = Math.round(performance.now() - t0);
    for (const p of people) p.update(0.016);
    camera.fov = 22; camera.aspect = innerWidth / (innerHeight / 2); camera.updateProjectionMatrix();
    const dz = Number(q.get('dz') ?? (view === 'clothes' ? 5.6 : Math.max(3.2, names.length * 0.55))), cy = Number(q.get('cy') ?? 0.92);
    camera.position.set(0, cy + 0.08, dz); camera.lookAt(0, cy, 0);
    render = () => {
      const W = innerWidth, H = innerHeight;
      renderer.info.reset();
      renderer.setScissorTest(true);
      renderer.setViewport(0, H / 2, W, H / 2); renderer.setScissor(0, H / 2, W, H / 2);
      renderer.render(scene, camera);
      for (const p of people) p.group.rotation.y = Math.PI / 2;
      renderer.setViewport(0, 0, W, H / 2); renderer.setScissor(0, 0, W, H / 2);
      renderer.render(scene, camera);
      for (const p of people) p.group.rotation.y = 0;
      renderer.setScissorTest(false);
    };
  }
  if (view === 'faces' || view === 'head') {
    scene.background = new THREE.Color(0x1d1a18);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffeedd, 0x302820, 0.35));
    const key = new THREE.DirectionalLight(0xffd8a8, 2.6); key.position.set(-1.5, 2.2, 2.2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8c4ff, 0.7); fill.position.set(2, 0.5, 1.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe0c0, 1.4); rim.position.set(1.5, 1.5, -2); scene.add(rim);
    const names = (q.get('only')?.split(',') ?? ['reference', 'casual', 'elder']) as PresetName[];
    const yaws = (q.get('yaws') ?? '0').split(',').map(Number);
    const exprs = (q.get('expr')?.split(',') ?? (view === 'head' ? yaws.map(() => 'neutral') : ['neutral', 'smile', 'playful', 'talking']));
    const t0 = performance.now();
    names.forEach((n, i) => {
      const o = preset(n); o.quality = quality; o.lod = 0;
      if (q.get('bald')) { o.look.hair = 'bald'; o.look.glasses = false; o.acc.hoops = null; }
      const p = buildPerson(o);
      p.group.position.set(i * 3, 0, 0);
      scene.add(p.group); people.push(p);
    });
    extra.buildMs = Math.round(performance.now() - t0);
    const hide = (q.get('hide') ?? '').split(',').filter(Boolean).map(Number);
    for (const p of people) { let k = 0; p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) { if (hide.includes(k)) m.visible = false; k++; } }); }
    const cams = names.map(() => new THREE.PerspectiveCamera(view === 'head' ? 22 : 24, 1, 0.02, 50));
    const side = Number(q.get('yaw') ?? '0') * Math.PI / 180;
    const settle = (e: string, p: Person) => {
      p.setExpression(e === 'talking' ? 'talking' : e, 1);
      if (e === 'talking') p.say('Have you tried the fizz here? It is so good.', 2.2);
      for (let k = 0; k < (e === 'talking' ? 33 : 40); k++) p.update(1 / 30);
    };
    render = () => {
      const W = innerWidth, H = innerHeight, cols = exprs.length, rows = names.length;
      const w = W / cols, h = H / rows;
      renderer.info.reset();
      renderer.setScissorTest(true);
      names.forEach((_, r) => {
        const p = people[r], cam = cams[r];
        const e0 = p.eyes();
        const d = Number(q.get('dist') ?? (view === 'head' ? 0.62 : 0.55));
        cam.aspect = w / h; cam.updateProjectionMatrix();
        exprs.forEach((e, c) => {
          const yw = view === 'head' ? (yaws[c] ?? 0) * Math.PI / 180 : side;
          cam.position.set(e0.x + Math.sin(yw) * d, e0.y + Number(q.get('cy') ?? 0), e0.z + Math.cos(yw) * d);   // cy: camera height off the eye line (a mouth close-up)
          cam.lookAt(e0.x + Number(q.get('dx') ?? 0), e0.y - Number(q.get('dy') ?? 0.045), e0.z);
          settle(e, p);
          renderer.setViewport(c * w, H - (r + 1) * h, w, h); renderer.setScissor(c * w, H - (r + 1) * h, w, h);
          renderer.render(scene, cam);
        });
      });
      renderer.setScissorTest(false);
    };
  }

  if (view === 'lineup') {
    const P = patio();
    P.table(1.6, -1.2); P.chair(1.6, -1.75, 0); P.chair(1.6, -0.65, Math.PI);
    const cam = new THREE.Vector3(0.3, 1.62, 6.2);
    const L: Parameters<typeof crowd>[0] = [
      { o: preset('reference'), x: -1.15, z: 1.2, ry: faceTo(-1.15, 1.2, -0.35, 1.0), anim: 'talk', look: 1 },
      { o: preset('casual'), x: -0.35, z: 1.0, ry: faceTo(-0.35, 1.0, -1.15, 1.2), anim: 'idle', look: 0 },
      { o: preset('beerBelly'), x: -2.6, z: -0.6, ry: faceTo(-2.6, -0.6, -1.7, -1.0), anim: 'laugh', look: 3 },
      { o: preset('olderWoman'), x: -1.7, z: -1.0, ry: faceTo(-1.7, -1.0, -2.6, -0.6), anim: 'talk', look: 2 },
      { o: preset('muscular'), x: -2.2, z: -1.6, ry: faceTo(-2.2, -1.6, -2.1, -0.8), anim: 'idle', look: 3 },
      { o: preset('curvy'), x: 1.6, z: -1.75, ry: 0, anim: 'sit', look: 6 },
      { o: preset('elder'), x: 1.6, z: -0.65, ry: Math.PI, anim: 'sit', look: 5 },
      { o: randomPerson(3), x: 2.9, z: 0.9, ry: faceTo(2.9, 0.9, 2.2, 1.4), anim: 'talk', look: 8 },
      { o: preset('obese'), x: 2.2, z: 1.4, ry: faceTo(2.2, 1.4, 2.9, 0.9), anim: 'idle', look: 7 },
      { o: preset('thin'), x: 0.4, z: -3.2, ry: faceTo(0.4, -3.2, 0.3, 6), anim: 'idle' },
    ];
    for (const s2 of L) if (s2.anim === 'sit') { s2.o.lod = 1; }
    const t0 = performance.now();
    people.push(...crowd(L, cam, 4.4));
    extra.buildMs = Math.round(performance.now() - t0);
    for (let k = 0; k < 45; k++) for (const p of people) p.update(1 / 30);
    camera.fov = 34; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    camera.position.copy(cam); camera.lookAt(0.1, 1.05, -0.4);
  }
  if (view === 'crowd') {
    // a busy night: n people in small groups across the patio, LOD by distance (people/budget.ts), the camera at a
    // third-person height. Reports draw calls, triangles and build time by LOD.
    const P = patio();
    P.table(2.4, -2.2); P.chair(2.4, -2.75, 0); P.chair(2.4, -1.65, Math.PI);
    const n = Number(q.get('n') ?? 30);
    const cam = new THREE.Vector3(0.4, 1.75, 6.5);
    let sd = 12345; const rnd = () => ((sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const opts = (i: number): PersonOptions => (i < PRESETS.length ? preset(PRESETS[i]) : randomPerson(100 + i));
    const spots: { o: PersonOptions; x: number; z: number; ry: number; anim: 'idle' | 'talk' | 'sit' | 'laugh'; look?: number }[] = [];
    spots.push({ o: opts(0), x: 2.4, z: -2.75, ry: 0, anim: 'sit', look: 1 }, { o: opts(1), x: 2.4, z: -1.65, ry: Math.PI, anim: 'sit', look: 0 });
    let gi = 0;
    while (spots.length < n) {
      const k = Math.min(n - spots.length, 2 + Math.floor(rnd() * 3));
      const col = gi % 4, row = Math.floor(gi / 4);
      const cx = -4.6 + col * 3.0 + (rnd() - 0.5) * 1.0 - (row % 2) * 1.2, cz = 2.6 - row * 3.2 + (rnd() - 0.5) * 0.8;
      const rad = 0.5 + 0.12 * k, a0 = rnd() * 6.28, first = spots.length;
      for (let j = 0; j < k; j++) {
        const a = a0 + (j / k) * 6.28, x = cx + Math.sin(a) * rad, z = cz + Math.cos(a) * rad;
        spots.push({ o: opts(spots.length), x, z, ry: faceTo(x, z, cx, cz), anim: j === 0 ? 'talk' : rnd() < 0.2 ? 'laugh' : rnd() < 0.5 ? 'talk' : 'idle', look: j === 0 ? first + 1 : first });
      }
      gi++;
    }
    const byLod: Record<number, { n: number; ms: number; tris: number; calls: number }> = { 0: { n: 0, ms: 0, tris: 0, calls: 0 }, 1: { n: 0, ms: 0, tris: 0, calls: 0 }, 2: { n: 0, ms: 0, tris: 0, calls: 0 } };
    const t0 = performance.now();
    for (const s2 of spots) {
      const d = Math.hypot(s2.x - cam.x, s2.z - cam.z);
      s2.o.quality = quality; s2.o.lod = lodFor(d, quality);
      const tb = performance.now();
      const p = buildPerson(s2.o);
      const st = p.stats(), b = byLod[st.lod];
      b.n++; b.ms += performance.now() - tb; b.tris += st.tris; b.calls += st.calls;
      p.group.position.set(s2.x, 0, s2.z); p.group.rotation.y = s2.ry;
      p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
      scene.add(p.group); p.play(s2.anim); people.push(p);
    }
    spots.forEach((s2, i) => { if (s2.look !== undefined && people[s2.look]) people[i].lookAt(people[s2.look].eyes()); });
    extra.buildMs = Math.round(performance.now() - t0);
    for (const k of [0, 1, 2]) { const b = byLod[k]; b.ms = Math.round(b.n ? b.ms / b.n : 0); }
    extra.crowd = { n: spots.length, quality, perLod: byLod, note: 'perLod.ms = mean build ms per person; tris/calls summed' };
    const tu = performance.now();
    for (let k = 0; k < 45; k++) for (const p of people) p.update(1 / 30);
    extra.updateMsPerFrame = +((performance.now() - tu) / 45).toFixed(2);
    camera.fov = 50; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    camera.position.copy(cam); camera.lookAt(0, 1.0, -2.5);
  }
  if (view === 'talk') {
    // the first-person conversation shot: about 1 m, face and shoulders, warm string-light key, shallow focus
    patio({ lights: false });
    const npcO = preset('reference'); npcO.quality = quality; npcO.lod = 0;
    const npc = buildPerson(npcO); scene.add(npc.group); people.push(npc);
    const eye0 = npc.eyes();
    const cam = new THREE.Vector3(eye0.x + 0.07, eye0.y + 0.05, eye0.z + Number(q.get('dist') ?? 0.85));
    const key = new THREE.PointLight(0xffd4ae, 4.2, 6, 2); key.position.set(eye0.x - 0.95, eye0.y + 0.65, eye0.z + 0.8); scene.add(key);
    const sconce = new THREE.PointLight(0xffa050, 2.2, 5, 2); sconce.position.set(eye0.x + 1.1, eye0.y + 0.3, eye0.z - 0.6); scene.add(sconce);
    const fill = new THREE.DirectionalLight(0x8ea8e0, 0.5); fill.position.set(2.5, 0.4, 2); scene.add(fill);
    const bg = crowd([
      { o: preset('casual'), x: -1.4, z: -3.2, ry: 0.9, anim: 'talk', look: 1 },
      { o: preset('curvy'), x: -0.6, z: -2.8, ry: -1.6, anim: 'laugh', look: 0 },
      { o: randomPerson(11), x: 1.5, z: -4.2, ry: -0.5, anim: 'talk' },
    ], cam, 0);
    people.push(...bg);
    npc.lookAt(cam);
    const expr = q.get('expr') ?? 'talking';
    npc.setExpression(expr, 1);
    if (expr === 'talking') npc.say('Oh, you came over from the car meet? Pull up a chair.', 3);
    for (let k = 0; k < 40; k++) for (const p of people) p.update(1 / 30);
    camera.fov = 30; camera.aspect = innerWidth / innerHeight; camera.near = 0.05; camera.updateProjectionMatrix();
    const front = new THREE.PointLight(0xffe2c0, 0.55, 4, 2); front.position.copy(cam).add(new THREE.Vector3(0.25, 0.2, 0.1)); scene.add(front);
    camera.position.copy(cam); camera.lookAt(eye0.x, eye0.y - Number(q.get('aim') ?? 0.085), eye0.z);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const focus = cam.distanceTo(eye0);
    if (q.get('dof') !== '0') composer.addPass(new BokehPass(scene, camera, { focus, aperture: Number(q.get('ap') ?? 0.012), maxblur: 0.012 }));
    composer.addPass(new OutputPass());
    render = () => { renderer.info.reset(); composer.render(); };
  }
  if (view === 'walk') {
    // third person behind a walking person, the GTA-style follow camera
    const P = patio();
    P.table(-2.4, -3.5); P.table(2.6, -4.5);
    const wo = preset(q.get('who') as PresetName ?? 'reference');
    const others = crowd([
      { o: preset('broad'), x: -2.0, z: -2.6, ry: faceTo(-2.0, -2.6, -2.9, -2.8), anim: 'talk', look: 1 },
      { o: preset('pear'), x: -2.9, z: -2.8, ry: faceTo(-2.9, -2.8, -2.0, -2.6), anim: 'idle', look: 0 },
      { o: preset('stocky'), x: 2.0, z: -3.6, ry: faceTo(2.0, -3.6, 2.8, -3.9), anim: 'laugh', look: 3 },
      { o: preset('hourglass'), x: 2.8, z: -3.9, ry: faceTo(2.8, -3.9, 2.0, -3.6), anim: 'talk', look: 2 },
    ], new THREE.Vector3(0, 0, 3), 0);
    wo.quality = quality; wo.lod = 0;
    const me = buildPerson(wo); scene.add(me.group); people.push(me, ...others);
    me.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
    me.group.rotation.y = Math.PI; me.play('walk');
    let z = 1.2;
    for (let k = 0; k < Number(q.get('steps') ?? 26); k++) { z -= 1.25 / 30; me.group.position.z = z; for (const p of people) p.update(1 / 30); }
    camera.fov = 50; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    const fd = Number(q.get('fd') ?? 1);   // follow distance scale (1 = the default GTA-style follow)
    camera.position.set(0.55 * fd, 1.25 + 0.7 * fd, z + 2.7 * fd); camera.lookAt(0, 1.25, z - 2.5);
  }
  if (q.get('dbg') === 'normal' || q.get('dbg') === 'flat') for (const p of people) p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh && m.name.startsWith('cloth')) (m as THREE.Mesh).material = q.get('dbg') === 'normal' ? new THREE.MeshNormalMaterial() : new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 }); });
  // the teeth: flat with their vertex colours (dbg=teeth), their normals (dbg=teethN), or alone, lit (dbg=teethOnly)
  const dbg = q.get('dbg') ?? '';
  if (dbg.startsWith('teeth')) for (const p of people) p.group.traverse((m) => {
    const mm = m as THREE.Mesh, mat = mm.material as THREE.MeshPhysicalMaterial;
    if (!mm.isMesh) return;
    const isTeeth = mat?.vertexColors && (mat as THREE.Material).type === 'MeshPhysicalMaterial';
    if (isTeeth && dbg !== 'teethOnly') mm.material = dbg === 'teeth' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshNormalMaterial();
    if (!isTeeth && dbg === 'teethOnly') mm.visible = false;
  });
  if (view !== 'crowd') extra.people = people.map((p) => p.stats());
  if (people[0]) { const ms: THREE.Mesh[] = []; people[0].group.traverse((m) => { if ((m as THREE.Mesh).isMesh) ms.push(m as THREE.Mesh); }); const e = ms[0]; e.updateWorldMatrix(true, false); const z = new THREE.Vector3(0, 0, 1).transformDirection(e.matrixWorld); extra.eyeZ = z.toArray().map((v) => +v.toFixed(3)); const pp = new THREE.Vector3(); e.getWorldPosition(pp); extra.eyeP = pp.toArray().map((v) => +v.toFixed(3)); extra.eyeParent = e.parent?.parent?.name; }
  extra.parts = people.slice(0, 1).map((p) => { const out: string[] = []; p.group.traverse((m) => { const g = (m as THREE.Mesh).geometry; if (g && m.visible) out.push(`${m.type}:${(g.index ? g.index.count : g.attributes.position.count) / 3}:${Object.keys(g.morphAttributes).length ? g.morphAttributes.position?.length : 0}`); }); return out.join(' '); });
  (window as unknown as { __people: Person[] }).__people = people;
  let frames = 0, last = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t1 = performance.now();
    if (frames < 3) { try { render(); } catch (e) { window.__previewError = String((e as Error)?.stack ?? e); } }
    frameMs = performance.now() - t1;
    frames++;
    if (frames === 3) window.__previewReady = true;
    void dt;
  };
  loop();
}
main().catch((e) => { window.__previewError = String(e?.stack ?? e); });

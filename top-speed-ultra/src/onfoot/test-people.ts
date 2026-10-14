// Test page for the people builder. Views (?view=): bodies, lineup, faces, talk, walk.
//   node tools/preview-shoot.mjs src/onfoot/test-people.ts tests/out/onfoot/people-<view>.png --size=960x540 --query="view=<view>"
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPerson, Person, preset, PresetName } from './people';

declare global { interface Window { __stage?: { info(): unknown }; __previewReady?: boolean; __previewError?: string; __people?: unknown } }
addEventListener('error', (e) => { window.__previewError = String(e.message || e); });
addEventListener('unhandledrejection', (e) => { window.__previewError = String((e as PromiseRejectionEvent).reason); });

const q = new URLSearchParams(location.search);
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
window.__stage = { info };
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

async function main() {
  const people: Person[] = [];
  let render = () => renderer.render(scene, camera);
  if (view === 'bodies') {
    studio();
    const all: PresetName[] = ['thin', 'petite', 'casual', 'tall', 'stocky', 'curvy', 'muscular', 'pear', 'beerBelly', 'hourglass', 'obese', 'broad', 'heavy', 'olderWoman', 'elder'];
    const names = q.get('only') ? (q.get('only')!.split(',') as PresetName[]) : all;
    const t0 = performance.now();
    names.forEach((n, i) => {
      const o = preset(n); o.quality = quality; o.lod = 1;
      const p = buildPerson(o);
      p.group.position.set((i - (names.length - 1) / 2) * 0.78, 0, 0);
      scene.add(p.group); people.push(p);
    });
    extra.buildMs = Math.round(performance.now() - t0);
    for (const p of people) p.update(0.016);
    camera.fov = 22; camera.aspect = innerWidth / (innerHeight / 2); camera.updateProjectionMatrix();
    const dz = Math.max(3.2, names.length * 0.55);
    camera.position.set(0, 1.0, dz); camera.lookAt(0, 0.92, 0);
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
          cam.position.set(e0.x + Math.sin(yw) * d, e0.y + 0.0, e0.z + Math.cos(yw) * d);
          cam.lookAt(e0.x + Number(q.get('dx') ?? 0), e0.y - Number(q.get('dy') ?? 0.045), e0.z);
          settle(e, p);
          renderer.setViewport(c * w, H - (r + 1) * h, w, h); renderer.setScissor(c * w, H - (r + 1) * h, w, h);
          renderer.render(scene, cam);
        });
      });
      renderer.setScissorTest(false);
    };
  }
  extra.people = people.map((p) => p.stats());
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

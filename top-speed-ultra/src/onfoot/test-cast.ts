// The cast's test page (dev server only: npx vite --config src/onfoot/vite.config.ts, then /test-cast.html).
//   ?who=<cast id>&lod=0|1&quality=high|phone   one character on a neutral grey studio, as the sheets are shot;
//        window.__cast.shot('front'|'side'|'back'|'three'|'head'|'headSide'|'headThree') frames it
//   ?view=lineup&lod=1                          the six side by side (front)
//   ?view=crowd&n=18                            crowd members from the cast (crowdPerson), slots 0..n-1
// window.__cast.ready turns true once built; stats() reports each person's triangles, calls and build time.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPerson, Person } from './people';
import { CAST, castPerson, crowdPerson, CastId } from './cast';

declare global { interface Window { __cast?: Record<string, unknown> } }
const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'one';
const quality = (q.get('quality') ?? 'high') as 'high' | 'phone';
const lod = Number(q.get('lod') ?? 0) as 0 | 1 | 2;
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
document.body.style.margin = '0';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fa1a6);   // the sheets' neutral grey
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8680, 0.6));
const key = new THREE.DirectionalLight(0xfff4e8, 2.0); key.position.set(2, 4, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 3, bottom: -1, near: 0.5, far: 20 });
scene.add(key);
const fill = new THREE.DirectionalLight(0xe8eeff, 0.7); fill.position.set(-4, 2, -3); scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(22, innerWidth / innerHeight, 0.05, 100);
const people: Person[] = [];
const rows: Record<string, unknown>[] = [];

function add(o: ReturnType<typeof castPerson>, x: number, ry = 0) {
  const t0 = performance.now();
  const p = buildPerson({ ...o, quality, lod });
  const ms = Math.round(performance.now() - t0);
  p.group.position.set(x, 0, 0); p.group.rotation.y = ry;
  p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; } });
  scene.add(p.group); people.push(p);
  p.update(0.016);
  rows.push({ name: o.name, ...p.stats(), ms });
  return p;
}

let target: Person | null = null;
function shot(a: string) {
  const p = target ?? people[0];
  const h = p.options.body.height;
  const head = new THREE.Vector3(); p.eyes(head);
  const ang: Record<string, number> = { front: 0, three: 0.75, side: Math.PI / 2, back: Math.PI, head: 0, headSide: Math.PI / 2, headThree: 0.6 };
  const r = ang[a] ?? 0;
  if (a.startsWith('head')) {
    const d = 0.62;
    camera.fov = 22; camera.position.set(head.x + Math.sin(r) * d, head.y - 0.02, head.z + Math.cos(r) * d);
    camera.lookAt(head.x, head.y - 0.03, head.z);
  } else {
    const d = h * 4.2;
    camera.fov = 22; camera.position.set(p.group.position.x + Math.sin(r) * d, h * 0.53, Math.cos(r) * d);
    camera.lookAt(p.group.position.x, h * 0.5, 0);
  }
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  for (let i = 0; i < 3; i++) { for (const pp of people) pp.update(0); renderer.render(scene, camera); }
  return { tris: renderer.info.render.triangles, calls: renderer.info.render.calls };
}

async function main() {
  await new Promise((r) => setTimeout(r, 50));
  if (view === 'one') {
    const id = (q.get('who') ?? 'mateo-reyes') as CastId;
    target = add(castPerson(id), 0);
    target.play('idle');
  } else if (view === 'lineup') {
    CAST.forEach((c, i) => add(castPerson(c.id), (i - 2.5) * 0.85));
    camera.position.set(0, 1.0, 9.5); camera.lookAt(0, 0.9, 0);
  } else if (view === 'crowd') {
    const n = Number(q.get('n') ?? 18);
    for (let i = 0; i < n; i++) add(crowdPerson(500 + i * 13, i), ((i % 9) - 4) * 0.8 + (i >= 9 ? 0.4 : 0), 0).group.position.z = i >= 9 ? -1.4 : 0;
    camera.position.set(0, 1.4, 11); camera.lookAt(0, 0.9, -0.5);
  }
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  window.__cast = { ready: true, shot, stats: () => rows, render: () => { renderer.render(scene, camera); return renderer.info.render; } };
}
window.__cast = { ready: false };
main().catch((e) => { window.__cast = { ready: false, error: String((e as Error)?.stack ?? e) }; });

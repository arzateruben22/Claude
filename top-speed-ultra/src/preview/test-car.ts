// Test page for the car part: the Rossini GT inside and out, and the traffic.
//   ?view=seat | dash | beauty | rear | wheel | traffic | side | top | front | mirror
//   &q=high|phone   &world=0 to skip the game's roads and terrain   &paint=hex   &s=metres from the stretch start
// Logs (console.warn, so preview-shoot prints it) the build time and the part's own cost: draw calls and triangles
// with the part shown minus with it hidden, shadow passes included.
import * as THREE from 'three';
import { makeStage, Stage } from './stage';
import { buildCar, buildTrafficCar, TrafficKind } from './car';
import { buildCockpit } from './cockpit';
import { EYE } from './spec';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'beauty';
const quality = (q.get('q') ?? 'high') as 'high' | 'phone';
const paint = parseInt(q.get('paint') ?? '9b1219', 16);
const debug = ['side', 'top', 'front'].includes(view);
const wantWorld = !debug && q.get('world') !== '0';

const stage = await makeStage({ stretch: !debug, fov: view === 'seat' ? 60 : view === 'dash' ? 50 : view === 'wheel' ? 34 : 30, near: 0.02 });
const { scene, camera, renderer } = stage;
const env = stage.useGameSky((q.get('time') as 'sunset') ?? 'sunset');
// Test light only: the game's 'sunset' preset has the sun at 3 degrees, where the sound walls shade the whole
// freeway. Golden hour in October with the sun at ~9 degrees (about 45 minutes before sunset) shows the car in
// sunlight. The atmosphere part owns the final scene's light.
{
  const alt = Number(q.get('alt') ?? 9) * Math.PI / 180;
  const E = env as unknown as { targetFor(d: Date): { alt: number } };
  const orig = E.targetFor.bind(env);
  E.targetFor = (d: Date) => { const s = orig(d); s.alt = alt; return s; };
  env.set('sunset', 'clear', true);
}
const log: Record<string, unknown> = { view, quality };

// where: on I-405 North (lane 1), or at the origin on a plain ground for the debug views
let frame: THREE.Object3D;
if (debug) {
  frame = new THREE.Group(); scene.add(frame);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x55534f, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
} else {
  const st = stage.stretch!;
  frame = stage.driverView(st.s0 + Number(q.get('s') ?? 1500));
}
const L = (x: number, y: number, z: number) => frame.localToWorld(new THREE.Vector3(x, y, z));
function look(from: THREE.Vector3, at: THREE.Vector3) { camera.position.copy(from); camera.up.set(0, 1, 0); camera.lookAt(at); }

// what to build
let part: THREE.Object3D;
const t0 = performance.now();
if (view === 'seat' || view === 'dash' || view === 'mirror') {
  const ck = buildCockpit({ paint, quality, mirrors: (q.get('mirrors') as 'live' | 'env' | null) ?? undefined });
  part = ck.group;
  frame.add(ck.group);
  log.buildMs = Math.round(performance.now() - t0);
  stage.onFrame((dt) => ck.update?.(dt));
  if (view === 'seat') stage.driverView(stage.stretch!.s0 + Number(q.get('s') ?? 1500), undefined, EYE);
  if (view === 'dash') look(L(-0.3, 1.02, -0.02), L(-0.4, 0.83, -0.6));
  if (view === 'mirror') look(L(-0.37, 1.16, 0.1), L(0.05, 1.18, -0.3));
} else if (view === 'traffic') {
  const kinds: TrafficKind[] = ['sedan', 'suv', 'pickup', 'van', 'boxTruck'];
  const cols = [0xd8d8d6, 0x1d2836, 0x6b6e72, 0xf1f1ee, 0xe9e9e6];
  const grp = new THREE.Group();
  kinds.forEach((k, i) => { const c = buildTrafficCar(k, cols[i], quality); c.position.set(-6 + i * 3.4 * (i > 2 ? 1.1 : 1), 0, 2 + (i % 2) * 1.5 - i * 1.2); c.rotation.y = 0.5; grp.add(c); });
  frame.add(grp); part = grp;
  log.buildMs = Math.round(performance.now() - t0);
  look(L(2, 2.2, -13), L(-1, 0.9, 0));
} else {
  const car = buildCar({ paint, quality });
  frame.add(car); part = car;
  log.buildMs = Math.round(performance.now() - t0);
  if (view === 'side') look(L(-14, 0.62, 0), L(0, 0.62, 0));
  if (view === 'top') look(L(0, 16, 0.01), L(0, 0, 0));
  if (view === 'front') look(L(0, 0.75, -14), L(0, 0.62, 0));
  if (view === 'beauty') look(L(-3.9, 1.0, -4.6), L(0.1, 0.5, 0.2));
  if (view === 'rear') look(L(-3.4, 1.05, 5.0), L(0.15, 0.55, 0.1));
  if (view === 'wheel') look(L(-2.0, 0.55, -2.25), L(-0.85, 0.36, -1.33));
}
if (debug) { camera.fov = 16; camera.updateProjectionMatrix(); }
// the sun's shadow box follows what we're looking at
env.follow(frame.getWorldPosition(new THREE.Vector3()), camera, 0, 0);
if (wantWorld) stage.addGameWorld('high');

// the part's own cost: render once without it and once with it
function measure(s: Stage, obj: THREE.Object3D) {
  const info = s.renderer.info; info.autoReset = false;
  const run = () => { info.reset(); s.renderer.render(s.scene, s.camera); return { calls: info.render.calls, tris: info.render.triangles }; };
  obj.visible = false; const a = run();
  obj.visible = true; const b = run();
  info.autoReset = true;
  return { calls: b.calls - a.calls, tris: b.tris - a.tris, sceneCalls: b.calls, sceneTris: b.tris };
}
await stage.ready(2);
if (q.get('measure') !== '0') Object.assign(log, measure(stage, part));
console.warn('[car] ' + JSON.stringify(log));
void renderer;

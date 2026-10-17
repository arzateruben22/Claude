// The traffic kinds side by side (?q=high|phone), to judge them before the game uses them; ?kind=<kind> shows one
// alone from ahead and to the left, ?kind=<kind>&view=rear from behind and to the right.
import * as THREE from 'three';
import { makeStage } from './stage';
import { buildTrafficCar, TrafficKind } from './traffic';

const q = new URLSearchParams(location.search);
const quality = (q.get('q') ?? 'high') as 'high' | 'phone';
const stage = await makeStage({ fov: 34 });
stage.useGameSky('day');
const st = stage.stretch!;
const frame = stage.driverView(st.s0 + 1500);
const L = (x: number, y: number, z: number) => frame.localToWorld(new THREE.Vector3(x, y, z));
const kinds: TrafficKind[] = ['sedan', 'coupe', 'suv', 'pickup', 'van', 'boxTruck', 'semi'];
const paints = [0xf2f2f0, 0x7f1416, 0x111214, 0x23395f, 0x8d9196, 0xf4f4f2, 0x1e3a8a];
const one = q.get('kind') as TrafficKind | null;     // ?kind=semi: one vehicle alone, framed by its length
if (one) {
  const c = buildTrafficCar(one, paints[kinds.indexOf(one)] ?? 0xf2f2f0, quality); frame.add(c);
  const len = c.children.reduce((m, o) => { const b = new THREE.Box3().setFromObject(o); return Math.max(m, b.max.z - b.min.z); }, 4);
  stage.camera.fov = 34;
  // ?view=rear: from behind and to the right, low (as a following driver sees it)
  if (q.get('view') === 'rear') { stage.camera.position.copy(L(len * 0.6, 1.5 + len * 0.04, len * 0.85)); stage.camera.lookAt(L(-0.2, 0.85, -0.2)); }
  else { stage.camera.position.copy(L(-len * 0.75, 2.2 + len * 0.08, -len * 0.55)); stage.camera.lookAt(L(0.4, 1.4, 0.5)); }
} else {
  kinds.forEach((k, i) => { const c = buildTrafficCar(k, paints[i], quality); c.position.set(-7 + i * 3.1, 0, 4 - i * 2.4 - (k === 'semi' ? 7 : 0)); frame.add(c); });
  stage.camera.fov = 40;
}
if (!one) { stage.camera.position.copy(L(-11, 2.2, -9)); stage.camera.lookAt(L(1.5, 0.9, -1)); }
stage.addGameWorld('high');
await stage.ready(2);
console.warn('[traffic] ' + JSON.stringify(stage.info()));

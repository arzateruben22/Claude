// The traffic kinds side by side (?q=high|phone, ?view=lineup|ahead), to judge them before the game uses them.
import * as THREE from 'three';
import { makeStage } from './stage';
import { buildTrafficCar, TrafficKind } from './traffic';

const q = new URLSearchParams(location.search);
const quality = (q.get('q') ?? 'high') as 'high' | 'phone';
const stage = await makeStage({ fov: 34 });
stage.useGameSky('day');
const st = stage.stretch!;
const frame = stage.driverView(st.s0 + 1500);
const kinds: TrafficKind[] = ['sedan', 'suv', 'pickup', 'van', 'boxTruck'];
const paints = [0xf2f2f0, 0x111214, 0x23395f, 0x8d9196, 0xf4f4f2];
kinds.forEach((k, i) => { const c = buildTrafficCar(k, paints[i], quality); c.position.set(-5 + i * 3.1, 0, 2 - i * 2.2); frame.add(c); });
const L = (x: number, y: number, z: number) => frame.localToWorld(new THREE.Vector3(x, y, z));
stage.camera.position.copy(L(-11, 2.2, -9)); stage.camera.lookAt(L(1.5, 0.9, -1));
stage.addGameWorld('high');
await stage.ready(2);
console.warn('[traffic] ' + JSON.stringify(stage.info()));

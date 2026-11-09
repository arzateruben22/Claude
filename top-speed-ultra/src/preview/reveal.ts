// The Founder Edition's reveal stage: the OC Hypercar's garage card shows it on a dark stage like the reference
// sheet's night showroom. A wet-look black floor, a ring of strip lights round a slow turntable with a Founder Ice
// ring at its edge, and the car (the procedural model, built in code like every car here) turning to its hero angle
// while the room comes up, its LEDs wake (car-wake.ts) and a light sweeps over it from nose to tail.
//
//   buildReveal(renderer, quality): RevealStage
//     stage.pose(t, kind)   everything as it is t seconds in: kind 'reveal' (REVEAL_SECONDS, the whole thing) or
//                           'wake' (WAKE_ONLY_SECONDS: the car already at its hero angle, only its lights wake, for
//                           when it is chosen in the garage). Returns the extra light-sweep band's position (0..1
//                           across the frame, or null) and the exposure to render at.
//     stage.dispose()       frees the geometry, the room's textures and its environment map (the car's materials are
//                           the shared caches the player's car uses too, so they stay)
//
// Cheap on purpose: it renders only while it moves (about six seconds, then the card keeps the last frame), at the
// card's size, with no shadow maps (a contact patch under the car), one draw call for the room's lights and a
// prefiltered environment made once from the same lights.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildCar } from './car';
import { wakeAt } from './car-wake';
import { FOUNDER_ICE, FOUNDER_CAR } from '../game/founder';
import type { CarId } from './car-shape';

export const REVEAL_SECONDS = 6.2;
export const WAKE_ONLY_SECONDS = 1.7;
export type RevealKind = 'reveal' | 'wake';

export interface RevealStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  car: THREE.Group;
  buildMs: number;
  pose(t: number, kind?: RevealKind): { exposure: number; wake: number; band: number | null };
  dispose(): void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);

function radialTex(stops: [number, string][], n = 256) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  for (const [k, col] of stops) gr.addColorStop(k, col);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the turntable's top: dark anodised metal with fine lathe rings
function ringsTex(n = 512) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1a1d22'; g.fillRect(0, 0, n, n);
  for (let r = 4; r < n / 2; r += 3) { g.strokeStyle = `rgba(${r % 9 ? 255 : 0},${r % 9 ? 255 : 0},${r % 9 ? 255 : 0},${0.03 + 0.03 * Math.sin(r * 0.7) ** 2})`; g.lineWidth = 1; g.beginPath(); g.arc(n / 2, n / 2, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(170,190,215,0.35)'; g.lineWidth = n * 0.008; g.beginPath(); g.arc(n / 2, n / 2, n * 0.47, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// the room's lights: 18 upright strips on a 12 m ring (the camera stands inside it, so they only show behind the car)
// and a halo over the car, as one geometry
function lightsGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, g = new THREE.BoxGeometry(0.1, 3.6, 0.1);
    g.translate(Math.sin(a) * 12, 2.0, Math.cos(a) * 12); parts.push(g);
  }
  const halo = new THREE.TorusGeometry(3.1, 0.05, 6, 96); halo.rotateX(Math.PI / 2); halo.translate(0, 4.4, 0); parts.push(halo);
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

export function buildReveal(renderer: THREE.WebGLRenderer, quality: 'phone' | 'high', car: CarId = FOUNDER_CAR as CarId): RevealStage {
  const t0 = performance.now();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020305);
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.1, 80);
  camera.position.set(-5.5, 1.1, -7.3); camera.lookAt(0.05, 0.52, 0.2);
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };

  // the floor: black, a clear coat that takes the strips' reflections like a wet floor, lit in a pool round the table
  const floorMap = keep(radialTex([[0, '#3a4049'], [0.22, '#1d2127'], [0.5, '#0b0d10'], [1, '#000000']]));
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(20, 64)), keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: floorMap, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.45 })));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // the turntable: an anodised disc with a lathe-ringed top, a Founder Ice ring round its edge, and the car on it
  const table = new THREE.Group(); scene.add(table);
  const top = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: keep(ringsTex()), metalness: 0.85, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.1 }));
  const side = keep(new THREE.MeshPhysicalMaterial({ color: 0x0c0e11, metalness: 0.9, roughness: 0.28 }));
  const disc = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.95, 2.98, 0.06, 96, 1)), [side, top, side]);
  disc.position.y = 0.03; table.add(disc);
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(FOUNDER_ICE.core) }));
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(2.965, 0.011, 6, 160)), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.058; table.add(ring);
  const glowMap = keep(radialTex([[0, 'rgba(0,0,0,0)'], [0.86, 'rgba(0,0,0,0)'], [0.905, 'rgba(110,190,255,0.55)'], [0.93, 'rgba(47,143,232,0.25)'], [1, 'rgba(47,143,232,0)']]));
  const glowMat = keep(new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(6.6, 6.6)), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.004; table.add(glow);
  const model = buildCar({ car, quality, cabin: 'full' });
  model.position.y = 0.06; table.add(model);

  // the room's lights, seen behind the car and in the floor
  const lightsMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const lights = new THREE.Mesh(keep(lightsGeometry()), lightsMat); scene.add(lights);
  // the environment the paint, the glass and the floor reflect: the same lights, bright, in a near-black room
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x030405);
    const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 1).multiplyScalar(7) });
    const eg = lightsGeometry();
    env.add(new THREE.Mesh(eg, bright));
    // a long soft box over the car (the showroom key the sheet's hero shows in the bonnet) and a dim floor
    const box = new RoundedBoxGeometry(1.2, 0.05, 5.2, 2, 0.02); box.translate(-0.6, 4.2, 0);
    env.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 1).multiplyScalar(3) })));
    const fl = new THREE.CircleGeometry(20, 32); fl.rotateX(-Math.PI / 2);
    env.add(new THREE.Mesh(fl, new THREE.MeshBasicMaterial({ color: 0x07080a })));
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0, 0.1, 60);
    pm.dispose(); eg.dispose(); box.dispose(); fl.dispose(); bright.dispose();
    scene.environment = rt.texture; keep(rt);
  }
  // a cool fill from above, a key from the front left, a blue rim from behind, and the sweep: a bright light that
  // travels from the nose to the tail
  const hemi = new THREE.HemisphereLight(0x9fb4d0, 0x050608, 0.35); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xeef4ff, 1.6); key.position.set(-4, 6, -4); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fd0ff, 1.1); rim.position.set(3, 3, 7); scene.add(rim, rim.target);
  const sweep = new THREE.SpotLight(0xf2f8ff, 0, 20, 0.3, 0.55, 2); scene.add(sweep, sweep.target);

  const pose = (t: number, kind: RevealKind = 'reveal') => {
    let up: number, yaw: number, wake: number, s: number, ringK: number;
    if (kind === 'wake') {
      up = 1; yaw = 0; s = -1; ringK = smooth(0, 0.4, t); wake = wakeAt(t - 0.2);
    } else {
      up = smooth(0, 1.1, t);                                  // the room comes up
      yaw = -2.1 * (1 - easeOut(t / 5.6));                      // the table turns it: rear three-quarter, side, then its hero angle
      ringK = smooth(0.3, 1.0, t);
      wake = wakeAt(t - 0.9);                                   // the car's lights wake once the room is up
      s = t >= 0.9 && t < 3.3 ? (t - 0.9) / 2.4 : -1;           // the sweep crosses from 0.9 s to 3.3 s
    }
    table.rotation.y = yaw;
    lightsMat.color.setScalar(0.25 + 2.2 * up);
    ringMat.color.setHex(FOUNDER_ICE.core).multiplyScalar(0.05 + 2.4 * ringK);
    glowMat.opacity = ringK;
    // while the sweep runs the key and the fill drop back, so its pool of light reads as it travels
    const dim = s >= 0 ? Math.sin(Math.PI * s) : 0;
    hemi.intensity = 0.35 * up * (1 - 0.5 * dim); key.intensity = 1.6 * up * (1 - 0.8 * dim); rim.intensity = 1.1 * up;
    if (s >= 0) {
      // a pool of light that runs over the car from the nose to the tail (in the room's frame, so it crosses whatever
      // side the table shows), high and a little toward the camera, brightest in the middle of its run
      const z = -4.2 + 8.4 * s;
      sweep.position.set(-2.2, 6.2, z - 1.2); sweep.target.position.set(0, 0.6, z); sweep.intensity = 120 * Math.sin(Math.PI * s);
    } else sweep.intensity = 0;
    return { exposure: 0.15 + 0.77 * up, wake, band: s >= 0 ? s : null };
  };
  pose(REVEAL_SECONDS);

  return {
    scene, camera, car: model, buildMs: Math.round(performance.now() - t0), pose,
    dispose() {
      model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      for (const x of own) x.dispose();
      scene.clear();
    },
  };
}

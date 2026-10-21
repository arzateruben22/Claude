// Test page for the main menu's showroom (src/game/Showroom.ts) without booting the game: the car from the preview's
// buildCar, the scene at the window's size, framed as the menu frames it.
//   node tools/preview-shoot.mjs tools/showroom-page.ts tests/out/uiref/showroom.png --size=1440x900 \
//        --query="car=rossini-gt&cx=0.6&cy=0.42&span=0.5"        (&thumb=1: the Garage tile's close-up; &t=seconds of drift)
import * as THREE from 'three';
import { Showroom } from '../src/game/Showroom';
import { buildCar } from '../src/preview/car';
import type { CarId } from '../src/preview/car-shape';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.get(k) === null ? d : Number(q.get(k)));
const w = innerWidth, h = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(1);
renderer.setSize(w, h);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
// after load, so the shooting tool's page load isn't held up by the build (software rendering on a busy machine)
setTimeout(() => { try {
  const t0 = performance.now();
  const s = new Showroom();
  s.build(renderer);
  const car = buildCar({ car: (q.get('car') ?? 'rossini-gt') as CarId, quality: (q.get('q') ?? 'phone') as 'phone' | 'high' });
  s.setCar(car);
  s.resize(w, h, 1);
  s.setFrame(num('cx', 0.6), num('cy', 0.42), num('span', 0.5));
  const t1 = performance.now();
  if (q.get('thumb')) s.renderThumb(renderer, w / h); else s.render(renderer, num('t', 0), num('t', 0) > 0);
  const info = { buildMs: Math.round(t1 - t0), renderMs: Math.round(performance.now() - t1), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  console.warn(JSON.stringify(info));
  (window as unknown as { __stage: unknown }).__stage = { info: () => info };
  (window as unknown as { __previewReady: boolean }).__previewReady = true;
} catch (e) {
  (window as unknown as { __previewError: string }).__previewError = String((e as Error).stack || e);
} }, 50);

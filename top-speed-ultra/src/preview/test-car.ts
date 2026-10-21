// Test page for the car part: the garage cars inside and out, from every camera the game has.
//   ?view= seat | free-left | free-right | free-up | hood | chase | back | sky | sky-zoom | dash | beauty | rear | wheel |
//          garage | lineup | lineup-top | side | top | front | mirror | dmirror | door | wheelck | hero | rear34 | wing
//   &car=rossini-gt | rossini-brio | rossini-corsa | vela-e | oc-hyper      &q=high|phone   &world=0 to skip the game's roads
//   &time=night (the game's night sky; default the golden-hour test light)   &bloom=1 (the game's High/Ultra bloom pass)
//   &key=showroom (preview only, not the game's light: three overhead strip lights, cool white, as rect-area lights
//                  with lit strips the reflection probe and the paint pick up; the reference sheet's night showroom)
//   &cy=metres (front and back-ortho: the camera's height, default 0.75)
//   &paint=hex   &s=metres from the stretch start   &mirrors=live|env   &hands=1 (the hands part on the rim)
//   &portrait=1 (the game's portrait-phone camera numbers)   &cam=x,y,z&at=x,y,z&fov=deg (any camera, car's frame)
//   &lit=1 (outside views: every switched lamp on, as PlayerCar lights them: the brake level on the tail lamps, the
//          turn signals and the reversing lamps; &head=night the headlamps at the game's night level)
// The interior views follow the car's driver (car-shape seatOffset: the hypercar's sits lower and further in).
// The game's cameras (src/game/Game.ts updateCamera), in the car's frame:
//   seat: EYE, pitched -0.085 rad (portrait -0.27), FOV 58 (portrait 96); free: the same eye, FOV 66
//   hood: (0, 1.0, -1.45), pitched -0.04 rad, FOV 62 (portrait 92)
//   chase: 6.6 m behind, 2.25 m up (portrait 8.2, 2.9), looking 3.5 m ahead and 0.9 m up, FOV 60 (portrait 80)
//   sky: 150 m up and 40 m ahead, looking straight down, FOV 50, square
// Logs (console.warn, so preview-shoot prints it) the build time and the part's own cost: draw calls and triangles
// with the part shown minus with it hidden, shadow passes included.
import * as THREE from 'three';
import { makeStage, Stage } from './stage';
import { buildCar } from './car';
import { CAR_IDS, CarId, shapeFor, seatOffset } from './car-shape';
import { EYE } from './spec';
import { carProbe } from './car-probe';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'beauty';
const quality = (q.get('q') ?? 'high') as 'high' | 'phone';
const car = (q.get('car') ?? 'rossini-gt') as CarId;
const paint = q.get('paint') ? parseInt(q.get('paint')!, 16) : undefined;
const portrait = q.get('portrait') === '1';
const debug = ['side', 'top', 'front', 'lineup', 'lineup-top', 'back-ortho', 'wheel-side', 'top-full'].includes(view);
const wantWorld = !debug && q.get('world') !== '0';
const interior = ['seat', 'free-left', 'free-right', 'free-up', 'dash', 'mirror', 'dmirror', 'door', 'wheelck', 'grip'].includes(view);

const FOV: Record<string, number> = {
  seat: portrait ? 96 : 58, 'free-left': 66, 'free-right': 66, 'free-up': 66, hood: portrait ? 92 : 62, chase: portrait ? 80 : 60, sky: 50, 'sky-zoom': 7, back: 62,
  dash: 50, wheelck: 50, door: 60, wheel: 34, dmirror: 16, grip: 28, garage: 34, hero: 30, rear34: 30, wing: 26,
};
const stage = await makeStage({ stretch: !debug, fov: FOV[view] ?? 30, near: view === 'chase' ? 0.15 : 0.02 });
const { scene, camera, renderer } = stage;
const env = stage.useGameSky((q.get('time') as 'sunset') ?? 'sunset');
// Test light only: the game's 'sunset' preset has the sun at 3 degrees, where the sound walls shade the whole
// freeway. Golden hour in October with the sun at ~9 degrees (about 45 minutes before sunset) shows the car in
// sunlight. The atmosphere part owns the final scene's light.
const night = q.get('time') === 'night';
if (night) env.set('night', 'clear', true);
else {
  const alt = Number(q.get('alt') ?? 9) * Math.PI / 180;
  const E = env as unknown as { targetFor(d: Date): { alt: number } };
  const orig = E.targetFor.bind(env);
  E.targetFor = (d: Date) => { const s = orig(d); s.alt = alt; return s; };
  env.set('sunset', 'clear', true);
}
const log: Record<string, unknown> = { view, car, quality };

// where: on I-405 North (lane 1), or at the origin on a plain ground for the debug views
let frame: THREE.Object3D;
if (debug) {
  frame = new THREE.Group(); scene.add(frame);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x55534f, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
} else {
  const st = stage.stretch!;
  frame = stage.driverView(st.s0 + Number(q.get('s') ?? 1500));
}
const L = (x: number, y: number, z: number) => frame.localToWorld(new THREE.Vector3(x, y, z));
// the same in the driver's frame (moved by this car's seat offset)
const SO = seatOffset(shapeFor(car)), EYE_C = EYE.clone().add(new THREE.Vector3(...SO));
const Ld = (x: number, y: number, z: number) => L(x + SO[0], y + SO[1], z + SO[2]);
function look(from: THREE.Vector3, at: THREE.Vector3) { camera.position.copy(from); camera.up.set(0, 1, 0); camera.lookAt(at); }
// a camera fixed in the car's frame: position, then yaw (left +) and pitch (up +) from straight ahead
function carCam(p: THREE.Vector3, yaw: number, pitch: number) {
  frame.updateMatrixWorld(true);
  camera.position.copy(p).applyMatrix4(frame.matrixWorld);
  const qf = frame.getWorldQuaternion(new THREE.Quaternion());
  camera.quaternion.copy(qf).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')));
}

// what to build
let part: THREE.Object3D;
const t0 = performance.now();
if (interior) {
  const { buildCockpit } = await import('./cockpit');
  const ck = buildCockpit({ car, paint, quality, mirrors: (q.get('mirrors') as 'live' | 'env' | null) ?? undefined });
  part = ck.group;
  frame.add(ck.group);
  log.buildMs = Math.round(performance.now() - t0);
  stage.onFrame((dt) => ck.update?.(dt));
  // &hands=1: the hands part's driver on the rim (a fit check: the grips must be clean leather under the fingers)
  if (q.get('hands') === '1') {
    try {
      const [{ buildDriverArms }, { lookFor }] = await Promise.all([import('./hands'), import('../game/drivers')]);
      const arms = buildDriverArms({ look: lookFor('closer', 'm', 1), presentation: 'm', quality });
      ck.wheel.add(arms.group);
      log.hands = 'ok';
    } catch (e) { log.hands = String(e); }
  }
  if (view === 'seat') carCam(EYE_C, 0, portrait ? -0.27 : -0.085);
  if (view === 'free-left') carCam(EYE_C, 1.2, -0.22);
  if (view === 'free-right') carCam(EYE_C, -1.05, -0.3);
  if (view === 'free-up') carCam(EYE_C, -0.25, 0.75);
  if (view === 'dash') look(Ld(-0.3, 1.02, -0.02), Ld(-0.4, 0.83, -0.6));
  if (view === 'mirror') look(Ld(-0.37, 1.16, 0.1), Ld(0.05, 1.18, -0.3));
  if (view === 'dmirror') look(Ld(-0.37, 1.16, 0.1), L(-1.02, 0.975, -0.66));
  if (view === 'door') look(Ld(-0.3, 1.12, 0.12), L(-0.86, 0.72 + SO[1] * 0.5, -0.35));
  if (view === 'wheelck') look(Ld(-0.37, 1.16, 0.1), Ld(-0.37, 0.84, -0.42));
  if (view === 'grip') look(Ld(-0.1, 1.08, -0.05), Ld(-0.22, 0.9, -0.45));
} else if (view === 'garage' || view === 'lineup' || view === 'lineup-top') {
  // all four: side by side across the lanes (garage), or nose to tail on a plain floor (lineup, for proportions)
  const grp = new THREE.Group(); frame.add(grp); part = grp;
  const ms: number[] = [];
  CAR_IDS.forEach((id, i) => {
    const t1 = performance.now();
    const c = buildCar({ car: id, quality });
    ms.push(Math.round(performance.now() - t1));
    if (view === 'garage') { c.position.set(-1.0 + i * 2.75, 0, 1.2 - i * 0.9); c.rotation.y = 0; }
    else c.position.set(0, 0, -8.1 + i * 5.4);
    grp.add(c);
  });
  log.buildMs = ms;
  if (view === 'garage') look(L(-5.2, 1.35, -9.5), L(2.6, 0.55, 0.4));
  // (the long lens is opened to fit every car, nose to tail, centred on the middle one)
  if (view === 'lineup') { const mid = -8.1 + 5.4 * (CAR_IDS.length - 1) / 2, span = 5.4 * (CAR_IDS.length - 1) + 5.4; camera.fov = 2 * Math.atan(span / 2 / camera.aspect / 180) * 180 / Math.PI; look(L(-180, 0.7, mid), L(0, 0.7, mid)); }
  if (view === 'lineup-top') { camera.fov = 7.5; look(L(0, 180, 0.01), L(0, 0, 0)); }
} else {
  const c = buildCar({ car, paint, quality });
  frame.add(c); part = c;
  if (q.get('lit') === '1') {
    const m = c.userData.materials as Record<string, THREE.MeshStandardMaterial>;
    if (m.tail) m.tail.emissiveIntensity = 5;
    for (const k of ['sigL', 'sigR', 'reverse']) { const o = c.getObjectByName(k); if (o) o.visible = true; }
    log.lit = true;
  }
  if (q.get('head') === 'night') { const m = c.userData.materials as Record<string, THREE.MeshStandardMaterial>; if (m.lamp) m.lamp.emissiveIntensity = 5.4; log.head = 'night'; }
  log.buildMs = Math.round(performance.now() - t0);
  if (view === 'side') look(L(-14, 0.62, 0), L(0, 0.62, 0));
  if (view === 'top') look(L(0, 16, 0.01), L(0, 0, 0));
  if (view === 'top-full') look(L(0, 21, 0.01), L(0, 0, 0));   // the whole car, splitter to wing
  // &cy= raises the front and back cameras (the reference sheet's FRONT and REAR panels look down a little)
  const cy = Number(q.get('cy') ?? 0.75);
  if (view === 'front') look(L(0, cy, -14), L(0, 0.62 - (cy - 0.75) * 0.3, 0));
  if (view === 'beauty') look(L(-3.9, 1.0, -4.6), L(0.1, 0.5, 0.2));
  if (view === 'rear') look(L(-3.4, 1.05, 5.0), L(0.15, 0.55, 0.1));
  // the reference sheet's hero: low and wide from the front left, a long lens; rear34 the same from behind
  if (view === 'hero') look(L(-4.7, 0.8, -6.1), L(0.2, 0.45, 0.25));
  if (view === 'rear34') look(L(-5.4, 1.1, 7.6), L(0.1, 0.5, -0.1));
  // the wing up close from behind and above the left end plate: the carbon, a swan neck, the plates and their LEDs
  if (view === 'wing') look(L(-1.75, 1.62, 3.55), L(-0.3, 0.98, 1.95));
  if (view === 'back-ortho') look(L(0, cy, 14), L(0, 0.62 - (cy - 0.75) * 0.3, 0));
  // the front wheel square on, from outboard (a close look at the rim, the caliper and the centre cap)
  if (view === 'wheel-side') { const { bodyFor } = await import('./car-body'); const A = bodyFor(car).AXLE; look(L(-9, A.r, A.zF), L(0, A.r, A.zF)); }
  if (view === 'wheel') look(L(-2.0, 0.55, -2.25), L(-0.85, 0.36, -1.33));
  if (view === 'hood') carCam(new THREE.Vector3(0, shapeFor(car).hoodY ?? 1.0, -1.45), 0, -0.04);
  if (view === 'back') carCam(new THREE.Vector3(0, 1.15, 2.6), Math.PI, 0);
  if (view === 'chase') look(L(0, portrait ? 2.9 : 2.25, portrait ? 8.2 : 6.6), L(0, 0.9, -3.5));
  if (view === 'sky' || view === 'sky-zoom') {
    // heading-up: the car's forward is the top of the frame
    const p = L(0, 150, -40), at = L(0, 0, -40.001), fwd = L(0, 0, -1).sub(L(0, 0, 0)).normalize();
    camera.position.copy(p); camera.up.copy(fwd); camera.lookAt(at);
    if (view === 'sky-zoom') { camera.position.copy(L(0, 150, 0)); camera.lookAt(L(0, 0, 0.001)); }
  }
}
if (debug && !view.startsWith('lineup')) camera.fov = view === 'wheel-side' ? 5.2 : 16;
if (view === 'garage' && CAR_IDS.length > 4) camera.fov = 40;
// &cam=x,y,z&at=x,y,z[&fov=deg]: any camera in the car's frame (a close look at one detail); overrides the view's
if (q.get('cam') && q.get('at')) {
  const [cx, cy2, cz] = q.get('cam')!.split(',').map(Number), [ax, ay, az] = q.get('at')!.split(',').map(Number);
  look(L(cx, cy2, cz), L(ax, ay, az));
  if (q.get('fov')) camera.fov = Number(q.get('fov'));
}
camera.updateProjectionMatrix();
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
// geometry sanity: name any mesh with NaN positions
{
  const bad: string[] = [];
  part.traverse((o) => {
    const m = o as THREE.Mesh; const p = m.isMesh ? m.geometry.attributes.position : null;
    if (p) for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) { bad.push(`${m.parent?.name}/${m.name}@${Math.floor(i / 3)}/${p.count}`); break; }
  });
  if (bad.length) log.nan = bad;
}
// &key=showroom: the preview's showroom key (not the game's light): three overhead strips over the car's length
if (q.get('key') === 'showroom') {
  const { RectAreaLightUniformsLib } = await import('three/examples/jsm/lights/RectAreaLightUniformsLib.js');
  RectAreaLightUniformsLib.init();
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe6efff).multiplyScalar(4) });
  for (const x of [-1.6, 0, 1.6]) {
    const l = new THREE.RectAreaLight(0xdfe9ff, 7, 0.25, 6.5);
    l.position.copy(L(x, 4.2, 0)); l.lookAt(L(x, 0, 0)); scene.add(l);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 6.5), stripMat);
    strip.position.copy(L(x, 4.21, 0)); strip.lookAt(L(x, 0, 0)); scene.add(strip);
  }
  log.key = 'showroom';
}
// the car's reflection probe (&probe=0 to see the sky preset's environment instead): the real road, walls and sky
// round the car in the paint, the glass, the chrome and the mirrors. Captured once the sky has run a frame or two.
if (q.get('probe') !== '0') {
  await new Promise<void>((res) => { let k = 0; stage.onFrame(() => { if (++k === 2) res(); }); });
  const t1 = performance.now();
  const probe = carProbe(renderer, scene, frame, { res: quality === 'high' ? 128 : 64 });
  probe.capture([part]);
  // inside: only what's outside the cabin and the mirrors see the probe; the cabin keeps the darker cabin light
  if (interior) { const b = part.getObjectByName('body'); if (b) probe.apply(b); probe.apply(part, { skip: (m) => !['mirror', 'mirrorDim', 'chrome'].includes(m.name) }); }
  else probe.apply(part);
  log.probeMs = Math.round(performance.now() - t1);
  stage.onFrame(() => probe.tick([part]));
}
// &bloom=1: the game's bloom pass on High and Ultra (strength 0.22, radius 0.45, threshold 0.92) and its output pass
if (q.get('bloom') === '1') {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
    import('three/examples/jsm/postprocessing/EffectComposer.js'), import('three/examples/jsm/postprocessing/RenderPass.js'),
    import('three/examples/jsm/postprocessing/UnrealBloomPass.js'), import('three/examples/jsm/postprocessing/OutputPass.js'),
  ]);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const c = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType }));
  c.addPass(new RenderPass(scene, camera)); c.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.45, 0.92)); c.addPass(new OutputPass());
  stage.setRender(() => c.render());
  log.bloom = true;
}
await stage.ready(2);
if (q.get('measure') !== '0') Object.assign(log, measure(stage, part));
console.warn('[car] ' + JSON.stringify(log));
void renderer;

// The realism preview's stage: a renderer, a scene, a camera, the real stretch of the 405, and a render loop that
// tells the screenshot tool when it's ready. Every part's test page and the final scene are built on this.
//
// Coordinates: the scene is in local metres around the stretch's middle (stage.origin), so numbers stay small. Use
// stage.toLocal(x, y, z) on anything that comes from the network (path.at(), signs, overpasses), which are in world
// metres (x east, z south, y height above sea level). The game's floating ORIGIN is set to the same point, so game
// modules that render (Roads, Terrain) line up too.
import * as THREE from 'three';
import { Network, Sign } from '../game/world/Network';
import { Path, ORIGIN } from '../game/world/Path';
import { Environment, TimeOfDay, Weather } from '../game/env/Environment';
import { configureTextures } from '../game/textures';
import { Roads } from '../game/world/Roads';
import { Terrain } from '../game/world/Terrain';
import { QUALITY, Quality } from '../game/settings';
import { STRETCH } from './spec';

export interface Stretch {
  net: Network;
  path: Path;                       // I-405 North
  s0: number; s1: number;           // the stretch, in metres along the path
  signs: Sign[];                    // the real exit signs on the stretch (destination text from OpenStreetMap)
  paths: Path[];                    // every path (mains and ramps) with any part within 400 m of the stretch
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  stretch: Stretch | null;
  origin: THREE.Vector3;            // world x, z of the local origin (y is 0: heights stay heights above sea level)
  toLocal(x: number, y: number, z: number, out?: THREE.Vector3): THREE.Vector3;
  // a point on the stretch: s along I-405 North, d metres to the right of its centreline, in local coordinates,
  // with the heading h (the road's tangent is (sin h, cos h) in x, z) and the height
  roadPoint(s: number, d?: number): { p: THREE.Vector3; h: number };
  // put the camera in the driver's seat of a car at (s, d), looking down the road; returns the car's frame, so a car
  // model added to it lines up with the eye
  driverView(s: number, d?: number, eye?: THREE.Vector3): THREE.Object3D;
  onFrame(fn: (dt: number, t: number) => void): void;
  setRender(fn: (dt: number) => void): void;   // replace renderer.render, e.g. with a post-processing composer
  env: Environment | null;                     // the game's sky and sun, if useGameSky() was called
  useGameSky(time?: TimeOfDay, weather?: Weather): Environment;
  addGameWorld(quality?: Quality): void;       // the game's current roads and terrain, for before/after
  ready(frames?: number): Promise<void>;       // render this many frames, then tell the screenshot tool
  info(): { calls: number; tris: number; geometries: number; textures: number; programs: number; frameMs: number };
}

export interface StageOptions {
  stretch?: boolean;                // load the network and the stretch (default true)
  fov?: number;
  near?: number;
  far?: number;
  pixelRatio?: number;
  antialias?: boolean;
}

declare global { interface Window { __stage?: Stage; __previewReady?: boolean; __previewError?: string } }

export async function makeStage(o: StageOptions = {}): Promise<Stage> {
  addEventListener('error', (e) => { window.__previewError = String(e.message || e); });
  addEventListener('unhandledrejection', (e) => { window.__previewError = String((e as PromiseRejectionEvent).reason); });
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: o.antialias ?? true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(o.pixelRatio ?? Math.min(2, devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  configureTextures(1024, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 60, innerWidth / innerHeight, o.near ?? 0.05, o.far ?? 4000);
  scene.add(camera);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });

  // the stretch
  let stretch: Stretch | null = null;
  const origin = new THREE.Vector3();
  if (o.stretch ?? true) {
    const net = await Network.load();
    const path = net.mains.find((m) => m.label === STRETCH.label);
    if (!path) throw new Error(`no ${STRETCH.label} in the network`);
    const s0 = path.ctrlS[STRETCH.ctrl0], s1 = path.ctrlS[STRETCH.ctrl1];
    const mid = path.at((s0 + s1) / 2, 0);
    origin.set(Math.round(mid.x), 0, Math.round(mid.z));
    ORIGIN.x = origin.x; ORIGIN.z = origin.z;
    const signs = net.signs.filter((g) => g.path === path && g.s >= s0 - 200 && g.s <= s1 + 200);
    // every road near the stretch: sample along it and ask the network
    const near = new Set<Path>();
    for (let s = s0 - 300; s <= s1 + 300; s += 40) {
      const p = path.at(Math.max(0, Math.min(path.len, s)), 0);
      for (const h of net.near(p.x, p.z, 400)) near.add(h.path);
    }
    stretch = { net, path, s0, s1, signs, paths: [...near] };
  }
  const toLocal = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x - origin.x, y, z - origin.z);

  const roadPoint = (s: number, d = 0) => {
    if (!stretch) throw new Error('no stretch loaded');
    const a = stretch.path.at(s, d);
    return { p: toLocal(a.x, a.y, a.z), h: a.h };
  };
  const carFrame = new THREE.Object3D();
  carFrame.rotation.order = 'YXZ';
  scene.add(carFrame);
  const driverView = (s: number, d?: number, eye = new THREE.Vector3(-0.37, 1.16, 0.1)) => {
    if (!stretch) throw new Error('no stretch loaded');
    const lane = d ?? stretch.path.laneCenter(Math.min(1, stretch.path.lanes - 1));
    const { p, h } = roadPoint(s, lane);
    const ahead = roadPoint(s + 4, lane).p;
    carFrame.position.copy(p);
    carFrame.rotation.set(-Math.atan2(ahead.y - p.y, 4), h + Math.PI, 0);    // the car faces -z: yaw by h + pi
    carFrame.updateMatrixWorld(true);
    camera.position.copy(eye).applyMatrix4(carFrame.matrixWorld);
    const look = new THREE.Vector3(eye.x, eye.y - 0.06, eye.z - 10).applyMatrix4(carFrame.matrixWorld);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    return carFrame;
  };

  const hooks: ((dt: number, t: number) => void)[] = [];
  let render = (_dt: number) => renderer.render(scene, camera);
  let env: Environment | null = null;
  let roads: Roads | null = null, terrain: Terrain | null = null;
  let frames = 0, last = performance.now(), t = 0, frameMs = 0;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000)); last = now; t += dt;
    const t0 = performance.now();
    for (const f of hooks) f(dt, t);
    if (env) { env.update(dt); env.follow(camera.position, camera, t, dt); }
    if (roads || terrain) {
      const wx = camera.position.x + origin.x, wz = camera.position.z + origin.z;
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw);
      roads?.update(wx, wz, fw.x, fw.z, 4); terrain?.update(wx, wz, 2);
    }
    render(dt);
    frameMs = performance.now() - t0;
    frames++;
  };
  requestAnimationFrame(loop);

  const stage: Stage = {
    renderer, scene, camera, stretch, origin, toLocal, roadPoint, driverView,
    onFrame: (fn) => { hooks.push(fn); },
    setRender: (fn) => { render = fn; },
    get env() { return env; },
    useGameSky(time = 'sunset', weather = 'clear') {
      if (!env) { env = new Environment(scene, renderer); env.setQuality(2048, camera.far); }
      env.set(time, weather, true);
      return env;
    },
    addGameWorld(quality = 'high') {
      if (!stretch) throw new Error('no stretch loaded');
      const q = QUALITY[quality];
      roads = new Roads(stretch.net, q); scene.add(roads.group);
      terrain = new Terrain(stretch.net, q); scene.add(terrain.group);
      const wx = camera.position.x + origin.x, wz = camera.position.z + origin.z;
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw);
      for (let i = 0; i < 400 && roads.update(wx, wz, fw.x, fw.z, 8) + terrain.update(wx, wz, 4) > 0; i++) { /* build what's in view */ }
    },
    async ready(n = 3) {
      const f0 = frames;
      await new Promise<void>((res) => { const w = () => (frames >= f0 + n ? res() : requestAnimationFrame(w)); w(); });
      window.__previewReady = true;
    },
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0, frameMs };
    },
  };
  window.__stage = stage;
  return stage;
}

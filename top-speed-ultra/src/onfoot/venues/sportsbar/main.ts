// Stoppage Time on foot: phase S1 of PROJECT_OC_SPORTS_BAR.md, a standalone page (not yet the game). Our own
// fictional sports bar at the real spot on South Claudina Way in Anaheim, built in code; the streets, the I-5 and the
// rest of the block from OpenStreetMap through Overture (ODbL, credited on screen). You walk it as your driver from the
// game, in first or third person or from overhead, by touch, keyboard or gamepad. The sky is the game's (the real sun
// for the chosen hour); the crowd level is simulated from the time and day and labelled so; nothing here is live.
// This file follows Lot 57's main.ts structure for applyQuality and the loop:
// COPY of lot57 main.ts's page loop and applyQuality: E0 replaces them with engine/page.ts and engine/quality.ts.
// Its choices (the parked cars' quality and count, your avatar's level of detail, the trees, the shadows) are the
// bar's own, as the plan states them. Test hooks: window.__onfoot (see the bottom of this file).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Environment } from '../../../game/env/Environment';
import { configureTextures } from '../../../game/textures';
import * as Props from '../../../game/road/props';
import { buildPerson, Person, randomPerson } from '../../people';
import { Kit, P2, rand } from '../../engine/geom';
import { ColliderSet, exportColliders, isTall, circ } from '../../engine/collide';
import { WalkGrid, RADIUS } from '../../engine/walkgrid';
import { STEP } from '../../engine/player';
import type { Seat } from '../../engine/venue-types';
import { Hud, loading, doneLoading } from '../../engine/hud';
import { readDriver, driverPerson, eyeHeight } from '../../engine/driver';
import { ParkedCars, yourCar } from '../../engine/lot';
import * as C from '../../engine/clock';
import * as Sch from '../../engine/schedule';
import type { Quality } from '../../engine/mats';
import { buildStreets, lightStreams, TOP, project as projectOn } from '../../engine/streets';
import { OverheadCamera } from '../../engine/overhead';
import { loadSite, NO_PEOPLE, ALLOC } from './def';
import { makeBarMats, setBarNight, streetMats } from './mats';
import { buildBarVenue } from './venue';
import { buildBarLot, standInGeometry } from './lot';
import { BarPlayer } from './player';
import { BarInput, BarAction } from './input';
import { BarHud } from './hud';
import { BarView, nextView } from './views';
import { PRESET } from './quality';
import { Visibility, setHiddenCaster } from './visibility';
import { laneTest, pathAt, pathLength } from './staff';
import { BAR_NAME } from './brand';
import { FRONT, fd, DOOR_START, HANDOFF, TREES, ZONES, PZONES, furniture } from './layout';
import { pointInPoly as pointInRing } from '../../engine/geom';
import { Embed, MountOptions, mountPage, optionsToParams } from '../../embed';

let q = new URLSearchParams(location.search);
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const sysReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Ultra is an entitlement flag only (decision 15): owner mode and the test build unlock it; there's no price and no
// purchase path anywhere. Until RS2's shared entitlement lands (S4), the flag is the page's own: ?ultra=1, the owner
// flag on this device, or the test hooks.
let ultraUnlocked = q.get('ultra') === '1' || q.get('quality') === 'ultra' || (() => { try { return localStorage.getItem('tsu.owner') === '1'; } catch { return false; } })();
let quality: Quality = (['low', 'high', 'ultra'].includes(q.get('quality') ?? '') ? q.get('quality') : coarse ? 'low' : 'high') as Quality;
if (quality === 'ultra' && !ultraUnlocked) quality = 'high';
let reduced = q.get('motion') === 'reduced' || sysReduced;
/** mounted in the game (mount, below): its hooks to stop, release and drive; null on the page's own */
let embed: Embed | null = null;
const track = <T>(f: () => T): T => (embed ? embed.track(f) : f());

declare global { interface Window { __onfoot?: Record<string, unknown>; __onfootError?: string } }
addEventListener('error', (e) => { window.__onfootError = String(e.message || e); });
addEventListener('unhandledrejection', (e) => { window.__onfootError = String((e as PromiseRejectionEvent).reason); });

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const THING: Record<string, string> = {
  car: 'A parked car', door: 'The door', table: 'A table', bench: 'A booth', stool: 'A stool', counter: 'The bar', wall: 'A wall', glass: 'The glass',
  fence: 'The fence', pole: 'A pole', planter: 'A planter', heater: 'A heater', building: 'A building', edge: 'The edge of the area', rail: 'A rail',
  tree: 'A tree', board: 'The dart surround', stand: 'The stand', shelf: 'The back bar', gate: 'The staff gate', jukebox: 'The jukebox', rack: 'The bike rack',
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

async function main() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !(coarse && quality === 'low'), stencil: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // the maps are drawn once a frame ("Shadows in three.js 0.160.1"): every renderer.render would redraw them, GTAO's
  // normal pass and the test hooks' measuring renders included, so they update only when the frame asks
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  configureTextures(PRESET[quality].tex, renderer.capabilities.getMaxAnisotropy());
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 2600);
  const env = new Environment(scene, renderer);
  env.set('live', 'clear', true);
  for (const o of [env.sky, env.clouds, env.mountains, env.stars]) o.userData.group = 'sky';
  // the game's sky lights the scene through an environment map over a plain ground disc that doesn't darken at night;
  // the page dims it with the daylight at runtime, as Lot 57's page does (the game's file is unchanged)
  const envInternals = env as unknown as { envScene?: THREE.Scene; envDirty?: boolean; envT?: number };
  const envGround = envInternals.envScene?.children.find((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.type === 'CircleGeometry') as THREE.Mesh | undefined;
  const envGroundHex = envGround ? (envGround.material as THREE.MeshBasicMaterial).color.getHex() : 0;
  // the game's Environment rebuilds its PMREM environment map whenever the sky moves or the page dims its ground (every
  // clock change here, and once a minute while the page follows the real clock), and frees only the old map's
  // texture, which leaves the old 768 x 1024 render target on the GPU each time (S1's repair measured 4 of them a
  // round of quality switches with a pose each). The page does the same rebuild on its own instance and frees the old
  // render target; the game's file is unchanged (the handoff tells its owners)
  {
    const envRebuild = env as unknown as { rebuildEnv(): void; envTex?: THREE.Texture };
    let envRT: THREE.WebGLRenderTarget | null = null;
    envRebuild.rebuildEnv = () => {
      if (!envInternals.envScene) return;
      const pm = new THREE.PMREMGenerator(renderer);
      const rt = pm.fromScene(envInternals.envScene, 0.02);
      pm.dispose();
      scene.environment = rt.texture;
      if (envRT) envRT.dispose(); else envRebuild.envTex?.dispose();
      envRT = rt; envRebuild.envTex = rt.texture;
    };
  }
  const dimEnvGround = () => { if (!envGround) return; (envGround.material as THREE.MeshBasicMaterial).color.setHex(envGroundHex).multiplyScalar(0.03 + 0.97 * env.daylight ** 1.5); envInternals.envDirty = true; envInternals.envT = 0; };

  // ------------------------------------------------------------------------------------------ build the world
  const steps: [string, number][] = [['Reading the map', 0.06], ['Painting the textures', 0.12], ['Laying out Claudina Way and the I-5', 0.3], ['Building Stoppage Time', 0.5], ['Striping the lot', 0.58], ['Baking the lights', 0.68], ['Mapping where you can walk', 0.78], ['Your driver', 0.86], ["Building your driver's close-up", 0.92], ['Parking cars', 0.96]];
  let si = 0; const stage = async (skipTo?: number) => { if (skipTo !== undefined) si = skipTo; loading(steps[si][1], steps[si][0] + '…'); si++; await nextFrame(); await nextFrame(); };
  const t0 = performance.now();
  await stage();
  const site = await loadSite();
  const { def, frame: F, slice } = site;
  const L = (u: number, v: number): P2 => F.fromFrame(u, v);
  const G = (lx: number, lz: number) => { const [x, z] = F.toGame(lx, lz); return { x: +x.toFixed(3), z: +z.toFixed(3) }; };
  const toL = (gx: number, gz: number) => F.toLocal(gx, gz);
  await stage();
  const mats = makeBarMats();
  mats.ground.map!.repeat.set(400, 400); mats.ground.normalMap!.repeat.set(400, 400);
  await stage();
  const streets = buildStreets(slice as never, streetMats(mats), { frame: F, centre: [18, 8], nearR: 210, dropSegs: def.site.dropSegs ?? [], keepHost: def.site.keepHost!.bld, far: PRESET[quality].far, colliderR: 140 });
  streets.near.group.userData.group = 'near streets'; streets.far.group.userData.group = 'far streets';
  scene.add(streets.near.group, streets.far.group);
  const MAX_STREAM = 400;
  const streams = lightStreams(streets, [[560, 362], [222, 358, 438]], MAX_STREAM, mats.streamHead, mats.streamTail);
  streets.near.group.add(streams.head, streams.tail);
  const streamCars = (qq: Quality) => (qq === 'low' ? 100 : qq === 'high' ? 200 : 400);
  await stage();
  const kit = new Kit();
  const room = def.rooms[0];
  const venue = buildBarVenue(kit, mats, F, room, site.restRing, site.unitOuter);
  await stage();
  const lot = buildBarLot(kit, mats, F, slice, site.lot, def.parking.stalls, site.yourStall);
  await stage();
  const world = new THREE.Group(); world.name = 'world'; world.userData.group = 'venue'; scene.add(world);
  const worldMeshes = kit.finish(world, kit.emitters, true);
  for (const m of venue.meshes) world.add(m);
  // the pool tables sit outside the kit (Ultra's pool spots need them as their own meshes), so they missed its bake
  // and read black at night on Low, which has no pool spots: bake the same night light into them now
  for (const p of venue.pool) { p.batch.bake(kit.emitters); p.table.geometry.dispose(); p.table.geometry = p.batch.build(); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; ground.name = 'ground'; world.add(ground);
  const byName = (n: string) => worldMeshes.find((m) => m.name === n) ?? null;
  // the lot heads' glow, and the pool of light on the ground under each (the asphalt's dark albedo swallows the baked
  // light, as at Lot 57): one draw call each
  {
    const heads = kit.emitters.filter((e) => e.ch === 1 && (e.down ?? 0) > 1.5);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(heads.map((e) => [e.x, e.y + 0.08, e.z]).flat(), 3)); g.computeBoundingSphere();
    const p = new THREE.Points(g, mats.glow); p.name = 'lot-glow'; p.renderOrder = 5; world.add(p);
    const P: number[] = [], U: number[] = [];
    for (const e of heads) { const r = 1.1 * e.y, h = 0.05; P.push(e.x - r, h, e.z - r, e.x - r, h, e.z + r, e.x + r, h, e.z + r, e.x - r, h, e.z - r, e.x + r, h, e.z + r, e.x + r, h, e.z - r); U.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); pg.computeBoundingSphere();
    const pools = new THREE.Mesh(pg, mats.pool); pools.name = 'lot-pools'; pools.renderOrder = 4; world.add(pools);
  }
  // the walls the overhead view cuts away, the roof and ceiling it hides
  for (const id of Object.keys(venue.walls)) { const w = venue.walls[id]; w.full = ['wall-' + id, 'glass-' + id].map(byName).filter(Boolean) as THREE.Object3D[]; w.cut = ['cut-' + id].map(byName).filter(Boolean) as THREE.Object3D[]; for (const o of w.cut) o.visible = false; }
  const roofs = ['unit-roof', 'unit-ceiling'].map(byName).filter(Boolean) as THREE.Object3D[];
  // our 10 street trees, in up to 4 instanced meshes (the game's own palms and shade trees, as Lot 57 plants them)
  let treeGroup = plantTrees(def.trees, quality); scene.add(treeGroup);
  // parked cars and your car
  const carQuality = (qq: Quality) => PRESET[qq].cars;
  /** every texture an object's materials use */
  const texturesOf = (root: THREE.Object3D) => {
    const out = new Set<THREE.Texture>();
    root.traverse((o) => { const m = o as THREE.Mesh; if (!m.material) return; for (const mt of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) out.add(v as THREE.Texture); });
    return out;
  };
  /** release a replaced avatar: the people builder's dispose() frees its geometries and materials, but not its
   *  skeleton's bone texture or the textures its materials hold, so the page frees those itself (a texture the new
   *  body also uses, a builder's cached one, is kept) */
  const disposePerson = (old: Person, keep: Person) => {
    const kept = texturesOf(keep.group), skeletons = new Set<THREE.Skeleton>();
    const textures = texturesOf(old.group);
    old.group.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (sm.isSkinnedMesh && sm.skeleton) skeletons.add(sm.skeleton); });
    old.dispose();
    for (const sk of skeletons) sk.dispose();
    for (const t of textures) if (!kept.has(t)) t.dispose();
  };
  /** release replaced parked cars: Lot 57's ParkedCars.dispose() frees the instance buffers only, but each ParkedCars
   *  builds its own model geometries (the game's trafficParts makes new ones on every call) and its stand-ins' material */
  const disposeParked = (pc: ParkedCars) => {
    const own = new Set<THREE.Material>();
    pc.group.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.geometry.dispose(); if (m.name.endsWith('-far')) own.add(m.material as THREE.Material); });
    pc.dispose();
    for (const mt of own) mt.dispose();
  };
  /** release a replaced your-car: every geometry it was built with, and the materials made for it alone (the unlit
   *  copies of its lamps and its contact patch's), never the car builder's shared ones (userData.materials) */
  const disposeCar = (g: THREE.Object3D) => {
    const shared = new Set(Object.values((g.userData.materials ?? {}) as Record<string, THREE.Material>));
    const own = new Set<THREE.Material>();
    g.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) if (!shared.has(mt)) own.add(mt);
    });
    for (const mt of own) mt.dispose();
  };
  let parked = new ParkedCars(def.parking.stalls, carQuality(quality), 0, false);
  parked.group.userData.group = 'parked'; scene.add(parked.group);
  let parkedFill: [number, number] = [0, 0];
  const choice = readDriver(q);
  const carId = (['rossini-gt', 'rossini-brio', 'rossini-corsa', 'vela-e', 'oc-hyper'].includes(choice.car) ? choice.car : 'rossini-gt') as 'rossini-gt';
  let mine = yourCar(site.yourStall, carId, embed?.paint, PRESET[quality].people);
  mine.group.userData.group = 'your-car'; scene.add(mine.group);
  const carBox = new THREE.Box3().setFromObject(mine.group), carSize = carBox.getSize(new THREE.Vector3());
  const paintHex = (() => { let c = 0xb8b8b8; mine.group.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if ((o as THREE.Mesh).isMesh && mm && o.name.includes('paint') && mm.color) c = mm.color.getHex(); }); return c; })();
  const standinMat = mats.standin.clone(); standinMat.color.setHex(paintHex);
  const standin = new THREE.Mesh(standInGeometry(Math.max(carSize.x, carSize.z), Math.min(carSize.x, carSize.z)), standinMat);
  standin.name = 'your-car-standin'; standin.userData.group = 'your-car-standin'; standin.castShadow = true; standin.receiveShadow = true; standin.userData.cast = true;
  standin.position.set(site.yourStall.x, 0, site.yourStall.z - 0.15); standin.rotation.y = site.yourStall.face; standin.visible = false;
  scene.add(standin);
  await stage();

  // ------------------------------------------------------------------------------------------ colliders, walk grid
  const set = new ColliderSet();
  const treeCols = def.trees.map((t) => circ(t.x, t.z, t.kind === 'palm' ? 0.36 : 0.3, 'tree', true));
  set.add(...streets.colliders, ...venue.colliders, ...lot.colliders, mine.collider, ...venue.closedOnly, ...treeCols);
  const rings: P2[][] = [def.edge, lot.aisleRibbon, venue.region.front, venue.region.patio, venue.region.interior];
  let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
  for (const r of rings) for (const [x, z] of r) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  const grid = new WalkGrid(Math.floor(bx0 - 3), Math.floor(bz0 - 3), Math.ceil(bx1 + 3), Math.ceil(bz1 + 3));
  for (const r of rings) grid.fillPoly(grid.region, r);
  for (const c of venue.region.cut) grid.fillPoly(grid.region, c, 0);            // the lane and the flap: staff only
  for (const r of venue.region.raised) grid.fillPoly(grid.raised, r);
  grid.fillPoly(grid.raised, venue.region.rampLow, 0);                             // the kerb ramp: one step at its midline
  const refreshDynamic = () => { set.all = set.all.filter((o) => !o.dyn || venue.closedOnly.includes(o)); for (const c of parked.colliders) set.all.push(c); set.rebuild(); grid.computeFree(set, true); };
  set.rebuild(); grid.computeFree(set);
  await stage();

  // ------------------------------------------------------------------------------------------ you
  // Your driver: LOD 1 at the preset's people quality; at Ultra only, the close-up LOD 0, built once and never during
  // play (during loading if the page opens at Ultra; behind a "Preparing Ultra…" sheet if you pick Ultra later).
  const personOpts = driverPerson(choice);
  let person: Person | null = null, lod0Ready = false, avDirty = true;
  /** what applyAvatar last ran for (compared field by field each frame; no string is built) */
  const avLast = { view: '', lod0: false, quality: '', hide: false };
  const buildAvatar = (qq: Quality) => {
    const old = person;
    person = buildPerson({ ...personOpts, quality: PRESET[qq].people, lod: 1 as const });
    person.group.userData.group = 'avatar';
    scene.add(person.group);
    if (old) { scene.remove(old.group); disposePerson(old, person); }
    lod0Ready = false; avDirty = true;
    return person;
  };
  const buildLod0 = () => { const p = person; if (!p || lod0Ready) return; p.setLod(0); markRetroSkip(p); p.setLod(1); lod0Ready = true; avDirty = true; };
  const markRetroSkip = (p: Person) => p.group.traverse((o) => { if (o.name === 'hair-cap' || o.name === 'hair-cards') o.userData.retroSkip = true; });
  buildAvatar(quality);
  await stage();
  if (quality === 'ultra') buildLod0();
  await stage();
  const player = new BarPlayer(set, grid, (x, z) => grid.isRoad(x, z), def, F);
  player.eye = eyeHeight(personOpts);
  player.reducedMotion = reduced;
  player.person = person;
  const startAt = q.get('at')?.split(',').map(Number);
  if (startAt && startAt.length >= 2) { const [lx, lz] = toL(startAt[0], startAt[1]); player.place(lx, lz); }
  else player.place(lot.spawn.x, lot.spawn.z);
  // looking toward the unit's north-east corner, where the walk to the door turns
  const ne = L(6.4, 16.5);
  player.yaw = q.has('yaw') ? (Number(q.get('yaw')) * Math.PI) / 180 : Math.atan2(ne[0] - player.x, ne[1] - player.z);
  player.pitch = q.has('pitch') ? (Number(q.get('pitch')) * Math.PI) / 180 : 0.02;
  player.heading = player.yaw;
  let view: BarView = (['first', 'third', 'overhead'].includes(q.get('view') ?? '') ? q.get('view') : 'first') as BarView;
  player.view = view === 'overhead' ? 'first' : view;
  const overhead = new OverheadCamera();
  {
    const c = L(18, 8); overhead.target.set(c[0], 0.5, c[1]);
    overhead.yaw = F.yawFromFrame(0, 1); overhead.dist = 22;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of rings) for (const [x, z] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    overhead.box = { x0, x1, z0, z1 }; overhead.reducedMotion = reduced;
  }

  // ------------------------------------------------------------------------------------------ the clock and the crowd
  let live = !(q.has('day') || q.has('hour'));
  let clock: C.ClockState = live ? C.liveClock() : { day: C.parseDay(q.get('day') ?? 'Sat'), hour: clamp(Number(q.get('hour') ?? 21), 0, 23.99) };
  let simDate = C.anaheimDate(clock.day, clock.hour);
  let open = false, night = 0, share = 0, level: C.CrowdLevel = 'Closed', liveT = 0, bladeN = 3, bladeT = 0;
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null, gtao: GTAOPass | null = null;
  const tuneBloom = () => { if (!bloom) return; bloom.threshold = lerp(4.5, 0.88, night); bloom.strength = lerp(0.12, 0.34, night); };
  const hud = track(() => new Hud());
  const barHud = track(() => new BarHud(hud));
  const S = def.schedule;
  const fillShare = () => (open ? clamp(0.12 + share * 0.92, 0, 0.96) : 0.05);
  const applyClock = (firstTime = false) => {
    simDate = live ? new Date() : C.anaheimDate(clock.day, clock.hour);
    if (live) clock = C.liveClock();
    open = Sch.isOpen(S, clock.day, clock.hour); share = Sch.crowdShare(S, clock.day, clock.hour); level = Sch.crowdLevel(S, clock.day, clock.hour);
    env.update(1000, simDate); dimEnvGround(); env.update(1000, simDate);
    night = Math.pow(1 - env.daylight, 0.75);
    setBarNight(mats, night, open);
    tuneBloom();
    for (const d of venue.doors) d.collider.on = !open;
    mats.bladeSign.draw(bladeN, open ? null : `opens ${Sch.opensAt(S, clock.day, clock.hour)}`);
    // parked cars: Lot 57's share rule and seed (L6), divided by the fill bias its rule gives these stalls
    parkedFill = [Math.min(1, fillShare() / site.fillBias), clock.day * 100 + Math.floor(clock.hour)];
    parked.fill(...parkedFill);
    parked.update(player.x, player.z, true);
    refreshDynamic();
    hud.setPlace(C.fmtClock(clock), open ? `Open till ${Sch.closesAt(S, clock.day, clock.hour)}` : `Closed · opens ${Sch.opensAt(S, clock.day, clock.hour)}`);
    hud.setCrowd(level);
    hud.setClockMode(live, clock.day, clock.hour);
    // closed with you inside or on the patio: you're shown out to the front walk
    const [pu, pv] = F.toFrame(player.x, player.z), onPatio = pu > 2 && pu < 24 && pv < 0.3 && pv > -5.5;
    if (!firstTime && !open && (def.indoor(pu, pv) || onPatio)) { player.seat = null; const o = L(...fd(1.2, FRONT.doorC)); player.place(o[0], o[1]); hud.toast(`${BAR_NAME} is closed · opens ${Sch.opensAt(S, clock.day, clock.hour)}`); }
    else if (player.clearance(player.x, player.z) < RADIUS - 0.02 && !player.seat) { player.place(player.x, player.z); player.rescues++; }
  };
  applyClock(true);

  // ------------------------------------------------------------------------------------------ the lights and the look
  const realLights: THREE.Light[] = [];
  const poolSpots: (THREE.SpotLight | null)[] = [null, null];
  const vis = new Visibility({
    def, frame: F, parked: () => parked, yourCar: () => mine.group, standin,
    roots: () => [world, streets.near.group, streets.far.group, treeGroup, parked.group, mine.group, standin],
    pool: venue.pool.map((p, i) => ({ meshes: [p.table, p.light], get light() { return poolSpots[i]; } })) as { meshes: THREE.Mesh[]; light: THREE.SpotLight | null }[],
    sun: env.sun,
  });
  const makeLights = (qq: Quality) => {
    for (const l of realLights) { scene.remove(l); if ((l as THREE.SpotLight).target) scene.remove((l as THREE.SpotLight).target); l.dispose(); }
    realLights.length = 0; poolSpots[0] = poolSpots[1] = null;
    const P = PRESET[qq]; if (!P.lights) return;
    // HD: the two pool pendants as spot lights, a TV-wall fill and the back bar; Ultra adds rect-area lights for the TV
    // wall's glow and the back bar, and the pool spots cast shadows of their own table and lamp only
    for (const [i, s] of venue.insideLights.entries()) {
      if (s.kind === 'pool') {
        const l = new THREE.SpotLight(0xffd6a0, 0, 7, 0.75, 0.55, 2); l.position.set(s.x, s.y, s.z); l.target.position.set(s.x, 0, s.z);
        l.castShadow = qq === 'ultra'; if (l.castShadow) { l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0004; l.shadow.camera.near = 0.3; l.shadow.camera.far = 4; }
        scene.add(l, l.target); realLights.push(l); poolSpots[i] = l;
      } else { const l = new THREE.PointLight(s.kind === 'fill' ? 0xb8c8ff : 0xffc890, 0, s.kind === 'fill' ? 7 : 6, 2); l.position.set(s.x, s.y, s.z); scene.add(l); realLights.push(l); }
    }
    if (qq === 'ultra') {
      const tv = L(35.5, 4.75), back = L(20.4, 15.6);
      const r1 = new THREE.RectAreaLight(0x9ab0ff, 0, 3.2, 1.8); r1.position.set(tv[0], 2.35, tv[1]); r1.lookAt(...((): [number, number, number] => { const t = L(30, 4.75); return [t[0], 2.0, t[1]]; })());
      const r2 = new THREE.RectAreaLight(0xffc890, 0, 12, 0.4); r2.position.set(back[0], 2.4, back[1]); r2.lookAt(...((): [number, number, number] => { const t = L(20.4, 12); return [t[0], 1.2, t[1]]; })());
      scene.add(r1, r2); realLights.push(r1, r2);
      for (const h of [[12.9, -3.95], [20.95, -3.95]] as P2[]) { const [x, z] = L(h[0], h[1]); const l = new THREE.PointLight(0xff9a50, 0, 5, 2); l.position.set(x, 2.2, z); scene.add(l); realLights.push(l); }
    }
  };
  const lightLevels = () => {
    for (const l of realLights) {
      const inside = !(l instanceof THREE.PointLight && l.color.getHex() === 0xff9a50);
      const k = inside ? (open ? 1 : 0) : open ? night : 0;
      if (l instanceof THREE.SpotLight) l.intensity = 9 * k; else if (l instanceof THREE.RectAreaLight) l.intensity = 2.2 * k; else if (l instanceof THREE.PointLight) l.intensity = (inside ? 4 : 6) * k;
    }
  };
  let farMode = PRESET[quality].far;
  // the walls the overhead view can cut, with their midpoints and outward normals in local metres, worked out once:
  // setOverheadCut runs every frame in the overhead view and allocates nothing
  const cutWalls = Object.entries(venue.walls).map(([id, w]) => { const [x, z] = L(w.mid[0], w.mid[1]), [nx, nz] = F.dirToLocal(w.out[0], w.out[1]); return { id, w, x, z, nx, nz }; });
  const cutState: Record<string, boolean> = {};
  const setOverheadCut = () => {
    for (let i = 0; i < cutWalls.length; i++) {
      const cw = cutWalls[i], c = view === 'overhead' && overhead.facing(cw.x, cw.z, cw.nx, cw.nz);
      cutState[cw.id] = c;
      for (let k = 0; k < cw.w.full.length; k++) cw.w.full[k].visible = !c;
      for (let k = 0; k < cw.w.cut.length; k++) cw.w.cut[k].visible = c;
    }
    for (let k = 0; k < roofs.length; k++) roofs[k].visible = view !== 'overhead';
    return cutState;
  };
  let cutNow: Record<string, boolean> = {};
  const applyQuality = (qq: Quality, rebuildPeople: boolean) => {
    const P = PRESET[qq];
    quality = qq;
    env.setQuality(P.shadows, 2600);
    renderer.shadowMap.enabled = P.shadows > 0;
    // release the old post chain: EffectComposer.dispose() frees only its two targets and its copy pass, so each pass
    // (the render pass, GTAO's targets and materials, bloom's mip chain, the output pass) is disposed first
    if (composer) { for (const ps of composer.passes) ps.dispose(); composer.dispose(); }
    composer = null; bloom = null; gtao = null;
    const pr = clamp((devicePixelRatio || 1) * P.scale, P.minPR, P.maxPR);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    if (P.post) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: P.msaa });
      const c = new EffectComposer(renderer, rt);
      c.addPass(new RenderPass(scene, camera));
      if (P.ao) {
        gtao = new GTAOPass(scene, camera, size.x, size.y); gtao.blendIntensity = 0.8; c.addPass(gtao);
        // the AO's own normal and depth pass draws every visible mesh opaque with a normal material: the overlays
        // that write no depth (the lot's light pools, glass, blob shadows, the wordmark) would read as solid
        // surfaces there, and a mesh with no normals (the pools, the game's mountain ring) reads as a surface
        // facing nowhere: the lot under the pools went near black at Ultra, and the mountains dark slate (S1).
        // Those sit out that pass; the AO then shades what is behind them, as the eye sees it.
        const g = gtao, base = g.overrideVisibility.bind(g);
        g.overrideVisibility = () => {
          base();
          scene.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || !m.visible) return; const mt = m.material; if (!m.geometry.attributes.normal || (!Array.isArray(mt) && !mt.depthWrite)) m.visible = false; });
        };
      }
      if (P.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.88); tuneBloom(); c.addPass(bloom); }
      c.addPass(new OutputPass());
      c.setPixelRatio(pr); c.setSize(innerWidth, innerHeight);
      composer = c;
    }
    makeLights(qq); lightLevels();
    if (rebuildPeople) {
      buildAvatar(qq); player.person = person;
      // the trees' instanced meshes go (their instance buffers); their geometries and materials are the game's cached
      // Props ones, kept for the next switch
      scene.remove(treeGroup); for (const c of treeGroup.children) (c as THREE.InstancedMesh).dispose(); treeGroup = plantTrees(def.trees, qq); scene.add(treeGroup);
      scene.remove(mine.group); disposeCar(mine.group);
      mine = yourCar(site.yourStall, carId, embed?.paint, P.people); mine.group.userData.group = 'your-car'; scene.add(mine.group);
    }
    // the far set: simple at Low and HD, full at Ultra (switching rebuilds the far batches)
    if (P.far !== farMode) { const f = streets.rebuildFar(P.far); f.group.userData.group = 'far streets'; scene.add(f.group); farMode = P.far; }
    if (parked.quality !== carQuality(qq)) {
      // the same cars in the same stalls (same seed), built from the other set of models
      scene.remove(parked.group); disposeParked(parked);
      parked = new ParkedCars(def.parking.stalls, carQuality(qq), 0, false); parked.group.userData.group = 'parked'; scene.add(parked.group);
      parked.fill(...parkedFill); refreshDynamic();
    }
    avDirty = true;
    hud.setQuality(qq);
    vis.update(camera, view, qq, nearPoint(), true);
    vis.applyCasting(qq);
    renderer.compile(scene, camera);
  };
  /** the point the parked cars' near set is taken round: the overhead's target, or the camera (one object, reused) */
  const _near = { x: 0, z: 0 };
  const nearPoint = () => { if (view === 'overhead') { _near.x = overhead.target.x; _near.z = overhead.target.z; } else { _near.x = camera.position.x; _near.z = camera.position.z; } return _near; };
  const onResize = () => {
    const P = PRESET[quality], pr = clamp((devicePixelRatio || 1) * P.scale, P.minPR, P.maxPR);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    composer?.setPixelRatio(pr); composer?.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  };
  addEventListener('resize', onResize);
  env.setFlareOccluders([], [], (o, d) => {
    const flat = Math.hypot(d.x, d.z); if (flat < 1e-3) return false;
    const Lr = 80, bx = o.x + (d.x / flat) * Lr, bz = o.z + (d.z / flat) * Lr;
    const t = set.ray(o.x, o.z, bx, bz, isTall);
    return t < 1 && o.y + (d.y / flat) * t * Lr < 5.4;
  });

  // ------------------------------------------------------------------------------------------ input, HUD, actions
  const bin = track(() => new BarInput(canvas, { stick: hud.stick, knob: hud.knob, car: hud.car }));
  const input = bin.input;
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 12).rotateX(-Math.PI / 2), mats.dots, 200);
  dots.count = 0; dots.renderOrder = 6; dots.name = 'path-dots'; dots.frustumCulled = false; scene.add(dots);
  const showPath = (p: P2[] | null) => {
    dots.count = 0; if (!p) return;
    const m4 = new THREE.Matrix4();
    for (let i = 1; i < p.length && dots.count < 200; i++) {
      const [ax, az] = p[i - 1], [bx, bz] = p[i], len = Math.hypot(bx - ax, bz - az);
      for (let t = i === 1 ? 0.8 : 0; t < len && dots.count < 200; t += 0.8) { const x = ax + ((bx - ax) * t) / len, z = az + ((bz - az) * t) / len; m4.makeTranslation(x, grid.height(x, z) + 0.06, z); dots.setMatrixAt(dots.count++, m4); }
    }
    dots.instanceMatrix.needsUpdate = true;
  };
  const nearSeat = () => {
    let best: Seat | null = null, bd = 1.4;
    for (const s of venue.seats) { if (player.seat === s) continue; const d = Math.min(Math.hypot(s.ax - player.x, s.az - player.z), Math.hypot(s.x - player.x, s.z - player.z) + 0.2); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  const nearCar = () => Math.hypot(lot.door.x - player.x, lot.door.z - player.z) < 2.6;
  const avail: [string | null, string | null] = [null, null];
  const available = (): [string | null, string | null] => { avail[0] = player.seat ? 'Stand' : nearCar() ? 'Drive' : nearSeat() ? 'Sit' : null; avail[1] = null; return avail; };
  const doAction = (which: 1 | 2): string | null => {
    const [a] = available();
    if (which !== 1 || !a) return null;
    if (a === 'Stand') { player.stand(); return 'stand'; }
    if (a === 'Sit') { const s = nearSeat(); if (s) { player.sit(s); hud.fadeHint(); return 'sit'; } return null; }
    if (a === 'Drive' && embed?.onDrive) { embed.onDrive(); return 'drive'; }
    if (a === 'Drive') { hud.toast(`${BAR_NAME} is on its own page for now. Driving out comes when it joins the game.`, 4.5); return 'drive'; }
    return null;
  };
  const walkToCar = (skip: boolean) => {
    if (skip) { player.place(lot.door.x, lot.door.z); player.yaw = site.yourStall.face + Math.PI; showPath(null); return true; }
    const p = player.goTo(lot.door.x, lot.door.z); showPath(p);
    if (!p) hud.toast('No way through to your car from here.');
    return !!p;
  };
  let preparingUltra = false;
  const setView = (v?: BarView | string) => {
    const nv: BarView = (['first', 'third', 'overhead'].includes(String(v)) ? v : nextView(view)) as BarView;
    if (nv === 'overhead' && view !== 'overhead') { const t = new THREE.Vector3(player.x, 0.5, player.z); overhead.moveTo({ target: t }); }
    view = nv; if (nv !== 'overhead') player.view = nv;
    bin.setOverhead(nv === 'overhead');
    barHud.setView(nv); avDirty = true;
    cutNow = setOverheadCut();
    return view;
  };
  barHud.setView(view); bin.setOverhead(view === 'overhead'); hud.setMotion(reduced);
  barHud.setUltra(ultraUnlocked);
  hud.onAct = (w) => { doAction(w); canvas.focus(); };
  hud.onView = (v) => setView(v);
  const switchQuality = (qq: Quality) => {
    if (qq === quality) return;
    const rebuild = PRESET[qq].people !== PRESET[quality].people;
    if (qq === 'ultra' && (rebuild || !lod0Ready)) {
      // your avatar's close-up is built behind a still, labelled sheet that the player asked for, never mid-walk
      preparingUltra = true; barHud.busy('Preparing Ultra…');
      requestAnimationFrame(() => requestAnimationFrame(() => { applyQuality(qq, rebuild); buildLod0(); barHud.busy(null); preparingUltra = false; }));
      return;
    }
    applyQuality(qq, rebuild);
  };
  hud.onQuality = (qq) => { if (qq === 'ultra' && !ultraUnlocked) { hud.toast('Ultra is locked on this device.', 3); return; } switchQuality(qq); };
  hud.onClock = (c) => { live = c.live; if (!c.live) clock = { day: c.day, hour: c.hour }; applyClock(); };
  hud.onMotion = (rm) => { reduced = rm; player.reducedMotion = rm; overhead.reducedMotion = rm; hud.setMotion(rm); };
  hud.onPause = (on) => { input.enabled = !on && view !== 'overhead'; };
  const ray = new THREE.Raycaster();
  const tapMeshes = () => [...worldMeshes, ...streets.near.meshes].filter((m) => m.visible && (m as THREE.Mesh).isMesh && !((m as THREE.Mesh).material as THREE.Material).transparent && !/plants|signs|neon|screens|lamps|exit|wordmark|blade/.test(m.name));
  const tapScreen = (sx: number, sy: number) => {
    const ndc = new THREE.Vector2((sx / canvas.clientWidth) * 2 - 1, -(sy / canvas.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let seat: Seat | null = null, sd = 0.45;
    const o = ray.ray.origin, d = ray.ray.direction, v = new THREE.Vector3();
    for (const s of venue.seats) {
      v.set(s.x - o.x, s.y + 0.15 - o.y, s.z - o.z); const t = v.dot(d); if (t < 0.3 || t > 60) continue;
      const dist = v.addScaledVector(d, -t).length(); if (dist < sd * (1 + t * 0.02)) { sd = dist; seat = s; }
    }
    if (seat) return tapGo(seat.ax, seat.az, seat);
    const hits = ray.intersectObjects(tapMeshes(), false);
    let gx: number, gz: number;
    const h = hits.find((x) => !(view === 'overhead' && x.point.y > 1.0 && x.face && x.face.normal.y > 0.6)) ?? hits[0];
    if (h && h.face && h.face.normal.y < 0.6) { const back = h.point.clone().addScaledVector(d, -0.5); gx = back.x; gz = back.z; }
    else if (h) { gx = h.point.x; gz = h.point.z; }
    else { if (d.y >= -1e-3) return null; const t = (0.0 - o.y) / d.y; gx = o.x + d.x * t; gz = o.z + d.z * t; }
    lastTapHit = h ? { name: h.object.name, x: h.point.x, y: h.point.y, z: h.point.z } : null;
    return tapGo(gx, gz, null, h ? h.point : undefined, o);
  };
  let lastTapHit: { name: string; x: number; y: number; z: number } | null = null;
  /** the last tap's snap to a free cell inside (for tapLook): from the tapped point to the cell, metres */
  let lastSnap: { from: P2; to: P2 | null; d: number } | null = null;
  /** the nearest free cell inside the unit to (x, z), within maxR metres, and (given a viewer at eye) on the viewer's
   *  side of the point; null if there's none */
  const nearestFreeIndoor = (x: number, z: number, maxR: number, eye?: { x: number; z: number }): P2 | null => {
    const R = Math.ceil(maxR / 0.5) + 1, ci = grid.ix(x), cj = grid.iz(z);
    let best: P2 | null = null, bd = maxR * maxR;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= grid.nx || j >= grid.nz || !grid.free[j * grid.nx + i]) continue;
      const cx = grid.cx(i), cz = grid.cz(j), dd = (cx - x) ** 2 + (cz - z) ** 2;
      if (dd > bd) continue;
      if (eye && (cx - x) * (eye.x - x) + (cz - z) * (eye.z - z) < 0) continue;
      const [u, v] = F.toFrame(cx, cz);
      if (!def.indoor(u, v)) continue;
      bd = dd; best = [cx, cz];
    }
    return best;
  };
  const indoorAt = (x: number, z: number) => { const f = F.toFrame(x, z); return def.indoor(f[0], f[1]); };
  /** walk to a tapped point. A point inside the unit that isn't free floor (the back bar, the counter, the lane), or a
   *  tap whose ray met something inside the unit, goes to the nearest free cell that is also inside, within 4 m of the
   *  tapped point (for a tap on the screen, one on your side of the point if there is one); with none, the tap is
   *  refused with Lot 57's toast. (On the screen, a tap on an upright face is already the point 0.5 m back toward you
   *  along the ray, as Lot 57's tap is.) 4 m, not the review's 3 m: the tapped points on the back bar and the screens
   *  over it lie 3.09 to 3.25 m from the nearest free cell on the customer side (the 2.5 m-deep bar and the stools'
   *  clearance), and 3 m refused three of the review's own seven taps (measured,
   *  tests/out/sportsbar/logs/s1-r2-tap-3m-probe.log).
   *  Lot 57's path() alone snaps to the nearest free cell of any kind, which from the back bar is the courtyard beyond
   *  the north wall (S1's tap on the bottle wall walked you out of the front door and round the building) */
  const TAP_SNAP_M = 4;
  const tapGo = (x: number, z: number, seat: Seat | null, hit?: { x: number; z: number }, eye?: { x: number; z: number }) => {
    let tx = x, tz = z;
    if (!seat) {
      const inT = indoorAt(x, z), inH = hit ? indoorAt(hit.x, hit.z) : false;
      if ((inT || inH) && !(inT && grid.isFree(x, z))) {
        const ox = inT ? x : hit!.x, oz = inT ? z : hit!.z;
        const c = (eye ? nearestFreeIndoor(ox, oz, TAP_SNAP_M, eye) : null) ?? nearestFreeIndoor(ox, oz, TAP_SNAP_M);
        lastSnap = c ? { from: [ox, oz], to: c, d: Math.hypot(c[0] - ox, c[1] - oz) } : { from: [ox, oz], to: null, d: -1 };
        if (!c) { showPath(null); hud.toast("Can't get there from here.", 2); hud.fadeHint(); return null; }
        tx = c[0]; tz = c[1];
      } else lastSnap = null;
    }
    const p = player.goTo(tx, tz, seat ? { seat } : null);
    showPath(p); if (!p) hud.toast("Can't get there from here.", 2);
    hud.fadeHint(); return p;
  };

  // ------------------------------------------------------------------------------------------ the loop
  let frames = 0, simMs = 0, frameMs = 0, lastT = performance.now(), acc = 0, edgeT = 0, hintT = 6, simTime = 0;
  const frameStats = { calls: 0, tris: 0 };
  const firstVisit = (() => { try { return !localStorage.getItem('sportsbar.seen'); } catch { return true; } })();
  if ((!firstVisit && !q.has('hint')) || q.get('hint') === '0') hud.hint(false);
  if (!coarse) { const el = document.getElementById('hint'); if (el) el.textContent = 'W A S D to walk · drag to look · click to go · E to act · V or O for the view'; }
  try { localStorage.setItem('sportsbar.seen', '1'); } catch { /* a convenience */ }
  const _follow = new THREE.Vector3();
  const shownAct: [string | null, string | null] = [null, null];
  hud.setActions(null, null);
  let fixedCam: { p: THREE.Vector3; t: THREE.Vector3 } | null = null;
  let frozen = false;
  const simStep = (stick: { x: number; y: number; run: boolean }) => { player.step(stick); };
  /** your avatar's level of detail and caster, only when the view, the preset or the build changes */
  const applyAvatar = (hideThird: boolean) => {
    const p = person; if (!p) return;
    const third = view !== 'first' && !(view === 'third' && hideThird), ultra = quality === 'ultra', low = quality === 'low';
    const close = view === 'third' && third && ultra && lod0Ready;
    p.setLod(close ? 0 : 1);
    const lod1 = p.group.getObjectByName('lod1') as THREE.Mesh | undefined;
    p.group.visible = true;
    p.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.layers.set(0); } });
    if (!lod1) return;
    if (low) { setHiddenCaster(lod1, false); if (!third) p.group.visible = false; return; }
    // HD and Ultra: your avatar casts with its LOD 1 body in every state, shown or as a hidden caster
    lod1.parent!.visible = true;
    setHiddenCaster(lod1, !third || close);
    lod1.castShadow = true; lod1.userData.maps = 1; lod1.onBeforeShadow = vis.before; lod1.onAfterShadow = vis.after;
  };
  const updateAvatar = (dt: number, hide: boolean) => {
    const p = person!; if (!p) return;
    p.group.position.set(player.x, player.seat ? Math.max(-0.1, player.seat.y - 0.47) : player.y, player.z);
    p.group.rotation.y = player.heading;
    const sp = player.speed;
    p.play(player.seat ? 'sit' : sp > 0.15 ? 'walk' : 'idle');
    const k = sp > 0.15 && !player.seat ? clamp(sp / 1.25, 0.6, 2.2) : 1;
    p.update(dt * k);
    if (avDirty || avLast.view !== view || avLast.lod0 !== lod0Ready || avLast.quality !== quality || avLast.hide !== hide) {
      avDirty = false; avLast.view = view; avLast.lod0 = lod0Ready; avLast.quality = quality; avLast.hide = hide;
      applyAvatar(hide);
    }
  };
  // the doors' centres in local metres, worked out once (updateDoors runs every frame)
  const doorAt = venue.doors.map((d) => L(d.centre[0], d.centre[1]));
  const updateDoors = (dt: number) => {
    let moved = false;
    for (let i = 0; i < venue.doors.length; i++) {
      const d = venue.doors[i], c = doorAt[i], want = open && Math.hypot(player.x - c[0], player.z - c[1]) < 2.6 ? 1 : 0;
      if (d.open !== want) { d.open = reduced ? want : clamp(d.open + Math.sign(want - d.open) * dt * 2.2, 0, 1); moved = true; }
    }
    if (moved || view === 'overhead') venue.poseDoors(cutNow);
  };
  const render = () => {
    renderer.info.reset();
    // the shadow maps once a frame: the frame's first render draws them and clears the flag
    renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
    if (composer) composer.render(); else renderer.render(scene, camera);
    frameStats.calls = renderer.info.render.calls; frameStats.tris = renderer.info.render.triangles;
    env.renderFlare();
  };
  const placeCamera = (dt: number) => {
    const fov = innerHeight > innerWidth ? 78 : 62;
    if (Math.abs(camera.fov - fov) > 0.01) camera.fov = fov;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    let hide = view === 'first';
    if (fixedCam) { camera.position.copy(fixedCam.p); camera.lookAt(fixedCam.t); hide = false; }
    else if (view === 'overhead') { overhead.update(camera, dt); hide = false; }
    else { const c = player.camera(camera); hide = c.hide; }
    return hide;
  };
  const frame = (now: number) => {
    if (embed?.dead) return;
    requestAnimationFrame(frame);
    if (frozen) { lastT = now; return; }
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const tf = performance.now();
    const look = input.poll(dt); bin.pollPad();
    for (let i = 0; i < input.actions.length; i++) handleAction(input.actions[i]);
    input.actions.length = 0;
    for (let i = 0; i < bin.extra.length; i++) handleAction(bin.extra[i]);
    bin.extra.length = 0;
    for (let i = 0; i < input.taps.length; i++) if (!hud.paused) tapScreen(input.taps[i].x, input.taps[i].y);
    input.taps.length = 0;
    const g = bin.takeOver();
    if (view === 'overhead' && !hud.paused) {
      if (g.panX || g.panY) overhead.pan(g.panX, g.panY, canvas.clientHeight);
      if (g.zoom !== 1) overhead.zoom(g.zoom);
      if (g.twist) overhead.rotate(g.twist);
      for (let i = 0; i < g.taps.length; i++) tapScreen(g.taps[i].x, g.taps[i].y);
    }
    if (!hud.paused && !preparingUltra) {
      player.look(look.dyaw, look.dpitch);
      const ts = performance.now();
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6) { simStep(input.stick); acc -= STEP; n++; }
      if (n === 6) acc = 0;
      simMs = performance.now() - ts;
      simTime += dt;
      if (Math.hypot(input.stick.x, input.stick.y) > 0.2 || Math.abs(look.dyaw) > 0.02) { if (hintT > 0 && hud.hintVisible) { hintT = 0; hud.fadeHint(); } }
      if (!player.path) dots.count = 0;
      edgeT -= dt;
      if (player.lastBlock === 'edge' && edgeT <= 0) { hud.toast("That's the edge of the hangout area for now"); edgeT = 4; }
      if (player.gaveUp) { hud.toast(`${THING[player.gaveUp.by] ?? 'Something'} is in the way. Stopped here.`, 3.5); player.gaveUp = null; showPath(null); }
    }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0 && hud.hintVisible) hud.fadeHint(); }
    if (live) { liveT -= dt; if (liveT <= 0) { liveT = 60; applyClock(); } }
    // the blade sign cycles +1 to +5 slowly while open
    bladeT += dt; if (open && bladeT > 4) { bladeT = 0; bladeN = (bladeN % 5) + 1; mats.bladeSign.draw(bladeN, null); }
    updateDoors(dt);
    const hide = placeCamera(dt);
    updateAvatar(dt, hide);
    // what's drawn: the state from the camera (the rule runs once a frame, after the camera moves)
    const np = nearPoint();
    if (vis.update(camera, view, quality, np)) avDirty = true;
    parked.update(np.x, np.z);
    if (view === 'overhead') cutNow = setOverheadCut();
    env.update(dt, live ? new Date() : simDate);
    env.follow(_follow.set(view === 'overhead' ? overhead.target.x : player.x, player.y, view === 'overhead' ? overhead.target.z : player.z), camera, now / 1000, dt);
    streams.update(simTime, camera, night > 0.25, streamCars(quality));
    const av = available();
    if (av[0] !== shownAct[0] || av[1] !== shownAct[1]) { shownAct[0] = av[0]; shownAct[1] = av[1]; hud.setActions(av[0], av[1]); }
    hud.tick(dt);
    render();
    frameMs = performance.now() - tf;
    frames++;
  };
  const handleAction = (a: BarAction) => {
    if (a === 'pause') { hud.pause(!hud.paused); return; }
    if (hud.paused) return;
    if (view === 'overhead' && (a === 'act' || a === 'act2')) { overhead.step(a === 'act' ? 1 : -1); return; }
    if (a === 'act') doAction(1); else if (a === 'act2') doAction(2);
    else if (a === 'view') setView();
    else if (a === 'overhead') setView('overhead');
    else if (a === 'car') walkToCar(false); else if (a === 'carSkip') walkToCar(true);
    else if (a === 'stand') { if (player.seat) player.stand(); }
  };
  applyQuality(quality, false);

  // ------------------------------------------------------------------------------------------ measuring (the budgets)
  /** the scene drawn once from the camera: one plain render between info resets, the maps not updating, no composer */
  const measurePass = () => {
    renderer.shadowMap.needsUpdate = false;
    renderer.info.reset(); renderer.render(scene, camera);
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  /** each shadow map: one render with only that light's map updating, less the pass */
  const measureMaps = (pass: { calls: number; tris: number }) => {
    const lights: [string, THREE.Light][] = [];
    if (renderer.shadowMap.enabled && env.sun.castShadow) lights.push(['sun', env.sun]);
    poolSpots.forEach((l, i) => { if (l && l.castShadow) lights.push([`pool-${i + 1}`, l]); });
    const auto = new Map(lights.map(([, l]) => [l, l.shadow!.autoUpdate]));
    const out: Record<string, { calls: number; tris: number; frozen?: boolean }> = {};
    for (const [name, l] of lights) {
      for (const [, o] of lights) o.shadow!.autoUpdate = o === l;
      renderer.shadowMap.needsUpdate = true;
      renderer.info.reset(); renderer.render(scene, camera);
      out[name] = { calls: renderer.info.render.calls - pass.calls, tris: renderer.info.render.triangles - pass.tris, frozen: auto.get(l) === false };
    }
    for (const [, l] of lights) l.shadow!.autoUpdate = auto.get(l)!;
    renderer.shadowMap.needsUpdate = false;
    return out;
  };
  /** GTAO's own normal pass (Ultra), as it draws it: its visibility rule and its normal material, maps not updating */
  const measureAo = () => {
    if (!gtao) return null;
    const g = gtao as unknown as { overrideVisibility(): void; restoreVisibility(): void; normalMaterial: THREE.Material };
    renderer.shadowMap.needsUpdate = false;
    const prev = scene.overrideMaterial; g.overrideVisibility(); scene.overrideMaterial = g.normalMaterial;
    renderer.info.reset(); renderer.render(scene, camera);
    scene.overrideMaterial = prev; g.restoreVisibility();
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  /** what's drawn, by mesh, counted as the renderer counts it: hidden objects skipped, three.js's frustum test where
   *  the object has one, instanced meshes by their instances, a hidden caster as 1 call and 0 triangles */
  const breakdown = () => {
    camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    const rows: { name: string; group: string; calls: number; tris: number; n: number }[] = [];
    const walk = (o: THREE.Object3D, grp: string) => {
      if (!o.visible) return;
      const g2 = (o.userData.group as string | undefined) ?? grp;
      const m = o as THREE.Mesh;
      if ((m.isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints) && o.layers.test(camera.layers)) {
        const geo = m.geometry, mat = m.material as THREE.Material;
        const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
        const ok = mat && (Array.isArray(mat) ? true : mat.visible) && inst > 0 && (!o.frustumCulled || frustum.intersectsObject(o));
        if (ok) {
          const name = o.name || o.parent?.name || o.type;
          const group = name.startsWith('parked-') ? name : g2;
          if (m.userData.hiddenCaster) rows.push({ name, group, calls: 1, tris: 0, n: 1 });
          else if (m.isMesh) {
            const c = (geo.index ? geo.index.count : geo.attributes.position.count), cnt = Math.min(c, geo.drawRange.count);
            // a double-sided transparent material is drawn in two passes (back faces, then front) unless forceSinglePass
            const mm = m.material as THREE.Material, twice = !Array.isArray(m.material) && mm.transparent && mm.side === THREE.DoubleSide && !mm.forceSinglePass ? 2 : 1;
            rows.push({ name, group, calls: (Array.isArray(m.material) ? geo.groups.length : 1) * twice, tris: Math.round((cnt / 3) * inst) * twice, n: inst });
          }
          else rows.push({ name, group, calls: 1, tris: 0, n: inst });
        }
      }
      for (const c of o.children) walk(c, g2);
    };
    walk(scene, 'other');
    const groups: Record<string, { calls: number; tris: number }> = {};
    for (const r of rows) { const k = r.group.startsWith('parked-') ? 'parked-' + r.group.split('-')[1] : r.group; groups[k] ??= { calls: 0, tris: 0 }; groups[k].calls += r.calls; groups[k].tris += r.tris; }
    const total = rows.reduce((a, r) => ({ calls: a.calls + r.calls, tris: a.tris + r.tris }), { calls: 0, tris: 0 });
    return { total, groups, rows: rows.sort((a, b) => b.tris - a.tris) };
  };
  const visReport = () => {
    const drawn = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const sets = [streets.near.group, streets.far.group].map((g) => g.children.filter(drawn).map((m) => ({ name: m.name, instances: (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1 })));
    const trees = treeGroup.children.filter(drawn).map((m) => ({ name: m.name, instances: (m as THREE.InstancedMesh).count }));
    const parkedDetailed = parked.group.children.filter((m) => !m.name.endsWith('-far') && (m as THREE.InstancedMesh).count > 0 && m.name.endsWith('-paint')).reduce((a, m) => a + (m as THREE.InstancedMesh).count, 0);
    const parkedStandins = parked.group.children.filter((m) => m.name.endsWith('-far')).reduce((a, m) => a + (m as THREE.InstancedMesh).count, 0);
    const lod1 = person?.group.getObjectByName('lod1') as THREE.Mesh | undefined;
    return {
      state: vis.state, view, quality,
      parked: { near: parked.near, count: parked.count, detailed: parkedDetailed, standins: parkedStandins },
      yourCar: vis.yours, streets: { near: sets[0], far: sets[1] }, trees,
      casters: renderer.shadowMap.enabled ? vis.members([world, streets.near.group, streets.far.group, treeGroup, parked.group, mine.group, standin, ...(person ? [person.group] : [])]) : null,
      avatar: person ? { lod: person.stats().lod, caster: lod1 ? { name: lod1.name, hidden: !!lod1.userData.hiddenCaster, castShadow: lod1.castShadow, visible: drawn(lod1) } : null, lod0CastShadow: (() => { let c = false; const g0 = person!.group.children.find((g) => g.getObjectByName('hair-cap') || g.getObjectByName('lod0')); g0?.traverse((m) => { if ((m as THREE.Mesh).isMesh && m.castShadow) c = true; }); return c; })() } : null,
      poolSpots: poolSpots.map((l) => (l ? { castShadow: l.castShadow, updating: l.shadow.autoUpdate, drawn: l.shadow.map !== null } : null)),
      poolTris: venue.pool.map((p) => [p.table, p.light].reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0)),
      walls: Object.fromEntries(Object.entries(venue.walls).map(([id, w]) => [id, w.full.some((o) => o.visible) ? 'full' : 'cut'])), roof: roofs.every((r) => r.visible),
    };
  };

  // ------------------------------------------------------------------------------------------ test hooks
  const lookAtPoint = (tx: number, ty: number, tz: number) => {
    const e = player.eyePos(new THREE.Vector3());
    player.yaw = Math.atan2(tx - player.x, tz - player.z); player.heading = player.yaw;
    player.pitch = Math.atan2(ty - e.y, Math.hypot(tx - player.x, tz - player.z));
  };
  const POSES: Record<string, () => void> = {
    door: () => { setView('first'); const p = L(5.0, 8.2); player.place(p[0], p[1]); const t = L(35.8, 4.75); lookAtPoint(t[0], 2.2, t[1]); },
    'tv-east': () => { setView('third'); const p = L(33.5, 4.75); player.place(p[0], p[1]); const t = L(3.6, 8.2); lookAtPoint(t[0], 1.5, t[1]); },
    stall: () => { setView('third'); player.place(lot.spawn.x, lot.spawn.z); const t = L(6.4, 16.5); lookAtPoint(t[0], 1.5, t[1]); },
    patio: () => { setView('third'); const p = L(3.0, -2.75); player.place(p[0], p[1]); const t = L(20.0, -2.75); lookAtPoint(t[0], 1.0, t[1]); },
    // the target the unit's centre, 35 m away at 55 degrees, facing +v (setView's own move to your position is replaced)
    overhead: () => { const c = L(18, 8); setView('overhead'); overhead.moveTo({ target: new THREE.Vector3(c[0], 0, c[1]), yaw: F.yawFromFrame(0, 1), pitch: (55 * Math.PI) / 180, dist: 35 }); overhead.snap(); },
  };
  const simulate = (n: number, stick: { x: number; y: number; run: boolean }, untilStop = false) => {
    const path: number[] = [], blocks: Record<string, number> = {};
    player.lastGaveUp = null;
    for (let i = 0; i < n; i++) {
      if (untilStop && !player.path) break;
      simStep(stick);
      const g = F.toGame(player.x, player.z);
      path.push(+g[0].toFixed(4), +g[1].toFixed(4));
      if (player.lastBlock) blocks[player.lastBlock] = (blocks[player.lastBlock] ?? 0) + 1;
    }
    return { path, blocks, end: hooks.pos() };
  };
  const shiftCollider = (c: Record<string, unknown>) => {
    const [ox, oz] = F.origin, out: Record<string, unknown> = { ...c };
    if (c.k === 'circ') { out.x = (c.x as number) + ox; out.z = (c.z as number) + oz; }
    else if (c.k === 'seg') { out.ax = (c.ax as number) + ox; out.az = (c.az as number) + oz; out.bx = (c.bx as number) + ox; out.bz = (c.bz as number) + oz; }
    else out.pts = (c.pts as number[]).map((v, i) => v + (i % 2 ? oz : ox));
    return out;
  };
  const frameRing = (r: P2[]) => r.map(([x, z]) => F.toFrame(x, z).map((v) => +v.toFixed(3)));
  const gate = venue.colliders.find((c) => c.tag === 'gate')!;
  const hooks = {
    ready: false, frames: 0, buildMs: 0,
    attribution: (slice as { attribution: string }).attribution,
    setClock(day: number | string, hour: number) { live = false; clock = { day: C.parseDay(day), hour: clamp(hour, 0, 23.99) }; applyClock(); return hooks.clock(); },
    liveClock() { live = true; applyClock(); return hooks.clock(); },
    clock() { return { day: clock.day, hour: clock.hour, label: C.fmtClock(clock), open, level, share: +share.toFixed(3), night: +night.toFixed(3), business: Sch.businessDay(S, clock.day, clock.hour) }; },
    setQuality(qq: Quality) { if (!PRESET[qq]) throw new Error('quality: low, high or ultra'); if (qq === 'ultra') { ultraUnlocked = true; barHud.setUltra(true); } const rebuild = PRESET[qq].people !== PRESET[quality].people; applyQuality(qq, rebuild); if (qq === 'ultra') buildLod0(); avDirty = true; return quality; },
    stats() {
      const pass = measurePass(), maps = measureMaps(pass), ao = measureAo();
      // the frame's own count again (the measuring renders above don't touch the last frame's figures)
      return {
        npcs: 0, groups: 0, seated: 0, walkers: 0,
        pass, frame: { ...frameStats }, maps, ao,
        drawCalls: frameStats.calls, calls: frameStats.calls, triangles: frameStats.tris, simMs: +simMs.toFixed(3), frameMs: +frameMs.toFixed(1),
        quality, view, state: vis.state, frames, open, crowd: level, share: +share.toFixed(3),
        parkedCars: parked.count, seats: venue.seats.length, colliders: set.all.filter((o) => o.on).length,
        textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length ?? 0,
        avatar: person ? { lod: person.stats().lod, tris: person.stats().tris, calls: person.stats().calls, buildMs: person.stats().buildMs } : null,
        pixelRatio: renderer.getPixelRatio(), rescues: player.rescues, gtao: !!gtao,
      };
    },
    go(x: number, z: number) { const [lx, lz] = toL(x, z); player.seat = null; showPath(null); const ok = player.place(lx, lz); return ok ? G(player.x, player.z) : null; },
    tap(x: number, z: number) { const [lx, lz] = toL(x, z); const p = tapGo(lx, lz, null); return p ? { waypoints: p.map(([a, b]) => G(a, b)), length: +p.reduce((s, c, i) => (i ? s + Math.hypot(c[0] - p[i - 1][0], c[1] - p[i - 1][1]) : 0), 0).toFixed(2) } : null; },
    tapSeat(id: number) { const st = venue.seats[id]; if (!st) return null; const p = tapGo(st.ax, st.az, st); return p ? { waypoints: p.map(([a, b]) => G(a, b)), length: +p.reduce((sum, c, i) => (i ? sum + Math.hypot(c[0] - p[i - 1][0], c[1] - p[i - 1][1]) : 0), 0).toFixed(2) } : null; },
    tapScreen(x: number, y: number) { const p = tapScreen(x, y); return p ? { waypoints: p.length, goal: player.pathGoal?.seat ? `seat ${player.pathGoal.seat.id}` : 'ground' } : null; },
    /** look from where you stand at a point (game x, height, game z), place the camera as a frame would, and tap the
     *  screen's centre: what the tap's ray met and where it sends you */
    tapLook(x: number, y: number, z: number) {
      const [lx, lz] = toL(x, z); fixedCam = null; lookAtPoint(lx, y, lz); placeCamera(0); camera.updateMatrixWorld();
      lastTapHit = null; lastSnap = null;
      const p = tapScreen(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const hit = lastTapHit as { name: string; x: number; y: number; z: number } | null;
      const sn = lastSnap as { from: P2; to: P2 | null; d: number } | null;
      const snap = sn ? { from: F.toFrame(sn.from[0], sn.from[1]).map((v) => +v.toFixed(3)), to: sn.to ? F.toFrame(sn.to[0], sn.to[1]).map((v) => +v.toFixed(3)) : null, d: +sn.d.toFixed(3) } : null;
      const hf = hit ? F.toFrame(hit.x, hit.z) : null;
      const goal = p ? p[p.length - 1] : null, gf = goal ? F.toFrame(goal[0], goal[1]) : null;
      return { hit: hit && hf ? { name: hit.name, u: +hf[0].toFixed(3), v: +hf[1].toFixed(3), y: +hit.y.toFixed(3) } : null, path: p ? p.length : null, goal: gf ? { u: +gf[0].toFixed(3), v: +gf[1].toFixed(3), indoor: def.indoor(gf[0], gf[1]) } : null, snap, toast: hud.toastText };
    },
    /** every visible mesh a ray from a to b (game x, height, game z) meets, nearest first, up to the segment's end */
    rayHits(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
      const [lax, laz] = toL(ax, az), [lbx, lbz] = toL(bx, bz);
      const o = new THREE.Vector3(lax, ay, laz), d = new THREE.Vector3(lbx - lax, by - ay, lbz - laz), len = d.length(); d.normalize();
      const rc = new THREE.Raycaster(o, d, 0, len);
      const shown = (m: THREE.Object3D) => { for (let q2: THREE.Object3D | null = m; q2; q2 = q2.parent) if (!q2.visible) return false; return true; };
      return rc.intersectObjects(scene.children, true).filter((h) => (h.object as THREE.Mesh).isMesh && shown(h.object)).slice(0, 8).map((h) => ({ name: h.object.name, d: +h.distance.toFixed(3) }));
    },
    act() { const did = doAction(1); return { did, now: [...available()] }; },
    actions() { return [...available()]; },
    view(v?: BarView) { return setView(v); },
    look(yawDeg: number, pitchDeg: number) { player.yaw = (yawDeg * Math.PI) / 180; player.pitch = (pitchDeg * Math.PI) / 180; if (!player.seat) player.heading = player.yaw; return true; },
    walk(sx: number, sy: number, seconds: number, run = false) { return simulate(Math.round(seconds / STEP), { x: sx, y: sy, run }); },
    sim(seconds: number, untilStop = false) { return simulate(Math.round(seconds / STEP), { x: 0, y: 0, run: false }, untilStop); },
    pos() { const gu = player.lastGaveUp, [u, v] = F.toFrame(player.x, player.z); return { ...G(player.x, player.z), lx: +player.x.toFixed(3), lz: +player.z.toFixed(3), u: +u.toFixed(3), v: +v.toFixed(3), y: +player.y.toFixed(3), heading: +player.heading.toFixed(3), yaw: +player.yaw.toFixed(3), sitting: player.seat ? player.seat.id : null, view, moving: !!player.path, speed: +player.speed.toFixed(3), indoors: player.indoors, gaveUp: gu ? { by: gu.by, ...G(gu.x, gu.z), left: +gu.left.toFixed(2) } : null }; },
    colliders() { return exportColliders(set).map((c) => shiftCollider(c as Record<string, unknown>)); },
    region() { const r = grid.exportRegion(); return { ...r, x0: r.x0 + F.origin[0], z0: r.z0 + F.origin[1] }; },
    seats() { return venue.seats.map((s) => ({ id: s.id, kind: s.kind, at: s.at, y: s.y, ...G(s.x, s.z), approach: G(s.ax, s.az) })); },
    randomFree(n: number, seed = 1) {
      const r = rand(seed), out: { x: number; z: number }[] = [];
      for (let k = 0; out.length < n && k < n * 400; k++) {
        const x = lerp(grid.x0, grid.x0 + grid.nx * 0.5, r()), z = lerp(grid.z0, grid.z0 + grid.nz * 0.5, r());
        if (grid.isFree(x, z) && player.clearance(x, z) >= RADIUS + 0.02) out.push(G(x, z));
      }
      return out;
    },
    render() { render(); return { calls: frameStats.calls, triangles: frameStats.tris }; },
    freeze(on: boolean) { frozen = on; return frozen; },
    reducedMotion(on: boolean) { hud.onMotion(on); return { reduced, bobOff: player.reducedMotion, transitionsOff: document.body.classList.contains('rm') }; },
    bobRange() { const ys: number[] = []; const e = new THREE.Vector3(); for (let i = 0; i < 60; i++) { player.step({ x: 0, y: 0.75, run: false }); ys.push(player.eyePos(e).y - player.y); } return +(Math.max(...ys) - Math.min(...ys)).toFixed(4); },
    camera(p?: [number, number, number, number, number, number] | null) { if (p === null) { fixedCam = null; return null; } if (p) { const a = toL(p[0], p[2]), b = toL(p[3], p[5]); fixedCam = { p: new THREE.Vector3(a[0], p[1], a[1]), t: new THREE.Vector3(b[0], p[4], b[1]) }; } return { p: G(camera.position.x, camera.position.z), y: camera.position.y }; },
    toast() { return hud.toastText; },
    hint(on: boolean) { hud.hint(on); return hud.hintVisible; },
    hud() { const r = (id: string) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: b.x, y: b.y, w: b.width, h: b.height, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && b.width > 0, text: e.textContent }; }; return { credit: r('credit'), crowd: r('crowd'), place: r('place'), act: r('act'), car: r('car'), viewBtn: r('viewBtn') }; },
    yourCar() { return { stall: G(site.yourStall.x, site.yourStall.z), door: G(lot.door.x, lot.door.z), spawn: G(lot.spawn.x, lot.spawn.z), face: site.yourStall.face }; },
    breakdown() { return breakdown(); },
    // ---- the bar's own hooks
    frame() { return { O: site.frameCheck.computed.O, A: site.frameCheck.computed.A, B: site.frameCheck.computed.B, check: site.frameCheck }; },
    layout() {
      return {
        front: { walk: frameRing(venue.region.front), ramp: venue.layout.rampLow, planters: FRONT.planters, bikes: FRONT.bikes, frontWalk: venue.layout.frontRing },
        patio: { fence: [[2.0, 0.024], [2.0, -5.5], [24.0, -5.5], [24.0, 0.288]], inner: [[2.05, -5.45], [23.95, -5.45]], zones: PZONES },
        aisle416: { line: lot.aisle.map(([x, z]) => F.toFrame(x, z)), ribbon: frameRing(lot.aisleRibbon), width: FRONT.aisle.w },
        building: { host: frameRing(site.host.map(([x, z]) => toL(x, z))), unitOuter: site.unitOuter, unitInner: site.unitInner, rest: site.restRing },
        trees: TREES, lanePath: def.staffPath, handoff: HANDOFF, lane: (venue.layout as { lane: P2[][] }).lane, zones: ZONES, slots: venue.slots.map((s) => ({ id: s.id, zone: s.zone, group: s.group ?? null, kind: s.kind, at: s.at, r: s.r, stand: s.stand })),
        furniture: furniture(), lot: site.lot, stalls: def.parking.stalls.map((s) => ({ ...G(s.x, s.z), face: s.face, row: s.row, mine: s.mine })), fillBias: +site.fillBias.toFixed(4),
      };
    },
    pose(name: string) { const f = POSES[name]; if (!f) throw new Error('poses: ' + Object.keys(POSES).join(', ')); hooks.setClock('Sat', 21); fixedCam = null; f(); placeCamera(0); vis.update(camera, view, quality, nearPoint(), true); cutNow = setOverheadCut(); updateAvatar(0, view === 'first'); return { pose: name, state: vis.state, view, camera: { ...G(camera.position.x, camera.position.z), y: +camera.position.y.toFixed(2) } }; },
    vis() { return visReport(); },
    /** S1's check budget for the pass without people or items, at this preset and state */
    budget() { return { noPeople: NO_PEOPLE[quality][vis.state], budget: def.budgets[quality], alloc: ALLOC[quality] }; },
    /** the street sets as built, whatever the camera sees (every batch, the light streams at this preset's night count):
     *  calls and triangles of the near set, the far set and both, against this preset's allocation rows */
    streetBuilt() {
      const count = (g: THREE.Object3D) => {
        let calls = 0, tris = 0;
        g.traverse((o) => {
          const m = o as THREE.Mesh; if (!m.isMesh && !(o as THREE.Line).isLine) return;
          calls++; if (!m.isMesh) return;
          const geo = m.geometry, c = geo.index ? geo.index.count : geo.attributes.position.count;
          const inst = m === streams.head || m === streams.tail ? streamCars(quality) : (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
          tris += Math.round(c / 3) * inst;
        });
        return { calls, tris };
      };
      const near = count(streets.near.group), far = count(streets.far.group);
      return { quality, near, far, all: { calls: near.calls + far.calls, tris: near.tris + far.tris }, alloc: ALLOC[quality] };
    },
    // the street sets and the bridge rule, for S1's checks
    streetSets() {
      const near = streets.near, far = streets.far;
      const drawn = [...streets.drawnSegs.entries()].filter(([, d]) => d.near).map(([id, d]) => ({ id, w: d.w, area: Math.round(d.area), ys: d.ys }));
      return { counts: streets.counts(), nearIds: near.ids, farIds: far.ids, nearMeshes: near.meshes.map((m) => m.name), farMeshes: far.meshes.map((m) => m.name), farMode: far.mode, drawn, streams: { head: streams.head.count, tail: streams.tail.count, cars: streamCars(quality), perPath: [...streams.perPath], paths: streams.paths.map((p) => ({ length: Math.round(p.L), yMin: +Math.min(...p.ys).toFixed(2), yMax: +Math.max(...p.ys).toFixed(2) })) } };
    },
    bridges() {
      const ids = [222, 232, 358, 360, 361, 362, 365, 424, 425, 438, 560, 561, 562];
      const heights = Object.fromEntries(ids.map((id) => { const p = streets.net.pieces.get(id); return [id, p ? { L: Math.round(p.L), br: p.br, tn: p.tn, w: p.w, hMin: +Math.min(...[0, 0.25, 0.5, 0.75, 1].map((t) => streets.net.height(id, t * p.L))).toFixed(2), hMax: +Math.max(...[0, 0.25, 0.5, 0.75, 1].map((t) => streets.net.height(id, t * p.L))).toFixed(2), onSpan: p.br.length ? +streets.net.height(id, ((p.br[0][0] + p.br[0][1]) / 2) * p.L).toFixed(2) : null } : null]; }));
      // no built pier meets a drawn ribbon beneath it (lower by CLEAR or more)
      let meets = 0;
      for (const pr of streets.piers) for (const p of streets.net.pieces.values()) { if (p.id === pr.seg || p.w <= 0) continue; const j = projectOn(p.pts, p.cum, pr.x, pr.z); if (j.d < p.w / 2 + 0.9 && !streets.net.inTunnel(p, j.t) && streets.net.height(p.id, j.t) <= TOP - 5.5) meets++; }
      return { piers: streets.piers.length, piersNear: streets.piers.filter((p) => p.near).length, leftOut: streets.leftOut.length, leftOutNear: streets.leftOut.filter((p) => p.near).length, under: [...new Set(streets.leftOut.map((p) => p.under))].sort((a, b) => a - b), meets, connectors: streets.connectorSpread(), heights };
    },
    crossings() { return streets.crossings(); },
    trees() { return def.trees.map((t, i) => ({ kind: t.kind, ...G(t.x, t.z), frame: TREES[i].at })); },
    /** a stand-in body moved along the lane path end to end: its least clearance to any collider but the gate */
    laneWalk() { set.rebuild(); return laneTest(def.staffPath!, F, set, (c) => c === gate); },
    lanePoint(s: number) { const p = pathAt(def.staffPath!, s); const [x, z] = L(p.at[0], p.at[1]); return { ...G(x, z), frame: p.at, length: pathLength(def.staffPath!) }; },
    doors() { return venue.doors.map((d) => ({ id: d.id, open: +d.open.toFixed(2), locked: d.collider.on, ...G(...L(d.centre[0], d.centre[1])) })); },
    /** turn your avatar's caster's castShadow off (or back on) for the next renders, to measure its own share */
    avatarCaster(on: boolean) { const lod1 = person?.group.getObjectByName('lod1') as THREE.Mesh | undefined; if (lod1) lod1.castShadow = on; return !!lod1; },
    overheadState() { return { target: G(overhead.target.x, overhead.target.z), yaw: overhead.yaw, pitch: overhead.pitch, dist: overhead.dist }; },
    startAt() { return { door: G(...L(DOOR_START[0], DOOR_START[1])) }; },
    frozen() { return frozen; },
    /** S1's walk test on the real grid: from just inside the front door, every slot's stand point has a reachable
     *  free cell within `within` metres, H is reached, and no reachable cell lies in the lane or the flap; then again
     *  with the lane and the flap put back in the region, so that only the colliders close them */
    walkTest(within = 0.6) {
      const lanes = venue.region.cut, inLane = (x: number, z: number) => lanes.some((r) => pointInRing(x, z, r));
      const bfs = (g: WalkGrid) => {
        const [sx, sz] = L(DOOR_START[0], DOOR_START[1]), st = g.nearestFree(sx, sz, 2); if (!st) return null;
        const seen = new Uint8Array(g.nx * g.nz), todo = [g.idx(st[0], st[1])]; seen[todo[0]] = 1;
        while (todo.length) {
          const k = todo.pop()!, i = k % g.nx, j = (k / g.nx) | 0;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz) continue;
            const q2 = jj * g.nx + ii; if (seen[q2] || !g.free[q2]) continue;
            if (di && dj && (!g.free[j * g.nx + ii] || !g.free[jj * g.nx + i])) continue;
            seen[q2] = 1; todo.push(q2);
          }
        }
        return seen;
      };
      const nearestReached = (g: WalkGrid, seen: Uint8Array, x: number, z: number) => {
        let best = Infinity; const R = Math.ceil(1.5 / 0.5), ci = g.ix(x), cj = g.iz(z);
        for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !seen[j * g.nx + i]) continue; best = Math.min(best, Math.hypot(g.cx(i) - x, g.cz(j) - z)); }
        return best;
      };
      const seen = bfs(grid)!;
      const worst: { id: string; d: number }[] = [];
      for (const sl of venue.slots) { const d = nearestReached(grid, seen, sl.sx, sl.sz); worst.push({ id: sl.id, d: +d.toFixed(3) }); }
      const [hx, hz] = L(HANDOFF[0], HANDOFF[1]), dH = nearestReached(grid, seen, hx, hz);
      let laneCells = 0, reached = 0; for (let k = 0; k < seen.length; k++) if (seen[k]) { reached++; if (inLane(grid.cx(k % grid.nx), grid.cz((k / grid.nx) | 0))) laneCells++; }
      // the lane and the flap back in the region: only the colliders (the counter, the back bar, the gate) close them
      const g2 = new WalkGrid(grid.x0, grid.z0, grid.x0 + grid.nx * 0.5, grid.z0 + grid.nz * 0.5);
      for (const r of rings) g2.fillPoly(g2.region, r);
      g2.computeFree(set);
      const seen2 = bfs(g2)!; let lane2 = 0; for (let k = 0; k < seen2.length; k++) if (seen2[k] && inLane(g2.cx(k % g2.nx), g2.cz((k / g2.nx) | 0))) lane2++;
      const bad = worst.filter((w) => w.d > within);
      return { slots: worst.length, within, worst: worst.sort((a, b) => b.d - a.d).slice(0, 5), bad, handoff: +dH.toFixed(3), reached, laneCells, laneCellsWithLaneInRegion: lane2, offset: { x0: grid.x0 + F.origin[0], z0: grid.z0 + F.origin[1] } };
    },
    /** walk through a door on the stick (Lot 57's step, unrendered), running the camera and the visibility rule after
     *  every step as the frame does: where the camera was (inside the door's line or out) and the state, step by step,
     *  and what vis() lists just before and just after the crossing */
    cross(door: 'front' | 'patio', v: 'first' | 'third' = 'first') {
      const d = venue.doors.find((x) => x.id === door)!;
      setView(v); hooks.setClock('Sat', 12);
      // start 1.2 m inside the door, facing out along its outward normal
      const out: P2 = door === 'front' ? [-0.932, 0.362] : [0, -1];
      const a = L(d.centre[0] - out[0] * 1.2, d.centre[1] - out[1] * 1.2); player.place(a[0], a[1]);
      const [ox, oz] = F.dirToLocal(out[0], out[1]); player.yaw = Math.atan2(ox, oz); player.heading = player.yaw; player.pitch = -0.05;
      const side = () => { const [u, vv] = F.toFrame(camera.position.x, camera.position.z); return def.indoor(u, vv) && camera.position.y < 3.6 ? 'in' : 'out'; };
      const stepsOut: { side: string; state: string }[] = [];
      let before: ReturnType<typeof visReport> | null = null, after: ReturnType<typeof visReport> | null = null, prev = '';
      for (let i = 0; i < 400; i++) {
        updateDoors(STEP); simStep({ x: 0, y: 0.75, run: false });
        const hide = placeCamera(STEP); updateAvatar(STEP, hide);
        vis.update(camera, view, quality, nearPoint());
        const sd = side(); stepsOut.push({ side: sd, state: vis.state });
        if (prev === 'in' && sd === 'out') after = visReport();
        if (sd === 'in') before = visReport();
        prev = sd;
        const [u, vv] = F.toFrame(player.x, player.z); if ((u - d.centre[0]) * out[0] + (vv - d.centre[1]) * out[1] > 2.5) break;
      }
      const flips = stepsOut.map((s2, i) => (i && s2.state !== stepsOut[i - 1].state ? i : -1)).filter((i) => i >= 0);
      const crossings = stepsOut.map((s2, i) => (i && s2.side !== stepsOut[i - 1].side ? i : -1)).filter((i) => i >= 0);
      return { steps: stepsOut.length, flips, crossings, mismatched: stepsOut.filter((s2) => (s2.side === 'in') !== (s2.state === 'inside')).length, before, after, end: hooks.pos() };
    },
    /** diagnostics: switch GTAO's pass off or on, and list the casters whose bounding sphere reaches over a point */
    /** diagnostics: GTAO on or off, shadow casting off by mesh name, meshes hidden by name, and what lies under a
     *  screen point (x, y in 0..1 from the top left): every mesh the ray meets, nearest first */
    debug(o: { gtao?: boolean; castOff?: string; hide?: string; pick?: [number, number] } = {}) {
      if (gtao && o.gtao !== undefined) gtao.enabled = o.gtao;
      const off: string[] = [], hidden: string[] = [];
      if (o.castOff) scene.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh && m.castShadow && new RegExp(o.castOff!).test(m.name)) { m.castShadow = false; off.push(m.name); } });
      if (o.hide) scene.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh && m.visible && new RegExp(o.hide!).test(m.name)) { m.visible = false; hidden.push(m.name); } });
      let hits: unknown[] | null = null;
      if (o.pick) {
        camera.updateMatrixWorld();
        const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(o.pick[0] * 2 - 1, 1 - o.pick[1] * 2), camera);
        const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        hits = rc.intersectObjects(scene.children, true).slice(0, 8).map((h) => {
          const m = h.object as THREE.Mesh, mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
          let shown = true; for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) shown = false;
          const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
          const s = g.boundingSphere!.clone().applyMatrix4(m.matrixWorld);
          const col = (g.attributes.color && h.face) ? [g.attributes.color.getX(h.face.a), g.attributes.color.getY(h.face.a), g.attributes.color.getZ(h.face.a)].map((v) => +v.toFixed(3)) : null;
          return { name: m.name, d: +h.distance.toFixed(3), y: +h.point.y.toFixed(3), shown, inFrustum: !m.frustumCulled || fr.intersectsSphere(s), normalY: h.face ? +h.face.normal.y.toFixed(2) : null, side: mat.side, offset: mat.polygonOffset ? [mat.polygonOffsetFactor, mat.polygonOffsetUnits] : null, color: col, matColor: mat.color ? '#' + mat.color.getHexString() : null, drawCount: g.drawRange.count };
        });
      }
      return { gtao: gtao ? gtao.enabled : null, off, hidden, hits, cam: { x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2), aspect: +camera.aspect.toFixed(3) } };
    },
    /** your car's whole body as built (every mesh, whatever the camera sees): triangles and meshes */
    yourCarTris() { let tris = 0, calls = 0; mine.group.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; calls++; }); return { tris: Math.round(tris), calls, car: carId, quality: PRESET[quality].people }; },
    /** O3: the people builder's costs and build times on this machine: a person built at LOD 2, LOD 1 and LOD 0 at
     *  each quality (one synchronous call each, timed), and stats() at each level; disposed afterwards */
    peopleCosts(which: string = 'npc') {
      const out: Record<string, unknown>[] = [];
      for (const quality2 of ['phone', 'high'] as const) {
        const opts = which === 'driver' ? { ...personOpts } : randomPerson(4242);
        const t0 = performance.now(); const p = buildPerson({ ...opts, quality: quality2, lod: 2 as const }); const t2 = performance.now() - t0;
        const s2 = p.stats();
        let t = performance.now(); p.setLod(1); const t1 = performance.now() - t; const s1 = p.stats();
        t = performance.now(); p.setLod(0); const t0b = performance.now() - t; const s0 = p.stats();
        out.push({ who: which, quality: quality2, lod2: { ms: Math.round(t2), tris: s2.tris, calls: s2.calls }, lod1: { ms: Math.round(t1), tris: s1.tris, calls: s1.calls }, lod0: { ms: Math.round(t0b), tris: s0.tris, calls: s0.calls } });
        p.dispose();
      }
      return out;
    },
    /** the parked cars as data: the count, and by kind the instances and their colours (sorted) */
    parkedList() {
      const kinds: Record<string, { n: number; colours: string[] }> = {};
      for (const m of parked.group.children) {
        const im = m as THREE.InstancedMesh; if (!im.isInstancedMesh || !(im.name.endsWith('-paint') || im.name.endsWith('-far'))) continue;
        const k = im.name.split('-')[1]; kinds[k] ??= { n: 0, colours: [] };
        const c = new THREE.Color();
        for (let i = 0; i < im.count; i++) { kinds[k].n++; if (im.instanceColor) { im.getColorAt(i, c); kinds[k].colours.push(c.getHexString()); } }
      }
      for (const k of Object.values(kinds)) k.colours.sort();
      return { count: parked.count, quality: parked.quality, kinds };
    },
    buildAll() { if (quality === 'ultra') buildLod0(); return true; },
  };
  Object.defineProperty(hooks, 'frames', { get: () => frames });
  window.__onfoot = hooks as unknown as Record<string, unknown>;

  // in the game: what dispose releases (embed.ts)
  const em = embed;
  if (em) em.cleanup = () => { removeEventListener('resize', onResize); em.release(renderer, scene, [person, parked, composer], [hud, barHud, bin]); };
  hud.show();
  loading(1, 'Ready');
  hooks.buildMs = Math.round(performance.now() - t0);
  doneLoading(reduced);
  canvas.focus();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
  const waitReady = () => { if (frames >= 2) hooks.ready = true; else if (!embed?.dead) requestAnimationFrame(waitReady); };
  waitReady();
}

/** our street trees, instanced (the game's own palms and shade trees): palm trunks, palm crowns, tree trunks and
 *  canopies, each bounding sphere computed once after placing (as Lot 57's plantTrees does, L11) */
function plantTrees(trees: { x: number; z: number; y: number; s: number; kind: string }[], quality: Quality) {
  const g = new THREE.Group(); g.name = 'trees'; g.userData.group = 'trees';
  const r = rand(77);
  const palmT: THREE.Matrix4[] = [], palmC: THREE.Matrix4[] = [], shadeT: THREE.Matrix4[] = [], shadeC: THREE.Matrix4[] = [];
  for (const t of trees) {
    const base = new THREE.Matrix4().makeTranslation(t.x, t.y, t.z).multiply(new THREE.Matrix4().makeRotationY(r() * 6.28));
    if (t.kind === 'palm') {
      const h = 9 + r() * 4;
      palmT.push(base.clone().multiply(new THREE.Matrix4().makeScale(1, h, 1)));
      palmC.push(base.clone().multiply(new THREE.Matrix4().makeTranslation(0, h, 0)).multiply(new THREE.Matrix4().makeScale(1.05, 1.05, 1.05)));
    } else {
      const s = 0.9 + r() * 0.2;
      shadeT.push(base.clone().multiply(new THREE.Matrix4().makeScale(s, s, s)));
      shadeC.push(base.clone().multiply(new THREE.Matrix4().makeScale(s, s, s)));
    }
  }
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], name: string) => {
    if (!ms.length) return;
    const im = new THREE.InstancedMesh(geo, mat, ms.length); im.name = name;
    ms.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.receiveShadow = true; im.userData.cast = true; im.computeBoundingSphere(); g.add(im);
  };
  const low = quality === 'low';
  inst(Props.palmTrunk(), Props.mats.bark(), palmT, 'palm-trunks');
  inst(Props.palmCrown(low ? 0 : 1), Props.mats.frond(), palmC, 'palm-crowns');
  inst(Props.treeTrunk(), Props.mats.trunk(), shadeT, 'tree-trunks');
  inst(Props.treeCanopy(low ? 1 : 3), Props.mats.foliage(), shadeC, 'tree-canopies');
  return g;
}

/**
 * Mount Stoppage Time in host (J1): the game passes the page's markup (html), your car and paint, the quality, the
 * clock and onDrive; the page's own boot below passes nothing (the markup is there, the options are the address).
 */
export function mount(host: HTMLElement, o: MountOptions = {}) {
  q = optionsToParams(o, o.html ? '' : location.search);
  if (q.get('quality') === 'ultra') ultraUnlocked = true;
  quality = (['low', 'high', 'ultra'].includes(q.get('quality') ?? '') ? q.get('quality') : coarse ? 'low' : 'high') as Quality;
  if (quality === 'ultra' && !ultraUnlocked) quality = 'high';
  reduced = q.get('motion') === 'reduced' || sysReduced;
  return mountPage(host, o, (e) => { embed = o.html ? e : null; return main(); });
}

if (!(globalThis as { __onfootEmbed?: boolean }).__onfootEmbed) mount(document.body).ready.catch((e) => { window.__onfootError = String((e as Error)?.stack ?? e); const st = document.getElementById('status'); if (st) st.textContent = 'Something went wrong building the page: ' + String((e as Error)?.message ?? e); });

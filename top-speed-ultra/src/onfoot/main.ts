// Lot 57 on foot: Phase 1a of PROJECT_OC_ON_FOOT.md, a standalone page (not yet the game). Our own fictional taproom
// and yard at the real spot on East Orangewood Avenue in Anaheim, built in code; the rest of the block and the
// Orangewood frontage from OpenStreetMap through Overture (ODbL, credited on screen). You walk it as your driver from
// the game, in first or third person, by touch, keyboard or gamepad, with collisions against every wall, fence,
// table and truck. The sky is the game's (the real sun for the chosen hour); the crowd level is simulated from the
// time and day and labelled so. Test hooks: window.__onfoot (see the bottom of this file).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { Environment } from '../game/env/Environment';
import { configureTextures } from '../game/textures';
import * as Props from '../game/road/props';
import { board as localBoard } from '../game/records';
import { buildPerson, Person } from './people';
import { makeMats, setNight } from './lot57/mats';
import { Kit, P2, rand } from './lot57/geom';
import { buildStreets, DATA_ATTRIBUTION } from './lot57/data';
import { buildVenue, Seat, Tree } from './lot57/venue';
import { buildLot, ParkedCars, yourCar } from './lot57/lot';
import { ColliderSet, exportColliders } from './lot57/collide';
import { WalkGrid, RADIUS } from './lot57/walkgrid';
import { Player, STEP, View } from './lot57/player';
import { Input, Action } from './lot57/input';
import { Hud, loading, doneLoading } from './lot57/hud';
import { readDriver, driverPerson, eyeHeight } from './lot57/driver';
import * as C from './lot57/clock';
import { ORIGIN, EDGE, PLAN, inVenue, inShed, toLocal, toGame } from './lot57/coords';

type Quality = 'low' | 'high' | 'ultra';
const PRESET: Record<Quality, { shadows: number; post: boolean; bloom: boolean; ao: boolean; msaa: number; maxPR: number; scale: number; lights: number; people: 'phone' | 'high'; tex: number }> = {
  low: { shadows: 0, post: false, bloom: false, ao: false, msaa: 0, maxPR: 1, scale: 0.85, lights: 0, people: 'phone', tex: 512 },
  high: { shadows: 2048, post: true, bloom: true, ao: false, msaa: 4, maxPR: 2, scale: 1, lights: 4, people: 'high', tex: 1024 },
  ultra: { shadows: 4096, post: true, bloom: true, ao: true, msaa: 4, maxPR: 2, scale: 1, lights: 8, people: 'high', tex: 1024 },
};
const q = new URLSearchParams(location.search);
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const sysReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let quality: Quality = (['low', 'high', 'ultra'].includes(q.get('quality') ?? '') ? q.get('quality') : coarse ? 'low' : 'high') as Quality;
let reduced = q.get('motion') === 'reduced' || sysReduced;

declare global { interface Window { __onfoot?: Record<string, unknown>; __onfootError?: string } }
addEventListener('error', (e) => { window.__onfootError = String(e.message || e); });
addEventListener('unhandledrejection', (e) => { window.__onfootError = String((e as PromiseRejectionEvent).reason); });

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

async function main() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !(coarse && quality === 'low'), stencil: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  configureTextures(PRESET[quality].tex, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 2600);
  camera.layers.enable(0);
  const env = new Environment(scene, renderer);
  env.set('live', 'clear', true);
  env.sun.shadow.camera.layers.enable(1);            // your own body casts a shadow in first person (layer 1)

  // ------------------------------------------------------------------------------------------ build the world
  const steps: [string, number][] = [['Painting the textures', 0.08], ['Laying out Orangewood and the block', 0.2], ['Building the Shed and the yard', 0.38], ['Striping the lot', 0.46], ['Baking the night lights', 0.6], ['Mapping where you can walk', 0.72], ['Your driver', 0.86], ['Parking cars', 0.94]];
  let si = 0; const stage = async () => { loading(steps[si][1], steps[si][0] + '…'); si++; await nextFrame(); await nextFrame(); };
  const t0 = performance.now();
  await stage();
  // the screen in the Shed shows the game's own local leaderboard (Speed Survival), labelled as the game does
  const runs = (() => { try { return localBoard('survival'); } catch { return []; } })();
  const board = { title: 'Speed Survival · best runs', rows: runs.slice(0, 6).map((r) => ({ name: r.road || 'Run', value: Math.round(r.score).toLocaleString('en-US') })), empty: 'No runs on this device yet. Go drive.' };
  const mats = makeMats(board);
  mats.ground.map!.repeat.set(400, 400); mats.ground.normalMap!.repeat.set(400, 400);
  await stage();
  const kit = new Kit();
  const streets = buildStreets(kit, mats);
  await stage();
  const venue = buildVenue(kit, mats);
  await stage();
  const lot = buildLot(kit, mats);
  await stage();
  const world = new THREE.Group(); world.name = 'world'; scene.add(world);
  const worldMeshes = kit.finish(world, kit.emitters, true);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; ground.name = 'ground'; world.add(ground);
  // the bulbs (emissive, bloom on High and Ultra; a soft additive glow on every preset), the wires, the lamp glows
  const bulbGeoLow = new THREE.IcosahedronGeometry(0.055, 0), bulbGeoHigh = new THREE.SphereGeometry(0.05, 8, 6);
  const bulbGeo = quality === 'low' ? bulbGeoLow : bulbGeoHigh;
  const bulbs = new THREE.InstancedMesh(bulbGeo, mats.bulb, venue.bulbs.length);
  venue.bulbs.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  bulbs.name = 'bulbs'; bulbs.computeBoundingSphere(); world.add(bulbs);
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(venue.bulbs.flatMap((p) => [p.x, p.y, p.z]), 3));
  const glow = new THREE.Points(glowGeo, mats.glow); glow.name = 'bulb-glow'; glow.renderOrder = 5; world.add(glow);
  const wireGeo = new THREE.BufferGeometry(); wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(venue.wires, 3));
  const wires = new THREE.LineSegments(wireGeo, mats.wire); wires.name = 'wires'; world.add(wires);
  const lampPts = kit.emitters.filter((e) => e.ch === 1 && (e.down ?? 0) > 1.5).map((e) => [e.x, e.y + 0.05, e.z]);
  const lampGeo = new THREE.BufferGeometry(); lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPts.flat(), 3));
  const lampGlow = new THREE.Points(lampGeo, mats.lampGlow); lampGlow.name = 'lamp-glow'; lampGlow.renderOrder = 5; world.add(lampGlow);
  // trees: olive-ish in the planters, shade trees in the median, palms along Orangewood (the game's own models)
  const trees: Tree[] = [...venue.trees, ...lot.trees, ...streets.palms.map((p) => ({ x: p.x, z: p.z, y: 0.15, s: p.h, kind: 'palm' as const }))];
  plantTrees(world, trees, quality);
  // parked cars (how many follows the simulated crowd) and your car
  // parked cars are background: the game's phone-quality traffic models up close, 150-triangle stand-ins beyond
  const parked = new ParkedCars(lot.stalls, 'phone', quality === 'low' ? 16 : 36);
  world.add(parked.group);
  const choice = readDriver(q);
  const carId = (['rossini-gt', 'rossini-brio', 'rossini-corsa', 'vela-e'].includes(choice.car) ? choice.car : 'rossini-gt') as 'rossini-gt';
  const mine = yourCar(lot.mine, carId, undefined, PRESET[quality].people);
  world.add(mine.group);
  await stage();

  // ------------------------------------------------------------------------------------------ colliders, walk grid
  const set = new ColliderSet();
  set.add(...streets.colliders, ...venue.colliders, ...lot.colliders, mine.collider, ...venue.closedOnly, ...venue.openOnly);
  const grid = new WalkGrid(-392, -104, 304, 192);
  grid.fillPoly(grid.region, streets.blockRing);
  const corridor = { x0: EDGE.x0, x1: EDGE.x1, z0: EDGE.z0, z1: EDGE.z1 };
  for (const sw of streets.sidewalks) grid.stroke(grid.region, sw, 1.0, 1, corridor);
  for (const cw of streets.crosswalks) grid.stroke(grid.region, cw, 1.6, 1, corridor);
  for (const sw of streets.sidewalks) grid.stroke(grid.raised, sw, 1.0, 1);
  grid.rect(grid.raised, -52.4, PLAN.lotWalk.z0, 57.5, PLAN.lotWalk.z1);
  // the road layer (only for telling a kerb from the edge of the area): carriageways and their parkway strips
  for (const r of streets.roads) grid.stroke(grid.road, r.pts, r.w / 2 + 2.5, 1);
  // a crosswalk is walkable even where a road ribbon crosses it; a sidewalk on top of a road edge is walkable too
  for (let k = 0; k < grid.road.length; k++) if (grid.region[k] && grid.road[k]) grid.road[k] = 0;
  let dynamic = [...venue.closedOnly, ...venue.openOnly];
  const refreshDynamic = () => { set.all = set.all.filter((o) => !o.dyn || dynamic.includes(o)); for (const c of parked.colliders) set.all.push(c); set.rebuild(); grid.computeFree(set, true); };
  set.rebuild(); grid.computeFree(set);
  await stage();

  // ------------------------------------------------------------------------------------------ you
  const personOpts = driverPerson(choice);
  let person: Person | null = null;
  const buildAvatar = (qq: Quality) => {
    if (person) { scene.remove(person.group); person.dispose(); }
    const o = { ...personOpts, quality: PRESET[qq].people, lod: 1 as const };
    person = buildPerson(o);
    person.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    scene.add(person.group);
    avatarLod = 1;
    return person;
  };
  let avatarLod = 1, wantLod0At = -1;
  buildAvatar(quality);
  const player = new Player(set, grid, (x, z) => grid.isRoad(x, z));
  player.eye = eyeHeight(personOpts);
  player.reducedMotion = reduced;
  player.person = person;
  // start in the lot by your car's door, looking at the gate (or where the URL says)
  const startAt = q.get('at')?.split(',').map(Number);
  if (startAt && startAt.length >= 2) { const [lx, lz] = toLocal(startAt[0], startAt[1]); player.place(lx, lz); }
  else player.place(lot.door.x, lot.door.z - 0.2);
  player.yaw = q.has('yaw') ? (Number(q.get('yaw')) * Math.PI) / 180 : Math.atan2(-5 - player.x, 10 - player.z);
  player.pitch = q.has('pitch') ? (Number(q.get('pitch')) * Math.PI) / 180 : 0.02;
  player.view = q.get('view') === 'third' ? 'third' : 'first';
  await stage();

  // ------------------------------------------------------------------------------------------ the clock and crowd
  let live = !(q.has('day') || q.has('hour'));
  let clock: C.ClockState = live ? C.liveClock() : { day: C.parseDay(q.get('day') ?? 'Sat'), hour: clamp(Number(q.get('hour') ?? 21), 0, 23.99) };
  let simDate = C.anaheimDate(clock.day, clock.hour);
  let open = false, night = 0, share = 0, level: C.CrowdLevel = 'Closed', liveT = 0;
  const hud = new Hud();
  const stateMeshes = (prefix: string) => world.children.filter((o) => o.name.startsWith(prefix));
  const applyClock = (firstTime = false) => {
    simDate = live ? new Date() : C.anaheimDate(clock.day, clock.hour);
    if (live) clock = C.liveClock();
    open = C.isOpen(clock.day, clock.hour); share = C.crowdShare(clock.day, clock.hour); level = C.crowdLevel(clock.day, clock.hour);
    env.update(1000, simDate); env.update(1000, simDate);
    night = Math.pow(1 - env.daylight, 0.75);
    setNight(mats, night, open);
    for (const o of stateMeshes('when-open')) o.visible = open;
    for (const o of stateMeshes('when-closed')) o.visible = !open;
    for (const c of venue.closedOnly) c.on = !open;
    for (const c of venue.openOnly) c.on = open;
    mats.readerTex.draw(open ? `OPEN TILL ${C.closesAt(clock.day, clock.hour)}` : 'CLOSED', open ? 'Taproom · Yard · Trucks' : `Opens ${C.opensAt(clock.day, clock.hour)}`, open);
    // parked cars: a few overnight, more as the simulated crowd grows (seeded by the day and hour)
    parked.fill(open ? clamp(0.12 + share * 0.92, 0, 0.96) : 0.05, clock.day * 100 + Math.floor(clock.hour));
    parked.update(player.x, player.z, true);
    dynamic = [...venue.closedOnly, ...venue.openOnly];
    refreshDynamic();
    hud.setPlace(C.fmtClock(clock), open ? `Open till ${C.closesAt(clock.day, clock.hour)}` : `Closed · opens ${C.opensAt(clock.day, clock.hour)}`);
    hud.setCrowd(level);
    hud.setClockMode(live, clock.day, clock.hour);
    // closed with you inside the fence: you're shown out to the lot walk by the gate
    if (!firstTime && !open && inVenue(player.x, player.z)) { player.seat = null; player.place(-5, 13.5); hud.toast(`Lot 57 is closed · opens ${C.opensAt(clock.day, clock.hour)}`); }
    else if (player.clearance(player.x, player.z) < RADIUS - 0.02 && !player.seat) { player.place(player.x, player.z); player.rescues++; }
  };
  applyClock(true);

  // ------------------------------------------------------------------------------------------ rendering
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null;
  const pointLights: THREE.PointLight[] = [];
  const lightCandidates = [...venue.lightSpots.map((s) => ({ ...s, c: 0xffb56a, k: 0.9, inside: false })), ...venue.heaters.map((h) => ({ x: h.x, y: h.y, z: h.z, i: 6, c: 0xff8a40, k: 0.6, inside: false })),
    ...venue.insideLights.map((s) => ({ ...s, c: 0xffc58a, k: 0.8, inside: true }))];
  const applyQuality = (qq: Quality, rebuildPeople: boolean) => {
    const P = PRESET[qq];
    quality = qq;
    env.setQuality(P.shadows, 2600);
    renderer.shadowMap.enabled = P.shadows > 0;
    world.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.cast === undefined) m.userData.cast = m.castShadow; if (m.isMesh) m.castShadow = P.shadows > 0 && !!m.userData.cast; });
    composer?.dispose(); composer = null; bloom = null;
    const pr = clamp((devicePixelRatio || 1) * P.scale, 0.5, P.maxPR);
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);
    if (P.post) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: P.msaa });
      const c = new EffectComposer(renderer, rt);
      c.addPass(new RenderPass(scene, camera));
      if (P.ao) { const g = new GTAOPass(scene, camera, size.x, size.y); g.blendIntensity = 0.8; c.addPass(g); }
      if (P.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.88); c.addPass(bloom); }
      c.addPass(new OutputPass());
      c.setPixelRatio(pr); c.setSize(innerWidth, innerHeight);
      composer = c;
    }
    // a few real lights near you on High and Ultra (the yard's strings and heaters), so your driver is lit by them
    while (pointLights.length > P.lights) { const l = pointLights.pop()!; scene.remove(l); l.dispose(); }
    while (pointLights.length < P.lights) { const l = new THREE.PointLight(0xffb56a, 0, 15, 2); l.castShadow = false; scene.add(l); pointLights.push(l); }
    if (rebuildPeople) {
      buildAvatar(qq); player.person = person;
      for (const o of [...world.children]) if (o.name === 'trees') world.remove(o);
      plantTrees(world, trees, qq);
    }
    // the cheaper bulbs and fewer detailed parked cars on Low
    bulbs.geometry = qq === 'low' ? bulbGeoLow : bulbGeoHigh;
    parked.near = qq === 'low' ? 16 : 36; parked.update(player.x, player.z, true);
    hud.setQuality(qq);
    renderer.compile(scene, camera);
  };
  applyQuality(quality, false);
  const onResize = () => {
    const P = PRESET[quality], pr = clamp((devicePixelRatio || 1) * P.scale, 0.5, P.maxPR);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    composer?.setPixelRatio(pr); composer?.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  };
  addEventListener('resize', onResize);
  // the sun's lens flare: hidden by the Shed, the buildings and the trucks (a cheap test on the 2D colliders)
  const HEIGHT: Record<string, number> = { wall: 9.6, building: 9, truck: 3.6, sign: 6.5, tank: 5.5, door: 4.2, car: 1.4 };
  env.setFlareOccluders([], [], (o, d) => {
    const flat = Math.hypot(d.x, d.z); if (flat < 1e-3) return false;
    const L = 80, bx = o.x + (d.x / flat) * L, bz = o.z + (d.z / flat) * L;
    const near = set.query(Math.min(o.x, bx) - 1, Math.min(o.z, bz) - 1, Math.max(o.x, bx) + 1, Math.max(o.z, bz) + 1);
    for (const c of near) {
      const h = HEIGHT[c.tag]; if (!h || !c.on) continue;
      const t = set.ray(o.x, o.z, bx, bz, (x) => x === c);
      if (t < 1 && o.y + (d.y / flat) * t * L < h) return true;
    }
    return false;
  });

  // ------------------------------------------------------------------------------------------ input, HUD, actions
  const input = new Input(canvas, { stick: hud.stick, knob: hud.knob, car: hud.car });
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 12).rotateX(-Math.PI / 2), mats.dots, 200);
  dots.count = 0; dots.renderOrder = 6; dots.name = 'path-dots'; dots.frustumCulled = false; scene.add(dots);
  const showPath = (p: P2[] | null) => {
    dots.count = 0;
    if (!p) return;
    const m = new THREE.Matrix4();
    for (let i = 1; i < p.length && dots.count < 200; i++) {
      const [ax, az] = p[i - 1], [bx, bz] = p[i], L = Math.hypot(bx - ax, bz - az);
      for (let t = i === 1 ? 0.8 : 0; t < L && dots.count < 200; t += 0.8) { const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L; m.makeTranslation(x, grid.height(x, z) + 0.06, z); dots.setMatrixAt(dots.count++, m); }
    }
    dots.instanceMatrix.needsUpdate = true;
  };
  const seatTaken = (s: Seat) => player.seat === s;
  const nearSeat = () => {
    let best: Seat | null = null, bd = 1.4;
    for (const s of venue.seats) { if (seatTaken(s)) continue; const d = Math.min(Math.hypot(s.ax - player.x, s.az - player.z), Math.hypot(s.x - player.x, s.z - player.z) + 0.2); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  const nearCar = () => Math.hypot(lot.door.x - player.x, lot.door.z - player.z) < 1.8;
  const available = (): [string | null, string | null] => {
    if (player.seat) return ['Stand', null];
    if (nearCar()) return ['Drive', null];
    if (nearSeat()) return ['Sit', null];
    return [null, null];
  };
  const doAction = (which: 1 | 2): string | null => {
    const [a] = available();
    if (which !== 1 || !a) return null;
    if (a === 'Stand') { player.stand(); return 'stand'; }
    if (a === 'Sit') { const s = nearSeat(); if (s) { player.sit(s); hud.fadeHint(); return 'sit'; } return null; }
    if (a === 'Drive') { hud.toast('Lot 57 is on its own page for now. Driving out comes when it joins the game.', 4.5); return 'drive'; }
    return null;
  };
  const walkToCar = (skip: boolean) => {
    if (skip) { player.place(lot.door.x, lot.door.z); player.yaw = Math.PI; showPath(null); return true; }
    const p = player.goTo(lot.door.x, lot.door.z); showPath(p);
    if (!p) hud.toast('No way through to your car from here.');
    return !!p;
  };
  const setView = (v?: View) => { player.view = v ?? (player.view === 'first' ? 'third' : 'first'); hud.setView(player.view); if (player.view === 'third' && quality !== 'low' && avatarLod !== 0) wantLod0At = performance.now() + 800; return player.view; };
  hud.setView(player.view); hud.setMotion(reduced);
  hud.onAct = (w) => { doAction(w); canvas.focus(); };
  hud.onView = (v) => setView(v);
  hud.onQuality = (qq) => { if (qq !== quality) { const rebuild = PRESET[qq].people !== PRESET[quality].people; applyQuality(qq, rebuild); } };
  hud.onClock = (c) => { live = c.live; if (!c.live) clock = { day: c.day, hour: c.hour }; applyClock(); };
  hud.onMotion = (rm) => { reduced = rm; player.reducedMotion = rm; hud.setMotion(rm); };
  hud.onPause = (on) => { input.enabled = !on; };
  const ray = new THREE.Raycaster();
  /** a tap on the screen: a seat sits you down, anywhere else on the ground walks you there */
  const tapScreen = (sx: number, sy: number) => {
    const ndc = new THREE.Vector2((sx / canvas.clientWidth) * 2 - 1, -(sy / canvas.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // a seat close to the ray
    let seat: Seat | null = null, sd = 0.45;
    const o = ray.ray.origin, d = ray.ray.direction, v = new THREE.Vector3();
    for (const s of venue.seats) {
      v.set(s.x - o.x, s.y + 0.15 - o.y, s.z - o.z); const t = v.dot(d); if (t < 0.3 || t > 40) continue;
      const dist = v.addScaledVector(d, -t).length(); if (dist < sd * (1 + t * 0.02)) { sd = dist; seat = s; }
    }
    if (seat) return tapGo(seat.ax, seat.az, seat);
    // the ground, or the foot of whatever wall the ray hits first
    const hits = ray.intersectObjects(worldMeshes.filter((m) => m.visible && !(m.material as THREE.Material).transparent), false);
    let gx: number, gz: number;
    const h = hits[0];
    if (h && h.face && h.face.normal.y < 0.6) { const back = h.point.clone().addScaledVector(d, -0.5); gx = back.x; gz = back.z; }
    else if (h) { gx = h.point.x; gz = h.point.z; }
    else { if (d.y >= -1e-3) return null; const t = (0.0 - o.y) / d.y; gx = o.x + d.x * t; gz = o.z + d.z * t; }
    return tapGo(gx, gz, null);
  };
  const tapGo = (x: number, z: number, seat: Seat | null) => {
    const p = player.goTo(x, z, seat ? { seat } : null);
    showPath(p);
    if (!p) hud.toast("Can't get there from here.", 2);
    hud.fadeHint();
    return p;
  };

  // ------------------------------------------------------------------------------------------ the loop
  let frames = 0, simMs = 0, frameMs = 0, lastT = performance.now(), acc = 0, edgeT = 0, hintT = 6, kerbT = 0;
  const stats = { calls: 0, tris: 0 };
  const firstVisit = (() => { try { return !localStorage.getItem('lot57.seen'); } catch { return true; } })();
  if ((!firstVisit && !q.has('hint')) || q.get('hint') === '0') hud.hint(false);
  // the hint speaks to what you hold: thumbs on a touch screen, keys and a mouse on a desktop
  if (!coarse) { const el = document.getElementById('hint'); if (el) el.textContent = 'W A S D to walk · drag to look · click to go · E to act'; }
  try { localStorage.setItem('lot57.seen', '1'); } catch { /* a convenience */ }
  const _eye = new THREE.Vector3();
  let fixedCam: { p: THREE.Vector3; t: THREE.Vector3 } | null = null;
  const camQ = q.get('cam')?.split(',').map(Number);
  if (camQ && camQ.length === 6) { const [a, b] = [toLocal(camQ[0], camQ[2]), toLocal(camQ[3], camQ[5])]; fixedCam = { p: new THREE.Vector3(a[0], camQ[1], a[1]), t: new THREE.Vector3(b[0], camQ[4], b[1]) }; }

  const simStep = (stick: { x: number; y: number; run: boolean }) => { player.step(stick); };
  const updateAvatar = (dt: number) => {
    const p = person!; if (!p) return;
    // seated: the builder's sitting pose is for a 0.46 m seat; a bar stool lifts you (feet on the rail)
    p.group.position.set(player.x, player.seat ? Math.max(-0.1, player.seat.y - 0.47) : player.y, player.z);
    p.group.rotation.y = player.heading;
    const sp = player.speed;
    p.play(player.seat ? 'sit' : sp > 0.15 ? 'walk' : 'idle');
    // the walk cycle's cadence matched to the speed (the builder's walk is tuned for 1.25 m/s)
    const k = sp > 0.15 && !player.seat ? clamp(sp / 1.25, 0.6, 2.2) : 1;
    p.update(dt * k);
    const fp = player.view === 'first';
    p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.layers.set(fp ? 1 : 0); });
  };
  const render = () => {
    renderer.info.reset();
    if (composer) composer.render(); else renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    env.renderFlare();
  };
  let frozen = false;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (frozen) { lastT = now; return; }
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const tf = performance.now();
    const look = input.poll(dt);
    for (const a of input.actions.splice(0)) handleAction(a);
    for (const t of input.taps.splice(0)) if (!hud.paused) tapScreen(t.x, t.y);
    if (!hud.paused) {
      player.look(look.dyaw, look.dpitch);
      const ts = performance.now();
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { simStep(input.stick); acc -= STEP; n++; }
      if (n === 6) acc = 0;
      simMs = performance.now() - ts;
      if (Math.hypot(input.stick.x, input.stick.y) > 0.2 || Math.abs(look.dyaw) > 0.02) { if (hintT > 0 && hud.hintVisible) { hintT = 0; hud.fadeHint(); } }
      if (!player.path) dots.count = 0;
      // toasts at the edge of the hangout area and at kerbs
      edgeT -= dt; kerbT -= dt;
      if (player.lastBlock === 'edge' && edgeT <= 0) { hud.toast("That's the edge of the hangout area for now"); edgeT = 4; }
      if (player.lastBlock === 'kerb' && kerbT <= 0) { hud.toast('Cross at a crosswalk'); kerbT = 5; }
      if (player.lastBlock === 'stuck') { hud.toast("Something's in the way."); player.lastBlock = ''; showPath(null); }
    }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0 && hud.hintVisible) hud.fadeHint(); }
    if (live) { liveT -= dt; if (liveT <= 0) { liveT = 60; applyClock(); } }
    updateAvatar(dt);
    parked.update(player.x, player.z);
    // the camera
    const fov = innerHeight > innerWidth ? 78 : 62;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    let hideAvatar = player.view === 'first';
    if (fixedCam) { camera.position.copy(fixedCam.p); camera.lookAt(fixedCam.t); hideAvatar = false; }
    else { const c = player.camera(camera); hideAvatar = c.hide; }
    if (person) person.group.visible = true;
    if (person && hideAvatar && player.view === 'third') person.group.visible = false;
    // the sky, the sun's shadow box round you, the flare
    env.update(dt, live ? new Date() : simDate);
    env.follow(new THREE.Vector3(player.x, player.y, player.z), camera, now / 1000, dt);
    // real lights near you (High and Ultra), only once the strings are lit
    if (pointLights.length) {
      // the yard's strings and heaters light up after dark; the Shed's pendants are on whenever it's open; the lights
      // inside count only when you're inside (and the yard's only when you're out), so walls don't leak light
      const eye = player.eyePos(_eye), inside = inShed(player.x, player.z);
      const ranked = lightCandidates.filter((c) => c.inside === inside).map((c) => ({ c, d: Math.hypot(c.x - eye.x, c.z - eye.z) })).sort((a, b) => a.d - b.d);
      pointLights.forEach((l, i) => {
        const r = ranked[i]; if (!r) { l.intensity = 0; return; }
        const lit = !open ? 0 : r.c.inside ? 0.35 + 0.65 * night : night;
        l.position.set(r.c.x, r.c.y, r.c.z); l.color.setHex(r.c.c); l.intensity = lit * r.c.k * clamp(r.c.i / 10, 0.4, 2.5) * 9 * clamp(1.4 - r.d / 30, 0, 1);
      });
    }
    // upgrade your driver to the close-up level of detail once you're in third person on High or Ultra
    if (wantLod0At > 0 && performance.now() > wantLod0At && person && player.view === 'third') { wantLod0At = -1; person.setLod(0); avatarLod = 0; person.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
    const [a1, a2] = available();
    hud.setActions(a1, a2);
    hud.tick(dt);
    render();
    frameMs = performance.now() - tf;
    frames++;
  };
  const handleAction = (a: Action) => {
    if (a === 'pause') { hud.pause(!hud.paused); return; }
    if (hud.paused) return;
    if (a === 'act') doAction(1); else if (a === 'act2') doAction(2);
    else if (a === 'view') setView();
    else if (a === 'car') walkToCar(false); else if (a === 'carSkip') walkToCar(true);
    else if (a === 'stand') { if (player.seat) player.stand(); }
  };

  // ------------------------------------------------------------------------------------------ test hooks
  const G = (lx: number, lz: number) => { const [x, z] = toGame(lx, lz); return { x: +x.toFixed(3), z: +z.toFixed(3) }; };
  const L = (gx: number, gz: number) => toLocal(gx, gz);
  const hooks = {
    ready: false,
    frames: 0,
    buildMs: 0,
    attribution: DATA_ATTRIBUTION,
    /** set the simulated clock: day 0-6 (Sunday 0) or a name, hour 0-24 */
    setClock(day: number | string, hour: number) { live = false; clock = { day: C.parseDay(day), hour: clamp(hour, 0, 23.99) }; applyClock(); return hooks.clock(); },
    liveClock() { live = true; applyClock(); return hooks.clock(); },
    clock() { return { day: clock.day, hour: clock.hour, label: C.fmtClock(clock), open, level, share: +share.toFixed(3), night: +night.toFixed(3) }; },
    setQuality(qq: Quality) { if (!PRESET[qq]) throw new Error('quality: low, high or ultra'); const rebuild = PRESET[qq].people !== PRESET[quality].people; applyQuality(qq, rebuild); return quality; },
    stats() {
      return {
        // the crowd is phase 1b: no NPCs are built yet, and the page says so by showing none
        npcs: 0, groups: 0, seated: 0, walkers: 0,
        calls: stats.calls, triangles: stats.tris, simMs: +simMs.toFixed(3), frameMs: +frameMs.toFixed(1),
        quality, view: player.view, frames, open, crowd: level, share: +share.toFixed(3),
        parkedCars: parked.count, seats: venue.seats.length, colliders: set.all.filter((o) => o.on).length,
        textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length ?? 0,
        avatar: person ? { lod: avatarLod, ...(() => { const s = person!.stats(); return { tris: s.tris, calls: s.calls }; })() } : null,
        pixelRatio: renderer.getPixelRatio(), rescues: player.rescues,
      };
    },
    /** stand at (x, z), game coordinates, or the nearest free spot to it; returns where you are */
    go(x: number, z: number) { const [lx, lz] = L(x, z); player.seat = null; showPath(null); const ok = player.place(lx, lz); return ok ? G(player.x, player.z) : null; },
    /** tap to go to a ground point (game coordinates): the path's waypoints, or null */
    tap(x: number, z: number) { const [lx, lz] = L(x, z); const p = tapGo(lx, lz, null); return p ? { waypoints: p.map(([a, b]) => G(a, b)), length: +p.reduce((s, c, i) => (i ? s + Math.hypot(c[0] - p[i - 1][0], c[1] - p[i - 1][1]) : 0), 0).toFixed(2) } : null; },
    /** a tap on the screen at pixel (x, y), through the same code as a finger */
    tapScreen(x: number, y: number) { const p = tapScreen(x, y); return p ? { waypoints: p.length, goal: player.pathGoal?.seat ? `seat ${player.pathGoal.seat.id}` : 'ground' } : null; },
    /** the action button: returns what it did */
    act() { const did = doAction(1); return { did, now: available() }; },
    actions() { return available(); },
    view(v?: View) { return setView(v); },
    look(yawDeg: number, pitchDeg: number) { player.yaw = (yawDeg * Math.PI) / 180; player.pitch = (pitchDeg * Math.PI) / 180; return true; },
    /** walk with the stick (x right, y forward, -1..1) for some seconds of simulation, unrendered; the trajectory in game coordinates */
    walk(sx: number, sy: number, seconds: number, run = false) { return simulate(Math.round(seconds / STEP), { x: sx, y: sy, run }); },
    /** let the simulation run (a tap-to-go path plays out), unrendered */
    sim(seconds: number) { return simulate(Math.round(seconds / STEP), { x: 0, y: 0, run: false }); },
    pos() { return { ...G(player.x, player.z), lx: +player.x.toFixed(3), lz: +player.z.toFixed(3), y: +player.y.toFixed(3), heading: +player.heading.toFixed(3), yaw: +player.yaw.toFixed(3), sitting: player.seat ? player.seat.id : null, view: player.view, moving: !!player.path, speed: +player.speed.toFixed(3) }; },
    colliders() { return exportColliders(set).map((c) => shiftCollider(c as Record<string, unknown>)); },
    region() { const r = grid.exportRegion(); return { ...r, x0: r.x0 + ORIGIN.x, z0: r.z0 + ORIGIN.z }; },
    seats() { return venue.seats.map((s) => ({ id: s.id, kind: s.kind, at: s.at, ...G(s.x, s.z), approach: G(s.ax, s.az) })); },
    /** n random free points in the walkable area (seeded), game coordinates */
    randomFree(n: number, seed = 1) {
      const r = rand(seed), out: { x: number; z: number }[] = [];
      for (let k = 0; out.length < n && k < n * 400; k++) {
        // half in and round the venue, half anywhere in the walkable area
        const x = k % 2 ? lerp(-60, 66, r()) : lerp(grid.x0, grid.x0 + grid.nx * 0.5, r()), z = k % 2 ? lerp(-60, 60, r()) : lerp(grid.z0, grid.z0 + grid.nz * 0.5, r());
        if (grid.isFree(x, z) && player.clearance(x, z) >= RADIUS + 0.02) out.push(G(x, z));
      }
      return out;
    },
    render() { render(); return { calls: stats.calls, triangles: stats.tris }; },
    /** stop drawing frames (for long unrendered test runs on a slow software renderer); false resumes */
    freeze(on: boolean) { frozen = on; return frozen; },
    reducedMotion(on: boolean) { hud.onMotion(on); return { reduced, bobOff: player.reducedMotion, transitionsOff: document.body.classList.contains('rm') }; },
    /** the head-bob height over a second of walking (for the reduced-motion check) */
    bobRange() { const ys: number[] = []; for (let i = 0; i < 60; i++) { player.step({ x: 0, y: 0.75, run: false }); ys.push(player.eyePos(_eye).y - player.y); } return +(Math.max(...ys) - Math.min(...ys)).toFixed(4); },
    camera(p?: [number, number, number, number, number, number] | null) { if (p === null) { fixedCam = null; return null; } if (p) { const a = L(p[0], p[2]), b = L(p[3], p[5]); fixedCam = { p: new THREE.Vector3(a[0], p[1], a[1]), t: new THREE.Vector3(b[0], p[4], b[1]) }; } return { p: G(camera.position.x, camera.position.z), y: camera.position.y }; },
    toast() { return hud.toastText; },
    /** show or hide the first-visit hint (screenshots after the first one hide it) */
    hint(on: boolean) { hud.hint(on); return hud.hintVisible; },
    hud() { const r = (id: string) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: b.x, y: b.y, w: b.width, h: b.height, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && b.width > 0, text: e.textContent }; }; return { credit: r('credit'), crowd: r('crowd'), place: r('place'), act: r('act'), car: r('car') }; },
    yourCar() { return { stall: G(lot.mine.x, lot.mine.z), door: G(lot.door.x, lot.door.z) }; },
    /** triangles by mesh (instanced meshes count every instance), biggest first: for the budgets */
    breakdown() {
      const out: { name: string; tris: number; n: number }[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry) return;
        const g = m.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3, n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
        out.push({ name: m.name || m.parent?.name || m.type, tris: Math.round(t * n), n });
      });
      return out.sort((a, b) => b.tris - a.tris).slice(0, 40);
    },
  };
  const shiftCollider = (c: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...c };
    if (c.k === 'circ') { out.x = (c.x as number) + ORIGIN.x; out.z = (c.z as number) + ORIGIN.z; }
    else if (c.k === 'seg') { out.ax = (c.ax as number) + ORIGIN.x; out.az = (c.az as number) + ORIGIN.z; out.bx = (c.bx as number) + ORIGIN.x; out.bz = (c.bz as number) + ORIGIN.z; }
    else out.pts = (c.pts as number[]).map((v, i) => v + (i % 2 ? ORIGIN.z : ORIGIN.x));
    return out;
  };
  const simulate = (n: number, stick: { x: number; y: number; run: boolean }) => {
    const path: number[] = [], blocks: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      simStep(stick);
      const g = toGame(player.x, player.z);
      path.push(+g[0].toFixed(4), +g[1].toFixed(4));
      if (player.lastBlock) blocks[player.lastBlock] = (blocks[player.lastBlock] ?? 0) + 1;
    }
    return { path, blocks, end: hooks.pos() };
  };
  Object.defineProperty(hooks, 'frames', { get: () => frames });
  window.__onfoot = hooks as unknown as Record<string, unknown>;

  hud.show();
  loading(1, 'Ready');
  hooks.buildMs = Math.round(performance.now() - t0);
  doneLoading(reduced);
  canvas.focus();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
  // ready after a couple of frames have drawn
  const waitReady = () => { if (frames >= 2) hooks.ready = true; else requestAnimationFrame(waitReady); };
  waitReady();
}

/** instanced trees: the game's own canopy and trunk for the planters' olives and the median's shade trees, its palms */
function plantTrees(world: THREE.Group, trees: Tree[], quality: Quality) {
  const g = new THREE.Group(); g.name = 'trees';
  const m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), qt = new THREE.Quaternion(), r = rand(91);
  const canopy: THREE.Matrix4[] = [], trunk: THREE.Matrix4[] = [], palmT: THREE.Matrix4[] = [], palmC: THREE.Matrix4[] = [];
  for (const t of trees) {
    if (t.kind === 'palm') {
      const lean = new THREE.Matrix4().makeRotationZ((r() - 0.5) * 0.08), base = new THREE.Matrix4().makeTranslation(t.x, t.y, t.z).multiply(lean);
      palmT.push(base.clone().multiply(new THREE.Matrix4().makeScale(1, t.s, 1)));
      const cs = 1 + r() * 0.2;
      palmC.push(base.clone().multiply(new THREE.Matrix4().makeTranslation(0, t.s, 0)).multiply(new THREE.Matrix4().makeRotationY(r() * 6)).multiply(new THREE.Matrix4().makeScale(cs, cs, cs)));
    } else {
      const s = t.kind === 'olive' ? t.s : t.s, sy = t.kind === 'olive' ? t.s * 0.95 : t.s * 1.1;
      qt.setFromAxisAngle(up, r() * 6);
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), qt, new THREE.Vector3(s, sy, s));
      canopy.push(m4.clone()); trunk.push(m4.clone());
    }
  }
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], name: string) => {
    if (!ms.length) return;
    const im = new THREE.InstancedMesh(geo, mat, ms.length); im.name = name;
    ms.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.castShadow = true; im.receiveShadow = true; im.userData.cast = true; im.computeBoundingSphere(); g.add(im);
  };
  inst(Props.palmTrunk(), Props.mats.bark(), palmT, 'palm-trunks');
  inst(Props.palmCrown(quality === 'low' ? 0 : 1), Props.mats.frond(), palmC, 'palm-crowns');
  inst(Props.treeCanopy(quality === 'low' ? 1 : 3), Props.mats.foliage(), canopy, 'tree-canopies');
  inst(Props.treeTrunk(), Props.mats.trunk(), trunk, 'tree-trunks');
  world.add(g);
}

main().catch((e) => { window.__onfootError = String((e as Error)?.stack ?? e); const st = document.getElementById('status'); if (st) st.textContent = 'Something went wrong building the page: ' + String((e as Error)?.message ?? e); });

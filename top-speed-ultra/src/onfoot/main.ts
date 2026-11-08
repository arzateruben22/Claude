// Lot 57 on foot: Phase 1 of PROJECT_OC_ON_FOOT.md, a standalone page (not yet the game). Our own fictional taproom
// and yard at the real spot on East Orangewood Avenue in Anaheim, built in code; the rest of the block and the
// Orangewood frontage from OpenStreetMap through Overture (ODbL, credited on screen). You walk it as your driver from
// the game, in first or third person, by touch, keyboard or gamepad, with collisions against every wall, fence,
// table and truck. The sky is the game's (the real sun for the chosen hour); the crowd level is simulated from the
// time and day and labelled so. P1b adds the things to do: tap to go to a seat, a group or a counter; Sit and
// Stand; Order at the bar or a truck window and Pick up what's made (held in your hand afterwards); Join a group of
// regulars and Leave (lot57/doings.ts, lot57/npcs.ts). P1c fills it: forty people (guests in talking groups, standing
// and seated, who arrive and leave with the simulated crowd curve; staff; walkers on the sidewalks), drawn inside the
// phone and desktop budgets (lot57/crowdview.ts). Test hooks: window.__onfoot (see the bottom of this file).
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
import { makeMats, setNight, setUltraMaps } from './lot57/mats';
import { Kit, P2, rand } from './lot57/geom';
import { buildStreets, DATA_ATTRIBUTION } from './lot57/data';
import { buildVenue, Seat, Tree } from './lot57/venue';
import { buildLot, ParkedCars, yourCar } from './lot57/lot';
import { buildTrees } from './lot57/trees';
import { ColliderSet, Collider, exportColliders, rayHit } from './lot57/collide';
import { truckWheel } from './lot57/wheels';
import { WalkGrid, RADIUS } from './lot57/walkgrid';
import { Player, STEP, View, Goal } from './lot57/player';
import { Input, Action } from './lot57/input';
import { Hud, loading, doneLoading } from './lot57/hud';
import { readDriver, driverPerson, eyeHeight } from './lot57/driver';
import * as C from './lot57/clock';
import { ORIGIN, EDGE, PLAN, inVenue, inShed, toLocal, toGame } from './lot57/coords';
import { Items, ItemId, MENUS, formOf } from './lot57/items';
import { Crowd, StaffPost, CrowdCtx, Npc } from './lot57/npcs';
import { Doings, ActLabel } from './lot57/doings';
import { useWorkers } from './lot57/crowdview';
import { serveBuilds } from './lot57/crowd-worker';
import { Embed, MountOptions, mountPage, optionsToParams } from './embed';

type Quality = 'low' | 'high' | 'ultra';
const PRESET: Record<Quality, { shadows: number; post: boolean; bloom: boolean; ao: boolean; msaa: number; maxPR: number; scale: number; lights: number; people: 'phone' | 'high'; tex: number }> = {
  low: { shadows: 0, post: false, bloom: false, ao: false, msaa: 0, maxPR: 1, scale: 0.85, lights: 0, people: 'phone', tex: 512 },
  high: { shadows: 2048, post: true, bloom: true, ao: false, msaa: 4, maxPR: 2, scale: 1, lights: 4, people: 'high', tex: 1024 },
  ultra: { shadows: 4096, post: true, bloom: true, ao: true, msaa: 4, maxPR: 2, scale: 1, lights: 8, people: 'high', tex: 1024 },
};
let q = new URLSearchParams(location.search);
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const sysReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let quality: Quality = (['low', 'high', 'ultra'].includes(q.get('quality') ?? '') ? q.get('quality') : coarse ? 'low' : 'high') as Quality;
let reduced = q.get('motion') === 'reduced' || sysReduced;
/** mounted in the game (mount, below): its hooks to stop, release and drive; null on the page's own */
let embed: Embed | null = null;
const track = <T>(f: () => T): T => (embed ? embed.track(f) : f());

declare global { interface Window { __onfoot?: Record<string, unknown>; __onfootError?: string } }
addEventListener('error', (e) => { window.__onfootError = String(e.message || e); });
addEventListener('unhandledrejection', (e) => { window.__onfootError = String((e as PromiseRejectionEvent).reason); });

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
/** what held a tap-to-go walk, in words for the toast (collider tags and the walk grid's edges) */
const THING: Record<string, string> = {
  car: 'A parked car', gate: 'The gate', door: 'A door', table: 'A table', bench: 'A bench', stool: 'A stool', chair: 'A chair',
  truck: 'A truck', counter: 'The counter', wall: 'A wall', fence: 'The fence', pole: 'A pole', post: 'A post', planter: 'A planter',
  heater: 'A heater', bin: 'A bin', cone: 'A cone', plant: 'A plant', median: 'The median', bollard: 'A bollard', building: 'A building',
  kerb: 'The kerb', edge: 'The edge of the area', sign: 'The sign', game: 'A lawn game', tank: 'A tank', glass: 'The glass', rail: 'A rail',
  tree: 'A palm', board: 'The chalkboard', stand: 'The host stand', shelf: 'A shelf', generator: 'The generator', cage: 'The propane cage',
};
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
  // The game's sky lights the scene through an environment map rendered from its sky over a plain beige ground disc,
  // and that disc doesn't darken at night: every wall here kept a daylight bounce from below at 21:00 (the business
  // park looked floodlit). The page dims that ground with the daylight, at runtime; the game's file is unchanged in
  // Phase 1 (the same fix belongs in Environment.ts when the hangout joins the game).
  const envInternals = env as unknown as { envScene?: THREE.Scene; envDirty?: boolean; envT?: number };
  const envGround = envInternals.envScene?.children.find((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.type === 'CircleGeometry') as THREE.Mesh | undefined;
  const envGroundHex = envGround ? (envGround.material as THREE.MeshBasicMaterial).color.getHex() : 0;
  const dimEnvGround = () => {
    if (!envGround) return;
    (envGround.material as THREE.MeshBasicMaterial).color.setHex(envGroundHex).multiplyScalar(0.03 + 0.97 * env.daylight ** 1.5);
    envInternals.envDirty = true; envInternals.envT = 0;
  };
  env.sun.shadow.camera.layers.enable(1);            // your own body casts a shadow in first person (layer 1)

  // ------------------------------------------------------------------------------------------ build the world
  const steps: [string, number][] = [['Painting the textures', 0.08], ['Laying out Orangewood and the block', 0.2], ['Building the Shed and the yard', 0.38], ['Striping the lot', 0.46], ['Baking the night lights', 0.6], ['Mapping where you can walk', 0.72], ['Your driver', 0.78], ['Your driver, up close', 0.84], ['The regulars and the staff', 0.9], ['Parking cars', 0.96]];
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
  // the olive trees in the yard's planters and the shade trees in the lot's median, grown in code (the palms are the
  // game's own, instanced below)
  const treeTris = buildTrees(kit, mats, [...venue.trees, ...lot.trees]);
  await stage();
  const world = new THREE.Group(); world.name = 'world'; scene.add(world);
  const worldMeshes = kit.finish(world, kit.emitters, true);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; ground.name = 'ground'; world.add(ground);
  // the bulbs (emissive, bloom on High and Ultra; a soft additive glow on every preset), the wires, the lamp glows
  const bulbGeoLow = new THREE.OctahedronGeometry(0.06, 0), bulbGeoHigh = new THREE.SphereGeometry(0.05, 6, 4);
  const bulbGeo = quality === 'low' ? bulbGeoLow : bulbGeoHigh;
  const bulbs = new THREE.InstancedMesh(bulbGeo, mats.bulb, venue.bulbs.length);
  venue.bulbs.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  bulbs.name = 'bulbs'; bulbs.computeBoundingSphere(); world.add(bulbs);
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(venue.bulbs.flatMap((p) => [p.x, p.y, p.z]), 3));
  const glow = new THREE.Points(glowGeo, mats.glow); glow.name = 'bulb-glow'; glow.renderOrder = 5; world.add(glow);
  // the food trucks' wheels: a tyre and a rim at each, instanced (finer on High and Ultra)
  const wheelGeos = [truckWheel(0), null, null] as (ReturnType<typeof truckWheel> | null)[];
  const wheelGeo = (qq: Quality) => { const d = qq === 'low' ? 0 : qq === 'high' ? 1 : 2; return (wheelGeos[d] ??= truckWheel(d as 0 | 1 | 2)); };
  const tyres = new THREE.InstancedMesh(wheelGeo(quality).tyre, mats.tyre, venue.wheels.length), rims = new THREE.InstancedMesh(wheelGeo(quality).rim, mats.rim, venue.wheels.length);
  venue.wheels.forEach((w, i) => { const m4 = new THREE.Matrix4().makeRotationY(w.side > 0 ? 0 : Math.PI).setPosition(w.x, w.y, w.z); tyres.setMatrixAt(i, m4); rims.setMatrixAt(i, m4); });
  for (const [im, n] of [[tyres, 'truck-tyres'], [rims, 'truck-rims']] as [THREE.InstancedMesh, string][]) { im.name = n; im.castShadow = true; im.receiveShadow = true; im.userData.cast = true; im.computeBoundingSphere(); world.add(im); }
  const wireGeo = new THREE.BufferGeometry(); wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(venue.wires, 3));
  const wires = new THREE.LineSegments(wireGeo, mats.wire); wires.name = 'wires'; world.add(wires);
  const lampPts = kit.emitters.filter((e) => e.ch === 1 && (e.down ?? 0) > 1.5).map((e) => [e.x, e.y + 0.05, e.z]);
  const lampGeo = new THREE.BufferGeometry(); lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPts.flat(), 3));
  const lampGlow = new THREE.Points(lampGeo, mats.lampGlow); lampGlow.name = 'lamp-glow'; lampGlow.renderOrder = 5; world.add(lampGlow);
  // the pools of light on the ground under the same heads (a disc about as wide as the pole is tall), one draw call
  {
    const P: number[] = [], U: number[] = [];
    for (const [x, y, z] of lampPts) {
      const r = 0.95 * y, h = 0.17;
      P.push(x - r, h, z - r, x - r, h, z + r, x + r, h, z + r, x - r, h, z - r, x + r, h, z + r, x + r, h, z - r);
      U.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    pg.computeBoundingSphere();
    const pools = new THREE.Mesh(pg, mats.pool); pools.name = 'lamp-pools'; pools.renderOrder = 4; world.add(pools);
  }
  // palms along Orangewood (the game's own models), instanced
  const trees: Tree[] = [...venue.trees, ...lot.trees, ...streets.palms.map((p) => ({ x: p.x, z: p.z, y: 0.15, s: p.h, kind: 'palm' as const }))];
  plantTrees(world, trees, quality);
  // parked cars (how many follows the simulated crowd) and your car
  // parked cars are background: the game's phone-quality traffic models up close (its high-quality ones on Ultra),
  // 150-triangle stand-ins beyond
  const carQuality = (qq: Quality) => (qq === 'ultra' ? 'high' : 'phone') as 'phone' | 'high';
  // (High: 24, so third person with the close-up driver stays inside 700k triangles; Ultra: 40, and the rest detailed)
  const nearCars = (qq: Quality) => (qq === 'low' ? 12 : qq === 'high' ? 24 : 40);
  let parked = new ParkedCars(lot.stalls, carQuality(quality), nearCars(quality), quality === 'ultra');
  let parkedFill: [number, number] = [0, 0];
  world.add(parked.group);
  const choice = readDriver(q);
  const carId = (['rossini-gt', 'rossini-brio', 'rossini-corsa', 'vela-e', 'oc-hyper'].includes(choice.car) ? choice.car : 'rossini-gt') as 'rossini-gt';
  const mine = yourCar(lot.mine, carId, embed?.paint, PRESET[quality].people);
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
  // (the people standing in groups are planned round, not collided with: refreshPeople, below)
  let peopleNow: () => { x: number; z: number; r: number }[] = () => [];
  const refreshDynamic = () => { set.all = set.all.filter((o) => !o.dyn || dynamic.includes(o)); for (const c of parked.colliders) set.all.push(c); set.rebuild(); grid.computeFree(set, true, peopleNow()); };
  set.rebuild(); grid.computeFree(set);
  await stage();

  // ------------------------------------------------------------------------------------------ you
  // Your driver's levels of detail: LOD 1 (patio distance) always; on High and Ultra the close-up LOD 0 for third
  // person, built while the page loads (it takes seconds, so never in the middle of play: a later switch to High or
  // Ultra builds it behind a toast and keeps LOD 1 until it's done). On High the close-up body's shadow comes from LOD 1
  // (layer 1, which only the sun's shadow camera sees), so it costs its triangles once; on Ultra it casts its own.
  const personOpts = driverPerson(choice);
  let person: Person | null = null;
  let g1: THREE.Object3D | null = null, lod0Ready = false, lod0Pending = false, avatarLod = 1, avatarKey = -1;
  const wantsLod0 = (qq: Quality) => qq !== 'low';
  const buildAvatar = (qq: Quality) => {
    if (person) { scene.remove(person.group); person.dispose(); }
    const o = { ...personOpts, quality: PRESET[qq].people, lod: 1 as const };
    person = buildPerson(o);
    g1 = person.group.getObjectByName('lod1')?.parent ?? null;
    scene.add(person.group);
    lod0Ready = false; avatarLod = 1; avatarKey = -1;
    return person;
  };
  const buildLod0 = () => {
    const p = person; if (!p || lod0Ready) return;
    p.setLod(0); p.setLod(1);
    lod0Ready = true; avatarKey = -1;
  };
  buildAvatar(quality);
  await stage();
  if (wantsLod0(quality)) buildLod0();
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

  // ------------------------------------------------------------------------------------------ the regulars and staff
  // A few groups of regulars talking in circles and the staff at the bar and the trucks (lot57/npcs.ts), built by
  // the people builder at load (about a second each on a desktop CPU), so nothing is built mid-play.
  const items = new Items(quality);
  // (the clock first: the guests dress for the hour they're built at)
  let live = !(q.has('day') || q.has('hour'));
  let clock: C.ClockState = live ? C.liveClock() : { day: C.parseDay(q.get('day') ?? 'Sat'), hour: clamp(Number(q.get('hour') ?? 21), 0, 23.99) };
  const posts: StaffPost[] = venue.counters.map((c) => ({ role: c.id === 'bar' ? 'bartender' : 'cook', counter: c.id, x: c.staff.x, y: c.staff.y, z: c.staff.z, face: c.staff.face, z0: c.staff.z0, z1: c.staff.z1, workFace: c.staff.workFace, workX: c.staff.workX, seeX: c.x + c.side * 0.3 }));
  // (captions and reply chips go to the HUD, which is made below: wireCrowd)
  let wireCrowd: (c: Crowd) => void = () => {};
  const crowdCtx: CrowdCtx = {
    seats: venue.seats,
    plan: (ax, az, bx, bz) => grid.path(ax, az, bx, bz),
    height: (x, z) => grid.height(x, z),
    yourSeat: () => player.seat,
    sidewalks: streets.sidewalks,
    moved: () => grid.computeFree(set, true, peopleNow()),
  };
  /** the crowd for a preset: built here at load (with the progress on the loading screen), or at once on a preset
   *  switch (the page freezes for it, as before) */
  const makeCrowd = async (qq: Quality, progress?: (k: number, n: number) => Promise<void>) => {
    const c = new Crowd(items, PRESET[qq].people, qq === 'ultra', renderer, qq);
    await c.build(posts, crowdCtx, clock.hour >= 18 || clock.hour < 7, progress);
    c.car = choice.car; scene.add(c.root); wireCrowd(c); return c;
  };
  let crowd = await makeCrowd(quality, async (k, n) => { loading(0.9 + 0.06 * (k / n), `The regulars and the staff (${k} of ${n})…`); await nextFrame(); });
  scene.add(camera);                                   // the first-person held item rides on the camera
  const peopleBlock: { x: number; z: number; r: number }[] = [];
  await stage();

  // ------------------------------------------------------------------------------------------ the clock and crowd
  let simDate = C.anaheimDate(clock.day, clock.hour);
  let open = false, night = 0, share = 0, level: C.CrowdLevel = 'Closed', liveT = 0;
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null;
  /** bloom is for the lights after dark: by day a sunlit white car or wall is over the night threshold and smeared
   *  into a glowing box, so the threshold rises and the strength falls with the daylight */
  const tuneBloom = () => {
    if (!bloom) return;
    bloom.threshold = lerp(4.5, 0.88, night); bloom.strength = lerp(0.12, 0.32, night);
  };
  const hud = track(() => new Hud());
  let inputRef: Input | null = null;
  const rnd = rand(4242);
  const doings = new Doings({
    player, venue, set, items, hud, scene, camera, crowd: () => crowd, door: lot.door,
    refreshPeople: () => { grid.computeFree(set, true, peopleNow()); },
    inputEnabled: (on) => { if (inputRef) inputRef.enabled = on && !hud.paused; },
    focusView: () => canvas.focus(), rand: rnd,
  });
  peopleNow = () => crowd.blockers(peopleBlock);
  // what hides a person from you: something full height (a wall, a building, a truck's body, a tank, a door), but
  // not glass (the tank room's window), a wall's stretch with a window in it (the storefront, the tank-room window in
  // the east wall), the low planter walls, fences and gates you see over, or a parked car (1.4 m: you see a head over
  // it; cars are 'tall' only to the third-person camera). (Acting on something is stricter: doings.ts blocksSight.)
  const blocksView = (o: Collider) => o.tall && o.tag !== 'glass' && o.tag !== 'car' && !o.see && !(o.k === 'circ' && o.r < 0.5);
  wireCrowd = (c) => {
    c.onCaption = (who, text, sec) => hud.caption(who, text, sec); c.onReplies = (r) => hud.replies(r); c.occluded = (ax, az, bx, bz) => set.ray(ax, az, bx, bz, blocksView) < 1;
    // the impostors carry no lighting of their own: the day's light, and after dark the string lights in the yard,
    // the Shed's pendants inside, the street lamps outside (the same levels as the venue's baked night light)
    c.view.light = (x, z, out) => {
      const inside = inShed(x, z), yard = inVenue(x, z), d = env.daylight;
      // (matched by eye against the bodies side by side, by day and at night: tests/out/onfoot/onfoot-1280x720-crowd-cal-*)
      const lamp = open ? (inside ? 0.4 + 0.26 * night : yard ? 0.66 * night : 0.2 * night) : 0.06 * night;
      const sky = 0.1 + 1.12 * d * (inside ? 0.5 : 1);
      return out.setRGB(sky + lamp, sky * 0.98 + lamp * 0.72, sky * 0.95 + lamp * 0.47);
    };
    // the bodies are lit by the sky and (High, Ultra) a few real lights near you; after dark the venue's lamps add the
    // same warm fill as on what you hold (lot57/crowdview.ts withFill)
    c.view.lamp = (x, z, out) => { const k = lampLevel(x, z); return out.setRGB(k, 0.72 * k, 0.45 * k); };
  };
  /** the venue's lamps after dark at (x, z) (local), as a fill on what's lit there that the baked light can't reach
   *  (held items, people): the string lights in the yard, the Shed's pendants, the street lamps outside; less where
   *  the real lights near you (High, Ultra) already add their own */
  const lampLevel = (x: number, z: number) => {
    const inside = inShed(x, z), yard = inVenue(x, z);
    return (open ? (inside ? 0.16 + 0.22 * night : yard ? 0.34 * night : 0.08 * night) : 0.04 * night) * (pointLights.length ? 0.55 : 1);
  };
  wireCrowd(crowd);
  // Ultra: the first of each group up close (lot57/npcs.ts buildCloseUps), built now rather than mid-play
  let closeUpsPending = false;
  const wantCloseUps = (qq: Quality) => {
    if (qq !== 'ultra' || crowd.groups.slice(0, 2).every((g) => g.members[0]?.closeUp) || closeUpsPending) return;
    closeUpsPending = true; hud.toast('Building the regulars up close…', 3);
    requestAnimationFrame(() => requestAnimationFrame(() => { crowd.buildCloseUps(); closeUpsPending = false; }));
  };
  if (quality === 'ultra') crowd.buildCloseUps();
  const stateMeshes = (prefix: string) => world.children.filter((o) => o.name.startsWith(prefix));
  const applyClock = (firstTime = false, settle = true) => {
    simDate = live ? new Date() : C.anaheimDate(clock.day, clock.hour);
    if (live) clock = C.liveClock();
    const wasOpen = open;
    open = C.isOpen(clock.day, clock.hour); share = C.crowdShare(clock.day, clock.hour); level = C.crowdLevel(clock.day, clock.hour);
    // (open or closed changed: a toast that said it was closed is out of date, so it goes; a new one may follow below)
    if (!firstTime && open !== wasOpen) hud.clearToast(/closed|opens/i);
    env.update(1000, simDate); dimEnvGround(); env.update(1000, simDate);
    night = Math.pow(1 - env.daylight, 0.75);
    setNight(mats, night, open);
    tuneBloom();
    for (const o of stateMeshes('when-open')) o.visible = open;
    for (const o of stateMeshes('when-closed')) o.visible = !open;
    for (const c of venue.closedOnly) c.on = !open;
    for (const c of venue.openOnly) c.on = open;
    // the simulated crowd: the parties the hour calls for (settled at once when the clock is set, arriving and leaving
    // over the minutes on the live clock), the staff, the walkers; nobody inside when it's closed
    if (!open) doings.cancelAll();
    crowd.setCrowd(open, share, night > 0.5, clock.hour, settle);
    mats.readerTex.draw(open ? `OPEN TILL ${C.closesAt(clock.day, clock.hour)}` : 'CLOSED', open ? 'Taproom · Yard · Trucks' : `Opens ${C.opensAt(clock.day, clock.hour)}`, open);
    // parked cars: a few overnight, more as the simulated crowd grows (seeded by the day and hour)
    parkedFill = [open ? clamp(0.12 + share * 0.92, 0, 0.96) : 0.05, clock.day * 100 + Math.floor(clock.hour)];
    parked.fill(...parkedFill);
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
  const pointLights: THREE.PointLight[] = [];
  // (and a light under each truck's awning, so the cook at the window is lit for you, as the baked light lights the truck)
  const lightCandidates = [...venue.lightSpots.map((s) => ({ ...s, c: 0xffb56a, k: 0.9, inside: false })), ...venue.heaters.map((h) => ({ x: h.x, y: h.y, z: h.z, i: 6, c: 0xff8a40, k: 0.6, inside: false })),
    ...venue.counters.filter((c) => c.id !== 'bar').map((c) => ({ x: c.x - 0.25, y: 2.7, z: (c.z0 + c.z1) / 2, i: 8, c: 0xffd2a0, k: 1.0, inside: false })),
    ...venue.insideLights.map((s) => ({ ...s, c: 0xffc58a, k: 0.8, inside: true }))];
  const applyQuality = (qq: Quality, rebuildPeople: boolean) => {
    const P = PRESET[qq];
    quality = qq;
    env.setQuality(P.shadows, 2600);
    renderer.shadowMap.enabled = P.shadows > 0;
    world.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.cast === undefined) m.userData.cast = m.castShadow; if (m.isMesh) m.castShadow = P.shadows > 0 && !!m.userData.cast && (qq === 'ultra' || !m.name.endsWith('venue-plants')); });
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
      if (P.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.88); tuneBloom(); c.addPass(bloom); }
      c.addPass(new OutputPass());
      c.setPixelRatio(pr); c.setSize(innerWidth, innerHeight);
      composer = c;
    }
    // a few real lights near you on High and Ultra (the yard's strings and heaters), so your driver is lit by them
    while (pointLights.length > P.lights) { const l = pointLights.pop()!; scene.remove(l); l.dispose(); }
    while (pointLights.length < P.lights) { const l = new THREE.PointLight(0xffb56a, 0, 15, 2); l.castShadow = false; scene.add(l); pointLights.push(l); }
    crowd.ultra = qq === 'ultra'; crowd.view.setTier(qq); items.setQuality(qq);
    if (rebuildPeople) {
      // the regulars and staff from the other set of people (a few seconds: say so first)
      doings.cancelAll();
      scene.remove(crowd.root); crowd.dispose();
      // (no progress callback: the build runs straight through, so the new crowd is in place before the next frame)
      void makeCrowd(qq).then((c) => { crowd = c; crowd.setCrowd(open, share, night > 0.5, clock.hour, true); if (qq === 'ultra') crowd.buildCloseUps(); refreshDynamic(); });
      buildAvatar(qq); player.person = person;
      for (const o of [...world.children]) if (o.name === 'trees') world.remove(o);
      plantTrees(world, trees, qq);
    }
    avatarKey = -1;
    wantCloseUps(qq);
    if (wantsLod0(qq) && !lod0Ready && !lod0Pending) {
      // the close-up body isn't built yet (you came from Low): say so, let the toast paint, then build it
      lod0Pending = true; hud.toast('Building your driver up close…', 3);
      requestAnimationFrame(() => requestAnimationFrame(() => { buildLod0(); lod0Pending = false; }));
    }
    // detail tiers: 'lo-' meshes on Low and High, 'ultra-' meshes on Ultra (venue.ts); Ultra's normal maps
    // ('phone-' on Low only, 'high-' on High only, 'hq-' on High and Ultra: the trees' densities, trees.ts)
    for (const m of worldMeshes) {
      const n = m.name;
      if (n.startsWith('ultra-')) m.visible = qq === 'ultra'; else if (n.startsWith('lo-')) m.visible = qq !== 'ultra';
      else if (n.startsWith('phone-')) m.visible = qq === 'low'; else if (n.startsWith('high-')) m.visible = qq === 'high';
      else if (n.startsWith('hq-')) m.visible = qq !== 'low';
    }
    setUltraMaps(mats, qq === 'ultra');
    // the cheaper bulbs and wheels, and fewer detailed parked cars, on Low
    bulbs.geometry = qq === 'low' ? bulbGeoLow : bulbGeoHigh;
    tyres.geometry = wheelGeo(qq).tyre; rims.geometry = wheelGeo(qq).rim;
    if (parked.quality !== carQuality(qq) || parked.farDetail !== (qq === 'ultra')) {
      // the same cars in the same stalls (same seed), built from the other set of models
      world.remove(parked.group); parked.dispose();
      parked = new ParkedCars(lot.stalls, carQuality(qq), nearCars(qq), qq === 'ultra'); world.add(parked.group);
      parked.fill(...parkedFill); refreshDynamic();
    }
    parked.near = nearCars(qq); parked.nearDist = qq === 'low' ? 45 : Infinity; parked.update(player.x, player.z, true);
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
  // (each candidate is tested once against the ray, into a scratch list: no allocation while the sun is on screen)
  const flareNear: Collider[] = [];
  env.setFlareOccluders([], [], (o, d) => {
    const flat = Math.hypot(d.x, d.z); if (flat < 1e-3) return false;
    const L = 80, bx = o.x + (d.x / flat) * L, bz = o.z + (d.z / flat) * L;
    const near = set.query(Math.min(o.x, bx) - 1, Math.min(o.z, bz) - 1, Math.max(o.x, bx) + 1, Math.max(o.z, bz) + 1, flareNear);
    for (let i = 0; i < near.length; i++) {
      const c = near[i], h = HEIGHT[c.tag]; if (!h || !c.on) continue;
      const t = rayHit(c, o.x, o.z, bx, bz);
      if (t < 1 && o.y + (d.y / flat) * t * L < h) return true;
    }
    return false;
  });

  // ------------------------------------------------------------------------------------------ input, HUD, actions
  const input = track(() => new Input(canvas, { stick: hud.stick, knob: hud.knob, car: hud.car }));
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
  /** what the action buttons offer here (lot57/doings.ts: Pick up, Leave, Stand, Drive, Order, Join, Sit) */
  const available = () => doings.available();
  const doAction = (which: 1 | 2): string | null => { const a = available()[which - 1]; if (a === 'Drive' && embed?.onDrive) { embed.onDrive(); return 'drive'; } return doings.act(a); };
  const walkToCar = (skip: boolean) => {
    if (skip) { player.place(lot.door.x, lot.door.z); player.yaw = Math.PI; showPath(null); return true; }
    const p = player.goTo(lot.door.x, lot.door.z); showPath(p);
    if (!p) hud.toast('No way through to your car from here.');
    return !!p;
  };
  const setView = (v?: View) => { player.view = v ?? (player.view === 'first' ? 'third' : 'first'); hud.setView(player.view); return player.view; };
  hud.setView(player.view); hud.setMotion(reduced);
  hud.onAct = (w) => { doAction(w); canvas.focus(); };
  hud.onView = (v) => setView(v);
  hud.onQuality = (qq) => { if (qq !== quality) { const rebuild = PRESET[qq].people !== PRESET[quality].people; applyQuality(qq, rebuild); } };
  hud.onClock = (c) => { live = c.live; if (!c.live) clock = { day: c.day, hour: c.hour }; applyClock(); };
  hud.onMotion = (rm) => { reduced = rm; player.reducedMotion = rm; hud.setMotion(rm); };
  hud.onPause = (on) => { input.enabled = !on && !hud.orderOpen; };
  inputRef = input;
  const ray = new THREE.Raycaster();
  // what a tap's ray can land on: the visible, opaque world, but not the trees' crowns and limbs (a tap through the
  // leaves goes to the ground beyond them)
  const tapMeshes = () => worldMeshes.filter((m) => m.visible && !(m.material as THREE.Material).transparent && !/-(leaves|bark)$/.test(m.name));
  /**
   * A tap on the screen: a seat walks you there and sits you down; a person walks you up to their group (or, staff,
   * to their counter); the bar or a truck's window walks you there and opens the order sheet; anywhere else on the
   * ground walks you there. Only what you can see counts: a seat or a person behind a wall is farther along the ray
   * than the wall it hits first, so the tap goes to the wall's foot instead (nothing is done through a wall).
   */
  let lastTap: { kind: 'seat' | 'group' | 'counter' | 'ground' | 'none'; id: string | number | null } = { kind: 'none', id: null };
  const counterAt = (p: THREE.Vector3) => venue.counters.find((cs) => Math.abs(p.x - cs.x) < 0.9 && p.z > cs.z0 - 0.2 && p.z < cs.z1 + (cs.id === 'bar' ? 0.2 : 1.3) && p.y > 0.6 && p.y < 3.2) ?? null;
  const walkToCounter = (cs: (typeof venue.counters)[number]) => {
    lastTap = { kind: 'counter', id: cs.id };
    if (doings.inRange(cs)) { doings.startOrder(cs); return [[player.x, player.z]] as P2[]; }
    const z = clamp(player.z, cs.z0 + 0.3, cs.z1 - 0.3);
    return tapGo(cs.x + cs.side * 1.1, z, { counter: cs.id });
  };
  const tapScreen = (sx: number, sy: number) => {
    const ndc = new THREE.Vector2((sx / canvas.clientWidth) * 2 - 1, -(sy / canvas.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, v = new THREE.Vector3();
    const hits = ray.intersectObjects(tapMeshes(), false), h = hits[0], tWorld = h ? h.distance : Infinity;
    // a seat the tap lands on (the ray's first hit is on or right by it) or passes very close to, no farther than
    // what the ray hits first (its own stool or bench, at most)
    let seat: Seat | null = null, sd = 0.45, st = Infinity;
    for (const s of venue.seats) {
      if (crowd.taken.has(s.id)) continue;
      v.set(s.x - o.x, s.y + 0.15 - o.y, s.z - o.z); const t = v.dot(d); if (t < 0.3 || t > 40 || t > tWorld + 0.45) continue;
      const dist = v.addScaledVector(d, -t).length(), k = 1 + t * 0.02;
      const onIt = h ? Math.hypot(h.point.x - s.x, h.point.y - s.y - 0.15, h.point.z - s.z) < 0.7 : false;
      if (dist < sd * k && (onIt || dist < 0.3 * k)) { sd = dist; seat = s; st = t; }
    }
    // a person, also in front of the first hit
    const who = crowd.hit(ray.ray, Math.min(tWorld + 0.2, 60));
    if (who && (!seat || who.t < st)) {
      const g = who.npc.group;
      if (g && !g.seated && g.ready) {
        lastTap = { kind: 'group', id: g.id };
        const a = Math.atan2(player.x - g.cx, player.z - g.cz), r = g.r + 0.8;
        return tapGo(g.cx + Math.sin(a) * r, g.cz + Math.cos(a) * r, null, true);
      }
      const cs = venue.counters[crowd.staff.indexOf(who.npc)];
      if (cs) return walkToCounter(cs);
      // anyone else (a seated guest, the host, the busser, a walker): walk up beside them
      const n = who.npc, a = Math.atan2(player.x - n.x, player.z - n.z);
      lastTap = { kind: 'ground', id: null };
      return tapGo(n.x + Math.sin(a) * 1.0, n.z + Math.cos(a) * 1.0, null);
    }
    if (seat) { lastTap = { kind: 'seat', id: seat.id }; return tapGo(seat.ax, seat.az, { seat }); }
    // the bar or a truck's window
    if (h) { const cs = counterAt(h.point); if (cs && open) return walkToCounter(cs); }
    // the ground, or the foot of whatever wall the ray hits first
    let gx: number, gz: number;
    if (h && h.face && h.face.normal.y < 0.6) { const back = h.point.clone().addScaledVector(d, -0.5); gx = back.x; gz = back.z; }
    else if (h) { gx = h.point.x; gz = h.point.z; }
    else { if (d.y >= -1e-3) return null; const t = (0.0 - o.y) / d.y; gx = o.x + d.x * t; gz = o.z + d.z * t; }
    lastTap = { kind: 'ground', id: null };
    return tapGo(gx, gz, null);
  };
  const tapGo = (x: number, z: number, goal: Goal | null, keep = false) => {
    if (!keep && (doings.joined || doings.pending)) doings.leave();
    const p = player.goTo(x, z, goal);
    showPath(p);
    if (!p) hud.toast("Can't get there from here.", 2);
    hud.fadeHint();
    return p;
  };

  // ------------------------------------------------------------------------------------------ the loop
  let frames = 0, simMs = 0, crowdMs = 0, frameMs = 0, lastT = performance.now(), acc = 0, edgeT = 0, hintT = 6, kerbT = 0;
  const stats = { calls: 0, tris: 0 };
  const firstVisit = (() => { try { return !localStorage.getItem('lot57.seen'); } catch { return true; } })();
  if ((!firstVisit && !q.has('hint')) || q.get('hint') === '0') hud.hint(false);
  // the hint speaks to what you hold: thumbs on a touch screen, keys and a mouse on a desktop
  if (!coarse) { const el = document.getElementById('hint'); if (el) el.textContent = 'W A S D to walk · drag to look · click to go · E to act'; }
  try { localStorage.setItem('lot57.seen', '1'); } catch { /* a convenience */ }
  const _eye = new THREE.Vector3(), _follow = new THREE.Vector3(), liveDate = new Date();
  const shownAct: [string | null, string | null] = [null, null];
  hud.setActions(null, null);
  // a few real lights near you on High and Ultra: the nearest candidates, re-ranked only when you've moved a metre or
  // gone in or out of the Shed (a partial insertion sort into two preallocated lists)
  const rankIdx: number[] = [], rankD: number[] = [];
  let rankX = Infinity, rankZ = Infinity, rankIn = false, rankK = -1;
  const rankLights = (ex: number, ez: number, inside: boolean) => {
    const k = pointLights.length;
    if (Math.hypot(ex - rankX, ez - rankZ) < 1 && inside === rankIn && k === rankK) return;
    rankX = ex; rankZ = ez; rankIn = inside; rankK = k; rankIdx.length = 0; rankD.length = 0;
    for (let i = 0; i < lightCandidates.length && k > 0; i++) {
      const c = lightCandidates[i]; if (c.inside !== inside) continue;
      const d = Math.hypot(c.x - ex, c.z - ez);
      let j = rankIdx.length;
      if (j === k) { if (d >= rankD[k - 1]) continue; j = k - 1; } else { rankIdx.push(0); rankD.push(0); }
      while (j > 0 && rankD[j - 1] > d) { rankIdx[j] = rankIdx[j - 1]; rankD[j] = rankD[j - 1]; j--; }
      rankIdx[j] = i; rankD[j] = d;
    }
  };
  let fixedCam: { p: THREE.Vector3; t: THREE.Vector3 } | null = null;
  const camQ = q.get('cam')?.split(',').map(Number);
  if (camQ && camQ.length === 6) { const [a, b] = [toLocal(camQ[0], camQ[2]), toLocal(camQ[3], camQ[5])]; fixedCam = { p: new THREE.Vector3(a[0], camQ[1], a[1]), t: new THREE.Vector3(b[0], camQ[4], b[1]) }; }

  const simStep = (stick: { x: number; y: number; run: boolean }) => { player.step(stick); };
  /** the world's own time: the regulars, the staff, the order and the conversation (rendered or not) */
  const worldStep = (dt: number, cam: THREE.Camera | null) => {
    player.eyePos(crowd.you);
    crowd.update(dt, cam, player);
    doings.tick(dt);
    player.soft = crowd.soft(player.soft);
  };
  /** which level of detail shows, on which layer, and what casts the shadow: only when the view or preset changes */
  const applyAvatar = (third: boolean) => {
    const p = person; if (!p) return;
    const close = third && lod0Ready && wantsLod0(quality), ultra = quality === 'ultra';
    p.setLod(close ? 0 : 1); avatarLod = close ? 0 : 1;
    p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.layers.set(third ? 0 : 1); m.castShadow = !close || ultra; m.receiveShadow = true; } });
    if (close && !ultra && g1) { g1.visible = true; g1.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.layers.set(1); m.castShadow = true; } }); }
  };
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
    // holding something: the right hand comes up with it (the shadow shows it in first person too)
    doings.poseAvatar(p, player.heading, player.view === 'third' || !!fixedCam);
    const third = player.view === 'third', key = (third ? 1 : 0) + (lod0Ready ? 2 : 0) + (quality === 'low' ? 0 : quality === 'high' ? 4 : 8);
    if (key !== avatarKey) { avatarKey = key; applyAvatar(third); }
  };
  // The background gives way to the people: when a frame comes in over the preset's triangle budget, or people near
  // you were drawn as impostors for want of triangles, fewer parked cars get their detailed model (the rest keep the
  // 150-triangle stand-in) from the next frame; they come back slowly once there's plenty of room. (Calls don't
  // change: the cars are instanced.) Ultra has no budget.
  const TRI_BUDGET: Record<Quality, number> = { low: 250000, high: 700000, ultra: Infinity };
  let carRoomT = 0;
  const makeRoom = () => {
    const B = TRI_BUDGET[quality]; if (!isFinite(B)) return;
    const perCar = quality === 'low' ? 2600 : 5000;            // a detailed parked car less its stand-in (High: with its shadow)
    const need = Math.max(stats.tris - (B - 1500), crowd.view.stats.starved);
    carRoomT -= 1;
    if (need > 0 && parked.near > 2) { parked.near = Math.max(2, parked.near - Math.ceil(need / perCar)); parked.update(player.x, player.z, true); carRoomT = 90; }
    else if (need <= 0 && carRoomT <= 0 && parked.near < nearCars(quality) && stats.tris < B - 20000 - 3 * perCar) { parked.near++; parked.update(player.x, player.z, true); carRoomT = 30; }
  };
  const render = () => {
    // how the crowd is drawn this frame, inside what the rest of the scene left of the budget last frame
    const tc = performance.now();
    crowd.draw(camera, stats);
    crowdMs += performance.now() - tc;
    renderer.info.reset();
    if (composer) composer.render(); else renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    env.renderFlare();
    makeRoom();
  };
  let frozen = false;
  const frame = (now: number) => {
    if (embed?.dead) return;
    requestAnimationFrame(frame);
    if (frozen) { lastT = now; return; }
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const tf = performance.now();
    const look = input.poll(dt);
    for (let i = 0; i < input.actions.length; i++) handleAction(input.actions[i]);
    input.actions.length = 0;
    for (let i = 0; i < input.taps.length; i++) if (!hud.paused) tapScreen(input.taps[i].x, input.taps[i].y);
    input.taps.length = 0;
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
      // a tap-to-go walk given up (something moved into the way after the path was planned): say what
      if (player.gaveUp) { hud.toast(`${THING[player.gaveUp.by] ?? 'Something'} is in the way. Stopped here.`, 3.5); player.gaveUp = null; showPath(null); }
    }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0 && hud.hintVisible) hud.fadeHint(); }
    if (live) { liveT -= dt; if (liveT <= 0) { liveT = 60; applyClock(false, false); } }
    // (the people's CPU this frame: their talk, walks and animation here, how they're drawn in render())
    crowdMs = 0;
    if (!hud.paused) { const tw = performance.now(); worldStep(dt, camera); crowdMs = performance.now() - tw; }
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
    // what you hold, in the corner of the first-person view; and the light on it (the string lights after dark,
    // the Shed's pendants inside), as the venue's baked night light does
    doings.placeFirst(player.view === 'first' && !fixedCam, reduced, dt);
    { const k = lampLevel(player.x, player.z); items.lamp.value.setRGB(1.0 * k, 0.72 * k, 0.45 * k); }
    // the sky, the sun's shadow box round you, the flare
    env.update(dt, live ? (liveDate.setTime(Date.now()), liveDate) : simDate);
    env.follow(_follow.set(player.x, player.y, player.z), camera, now / 1000, dt);
    // real lights near you (High and Ultra), only once the strings are lit
    if (pointLights.length) {
      // the yard's strings and heaters light up after dark; the Shed's pendants are on whenever it's open; the lights
      // inside count only when you're inside (and the yard's only when you're out), so walls don't leak light
      const eye = player.eyePos(_eye), inside = inShed(player.x, player.z);
      rankLights(eye.x, eye.z, inside);
      for (let i = 0; i < pointLights.length; i++) {
        const l = pointLights[i], ci = rankIdx[i];
        if (ci === undefined) { l.intensity = 0; continue; }
        const c = lightCandidates[ci], d = Math.hypot(c.x - eye.x, c.z - eye.z);
        const lit = !open ? 0 : c.inside ? 0.35 + 0.65 * night : night;
        l.position.set(c.x, c.y, c.z); l.color.setHex(c.c); l.intensity = lit * c.k * clamp(c.i / 10, 0.4, 2.5) * 9 * clamp(1.4 - d / 30, 0, 1);
      }
    }
    const av = available();
    if (av[0] !== shownAct[0] || av[1] !== shownAct[1]) { shownAct[0] = av[0]; shownAct[1] = av[1]; hud.setActions(av[0], av[1]); }
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
    else if (a === 'stand') { if (hud.orderOpen) doings.closeSheet(); else if (doings.joined || doings.pending) doings.leave(); else if (player.seat) player.stand(); }
  };

  // ------------------------------------------------------------------------------------------ test hooks
  const G = (lx: number, lz: number) => { const [x, z] = toGame(lx, lz); return { x: +x.toFixed(3), z: +z.toFixed(3) }; };
  const L = (gx: number, gz: number) => toLocal(gx, gz);
  const hooks = {
    ready: false,
    frames: 0,
    buildMs: 0,
    attribution: DATA_ATTRIBUTION,
    /** set the simulated clock: day 0-6 (Sunday 0) or a name, hour 0-24; `ms` is how long setting it took (the crowd
     *  settling, posed at once) */
    setClock(day: number | string, hour: number) { live = false; clock = { day: C.parseDay(day), hour: clamp(hour, 0, 23.99) }; const t = performance.now(); applyClock(); return { ...hooks.clock(), ms: +(performance.now() - t).toFixed(2) }; },
    liveClock() { live = true; applyClock(); return hooks.clock(); },
    clock() { return { day: clock.day, hour: clock.hour, label: C.fmtClock(clock), open, level, share: +share.toFixed(3), night: +night.toFixed(3) }; },
    setQuality(qq: Quality) { if (!PRESET[qq]) throw new Error('quality: low, high or ultra'); const rebuild = PRESET[qq].people !== PRESET[quality].people; applyQuality(qq, rebuild); return quality; },
    stats() {
      const cs = crowd.stats();
      return {
        // the people (P1c): everyone out now, the guests, those inside the fence, the groups, who's sitting, who's
        // walking (arriving, leaving, the sidewalks, the busser's rounds), the staff; how they're drawn (bodies,
        // impostors, their triangles and calls, shadow passes included) and what the rest of the scene drew
        npcs: cs.npcs, guests: cs.guests, inside: cs.inside, groups: cs.groups, talking: cs.talking, seated: cs.seated, walkers: cs.walkers, street: cs.street, staff: cs.staff,
        npcsDrawn: cs.drawn, bodies: cs.bodies, impostors: cs.impostors, lod0: cs.lod0, lod1: cs.lod1, lod2: cs.lod2, npcShadows: cs.shadows, heldDrawn: cs.heldDrawn,
        npcTris: cs.tris, npcCalls: cs.calls, venueTris: cs.venueTris, venueCalls: cs.venueCalls,
        crowdBuildMs: cs.buildMs, workerMs: cs.workerMs, workerErrors: cs.workerErrors, workers: cs.workers, lod1Built: cs.lod1Built, lod1Pending: cs.lod1Pending, paintMs: cs.paintMs, atlas: cs.atlas, crowdTarget: cs.target, routeFails: cs.routeFails, seatsTaken: cs.taken,
        holding: doings.held ? doings.held.id : null,
        // (simMs: your own steps; crowdMs: the people's talk, walks, animation and drawing choices; both CPU, last frame)
        drawCalls: stats.calls, calls: stats.calls, triangles: stats.tris, simMs: +simMs.toFixed(3), crowdMs: +crowdMs.toFixed(3), frameMs: +frameMs.toFixed(1),
        // (crowdMs in parts: talk, move, anim (animN people), allot, pump, post (postN posed late); the rest of
        // crowdMs is the order and the talk with you (doings) and the soft bodies you ease past)
        crowdParts: { ...Object.fromEntries(Object.entries(crowd.prof).map(([k, v]) => [k, +v.toFixed(3)])), lastExpand: grid.lastExpand, lastPullMs: +grid.lastPullMs.toFixed(3), gridN: grid.nx * grid.nz },
        quality, view: player.view, frames, open, crowd: level, share: +share.toFixed(3),
        parkedCars: parked.count, seats: venue.seats.length, colliders: set.all.filter((o) => o.on).length,
        textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length ?? 0,
        avatar: person ? { lod: avatarLod, ...(() => { const s = person!.stats(); return { tris: s.tris, calls: s.calls }; })() } : null,
        pixelRatio: renderer.getPixelRatio(), rescues: player.rescues, parkedDetailed: parked.near, peopleStarved: crowd.view.stats.starved,
        trees: { tris: quality === 'low' ? treeTris.phone : quality === 'high' ? treeTris.high : treeTris.ultra },
      };
    },
    /** stand at (x, z), game coordinates, or the nearest free spot to it; returns where you are */
    go(x: number, z: number) { const [lx, lz] = L(x, z); player.seat = null; showPath(null); const ok = player.place(lx, lz); return ok ? G(player.x, player.z) : null; },
    /** tap to go to a ground point (game coordinates): the path's waypoints, or null */
    tap(x: number, z: number) { const [lx, lz] = L(x, z); const p = tapGo(lx, lz, null); return p ? { waypoints: p.map(([a, b]) => G(a, b)), length: +p.reduce((s, c, i) => (i ? s + Math.hypot(c[0] - p[i - 1][0], c[1] - p[i - 1][1]) : 0), 0).toFixed(2) } : null; },
    /** tap a seat (by id), through the same code as a finger on it: walks there by a path and sits you down */
    tapSeat(id: number) { const st = venue.seats[id]; if (!st) return null; if (crowd.taken.has(id)) { hud.toast("Someone's sitting there.", 2); return null; } const p = tapGo(st.ax, st.az, { seat: st }); return p ? { waypoints: p.map(([a, b]) => G(a, b)), length: +p.reduce((sum, c, i) => (i ? sum + Math.hypot(c[0] - p[i - 1][0], c[1] - p[i - 1][1]) : 0), 0).toFixed(2) } : null; },
    /** a tap on the screen at pixel (x, y), through the same code as a finger */
    tapScreen(x: number, y: number) { const p = tapScreen(x, y); return p ? { waypoints: p.length, goal: player.pathGoal?.seat ? `seat ${player.pathGoal.seat.id}` : 'ground' } : null; },
    /** the action button: returns what it did */
    act(which: 1 | 2 = 1) { const did = doAction(which); return { did, now: [...available()] }; },
    // ---------------------------------------------------------------- P1b: things to do
    /** the buttons now and what they'd act on (a seat id, a counter, a group) */
    target() { available(); const t = doings.target; return { actions: [...doings.avail], seat: t.seat?.id ?? null, counter: t.counter?.id ?? null, group: t.group?.id ?? null }; },
    /** press whichever button says `label`, if one does: what was done, or null */
    press(label: ActLabel) { const a = available(), w = a[0] === label ? 1 : a[1] === label ? 2 : 0; return w ? { did: doAction(w as 1 | 2), now: [...available()] } : { did: null, now: [...a] }; },
    /** the order sheet: open or not, its title and its items */
    sheet() { return { open: hud.orderOpen, title: document.getElementById('orderTitle')?.textContent ?? '', items: Array.from(document.querySelectorAll<HTMLButtonElement>('#menuItems button')).map((b) => ({ id: b.dataset.item, text: b.textContent })), menus: Object.fromEntries(Object.entries(MENUS).map(([k, v]) => [k, v.items.map((i) => i.id)])) }; },
    /** choose an item on the open sheet (through the same code as a finger on its button) */
    pick(id: ItemId) { const b = document.querySelector<HTMLButtonElement>(`#menuItems button[data-item="${id}"]`); if (!b) return false; b.click(); return doings.order?.item === id; },
    closeSheet() { doings.closeSheet(); return hud.orderOpen; },
    /** a reply chip (0 or 1), through the chip's own click */
    reply(i: 0 | 1) { const b = document.getElementById('reply' + i) as HTMLButtonElement | null; if (!b || !hud.repliesShown) return false; b.click(); return true; },
    /** the order, what you hold, the circle you're in, what's on screen */
    state() { return { ...doings.state(), caption: hud.captionText, replies: hud.repliesShown, status: hud.statusText, actions: [...available()], log: doings.log.slice(-12) }; },
    talk() { const g = doings.joined; const t = g?.talk; return t ? { group: g!.id, stage: t.stage, n: t.n, caption: t.caption, replies: t.replies, log: t.log } : null; },
    groups() {
      return crowd.groups.map((g) => ({
        id: g.id, label: g.label, active: g.active, ready: g.ready, seated: g.seated, party: g.party.state, order: g.party.order, ...G(g.cx, g.cz), r: g.r, you: g.you, speaker: g.speaker,
        // facesSpeaker: the head (from the bones) within 25 degrees of the speaker's eyes; bones are posed only for
        // people drawn as bodies, or for everyone in unrendered steps (sim(..., true)). bodyFaces: the body's heading
        // within 25 degrees of the speaker (all a cut-out shows: it's painted with the head straight)
        members: g.members.map((m, i) => { const sp = g.speaker >= 0 && g.speaker !== i ? g.members[g.speaker] : null; return { name: m.name, ...G(m.x, m.z), heading: +m.heading.toFixed(3), speaking: m.speaking, anim: m.anim, pose: m.pose, seat: m.seat?.id ?? null, lod: m.lod, rep: m.rep, drawn: m.rep !== 'off', holds: m.hold, facesSpeaker: sp ? faces(m, sp) : null, bodyFaces: sp ? bodyFaces(m, sp) : null }; }),
      }));
    },
    npcs() { return crowd.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, mode: n.mode, ...G(n.x, n.z), y: +n.y.toFixed(3), heading: +n.heading.toFixed(3), shown: n.shown, drawn: n.rep !== 'off', rep: n.rep, lod: n.lod, dist: +n.dist.toFixed(2), anim: n.anim, pose: n.pose, seat: n.seat?.id ?? null, walking: !!n.route, holds: n.hold, group: n.group?.id ?? null, lod1: !!n.m1, inside: inVenue(n.x, n.z) })); },
    /** the simulated crowd: the level, the guests it calls for, the parties and where they are, what happened */
    crowd() { const s = crowd.stats(); return { level, share: +share.toFixed(3), open, target: s.target, guests: s.guests, inside: s.inside, parties: crowd.groups.map((g) => ({ id: g.id, label: g.label, size: g.party.size, order: g.party.order, state: g.party.state, seated: g.seated, stayMin: +(g.party.stay / 60).toFixed(1) })), log: crowd.log.slice(-20) }; },
    /** the next party to go leaves now and the next to come arrives (they walk out and in) */
    turnover() { return crowd.turnover(); },
    /** draw everyone in view as impostors ('imp') or bodies ('body', no budget), or as the budget decides ('auto'): for comparison shots */
    crowdView(mode: 'auto' | 'imp' | 'body') { crowd.view.force = mode; return mode; },
    /**
     * The people's draw calls in this view, counted two ways: by the crowd's own budget (what it counts as it chooses
     * bodies and cut-outs) and measured, by drawing the frame with them and again without them (every pass: the
     * sun's shadow map, the bloom). The frame is drawn as usual first.
     */
    peopleCalls() {
      // (the two draws back to back, nothing else changing between them: render() would also re-choose the parked
      // cars' detail after each frame)
      const draw = () => { renderer.info.reset(); if (composer) composer.render(); else renderer.render(scene, camera); return renderer.info.render.calls; };
      crowd.draw(camera, stats);
      const all = draw(), counted = crowd.view.stats.npcCalls;
      const vis = crowd.root.visible; crowd.root.visible = false;
      const without = draw();
      crowd.root.visible = vis;
      render();
      return { counted, measured: all - without, all, without, bodies: crowd.view.stats.meshes, impostors: crowd.view.stats.imps, shadows: crowd.view.stats.shadows, held: crowd.view.stats.held };
    },
    /** repaint one person's cut-out now (as when their patio body arrives from the worker) */
    repaint(id: number) { const n = crowd.npcs[id]; if (!n) return null; crowd.view.paint(n); return { id, playing: n.playing, rep: n.rep }; },
    /** a person's stride: how far one thigh swings forward of the other (degrees, in the hips' frame): about 40 at the
     *  ends of a walking step, near 0 standing */
    legs(id: number) {
      const n = crowd.npcs[id]; if (!n) return null;
      const a = n.p.group.getObjectByName('thighL'), b = n.p.group.getObjectByName('thighR'); if (!a || !b) return null;
      const fwd = (o: THREE.Object3D) => { const d = new THREE.Vector3(0, -1, 0).applyQuaternion(o.quaternion); return Math.atan2(d.z, -d.y) * 180 / Math.PI; };
      return { deg: +Math.abs(fwd(a) - fwd(b)).toFixed(1), playing: n.playing, anim: n.anim, walking: !!n.route, rep: n.rep };
    },
    /** one person's cut-out cells from the atlas (standing, and sitting if they sit), as a PNG data URL */
    atlas(id: number) { const n = crowd.npcs[id]; return n ? crowd.view.cellsImage(n) : null; },
    /** the seats the guests are in or walking to (nobody else can sit there) */
    takenSeats() { return [...crowd.taken].sort((a, b) => a - b); },
    /** every patio body is built (the worker's queue is empty) */
    peopleReady() { const s = crowd.stats(); return s.lod1Pending === 0; },
    counters() { return venue.counters.map((c) => ({ id: c.id, label: c.label, from: G(c.x, c.z0), to: G(c.x, c.z1), side: c.side, stand: G(c.x + c.side * 1.1, (c.z0 + c.z1) / 2), set: { ...G(c.setX, (c.z0 + c.z1) / 2), y: c.setY } })); },
    /** stretch every action's range by k (1 is normal): for showing that the line test, not only distance, holds */
    reach(k: number) { doings.reach = k; return k; },
    /** what would be offered standing at a game point (the player doesn't move): counter, group, seat; and the line of sight */
    offerAt(x: number, z: number) { const [lx, lz] = L(x, z), at = { x: lx, z: lz }; return { counter: doings.nearCounter(at)?.id ?? null, group: doings.nearGroup(at)?.id ?? null, seat: doings.nearSeat(at)?.id ?? null, free: grid.isFree(lx, lz) }; },
    /** a clear line between two game points (nothing you can't act through in between) */
    sight(ax: number, az: number, bx: number, bz: number) { const [a, b] = L(ax, az), [c, d] = L(bx, bz); return doings.canSee(c, d, { x: a, z: b }); },
    /** where a world point (game x, z; height y) is on the screen, in CSS pixels; null if behind the camera */
    project(x: number, y: number, z: number) { const [lx, lz] = L(x, z), v = new THREE.Vector3(lx, y, lz).project(camera); return v.z > 1 ? null : { x: +((v.x + 1) / 2 * canvas.clientWidth).toFixed(1), y: +((1 - v.y) / 2 * canvas.clientHeight).toFixed(1) }; },
    lastTap() { return { ...lastTap, goal: player.pathGoal ? { seat: player.pathGoal.seat?.id ?? null, join: player.pathGoal.join ?? null, counter: player.pathGoal.counter ?? null } : null, moving: !!player.path }; },
    /** how far the held item (third-person copy) is from your avatar's right hand, and the regulars' cups from theirs */
    inHand() {
      const v = new THREE.Vector3(), w = new THREE.Vector3(), out: { who: string; d: number }[] = [];
      const near = (p: Person, item: THREE.Object3D, who: string) => { const hand = p.group.getObjectByName('handR'); if (!hand) return; p.group.updateMatrixWorld(true); hand.getWorldPosition(v); item.getWorldPosition(w); out.push({ who, d: +Math.hypot(v.x - w.x, v.z - w.z, v.y - (w.y + (formOf(item.userData.item) === 'cup' ? 0.07 : 0.035))).toFixed(3) }); };
      if (doings.held && person) near(person, doings.held.tp, 'you');
      for (const n of crowd.npcs) if (n.held && n.shown) near(n.p, n.held, n.name);
      return out;
    },
    /** hold an item directly (for the screenshots of holding without the wait) */
    hold(id: ItemId | null) { doings.hold(id); return doings.held?.id ?? null; },
    actions() { return [...available()]; },
    view(v?: View) { return setView(v); },
    look(yawDeg: number, pitchDeg: number) { player.yaw = (yawDeg * Math.PI) / 180; player.pitch = (pitchDeg * Math.PI) / 180; if (!player.seat) player.heading = player.yaw; return true; },
    /** walk with the stick (x right, y forward, -1..1) for some seconds of simulation, unrendered; the trajectory in game coordinates */
    walk(sx: number, sy: number, seconds: number, run = false) { return simulate(Math.round(seconds / STEP), { x: sx, y: sy, run }); },
    /**
     * Let the simulation run (a tap-to-go path plays out), unrendered; untilStop ends it once the walk is over. With
     * `world` the people, the order and the talk run too: true animates everyone (as if all were bodies); 'view' as a
     * rendered frame does, only the people drawn as bodies in the last frame (cut-outs keep their painted pose).
     */
    sim(seconds: number, untilStop = false, world: boolean | 'view' = false) { return simulate(Math.round(seconds / STEP), { x: 0, y: 0, run: false }, untilStop, world); },
    pos() { const gu = player.lastGaveUp; return { ...G(player.x, player.z), lx: +player.x.toFixed(3), lz: +player.z.toFixed(3), y: +player.y.toFixed(3), heading: +player.heading.toFixed(3), yaw: +player.yaw.toFixed(3), sitting: player.seat ? player.seat.id : null, view: player.view, moving: !!player.path, speed: +player.speed.toFixed(3), gaveUp: gu ? { by: gu.by, ...G(gu.x, gu.z), left: +gu.left.toFixed(2) } : null }; },
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
    /** what's under a ground point (game coordinates): the meshes a ray straight down from 60 m hits, nearest first */
    probe(x: number, z: number) {
      const [lx, lz] = L(x, z), rc = new THREE.Raycaster(new THREE.Vector3(lx, 60, lz), new THREE.Vector3(0, -1, 0), 0, 70);
      return rc.intersectObjects(world.children, true).slice(0, 6).map((h) => ({ name: h.object.name || h.object.parent?.name || h.object.type, y: +h.point.y.toFixed(3), visible: h.object.visible }));
    },
    breakdown(n = 40, visibleOnly = false) {
      const out: { name: string; tris: number; n: number }[] = [];
      const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
      scene.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry) return;
        if (visibleOnly && !shown(m)) return;
        const g = m.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3, n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
        out.push({ name: m.name || m.parent?.name || m.type, tris: Math.round(t * n), n });
      });
      return out.sort((a, b) => b.tris - a.tris).slice(0, n);
    },
  };
  /** does a listener's head face the speaker (within 25 degrees across the ground)? */
  const _hq = new THREE.Quaternion(), _hf = new THREE.Vector3(), _he = new THREE.Vector3(), _hs = new THREE.Vector3();
  const faces = (m: Npc, s: Npc) => {
    const head = m.bones.head; if (!head) return false;
    m.p.group.updateMatrixWorld(true); head.getWorldQuaternion(_hq); _hf.set(0, 0, 1).applyQuaternion(_hq);
    m.p.eyes(_he); s.p.eyes(_hs); _hs.sub(_he);
    const a = Math.atan2(_hf.x, _hf.z), b = Math.atan2(_hs.x, _hs.z), d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    return d < (25 * Math.PI) / 180;
  };
  /** does a listener's body face the speaker (its heading within 25 degrees of the line to them)? */
  const bodyFaces = (m: Npc, s: Npc) => {
    const a = Math.atan2(s.x + s.ox - (m.x + m.ox), s.z + s.oz - (m.z + m.oz));
    return Math.abs(Math.atan2(Math.sin(m.heading - a), Math.cos(m.heading - a))) < (25 * Math.PI) / 180;
  };
  const shiftCollider = (c: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...c };
    if (c.k === 'circ') { out.x = (c.x as number) + ORIGIN.x; out.z = (c.z as number) + ORIGIN.z; }
    else if (c.k === 'seg') { out.ax = (c.ax as number) + ORIGIN.x; out.az = (c.az as number) + ORIGIN.z; out.bx = (c.bx as number) + ORIGIN.x; out.bz = (c.bz as number) + ORIGIN.z; }
    else out.pts = (c.pts as number[]).map((v, i) => v + (i % 2 ? ORIGIN.z : ORIGIN.x));
    return out;
  };
  const simulate = (n: number, stick: { x: number; y: number; run: boolean }, untilStop = false, world: boolean | 'view' = false) => {
    const path: number[] = [], blocks: Record<string, number> = {};
    player.lastGaveUp = null;
    for (let i = 0; i < n; i++) {
      if (untilStop && !player.path) break;
      simStep(stick);
      // the regulars, the staff, the order and the talk run too when asked (at 30 Hz; everyone animated, or as drawn)
      if (world && i % 2 === 1) worldStep(STEP * 2, world === 'view' ? camera : null);
      const g = toGame(player.x, player.z);
      path.push(+g[0].toFixed(4), +g[1].toFixed(4));
      if (player.lastBlock) blocks[player.lastBlock] = (blocks[player.lastBlock] ?? 0) + 1;
    }
    return { path, blocks, end: hooks.pos() };
  };
  Object.defineProperty(hooks, 'frames', { get: () => frames });
  window.__onfoot = hooks as unknown as Record<string, unknown>;

  // in the game: what dispose releases (embed.ts)
  const em = embed;
  if (em) em.cleanup = () => { removeEventListener('resize', onResize); doings.cancelAll(); em.release(renderer, scene, [crowd, person, parked, composer, dots], [hud, input, doings]); };
  hud.show();
  loading(1, 'Ready');
  hooks.buildMs = Math.round(performance.now() - t0);
  doneLoading(reduced);
  canvas.focus();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
  // ready after a couple of frames have drawn
  const waitReady = () => { if (frames >= 2) hooks.ready = true; else if (!embed?.dead) requestAnimationFrame(waitReady); };
  waitReady();
}

/** instanced palms along Orangewood (the game's own trunk and crown); the venue's olive and shade trees are built in
 *  code by trees.ts into the world's batches */
function plantTrees(world: THREE.Group, trees: Tree[], quality: Quality) {
  const g = new THREE.Group(); g.name = 'trees';
  const r = rand(91);
  // palms within 120 m of the venue cast shadows; the rest along Orangewood don't (an instanced mesh draws every
  // instance into the shadow map, wherever the shadow box is)
  const palmT: THREE.Matrix4[] = [], palmC: THREE.Matrix4[] = [];
  const far = new Set<THREE.Matrix4>();
  const put = (list: THREE.Matrix4[], m: THREE.Matrix4, isFar: boolean) => { list.push(m); if (isFar) far.add(m); };
  for (const t of trees) {
    if (t.kind !== 'palm') continue;
    const isFar = Math.hypot(t.x, t.z) > 120;
    const lean = new THREE.Matrix4().makeRotationZ((r() - 0.5) * 0.08), base = new THREE.Matrix4().makeTranslation(t.x, t.y, t.z).multiply(lean);
    put(palmT, base.clone().multiply(new THREE.Matrix4().makeScale(1, t.s, 1)), isFar);
    const cs = 1 + r() * 0.2;
    put(palmC, base.clone().multiply(new THREE.Matrix4().makeTranslation(0, t.s, 0)).multiply(new THREE.Matrix4().makeRotationY(r() * 6)).multiply(new THREE.Matrix4().makeScale(cs, cs, cs)), isFar);
  }
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, all: THREE.Matrix4[], name: string) => {
    for (const [ms, cast] of [[all.filter((m) => !far.has(m)), true], [all.filter((m) => far.has(m)), false]] as [THREE.Matrix4[], boolean][]) {
      if (!ms.length) continue;
      const im = new THREE.InstancedMesh(geo, mat, ms.length); im.name = cast ? name : name + '-far';
      ms.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = cast; im.receiveShadow = true; im.userData.cast = cast; im.computeBoundingSphere(); g.add(im);
    }
  };
  inst(Props.palmTrunk(), Props.mats.bark(), palmT, 'palm-trunks');
  inst(Props.palmCrown(quality === 'low' ? 0 : 1), Props.mats.frond(), palmC, 'palm-crowns');
  world.add(g);
}

/**
 * Mount Lot 57 in host (Phase 3a): the game passes the page's markup (html), your car and paint, the quality, the
 * clock and onDrive; the page's own boot below passes nothing (the markup is there, the options are the address).
 */
export function mount(host: HTMLElement, o: MountOptions = {}) {
  q = optionsToParams(o, o.html ? '' : location.search);
  quality = (['low', 'high', 'ultra'].includes(q.get('quality') ?? '') ? q.get('quality') : coarse ? 'low' : 'high') as Quality;
  reduced = q.get('motion') === 'reduced' || sysReduced;
  return mountPage(host, o, (e) => { embed = o.html ? e : null; return main(); });
}

// The same script runs twice: as the page, and as the worker that builds the people's patio bodies (no document
// there: lot57/crowd-worker.ts). The worker is this page's own inlined script, started again from a blob, so none of
// the builder's code ships twice. It starts as a classic worker in strict mode: a page opened from disk can't start a
// module worker from a blob, and the single-file bundle has no imports or exports. (Served by Vite's dev server the
// script isn't inline: the bodies are built on the main thread instead, slowly.)
if (typeof document === 'undefined') serveBuilds();
else if (!(globalThis as { __onfootEmbed?: boolean }).__onfootEmbed) {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"]:not([src])')?.textContent ?? '';
  if (src.length > 10000 && typeof Worker === 'function' && !/\bimport\.meta\b/.test(src)) {
    try {
      const url = URL.createObjectURL(new Blob(['"use strict";\n', src], { type: 'text/javascript' }));
      useWorkers(() => new Worker(url, { name: 'lot57-people' }));
    } catch { useWorkers(null); }
  }
  mount(document.body).ready.catch((e) => { window.__onfootError = String((e as Error)?.stack ?? e); const st = document.getElementById('status'); if (st) st.textContent = 'Something went wrong building the page: ' + String((e as Error)?.message ?? e); });
}

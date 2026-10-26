// The garage cars' cockpits: everything the driver sees from the seat, in the car's frame (spec.ts).
//
//   buildCockpit({ car?, paint?, quality?, mirrors?, body?, stitch? }): Cockpit
//     car: 'rossini-gt' (default) | 'rossini-brio' | 'rossini-corsa' | 'vela-e'. Each has its own trim (THEMES below):
//       GT black Alcantara and Nappa with cognac seats; Brio navy leather, aluminium trim, an all-leather wheel;
//       Corsa carbon buckets in Alcantara with red four-point harnesses, a roll hoop, carbon door cards, an
//       Alcantara wheel with a yellow centre stripe; Vela E ivory leather, a round two-spoke wheel with the V badge
//       and a wide display in place of the tachometer.
//     paint: sRGB hex for the body seen through the glass (bonnet, wings, mirror housings; default the car's).
//     quality: 'phone' | 'high' (default 'high': finer meshes, anisotropic carbon and aluminium, 512 maps).
//     mirrors: 'env' (default: the sky's environment map in the rear-view and door mirrors, no extra renders) or
//       'live' (render-target reflections of the scene in the rear-view and the driver's door mirror, cut to each
//       glass's outline; they alternate, so one extra low-resolution scene render a frame. That render re-draws
//       whatever of the world the mirror sees, which is over the cockpit's draw-call budget in a full scene: opt in;
//       the game does on High and Ultra, and leaves its own car out of the rear-view's render, see CarMirror.hide).
//       With body false the door mirror's glass sits a hair proud of the exterior's own glass (the game's PlayerCar
//       builds the body separately), so it draws over it.
//     body: include the front of the car's body seen through the windscreen and the door mirrors (default true).
//     stitch: thread colour (default cognac).
//   returns { group, wheel, update(dt), setInstruments({ rpm }), mirrors }
//     group: the interior in the car's frame. wheel: the steering-wheel mount at spec WHEEL_AT, rotation.x =
//     WHEEL_TILT; its rotation.z steers, and hands added to it turn with it (the rim follows spec rimAt/rimA/rimB).
//     update(dt): the needle's idle flutter. setInstruments: move the tach needle. mirrors: the live CarMirrors
//     (empty with 'env'), to switch off (active = false) or dispose.
//
// What it is made of: Alcantara (dash top, pillars, headliner, door inserts), black Nappa with cognac double
// stitching (fascia, binnacle, door cards, wheel grips perforated), cognac Nappa seats, 2x2 twill carbon under a
// clear coat, brushed and anodised aluminium (vents, paddles, trim), a tachometer and two displays drawn in code,
// and a windscreen with a faint ghost of the dashboard reflected in it and a film of dust with the wiper sweeps.
// No hands: another part builds them on the rim.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, V3, v3, gridGeo, sweepGeo, tubeGeo, latheGeo, extrude, roundRect, mat, clamp, sstep, lerp, between } from './car-kit';
import * as M from './car-mats';
import { bodyFor } from './car-body';
import { carMaterials, aoFor } from './car';
import { CarId, shapeFor, seatOffset } from './car-shape';
import { EYE, WHEEL_AT, WHEEL_TILT, rimAt, rimA, rimB } from './spec';
import * as G from './car-gauges';
import { windscreenDust, badgeTex, once } from './car-tex';
import { CarMirror } from './car-mirror';

export interface CockpitOptions { car?: CarId; paint?: number; quality?: 'phone' | 'high'; mirrors?: 'live' | 'env'; body?: boolean; stitch?: number }
// each car's trim: seat colour and kind, thread, the dash top's material, the fascia band, the wheel, the binnacle
interface Theme { seat: number; seatKind: 'leather' | 'buckets'; stitch: number; dash: 'alc' | 'nappa'; band: 'carbon' | 'alu'; wheel: 'gt' | 'brio' | 'corsa' | 'vela'; binnacle: 'tach' | 'screen'; door: 'nappa' | 'carbon'; head: number; stripe?: number; belt?: number }
const THEMES: Record<string, Theme> = {
  gt: { seat: 0x7a3f1c, seatKind: 'leather', stitch: 0xc58a52, dash: 'alc', band: 'carbon', wheel: 'gt', binnacle: 'tach', door: 'nappa', head: 0x3a3a3e },
  brio: { seat: 0x1c2740, seatKind: 'leather', stitch: 0x8fb0e0, dash: 'nappa', band: 'alu', wheel: 'brio', binnacle: 'tach', door: 'nappa', head: 0x55565b },
  corsa: { seat: 0x2b2b2e, seatKind: 'buckets', stitch: 0xe8b81c, dash: 'alc', band: 'carbon', wheel: 'corsa', binnacle: 'tach', door: 'carbon', head: 0x29292b },
  vela: { seat: 0xbdb5a5, seatKind: 'leather', stitch: 0x7d7870, dash: 'nappa', band: 'alu', wheel: 'vela', binnacle: 'screen', door: 'nappa', head: 0xa39e93 },
  // the OC Hypercar: the Corsa's carbon buckets, roll hoop and Alcantara wheel, with ice-blue stitching, an ice-blue
  // centre stripe on the rim, deep blue harnesses, an ice-blue ambient line along the dash and the door cards, the OC
  // badge on the wheel's boss (the car's brand), a gauge pod on the dash kept for M5's Cold Thrust tank gauge, and
  // its own driver display (the Vela's display geometry, centred on its driver, with car-gauges hyperScreenTex)
  // Its door card is black Nappa, not carbon: in the narrow canopy the card sits a hand's width from the eye, where
  // a clear coat at that grazing angle mirrored the bright sky as a grey slab across the left of the seat view.
  hyper: { seat: 0x2b2b2e, seatKind: 'buckets', stitch: 0x8fd0ff, dash: 'alc', band: 'carbon', wheel: 'corsa', binnacle: 'screen', door: 'nappa', head: 0x29292b, stripe: 0x7cc8ff, belt: 0x1f3f66 },
};
export interface Cockpit {
  group: THREE.Group;
  wheel: THREE.Object3D;
  update?(dt: number): void;
  // rpm moves the tachometer's needle; the hypercar's live display takes the rest (car-gauges hyperScreen)
  setInstruments?(o: { rpm?: number } & Partial<G.HyperReadout>): void;
  rearView?: { at: THREE.Vector3; normal: THREE.Vector3; w: number; h: number };   // the rear-view mirror's face: centre, normal, size
  mirrors: CarMirror[];
  // the hypercar's gauge pod on the dash, kept for M5's Cold Thrust tank gauge: the face's centre, its normal (toward
  // the driver) and radius, in the car's frame
  gaugeAt?: { at: THREE.Vector3; normal: THREE.Vector3; r: number };
}

const CENTRE = v3(-0.1, 0.85, -0.2);            // a point in the middle of the cabin: "inward" is toward it

// ------------------------------------------------------------------------------------------------ helpers
// a loft along x: prof(x) gives the section's (z, y) points
function loftX(xs: number[], prof: (x: number) => [number, number][], flip = false) {
  return gridGeo(xs.map((x) => prof(x).map(([z, y]) => v3(x, y, z))), { flip });
}
// a loft along z: prof(z) gives the section's (x, y) points
function loftZ(zs: number[], prof: (z: number) => [number, number][], flip = false) {
  return gridGeo(zs.map((z) => prof(z).map(([x, y]) => v3(x, y, z))), { flip });
}
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * (i / n));
// a ribbon of stitches along a path: across gives the width direction at each point, lift pushes it off the surface
function stitchRow(path: V3[], across: V3[], lift: V3[], w = 0.0018) {
  const rows: V3[][] = path.map((p, i) => {
    const c = p.clone().addScaledVector(lift[i], 0.0006);
    return [c.clone().addScaledVector(across[i], -w / 2), c.clone().addScaledVector(across[i], w / 2)];
  });
  const g = gridGeo(rows);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  let len = 0;
  for (let i = 0; i < path.length; i++) { if (i) len += path[i].distanceTo(path[i - 1]); uv.setXY(i * 2, len / 0.032, 0); uv.setXY(i * 2 + 1, len / 0.032, 1); }
  return g;
}
// split a grid's quads into a border (frit) and a middle
function splitGrid(g: THREE.BufferGeometry, ni: number, nj: number, isFrit: (i: number, j: number) => boolean) {
  const idx = g.index!.array, a: number[] = [], b: number[] = [];
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const k = (i * (nj - 1) + j) * 6;
    (isFrit(i, j) ? b : a).push(...Array.from(idx.slice(k, k + 6)));
  }
  const ga = g.clone(); ga.setIndex(a); const gb = g.clone(); gb.setIndex(b);
  return [ga, gb];
}
// the reflection of a geometry in a plane (point p0, normal n)
function reflectMatrix(p0: V3, n: V3) {
  const d = n.dot(p0), m = new THREE.Matrix4();
  m.set(1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 2 * d * n.x,
    -2 * n.x * n.y, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 2 * d * n.y,
    -2 * n.x * n.z, -2 * n.y * n.z, 1 - 2 * n.z * n.z, 2 * d * n.z,
    0, 0, 0, 1);
  return m;
}
const clean = (g: THREE.BufferGeometry) => { const x = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; };

// rim frames (as the game's cockpit): path, outward normal in the wheel plane, +z toward the driver
function rimFrames(a0: number, a1: number, n: number) {
  const path: V3[] = [], N: V3[] = [], B: V3[] = [], as: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / (n - 1));
    const p = rimAt(a), t = rimAt(a + 0.002).sub(rimAt(a - 0.002)).normalize();
    N.push(p.clone().sub(t.clone().multiplyScalar(p.dot(t))).normalize()); path.push(p); B.push(v3(0, 0, 1)); as.push(a);
  }
  return { path, N, B, as };
}

// ------------------------------------------------------------------------------------------------ the cockpit
export function buildCockpit(o: CockpitOptions = {}): Cockpit {
  const q = o.quality ?? 'high', high = q === 'high';
  const id = o.car ?? 'rossini-gt', P = shapeFor(id), B = bodyFor(id), T = THEMES[P.interior];
  // the driver's frame: the shared one (spec.ts), moved for a car whose driver sits lower and further in (the
  // hypercar: car-shape seatOffset). The eye, the wheel and the binnacle move with the driver; the dash, the console
  // and the gauge pod move down with them across the car; the seats drop less (the floor stays above the sills, so
  // the driver reclines a little more); the glass, pillars, headliner, doors and hoop stay fitted to the body.
  const [sX, sY, sZ] = seatOffset(P), hyper = P.interior === 'hyper';
  const seatY = Math.max(sY, -0.12), floorY = Math.max(sY, -0.04);
  const eye = EYE.clone().add(v3(sX, sY, sZ)), wheelAt = WHEEL_AT.clone().add(v3(sX, sY, sZ));
  // file what kit.add takes inside fn moved by (dx, dy, dz)
  const moved = (dx: number, dy: number, dz: number, fn: () => void) => {
    if (!dx && !dy && !dz) { fn(); return; }
    const w = kit.warp; kit.warp = (p) => { p.x += dx; p.y += dy; p.z += dz; return true; };
    try { fn(); } finally { kit.warp = w; }
  };
  const { body, wsPoint, wsXZ, WS, sgPoint, SG, MIRROR, mirrorParts, mirrorGlassPlacement } = B;
  const D = P.cabinW;                                // the door cards' inner face (half-width)
  const paint = o.paint ?? P.paint;
  const live = (o.mirrors ?? 'env') === 'live';
  const group = new THREE.Group(); group.name = 'cockpit';
  const kit = new Kit(), wk = new Kit(), bk = new Kit();       // the interior, the steering wheel, the body outside
  const ghost: THREE.BufferGeometry[] = [];         // dash surfaces that the windscreen reflects
  const stitchC = o.stitch ?? T.stitch;

  // ---------------------------------------------------------------- materials
  const ext = carMaterials(paint, q, P.caliper, id);
  const tachT = G.tachTextures(high ? 1024 : 512, P.brand === 'oc' ? 'O C' : undefined);
  const mats: Record<string, THREE.Material> = {
    paint: ext.paint, mirrorPaint: ext.mirrorPaint, trim: ext.trim, dark: ext.dark, lamp: ext.lamp, tail: ext.tail, grille: ext.grille, liner: ext.liner, rubber: ext.rubber, badge: ext.badge,
    mirror: M.chrome(0.02, 0x6a6e74), exhaust: ext.exhaust, mirrorDim: M.chrome(0.03, 0x4a4d52), carbonX: ext.carbon, frit: M.gloss(0x040404),
    // black Nappa reflects about 3-4 % (sRGB ~0x33 before the grain map's ~0.86); black Alcantara a little less
    alc: M.alcantara(q, 0x2c2c2f), nappa: M.leather(q, 0x333336, { tile: 0.12 }),
    nappaPerf: M.leather(q, 0x2f2f32, { perforated: true, tile: 0.09, worn: true }), wheelNappa: M.leather(q, 0x2f2f32, { tile: 0.08, worn: true }),
    tan: T.seatKind === 'buckets' ? M.alcantara(q, T.seat, 0.07) : M.leather(q, T.seat, { tile: 0.12, sheen: 0.45 }),
    tanPerf: T.seatKind === 'buckets' ? M.alcantara(q, 0x232326, 0.06) : M.leather(q, T.seat, { perforated: true, tile: 0.1, sheen: 0.45 }),
    carbon: M.carbon(q), alu: M.brushed(q, 0xc6cace), anod: M.brushed(q, 0x3c3f45, { rough: 1.25, aniso: 0.6, key: 'anod' }),
    chrome: M.chrome(0.08), plastic: M.softPlastic(q), gloss: M.gloss(), carpet: M.carpet(q),
    stitch: M.stitch(stitchC), stitchDark: M.stitch(0x2b1a10),
    glass: M.glass('cabin', 0.04, { env: 0.3 }), // the hypercar's side windows are smoked: its front fenders crest level with the low eye, and through clear
    // glass their silver paint and the sky's reflection filled the left of the seat view as a bright wall
    sideGlass: hyper ? M.glass('cabinSideHyper', 0.35, { env: 0.25, color: 0x05080c }) : M.glass('cabinSide', 0.1, { env: 0.45 }), gaugeGlass: M.glass('gauge', 0.0, { env: 0.9 }),
    roofGlass: M.glass('roofIn', 0.72, { env: 0.35, color: 0x05080c }),
    belt: once('m.belt' + (T.belt ?? 0x8a1216), () => new THREE.MeshStandardMaterial({ color: T.belt ?? 0x8a1216, roughness: 0.82 })),
    hoop: once('m.hoop', () => new THREE.MeshPhysicalMaterial({ color: 0x1c1c1e, roughness: 0.55, metalness: 0.2, clearcoat: 0.3 })),
    stripe: once('m.stripe' + (T.stripe ?? 0xe8b81c), () => new THREE.MeshStandardMaterial({ color: T.stripe ?? 0xe8b81c, roughness: 0.6 })),
    screenV: once('m.scrV', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.velaScreenTex(), emissiveIntensity: 0.95, roughness: 0.12 })),
    screenH: once('m.scrH', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.hyperScreenTex(), emissiveIntensity: 1.0, roughness: 0.12 })),
    tach: once('m.tach' + q + P.brand, () => new THREE.MeshStandardMaterial({ map: tachT.map, emissiveMap: tachT.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.55 })),
    screenL: once('m.scrL', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.leftScreenTex(), emissiveIntensity: 0.9, roughness: 0.18 })),
    screenR: once('m.scrR', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.rightScreenTex(), emissiveIntensity: 0.9, roughness: 0.18 })),
    icons: once('m.icons', () => new THREE.MeshStandardMaterial({ map: G.iconAtlas(), roughness: 0.35 })),
    start: once('m.start', () => new THREE.MeshPhysicalMaterial({ map: G.startTex(), roughness: 0.3, clearcoat: 0.6 })),
    red: once('m.red', () => new THREE.MeshPhysicalMaterial({ color: 0xb3151b, roughness: 0.35, clearcoat: 0.5 })),
    dial: once('m.dial', () => new THREE.MeshStandardMaterial({ map: G.modeDialTex(), transparent: true, alphaTest: 0.4, roughness: 0.5 })),
    led: once('m.led', () => new THREE.MeshPhysicalMaterial({ color: 0x0b0c0d, roughness: 0.15, clearcoat: 1 })),
    dust: once('m.dust', () => new THREE.MeshBasicMaterial({ map: windscreenDust(1024, 512, 1.53, 1.05, [[0.705, 0.0], [1.365, 0.0]], 0.58), color: 0x6e665e, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })),
  };
  for (const k of ['alc', 'nappa', 'tan', 'tanPerf', 'carpet', 'plastic']) (mats[k] as THREE.Material).side = THREE.DoubleSide;
  // the screen binnacle's display: the Vela's atlas, or the hypercar's own
  const scrK = hyper ? 'screenH' : 'screenV';
  mats.cluster = mats[scrK];   // the driver's display, built as its own mesh (one draw call more) so it can be found by name
  mats.badgeHub = once('m.badgehub' + P.brand, () => new THREE.MeshPhysicalMaterial({ map: badgeTex(256, P.brand), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.1 }));
  // the dash top and the fascia band, per car
  mats.dashTop = T.dash === 'alc' ? mats.alc : mats.nappa;
  mats.band = T.band === 'carbon' ? mats.carbon : mats.alu;
  mats.doorLow = T.door === 'carbon' ? mats.carbon : mats.nappa;
  mats.alcW = M.alcantara(q, 0x2a2a2d, 0.05);
  // the headliner, pillars and visors: one Alcantara per car (dark grey, grey, black, ivory)
  mats.head = M.alcantara(q, T.head, 0.08); (mats.head as THREE.Material).side = THREE.DoubleSide;
  // the hypercar's ambient line: its LED, dimmed to a cabin accent
  if (hyper && P.led) { const led = P.led; mats.amb = once('m.amb' + q, () => { const m = M.led(led.color, led.halo, q, led.edge).clone(); m.emissiveIntensity = q === 'high' ? 1.4 : 1.0; m.side = THREE.DoubleSide; return m; }); }

  // ambient occlusion inside: dark low down and under the dash, the headliner lit only by bounce
  const aoIn = (p: V3, n: V3) => {
    if (p.z < -1.12 || Math.abs(p.x) > 0.97) return clamp((0.62 + 0.38 * sstep(0.08, 0.7, p.y)) * (n.y < -0.4 ? 0.55 : 1), 0.2, 1);
    let a = 0.32 + 0.68 * sstep(0.18, 1.0, p.y);
    if (n.y > 0.4) a += 0.14 * n.y;
    if (p.z < -0.6 && p.y < 0.78) a *= 0.55;
    if (n.y < -0.5 && p.y > 1.0) a = 0.6;
    if (p.y < 0.3) a *= 0.75;
    return clamp(a, 0.15, 1);
  };
  const aoP = new THREE.Vector3();
  kit.ao = sY ? (p, n) => aoIn(aoP.copy(p).setY(p.y - sY), n) : aoIn;
  wk.ao = (p) => clamp(0.85 + p.z * 4, 0.6, 1);
  bk.ao = aoFor(B);

  // ---------------------------------------------------------------- windscreen: glass, frit, dust
  const NS = high ? 30 : 18, NT = high ? 18 : 10;
  const wsRows: V3[][] = [];
  for (let i = 0; i <= NT; i++) { const r: V3[] = []; for (let j = 0; j <= NS; j++) r.push(wsPoint(-1 + 2 * (j / NS), i / NT, -0.006)); wsRows.push(r); }
  {
    const g = gridGeo(wsRows, { flip: true });
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i <= NT; i++) for (let j = 0; j <= NS; j++) uv.setXY(i * (NS + 1) + j, j / NS, i / NT);
    const [clear, frit] = splitGrid(g, NT + 1, NS + 1, (i, j) => i === 0 || j === 0 || i === NT - 1 || j === NS - 1 || (!hyper && i >= NT - 3 && Math.abs(j - NS / 2 - 1) <= 1));
    kit.add('glass', clear); kit.add('frit', frit);
    // the dust film, just inside the glass (UV 0..1 across and up, as the dust texture expects)
    const dRows = wsRows.map((r, i) => r.map((_, j) => wsPoint(-1 + 2 * (j / NS), i / NT, -0.0075)));
    const d = gridGeo(dRows, { flip: true });
    const duv = d.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i <= NT; i++) for (let j = 0; j <= NS; j++) duv.setXY(i * (NS + 1) + j, j / NS, i / NT);
    kit.add('dust', d);
  }

  // ---------------------------------------------------------------- the dashboard
  const xs = range(-(D - 0.001), D - 0.001, high ? 48 : 26);
  const glassBase = (x: number): [number, number] => {
    const s = clamp(x / WS.xb, -1, 1), zb = wsXZ(s, 0)[1] + 0.012;
    return [zb, body.top(zb, Math.min(Math.abs(x), WS.xb - 0.005)) - 0.016];
  };
  // (the dash's own profile moves with the driver's frame; its front edge stays on the glass)
  const sh = (pts: [number, number][]): [number, number][] => pts.map(([z, y]) => [z + sZ, y + sY]);
  const dashTop = (x: number): [number, number][] => {
    const [zb, yb] = glassBase(x);
    return [[zb, yb], [zb + 0.06, Math.min(yb + 0.006, 0.85 + sY)], ...sh([[-0.93, 0.855], [-0.81, 0.861], [-0.73, 0.858], [-0.69, 0.847]])];
  };
  const LIP = sh([[-0.69, 0.847], [-0.674, 0.836], [-0.664, 0.818], [-0.665, 0.795]]);
  const FASCIA = sh([[-0.665, 0.795], [-0.659, 0.75], [-0.646, 0.69], [-0.628, 0.62]]);
  const LOWER = sh([[-0.628, 0.62], [-0.632, 0.555], [-0.67, 0.495], [-0.78, 0.445], [-0.96, 0.41]]);
  const top = loftX(xs, dashTop, true);
  kit.add('dashTop', top); ghost.push(top);
  kit.add('nappa', loftX(xs, () => LIP, true));
  kit.add('nappa', loftX(xs, () => FASCIA, true));
  kit.add('plastic', loftX(xs, () => LOWER, true));
  // dash ends against the doors
  for (const sd of [-1, 1]) {
    const x = sd * (D - 0.001), pts = [...dashTop(x), ...LIP.slice(1), ...FASCIA.slice(1), ...LOWER.slice(1)];
    const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const cap = new THREE.ShapeGeometry(sh, 1); cap.rotateY(-Math.PI / 2); cap.translate(x, 0, 0);
    kit.add('nappa', cap, null, 0.1);
  }
  // the defrost slot along the base of the glass, and the twin stitch lines where the lip meets the top
  {
    const rows: V3[][] = [];
    for (const x of range(-0.62, 0.62, 24)) { const [zb, yb] = glassBase(x); rows.push([v3(x, yb + 0.0025, zb + 0.03), v3(x, yb + 0.0035, zb + 0.048)]); }
    kit.add('gloss', gridGeo(rows, { flip: true }), null, 0.1);
    moved(0, sY, sZ, () => {
    for (const off of [-0.0035, 0.0035]) {
      const path = xs.map((x) => v3(x, 0.847 + off * 0.55, -0.69 - off * 0.83));
      kit.add('stitch', stitchRow(path, path.map(() => v3(0, 0.55, -0.83).normalize()), path.map(() => v3(0, 0.83, 0.55))));
    }
    // a carbon band across the fascia, with a fine aluminium line under it
    const band = (x0: number, x1: number) => {
      const b = new RoundedBoxGeometry(x1 - x0, 0.026, 0.012, 2, 0.004); b.rotateX(-0.12); b.translate((x0 + x1) / 2, 0.75, -0.655);
      kit.add('band', b, null, T.band === 'alu' ? 0.12 : 'keep');
      const l = new THREE.BoxGeometry(x1 - x0, 0.0025, 0.004); l.rotateX(-0.12); l.translate((x0 + x1) / 2, 0.735, -0.655); kit.add('alu', l, null, 0.05);
    };
    band(-(D - 0.006), -0.64); band(T.binnacle === 'screen' ? 0.06 : -0.1, D - 0.006);
    });
  }
  // round vents: brushed bezel, dark throat, five vanes, a knob (and the centre stack under them)
  moved(0, sY, sZ, () => {
  for (const [x, y, s] of [[-(D - 0.086), 0.705, 0.95], [0.03, 0.7, 1.0], [D - 0.076, 0.705, 0.95]] as [number, number, number][]) {
    const m = mat(x, y, -0.652, -0.12, 0, 0, s);
    kit.add('alu', latheGeo([[0.04, -0.004], [0.046, 0.006], [0.053, 0.011], [0.0565, 0.008], [0.057, -0.004]], high ? 48 : 28, 'z', { flip: true, uRepeat: 1, vScale: 0.05 }), m);
    kit.add('gloss', latheGeo([[0.0405, -0.004], [0.04, -0.05]], 32, 'z', { flip: true }), m, 0.05);
    const back = new THREE.CircleGeometry(0.041, 24); back.translate(0, 0, -0.05); kit.add('plastic', back, m, 0.05);
    for (let i = -2; i <= 2; i++) { const w = 2 * Math.sqrt(Math.max(0, 0.04 * 0.04 - (i * 0.0135) ** 2)); const v = new THREE.BoxGeometry(w, 0.0022, 0.02); v.rotateX(0.3); v.translate(0, i * 0.0135, -0.012); kit.add('alu', v, m, 0.05); }
    const knob = new THREE.CylinderGeometry(0.0065, 0.0065, 0.012, 16); knob.rotateX(Math.PI / 2); kit.add('chrome', knob, m, 0.02);
  }
  // centre stack: a carbon panel under the centre vent with three knobs and a hazard switch
  {
    const p = new RoundedBoxGeometry(0.22, 0.2, 0.014, 2, 0.006); p.rotateX(-0.45); p.translate(0, 0.565, -0.6);
    kit.add(T.band === 'alu' ? 'gloss' : 'carbon', p);
    if (T.binnacle === 'screen') {
      // the Vela's centre touchscreen (the lower part of its display atlas)
      const sc = new THREE.PlaneGeometry(0.19, 0.17); const su = sc.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < su.count; i++) su.setXY(i, 0.7 + 0.3 * su.getX(i), su.getY(i) * 0.5);
      sc.rotateX(-0.45); sc.translate(0, 0.567, -0.592); kit.add(scrK, sc);
    } else for (const x of [-0.06, 0, 0.06]) { const k = latheGeo([[0.0, 0.016], [0.012, 0.016], [0.014, 0.012], [0.014, 0.0]], 24, 'z', { flip: true, vScale: 0.02 }); kit.add('alu', k, mat(x, 0.585, -0.585, -0.45)); }
  }
  });
  // the hypercar: an ice-blue line under the dash's lip, door to door, and a gauge pod on the dash top right of the
  // binnacle, kept for M5's Cold Thrust tank gauge (a bezel and a dark face with a faint ring; M5 draws the gauge)
  let gaugeAt: Cockpit['gaugeAt'];
  const ambLine = (path: V3[], across: V3, w: number) => {
    const rows = path.map((p) => [p.clone().addScaledVector(across, -w / 2), p.clone().addScaledVector(across, w / 2)]);
    const g = gridGeo(rows, { flip: true }), uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < rows.length; i++) for (let j = 0; j < 2; j++) uv.setXY(i * 2 + j, i / (rows.length - 1), j);
    return g;
  };
  if (hyper && mats.amb) {
    const [lz, ly] = LIP[LIP.length - 1];
    kit.add('amb', ambLine(range(-(D - 0.012), D - 0.012, 40).map((x) => v3(x, ly - 0.004, lz + 0.0035)), v3(0, 1, 0), 0.005));
    const gm = mat(0.06, 0.87 + sY, -0.74 + sZ, -0.62), r = 0.046;
    kit.add('alu', latheGeo([[r - 0.002, 0.004], [r + 0.003, 0.009], [r + 0.008, 0.006], [r + 0.009, -0.03]], high ? 48 : 28, 'z', { flip: true, vScale: 0.05 }), gm);
    const face = new THREE.CircleGeometry(r, 40); face.translate(0, 0, -0.002); kit.add('gloss', face, gm, 0.05);
    const ring = new THREE.RingGeometry(r * 0.8, r * 0.83, 48, 1); ring.translate(0, 0, -0.0012); kit.add('amb', ring, gm);
    const gl = new THREE.CircleGeometry(r + 0.002, 40); gl.translate(0, 0, 0.003); kit.add('gaugeGlass', gl, gm);
    const pod = new RoundedBoxGeometry(0.12, 0.11, 0.07, 3, 0.02); pod.translate(0, -0.004, -0.04); kit.add('nappa', pod, gm);
    gaugeAt = { at: v3(0, 0, 0.003).applyMatrix4(gm), normal: v3(0, 0, 1).transformDirection(gm), r };
  }

  // ---------------------------------------------------------------- the binnacle: tach, two displays, the cowl
  const clM = mat(-0.37 + sX, 0.835 + sY, -0.62 + sZ, -0.41);
  if (T.binnacle === 'screen') {
    // the Vela's wide display, free-standing over the dash on a leather-wrapped plinth (the hypercar's: the same
    // display centred on its driver, 12 % smaller and 2 cm lower so the whole screen sits between the rim's top and
    // the hub from its low seat, on a carbon plinth, with its own screen)
    const ds = hyper ? 0.88 : 1, dy = hyper ? -0.02 : 0;
    const vM = mat((hyper ? -0.37 : -0.17) + sX, 0.862 + dy + sY, -0.635 + sZ, -0.36);
    const bez = extrude(roundRect(0.64 * ds, 0.168 * ds, 0.018), 0.014, 0.003); bez.translate(0, 0, -0.0165); kit.add('gloss', bez, vM, 0.05);
    const scr = new THREE.PlaneGeometry(0.62 * ds, 0.15 * ds); const su = scr.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < su.count; i++) su.setY(i, 0.5 + 0.5 * su.getY(i));
    scr.translate(0, 0, -0.0018); kit.add('cluster', scr, vM);   // the driver's display: its own mesh, named 'cluster'
    const plinth = new RoundedBoxGeometry(0.34 * ds, 0.07, 0.1, 3, 0.02); plinth.translate((hyper ? -0.37 : -0.17) + sX, 0.81 + dy + sY, -0.68 + sZ); kit.add(hyper ? 'carbon' : 'nappa', plinth);
    ghost.push(bez.clone().applyMatrix4(vM));
  } else {
    const plate = extrude(roundRect(0.47, 0.18, 0.02), 0.012, 0.002); plate.translate(0, 0, -0.03);
    kit.add('gloss', plate, clM, 0.05);
    kit.add('gloss', latheGeo([[0.077, -0.022], [0.077, 0.011]], 64, 'z', { flip: true }), clM, 0.05);
    kit.add('alu', latheGeo([[0.0768, 0.011], [0.082, 0.0155], [0.0865, 0.0125], [0.0875, 0.002], [0.092, -0.004]], 72, 'z', { flip: true, vScale: 0.05 }), clM);
    const face = new THREE.CircleGeometry(0.072, 96); face.translate(0, 0, -0.004); kit.add('tach', face, clM);
    const cap = new THREE.SphereGeometry(0.0085, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); cap.rotateX(Math.PI / 2); cap.translate(0, 0, 0.004); kit.add('anod', cap, clM, 0.02);
    const gl = new THREE.CircleGeometry(0.078, 48); gl.translate(0, 0, 0.0105); kit.add('gaugeGlass', gl, clM);
    for (const sd of [-1, 1]) {
      const sm = clM.clone().multiply(mat(sd * 0.158, -0.004, -0.008, 0, -sd * 0.2, 0));
      const scr = new THREE.PlaneGeometry(0.118, 0.0738); kit.add(sd < 0 ? 'screenL' : 'screenR', scr, sm);
      const bez = extrude(roundRect(0.128, 0.084, 0.007), 0.006, 0.0015); bez.translate(0, 0, -0.0062); kit.add('gloss', bez, sm, 0.05);
    }
    // the cowl: black Nappa, stitched along its lip
    const PROF: [number, number][] = [[0.045, -0.092], [-0.03, -0.097], [-0.11, -0.09], [-0.135, -0.03], [-0.13, 0.06], [-0.09, 0.106], [-0.02, 0.125], [0.04, 0.121], [0.067, 0.107], [0.074, 0.097], [0.064, 0.09], [0.02, 0.088]];
    const cx = range(-0.255, 0.255, 24);
    const cowl = gridGeo(cx.map((x) => PROF.map(([z, y]) => v3(x, y * (1 - 0.06 * (x / 0.255) ** 4), z))), { flip: true });
    kit.add('nappa', cowl, clM); ghost.push(cowl.clone().applyMatrix4(clM));
    for (const sd of [-1, 1]) {
      const sh = new THREE.Shape(PROF.map(([z, y]) => new THREE.Vector2(z, y * 0.94)));
      const c = new THREE.ShapeGeometry(sh, 1); c.rotateY(-Math.PI / 2); c.translate(sd * 0.255, 0, 0);
      kit.add('nappa', c, clM, 0.1);
    }
    for (const off of [-0.003, 0.003]) {
      const path = cx.map((x) => v3(x, 0.1145 + off * 0.45, 0.0535 + off * 0.89));
      kit.add('stitch', stitchRow(path, path.map(() => v3(0, -0.45, -0.89)), path.map(() => v3(0, 0.89, -0.45))), clM);
    }
  }
  // the needle (it moves): a tapered blade, lit, on its own mesh in the binnacle's frame (not on the Vela)
  const needleMat = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff4a12, emissiveIntensity: 2.2, roughness: 0.4 });
  const needleShape = new THREE.Shape([new THREE.Vector2(-0.0023, -0.016), new THREE.Vector2(0.0023, -0.016), new THREE.Vector2(0.0009, 0.064), new THREE.Vector2(-0.0009, 0.064)]);
  const needle = new THREE.Mesh(new THREE.ShapeGeometry(needleShape), needleMat);
  const needlePivot = new THREE.Group(); needlePivot.applyMatrix4(clM); needlePivot.add(needle); needle.position.z = 0.0025;
  if (T.binnacle === 'tach') group.add(needlePivot);
  let rpm = 3150, rpmShown = rpm, flutter = 0;
  const setNeedle = (r: number) => { needle.rotation.z = G.tachAngle(r) - Math.PI / 2; };
  setNeedle(rpm);

  // ---------------------------------------------------------------- the steering wheel (spec.ts rim)
  const wheelMount = new THREE.Group(); wheelMount.name = 'steering-wheel';
  wheelMount.position.copy(wheelAt); wheelMount.rotation.x = WHEEL_TILT;
  group.add(wheelMount);
  const wheelM = mat(wheelAt.x, wheelAt.y, wheelAt.z, WHEEL_TILT);
  {
    const segs = high ? 22 : 12;
    const zone = (a0: number, a1: number, key: string, n: number, grow = 1) => {
      const f = rimFrames(a0, a1, n);
      wk.add(key, sweepGeo(f.path, f.N, f.B, (i) => rimA(f.as[i]) * grow, (i) => rimB(f.as[i]) * grow, segs, { around: 0.13, flip: true }));
      return f;
    };
    // each car's wheel: GT carbon top and bottom, perforated Nappa grips, carbon spokes, shift lights; Brio all
    // Nappa with aluminium spokes; Corsa all Alcantara with a yellow stripe at 12 o'clock, carbon spokes, shift
    // lights; Vela smooth Nappa on a round hub with two slim brushed spokes and the V badge
    const ws = T.wheel;
    const rimTop = ws === 'gt' ? 'carbon' : ws === 'corsa' ? 'alcW' : 'wheelNappa';
    const gripK = ws === 'corsa' ? 'alcW' : ws === 'vela' ? 'wheelNappa' : 'nappaPerf';
    const spokeK = ws === 'brio' || ws === 'vela' ? 'alu' : 'carbon';
    // The grips are perforated Nappa from 46 degrees below to 52 above each side, so a hand at spec GRIP (32 and
    // 148 degrees, about +-16 degrees of rim under the palm and fingers) sits wholly on leather: no seam, ring or
    // step under the fingers. Carbon only across the top (the shift lights) and the bottom.
    const G0 = 0.91, G1 = Math.PI - G0, B0 = Math.PI + 0.8, B1 = Math.PI * 2 - 0.8;
    zone(G0, G1, rimTop, high ? 56 : 30);
    zone(B0, B1, rimTop, high ? 52 : 28);
    const grips = [zone(B1 - Math.PI * 2, G0, gripK, high ? 64 : 34), zone(G1, B0, gripK, high ? 64 : 34)];
    // the perforation stops short of the edges: a plain Nappa band where each grip meets the carbon
    if (gripK === 'nappaPerf') for (const [a0, a1] of [[G0 - 0.09, G0], [B1 - Math.PI * 2, B1 - Math.PI * 2 + 0.09], [G1, G1 + 0.09], [B0 - 0.09, B0]]) zone(a0 - 0.002, a1 + 0.002, 'wheelNappa', 8);
    // the Corsa's centre marker: a 25 mm yellow band at the top, a hair proud
    if (ws === 'corsa') zone(Math.PI / 2 - 0.07, Math.PI / 2 + 0.07, 'stripe', 8, 1.03);
    // double stitching on the inside of each grip, toward the driver
    for (const f of grips) for (const th of [Math.PI * 0.69, Math.PI * 0.81]) {
      const path: V3[] = [], across: V3[] = [], lift: V3[] = [];
      f.path.forEach((p, i) => {
        const a = rimA(f.as[i]), b = rimB(f.as[i]), N = f.N[i], B = f.B[i];
        const pos = p.clone().addScaledVector(N, Math.cos(th) * a).addScaledVector(B, Math.sin(th) * b);
        const nrm = N.clone().multiplyScalar(Math.cos(th) / a).addScaledVector(B, Math.sin(th) / b).normalize();
        const tang = rimAt(f.as[i] + 0.002).sub(rimAt(f.as[i] - 0.002)).normalize();
        path.push(pos); lift.push(nrm); across.push(tang.clone().cross(nrm).normalize());
      });
      wk.add('stitch', stitchRow(path, across, lift, 0.0016));
    }
    // brushed rings where leather meets carbon
    if (ws === 'gt') for (const a of [G0, G1, B0, B1]) {
      const p = rimAt(a), t = rimAt(a + 0.002).sub(rimAt(a - 0.002)).normalize();
      // a 3 mm band, 0.8 mm proud of the rim (the torus's tube is scaled along the rim to 2.6 mm)
      const ring = new THREE.TorusGeometry(1, 0.075, 8, 40); ring.scale(rimA(a) * 0.97, rimB(a) * 0.97, 0.035);
      // the torus's ring plane: x along the outward normal, y toward the driver, axis along the rim
      const N = p.clone().sub(t.clone().multiplyScalar(p.dot(t))).normalize();
      ring.applyMatrix4(new THREE.Matrix4().makeBasis(N, v3(0, 0, 1), t).setPosition(p));
      wk.add('alu', ring, null, 0.02);
    }
    // shift lights across the top, on the driver's face of the rim
    if (ws === 'gt' || ws === 'corsa') for (let i = 0; i < 10; i++) {
      const a = 2.0 - (i / 9) * 0.88, p = rimAt(a);
      const led = new RoundedBoxGeometry(0.0085, 0.0042, 0.003, 1, 0.001);
      led.rotateZ(a - Math.PI / 2); led.translate(p.x - Math.cos(a) * 0.004, p.y - Math.sin(a) * 0.004, rimB(a) + 0.0006);
      wk.add('led', led, null, 0.02);
    }
    // hub: a Nappa airbag cover with the badge, three carbon spokes with aluminium inlays and button pods
    const hub = ws === 'vela' ? extrude(roundRect(0.13, 0.13, 0.065, 0, -0.004), 0.034, 0.012) : extrude(roundRect(0.19, 0.122, 0.04, 0, -0.004), 0.034, 0.012);
    hub.translate(0, 0, -0.036);
    wk.add('wheelNappa', hub);
    const seam = new THREE.TorusGeometry(1, 0.012, 4, 64); if (ws === 'vela') seam.scale(0.05, 0.05, 1); else seam.scale(0.071, 0.046, 1); seam.translate(0, -0.004, -0.001);
    wk.add('gloss', seam, null, 0.05);
    const badge = new THREE.CircleGeometry(0.022, 40); badge.translate(0, 0.004, -0.0005);
    wk.add('badgeHub', badge);
    const bring = new THREE.TorusGeometry(0.0228, 0.0016, 8, 48); bring.translate(0, 0.004, -0.0005); wk.add('chrome', bring, null, 0.02);
    for (const sd of [-1, 1]) {
      const sp = ws === 'vela' ? new RoundedBoxGeometry(0.11, 0.03, 0.016, 3, 0.007) : new RoundedBoxGeometry(0.082, 0.052, 0.02, 3, 0.008);
      sp.translate(sd * (ws === 'vela' ? 0.12 : 0.13), -0.006, -0.012); wk.add(spokeK, sp);
      const inlay = new THREE.BoxGeometry(0.07, 0.003, 0.002); inlay.translate(sd * 0.13, -0.03, -0.0015); wk.add('alu', inlay, null, 0.02);
      const pod = new RoundedBoxGeometry(0.058, 0.04, 0.008, 2, 0.004); pod.translate(sd * 0.128, -0.004, 0.0); wk.add('gloss', pod, null, 0.05);
      // three buttons a side, each a cell of the icon atlas
      const cells = sd < 0 ? [0, 2, 3] : [1, 4, 5];
      [[-0.013, 0.007], [0.013, 0.007], [0, -0.01]].forEach(([bx, by], k) => {
        const b = new THREE.CylinderGeometry(0.0072, 0.0076, 0.004, 24, 1, false); b.rotateX(Math.PI / 2);
        b.translate(sd * 0.128 + bx, -0.004 + by, 0.005); wk.add('gloss', b, null, 0.05);
        const face = new THREE.CircleGeometry(0.0066, 24); const uv = face.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (cells[k] + uv.getX(i)) / 8);
        face.translate(sd * 0.128 + bx, -0.004 + by, 0.0071); wk.add('icons', face);
      });
    }
    if (ws !== 'vela') {
    const bot = new RoundedBoxGeometry(0.058, 0.07, 0.02, 3, 0.008); bot.translate(0, -0.102, -0.012); wk.add(spokeK, bot);
    const binl = new THREE.BoxGeometry(0.003, 0.05, 0.002); binl.translate(0, -0.104, -0.0015); wk.add('alu', binl, null, 0.02);
    // engine start (lower left) and the drive-mode dial (lower right)
    const st = new THREE.CylinderGeometry(0.0135, 0.0142, 0.008, 32); st.rotateX(Math.PI / 2); st.translate(-0.06, -0.05, 0.002); wk.add('red', st);
    const stf = new THREE.CircleGeometry(0.0128, 32); stf.translate(-0.06, -0.05, 0.0062); wk.add('start', stf);
    const sring = new THREE.TorusGeometry(0.0145, 0.0014, 6, 40); sring.translate(-0.06, -0.05, 0.003); wk.add('chrome', sring, null, 0.02);
    const dial = latheGeo([[0.0, 0.009], [0.012, 0.009], [0.0165, 0.007], [0.0175, 0.0], [0.0175, -0.004]], 40, 'z', { flip: true, vScale: 0.03 });
    dial.translate(0.06, -0.05, 0.0); wk.add('anod', dial);
    const ptr = new THREE.BoxGeometry(0.003, 0.012, 0.0015); ptr.translate(0, 0.006, 0.0098); ptr.rotateZ(0.6); ptr.translate(0.06, -0.05, 0); wk.add('red', ptr, null, 0.02);
    const scale = new THREE.RingGeometry(0.019, 0.032, 40, 1); scale.translate(0.06, -0.05, -0.0005);
    const suv = scale.attributes.uv as THREE.BufferAttribute, sp2 = scale.attributes.position;
    for (let i = 0; i < suv.count; i++) suv.setXY(i, (sp2.getX(i) - 0.06) / 0.07 + 0.5, (sp2.getY(i) + 0.05) / 0.07 + 0.5);
    wk.add('dial', scale);
    }
  }
  // the column, its shroud and the paddles: fixed to the car, not the wheel
  {
    const col = new THREE.CylinderGeometry(0.03, 0.042, 0.26, 24); col.rotateX(Math.PI / 2); col.translate(0, -0.005, -0.17); kit.add('plastic', col, wheelM, 0.05);
    const shroud = new RoundedBoxGeometry(0.13, 0.09, 0.17, 3, 0.022); shroud.translate(0, -0.008, -0.13); kit.add('nappa', shroud, wheelM);
    for (const sd of [-1, 1]) {
      const s = new THREE.Shape();
      s.moveTo(0, -0.024); s.lineTo(0.098, -0.034); s.quadraticCurveTo(0.142, -0.02, 0.138, 0.012); s.quadraticCurveTo(0.13, 0.05, 0.09, 0.046); s.lineTo(0, 0.026); s.closePath();
      const p = extrude(s, 0.006, 0.0018, 16);
      if (sd < 0) p.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
      p.translate(sd * 0.045, 0.028, -0.052);
      const bu = p.attributes.uv as THREE.BufferAttribute, bp = p.attributes.position; for (let i = 0; i < bu.count; i++) bu.setXY(i, bp.getX(i) / 0.12, bp.getY(i) / 0.12);
      kit.add('anod', p, wheelM.clone().multiply(mat(0, 0, 0, 0, 0, sd * 0.1)));
    }
  }

  // ---------------------------------------------------------------- A-pillars, header, headliner, rails
  const sgInner = (u: number, v: number, sd: 1 | -1, d = 0.006) => { const p = sgPoint(u, v, sd); p.x -= sd * d; return p; };
  for (const sd of [-1, 1] as const) {
    const rows: V3[][] = [];
    for (const t of range(0, 1.02, 16)) {
      const pw = wsPoint(sd, Math.min(1, t), -0.006), ps = sgInner(0, Math.min(1, t), sd, 0.008);
      const mid = pw.clone().lerp(ps, 0.5), D = CENTRE.clone().sub(mid).normalize();
      const r: V3[] = [];
      for (const u of range(-0.12, 1.12, 10)) {
        const b = Math.sin(Math.PI * clamp(u, 0, 1));
        r.push(pw.clone().lerp(ps, clamp(u, 0, 1)).addScaledVector(D, 0.008 + 0.03 * b + (u < 0 || u > 1 ? -0.004 : 0)).addScaledVector(pw.clone().sub(ps).normalize(), u < 0 ? -u * 0.08 : u > 1 ? -(u - 1) * 0.08 : 0));
      }
      rows.push(r);
    }
    kit.add('head', gridGeo(rows, { flip: sd > 0 }));
  }
  // header beam along the top of the glass, and the headliner back to the bulkhead
  {
    // the header: a slim padded lip that wraps the glass's top edge into the headliner (kept tight to the roof so
    // the driver's view up the road stays open: its lower edge sits ~18 degrees above the eye line)
    {
      const hs = range(-1.04, 1.04, high ? 40 : 20), rows: V3[][] = [];
      for (const s of hs) {
        const sc = clamp(s, -1, 1), p0 = wsPoint(sc, 0.955, -0.007), p1 = wsPoint(sc, 0.985, -0.016), p2 = wsPoint(sc, 1, -0.02);
        const [hx, hz0] = wsXZ(sc, 1), hz = hz0 + 0.03, ph = v3(hx * 0.99, body.top(hz, Math.abs(hx)) - 0.024, hz);
        const out = (s - sc) * 0.6;
        rows.push([p0, p1, p2, ph].map((p) => p.clone().add(v3(Math.sign(s) * Math.abs(out) * 0.4, -Math.abs(out) * 0.1, Math.abs(out) * 0.4))));
      }
      kit.add('head', gridGeo(rows, { flip: true }));
    }
    const zBack = 0.565, NZ = high ? 16 : 8, NX = high ? 24 : 12;
    const edgeX = (z: number) => {
      if (z <= SG.ft[0]) return Math.abs(sgPoint(0, 1, 1).x);
      if (z >= SG.rt[0]) return body.canopyX(z, SG.rt[1] - (z - SG.rt[0]) * 0.25) - 0.01;
      return Math.abs(sgPoint((z - SG.ft[0]) / (SG.rt[0] - SG.ft[0]), 1, 1).x);
    };
    const rows: V3[][] = [];
    for (let i = 0; i <= NZ; i++) {
      const w = i / NZ, r: V3[] = [];
      for (let j = 0; j <= NX; j++) {
        const s = -1 + 2 * (j / NX), z0 = wsXZ(clamp(s, -1, 1), 1)[1] + 0.025, z = lerp(z0, zBack, w), x = s * (edgeX(z) - 0.012);
        r.push(v3(x, body.top(z, Math.abs(x)) - 0.024 - 0.004 * Math.sin(Math.PI * w), z));
      }
      rows.push(r);
    }
    // the Vela's glass roof: the headliner stops round it, the glass (tinted, seen from below) fills the gap
    const RF = P.roofGlass;
    const inRoof = (p: V3) => !!RF && Math.abs(p.x) < RF.x * 0.93 && p.z > RF.z0 + 0.035 && p.z < RF.z1 - 0.035;
    const hl = gridGeo(rows, { flip: true });
    if (RF) {
      const [lining, hole] = splitGrid(hl, NZ + 1, NX + 1, (i, j) => inRoof(rows[i][j].clone().add(rows[i + 1][j + 1]).multiplyScalar(0.5)));
      kit.add('head', lining);
      const gl = hole.clone(); const gp = gl.attributes.position;
      for (let k = 0; k < gp.count; k++) gp.setY(k, gp.getY(k) + 0.012);
      kit.add('roofGlass', gl);
    } else kit.add('head', hl);
    // sun visors folded up against the headliner, hinged outboard, clipped inboard (not in the hypercar's narrow
    // canopy: its header sits just over the driver's eye line)
    if (!hyper) for (const sd of [-1, 1] as const) {
      const xc = sd * 0.4, z0 = wsXZ(sd * 0.5, 1)[1] + 0.04, z1 = z0 + 0.175;
      const y0 = body.top(z0, Math.abs(xc)) - 0.024 - 0.013, y1 = body.top(z1, Math.abs(xc)) - 0.024 - 0.013;
      const Z = v3(0, y1 - y0, z1 - z0).normalize(), X = v3(1, 0, 0), Y = Z.clone().cross(X).normalize();
      const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(v3(xc, (y0 + y1) / 2, (z0 + z1) / 2));
      kit.add('head', new RoundedBoxGeometry(0.4, 0.02, 0.172, 3, 0.0095), m);
      // a stitched welt round the edge, and the hinge rod and clip (satin black)
      const edge: V3[] = [];
      for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); edge.push(v3(Math.sign(c) * Math.pow(Math.abs(c), 0.25) * 0.192, -0.0102, Math.sign(s2) * Math.pow(Math.abs(s2), 0.25) * 0.078).applyMatrix4(m)); }
      const nY = Y.clone().negate(), acr = edge.map((_, k) => edge[Math.min(40, k + 1)].clone().sub(edge[Math.max(0, k - 1)]).normalize().cross(nY).normalize());
      kit.add('stitchDark', stitchRow(edge, acr, edge.map(() => nY), 0.0014));
      const rod = new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 10); rod.rotateZ(Math.PI / 2); rod.translate(sd * 0.215, 0.006, -0.06); kit.add('plastic', rod, m, 0.05);
      const clip = new RoundedBoxGeometry(0.03, 0.014, 0.02, 2, 0.005); clip.translate(-sd * 0.215, 0.006, -0.05); kit.add('plastic', clip, m, 0.05);
    }
    for (const sd of [-1, 1] as const) {
      const rail = range(0, 1, 18).map((u) => { const p = sgInner(u, 1, sd, 0.016); p.y -= 0.012; return p; });
      rail.push(v3(sd * (edgeX(zBack) - 0.018), body.top(zBack, edgeX(zBack)) - 0.05, zBack));
      kit.add('head', tubeGeo(rail, () => 0.017, high ? 10 : 6));
    }
  }
  // ---------------------------------------------------------------- side glass (inside) with frit
  for (const sd of [-1, 1] as const) {
    const nu = high ? 22 : 12, nv = high ? 9 : 5, rows: V3[][] = [];
    for (let i = 0; i <= nv; i++) { const r: V3[] = []; for (let j = 0; j <= nu; j++) r.push(sgInner(j / nu, i / nv, sd)); rows.push(r); }
    const [clear, frit] = splitGrid(gridGeo(rows, { flip: sd > 0 }), nv + 1, nu + 1, (i, j) => i === nv - 1 || j === 0 || j === nu - 1);
    kit.add('sideGlass', clear); kit.add('frit', frit);
  }

  // ---------------------------------------------------------------- doors
  const sill = (z: number) => lerp(SG.fb[1], SG.rb[1], clamp((z - SG.fb[0]) / (SG.rb[0] - SG.fb[0]), 0, 1)) - 0.004;
  // the cabin's side wall: the door cards' face at 0.866 m; in the hypercar's narrow canopy, 15 mm inside its flank
  // just under the glass (0.39 to 0.49 m), so nothing of the tub stands out over the sidepods
  const wallX = (z: number) => hyper ? body.canopyX(z, sill(z) - 0.02) - 0.015 : 0.866;
  for (const sd of [-1, 1] as const) {
    const zs = range(-0.94, 0.5, high ? 26 : 14);
    // (the hypercar: every door part below is moved in to its wall, and its heights scaled so the insert's top meets
    // the glass; the sill cap is built in place)
    const kw = kit.warp;
    if (hyper) kit.warp = (p) => { p.x = Math.sign(p.x) * (Math.abs(p.x) - 0.866 + wallX(p.z)); p.y = 0.2 + (p.y - 0.2) * (sill(p.z) - 0.012 - 0.2) / 0.61; return true; };
    const arm = (z: number) => sstep(-0.62, -0.42, z) * (1 - sstep(0.22, 0.4, z));
    const X = (x: number) => sd * x;
    const flip = sd > 0;
    // lower panel up to the armrest, the armrest (cognac), the Alcantara insert, the sill cap to the glass
    kit.add('doorLow', loftZ(zs, (z) => { const a = arm(z); return [[X(0.866), 0.2], [X(0.862), 0.36], [X(0.858), 0.5], [X(0.85 - 0.02 * a), 0.545], [X(0.85 - 0.055 * a), 0.585]]; }, flip));
    kit.add('tan', loftZ(zs, (z) => { const a = arm(z); return [[X(0.85 - 0.055 * a), 0.585], [X(0.85 - 0.068 * a), 0.618], [X(0.85 - 0.06 * a), 0.646], [X(0.856 - 0.03 * a), 0.664], [X(0.858), 0.676]]; }, flip));
    kit.add('alc', loftZ(zs, () => [[X(0.858), 0.676], [X(0.86), 0.74], [X(0.858), 0.81]], flip));
    if (!hyper) kit.add('nappa', loftZ(zs, (z) => { const ys = sill(z), gx = body.canopyX(z, ys + 0.012) - 0.008; return [[X(0.858), 0.81], [X(0.856), ys - 0.05], [X(0.845), ys - 0.012], [X(Math.min(0.84, gx + 0.006)), ys + 0.002], [X(gx - 0.002), ys + 0.006]]; }, flip));
    // stitches along the armrest's top edge
    for (const off of [0, 0.004]) {
      const path = zs.filter((z) => arm(z) > 0.05).map((z) => { const a = arm(z); return v3(X(0.856 - 0.03 * a - 0.0015), 0.664 - off, z); });
      if (path.length > 2) kit.add('stitchDark', stitchRow(path, path.map(() => v3(0, 1, 0)), path.map(() => v3(-sd, 0, 0))));
    }
    // the hypercar's ambient line along the door card's Alcantara insert
    if (hyper && mats.amb) kit.add('amb', ambLine(zs.map((z) => v3(X(0.8565), 0.735, z)), v3(0, 1, 0), 0.005));
    // a carbon strip under the sill, the pull strap, the release, a speaker
    if (!hyper) { const strip = new RoundedBoxGeometry(0.012, 0.022, 1.36, 2, 0.004); strip.translate(X(0.853), 0.8, -0.22); kit.add('carbon', strip); }
    // the pull strap: a loop of cognac leather, flat in section, its ends in small aluminium clamps
    const sp = [v3(X(0.852), 0.71, -0.66), v3(X(0.83), 0.707, -0.635), v3(X(0.818), 0.703, -0.58), v3(X(0.82), 0.699, -0.5), v3(X(0.85), 0.695, -0.45)];
    kit.add('tan', tubeGeo(sp, () => 0.012, 8, { rb: () => 0.0028, up: v3(0, 1, 0) }));
    for (const e of [sp[0], sp[sp.length - 1]]) { const c = new RoundedBoxGeometry(0.014, 0.03, 0.022, 2, 0.004); c.translate(e.x - sd * 0.004, e.y, e.z); kit.add('alu', c); }
    const rel = new RoundedBoxGeometry(0.012, 0.016, 0.06, 2, 0.004); rel.translate(X(0.85), 0.77, -0.72); kit.add('alu', rel);
    const spk = latheGeo([[0.0, 0.0], [0.06, 0.0], [0.068, -0.004]], 32, 'z', { flip: true, vScale: 0.05 });
    spk.applyMatrix4(mat(X(0.858), 0.43, -0.7, 0, -sd * Math.PI / 2)); kit.add('alu', spk);
    kit.warp = kw;
    // the hypercar's sill cap: carbon, from the wall's top to the glass
    if (hyper) kit.add('carbon', loftZ(zs, (z) => {
      const ys = sill(z), w = wallX(z), gx = body.canopyX(z, ys + 0.012) - 0.008;
      return [[X(w - 0.002), ys - 0.014], [X(w + 0.002), ys - 0.009], [X(lerp(w, gx, 0.5)), ys - 0.003], [X(gx + 0.002), ys + 0.002], [X(gx - 0.002), ys + 0.006]];
    }, flip), null, 0.1);
  }

  // ---------------------------------------------------------------- bulkhead behind the seats, with its window
  {
    const z = 0.565, sh = new THREE.Shape();
    const pts: [number, number][] = [[wallX(z) + 0.012, 0.2], [wallX(z) + 0.012, sill(z) - 0.01]];
    for (const a of range(body.canopyX(z, sill(z)) - 0.01, 0, 14)) pts.push([a, body.top(z, a) - 0.035]);
    const all = [...pts, ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
    sh.moveTo(all[0][0], all[0][1]); for (const p of all.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath();
    // (the hypercar: a small slot under its low roof)
    const winY = hyper ? body.top(z, 0) - 0.15 : 1.065, win = hyper ? roundRect(0.4, 0.09, 0.03, 0, winY) : roundRect(0.86, 0.22, 0.05, 0, winY);
    sh.holes.push(win);
    const g = new THREE.ShapeGeometry(sh, 4); g.rotateY(Math.PI); g.translate(0, 0, z);
    kit.add('alc', g, null, 0.08);
    const glassW = new THREE.ShapeGeometry(win, 4); glassW.rotateY(Math.PI); glassW.translate(0, 0, z + 0.006); kit.add('sideGlass', glassW);
    const ring = new THREE.Shape((hyper ? roundRect(0.44, 0.13, 0.045, 0, winY) : roundRect(0.9, 0.26, 0.07, 0, winY)).getPoints(6)); ring.holes.push(new THREE.Path(win.getPoints(6)));
    const rg = new THREE.ShapeGeometry(ring, 4); rg.rotateY(Math.PI); rg.translate(0, 0, z - 0.002); kit.add('frit', rg, null, 0.05);
  }

  // ---------------------------------------------------------------- seats: cognac Nappa bolsters, perforated centres, carbon shells
  // (the hypercar's buckets: 18 % narrower, at its seats' x, lower: seatWarp)
  const seatWarp = (cx: number, fn: () => void) => {
    if (!hyper) { fn(); return; }
    const w = kit.warp, wS = 0.82, dx = -Math.sign(cx) * sX;
    kit.warp = (p) => { p.x = cx + (p.x - cx) * wS + dx; p.y += seatY; p.z += sZ; return true; };
    try { fn(); } finally { kit.warp = w; }
  };
  for (const cx of [-0.37, 0.37]) seatWarp(cx, () => {
    const U = [-0.27, -0.26, -0.22, -0.17, -0.13, -0.07, 0, 0.07, 0.13, 0.17, 0.22, 0.26, 0.27];
    const bol = (u: number) => { const a = Math.abs(u); return a > 0.13 ? 0.095 * Math.sin(Math.PI * clamp((a - 0.13) / 0.14, 0, 1) * 0.92) + (a > 0.25 ? -0.06 * (a - 0.25) / 0.02 : 0) : -0.006 * Math.cos(a / 0.13 * Math.PI / 2); };
    // cushion along z: from the front edge back to the backrest
    const cz = range(-0.2, 0.28, 10);
    const cush = (key: string, us: number[]) => kit.add(key, gridGeo(cz.map((z) => { const f = sstep(-0.2, -0.12, z); return us.map((u) => v3(cx + u, 0.25 + 0.06 * f + bol(u) * f + 0.02 * (1 - f) * 0, z)); }), { flip: true }));
    cush('tan', U.slice(0, 5)); cush('tanPerf', U.slice(4, 9)); cush('tan', U.slice(8));
    const front = new RoundedBoxGeometry(0.54, 0.14, 0.06, 3, 0.025); front.translate(cx, 0.22, -0.2); kit.add('tan', front);
    // backrest, reclined 22 degrees, with a head section
    const up = v3(0, Math.cos(0.38), Math.sin(0.38)), fwd = v3(0, -Math.sin(0.38), Math.cos(0.38)).negate(), base = v3(cx, 0.3, 0.28);
    const hs = range(0, 0.8, 14);
    const back = (key: string, us: number[], d = 0) => kit.add(key, gridGeo(hs.map((h) => {
      const head = sstep(0.52, 0.6, h), narrow = 1 - 0.42 * head;
      return us.map((u) => base.clone().addScaledVector(up, h).add(v3(u * narrow, 0, 0)).addScaledVector(fwd, (bol(u) * (1 - 0.5 * head) - d) + 0.02 * Math.sin(Math.PI * h / 0.8)));
    }), { flip: true }));
    back('tan', U.slice(0, 5)); back('tanPerf', U.slice(4, 9)); back('tan', U.slice(8));
    back('carbon', [U[0], -0.2, -0.1, 0, 0.1, 0.2, U[12]].map((u) => u * 1.02), 0.075);
  });
  // ---------------------------------------------------------------- the Corsa: a roll hoop behind the seats, a four-point harness on the passenger seat
  if (P.interior === 'corsa' || hyper) {
    const z = 0.535, yTop = body.top(z, 0) - 0.085, Xm = hyper ? wallX(z) - 0.04 : D - 0.11, hoop: V3[] = [];
    for (let k = 0; k <= 40; k++) {
      const sx = -1 + 2 * (k / 40), y = 0.16 + (yTop - 0.16) * Math.pow(Math.max(0, 1 - Math.abs(sx) ** 5), 1 / 5);
      let x = sx * Xm; if (y > 0.8) x = Math.sign(sx) * Math.min(Math.abs(x), body.canopyX(z, y) - 0.06);
      hoop.push(v3(x, y, z));
    }
    kit.add('hoop', tubeGeo(hoop, () => 0.021, high ? 12 : 8), null, 0.1);
    // the harness: two shoulder straps out of the backrest's slots, down the seat to a turn-buckle, two lap belts
    seatWarp(0.37, () => {
    const cx = 0.37, upV = v3(0, Math.cos(0.38), Math.sin(0.38)), fwdV = v3(0, Math.sin(0.38), -Math.cos(0.38)), base = v3(cx, 0.3, 0.28);
    const onBack = (h: number, u: number) => base.clone().addScaledVector(upV, h).add(v3(u, 0, 0)).addScaledVector(fwdV, 0.02 * Math.sin(Math.PI * h / 0.8) + 0.006);
    const buckle = v3(cx, 0.322, 0.03);
    for (const sd of [-1, 1]) {
      const path: V3[] = [];
      for (let k = 0; k <= 8; k++) { const h = 0.6 - 0.46 * (k / 8); path.push(onBack(h, sd * (0.075 - 0.03 * (k / 8)))); }
      path.push(v3(cx + sd * 0.04, 0.33, 0.17), v3(cx + sd * 0.02, 0.326, 0.08), buckle.clone().add(v3(sd * 0.01, 0, -0.01)));
      kit.add('belt', tubeGeo(path, () => 0.019, 6, { rb: () => 0.0022, up: v3(1, 0, 0) }), null, 0.1);
      const lap = [v3(cx + sd * 0.235, 0.36, 0.2), v3(cx + sd * 0.17, 0.335, 0.12), v3(cx + sd * 0.08, 0.327, 0.05), buckle.clone().add(v3(sd * 0.02, 0, 0))];
      kit.add('belt', tubeGeo(lap, () => 0.019, 6, { rb: () => 0.0022, up: v3(0, 0, 1) }), null, 0.1);
      // adjusters on the shoulder straps
      const adj = new RoundedBoxGeometry(0.05, 0.008, 0.03, 2, 0.003); adj.applyMatrix4(new THREE.Matrix4().makeBasis(v3(1, 0, 0), fwdV, upV.clone().negate()).setPosition(onBack(0.36, sd * 0.06).addScaledVector(fwdV, 0.004)));
      kit.add('alu', adj, null, 0.05);
    }
    const bk2 = new THREE.CylinderGeometry(0.034, 0.034, 0.014, 32); bk2.translate(buckle.x, buckle.y + 0.004, buckle.z); kit.add('alu', bk2, null, 0.05);
    });
  }

  // ---------------------------------------------------------------- console, floor
  {
    // (the hypercar's console: narrower between its closer seats, and lower with them)
    const cw = hyper ? 0.7 : 1, w = kit.warp;
    if (hyper) kit.warp = (p) => { p.x *= cw; p.y += seatY; p.z += sZ; return true; };
    const con = new RoundedBoxGeometry(0.24, 0.36, 1.0, 3, 0.03); con.translate(0, 0.27, -0.13); kit.add('nappa', con);
    const lid = new RoundedBoxGeometry(0.21, 0.014, 0.94, 2, 0.005); lid.translate(0, 0.452, -0.13); kit.add('carbon', lid);
    const bridge = new RoundedBoxGeometry(0.08, 0.04, 0.3, 4, 0.016); bridge.translate(0, 0.475, -0.38); kit.add('alu', bridge);
    kit.warp = w;
    const floor = new THREE.PlaneGeometry(1.74, 1.6); floor.rotateX(-Math.PI / 2); floor.translate(0, 0.12 + floorY, -0.25); kit.add('carpet', floor);
    const toe = new THREE.PlaneGeometry(1.74, 0.42); toe.rotateX(-0.85); toe.translate(0, 0.27 + floorY, -1.12); kit.add('carpet', toe);
  }

  // ---------------------------------------------------------------- the car's body seen through the glass
  if (o.body ?? true) {
    // the whole shell (no glass: the cockpit has its own): the bonnet and wings through the windscreen, the door
    // tops and the haunches through the side glass and in the door mirrors, the engine cover in the rear-view
    B.buildBody(bk, { q, glass: false, mirrors: false });
    for (const sd of [-1, 1] as const) mirrorParts(bk, sd, !live || sd > 0);
  }

  // ---------------------------------------------------------------- the dashboard's ghost in the windscreen
  {
    const p0 = wsPoint(0, 0.3, -0.006), p1 = wsPoint(-0.8, 0.3, -0.006), p2 = wsPoint(0, 0.7, -0.006);
    const n = p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize(); if (n.y < 0) n.negate();
    const src = mergeGeometries(ghost.map(clean))!;
    // brightness: surfaces facing up see the sky through the glass; the reflection keeps that, dimly
    const P = src.attributes.position, N = src.attributes.normal, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const k = 0.25 + 0.75 * Math.max(0, N.getY(i)); col[i * 3] = k; col[i * 3 + 1] = k * 0.97; col[i * 3 + 2] = k * 0.93; }
    src.setAttribute('color', new THREE.BufferAttribute(col, 3));
    src.applyMatrix4(reflectMatrix(p0, n));
    // keep only what the driver sees through the windscreen
    const d = n.dot(p0), E = eye, keepIdx: number[] = [];
    const C = new THREE.Vector3(), Pp = new THREE.Vector3();
    for (let t = 0; t < P.count; t += 3) {
      C.set(0, 0, 0); for (let k = 0; k < 3; k++) C.add(v3(P.getX(t + k), P.getY(t + k), P.getZ(t + k))); C.multiplyScalar(1 / 3);
      const dir = C.clone().sub(E), den = n.dot(dir); if (Math.abs(den) < 1e-6) continue;
      const s = (d - n.dot(E)) / den; if (s <= 0 || s >= 1) continue;
      Pp.copy(E).addScaledVector(dir, s);
      const tt = (Pp.z - WS.zb) / (WS.zt - WS.zb), half = WS.xb + (WS.xt - WS.xb) * tt;
      if (tt > 0.03 && tt < 0.95 && Math.abs(Pp.x) < half - 0.04) keepIdx.push(t, t + 1, t + 2);
    }
    src.setIndex(keepIdx);
    const gm = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x2a2622, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const gh = new THREE.Mesh(src, gm); gh.name = 'windscreen-reflection'; gh.renderOrder = 3;
    group.add(gh);
  }

  // ---------------------------------------------------------------- build
  kit.build(mats, group, { shadow: (k) => ['alc', 'nappa', 'tan', 'paint', 'carbon', 'plastic'].includes(k) });
  wk.build(mats, wheelMount, { shadow: (k) => ['nappaPerf', 'wheelNappa', 'carbon'].includes(k) });
  const outside = new THREE.Group(); outside.name = 'body'; group.add(outside);
  bk.build(mats, outside, { shadow: (k) => k === 'paint' || k === 'mirrorPaint' || k === 'dark' });
  for (const k of ['glass', 'sideGlass', 'gaugeGlass', 'dust']) { const m = group.getObjectByName(k); if (m) { m.renderOrder = k === 'dust' ? 4 : 2; m.castShadow = false; } }
  // names the HUD and the suite look for: the cluster (the driver's display, or the tach's face) and the windscreen
  { const t = T.binnacle === 'tach' ? group.getObjectByName('tach') : null; if (t) t.name = 'cluster'; const w = group.getObjectByName('glass'); if (w) w.name = 'windscreen'; }

  // ---------------------------------------------------------------- mirrors with reflections
  let rearView: Cockpit['rearView'];
  const mirrors: CarMirror[] = [];
  {
    // rear-view: frameless, hung from the top of the windscreen over the driver's side (x ~ -0.22, about 24 degrees
    // right of the eye: at the centre of the glass it sits 45 degrees out and more than half of it is off screen at
    // the game's 58-degree cockpit view), its face turned so the driver looks straight back along the car
    // With the environment map ('env': phones, Low and Medium) the glass keeps its old place just left of centre
    // and its old aim through the bulkhead window: moved over the driver's side it covered the road in portrait.
    const mount = wsPoint(live ? -0.36 : -0.05, 0.935, -0.008), inward = body.topNormal(mount.x, mount.z).negate();
    const mb = mount.clone().addScaledVector(inward, 0.03).add(v3(0, -0.034, 0.012));
    // aimed straight back, the centre of the glass 2.5 degrees below level: the horizon sits in the upper half and a
    // car twenty metres behind fills the middle (the glass sees 7.5 degrees top to bottom from the driver's eye).
    // The game's rear-view renders the world without the player's car (PlayerCar), so the aim ignores the bulkhead
    // window and the engine cover behind it.
    const nrm = eye.clone().sub(mb).normalize().add((live ? v3(0, mb.y - 30 * Math.tan(2.5 * Math.PI / 180), 30) : v3(0, 0.75, 2.3)).sub(mb).normalize()).normalize();
    // (the hypercar has no rear-view mirror: under its low header it would hang across the road ahead, and its
    // canopy's narrow spine leaves nothing to see behind; its door mirrors do the work)
    if (!hyper) rearView = { at: mb.clone(), normal: nrm.clone(), w: 0.262, h: 0.07 };
    const look = new THREE.Object3D(); look.position.copy(mb); look.lookAt(mb.clone().add(nrm)); look.updateMatrix();
    const housing = extrude(roundRect(0.262, 0.07, 0.03), 0.026, 0.006, 8); housing.translate(0, 0, -0.03); housing.applyMatrix4(look.matrix);
    const stem = new THREE.CylinderGeometry(0.0065, 0.0075, 1, 12); stem.applyMatrix4(between(mount, mb.clone().addScaledVector(nrm, -0.03)));
    const extra = new Kit(); extra.add('gloss', housing); extra.add('plastic', stem, null, 0.02);
    const base = new RoundedBoxGeometry(0.05, 0.012, 0.035, 2, 0.004); base.applyMatrix4(new THREE.Matrix4().makeBasis(v3(1, 0, 0), inward.clone().negate(), v3(1, 0, 0).cross(inward.clone().negate()).normalize()).setPosition(mount.clone().addScaledVector(inward, 0.005)));
    extra.add('plastic', base);
    // without a live reflection the rear-view shows the environment map dimmed, as a mirror facing a dark cabin does
    if (!live) { const g = new THREE.PlaneGeometry(0.248, 0.058); g.applyMatrix4(look.matrix); extra.add('mirrorDim', g, null, 0.2); }
    if (!hyper) extra.build(mats, group, { shadow: () => false });
    if (live) {
      // both mirrors see 400 m: the road, the walls and the traffic behind draw, the far road chunks (most of the
      // draw calls) do not, and the backdrop beyond it is the sky. The targets cost draw calls, not pixels, so the
      // desktop build gets sharp ones (the rear-view spans a third of a 1440-wide frame).
      if (!hyper) {
        const rv = new CarMirror(0.248, 0.058, { res: high ? [512, 128] : [192, 48], tint: 0xc4c4c4, every: 2, phase: 0, far: 400 });
        rv.position.copy(mb).addScaledVector(nrm, 0.0008); rv.lookAt(rv.position.clone().add(nrm)); rv.name = 'rear-view-mirror';
        group.add(rv); mirrors.push(rv);
      }
      // the driver's door mirror: flush in the cockpit's own housing, or 0.8 mm proud of the exterior's glass
      const { p, q: qq } = mirrorGlassPlacement(-1, (o.body ?? true) ? 0.006 : 0.0052);
      const dm = new CarMirror(MIRROR.glass[0], MIRROR.glass[1], { res: high ? [256, 112] : [128, 56], tint: 0xc9ccd2, every: 2, phase: 1, dim: 0.35, far: 400 });
      dm.position.copy(p); dm.quaternion.copy(qq); dm.name = 'door-mirror-left';
      group.add(dm); mirrors.push(dm);
    }
  }

  // the hypercar's display: the latest readout, repainted at most 15 times a second and only when it changed
  const disp: G.HyperReadout = { mph: 0, gear: 'N', kw: 0, kwMax: 1500, rpm: 0, rpmFrac: 0, mode: 'SPORT' };
  let liveT = 0, liveKey = '';
  const setInstruments = (s: { rpm?: number } & Partial<G.HyperReadout>) => { if (s.rpm !== undefined) rpm = s.rpm; if (hyper) Object.assign(disp, s); };
  const update = (dt: number) => {
    flutter += dt;
    if (hyper && (liveT += dt) >= 1 / 15) {
      liveT = 0;
      const key = `${Math.round(disp.mph)}|${disp.gear}|${Math.round(disp.kw / 10)}|${Math.round(disp.rpmFrac * 12)}|${(disp.rpm / 1000).toFixed(1)}|${disp.mode}`;
      if (key !== liveKey) { liveKey = key; G.hyperScreen().draw(disp); }
    }
    rpmShown += (rpm - rpmShown) * Math.min(1, dt * 8);
    setNeedle(rpmShown + Math.sin(flutter * 23) * 12 + Math.sin(flutter * 7.3) * 18);
  };
  group.userData.materials = mats;
  return { group, wheel: wheelMount, update, setInstruments, rearView, mirrors, gaugeAt };
}

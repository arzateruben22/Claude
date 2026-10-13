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
//       whatever of the world the mirror sees, which is over the cockpit's draw-call budget in a full scene: opt in).
//     body: include the front of the car's body seen through the windscreen and the door mirrors (default true).
//     stitch: thread colour (default cognac).
//   returns { group, wheel, update(dt), setInstruments({ rpm }) }
//     group: the interior in the car's frame. wheel: the steering-wheel mount at spec WHEEL_AT, rotation.x =
//     WHEEL_TILT; its rotation.z steers, and hands added to it turn with it (the rim follows spec rimAt/rimA/rimB).
//     update(dt): the needle's idle flutter. setInstruments: move the tach needle.
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
import { CarId, shapeFor } from './car-shape';
import { EYE, WHEEL_AT, WHEEL_TILT, rimAt, rimA, rimB } from './spec';
import * as G from './car-gauges';
import { windscreenDust, badgeTex, once } from './car-tex';
import { CarMirror } from './car-mirror';

export interface CockpitOptions { car?: CarId; paint?: number; quality?: 'phone' | 'high'; mirrors?: 'live' | 'env'; body?: boolean; stitch?: number }
// each car's trim: seat colour and kind, thread, the dash top's material, the fascia band, the wheel, the binnacle
interface Theme { seat: number; seatKind: 'leather' | 'buckets'; stitch: number; dash: 'alc' | 'nappa'; band: 'carbon' | 'alu'; wheel: 'gt' | 'brio' | 'corsa' | 'vela'; binnacle: 'tach' | 'screen'; door: 'nappa' | 'carbon' }
const THEMES: Record<string, Theme> = {
  gt: { seat: 0x7a3f1c, seatKind: 'leather', stitch: 0xc58a52, dash: 'alc', band: 'carbon', wheel: 'gt', binnacle: 'tach', door: 'nappa' },
  brio: { seat: 0x1c2740, seatKind: 'leather', stitch: 0x8fb0e0, dash: 'nappa', band: 'alu', wheel: 'brio', binnacle: 'tach', door: 'nappa' },
  corsa: { seat: 0x2b2b2e, seatKind: 'buckets', stitch: 0xe8b81c, dash: 'alc', band: 'carbon', wheel: 'corsa', binnacle: 'tach', door: 'carbon' },
  vela: { seat: 0xbdb5a5, seatKind: 'leather', stitch: 0x7d7870, dash: 'nappa', band: 'alu', wheel: 'vela', binnacle: 'screen', door: 'nappa' },
};
export interface Cockpit {
  group: THREE.Group;
  wheel: THREE.Object3D;
  update?(dt: number): void;
  setInstruments?(o: { rpm?: number }): void;
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
  const tachT = G.tachTextures(high ? 1024 : 512);
  const mats: Record<string, THREE.Material> = {
    paint: ext.paint, trim: ext.trim, dark: ext.dark, lamp: ext.lamp, tail: ext.tail, grille: ext.grille, liner: ext.liner, rubber: ext.rubber, badge: ext.badge,
    mirror: M.chrome(0.02, 0x6a6e74), exhaust: ext.exhaust, mirrorDim: M.chrome(0.03, 0x4a4d52), carbonX: ext.carbon, frit: M.gloss(0x040404),
    // black Nappa reflects about 3-4 % (sRGB ~0x33 before the grain map's ~0.86); black Alcantara a little less
    alc: M.alcantara(q, 0x2c2c2f), nappa: M.leather(q, 0x333336, { tile: 0.12 }),
    nappaPerf: M.leather(q, 0x2f2f32, { perforated: true, tile: 0.09, worn: true }), wheelNappa: M.leather(q, 0x2f2f32, { tile: 0.08, worn: true }),
    tan: T.seatKind === 'buckets' ? M.alcantara(q, T.seat, 0.07) : M.leather(q, T.seat, { tile: 0.12, sheen: 0.45 }),
    tanPerf: T.seatKind === 'buckets' ? M.alcantara(q, 0x232326, 0.06) : M.leather(q, T.seat, { perforated: true, tile: 0.1, sheen: 0.45 }),
    carbon: M.carbon(q), alu: M.brushed(q, 0xc6cace), anod: M.brushed(q, 0x3c3f45, { rough: 1.25, aniso: 0.6, key: 'anod' }),
    chrome: M.chrome(0.08), plastic: M.softPlastic(q), gloss: M.gloss(), carpet: M.carpet(q),
    stitch: M.stitch(stitchC), stitchDark: M.stitch(0x2b1a10),
    glass: M.glass('cabin', 0.04, { env: 0.3 }), sideGlass: M.glass('cabinSide', 0.1, { env: 0.45 }), gaugeGlass: M.glass('gauge', 0.0, { env: 0.9 }),
    roofGlass: M.glass('roofIn', 0.72, { env: 0.35, color: 0x05080c }),
    belt: once('m.belt', () => new THREE.MeshStandardMaterial({ color: 0x8a1216, roughness: 0.82 })),
    hoop: once('m.hoop', () => new THREE.MeshPhysicalMaterial({ color: 0x1c1c1e, roughness: 0.55, metalness: 0.2, clearcoat: 0.3 })),
    stripe: once('m.stripe', () => new THREE.MeshStandardMaterial({ color: 0xe8b81c, roughness: 0.6 })),
    screenV: once('m.scrV', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.velaScreenTex(), emissiveIntensity: 0.95, roughness: 0.12 })),
    tach: once('m.tach' + q, () => new THREE.MeshStandardMaterial({ map: tachT.map, emissiveMap: tachT.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.55 })),
    screenL: once('m.scrL', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.leftScreenTex(), emissiveIntensity: 0.9, roughness: 0.18 })),
    screenR: once('m.scrR', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: G.rightScreenTex(), emissiveIntensity: 0.9, roughness: 0.18 })),
    icons: once('m.icons', () => new THREE.MeshStandardMaterial({ map: G.iconAtlas(), roughness: 0.35 })),
    start: once('m.start', () => new THREE.MeshPhysicalMaterial({ map: G.startTex(), roughness: 0.3, clearcoat: 0.6 })),
    red: once('m.red', () => new THREE.MeshPhysicalMaterial({ color: 0xb3151b, roughness: 0.35, clearcoat: 0.5 })),
    dial: once('m.dial', () => new THREE.MeshStandardMaterial({ map: G.modeDialTex(), transparent: true, alphaTest: 0.4, roughness: 0.5 })),
    led: once('m.led', () => new THREE.MeshPhysicalMaterial({ color: 0x0b0c0d, roughness: 0.15, clearcoat: 1 })),
    dust: once('m.dust', () => new THREE.MeshBasicMaterial({ map: windscreenDust(1024, 512, 1.53, 1.05, [[0.705, 0.0], [1.365, 0.0]], 0.58), color: 0x6e665e, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })),
  };
  for (const k of ['alc', 'nappa', 'tan', 'tanPerf', 'carpet', 'plastic']) (mats[k] as THREE.Material).side = THREE.DoubleSide;
  mats.badgeHub = once('m.badgehub' + P.brand, () => new THREE.MeshPhysicalMaterial({ map: badgeTex(256, P.brand), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.1 }));
  // the dash top and the fascia band, per car
  mats.dashTop = T.dash === 'alc' ? mats.alc : mats.nappa;
  mats.band = T.band === 'carbon' ? mats.carbon : mats.alu;
  mats.doorLow = T.door === 'carbon' ? mats.carbon : mats.nappa;
  mats.alcW = M.alcantara(q, 0x2a2a2d, 0.05);

  // ambient occlusion inside: dark low down and under the dash, the headliner lit only by bounce
  kit.ao = (p, n) => {
    if (p.z < -1.12 || Math.abs(p.x) > 0.97) return clamp((0.62 + 0.38 * sstep(0.08, 0.7, p.y)) * (n.y < -0.4 ? 0.55 : 1), 0.2, 1);
    let a = 0.32 + 0.68 * sstep(0.18, 1.0, p.y);
    if (n.y > 0.4) a += 0.14 * n.y;
    if (p.z < -0.6 && p.y < 0.78) a *= 0.55;
    if (n.y < -0.5 && p.y > 1.0) a = 0.6;
    if (p.y < 0.3) a *= 0.75;
    return clamp(a, 0.15, 1);
  };
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
    const [clear, frit] = splitGrid(g, NT + 1, NS + 1, (i, j) => i === 0 || j === 0 || i === NT - 1 || j === NS - 1 || (i >= NT - 3 && Math.abs(j - NS / 2 - 1) <= 1));
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
  const dashTop = (x: number): [number, number][] => {
    const [zb, yb] = glassBase(x);
    return [[zb, yb], [zb + 0.06, Math.min(yb + 0.006, 0.85)], [-0.93, 0.855], [-0.81, 0.861], [-0.73, 0.858], [-0.69, 0.847]];
  };
  const LIP: [number, number][] = [[-0.69, 0.847], [-0.674, 0.836], [-0.664, 0.818], [-0.665, 0.795]];
  const FASCIA: [number, number][] = [[-0.665, 0.795], [-0.659, 0.75], [-0.646, 0.69], [-0.628, 0.62]];
  const LOWER: [number, number][] = [[-0.628, 0.62], [-0.632, 0.555], [-0.67, 0.495], [-0.78, 0.445], [-0.96, 0.41]];
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
  }
  // round vents: brushed bezel, dark throat, five vanes, a knob
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
      sc.rotateX(-0.45); sc.translate(0, 0.567, -0.592); kit.add('screenV', sc);
    } else for (const x of [-0.06, 0, 0.06]) { const k = latheGeo([[0.0, 0.016], [0.012, 0.016], [0.014, 0.012], [0.014, 0.0]], 24, 'z', { flip: true, vScale: 0.02 }); kit.add('alu', k, mat(x, 0.585, -0.585, -0.45)); }
  }

  // ---------------------------------------------------------------- the binnacle: tach, two displays, the cowl
  const clM = mat(-0.37, 0.835, -0.62, -0.41);
  if (T.binnacle === 'screen') {
    // the Vela's wide display, free-standing over the dash on a leather-wrapped plinth
    const vM = mat(-0.17, 0.862, -0.635, -0.36);
    const bez = extrude(roundRect(0.64, 0.168, 0.018), 0.014, 0.003); bez.translate(0, 0, -0.0165); kit.add('gloss', bez, vM, 0.05);
    const scr = new THREE.PlaneGeometry(0.62, 0.15); const su = scr.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < su.count; i++) su.setY(i, 0.5 + 0.5 * su.getY(i));
    scr.translate(0, 0, -0.0018); kit.add('screenV', scr, vM);
    const plinth = new RoundedBoxGeometry(0.34, 0.07, 0.1, 3, 0.02); plinth.translate(-0.17, 0.81, -0.68); kit.add('nappa', plinth);
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
  wheelMount.position.copy(WHEEL_AT); wheelMount.rotation.x = WHEEL_TILT;
  group.add(wheelMount);
  const wheelM = mat(WHEEL_AT.x, WHEEL_AT.y, WHEEL_AT.z, WHEEL_TILT);
  {
    const segs = high ? 22 : 12;
    const zone = (a0: number, a1: number, key: string, n: number) => {
      const f = rimFrames(a0, a1, n);
      wk.add(key, sweepGeo(f.path, f.N, f.B, (i) => rimA(f.as[i]), (i) => rimB(f.as[i]), segs, { around: 0.13, flip: true }));
      return f;
    };
    // The grips are perforated Nappa from 46 degrees below to 52 above each side, so a hand at spec GRIP (32 and
    // 148 degrees, about +-16 degrees of rim under the palm and fingers) sits wholly on leather: no seam, ring or
    // step under the fingers. Carbon only across the top (the shift lights) and the bottom.
    const G0 = 0.91, G1 = Math.PI - G0, B0 = Math.PI + 0.8, B1 = Math.PI * 2 - 0.8;
    zone(G0, G1, 'carbon', high ? 56 : 30);
    zone(B0, B1, 'carbon', high ? 52 : 28);
    const grips = [zone(B1 - Math.PI * 2, G0, 'nappaPerf', high ? 64 : 34), zone(G1, B0, 'nappaPerf', high ? 64 : 34)];
    // the perforation stops short of the edges: a plain Nappa band where each grip meets the carbon
    for (const [a0, a1] of [[G0 - 0.09, G0], [B1 - Math.PI * 2, B1 - Math.PI * 2 + 0.09], [G1, G1 + 0.09], [B0 - 0.09, B0]]) zone(a0 - 0.002, a1 + 0.002, 'wheelNappa', 8);
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
    for (const a of [G0, G1, B0, B1]) {
      const p = rimAt(a), t = rimAt(a + 0.002).sub(rimAt(a - 0.002)).normalize();
      // a 3 mm band, 0.8 mm proud of the rim (the torus's tube is scaled along the rim to 2.6 mm)
      const ring = new THREE.TorusGeometry(1, 0.075, 8, 40); ring.scale(rimA(a) * 0.97, rimB(a) * 0.97, 0.035);
      // the torus's ring plane: x along the outward normal, y toward the driver, axis along the rim
      const N = p.clone().sub(t.clone().multiplyScalar(p.dot(t))).normalize();
      ring.applyMatrix4(new THREE.Matrix4().makeBasis(N, v3(0, 0, 1), t).setPosition(p));
      wk.add('alu', ring, null, 0.02);
    }
    // shift lights across the top, on the driver's face of the rim
    for (let i = 0; i < 10; i++) {
      const a = 2.0 - (i / 9) * 0.88, p = rimAt(a);
      const led = new RoundedBoxGeometry(0.0085, 0.0042, 0.003, 1, 0.001);
      led.rotateZ(a - Math.PI / 2); led.translate(p.x - Math.cos(a) * 0.004, p.y - Math.sin(a) * 0.004, rimB(a) + 0.0006);
      wk.add('led', led, null, 0.02);
    }
    // hub: a Nappa airbag cover with the badge, three carbon spokes with aluminium inlays and button pods
    const hub = extrude(roundRect(0.19, 0.122, 0.04, 0, -0.004), 0.034, 0.012); hub.translate(0, 0, -0.036);
    wk.add('wheelNappa', hub);
    const seam = new THREE.TorusGeometry(1, 0.012, 4, 64); seam.scale(0.071, 0.046, 1); seam.translate(0, -0.004, -0.001);
    wk.add('gloss', seam, null, 0.05);
    const badge = new THREE.CircleGeometry(0.022, 40); badge.translate(0, 0.004, -0.0005);
    wk.add('badgeHub', badge);
    const bring = new THREE.TorusGeometry(0.0228, 0.0016, 8, 48); bring.translate(0, 0.004, -0.0005); wk.add('chrome', bring, null, 0.02);
    for (const sd of [-1, 1]) {
      const sp = new RoundedBoxGeometry(0.082, 0.052, 0.02, 3, 0.008); sp.translate(sd * 0.13, -0.006, -0.012); wk.add('carbon', sp);
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
    const bot = new RoundedBoxGeometry(0.058, 0.07, 0.02, 3, 0.008); bot.translate(0, -0.102, -0.012); wk.add('carbon', bot);
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
    kit.add('alc', gridGeo(rows, { flip: sd > 0 }));
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
      kit.add('alc', gridGeo(rows, { flip: true }));
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
    kit.add('alc', gridGeo(rows, { flip: true }));
    for (const sd of [-1, 1] as const) {
      const rail = range(0, 1, 18).map((u) => { const p = sgInner(u, 1, sd, 0.016); p.y -= 0.012; return p; });
      rail.push(v3(sd * (edgeX(zBack) - 0.018), body.top(zBack, edgeX(zBack)) - 0.05, zBack));
      kit.add('alc', tubeGeo(rail, () => 0.017, high ? 10 : 6));
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
  for (const sd of [-1, 1] as const) {
    const zs = range(-0.94, 0.5, high ? 26 : 14);
    const arm = (z: number) => sstep(-0.62, -0.42, z) * (1 - sstep(0.22, 0.4, z));
    const X = (x: number) => sd * x;
    const flip = sd > 0;
    // lower panel up to the armrest, the armrest (cognac), the Alcantara insert, the sill cap to the glass
    kit.add('nappa', loftZ(zs, (z) => { const a = arm(z); return [[X(0.866), 0.2], [X(0.862), 0.36], [X(0.858), 0.5], [X(0.85 - 0.02 * a), 0.545], [X(0.85 - 0.055 * a), 0.585]]; }, flip));
    kit.add('tan', loftZ(zs, (z) => { const a = arm(z); return [[X(0.85 - 0.055 * a), 0.585], [X(0.85 - 0.068 * a), 0.618], [X(0.85 - 0.06 * a), 0.646], [X(0.856 - 0.03 * a), 0.664], [X(0.858), 0.676]]; }, flip));
    kit.add('alc', loftZ(zs, () => [[X(0.858), 0.676], [X(0.86), 0.74], [X(0.858), 0.81]], flip));
    kit.add('nappa', loftZ(zs, (z) => { const ys = sill(z), gx = body.canopyX(z, ys + 0.012) - 0.008; return [[X(0.858), 0.81], [X(0.856), ys - 0.05], [X(0.845), ys - 0.012], [X(Math.min(0.84, gx + 0.006)), ys + 0.002], [X(gx - 0.002), ys + 0.006]]; }, flip));
    // stitches along the armrest's top edge
    for (const off of [0, 0.004]) {
      const path = zs.filter((z) => arm(z) > 0.05).map((z) => { const a = arm(z); return v3(X(0.856 - 0.03 * a - 0.0015), 0.664 - off, z); });
      if (path.length > 2) kit.add('stitchDark', stitchRow(path, path.map(() => v3(0, 1, 0)), path.map(() => v3(-sd, 0, 0))));
    }
    // a carbon strip under the sill, the pull strap, the release, a speaker
    const strip = new RoundedBoxGeometry(0.012, 0.022, 1.36, 2, 0.004); strip.translate(X(0.853), 0.8, -0.22); kit.add('carbon', strip);
    // the pull strap: a loop of cognac leather, flat in section, its ends in small aluminium clamps
    const sp = [v3(X(0.852), 0.71, -0.66), v3(X(0.83), 0.707, -0.635), v3(X(0.818), 0.703, -0.58), v3(X(0.82), 0.699, -0.5), v3(X(0.85), 0.695, -0.45)];
    kit.add('tan', tubeGeo(sp, () => 0.012, 8, { rb: () => 0.0028, up: v3(0, 1, 0) }));
    for (const e of [sp[0], sp[sp.length - 1]]) { const c = new RoundedBoxGeometry(0.014, 0.03, 0.022, 2, 0.004); c.translate(e.x - sd * 0.004, e.y, e.z); kit.add('alu', c); }
    const rel = new RoundedBoxGeometry(0.012, 0.016, 0.06, 2, 0.004); rel.translate(X(0.85), 0.77, -0.72); kit.add('alu', rel);
    const spk = latheGeo([[0.0, 0.0], [0.06, 0.0], [0.068, -0.004]], 32, 'z', { flip: true, vScale: 0.05 });
    spk.applyMatrix4(mat(X(0.858), 0.43, -0.7, 0, -sd * Math.PI / 2)); kit.add('alu', spk);
  }

  // ---------------------------------------------------------------- bulkhead behind the seats, with its window
  {
    const z = 0.565, sh = new THREE.Shape();
    const pts: [number, number][] = [[0.866, 0.2], [0.866, sill(z) - 0.01]];
    for (const a of range(body.canopyX(z, sill(z)) - 0.01, 0, 14)) pts.push([a, body.top(z, a) - 0.035]);
    const all = [...pts, ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
    sh.moveTo(all[0][0], all[0][1]); for (const p of all.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath();
    const win = roundRect(0.86, 0.22, 0.05, 0, 1.065);
    sh.holes.push(win);
    const g = new THREE.ShapeGeometry(sh, 4); g.rotateY(Math.PI); g.translate(0, 0, z);
    kit.add('alc', g, null, 0.08);
    const glassW = new THREE.ShapeGeometry(win, 4); glassW.rotateY(Math.PI); glassW.translate(0, 0, z + 0.006); kit.add('sideGlass', glassW);
    const ring = new THREE.Shape(roundRect(0.9, 0.26, 0.07, 0, 1.065).getPoints(6)); ring.holes.push(new THREE.Path(win.getPoints(6)));
    const rg = new THREE.ShapeGeometry(ring, 4); rg.rotateY(Math.PI); rg.translate(0, 0, z - 0.002); kit.add('frit', rg, null, 0.05);
  }

  // ---------------------------------------------------------------- seats: cognac Nappa bolsters, perforated centres, carbon shells
  for (const cx of [-0.37, 0.37]) {
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
  }
  // ---------------------------------------------------------------- console, floor
  {
    const con = new RoundedBoxGeometry(0.24, 0.36, 1.0, 3, 0.03); con.translate(0, 0.27, -0.13); kit.add('nappa', con);
    const lid = new RoundedBoxGeometry(0.21, 0.014, 0.94, 2, 0.005); lid.translate(0, 0.452, -0.13); kit.add('carbon', lid);
    const bridge = new RoundedBoxGeometry(0.08, 0.04, 0.3, 4, 0.016); bridge.translate(0, 0.475, -0.38); kit.add('alu', bridge);
    const floor = new THREE.PlaneGeometry(1.74, 1.6); floor.rotateX(-Math.PI / 2); floor.translate(0, 0.12, -0.25); kit.add('carpet', floor);
    const toe = new THREE.PlaneGeometry(1.74, 0.42); toe.rotateX(-0.85); toe.translate(0, 0.27, -1.12); kit.add('carpet', toe);
  }

  // ---------------------------------------------------------------- the car's body seen through the glass
  if (o.body ?? true) {
    // the whole shell (no glass: the cockpit has its own): the bonnet and wings through the windscreen, the door
    // tops and the haunches through the side glass and in the door mirrors, the engine cover in the rear-view
    buildBody(bk, { q, glass: false, mirrors: false });
    for (const sd of [-1, 1] as const) mirrorParts(bk, sd, !live || sd > 0, 'paint');
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
    const d = n.dot(p0), E = EYE, keepIdx: number[] = [];
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
  bk.build(mats, outside, { shadow: (k) => k === 'paint' || k === 'dark' });
  for (const k of ['glass', 'sideGlass', 'gaugeGlass', 'dust']) { const m = group.getObjectByName(k); if (m) { m.renderOrder = k === 'dust' ? 4 : 2; m.castShadow = false; } }

  // ---------------------------------------------------------------- mirrors with reflections
  {
    // rear-view: frameless, hung from the top of the windscreen just left of centre, its face turned so the driver
    // looks straight back through the bulkhead window
    const mount = wsPoint(-0.05, 0.935, -0.008), inward = body.topNormal(mount.x, mount.z).negate();
    const mb = mount.clone().addScaledVector(inward, 0.03).add(v3(0, -0.034, 0.012));
    // aimed through the middle of the bulkhead window, over the engine cover, at the road ~6 m behind the tail
    const nrm = EYE.clone().sub(mb).normalize().add(v3(0, 0.75, 2.3).sub(mb).normalize()).normalize();
    const look = new THREE.Object3D(); look.position.copy(mb); look.lookAt(mb.clone().add(nrm)); look.updateMatrix();
    const housing = extrude(roundRect(0.262, 0.07, 0.03), 0.026, 0.006, 8); housing.translate(0, 0, -0.03); housing.applyMatrix4(look.matrix);
    const stem = new THREE.CylinderGeometry(0.0065, 0.0075, 1, 12); stem.applyMatrix4(between(mount, mb.clone().addScaledVector(nrm, -0.03)));
    const extra = new Kit(); extra.add('gloss', housing); extra.add('plastic', stem, null, 0.02);
    const base = new RoundedBoxGeometry(0.05, 0.012, 0.035, 2, 0.004); base.applyMatrix4(new THREE.Matrix4().makeBasis(v3(1, 0, 0), inward.clone().negate(), v3(1, 0, 0).cross(inward.clone().negate()).normalize()).setPosition(mount.clone().addScaledVector(inward, 0.005)));
    extra.add('plastic', base);
    // without a live reflection the rear-view shows the environment map dimmed, as a mirror facing a dark cabin does
    if (!live) { const g = new THREE.PlaneGeometry(0.248, 0.058); g.applyMatrix4(look.matrix); extra.add('mirrorDim', g, null, 0.2); }
    extra.build(mats, group, { shadow: () => false });
    if (live) {
      const rv = new CarMirror(0.248, 0.058, { res: high ? [320, 80] : [192, 48], tint: 0xc4c4c4, every: 2, phase: 0 });
      rv.position.copy(mb).addScaledVector(nrm, 0.0008); rv.lookAt(rv.position.clone().add(nrm)); rv.name = 'rear-view-mirror';
      group.add(rv);
      if (o.body ?? true) {
        const { p, q: qq } = mirrorGlassPlacement(-1);
        const dm = new CarMirror(MIRROR.glass[0], MIRROR.glass[1], { res: high ? [192, 84] : [128, 56], tint: 0xc9ccd2, every: 2, phase: 1, dim: 0.35 });
        dm.position.copy(p); dm.quaternion.copy(qq); dm.name = 'door-mirror-left';
        group.add(dm);
      }
    }
  }

  const setInstruments = (s: { rpm?: number }) => { if (s.rpm !== undefined) rpm = s.rpm; };
  const update = (dt: number) => {
    flutter += dt;
    rpmShown += (rpm - rpmShown) * Math.min(1, dt * 8);
    setNeedle(rpmShown + Math.sin(flutter * 23) * 12 + Math.sin(flutter * 7.3) * 18);
  };
  group.userData.materials = mats;
  return { group, wheel: wheelMount, update, setInstruments };
}

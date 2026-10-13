// The Rossini GT from outside, and the traffic around it.
//
//   buildCar({ paint, quality?, cabin?, caliper?, contactShadow? }): THREE.Group
//     The car in its own frame (spec.ts: x right, y up, faces -z, origin on the ground under the middle of the car).
//     paint: sRGB hex for the metallic paint. quality: 'phone' | 'high' (default 'high': finer tessellation, flake
//     sparkle, anisotropic carbon and machined faces, 1024 tyre maps). cabin: 'full' (default: tinted glass and a
//     dark cabin silhouette, for outside views) or 'shell' (no glass, no cabin: for the driver's view, where
//     buildCockpit supplies the interior and its own glass). caliper: hex (default Rossini yellow).
//     contactShadow: the soft patch under the car (default true). The group's userData.materials holds the
//     materials by key; userData.buildMs the time it took.
//
//   buildTrafficCar(kind, paint, quality?): THREE.Group
//     Unbranded traffic: 'sedan' | 'suv' | 'pickup' | 'van' | 'boxTruck'. Same frame. At most 4 draw calls and 8k
//     triangles each; materials are shared between all traffic (paint per colour).
import * as THREE from 'three';
import { Kit, V3, v3, gridGeo, clamp, sstep, curve, bakeAO } from './car-kit';
import * as M from './car-mats';
import { buildBody, cabinSilhouette, lampMaterials, shutLines, AXLE, ARCHES } from './car-body';
import { addWheel, TREAD_V } from './car-wheel';
import { badgeTex, wordmarkTex, contactShadow, once } from './car-tex';

export type Quality = 'phone' | 'high';
export interface CarOptions { paint: number; quality?: Quality; cabin?: 'full' | 'shell'; caliper?: number; contactShadow?: boolean }

// every material the car's kit can file geometry under
export function carMaterials(paint: number, q: Quality, caliper = 0xe0a800): Record<string, THREE.Material> {
  const lamps = once('lamps', lampMaterials);
  const dark = once('m.dark', () => M.patchedStd(0x050506, 0.75));
  return {
    paint: M.paint(paint, q, shutLines(), { key: 'rossini' }),
    frit: M.gloss(0x050505), trim: M.gloss(0x070708), dark,
    glass: M.glass('tint', 0.62, { env: 1.0 }),
    carbon: M.carbon(q), grille: M.honeycomb(q, 0.15), liner: M.stipple(q, 0x161617, 0.05),
    lamp: lamps.lamp, tail: lamps.tail,
    chrome: M.chrome(0.12, 0xd8dadd), mirror: M.chrome(0.015, 0xb9bfc6), rubber: M.rubber(),
    badge: once('m.badge', () => new THREE.MeshPhysicalMaterial({ map: badgeTex(), roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 })),
    word: once('m.word', () => new THREE.MeshStandardMaterial({ color: 0xe4e6e8, alphaMap: wordmarkTex('ROSSINI'), alphaTest: 0.5, metalness: 1, roughness: 0.18 })),
    interior: once('m.cabin', () => M.patchedStd(0x0d0d0e, 0.6)),
    exhaust: once('m.exhaust', () => new THREE.MeshPhysicalMaterial({ color: 0x8e9097, metalness: 1, roughness: 0.3, iridescence: 0.55, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 420], side: THREE.DoubleSide })),
    tyre: M.tyre(q, TREAD_V), machined: M.machined(q), rimPaint: M.rimPaint(), disc: M.disc(q),
    caliper: once('m.cal' + caliper, () => { const m = M.caliper(caliper).clone(); m.side = THREE.DoubleSide; return m; }),
    calText: once('m.caltext', () => new THREE.MeshStandardMaterial({ color: 0xf4f4f2, map: wordmarkTex('ROSSINI', 1024, 128), alphaTest: 0.5, roughness: 0.4 })),
  };
}

// a heuristic for ambient occlusion outside: the underside and the wheel wells are dark, the lower body a little
function carAO(p: V3, n: V3) {
  let a = 0.62 + 0.38 * sstep(0.08, 0.7, p.y);
  if (n.y < -0.4) a *= 0.55;
  // inside the wheel wells, above the axle: the liner and the top of the tyre sit in the dark
  for (const A of ARCHES) {
    const d = Math.hypot(p.z - A.z, p.y - A.yc);
    if (Math.abs(p.x) > 0.45 && Math.abs(p.x) < 0.985 && d < A.R + 0.01 && p.y > 0.4) a *= 0.3 + 0.7 * sstep(0.62, 0.35, (p.y - 0.4) / (A.R - 0.1));
  }
  return clamp(a, 0.15, 1);
}

export function buildCar(o: CarOptions): THREE.Group {
  const t0 = performance.now();
  const q = o.quality ?? 'high', g = new THREE.Group();
  g.name = 'rossini-gt';
  const kit = new Kit();
  kit.ao = carAO;
  const full = (o.cabin ?? 'full') === 'full';
  buildBody(kit, { q, glass: full });
  if (full) cabinSilhouette(kit);
  for (const [z, track, front] of [[AXLE.zF, AXLE.trackF, true], [AXLE.zR, AXLE.trackR, false]] as [number, number, boolean][]) {
    for (const out of [1, -1] as const) addWheel(kit, { q, front }, new THREE.Matrix4().makeTranslation(out * track, AXLE.r, z), out);
  }
  const mats = carMaterials(o.paint, q, o.caliper);
  kit.build(mats, g, { shadow: (k) => k === 'paint' || k === 'tyre' || k === 'rimPaint' || k === 'dark' });
  if (o.contactShadow ?? true) g.add(contactPatch(4.6, 1.97));
  g.userData.materials = mats;
  g.userData.buildMs = performance.now() - t0;
  return g;
}

// the soft shadow under the car (sky occlusion the shadow map can't resolve)
export function contactPatch(len: number, wid: number, wheels: [number, number][] = [[-AXLE.trackF, AXLE.zF], [AXLE.trackF, AXLE.zF], [-AXLE.trackR, AXLE.zR], [AXLE.trackR, AXLE.zR]]) {
  const tex = contactShadow(len, wid, wheels);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(wid + 1.2, len + 1.2), m);
  p.rotation.x = -Math.PI / 2; p.position.y = 0.012; p.renderOrder = 1; p.name = 'contact-shadow';
  return p;
}

// ------------------------------------------------------------------------------------------------ traffic
// Generic, unbranded vehicles with real proportions (a mid-size sedan, a compact SUV, a full-size crew-cab pickup,
// a high-roof van, a 16 ft box truck). One body loft each with the glass band painted into a second material, a
// trim material carrying tyres, rims, grille and lamps by vertex colour, and the paint. Four draw calls at most.
export type TrafficKind = 'sedan' | 'suv' | 'pickup' | 'van' | 'boxTruck';
interface Spec { len: number; wid: number; wb: number; r: number; track: number; sill: number; belt: number; roof: number; hood: number; deck: number; ws0: number; ws1: number; bl0: number; bl1: number; bed?: number; box?: [number, number] }
const SPECS: Record<TrafficKind, Spec> = {
  // ws0/ws1: windscreen base and top (z); bl0/bl1: back glass top and base (z); hood/deck heights at the ends
  sedan: { len: 4.88, wid: 1.84, wb: 2.83, r: 0.33, track: 0.8, sill: 0.2, belt: 0.92, roof: 1.44, hood: 0.86, deck: 0.98, ws0: -0.95, ws1: -0.25, bl0: 0.85, bl1: 1.45 },
  suv: { len: 4.6, wid: 1.86, wb: 2.69, r: 0.36, track: 0.81, sill: 0.32, belt: 1.08, roof: 1.68, hood: 1.04, deck: 1.1, ws0: -1.0, ws1: -0.38, bl0: 1.9, bl1: 2.1 },
  pickup: { len: 5.89, wid: 2.03, wb: 3.68, r: 0.4, track: 0.87, sill: 0.45, belt: 1.32, roof: 1.92, hood: 1.27, deck: 1.3, ws0: -1.1, ws1: -0.52, bl0: 0.5, bl1: 0.55, bed: 0.62 },
  van: { len: 5.93, wid: 2.02, wb: 3.66, r: 0.37, track: 0.86, sill: 0.42, belt: 1.18, roof: 2.55, hood: 1.12, deck: 2.4, ws0: -2.05, ws1: -1.45, bl0: 2.95, bl1: 2.96 },
  boxTruck: { len: 7.4, wid: 2.3, wb: 4.3, r: 0.48, track: 0.95, sill: 0.6, belt: 1.55, roof: 3.45, hood: 1.6, deck: 3.4, ws0: -2.9, ws1: -2.55, bl0: 3.7, bl1: 3.7, box: [-1.55, 3.7] },
};
// trim colours (vertex colour on one shared material)
const TRIM = { tyre: [0.035, 0.035, 0.037], rim: [0.55, 0.57, 0.6], black: [0.03, 0.03, 0.032], chrome: [0.75, 0.76, 0.78], head: [0.9, 0.92, 0.95], tail: [0.55, 0.02, 0.02], amber: [0.8, 0.35, 0.02], box: [0.82, 0.83, 0.82] } as const;
function tint(g: THREE.BufferGeometry, c: readonly number[]) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function trafficMats(paint: number, q: Quality) {
  return {
    paint: M.paint(paint, q, [], { key: 'traffic', flake: 0.2 }),
    glass: once('m.tglass', () => new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 })),
    trim: once('m.ttrim', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 })),
    lamp: once('m.tlamp', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.0 })),
  };
}
export function buildTrafficCar(kind: TrafficKind, paint: number, quality: Quality = 'high'): THREE.Group {
  const S = SPECS[kind], q = quality, g = new THREE.Group();
  g.name = 'traffic-' + kind;
  const L2 = S.len / 2, W2 = S.wid / 2, zF = -L2, zR = L2;
  const zA = [-S.wb / 2 + (kind === 'van' || kind === 'boxTruck' ? -0.35 : -0.15), S.wb / 2 + (kind === 'van' || kind === 'boxTruck' ? -0.35 : -0.15)];
  // the body: sections along z, a rounded box whose top follows hood, glass, roof and deck
  const topAt = curve([[zF, S.hood - 0.08], [zF + 0.25, S.hood], [S.ws0, S.hood + 0.04], [S.ws1, S.roof], [S.box ? S.box[0] : S.bl0 - 0.05, S.roof], [S.bl0, S.box ? S.roof : S.roof - 0.02], [S.bl1, S.deck], [zR - 0.15, S.deck], [zR, S.deck - 0.06]]);
  const cabTop = (z: number) => (S.bed !== undefined && z > S.bl1 ? S.belt : topAt(z));
  const ns = q === 'high' ? 70 : 44, nr = q === 'high' ? 26 : 18;
  const rows: V3[][] = [], cls: number[][] = [];
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, z = zF + (zR - zF) * t;
    const endR = Math.min(1, Math.min(z - zF, zR - z) / 0.22), end = 1 - Math.sqrt(Math.max(0, 1 - endR * endR));
    const w = W2 - 0.12 * end, top = cabTop(z) - 0.06 * end;
    let yb = S.sill;
    for (const za of zA) { const dz = Math.abs(z - za), R = S.r + 0.06; if (dz < R) yb = Math.max(yb, S.r + Math.sqrt(R * R - dz * dz) * 0.95); }
    const row: V3[] = [], c: number[] = [];
    const green = top > S.belt + 0.05 && !(S.box && z > S.box[0]);
    for (let j = 0; j <= nr; j++) {
      const u = j / nr, a = u * Math.PI;              // around the half-section: right side up, over, left side down
      const sx = Math.cos(a), sy = Math.sin(a);
      // a rounded-box section with tumblehome above the belt
      const k = Math.pow(Math.abs(sx), 0.25) * Math.sign(sx), yy = Math.pow(sy, 0.2);
      let y = yb + (top - yb) * yy, x = w * k;
      if (green && y > S.belt) { const f = (y - S.belt) / Math.max(0.01, top - S.belt); x *= 1 - 0.14 * f * f; }
      row.push(v3(x, y, z));
      c.push(green && y > S.belt + 0.04 && y < top - 0.07 && z > S.ws0 + 0.04 && z < Math.max(S.bl1, S.ws1 + 0.3) - 0.04 ? 1 : 0);
    }
    rows.push(row); cls.push(c);
  }
  const body = gridGeo(rows, { flip: true });
  const idx = body.index!.array, paintI: number[] = [], glassI: number[] = [];
  for (let i = 0; i < ns; i++) for (let j = 0; j < nr; j++) {
    const k = (i * nr + j) * 6, glassy = cls[i][j] + cls[i + 1][j] + cls[i][j + 1] + cls[i + 1][j + 1] >= 3;
    (glassy ? glassI : paintI).push(...Array.from(idx.slice(k, k + 6)));
  }
  const bp = body.clone(); bp.setIndex(paintI);
  const bg = body.clone(); bg.setIndex(glassI);
  // nose and tail caps
  const cap = (i: number, back: boolean) => { const r = rows[i], s = new THREE.Shape(); s.moveTo(r[0].x, r[0].y); for (const p of r.slice(1)) s.lineTo(p.x, p.y); s.closePath(); const c2 = new THREE.ShapeGeometry(s, 2); if (!back) c2.rotateY(Math.PI); c2.translate(0, 0, r[0].z); return c2; };
  const paintParts: THREE.BufferGeometry[] = [bp, cap(0, false), cap(ns, true)];
  const trim: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [];
  // the box on a box truck, the bed walls on a pickup
  if (S.box) { const b = new THREE.BoxGeometry(S.wid + 0.04, S.roof - S.sill - 0.15, S.box[1] - S.box[0], 2, 2, 4); b.translate(0, (S.roof + S.sill + 0.15) / 2, (S.box[0] + S.box[1]) / 2); trim.push(tint(b, TRIM.box)); }
  if (S.bed !== undefined) { const b = new THREE.BoxGeometry(S.wid - 0.2, 0.06, zR - S.bl1 - 0.15); b.translate(0, S.belt - 0.45, (S.bl1 + zR) / 2); trim.push(tint(b, TRIM.black)); }
  // wheels: tyre lathe and a rim disc, by vertex colour
  for (const za of zA) for (const sd of [1, -1]) {
    const ty = new THREE.TorusGeometry(S.r - 0.07, 0.075, 8, q === 'high' ? 28 : 18); ty.rotateY(Math.PI / 2); ty.scale(1.6, 1, 1); ty.translate(sd * S.track, S.r, za);
    trim.push(tint(ty, TRIM.tyre));
    const rim = new THREE.CircleGeometry(S.r - 0.11, 16); rim.rotateY(sd * Math.PI / 2); rim.translate(sd * (S.track + 0.1), S.r, za);
    trim.push(tint(rim, kind === 'boxTruck' ? TRIM.box : TRIM.rim));
  }
  // grille, bumpers, lamps
  const fr = (w: number, h: number, x: number, y: number, z: number, c: readonly number[], back = false) => { const p = new THREE.PlaneGeometry(w, h); if (!back) p.rotateY(Math.PI); p.translate(x, y, z); return tint(p, c); };
  trim.push(fr(S.wid * 0.5, (S.hood - S.sill) * 0.35, 0, S.sill + (S.hood - S.sill) * 0.6, zF - 0.012, TRIM.black));
  trim.push(fr(S.wid - 0.1, 0.12, 0, S.sill + 0.08, zF - 0.012, TRIM.black));
  trim.push(fr(S.wid - 0.1, 0.12, 0, S.sill + 0.08, zR + 0.012, TRIM.black, true));
  for (const sd of [1, -1]) {
    lamps.push(fr(S.wid * 0.18, 0.09, sd * W2 * 0.7, S.hood - 0.12, zF - 0.014, TRIM.head));
    lamps.push(fr(S.wid * 0.12, 0.16, sd * W2 * 0.78, (S.box ? 1.0 : S.deck - 0.14), zR + 0.014, TRIM.tail, true));
    // mirrors
    const m = new THREE.BoxGeometry(0.06, 0.14, 0.2); m.translate(sd * (W2 + 0.1), S.belt + 0.08, S.ws0 + 0.15); trim.push(tint(m, TRIM.black));
  }
  const mats = trafficMats(paint, q);
  const add = (parts: THREE.BufferGeometry[], m: THREE.Material, name: string, shadow: boolean) => {
    if (!parts.length) return;
    const clean = parts.map((p) => { const x = p.index ? p : p.setIndex([...Array(p.attributes.position.count).keys()]); if (!x.attributes.normal) x.computeVertexNormals(); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) x.deleteAttribute(k); if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; });
    const hasColor = clean.some((p) => p.attributes.color);
    for (const p of clean) if (hasColor && !p.attributes.color) tint(p, [1, 1, 1]); else if (!hasColor && p.attributes.color) p.deleteAttribute('color');
    const merged = bakeAO(mergeAll(clean), (p, n) => (0.6 + 0.4 * sstep(0.1, 1.0, p.y)) * (n.y < -0.4 ? 0.6 : 1));
    const mesh = new THREE.Mesh(merged, m); mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh);
  };
  add(paintParts.map((p) => { for (const k of ['color']) if (p.attributes[k]) p.deleteAttribute(k); return p; }), mats.paint, 'paint', true);
  add([bg], mats.glass, 'glass', false);
  add(trim, mats.trim, 'trim', true);
  add(lamps, mats.lamp, 'lamps', false);
  g.add(contactPatch(S.len, S.wid, [[-S.track, zA[0]], [S.track, zA[0]], [-S.track, zA[1]], [S.track, zA[1]]]));
  return g;
}
function mergeAll(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    const P = p.attributes.position, N = p.attributes.normal, U = p.attributes.uv, C = p.attributes.color;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U.getX(i), U.getY(i)); if (C) col.push(C.getX(i), C.getY(i), C.getZ(i)); }
    const I = p.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + base);
    base += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

// The garage cars from outside (Rossini GT, Brio, Corsa, the Vela E and the OC Hypercar), and the traffic around them.
//
//   buildCar({ car?, paint?, quality?, cabin?, caliper?, contactShadow? }): THREE.Group
//     The car in its own frame (spec.ts: x right, y up, faces -z, origin on the ground under the middle of the car).
//     car: 'rossini-gt' (default) | 'rossini-brio' | 'rossini-corsa' | 'vela-e' | 'oc-hyper' (car-shape.ts has their
//     numbers; the hypercar is a procedural model built in code, like the others).
//     paint: sRGB hex for the metallic paint (default: the car's garage colour). quality: 'phone' | 'high' (default
//     'high': finer tessellation, flake sparkle, anisotropic carbon and machined faces, 1024 tyre maps). cabin:
//     'full' (default: tinted glass and a dark cabin silhouette, for outside views) or 'shell' (no glass, no cabin:
//     for the driver's view, where buildCockpit supplies the interior and its own glass). caliper: hex (default the
//     car's). contactShadow: the soft patch under the car (default true). The group's userData.materials holds the
//     materials by key; userData.buildMs the time it took.
//
//   buildTrafficCar(kind, paint, quality?): THREE.Group
//     Unbranded traffic: 'sedan' | 'suv' | 'pickup' | 'van' | 'boxTruck'. Same frame. At most 4 draw calls and 8k
//     triangles each; materials are shared between all traffic (paint per colour).
import * as THREE from 'three';
import { Kit, V3, v3, clamp, sstep, withAO } from './car-kit';
import * as M from './car-mats';
import { bodyFor, lampMaterials, CarBody } from './car-body';
import { addWheel, TREAD_V, type WheelStyle } from './car-wheel';
import { badgeTex, wordmarkTex, ocMarkTex, plateTex, contactShadow, once } from './car-tex';
import { CarId, shapeFor, rearR } from './car-shape';

export type Quality = 'phone' | 'high';
export type { CarId } from './car-shape';
export interface CarOptions { car?: CarId; paint?: number; quality?: Quality; cabin?: 'full' | 'shell'; caliper?: number; contactShadow?: boolean; wheels?: boolean; rim?: WheelStyle }   // rim: a garage style in place of the car's own

// the colours each interior shows through the glass from outside
const SIL: Record<string, [number, number]> = { gt: [0x161618, 0x5c2c12], brio: [0x161618, 0x1b2233], corsa: [0x141416, 0x1a1a1c], vela: [0x1a1a1c, 0x8e8981], hyper: [0x141416, 0x1a1a1c] };
// the lamps that are off until the player's car lights them (PlayerCar): the turn signals' amber overlays and the
// reversing lamps. Built hidden, so they cost nothing until lit.
export const SWITCHED_LAMPS = ['sigL', 'sigR', 'reverse'];

// A paint finish other than the car's factory metallic flake (the store's gloss, metallic, satin and pearl, numbers
// from src/store/cosmetics.json). flake false: a solid colour with no metallic flake.
export interface PaintFinish { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; flake: boolean }

// the body paint for a car, in its factory finish or in a store finish; cached per car, colour, quality and finish
export function carPaint(paint: number, q: Quality, id: CarId = 'rossini-gt', finish: PaintFinish | null = null, mirror = false) {
  const P = shapeFor(id), B = bodyFor(id), vela = P.brand === 'vela', oc = P.brand === 'oc';
  const flake = oc ? 0.2 : vela ? 0.1 : 0.15, lines = mirror ? [] : B.shutLines(), key = mirror ? id + '-mirror' : id;
  // the OC Hypercar: a bright, cool light silver and its gloss-black two-tone drawn by the paint shader (P.masks, body only)
  const masks = oc && !mirror ? P.masks : undefined;
  if (!finish) return M.paint(paint, q, lines, oc ? { key, flake, rough: P.paintFinish?.rough ?? 0.22, metal: P.paintFinish?.metal ?? 0.8, masks } : { key, flake, rough: vela ? 0.3 : undefined });
  return M.paint(paint, q, lines, { flake: finish.flake ? flake : 0, metal: finish.metalness, rough: finish.roughness, coat: finish.clearcoat, coatRough: finish.clearcoatRoughness, masks });
}

// every material the car's kit can file geometry under
export function carMaterials(paint: number, q: Quality, caliper = 0xe0a800, id: CarId = 'rossini-gt'): Record<string, THREE.Material> {
  const P = shapeFor(id);
  const lamps = lampMaterials(P.headStyle);
  const dark = once('m.dark', () => M.patchedStd(0x050506, 0.75));
  const vela = P.brand === 'vela', oc = P.brand === 'oc';
  const [silI, silS] = SIL[P.interior];
  // the OC Hypercar's paint: a bright, cool light silver (less metal than a chrome-like silver, so a warm sky doesn't
  // turn it bronze), a fine flake, and its gloss-black two-tone drawn by the paint shader (P.masks)
  const word = (w: number, h: number) => (oc ? ocMarkTex(w / 2, h * 1.5) : wordmarkTex(vela ? 'VELA' : 'ROSSINI', w, h));
  const extra: Record<string, THREE.Material> = {};
  if (P.led) {
    extra.led = M.led(P.led.color, P.led.halo, q, P.led.edge);
    // the turn signals (amber, about 1.5x the brake level of the red bar's map) and the reversing lamps (white)
    const sig = once('m.signal', () => Object.assign(new THREE.MeshStandardMaterial({ color: 0x2a1600, emissive: 0xff9326, emissiveIntensity: 3.2, roughness: 0.3 }), { name: 'signal' }));
    extra.sigL = sig; extra.sigR = sig;
    extra.reverse = once('m.reverse', () => Object.assign(new THREE.MeshStandardMaterial({ color: 0x202224, emissive: 0xf4f7ff, emissiveIntensity: 2.6, roughness: 0.3 }), { name: 'reverse' }));
  }
  if (P.plate) extra.plate = once('m.plateOC', () => new THREE.MeshPhysicalMaterial({ map: plateTex(), roughness: 0.38, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
  return {
    ...extra,
    paint: carPaint(paint, q, id),
    // the door mirrors' pods and stalks: the same paint without the shut lines (the shader draws them by position, so
    // the door's shut line would cross the stalk); PlayerCar.setPaint swaps both
    mirrorPaint: carPaint(paint, q, id, null, true),
    frit: M.gloss(0x050505), trim: M.gloss(0x070708), dark,
    glass: M.glass('tint', 0.62, { env: 1.0 }),
    carbon: M.carbon(q), grille: M.honeycomb(q, 0.15), liner: M.stipple(q, 0x161617, 0.05),
    lamp: lamps.lamp, tail: lamps.tail,
    chrome: M.chrome(0.12, 0xd8dadd), mirror: M.chrome(0.015, 0xb9bfc6), rubber: M.rubber(),
    badge: once('m.badge' + P.brand, () => new THREE.MeshPhysicalMaterial({ map: badgeTex(256, P.brand), roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 })),
    word: once('m.word' + P.brand, () => new THREE.MeshStandardMaterial({ color: 0xe4e6e8, alphaMap: word(1024, 128), alphaTest: 0.5, metalness: 1, roughness: 0.18 })),
    interior: once('m.cabin' + silI, () => M.patchedStd(silI, 0.6)),
    seatSil: once('m.seatsil' + silS, () => M.patchedStd(silS, 0.55)),
    exhaust: once('m.exhaust', () => new THREE.MeshPhysicalMaterial({ color: 0x8e9097, metalness: 1, roughness: 0.3, iridescence: 0.55, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 420], side: THREE.DoubleSide })),
    tyre: M.tyre(q, TREAD_V, P.tyreTint), machined: M.machined(q), rimPaint: P.wheel === 'multi' ? M.rimPaint(P.rimColor, 0.22) : M.rimPaint(P.rimColor), disc: M.disc(q, P.discTint),
    aero: once('m.aero', () => withAO(Object.assign(new THREE.MeshPhysicalMaterial({ color: 0x2a2d33, metalness: 0.65, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }), { name: 'aero' }))),
    nut: once('m.nut' + caliper, () => withAO(new THREE.MeshPhysicalMaterial({ color: caliper, metalness: 0.7, roughness: 0.3, clearcoat: 0.6 }))),
    caliper: once('m.cal' + caliper, () => { const m = M.caliper(caliper).clone(); m.side = THREE.DoubleSide; return m; }),
    calText: once('m.caltext' + P.brand, () => new THREE.MeshStandardMaterial({ color: 0xf4f4f2, map: word(1024, 128), alphaTest: 0.5, roughness: 0.4 })),
  };
}

// a heuristic for ambient occlusion outside: the underside and the wheel wells are dark, the lower body a little
export function aoFor(B: CarBody) {
  return (p: V3, n: V3) => {
    let a = 0.62 + 0.38 * sstep(0.08, 0.7, p.y);
    if (n.y < -0.4) a *= 0.55;
    // inside the wheel wells, above the axle: the liner and the top of the tyre sit in the dark
    for (const A of B.ARCHES) {
      const d = Math.hypot(p.z - A.z, p.y - A.yc);
      if (Math.abs(p.x) > 0.45 && Math.abs(p.x) < 1.0 && d < A.R + 0.01 && p.y > 0.4) a *= 0.3 + 0.7 * sstep(0.62, 0.35, (p.y - 0.4) / (A.R - 0.1));
    }
    return clamp(a, 0.15, 1);
  };
}
export const carAO = aoFor(bodyFor('rossini-gt'));

// the four wheels, rigid (outside the body's warp), into a kit
export function addWheels(kit: Kit, B: CarBody, q: Quality, rim?: WheelStyle) {
  const P = B.P, A = B.AXLE;
  kit.rigid(() => {
    for (const [z, track, front] of [[A.zF, A.trackF, true], [A.zR, A.trackR, false]] as [number, number, boolean][]) {
      const r = front ? A.r : rearR(P), k = r / 0.345;
      for (const out of [1, -1] as const) {
        const m = new THREE.Matrix4().compose(v3(out * track, r, z), new THREE.Quaternion(), v3(1, k, k));
        addWheel(kit, { q, front, style: rim ?? P.wheel, w: front ? A.wF : A.wR, sidewall: P.sidewall }, m, out);
      }
    }
  });
}

export function buildCar(o: CarOptions = {}): THREE.Group {
  const t0 = performance.now();
  const id = o.car ?? 'rossini-gt', P = shapeFor(id), B = bodyFor(id);
  const q = o.quality ?? 'high', g = new THREE.Group();
  g.name = id;
  const kit = new Kit();
  kit.ao = aoFor(B);
  const full = (o.cabin ?? 'full') === 'full';
  B.buildBody(kit, { q, glass: full });
  if (full) B.cabinSilhouette(kit);
  if (o.wheels ?? true) addWheels(kit, B, q, o.rim);          // false: the game adds its own wheels, which spin and steer
  const mats = carMaterials(o.paint ?? P.paint, q, o.caliper ?? P.caliper, id);
  kit.build(mats, g, { shadow: (k) => k === 'paint' || k === 'mirrorPaint' || k === 'tyre' || k === 'rimPaint' || k === 'dark' || k === 'carbon' });
  for (const k of SWITCHED_LAMPS) { const m = g.getObjectByName(k); if (m) m.visible = false; }
  g.userData.thrusters = B.thrusters;
  if (o.contactShadow ?? true) g.add(contactPatch(B.ZR - B.ZF, P.WP.reduce((m, [, w]) => Math.max(m, w), 0) * 2,
    [[-A(B).trackF, B.AXLE.zF], [A(B).trackF, B.AXLE.zF], [-A(B).trackR, B.AXLE.zR], [A(B).trackR, B.AXLE.zR]], (B.ZF + B.ZR) / 2));
  g.userData.materials = mats;
  g.userData.buildMs = performance.now() - t0;
  return g;
}
const A = (B: CarBody) => B.AXLE;

// the soft shadow under the car (sky occlusion the shadow map can't resolve)
export function contactPatch(len: number, wid: number, wheels: [number, number][], zc = 0) {
  const tex = contactShadow(len, wid, wheels.map(([x, z]) => [x, z - zc] as [number, number]));
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(wid + 1.2, len + 1.2), m);
  p.rotation.x = -Math.PI / 2; p.position.set(0, 0.012, zc); p.renderOrder = 1; p.name = 'contact-shadow';
  return p;
}


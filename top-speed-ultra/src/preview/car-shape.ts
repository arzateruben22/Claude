// The four garage cars as numbers: one parametric body (car-body.ts) and one set of wheels, interiors and trims
// (car-wheel.ts, cockpit.ts), shaped by these. All four are our own designs: Rossini (the "R" badge) and Vela.
//
//   rossini-gt     the base: a balanced mid-engine coupe, red. 4.60 x 1.97 m, 2.65 m wheelbase.
//   rossini-brio   smaller and lighter: shorter overhangs, narrower, a softer round nose, blue. 4.22 x 1.88 m.
//   rossini-corsa  the track car: lower, wider, a big wing on swan-neck mounts, splitter and canards, bigger
//                  intakes, a roof scoop, a carbon roof, centre-lock wheels, yellow. 4.78 x 2.03 m (splitter to wing).
//   vela-e         electric (our other brand): a smooth closed nose with a light bar, flush door handles, a glass
//                  roof, a fastback, aero wheels, no exhausts, white. 4.76 x 1.99 m, 2.80 m wheelbase.
//
// Every car shares the driver's frame (spec.ts EYE, WHEEL_AT): the cabin stays where the driver sits; the body
// changes round it. Lengths in metres, car frame (x right, y up, the car faces -z, origin under the middle).
export type CarId = 'rossini-gt' | 'rossini-brio' | 'rossini-corsa' | 'vela-e';
export const CAR_IDS: CarId[] = ['rossini-gt', 'rossini-brio', 'rossini-corsa', 'vela-e'];
type K = [number, number][];

export interface ShapeParams {
  id: CarId; name: string; brand: 'rossini' | 'vela';
  paint: number;                         // the garage colour (sRGB)
  ZF: number; ZR: number; YSILL: number; // nose and tail z, sill height
  axle: { zF: number; zR: number; r: number; trackF: number; trackR: number; wF: number; wR: number };
  arch: [number, number];                // wheel-arch radius front, rear (centred on the axle)
  // keyed curves along z: plan half-width, fender crest height, centre deck height, roof height, canopy half-width
  WP: K; FH: K; CC: K; RH: K; GB: K;
  ZC0: number; ZC1: number;              // the canopy's extent
  DROP: number; ROLL: number; P: number; K: number;
  nose: { R: number; p: number; Ry: number; tuck: number; tuckY: number };   // plan rounding, elevation rounding, chin set-back
  tail: { R: number; p: number; Ry: number; tuck: number; tuckY: number };
  scallop: { depth: number; z0: number; z1: number; e0: number; e1: number; yc: number; h: number };
  WS: { zb: number; zt: number; xb: number; xt: number };
  SG: { fb: [number, number]; rb: [number, number]; rt: [number, number]; ftZ: number };
  RG: { x0: number; x1: number; z0: number; z1: number };
  roofGlass: { z0: number; z1: number; x: number } | null;
  carbonRoof: boolean;
  intake: { z0: number; z1: number; y0: number; y1: number } | null;   // side intakes
  louvre: { z0: number; z1: number; x: number; n: number } | null;     // engine-cover louvres
  door: [number, number][];              // door shut line (side plane, z y)
  frontLid: [number, number][];          // bonnet shut line (top plane, x z)
  head: [number, number][];              // headlamp patch on the fender top (x, z): inner-front, outer-front, outer-rear, inner-rear
  headStyle: 'twin' | 'round' | 'slim';
  noseStyle: 'gt' | 'brio' | 'corsa' | 'vela';
  tailStyle: 'gt' | 'brio' | 'corsa' | 'vela';
  noseIntake: [number, number][];        // the main front opening (x, y), convex
  rearMesh: { w: number; h: number; cy: number } | null;
  exhaust: 'twin' | 'single' | 'high' | 'none';
  diffuser: { half: number; h: number; z0: number; fins: number[] };
  splitter: { w: number; d: number; proud: number; canards: boolean };
  wing: { span: number; chord: number; y: number; z: number; mountX: number } | null;
  scoop: boolean;
  bonnetVent: boolean;
  fenderVents: boolean;
  handles: 'hidden' | 'flush';
  mirrorAt: [number, number, number];
  cabinW: number;                        // inner door-card half-width
  wheel: 'twin5' | 'five' | 'cl10' | 'aero';
  rimColor: number; caliper: number;
  interior: 'gt' | 'brio' | 'corsa' | 'vela';
}

const GT: ShapeParams = {
  id: 'rossini-gt', name: 'Rossini GT', brand: 'rossini', paint: 0xa80d10,
  ZF: -2.3, ZR: 2.3, YSILL: 0.13,
  axle: { zF: -1.33, zR: 1.32, r: 0.345, trackF: 0.848, trackR: 0.83, wF: 0.245, wR: 0.305 },
  arch: [0.392, 0.398],
  WP: [[-2.3, 0.86], [-2.1, 0.915], [-1.8, 0.95], [-1.33, 0.966], [-1.0, 0.952], [-0.6, 0.938], [-0.1, 0.932], [0.4, 0.948], [0.9, 0.975], [1.32, 0.985], [1.8, 0.978], [2.1, 0.96], [2.3, 0.935]],
  FH: [[-2.3, 0.5], [-2.05, 0.622], [-1.8, 0.733], [-1.55, 0.806], [-1.33, 0.835], [-1.0, 0.855], [-0.5, 0.874], [0.0, 0.888], [0.5, 0.915], [1.0, 0.955], [1.32, 0.968], [1.8, 0.962], [2.1, 0.958], [2.3, 0.985]],
  CC: [[-2.3, 0.45], [-2.05, 0.52], [-1.75, 0.61], [-1.5, 0.69], [-1.33, 0.745], [-1.12, 0.815], [-0.6, 0.855], [0.6, 0.88], [1.2, 0.9], [2.0, 0.935], [2.3, 0.975]],
  RH: [[-1.12, 0.818], [-0.85, 0.975], [-0.6, 1.11], [-0.4, 1.205], [-0.2, 1.274], [0.0, 1.305], [0.2, 1.316], [0.5, 1.284], [0.9, 1.185], [1.4, 1.07], [1.85, 0.985], [2.1, 0.94]],
  GB: [[-1.12, 0.82], [-0.5, 0.86], [0.1, 0.86], [0.6, 0.79], [1.2, 0.63], [1.8, 0.5], [2.1, 0.45]],
  ZC0: -1.12, ZC1: 2.1, DROP: 0.075, ROLL: 0.13, P: 4, K: 0.035,
  nose: { R: 0.38, p: 2.5, Ry: 0.14, tuck: 0.09, tuckY: 0.48 },
  tail: { R: 0.24, p: 2.4, Ry: 0.03, tuck: 0.085, tuckY: 0.6 },
  scallop: { depth: 0.095, z0: -0.55, z1: 0.5, e0: 0.84, e1: 0.95, yc: 0.53, h: 0.16 },
  WS: { zb: -1.095, zt: -0.2, xb: 0.765, xt: 0.61 },
  SG: { fb: [-0.92, 0.885], rb: [0.56, 0.94], rt: [0.42, 1.19], ftZ: -0.165 },
  RG: { x0: 0.43, x1: 0.37, z0: 0.5, z1: 0.84 },
  roofGlass: null, carbonRoof: false,
  intake: { z0: 0.6, z1: 0.86, y0: 0.42, y1: 0.64 },
  louvre: { z0: 0.92, z1: 1.86, x: 0.38, n: 9 },
  door: [[-0.9, 0.22], [0.4, 0.22], [0.47, 0.905], [-0.86, 0.885]],
  frontLid: [[-0.5, -2.13], [0.5, -2.13], [0.57, -1.2], [-0.57, -1.2]],
  head: [[0.36, -2.17], [0.79, -2.095], [0.86, -1.93], [0.5, -2.0]], headStyle: 'twin',
  noseStyle: 'gt', tailStyle: 'gt',
  noseIntake: [[-0.43, 0.158], [0.43, 0.158], [0.37, 0.305], [-0.37, 0.305]],
  rearMesh: { w: 1.36, h: 0.26, cy: 0.6 },
  exhaust: 'twin',
  diffuser: { half: 0.64, h: 0.38, z0: 1.7, fins: [-0.64, -0.38, -0.13, 0.13, 0.38, 0.64] },
  splitter: { w: 1.62, d: 0.5, proud: 0.06, canards: false },
  wing: null, scoop: false, bonnetVent: false, fenderVents: false, handles: 'hidden',
  mirrorAt: [1.025, 0.975, -0.7], cabinW: 0.866,
  wheel: 'twin5', rimColor: 0x2b2d31, caliper: 0xe0a800, interior: 'gt',
};

const BRIO: ShapeParams = {
  ...GT, id: 'rossini-brio', name: 'Rossini Brio', paint: 0x1d4f9c,
  ZF: -2.12, ZR: 2.1, YSILL: 0.135,
  axle: { zF: -1.24, zR: 1.26, r: 0.332, trackF: 0.8, trackR: 0.79, wF: 0.225, wR: 0.265 },
  arch: [0.378, 0.382],
  WP: [[-2.12, 0.79], [-1.95, 0.865], [-1.7, 0.9], [-1.24, 0.918], [-0.9, 0.905], [-0.5, 0.895], [0.0, 0.895], [0.4, 0.908], [0.85, 0.928], [1.26, 0.94], [1.7, 0.932], [1.95, 0.91], [2.1, 0.88]],
  FH: [[-2.12, 0.52], [-1.9, 0.64], [-1.65, 0.74], [-1.45, 0.8], [-1.24, 0.825], [-0.9, 0.842], [-0.5, 0.86], [0.0, 0.874], [0.5, 0.9], [0.95, 0.935], [1.26, 0.946], [1.7, 0.94], [1.95, 0.935], [2.1, 0.948]],
  CC: [[-2.12, 0.475], [-1.9, 0.555], [-1.6, 0.65], [-1.35, 0.725], [-1.1, 0.8], [-0.6, 0.846], [0.6, 0.87], [1.2, 0.888], [1.9, 0.915], [2.1, 0.94]],
  RH: [[-1.1, 0.802], [-0.85, 0.972], [-0.6, 1.106], [-0.4, 1.2], [-0.2, 1.268], [0.0, 1.298], [0.2, 1.305], [0.5, 1.268], [0.9, 1.16], [1.35, 1.05], [1.72, 0.975], [1.95, 0.935]],
  GB: [[-1.1, 0.79], [-0.5, 0.83], [0.1, 0.83], [0.6, 0.765], [1.2, 0.61], [1.7, 0.5], [1.95, 0.46]],
  ZC0: -1.1, ZC1: 1.95, DROP: 0.07, ROLL: 0.15,
  nose: { R: 0.46, p: 2.15, Ry: 0.19, tuck: 0.075, tuckY: 0.5 },
  tail: { R: 0.32, p: 2.2, Ry: 0.05, tuck: 0.07, tuckY: 0.55 },
  scallop: { depth: 0.06, z0: -0.5, z1: 0.45, e0: 0.76, e1: 0.86, yc: 0.55, h: 0.13 },
  WS: { zb: -1.075, zt: -0.21, xb: 0.74, xt: 0.59 },
  SG: { fb: [-0.9, 0.875], rb: [0.5, 0.93], rt: [0.38, 1.175], ftZ: -0.175 },
  RG: { x0: 0.42, x1: 0.36, z0: 0.48, z1: 0.8 },
  intake: { z0: 0.56, z1: 0.78, y0: 0.47, y1: 0.62 },
  louvre: { z0: 0.95, z1: 1.6, x: 0.3, n: 6 },
  door: [[-0.88, 0.23], [0.34, 0.23], [0.41, 0.895], [-0.84, 0.875]],
  frontLid: [[-0.48, -1.96], [0.48, -1.96], [0.54, -1.15], [-0.54, -1.15]],
  head: [[0.47, -2.0], [0.77, -1.9], [0.8, -1.74], [0.53, -1.8]], headStyle: 'round',
  noseStyle: 'brio', tailStyle: 'brio',
  noseIntake: [[-0.34, 0.17], [0.34, 0.17], [0.3, 0.29], [-0.3, 0.29]],
  rearMesh: { w: 1.1, h: 0.17, cy: 0.56 },
  exhaust: 'single',
  diffuser: { half: 0.5, h: 0.33, z0: 1.6, fins: [-0.5, -0.17, 0.17, 0.5] },
  splitter: { w: 1.4, d: 0.36, proud: 0.03, canards: false },
  mirrorAt: [0.98, 0.965, -0.69], cabinW: 0.826,
  wheel: 'five', rimColor: 0xb8bbbf, caliper: 0x1a1a1c, interior: 'brio',
};

const CORSA: ShapeParams = {
  ...GT, id: 'rossini-corsa', name: 'Rossini Corsa', paint: 0xf5c518,
  ZF: -2.42, ZR: 2.36, YSILL: 0.11,
  axle: { zF: -1.33, zR: 1.32, r: 0.345, trackF: 0.868, trackR: 0.855, wF: 0.265, wR: 0.325 },
  arch: [0.39, 0.396],
  WP: [[-2.42, 0.85], [-2.2, 0.93], [-1.85, 0.975], [-1.33, 0.995], [-1.0, 0.968], [-0.6, 0.945], [-0.1, 0.938], [0.4, 0.958], [0.9, 0.995], [1.32, 1.015], [1.8, 1.005], [2.1, 0.985], [2.36, 0.955]],
  FH: [[-2.42, 0.46], [-2.15, 0.595], [-1.85, 0.718], [-1.55, 0.798], [-1.33, 0.828], [-1.0, 0.846], [-0.5, 0.862], [0.0, 0.876], [0.5, 0.905], [1.0, 0.945], [1.32, 0.958], [1.8, 0.952], [2.1, 0.948], [2.36, 0.968]],
  CC: [[-2.42, 0.41], [-2.15, 0.495], [-1.8, 0.595], [-1.5, 0.68], [-1.33, 0.735], [-1.12, 0.806], [-0.6, 0.848], [0.6, 0.872], [1.2, 0.89], [2.0, 0.925], [2.36, 0.955]],
  RH: [[-1.12, 0.81], [-0.85, 0.968], [-0.6, 1.103], [-0.4, 1.198], [-0.2, 1.266], [0.0, 1.296], [0.2, 1.306], [0.5, 1.274], [0.9, 1.175], [1.4, 1.06], [1.85, 0.975], [2.1, 0.935]],
  nose: { R: 0.34, p: 2.7, Ry: 0.1, tuck: 0.07, tuckY: 0.42 },
  tail: { R: 0.2, p: 2.6, Ry: 0.025, tuck: 0.09, tuckY: 0.6 },
  scallop: { depth: 0.11, z0: -0.6, z1: 0.48, e0: 0.86, e1: 0.97, yc: 0.51, h: 0.19 },
  carbonRoof: true,
  intake: { z0: 0.54, z1: 0.88, y0: 0.37, y1: 0.66 },
  louvre: { z0: 0.92, z1: 1.86, x: 0.4, n: 11 },
  frontLid: [[-0.52, -2.2], [0.52, -2.2], [0.57, -1.2], [-0.57, -1.2]],
  head: [[0.4, -2.26], [0.8, -2.17], [0.88, -2.0], [0.52, -2.08]],
  noseStyle: 'corsa', tailStyle: 'corsa',
  noseIntake: [[-0.56, 0.135], [0.56, 0.135], [0.47, 0.32], [-0.47, 0.32]],
  rearMesh: { w: 1.42, h: 0.3, cy: 0.58 },
  exhaust: 'high',
  diffuser: { half: 0.72, h: 0.42, z0: 1.6, fins: [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72] },
  splitter: { w: 1.8, d: 0.55, proud: 0.11, canards: true },
  wing: { span: 1.78, chord: 0.31, y: 1.24, z: 2.12, mountX: 0.36 },
  scoop: true, bonnetVent: true, fenderVents: true,
  mirrorAt: [1.04, 0.97, -0.7], cabinW: 0.87,
  wheel: 'cl10', rimColor: 0x16171a, caliper: 0xc0161c, interior: 'corsa',
};

const VELA: ShapeParams = {
  ...GT, id: 'vela-e', name: 'Vela E', brand: 'vela', paint: 0xf3f1ec,
  ZF: -2.36, ZR: 2.4, YSILL: 0.14,
  axle: { zF: -1.4, zR: 1.4, r: 0.35, trackF: 0.85, trackR: 0.848, wF: 0.255, wR: 0.295 },
  arch: [0.395, 0.4],
  WP: [[-2.36, 0.81], [-2.15, 0.905], [-1.85, 0.952], [-1.4, 0.975], [-1.0, 0.958], [-0.5, 0.946], [0.0, 0.946], [0.5, 0.96], [1.0, 0.985], [1.4, 0.995], [1.85, 0.985], [2.15, 0.958], [2.4, 0.915]],
  FH: [[-2.36, 0.49], [-2.1, 0.625], [-1.85, 0.735], [-1.6, 0.808], [-1.4, 0.838], [-1.0, 0.858], [-0.5, 0.875], [0.0, 0.888], [0.5, 0.908], [1.0, 0.935], [1.4, 0.948], [1.9, 0.944], [2.2, 0.935], [2.4, 0.94]],
  CC: [[-2.36, 0.455], [-2.1, 0.545], [-1.8, 0.64], [-1.5, 0.72], [-1.3, 0.77], [-1.12, 0.818], [-0.6, 0.858], [0.6, 0.88], [1.2, 0.9], [2.0, 0.918], [2.4, 0.925]],
  RH: [[-1.12, 0.822], [-0.85, 0.978], [-0.6, 1.113], [-0.4, 1.208], [-0.2, 1.277], [0.0, 1.306], [0.2, 1.313], [0.5, 1.292], [0.9, 1.238], [1.4, 1.14], [1.9, 1.03], [2.28, 0.955]],
  GB: [[-1.12, 0.82], [-0.5, 0.86], [0.1, 0.86], [0.6, 0.835], [1.2, 0.77], [1.8, 0.67], [2.28, 0.58]],
  ZC0: -1.12, ZC1: 2.28,
  nose: { R: 0.42, p: 2.3, Ry: 0.17, tuck: 0.075, tuckY: 0.5 },
  tail: { R: 0.26, p: 2.3, Ry: 0.035, tuck: 0.06, tuckY: 0.58 },
  scallop: { depth: 0.035, z0: -0.5, z1: 0.6, e0: 0.95, e1: 1.1, yc: 0.5, h: 0.14 },
  SG: { fb: [-0.92, 0.885], rb: [0.78, 0.952], rt: [0.62, 1.2], ftZ: -0.165 },
  RG: { x0: 0.56, x1: 0.44, z0: 0.78, z1: 1.78 },
  roofGlass: { z0: -0.1, z1: 0.66, x: 0.5 },
  intake: null, louvre: null,
  door: [[-0.9, 0.24], [0.52, 0.24], [0.6, 0.915], [-0.86, 0.885]],
  frontLid: [[-0.52, -2.18], [0.52, -2.18], [0.58, -1.25], [-0.58, -1.25]],
  head: [[0.52, -2.235], [0.84, -2.13], [0.87, -2.06], [0.56, -2.18]], headStyle: 'slim',
  noseStyle: 'vela', tailStyle: 'vela',
  noseIntake: [[-0.46, 0.17], [0.46, 0.17], [0.42, 0.235], [-0.42, 0.235]],
  rearMesh: null,
  exhaust: 'none',
  diffuser: { half: 0.66, h: 0.34, z0: 1.75, fins: [-0.66, -0.33, 0, 0.33, 0.66] },
  splitter: { w: 1.5, d: 0.4, proud: 0.025, canards: false },
  handles: 'flush',
  mirrorAt: [1.03, 0.98, -0.7], cabinW: 0.87,
  wheel: 'aero', rimColor: 0x1e2024, caliper: 0x2d6fd8, interior: 'vela',
};

// The front lids sit fuller and higher than the first cut: a real mid-engine car's lid meets its nose at 0.55 to
// 0.62 m (pedestrian-impact rules), not 0.45. The game's hood camera (0, 1.0, -1.45) then sees the lid's leading
// edge along the bottom of the frame, and the driver sees the wings and the lid's crown over the dash.
function liftNose(P: ShapeParams, dy: number): ShapeParams {
  const zEnd = P.axle.zF + 0.3;
  const f = (z: number) => { const t = Math.min(1, Math.max(0, (z - P.ZF) / (zEnd - P.ZF))); return 1 - t * t * (3 - 2 * t); };
  const up = (K: K, k: number): K => K.map(([z, y]) => [z, +(y + dy * k * f(z)).toFixed(4)]);
  return { ...P, CC: up(P.CC, 1), FH: up(P.FH, 0.7) };
}

export const SHAPES: Record<CarId, ShapeParams> = {
  'rossini-gt': liftNose(GT, 0.075), 'rossini-brio': liftNose(BRIO, 0.07), 'rossini-corsa': liftNose(CORSA, 0.065), 'vela-e': liftNose(VELA, 0.085),
};
export const shapeFor = (id: CarId = 'rossini-gt') => SHAPES[id] ?? GT;

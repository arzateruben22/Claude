// The garage cars as numbers: one parametric body (car-body.ts) and one set of wheels, interiors and trims
// (car-wheel.ts, cockpit.ts), shaped by these. All are our own designs: Rossini (the "R" badge), Vela and OC.
//
//   rossini-gt     the base: a balanced mid-engine coupe, red. 4.60 x 1.97 m, 2.65 m wheelbase.
//   rossini-brio   smaller and lighter: shorter overhangs, narrower, a softer round nose, blue. 4.22 x 1.88 m.
//   rossini-corsa  the track car: lower, wider, a big wing on swan-neck mounts, splitter and canards, bigger
//                  intakes, a roof scoop, a carbon roof, centre-lock wheels, yellow. 4.78 x 2.03 m (splitter to wing).
//   vela-e         electric (our other brand): a smooth closed nose with a light bar, flush door handles, a glass
//                  roof, a fastback, aero wheels, no exhausts, white. 4.76 x 1.99 m, 2.80 m wheelbase.
//   oc-hyper       the OC Hypercar Prototype 01 (the owner's reference sheet, PROJECT_OC_HYPERCAR.md): a procedural
//                  model built in code, not a finished 3D asset. Very low and wide, light silver, a deep stepped
//                  carbon splitter, ice-blue LED blades and strips, deep side intakes, a big wing on swan necks, a
//                  full-width red tail bar. 4.72 x 2.02 m, 3.00 m wheelbase, staggered 0.70 / 0.74 m tyres.
//
// Every car shares the driver's frame (spec.ts EYE, WHEEL_AT): the cabin stays where the driver sits; the body
// changes round it. The hypercar alone moves its driver lower and inboard (seatOffset below: seatDrop, seatX), so the
// eye sits under its 1.12 m roof. Lengths in metres, car frame (x right, y up, the car faces -z, origin under the middle).
import type { PaintMask } from './car-mats';
export type CarId = 'rossini-gt' | 'rossini-brio' | 'rossini-corsa' | 'vela-e' | 'oc-hyper';
export const CAR_IDS: CarId[] = ['rossini-gt', 'rossini-brio', 'rossini-corsa', 'vela-e', 'oc-hyper'];
type K = [number, number][];

export interface ShapeParams {
  id: CarId; name: string; brand: 'rossini' | 'vela' | 'oc';
  paint: number;                         // the garage colour (sRGB)
  ZF: number; ZR: number; YSILL: number; // nose and tail z, sill height
  axle: { zF: number; zR: number; r: number; rR?: number; trackF: number; trackR: number; wF: number; wR: number };   // rR: a bigger rear tyre (staggered)
  arch: [number, number];                // wheel-arch radius front, rear (centred on the axle)
  // keyed curves along z: plan half-width, fender crest height, centre deck height, roof height, canopy half-width
  WP: K; FH: K; CC: K; RH: K; GB: K;
  ZC0: number; ZC1: number;              // the canopy's extent
  DROP: number; ROLL: number; P: number; K: number;
  nose: { R: number; p: number; Ry: number; tuck: number; tuckY: number };   // plan rounding, elevation rounding, chin set-back
  tail: { R: number; p: number; Ry: number; tuck: number; tuckY: number };
  scallop: { depth: number; z0: number; z1: number; e0: number; e1: number; yc: number; h: number; tilt?: number; pow?: number; rake?: number };   // tilt: the scoop's centre rises this much toward the rear; pow: edge sharpness (4); rake: its front and rear ends lean back this many metres per metre down (diagonal ends)
  WS: { zb: number; zt: number; xb: number; xt: number };
  SG: { fb: [number, number]; rb: [number, number]; rt: [number, number]; ftZ: number; ftA?: number };   // ftA: the front-top corner's half-width (0.66)
  RG: { x0: number; x1: number; z0: number; z1: number };
  roofGlass: { z0: number; z1: number; x: number } | null;
  carbonRoof: boolean;
  intake: { z0: number; z1: number; y0: number; y1: number } | null;   // side intakes
  louvre: { z0: number; z1: number; x: number; n: number } | null;     // engine-cover louvres
  door: [number, number][];              // door shut line (side plane, z y)
  frontLid: [number, number][];          // bonnet shut line (top plane, x z)
  head: [number, number][];              // headlamp patch on the fender top (x, z): inner-front, outer-front, outer-rear, inner-rear
  bladeSweep?: number;                   // the blade's outer end sweeps this much further back (z += sweep * u^3 along it), so it climbs the fender's corner
  headStyle: 'twin' | 'round' | 'slim' | 'blade';
  // the hypercar's blade (headStyle 'blade'): a lit face h tall standing on the nose from x0 off the centre out to the
  // fender's corner, under a dark lamp socket (the lens) that runs back up the surface socket[0] (inner end) to
  // socket[1] (outer end) metres; its outer end follows the head quad's front edge (and bladeSweep)
  blade?: { x0: number; y0: number; h: number; socket: [number, number] };
  noseStyle: 'gt' | 'brio' | 'corsa' | 'vela' | 'hyper';
  tailStyle: 'gt' | 'brio' | 'corsa' | 'vela' | 'hyper';
  noseIntake: [number, number][];        // the main front opening (x, y), convex; inside the nose face's outline
  cornerIntake: [number, number][] | null; // an opening in each front corner (|x|, y): inner-bottom, outer-bottom, outer-top, inner-top
  rearMesh: { w: number; h: number; cy: number } | null;
  exhaust: 'twin' | 'single' | 'high' | 'none';
  diffuser: { half: number; h: number; z0: number; fins: number[]; top?: number };   // top: the mouth's half-width at its top edge (a trapezoid whose sides lean out to half at the floor)
  splitter: { w: number; d: number; proud: number; canards: boolean };
  wing: { span: number; chord: number; y: number; z: number; mountX: number; plate?: [number, number] } | null;   // plate: end-plate length, height
  scoop: boolean;
  bonnetVent: boolean;
  fenderVents: boolean;
  handles: 'hidden' | 'flush';
  mirrorAt: [number, number, number];
  cabinW: number;                        // inner door-card half-width
  wheel: 'twin5' | 'five' | 'cl10' | 'aero' | 'multi';
  rimColor: number; caliper: number;
  interior: 'gt' | 'brio' | 'corsa' | 'vela' | 'hyper';
  // the OC Hypercar's own pieces (absent on the other cars, which then build exactly as before)
  sidewall?: number;                     // tyre sidewall height as a share of the standard one (a low profile, a bigger rim)
  seatDrop?: number;                     // how far this car's driver sits below the shared frame (spec.ts EYE): the
                                         // eye, the wheel, the hands, the seats and the dash move down by it (seatOffset)
  led?: { color: number; halo: number; edge?: number };   // ice-blue LED strips: splitter edge, front corners, sills, diffuser, wing plates
                                         // (color: the hot centre, halo: the strip's body, edge: its outer glow; material values, picked so
                                         // the tone-mapped strip reads as the reference's ice blue, not white)
  bar?: { len: number; h: number };      // the full-width red tail bar
  fins?: { x: [number, number]; z: [number, number]; h: number };   // twin fins on the rear deck, front to back
  bonnetVents?: { x: [number, number]; z: [number, number]; n: number };   // a louvred vent each side of the bonnet's centre
  plate?: { w: number; h: number; y: number };   // the rear plate (the OC mark)
  splitterStep?: { w: number; d: number; h: number };   // a second, raised splitter tier behind the blade
  thrusters?: { x: number; y: number; r: number };   // two small nozzles set into the diffuser (fired in a later milestone)
  intakeQ?: [number, number][];          // a side intake shaped as a quad (side plane z, y): bottom-front, bottom-rear, top-rear, top-front
  lowCarbon?: [number, number];          // the skin ahead of the front wheels and behind the rears is carbon up to these shares of the side's height
  crown?: number;                        // the deck's profile across: rises as u^crown from the centre to the fender crest (a sunken bonnet between peaked crests)
  masks?: PaintMask[];                   // gloss-black regions of the paint (the two-tone), drawn by the paint shader
  paintFinish?: { metal: number; rough: number };
  tyreTint?: number; discTint?: number;  // darker rubber, a dark grey carbon-ceramic disc
  ventsQ?: [number, number][][];         // louvred vents as quads on the top surface (x, z: inner-front, outer-front, outer-rear, inner-rear; mirrored)
  hoodY?: number;                        // the game's hood camera's height (1.0 m; the hypercar's bonnet sits lower)
  seatX?: number;                        // the seats' |x| (0.37, the shared driver's frame): the driver, the wheel and both seats move to it
  deckRibs?: { x: [number, number]; z: number[] };   // silver ribs across the rear deck's openings (the structure seen under the wing)
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
  noseIntake: [[-0.41, 0.158], [0.41, 0.158], [0.36, 0.305], [-0.36, 0.305]],
  cornerIntake: [[0.5, 0.19], [0.79, 0.2], [0.73, 0.35], [0.52, 0.33]],
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
  noseIntake: [[-0.27, 0.17], [0.27, 0.17], [0.24, 0.29], [-0.24, 0.29]],
  cornerIntake: [[0.37, 0.2], [0.63, 0.21], [0.59, 0.31], [0.39, 0.3]],
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
  noseIntake: [[-0.45, 0.135], [0.45, 0.135], [0.4, 0.32], [-0.4, 0.32]],
  cornerIntake: [[0.54, 0.15], [0.87, 0.17], [0.81, 0.39], [0.56, 0.35]],
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
  noseIntake: [[-0.34, 0.17], [0.34, 0.17], [0.31, 0.235], [-0.31, 0.235]],
  cornerIntake: [[0.47, 0.2], [0.55, 0.2], [0.58, 0.41], [0.51, 0.41]],
  rearMesh: null,
  exhaust: 'none',
  diffuser: { half: 0.66, h: 0.34, z0: 1.75, fins: [-0.66, -0.33, 0, 0.33, 0.66] },
  splitter: { w: 1.5, d: 0.4, proud: 0.025, canards: false },
  handles: 'flush',
  mirrorAt: [1.03, 0.98, -0.7], cabinW: 0.87,
  wheel: 'aero', rimColor: 0x1e2024, caliper: 0x2d6fd8, interior: 'vela',
};

// The OC Hypercar Prototype 01, from the owner's reference sheet (PROJECT_OC_HYPERCAR.md section 3 and 4.2: 8.0 mm/px
// on the SIDE panel, anchored on the tyres; the width from the plate on the REAR panel). Its roof is 1.12 m, not the
// sheet's 1.05 m: the shared driver's frame needs room (section 3, "What the game's shared frame forces").
const HYPER: ShapeParams = {
  ...CORSA, id: 'oc-hyper', name: 'OC Hypercar Prototype 01', brand: 'oc', paint: 0xc8d3e8,
  ZF: -2.43, ZR: 2.29, YSILL: 0.07,
  // 3.00 m wheelbase; 0.70 / 0.74 m tyres; tracks 1.72 / 1.69 m
  axle: { zF: -1.52, zR: 1.48, r: 0.35, rR: 0.37, trackF: 0.86, trackR: 0.845, wF: 0.275, wR: 0.345 },
  arch: [0.4, 0.42],
  WP: [[-2.43, 0.88], [-2.2, 0.955], [-1.9, 0.99], [-1.52, 1.0], [-1.1, 0.975], [-0.6, 0.94], [0.0, 0.925], [0.5, 0.955], [1.0, 1.0], [1.48, 1.02], [1.9, 1.01], [2.15, 0.99], [2.29, 0.96]],
  FH: [[-2.43, 0.37], [-2.27, 0.43], [-2.1, 0.53], [-1.9, 0.65], [-1.7, 0.745], [-1.52, 0.79], [-1.25, 0.77], [-0.9, 0.74], [-0.4, 0.72], [0.2, 0.77], [0.8, 0.84], [1.2, 0.87], [1.48, 0.875], [1.9, 0.84], [2.15, 0.79], [2.29, 0.75]],
  // the deck's centre: low between the front fenders (the sunken bonnet) and between the rear haunches (the recess
  // the spine and the openings sit in), up to a lip across the tail that carries the red bar
  CC: [[-2.43, 0.33], [-2.25, 0.36], [-2.0, 0.42], [-1.75, 0.48], [-1.52, 0.53], [-1.15, 0.62], [-0.6, 0.74], [0.0, 0.82], [0.6, 0.84], [1.0, 0.78], [1.4, 0.72], [1.8, 0.69], [2.1, 0.7], [2.29, 0.72]],
  // (the windscreen springs from the deck at the cowl: no step under it)
  RH: [[-1.15, 0.64], [-1.05, 0.745], [-0.9, 0.86], [-0.6, 0.97], [-0.4, 1.04], [-0.2, 1.09], [0.0, 1.115], [0.2, 1.12], [0.5, 1.1], [0.9, 1.03], [1.3, 0.96], [1.7, 0.9], [2.0, 0.86]],
  // the canopy: a narrow teardrop, about half the body's width at the cabin (the sheet's TOP), running back into a
  // narrow spine to the wing
  GB: [[-1.15, 0.47], [-0.7, 0.5], [-0.1, 0.5], [0.35, 0.45], [0.7, 0.32], [1.0, 0.24], [1.4, 0.17], [1.8, 0.13], [2.0, 0.11]],
  ZC0: -1.15, ZC1: 2.0, DROP: 0.1, ROLL: 0.2, P: 4, K: 0.035,
  crown: 2.6,
  nose: { R: 0.3, p: 2.8, Ry: 0.12, tuck: 0.13, tuckY: 0.4 },
  tail: { R: 0.14, p: 2.7, Ry: 0.02, tuck: 0.08, tuckY: 0.5 },
  // the door's scoop: a deep, sharp-edged recess whose front and rear ends lean back down the side (the sheet's
  // fender trailing edge and the diagonal into the intake)
  scallop: { depth: 0.16, z0: -0.92, z1: -0.68, e0: 0.16, e1: 0.4, yc: 0.45, h: 0.18, pow: 4.5, rake: 1.1 },
  WS: { zb: -1.15, zt: -0.3, xb: 0.47, xt: 0.38 },
  SG: { fb: [-0.95, 0.76], rb: [0.42, 0.87], rt: [0.28, 1.05], ftZ: -0.3, ftA: 0.38 },
  RG: { x0: 0.22, x1: 0.13, z0: 0.48, z1: 1.0 },
  // smoked glass across most of the roof, under the scoop, running into the rear screen and the spine behind it: from
  // above the canopy reads as one dark teardrop between silver flanks (the sheet's TOP); the camera of the side, front
  // and hero views is below the roof, so they still see the silver flanks (the sheet's SIDE and FRONT)
  roofGlass: { z0: -0.26, z1: 0.47, x: 0.6 }, carbonRoof: false,
  intake: null, intakeQ: [[0.3, 0.25], [0.56, 0.25], [0.2, 0.63], [0.06, 0.63]],
  louvre: null,
  door: [[-0.56, 0.29], [0.1, 0.29], [0.14, 0.82], [-0.98, 0.8]],   // its front and lower edges lie along the scoop's creases
  frontLid: [[-0.5, -2.25], [0.5, -2.25], [0.55, -1.25], [-0.55, -1.25]],
  // the blade: a slim lamp along the fender's lower front edge, sweeping up and out to the corner: its outer end
  // bends back up the fender's corner (bladeSweep), so in the FRONT view it climbs from 0.38 m at the inner end to
  // about 0.52 m at the outer end (the sheet: about 0.30 to 0.48 m), where a straight blade turned down over the corner
  head: [[0.45, -2.335], [0.9, -2.185], [0.915, -2.13], [0.47, -2.285]], headStyle: 'blade', bladeSweep: 0.125,
  // M2 (M1b item 2): the blade is the face's main feature, about 0.8 m a side from 0.14 m off the centre (its foot at
  // 0.362 m, just under the black lower nose's top edge, rising to the head quad's front edge) out round the corner:
  // a lit face 25 mm tall under a dark socket that shows 12 mm (inner end) to 40 mm (outer end) above it from ahead
  blade: { x0: 0.14, y0: 0.362, h: 0.025, socket: [0.012, 0.04] },
  noseStyle: 'hyper', tailStyle: 'hyper',
  noseIntake: [[-0.48, 0.09], [0.48, 0.09], [0.43, 0.26], [-0.43, 0.26]],
  // the 'fang': a tall corner intake under the blade's outer half, an LED down its outer edge into the splitter
  cornerIntake: [[0.6, 0.1], [0.8, 0.1], [0.84, 0.3], [0.67, 0.27]],
  rearMesh: { w: 1.2, h: 0.22, cy: 0.5 },
  exhaust: 'none',
  // the diffuser's mouth: a wide trapezoid under the plate (the sheet's REAR: its LED outline runs across at about
  // half the tail's width and angles down and out to the tail's lower corners)
  diffuser: { half: 0.67, h: 0.36, z0: 1.75, fins: [-0.6, -0.43, -0.26, -0.09, 0.09, 0.26, 0.43, 0.6], top: 0.47 },
  splitter: { w: 1.94, d: 0.66, proud: 0.24, canards: false },
  wing: { span: 1.71, chord: 0.36, y: 0.98, z: 1.98, mountX: 0.42, plate: [0.55, 0.25] },
  scoop: true, bonnetVent: false, fenderVents: false, handles: 'hidden',
  mirrorAt: [0.98, 0.86, -0.92], cabinW: 0.8,
  wheel: 'multi', rimColor: 0x101318, caliper: 0x1f4fd8,
  // the Corsa's carbon buckets, harnesses and roll hoop with the hypercar's own trim (cockpit.ts 'hyper')
  interior: 'hyper',
  // the driver sits 0.20 m lower and 0.10 m further in than the shared frame (eye 0.96 m, x -0.27): under this roof
  // the windscreen's header is 1.03-1.05 m at the driver's x, which at the plan's 0.15 m drop lies 2-6 degrees above
  // the eye line, across the road at the horizon; at 0.20 m it is 8-13 degrees up, with 0.12 m of headroom
  sidewall: 0.75, seatDrop: 0.2, seatX: 0.27,
  // its bonnet is 0.25 m lower than the others': the hood camera comes down 0.15 m so its crests and V stay in frame
  hoodY: 0.85,
  // the LED family, as material colours: under ACES at the strip's 2.8x emissive a pale ice (the old 0xa6dcff) tone-maps
  // to white, so the strip's body is a deeper blue (0x1e6fd8 reads about (121,188,241) on screen), its outer glow
  // deeper still (0x0c4fb8, about (65,140,234)) and only a narrow hot centre is the pale ice (0x5eb8ff, about
  // (205,233,245)): the reference's strips sample about (122,152,190) with a (176,219,245) core
  led: { color: 0x5eb8ff, halo: 0x1e6fd8, edge: 0x0c4fb8 },
  bar: { len: 1.66, h: 0.02 },
  fins: { x: [0.68, 0.62], z: [0.95, 2.08], h: 0.08 },
  // two long vents along the front fenders' inner walls, by the cowl
  ventsQ: [[[0.37, -1.86], [0.47, -1.88], [0.6, -1.24], [0.47, -1.22]]],
  plate: { w: 0.52, h: 0.11, y: 0.46 },
  splitterStep: { w: 1.6, d: 0.5, h: 0.035 },
  thrusters: { x: 0.2, y: 0.26, r: 0.03 },
  lowCarbon: [0.62, 0.7],
  // a light, cool silver: at metalness 0.3 the faces turned away from the sun take the sky's light and still read
  // light (the front and rear views), and a warm sky doesn't turn the paint bronze
  paintFinish: { metal: 0.3, rough: 0.27 },
  tyreTint: 0x7a818e, discTint: 0x5c6068,
  deckRibs: { x: [0.3, 0.74], z: [1.12, 1.32, 1.52] },
  // the gloss-black two-tone (x, z in plan; mirrored): the V from the badge to the cowl, the spine from the rear
  // screen to the tail, the openings either side of it, and a channel along each side of the cowl
  masks: [
    { plane: 'top', mirror: true, pts: [[-0.05, -2.2], [0.03, -2.2], [0.35, -1.1], [-0.05, -1.1]], soft: 0.006 },
    // below each blade: the nose's front slope and its rounding turn black out to the corner (the blade then sits on
    // the fender's lower edge, silver above it, the dark corner and its fang intake below)
    // (in five convex pieces whose edges follow the swept blade's front edge, 5 mm under the lamp; each overlaps the
    // next by 3 to 6 cm along its own chord, so no half-tone seam shows where two pieces meet)
    { plane: 'top', mirror: true, pts: [[0.4, -2.6], [0.66, -2.6], [0.66, -2.2507], [0.45, -2.33]], soft: 0.004 },
    { plane: 'top', mirror: true, pts: [[0.6, -2.6], [0.795, -2.6], [0.795, -2.1642], [0.6, -2.2798]], soft: 0.004 },
    { plane: 'top', mirror: true, pts: [[0.735, -2.6], [0.876, -2.6], [0.876, -2.0874], [0.735, -2.2076]], soft: 0.004 },
    { plane: 'top', mirror: true, pts: [[0.816, -2.6], [0.9, -2.6], [0.9, -2.055], [0.816, -2.1452]], soft: 0.004 },
    { plane: 'top', mirror: true, pts: [[0.87, -2.6], [1.05, -2.6], [1.05, -2.055], [0.87, -2.055]], soft: 0.004 },
    { plane: 'front', mirror: true, side: -1, pts: [[0.4, 0.0], [1.05, 0.0], [1.05, 0.44], [0.45, 0.383]], soft: 0.004, range: [-3, -2.2] },
    // and across the middle: the whole lower nose below the bonnet's leading edge is black (the sheet's FRONT), so
    // the silver bonnet comes down to a gentle V at the badge and the blades sit on one dark band, not in two
    // 'eyes' with a silver bumper between them (it overlaps the corner's region, so no seam where they meet)
    { plane: 'front', mirror: true, side: -1, pts: [[-0.05, 0.0], [0.5, 0.0], [0.5, 0.388], [-0.05, 0.35]], soft: 0.004, range: [-3, -2.3] },
    // the spine: the top of the canopy's tail behind the rear screen, tapering to the wing (its steep flanks stay
    // silver: the buttresses), and the deck's centre over the tail
    { plane: 'top', mirror: true, pts: [[-0.05, 0.98], [0.16, 0.98], [0.07, 2.05], [-0.05, 2.05]], soft: 0.006 },
    { plane: 'top', mirror: true, pts: [[-0.05, 1.86], [0.42, 1.86], [0.5, 2.4], [-0.05, 2.4]], soft: 0.008, range: [0, 0.8] },
    // a dark channel along each side of the canopy's base, from the cowl vents back into the openings, so the
    // front fenders and the rear haunches read as separate silver pods (the sheet's TOP); two halves that overlap
    { plane: 'top', mirror: true, pts: [[0.47, -1.26], [0.6, -1.26], [0.625, -0.05], [0.5, -0.05]], soft: 0.008 },
    { plane: 'top', mirror: true, pts: [[0.5, -0.15], [0.625, -0.15], [0.625, 0.9], [0.44, 0.9]], soft: 0.008 },
    // (each opening is a lens, as two convex halves)
    { plane: 'top', mirror: true, pts: [[0.44, 0.84], [0.62, 0.82], [0.76, 1.25], [0.33, 1.25]], soft: 0.008 },
    { plane: 'top', mirror: true, pts: [[0.33, 1.249], [0.76, 1.249], [0.66, 1.72], [0.45, 1.74]], soft: 0.008 },
  ],
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
  // the hypercar keeps its nose low (the sheet's nose is about 0.40-0.45 m at the tip): a token lift only
  'oc-hyper': liftNose(HYPER, 0.02),
};
// the driver's frame for this car, as an offset from the shared one (spec.ts EYE, WHEEL_AT, GRIP): [x, y, z] for
// the driver's side (the passenger's seat mirrors x). Zero for every car but the hypercar.
export const seatOffset = (P: ShapeParams): [number, number, number] => [P.seatX !== undefined ? 0.37 - P.seatX : 0, -(P.seatDrop ?? 0), 0];
// the rear tyre's radius (the hypercar's are bigger than its fronts)
export const rearR = (P: ShapeParams) => P.axle.rR ?? P.axle.r;
export const shapeFor = (id: CarId = 'rossini-gt') => SHAPES[id] ?? GT;

// The cars: our own fictional makes. They share one body for now (paint changes); what changes is the machine
// underneath: weight, power, torque, revs, drag, downforce, grip. Bought with credits earned by driving, never with
// real money. Garage slots open up as you level.

import { SPEC } from './vehicle/Physics';
import type { TimeOfDay, Weather } from './settings';

export interface CarDef {
  id: string; name: string; blurb: string; price: number; level: number;
  mass: number; power: number; torque: number; redline: number; CdA: number; ClA: number; grip: number; paint: number;
  final: number;                     // final drive: shorter (bigger) is quicker off the line, lower at the top
  // optional chassis fields (the hypercar's; an earnable car carries none and gets the physics' defaults)
  Cf?: number; Cr?: number; steerGain?: number; brakeG?: number; brakeBias?: number; halfL?: number; halfW?: number;
  track?: number; rollF?: number; loadSens?: number; kx?: number; IwF?: number; IwR?: number; Ieng?: number;
  driveFront?: number; vector?: number; steerRate?: number; csRate?: number; hbKick?: number;
  // the hypercar's race tune: what changes in the scored modes (Races, Time Trial, Speed Survival); Free Drive runs the
  // Unleashed numbers above. A field set to undefined falls back to the physics' default.
  race?: Partial<CarDef>;
  founder?: boolean;                 // the OC Hypercar Founder Edition: never bought or sold for credits
  // every car is its own atmosphere (owner, 2026-10-21): the time and weather the menu's attract drive runs in while
  // this car is chosen. A run keeps the player's own time and weather settings.
  atmosphere: { time: TimeOfDay; weather: Weather };
}

export const CARS: CarDef[] = [
  { id: 'rossini-gt', name: 'Rossini GT', blurb: 'Where everyone starts: mid-engine, 711 hp, a seven-speed dual-clutch. Fast everywhere, honest at the limit.', price: 0, level: 1,
    mass: 1480, power: 530000, torque: 770, redline: 8000, CdA: 0.62, ClA: 0.5, grip: 1, paint: 0xa80d10, final: 4.44, atmosphere: { time: 'sunset', weather: 'clear' } },
  { id: 'rossini-brio', name: 'Rossini Brio', blurb: 'Light and eager: 1,250 kg and 470 hp. Gives up top speed, gets it back in the curves.', price: 9000, level: 2,
    mass: 1250, power: 350000, torque: 520, redline: 8600, CdA: 0.57, ClA: 0.55, grip: 1.07, paint: 0x1d4f9c, final: 5.0, atmosphere: { time: 'sunset', weather: 'cloudy' } },   // the coast at dusk
  { id: 'rossini-corsa', name: 'Rossini Corsa', blurb: 'The track-day one: 819 hp, a big wing\'s worth of downforce, and it revs to 8,500.', price: 30000, level: 5,
    mass: 1410, power: 611000, torque: 820, redline: 8500, CdA: 0.68, ClA: 1.0, grip: 1.04, paint: 0xf5c518, final: 4.3, atmosphere: { time: 'day', weather: 'clear' } },      // a track day
  { id: 'vela-e', name: 'Vela E', blurb: 'Electric and heavy: 1,020 hp and 1,400 Nm. The tyres cap the launch; after that it just keeps pulling.', price: 60000, level: 8,
    mass: 2150, power: 760000, torque: 1400, redline: 9000, CdA: 0.6, ClA: 0.45, grip: 1.0, paint: 0xf3f1ec, final: 4.7, atmosphere: { time: 'sunrise', weather: 'mist' } },    // an electric dawn
  // The OC Hypercar Prototype 01, Founder Edition (PROJECT_OC_HYPERCAR.md section 5): Unleashed in Free Drive, the
  // fastest, best-gripping and best-braking car in the game (all-wheel drive, torque vectoring, fan-assisted
  // downforce, stiffer tyres, 2 g brakes); in every scored mode it runs the race tune, at or under the Corsa.
  { id: 'oc-hyper', name: 'OC Hypercar', blurb: 'Prototype 01, Founder Edition. Unleashed in Free Drive: 2,012 hp, all-wheel drive and fan downforce. Races, Time Trial and Survival run its race tune, at the Corsa\'s level.', price: 0, level: 1, founder: true,
    mass: 1690, power: 1500000, torque: 2000, redline: 9000, CdA: 0.62, ClA: 2.2, grip: 1.3, paint: 0xc8d3e8, final: 3.0,
    Cf: 225000, Cr: 333000, steerGain: 1.25, brakeG: 2.0, halfL: 2.36, halfW: 1.02, driveFront: 0.4, vector: 0.6,
    atmosphere: { time: 'night', weather: 'clear' },   // the owner's reference: the hypercar at night
    race: { mass: 1500, power: 620000, torque: 1000, final: 4.0, CdA: 0.8, ClA: 1.0, grip: 1.04,
      Cf: undefined, Cr: undefined, steerGain: undefined, brakeG: undefined, driveFront: undefined, vector: undefined } },
];

// Paints (U5, the garage's Paint tab): six per car, our own names (no carmaker's colour names), the first the car's own.
// A paint is only ever applied to a car whose list has it, so the hypercar's Founder Silver never reaches another car.
export interface Paint { name: string; hex: number }
export const PAINTS: Record<string, Paint[]> = {
  'rossini-gt': [{ name: 'Rossini Red', hex: 0xa80d10 }, { name: 'Sunset Orange', hex: 0xe5620b }, { name: 'Laguna Blue', hex: 0x1d4f9c }, { name: 'Canyon Bronze', hex: 0x8a5a2b }, { name: 'Bianco', hex: 0xf1f0ec }, { name: 'Nero', hex: 0x111214 }],
  'rossini-brio': [{ name: 'Coast Blue', hex: 0x1d4f9c }, { name: 'Seafoam', hex: 0x2fa99a }, { name: 'Dune', hex: 0xd8c7a0 }, { name: 'Rossini Red', hex: 0xa80d10 }, { name: 'Pearl', hex: 0xeeeae2 }, { name: 'Nero', hex: 0x111214 }],
  'rossini-corsa': [{ name: 'Track Yellow', hex: 0xf5c518 }, { name: 'Pit Orange', hex: 0xff6a13 }, { name: 'Graphite', hex: 0x3a3d42 }, { name: 'Rossini Red', hex: 0xa80d10 }, { name: 'Bianco', hex: 0xf1f0ec }, { name: 'Matte Black', hex: 0x161616 }],
  'vela-e': [{ name: 'Glacier White', hex: 0xf3f1ec }, { name: 'Volt Violet', hex: 0x6a3fcf }, { name: 'Electric Blue', hex: 0x2a6fdc }, { name: 'Silver', hex: 0xb9bfc8 }, { name: 'Graphite', hex: 0x3a3d42 }, { name: 'Nero', hex: 0x111214 }],
  'oc-hyper': [{ name: 'Founder Silver', hex: 0xc8d3e8 }, { name: 'Ice Blue', hex: 0x9cc8ff }, { name: 'Platinum', hex: 0xe6e8ea }, { name: 'Titanium', hex: 0x7d828a }, { name: 'Midnight', hex: 0x111a33 }, { name: 'Obsidian', hex: 0x0e1116 }],
};
// the paint a car wears: the saved choice if it is one of that car's paints, else the car's own
export function paintFor(c: CarDef, saved?: Record<string, number>) {
  const h = saved?.[c.id];
  return h !== undefined && (PAINTS[c.id] ?? []).some((p) => p.hex === h) ? h : c.paint;
}

const BASE = { ...SPEC };
export function carById(id: string) { return CARS.find((c) => c.id === id) ?? CARS[0]; }
export const slotsFor = (level: number) => Math.min(6, 1 + Math.floor(level / 4));
// what the garage lists (owner, 2026-10-16): the Vela E stays in the game but shows only in owner mode or once it's
// yours. Owner mode lists every car.
export const GARAGE_HIDDEN = ['vela-e'];
export function garageCars(owner: boolean, owned: string[]) {
  return CARS.filter((c) => owner || owned.includes(c.id) || !GARAGE_HIDDEN.includes(c.id));
}

// put a car's numbers into the physics (one car drives at a time)
// the tune a run uses: the hypercar's race tune in every scored mode, its Unleashed numbers in Free Drive (and on the
// menu's attract drive); every other car has one tune
export function tuneFor(c: CarDef, mode?: string): CarDef { return c.race && mode && mode !== 'free' ? { ...c, ...c.race } : c; }
export function applyCar(car: CarDef, mode?: string) {
  const c = tuneFor(car, mode);
  Object.assign(SPEC, BASE);
  SPEC.mass = c.mass; SPEC.power = c.power; SPEC.peakTorque = c.torque;
  SPEC.redline = c.redline; SPEC.limiter = c.redline + 150;
  SPEC.CdA = c.CdA; SPEC.ClA = c.ClA; SPEC.final = c.final;
  // yaw inertia scales with mass
  SPEC.Iz = BASE.Iz * (c.mass / BASE.mass);
  // the optional chassis fields, or the base values
  SPEC.Cf = c.Cf ?? BASE.Cf; SPEC.Cr = c.Cr ?? BASE.Cr; SPEC.steerGain = c.steerGain ?? BASE.steerGain;
  SPEC.brakeG = c.brakeG ?? BASE.brakeG; SPEC.brakeBias = c.brakeBias ?? BASE.brakeBias;
  SPEC.halfL = c.halfL ?? BASE.halfL; SPEC.halfW = c.halfW ?? BASE.halfW;
  SPEC.track = c.track ?? BASE.track; SPEC.rollF = c.rollF ?? BASE.rollF; SPEC.loadSens = c.loadSens ?? BASE.loadSens;
  SPEC.kx = c.kx ?? BASE.kx; SPEC.IwF = c.IwF ?? BASE.IwF; SPEC.IwR = c.IwR ?? BASE.IwR; SPEC.Ieng = c.Ieng ?? BASE.Ieng;
  SPEC.driveFront = c.driveFront ?? BASE.driveFront; SPEC.vector = c.vector ?? BASE.vector;
  SPEC.steerRate = c.steerRate ?? BASE.steerRate; SPEC.csRate = c.csRate ?? BASE.csRate; SPEC.hbKick = c.hbKick ?? BASE.hbKick;
  return c.grip;
}

// rough figures for the showroom card, calibrated to what the GT measures in the sim (3.3 s, 211 mph): top speed
// where drag meets power or the gearing runs out, and 0-60 grip-limited off the line, then power-limited
export function figures(c: CarDef) {
  const rho = 1.225, crr = 0.012 * c.mass * 9.81;
  let v = 60;
  for (let i = 0; i < 80; i++) { const need = (0.5 * rho * c.CdA * v * v + crr) * v; v *= Math.cbrt((c.power * 0.88) / need); }
  const gearCap = ((c.redline * Math.PI) / 30) * BASE.wheelR / (BASE.gears[BASE.gears.length - 1] * c.final);
  const top = Math.min(v, gearCap);
  const a0 = Math.min(9.06 * c.grip, (c.torque * BASE.gears[0] * c.final * 0.9) / BASE.wheelR / c.mass);
  const vt = (c.power * 0.8) / (c.mass * a0), v60 = 26.82;
  const t = v60 <= vt ? v60 / a0 : vt / a0 + (c.mass * (v60 * v60 - vt * vt)) / (2 * c.power * 0.8);
  return { topMph: Math.round(top * 2.236936), zeroSixty: Math.round((t + 0.3) * 10) / 10, hp: Math.round(c.power / 745.7) };
}

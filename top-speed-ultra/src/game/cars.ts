// The cars: our own fictional makes. They share one body for now (paint changes); what changes is the machine
// underneath: weight, power, torque, revs, drag, downforce, grip. Bought with credits earned by driving, never with
// real money. Garage slots open up as you level.

import { SPEC } from './vehicle/Physics';

export interface CarDef {
  id: string; name: string; blurb: string; price: number; level: number;
  mass: number; power: number; torque: number; redline: number; CdA: number; ClA: number; grip: number; paint: number;
  final: number;                     // final drive: shorter (bigger) is quicker off the line, lower at the top
}

export const CARS: CarDef[] = [
  { id: 'rossini-gt', name: 'Rossini GT', blurb: 'Where everyone starts: mid-engine, 711 hp, a seven-speed dual-clutch. Fast everywhere, honest at the limit.', price: 0, level: 1,
    mass: 1480, power: 530000, torque: 770, redline: 8000, CdA: 0.62, ClA: 0.5, grip: 1, paint: 0xa80d10, final: 4.44 },
  { id: 'rossini-brio', name: 'Rossini Brio', blurb: 'Light and eager: 1,250 kg and 470 hp. Gives up top speed, gets it back in the curves.', price: 9000, level: 2,
    mass: 1250, power: 350000, torque: 520, redline: 8600, CdA: 0.57, ClA: 0.55, grip: 1.07, paint: 0x1d4f9c, final: 5.0 },
  { id: 'rossini-corsa', name: 'Rossini Corsa', blurb: 'The track-day one: 819 hp, a big wing\'s worth of downforce, and it revs to 8,500.', price: 30000, level: 5,
    mass: 1410, power: 611000, torque: 820, redline: 8500, CdA: 0.68, ClA: 1.0, grip: 1.04, paint: 0xf5c518, final: 4.3 },
  { id: 'vela-e', name: 'Vela E', blurb: 'Electric and heavy: 1,020 hp and 1,400 Nm. The tyres cap the launch; after that it just keeps pulling.', price: 60000, level: 8,
    mass: 2150, power: 760000, torque: 1400, redline: 9000, CdA: 0.6, ClA: 0.45, grip: 1.0, paint: 0xf3f1ec, final: 4.7 },
];

const BASE = { ...SPEC };
export function carById(id: string) { return CARS.find((c) => c.id === id) ?? CARS[0]; }
export const slotsFor = (level: number) => Math.min(6, 1 + Math.floor(level / 4));

// put a car's numbers into the physics (one car drives at a time)
export function applyCar(c: CarDef) {
  Object.assign(SPEC, BASE);
  SPEC.mass = c.mass; SPEC.power = c.power; SPEC.peakTorque = c.torque;
  SPEC.redline = c.redline; SPEC.limiter = c.redline + 150;
  SPEC.CdA = c.CdA; SPEC.ClA = c.ClA; SPEC.final = c.final;
  // yaw inertia scales with mass
  SPEC.Iz = BASE.Iz * (c.mass / BASE.mass);
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

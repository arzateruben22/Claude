// Your driver as the avatar (PROJECT_OC_ON_FOOT.md, "Camera": archetype, male or female version, skin tone, and the
// cosmetics from drivers.ts). The game keeps the choice in its settings on this device; this page reads them if
// they're there (or ?driver=closer|ace|wrench&pres=m|f&skin=0..4), and builds the person with the people builder.
import { DRIVERS, SKINS, lookFor, DriverId, Presentation } from '../../game/drivers';
import { baseBody, baseLook, defaultFace, HAIR_COLORS, IRIS_COLORS } from '../people/params';
import type { PersonOptions, Garment, Accessories } from '../people';

export interface DriverChoice { id: DriverId; pres: Presentation; skin: number; car: string; name: string }

export function readDriver(q: URLSearchParams): DriverChoice {
  let s: { driver?: string; presentation?: string; skin?: number } = {}, car = 'rossini-gt';
  try { s = JSON.parse(localStorage.getItem('tsu.settings') ?? '{}') ?? {}; } catch { /* a convenience */ }
  try { car = JSON.parse(localStorage.getItem('tsu.profile') ?? '{}')?.car ?? car; } catch { /* a convenience */ }
  const id = (q.get('driver') ?? s.driver ?? 'closer') as DriverId;
  const pres = (q.get('pres') ?? s.presentation ?? 'm') as Presentation;
  const skin = Math.max(0, Math.min(SKINS.length - 1, Number(q.get('skin') ?? s.skin ?? 1) || 0));
  const def = DRIVERS.find((d) => d.id === id) ?? DRIVERS[0];
  const carQ = q.get('car');
  return { id: def.id, pres: pres === 'f' ? 'f' : 'm', skin, car: carQ ?? car, name: def.name };
}

const GOLD = 0xc9a65a, STEEL = 0xb9bcc0, DARK = 0x161616;

export function driverPerson(c: DriverChoice): PersonOptions {
  const look = lookFor(c.id, c.pres, c.skin), f = c.pres === 'f';
  const body = { ...baseBody(f ? 'f' : 'm'), age: f ? 31 : 36, height: f ? 1.67 : 1.79, fat: 0.36, muscle: f ? 0.38 : 0.52 };
  const face = defaultFace(f ? 'f' : 'm');
  const lk = { ...baseLook(), skin: look.skin, iris: IRIS_COLORS[c.skin >= 3 ? 0 : 2] };
  const acc: Accessories = { hoops: null, studs: null, chain: null, watch: null, bracelet: null, ring: null, bag: 'none', bagColor: 0x111111 };
  if (look.watch) acc.watch = look.watch === 'gold' ? GOLD : look.watch === 'steel' ? STEEL : DARK;
  if (look.ring) acc.ring = look.watch === 'gold' ? GOLD : STEEL;
  if (look.bracelet) acc.bracelet = GOLD;
  let outfit: Garment[];
  if (c.id === 'closer') {
    // pressed shirt, heavy gold watch, never late
    outfit = [
      f ? { kind: 'blouse', color: look.sleeve ?? 0xe9e4da, fabric: 'satin', sleeve: 0.95, neck: 'v' } : { kind: 'shirt', color: look.sleeve ?? 0xf2f2f0, fabric: 'cotton', sleeve: 1, neck: 'collar' },
      { kind: 'trousers', color: 0x2a2c30, fabric: 'wool' },
      { kind: f ? 'flats' : 'loafers', color: 0x2a1c14, fabric: 'leather' },
    ];
    Object.assign(lk, f ? { hair: 'bob', hairColor: HAIR_COLORS.darkBrown, lipstick: 0x8e2a2e, liner: 0.5 } : { hair: 'short', hairColor: HAIR_COLORS.black, facialHair: 'stubble' });
    if (f) acc.studs = GOLD;
  } else if (c.id === 'ace') {
    // the racer: black jacket open over a dark top (the gloves stay in the car)
    outfit = [
      f ? { kind: 'fitted', color: 0x1d1f22, fabric: 'knit', sleeve: 0.95, neck: 'crew' } : { kind: 'tee', color: 0x1d1f22, fabric: 'cotton', sleeve: 0.25, neck: 'crew' },
      { kind: 'leather', color: look.sleeve ?? 0x1b1b1d, fabric: 'leather', sleeve: 1, open: true },
      { kind: 'jeans', color: 0x1f2a40, fabric: 'denim' },
      { kind: 'boots', color: 0x111111, fabric: 'leather' },
    ];
    Object.assign(lk, f ? { hair: 'ponytail', hairColor: HAIR_COLORS.black, liner: 0.7 } : { hair: 'buzz', hairColor: HAIR_COLORS.black, facialHair: 'stubble' });
  } else {
    // the engineer: sleeves rolled, a smart watch
    outfit = [
      { kind: 'tee', color: f ? 0x4a5a46 : 0x56646c, fabric: 'cotton', sleeve: 0.22, neck: 'crew' },
      { kind: 'jeans', color: 0x3c5070, fabric: 'denim' },
      { kind: f ? 'sneakers' : 'boots', color: f ? 0xf0eee8 : 0x5a3a22, fabric: 'leather', accent: 0xffffff },
    ];
    Object.assign(lk, f ? { hair: 'ponytail', hairColor: HAIR_COLORS.auburn, freckles: c.skin < 2 ? 0.3 : 0 } : { hair: 'short', hairColor: HAIR_COLORS.brown, facialHair: 'beard' });
  }
  return { seed: 9000 + DRIVERS.findIndex((d) => d.id === c.id) * 10 + (f ? 1 : 0) + c.skin * 100, name: 'you', body, face, look: lk, outfit, acc };
}

/** eye height for the first-person camera, from the driver's height */
export const eyeHeight = (o: PersonOptions) => Math.max(1.5, Math.min(1.7, o.body.height * 0.935));

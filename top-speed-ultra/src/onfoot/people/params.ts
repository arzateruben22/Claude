// Everything that makes one person different from the next, as continuous parameters, plus presets and a seeded
// random generator. Every person is an adult (21-75) dressed for a night out. No body type is a joke: the same care,
// clothes and detail go to everyone.
import { clamp, rng, Rng } from './math';

export type Sex = 'f' | 'm';
export type Quality = 'phone' | 'high';

export interface BodyShape {
  sex: Sex;
  age: number;          // 21..75
  height: number;       // metres, 1.45..2.05
  heads: number;        // body height in head heights, 7.0..8.0
  fat: number;          // 0 very lean .. 0.5 average .. 1 very heavy
  muscle: number;       // 0 .. 1
  apple: number;        // -1 pear (hips, thighs, seat) .. +1 apple (belly, waist)
  belly: number;        // 0..1 a firm, high beer belly on top of the fat
  bust: number;         // 0..1
  shoulders: number;    // -1 narrow .. +1 broad
  hips: number;         // -1 narrow .. +1 wide
  waist: number;        // -1 defined (hourglass) .. +1 straight
  legs: number;         // -1 short legs .. +1 long legs
  posture: number;      // 0 upright .. 1 stooped (older posture)
  soft: number;         // 0 toned .. 1 soft and out of shape
}

export interface FaceShape {
  width: number; length: number;          // ~0.92..1.08
  jaw: number; chin: number; chinLen: number;
  cheekbones: number; cheeks: number;     // prominence; fullness
  noseLen: number; noseW: number; noseBridge: number; noseTip: number;
  lipUpper: number; lipLower: number; mouthW: number;
  eyeSize: number; eyeSpacing: number; eyeTilt: number; hooded: number;
  brow: number; forehead: number;         // brow ridge; forehead slope back
  earSize: number; earOut: number;
}

export type HairStyle = 'updo' | 'long' | 'bob' | 'short' | 'curly' | 'buzz' | 'bald' | 'ponytail' | 'receding';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'moustache' | 'goatee';

export interface Look {
  skin: number;               // sRGB hex
  iris: number;
  hair: HairStyle;
  hairColor: number;
  grey: number;               // 0..1 share of grey strands
  facialHair: FacialHair;
  glasses: boolean;
  lipstick: number | null;
  liner: number;              // 0..1 eyeliner / mascara
  blush: number;              // 0..1
  freckles: number;           // 0..1
  tattoo: 'none' | 'sleeveL' | 'forearmR' | 'forearmL';
  nails: number | null;       // painted nails
}

export type Fabric = 'satin' | 'cotton' | 'denim' | 'leather' | 'knit' | 'wool' | 'linen';
export type GarmentKind =
  | 'dress' | 'tee' | 'fitted' | 'tank' | 'shirt' | 'blouse' | 'polo'
  | 'jeans' | 'trousers' | 'skirt' | 'shorts'
  | 'jacket' | 'leather' | 'blazer' | 'cardigan'
  | 'sneakers' | 'boots' | 'heels' | 'loafers' | 'flats';

export interface Garment {
  kind: GarmentKind;
  color: number;
  fabric: Fabric;
  sleeve?: number;            // 0 sleeveless .. 1 to the wrist
  length?: number;            // dress/skirt: hem height as a share of the leg (0 at the hip .. 1 at the ankle)
  neck?: 'crew' | 'v' | 'square' | 'scoop' | 'collar' | 'strap';
  open?: boolean;             // jackets and shirts worn open
  accent?: number;            // a second colour (soles, buttons, trim)
}

export interface Accessories {
  hoops: number | null;       // gold or silver colour
  studs: number | null;
  chain: number | null;
  watch: number | null;       // case colour
  bracelet: number | null;
  ring: number | null;
  bag: 'none' | 'quilted' | 'crossbody';
  bagColor: number;
}

export interface PersonOptions {
  seed: number;
  name?: string;
  body: BodyShape;
  face: FaceShape;
  look: Look;
  outfit: Garment[];
  acc: Accessories;
  quality?: Quality;
  lod?: 0 | 1 | 2;
}

// ------------------------------------------------------------------------------------------------ palettes
/** a wide range of real skin tones (sRGB), light to deep */
export const SKIN_TONES = [0xf3d6c4, 0xeac0a4, 0xdcab8a, 0xc99472, 0xb57a58, 0x9c6545, 0x80513a, 0x65402f, 0x4e3226, 0x3d281f];
export const HAIR_COLORS = { black: 0x141110, darkBrown: 0x33231a, brown: 0x4a3122, auburn: 0x6b3220, blonde: 0xb08d5a, ash: 0x8a7a66, red: 0x7c341c, grey: 0x9a9690, white: 0xd6d3cc };
export const IRIS_COLORS = [0x3d2614, 0x4b2e17, 0x5a3a1e, 0x6b5a2e, 0x4f6a52, 0x5a7891, 0x3e5a78, 0x71604a];

const NIGHT_TOPS = [0x161616, 0xf2efe8, 0x1d2a44, 0x7a1d24, 0x2f4a3a, 0x5b4636, 0x8a8f96, 0x3a2f4f, 0xc9a77a, 0x0f3550];
const NIGHT_DRESS = [0x9e1622, 0x141414, 0x1f2f5a, 0x2d4a3e, 0x6a2a4f, 0xc58b3c, 0x5a1a1a];
const DENIM = [0x2a3a5c, 0x1f2a40, 0x3c5070, 0x151a24, 0x4a5a72];

export function defaultFace(sex: Sex): FaceShape {
  const m = sex === 'm';
  return {
    width: 1, length: 1, jaw: m ? 1.08 : 0.94, chin: m ? 1.1 : 0.92, chinLen: m ? 1.08 : 0.95,
    cheekbones: 1, cheeks: 1, noseLen: m ? 1.05 : 0.96, noseW: m ? 1.06 : 0.94, noseBridge: 1, noseTip: 1,
    lipUpper: m ? 0.9 : 1.08, lipLower: m ? 0.95 : 1.1, mouthW: 1, eyeSize: m ? 0.99 : 1.06, eyeSpacing: 1, eyeTilt: m ? 0 : 0.3,
    hooded: 0, brow: m ? 1.2 : 0.7, forehead: m ? 1.1 : 0.9, earSize: 1, earOut: 0,
  };
}

const noAcc = (): Accessories => ({ hoops: null, studs: null, chain: null, watch: null, bracelet: null, ring: null, bag: 'none', bagColor: 0x111111 });

export function baseBody(sex: Sex): BodyShape {
  return { sex, age: 30, height: sex === 'm' ? 1.76 : 1.63, heads: 7.5, fat: 0.4, muscle: 0.4, apple: sex === 'm' ? 0.3 : -0.3, belly: 0, bust: sex === 'f' ? 0.45 : 0, shoulders: 0, hips: 0, waist: 0, legs: 0, posture: 0, soft: 0.3 };
}
export function baseLook(): Look {
  return { skin: SKIN_TONES[3], iris: IRIS_COLORS[1], hair: 'short', hairColor: HAIR_COLORS.darkBrown, grey: 0, facialHair: 'none', glasses: false, lipstick: null, liner: 0, blush: 0, freckles: 0, tattoo: 'none', nails: null };
}

// ------------------------------------------------------------------------------------------------ presets
export type PresetName =
  | 'reference' | 'casual' | 'elder' | 'curvy' | 'tall' | 'stocky' | 'thin' | 'heavy' | 'muscular' | 'petite'
  | 'beerBelly' | 'pear' | 'hourglass' | 'olderWoman' | 'obese' | 'broad';

export function preset(name: PresetName): PersonOptions {
  const P = (seed: number, body: Partial<BodyShape> & { sex: Sex }, face: Partial<FaceShape>, look: Partial<Look>, outfit: Garment[], acc: Partial<Accessories> = {}): PersonOptions => ({
    seed, name, body: { ...baseBody(body.sex), ...body }, face: { ...defaultFace(body.sex), ...face }, look: { ...baseLook(), ...look }, outfit, acc: { ...noAcc(), ...acc },
  });
  switch (name) {
    // close to the owner's reference look: red satin dress, gold hoops, fine chain, black quilted bag, a loose updo
    case 'reference': return P(101, { sex: 'f', age: 27, height: 1.66, fat: 0.36, muscle: 0.35, bust: 0.5, waist: -0.5, hips: 0.2, apple: -0.4, soft: 0.2 },
      { lipUpper: 1.12, lipLower: 1.15, cheekbones: 1.12, eyeSize: 1.05, noseW: 0.92, jaw: 0.92 },
      { skin: SKIN_TONES[3], iris: IRIS_COLORS[0], hair: 'updo', hairColor: HAIR_COLORS.darkBrown, lipstick: 0x8e2a2e, liner: 0.7, blush: 0.35 },
      [{ kind: 'dress', color: 0x9e1622, fabric: 'satin', length: 0.36, neck: 'strap', sleeve: 0 }, { kind: 'heels', color: 0x161210, fabric: 'leather' }],
      { hoops: 0xd8b25a, chain: 0xd8b25a, bag: 'quilted', bagColor: 0x111111, ring: 0xd8b25a });
    case 'casual': return P(102, { sex: 'm', age: 31, height: 1.78, fat: 0.42, muscle: 0.5 },
      { jaw: 1.12 }, { skin: SKIN_TONES[5], hair: 'short', hairColor: HAIR_COLORS.black, facialHair: 'beard' },
      [{ kind: 'tee', color: 0x161616, fabric: 'cotton', sleeve: 0.25, neck: 'crew' }, { kind: 'jeans', color: DENIM[0], fabric: 'denim' }, { kind: 'sneakers', color: 0xf0eee8, fabric: 'leather', accent: 0xffffff }],
      { watch: 0x9a9da3 });
    case 'elder': return P(103, { sex: 'm', age: 71, height: 1.72, fat: 0.55, muscle: 0.2, posture: 0.75, soft: 0.8, apple: 0.6 },
      { noseLen: 1.12, earSize: 1.12, lipUpper: 0.75, lipLower: 0.8, hooded: 0.6 }, { skin: SKIN_TONES[1], hair: 'receding', hairColor: HAIR_COLORS.white, grey: 1, glasses: true, facialHair: 'moustache' },
      [{ kind: 'shirt', color: 0x5f7488, fabric: 'cotton', sleeve: 1, neck: 'collar' }, { kind: 'trousers', color: 0x3a3630, fabric: 'wool' }, { kind: 'loafers', color: 0x3a2418, fabric: 'leather' }],
      { watch: 0xc9a65a });
    case 'curvy': return P(104, { sex: 'f', age: 34, height: 1.6, fat: 0.68, muscle: 0.3, apple: -0.2, bust: 0.75, hips: 0.5, waist: -0.2, soft: 0.5 },
      { cheeks: 1.15 }, { skin: SKIN_TONES[7], hair: 'curly', hairColor: HAIR_COLORS.black, lipstick: 0x6a2a2a, liner: 0.5 },
      [{ kind: 'fitted', color: 0x2f4a3a, fabric: 'knit', sleeve: 0.5, neck: 'v' }, { kind: 'jeans', color: DENIM[3], fabric: 'denim' }, { kind: 'boots', color: 0x2a1c14, fabric: 'leather' }],
      { hoops: 0xd8b25a, bracelet: 0xd8b25a });
    case 'tall': return P(105, { sex: 'f', age: 29, height: 1.86, heads: 7.9, fat: 0.3, muscle: 0.45, shoulders: 0.6, legs: 0.6 },
      { jaw: 1.0, cheekbones: 1.15 }, { skin: SKIN_TONES[8], hair: 'buzz', hairColor: HAIR_COLORS.black, lipstick: 0x4a2422 },
      [{ kind: 'blouse', color: 0xf2efe8, fabric: 'satin', sleeve: 0.95, neck: 'v' }, { kind: 'trousers', color: 0x161616, fabric: 'wool' }, { kind: 'heels', color: 0x161616, fabric: 'leather' }],
      { studs: 0xd8b25a, watch: 0xd8b25a });
    case 'stocky': return P(106, { sex: 'm', age: 38, height: 1.68, heads: 7.1, fat: 0.6, muscle: 0.65, shoulders: 0.5, apple: 0.4 },
      { width: 1.06, jaw: 1.18, noseW: 1.1 }, { skin: SKIN_TONES[4], hair: 'buzz', hairColor: HAIR_COLORS.black, facialHair: 'goatee', tattoo: 'forearmR' },
      [{ kind: 'polo', color: 0x1d2a44, fabric: 'cotton', sleeve: 0.25, neck: 'collar' }, { kind: 'jeans', color: DENIM[2], fabric: 'denim' }, { kind: 'boots', color: 0x5a3a22, fabric: 'leather' }],
      { watch: 0x222222 });
    case 'thin': return P(107, { sex: 'm', age: 24, height: 1.88, heads: 7.8, fat: 0.04, muscle: 0.15, shoulders: -0.3, legs: 0.4 },
      { width: 0.94, cheeks: 0.8, jaw: 0.98 }, { skin: SKIN_TONES[0], hair: 'long', hairColor: HAIR_COLORS.brown, freckles: 0.4 },
      [{ kind: 'shirt', color: 0x1a1a1a, fabric: 'cotton', sleeve: 1, neck: 'collar', open: false }, { kind: 'jeans', color: DENIM[3], fabric: 'denim' }, { kind: 'boots', color: 0x111111, fabric: 'leather' }],
      { ring: 0xc0c4c8 });
    case 'heavy': return P(108, { sex: 'f', age: 45, height: 1.64, fat: 0.82, muscle: 0.3, apple: 0.5, bust: 0.8, soft: 0.6 },
      { cheeks: 1.25 }, { skin: SKIN_TONES[2], hair: 'bob', hairColor: HAIR_COLORS.auburn, lipstick: 0x9a3b44, blush: 0.3, glasses: true },
      [{ kind: 'dress', color: 0x1f2f5a, fabric: 'knit', length: 0.55, neck: 'v', sleeve: 0.5 }, { kind: 'flats', color: 0x161616, fabric: 'leather' }],
      { chain: 0xc0c4c8, bag: 'crossbody', bagColor: 0x5a3a22 });
    case 'muscular': return P(109, { sex: 'm', age: 28, height: 1.82, fat: 0.28, muscle: 0.95, shoulders: 0.8, waist: 0.2 },
      { jaw: 1.2, brow: 1.3 }, { skin: SKIN_TONES[9], hair: 'buzz', hairColor: HAIR_COLORS.black, facialHair: 'stubble', tattoo: 'sleeveL' },
      [{ kind: 'tee', color: 0xf2efe8, fabric: 'cotton', sleeve: 0.2, neck: 'crew' }, { kind: 'jeans', color: DENIM[1], fabric: 'denim' }, { kind: 'sneakers', color: 0x161616, fabric: 'leather', accent: 0xf0f0f0 }],
      { chain: 0xd8b25a, watch: 0xd8b25a });
    case 'petite': return P(110, { sex: 'f', age: 23, height: 1.5, heads: 7.1, fat: 0.25, muscle: 0.3, bust: 0.3 },
      { eyeSize: 1.08, noseLen: 0.9 }, { skin: SKIN_TONES[1], hair: 'long', hairColor: HAIR_COLORS.black, liner: 0.8, lipstick: 0xb04a5a },
      [{ kind: 'tank', color: 0x161616, fabric: 'satin', sleeve: 0, neck: 'scoop' }, { kind: 'skirt', color: 0x6a5a48, fabric: 'leather', length: 0.4 }, { kind: 'boots', color: 0x111111, fabric: 'leather' }],
      { hoops: 0xc0c4c8, bag: 'crossbody', bagColor: 0x161616 });
    case 'beerBelly': return P(111, { sex: 'm', age: 52, height: 1.75, fat: 0.62, muscle: 0.35, apple: 0.9, belly: 0.8, soft: 0.8, posture: 0.2 },
      { cheeks: 1.15, jaw: 1.05 }, { skin: SKIN_TONES[2], hair: 'short', hairColor: HAIR_COLORS.brown, grey: 0.5, facialHair: 'stubble' },
      [{ kind: 'shirt', color: 0x7a5a3a, fabric: 'linen', sleeve: 0.3, neck: 'collar' }, { kind: 'jeans', color: DENIM[4], fabric: 'denim' }, { kind: 'sneakers', color: 0x8a8f96, fabric: 'leather', accent: 0xffffff }],
      { watch: 0x9a9da3 });
    case 'pear': return P(112, { sex: 'f', age: 39, height: 1.62, fat: 0.6, muscle: 0.25, apple: -0.9, hips: 0.7, bust: 0.35, shoulders: -0.4, soft: 0.5 },
      {}, { skin: SKIN_TONES[6], hair: 'ponytail', hairColor: HAIR_COLORS.darkBrown, lipstick: 0x7a3030, liner: 0.4 },
      [{ kind: 'fitted', color: 0x7a1d24, fabric: 'cotton', sleeve: 0.95, neck: 'scoop' }, { kind: 'jeans', color: DENIM[1], fabric: 'denim' }, { kind: 'flats', color: 0xc9a77a, fabric: 'leather' }],
      { studs: 0xd8b25a, bag: 'crossbody', bagColor: 0x8a5a32 });
    case 'hourglass': return P(113, { sex: 'f', age: 31, height: 1.68, fat: 0.48, muscle: 0.35, apple: 0, bust: 0.7, hips: 0.45, waist: -0.9 },
      { lipUpper: 1.1, lipLower: 1.12 }, { skin: SKIN_TONES[5], hair: 'long', hairColor: HAIR_COLORS.darkBrown, lipstick: 0x8e2a2e, liner: 0.6 },
      [{ kind: 'dress', color: 0x141414, fabric: 'satin', length: 0.45, neck: 'square', sleeve: 0 }, { kind: 'heels', color: 0x141414, fabric: 'leather' }],
      { hoops: 0xd8b25a, bracelet: 0xd8b25a });
    case 'olderWoman': return P(114, { sex: 'f', age: 66, height: 1.6, fat: 0.55, muscle: 0.2, posture: 0.45, soft: 0.8, apple: 0.3, bust: 0.55 },
      { lipUpper: 0.8, lipLower: 0.85, hooded: 0.7, cheeks: 0.95 }, { skin: SKIN_TONES[0], hair: 'short', hairColor: HAIR_COLORS.grey, grey: 0.9, glasses: true, lipstick: 0xa05060, blush: 0.25 },
      [{ kind: 'cardigan', color: 0x3a2f4f, fabric: 'knit', sleeve: 1, neck: 'v' }, { kind: 'trousers', color: 0x2a2a2e, fabric: 'wool' }, { kind: 'flats', color: 0x2a1c14, fabric: 'leather' }],
      { studs: 0xc0c4c8, chain: 0xc0c4c8, watch: 0xc0c4c8 });
    case 'obese': return P(115, { sex: 'm', age: 42, height: 1.8, fat: 1, muscle: 0.4, apple: 0.5, soft: 0.7, shoulders: 0.3 },
      { cheeks: 1.35, width: 1.06 }, { skin: SKIN_TONES[6], hair: 'short', hairColor: HAIR_COLORS.black, facialHair: 'beard' },
      [{ kind: 'shirt', color: 0x2a2a2a, fabric: 'cotton', sleeve: 0.3, neck: 'collar' }, { kind: 'trousers', color: 0x2a3040, fabric: 'cotton' }, { kind: 'sneakers', color: 0x161616, fabric: 'leather', accent: 0x161616 }],
      { watch: 0x161616 });
    case 'broad': return P(116, { sex: 'f', age: 36, height: 1.74, fat: 0.5, muscle: 0.7, shoulders: 0.7, hips: -0.2, waist: 0.3, bust: 0.4 },
      { jaw: 1.02 }, { skin: SKIN_TONES[4], hair: 'short', hairColor: HAIR_COLORS.blonde, tattoo: 'forearmL' },
      [{ kind: 'tee', color: 0x5b4636, fabric: 'cotton', sleeve: 0.2, neck: 'v' }, { kind: 'leather', color: 0x141414, fabric: 'leather', sleeve: 1, open: true }, { kind: 'jeans', color: DENIM[0], fabric: 'denim' }, { kind: 'boots', color: 0x141414, fabric: 'leather' }],
      { studs: 0xc0c4c8 });
  }
}

export const PRESETS: PresetName[] = ['reference', 'casual', 'elder', 'curvy', 'tall', 'stocky', 'thin', 'heavy', 'muscular', 'petite', 'beerBelly', 'pear', 'hourglass', 'olderWoman', 'obese', 'broad'];

// ------------------------------------------------------------------------------------------------ random people
export function randomPerson(seed: number): PersonOptions {
  const r = rng(seed * 7919 + 13);
  const sex: Sex = r.chance(0.5) ? 'f' : 'm';
  const m = sex === 'm';
  // age skews toward a night-out crowd but runs to 75
  const age = Math.round(clamp(21 + Math.abs(r.gauss()) * 14 + (r.chance(0.12) ? r.range(15, 35) : 0), 21, 75));
  const old = clamp((age - 45) / 30);
  const fat = clamp(0.42 + r.gauss() * 0.2 + old * 0.08 + (r.chance(0.12) ? 0.25 : 0), 0.02, 1);
  const body: BodyShape = {
    sex, age,
    height: clamp((m ? 1.76 : 1.625) + r.gauss() * (m ? 0.07 : 0.065) - old * 0.02, 1.45, 2.03),
    heads: clamp(7.5 + r.gauss() * 0.22, 7.0, 8.0),
    fat, muscle: clamp((m ? 0.45 : 0.32) + r.gauss() * 0.2 - old * 0.15, 0, 1),
    apple: clamp((m ? 0.35 : -0.25) + r.gauss() * 0.4, -1, 1),
    belly: m && fat > 0.45 && r.chance(0.35) ? r.range(0.2, 0.9) : 0,
    bust: m ? 0 : clamp(0.42 + r.gauss() * 0.18 + fat * 0.25, 0.1, 1),
    shoulders: clamp(r.gauss() * 0.4, -1, 1), hips: clamp(r.gauss() * 0.4, -1, 1), waist: clamp(r.gauss() * 0.45, -1, 1),
    legs: clamp(r.gauss() * 0.4, -1, 1), posture: clamp(old * 0.7 + r.next() * 0.15, 0, 1), soft: clamp(0.3 + r.gauss() * 0.25 + old * 0.3, 0, 1),
  };
  const f0 = defaultFace(sex), j = (s: number) => 1 + r.gauss() * s;
  const face: FaceShape = {
    width: f0.width * j(0.035) + (fat - 0.4) * 0.05, length: j(0.035), jaw: f0.jaw * j(0.05), chin: f0.chin * j(0.06), chinLen: f0.chinLen * j(0.06),
    cheekbones: j(0.07), cheeks: clamp(j(0.06) + (fat - 0.4) * 0.5, 0.75, 1.45), noseLen: f0.noseLen * j(0.06), noseW: f0.noseW * j(0.07), noseBridge: j(0.12), noseTip: j(0.1),
    lipUpper: f0.lipUpper * j(0.1) - old * 0.12, lipLower: f0.lipLower * j(0.1) - old * 0.1, mouthW: j(0.05), eyeSize: f0.eyeSize * j(0.04), eyeSpacing: j(0.03), eyeTilt: f0.eyeTilt + r.gauss() * 0.4,
    hooded: clamp(r.next() * 0.4 + old * 0.5), brow: f0.brow * j(0.12), forehead: f0.forehead * j(0.1), earSize: j(0.07) + old * 0.08, earOut: clamp(r.gauss() * 0.4, -0.5, 1),
  };
  const toneI = clamp(Math.floor(r.next() * SKIN_TONES.length), 0, SKIN_TONES.length - 1);
  const darkHair = toneI >= 4 || r.chance(0.6);
  const hairColor = old > 0.5 && r.chance(0.6) ? (r.chance(0.5) ? HAIR_COLORS.grey : HAIR_COLORS.white)
    : darkHair ? r.pick([HAIR_COLORS.black, HAIR_COLORS.darkBrown, HAIR_COLORS.darkBrown, HAIR_COLORS.brown])
    : r.pick([HAIR_COLORS.brown, HAIR_COLORS.blonde, HAIR_COLORS.ash, HAIR_COLORS.auburn, HAIR_COLORS.red]);
  const hair: HairStyle = m
    ? r.pick(old > 0.4 ? ['short', 'receding', 'bald', 'buzz', 'short'] as const : ['short', 'short', 'buzz', 'curly', 'long', 'bald', 'receding'] as const)
    : r.pick(['updo', 'long', 'long', 'bob', 'curly', 'ponytail', 'short', 'buzz'] as const);
  const look: Look = {
    skin: SKIN_TONES[toneI], iris: toneI >= 4 ? r.pick(IRIS_COLORS.slice(0, 3)) : r.pick(IRIS_COLORS), hair, hairColor,
    grey: clamp((age - 32) / 35 + r.gauss() * 0.15), facialHair: m ? r.pick(['none', 'none', 'stubble', 'beard', 'moustache', 'goatee'] as const) : 'none',
    glasses: r.chance(0.18 + old * 0.4), lipstick: !m && r.chance(0.55) ? r.pick([0x8e2a2e, 0xa04a50, 0x6a2a2a, 0xb85a5a, 0x7a3a40]) : null,
    liner: !m ? r.range(0, 0.8) : 0, blush: !m ? r.range(0, 0.4) : 0, freckles: toneI < 3 && r.chance(0.25) ? r.range(0.2, 0.7) : 0,
    tattoo: r.chance(0.18) ? r.pick(['sleeveL', 'forearmR', 'forearmL'] as const) : 'none', nails: !m && r.chance(0.5) ? r.pick([0x9e1622, 0x161616, 0xd8a0a0, 0x6a2a4f]) : null,
  };
  const outfit: Garment[] = [];
  const top = r.pick(NIGHT_TOPS);
  if (!m && r.chance(0.35)) {
    outfit.push({ kind: 'dress', color: r.pick(NIGHT_DRESS), fabric: r.pick(['satin', 'knit', 'cotton'] as const), length: r.range(0.3, 0.75), neck: r.pick(['strap', 'v', 'square', 'scoop'] as const), sleeve: r.pick([0, 0, 0.25, 0.5]) });
  } else {
    const kinds = m ? (['tee', 'shirt', 'polo', 'shirt', 'tee'] as const) : (['fitted', 'blouse', 'tank', 'tee', 'fitted'] as const);
    const kind = r.pick(kinds);
    outfit.push({ kind, color: top, fabric: kind === 'blouse' ? 'satin' : kind === 'shirt' ? r.pick(['cotton', 'linen'] as const) : r.pick(['cotton', 'knit'] as const), sleeve: kind === 'tank' ? 0 : r.pick([0.2, 0.3, 0.95, 1]), neck: kind === 'shirt' || kind === 'polo' ? 'collar' : r.pick(['crew', 'v', 'scoop'] as const), open: kind === 'shirt' && r.chance(0.2) });
    const bottom = !m && r.chance(0.25) ? 'skirt' : r.chance(0.7) ? 'jeans' : 'trousers';
    outfit.push({ kind: bottom, color: bottom === 'jeans' ? r.pick(DENIM) : r.pick([0x161616, 0x2a2a2e, 0x3a3630, 0x5a4a3a, 0x1d2a44]), fabric: bottom === 'jeans' ? 'denim' : bottom === 'skirt' ? r.pick(['leather', 'satin', 'cotton'] as const) : r.pick(['wool', 'cotton'] as const), length: bottom === 'skirt' ? r.range(0.35, 0.7) : 1 });
    if (r.chance(0.28)) outfit.push({ kind: r.pick(['jacket', 'leather', 'blazer', 'cardigan'] as const), color: r.pick([0x161616, 0x3a2a1e, 0x2a3a5c, 0x4a4a48, 0x5a3a22]), fabric: 'leather', sleeve: 1, open: true });
  }
  const dressy = outfit[0].kind === 'dress' || outfit.some((g) => g.kind === 'skirt');
  outfit.push({ kind: dressy ? r.pick(['heels', 'boots', 'flats'] as const) : m ? r.pick(['sneakers', 'boots', 'loafers', 'sneakers'] as const) : r.pick(['sneakers', 'boots', 'heels', 'flats'] as const), color: r.pick([0x161616, 0xf0eee8, 0x5a3a22, 0x2a1c14, 0x8a8f96]), fabric: 'leather', accent: 0xf2f2f0 });
  for (const g of outfit) if (g.kind === 'jacket' || g.kind === 'cardigan') g.fabric = g.kind === 'cardigan' ? 'knit' : r.pick(['denim', 'cotton', 'wool'] as const);
  const metal = r.chance(0.6) ? 0xd8b25a : 0xc0c4c8;
  const acc: Accessories = {
    hoops: !m && r.chance(0.35) ? metal : null, studs: r.chance(m ? 0.1 : 0.35) ? metal : null, chain: r.chance(0.3) ? metal : null,
    watch: r.chance(0.4) ? r.pick([metal, 0x161616, 0x9a9da3]) : null, bracelet: r.chance(m ? 0.1 : 0.3) ? metal : null, ring: r.chance(0.3) ? metal : null,
    bag: !m && r.chance(0.45) ? r.pick(['quilted', 'crossbody'] as const) : 'none', bagColor: r.pick([0x111111, 0x5a3a22, 0x8a5a32, 0xc9a77a, 0x7a1d24]),
  };
  return { seed, body, face, look, outfit, acc };
}

export type { Rng };

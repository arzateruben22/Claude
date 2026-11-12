// The cast (owner, 2026-11-11): the six playable characters, three men and three women, as ONE data-driven catalog.
// Everything about how a character looks lives here, as data: the people builder's parameters (body, face, look,
// wardrobe slots, accessories), the height and proportions, the portrait and the owner's reference sheets, the
// animation settings, the unlock category, the cockpit arms' appearance, and the crowd variations. Nothing here is
// a mesh or a texture: the characters are built procedurally by the people builder (src/onfoot/people) from these
// parameters; there are no imported meshes, rigs or texture sets (PROJECT_OC_CAST.md has the asset status).
//
// One source of truth for the player's appearance: this catalog plus the saved choice (Settings.character, '' until
// the player picks one; src/game/settings.ts). The cockpit arms (src/game/drivers.ts characterLook), the on-foot avatar
// in both venues (src/onfoot/lot57/driver.ts) and the picker (src/ui/CastPicker.tsx) all read it from here.
//
// Honest scope: stylised real-time 3D for a phone browser, matched to the owner's sheets as closely as the builder's
// shapes allow; not photoreal. The six are cosmetic: they change nothing about driving, scoring or the abilities.
//
// The brief's technical IDs are kept as `ref` (M01 Marcus Bell, M02 Mateo Reyes, M03 Danny Tran, F01 Jas Cruz,
// F02 Leila Farahani, F03 Kate Morgan); the names are ours.
import type { PersonOptions, Garment, Accessories, Look, BodyShape, FaceShape, AnimName } from './people';
import { baseBody, baseLook, defaultFace } from './people/params';

export type BaseCastId = 'mateo-reyes' | 'danny-tran' | 'marcus-bell' | 'leila-farahani' | 'jas-cruz' | 'kate-morgan';
/** (2026-11-12) the pack's two characters, working names (the owner may rename them; the ids stay) */
export type PackCastId = 'chad' | 'chadaline';
export type CastId = BaseCastId | PackCastId;
export type Unlock = 'base' | 'pack';
export type ArmsOutfit = 'shirt' | 'suit' | 'work' | 'jacket' | 'fur';

/** the wardrobe as slots: what the player sees and what the crowd's variations swap */
export interface Wardrobe {
  top: Garment;
  outer: Garment | null;
  bottom: Garment | null;      // null: a dress (the top) is the whole outfit
  shoes: Garment;
  acc: Partial<Accessories>;
}
/** the cockpit arms' appearance (src/preview/hands public options, through drivers.ts characterLook) */
export interface ArmsLook {
  sleeve: number;              // the sleeve colour the hands draw
  outfit: ArmsOutfit;          // the closest sleeve the hands have: 'shirt' a buttoned cuff at the wrist, 'suit' a ribbed
                               // knit cuff, 'work' rolled up past the forearm (forearms bare); (pack) 'jacket' a suit
                               // jacket's sleeve over a sliver of shirt cuff, 'fur' a shrug's sleeve from mid forearm up
  cuff?: number;               // (pack) the shirt cuff's colour under a 'jacket' sleeve
  watch: 'gold' | 'steel' | 'smart' | null;
  bracelet: boolean;           // the hands' right-wrist bangle
  ring: boolean;
  nails: number | null;        // polish (null natural); the hand shape follows the presentation
  /** what the hands can't show yet (for the session that owns src/preview/hands*) */
  missing: string | null;
}
export interface AnimConfig {
  walkSpeed: number;           // m/s, an unhurried walk for this build and height
  idles: AnimName[];           // the idle set the crowd picks from (the builder's own clips)
  gait: 'heavy' | 'easy' | 'light';
}
/** the variety the crowd may use without losing who it is: tints for the clothes, optional layers and accessories */
export interface CrowdVariety {
  tops: number[]; outers: number[]; bottoms: number[]; shoes: number[];
  /** may take the outer layer off (a tee on its own) */
  dropOuter: boolean;
  /** accessories that may come and go; the defining ones (glasses, the hoops) stay */
  optional: (keyof Accessories)[];
}
export interface CastEntry {
  id: CastId;
  ref: 'M01' | 'M02' | 'M03' | 'F01' | 'F02' | 'F03' | 'P01' | 'P02';
  name: string;
  first: string;
  presentation: 'm' | 'f';
  age: number;
  heightCm: number;
  build: string;
  from: string;                // who they are, one line (fictional)
  unlock: Unlock;
  portrait: string;            // the picker's portrait: src/ui/assets/cast/<id>.webp (cropped from the face sheet)
  sheets: { body: string; face: string };   // the owner's reference sheets (not shipped; the build uses only the crop)
  body: BodyShape;
  face: FaceShape;
  look: Look;
  wardrobe: Wardrobe;
  anim: AnimConfig;
  arms: ArmsLook;
  crowd: CrowdVariety;
  /** where the build differs from the sheets or the brief's text, recorded instead of blended */
  notes: string[];
}

const SHEETS = (dir: string) => ({ body: `characters/${dir}/body-sheet.webp`, face: `characters/${dir}/face-sheet.webp` });
const STEEL = 0xb9bcc0, GOLD = 0xd8b25a, SILVER = 0xc0c4c8;

// ------------------------------------------------------------------------------------------------ the six
export const CAST: CastEntry[] = [
  {
    id: 'mateo-reyes', ref: 'M02', name: 'Mateo Reyes', first: 'Mateo', presentation: 'm', age: 27, heightCm: 175, build: 'stocky, athletic, broad shoulders',
    from: 'Santa Ana; mechanic and tuner at a Costa Mesa garage', unlock: 'base', portrait: 'cast/mateo-reyes.webp', sheets: SHEETS('01-mateo-reyes'),
    body: { ...baseBody('m'), age: 27, height: 1.75, heads: 7.2, fat: 0.42, muscle: 0.78, apple: 0.15, shoulders: 0.75, hips: 0.1, waist: 0.25, legs: -0.1, soft: 0.15 },
    face: { ...defaultFace('m'), width: 1.07, jaw: 1.2, chin: 1.08, chinLen: 1.02, cheekbones: 1.08, cheeks: 1.06, noseW: 1.1, noseLen: 1.04, brow: 1.3, lipUpper: 0.92, lipLower: 1.0, eyeSize: 0.96, hooded: 0.15 },
    look: { ...baseLook(), skin: 0xb57a58, iris: 0x3d2614, hair: 'fade', hairColor: 0x141110, facialHair: 'fullBeard' },
    wardrobe: {
      top: { kind: 'tee', color: 0xefede8, fabric: 'cotton', sleeve: 0.25, neck: 'crew' },
      outer: { kind: 'workJacket', color: 0x3b3b3d, fabric: 'cotton', sleeve: 1, open: true, accent: 0x2e2e30 },
      bottom: { kind: 'workPants', color: 0x1c2233, fabric: 'cotton' },
      shoes: { kind: 'workBoots', color: 0x1a1a1a, fabric: 'leather' },
      acc: { chain: SILVER },
    },
    anim: { walkSpeed: 1.32, idles: ['idle', 'talk', 'laugh'], gait: 'heavy' },
    arms: { sleeve: 0x3b3b3d, outfit: 'shirt', watch: null, bracelet: false, ring: false, nails: null, missing: 'a canvas work-jacket cuff (a plain button, no cufflink): the shirt cuff is the closest the hands have, and it shows a cufflink' },
    crowd: { tops: [0xefede8, 0x1a1a1a, 0x3a4250, 0x6a6e72], outers: [0x3b3b3d, 0x4a3a2a, 0x2a3424, 0x22262e], bottoms: [0x1c2233, 0x2a2a2c, 0x3a3226], shoes: [0x1a1a1a, 0x3a2416], dropOuter: true, optional: ['chain', 'watch'] },
    notes: ['The jacket is drawn zip-front in both sheets (the brief\'s text says an open work jacket): built as drawn, worn unzipped and open.'],
  },
  {
    id: 'danny-tran', ref: 'M03', name: 'Danny Tran', first: 'Danny', presentation: 'm', age: 31, heightCm: 172, build: 'slim',
    from: 'Westminster; architect in Irvine', unlock: 'base', portrait: 'cast/danny-tran.webp', sheets: SHEETS('02-danny-tran'),
    body: { ...baseBody('m'), age: 31, height: 1.72, heads: 7.6, fat: 0.16, muscle: 0.42, apple: 0, shoulders: 0.15, hips: -0.15, waist: 0.05, legs: 0.15, soft: 0.1 },
    face: { ...defaultFace('m'), width: 0.97, length: 1.03, jaw: 1.06, chin: 1.02, cheekbones: 1.12, cheeks: 0.92, noseW: 1.0, noseBridge: 0.85, noseLen: 1.0, brow: 1.05, eyeTilt: 0.15, hooded: 0.3, lipUpper: 0.92, lipLower: 0.98 },
    look: { ...baseLook(), skin: 0xd6a47f, iris: 0x3d2614, hair: 'sidePart', hairColor: 0x121010, glasses: true },
    wardrobe: {
      top: { kind: 'tee', color: 0xefefec, fabric: 'cotton', sleeve: 0.25, neck: 'crew' },
      outer: { kind: 'overshirt', color: 0x9a9c9f, fabric: 'linen', sleeve: 0.74, open: true, roll: true, accent: 0x8a8c8f },
      bottom: { kind: 'trousers', color: 0x56603e, fabric: 'cotton', length: 0.93, roll: true, accent: 0x4c5536 },
      shoes: { kind: 'sneakers', color: 0xf2f2ef, fabric: 'leather', accent: 0xf6f6f4 },
      acc: { watch: STEEL },
    },
    anim: { walkSpeed: 1.38, idles: ['idle', 'talk'], gait: 'light' },
    arms: { sleeve: 0x9a9c9f, outfit: 'work', watch: 'steel', bracelet: false, ring: false, nails: null, missing: null },
    crowd: { tops: [0xefefec, 0x1a1a1a, 0x2a3a5c, 0xc9c2b4], outers: [0x9a9c9f, 0x2a3a5c, 0x5a4636, 0x3a4a3a], bottoms: [0x56603e, 0xc2b28e, 0x22262e, 0x3c5070], shoes: [0xf2f2ef, 0x1a1a1a], dropOuter: true, optional: ['watch'] },
    notes: [],
  },
  {
    id: 'marcus-bell', ref: 'M01', name: 'Marcus Bell', first: 'Marcus', presentation: 'm', age: 38, heightCm: 188, build: 'tall, muscular',
    from: 'Huntington Beach; lifeguard captain and surf coach', unlock: 'base', portrait: 'cast/marcus-bell.webp', sheets: SHEETS('03-marcus-bell'),
    body: { ...baseBody('m'), age: 38, height: 1.88, heads: 7.7, fat: 0.32, muscle: 1, apple: 0.05, shoulders: 1, hips: 0.05, waist: 0.2, legs: 0.1, soft: 0.02 },
    face: { ...defaultFace('m'), width: 1.03, length: 1.04, jaw: 1.22, chin: 1.12, chinLen: 1.06, cheekbones: 1.12, noseW: 1.2, noseLen: 1.02, noseTip: 1.08, brow: 1.38, lipUpper: 1.06, lipLower: 1.12, eyeSize: 0.96, forehead: 1.05 },
    look: { ...baseLook(), skin: 0x65402f, iris: 0x3d2614, hair: 'bald', hairColor: 0x1c1816, grey: 0.12, facialHair: 'fullBeard' },
    wardrobe: {
      top: { kind: 'henley', color: 0x1f2740, fabric: 'cotton', sleeve: 0.24, neck: 'crew', accent: 0x18203a },
      outer: null,
      bottom: { kind: 'chinoShorts', color: 0xc2a77c, fabric: 'cotton' },
      shoes: { kind: 'sandals', color: 0x5a3a24, fabric: 'leather' },
      acc: { sunglassesUp: 0x3a221a },
    },
    anim: { walkSpeed: 1.42, idles: ['idle', 'laugh', 'talk'], gait: 'easy' },
    arms: { sleeve: 0x1f2740, outfit: 'work', watch: null, bracelet: false, ring: false, nails: null, missing: 'a short sleeve ending above the elbow: the rolled work sleeve is the closest (the forearms are bare as drawn)' },
    crowd: { tops: [0x1f2740, 0xefede8, 0x3a4a3a, 0x7a1d24], outers: [], bottoms: [0xc2a77c, 0x5a5048, 0x2a3a5c], shoes: [0x5a3a24, 0x2a1c14], dropOuter: false, optional: ['sunglassesUp'] },
    notes: ['The eyebrow scar is on his RIGHT eyebrow in both sheets (the brief\'s text says left): to be built as drawn, but the people builder has no scar mark yet (it needs face.ts or skin.ts, which another branch changes): not built.'],
  },
  {
    id: 'leila-farahani', ref: 'F02', name: 'Leila Farahani', first: 'Leila', presentation: 'f', age: 29, heightCm: 168, build: 'slim',
    from: 'Irvine; real-estate agent in Newport Beach', unlock: 'base', portrait: 'cast/leila-farahani.webp', sheets: SHEETS('04-leila-farahani'),
    body: { ...baseBody('f'), age: 29, height: 1.68, heads: 7.6, fat: 0.28, muscle: 0.3, apple: -0.2, bust: 0.42, shoulders: -0.05, hips: 0.05, waist: -0.35, legs: 0.2, soft: 0.15 },
    face: { ...defaultFace('f'), length: 1.03, jaw: 0.96, chin: 0.95, cheekbones: 1.1, noseLen: 1.06, noseBridge: 1.15, noseW: 0.96, noseTip: 1.04, eyeSize: 1.08, eyeTilt: 0.1, brow: 0.95, lipUpper: 1.04, lipLower: 1.08 },
    look: { ...baseLook(), skin: 0xd3a583, iris: 0x6b5a2e, hair: 'waves', hairColor: 0x2e1f17, liner: 0.35, blush: 0.15, lipstick: 0x9a5a52 },
    wardrobe: {
      top: { kind: 'fitted', color: 0x141414, fabric: 'knit', sleeve: 0.3, neck: 'crew' },
      outer: { kind: 'blazer', color: 0xe3d7c3, fabric: 'wool', sleeve: 1, open: true, neck: 'v' },
      bottom: { kind: 'trousers', color: 0x18181a, fabric: 'wool' },
      shoes: { kind: 'lowHeels', color: 0x121212, fabric: 'leather' },
      acc: { hoops: GOLD },
    },
    anim: { walkSpeed: 1.3, idles: ['idle', 'talk'], gait: 'light' },
    arms: { sleeve: 0xe3d7c3, outfit: 'shirt', watch: null, bracelet: false, ring: false, nails: 0xb07a72, missing: 'a tailored blazer cuff (no shirt cuff showing): the shirt cuff is the closest the hands have, and it shows a pearl button' },
    crowd: { tops: [0x141414, 0xf2efe8, 0x7a1d24, 0x2a3a5c], outers: [0xe3d7c3, 0x161616, 0x5a3a2a, 0x2a3424], bottoms: [0x18181a, 0x3a3630, 0xe3d7c3], shoes: [0x121212, 0x5a3a22], dropOuter: true, optional: [] },
    notes: ['Nails: a muted nude polish is our provisional choice (the sheets do not show her nails clearly).'],
  },
  {
    id: 'jas-cruz', ref: 'F01', name: 'Jas Cruz', first: 'Jas', presentation: 'f', age: 24, heightCm: 160, build: 'petite, athletic',
    from: 'Anaheim; barista and sim racer', unlock: 'base', portrait: 'cast/jas-cruz.webp', sheets: SHEETS('05-jas-cruz'),
    body: { ...baseBody('f'), age: 24, height: 1.6, heads: 7.25, fat: 0.3, muscle: 0.55, apple: -0.3, bust: 0.58, shoulders: 0.05, hips: 0.3, waist: -0.4, legs: 0.0, soft: 0.15 },
    face: { ...defaultFace('f'), width: 1.03, length: 0.98, jaw: 0.98, chin: 0.94, cheekbones: 1.06, cheeks: 1.06, noseW: 1.04, noseLen: 0.94, noseBridge: 0.88, eyeSize: 1.04, eyeTilt: 0.25, brow: 0.82, lipUpper: 1.08, lipLower: 1.12 },
    look: { ...baseLook(), skin: 0xc49068, iris: 0x3d2614, hair: 'highPonytail', hairColor: 0x121010, liner: 0.4, freckles: 0.15 },
    wardrobe: {
      top: { kind: 'tank', color: 0xf2f1ee, fabric: 'cotton', sleeve: 0, neck: 'scoop' },
      outer: { kind: 'bomber', color: 0x4e5536, fabric: 'cotton', sleeve: 0.8, open: true, accent: 0x434a2e },
      bottom: { kind: 'jeans', color: 0x8fa3bd, fabric: 'denim' },
      shoes: { kind: 'chunkySneakers', color: 0xf4f4f2, fabric: 'leather', accent: 0xf6f6f4 },
      acc: { hairTie: 0x161616 },
    },
    anim: { walkSpeed: 1.36, idles: ['idle', 'laugh', 'talk'], gait: 'light' },
    arms: { sleeve: 0x4e5536, outfit: 'suit', watch: null, bracelet: true, ring: false, nails: null, missing: 'a bomber\'s ribbed cuff on a plain sleeve (the suit sleeve is ribbed all along and carries a small R chevron patch) and an elastic hair tie on the right wrist (the metal bangle stands in)' },
    crowd: { tops: [0xf2f1ee, 0x1a1a1a, 0x9e1622, 0x2a3a5c], outers: [0x4e5536, 0x161616, 0x7a1d24, 0x2a3a5c], bottoms: [0x8fa3bd, 0x2a3a5c, 0x161616], shoes: [0xf4f4f2, 0x161616], dropOuter: true, optional: ['hairTie'] },
    notes: ['The hair tie is on her right wrist in every view: built there.'],
  },
  {
    id: 'kate-morgan', ref: 'F03', name: 'Kate Morgan', first: 'Kate', presentation: 'f', age: 35, heightCm: 175, build: 'tall, athletic swimmer',
    from: 'San Clemente; ex-pro surfer, boat captain at Dana Point Harbor', unlock: 'base', portrait: 'cast/kate-morgan.webp', sheets: SHEETS('06-kate-morgan'),
    body: { ...baseBody('f'), age: 35, height: 1.75, heads: 7.8, fat: 0.22, muscle: 0.68, apple: 0, bust: 0.34, shoulders: 0.55, hips: -0.05, waist: 0.05, legs: 0.3, soft: 0.05 },
    face: { ...defaultFace('f'), length: 1.04, width: 0.98, jaw: 1.02, chin: 0.98, cheekbones: 1.14, cheeks: 0.94, noseLen: 1.04, noseBridge: 1.05, eyeSize: 1.0, eyeTilt: 0.05, brow: 0.9, lipUpper: 0.96, lipLower: 1.0 },
    look: { ...baseLook(), skin: 0xe0b393, iris: 0x667f92, hair: 'lowPonytail', hairColor: 0xa8895c, freckles: 0.85, blush: 0.12 },
    wardrobe: {
      top: { kind: 'tee', color: 0xefede6, fabric: 'cotton', sleeve: 0.25, neck: 'scoop' },
      outer: { kind: 'overshirt', color: 0x7f98b4, fabric: 'denim', sleeve: 0.7, open: true, roll: true, accent: 0x9aadc2 },
      bottom: { kind: 'cargo', color: 0x9a8a68, fabric: 'cotton', length: 0.86, roll: true, accent: 0x8c7d5c },
      shoes: { kind: 'deckShoes', color: 0x2c3a58, fabric: 'leather', accent: 0xeee8dc },
      acc: {},
    },
    anim: { walkSpeed: 1.4, idles: ['idle', 'talk', 'laugh'], gait: 'easy' },
    arms: { sleeve: 0x7f98b4, outfit: 'work', watch: null, bracelet: false, ring: false, nails: null, missing: null },
    crowd: { tops: [0xefede6, 0x2a3a5c, 0x5a7891, 0x161616], outers: [0x7f98b4, 0x3a4a3a, 0xc9a77a], bottoms: [0x9a8a68, 0x2a3a5c, 0x3c5070], shoes: [0x2c3a58, 0xf0eee8], dropOuter: true, optional: [] },
    notes: ['The brief leaves the rest of her outfit to the sheet: white tee, faded denim shirt rolled up, khaki cargo trousers rolled at the ankle, navy deck shoes (as drawn).'],
  },
];

export const CAST_IDS = CAST.map((c) => c.id);
/** any character of the catalog, the pack's included (whether a save may PLAY a pack character is `playable`) */
export const castById = (id: string | null | undefined): CastEntry | null => CAST.find((c) => c.id === id) ?? CAST_PACK.identities.find((c) => c.id === id) ?? null;
export const isCastId = (v: unknown): v is CastId => typeof v === 'string' && castById(v) !== null;

// ------------------------------------------------------------------------------------------------ the pack
// The two-character pack (owner, 2026-11-11/12): "Chad" and "Chadaline" (working names), the male and female versions
// of each other, sold together with the Rossini Scarlatta for $22.22 (src/store/catalog.json 'cast-pack-duo',
// price_cents 2222, an 18+ purchase, available: false: nothing is on sale and the store stays in test mode). Both are
// our own original, fictional adults in the game's stylised 3D look (no likeness of anyone real), built by the same
// people builder from the owner's reference sheets (owner/pack/chad, owner/pack/chadaline; not shipped).
// They are playable only with the pack's entitlement (src/game/castPack.ts packUnlocked: the store's entitlement, or
// in a test-mode build the labelled TEST unlock), and they NEVER join the crowd: the crowd draws only on CAST (the
// six, unlock 'base').
const PACK_SHEETS = (dir: string, ext: string) => ({ body: `owner/pack/${dir}/body-sheet.${ext}`, face: `owner/pack/${dir}/face-sheet.${ext}` });
const INK = 0x111113, CREAM_FUR = 0xe8dcc6, WHITE = 0xf4f4f1;
const PACK_IDENTITIES: CastEntry[] = [
  {
    id: 'chad', ref: 'P01', name: 'Chad', first: 'Chad', presentation: 'm', age: 28, heightCm: 188, build: 'tall, athletic',
    from: 'Newport Beach; pack character (working name)', unlock: 'pack', portrait: 'cast/chad.webp', sheets: PACK_SHEETS('chad', 'png'),
    body: { ...baseBody('m'), age: 28, height: 1.88, heads: 7.5, fat: 0.27, muscle: 0.55, apple: 0, shoulders: 0.6, hips: -0.1, waist: -0.2, legs: 0.2, soft: 0.03 },
    face: { ...defaultFace('m'), jaw: 0.97, chin: 1.0, chinLen: 1.0, cheekbones: 1.06, cheeks: 1.2, noseLen: 1.03, noseW: 1.0, noseBridge: 1.1, lipUpper: 1.1, lipLower: 1.16, eyeTilt: 0.05, hooded: 0.2, brow: 1.3, earSize: 0.92, earOut: -0.3, jawSoft: 1 },
    look: { ...baseLook(), skin: 0xc79370, iris: 0x4b2e17, hair: 'curlsMedium', hairColor: 0x1d130d, hairTips: 0x4e3521, facialHair: 'lightStubble', browThick: 1.3 },
    wardrobe: {
      // (the builder's 'fitted' shell with a collar, the top buttons undone: its looser 'shirt' drape would push through the jacket)
      top: { kind: 'fitted', color: WHITE, fabric: 'cotton', sleeve: 1, neck: 'collar', unbutton: 1.15 },
      outer: { kind: 'suitJacket', color: INK, fabric: 'wool', sleeve: 0.945, neck: 'v' },
      bottom: { kind: 'suitTrousers', color: INK, fabric: 'wool' },
      shoes: { kind: 'oxfords', color: 0x0c0c0d, fabric: 'leather' },
      acc: { studs: 0xe9eef3, pocketSquare: 0xf6f6f3, buttons: 0x0b0b0c },
    },
    anim: { walkSpeed: 1.42, idles: ['idle', 'talk', 'laugh'], gait: 'easy' },
    arms: { sleeve: INK, outfit: 'jacket', cuff: WHITE, watch: null, bracelet: false, ring: false, nails: null, missing: null },
    crowd: { tops: [WHITE], outers: [INK], bottoms: [INK], shoes: [0x0c0c0d], dropOuter: false, optional: [] },
    notes: ['A working name: the owner may rename him; the id stays.', 'The jacket\'s flap pockets and the trousers\' pressed crease are not built.'],
  },
  {
    id: 'chadaline', ref: 'P02', name: 'Chadaline', first: 'Chadaline', presentation: 'f', age: 27, heightCm: 168, build: 'curvy, hourglass',
    from: 'Newport Beach; pack character (working name)', unlock: 'pack', portrait: 'cast/chadaline.webp', sheets: PACK_SHEETS('chadaline', 'webp'),
    body: { ...baseBody('f'), age: 27, height: 1.68, heads: 7.6, fat: 0.4, muscle: 0.4, apple: -0.5, bust: 0.7, shoulders: 0, hips: 0.55, waist: -0.85, legs: 0.15, soft: 0.18 },
    face: { ...defaultFace('f'), jaw: 0.86, chin: 0.9, cheekbones: 1.12, cheeks: 1.14, noseLen: 0.96, noseW: 0.94, noseTip: 0.98, lipUpper: 1.26, lipLower: 1.3, mouthW: 1.03, eyeSize: 1.08, eyeTilt: 0.42, brow: 0.74, jawSoft: 0.9 },
    look: { ...baseLook(), skin: 0xc48a63, iris: 0x5a3a1e, hair: 'longWaves', hairColor: 0x18100c, hairTips: 0x4a2c1a, liner: 0.9, blush: 0.3, lipstick: 0xa5665c, nails: 0xe8cfc4, browThick: 1.3 },
    wardrobe: {
      top: { kind: 'dress', color: 0x101011, fabric: 'knit', length: 0.27, neck: 'strap', sleeve: 0, fit: 'body' },
      outer: { kind: 'shrug', color: CREAM_FUR, fabric: 'fur' },
      bottom: null,
      // (plain black soles: the sheet's red soles are a real fashion brand's trademark and are not copied)
      shoes: { kind: 'stilettos', color: 0x0d0d0e, fabric: 'leather' },
      acc: { hoops: GOLD, hoopSize: 0.5, watch: GOLD, watchRight: true, rings: GOLD },
    },
    anim: { walkSpeed: 1.22, idles: ['idle', 'talk', 'laugh'], gait: 'light' },
    arms: { sleeve: CREAM_FUR, outfit: 'fur', watch: 'gold', bracelet: false, ring: true, nails: 0xe8cfc4, missing: 'the watch is drawn on her right wrist (built there on foot); the cockpit hands wear a watch on the left wrist only' },
    crowd: { tops: [0x101011], outers: [CREAM_FUR], bottoms: [], shoes: [0x0d0d0e], dropOuter: false, optional: [] },
    notes: ['A working name: the owner may rename her; the id stays.', 'The sheet\'s red shoe soles are a real brand\'s trademark: the soles are plain black.', 'Nails: a pale nude polish, as the sheet shows.'],
  },
];
export const CAST_PACK = { sku: 'cast-pack-duo', unlock: 'pack' as const, entitlement: 'cast-pack-duo-characters', identities: PACK_IDENTITIES, planned: { men: 1, women: 1 } };
export const isPackId = (v: unknown): v is PackCastId => typeof v === 'string' && CAST_PACK.identities.some((c) => c.id === v);
/** the identities a player may pick: the six base characters, plus the pack's two when the pack is unlocked */
export const pickable = (ownsPack = false) => [...CAST.filter((c) => c.unlock === 'base'), ...(ownsPack ? CAST_PACK.identities : [])];
/** the character a save may play as: a base character always; a pack character only while the pack is unlocked (else
 *  null, and the caller falls back to the look without a character) */
export const playable = (id: string | null | undefined, packUnlocked: boolean): CastEntry | null => { const c = castById(id); return c && (c.unlock === 'base' || packUnlocked) ? c : null; };

// ------------------------------------------------------------------------------------------------ building them
const clone = (g: Garment): Garment => ({ ...g });
function outfitOf(w: Wardrobe): Garment[] {
  return [clone(w.top), ...(w.outer ? [clone(w.outer)] : []), ...(w.bottom ? [clone(w.bottom)] : []), clone(w.shoes)];
}
function accOf(a: Partial<Accessories>): Accessories {
  return { hoops: null, studs: null, chain: null, watch: null, bracelet: null, ring: null, bag: 'none', bagColor: 0x111111, sunglassesUp: null, hairTie: null, rings: null, pocketSquare: null, buttons: null, ...a };
}
const SEED: Record<CastId, number> = { 'mateo-reyes': 7101, 'danny-tran': 7102, 'marcus-bell': 7103, 'leila-farahani': 7104, 'jas-cruz': 7105, 'kate-morgan': 7106, chad: 7201, chadaline: 7202 };

/** a character exactly as on the sheets (the player, the picker) */
export function castPerson(id: CastId, seed = SEED[id]): PersonOptions {
  const c = castById(id) ?? CAST[0];
  return { seed, name: 'cast:' + c.id, body: { ...c.body }, face: { ...c.face }, look: { ...c.look }, outfit: outfitOf(c.wardrobe), acc: accOf(c.wardrobe.acc) };
}
/** the slot for one of the six by id (for crowdPerson and staffPerson) */
export const slotOf = (id: BaseCastId) => CAST.findIndex((c) => c.id === id);
/** which of the six a person's options were built from (null: not from the cast) */
export function castOf(o: Pick<PersonOptions, 'name'>): CastId | null {
  const m = /^cast:([a-z-]+)/.exec(o.name ?? '');
  return m && isCastId(m[1]) ? m[1] : null;
}

// ------------------------------------------------------------------------------------------------ the crowd
// The six are the only human appearance archetypes for the venues' people (the master brief, section 3). A crowd
// member keeps the base character's face, skin tone, defining hair, proportions and defining accessories (Danny's
// glasses, Leila's hoops); the variety is in the clothes' tints, whether the outer layer is on, the optional
// accessories, and (in the venues' own code) routes, schedules, idle and conversation timing.
const rnd = (seed: number) => { let a = (seed * 2654435761) >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; };
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length) % xs.length];

/**
 * A crowd member from the cast. `slot` picks the base character: neighbours (consecutive slots, e.g. the members of
 * one group or party) get different characters, so no two identical people stand side by side; `seed` varies the
 * clothes. The canonical outfit comes up about one time in four.
 */
export function crowdPerson(seed: number, slot: number): PersonOptions {
  const base = CAST[((slot % 6) + 6) % 6];
  const r = rnd(seed * 31 + slot * 7 + 11);
  const o = castPerson(base.id, seed);
  if (r() < 0.25) return o;
  const v = base.crowd, w = base.wardrobe;
  const outfit: Garment[] = [{ ...w.top, color: pick(r, v.tops) }];
  if (w.outer && !(v.dropOuter && r() < 0.35)) outfit.push({ ...w.outer, color: v.outers.length ? pick(r, v.outers) : w.outer.color, accent: undefined });
  if (w.bottom) outfit.push({ ...w.bottom, color: pick(r, v.bottoms), accent: undefined });
  outfit.push({ ...w.shoes, color: pick(r, v.shoes) });
  // a roll's accent follows the new colour
  for (const g of outfit) if (g.roll) g.accent = shade(g.color, 0.9);
  const acc = { ...o.acc };
  for (const k of v.optional) if (r() < 0.5) (acc as unknown as Record<string, unknown>)[k] = null;
  return { ...o, outfit, acc };
}
/** a member of staff from the cast: the base character in the venue's uniform top (and dark trousers, sneakers) */
export function staffPerson(seed: number, slot: number, uniform: { kind: Garment['kind']; color: number; sleeve?: number; neck?: Garment['neck']; accent?: number; trousers?: number }): PersonOptions {
  const base = CAST[((slot % 6) + 6) % 6];
  const o = castPerson(base.id, seed);
  const outfit: Garment[] = [
    { kind: uniform.kind, color: uniform.color, fabric: 'cotton', sleeve: uniform.sleeve ?? 0.25, neck: uniform.neck ?? (uniform.kind === 'polo' ? 'collar' : 'crew'), accent: uniform.accent },
    { kind: 'trousers', color: uniform.trousers ?? 0x22252a, fabric: 'cotton' },
    { kind: 'sneakers', color: 0x161616, fabric: 'leather', accent: 0xf2f2f0 },
  ];
  // the defining accessories stay (glasses are a Look; the hoops, a watch); sunglasses and the hair tie come off at work
  return { ...o, outfit, acc: { ...o.acc, sunglassesUp: null, hairTie: null, chain: null } };
}
function shade(hex: number, k: number) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k)), g = Math.min(255, Math.round(((hex >> 8) & 255) * k)), b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// ------------------------------------------------------------------------------------------------ old saves
// Before the cast, the driver's appearance was a presentation (m/f) and one of five skin tones (drivers.ts SKINS).
// A save with those and no character keeps exactly that look until the player picks a character (the brief: "default
// = keep today's player look until the player picks"); the picker opens on the closest character, which is the one
// of the same presentation whose skin tone is nearest (RGB distance) to the saved tone.
export function closestCharacter(presentation: 'm' | 'f', skinHex: number): CastId {
  const rgb = (h: number) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const [r0, g0, b0] = rgb(skinHex);
  let best: CastEntry = CAST[0], bd = Infinity;
  for (const c of CAST) {
    if (c.presentation !== presentation) continue;
    const [r, g, b] = rgb(c.look.skin), d = (r - r0) ** 2 + (g - g0) ** 2 + (b - b0) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best.id;
}

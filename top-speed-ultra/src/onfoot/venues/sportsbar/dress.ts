// S4's fourth pass (the art review: a seated guest at the bar read as nude at Ultra after dark, a uniform bare back and
// hips): the people builder's random wardrobe (people/params.ts, not the bar's to edit) includes camel, tan and brown
// tops, dresses, skirts and trousers (0xc9a77a, 0xc58b3c, 0x5b4636, 0x5a4a3a, 0x3a2a1e ...) within a few steps of its
// own skin tones. A close-fitting garment in the wearer's own skin colour reads as bare skin in any light, and the
// room's warm light after dark (and the warm rim) closes what gap there is. So every guest the bar builds keeps their
// garments' colours apart from their own skin: a body garment (anything over the torso, hips or legs) that reads as the
// skin (`readsAsSkin`) is given the bar's nearest-in-spirit night colour that stands well apart from that skin, chosen by the
// person's seed so the same guest always wears the same thing. Shoes and accents are left as they are. Pure (no three,
// no DOM), so the node crowd test checks it over thousands of random people.
// (S4's fifth pass: the fourth pass caught only a garment near the wearer's OWN skin. Its phone frame at the pool tables
// after dark still showed a guest from behind in a camel top over brown trousers, with mid-brown skin, who read as bare:
// a camel top is the colour of a lighter skin, and the eye takes it for one whoever wears it. So a body garment is now
// kept apart from the builder's light to mid skin tones (the first six) as well as the wearer's own. The deep tones
// stay the wearer's-own rule only: against them the check would take every brown jacket and tee out of the wardrobe
// (1,360 of 5,000 guests recoloured, tried), and a dark brown reads as bare only on a wearer of that skin)
import type { PersonOptions, Garment } from '../../people/params';
import { SKIN_TONES } from '../../people/params';

/** garments that cover the body (shoes, and accessories elsewhere, don't read as skin) */
const BODY: ReadonlySet<string> = new Set(['tee', 'shirt', 'polo', 'fitted', 'blouse', 'tank', 'dress', 'skirt', 'jeans', 'trousers', 'jacket', 'leather', 'blazer', 'cardigan']);
/** the replacements, the wardrobe's own night colours that sit furthest from every skin tone: black, chalk, navy,
 *  oxblood, forest, ink blue, plum, slate */
const APART = [0x161616, 0xf2efe8, 0x1d2a44, 0x7a1d24, 0x2f4a3a, 0x0f3550, 0x3a2f4f, 0x4a4a52];
/** a garment reads as skin when it is warm like skin (red over green over blue), its hue near the skin's (green over
 *  red within 0.15) and closer than this to it (a weighted RGB distance on 0..255, the eye's weights). Black, navy and
 *  grey on dark skin, or a deep red, aren't caught: they don't read as bare skin */
export const NEAR = 40;
/** how far a replacement must stand from the skin */
export const FAR = 110;

export function colorDistance(a: number, b: number) {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255), dg = ((a >> 8) & 255) - ((b >> 8) & 255), db = (a & 255) - (b & 255);
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) * 1.7;   // (x 1.7: about RGB's own scale for greys)
}

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
/** does this colour read as this skin? */
export function readsAsSkin(color: number, skin: number) {
  const [r, g, b] = rgb(color), [sr, sg] = rgb(skin);
  return r - b >= 12 && r >= g && g >= b && Math.abs(g / Math.max(1, r) - sg / sr) < 0.15 && colorDistance(color, skin) < NEAR;
}

/** the light to mid skin tones (0xf3d6c4 to 0x9c6545): a garment in one of these reads as bare skin on anyone */
const LIGHT_TONES = SKIN_TONES.slice(0, 6);
/** does this colour read as bare skin: the wearer's own, or a light to mid tone whoever wears it? */
export function readsAsAnySkin(color: number, skin: number) {
  if (readsAsSkin(color, skin)) return true;
  for (let i = 0; i < LIGHT_TONES.length; i++) if (readsAsSkin(color, LIGHT_TONES[i])) return true;
  return false;
}

/** the person with any body garment that reads as skin recoloured; the same object back when nothing needed it */
export function apartFromSkin(o: PersonOptions): PersonOptions {
  const skin = o.look.skin;
  const near = (g: Garment) => BODY.has(g.kind) && readsAsAnySkin(g.color, skin);
  if (!o.outfit.some(near)) return o;
  const ok = APART.filter((c) => colorDistance(c, skin) >= FAR);
  const pick = (k: number) => ok[(Math.abs(o.seed | 0) + k * 7) % ok.length];
  let k = 0;
  return { ...o, outfit: o.outfit.map((g) => (near(g) ? { ...g, color: pick(k++) } : g)) };
}

/** how many of a person's body garments read as skin, theirs or any tone (the check: 0 after apartFromSkin) */
export function skinLike(o: PersonOptions) {
  let n = 0;
  for (const g of o.outfit) if (BODY.has(g.kind) && readsAsAnySkin(g.color, o.look.skin)) n++;
  return n;
}

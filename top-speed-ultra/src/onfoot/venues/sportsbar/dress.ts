// S4's fourth pass (the art review: a seated guest at the bar read as nude at Ultra after dark, a uniform bare back and
// hips): the people builder's random wardrobe (people/params.ts, not the bar's to edit) includes camel, tan and brown
// tops, dresses, skirts and trousers (0xc9a77a, 0xc58b3c, 0x5b4636, 0x5a4a3a, 0x3a2a1e ...) within a few steps of its
// own skin tones. A close-fitting garment in the wearer's own skin colour reads as bare skin in any light, and the
// room's warm light after dark (and the warm rim) closes what gap there is. So every guest the bar builds keeps their
// garments' colours apart from their own skin: a body garment (anything over the torso, hips or legs) that reads as the
// skin (`readsAsSkin`) is given the bar's nearest-in-spirit night colour that stands well apart from that skin, chosen by the
// person's seed so the same guest always wears the same thing. Shoes and accents are left as they are. Pure (no three,
// no DOM), so the node crowd test checks it over thousands of random people.
import type { PersonOptions, Garment } from '../../people/params';

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

/** the person with any body garment near their skin recoloured; the same object back when nothing needed it */
export function apartFromSkin(o: PersonOptions): PersonOptions {
  const skin = o.look.skin;
  const near = (g: Garment) => BODY.has(g.kind) && readsAsSkin(g.color, skin);
  if (!o.outfit.some(near)) return o;
  const ok = APART.filter((c) => colorDistance(c, skin) >= FAR);
  const pick = (k: number) => ok[(Math.abs(o.seed | 0) + k * 7) % ok.length];
  let k = 0;
  return { ...o, outfit: o.outfit.map((g) => (near(g) ? { ...g, color: pick(k++) } : g)) };
}

/** how many of a person's body garments read as their skin (the check: 0 after apartFromSkin) */
export function skinLike(o: PersonOptions) {
  let n = 0;
  for (const g of o.outfit) if (BODY.has(g.kind) && readsAsSkin(g.color, o.look.skin)) n++;
  return n;
}

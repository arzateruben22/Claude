// What you can order at Lot 57 and what you then hold (PROJECT_OC_ON_FOOT.md, "What you can do": "Order at the bar
// or a truck window. A sheet with five big buttons ... you hold it (a cup or a basket in the corner of the
// first-person view, in your avatar's hand in third person). Free, fictional, alcohol-free for the player.")
//
// Every item and every name is ours. Nothing costs anything: there are no prices, in real money or in credits. The
// player's menu has no alcohol (you drove here); NPCs may hold pints as part of the scene ('pint').
//
// The models are built in code: lathed cups and glasses, a paper boat with a checked liner, a noodle box, tacos,
// a pretzel (a trefoil tube: three holes), dumplings, corn. Each item is three meshes: paper and food (vertex colours
// over one small atlas, painted in canvas at load), the wet things (liquid, ice: glossy), and the clear plastic or
// glass (transparent). A held item is lit by a "lamp" level the page sets each frame (the string lights after dark,
// the Shed's pendants inside), the same way the venue's baked night light works.
import * as THREE from 'three';
import { PAL } from './tex';

export type CounterId = 'bar' | 'tacos' | 'noodles';
export type ItemId =
  | 'fizz' | 'agua' | 'horchata' | 'hazy' | 'pretzel'
  | 'birria' | 'asada' | 'elote' | 'jamaica'
  | 'garlic' | 'dumplings' | 'cukes' | 'tea' | 'yuzu'
  | 'pint';

export interface MenuItem { id: ItemId; name: string; note: string; kind: 'drink' | 'food' }
export interface Counter {
  id: CounterId;
  title: string;
  /** what the staff says when you step up, and when it's ready ({item} is replaced) */
  hello: string;
  ready: string;
  /** what the wait is called on screen: "Pouring", "Cooking" */
  making: string;
  items: MenuItem[];
}

const fizz: MenuItem = { id: 'fizz', name: 'Orangewood Fizz', note: 'Orange soda, lots of ice', kind: 'drink' };
export const MENUS: Record<CounterId, Counter> = {
  bar: {
    id: 'bar', title: 'The Shed · bar', hello: 'Hey. What can I get you?', ready: 'One {item}. Enjoy.', making: 'Pouring',
    items: [
      fizz,
      { id: 'agua', name: 'Cucumber-lime agua fresca', note: 'Blended cucumber and lime, a little sugar', kind: 'drink' },
      { id: 'horchata', name: 'Horchata cold brew', note: 'Cinnamon rice horchata over cold brew', kind: 'drink' },
      { id: 'hazy', name: 'Zero-proof hazy', note: 'Non-alcoholic hazy pale, 0.0%', kind: 'drink' },
      { id: 'pretzel', name: 'Soft pretzel', note: 'Salted, with house mustard', kind: 'food' },
    ],
  },
  tacos: {
    id: 'tacos', title: 'Two Lane Tacos', hello: 'Hey! What are we having?', ready: '{item}, here you go!', making: 'Cooking',
    items: [
      { id: 'birria', name: 'Birria tacos', note: 'Three tacos, consommé to dip', kind: 'food' },
      { id: 'asada', name: 'Carne asada tacos', note: 'Three tacos, onion, cilantro, lime', kind: 'food' },
      { id: 'elote', name: 'Elote cup', note: 'Street corn, crema, chile, lime', kind: 'food' },
      { id: 'jamaica', name: 'Agua de jamaica', note: 'Hibiscus, iced', kind: 'drink' },
      fizz,
    ],
  },
  noodles: {
    id: 'noodles', title: 'Night Shift Noodles', hello: 'Hi there. What sounds good?', ready: '{item}. Careful, it\'s hot.', making: 'Cooking',
    items: [
      { id: 'garlic', name: 'Garlic noodles', note: 'Butter, garlic, parmesan, scallion', kind: 'food' },
      { id: 'dumplings', name: 'Chili crisp dumplings', note: 'Six, pan-fried', kind: 'food' },
      { id: 'cukes', name: 'Sesame cucumbers', note: 'Smashed, with chili oil', kind: 'food' },
      { id: 'tea', name: 'Jasmine iced tea', note: 'Unsweetened, over ice', kind: 'drink' },
      { id: 'yuzu', name: 'Yuzu lemonade', note: 'Bright and sour', kind: 'drink' },
    ],
  },
};
/** every item's name, looked up once here (the order chip asks for it every frame while an order or a held item is out) */
const NAMES = (() => {
  const out = { pint: 'pint' } as Record<ItemId, string>;
  for (const c of Object.values(MENUS)) for (const it of c.items) out[it.id] = it.name;
  return out;
})();
export const itemName = (id: ItemId): string => NAMES[id] ?? id;
const FOOD = new Set<ItemId>(['pretzel', 'birria', 'asada', 'elote', 'garlic', 'dumplings', 'cukes']);
export const isDrink = (id: ItemId) => !FOOD.has(id);

// ------------------------------------------------------------------------------------------------ the atlas
// 256 x 256, painted once: a white patch (untextured parts), three sleeve bands (ours: LOT 57, TWO LANE, NIGHT SHIFT)
// and a red-and-cream checked liner for the paper boats.
type Rect = { u0: number; v0: number; u1: number; v1: number };
const W = 256;
const px = (x0: number, y0: number, x1: number, y1: number): Rect => ({ u0: x0 / W, v0: 1 - y1 / W, u1: x1 / W, v1: 1 - y0 / W });
const R = {
  white: px(2, 2, 14, 14),
  lot: px(0, 16, 256, 56), lane: px(0, 56, 256, 96), night: px(0, 96, 256, 136),
  check: px(0, 136, 256, 200), kraft: px(0, 200, 256, 256),
};
const WHITE_UV: [number, number] = [8 / W, 1 - 8 / W];

function atlasTexture() {
  const c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, W);
  const band = (y: number, bg: string, fg: string, accent: string, text: string, size: number) => {
    g.fillStyle = bg; g.fillRect(0, y, W, 40);
    g.fillStyle = accent; g.fillRect(0, y + 3, W, 2); g.fillRect(0, y + 35, W, 2);
    g.fillStyle = fg; g.font = `800 ${size}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    // twice round the cup, so it reads from either side
    for (const x of [64, 192]) g.fillText(text, x, y + 21);
  };
  band(16, PAL.teal, PAL.cream, PAL.red, 'LOT 57', 24);
  band(56, PAL.red, PAL.cream, PAL.cream, 'TWO LANE', 20);
  band(96, '#1b2a3a', PAL.cream, PAL.patina, 'NIGHT SHIFT', 18);
  for (let y = 136; y < 200; y += 8) for (let x = 0; x < W; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#c8462f' : '#f4ecd8'; g.fillRect(x, y, 8, 8); }
  // kraft paper: a warm tan with fibres
  g.fillStyle = '#c39a62'; g.fillRect(0, 200, W, 56);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${i % 2 ? '90,60,30' : '235,210,170'},0.18)`; g.fillRect((i * 97) % W, 200 + ((i * 31) % 56), 3 + (i % 5), 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return t;
}

// ------------------------------------------------------------------------------------------------ geometry
/** one item's triangles for one material: positions, normals, vertex colours, atlas UVs */
class Build {
  P: number[] = []; N: number[] = []; C: number[] = []; U: number[] = []; I: number[] = [];
  private col = new THREE.Color();
  add(g: THREE.BufferGeometry, color: number, m: THREE.Matrix4 | null = null, rect: Rect | null = null) {
    if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, base = this.P.length / 3;
    this.col.setHex(color);
    for (let i = 0; i < p.count; i++) {
      this.P.push(p.getX(i), p.getY(i), p.getZ(i));
      this.N.push(n.getX(i), n.getY(i), n.getZ(i));
      this.C.push(this.col.r, this.col.g, this.col.b);
      if (rect && uv) this.U.push(rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
      else this.U.push(WHITE_UV[0], WHITE_UV[1]);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.I.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) this.I.push(base + i);
    g.dispose();
  }
  get empty() { return this.I.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setIndex(this.I);
    g.computeBoundingSphere();
    return g;
  }
}
const M = () => new THREE.Matrix4();
const T = (x: number, y: number, z: number) => M().makeTranslation(x, y, z);
const lathe = (pts: [number, number][], seg: number) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** a quad (two triangles) with UVs 0..1, wound so its normal faces `n` (both sides when `two`) */
function quad(a: number[], b: number[], c: number[], d: number[], two = false) {
  const g = new THREE.BufferGeometry();
  const P = [...a, ...b, ...c, ...a, ...c, ...d], U = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  if (two) { P.push(...a, ...c, ...b, ...a, ...d, ...c); U.push(0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  return g;
}
/** the same surface seen from the other side: winding and normals reversed */
function flip(g: THREE.BufferGeometry) {
  if (g.index) g.setIndex(Array.from(g.index.array).reverse());
  const n = g.attributes.normal;
  if (n) for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
/** a seeded jitter */
function rnd(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** a clear plastic cup (16 oz): the shell, a liquid to `fill`, ice, a straw, our sleeve */
function cup(o: Parts, liquid: number, opt: { top?: number; fill?: number; ice?: boolean; straw?: number | null; sleeve?: Rect; garnish?: 'lime' | 'lemon' | null; layered?: number }) {
  const seg = o.seg, H = 0.135, r0 = 0.03, r1 = 0.046, fill = opt.fill ?? 0.112;
  const rAt = (y: number) => r0 + (r1 - r0) * (y / H);
  o.clear.add(lathe([[r0 - 0.001, 0.0], [r0, 0.002], [rAt(H - 0.004), H - 0.004], [r1 + 0.002, H - 0.001], [r1 + 0.002, H + 0.002], [r1 - 0.001, H + 0.002], [rAt(H) - 0.0015, H - 0.002], [r0 - 0.0015, 0.004], [0, 0.004]], seg), 0xffffff);
  // the liquid (a little inside the shell), its surface; a second, paler layer on top for the horchata
  const ri = (y: number) => rAt(y) - 0.0018;
  if (opt.layered !== undefined) {
    const mid = fill * 0.55;
    o.wet.add(lathe([[0, 0.005], [ri(0.005), 0.005], [ri(mid), mid], [0, mid]], seg), liquid);
    o.wet.add(lathe([[0, mid], [ri(mid), mid], [ri(fill), fill], [0, fill]], seg), opt.layered);
  } else o.wet.add(lathe([[0, 0.005], [ri(0.005), 0.005], [ri(fill), fill], [0, fill]], seg), liquid);
  if (opt.ice !== false) {
    const r = rnd(liquid);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + r(), d = 0.012 + r() * 0.014, s = 0.017 + r() * 0.006;
      const m = T(Math.sin(a) * d, fill - 0.004 + r() * 0.006, Math.cos(a) * d).multiply(M().makeRotationFromEuler(new THREE.Euler(r() * 0.8, r() * 3, r() * 0.8)));
      o.wet.add(new THREE.BoxGeometry(s, s * 0.9, s), 0xe6f2f6, m);
    }
  }
  if (opt.straw !== null) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0.008, 0.01, 0.004), new THREE.Vector3(0.014, 0.12, 0.006), new THREE.Vector3(0.02, 0.2, 0.008)]);
    o.paper.add(new THREE.TubeGeometry(c, 8, 0.0034, 8, false), opt.straw ?? 0xc8462f);
  }
  if (opt.sleeve) {
    const y0 = 0.045, y1 = 0.088;
    const sl = new THREE.CylinderGeometry(rAt(y1) + 0.0016, rAt(y0) + 0.0016, y1 - y0, seg, 1, true);
    o.paper.add(sl, 0xffffff, T(0, (y0 + y1) / 2, 0), opt.sleeve);
  }
  if (opt.garnish) {
    // a citrus wheel on the rim
    const c = opt.garnish === 'lime' ? 0x6fae3a : 0xf2d24a, inner = opt.garnish === 'lime' ? 0xc9e58a : 0xfaf0a0;
    const m = T(r1 - 0.004, H + 0.006, 0).multiply(M().makeRotationZ(Math.PI / 2 - 0.25));
    o.paper.add(new THREE.CylinderGeometry(0.021, 0.021, 0.005, Math.max(10, seg / 2)), c, m.clone());
    o.wet.add(new THREE.CylinderGeometry(0.018, 0.018, 0.0058, Math.max(10, seg / 2)), inner, m);
  }
}

/** a shaker pint: thick base, the liquid, a foam head */
function pint(o: Parts, liquid: number) {
  const seg = o.seg, H = 0.15, r0 = 0.031, r1 = 0.043, rAt = (y: number) => r0 + (r1 - r0) * (y / H);
  o.clear.add(lathe([[0, 0], [r0, 0], [rAt(H), H], [rAt(H) - 0.003, H], [rAt(0.02) - 0.004, 0.02], [0, 0.02]], seg), 0xffffff);
  const ri = (y: number) => rAt(y) - 0.0035;
  o.wet.add(lathe([[0, 0.02], [ri(0.02), 0.02], [ri(0.124), 0.124], [0, 0.124]], seg), liquid);
  o.paper.add(lathe([[0, 0.124], [ri(0.124), 0.124], [ri(0.142), 0.142], [ri(0.142) - 0.004, 0.146], [0, 0.147]], seg), 0xf2e7cf);
}

/** a paper boat (kraft outside, the checked liner inside) of length L, width B, depth D, flared */
function boat(o: Parts, L = 0.17, B = 0.1, D = 0.045) {
  const fl = 0.012, x0 = -L / 2, x1 = L / 2, z0 = -B / 2, z1 = B / 2;
  const b = [[x0, 0.002, z0], [x1, 0.002, z0], [x1, 0.002, z1], [x0, 0.002, z1]];
  const t = [[x0 - fl, D, z0 - fl], [x1 + fl, D, z0 - fl], [x1 + fl, D, z1 + fl], [x0 - fl, D, z1 + fl]];
  // (the corners run round the base so that quad(a, b, c, d) faces down and in; each face is wound to face the side
  // it's seen from: kraft outside and underneath, the checked liner inside)
  o.paper.add(quad(b[0], b[1], b[2], b[3]), 0xffffff, null, R.kraft);                   // underneath
  o.paper.add(quad(b[3], b[2], b[1], b[0]), 0xffffff, T(0, 0.001, 0), R.check);          // the liner's floor
  for (let k = 0; k < 4; k++) {
    const a = b[k], c = b[(k + 1) % 4], d = t[(k + 1) % 4], e = t[k];
    o.paper.add(quad(c, a, e, d), 0xffffff, null, R.kraft);                             // outside
    o.paper.add(quad(a, c, d, e), 0xffffff, null, R.check);                             // inside
  }
}

/** three tacos side by side in a boat: tortilla shells, the filling, onion and cilantro */
function tacos(o: Parts, birria: boolean) {
  boat(o, 0.17, 0.11, 0.04);
  const r = rnd(birria ? 7 : 9), seg = Math.max(8, o.seg / 2);
  for (let k = 0; k < 3; k++) {
    const x = -0.052 + k * 0.052;
    // the tortilla: an open half-cylinder across the boat (a little more than half), opening up; seen from outside
    // and in. Its axis runs across the boat (z), so the three sit side by side, each a U from the end
    const m = T(x, 0.035, 0).multiply(M().makeRotationY(0.1 * (k - 1))).multiply(M().makeRotationX(Math.PI / 2));
    const arc = (r: number) => new THREE.CylinderGeometry(r, r, 0.1, seg, 1, true, -Math.PI * 0.66, Math.PI * 1.32);
    o.paper.add(arc(0.031), birria ? 0xd06a34 : 0xe8c47c, m.clone());
    o.paper.add(flip(arc(0.0295)), birria ? 0xe0924c : 0xf2d898, m.clone());
    // the filling (a strip showing between the tortilla's two edges), and bits on top: onion and cilantro
    o.paper.add(new THREE.CylinderGeometry(0.018, 0.018, 0.088, seg), birria ? 0x6a2414 : 0x5e3420, T(x, 0.03, 0).multiply(M().makeRotationX(Math.PI / 2)).multiply(M().makeScale(1, 1, 0.5)));
    // shredded or chopped meat: irregular chunks heaped along the strip
    for (let i = 0; i < 22; i++) {
      const sx = 0.006 + r() * 0.006, sy = 0.004 + r() * 0.004, sz = 0.007 + r() * 0.008, sh = r();
      o.wet.add(new THREE.BoxGeometry(sx, sy, sz), birria ? (sh < 0.5 ? 0x8a3018 : 0x6e2412) : (sh < 0.5 ? 0x6a3a22 : 0x51301c), T(x + (r() - 0.5) * 0.02, 0.038 + r() * 0.004, (r() - 0.5) * 0.082).multiply(M().makeRotationFromEuler(new THREE.Euler(r() * 0.6, r() * 3, r() * 0.6))));
    }
    for (let i = 0; i < 12; i++) {
      const s = 0.0032 + r() * 0.002, white = i % 3 !== 0;
      o.paper.add(new THREE.BoxGeometry(s, s, s), white ? 0xf2efe6 : 0x3f8a2e, T(x + (r() - 0.5) * 0.014, 0.0445 + r() * 0.002, (r() - 0.5) * 0.08).multiply(M().makeRotationY(r() * 3)));
    }
  }
  if (birria) {
    // the consommé in a small paper cup at the end
    o.paper.add(lathe([[0, 0], [0.024, 0], [0.03, 0.035], [0.028, 0.035], [0.022, 0.003], [0, 0.003]], o.seg), 0xf3efe6, T(0.105, 0, 0.0));
    o.wet.add(lathe([[0, 0.003], [0.023, 0.003], [0.0275, 0.03], [0, 0.03]], o.seg), 0x6a1c12, T(0.105, 0, 0));
  } else {
    o.paper.add(new THREE.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x6fae3a, T(0.1, 0.0, 0.02).multiply(M().makeScale(1, 0.6, 1.4)));
  }
}

/** our pretzel: a trefoil tube (three holes), glossy brown, coarse salt; a mustard cup */
function pretzel(o: Parts) {
  boat(o, 0.17, 0.12, 0.035);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 48; k++) {
    const t = (k / 48) * Math.PI * 2;
    pts.push(new THREE.Vector3((Math.sin(t) + 2 * Math.sin(2 * t)) * 0.017, 0.022 + Math.sin(3 * t) * 0.006, (Math.cos(t) - 2 * Math.cos(2 * t)) * 0.015));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  o.wet.add(new THREE.TubeGeometry(curve, Math.max(48, o.seg * 3), 0.0085, Math.max(8, o.seg / 2), true), 0x7a3e16, T(-0.012, 0, 0));
  const r = rnd(3);
  for (let i = 0; i < 40; i++) { const p = curve.getPoint(r()); o.paper.add(new THREE.BoxGeometry(0.003, 0.003, 0.003), 0xf6f4ee, T(p.x - 0.012 + (r() - 0.5) * 0.008, p.y + 0.007, p.z + (r() - 0.5) * 0.008).multiply(M().makeRotationY(r() * 3))); }
  o.paper.add(lathe([[0, 0], [0.018, 0], [0.022, 0.025], [0.02, 0.025], [0.016, 0.003], [0, 0.003]], o.seg), 0xf3efe6, T(0.062, 0, 0.025));
  o.wet.add(lathe([[0, 0.003], [0.017, 0.003], [0.0205, 0.02], [0, 0.021]], o.seg), 0xd29a1e, T(0.062, 0, 0.025));
}

/** six pan-fried dumplings with chili crisp */
function dumplings(o: Parts) {
  boat(o, 0.17, 0.11, 0.035);
  const r = rnd(11);
  for (let k = 0; k < 6; k++) {
    const x = -0.05 + (k % 3) * 0.05, z = k < 3 ? -0.024 : 0.024;
    const m = T(x, 0.004, z).multiply(M().makeRotationY(0.3 * (r() - 0.5))).multiply(M().makeScale(1.35, 0.85, 0.9));
    o.wet.add(new THREE.SphereGeometry(0.019, Math.max(10, o.seg / 2), 7, 0, Math.PI * 2, 0, Math.PI / 2), 0xeee1c2, m);
    // the pleated ridge along the top
    o.wet.add(new THREE.BoxGeometry(0.044, 0.004, 0.004), 0xe6d3ac, T(x, 0.019, z));
  }
  for (let i = 0; i < 50; i++) o.paper.add(new THREE.BoxGeometry(0.0035, 0.002, 0.0035), i % 4 ? 0xa8241a : 0x5a8a2a, T((r() - 0.5) * 0.14, 0.02 + r() * 0.004, (r() - 0.5) * 0.08));
}

/** a takeout noodle box: tapered sides with our band, open flaps, a wire handle, noodles, chopsticks */
function noodleBox(o: Parts) {
  const h = 0.095, bx = 0.038, bz = 0.03, tx = 0.05, tz = 0.04;
  const b = [[-bx, 0, -bz], [bx, 0, -bz], [bx, 0, bz], [-bx, 0, bz]], t = [[-tx, h, -tz], [tx, h, -tz], [tx, h, tz], [-tx, h, tz]];
  o.paper.add(quad(b[0], b[1], b[2], b[3]), 0xf4f1ea);
  for (let k = 0; k < 4; k++) {
    const a = b[k], c = b[(k + 1) % 4], d = t[(k + 1) % 4], e = t[k];
    o.paper.add(quad(c, a, e, d), 0xffffff, null, R.night);                             // outside, our band
    o.paper.add(quad(a, c, d, e), 0xece6da);                                            // inside
    // a flap folded out from the top edge
    const mx = (d[0] + e[0]) / 2, mz = (d[2] + e[2]) / 2, ox = Math.sign(mx) * (Math.abs(mx) > 0.001 ? 1 : 0), oz = Math.sign(mz) * (Math.abs(mz) > 0.001 ? 1 : 0);
    const f = 0.03, d2 = [d[0] + ox * f, h + f * 0.7, d[2] + oz * f], e2 = [e[0] + ox * f, h + f * 0.7, e[2] + oz * f];
    o.paper.add(quad(e, d, d2, e2, true), 0xf4f1ea);
  }
  const wire = new THREE.CatmullRomCurve3([new THREE.Vector3(-tx - 0.004, h - 0.01, 0), new THREE.Vector3(-0.03, h + 0.07, 0), new THREE.Vector3(0.03, h + 0.07, 0), new THREE.Vector3(tx + 0.004, h - 0.01, 0)]);
  o.wet.add(new THREE.TubeGeometry(wire, 16, 0.0012, 5, false), 0xc0c4c8);
  // noodles: a tangle of tubes mounded over the rim, flecks of scallion
  const r = rnd(5);
  for (let k = 0; k < 16; k++) {
    const a = r() * Math.PI * 2, pts: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) { const s = i / 4; pts.push(new THREE.Vector3(Math.cos(a + s * 2.2) * (0.012 + r() * 0.03), h - 0.004 + Math.sin(s * Math.PI) * (0.012 + r() * 0.012), Math.sin(a + s * 2.2) * (0.01 + r() * 0.025))); }
    o.wet.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0022, 5, false), k % 3 ? 0xe9c46a : 0xdcb257);
  }
  for (let i = 0; i < 24; i++) o.paper.add(new THREE.BoxGeometry(0.004, 0.0025, 0.004), 0x3f9a3a, T((r() - 0.5) * 0.07, h + 0.016 + r() * 0.008, (r() - 0.5) * 0.06));
  for (const s of [-1, 1]) o.paper.add(new THREE.BoxGeometry(0.005, 0.005, 0.22), 0xd8b47e, T(0.012 * s, h + 0.05, -0.02).multiply(M().makeRotationX(-0.95)).multiply(M().makeRotationY(0.05 * s)));
}

/** street corn in a paper cup with our band: kernels, crema, chile */
function elote(o: Parts) {
  const seg = o.seg, H = 0.07;
  o.paper.add(lathe([[0, 0], [0.034, 0], [0.042, H], [0.04, H], [0.032, 0.003], [0, 0.003]], seg), 0xf6f2ea);
  o.paper.add(new THREE.CylinderGeometry(0.0425, 0.0365, 0.03, seg, 1, true), 0xffffff, T(0, 0.035, 0), R.lane);
  const r = rnd(13);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.036, y = H - 0.006 + (1 - d / 0.036) * 0.022 + r() * 0.004;
    o.wet.add(new THREE.IcosahedronGeometry(0.0055, 0), 0xf0c444, T(Math.cos(a) * d, y, Math.sin(a) * d));
  }
  const c = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, k) => new THREE.Vector3(Math.cos(k * 1.7) * 0.022, H + 0.022 - Math.abs(k - 4) * 0.002, Math.sin(k * 1.7) * 0.022)));
  o.wet.add(new THREE.TubeGeometry(c, 30, 0.0028, 5, false), 0xf4f0e2);
  for (let i = 0; i < 40; i++) o.paper.add(new THREE.BoxGeometry(0.003, 0.002, 0.003), 0xb2321a, T((r() - 0.5) * 0.06, H + 0.026, (r() - 0.5) * 0.06));
}

/** smashed cucumbers in a small bowl, sesame and chili oil */
function cukes(o: Parts) {
  const seg = o.seg;
  o.paper.add(lathe([[0, 0], [0.04, 0], [0.058, 0.045], [0.056, 0.046], [0.038, 0.004], [0, 0.004]], seg), 0xece8e0);
  o.wet.add(lathe([[0, 0.004], [0.039, 0.004], [0.05, 0.026], [0, 0.026]], seg), 0x8a2a14);
  const r = rnd(17);
  for (let k = 0; k < 11; k++) {
    const a = r() * Math.PI * 2, d = r() * 0.035, m = T(Math.cos(a) * d, 0.03 + r() * 0.01, Math.sin(a) * d).multiply(M().makeRotationFromEuler(new THREE.Euler(r() * 1.2, r() * 3, r() * 1.2)));
    o.wet.add(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 10), 0x2f6a2a, m.clone());
    o.wet.add(new THREE.CylinderGeometry(0.0115, 0.0115, 0.0068, 10), 0xcfe6a2, m);
  }
  for (let i = 0; i < 40; i++) o.paper.add(new THREE.BoxGeometry(0.0035, 0.0015, 0.002), 0xf2e8cc, T((r() - 0.5) * 0.07, 0.042 + r() * 0.005, (r() - 0.5) * 0.07).multiply(M().makeRotationY(r() * 3)));
}

interface Parts { paper: Build; wet: Build; clear: Build; seg: number }

/** the shapes: what each item is made of */
function shape(id: ItemId, o: Parts) {
  switch (id) {
    case 'fizz': return cup(o, 0xf07a1a, { sleeve: R.lot, straw: 0xc8462f });
    case 'agua': return cup(o, 0xb9d98a, { sleeve: R.lot, straw: 0x4f7f6a, garnish: 'lime' });
    case 'horchata': return cup(o, 0x4a2c1a, { sleeve: R.lot, straw: 0xf3e6c4, layered: 0xe8dcc6, ice: true });
    case 'hazy': return pint(o, 0xe0a33e);
    case 'pint': return pint(o, 0xc8862a);
    case 'jamaica': return cup(o, 0x7a1630, { sleeve: R.lane, straw: 0xf3e6c4, garnish: 'lime' });
    case 'tea': return cup(o, 0xb87a2a, { sleeve: R.night, straw: 0x12333a, garnish: 'lemon' });
    case 'yuzu': return cup(o, 0xf0dc6a, { sleeve: R.night, straw: 0xc8462f, garnish: 'lemon' });
    case 'pretzel': return pretzel(o);
    case 'birria': return tacos(o, true);
    case 'asada': return tacos(o, false);
    case 'elote': return elote(o);
    case 'garlic': return noodleBox(o);
    case 'dumplings': return dumplings(o);
    case 'cukes': return cukes(o);
  }
}

/** how big each item is, for holding it (metres): height and the grip's height above the base */
export const GRIP: Record<'cup' | 'boat' | 'box' | 'bowl', { h: number; grip: number }> = {
  cup: { h: 0.14, grip: 0.06 }, boat: { h: 0.05, grip: 0.0 }, box: { h: 0.1, grip: 0.0 }, bowl: { h: 0.05, grip: 0.0 },
};
const BOATS = new Set<ItemId>(['pretzel', 'birria', 'asada', 'dumplings']);
export const formOf = (id: ItemId): keyof typeof GRIP =>
  BOATS.has(id) ? 'boat' : id === 'garlic' ? 'box' : id === 'cukes' || id === 'elote' ? 'bowl' : 'cup';

/**
 * The item factory: the atlas and the three materials, made once and shared by every item on the page; geometry
 * per item id, made on first use and shared by every copy (on the counter, in your hand, in an NPC's hand).
 */
export class Items {
  readonly atlas = atlasTexture();
  /** the lamp level on held and served items (warm light after dark), set by the page each frame */
  readonly lamp = { value: new THREE.Color(0, 0, 0) };
  readonly paper: THREE.MeshStandardMaterial; readonly wet: THREE.MeshStandardMaterial; readonly clear: THREE.MeshStandardMaterial;
  private geos = new Map<string, [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry]>();
  constructor(private quality: 'low' | 'high' | 'ultra') {
    const lamp = <T extends THREE.Material>(m: T, key: string): T => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uLamp = this.lamp;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uLamp;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uLamp;');
      };
      m.customProgramCacheKey = () => 'lot57-item-' + key;
      return m;
    };
    this.paper = lamp(new THREE.MeshStandardMaterial({ map: this.atlas, vertexColors: true, roughness: 0.78, metalness: 0 }), 'paper');
    this.wet = lamp(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0 }), 'wet');
    this.clear = lamp(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide }), 'clear');
  }
  /** new copies use the other detail (copies already out keep theirs: the cache holds both) */
  setQuality(q: 'low' | 'high' | 'ultra') { this.quality = q; }
  private geometry(id: ItemId) {
    const key = id + (this.quality === 'low' ? ':lo' : ':hi');
    let g = this.geos.get(key);
    if (!g) {
      const o: Parts = { paper: new Build(), wet: new Build(), clear: new Build(), seg: this.quality === 'low' ? 14 : 28 };
      shape(id, o);
      g = [o.paper.geometry(), o.wet.geometry(), o.clear.geometry()];
      this.geos.set(key, g);
    }
    return g;
  }
  /** a new copy of an item (a group of up to three meshes, its base at the origin, upright) */
  make(id: ItemId, name = 'item-' + id): THREE.Group {
    const [p, w, c] = this.geometry(id), g = new THREE.Group();
    g.name = name; g.userData.item = id;
    for (const [geo, mat, n] of [[p, this.paper, 'paper'], [w, this.wet, 'wet'], [c, this.clear, 'clear']] as [THREE.BufferGeometry, THREE.Material, string][]) {
      if (!geo.index || geo.index.count === 0) continue;
      const m = new THREE.Mesh(geo, mat); m.name = `${name}-${n}`; m.castShadow = n !== 'clear'; m.receiveShadow = true;
      if (n === 'clear') m.renderOrder = 3;
      g.add(m);
    }
    return g;
  }
  /** triangles in one copy of an item (for the budgets) */
  tris(id: ItemId) { return this.geometry(id).reduce((s, g) => s + (g.index ? g.index.count / 3 : 0), 0); }
}

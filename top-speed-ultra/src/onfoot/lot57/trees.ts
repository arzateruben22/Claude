// The venue's own trees, built in code: olive trees in the yard's corten planters (multi-stemmed, gnarled, an airy
// grey-green crown) and broadleaf shade trees in the lot's median (one trunk, four scaffold limbs, a full crown). A
// tree is a set of tapered limbs grown by a seeded recursion, and a crown of leaf cards: small squares carrying a
// painted sprig (twigs and leaves drawn on a canvas at load, no downloaded textures), scattered through a clump at
// the end of every twig. The cards are lit with normals pointing out of the crown (not their own flat normals), so
// the crown shades as one soft mass and never shows its cards edge-on, and both faces of a card share that normal.
// Vertex colours darken the inside and the underside of the crown (a baked occlusion), and the night light is baked
// in like every other batch (geom.ts). Three densities: phone (Low), high, ultra. The palms along Orangewood stay the
// game's own.
import * as THREE from 'three';
import { Batch, Kit, canvasTex, rand } from './geom';
import type { Tree } from './venue';

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ------------------------------------------------------------------------------------------ textures
/** the leaf atlas: a row of four olive sprigs over a row of four broadleaf sprigs, each in a square cell */
export const leafAtlas = (W = 1024) => canvasTex(W, W / 2, (g, w) => {
  const cs = w / 4;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) sprig(g, col * cs, row * cs, cs, row === 0, rand(4100 + row * 16 + col));
});

/** one sprig: twigs from near the middle out to the cell's edge, leaves along them, kept inside the cell */
function sprig(g: CanvasRenderingContext2D, ox: number, oy: number, cs: number, olive: boolean, r: () => number) {
  const k = cs / 256, cx = ox + cs / 2, cy = oy + cs / 2;
  g.save();
  g.beginPath(); g.rect(ox + 1, oy + 1, cs - 2, cs - 2); g.clip();
  // a faint wash of the leaf colour under everything (alpha under the cut-out threshold): the mip levels average
  // toward leaf green at the edges, not toward black
  g.fillStyle = olive ? 'rgba(92,102,74,0.04)' : 'rgba(66,96,44,0.04)';
  g.fillRect(ox, oy, cs, cs);
  const leaves: { x: number; y: number; a: number; L: number; W: number; c: string; rib: string | null }[] = [];
  const twigs: [number, number][][] = [];
  const nT = olive ? 7 : 6;
  for (let t = 0; t < nT; t++) {
    let a = (t / nT) * Math.PI * 2 + (r() - 0.5) * 0.6, x = cx + (r() - 0.5) * 18 * k, y = cy + (r() - 0.5) * 18 * k;
    const len = cs * (0.36 + r() * 0.1), steps = 12, pts: [number, number][] = [[x, y]];
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.22;
      x += (Math.cos(a) * len) / steps; y += (Math.sin(a) * len) / steps;
      pts.push([x, y]);
      if (s < 1) continue;
      const fade = 1 - (s / steps) * 0.35;
      for (const side of [-1, 1]) {
        if (r() < (olive ? 0.12 : 0.3)) continue;
        if (olive) {
          // narrow lanceolate leaves, dark grey-green above, a silvery underside showing on about a third
          const silver = r() < 0.32, v = 0.85 + r() * 0.3;
          const c = silver ? `rgb(${Math.round(150 * v)},${Math.round(160 * v)},${Math.round(134 * v)})` : `rgb(${Math.round(80 * v)},${Math.round(94 * v)},${Math.round(62 * v)})`;
          leaves.push({ x, y, a: a + side * (0.55 + r() * 0.45), L: (30 + r() * 12) * k * fade, W: (7 + r() * 2.5) * k, c, rib: null });
        } else {
          // ovate leaves with a pale midrib, mid to deep green, a few catching the light
          const v = 0.8 + r() * 0.35, hi = r() < 0.12;
          const c = hi ? `rgb(${Math.round(118 * v)},${Math.round(146 * v)},${Math.round(70 * v)})` : `rgb(${Math.round(58 * v)},${Math.round(92 * v)},${Math.round(40 * v)})`;
          leaves.push({ x, y, a: a + side * (0.65 + r() * 0.4), L: (26 + r() * 10) * k * fade, W: (19 + r() * 6) * k * fade, c, rib: `rgba(170,190,120,0.45)` });
        }
      }
    }
    twigs.push(pts);
  }
  // a few leaves at the middle so the sprig has a heart
  for (let i = 0; i < (olive ? 10 : 6); i++) {
    const a = r() * Math.PI * 2, v = 0.8 + r() * 0.3;
    leaves.push(olive
      ? { x: cx + (r() - 0.5) * 30 * k, y: cy + (r() - 0.5) * 30 * k, a, L: (28 + r() * 10) * k, W: 7 * k, c: `rgb(${Math.round(84 * v)},${Math.round(98 * v)},${Math.round(66 * v)})`, rib: null }
      : { x: cx + (r() - 0.5) * 30 * k, y: cy + (r() - 0.5) * 30 * k, a, L: (26 + r() * 8) * k, W: 20 * k, c: `rgb(${Math.round(54 * v)},${Math.round(86 * v)},${Math.round(38 * v)})`, rib: 'rgba(170,190,120,0.4)' });
  }
  // the twigs under the leaves
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pts of twigs) {
    g.strokeStyle = olive ? '#4b4335' : '#4a3d2c';
    g.lineWidth = 2.4 * k;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
  // leaves: a darker under-layer first (depth inside the sprig), then the rest in a shuffled order
  for (let i = leaves.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [leaves[i], leaves[j]] = [leaves[j], leaves[i]]; }
  const under = Math.floor(leaves.length * 0.3);
  for (let i = 0; i < leaves.length; i++) {
    const l = leaves[i];
    g.save(); g.translate(l.x, l.y); g.rotate(l.a);
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(l.L * 0.42, -l.W, l.L, 0);
    g.quadraticCurveTo(l.L * 0.42, l.W, 0, 0);
    g.fillStyle = l.c; g.fill();
    if (i < under) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fill(); }
    if (l.rib) { g.strokeStyle = l.rib; g.lineWidth = 0.9 * k; g.beginPath(); g.moveTo(l.L * 0.06, 0); g.lineTo(l.L * 0.86, 0); g.stroke(); }
    g.restore();
  }
  g.restore();
}

/** bark: grey, ridged and fissured along the limb (v runs along it); tinted per species by vertex colour */
export const barkTex = () => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#8a8378'; g.fillRect(0, 0, w, h);
  const r = rand(733);
  for (let i = 0; i < 9000; i++) { const a = r() * 0.16; g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,250,240,${a * 0.6})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 5); }
  // long fissures that wander and fork, dark in the groove with a light lip beside it
  for (let i = 0; i < 26; i++) {
    let x = r() * w, y = -20;
    const pts: [number, number][] = [[x, y]];
    while (y < h + 20) { y += 10 + r() * 18; x += (r() - 0.5) * 9; pts.push([x, y]); }
    for (const [dx, col, lw] of [[1.6, 'rgba(255,248,236,0.16)', 2.2], [0, 'rgba(28,24,20,0.7)', 1.4 + r() * 2.2]] as [number, string, number][]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      pts.forEach(([px, py], k) => (k ? g.lineTo(px + dx, py) : g.moveTo(px + dx, py)));
      g.stroke();
      // the texture wraps round the limb: draw the fissure again across the seam
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + dx - w, py) : g.moveTo(px + dx - w, py))); g.stroke();
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + dx + w, py) : g.moveTo(px + dx + w, py))); g.stroke();
    }
  }
}, { repeat: true });

// ------------------------------------------------------------------------------------------ growth
interface Limb { a: V3; b: V3; r0: number; r1: number; level: number }
interface Tip { p: V3; R: number }
interface Habit {
  /** the stems from the base: count, length, base radius, lean from vertical */
  stems: number; stemLen: number; stemR: number; lean: [number, number]; stemSegs: number; gnarl: number;
  /** per branching level: children, spread from the parent (radians), length, how much they turn back up */
  kids: number[]; spread: number[]; len: number[]; upBias: number[];
  /** the leaf clump at each twig's end, and the leaf cards' size and count per tier */
  clump: number; card: number; cards: { phone: number; high: number; ultra: number };
  /** which row of the leaf atlas, the bark's tint, the leaves' tint */
  row: 0 | 1; bark: number; leaf: [number, number, number];
}
const OLIVE: Habit = {
  stems: 3, stemLen: 1.15, stemR: 0.075, lean: [0.18, 0.45], stemSegs: 3, gnarl: 0.4,
  kids: [3, 2], spread: [0.62, 0.55], len: [0.8, 0.5], upBias: [0.22, 0.18],
  clump: 0.58, card: 0.6, cards: { phone: 150, high: 330, ultra: 620 },
  row: 0, bark: 0xa49c90, leaf: [1, 1, 1],
};
const SHADE: Habit = {
  stems: 1, stemLen: 2.5, stemR: 0.17, lean: [0, 0.06], stemSegs: 3, gnarl: 0.12,
  kids: [4, 3, 2], spread: [0.78, 0.55, 0.5], len: [1.75, 1.15, 0.62], upBias: [0.18, 0.2, 0.15],
  clump: 1.0, card: 0.9, cards: { phone: 260, high: 580, ultra: 1050 },
  row: 1, bark: 0x9c8f7e, leaf: [1, 1, 1],
};

/** a direction turned `angle` away from d, toward the azimuth `az` round it */
function spread(d: V3, angle: number, az: number): V3 {
  const u = Math.abs(d.y) < 0.95 ? V().crossVectors(d, UP).normalize() : V(1, 0, 0);
  const w = V().crossVectors(d, u).normalize();
  const axis = u.multiplyScalar(Math.cos(az)).addScaledVector(w, Math.sin(az));
  return d.clone().multiplyScalar(Math.cos(angle)).addScaledVector(axis, Math.sin(angle)).normalize();
}
const jitter = (d: V3, amt: number, r: () => number) => d.clone().add(V((r() - 0.5) * amt, (r() - 0.5) * amt * 0.5, (r() - 0.5) * amt)).normalize();

function grow(H: Habit, base: V3, k: number, r: () => number) {
  const limbs: Limb[] = [], tips: Tip[] = [];
  const kid = (p: V3, d: V3, rad: number, level: number) => {
    const n = H.kids[level], az0 = r() * Math.PI * 2;
    for (let c = 0; c < n; c++) {
      const az = az0 + (c / n) * Math.PI * 2 + (r() - 0.5) * 0.8;
      let nd = spread(d, H.spread[level] * (0.75 + r() * 0.5), az);
      nd = nd.lerp(UP, H.upBias[level]).normalize();
      const L = H.len[level] * (0.75 + r() * 0.5) * k, segs = level < H.kids.length - 1 ? 2 : 1;
      let q = p.clone(), rr = rad * (0.62 + r() * 0.1);
      for (let s = 0; s < segs; s++) {
        nd = jitter(nd, H.gnarl, r);
        const e = q.clone().addScaledVector(nd, L / segs), r1 = rr * 0.78;
        limbs.push({ a: q, b: e, r0: rr, r1, level: level + 1 });
        q = e; rr = r1;
      }
      if (level + 1 < H.kids.length) kid(q, nd, rr, level + 1);
      else tips.push({ p: q, R: H.clump * (0.8 + r() * 0.4) * k });
    }
  };
  for (let i = 0; i < H.stems; i++) {
    const az = (i / H.stems) * Math.PI * 2 + r() * 0.9, lean = H.lean[0] + r() * (H.lean[1] - H.lean[0]);
    let d = V(Math.sin(az) * Math.sin(lean), Math.cos(lean), Math.cos(az) * Math.sin(lean));
    let p = base.clone().add(V(Math.sin(az) * 0.05 * k * (H.stems > 1 ? 1 : 0), 0, Math.cos(az) * 0.05 * k * (H.stems > 1 ? 1 : 0)));
    let rad = H.stemR * k * (H.stems > 1 ? 0.85 + r() * 0.3 : 1);
    const L = H.stemLen * k * (H.stems > 1 ? 0.85 + r() * 0.3 : 1);
    for (let s = 0; s < H.stemSegs; s++) {
      d = jitter(d, H.gnarl, r);
      const q = p.clone().addScaledVector(d, L / H.stemSegs), r1 = rad * 0.9;
      limbs.push({ a: p, b: q, r0: rad, r1, level: 0 });
      p = q; rad = r1;
    }
    kid(p, d, rad, 0);
  }
  return { limbs, tips };
}

// ------------------------------------------------------------------------------------------ meshing
/** a tapered tube with UVs (u round it, v along it in metres / 0.7), its start pushed back a little into its parent */
function limbMesh(B: Batch, l: Limb, sides: number, hex: number) {
  const c = new THREE.Color(hex), d = l.b.clone().sub(l.a), len = d.length(); if (len < 1e-4) return;
  d.divideScalar(len);
  const a = l.a.clone().addScaledVector(d, -Math.min(l.r0, len * 0.3));
  const up = Math.abs(d.y) < 0.95 ? UP : V(1, 0, 0);
  const u = V().crossVectors(d, up).normalize(), w = V().crossVectors(d, u).normalize();
  const L = len + Math.min(l.r0, len * 0.3), turns = Math.max(1, Math.round((2 * Math.PI * l.r0) / 0.45));
  // the base of the tree is darker (soil splash, shade); limbs are lighter up in the crown
  const shadeA = l.level === 0 ? 0.78 : 0.92, shadeB = l.level === 0 ? 0.92 : 1;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
    const n0 = u.clone().multiplyScalar(Math.cos(a0)).addScaledVector(w, Math.sin(a0)), n1 = u.clone().multiplyScalar(Math.cos(a1)).addScaledVector(w, Math.sin(a1));
    const p0 = a.clone().addScaledVector(n0, l.r0), p1 = a.clone().addScaledVector(n1, l.r0);
    const p2 = l.b.clone().addScaledVector(n1, l.r1), p3 = l.b.clone().addScaledVector(n0, l.r1);
    const u0 = (i / sides) * turns, u1 = ((i + 1) / sides) * turns, v0 = 0, v1 = L / 0.7;
    const P = (p: V3, n: V3, uu: number, vv: number, s: number) => B.vert(p.x, p.y, p.z, n.x, n.y, n.z, c.r * s, c.g * s, c.b * s, uu, vv);
    P(p0, n0, u0, v0, shadeA); P(p3, n0, u0, v1, shadeB); P(p2, n1, u1, v1, shadeB);
    P(p0, n0, u0, v0, shadeA); P(p2, n1, u1, v1, shadeB); P(p1, n1, u1, v0, shadeA);
  }
}

/** the crown's leaf cards for one tree: scattered through the twig clumps, lit as one mass */
function crown(B: Batch, H: Habit, tips: Tip[], n: number, sizeK: number, r: () => number) {
  if (!tips.length) return;
  const centre = V(), lo = V(Infinity, Infinity, Infinity), hi = V(-Infinity, -Infinity, -Infinity);
  for (const t of tips) { centre.add(t.p); lo.min(t.p); hi.max(t.p); }
  centre.divideScalar(tips.length);
  let span = 0; for (const t of tips) span = Math.max(span, t.p.distanceTo(centre) + t.R);
  const weights = tips.map((t) => t.R * t.R), total = weights.reduce((a, b) => a + b, 0);
  const cellW = 0.25, v0 = H.row * 0.5;
  const rnd = () => { const v = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); return v.lengthSq() > 1e-4 ? v.normalize() : V(0, 1, 0); };
  for (let i = 0; i < n; i++) {
    // pick a clump by its size
    let x = r() * total, t = tips[0];
    for (let j = 0; j < tips.length; j++) { x -= weights[j]; if (x <= 0) { t = tips[j]; break; } }
    const dir = rnd(), dist = t.R * (0.4 + 0.6 * Math.sqrt(r()));
    const c = t.p.clone().add(V(dir.x * dist, dir.y * dist * 0.8, dir.z * dist));
    // the shading normal: out of the crown (tipped toward the sky), a little of the card's own
    const out = c.clone().sub(centre); out.y += span * 0.25; out.normalize();
    const nCard = out.clone().multiplyScalar(0.5).add(rnd().multiplyScalar(0.9)).normalize();
    const nShade = out.clone().multiplyScalar(0.8).addScaledVector(nCard, 0.2).normalize();
    const tA = Math.abs(nCard.y) < 0.9 ? V().crossVectors(nCard, UP).normalize() : V(1, 0, 0);
    const bA = V().crossVectors(nCard, tA).normalize();
    const rot = r() * Math.PI * 2, cs = Math.cos(rot), sn = Math.sin(rot);
    const T = tA.clone().multiplyScalar(cs).addScaledVector(bA, sn), Bv = tA.clone().multiplyScalar(-sn).addScaledVector(bA, cs);
    const h = (H.card * sizeK * (0.8 + r() * 0.4)) / 2;
    // occlusion: darker deep inside the crown and underneath it
    const rel = Math.min(1, c.distanceTo(centre) / Math.max(0.5, span)), hy = (c.y - lo.y) / Math.max(0.3, hi.y - lo.y + 1);
    const ao = (0.42 + 0.58 * Math.min(1, Math.max(0, (rel - 0.15) / 0.75))) * (0.72 + 0.28 * Math.min(1, Math.max(0, hy)));
    const tint = 0.9 + r() * 0.2, warm = (r() - 0.5) * 0.08;
    const cr = ao * tint * H.leaf[0] * (1 + warm), cg = ao * tint * H.leaf[1], cb = ao * tint * H.leaf[2] * (1 - warm);
    const cell = Math.floor(r() * 4), u0 = cell * cellW, u1 = u0 + cellW;
    const P = (sx: number, sy: number, uu: number, vv: number) => {
      const p = c.clone().addScaledVector(T, sx * h).addScaledVector(Bv, sy * h);
      B.vert(p.x, p.y, p.z, nShade.x, nShade.y, nShade.z, cr, cg, cb, uu, vv);
    };
    // canvas y runs down the atlas, texture v up: the cell's rows are v0..v0 + 0.5 from the bottom
    const vb = 1 - (v0 + 0.5), vt = 1 - v0;
    P(-1, -1, u0, vb); P(1, -1, u1, vb); P(1, 1, u1, vt);
    P(-1, -1, u0, vb); P(1, 1, u1, vt); P(-1, 1, u0, vt);
  }
}

/**
 * Build every olive and shade tree in the list into the kit: leaves and bark per detail tier ('phone-' on Low,
 * 'high-' on High, 'ultra-' on Ultra; the bark's 'hq-' batch on High and Ultra). Palms are skipped (the page instances
 * the game's own). Returns the triangle counts per tier, for the budgets.
 */
export function buildTrees(kit: Kit, mats: { leaves: THREE.Material; bark: THREE.Material }, trees: Tree[]) {
  const tiers = ['phone', 'high', 'ultra'] as const;
  const leaf = Object.fromEntries(tiers.map((t) => [t, kit.get(`${t}-leaves`, mats.leaves, { uv: 1, cast: true, ao: false })])) as Record<(typeof tiers)[number], Batch>;
  const barkHQ = kit.get('hq-bark', mats.bark, { uv: 1, cast: true, ao: false }), barkPhone = kit.get('phone-bark', mats.bark, { uv: 1, cast: true, ao: false });
  let seed = 61;
  for (const t of trees) {
    if (t.kind === 'palm') continue;
    const H = t.kind === 'olive' ? OLIVE : SHADE, k = t.kind === 'olive' ? t.s / 0.46 : t.s / 0.92;
    const g = grow(H, V(t.x, t.y - 0.05, t.z), k, rand(seed += 7));
    for (const l of g.limbs) {
      const twig = l.level >= H.kids.length;
      limbMesh(barkHQ, l, l.level === 0 ? 8 : twig ? 5 : 6, H.bark);
      if (!twig) limbMesh(barkPhone, l, l.level === 0 ? 6 : 5, H.bark);
    }
    // the same crown at three densities (fewer, larger cards on phones)
    crown(leaf.phone, H, g.tips, H.cards.phone, 1.3, rand(seed + 1));
    crown(leaf.high, H, g.tips, H.cards.high, 1.0, rand(seed + 2));
    crown(leaf.ultra, H, g.tips, H.cards.ultra, 0.85, rand(seed + 3));
  }
  const tris = (b: Batch) => b.vertices / 3;
  return { phone: tris(leaf.phone) + tris(barkPhone), high: tris(leaf.high) + tris(barkHQ), ultra: tris(leaf.ultra) + tris(barkHQ) };
}

/**
 * The leaves' material tweak (on top of the night glow): a card's back face keeps the crown's outward normal
 * (three.js flips it for double-sided materials, which lit the back of every card from the wrong side).
 */
export function leafShading(m: THREE.MeshStandardMaterial) {
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );\n\tnonPerturbedNormal = normal;');
  };
  m.customProgramCacheKey = () => 'lot57-glow-leaves';
  return m;
}

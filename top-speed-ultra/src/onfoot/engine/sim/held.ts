// Held items, table items and game pieces (PROJECT_OC_SPORTS_BAR.md, "Held items, table items and game pieces"): one
// InstancedMesh per item model, six in all, every instance's matrix set each frame from its holder's hand or its
// place, `count` the number in use. One model serves several items by its scale (a disc is a plate, a tray or a puck;
// a stick is a cue or a dart), and colour is per instance. frustumCulled = false on all six: three.js 0.160 computes an
// instanced mesh's bounding sphere once, from the instances in use when it's first tested, so a mesh first tested at
// count 0 would be culled for good; drawn whole every frame is what the sums count. They cast into the sun's map only
// (the page's per-light members; userData.maps = 1). Triangles per instance, by detail (Low; HD and Ultra), within the
// plan's rows: glass 19 and 40 (20, 40), basket 20 and 44 (24, 48), disc 16 and 31 (16, 32), ball 32 and 128, band
// 16 and 32, stick 12 and 24. Lit by the venue's baked night-light channels (engine/mats.ts glowify): the interior's.
import * as THREE from 'three';
import { glowify } from '../mats';

export type ItemModel = 'glass' | 'basket' | 'disc' | 'ball' | 'band' | 'stick';
export const MODELS: ItemModel[] = ['glass', 'basket', 'disc', 'ball', 'band', 'stick'];
export const CAPS: Record<ItemModel, number> = { glass: 132, basket: 40, disc: 54, ball: 32, band: 14, stick: 26 };
/** the plan's allocations: triangles per instance, Low and HD/Ultra */
export const ALLOC_TRIS: Record<ItemModel, [number, number]> = { glass: [20, 40], basket: [24, 48], disc: [16, 32], ball: [32, 128], band: [16, 32], stick: [12, 24] };

type Ring = { r: number; y: number; c: number };
/** a lathe from rings (bottom to top), N sides, open at the top, with an optional bottom cap; vertex colours */
function lathe(rings: Ring[], N: number, capBottom: boolean, capTop = false): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (const rg of rings) for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pos.push(Math.cos(a) * rg.r, rg.y, Math.sin(a) * rg.r); col.push(rg.c, rg.c, rg.c); }
  for (let j = 0; j + 1 < rings.length; j++) for (let i = 0; i < N; i++) {
    const a = j * N + i, b = j * N + ((i + 1) % N), c = (j + 1) * N + ((i + 1) % N), d = (j + 1) * N + i;
    idx.push(a, d, c, a, c, b);
  }
  const fan = (base: number, flip: boolean) => { for (let i = 1; i + 1 < N; i++) flip ? idx.push(base, base + i + 1, base + i) : idx.push(base, base + i, base + i + 1); };
  if (capBottom) fan(0, false);
  if (capTop) fan((rings.length - 1) * N, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** a merged pair of indexed geometries (same attributes) */
function merge(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = [...(a.attributes.position.array as Float32Array), ...(b.attributes.position.array as Float32Array)];
  const col = [...(a.attributes.color.array as Float32Array), ...(b.attributes.color.array as Float32Array)];
  const nrm = [...(a.attributes.normal.array as Float32Array), ...(b.attributes.normal.array as Float32Array)];
  const n = a.attributes.position.count, idx = [...(a.index!.array as ArrayLike<number> as number[]), ...Array.from(b.index!.array, (v) => v + n)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx); return g;
}
/** the six models at a detail level: 0 (Low) or 1 (HD and Ultra) */
export function itemGeometry(model: ItemModel, hi: boolean): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (model === 'glass') g = lathe([{ r: 0.031, y: 0, c: 0.62 }, { r: 0.04, y: 0.135, c: 1.15 }], hi ? 14 : 7, true);         // 3N - 2
  else if (model === 'basket') {
    // a paper boat (open, tapered) and the food heaped in it
    const N = hi ? 8 : 4;
    const boat = lathe([{ r: 0.075, y: 0, c: 0.62 }, { r: 0.1, y: 0.045, c: 0.72 }], N, true);
    const heap = lathe([{ r: 0.088, y: 0.03, c: 1 }, { r: 0.05, y: 0.075, c: 1 }], N, false, true);
    g = merge(boat, heap);
    if (!hi) g.rotateY(Math.PI / 4);
  } else if (model === 'disc') g = lathe([{ r: 1, y: 0, c: 0.86 }, { r: 1, y: 1, c: 1 }], hi ? 11 : 6, false, true);    // unit: scaled per use
  else if (model === 'ball') { g = new THREE.SphereGeometry(0.028, hi ? 16 : 8, hi ? 5 : 3); const n = g.attributes.position.count; g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3)); }
  else if (model === 'band') g = lathe([{ r: 0.0286, y: -0.0085, c: 1 }, { r: 0.0286, y: 0.0085, c: 1 }], hi ? 16 : 8, false);
  else g = lathe([{ r: 0.0065, y: 0, c: 0.9 }, { r: 0.004, y: 1, c: 1 }], hi ? 12 : 6, false);                              // unit length along +y
  // the interior's baked night-light channel (c), as the venue's own batches carry it
  const n = g.attributes.position.count, glow = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) glow[i * 3 + 2] = 1;
  g.setAttribute('glow', new THREE.BufferAttribute(glow, 3));
  g.computeBoundingSphere();
  return g;
}
export const trisOf = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

export class HeldItems {
  group = new THREE.Group();
  meshes = {} as Record<ItemModel, THREE.InstancedMesh>;
  private mat: THREE.MeshStandardMaterial;
  private n = {} as Record<ItemModel, number>;
  private m4 = new THREE.Matrix4(); private c = new THREE.Color();
  hi = false;
  constructor(hi: boolean) {
    this.group.name = 'items'; this.group.userData.group = 'items';
    this.mat = glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 }));
    this.build(hi);
  }
  private build(hi: boolean) {
    for (const k of MODELS) { const old = this.meshes[k]; if (old) { this.group.remove(old); old.geometry.dispose(); old.dispose(); } }
    this.hi = hi;
    for (const k of MODELS) {
      const im = new THREE.InstancedMesh(itemGeometry(k, hi), this.mat, CAPS[k]);
      im.name = 'items-' + k; im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      im.userData.cast = true; im.userData.maps = 1; im.userData.group = 'items';
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.setColorAt(0, this.c.set(0xffffff)); im.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      this.meshes[k] = im; this.group.add(im); this.n[k] = 0;
    }
  }
  /** Low uses the low-detail models; HD and Ultra the high ones (a switch rebuilds the six meshes) */
  setDetail(hi: boolean) { if (hi !== this.hi) this.build(hi); }
  begin() { for (const k of MODELS) this.n[k] = 0; }
  /** one instance this frame (false if the model's cap is reached) */
  put(model: ItemModel, m: THREE.Matrix4, color: number | THREE.Color) {
    const i = this.n[model]; if (i >= CAPS[model]) return false;
    const im = this.meshes[model];
    im.setMatrixAt(i, m); im.setColorAt(i, typeof color === 'number' ? this.c.set(color) : color);
    this.n[model] = i + 1; return true;
  }
  /** an instance from a position, a yaw and a scale */
  putAt(model: ItemModel, x: number, y: number, z: number, yaw: number, s: number | THREE.Vector3, color: number | THREE.Color) {
    const q = _q.setFromAxisAngle(_y, yaw), sc = typeof s === 'number' ? _s.set(s, s, s) : s;
    return this.put(model, this.m4.compose(_p.set(x, y, z), q, sc), color);
  }
  end() {
    for (const k of MODELS) { const im = this.meshes[k]; im.count = this.n[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  /** the instances placed so far this frame (after end(), what's drawn) */
  counts() { return Object.fromEntries(MODELS.map((k) => [k, this.n[k] ?? this.meshes[k].count])) as Record<ItemModel, number>; }
  /** triangles per instance of each model as built */
  perInstance() { return Object.fromEntries(MODELS.map((k) => [k, trisOf(this.meshes[k].geometry)])) as Record<ItemModel, number>; }
}
const _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _s = new THREE.Vector3(), _p = new THREE.Vector3();

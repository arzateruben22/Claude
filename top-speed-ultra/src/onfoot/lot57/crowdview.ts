// How the crowd is drawn inside the phone and desktop budgets (PROJECT_OC_ON_FOOT.md, "Level of detail" and "Phone
// performance budgets"). Every person is the people builder's own skinned body (src/onfoot/people, used through its
// exports only), one draw call each, so 40 people can't all be bodies on a phone: the plan allows 16 draw calls for
// every NPC on Low and 24 on High, inside 150 and 350 for the whole scene, and 250k and 700k triangles.
//
// So each frame, nearest first, a person is drawn as one of:
//   - the close-up body (LOD 0; Ultra only, the regular who talks to you),
//   - the patio body (LOD 1: built in a worker, lot57/crowd-worker.ts, so the page never stalls on it),
//   - the far body (LOD 2: built at load),
//   - a flat impostor: a card that turns to face you, painted at load from that same person's own body from eight
//     sides, standing and (for people who sit) sitting. Every impostor is one instanced draw call together.
// ...or not at all when they're out of view or a wall, a building or a truck's body is between you and them.
// What fits is worked out from what the rest of the scene drew in the last frame: the triangles and calls left
// under the preset's budget go to the nearest people first. Every person drawn has a soft contact shadow under them
// (one instanced draw call for all of them); on High the nearest few also cast the sun's shadow.
import * as THREE from 'three';
import type { Person, PersonOptions } from '../people';
import { lodMaterial } from '../people/lod';
import type { BuildDone, BuildJob } from './crowd-worker';

/** how the page starts a build worker (main.ts: its own script again); none, and the patio bodies are built here */
let workerFactory: (() => Worker) | null = null;
export function useWorkers(f: (() => Worker) | null) { workerFactory = f; }

export type Rep = 'off' | 'imp' | 'm2' | 'm1' | 'm0';
export type Tier = 'low' | 'high' | 'ultra';

/** what the view reads and writes on a person (lot57/npcs.ts Npc has all of these) */
export interface ViewNpc {
  id: number; p: Person; opts: PersonOptions;
  x: number; y: number; z: number; ox: number; oz: number; heading: number;
  shown: boolean; pose: 'stand' | 'sit'; canSit: boolean; closeUp: boolean;
  rep: Rep; dist: number;
  /** the patio body (from the worker), the far body's group, their triangles */
  m1: THREE.SkinnedMesh | null; g2: THREE.Object3D | null; tris1: number; tris2: number;
  /** the impostor's first atlas cell standing and sitting (-1: none) and which body it was painted from */
  cells: [number, number]; paintedFrom: 1 | 2;
  held: THREE.Group | null; heldOn: boolean; heldCalls: number; heldTris: number;
  shadow: boolean;
  /** hidden by a wall (refreshed a few times a second) */
  occl: boolean; occlK: number;
  /** the point the wall test aims at (staff stand inside their counter's collider: their customer side) */
  seeX: number | null;
}

export const TIER: Record<Tier, { calls: number; tris: number; npcCalls: number; meshCap: number; shadowCap: number; shadowDist: number; impDist: number; l1: number; hold: number; margin: number; cell: [number, number] }> = {
  // phones: the plan's Low budget (150 calls, 250k triangles; 16 calls for all NPCs)
  low: { calls: 150, tris: 250000, npcCalls: 16, meshCap: 13, shadowCap: 0, shadowDist: 0, impDist: 16, l1: 12, hold: 10, margin: 5000, cell: [44, 78] },
  // desktop: the plan's High budget (350 calls, 700k triangles; 24 calls for all NPCs, shadow passes included)
  high: { calls: 350, tris: 700000, npcCalls: 24, meshCap: 18, shadowCap: 4, shadowDist: 14, impDist: 34, l1: 18, hold: 18, margin: 10000, cell: [64, 112] },
  // Ultra has no budget in the plan: everyone near is a body, the nearest dozen cast the sun's shadow
  ultra: { calls: Infinity, tris: Infinity, npcCalls: Infinity, meshCap: 64, shadowCap: 14, shadowDist: 26, impDist: 75, l1: 24, hold: 45, margin: 0, cell: [72, 126] },
};
/** the impostor card: 1.24 m wide, from 6 cm below the feet to 2.12 m up */
const CARD = { w: 1.24, y0: -0.06, h: 2.18 };
const ANGLES = 8;

// ------------------------------------------------------------------------------------------ the build workers
/** a small pool of workers that build patio bodies, nearest first; shared by every crowd the page makes */
class BuildPool {
  private workers: Worker[] = [];
  private busy: boolean[] = [];
  private queue: BuildJob[] = [];
  private prio = new Map<number, number>();
  private jobN = 0;
  failed = false;
  /** why the workers aren't in use (for the hooks) */
  why = '';
  onDone: (d: BuildDone) => void = () => {};
  constructor(n: number) {
    try {
      if (!workerFactory) throw new Error('no workers');
      for (let i = 0; i < n; i++) {
        const w = workerFactory();
        w.onmessage = (e: MessageEvent<BuildDone>) => { this.busy[i] = false; this.onDone(e.data); this.kick(); };
        w.onerror = (e) => { this.busy[i] = false; this.failed = true; this.why = 'worker error: ' + (e.message || 'no message'); this.kick(); };
        this.workers.push(w); this.busy.push(false);
      }
    } catch (e) { this.failed = true; this.workers = []; this.why = String((e as Error)?.message ?? e); }
  }
  get ok() { return this.workers.length > 0 && !this.failed; }
  get pending() { return this.queue.length + this.busy.filter(Boolean).length; }
  add(gen: number, id: number, opts: PersonOptions, priority: number) {
    const job: BuildJob = { job: ++this.jobN, gen, id, opts, lod: 1 };
    this.prio.set(job.job, priority);
    this.queue.push(job);
    this.kick();
  }
  /** nearest first: the page re-ranks the waiting jobs as you move */
  rank(f: (gen: number, id: number) => number) { for (const j of this.queue) this.prio.set(j.job, f(j.gen, j.id)); }
  drop(gen: number) { this.queue = this.queue.filter((j) => j.gen !== gen); }
  private kick() {
    for (let i = 0; i < this.workers.length; i++) {
      if (this.busy[i] || !this.queue.length) continue;
      let bi = 0;
      for (let k = 1; k < this.queue.length; k++) if ((this.prio.get(this.queue[k].job) ?? 0) < (this.prio.get(this.queue[bi].job) ?? 0)) bi = k;
      const job = this.queue.splice(bi, 1)[0];
      this.busy[i] = true;
      this.workers[i].postMessage(job);
    }
  }
}
let pool: BuildPool | null = null;
const getPool = () => (pool ??= new BuildPool(Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 2))));

// ------------------------------------------------------------------------------------------ the impostor shader
const IMP_VS = /* glsl */ `
attribute vec3 iPos; attribute float iHead; attribute float iCell; attribute vec3 iTint;
uniform vec2 uCells; uniform vec3 uCard;
varying vec2 vUv; varying vec3 vTint;
#include <fog_pars_vertex>
void main() {
  vec3 toCam = cameraPosition - iPos;
  vec2 d = normalize(toCam.xz + vec2(1e-5, 0.0));
  float rel = atan(d.x, d.y) - iHead;
  float a = mod(floor(rel / 6.2831853 * ${ANGLES}.0 + 0.5), ${ANGLES}.0);
  float cell = iCell + a;
  vec3 right = vec3(d.y, 0.0, -d.x);
  vec3 p = iPos + right * (position.x * uCard.x) + vec3(0.0, uCard.y + position.y * uCard.z, 0.0);
  float col = mod(cell, uCells.x), row = floor(cell / uCells.x);
  vUv = (vec2(col, row) + uv) / uCells;
  vTint = iTint;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const IMP_FS = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec3 vTint;
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  if (c.a < 0.45) discard;
  gl_FragColor = vec4(c.rgb / max(c.a, 0.45) * vTint, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** a soft round contact shadow (a canvas gradient, 64 px) */
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** draw nothing when the scene is drawn with an override material (count 0 for that draw, restored after it) */
function skipOverrides(m: THREE.Mesh, get: () => number, set: (k: number) => void) {
  let saved = -1;
  m.onBeforeRender = (_r, _s, _c, _g, mat) => { if (mat !== m.material) { saved = get(); set(0); } };
  m.onAfterRender = () => { if (saved >= 0) { set(saved); saved = -1; } };
}

export interface ViewStats { workerMs: number[]; starved: number; meshes: number; lod0: number; lod1: number; lod2: number; imps: number; blobs: number; shadows: number; held: number; npcTris: number; npcCalls: number; venueTris: number; venueCalls: number; lod1Built: number; lod1Pending: number; paintMs: number; atlas: [number, number] }

export class PeopleView {
  readonly root = new THREE.Group();
  T: (typeof TIER)[Tier];
  private rt: THREE.WebGLRenderTarget;
  private cols: number; private rows: number; private cw: number; private ch: number; private nextCell = 0;
  private cap: { scene: THREE.Scene; cam: THREE.OrthographicCamera };
  private imp: THREE.Mesh; private impGeo: THREE.InstancedBufferGeometry;
  private iPos: THREE.InstancedBufferAttribute; private iHead: THREE.InstancedBufferAttribute; private iCell: THREE.InstancedBufferAttribute; private iTint: THREE.InstancedBufferAttribute;
  private blobs: THREE.InstancedMesh;
  private gen: number;
  private byId = new Map<number, ViewNpc>();
  private recap: ViewNpc[] = [];
  private lod1Mats: THREE.Material[] = [];
  private frustum = new THREE.Frustum(); private pm = new THREE.Matrix4(); private sphere = new THREE.Sphere();
  private cands: ViewNpc[] = [];
  private camAt = new THREE.Vector3(Infinity, 0, 0); private frameK = 0;
  private _m = new THREE.Matrix4(); private _c = new THREE.Color();
  stats: ViewStats = { workerMs: [], starved: 0, meshes: 0, lod0: 0, lod1: 0, lod2: 0, imps: 0, blobs: 0, shadows: 0, held: 0, npcTris: 0, npcCalls: 0, venueTris: 0, venueCalls: 0, lod1Built: 0, lod1Pending: 0, paintMs: 0, atlas: [0, 0] };
  /** worker builds that came back broken (the page falls back to building on the main thread, slowly) */
  errors: string[] = [];
  /** the light on a person at (x, z): the page's day, night and string-light levels (impostors carry no lighting) */
  light: (x: number, z: number, out: THREE.Color) => THREE.Color = (_x, _z, o) => o.setRGB(1, 1, 1);
  /** a wall, a building or a truck between two ground points */
  occluded: ((ax: number, az: number, bx: number, bz: number) => boolean) | null = null;
  private static gens = 0;

  /** a preset switch that keeps the same people (High and Ultra): the budget changes, the atlas stays */
  setTier(t: Tier) { this.tier = t; this.T = { ...TIER[t], cell: this.T.cell }; }
  constructor(private renderer: THREE.WebGLRenderer, public tier: Tier, cells: number) {
    this.T = TIER[tier];
    this.gen = ++PeopleView.gens;
    this.root.name = 'crowd-view';
    // the atlas: as many 8-angle cells as the crowd needs, in rows under the GPU's size limit
    [this.cw, this.ch] = this.T.cell;
    const maxW = Math.min(2048, renderer.capabilities.maxTextureSize);
    this.cols = Math.floor(maxW / this.cw); this.rows = Math.max(1, Math.ceil(cells / this.cols));
    this.rt = new THREE.WebGLRenderTarget(this.cols * this.cw, this.rows * this.ch, { depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    this.rt.texture.name = 'crowd-impostors';
    this.stats.atlas = [this.rt.width, this.rt.height];
    // the painting set: an orthographic camera on the card, a sky-and-ground fill and a key light from the front
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xf4eee6, 0x5a5048, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(0.6, 1.4, 1.6); scene.add(key);
    const cam = new THREE.OrthographicCamera(-CARD.w / 2, CARD.w / 2, CARD.y0 + CARD.h, CARD.y0, 0.1, 20);
    cam.position.set(0, 0, 6); cam.lookAt(0, 0, 0);
    this.cap = { scene, cam };
    // one instanced card for every impostor
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const N = 64;
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); this.iHead = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.iCell = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); this.iTint = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    for (const a of [this.iPos, this.iHead, this.iCell, this.iTint]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iHead', this.iHead); g.setAttribute('iCell', this.iCell); g.setAttribute('iTint', this.iTint);
    g.instanceCount = 0;
    this.impGeo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: null }, uCells: { value: new THREE.Vector2(this.cols, this.rows) }, uCard: { value: new THREE.Vector3(CARD.w, CARD.y0, CARD.h) } }]),
      vertexShader: IMP_VS, fragmentShader: IMP_FS, fog: true,
    });
    mat.uniforms.uAtlas.value = this.rt.texture;
    this.imp = new THREE.Mesh(g, mat); this.imp.name = 'crowd-impostors'; this.imp.frustumCulled = false;
    this.root.add(this.imp);
    // one instanced soft shadow under every person drawn
    const bg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const bm = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.blobs = new THREE.InstancedMesh(bg, bm, N); this.blobs.name = 'crowd-blobs'; this.blobs.count = 0; this.blobs.frustumCulled = false; this.blobs.renderOrder = 2;
    this.root.add(this.blobs);
    // (a pass that draws the scene with one material of its own, such as Ultra's ambient occlusion, would draw the
    // cards as one bare square at the origin and the soft shadows as opaque tiles: both sit those passes out)
    skipOverrides(this.imp, () => this.impGeo.instanceCount, (k) => { this.impGeo.instanceCount = k; });
    skipOverrides(this.blobs, () => this.blobs.count, (k) => { this.blobs.count = k; });
    getPool().onDone = (d) => this.done(d);
  }

  // ------------------------------------------------------------------------------------------ people in, bodies back
  /** a person joins the view: the far body is theirs already; paint their impostor now and order the patio body */
  add(n: ViewNpc, priority: number) {
    this.byId.set(n.id, n);
    n.g2 = n.p.group.getObjectByName('lod2')?.parent ?? null;
    n.tris2 = n.p.stats().tris;
    n.cells = [this.alloc(), n.canSit ? this.alloc() : -1];
    this.paint(n);
    const P = getPool();
    if (P.ok) P.add(this.gen, n.id, n.opts, priority);
    else this.recap.push(n);
  }
  private alloc() { const c = this.nextCell; this.nextCell += ANGLES; return c; }
  /** re-rank the patio bodies still to build: the nearest to you first */
  rank(px: number, pz: number) { getPool().rank((gen, id) => { const n = gen === this.gen ? this.byId.get(id) : null; return n ? Math.hypot(n.x - px, n.z - pz) - (n.shown ? 1000 : 0) : 1e9; }); }
  get lod1Pending() { return getPool().pending + this.recap.length; }
  /** for comparison shots: everyone in view as impostors, or as bodies (no budget), or as the budget decides */
  force: 'auto' | 'imp' | 'body' = 'auto';
  get workers() { const P = getPool(); return P.ok ? 'ok' : P.why || 'none'; }
  private done(d: BuildDone) {
    if (d.gen !== this.gen) return;
    this.stats.workerMs.push(d.ms);
    const n = this.byId.get(d.id); if (!n) return;
    if (d.error || !d.attrs.length) { this.errors.push(d.error ?? 'empty'); this.recap.push(n); return; }
    const g = new THREE.BufferGeometry();
    for (const a of d.attrs) {
      const attr = a.name === 'skinIndex' ? new THREE.Uint16BufferAttribute(a.array as Uint16Array, a.size) : new THREE.BufferAttribute(a.array, a.size);
      g.setAttribute(a.name, attr);
    }
    if (d.index) g.setIndex(new THREE.BufferAttribute(d.index, 1));
    g.computeBoundingSphere();
    this.attachLod1(n, g);
  }
  private attachLod1(n: ViewNpc, g: THREE.BufferGeometry) {
    const src = n.p.group.getObjectByName('lod2') as THREE.SkinnedMesh | undefined;
    if (!src?.skeleton) return;
    const mat = lodMaterial(); this.lod1Mats.push(mat);
    const m = new THREE.SkinnedMesh(g, mat);
    m.name = 'lod1-view'; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
    const holder = new THREE.Group(); holder.name = 'lod1-view-group'; holder.visible = false; holder.add(m);
    n.p.group.add(holder);
    m.bind(src.skeleton, new THREE.Matrix4());
    n.m1 = m; n.tris1 = (g.index ? g.index.count : g.attributes.position.count) / 3;
    this.stats.lod1Built++;
    // the impostor again, from the finer body
    this.recapQ.push(n);
  }
  private recapQ: ViewNpc[] = [];
  /** once a frame: paint a waiting impostor or two from the patio bodies; with no worker, build one body here */
  pump() {
    const t0 = performance.now();
    // (one person a frame: a repaint is 8 or 16 small renders)
    if (this.recapQ.length) { const n = this.recapQ.shift()!; if (this.byId.has(n.id)) this.paint(n); }
    // (no worker: the builder's own LOD 1 on the main thread, one person now and then; it stalls the page for about
    // a second each, so this is the fallback only)
    if (this.recap.length && this.frameK % 45 === 0) {
      const n = this.recap.shift()!;
      if (this.byId.has(n.id) && !n.m1) {
        n.p.setLod(1); const m = n.p.group.getObjectByName('lod1') as THREE.SkinnedMesh | undefined; n.p.setLod(2);
        if (m) { const holder = m.parent!; holder.visible = false; holder.name = 'lod1-view-group'; m.name = 'lod1-view'; n.m1 = m; n.tris1 = (m.geometry.index ? m.geometry.index.count : 0) / 3; this.stats.lod1Built++; this.recapQ.push(n); }
      }
    }
    this.stats.lod1Pending = this.lod1Pending + this.recap.length;
    if (this.recapQ.length === 0 && this.dirtyMips) this.finishMips();
    this.stats.paintMs += performance.now() - t0;
  }

  // ------------------------------------------------------------------------------------------ painting impostors
  private dirtyMips = false;
  /** paint a person's impostor cells: standing (and sitting) from eight sides, from their finest coarse body */
  paint(n: ViewNpc) {
    const t0 = performance.now();
    const p = n.p, g = p.group, parent = g.parent;
    const pos = g.position.clone(), rot = g.rotation.y, vis = g.visible;
    const r = this.renderer, oldRT = r.getRenderTarget(), oldAuto = r.autoClear, oldCol = r.getClearColor(this._c).getHex(), oldA = r.getClearAlpha();
    const shadowOn = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    // which body: the patio one if it's built, else the far one
    const use1 = !!n.m1;
    const h1 = n.m1?.parent ?? null, h0 = this.lod0Of(n);
    if (n.g2) n.g2.visible = !use1; if (h1) h1.visible = use1; if (h0) h0.visible = false;
    this.cap.scene.add(g);
    g.position.set(0, 0, 0); g.visible = true;
    r.autoClear = false; r.setClearColor(0x000000, 0);
    this.rt.texture.generateMipmaps = false;
    for (const pose of ['stand', 'sit'] as const) {
      const base = n.cells[pose === 'stand' ? 0 : 1]; if (base < 0) continue;
      p.lookAt(null); p.play(pose === 'sit' ? 'sit' : 'idle');
      for (let k = 0; k < 4; k++) p.update(0.25);
      for (let a = 0; a < ANGLES; a++) {
        g.rotation.y = -(a / ANGLES) * Math.PI * 2;
        const cell = base + a, cx = (cell % this.cols) * this.cw, cy = Math.floor(cell / this.cols) * this.ch;
        this.rt.viewport.set(cx, cy, this.cw, this.ch); this.rt.scissor.set(cx, cy, this.cw, this.ch); this.rt.scissorTest = true;
        r.setRenderTarget(this.rt); r.clear(true, true, false);
        r.render(this.cap.scene, this.cap.cam);
      }
    }
    this.rt.scissorTest = false;
    r.setRenderTarget(oldRT); r.autoClear = oldAuto; r.setClearColor(oldCol, oldA); r.shadowMap.enabled = shadowOn;
    // back where they were, in their own pose (the page sets their animation again next frame)
    if (parent) parent.add(g);
    g.position.copy(pos); g.rotation.y = rot; g.visible = vis;
    p.play(n.pose === 'sit' ? 'sit' : 'idle');
    n.paintedFrom = use1 ? 1 : 2;
    n.rep = 'off';        // the next allot sets the bodies' visibility again
    this.dirtyMips = true;
    this.stats.paintMs += performance.now() - t0;
  }
  /** after a batch of painting: the atlas's mipmaps once (painting each cell with them on would rebuild them each time) */
  finishMips() {
    const r = this.renderer, old = r.getRenderTarget(), oldAuto = r.autoClear;
    this.rt.texture.generateMipmaps = true;
    this.rt.viewport.set(0, 0, 1, 1); this.rt.scissor.set(0, 0, 1, 1); this.rt.scissorTest = true;
    r.autoClear = false; r.setRenderTarget(this.rt); r.render(new THREE.Scene(), this.cap.cam);
    this.rt.scissorTest = false; r.setRenderTarget(old); r.autoClear = oldAuto;
    this.dirtyMips = false;
  }
  private lod0Of(n: ViewNpc) { let g: THREE.Object3D | null = null; n.p.group.traverse((o) => { if (!g && o.name === 'lod0') g = o; }); return g ? ((g as THREE.Object3D).parent ?? null) : null; }

  // ------------------------------------------------------------------------------------------ the frame
  /**
   * Choose how each person is drawn this frame, nearest first, inside what the rest of the scene left of the budget
   * in the last frame (`total` is the last frame's renderer.info, every pass included), then write the impostors and
   * the shadows. `force` re-tests every wall now (after a jump of the camera).
   */
  allot(npcs: ViewNpc[], camera: THREE.Camera, total: { calls: number; tris: number }, closeRange: number) {
    const T = this.T, S = this.stats;
    this.frameK++;
    S.venueTris = Math.max(0, total.tris - S.npcTris); S.venueCalls = Math.max(0, total.calls - S.npcCalls);
    let triLeft = T.tris - T.margin - S.venueTris;
    // (two calls kept for the impostors and the shadows)
    let callLeft = Math.min(T.npcCalls, T.calls - 2 - S.venueCalls) - 2;
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm);
    const cp = camera.position, jump = cp.distanceTo(this.camAt) > 1.5;
    if (jump) this.camAt.copy(cp);
    const C = this.cands; C.length = 0;
    for (const n of npcs) {
      n.heldOn = false; n.shadow = false;
      if (!n.shown) { this.setRep(n, 'off'); continue; }
      const x = n.x + n.ox, z = n.z + n.oz;
      n.dist = Math.hypot(x - cp.x, z - cp.z);
      this.sphere.center.set(x, n.y + 0.95, z); this.sphere.radius = 1.15;
      if (!this.frustum.intersectsSphere(this.sphere)) { this.setRep(n, 'off'); continue; }
      // the wall test: every person a few times a second, all of them after a jump
      if (this.occluded && (jump || (n.occlK++ % 5) === 0)) n.occl = this.occluded(cp.x, cp.z, n.seeX ?? x, z);
      if (n.occl) { this.setRep(n, 'off'); continue; }
      C.push(n);
    }
    C.sort((a, b) => a.dist - b.dist);
    // (starved: the triangles people near you wanted for their bodies and didn't get; the page makes room next frame
    // by drawing fewer parked cars in detail)
    let meshes = 0, shadows = 0, l0 = 0, l1 = 0, l2 = 0, imps = 0, held = 0, heldCalls = 0, tris = 0, starved = 0;
    for (const n of C) {
      let rep: Rep = 'imp';
      const keep = n.rep === 'm1' || n.rep === 'm2' ? 2 : 0;          // a little hysteresis at the impostor line
      if (this.force === 'imp') rep = 'imp';
      else if (this.force === 'body') rep = n.m1 && n.dist < T.l1 ? 'm1' : 'm2';
      else if (n.closeUp && this.tier === 'ultra' && n.dist < closeRange) rep = 'm0';
      else if (meshes < T.meshCap && callLeft >= 1 && n.dist < T.impDist + keep) {
        const sh = shadows < T.shadowCap && n.dist < T.shadowDist;
        const c1 = n.m1 && n.dist < T.l1 + (n.rep === 'm1' ? 1 : 0) ? n.tris1 * (sh ? 2 : 1) : Infinity;
        if (c1 <= triLeft && callLeft >= (sh ? 2 : 1)) { rep = 'm1'; n.shadow = sh; }
        else if (n.tris2 <= triLeft) { rep = 'm2'; if (c1 < Infinity) starved += n.tris1 - n.tris2; }
        else starved += c1 < Infinity ? n.tris1 : n.tris2;
      }
      this.setRep(n, rep);
      if (rep === 'm0') { const s = n.p.stats(); triLeft -= s.tris; callLeft -= s.calls; tris += s.tris; meshes++; l0++; }
      else if (rep === 'm1') { const c = n.tris1 * (n.shadow ? 2 : 1); triLeft -= c; tris += c; callLeft -= n.shadow ? 2 : 1; meshes++; l1++; if (n.shadow) shadows++; }
      else if (rep === 'm2') { triLeft -= n.tris2; tris += n.tris2; callLeft -= 1; meshes++; l2++; }
      else imps++;
      if (n.m1) n.m1.castShadow = n.shadow;
    }
    // what they hold, for the nearest bodies, with what's left
    for (const n of C) {
      if (!n.held || (n.rep !== 'm0' && n.rep !== 'm1' && n.rep !== 'm2') || n.dist > T.hold) continue;
      if (callLeft < n.heldCalls || triLeft < n.heldTris) continue;
      n.heldOn = true; callLeft -= n.heldCalls; triLeft -= n.heldTris; tris += n.heldTris; held++; heldCalls += n.heldCalls;
    }
    for (const n of npcs) if (n.held) n.held.visible = n.heldOn;
    // the impostors and the shadows
    let k = 0, b = 0;
    for (const n of C) {
      const x = n.x + n.ox, z = n.z + n.oz;
      if (n.rep === 'imp' && k < this.iHead.count) {
        this.iPos.setXYZ(k, x, n.y, z); this.iHead.setX(k, n.heading); this.iCell.setX(k, n.cells[n.pose === 'sit' && n.cells[1] >= 0 ? 1 : 0]);
        this.light(x, z, this._c); this.iTint.setXYZ(k, this._c.r, this._c.g, this._c.b); k++;
      }
      if (b < this.blobs.instanceMatrix.count) {
        const s = n.pose === 'sit' ? 0.95 : 0.8;
        this._m.makeScale(s, 1, s).setPosition(x, Math.max(0, n.pose === 'sit' ? 0 : n.y) + 0.035, z);
        this.blobs.setMatrixAt(b++, this._m);
      }
    }
    this.impGeo.instanceCount = k;
    for (const a of [this.iPos, this.iHead, this.iCell, this.iTint]) a.needsUpdate = true;
    this.imp.visible = k > 0;
    this.blobs.count = b; this.blobs.instanceMatrix.needsUpdate = true; this.blobs.visible = b > 0;
    S.starved = this.force === 'auto' ? starved : 0;
    S.meshes = meshes; S.lod0 = l0; S.lod1 = l1; S.lod2 = l2; S.imps = imps; S.blobs = b; S.shadows = shadows; S.held = held;
    S.npcTris = Math.round(tris + k * 2 + b * 2);
    S.npcCalls = meshes + shadows + heldCalls + (k ? 1 : 0) + (b ? 1 : 0);
    // (an Ultra close-up body draws in more than one call)
    if (l0) S.npcCalls += C.filter((n) => n.rep === 'm0').reduce((s, n) => s + n.p.stats().calls - 1, 0);
  }
  /** show the body that matches a person's choice (only on change) */
  private setRep(n: ViewNpc, rep: Rep) {
    if (rep === n.rep) return;
    const was = n.rep; n.rep = rep;
    const g = n.p.group, h1 = n.m1?.parent ?? null;
    if (rep === 'off' || rep === 'imp') { g.visible = false; return; }
    g.visible = true;
    if (rep === 'm0') { n.p.setLod(0); if (h1) h1.visible = false; return; }
    if (was === 'm0') n.p.setLod(2);
    if (n.g2) n.g2.visible = rep === 'm2';
    if (h1) h1.visible = rep === 'm1';
  }
  /** the triangles a person is drawn with now (their body; impostors 2) */
  trisOf(n: ViewNpc) { return n.rep === 'm1' ? n.tris1 : n.rep === 'm2' ? n.tris2 : n.rep === 'm0' ? n.p.stats().tris : n.rep === 'imp' ? 2 : 0; }

  dispose() {
    getPool().drop(this.gen);
    this.rt.dispose(); this.impGeo.dispose(); (this.imp.material as THREE.Material).dispose();
    this.blobs.geometry.dispose(); (this.blobs.material as THREE.MeshBasicMaterial).map?.dispose(); (this.blobs.material as THREE.Material).dispose();
    for (const n of this.byId.values()) if (n.m1 && n.m1.name === 'lod1-view') n.m1.geometry.dispose();
    for (const m of this.lod1Mats) m.dispose();
    this.byId.clear();
  }
}

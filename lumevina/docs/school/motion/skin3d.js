// skin3d.js — human skin for the solid scenes. render.mjs pastes this after studio3d.js and turns
// every `new THREE.InstancedMesh(` in a scene into `skinOrInstanced(`.
//
// The scenes model skin as a grid of cells (a block of 16 × 14 × 9 cubes, coloured by layer, with
// a pore cut through it; some scenes add a row of top cells or a layer of dead-cell plates) and
// animate them one by one: a cell reddens, rises, shrinks, climbs and sheds. That grid stays
// exactly as written. What changes is the picture: instead of a block of separate toy cubes, the
// cells become one piece of living tissue, a marching-cubes surface over a soft field built from
// the cells, so a rising cell is a swelling, a shrinking one a dimple, the missing cells a round
// follicle, and the block's edges and corners are rounded like a cut through flesh. The surface
// is shaded as skin: the cells' own colours (sampled through a 3D texture, so the layers blend and
// the dermal–epidermal junction undulates), the skin's fine polygonal line network and pores on
// the surface, collagen fibres on the dermis band of the cut, fat lobules below, a dewy sheen.
//
// A scene's InstancedMesh calls keep working on the stand-in (setMatrixAt, setColorAt,
// instanceMatrix.needsUpdate = true, castShadow…): they write into the field, and the surface is
// rebuilt before the next draw when something moved or changed colour. Everything stays a pure
// function of time.

import { marchingCubesClass } from "../metaballs.js";

const SKIN = (window.SKIN = { sets: [], tissue: null, opts: Object.assign({ res: 0.25, margin: 0.5, bump: 1, undulation: 0.16, top: 0.88 }, window.SKIN_OPTS || {}) });

// a box geometry's size (a SoftBox has no `parameters`; its bounding box says)
const skinSizeOf = (geo) => {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
};
const about = (a, b, e = 0.06) => Math.abs(a - b) < e;

// the cells of the skin block (0.96 cubes) and its top row (the same cubes) become tissue; everything
// else (the dead-cell plates that flake off in 4-2, oil seams, drops, foam) stays instanced
function skinOrInstanced(geo, mat, count) {
  const [w, h, d] = skinSizeOf(geo);
  const cellLike = count >= 60 && about(w, 0.96) && about(d, 0.96) && about(h, 0.96);
  if (cellLike) return new SkinCells(count, [w, h, d]);
  // the dead-cell plates (4-2) become loose scales: flat, rounded, a little irregular, the way skin flakes
  if (count >= 60 && about(w, 0.92) && about(h, 0.34)) { const g = new THREE.SphereGeometry(0.5, 16, 10); g.scale(w * 1.04, h, d * 1.04); return new THREE.InstancedMesh(g, mat, count); }
  return new THREE.InstancedMesh(geo, mat, count);
}

// the stand-in for one InstancedMesh of cells
class SkinCells extends THREE.Group {
  constructor(count, size) {
    super();
    this.isSkinCells = true;
    this.count = count; this.size = size;
    this.pos = new Float32Array(count * 3); this.scl = new Float32Array(count * 3).fill(1);
    this.col = new Float32Array(count * 3).fill(1); this.rest = new Float32Array(count * 3); this.has = new Uint8Array(count);
    const flag = () => { SKIN.dirty = true; };
    this.instanceMatrix = { get needsUpdate() { return false; }, set needsUpdate(v) { if (v) flag(); } };
    this.instanceColor = { get needsUpdate() { return false; }, set needsUpdate(v) { if (v) flag(); } };
    SKIN.sets.push(this);
    if (!SKIN.tissue) { SKIN.tissue = new Tissue(); this.add(SKIN.tissue.group); }
  }
  // Object3D's constructor sets these before the tissue exists: they go to the tissue once there is one
  get castShadow() { return SKIN.tissue ? SKIN.tissue.shadow.cast : false; } set castShadow(v) { if (SKIN.tissue) SKIN.tissue.setShadow("cast", v); }
  get receiveShadow() { return SKIN.tissue ? SKIN.tissue.shadow.receive : false; } set receiveShadow(v) { if (SKIN.tissue) SKIN.tissue.setShadow("receive", v); }
  setMatrixAt(i, m) {
    const e = m.elements, k = i * 3;
    this.pos[k] = e[12]; this.pos[k + 1] = e[13]; this.pos[k + 2] = e[14];
    this.scl[k] = Math.hypot(e[0], e[1], e[2]); this.scl[k + 1] = Math.hypot(e[4], e[5], e[6]); this.scl[k + 2] = Math.hypot(e[8], e[9], e[10]);
    if (!this.has[i]) { this.has[i] = 1; this.rest[k] = e[12]; this.rest[k + 1] = e[13]; this.rest[k + 2] = e[14]; }
    SKIN.dirty = true;
  }
  getMatrixAt(i, m) { const k = i * 3; m.makeScale(this.scl[k], this.scl[k + 1], this.scl[k + 2]); m.setPosition(this.pos[k], this.pos[k + 1], this.pos[k + 2]); return m; }
  setColorAt(i, c) { const k = i * 3; this.col[k] = c.r; this.col[k + 1] = c.g; this.col[k + 2] = c.b; SKIN.dirty = true; }
  getColorAt(i, c) { const k = i * 3; c.setRGB(this.col[k], this.col[k + 1], this.col[k + 2]); return c; }
  computeBoundingSphere() {} computeBoundingBox() {} dispose() {}
  // every render starts by updating the scene's matrices, before it gathers what to draw: the surface is
  // (re)built here, so it is in the frame that is about to be drawn (a build during the draw would miss it)
  updateMatrixWorld(force) { if (SKIN.tissue) SKIN.tissue.sync(); super.updateMatrixWorld(force); }
}

// ── the surface and its skin shader ──
const VERT_ADD = `
varying vec3 vWp; varying vec3 vWn;`;
const FRAG_ADD = `
precision highp sampler3D;
varying vec3 vWp; varying vec3 vWn;
uniform sampler3D tCells; uniform vec3 uMin, uSize; uniform vec2 uBands; uniform float uTop, uBump, uTopTint;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// the nearest two cell centres of a jittered lattice: lobules (fat) and the surface's own cells
vec2 worley(vec2 q) {
  vec2 g = floor(q), f = q - g; float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)); vec2 c = o + 0.5 + 0.4 * (vec2(h21(g + o), h21(g + o + 19.7)) - 0.5);
    float d = length(c - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}
// the relief, in world units, for a point on the surface: what band of the cut it is on, or the top
float skinH(vec3 p, vec3 n) {
  if (n.y > 0.55) {
    // the top: the fine polygonal network of skin lines, a few pores
    vec2 q = p.xz + 0.3 * vec2(sin(p.z * 1.7), sin(p.x * 1.3));
    vec2 w = worley(q * 2.8); float line = 1.0 - smoothstep(0.0, 0.14, w.y - w.x);
    vec2 w2 = worley(q * 0.55 + 7.0); float pore = (1.0 - smoothstep(0.05, 0.12, w2.x)) * step(0.62, h21(floor(q * 0.55 + 7.0)));
    return -0.028 * line - 0.08 * pore + 0.006 * sin(q.x * 9.0) * sin(q.y * 7.0);
  }
  vec2 q = abs(n.z) > abs(n.x) ? p.xy : p.zy;
  vec2 w = worley(q * 0.9 + 3.0); float fat = 0.09 * smoothstep(0.0, 0.42, w.y - w.x);                       // fat: round lobules with recessed seams
  float a = sin((q.x * 2.6 + q.y * 9.0 + 1.1 * sin(q.x * 3.1 + q.y * 1.7)) * 1.4);                           // dermis: collagen fibres, a loose weave
  float b = sin((q.x * 8.0 - q.y * 2.2 + 0.8 * sin(q.y * 4.3 + q.x * 0.9)) * 1.2);
  float derm = 0.007 * a + 0.005 * b;
  float epi = 0.004 * sin(q.x * 13.0) * sin(q.y * 11.0);                                                        // epidermis: fine stipple
  float kf = smoothstep(uBands.x - 0.5, uBands.x + 0.5, p.y), ke = smoothstep(uBands.y - 0.5, uBands.y + 0.5, p.y);
  return mix(mix(fat, derm, kf), epi, ke);
}`;
const COLOR_ADD = `
{
  // the cells' colours, the layer boundaries undulating like the dermal–epidermal junction
  float top = clamp((uTop - vWp.y) * 0.9, 0.0, 1.0);
  float wob = (0.34 * sin(vWp.x * 1.25 + vWp.z * 0.85) + 0.17 * sin(vWp.x * 2.9 - vWp.z * 1.7 + 1.0)) * top;
  vec3 uvw = (vec3(vWp.x, vWp.y + wob, vWp.z) - uMin) / uSize;
  vec4 cell = texture(tCells, uvw);
  vec3 c = cell.rgb;
  vec2 q = abs(vWn.z) > abs(vWn.x) ? vWp.xy : vWp.zy;
  if (vWn.y <= 0.55) {
    vec2 w = worley(q * 0.9 + 3.0); float seam = 0.8 + 0.2 * smoothstep(0.0, 0.3, w.y - w.x);                                       // seams between the lobules
    float weave = 0.97 + 0.03 * sin((q.x * 2.6 + q.y * 9.0 + 1.1 * sin(q.x * 3.1 + q.y * 1.7)) * 1.4);
    float kf = smoothstep(uBands.x - 0.5, uBands.x + 0.5, vWp.y), ke = smoothstep(uBands.y - 0.5, uBands.y + 0.5, vWp.y);
    c *= mix(mix(seam, weave, kf), 1.0, ke);
  } else { vec2 w = worley((vWp.xz + 0.3 * vec2(sin(vWp.z * 1.7), sin(vWp.x * 1.3))) * 2.8); c *= (0.965 + 0.035 * smoothstep(0.0, 0.16, w.y - w.x)) * mix(1.0, uTopTint, smoothstep(0.55, 0.8, vWn.y)); }
  c *= 0.97 + 0.06 * (h21(floor(vWp.xz * 3.0) + floor(vWp.y * 3.0)) - 0.5);
  diffuseColor.rgb *= c;
}`;
const NORMAL_ADD = `
{
  vec3 dpw_x = dFdx(vWp), dpw_y = dFdy(vWp);
  float h0 = skinH(vWp, vWn), hx = skinH(vWp + dpw_x, vWn), hy = skinH(vWp + dpw_y, vWn);
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec3 R1 = cross(sy, normal), R2 = cross(normal, sx);
  float det = dot(sx, R1) * faceDirection;
  vec3 grad = sign(det) * ((hx - h0) * R1 + (hy - h0) * R2) * uBump;
  normal = normalize(abs(det) * normal - grad);
}`;

function skinMaterial(u) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.0, clearcoat: 0.05, clearcoatRoughness: 0.6, specularIntensity: 0.55 });
  if (SKIN.opts.shade === 0) return new THREE.MeshStandardMaterial({ color: 0xd9a89a, roughness: 0.7 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>" + VERT_ADD)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvWn = normalize(mat3(modelMatrix) * objectNormal);")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>" + FRAG_ADD)
      .replace("#include <color_fragment>", "#include <color_fragment>" + COLOR_ADD)
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>" + NORMAL_ADD);
  };
  m.customProgramCacheKey = () => "lumevina-skin";
  return m;
}

class Tissue {
  constructor() {
    this.u = { tCells: { value: null }, uMin: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(1, 1, 1) }, uBands: { value: new THREE.Vector2() }, uTop: { value: 0 }, uBump: { value: SKIN.opts.bump }, uTopTint: { value: SKIN.opts.top } };
    this.material = skinMaterial(this.u);
    this.group = new THREE.Group();
    this.shadow = { cast: true, receive: true };
    // the surface is built on the first draw, once every cell has been placed: until then a probe (one
    // degenerate triangle that draws nothing) is what the renderer calls before each pass
    const sync = () => this.sync();
    const tri = new THREE.BufferGeometry(); tri.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    this.probe = new THREE.Mesh(tri, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    this.probe.frustumCulled = false; this.probe.castShadow = true;
    this.probe.onBeforeRender = sync; this.probe.onBeforeShadow = sync;
    this.group.add(this.probe);
    this.mc = null; this.built = false; this.last = null;
  }
  setShadow(k, v) { this.shadow[k] = v; if (this.mc) { if (k === "cast") this.mc.castShadow = v; else this.mc.receiveShadow = v; } }
  // the grid the cells sit on, from their rest positions: the colour texture's texels, the field's cube
  build() {
    const sets = SKIN.sets;
    let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
    for (const s of sets) for (let i = 0; i < s.count; i++) {
      if (!s.has[i]) continue;
      const k = i * 3;
      minX = Math.min(minX, s.rest[k]); maxX = Math.max(maxX, s.rest[k]);
      minY = Math.min(minY, s.rest[k + 1]); maxY = Math.max(maxY, s.rest[k + 1]);
      minZ = Math.min(minZ, s.rest[k + 2]); maxZ = Math.max(maxZ, s.rest[k + 2]);
    }
    if (minX > maxX) return false;
    this.g = { minX, minY, minZ, nx: Math.round(maxX - minX) + 1, ny: Math.round(maxY - minY) + 1, nz: Math.round(maxZ - minZ) + 1 };
    const g = this.g;
    this.tex = new THREE.Data3DTexture(new Uint8Array(g.nx * g.ny * g.nz * 4), g.nx, g.ny, g.nz);
    this.tex.format = THREE.RGBAFormat; this.tex.type = THREE.UnsignedByteType;
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter; this.tex.unpackAlignment = 1; this.tex.wrapS = this.tex.wrapT = this.tex.wrapR = THREE.ClampToEdgeWrapping;
    this.u.tCells.value = this.tex;
    this.u.uMin.value.set(minX - 0.5, minY - 0.5, minZ - 0.5);
    this.u.uSize.value.set(g.nx, g.ny, g.nz);
    this.u.uBands.value.set(minY + 2.5, maxY - 2.0);       // fat: the bottom three rows; epidermis: the top two and a half
    this.u.uTop.value = maxY + 0.5;
    // the field: a cube around the block with room for a swelling above and the rounding around
    const sx = g.nx + 3, sy = g.ny + 4, sz = g.nz + 3, size = Math.max(sx, sy, sz);
    const res = Math.max(40, Math.min(112, Math.round(size / SKIN.opts.res)));
    const MarchingCubes = marchingCubesClass(THREE);
    this.mc = new MarchingCubes(res, this.material, false, false, 160000);
    this.mc.isolation = 0.5;
    this.mc.position.set((minX + maxX) / 2, (minY + maxY) / 2 + 0.5, (minZ + maxZ) / 2);
    this.mc.scale.setScalar(size / 2);
    this.mc.castShadow = this.shadow.cast; this.mc.receiveShadow = this.shadow.receive; this.mc.frustumCulled = false;
    this.mc.onBeforeRender = this.probe.onBeforeRender; this.mc.onBeforeShadow = this.probe.onBeforeShadow;
    this.group.add(this.mc);
    this.f = { res, size, origin: [this.mc.position.x - size / 2, this.mc.position.y - size / 2, this.mc.position.z - size / 2], step: size / res };
    this.built = true;
    return true;
  }
  changed() {
    const sets = SKIN.sets;
    if (!this.last) { this.last = sets.map((s) => ({ pos: new Float32Array(s.pos), scl: new Float32Array(s.scl), col: new Float32Array(s.col), vis: s.visible })); return true; }
    let any = false;
    sets.forEach((s, n) => {
      const L = this.last[n];
      if (L.vis !== s.visible) { L.vis = s.visible; any = true; }
      for (let i = 0; i < s.pos.length; i++) {
        if (Math.abs(L.pos[i] - s.pos[i]) > 0.004 || Math.abs(L.scl[i] - s.scl[i]) > 0.004 || Math.abs(L.col[i] - s.col[i]) > 0.006) { any = true; break; }
      }
      if (any) { L.pos.set(s.pos); L.scl.set(s.scl); L.col.set(s.col); }
    });
    return any;
  }
  sync() {
    if (!this.built && !this.build()) return;
    if (!SKIN.dirty && this.last) return;
    SKIN.dirty = false;
    if (!this.changed()) return;
    this.rebuild();
  }
  rebuild() {
    const mc = this.mc, F = this.f, g = this.g, m = SKIN.opts.margin, res = F.res, step = F.step;
    const field = mc.field; field.fill(0);
    const data = this.tex.image.data; data.fill(0);
    const [ox, oy, oz] = F.origin;
    for (const s of SKIN.sets) {
      if (!s.visible) continue;
      const [w, h, d] = s.size;
      for (let i = 0; i < s.count; i++) {
        if (!s.has[i]) continue;
        const k = i * 3, sx = s.scl[k], sy = s.scl[k + 1], sz = s.scl[k + 2];
        // the cell's colour, at its rest texel
        const ix = Math.round(s.rest[k] - g.minX), iy = Math.round(s.rest[k + 1] - g.minY), iz = Math.round(s.rest[k + 2] - g.minZ);
        if (ix >= 0 && iy >= 0 && iz >= 0 && ix < g.nx && iy < g.ny && iz < g.nz) {
          const t = ((iz * g.ny + iy) * g.nx + ix) * 4;
          data[t] = Math.min(255, s.col[k] * 255); data[t + 1] = Math.min(255, s.col[k + 1] * 255); data[t + 2] = Math.min(255, s.col[k + 2] * 255); data[t + 3] = 255;
        }
        // the cell's soft box in the field. A cell a scene shrinks keeps its footprint (tissue has no gaps)
        // and sinks instead, so a tired, worn or shed cell reads as a dip; a stretched one rises. The surface
        // also undulates a little from cell to cell, as skin does.
        const hx = w * Math.max(sx, 0.95) / 2, hy = h * sy / 2, hz = d * Math.max(sz, 0.95) / 2;
        const sag = Math.max(0, 0.92 - Math.min(sx, sy, sz)) * 2.5;
        const und = SKIN.opts.undulation * (0.7 * Math.sin(s.rest[k] * 0.9 + 0.4) * Math.sin(s.rest[k + 2] * 1.3 + 1.1) + 0.3 * Math.sin(s.rest[k] * 2.3 + s.rest[k + 2] * 1.7 + 0.8));
        const cx = s.pos[k], cy = s.pos[k + 1] - sag + und, cz = s.pos[k + 2];
        const x0 = Math.max(0, Math.floor((cx - hx - m - ox) / step)), x1 = Math.min(res - 1, Math.ceil((cx + hx + m - ox) / step));
        const y0 = Math.max(0, Math.floor((cy - hy - m - oy) / step)), y1 = Math.min(res - 1, Math.ceil((cy + hy + m - oy) / step));
        const z0 = Math.max(0, Math.floor((cz - hz - m - oz) / step)), z1 = Math.min(res - 1, Math.ceil((cz + hz + m - oz) / step));
        for (let z = z0; z <= z1; z++) {
          const fz = Math.min(1, Math.max(0, (hz + m - Math.abs(oz + z * step - cz)) / (2 * m)));
          if (fz <= 0) continue;
          for (let y = y0; y <= y1; y++) {
            const fy = Math.min(1, Math.max(0, (hy + m - Math.abs(oy + y * step - cy)) / (2 * m)));
            if (fy <= 0) continue;
            const row = z * res * res + y * res;
            for (let x = x0; x <= x1; x++) {
              const fx = Math.min(1, Math.max(0, (hx + m - Math.abs(ox + x * step - cx)) / (2 * m)));
              if (fx > 0) field[row + x] += fx * fy * fz;
            }
          }
        }
      }
    }
    // an empty texel (the follicle) takes a neighbour's colour, so no dark bleeds into the wall around it
    for (let iz = 0; iz < g.nz; iz++) for (let iy = 0; iy < g.ny; iy++) for (let ix = 0; ix < g.nx; ix++) {
      const t = ((iz * g.ny + iy) * g.nx + ix) * 4;
      if (data[t + 3]) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= g.nx || jz >= g.nz) continue;
        const u = ((jz * g.ny + iy) * g.nx + jx) * 4;
        if (data[u + 3]) { data[t] = data[u]; data[t + 1] = data[u + 1]; data[t + 2] = data[u + 2]; break; }
      }
    }
    this.tex.needsUpdate = true;
    mc.update();
  }
}

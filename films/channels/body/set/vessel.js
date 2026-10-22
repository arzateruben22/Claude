// vessel.js — B1, the vessel (films/channels/body/set): a cut-away tube along a path, its lining, its cut rim.
//
//   import { lining, vessel } from "../set/vessel.js";
//   const tex = lining(THREE, { seed: 3 });                         // endothelial cells, once per film
//   const V = vessel(THREE, L, P, { radius: (s) => 2.6, wall: 0.5, tex });   // L: look.js, P: path.js path
//   scene.add(V.group);
//
// The cut: the half of the tube that faces the viewer is not built (real geometry, not a clipping plane,
// so the finish's depth pass sees the same cut as its colour pass). The path's frames start with n = +z
// (path.js `up`), and a path drawn in the x–y plane keeps n = +z all along, so the kept half (angles π/2
// to 3π/2 from n) is the back half, z ≤ 0. Through the cut you see the lining of the back wall and
// whatever flows inside; the two cut edges are flat strips the thickness of the wall ("a darker cut-face
// rim", bible §5), so the wall reads as a wall and not as a sheet.
//
// The lining: a seamless Voronoi texture of long cells with darker borders and an oval nucleus each, the
// look of an endothelium (the cells that line every vessel), made once from a seed. u runs along the
// vessel in µm (one tile every `tile` µm), v around it.
//
// lining(THREE, { seed = 3, size = [512, 256], cells = 42 }) → THREE.DataTexture (repeat-wrapped, mipmapped,
//   anisotropy 1: SwiftShader's anisotropic filtering carried state between draws for the physics channel)
// vessel(THREE, L, P, o) → { group, inner, rims, radius }
//   o: { radius = P.radius, wall = 0.5 µm, s0, s1, color = "#E9B3A8" (theme "vessel"), rimColor (darker),
//        tex, tile = 22 (µm along per texture tile), around = 2 (tiles around the full circle), radial = 20,
//        step = 2 (µm per ring), fresnel = 0.3 }
import { tube } from "cinema/sci/path.js";
import { rng } from "cinema/film/runtime.js";

export const lining = (THREE, o = {}) => {
  const [W, H] = o.size || [512, 256], N = o.cells ?? 42, r = rng(o.seed ?? 3);
  const pts = Array.from({ length: N }, () => [r() * W, r() * H, 0.75 + 0.5 * r()]);
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let d1 = 1e9, d2 = 1e9, i1 = 0;
    for (let i = 0; i < N; i++) {
      // torus distance, with cells stretched along u (x): long endothelial cells aligned with the flow
      let dx = Math.abs(x - pts[i][0]); dx = Math.min(dx, W - dx); let dy = Math.abs(y - pts[i][1]); dy = Math.min(dy, H - dy);
      const d = Math.hypot(dx * 0.42, dy);
      if (d < d1) { d2 = d1; d1 = d; i1 = i; } else if (d < d2) d2 = d;
    }
    const edge = Math.min(1, Math.max(0, (d2 - d1) / 7));
    let dx = Math.abs(x - pts[i1][0]); dx = Math.min(dx, W - dx); let dy = Math.abs(y - pts[i1][1]); dy = Math.min(dy, H - dy);
    const nuc = Math.hypot(dx / 22, dy / 9) * pts[i1][2];
    const nucleus = 1 - Math.min(1, Math.max(0, (nuc - 0.75) / 0.35));
    let v = 0.68 + 0.32 * edge * edge * (3 - 2 * edge);
    v *= 1 - 0.16 * nucleus;
    v *= 0.96 + 0.04 * Math.sin(i1 * 12.9898);
    const k = (y * W + x) * 4, b = Math.round(Math.min(1, v) * 255);
    data[k] = b; data[k + 1] = Math.round(b * (1 - 0.05 * nucleus)); data[k + 2] = Math.round(b * (1 - 0.03 * nucleus)); data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.anisotropy = 1; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return tex;
};

export const vessel = (THREE, L, P, o = {}) => {
  const R = o.radius ? (typeof o.radius === "function" ? o.radius : () => o.radius) : P.radius;
  const wall = o.wall ?? 0.5, wallF = typeof wall === "function" ? wall : () => wall;
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? P.length, step = o.step ?? 2, radial = o.radial ?? 20;
  const segs = Math.max(4, Math.ceil((s1 - s0) / step));
  const map = o.tex ? o.tex.clone() : null;
  if (map) { map.repeat.set(1 / (o.tile ?? 22), o.around ?? 2); map.needsUpdate = true; }
  const mat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin(o.color || "#E9B3A8"), map, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
    { fresnel: o.fresnel ?? 0.3, key: "vessel" });
  const inner = new THREE.Mesh(tube(P, { radius: R, s0, s1, segments: segs, radial, arc: [Math.PI / 2, (3 * Math.PI) / 2], inside: true }), mat);
  // the two cut edges: strips from the inner radius out through the wall, facing the cut (+n)
  const rimMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin(o.rimColor || "#B98479"), roughness: 0.7, metalness: 0, side: THREE.DoubleSide }), { fresnel: 0.1, key: "vrim" });
  const pos = [], nor = [], idx = [];
  for (const a of [Math.PI / 2, (3 * Math.PI) / 2]) {
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const s = s0 + ((s1 - s0) * j) / segs, F = P.frame(s), r = R(s), w = wallF(s), c = Math.cos(a), sn = Math.sin(a);
      const d = [F.n[0] * c + F.b[0] * sn, F.n[1] * c + F.b[1] * sn, F.n[2] * c + F.b[2] * sn];
      for (const rr of [r, r + w]) { pos.push(F.p[0] + d[0] * rr, F.p[1] + d[1] * rr, F.p[2] + d[2] * rr); nor.push(F.n[0], F.n[1], F.n[2]); }
    }
    for (let j = 0; j < segs; j++) { const A = base + 2 * j, B = A + 1, C = A + 2, D = A + 3; idx.push(A, B, C, B, D, C); }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  rg.setIndex(idx); rg.computeBoundingSphere();
  const rims = new THREE.Mesh(rg, rimMat);
  // the outer face of the back half: seen past the silhouette when the camera is off-axis
  const outer = new THREE.Mesh(tube(P, { radius: (s) => R(s) + wallF(s), s0, s1, segments: segs, radial, arc: [Math.PI / 2, (3 * Math.PI) / 2] }), rimMat);
  const group = new THREE.Group();
  group.add(inner, rims, outer);
  group.userData.noProbe = true;
  return { group, inner, rims, outer, radius: R, path: P };
};

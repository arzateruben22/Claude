// dna04.js — No. 004's scale jump (films/channels/skincare/set): a short stretch of DNA inside one living cell's
// nucleus, drawn as a ladder twisted into a double helix (a model, badged "model · not to scale"). Two neighbouring
// bases on one strand (thymines) fuse when ultraviolet lands: their rungs lean together and a uv bridge lights
// between them (a cyclobutane pyrimidine dimer, simplified). Built once, set from t alone.
//
//   const D = createDNA({ bp: 28, seed: 4, x: 3000 });   scene.add(D.group);
//   D.set({ fuse, glow, spin, dim });   D.at.fused() → [x, y, z] (the dimer, world space)   D.at.end(u) → a point on the axis
//
// Units are the scene's but the ladder is not to scale with the section: it is its own place (`x` puts it far off
// the section, so the two never share a frame). The colours are muted stain colours for the four bases (never
// skin, never the channel's signal colours), the backbone is ink; only the fused bridge uses uv.
import * as THREE from "three";

const lin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => { const c = parseInt(x.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); };
const BASE = { A: "#8C9BB0", T: "#B9A6C4", G: "#9DB3A4", C: "#C7B79B" };   // muted, stain-like
const PAIR = { A: "T", T: "A", G: "C", C: "G" };

export const createDNA = ({ bp = 28, rise = 3.4, radius = 10, twist = 36, x = 3000, fuseAt = 13, seed = 4 } = {}) => {
  const g = new THREE.Group();
  g.position.x = x;
  const L = (bp - 1) * rise, x0 = -L / 2, tw = (twist * Math.PI) / 180;
  // a fixed, readable sequence with the two thymines that fuse at fuseAt, fuseAt + 1 on strand 1
  const seq = "GATCCAGTACGTTAGCATCGGATCAATGCA".slice(0, bp).split("");
  seq[fuseAt] = "T"; seq[fuseAt + 1] = "T";
  const P = (i, s) => { const a = i * tw + (s ? Math.PI * 0.82 : 0); return new THREE.Vector3(x0 + i * rise, radius * Math.cos(a), radius * Math.sin(a)); };
  const backMat = new THREE.MeshStandardMaterial({ color: 0x31434a, roughness: 0.45, metalness: 0 });
  for (const s of [0, 1]) {
    const pts = [];
    for (let k = -2; k <= (bp + 1) * 4; k++) pts.push(P(k / 4, s));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), bp * 12, 1.25, 10, false), backMat));
  }
  const cyl = new THREE.CylinderGeometry(0.85, 0.85, 1, 10, 1);
  const half = [];   // [i][s] → { mesh, a, b } (a: on the strand, b: near the axis)
  const mats = {};
  const matOf = (b) => (mats[b] = mats[b] || new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...lin(BASE[b])), roughness: 0.55, metalness: 0, emissive: 0x000000 }));
  const place = (m, a, b) => { const d = b.clone().sub(a); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  for (let i = 0; i < bp; i++) {
    const row = [];
    for (const s of [0, 1]) {
      const b = s ? PAIR[seq[i]] : seq[i];
      const m = new THREE.Mesh(cyl, (i === fuseAt || i === fuseAt + 1) && !s ? new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...lin(BASE.T)), roughness: 0.5, metalness: 0, emissive: 0x000000 }) : matOf(b));
      const a = P(i, s), c = P(i, 0).add(P(i, 1)).multiplyScalar(0.5), e = a.clone().lerp(c, 0.9);
      place(m, a, e);
      g.add(m);
      row.push({ mesh: m, a, b: e });
    }
    half.push(row);
  }
  // the dimer's bridge: a short bar between the two fused thymines' inner ends (uv, emissive, blooms)
  const bridgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: true });
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 10), bridgeMat);
  g.add(bridge);
  const h0 = half[fuseAt][0], h1 = half[fuseAt + 1][0];
  const mid = h0.b.clone().add(h1.b).multiplyScalar(0.5);
  return {
    group: g, seq,
    // fuse: 0 … 1 (the two rungs lean together, the bridge forms); glow: 0 … 1 the bridge's light (uv, linear rgb);
    // spin: the whole ladder's roll about its axis (radians); dim: 0 … 1 everything but the dimer steps back
    set({ fuse = 0, glow = 0, uv = [0.6, 0.45, 1], spin = 0, dim = 0 } = {}) {
      g.rotation.x = spin;
      backMat.userData.base ??= backMat.color.clone();
      backMat.color.copy(backMat.userData.base).lerp(new THREE.Color(0.8, 0.82, 0.82), 0.5 * dim);
      for (const m of Object.values(mats)) m.userData.base ??= m.color.clone(), m.color.copy(m.userData.base).lerp(new THREE.Color(0.8, 0.82, 0.82), 0.5 * dim);
      const lean = 0.42 * fuse;
      place(h0.mesh, h0.a, h0.b.clone().lerp(mid, lean));
      place(h1.mesh, h1.a, h1.b.clone().lerp(mid, lean));
      for (const h of [h0, h1]) h.mesh.material.emissive.setRGB(...uv.map((v) => v * 0.55 * glow));
      const e0 = h0.b.clone().lerp(mid, lean), e1 = h1.b.clone().lerp(mid, lean);
      place(bridge, e0, e1);
      bridge.scale.x = bridge.scale.z = 0.4 + 1.1 * fuse;
      bridgeMat.color.setRGB(...uv.map((v) => v * (1 + 1.6 * glow)));
      bridgeMat.opacity = Math.min(1, 1.4 * fuse);
      bridge.visible = fuse > 0.01;
    },
    at: {
      fused: () => { const p = mid.clone(); p.applyAxisAngle(new THREE.Vector3(1, 0, 0), g.rotation.x); return [p.x + x, p.y, p.z]; },
      end: (u) => [x + x0 + L * u, 0, 0],
    },
    dims: { L, radius, x },
  };
};

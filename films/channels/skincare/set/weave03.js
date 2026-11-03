// weave03.js — No. 003's dermis (films/channels/skincare/set): collagen bundles woven over and under in every
// direction (simplified), a cut through it, the patch of parallel threads, and the regrown weave. Units µm; the block
// spans x ∈ [-w/2, w/2], z ∈ [-d/2, d/2], y ∈ [-h, 0] (the surface at y = 0 is the epidermis, drawn by the episode).
//   createWeave({ w, h, d, seed }) → { group, set(p), at }
//   set({ tone, pull: [px, pz] (−1 … 1 stretch along x / z), cut (0 … 1 a gap opening across the middle, |x| < gap),
//         patch (0 … 1 new parallel threads filling the gap, all along z), regrow (0 … 1 woven bundles filling it
//         instead), follicles (0 … 1 follicles and glands visible; inside the gap only with regrow), glow (the patch
//         lit cyan, the subject), dim })
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

export const createWeave = ({ w = 600, h = 260, d = 300, seed = 31, gap = 80, irregular = false } = {}) => {
  const R = rng(seed), g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, color: 0xf0e2d0 });
  const patchMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, color: 0xf6efe6, emissive: 0x000000 });
  const regrowMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, color: 0xf0e2d0, emissive: 0x000000 });
  // a woven bundle: a tube along a direction, bobbing over and under (phase by its row), slightly wavy
  const bundle = (dir, offset, y0, phase, len, r, m, s0 = -len / 2, s1 = len / 2) => {
    const pts = []; const n = Math.max(6, Math.round(28 * (s1 - s0) / len));
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const wob = 9 * Math.sin((s / 42) * Math.PI + phase);
      const p = dir === "x" ? new THREE.Vector3(s, y0 + wob, offset) : dir === "z" ? new THREE.Vector3(offset, y0 + wob, s) : new THREE.Vector3((s + offset) * 0.707, y0 + wob, (s - offset) * 0.707);
      pts.push(p);
    }
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false), m);
    mesh.userData = { dir, offset, y0, mid: Math.abs((s0 + s1) / 2) < 1 && s1 - s0 < len * 0.9 };
    return mesh;
  };
  const weave = [];
  for (let layer = 0; layer < 5; layer++) {
    const y0 = -40 - layer * (h - 60) / 4;
    for (const dir of ["x", "z"]) {
      const span = dir === "x" ? d : w;
      for (let o = -span / 2 + 20; o < span / 2; o += 34 + R() * 8) {
        const yy = y0 + (R() - 0.5) * 10 + (layer % 2 ? 10 : -10) * (dir === "x" ? 1 : -1), ph = (Math.round(o / 34) % 2) * Math.PI + layer, r = 7 + R() * 4;
        // x bundles cross the cut: three pieces, so only the middle one goes when the cut opens
        const segs = dir === "x" ? [[-w / 2, -gap], [-gap, gap], [gap, w / 2]] : [[-d / 2, d / 2]];
        for (const [a, b] of segs) { const m = bundle(dir, o, yy, ph, dir === "x" ? w : d, r, mat, a, b); g.add(m); weave.push(m); }
      }
    }
  }
  // the patch: parallel threads across the gap, all one way (along z)
  const patch = [];
  if (!irregular) for (let layer = 0; layer < 6; layer++) for (let x = -gap + 8; x < gap; x += 14) {
    const m = bundle("z", x, -30 - layer * (h - 50) / 5, 0, d, 6, patchMat); m.userData.k = R(); m.userData.x = x; g.add(m); patch.push(m);
  }
  // irregular (opt-in, No. 003 round 9): still all one way, but strands of uneven thickness and spacing that wander a
  // little, tapered and frayed at the ends, some shorter than the block, so the patch reads as tissue, not as rods
  else { const P = rng(seed + 7);
    for (let layer = 0; layer < 6; layer++) for (let x = -gap + 4 + P() * 6; x < gap - 2; x += 7 + P() * 13) {
      const r = 2.8 + Math.pow(P(), 1.5) * 6.5, y0 = -30 - layer * (h - 50) / 5 + (P() - 0.5) * 22;
      const s0 = -d / 2 - 2 + P() * P() * 30, s1 = d / 2 + 2 - P() * P() * 30, n = 40, ph = P() * 6.3, ph2 = P() * 6.3, amp = 2 + P() * 5, wl = 50 + P() * 60;
      const pts = []; for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; pts.push(new THREE.Vector3(x + amp * Math.sin(s / wl + ph), y0 + 3 * Math.sin(s / 37 + ph2), s)); }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, r, 9, false), pa = geo.attributes.position, c = new THREE.Vector3();
      // taper: pull each ring toward the curve centre near the ends, with a slight swelling partway along
      const curve = geo.parameters.path; for (let i = 0; i < pa.count; i++) { const ring = Math.floor(i / 10), u = Math.min(1, ring / 60); curve.getPointAt(u, c);
        const e = Math.min(u, 1 - u), t = Math.min(1, e / 0.12), k = (0.55 + 0.45 * Math.sqrt(t)) * (1 + 0.18 * Math.sin(u * 9 + ph));
        pa.setXYZ(i, c.x + (pa.getX(i) - c.x) * k, c.y + (pa.getY(i) - c.y) * k, c.z + (pa.getZ(i) - c.z) * k); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, patchMat); m.userData = { dir: "z", offset: x, y0, k: P(), x }; g.add(m); patch.push(m);
    } }
  // the regrown weave inside the gap (whoa): short woven bundles in both directions
  const regrow = [];
  for (let layer = 0; layer < 4; layer++) {
    const y0 = -40 - layer * (h - 60) / 3;
    for (let o = -d / 2 + 20; o < d / 2; o += 34) { const m = bundle("x", o, y0, (Math.round(o / 34) % 2) * Math.PI, gap * 2, 7, regrowMat); m.userData.k = R(); g.add(m); regrow.push(m); }
    for (let o = -gap + 20; o < gap; o += 34) { const m = bundle("z", o, y0 - 12, layer, d, 7, regrowMat); m.userData.k = R(); g.add(m); regrow.push(m); }
  }
  // follicles and glands: tubes down from the surface with a bulb, and coiled sweat-gland knots
  const fMat = new THREE.MeshStandardMaterial({ roughness: 0.55, color: 0x6b4a3a }), gMat = new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xd7a07a });
  const appendages = [];
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 40 + R() * (w - 80), z = -d / 2 + 30 + R() * (d - 60), inGap = Math.abs(x) < gap + 10;
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    if (i % 3) { const tube = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, h * 0.8, 10).translate(0, -h * 0.4, 0), fMat); const bulb = new THREE.Mesh(new THREE.SphereGeometry(17, 12, 10), fMat); bulb.position.y = -h * 0.8; grp.add(tube, bulb); }
    else { const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(18, 5, 64, 8, 2, 3), gMat); knot.position.y = -h * 0.75; const duct = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, h * 0.7, 6).translate(0, -h * 0.35, 0), gMat); grp.add(knot, duct); }
    grp.userData.inGap = inGap; g.add(grp); appendages.push(grp);
  }
  return {
    group: g, dims: { w, h, d, gap },
    set({ tone = 0.9, pull = [0, 0], cut = 0, patch: pk = 0, regrow: rk = 0, follicles = 1, glow = 0, dim = 0 } = {}) {
      const k = 1 - 0.45 * dim;
      const base = toneColor("dermis", tone).map((v) => Math.min(1, v * 1.45 + 0.22));
      mat.color.setRGB(...base.map((v) => v * k)); regrowMat.color.copy(mat.color);
      if (irregular) patchMat.color.setRGB(...base.map((v, i) => Math.min(1, v * 1.05 + 0.06) * k)); else patchMat.color.setRGB(0.97 * k, 0.94 * k, 0.9 * k);   // irregular: the same fibre, only paler patchMat.emissive.setRGB(0.12 * glow, 0.55 * glow, 0.52 * glow);
      fMat.color.setRGB(...toneColor("basal", tone).map((v) => v * k)); gMat.color.setRGB(...toneColor("living", tone).map((v) => v * k * 1.1));
      g.scale.set(1 + 0.12 * pull[0], 1 - 0.05 * (Math.abs(pull[0]) + Math.abs(pull[1])), 1 + 0.12 * pull[1]);
      const open = cut * (1 - Math.max(pk, rk));
      weave.forEach((m) => {
        // what lay in the cut is gone once it opens (the middle of the x bundles, the z bundles inside the gap)
        const inCut = m.userData.mid || (m.userData.dir === "z" && Math.abs(m.userData.offset) < gap);
        m.visible = !(inCut && cut > 0.02);
      });
      patch.forEach((m) => { m.visible = pk > m.userData.k * 0.9 + 0.02; m.position.x = 0; });
      regrow.forEach((m) => { m.visible = rk > m.userData.k * 0.9 + 0.02; });
      appendages.forEach((a) => { a.visible = follicles > 0.01 && (!a.userData.inGap || cut < 0.02 || rk > 0.6); });
      g.userData.open = open;
    },
    at: { gap: () => [0, -120, 0], weave: () => [-170, -90, 40], appendage: () => [180, -60, 40], surface: () => [-w / 2 + 10, 0, 0] },
  };
};

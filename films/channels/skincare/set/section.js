// section.js — Outer Layer's "section" (films/channels/skincare/set): a block of skin cut open, built once from a
// seed, then set per frame from t alone. Units: 1 = 1 µm; the top surface is y = 0, depth is −y; the cut face is
// the block's +z face (the camera sits on +z). Simplified on purpose (badged "simplified" in every episode): the
// layers' thicknesses are the episode's (the stratum corneum's is the claim's), the cells are drawn rounder and
// fewer than real ones, and the colours follow one melanin parameter (0 light … 1 deep), never a "default" skin.
//
//   const S = createSection({ width: 180, depth: 60, rows: 15, sc: 17, gran: 10, spin: 48, basal: 10, seed: 3 });
//   scene.add(S.group);
//   S.set({ tone, mortar, dimLiving, dimDead, lift, ... });   S.at.scTop(u) → [x, y, z] (anchors for labels)
//
// Everything is opaque, lit geometry (MeshStandardMaterial) except the lipid mortar and the water beads, which are
// emissive in the theme's scene colours so the bloom picks them up (the only things that glow). The cut is made by
// clipping planes on every material (renderer.localClippingEnabled must be true), so cells cut by the face show
// their insides: cytoplasm, a darker nucleus and, in the basal row, melanin caps.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
// skin colours by melanin (light → medium → deep), from illustrative sRGB samples across the range of measured skin
// reflectance; one parameter tints every layer, so no one tone is "the" skin
const RAMP = {
  corneo: ["#F3E7DA", "#D9B79A", "#A47A5E"],     // the dead rows: paler and drier than the living cells beneath
  living: ["#EED3C2", "#C9946F", "#7E5038"],
  basal: ["#E6C3AE", "#B37D58", "#5E3826"],
  melanin: ["#B48A6A", "#6B4128", "#2E1A10"],
  nucleus: ["#9A7FA0", "#7A5E80", "#4E3A55"],    // a stain-like violet-grey, the same for every tone
  dermis: ["#F1D8CC", "#D5AE98", "#9E7562"],
  fibre: ["#F7EEE6", "#E9D6C6", "#C7A68E"],
};
export const toneColor = (name, m) => {
  const r = RAMP[name].map(hexLin), u = Math.min(1, Math.max(0, m));
  return u < 0.5 ? mix(r[0], r[1], u / 0.5) : mix(r[1], r[2], (u - 0.5) / 0.5);
};

export const createSection = (o = {}) => {
  const W = o.width ?? 180, D = o.depth ?? 60, ROWS = o.rows ?? 15, SC = o.sc ?? 17, GR = o.gran ?? 10, SP = o.spin ?? 48, BA = o.basal ?? 10;
  const R = rng(o.seed ?? 3), x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2, OX = o.x ?? 0;
  const MORTAR0 = o.mortarFloor ?? 0.15;   // the lipid sheets' resting strength; 0 hides them until lit (close-ups stripe otherwise; No. 004's review)   // OX: the block's x in the world (clipping planes are world-space)
  const yG = -SC, yS = -SC - GR, yB = -SC - GR - SP, yDJ = yB - BA;           // tops of granular, spinous, basal; the junction
  const junction = (x) => yDJ + 3.2 * Math.sin(x / 17 + 0.6) + 1.4 * Math.sin(x / 7.3 + 1.9);
  const group = new THREE.Group();
  group.position.x = OX;
  const clip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), x1 + OX), new THREE.Plane(new THREE.Vector3(1, 0, 0), -x0 - OX),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), z1), new THREE.Plane(new THREE.Vector3(0, 0, 1), -z0)];
  const mat = (o2 = {}) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clip, ...o2 });
  const M = { corneo: mat({ roughness: 0.5 }), living: mat(), basal: mat(), melanin: mat({ roughness: 0.4 }), nucleus: mat({ roughness: 0.45 }),
    dermis: mat({ roughness: 0.8 }), fibre: mat({ roughness: 0.7 }) };
  const dummy = new THREE.Object3D();
  const inst = (geo, material, list) => {
    const m = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((p, i) => { dummy.position.set(...p.pos); dummy.scale.set(...p.scl); dummy.rotation.set(0, p.rot || 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.instanceMatrix.needsUpdate = true;
    group.add(m);
    return m;
  };

  // stratum corneum: ROWS rows of flat hexagonal plates, staggered like brickwork, a thin gap between rows (the mortar)
  const rowH = SC / ROWS, plateH = rowH * 0.72, CW = 26;
  const corneo = [];
  for (let r = 0; r < ROWS; r++) {
    const y = -rowH * (r + 0.5), off = (r % 2) * CW * 0.5 + (R() - 0.5) * 4;
    for (let x = x0 - CW + off; x < x1 + CW; x += CW) for (let z = z0 - CW * 0.5; z < z1 + CW; z += CW * 0.9)
      corneo.push({ pos: [x + (R() - 0.5) * 3, y + (R() - 0.5) * rowH * 0.12, z + (R() - 0.5) * 3], scl: [CW * 0.54, plateH, CW * 0.54], rot: R() * Math.PI, row: r });
  }
  const corneoMesh = inst(new THREE.CylinderGeometry(1, 1, 1, 6, 1), M.corneo, corneo);
  // the mortar: one emissive sheet per gap between rows (lipids), and one under the whole layer
  const mortarMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: clip, toneMapped: true });
  const mortar = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 1, D + 2), mortarMat);
  const mortarGroup = new THREE.Group();
  for (let r = 1; r < ROWS; r++) { const m = mortar.clone(); m.position.set(0, -rowH * r, 0); m.scale.set(1, rowH * 0.3, 1); mortarGroup.add(m); }
  group.add(mortarGroup);

  // granular layer: two rows of flattened cells
  const gran = [];
  for (let r = 0; r < 2; r++) for (let x = x0 - 8; x < x1 + 12; x += 15) for (let z = z0 - 6; z < z1 + 10; z += 14)
    gran.push({ pos: [x + (r % 2) * 7 + (R() - 0.5) * 3, yG - GR * (0.27 + 0.5 * r), z + (R() - 0.5) * 4], scl: [9.4, 3.3 + r * 0.6, 8.6], rot: R() * 3 });   // overlapping: no light gaps between the rows
  const granMesh = inst(new THREE.SphereGeometry(1, 14, 10), M.living, gran);
  // spinous layer: rounder cells, flatter toward the top
  const spin = [], nuclei = [];
  const NSR = Math.round(SP / 11);
  for (let r = 0; r < NSR; r++) {
    const y = yS - SP * (r + 0.5) / NSR, flat = 0.75 + 0.25 * (r / Math.max(1, NSR - 1));
    for (let x = x0 - 6; x < x1 + 10; x += 11.5) for (let z = z0 - 6; z < z1 + 10; z += 11.5) {
      const p = [x + (r % 2) * 5.5 + (R() - 0.5) * 2.5, y + (R() - 0.5) * 2, z + (R() - 0.5) * 2.5];
      spin.push({ pos: p, scl: [7.0, 6.6 * flat, 7.0], rot: R() * 3 });   // overlapping a little: no light gaps between rows
      nuclei.push({ pos: p, scl: [2.3, 2.1 * flat, 2.3] });
    }
  }
  const spinMesh = inst(new THREE.IcosahedronGeometry(1, 1), M.living, spin);
  // basal layer: a row of columns on the wavy junction, each with a melanin cap above its nucleus
  const basal = [], caps = [];
  for (let x = x0 - 4; x < x1 + 6; x += 7.2) for (let z = z0 - 4; z < z1 + 6; z += 7.2) {
    const yb = junction(x) + BA * 0.5;
    basal.push({ pos: [x + (R() - 0.5), yb, z + (R() - 0.5)], scl: [3.4, BA * 0.52, 3.4], rot: R() * 3 });
    nuclei.push({ pos: [x, yb - 0.6, z], scl: [1.9, 2.6, 1.9] });
    caps.push({ pos: [x, yb + 2.6, z], scl: [2.2, 1.0, 2.2] });
  }
  const basalMesh = inst(new THREE.SphereGeometry(1, 12, 10), M.basal, basal);
  const nucMesh = inst(new THREE.SphereGeometry(1, 10, 8), M.nucleus, nuclei);
  const capMesh = inst(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.melanin, caps);
  // dermis: a solid block under the wavy junction, with collagen fibres on its cut face
  const dGeo = new THREE.BoxGeometry(W - 0.6, 140, D - 0.6, 64, 1, 1), pa = dGeo.attributes.position;   // inside the clipping planes: a face exactly on a plane z-fights (the review's shimmer)
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setY(i, pa.getY(i) > 0 ? junction(x) - yDJ : pa.getY(i)); }   // top on the junction, bottom 70 µm down
  dGeo.computeVertexNormals();
  const dermis = new THREE.Mesh(dGeo, M.dermis);
  dermis.position.y = yDJ;
  group.add(dermis);
  const fib = [];
  for (let i = 0; i < Math.round(W / 4); i++) fib.push({ pos: [x0 + R() * W, yDJ - 8 - R() * 58, z1 - 1.6 - R() * 2], scl: [1.5, 10 + R() * 22, 1.5], rot: 0, tilt: (R() - 0.5) * 2.6 });
  const fibMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), M.fibre, fib.length);
  fib.forEach((p, i) => { dummy.position.set(...p.pos); dummy.scale.set(...p.scl); dummy.rotation.set(0, 0, Math.PI / 2 + p.tilt * 0.4); dummy.updateMatrix(); fibMesh.setMatrixAt(i, dummy.matrix); });
  fibMesh.visible = false;   // single fibres read as stray white lines (the No. 001 review)
  group.add(fibMesh);

  // the dead layer as one continuous sheet (No. 003): shown instead of the separate plates while the section is
  // wrinkled, so a fold reads as one skin buckling, never as plates coming apart
  // inside the clipping planes, so its cut face is solid
  const sheetGeo = new THREE.BoxGeometry(W - 0.6, SC, D - 0.6, 160, 2, 1), sPos = sheetGeo.attributes.position, sBase = Float32Array.from(sPos.array);
  const sheet = new THREE.Mesh(sheetGeo, M.corneo);
  sheet.position.y = -SC / 2; sheet.visible = false;
  group.add(sheet);
  // an opt-in backing behind the cells (gaps between rows show tissue, not the page)
  let backing = null;
  if (o.backing) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(W - 1, SC + GR + SP + BA - 2, D - 6), M.living);   // its top 2 µm under the surface: no z-fight with the dead rows
    back.position.set(0, -(SC + GR + SP + BA) / 2 - 1, -2);
    group.add(back);
    backing = back;
  }
  const meshes = { corneoMesh, granMesh, spinMesh, basalMesh, nucMesh, capMesh, dermis, fibMesh };
  // wrinkling (No. 003): every cell near the surface rides a fold y += amp · sin(2πx/period) · e^(y/decay); the fold dies
  // away with depth, so the dead rows buckle and the dermis barely moves. Matrices are rebuilt only when amp changes.
  const LISTS = [[corneoMesh, corneo], [granMesh, gran], [spinMesh, spin], [basalMesh, basal], [nucMesh, nuclei], [capMesh, caps]];
  const dTop = Float32Array.from({ length: pa.count }, (_, i) => pa.getY(i));
  let wrinkled = 0;
  const wrinkle = (amp = 0, period = 26, decay = 28, phase = 0.4) => {
    if (Math.abs(amp - wrinkled) < 1e-4) return;
    wrinkled = amp;
    const f = (x, y) => amp * Math.sin(2 * Math.PI * x / period + phase) * Math.exp(Math.min(0, y) / decay);
    for (const [m, list] of LISTS) {
      list.forEach((p, i) => { dummy.position.set(p.pos[0], p.pos[1] + f(p.pos[0], p.pos[1]), p.pos[2]); dummy.scale.set(...p.scl); dummy.rotation.set(0, p.rot || 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
      m.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < pa.count; i++) pa.setY(i, dTop[i] + (dTop[i] > -1 ? f(pa.getX(i), yDJ) : 0));
    for (let i = 0; i < sPos.count; i++) sPos.setY(i, sBase[3 * i + 1] + f(sBase[3 * i], -SC / 2 + sBase[3 * i + 1]));
    sPos.needsUpdate = true; sheetGeo.computeVertexNormals();
    sheet.visible = amp > 0.05; corneoMesh.visible = amp <= 0.05;
    pa.needsUpdate = true; dGeo.computeVertexNormals();
    mortarGroup.visible = amp < 0.05;              // flat sheets can't follow a fold
    if (backing) backing.visible = amp < 0.05;     // a flat slab would poke through the buckled sheet's troughs
  };
  const base = (m, c, k = 1) => m.color.setRGB(c[0] * k, c[1] * k, c[2] * k);
  return {
    group, meshes, mortarGroup, junction, wrinkle, dims: { W, D, ROWS, SC, GR, SP, BA, yG, yS, yB, yDJ, rowH },
    // tone (melanin 0–1); dimDead / dimLiving: 0 … 1 (rule 8: whatever isn't the subject steps back to ~1/3);
    // mortar: 0 … 1, the lipid sheets lit in the theme's water colour (lin, as [r, g, b] linear)
    set({ tone = 0.5, dimDead = 0, dimLiving = 0, mortar = 0, mortarColor = [0.3, 0.7, 0.75], glowDead = 0 } = {}) {
      const kd = 1 - 0.62 * dimDead, kl = 1 - 0.62 * dimLiving;
      base(M.corneo, toneColor("corneo", tone), kd * (1 + 0.12 * glowDead));   // lit, not washed out: the rows keep their edges
      M.corneo.emissive.setRGB(...toneColor("corneo", tone).map((v) => v * 0.1 * glowDead));
      base(M.living, toneColor("living", tone), kl);
      base(M.basal, toneColor("basal", tone), kl);
      base(M.melanin, toneColor("melanin", tone), kl);
      base(M.nucleus, toneColor("nucleus", tone), kl);
      base(M.dermis, toneColor("dermis", tone), kl);
      base(M.fibre, toneColor("fibre", tone), kl);
      // melanin caps grow with tone (more and larger melanosomes; illustrative)
      capMesh.visible = tone > 0.05;
      mortarMat.color.setRGB(...mortarColor);
      mortarMat.opacity = MORTAR0 + (1 - MORTAR0) * mortar;
      mortarGroup.visible = wrinkled < 0.05 && mortarMat.opacity > 0.01;
    },
    at: {
      scTop: (u = 0.5, zf = 1) => [x0 + W * u, -0.2, z1 * zf],
      scMid: (u = 0.5) => [x0 + W * u, -SC * 0.5, z1],
      living: (u = 0.5) => [x0 + W * u, yS - SP * 0.5, z1],
      basal: (u = 0.5) => [x0 + W * u, junction(x0 + W * u) + BA * 0.5, z1],
      corneo: (r = 3, u = 0.55) => [x0 + W * u, -rowH * (r + 0.5), z1],
    },
  };
};

// the climbing cell (a keratinocyte followed from the basal row to the surface): its own mesh, so it can win its
// frames; u 0 → 1 is its climb (round at the base, flat at the top), k 0 → 1 its cornification (the nucleus goes,
// the cell empties and flattens into a plate)
export const createClimber = ({ clip } = {}) => {
  const g = new THREE.Group();
  const cell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, emissive: 0x000000 }));
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, transparent: true }));
  const fil = new THREE.Group();                                   // keratin filaments, drawn as short strands inside
  const fm = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, transparent: true });
  const R = rng(41);
  for (let i = 0; i < 28; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 4), fm);
    s.position.set((R() - 0.5) * 1.2, (R() - 0.5) * 0.8, (R() - 0.5) * 1.2); s.rotation.set(R() * 3, R() * 3, R() * 3); s.scale.y = 0.5 + R() * 0.7;
    fil.add(s);
  }
  cell.material.transparent = true; cell.material.opacity = 0.9; cell.material.depthWrite = false;
  // an ink outline (the back faces of a slightly larger shell), so the followed cell reads against its neighbours in
  // every tone
  const line = new THREE.Mesh(cell.geometry, new THREE.MeshBasicMaterial({ color: 0x13252c, side: THREE.BackSide, transparent: true, opacity: 0.85, toneMapped: false }));
  g.add(nuc, fil, line, cell);
  g.renderOrder = 10;   // drawn after the section and over it, so the followed cell never cuts through its neighbours
  // painted in order with no depth test: outline, then the nucleus and filaments, then the translucent body over them
  line.renderOrder = 10; cell.renderOrder = 12; nuc.renderOrder = 13;   // the nucleus over the body, so its going is seen
  [cell, nuc, line].forEach((m) => { m.material.depthTest = false; });
  fil.children.forEach((m) => { m.renderOrder = 11; }); fm.depthTest = false;
  return {
    group: g,
    set({ pos, u, k, tone, glow = 1, bodyColor, nucColor }) {
      const sx = 6.6 + 6.4 * u * u + 2 * k, sy = 6.2 - 3.4 * u - 2.2 * k;
      g.position.set(...pos);
      cell.scale.set(sx, Math.max(0.7, sy), sx);
      line.scale.set(sx + 0.9, Math.max(0.7, sy) + 0.9, sx + 0.9);
      cell.material.color.setRGB(...bodyColor.map((v) => v + (1 - v) * 0.35));   // paler than its neighbours
      cell.material.emissive.setRGB(...bodyColor.map((v) => v * 0.5 * glow));
      cell.material.opacity = 0.8 + 0.15 * k;
      nuc.scale.setScalar(2.4 * (1 - k));
      nuc.visible = k < 0.98;
      nuc.material.color.setRGB(...nucColor); nuc.material.opacity = 1 - k;
      fil.scale.set(sx * 0.85, Math.max(0.5, sy * 0.8), sx * 0.85);
      fm.color.setRGB(...bodyColor.map((v) => v * 0.7)); fm.opacity = 0.25 + 0.6 * Math.min(1, u * 1.4);
      g.visible = true;
    },
    hide() { g.visible = false; },
  };
};

// water beads: instanced small spheres, emissive; each one rises from deep in the living layers toward the surface.
// pass(i) decides whether it gets through the wall at y = wallY (and leaves the skin, fading) or turns back under it.
export const createBeads = ({ n = 120, x: [xa, xb] = [-80, 80], z: [za, zb] = [-20, 28], y0 = -70, wallY = -17, top = 30, seed = 5, pass = () => false, size = 1.6, period = [2.6, 2.2] } = {}) => {
  const R = rng(seed);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat, n);
  const B = Array.from({ length: n }, (_, i) => ({ x: xa + R() * (xb - xa), z: za + R() * (zb - za), P: period[0] + R() * period[1], ph: R(), pass: pass(i, R), wob: R() * 6.28 }));
  const dummy = new THREE.Object3D();
  return {
    mesh, B,
    // t: film time; gain 0 … 1 (opacity of the whole swarm); returns the screen anchor of a passing bead
    set(t, { gain = 1, color = [0.3, 0.7, 0.75] } = {}) {
      mat.color.setRGB(...color); mat.opacity = gain;
      mesh.visible = gain > 0.002;
      let any = null;
      B.forEach((b, i) => {
        const u = ((t / b.P + b.ph) % 1 + 1) % 1;
        let y, s = size;
        if (b.pass) { y = y0 + (top - y0) * u; s *= y > 0 ? Math.max(0, 1 - y / top) : 1; if (!any && y > 2 && y < 12) any = [b.x, y, b.z]; }
        else { const up = u < 0.5 ? u / 0.5 : (1 - u) / 0.5; y = y0 + (wallY - 1.5 - y0) * Math.sin(up * Math.PI / 2); }
        dummy.position.set(b.x + 0.8 * Math.sin(t * 1.3 + b.wob), y, b.z);
        dummy.scale.setScalar(s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      return any;
    },
  };
};

// flakes: a few dead plates lifting off the surface and drifting up, tumbling and fading (No. 001's "flake away")
export const createFlakes = ({ n = 7, x: [xa, xb] = [-60, 60], z = 24, seed = 9 } = {}) => {
  const R = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, transparent: true, opacity: 1 });
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1), mat, n);
  const F = Array.from({ length: n }, () => ({ x: xa + R() * (xb - xa), z: z - R() * 20, d: R() * 0.6, spin: (R() - 0.5) * 2, drift: (R() - 0.5) * 18 }));
  const d = new THREE.Object3D();
  return {
    mesh,
    set(t, { t0, color = [0.9, 0.85, 0.8], gain = 1 }) {
      mat.color.setRGB(...color);
      mesh.visible = gain > 0.002 && t > t0;
      F.forEach((f, i) => {
        const u = Math.max(0, Math.min(1, (t - t0 - f.d) / 2.4)), e = u * u * (3 - 2 * u);
        d.position.set(f.x + f.drift * e, 0.6 + 8 * e, f.z);   // a short lift: clear of the counters
        d.rotation.set(f.spin * e * 1.4, f.spin * e * 2, f.spin * e * 0.9);
        const s = (u > 0 ? 1 : 0) * (1 - Math.max(0, (u - 0.7) / 0.3));
        d.scale.set(8 * s + 1e-4, 0.8, 8 * s + 1e-4); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mat.opacity = gain;
    },
  };
};

// vessels (No. 003): a few small blood vessels running along the upper dermis, just behind the cut face; their radius is
// set per frame (they narrow when the nerves tell them to). A muted brick red: not the body channel's blood pink.
export const createVessels = ({ x: [xa, xb] = [-80, 80], ys = [-92, -100, -110], z = 20, r = 2.4, ox = 0 } = {}) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xa8584e, roughness: 0.45, metalness: 0 });
  const group = new THREE.Group();
  const curves = ys.map((y, i) => {
    const pts = [];
    for (let k = 0; k <= 24; k++) { const x = xa + (xb - xa) * k / 24; pts.push(new THREE.Vector3(ox + x, y + 2.5 * Math.sin(x / 13 + i * 1.7), z - i * 3)); }
    return new THREE.CatmullRomCurve3(pts);
  });
  const tubes = curves.map((c) => { const m = new THREE.Mesh(new THREE.TubeGeometry(c, 48, r, 12, false), mat); group.add(m); return m; });
  let last = -1;
  return {
    group,
    // k: 1 open … about 0.4 narrowed (each tube rebuilt at radius r·k about its own centreline)
    set({ k = 1, opacity = 1 } = {}) {
      group.visible = opacity > 0.002;
      const kk = Math.round(k * 200) / 200;
      if (kk === last) return;
      last = kk;
      tubes.forEach((m, i) => { m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(curves[i], 48, r * kk, 12, false); });
    },
  };
};

// water (No. 003): a clear slab of bath water over a block, tinted with the theme's water colour
export const createWater = ({ width = 180, depth = 60, top = 40, x = 0 } = {}) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xbfe3e6, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, top, depth), mat);
  mesh.position.set(x, top / 2, 0);
  return { mesh, set({ opacity = 0.22 } = {}) { mat.opacity = opacity; mesh.visible = opacity > 0.002; } };
};

// the pad (No. 003): a fingertip's pad (or a patch of forearm) at the same µm scale as the sections, a rounded block of
// skin whose top surface can furrow: y_top(x) = h − amp · furrows · (0.5 − 0.5 cos(2π x / period)), so the folds are one
// continuous skin, lit from the side by the key. Simplified (badged): real fingertip furrows are wider and curve.
export const createPad = ({ width = 70, depth = 46, height = 60, x = 0, seed = 1, period = 14 } = {}) => {
  const geo = new THREE.BoxGeometry(width, height, depth, 140, 6, 40);
  const pos = geo.attributes.position, base = Float32Array.from(pos.array);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, vertexColors: true });
  const cols = new Float32Array(pos.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, -height / 2, 0);
  const R = rng(seed);
  const ph = R() * 6.28;
  let last = -1;
  return {
    mesh, width, depth, height,
    // furrows: 0 smooth … 1 fully wrinkled; amp: fold depth (µm); swell: 0 … 1 (the wrong idea: a puffy, swollen pad)
    // color: the living skin; top: the dead layer's colour (a paler band over the top 17% of the pad)
    set({ furrows = 0, amp = 10, color = [0.5, 0.3, 0.2], top: topColor = null, swell = 0, visible = true } = {}) {
      mesh.visible = visible;
      const tc = topColor || color;
      for (let i = 0; i < pos.count; i++) { const h = (base[3 * i + 1] + height / 2) / height, k = h > 0.83 ? 1 : 0; for (let c = 0; c < 3; c++) cols[3 * i + c] = color[c] + (tc[c] - color[c]) * k; }
      geo.attributes.color.needsUpdate = true;
      const key = Math.round(furrows * 1000) + 1e4 * Math.round(swell * 1000);
      if (key === last) return;
      last = key;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[3 * i], by = base[3 * i + 1], bz = base[3 * i + 2];
        const top = (by + height / 2) / height;                       // 0 at the bottom … 1 at the top
        const edge = Math.min(1, (width / 2 - Math.abs(bx)) / 10) * Math.min(1, (depth / 2 - Math.abs(bz)) / 10);
        const fold = amp * furrows * (0.5 - 0.5 * Math.cos(2 * Math.PI * bx / period + ph)) * Math.max(0, edge);   // soft, even folds
        const e2 = Math.min(1, (width / 2 - Math.abs(bx)) / 18) * Math.min(1, (depth / 2 - Math.abs(bz)) / 18);
        const round = 14 * (1 - Math.sqrt(Math.max(0, e2)));          // the pad's rounded shoulders
        const crown = 7 * (1 - (2 * bx / width) ** 2) * (1 - (2 * bz / depth) ** 2);   // a domed top, like a fingertip's pulp
        pos.setY(i, by + top * (height * 0.12 * swell - fold - round * top + crown * top * top));
        // rounded vertical edges (radius 12 µm): the corner columns pulled onto a quarter circle
        const rc = 12, dx = Math.abs(bx) - (width / 2 - rc), dz = Math.abs(bz) - (depth / 2 - rc);
        if (dx > 0 && dz > 0) { const l = Math.hypot(dx, dz), k = Math.min(1, rc / l); pos.setX(i, Math.sign(bx) * (width / 2 - rc + dx * k)); pos.setZ(i, Math.sign(bz) * (depth / 2 - rc + dz * k)); }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
};

// Stylized glowing props for Gravity Doubles Part 1 v2: a cup, a 3-step stair, a translucent human skeleton with load glow, a tower cutaway (the load path glowing down the
// columns into the foundation), a small city, an ocean cross-section under a sky layer, a cracking mountain ledge. Simple geometry, emissive/additive, same glow language as the globe.
// Every builder returns { group, update(...) }; the scene places and times them.
import * as THREE from "three";
import { unlit } from "../../set/aces.js";

const col = (hex) => new THREE.Color(unlit(hex));
const basic = (hex, o = 1, add = false) => new THREE.MeshBasicMaterial({ color: col(hex), transparent: o < 1 || add, opacity: o, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E_ = new THREE.Euler();
const lerp = (a, b, u) => a + (b - a) * u, c01 = (x) => Math.max(0, Math.min(1, x));
const MAG = "#EB63FF", CY = "#7fe6ff", WH = "#e9f4ff";
const lerpCol = (a, b, u) => new THREE.Color(a).lerp(new THREE.Color(b), c01(u));

// ── a small glossy cup (a pedestal is separate) ──
export const makeCup = () => {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: "#EB63FF", roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color("#7a1f90"), emissiveIntensity: 0.4, envMapIntensity: 1.2 });
  const pts = [[0.0, 0.0], [0.045, 0.0], [0.05, 0.008], [0.062, 0.1], [0.066, 0.105], [0.058, 0.105], [0.052, 0.098], [0.04, 0.012], [0.0, 0.01]].map(([r, y]) => new THREE.Vector2(r, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), m); cup.material.side = THREE.DoubleSide; g.add(cup);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 10, 24, Math.PI * 1.2), m); handle.position.set(0.064, 0.055, 0); handle.rotation.z = -Math.PI * 0.6; g.add(handle);
  return { group: g };
};
export const makePedestal = () => {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: "#26407a", roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.9 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.16, 32), m); b.position.y = 0.08; g.add(b);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.006, 8, 40), basic(CY, 0.95, true)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; g.add(ring);
  return { group: g, top: 0.16 };
};

// ── a 3-step stair (glass blocks with a glowing edge) ──
export const makeStair = (steps = 3, tread = 0.13, rise = 0.055, depth = 0.3, skirt = 0.1) => {
  const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color: "#26407a", roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.9 }), tops = [];
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1) + skirt, box = new THREE.Mesh(new THREE.BoxGeometry(tread, h, depth), mat), x = tread * (i + 0.5); box.position.set(x, (h - skirt) / 2 - skirt / 2 + skirt / 2 - skirt / 2, 0); g.add(box);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(tread, h, depth)), new THREE.LineBasicMaterial({ color: col("#6fe0ff"), transparent: true, opacity: 0.9 })); e.position.copy(box.position); g.add(e);
    tops.push({ x, y: h - skirt });
  }
  return { group: g, tops, width: tread * steps };
};

// ── a translucent human skeleton with load glow (spine, pelvis, knees, feet) ──
export const makeSkeleton = () => {
  const g = new THREE.Group(), bone = basic(WH, 0.5, true), boneD = basic(CY, 0.35, true);
  const cap = (x0, y0, x1, y1, r, m = bone) => { const L = Math.hypot(x1 - x0, y1 - y0), c = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L - 2 * r), 6, 12), m); c.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); c.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; g.add(c); return c; };
  const sph = (x, y, r, m = bone, sx = 1, sy = 1, sz = 1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m); s.position.set(x, y, 0); s.scale.set(sx, sy, sz); g.add(s); return s; };
  sph(0, 1.64, 0.075, bone, 1, 1.12, 1.0); sph(0, 1.57, 0.045, boneD, 1.1, 0.7, 0.8);                                   // skull, jaw
  const vert = []; for (let i = 0; i < 15; i++) { const u = i / 14, y = lerp(0.98, 1.5, u), x = -0.012 * Math.sin(u * Math.PI * 2); const s = sph(x, y, 0.024, bone, 1.3, 0.7, 1); vert.push(s); }
  for (let i = 0; i < 7; i++) { const y = 1.47 - i * 0.05, r = 0.07 + 0.045 * Math.sin((i + 0.6) / 7 * Math.PI) ; const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 28), boneD); t.rotation.x = Math.PI / 2; t.position.set(0, y, 0); t.scale.set(1.15, 0.8, 1); g.add(t); }   // ribs
  cap(0, 1.52, 0, 1.3, 0.012);
  const pel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 28), bone); pel.rotation.x = Math.PI / 2; pel.position.y = 0.93; pel.scale.set(1.2, 0.8, 1); g.add(pel);
  for (const s of [-1, 1]) {                                                                                                // arms and legs
    cap(s * 0.19, 1.47, s * 0.23, 1.12, 0.017); cap(s * 0.23, 1.12, s * 0.22, 0.8, 0.014); sph(s * 0.19, 1.48, 0.03); sph(s * 0.23, 1.12, 0.022);
    cap(s * 0.085, 0.92, s * 0.075, 0.52, 0.026); cap(s * 0.075, 0.52, s * 0.07, 0.1, 0.02); sph(s * 0.075, 0.52, 0.036);    // femur, tibia, knee
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.17), bone); foot.position.set(s * 0.07, 0.03, 0.035); g.add(foot);
  }
  // load glow: blobs at the lumbar spine, pelvis, knees, ankles, plus a thin column of light along spine and legs
  const L = [[0, 1.2, 0.07], [0, 1.02, 0.075], [0, 0.93, 0.09], [-0.075, 0.52, 0.075], [0.075, 0.52, 0.075], [-0.07, 0.06, 0.065], [0.07, 0.06, 0.065]].map(([x, y, r]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), basic(MAG, 0.0, true)); m.position.set(x, y, 0.01); m.userData.r = r; g.add(m); return m; });
  const cols = [[0, 0.95, 1.5], [-0.075, 0.1, 0.9], [0.075, 0.1, 0.9]].map(([x, y0, y1]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(MAG, 0.0, true)); m.position.set(x, (y0 + y1) / 2, 0.02); m.userData.h = y1 - y0; g.add(m); return m; });
  return { group: g, height: 1.7, update: (load, a = 1) => {                                                                // load 1 = today, 2 = doubled ...
    const k = c01((load - 0.6) / 3.4);
    for (const m of L) { m.scale.setScalar(m.userData.r * (0.55 + 1.1 * k)); m.material.opacity = a * (0.15 + 0.65 * k); m.material.color.copy(lerpCol(CY, MAG, k * 1.4)); }
    for (const c of cols) { c.scale.set(0.012 + 0.03 * k, c.userData.h, 0.012 + 0.03 * k); c.material.opacity = a * (0.1 + 0.55 * k); c.material.color.copy(lerpCol(CY, MAG, k * 1.4)); }
  } };
};

// ── a tower: columns (chains of segments that can bow), beams, floor slabs, a foundation, the load path flowing down ──
export const makeTower = (floors = 10) => {
  const g = new THREE.Group(), H = 1.5, FH = H / floors, XS = [-0.2, 0, 0.2], K = 14, NC = XS.length;
  const colI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), NC * K); colI.frustumCulled = false; g.add(colI);
  const beamI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: col("#7fb2ff") }), (NC - 1) * (floors + 1)); beamI.frustumCulled = false; g.add(beamI);
  const slabI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic("#3a5cff", 0.35, true), floors + 1); slabI.frustumCulled = false; g.add(slabI);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), basic(WH, 0.95, true), NC * 10); dots.frustumCulled = false; g.add(dots);
  const found = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: col("#27334f") })); found.position.y = -0.05; g.add(found);
  const fE = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.62, 0.1, 0.3)), new THREE.LineBasicMaterial({ color: col(CY) })); fE.position.y = -0.05; g.add(fE);
  const piles = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 0.7, 1, 8), new THREE.MeshBasicMaterial({ color: col("#3a4b72") }), 5); piles.frustumCulled = false; g.add(piles);
  for (let i = 0; i < 5; i++) { S.set(0.03, 0.34, 0.03); P.set(-0.26 + i * 0.13, -0.27, 0); M4.compose(P, Q.identity(), S); piles.setMatrixAt(i, M4); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.01), basic(CY, 0.8, true)); ground.position.set(0, 0, 0.05); g.add(ground);
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.52, H, 0.3)), new THREE.LineBasicMaterial({ color: col("#4aa8ff"), transparent: true, opacity: 0.45 })); shell.position.y = H / 2; g.add(shell);
  const c1 = new THREE.Color(), cA = new THREE.Color(CY), cB = new THREE.Color(MAG);
  const bowAt = (y, bow) => bow * 0.16 * Math.sin(Math.PI * (y / H) * 0.9 + 0.05);
  return { group: g, height: H, update: (load, bow = 0, t = 0, a = 1) => {
    const k = c01((load - 0.6) / 7.4);
    let n = 0;
    for (let c = 0; c < NC; c++) for (let s = 0; s < K; s++) { const y0 = s * H / K, y1 = (s + 1) * H / K, x0 = XS[c] + bowAt(y0, bow) * (c === 1 ? 1.3 : 1), x1 = XS[c] + bowAt(y1, bow) * (c === 1 ? 1.3 : 1), dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      P.set((x0 + x1) / 2, (y0 + y1) / 2, 0); Q.setFromEuler(E_.set(0, 0, Math.atan2(dx, dy) * -1)); S.set(0.026 + 0.016 * k, len * 1.02, 0.026); M4.compose(P, Q, S); colI.setMatrixAt(n, M4);
      const ym = (y0 + y1) / 2, ld = k * (0.35 + 0.65 * (1 - ym / H)); c1.copy(cA).lerp(cB, c01(ld * 1.5)); c1.multiplyScalar(0.55 + 0.8 * ld); colI.setColorAt(n, c1); n++; }
    colI.instanceMatrix.needsUpdate = true; if (colI.instanceColor) colI.instanceColor.needsUpdate = true;
    n = 0; for (let f = 0; f <= floors; f++) { const y = f * FH; for (let c = 0; c < NC - 1; c++) { const xa = XS[c] + bowAt(y, bow) * (c === 1 ? 1.3 : 1), xb = XS[c + 1] + bowAt(y, bow) * (c + 1 === 1 ? 1.3 : 1); P.set((xa + xb) / 2, y, 0); S.set(Math.abs(xb - xa), 0.012, 0.012); M4.compose(P, Q.identity(), S); beamI.setMatrixAt(n++, M4); } }
    beamI.instanceMatrix.needsUpdate = true;
    for (let f = 0; f <= floors; f++) { const y = f * FH, xo = bowAt(y, bow); P.set(xo, y, 0); S.set(0.5, 0.008, 0.26); M4.compose(P, Q.identity(), S); slabI.setMatrixAt(f, M4); } slabI.instanceMatrix.needsUpdate = true;
    n = 0; for (let c = 0; c < NC; c++) for (let i = 0; i < 10; i++) { const u = ((t * (0.22 + 0.5 * k) + i / 10 + c * 0.13) % 1), y = H * (1 - u); P.set(XS[c] + bowAt(y, bow) * (c === 1 ? 1.3 : 1), y, 0.03); const r = 0.008 + 0.012 * k; S.set(r, r, r); M4.compose(P, Q.identity(), S); dots.setMatrixAt(n++, M4); }
    dots.instanceMatrix.needsUpdate = true; dots.material.opacity = a * (0.25 + 0.7 * k); fE.material.color.copy(c1.copy(cA).lerp(cB, k)); piles.visible = true;
  } };
};

// ── a small city on the globe's curve: boxes with glowing edges, placed by the scene on the sphere ──
export const makeCity = (n = 11) => {
  const g = new THREE.Group(), items = [];
  const bm = new THREE.MeshBasicMaterial({ color: col("#16264d") });
  for (let i = 0; i < n; i++) { const w = 0.03 + 0.025 * rnd(i, 1), h = 0.05 + 0.15 * Math.pow(rnd(i, 2), 1.4), d = 0.03 + 0.02 * rnd(i, 3);
    const grp = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm); box.position.y = h / 2; grp.add(box);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: col(i % 3 === 0 ? MAG : CY), transparent: true, opacity: 0.95 })); e.position.y = h / 2; grp.add(e);
    const wd = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.8), basic("#ffd98a", 0.55, true)); wd.position.set(0, h / 2, d / 2 + 0.001); grp.add(wd);
    g.add(grp); items.push({ grp, h }); }
  return { group: g, items };
};

// ── ocean cross-section under a sky layer: the water goes dark with depth (faster with g); the air layer thins to 1/g and the clouds sink ──
export const makeOcean = () => {
  const g = new THREE.Group(), W = 1.0, D = 1.4, HA = 1.0;
  const wat = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uK: { value: 1 } },
    vertexShader: "varying vec2 q; void main(){ q = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec2 q; uniform float uK; void main(){ float d = 1.0 - q.y; float dark = exp(-d * 1.6 * uK); vec3 c = mix(vec3(0.0, 0.01, 0.05), vec3(0.1, 0.62, 1.0), dark); float line = smoothstep(0.985, 1.0, fract(d * 10.0)) * 0.25; gl_FragColor = vec4(c + vec3(0.2, 0.5, 1.0) * line * dark, 0.92); }" }));
  wat.position.y = -D / 2; g.add(wat);
  const air = new THREE.Mesh(new THREE.PlaneGeometry(W, HA, 1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uH: { value: 1 } },
    vertexShader: "varying vec2 q; void main(){ q = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec2 q; uniform float uH; void main(){ float y = q.y * 1.0; float inside = step(y, uH); float a = (0.5 - 0.35 * y / max(uH, 0.001)) * inside; gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * 1.0, a * 0.75); }" }));
  air.position.y = HA / 2; air.geometry.translate(0, 0, 0); g.add(air);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.012), basic(WH, 0.9, true)); g.add(surf);
  const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), basic("#cfe6ff", 0.32, true), 7); clouds.frustumCulled = false; g.add(clouds);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(MAG, 0.9, true), 9); bars.frustumCulled = false; g.add(bars);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, D + HA)), new THREE.LineBasicMaterial({ color: col(CY), transparent: true, opacity: 0.5 })); edge.position.y = (HA - D) / 2; g.add(edge);
  return { group: g, update: (load, t = 0) => {
    wat.material.uniforms.uK.value = Math.pow(load, 0.55); const Ha = HA / Math.pow(load, 0.6); air.material.uniforms.uH.value = Ha / HA;
    for (let i = 0; i < 7; i++) { const ys = 0.04 + (0.9 * (0.25 + 0.75 * rnd(i, 4))) / Math.pow(load, 0.6), x = (rnd(i, 5) - 0.5) * 0.8 + 0.02 * Math.sin(t * 0.7 + i); P.set(x, Math.min(ys, Ha - 0.02), 0.01); S.set(0.07 + 0.05 * rnd(i, 6), 0.025 + 0.02 * rnd(i, 7), 0.02); M4.compose(P, Q.identity(), S); clouds.setMatrixAt(i, M4); }
    clouds.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 9; i++) { const y = -(i + 0.5) * D / 9, len = 0.03 + 0.07 * Math.min(4, Math.pow(load, 0.7)) * (i + 1) / 9 * 1.0; P.set(W / 2 + len / 2 + 0.01, y, 0); S.set(len, 0.012, 0.012); M4.compose(P, Q.identity(), S); bars.setMatrixAt(i, M4); }
    bars.instanceMatrix.needsUpdate = true;
  } };
};

// ── a cracking mountain ledge: faceted peaks with glowing edges, a ledge jutting from the main peak; a crack grows across it, then the tip lets go and falls ──
export const makeMountain = () => {
  const g = new THREE.Group(), fill = new THREE.MeshBasicMaterial({ color: col("#0f1b3d"), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const peak = (x, z, r, h, rot) => { const geo = new THREE.ConeGeometry(r, h, 6, 1); const m = new THREE.Mesh(geo, fill); m.position.set(x, h / 2, z); m.rotation.y = rot; g.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col(CY), transparent: true, opacity: 0.85 })); e.position.copy(m.position); e.rotation.copy(m.rotation); g.add(e); };
  peak(-0.05, -0.05, 0.5, 1.0, 0.3); peak(-0.55, -0.2, 0.38, 0.62, 0.9); peak(0.5, -0.25, 0.34, 0.5, 0.1);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.012), basic(CY, 0.8, true)); ground.position.set(0, 0.0, 0.2); g.add(ground);
  // the ledge: a base block fixed to the peak and a tip block that lets go
  const LB = new THREE.BoxGeometry(0.32, 0.08, 0.3), LT = new THREE.BoxGeometry(0.28, 0.08, 0.3);
  const base = new THREE.Mesh(LB, fill); base.position.set(0.3, 0.46, 0.22); g.add(base);
  const baseE = new THREE.LineSegments(new THREE.EdgesGeometry(LB), new THREE.LineBasicMaterial({ color: col(WH), transparent: true, opacity: 0.9 })); baseE.position.copy(base.position); g.add(baseE);
  const tip = new THREE.Group(); tip.position.set(0.6, 0.46, 0.22); g.add(tip); const tipM = new THREE.Mesh(LT, fill); tip.add(tipM);
  const tipE = new THREE.LineSegments(new THREE.EdgesGeometry(LT), new THREE.LineBasicMaterial({ color: col(WH), transparent: true, opacity: 0.9 })); tip.add(tipE);
  // the crack: a jagged line down the ledge's front face where base and tip meet, and a glow behind it
  const pts = []; const NP = 14; for (let i = 0; i <= NP; i++) { const u = i / NP; pts.push(new THREE.Vector3(0.46 + 0.035 * Math.sin(u * 11) + 0.02 * (rnd(i, 9) - 0.5), 0.5 - 0.08 * u, 0.375)); }
  const cg = new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => (i ? [pts[i - 1], p] : []))); const cm = new THREE.LineBasicMaterial({ color: col(MAG), transparent: true, opacity: 1, depthTest: false });
  const crack = new THREE.LineSegments(cg, cm); crack.renderOrder = 6; g.add(crack);
  const glowL = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
    vertexShader: "varying vec2 q; void main(){ q = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }", fragmentShader: "varying vec2 q; uniform float uK; void main(){ float d = length(q); gl_FragColor = vec4(vec3(1.0, 0.35, 1.0) * exp(-d * d * 7.0) * uK, 1.0); }" }));
  glowL.position.set(0.46, 0.46, 0.4); glowL.scale.setScalar(0.2); glowL.renderOrder = 5; g.add(glowL);
  const frag = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: col("#8aa2e0") }), 12); frag.frustumCulled = false; g.add(frag);
  return { group: g, update: (u, t = 0, ft = 0) => {                                                                  // u: crack progress 0..1; ft: seconds since the tip let go
    const n = Math.floor(c01(u) * NP) * 2; cg.setDrawRange(0, n); glowL.material.uniforms.uK.value = 0.9 * c01(u * 1.3) * (0.75 + 0.25 * Math.sin(t * 22)) * (ft > 0.25 ? 0.4 : 1);
    const f = Math.max(0, ft); tip.position.set(0.6 + 0.05 * f, 0.46 - 2.4 * f * f, 0.22 + 0.04 * f); tip.rotation.set(0.5 * f, 0.4 * f, -1.4 * f * f);
    for (let i = 0; i < 12; i++) { const y = 0.5 - 2.2 * f * f * (0.8 + 0.4 * rnd(i, 3)) + 0.05 * rnd(i, 1), s = 0.012 + 0.02 * rnd(i, 4), vis = ft > 0.02 && y > -0.1 ? 1 : 0;
      P.set(0.46 + 0.3 * (rnd(i, 2) - 0.3) * f * 1.3, y, 0.3 + 0.1 * rnd(i, 5)); S.setScalar(s * vis); M4.compose(P, Q.setFromEuler(E_.set(f * 3 * rnd(i, 6), f * 4 * rnd(i, 7), 0)), S); frag.setMatrixAt(i, M4); }
    frag.instanceMatrix.needsUpdate = true;
  } };
};

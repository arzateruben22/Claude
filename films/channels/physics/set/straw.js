// straw.js — the straw episode's blocks (films/channels/physics/set; bible §5 "a liquid column and a glass shader"), in
// centimetres. Glass without the costly transmission material: a lit, nearly clear standard material whose alpha and
// brightness rise at grazing angles (a Fresnel rim) plus a thin highlight stripe, so a glass reads on the pale cyc.
// A liquid column is a unit cylinder scaled along its tube. The hydrostatics are the helpers below (h = Δp / ρg).
//
//   import { glassMat, createGlass, createStraw, createJar, createHouse, createBubbles, inkBarometer, liftCm, hpaFor } from "../set/straw.js";
//   const G = createGlass({ r: 4, h: 13, x, y, z }); G.setWater(11)        // water depth (cm) above the inside bottom
//   const S = createStraw({ a: [x, y, z], b: [x, y, z], r: 0.35 }); S.fill(yTop)   // the column up to world height yTop
//   const J = createJar({ r: 9, h: 24 }); J.group.position.set(…)            // a bell jar (straw hole in its top)
//   const Hs = createHouse(I, { x, z, storeys: 3, storey: 340, w: 300, roof: "flat" | gable, scaleX, scaleY0 })   // an ink house front with metre ticks
//   const B = createBubbles({ n: 14, seed }); B.update(t, [x, y, z], r, k)    // boiling under a meniscus at y (k 0–1)
//   const T = inkBarometer(I, { x, y, z, s })                                  // Torricelli's tube: 76 cm of mercury, empty above
//   const Ld = createLid({ r: 4.2, hole: 0.4 }); Ld.group.position.set(x, yTop, z)   // a screw lid with a grommet for the straw
//   inkDash(I, x0, y0, x1, y1, { dash, gap, w, m })                           // a dashed ink line (a group)
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { albedo } from "./aces.js";

export const P0 = 1013.25;                                // hPa, standard sea-level pressure (NOAA)
export const PV20 = 23.39;                                // hPa, water's vapour pressure at 20 °C (LibreTexts S3)
const RHO = 998.2, GG = 9.81;                             // kg/m³ (20 °C), m/s²
export const liftCm = (dpHpa) => ((dpHpa * 100) / (RHO * GG)) * 100;   // the column a pressure difference holds
export const hpaFor = (hCm) => (RHO * GG * (hCm / 100)) / 100;          // the pressure difference a column needs

// ── glass: lit, nearly clear, brighter and more opaque at grazing angles, one highlight stripe ──
export const glassMat = (o = {}) => {
  const m = new THREE.MeshStandardMaterial({ color: albedo(o.tint || "#F4F7F8"), roughness: o.roughness ?? 0.12, metalness: 0,
    transparent: true, opacity: o.alpha ?? 0.1, depthWrite: false, side: o.side ?? THREE.DoubleSide });
  const rimA = (o.rim ?? 0.55).toFixed(3), rimL = (o.rimLight ?? 0.32).toFixed(3), stripe = (o.stripe ?? 0.35).toFixed(3);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `
      { vec3 vv = normalize(vViewPosition); vec3 nn = normalize(normal);
        float fres = pow(1.0 - abs(dot(nn, vv)), 2.6);
        float sx = nn.x * (gl_FrontFacing ? 1.0 : -1.0);
        float strip = smoothstep(0.42, 0.5, sx) * (1.0 - smoothstep(0.58, 0.66, sx));
        outgoingLight += vec3(fres * ${rimL} + strip * ${stripe});
        diffuseColor.a = clamp(diffuseColor.a + fres * ${rimA} + strip * ${stripe} * 0.6, 0.0, 0.92); }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `rf-glass-${rimA}-${rimL}-${stripe}`;
  return m;
};
export const waterMat = (o = {}) => new THREE.MeshStandardMaterial({ color: albedo(o.color || "#6FA6C9"), roughness: 0.25, metalness: 0,
  transparent: true, opacity: o.alpha ?? 0.78, depthWrite: false });

// ── a drinking glass with water: an open tube, a thick base, the water body and its surface ──
export const createGlass = (o = {}) => {
  const r = o.r ?? 4, h = o.h ?? 13, base = o.base ?? 1.2, group = new THREE.Group();
  group.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  const gm = glassMat(o.glass), wm = waterMat(o.water);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, h, 40, 1, true), gm); wall.position.y = h / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, base, 40), gm); foot.position.y = base / 2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 48), gm); lip.rotation.x = Math.PI / 2; lip.position.y = h;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40), wm);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1, 40), waterMat({ color: o.water?.top || "#8DBBD8", alpha: 0.85 })); top.rotation.x = -Math.PI / 2;
  group.add(body, top, wall, foot, lip);                 // water first: the glass draws over it (sortObjects is off)
  const radiusAt = (y) => r * 0.9 + (r - r * 0.9) * (y / h) - 0.25;
  const setWater = (d) => {
    const y1 = base + Math.max(0.01, d), rm = radiusAt((base + y1) / 2);
    body.scale.set(rm, y1 - base, rm); body.position.y = (base + y1) / 2;
    const rt = radiusAt(y1); top.scale.set(rt, rt, 1); top.position.y = y1;
    return y1;
  };
  setWater(o.depth ?? h * 0.8);
  return { group, wall, body, top, setWater, surfaceY: (d) => group.position.y + base + d, r, h };
};

// ── a straight straw (or a tall pipe) from a (its bottom) to b, with a liquid column from a up to world height y ──
export const createStraw = (o = {}) => {
  const a = new THREE.Vector3(...o.a), b = new THREE.Vector3(...o.b), r = o.r ?? 0.35, group = new THREE.Group();
  const d = b.clone().sub(a), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, o.seg ?? 20, 1, true), glassMat({ alpha: o.alpha ?? 0.16, rim: 0.7, stripe: 0.45, ...o.glass }));
  tube.position.copy(a).add(b).multiplyScalar(0.5); tube.quaternion.copy(q);
  const colM = new THREE.MeshStandardMaterial({ color: albedo(o.color || "#3F86B5"), roughness: 0.3, metalness: 0, transparent: true, opacity: o.colAlpha ?? 0.92, depthWrite: false });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, 1, o.seg ?? 20), colM); col.quaternion.copy(q);
  const men = new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, o.seg ?? 20), new THREE.MeshStandardMaterial({ color: albedo(o.top || "#9CC6DE"), roughness: 0.2, transparent: true, opacity: 0.95, depthWrite: false }));
  men.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  group.add(col, men, tube);
  const dy = b.y - a.y;
  const fill = (yTop) => {                                // the column from a up to world height yTop (clamped to the tube)
    const u = Math.max(0, Math.min(1, (yTop - a.y) / dy)), l = Math.max(0.01, u * L);
    col.scale.set(1, l, 1); col.position.copy(a).addScaledVector(d, (u / 2));
    men.position.copy(a).addScaledVector(d, u); col.visible = men.visible = u > 0.0005;
    return u;
  };
  const at = (u) => a.clone().addScaledVector(d, u).toArray();
  fill(a.y);
  return { group, tube, col, men, fill, at, a: a.toArray(), b: b.toArray(), L, r };
};

// ── a bell jar: a glass cylinder with a dome, a rubber seal ring, a hole for the straw on top ──
export const createJar = (o = {}) => {
  const r = o.r ?? 9, h = o.h ?? 24, group = new THREE.Group(), gm = glassMat({ alpha: 0.08, rim: 0.6, stripe: 0.4 });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h - r * 0.5, 48, 1, true), gm); wall.position.y = (h - r * 0.5) / 2;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.32), gm);
  dome.scale.y = 0.55 / 0.48; dome.position.y = h - r * 0.5 - r * Math.cos(Math.PI * 0.32) * (0.55 / 0.48);
  const seal = new THREE.Mesh(new THREE.TorusGeometry(r + 0.3, 0.55, 8, 48), new THREE.MeshStandardMaterial({ color: albedo("#3A3C42"), roughness: 0.8 }));
  seal.rotation.x = Math.PI / 2; seal.position.y = 0.4;
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.6, 20), new THREE.MeshStandardMaterial({ color: albedo("#3A3C42"), roughness: 0.8 }));
  plug.position.y = h - 0.2;
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 14), new THREE.MeshStandardMaterial({ color: albedo("#3A3C42"), roughness: 0.8 }));
  port.rotation.z = Math.PI / 2; port.position.set(r + 1.2, 4, 0);
  group.add(wall, dome, seal, plug, port);
  return { group, r, h, portAt: () => [r + 2.7, 4, 0] };
};

// ── a hand vacuum pump on the floor with its hose (a tube along a sagging curve) ──
export const createPump = (o = {}) => {                   // o: { x, y, z, s (scale) }
  const group = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: albedo("#5A5F69"), roughness: 0.5, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: albedo("#2A2B2F"), roughness: 0.7 });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 26, 24), body); cyl.position.y = 15;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 9), dark); foot.position.y = 1;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 14, 10), body); rod.position.y = 33;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 16, 12), dark); handle.rotation.z = Math.PI / 2; handle.position.y = 40;
  group.add(cyl, foot, rod, handle);
  group.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0); const sc = o.s ?? 1; group.scale.setScalar(sc);
  const hoseMat = new THREE.MeshStandardMaterial({ color: albedo("#2F3238"), roughness: 0.8 });
  let hose = null;
  const connect = (p0, p1, sag = 18) => {                 // world points: pump outlet → jar port
    if (hose) { group.parent && group.parent.remove(hose); hose.geometry.dispose(); }
    const m = new THREE.Vector3(...p0).add(new THREE.Vector3(...p1)).multiplyScalar(0.5); m.y -= sag;
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...p0), m, new THREE.Vector3(...p1));
    hose = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.75, 10, false), hoseMat);
    return hose;
  };
  const pumpAt = (u) => { rod.position.y = 33 - 6 * u; handle.position.y = 40 - 6 * u; };   // u 0–1: the stroke
  return { group, connect, pumpAt, outlet: () => [group.position.x, group.position.y + 24 * sc, group.position.z + 3.2 * sc] };
};

// ── an ink house front: storeys, windows, a door, a roof line, and a metre scale up one edge ──
export const createHouse = (I, o = {}) => {
  const n = o.storeys ?? 3, sh = o.storey ?? 340, w = o.w ?? 300, x0 = -w / 2, g = new THREE.Group(), Ht = n * sh;
  g.add(I.poly([[x0, 0], [x0, Ht], [x0 + w, Ht], [x0 + w, 0]], 1.6));                       // the walls
  if (o.roof === "flat") g.add(I.poly([[x0 - 8, Ht], [x0 - 8, Ht + 28], [x0 + w + 8, Ht + 28], [x0 + w + 8, Ht]], 1.6));   // a flat roof's parapet
  else g.add(I.poly([[x0 - 14, Ht], [x0 + w / 2, Ht + 110], [x0 + w + 14, Ht]], 1.6));        // the roof
  for (let k = 1; k < n; k++) g.add(I.bar(x0, k * sh, x0 + w, k * sh, 0.8));                  // the floors
  for (let k = 0; k < n; k++) {                                                               // two windows a storey
    [0.3, 0.72].forEach((fx, j) => {
      if (k === 0 && j === 0) return;                                                         // the door's place
      const cx = x0 + w * fx, cy = k * sh + sh * 0.45, ww = 56, wh = 110;
      g.add(I.poly([[cx - ww / 2, cy - wh / 2], [cx - ww / 2, cy + wh / 2], [cx + ww / 2, cy + wh / 2], [cx + ww / 2, cy - wh / 2]], 1.0, true));
      g.add(I.bar(cx, cy - wh / 2, cx, cy + wh / 2, 0.6)); g.add(I.bar(cx - ww / 2, cy, cx + ww / 2, cy, 0.6));
    });
  }
  { const cx = x0 + w * 0.3; g.add(I.poly([[cx - 40, 0], [cx - 40, 210], [cx + 40, 210], [cx + 40, 0]], 1.1)); }   // the door
  const sx = o.scaleX ?? x0 + w + 26, z0 = o.scaleY0 ?? 0;                                    // the metre scale, its zero at scaleY0 (a drink's surface)
  if (o.scale !== false) {
    g.add(I.bar(sx, z0, sx, z0 + Math.ceil((Ht - z0) / 100) * 100 + 40, 0.9));
    for (let m = 0; z0 + m * 100 <= Ht + 60; m++) g.add(I.bar(sx, z0 + m * 100, sx + (m % 5 === 0 ? 16 : 9), z0 + m * 100, m % 5 === 0 ? 1.2 : 0.8));
  }
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  return { group: g, height: Ht, scaleX: sx, scaleY0: z0 };
};

// ── boiling: small vapour bubbles born under a meniscus, swelling as they rise, bursting at the surface ──
export const createBubbles = (o = {}) => {
  const n = o.n ?? 14, R = rng(o.seed ?? 1644), g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: albedo("#F2F6F8"), roughness: 0.15, transparent: true, opacity: 0.85, depthWrite: false });
  const geo = new THREE.SphereGeometry(1, 12, 8), ms = [];
  const P = Array.from({ length: n }, () => ({ ph: R(), per: 0.55 + R() * 0.6, ax: R() * 2 - 1, az: R() * 2 - 1, depth: 0.5 + R() * 0.5, s: 0.6 + R() * 0.5 }));
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); g.add(m); ms.push(m); }
  const update = (t, top, r, k = 1, depthCm = 6) => {    // top: the meniscus centre [x, y, z]; r: the tube's inner radius
    for (let i = 0; i < n; i++) {
      const p = P[i], u = ((t / p.per + p.ph) % 1 + 1) % 1, m = ms[i];
      const on = k > (i + 0.5) / n;
      m.visible = on;
      if (!on) continue;
      const y = top[1] - depthCm * p.depth * (1 - u), sz = r * 0.32 * p.s * (0.35 + 0.65 * u) * (u > 0.93 ? (1 - u) / 0.07 : 1);
      m.position.set(top[0] + p.ax * Math.min(r * 0.45, o.spread ?? Infinity), y, top[2] + p.az * Math.min(r * 0.45, o.spread ?? Infinity)); m.scale.setScalar(Math.max(0.01, sz));
    }
  };
  return { group: g, update };
};

// ── Torricelli's tube in ink: a dish of mercury, a sealed tube about a metre long, 76 cm of mercury, empty above ──
export const inkBarometer = (I, o = {}) => {
  const s = o.s ?? 1, g = new THREE.Group(), hg = new THREE.MeshBasicMaterial({ color: I.mat.color.clone().multiplyScalar(0.55), transparent: true, opacity: 1, depthWrite: false });
  g.add(I.poly([[-22, 12], [-20, 0], [20, 0], [22, 12]].map(([x, y]) => [x * s, y * s]), 1.1 * s));                          // the dish
  g.add(I.bar(-21 * s, 7 * s, 21 * s, 7 * s, 0.6 * s));                                                                       // the dish's mercury level
  g.add(I.poly([[-2.4, 3], [-2.4, 103], [2.4, 103], [2.4, 3]].map(([x, y]) => [x * s, y * s]), 0.8 * s));                    // the tube, sealed at the top
  const col = new THREE.Mesh(new THREE.BoxGeometry(3.6 * s, 76 * s, 0.4), hg); col.position.set(0, (7 + 38) * s, 0);           // 76 cm above the dish's level
  g.add(col);
  [0, 76].forEach((y) => g.add(I.bar(9 * s, (7 + y) * s, 15 * s, (7 + y) * s, 0.7 * s)));                                   // the measure ticks
  g.add(I.bar(12 * s, 7 * s, 12 * s, 83 * s, 0.5 * s));
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  const opacity = (k) => { hg.opacity = k; };
  return { group: g, opacity, topY: (83) * s, tickX: 15 * s };
};

// ── a small wooden table (the bench's own furniture, not the lab bench): a top and four legs ──
export const createTable = (o = {}) => {
  const w = o.w ?? 70, d = o.d ?? 36, h = o.h ?? 80, t = 3, g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: albedo(o.color || "#A88A62"), roughness: 0.7, metalness: 0 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), wood); top.position.y = h - t / 2;
  g.add(top);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3.2, h - t, 3.2), wood); leg.position.set(sx * (w / 2 - 3), (h - t) / 2, sz * (d / 2 - 3)); g.add(leg);
  });
  g.position.set(o.x ?? 0, 0, o.z ?? 0);
  return { group: g, topY: h };
};

// ── a screw lid: a thin metal disc with a knurled rim and a rubber grommet round the straw's hole ──
export const createLid = (o = {}) => {
  const r = o.r ?? 4.2, hole = o.hole ?? 0.4, g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: albedo(o.color || "#8C9198"), roughness: 0.38, metalness: 0.55 });
  const rub = new THREE.MeshStandardMaterial({ color: albedo("#2F3136"), roughness: 0.85 });
  const disc = new THREE.Mesh(new THREE.RingGeometry(hole + 0.35, r, 40, 1), metal); disc.rotation.x = -Math.PI / 2; disc.position.y = 1.1;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.2, 40, 1, true), metal); skirt.position.y = 0.55;
  const grom = new THREE.Mesh(new THREE.TorusGeometry(hole + 0.22, 0.2, 8, 20), rub); grom.rotation.x = Math.PI / 2; grom.position.y = 1.2;
  g.add(disc, skirt, grom);
  return { group: g };
};

// ── a dashed ink line between two points (in the drawing's plane) ──
export const inkDash = (I, x0, y0, x1, y1, o = {}) => {
  const g = new THREE.Group(), L = Math.hypot(x1 - x0, y1 - y0), d = o.dash ?? 6, q = o.gap ?? 4, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  for (let s = 0; s < L; s += d + q) { const e = Math.min(L, s + d); g.add(I.bar(x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e, o.w ?? 0.9, o.m)); }
  return g;
};

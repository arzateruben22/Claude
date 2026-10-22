// rbc.js — the red blood cell (films/channels/body/set): its biconcave shape, its fold into a parachute,
// and its materials. Used by the cell stream (B2: one InstancedMesh, folded in the vertex shader per
// instance) and by the hero (a cutaway.js shell, folded on the CPU so the finish's depth pass sees it).
//
// Shape: Evans & Fung (1972), the standard fit of a red cell's profile, scaled to a 7.5 µm diameter
// (claims.json c2 says a scale pill reads 7.5 µm): half-thickness
//     h(ρ) = ½ · k · √(1 − x²) · (C0 + C2 x² + C4 x⁴),   x = ρ / R,  R = 3.75 µm,  k = 3.75 / 3.91
// with C0 0.81, C2 7.83, C4 −4.39 µm: 0.78 µm thick at the centre (the dimple), 2.5 µm at the rim.
// One world unit is 1 µm. The cell's axis is local +y.
//
// The fold. A disc facing the flow bends its rim backwards into a cup, the parachute (Noguchi & Gompper,
// claims.json c9). The mid-surface is mapped onto a capsule of curvature k (a hemisphere of radius 1/k on
// a cylinder) keeping arc length along every meridian, so the membrane bends without stretching (claims
// c7): a point at distance s from the centre goes to angle α = k·s on the cap (or down the cylinder past
// s = π/2k). The thickness thins a little as it folds (th), so a cell can pass a 3 µm vessel. The cup
// opens toward −y; the cell travels toward +y, convex nose first. Its centre stays on its path.
//
// rbcGeometry(THREE, { around = 22, along = 18 }) → a closed BufferGeometry (rest shape)
// rbcRadial(dir) → r: the rest shell along a unit direction (for cutaway.js; star-shaped about the centre)
// halfThick(rho) → h(ρ)
// fold(p, n, k, th) → { p, n }: the fold of a rest point and its normal (CPU; the same maths as FOLD_GLSL)
// foldFor(rt, margin) → { k, th }: the least fold that fits a vessel of radius rt (0 when a flat cell fits)
// outerRadius(k, th) → the folded cell's largest distance from its axis
// cellMaterial(THREE, L, o) → an instanced MeshStandardMaterial with the fold (attribute aFold = [k, th])
// heroDeform(k, th) → a deform for cutaway.js (with a key, so a still cell is not recomputed)

export const R = 3.75;
const KS = 3.75 / 3.91, C0 = 0.81, C2 = 7.83, C4 = -4.39;
export const halfThick = (rho) => { const x = Math.min(1, Math.abs(rho) / R); return 0.5 * KS * Math.sqrt(Math.max(0, 1 - x * x)) * (C0 + C2 * x * x + C4 * x ** 4); };
export const H_MAX = (() => { let m = 0; for (let i = 0; i <= 400; i++) m = Math.max(m, halfThick((i / 400) * R)); return m; })();

export const rbcRadial = (d) => {
  const st = Math.hypot(d[0], d[2]), ct = Math.abs(d[1]);
  // h(r·sinθ) − r·|cosθ| > 0 inside; one crossing (h(ρ)/ρ falls monotonically)
  let lo = 0, hi = st > 1e-9 ? R / st : H_MAX * 1.01;
  hi = Math.min(hi, 20);
  for (let it = 0; it < 48; it++) { const m = (lo + hi) / 2; if (halfThick(m * st) - m * ct > 0 && m * st < R) lo = m; else hi = m; }
  return lo;
};

export const rbcGeometry = (THREE, o = {}) => {
  const na = o.around ?? 22, nu = o.along ?? 18;
  const pos = [], nor = [], idx = [];
  // u: 0 (top pole) → π (bottom pole), ρ = R sin u, y = ½ k cos u (C0 + C2 sin²u + C4 sin⁴u)
  const prof = (u) => { const s = Math.sin(u), c = Math.cos(u), q = C0 + C2 * s * s + C4 * s ** 4; return [R * s, 0.5 * KS * c * q]; };
  for (let j = 0; j <= nu; j++) {
    // denser near the rim, where the curvature is highest
    const v = j / nu, u = Math.PI * (v - (0.18 / Math.PI) * Math.sin(2 * Math.PI * v));
    const [rho, y] = prof(u), e = 1e-4, a = prof(u - e), b = prof(u + e);
    let tr = b[0] - a[0], ty = b[1] - a[1];
    let nr = -ty, ny = tr; const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
    if (j === 0) { nr = 0; ny = 1; } if (j === nu) { nr = 0; ny = -1; }
    for (let i = 0; i <= na; i++) {
      const ph = (i / na) * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
      pos.push(rho * c, y, rho * s); nor.push(nr * c, ny, nr * s);
    }
  }
  for (let j = 0; j < nu; j++) for (let i = 0; i < na; i++) {
    const a = j * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1;
    if (j > 0) idx.push(a, b, c);
    if (j < nu - 1) idx.push(b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
};

// ── the fold (CPU) ───────────────────────────────────────────────────────────
const mid = (s, k) => {
  if (k < 1e-5) return [s, 0, 0];
  const sc = Math.PI / (2 * k);
  if (s <= sc) { const a = k * s; return [Math.sin(a) / k, -(1 - Math.cos(a)) / k, a]; }
  return [1 / k, -1 / k - (s - sc), Math.PI / 2];
};
// the folded cell is re-centred: half the rim's trailing distance is moved forward, so the nose and the
// rim sit about evenly either side of the cell's place on its path
const shiftFor = (k) => (k < 1e-5 ? 0 : -0.5 * mid(R, k)[1]);
export const fold = (p, n, k, th = 1) => {
  if (k < 1e-5 && th === 1) return { p, n };
  const rho = Math.hypot(p[0], p[2]), dx = rho > 1e-9 ? p[0] / rho : 1, dz = rho > 1e-9 ? p[2] / rho : 0;
  const [rm, ym, a] = mid(rho, k), off = p[1] * th, sa = Math.sin(a), ca = Math.cos(a);
  const r2 = rm + off * sa, y2 = ym + off * ca + shiftFor(k);
  const nr = n[0] * dx + n[2] * dz, nphi = -n[0] * dz + n[2] * dx, ny = n[1];
  const nr2 = nr * ca + ny * sa, ny2 = -nr * sa + ny * ca;
  return { p: [r2 * dx, y2, r2 * dz], n: [nr2 * dx - nphi * dz, ny2, nr2 * dz + nphi * dx] };
};
export const outerRadius = (k, th) => {
  let m = 0;
  for (let i = 0; i <= 40; i++) {
    const s = (i / 40) * R, [rm, , a] = mid(s, k), h = halfThick(s) * th, sa = Math.sin(a);
    m = Math.max(m, rm + h * sa, rm - h * sa);
  }
  return m;
};
export const thinFor = (k) => 1 - 0.45 * Math.min(1, k / 1.1);
export const foldFor = (rt, margin = 0.3) => {
  const room = rt - margin;
  if (outerRadius(0, 1) <= room) return { k: 0, th: 1 };
  let lo = 0, hi = 3;
  for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (outerRadius(m, thinFor(m)) <= room) hi = m; else lo = m; }
  return { k: hi, th: thinFor(hi) };
};

// the same maths in GLSL, for the instanced stream (aFold = [k, th])
export const FOLD_GLSL = `
  attribute vec2 aFold;
  vec3 rbcMid(float s, float k) {
    if (k < 1e-5) return vec3(s, 0.0, 0.0);
    float sc = 1.5707963 / k;
    if (s <= sc) { float a = k * s; return vec3(sin(a) / k, -(1.0 - cos(a)) / k, a); }
    return vec3(1.0 / k, -1.0 / k - (s - sc), 1.5707963);
  }
  void rbcFold(inout vec3 p, inout vec3 n, float k, float th) {
    float rho = length(p.xz);
    vec2 d = rho > 1e-6 ? p.xz / rho : vec2(1.0, 0.0);
    vec3 m = rbcMid(rho, k);
    float off = p.y * th, sa = sin(m.z), ca = cos(m.z);
    float r2 = m.x + off * sa;
    vec3 mr = rbcMid(${R.toFixed(4)}, k);
    float y2 = m.y + off * ca - 0.5 * mr.y * step(1e-5, k);
    float nr = dot(n.xz, d), nphi = -n.x * d.y + n.z * d.x, ny = n.y;
    float nr2 = nr * ca + ny * sa, ny2 = -nr * sa + ny * ca;
    p = vec3(r2 * d.x, y2, r2 * d.y);
    n = vec3(nr2 * d.x - nphi * d.y, ny2, nr2 * d.y + nphi * d.x);
  }`;

// the instanced cell: rbc → rbc-deep toward the thin centre (the dimple reads), fresnel rim, backdrop fog
export const cellMaterial = (THREE, L, o = {}) => {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: o.roughness ?? 0.42, metalness: 0 });
  const rim = L.lin(o.rbc || "#E5334F"), deep = L.lin(o.deep || "#8E2A3F");
  L.patch(m, { fresnel: o.fresnel ?? 0.22, key: "cell" + (o.instanced === false ? "-solo" : "") });
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.uRim = { value: rim }; sh.uniforms.uDeep = { value: deep };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + (o.instanced === false ? FOLD_GLSL.replace("attribute vec2 aFold;", "") : FOLD_GLSL) + "\nvarying float vPallor;")
      .replace("#include <beginnormal_vertex>", `vec3 objectNormal = vec3(normal);
        vec3 rbcP = position;
        vPallor = 1.0 - smoothstep(0.25, 0.8, length(position.xz) / ${R.toFixed(4)});
        ${o.instanced === false ? "" : "rbcFold(rbcP, objectNormal, aFold.x, aFold.y);"}
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace("#include <begin_vertex>", "vec3 transformed = rbcP;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim, uDeep; varying float vPallor;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= mix(uRim, uDeep, vPallor * 0.62);");
  };
  return m;
};

export const heroDeform = (k, th) => {
  const f = (p, n) => fold(p, n, k, th);
  f.key = [+k.toFixed(5), +th.toFixed(5)];
  return k < 1e-5 && th === 1 ? null : f;
};

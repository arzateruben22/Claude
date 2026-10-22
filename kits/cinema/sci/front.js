// front.js — expanding rings and shells for the science films (kits/cinema/sci): r = c·(t − t_emit),
// the retarded-time helpers that go with them, and screen-space ribbons (arcs and segments of constant
// pixel width) to draw them. Brand-neutral: colours come in as numbers or CSS-style hex from the scene.
// Used by: space (light and gravity fronts, orbits and trails), physics (wave fields), body (nerve
// front, pulse wave). A plain ES module; it imports three.js through the page's import map.
//
// ── the math (pure, no three.js; times in whatever clock the scene keeps, usually scene time τ) ──
//   radius(t, { c, t0 })          the front's radius at t: max(0, c·(t − t0))
//   arrival(dist, { c, t0 })      when the front emitted at t0 reaches dist: t0 + dist / c
//   retarded(t, dist, c)          the source time an observer at dist sees at t: t − dist / c
//   seen(history, dist, c)        a source's history as seen from dist: (t) => history(t − dist / c)
//   train(t, { c, period, from, to, rMax, phase })
//                                 a periodic emission: one front every `period` from `from` to `to`
//                                 (the source switched on at from, off at to); returns the fronts alive
//                                 at t, [{ k, t0, r }], newest first. The last one emitted before `to` is
//                                 the "last light": nothing follows it.
//   step(x, w)                    a smoothed step 0 → 1 over [0, w] (a front that is w wide, so it never aliases)
//
// ── meshes (three.js) ──
//   ribbon(o)  → R: a line of constant pixel width, drawn as a camera-facing strip whose width is set in
//              the vertex shader in screen pixels (so a ring 2 px wide stays 2 px from any distance, in
//              any tier: widths are px at a 1080-px short side and scale with the frame).
//     o: { kind: "arc" | "seg", segments: 256, color: 0xRRGGBB | "#hex" | [r, g, b] (linear, may exceed 1
//          for bloom), opacity: 1, width: 3 (px), dash: 0 (dashes around a full turn for an arc, or per
//          unit length for a segment), duty: 0.55, fade: [a0, a1] (opacity at the start and the end of the
//          line: a trail), additive: true, depthTest: true, W, H (the frame; default window.W, window.H) }
//     R.mesh                        the THREE.Mesh (add it to any group: centre and radius are in that group's units)
//     R.arc({ center, r, a0, a1, e1, e2 })   a circle arc: centre [x,y,z], radius, angles (radians) from a0 to a1
//                                   in the plane spanned by e1 and e2 (default the xz plane: e1 +x, e2 +z)
//     R.seg(a, b)                   a straight segment from a to b
//     R.set({ opacity, color, width, dash, fade })
//     R.point(angle or u)           a point on the line in its group's units (for labels: group.localToWorld)
//   ring(o) is ribbon({ kind: "arc", ...o }); segment(o) is ribbon({ kind: "seg", ...o }).
//   shell(o)  → a sphere drawn as a soft rim (brightest at its silhouette), for 3D shells: { color, opacity, power }
//              S.mesh, S.set({ center, r, opacity })
//
// ── the motion-blur probe ──
//   kits/cinema/cinema3d.js decides how many sub-frames a frame needs (K) from how far MESH ORIGINS move
//   on screen across the shutter. A ring that grows about a fixed centre, or a ribbon whose shape comes
//   from uniforms, moves no origin, so the probe never sees it. probes(group, n) adds n invisible meshes
//   (material.visible = false: never drawn, but probed) and returns place(points): put them on the moving
//   edge each seek, and the probe measures the edge's real travel. Keep them in front of the camera: a
//   probe at or behind the lens projects to nonsense, so place() hides any probe you pass as null.
//
// Everything is a pure function of what the scene passes in; nothing here keeps time.
import * as THREE from "three";

export const radius = (t, { c = 1, t0 = 0 } = {}) => Math.max(0, c * (t - t0));
export const arrival = (dist, { c = 1, t0 = 0 } = {}) => t0 + dist / c;
export const retarded = (t, dist, c = 1) => t - dist / c;
export const seen = (history, dist, c = 1) => (t) => history(t - dist / c);
export const step = (x, w = 0) => (w <= 0 ? (x >= 0 ? 1 : 0) : x <= 0 ? 0 : x >= w ? 1 : ((u) => u * u * (3 - 2 * u))(x / w));

export const train = (t, { c = 1, period = 1, from = -Infinity, to = Infinity, rMax = Infinity, phase = 0 } = {}) => {
  const out = [];
  if (!(period > 0)) return out;
  const last = Math.min(t, to);                                   // nothing is emitted after `to` (or after now)
  const kHi = Math.floor((last - phase) / period + 1e-9);
  for (let k = kHi; ; k--) {
    const t0 = phase + k * period;
    if (t0 < from - 1e-9) break;
    const r = c * (t - t0);
    if (r > rMax) break;
    out.push({ k, t0, r });
    if (out.length > 4096) break;
  }
  return out;
};

// ── colour: numbers, "#hex" (sRGB, converted to linear) or [r, g, b] linear ──
const toLinear = (c) => {
  if (Array.isArray(c)) return new THREE.Vector3(c[0], c[1], c[2]);
  const col = new THREE.Color(c);                                 // THREE.Color converts sRGB hex to linear
  return new THREE.Vector3(col.r, col.g, col.b);
};

const RIBBON_VS = /* glsl */ `
  attribute float side; attribute float u;
  uniform float uKind;               // 0 arc, 1 segment
  uniform vec3 uC, uE1, uE2, uA, uB; uniform vec2 uArc; uniform float uR;
  uniform vec2 uRes; uniform float uW;
  varying float vU; varying float vSide; varying float vLen;
  vec3 P(float s){
    if (uKind < 0.5) { float a = mix(uArc.x, uArc.y, s); return uC + uR * (cos(a) * uE1 + sin(a) * uE2); }
    return mix(uA, uB, s);
  }
  void main(){
    float du = 0.002;
    float s0 = clamp(u, 0.0, 1.0);
    vec4 c0 = projectionMatrix * modelViewMatrix * vec4(P(s0), 1.0);
    vec4 cA = projectionMatrix * modelViewMatrix * vec4(P(s0 - du), 1.0);
    vec4 cB = projectionMatrix * modelViewMatrix * vec4(P(s0 + du), 1.0);
    vU = u; vSide = side;
    vLen = uKind < 0.5 ? (uArc.y - uArc.x) * u : length(uB - uA) * u;
    if (c0.w <= 1e-4 || cA.w <= 1e-4 || cB.w <= 1e-4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // behind the lens: drop it
    vec2 a = cA.xy / cA.w * uRes * 0.5, b = cB.xy / cB.w * uRes * 0.5;
    vec2 tg = b - a; float l = length(tg);
    vec2 n = l > 1e-6 ? vec2(-tg.y, tg.x) / l : vec2(0.0, 1.0);
    c0.xy += n * side * uW * 0.5 / (uRes * 0.5) * c0.w;
    gl_Position = c0;
  }`;
const RIBBON_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform float uDash; uniform float uDuty; uniform vec2 uFade; uniform float uW;
  uniform float uKind;
  varying float vU; varying float vSide; varying float vLen;
  void main(){
    float aa = clamp(1.6 / max(uW, 1.0), 0.0, 1.0);
    float edge = 1.0 - smoothstep(1.0 - aa, 1.0, abs(vSide));
    float dash = 1.0;
    if (uDash > 0.0) {
      float x = uKind < 0.5 ? vLen / 6.2831853 * uDash : vLen * uDash;
      float f = fract(x), fw = max(fwidth(x), 1e-4);
      dash = smoothstep(0.0, fw, f) * (1.0 - smoothstep(uDuty - fw, uDuty, f));
    }
    float a = uOpacity * edge * dash * mix(uFade.x, uFade.y, clamp(vU, 0.0, 1.0));
    gl_FragColor = vec4(uColor * a, a);
  }`;

export const ribbon = (o = {}) => {
  const n = o.segments ?? 256, W = o.W ?? window.W, H = o.H ?? window.H, S1 = Math.min(W, H) / 1080;
  const pos = new Float32Array((n + 1) * 2 * 3), side = new Float32Array((n + 1) * 2), u = new Float32Array((n + 1) * 2), idx = [];
  for (let i = 0; i <= n; i++) {
    side[i * 2] = -1; side[i * 2 + 1] = 1; u[i * 2] = u[i * 2 + 1] = i / n;
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));   // unused by the shader; three needs it to draw
  g.setAttribute("side", new THREE.BufferAttribute(side, 1));
  g.setAttribute("u", new THREE.BufferAttribute(u, 1));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);    // never culled (the shape lives in uniforms)
  const additive = o.additive ?? true;
  const U = {
    uKind: { value: o.kind === "seg" ? 1 : 0 }, uC: { value: new THREE.Vector3() }, uE1: { value: new THREE.Vector3(1, 0, 0) }, uE2: { value: new THREE.Vector3(0, 0, 1) },
    uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3(1, 0, 0) }, uArc: { value: new THREE.Vector2(0, Math.PI * 2) }, uR: { value: 1 },
    uRes: { value: new THREE.Vector2(W, H) }, uW: { value: (o.width ?? 3) * S1 }, uColor: { value: toLinear(o.color ?? 0xffffff) }, uOpacity: { value: o.opacity ?? 1 },
    uDash: { value: o.dash ?? 0 }, uDuty: { value: o.duty ?? 0.55 }, uFade: { value: new THREE.Vector2(...(o.fade || [1, 1])) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false, depthTest: o.depthTest ?? true,
    blending: additive ? THREE.CustomBlending : THREE.NormalBlending, side: THREE.DoubleSide,
    ...(additive ? { blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } : { premultipliedAlpha: true }),
  });
  if (!additive) { mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.userData.noProbe = true;                                     // its outline moves in the shader, unseen by the probe: see probes()
  const R = {
    mesh, uniforms: U,
    // the mesh's origin is parked on the shape (an arc's centre, a segment's start) and the shape is drawn
    // relative to it: the motion-blur probe reads mesh origins, and an origin left at the group's (0,0,0)
    // can sit behind the lens and read as a huge jump (see the header)
    arc({ center = [0, 0, 0], r = 1, a0 = 0, a1 = Math.PI * 2, e1, e2 } = {}) {
      U.uKind.value = 0; mesh.position.fromArray(center); U.uC.value.set(0, 0, 0); U.uR.value = r; U.uArc.value.set(a0, a1);
      if (e1) U.uE1.value.fromArray(e1); if (e2) U.uE2.value.fromArray(e2);
      return R;
    },
    seg(a, b) { U.uKind.value = 1; mesh.position.fromArray(a); U.uA.value.set(0, 0, 0); U.uB.value.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); return R; },
    set(p = {}) {
      if (p.opacity != null) U.uOpacity.value = p.opacity;
      if (p.color != null) U.uColor.value.copy(toLinear(p.color));
      if (p.width != null) U.uW.value = p.width * S1;
      if (p.dash != null) U.uDash.value = p.dash;
      if (p.duty != null) U.uDuty.value = p.duty;
      if (p.fade) U.uFade.value.set(p.fade[0], p.fade[1]);
      mesh.visible = U.uOpacity.value > 1e-4;
      return R;
    },
    point(x) {
      const o = mesh.position;
      if (U.uKind.value > 0.5) return [0, 1, 2].map((i) => o.getComponent(i) + U.uB.value.getComponent(i) * x);
      const c = o, e1 = U.uE1.value, e2 = U.uE2.value, r = U.uR.value;
      return [c.x + r * (Math.cos(x) * e1.x + Math.sin(x) * e2.x), c.y + r * (Math.cos(x) * e1.y + Math.sin(x) * e2.y), c.z + r * (Math.cos(x) * e1.z + Math.sin(x) * e2.z)];
    },
  };
  return R;
};
export const ring = (o = {}) => ribbon({ ...o, kind: "arc" });
export const segment = (o = {}) => ribbon({ ...o, kind: "seg" });

// A sphere drawn as a soft rim: brightest at its silhouette, clear in the middle (a shell seen edge-on).
export const shell = (o = {}) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: toLinear(o.color ?? 0xffffff) }, uOpacity: { value: o.opacity ?? 1 }, uPow: { value: o.power ?? 3 } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uColor; uniform float uOpacity, uPow; varying vec3 vN; varying vec3 vV; void main(){ float r = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow) * uOpacity; gl_FragColor = vec4(uColor * r, r); }",
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  mesh.userData.noProbe = true;
  return {
    mesh,
    set({ center, r, opacity } = {}) {
      if (center) mesh.position.fromArray(center);
      if (r != null) mesh.scale.setScalar(Math.max(r, 1e-6));
      if (opacity != null) mat.uniforms.uOpacity.value = opacity;
      mesh.visible = mat.uniforms.uOpacity.value > 1e-4 && (r == null || r > 1e-6);
      return this;
    },
  };
};

// Invisible meshes the motion-blur probe can see (see the header). place([[x,y,z] | null, ...]) in the
// group's units; a null hides that probe this frame.
const PROBE_GEO = new THREE.BufferGeometry();
PROBE_GEO.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
export const probes = (group, n = 4) => {
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  const ms = Array.from({ length: n }, () => { const m = new THREE.Mesh(PROBE_GEO, mat); m.frustumCulled = false; m.userData.probe = true; group.add(m); return m; });
  return (pts) => ms.forEach((m, i) => { const p = pts[i]; m.visible = !!p; if (p) m.position.set(p[0], p[1], p[2]); });
};

// GLSL for a field felt late: include it in a vertex or fragment shader and call
// retardedStep(tau, dist, c, t0, w): 0 before the news of an event at t0 reaches dist, 1 after (w wide).
export const GLSL = /* glsl */ `
  float retardedStep(float tau, float dist, float c, float t0, float w){
    float x = (tau - dist / c) - t0;
    return w <= 0.0 ? step(0.0, x) : smoothstep(0.0, w, x);
  }`;

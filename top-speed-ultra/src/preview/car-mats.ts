// Materials for the car, inside and out, shared by the cockpit, the exterior and the traffic. Physically based:
// albedos in real ranges (black leather ~0.04, carbon ~0.05, rubber ~0.03, aluminium F0 ~0.9), roughness from
// generated maps, normals from generated height fields. All UVs are in metres; each material sets its tile size.
import * as THREE from 'three';
import * as X from './car-tex';
import { patch, withAO } from './car-kit';

export type Quality = 'phone' | 'high';
const memo = new Map<string, THREE.Material>();
function once<M extends THREE.Material>(key: string, make: () => M): M {
  if (!memo.has(key)) memo.set(key, make());
  return memo.get(key) as M;
}
// a texture set retiled to `tile` metres (clones share the GPU image)
function tiled(maps: X.SurfaceMaps, tile: number) {
  const r = 1 / tile, t = (x?: THREE.Texture) => { if (!x) return undefined; const c = x.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
  return { map: t(maps.map), normalMap: t(maps.normalMap)!, roughnessMap: t(maps.roughnessMap), anisotropyMap: t(maps.anisotropyMap) };
}
const S = (q: Quality, high: number, phone: number) => (q === 'high' ? high : phone);

// ------------------------------------------------------------------------------------------------ interior
export function carbon(q: Quality, tile = 0.064) {
  return once('carbon' + q + tile, () => {
    const t = tiled(X.carbonMaps(S(q, 512, 256)), tile);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(1.9, 1.9, 2.0), map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: t.roughnessMap, roughness: 1, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.035,
      anisotropy: q === 'high' ? 0.75 : 0, anisotropyMap: q === 'high' ? t.anisotropyMap : null, envMapIntensity: 1,
    });
    m.name = 'carbon';
    return withAO(m);
  });
}
export function leather(q: Quality, color: number, o: { perforated?: boolean; tile?: number; rough?: number; sheen?: number; worn?: boolean } = {}) {
  const key = 'leather' + q + color.toString(16) + JSON.stringify(o);
  return once(key, () => {
    const t = tiled(X.leatherMaps(S(q, 512, 256), !!o.perforated), o.tile ?? 0.1);
    const c = new THREE.Color(color);
    const m = new THREE.MeshPhysicalMaterial({
      color: c, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: t.roughnessMap,
      roughness: o.rough ?? 1, sheen: o.sheen ?? 0.35, sheenRoughness: 0.55, sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.25).multiplyScalar(0.6),
      envMapIntensity: 0.7,
    });
    // hands polish a steering wheel: smoother, a faint shine
    if (o.worn) { m.roughness = 0.72; m.clearcoat = 0.12; m.clearcoatRoughness = 0.35; }
    m.name = 'leather';
    return withAO(m);
  });
}
export function alcantara(q: Quality, color = 0x2a2a2c, tile = 0.08) {
  return once('alc' + q + color, () => {
    const t = tiled(X.alcantaraMaps(S(q, 512, 256)), tile);
    const c = new THREE.Color(color);
    const m = new THREE.MeshPhysicalMaterial({
      color: c, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, metalness: 0,
      sheen: 1, sheenRoughness: 0.8, sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.35).multiplyScalar(0.9), envMapIntensity: 0.45,
      specularIntensity: 0.3,
    });
    m.name = 'alcantara';
    return withAO(m);
  });
}
// brushed aluminium: streaks along u; anisotropy turns the highlight into a streak across them
export function brushed(q: Quality, color = 0xc8ccd1, o: { tile?: number; rough?: number; aniso?: number; key?: string } = {}) {
  return once('brushed' + q + color + JSON.stringify(o), () => {
    const t = tiled(X.brushedMaps(S(q, 512, 256)), o.tile ?? 0.12);
    const m = new THREE.MeshPhysicalMaterial({
      color, metalness: 1, roughness: o.rough ?? 1.1, roughnessMap: t.roughnessMap, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.12, 0.12),
      anisotropy: q === 'high' ? (o.aniso ?? 0.8) : 0, envMapIntensity: 1,
    });
    m.name = 'brushed';
    return withAO(m);
  });
}
export function patchedStd(color: number, rough: number) {
  return once('std' + color + rough, () => withAO(new THREE.MeshStandardMaterial({ color, roughness: rough })));
}
export function chrome(rough = 0.06, color = 0xeeeeee) {
  return once('chrome' + rough + color, () => withAO(Object.assign(new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough }), { name: 'chrome' })));
}
export function softPlastic(q: Quality, color = 0x18191b, tile = 0.05) {
  return once('soft' + q + color + tile, () => {
    const t = tiled(X.plasticMaps(S(q, 256, 128)), tile);
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughnessMap: t.roughnessMap, roughness: 1, envMapIntensity: 0.7 }), { name: 'plastic' }));
  });
}
export function gloss(color = 0x040405) {
  return once('gloss' + color, () => withAO(Object.assign(new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1 }), { name: 'gloss' })));
}
export function rubber(color = 0x0b0b0c) {
  return once('rubber' + color, () => withAO(Object.assign(new THREE.MeshStandardMaterial({ color, roughness: 0.78, envMapIntensity: 0.5 }), { name: 'rubber' })));
}
export function carpet(q: Quality) {
  return once('carpet' + q, () => {
    const t = tiled(X.carpetMaps(S(q, 256, 128)), 0.08);
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ color: 0x1b1b1c, map: t.map, normalMap: t.normalMap, roughness: 1, envMapIntensity: 0.4 }), { name: 'carpet' }));
  });
}
export function stitch(color: number) {
  return once('stitch' + color, () => {
    const t = X.stitchTex();
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ color, map: t, alphaTest: 0.5, roughness: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.5 }), { name: 'stitch' }));
  });
}
export function stipple(q: Quality, color = 0x19191a, tile = 0.06) {
  return once('stipple' + q + color, () => {
    const t = tiled(X.stippleMaps(S(q, 256, 128)), tile);
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, envMapIntensity: 0.6 }), { name: 'stipple' }));
  });
}

// ------------------------------------------------------------------------------------------------ glass
// Glass blended as premultiplied: the reflection is added at full strength and only the transmitted light is
// dimmed by `absorb` (what a single alpha can't do with normal blending, where reflections fade with opacity).
export function glass(name: string, absorb: number, o: { env?: number; rough?: number; color?: number } = {}) {
  return once('glass' + name + absorb + JSON.stringify(o), () => {
    const m = new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0x000000, metalness: 0, roughness: o.rough ?? 0.02, transparent: true, opacity: absorb, depthWrite: false,
      envMapIntensity: o.env ?? 1, ior: 1.52, specularIntensity: 1,
    });
    m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.name = 'glass-' + name;
    return m;
  });
}

// ------------------------------------------------------------------------------------------------ paint
// A shut line is an outline in one of the car's planes, drawn analytically in the paint shader as a dark gap that
// breaks the clear coat, with a soft shadow either side: crisp at any distance, no texture needed.
export interface ShutLine {
  plane: 'side' | 'top' | 'front';         // side: (z, y) on surfaces facing +-x; top: (x, z) facing up; front: (x, y) facing +-z
  pts: [number, number][];                 // a convex polygon (3-4 points) or, with seg, a segment (2 points)
  r?: number;                              // corner radius for polygons
  seg?: boolean;
  side?: -1 | 0 | 1;                       // only x>0 (1), x<0 (-1) or both (0); for 'front', z sign
}
const MAX_SHUT = 14;
// inset a convex polygon by r (edges moved inward and re-intersected)
function inset(pts: [number, number][], r: number): [number, number][] {
  const n = pts.length;
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const nx = -dy / l * s, ny = dx / l * s;   // inward normal
    return { p: [a[0] + nx * r, a[1] + ny * r], d: [dx, dy] };
  });
  return lines.map((L, i) => {
    const M = lines[(i - 1 + n) % n];
    const den = M.d[0] * L.d[1] - M.d[1] * L.d[0];
    if (Math.abs(den) < 1e-9) return [L.p[0], L.p[1]] as [number, number];
    const t = ((L.p[0] - M.p[0]) * L.d[1] - (L.p[1] - M.p[1]) * L.d[0]) / den;
    return [M.p[0] + M.d[0] * t, M.p[1] + M.d[1] * t] as [number, number];
  });
}
function packShut(lines: ShutLine[]) {
  const a = new Array<THREE.Vector4>(MAX_SHUT * 3).fill(new THREE.Vector4()).map(() => new THREE.Vector4());
  lines.slice(0, MAX_SHUT).forEach((l, k) => {
    const plane = l.plane === 'side' ? 0 : l.plane === 'top' ? 1 : 2;
    let p = l.pts;
    if (!l.seg && l.r) p = inset(p, l.r);
    while (p.length < 4) p = [...p, p[p.length - 1]];
    a[k * 3].set(l.seg ? 1 : 0, plane, l.side ?? 0, l.seg ? 0 : (l.r ?? 0));
    a[k * 3 + 1].set(p[0][0], p[0][1], p[1][0], p[1][1]);
    a[k * 3 + 2].set(p[2][0], p[2][1], p[3][0], p[3][1]);
  });
  return a;
}
const PAINT_PARS = /* glsl */`
uniform vec4 uShut[${MAX_SHUT * 3}];
uniform int uShutN;
uniform float uFlake;
uniform mat3 normalMatrix;
varying vec3 vOP;
varying vec3 vON;
float shutLine = 0.0, shutHalo = 0.0;
vec3 flakeHash(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float shSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0); return length(pa - ba * h); }
float shPoly(vec2 p, vec2 v0, vec2 v1, vec2 v2, vec2 v3) {
  vec2 v[4]; v[0] = v0; v[1] = v1; v[2] = v2; v[3] = v3;
  float d = dot(p - v[0], p - v[0]); float s = 1.0;
  for (int i = 0; i < 4; i++) {
    int j = (i + 3) - ((i + 3) / 4) * 4;
    vec2 e = v[j] - v[i]; vec2 w = p - v[i];
    vec2 b = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-8), 0.0, 1.0); d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
void shutLines(float pix) {
  for (int k = 0; k < ${MAX_SHUT}; k++) {
    if (k >= uShutN) break;
    vec4 A = uShut[k * 3], B = uShut[k * 3 + 1], C = uShut[k * 3 + 2];
    int plane = int(A.y + 0.5);
    vec2 p; float ok;
    if (plane == 0) { p = vOP.zy; ok = step(0.3, abs(vON.x)) * (A.z == 0.0 ? 1.0 : step(0.0, vOP.x * A.z)); }
    else if (plane == 1) { p = vOP.xz; ok = step(0.3, vON.y); }
    else { p = vOP.xy; ok = step(0.3, abs(vON.z)) * (A.z == 0.0 ? 1.0 : step(0.0, vOP.z * A.z)); }
    float d = abs(A.x < 0.5 ? shPoly(p, B.xy, B.zw, C.xy, C.zw) - A.w : shSeg(p, B.xy, B.zw));
    float hw = 0.0021;
    shutLine = max(shutLine, ok * (1.0 - smoothstep(hw - pix, hw + pix, d)));
    shutHalo = max(shutHalo, ok * (1.0 - smoothstep(hw, hw + 0.006 + pix, d)));
  }
}
`;
// metallic paint: a base coat with flakes under a clear coat; the flakes are a per-pixel random tilt of the base
// layer's normal, hashed in the car's own space (so they stay put as you move) at about the size of a pixel
export function paint(hex: number, q: Quality, lines: ShutLine[] = [], o: { flake?: number; metal?: number; rough?: number; key?: string } = {}) {
  const key = 'paint' + hex + q + (o.key ?? '') + JSON.stringify(lines) + JSON.stringify(o);
  return once(key, () => {
    const m = new THREE.MeshPhysicalMaterial({
      color: hex, metalness: o.metal ?? 0.62, roughness: o.rough ?? 0.36, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1,
      clearcoatNormalMap: X.peelNormal(S(q, 256, 128)), clearcoatNormalScale: new THREE.Vector2(0.05, 0.05),
    });
    const peel = m.clearcoatNormalMap!.clone(); peel.repeat.set(4, 4); peel.needsUpdate = true; m.clearcoatNormalMap = peel;
    m.name = 'paint';
    const uniforms = { uShut: { value: packShut(lines) }, uShutN: { value: Math.min(MAX_SHUT, lines.length) }, uFlake: { value: q === 'high' ? (o.flake ?? 0.15) : 0 } };
    (m.userData as { uniforms: typeof uniforms }).uniforms = uniforms;
    patch(m, 'paint' + q, (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + PAINT_PARS)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float pixW = length(fwidth(vOP)) * 0.7 + 1e-5;
          shutLines(pixW);
          diffuseColor.rgb *= (1.0 - 0.94 * shutLine) * (1.0 - 0.3 * shutHalo);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          if (uFlake > 0.0) {
            vec3 fp = vOP * 2400.0;
            vec3 fw3 = fwidth(fp); float fpx = max(max(fw3.x, fw3.y), fw3.z);
            float lv = max(0.0, log2(max(fpx, 1e-4)) + 0.6); float l0 = floor(lv); float lt = lv - l0;
            vec3 h0 = flakeHash(floor(fp / exp2(l0))) * 2.0 - 1.0;
            vec3 h1 = flakeHash(floor(fp / exp2(l0 + 1.0)) + 17.0) * 2.0 - 1.0;
            vec3 fh = mix(h0, h1, lt);
            float fk = uFlake * pow(exp2(l0), -1.2);
            normal = normalize(normal + normalize(normalMatrix * fh) * fk * length(fh) * (1.0 - shutLine));
          }`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
          material.clearcoat *= 1.0 - shutLine;
          material.roughness = mix(material.roughness, 0.9, shutLine);`);
    });
    return withAO(m, 0.2);
  });
}
export function setShutLines(m: THREE.Material, lines: ShutLine[]) {
  const u = (m.userData as { uniforms?: { uShut: { value: THREE.Vector4[] }; uShutN: { value: number } } }).uniforms;
  if (!u) return;
  u.uShut.value = packShut(lines); u.uShutN.value = Math.min(MAX_SHUT, lines.length);
}

// ------------------------------------------------------------------------------------------------ running gear
export function tyre(q: Quality, treadV: [number, number]) {
  return once('tyre' + q + treadV.join(), () => {
    const t = X.tyreMaps(S(q, 1024, 512), treadV);
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: t.roughnessMap, roughness: 1, envMapIntensity: 0.7 }), { name: 'tyre' }));
  });
}
// a machined face: bright, concentric lathe marks (UV u runs round the wheel), anisotropic along them
export function machined(q: Quality) {
  return once('machined' + q, () => {
    const t = X.brushedMaps(S(q, 512, 256));
    const rough = t.roughnessMap!.clone(); rough.repeat.set(1, 30); rough.needsUpdate = true;
    const nm = t.normalMap.clone(); nm.repeat.set(1, 30); nm.needsUpdate = true;
    return withAO(Object.assign(new THREE.MeshPhysicalMaterial({ color: 0xd6d9dd, metalness: 1, roughness: 1.0, roughnessMap: rough, normalMap: nm, normalScale: new THREE.Vector2(0.08, 0.08), anisotropy: q === 'high' ? 0.85 : 0, clearcoat: 0.6, clearcoatRoughness: 0.08 }), { name: 'machined' }));
  });
}
export function rimPaint(color = 0x2b2d31) {
  return once('rimpaint' + color, () => withAO(Object.assign(new THREE.MeshPhysicalMaterial({ color, metalness: 0.75, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.12 }), { name: 'rimpaint' })));
}
export function disc(q: Quality) {
  return once('disc' + q, () => {
    const t = X.discMaps(S(q, 512, 256));
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, roughness: 1, metalness: 0.25 }), { name: 'disc' }));
  });
}
export function caliper(color = 0xe0a800) {
  return once('caliper' + color, () => withAO(Object.assign(new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 }), { name: 'caliper' })));
}

// ------------------------------------------------------------------------------------------------ lamps and grilles
export function emissive(name: string, color: number, intensity: number, base = 0x111111) {
  return once('emis' + name + color + intensity, () => Object.assign(new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: intensity, roughness: 0.3 }), { name: 'emissive-' + name }));
}
export function honeycomb(q: Quality, tile = 0.09) {
  return once('honey' + q + tile, () => {
    const h = X.honeycombMaps(S(q, 256, 128));
    const a = h.alphaMap.clone(), n = h.normalMap.clone();
    for (const t of [a, n]) { t.repeat.set(1 / tile, 1 / tile); t.needsUpdate = true; }
    return withAO(Object.assign(new THREE.MeshStandardMaterial({ color: 0x0c0c0d, alphaMap: a, alphaTest: 0.5, normalMap: n, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }), { name: 'honeycomb' }));
  });
}

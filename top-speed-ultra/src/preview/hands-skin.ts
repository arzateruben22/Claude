// Skin, leather glove and nail materials for the driver's hands: MeshPhysicalMaterial with its shader extended.
//  - colour from the skin tone, varied per vertex (redder knuckles and fingertips, paler palms and inner forearm,
//    soft mottling), with faint veins on the back of the hand
//  - procedural relief without UVs, in the hand's own frame (so it sticks to the skin as the wheel turns): a fine
//    polygonal furrow network with pores, creases across the finger joints, knuckle folds, veins and tendons;
//    faded out where it would be smaller than a pixel (and the roughness raised a touch instead)
//  - roughness varied (shinier knuckles and fingertips), a soft sheen, a faint oily second lobe (clearcoat)
//  - a cheap subsurface look: wrapped diffuse lighting tinted red at the terminator, light through the thin
//    fingers when they are against the light, and baked ambient occlusion from the distance field (rim included)
//  - GLOVE: leather over the hand with round knuckle holes, an open back, stitched edges and a wrist strap
import * as THREE from 'three';

export type Quality = 'phone' | 'high';

const NOISE = /* glsl */ `
float hh13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hh33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh13(i), hh13(i + vec3(1,0,0)), f.x), mix(hh13(i + vec3(0,1,0)), hh13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hh13(i + vec3(0,0,1)), hh13(i + vec3(1,0,1)), f.x), mix(hh13(i + vec3(0,1,1)), hh13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// cellular: x = distance to the nearest feature point, y = the gap to the second (0 on the cell walls)
vec2 cells(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), o = hh33(i + g);
    vec3 r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d1), sqrt(d2) - sqrt(d1));
}
float segd(vec3 p, vec3 a, vec3 b) { vec3 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * t); }
// bump mapping from a height in metres, with the surface's own screen derivatives (Mikkelsen, unnormalised)
vec3 bumpNormal(vec3 pos, vec3 n, float H, float faceDir) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 g = sign(det) * (dFdx(H) * r1 + dFdy(H) * r2);
  return normalize(abs(det) * n - g);
}
`;

// direct light with a subsurface look: wrapped, red-tinted diffuse and light coming through thin parts
function sssLights() {
  return THREE.ShaderChunk.lights_physical_pars_fragment
    .replace('void RE_Direct_Physical(', 'float gThin = 0.0; float gAoD = 1.0; vec3 gSss = vec3(1.0, 0.35, 0.22);\nvoid RE_Direct_Physical(')
    .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', /* glsl */ `
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * gAoD;
	#ifdef SKIN_SSS
	float nl = dot( geometryNormal, directLight.direction );
	float wrapNL = saturate( ( nl + 0.45 ) / 1.45 );
	reflectedLight.directDiffuse += max( wrapNL - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseColor ) * gSss * 0.6 * gAoD;
	float back = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 );
	float thru = saturate( 0.35 - nl );
	reflectedLight.directDiffuse += directLight.color * gThin * ( back * 0.7 + 0.12 ) * thru * gSss * material.diffuseColor;
	#endif`);
}

export interface SkinOptions {
  tone: number;                 // the skin colour (hex, sRGB)
  glove: number | null;         // leather colour, or none
  quality: Quality;
  female: boolean;
  veins: number[];              // segments in the hand frame (mm): x0 y0 z0 x1 y1 z1 r
  holes: number[];              // glove openings (mm): x y z r (4 knuckles, then the back)
  holeNormals: number[];        // their outward normals
}

export interface SkinMaterial extends THREE.MeshPhysicalMaterial {
  setTone(hex: number): void;
}

const NV = 11;

export function skinMaterial(o: SkinOptions): SkinMaterial {
  const high = o.quality === 'high';
  const gloved = o.glove !== null;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.5, metalness: 0, ior: 1.4, specularIntensity: 0.62,
    sheen: high ? 0.35 : 0, sheenColor: new THREE.Color(0.75, 0.62, 0.56), sheenRoughness: 0.45,
    clearcoat: high ? (gloved ? 0.35 : 0.06) : 0, clearcoatRoughness: gloved ? 0.5 : 0.32,
    envMapIntensity: 0.9,
  }) as SkinMaterial;
  const tone = new THREE.Color(o.tone);
  const uniforms = {
    uTone: { value: tone.clone() },
    uDark: { value: darkness(o.tone) },
    uVeins: { value: veinUniform(o.veins) },
    uVeinAmt: { value: (o.female ? 0.55 : 1) },
    uHoles: { value: Array.from({ length: 5 }, (_, i) => new THREE.Vector4(o.holes[i * 4] ?? 0, o.holes[i * 4 + 1] ?? 0, o.holes[i * 4 + 2] ?? 0, o.holes[i * 4 + 3] ?? 0)) },
    uHoleN: { value: Array.from({ length: 5 }, (_, i) => new THREE.Vector3(o.holeNormals[i * 3] ?? 0, o.holeNormals[i * 3 + 1] ?? 0, o.holeNormals[i * 3 + 2] ?? 1)) },
    uLeather: { value: new THREE.Color(o.glove ?? 0x111111) },
    uFem: { value: o.female ? 1 : 0 },
  };
  m.setTone = (hex: number) => { uniforms.uTone.value.set(hex); uniforms.uDark.value = darkness(hex); };
  m.customProgramCacheKey = () => `skin-${o.quality}-${gloved ? 'g' : 's'}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.defines = { ...(sh.defines ?? {}), SKIN_SSS: 1, ...(high ? { SKIN_HIGH: 1 } : {}), ...(gloved ? { GLOVE: 1 } : {}) };
    const decl = /* glsl */ `
attribute vec3 aHand; attribute vec4 aSkin; attribute vec4 aJoint; attribute vec2 aArm;
varying vec3 vHand; varying vec4 vSkin; varying vec4 vJoint; varying vec2 vArm;
#ifdef GLOVE
uniform vec4 uHoles[5];
varying float vLeather;
float leatherAt(vec3 hp, float along) {
  float cover = 1.0 - smoothstep(18.0, 22.0, along);
  for (int i = 0; i < 5; i++) { float d = length(hp - uHoles[i].xyz) - uHoles[i].w; cover *= smoothstep(-0.6, 0.6, d); }
  return cover;
}
#endif
`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + decl)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
vHand = aHand; vSkin = aSkin; vJoint = aJoint; vArm = aArm;
#ifdef GLOVE
vLeather = leatherAt(aHand * 1000.0, aArm.x);
transformed += normal * 0.0009 * vLeather;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
varying vec3 vHand; varying vec4 vSkin; varying vec4 vJoint; varying vec2 vArm;
uniform vec3 uTone; uniform float uDark; uniform vec4 uVeins[${NV * 2}]; uniform float uVeinAmt; uniform float uFem;
#ifdef GLOVE
uniform vec4 uHoles[5]; uniform vec3 uHoleN[5]; uniform vec3 uLeather; varying float vLeather;
#endif
${NOISE}`)
      .replace('#include <lights_physical_pars_fragment>', sssLights())
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
vec3 hp = vHand * 1000.0;                       // the hand's frame, mm
float pix = length(fwidth(hp));                 // mm per pixel here
float fine = smoothstep(0.85, 0.22, pix);       // fine relief that a pixel can still show
float mid = smoothstep(3.0, 0.8, pix);
float red = vSkin.x, palmar = vSkin.y, ao = vSkin.z, thin = vSkin.w;
float dorsal = 1.0 - palmar;
// ---- veins on the back of the hand and up the forearm
float vein = 0.0;
for (int i = 0; i < ${NV}; i++) {
  vec4 a = uVeins[i * 2], b = uVeins[i * 2 + 1];
  float d = segd(hp, a.xyz, b.xyz) / a.w;
  vein = max(vein, exp(-d * d * 1.6));
}
float wob = vnoise(hp * 0.35);
vein *= uVeinAmt * dorsal * smoothstep(0.15, 0.6, wob + 0.3) * (1.0 - uDark * 0.55);
// ---- colour
vec3 c = pow(uTone, vec3(1.12)) * 0.8;          // the game's display colour as an albedo: a touch darker, richer
float m1 = vnoise(hp * 0.07) - 0.5, m2 = vnoise(hp * 0.21 + 7.1) - 0.5, m3 = vnoise(hp * 0.9 + 3.3) - 0.5;
c *= 1.0 + 0.07 * m1 + 0.05 * m2 + 0.025 * m3;
c = mix(c, c * vec3(1.06, 0.93, 0.9), clamp(m1 * 1.6 + 0.4, 0.0, 1.0) * 0.35);
vec3 redT = mix(vec3(1.12, 0.80, 0.76), vec3(0.80, 0.70, 0.68), uDark);
c *= mix(vec3(1.0), redT, clamp(red, 0.0, 1.0) * 0.85);
vec3 palmTone = mix(c * vec3(1.05, 0.97, 0.95), vec3(0.5, 0.33, 0.27), 0.12 + 0.6 * uDark);
c = mix(c, palmTone, clamp(palmar * 0.9, 0.0, 1.0) * (0.35 + 0.5 * uDark));
c *= mix(vec3(1.0), vec3(0.86, 0.93, 1.03), vein * 0.55);
// tiny pigment spots on light skin (sparse, faint)
#ifdef SKIN_HIGH
{ vec2 sp = cells(hp * 0.45); c *= 1.0 - (1.0 - uDark) * 0.18 * smoothstep(0.16, 0.05, sp.x) * step(0.82, hh13(floor(hp * 0.45) + 5.0)) * fine; }
#endif
// ---- relief (mm), turned into metres for the bump
float H = 0.0;
#ifdef SKIN_HIGH
vec2 cl = cells(hp * 1.05 + vec3(0.0, wob, 0.0));
H -= 0.045 * smoothstep(0.16, 0.0, cl.y) * fine * (1.0 - palmar * 0.4);          // the furrow network
H -= 0.03 * smoothstep(0.22, 0.0, cl.x) * fine;                                // pores at its nodes
H += 0.02 * (vnoise(hp * 3.1) - 0.5) * fine;
#else
H += 0.04 * (vnoise(hp * 1.6) - 0.5) * mid;
#endif
// creases across the finger joints: a few curved lines on the back, deepest over the middle knuckle
float ax = vJoint.x, la = vJoint.y, st = vJoint.z, kind = vJoint.w;
float win = exp(-(ax * ax) / (kind > 1.5 ? 70.0 : kind > 0.5 ? 30.0 : 22.0)) * st;
float arc = ax + la * la * (kind > 0.5 ? 0.02 : 0.035) + (vnoise(hp * 0.7) - 0.5) * 1.2;
float sp = kind > 1.5 ? 2.2 : kind > 0.5 ? 1.15 : 1.35;
float lines = pow(0.5 + 0.5 * cos(arc * 6.2832 / sp), 6.0);
float crease = win * lines * mix(1.0, 0.65, uFem);
H -= 0.11 * crease * mid;
// knuckle folds: the slack skin round the big knuckles
H += 0.05 * (vnoise(hp * vec3(0.5, 1.6, 0.5)) - 0.5) * smoothstep(0.2, 0.8, red) * dorsal * mid;
// veins raised a little
H += 0.32 * vein * mid;
c *= 1.0 - 0.18 * crease * mid;
diffuseColor.rgb = c;
float rough = mix(0.54, 0.40, clamp(red * dorsal, 0.0, 1.0)) + 0.08 * palmar + 0.05 * (1.0 - fine) + 0.03 * m3 + 0.08 * crease;
float leather = 0.0;
#ifdef GLOVE
leather = smoothstep(0.35, 0.65, vLeather);
{
  // edge binding and stitching round each opening
  float edge = 0.0, stitch = 0.0;
  for (int i = 0; i < 5; i++) {
    vec3 q = hp - uHoles[i].xyz, n = uHoleN[i];
    float d = length(q) - uHoles[i].w;
    vec3 e1 = normalize(cross(n, vec3(0.31, 0.95, 0.07))), e2 = cross(n, e1);
    float ang = atan(dot(q, e2), dot(q, e1)) * (uHoles[i].w + 2.2);
    edge = max(edge, smoothstep(2.0, 0.6, d) * step(0.0, d));
    stitch = max(stitch, smoothstep(0.45, 0.15, abs(d - 2.3)) * step(0.5, fract(ang / 2.4)));
  }
  // the wrist strap and its stitching
  float along = vArm.x;
  float strap = smoothstep(4.0, 5.0, along) * smoothstep(17.0, 16.0, along) * smoothstep(0.55, 0.3, palmar);
  float sline = (smoothstep(0.35, 0.1, abs(along - 6.2)) + smoothstep(0.35, 0.1, abs(along - 14.8))) * step(0.5, fract(dot(hp, vec3(0.31, 0.6, 0.73)) / 2.3)) * strap;
  vec2 grain = cells(hp * 1.4);
  float gH = 0.06 * smoothstep(0.2, 0.0, grain.y) * mid;
  float fold = win * pow(0.5 + 0.5 * cos(arc * 6.2832 / (sp * 2.6)), 3.0);
  vec3 lc = max(uLeather, vec3(0.028)) * (1.0 + 0.12 * m1 + 0.08 * m2);
  lc = mix(lc, lc * 1.6 + 0.01, smoothstep(0.3, 0.9, red) * 0.35 * dorsal);          // worn and polished over the knuckles
  lc *= 1.0 - 0.35 * fold;
  lc = mix(lc, lc * 0.55, edge);
  lc = mix(lc, vec3(0.16, 0.15, 0.14), stitch * 0.85);
  lc = mix(lc, lc * 0.6, sline * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, lc, leather);
  H = mix(H, -gH - 0.22 * fold * mid + 0.12 * stitch * mid + 0.25 * strap * mid - 0.1 * sline, leather);
  rough = mix(rough, 0.48 - 0.12 * smoothstep(0.3, 0.9, red) * dorsal + 0.1 * fold + 0.1 * edge, leather);
  thin *= 1.0 - leather; ao = mix(ao, ao * 0.95, leather);
}
#endif
gThin = thin * (1.0 - uDark * 0.5);
gSss = mix(vec3(1.0, 0.34, 0.22), vec3(0.75, 0.32, 0.22), uDark);
gAoD = mix(1.0, ao, 0.45);
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(rough, 0.25, 0.85);')
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
normal = bumpNormal(-vViewPosition, normal, H * 0.001, faceDirection);`)
      .replace('#include <lights_fragment_end>', /* glsl */ `#include <lights_fragment_end>
{
  reflectedLight.indirectDiffuse *= ao;
  float dotNVo = saturate(dot(geometryNormal, geometryViewDir));
  reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNVo, ao, material.roughness);
  #ifdef USE_SHEEN
  sheenSpecularIndirect *= ao;
  #endif
  #ifdef USE_CLEARCOAT
  clearcoatSpecularIndirect *= ao;
  #endif
}`);
  };
  return m;
}

function darkness(hex: number) {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;   // linear luminance
  return THREE.MathUtils.clamp((0.6 - l) / 0.52, 0, 1);
}

function veinUniform(v: number[]) {
  const out: THREE.Vector4[] = [];
  for (let i = 0; i < NV; i++) {
    const b = i * 7;
    if (b + 6 < v.length) { out.push(new THREE.Vector4(v[b], v[b + 1], v[b + 2], v[b + 6]), new THREE.Vector4(v[b + 3], v[b + 4], v[b + 5], 0)); }
    else out.push(new THREE.Vector4(1e4, 1e4, 1e4, 1), new THREE.Vector4(1e4, 1e4, 1e4, 0));
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ nails
// A nail plate: the pink nail bed seen through the plate, a pale lunula at its base, the white free edge past the
// fingertip, faint lengthwise ridges; or a coat of polish (glossy, a hair short of the cuticle) with a clear coat.
export interface NailMaterial extends THREE.MeshPhysicalMaterial { setTone(hex: number): void }
export function nailMaterial(o: { tone: number; paint: number | null; quality: Quality }): NailMaterial {
  const painted = o.paint !== null;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: painted ? 0.16 : 0.3, metalness: 0, ior: 1.5,
    clearcoat: painted ? 1 : 0.35, clearcoatRoughness: painted ? 0.04 : 0.18,
    envMapIntensity: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }) as NailMaterial;
  const u = {
    uTone: { value: new THREE.Color(o.tone) }, uDark: { value: darkness(o.tone) },
    uPaint: { value: new THREE.Color(o.paint ?? 0) }, uPainted: { value: painted ? 1 : 0 },
  };
  m.setTone = (hex: number) => { u.uTone.value.set(hex); u.uDark.value = darkness(hex); };
  m.customProgramCacheKey = () => `nail-${painted ? 'p' : 'n'}-${o.quality}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aNail; varying vec4 vNail;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNail = aNail;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vNail; uniform vec3 uTone; uniform float uDark; uniform vec3 uPaint; uniform float uPainted;\n${NOISE}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
float s = vNail.x, w = vNail.y, freeAt = vNail.z, L = vNail.w;     // mm from the cuticle; -1..1 across
float side = vNail.y;
// the nail bed: pink over the skin tone; paler toward the free edge's line; the lunula at the base
vec3 bed = mix(uTone * vec3(1.05, 0.78, 0.76), vec3(0.62, 0.36, 0.34), 0.35 + 0.25 * uDark);
bed = mix(bed, bed * vec3(1.08, 1.02, 1.0) + 0.04, smoothstep(freeAt - 2.5, freeAt, s) * 0.5);
float lun = smoothstep(0.08, -0.08, length(vec2((s - 0.3) / (L * 0.2 + 0.6), w * 0.85)) - 1.0);
bed = mix(bed, vec3(0.78, 0.68, 0.64), lun * 0.6);
// the free edge: off-white, the smile line where it leaves the fingertip
vec3 fe = vec3(0.82, 0.79, 0.72) * (0.94 + 0.06 * vnoise(vec3(s * 3.0, w * 4.0, 0.0)));
float isFree = smoothstep(freeAt - 0.15, freeAt + 0.35, s + 0.25 * w * w);
vec3 nc = mix(bed, fe, isFree);
nc = mix(nc, vec3(0.86, 0.8, 0.76), smoothstep(0.7, 0.0, s) * 0.5);            // cuticle
float ridges = vnoise(vec3(w * 9.0, s * 0.25, 1.0));
nc *= 0.96 + 0.06 * ridges;
// polish: a hair short of the cuticle and the side walls
float coat = uPainted * smoothstep(0.35, 0.65, s) * smoothstep(0.98, 0.9, abs(w));
vec3 pc = uPaint * (0.95 + 0.05 * vnoise(vec3(s * 0.8, w * 2.0, 3.0)));
diffuseColor.rgb = mix(nc, pc, coat);
float nailRough = mix(mix(0.32, 0.4, isFree), 0.12, coat);
float nailH = mix(0.004 * ridges, 0.0, coat);
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = nailRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bumpNormal(-vViewPosition, normal, nailH * 0.001, faceDirection);');
  };
  return m;
}

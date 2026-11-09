// Skin, leather glove and nail materials for the driver's hands: MeshPhysicalMaterial with its shader extended.
//  - colour from the skin tone, varied per vertex (redder knuckles and fingertips, paler palms and inner forearm,
//    soft mottling), with faint veins on the back of the hand
//  - procedural relief without UVs, in the hand's own frame (so it sticks to the skin as the wheel turns): a fine
//    polygonal furrow network with pores, creases across the finger joints, knuckle folds, veins and tendons;
//    faded out where it would be smaller than a pixel (and the roughness raised a touch instead)
//  - roughness varied (shinier knuckles and fingertips), a soft sheen, a faint oily second lobe (clearcoat)
//  - a cheap subsurface look: wrapped diffuse lighting tinted red at the terminator, light through the thin
//    fingers when they are against the light, and baked ambient occlusion from the distance field (rim included)
//  - GLOVE: a racing glove: leather over the whole hand, padded knuckles (raised, ribbed, stitched round), panel
//    seams down the fingers and round the back, a wrist strap with an accent stripe across its closure
//  - a faint tan line just under the rolled work shirt (rollAt), where the sleeve usually covers the arm
import * as THREE from 'three';

export type Quality = 'phone' | 'high';

/** bumpNormal(pos, n, H, faceDir): a bump from a height in metres; shared with the cloth shader (hands-acc.ts) */
export const BUMP_GLSL = /* glsl */ `
// bump mapping from a height in metres, with the surface's own screen derivatives (Mikkelsen, unnormalised)
vec3 bumpNormal(vec3 pos, vec3 n, float H, float faceDir) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 g = sign(det) * (dFdx(H) * r1 + dFdy(H) * r2);
  vec3 v = abs(det) * n - g;
  float l2 = dot(v, v);
  // degenerate derivatives (silhouettes, tiny triangles) would give a NaN normal: a black speck
  vec3 b = l2 > 1e-30 ? v * inversesqrt(l2) : n;
  return dot(b, n) > 0.2 ? b : n;
}
`;

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
${BUMP_GLSL}
`;

// direct light with a subsurface look: wrapped, red-tinted diffuse and light coming through thin parts
function sssLights() {
  return THREE.ShaderChunk.lights_physical_pars_fragment
    .replace('void RE_Direct_Physical(', 'float gThin = 0.0; float gAoD = 1.0; vec3 gSss = vec3(1.0, 0.42, 0.30);\nvoid RE_Direct_Physical(')
    .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', /* glsl */ `
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * gAoD;
	#ifdef SKIN_SSS
	float nl = dot( geometryNormal, directLight.direction );
	float wrapNL = saturate( ( nl + 0.45 ) / 1.45 );
	reflectedLight.directDiffuse += max( wrapNL - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseColor ) * gSss * 0.5 * gAoD;
	float back = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 );
	float thru = saturate( 0.35 - nl );
	reflectedLight.directDiffuse += directLight.color * gThin * ( back * 0.6 + 0.035 ) * thru * gSss * material.diffuseColor;
	#endif`);
}

export interface SkinOptions {
  tone: number;                 // the skin colour (hex, sRGB)
  glove: number | null;         // leather colour, or none
  quality: Quality;
  female: boolean;
  veins: number[];              // segments in the hand frame (mm): x0 y0 z0 x1 y1 z1 r, then the skin's up there
  holes: number[];              // glove openings (mm): x y z r (4 knuckles, then the back)
  holeNormals: number[];        // their outward normals
  accent?: number;              // the glove's stripe at the wrist closure (hex; the driver's accent, which hands.ts passes; default the Ace's lavender, #b9a6ff)
}

/** where the Wrench's rolled sleeve ends, mm from the wrist (hands-acc.ts rolls it there; the skin's tan line sits
 *  just below it). Under the other outfits the skin there is covered, so the tan line never shows. */
export const rollAt = (female: boolean) => Math.round(204 * (female ? 0.92 : 1));

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
    uVeinAmt: { value: (o.female ? 0.3 : 0.8) },
    uHoles: { value: Array.from({ length: 5 }, (_, i) => new THREE.Vector4(o.holes[i * 4] ?? 0, o.holes[i * 4 + 1] ?? 0, o.holes[i * 4 + 2] ?? 0, o.holes[i * 4 + 3] ?? 0)) },
    uHoleN: { value: Array.from({ length: 5 }, (_, i) => new THREE.Vector3(o.holeNormals[i * 3] ?? 0, o.holeNormals[i * 3 + 1] ?? 0, o.holeNormals[i * 3 + 2] ?? 1)) },
    uLeather: { value: new THREE.Color(o.glove ?? 0x111111) },
    uAccent: { value: new THREE.Color(o.accent ?? 0xb9a6ff) },
    uTanAt: { value: rollAt(o.female) - 32 },     // mm from the wrist: paler skin above this (the roll starts 16 mm below rollAt)
    uFem: { value: o.female ? 1 : 0 },
    uDbg: { value: 0 },             // debugging (test page ?skindbg=): 1 no relief, 2 no occlusion, 3 flat colour
  };
  // the sheen (the fine vellus hair and the skin's oily film) and the specular lobe follow the tone: on dark skin a
  // light sheen reads as a wet, chalky film
  const fit = (hex: number) => {
    const k = darkness(hex);
    m.sheenColor.setRGB(0.75 - 0.42 * k, 0.62 - 0.38 * k, 0.56 - 0.36 * k);
    m.specularIntensity = 0.62 - 0.2 * k;
    m.clearcoat = high ? (gloved ? 0.35 : 0.06 * (1 - k)) : 0;
    // black leather: a faint neutral sheen, not the skin's peach film (which turned it grey)
    if (gloved) { m.sheen = high ? 0.12 : 0; m.sheenColor.setRGB(0.3, 0.29, 0.28); m.specularIntensity = 0.5; }
  };
  fit(o.tone);
  m.setTone = (hex: number) => { uniforms.uTone.value.set(hex); uniforms.uDark.value = darkness(hex); fit(hex); };
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
// a racing glove covers the whole hand to its gauntlet; where a driving glove had knuckle holes it has pads
float leatherAt(float along) { return 1.0 - smoothstep(18.0, 22.0, along); }
float padAt(vec3 hp) {
  float pad = 0.0;
  for (int i = 0; i < 4; i++) { float d = length(hp - uHoles[i].xyz) - uHoles[i].w * 1.15; pad = max(pad, smoothstep(0.8, -1.6, d)); }
  return pad;
}
#endif
`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + decl)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
vHand = aHand; vSkin = aSkin; vJoint = aJoint; vArm = aArm;
#ifdef GLOVE
vLeather = leatherAt(aArm.x);
transformed += normal * (0.0009 + 0.0011 * padAt(aHand * 1000.0)) * vLeather;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
varying vec3 vHand; varying vec4 vSkin; varying vec4 vJoint; varying vec2 vArm;
uniform vec3 uTone; uniform float uDark; uniform vec4 uVeins[${NV * 3}]; uniform float uVeinAmt; uniform float uFem; uniform float uDbg; uniform float uTanAt;
#ifdef GLOVE
uniform vec4 uHoles[5]; uniform vec3 uHoleN[5]; uniform vec3 uLeather; uniform vec3 uAccent; varying float vLeather;
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
  vec4 a = uVeins[i * 3], b = uVeins[i * 3 + 1]; vec3 up = uVeins[i * 3 + 2].xyz;
  // distance across the skin (the 'up' component removed): a band that follows the surface, not a buried tube that
  // the skin only touches in spots (those spots read as dark specks from the seat)
  vec3 pa = hp - a.xyz, ba = b.xyz - a.xyz;
  float t = clamp(dot(pa - up * dot(pa, up), ba - up * dot(ba, up)) / max(dot(ba - up * dot(ba, up), ba - up * dot(ba, up)), 1e-3), 0.0, 1.0);
  vec3 q = pa - ba * t;
  float hz = dot(q, up);
  float d = length(q - up * hz) / a.w;
  vein = max(vein, exp(-d * d * 1.6) * smoothstep(14.0, 7.0, abs(hz)));
}
float wob = vnoise(hp * 0.35);
vein *= uVeinAmt * dorsal * smoothstep(0.15, 0.6, wob + 0.3) * (1.0 - uDark * 0.55);
// ---- colour
vec3 c = pow(uTone, vec3(1.12)) * 0.8;          // the game's display colour as an albedo: a touch darker, richer
float m1 = vnoise(hp * 0.07) - 0.5, m2 = vnoise(hp * 0.21 + 7.1) - 0.5, m3 = vnoise(hp * 0.9 + 3.3) - 0.5;
c *= 1.0 + 0.07 * m1 + 0.05 * m2 + 0.025 * m3;
c = mix(c, c * vec3(1.06, 0.93, 0.9), clamp(m1 * 1.6 + 0.4, 0.0, 1.0) * 0.35);
vec3 redT = mix(vec3(1.12, 0.80, 0.76), vec3(0.80, 0.70, 0.68), uDark);
c *= mix(vec3(1.0), redT, clamp(red, 0.0, 1.0) * 0.6);   // subtle: strong red read as swollen knuckles
vec3 palmTone = mix(c * vec3(1.05, 0.97, 0.95), vec3(0.5, 0.33, 0.27), 0.12 + 0.42 * uDark);
c = mix(c, palmTone, clamp(palmar * 0.9, 0.0, 1.0) * (0.35 + 0.5 * uDark));
c *= mix(vec3(1.0), mix(vec3(0.86, 0.93, 1.03), vec3(0.86, 0.84, 0.86), uDark), vein * 0.55);   // blue-grey under light skin, darker under dark
// the tan line: the skin the rolled sleeve usually covers is a shade paler (less so on dark skin), a soft edge
c *= mix(vec3(1.0), vec3(1.2, 1.14, 1.1), smoothstep(uTanAt - 2.0, uTanAt + 2.0, vArm.x) * (1.0 - 0.6 * uDark));
// (no pigment-spot term: from the seat its dots read as dirt or stubble)
// ---- relief (mm), turned into metres for the bump
float H = 0.0;
#ifdef SKIN_HIGH
vec2 cl = cells(hp * 1.05 + vec3(0.0, wob, 0.0));
// (subtle, and fading out well before a pore reaches a pixel: stronger read as orange peel / plucked skin)
float fine2 = fine * fine;
H -= 0.013 * smoothstep(0.16, 0.0, cl.y) * fine2 * (1.0 - palmar * 0.4);        // the furrow network
H -= 0.007 * smoothstep(0.22, 0.0, cl.x) * fine2;                               // pores at its nodes
H += 0.008 * (vnoise(hp * 3.1) - 0.5) * fine2;
#else
H += 0.04 * (vnoise(hp * 1.6) - 0.5) * mid;
#endif
// creases across the finger joints: a few curved lines on the back, deepest over the middle knuckle
float ax = vJoint.x, la = vJoint.y, st = vJoint.z, kind = vJoint.w;
// a negative strength (the thumb's IP): the crease's wrinkles also read from the seat, as a soft band where a pixel is
// too coarse for the lines (else the joint vanished and the thumb read as one sausage)
float far3 = step(st, -1e-4);
st = abs(st);
float win = exp(-(ax * ax) / (kind > 1.5 ? 70.0 : kind > 0.5 ? 30.0 : 22.0)) * st;
float arc = ax + la * la * (kind > 0.5 ? 0.02 : 0.035) + (vnoise(hp * 0.7) - 0.5) * 1.2;
float sp = kind > 1.5 ? 2.2 : kind > 0.5 ? 1.15 : 1.35;
float lines = pow(0.5 + 0.5 * cos(arc * 6.2832 / sp), 6.0);
// a crease line is ~0.2 of its spacing wide: once a pixel is wider than that it aliases into dots, so it turns into
// its own average (a soft shading across the joint) instead
float sharpC = smoothstep(sp * 0.42, sp * 0.16, pix);
lines = mix(0.226, lines, sharpC);
float crease = win * lines * mix(1.0, 0.65, uFem);
H -= 0.11 * crease * mid * sharpC;
// knuckle folds: the slack skin round the big knuckles
H += 0.035 * (vnoise(hp * vec3(0.5, 1.6, 0.5)) - 0.5) * smoothstep(0.2, 0.8, red) * dorsal * fine;
// veins raised a little (only while a vein is a few pixels wide)
H += 0.24 * vein * smoothstep(1.2, 0.45, pix);
c *= 1.0 - 0.18 * crease * mid;
// (the thumb's IP band: narrower than the crease's window and deeper, so the joint reads as a crease across the thumb
// at a phone's scale whatever the light. A darker colour alone barely showed: the skin's sheen and specular, and the
// tone curve's shoulder, are the same over it. The wrinkles' own shadowing also takes some of the light, so the band
// is an occlusion too: in shade, where the knuckle's own shading is gone, it carries the joint)
float ipBand = far3 * exp(-(ax * ax) / 9.0) * st * (1.0 - sharpC) * (1.0 - 0.35 * uFem);
c *= mix(vec3(1.0), vec3(0.80, 0.76, 0.77), ipBand);
ao *= 1.0 - 0.22 * ipBand;
diffuseColor.rgb = c;
float rough = mix(0.54, 0.43, clamp(red * dorsal, 0.0, 1.0)) + 0.08 * palmar + 0.05 * (1.0 - fine) + 0.03 * m3 + 0.08 * crease + 0.06 * uDark;
float leather = 0.0;
#ifdef GLOVE
leather = smoothstep(0.35, 0.65, vLeather);
{
  // the knuckle pads: raised, ribbed across, a groove and a row of stitching round each; the back of the hand is a
  // separate panel, its seam stitched
  float edge = 0.0, stitch = 0.0, pad = 0.0, rib = 0.0;
  for (int i = 0; i < 5; i++) {
    vec3 q = hp - uHoles[i].xyz, n = uHoleN[i];
    float r = uHoles[i].w * (i < 4 ? 1.15 : 1.0);
    float d = length(q) - r;
    vec3 e1 = normalize(cross(n, vec3(0.31, 0.95, 0.07))), e2 = cross(n, e1);
    float ang = atan(dot(q, e2), dot(q, e1)) * (r + 1.2);
    float sd = i < 4 ? 1.1 : 0.0;
    edge = max(edge, smoothstep(0.9, 0.0, abs(d - sd * 0.3)) * (i < 4 ? 1.0 : 0.6));
    stitch = max(stitch, smoothstep(0.42, 0.12, abs(d - sd - 0.9)) * step(0.5, fract(ang / 2.2)));
    if (i < 4) {
      float pk = smoothstep(0.4, -1.4, d);
      pad = max(pad, pk);
      rib = max(rib, pk * pow(0.5 + 0.5 * cos(dot(q, e2) * 6.2832 / 2.6), 2.0));
    }
  }
  // the wrist strap, its stitching, and the accent stripe across the closure
  float along = vArm.x;
  float strap = smoothstep(4.0, 5.0, along) * smoothstep(17.0, 16.0, along) * smoothstep(0.55, 0.3, palmar);
  float sline = (smoothstep(0.35, 0.1, abs(along - 6.2)) + smoothstep(0.35, 0.1, abs(along - 14.8))) * step(0.5, fract(dot(hp, vec3(0.31, 0.6, 0.73)) / 2.3)) * strap;
  float stripe = smoothstep(1.7, 1.2, abs(along - 10.5)) * strap * smoothstep(1.6, 0.6, pix);
  // each finger is sewn from a back and a palm piece: a raised seam with its stitching runs down both sides of the
  // finger (where the back turns into the palm side) and round the tip
  float onF = smoothstep(0.15, 0.4, thin);
  float sd = abs(palmar - 0.42);
  float fseam = smoothstep(0.1, 0.03, sd) * onF;
  float fst = smoothstep(0.05, 0.0, sd) * step(0.45, fract(dot(hp, vec3(0.57, 0.41, 0.71)) / 1.9)) * onF;
  stitch = max(stitch, fst);
  edge = max(edge, fseam * 0.6);
  vec2 grain = cells(hp * 1.4);
  float gH = 0.06 * smoothstep(0.2, 0.0, grain.y) * mid;
  float fold = win * pow(0.5 + 0.5 * cos(arc * 6.2832 / (sp * 2.6)), 3.0);
  vec3 lc = max(uLeather, vec3(0.028)) * (1.0 + 0.12 * m1 + 0.08 * m2);
  lc = mix(lc, lc * 1.6 + 0.01, smoothstep(0.3, 0.9, red) * 0.35 * dorsal);          // worn and polished over the knuckles
  lc *= 1.0 - 0.35 * fold;
  lc = mix(lc, lc * 0.55, edge);
  lc = mix(lc, vec3(0.16, 0.15, 0.14), stitch * 0.85);
  lc = mix(lc, lc * 0.6, sline * 0.8);
  lc *= 1.0 + 0.25 * pad - 0.3 * rib * mid;                 // the pads: a smoother, slightly shinier leather, ribbed
  lc = mix(lc, uAccent * 0.75, stripe);
  diffuseColor.rgb = mix(diffuseColor.rgb, lc, leather);
  H = mix(H, -gH * (1.0 - pad) - 0.22 * fold * mid * (1.0 - pad) + 0.12 * stitch * mid + 0.25 * strap * mid - 0.1 * sline + 0.18 * fseam * mid
           + 0.35 * pad * mid - 0.12 * rib * mid - 0.2 * edge * mid + 0.06 * stripe, leather);
  rough = mix(rough, 0.48 - 0.12 * smoothstep(0.3, 0.9, red) * dorsal + 0.1 * fold + 0.1 * edge - 0.1 * pad + 0.12 * stripe, leather);
  thin *= 1.0 - leather; ao = mix(ao, ao * 0.95, leather);
}
#endif
if (uDbg > 0.5 && uDbg < 1.5) H = 0.0;
if (uDbg > 1.5 && uDbg < 2.5) ao = 1.0;
if (uDbg > 2.5) diffuseColor.rgb = vec3(0.6, 0.45, 0.35);
gThin = thin * (1.0 - uDark * 0.5);
gSss = mix(vec3(1.0, 0.34, 0.22), vec3(0.75, 0.32, 0.22), uDark);
gAoD = mix(1.0, ao, 0.45);
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(rough, 0.25, 0.85);')
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
normal = bumpNormal(-vViewPosition, normal, H * 0.001, faceDirection);`)
      .replace('#include <lights_fragment_end>', /* glsl */ `#include <lights_fragment_end>
{
  // occluded skin goes warm-dark (light scattered through the flesh), not grey
  reflectedLight.indirectDiffuse *= ao * mix(vec3(1.0), vec3(1.12, 0.92, 0.88), (1.0 - ao) * 0.7);
  float dotNVo = saturate(dot(geometryNormal, geometryViewDir));
  reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNVo, ao, material.roughness);
  // specular and sheen die in the creases where the fingers press together (bright specks there read as cracks)
  float ao2 = ao * ao;
  reflectedLight.directSpecular *= mix(1.0, ao2, 0.85);
  #ifdef USE_SHEEN
  sheenSpecularIndirect *= ao2;
  sheenSpecularDirect *= ao2;
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
    const b = i * 10;
    if (b + 9 < v.length) out.push(new THREE.Vector4(v[b], v[b + 1], v[b + 2], v[b + 6]), new THREE.Vector4(v[b + 3], v[b + 4], v[b + 5], 0), new THREE.Vector4(v[b + 7], v[b + 8], v[b + 9], 0));
    else out.push(new THREE.Vector4(1e4, 1e4, 1e4, 1), new THREE.Vector4(1e4, 1e4, 1e4, 0), new THREE.Vector4(0, 1, 0, 0));
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
    color: 0xffffff, roughness: painted ? 0.16 : 0.36, metalness: 0, ior: 1.5,
    clearcoat: painted ? 1 : 0.12, clearcoatRoughness: painted ? 0.04 : 0.25,
    envMapIntensity: painted ? 1 : 0.7, polygonOffset: false,
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
float s = vNail.x, w = vNail.y, freeAt = vNail.z, L = abs(vNail.w);     // mm from the cuticle; -1..1 across
float nRim = step(vNail.w, 0.0);                                      // the plate's cut edge
float side = vNail.y;
// the nail bed: pink over the skin tone; paler toward the free edge's line; the lunula at the base
// (a little lighter and pinker than the skin round it, so the plate still registers a few pixels wide from the seat)
vec3 bed = mix(uTone * vec3(1.08, 0.86, 0.84) + 0.035, vec3(0.74, 0.47, 0.45), 0.3 + 0.25 * uDark);
bed = mix(bed, bed * vec3(1.06, 1.02, 1.0) + 0.03, smoothstep(freeAt - 2.0, freeAt, s) * 0.35);
float lun = smoothstep(0.08, -0.08, length(vec2((s - 0.3) / (L * 0.2 + 0.6), w * 0.85)) - 1.0);
bed = mix(bed, bed * vec3(1.12, 1.08, 1.06) + 0.05, lun * 0.55);
// the free edge: off-white, the smile line where it leaves the fingertip
// (translucent: the bed's colour shows through it, whiter only where it is thick and clear of the finger)
vec3 fe = mix(bed * vec3(1.04, 1.0, 0.98) + 0.015, vec3(0.70, 0.66, 0.60), 0.06 + 0.4 * smoothstep(1.0, 3.5, s - freeAt)) * (0.94 + 0.06 * vnoise(vec3(s * 3.0, w * 4.0, 0.0)));
float isFree = smoothstep(freeAt - 0.15, freeAt + 0.35, s + 0.25 * w * w);
vec3 nc = mix(bed, fe, isFree);
nc = mix(nc, uTone * vec3(1.0, 0.86, 0.82), smoothstep(0.9, 0.0, s) * 0.6);      // the cuticle: skin over the plate's base
float ridges = vnoise(vec3(w * 9.0, s * 0.25, 1.0));
nc *= 0.96 + 0.06 * ridges;
// polish: a hair short of the cuticle and the side walls
float coat = uPainted * smoothstep(0.35, 0.65, s);   // the polish wraps the free edge and the plate's sides
vec3 pc = uPaint * (0.95 + 0.05 * vnoise(vec3(s * 0.8, w * 2.0, 3.0)));
diffuseColor.rgb = mix(nc, pc, coat);
// the cut edge: the bed's colour at ~70%, matte (not a white crescent catching the sky)
diffuseColor.rgb = mix(diffuseColor.rgb, mix(bed, pc, coat) * 0.7, nRim);
float nailRough = mix(mix(mix(0.32, 0.4, isFree), 0.12, coat), 0.7, nRim);
float nailH = mix(0.004 * ridges, 0.0, coat);
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = nailRough;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - 0.6 * nRim;\n#endif')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bumpNormal(-vViewPosition, normal, nailH * 0.001, faceDirection);');
  };
  return m;
}

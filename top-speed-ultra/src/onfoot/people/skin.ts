// Skin for faces and bodies: MeshPhysicalMaterial with its shader extended, after src/preview/hands-skin.ts (copied
// and adapted: that folder belongs to another workflow).
//  - colour from the tone, varied per vertex: warmer cheeks, nose and ears; lips (natural or lipstick); blush;
//    stubble and beard shadow; eyeshadow; the mouth's dark interior; the scalp under the hair; freckles; tattoos
//  - procedural relief in the rest pose's frame (it sticks to the skin as it moves): a 3 mm unevenness that survives at
//    conversation distance, a fine furrow network and pores (larger on the nose and cheeks) when they are resolved;
//    with age, forehead lines, crow's feet and neck rings (vertex-masked), and per-pixel nasolabial folds, marionette
//    and glabellar lines, under-eye bags and age spots; everything faded out below a pixel
//  - roughness varied (an oilier T-zone, wet lips and mouth, sebum in the folds), a soft sheen, a faint clearcoat on 'high'
//  - a cheap subsurface look: wrapped, red-tinted diffuse and light through thin parts (ears, nose), baked AO
import * as THREE from 'three';
import { Quality } from './params';

export const NOISE = /* glsl */ `
float hh13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hh33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh13(i), hh13(i + vec3(1,0,0)), f.x), mix(hh13(i + vec3(0,1,0)), hh13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hh13(i + vec3(0,0,1)), hh13(i + vec3(1,0,1)), f.x), mix(hh13(i + vec3(0,1,1)), hh13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
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
float segD2(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * t); }
float segS2(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); vec2 r = p - a - ab * t; return length(r) * sign(ab.x * r.y - ab.y * r.x + 1e-9); }
vec3 bumpNormal(vec3 pos, vec3 n, float H, float faceDir) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 g = sign(det) * (dFdx(H) * r1 + dFdy(H) * r2);
  return normalize(abs(det) * n - g);
}
`;

export function sssLights() {
  return THREE.ShaderChunk.lights_physical_pars_fragment
    .replace('void RE_Direct_Physical(', 'float gThin = 0.0; float gAoD = 1.0; vec3 gSss = vec3(1.0, 0.42, 0.3); float gWrap = 1.0;\nvoid RE_Direct_Physical(')
    .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', /* glsl */ `
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * gAoD;
	#ifdef SKIN_SSS
	float nl = dot( geometryNormal, directLight.direction );
	float wrapNL = saturate( ( nl + 0.5 ) / 1.5 );
	reflectedLight.directDiffuse += max( wrapNL - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseColor ) * gSss * 0.7 * gAoD * gWrap;
	float back = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 );
	float thru = saturate( 0.35 - nl );
	reflectedLight.directDiffuse += directLight.color * gThin * ( back * 0.7 + 0.12 ) * thru * gSss * material.diffuseColor;
	#endif`);
}

export interface SkinLook {
  tone: number; lipstick: number | null; blush: number; beard: number; beardColor: number; liner: number;
  hairColor: number; freckles: number; age: number; male: boolean; tattooInk?: number;
}

export interface SkinMaterial extends THREE.MeshPhysicalMaterial { uniformsRef: Record<string, THREE.IUniform> }

export function darkness(hex: number) {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return THREE.MathUtils.clamp((0.6 - l) / 0.52, 0, 1);
}

export function skinMaterial(o: SkinLook, quality: Quality, detail: 'face' | 'body' = 'face'): SkinMaterial {
  const high = quality === 'high';
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.5, metalness: 0, ior: 1.4, specularIntensity: 0.45,
    sheen: high ? 0.3 : 0, sheenColor: new THREE.Color(0.75, 0.62, 0.56), sheenRoughness: 0.45,
    clearcoat: high ? 0.03 : 0, clearcoatRoughness: 0.35, envMapIntensity: 0.8,
  }) as SkinMaterial;
  const u: Record<string, THREE.IUniform> = {
    uTone: { value: new THREE.Color(o.tone) }, uDark: { value: darkness(o.tone) },
    uLip: { value: new THREE.Color(o.lipstick ?? 0x000000) }, uLipAmt: { value: o.lipstick === null ? 0 : 1 },
    uBlush: { value: o.blush }, uBeard: { value: o.beard }, uBeardCol: { value: new THREE.Color(o.beardColor) },
    uLiner: { value: o.liner }, uHair: { value: new THREE.Color(o.hairColor) }, uFreckles: { value: o.freckles },
    uAge: { value: THREE.MathUtils.clamp((o.age - 25) / 50, 0, 1) }, uMale: { value: o.male ? 1 : 0 },
    uInk: { value: new THREE.Color(o.tattooInk ?? 0x1a2230) },
    uHeadO: { value: new THREE.Vector3(0, 0, 0) }, uHeadS: { value: new THREE.Vector3(1, 1, 1) }, uLipP: { value: new THREE.Vector4(-1, 0.026, 1, 1) },
    uFaceP: { value: new THREE.Vector4(0.0315, -0.036, 0, 0) },   // the eye's x, the nose tip's y (head-local), the head's old
  };
  m.uniformsRef = u;
  m.customProgramCacheKey = () => `pskin-${quality}-${detail}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.defines = { ...(sh.defines ?? {}), SKIN_SSS: 1, ...(high ? { SKIN_HIGH: 1 } : {}), ...(detail === 'face' ? { SKIN_FACE: 1 } : {}) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec4 aSkin; attribute vec4 aFace; attribute vec4 aMisc;\nvarying vec3 vRest; varying vec4 vSkin; varying vec4 vFace; varying vec4 vMisc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vSkin = aSkin; vFace = aFace; vMisc = aMisc;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
varying vec3 vRest; varying vec4 vSkin; varying vec4 vFace; varying vec4 vMisc;
uniform vec3 uTone; uniform float uDark; uniform vec3 uLip; uniform float uLipAmt; uniform float uBlush; uniform float uBeard; uniform vec3 uBeardCol;
uniform float uLiner; uniform vec3 uHair; uniform float uFreckles; uniform float uAge; uniform float uMale; uniform vec3 uInk;
uniform vec3 uHeadO; uniform vec3 uHeadS; uniform vec4 uLipP; uniform vec4 uFaceP;
${NOISE}`)
      .replace('#include <lights_physical_pars_fragment>', sssLights())
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
vec3 hp = vRest * 1000.0;                       // mm, rest pose
float pix = length(fwidth(hp));
float fine = smoothstep(0.9, 0.25, pix);        // sub-mm detail (pores, furrows): only where it is resolved
float mid = smoothstep(3.5, 0.9, pix);          // mm-scale detail (creases, lip lines)
float mid3 = smoothstep(2.2, 0.7, pix);         // 3 mm mottle and relief: the scale a face is seen at in conversation (1-3 px/mm)
float red = vSkin.x, lip = vSkin.y, ao = vSkin.z, thin = vSkin.w;
float blush = vFace.x, beard = vFace.y, eyeA = min(vFace.z, 1.0), mouth = vFace.w, lashL = clamp(vFace.z - 1.0, 0.0, 1.0);
float tat = vMisc.x, scalp = vMisc.y, wrink = vMisc.z, fz = vMisc.w;
#ifndef SKIN_FACE
red = max(red, 0.12);                           // the neck, chest and arms carry a little of the face's warmth: no mask edge at the jaw
#endif
vec3 c = pow(uTone, vec3(1.12)) * 0.8;
c = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 0.86);   // real skin is less saturated than a paint chip
float m1 = vnoise(hp * 0.05) - 0.5, m2 = vnoise(hp * 0.17 + 7.1) - 0.5, m3 = vnoise(hp * 0.8 + 3.3) - 0.5;
float m4 = vnoise(hp * 0.32 + 11.7) - 0.5;      // 3 mm mottle: the unevenness that survives at conversation distance
float ageT = 1.0 + 0.6 * uAge;                  // older skin is more uneven in tone and relief
c *= 1.0 + 0.06 * m1 + 0.045 * m2 + 0.02 * m3 + 0.06 * m4 * mid3 * ageT;
c = mix(c, c * vec3(1.05, 0.93, 0.9), clamp(m1 * 1.6 + 0.4, 0.0, 1.0) * 0.3);
// redder patches a few mm across (capillaries) and yellower ones between (pigment): skin is not one paint
c = mix(c, c * vec3(1.06, 0.9, 0.88), clamp(m4 * 2.5 + 0.25, 0.0, 1.0) * 0.4 * mid3 * ageT);
c = mix(c, c * vec3(1.0, 0.98, 0.9), clamp(-m2 * 2.0, 0.0, 1.0) * 0.25);
vec3 redT = mix(vec3(1.09, 0.84, 0.83), vec3(0.86, 0.74, 0.72), uDark);   // pink-red, not orange (orange cheeks read as a tan mask over a pale neck)
c *= mix(vec3(1.0), redT, clamp(red, 0.0, 1.0) * 0.75);
// lips: a darker, redder, slightly cooler tone, or lipstick
vec3 lipN = c * mix(vec3(0.92, 0.62, 0.62), vec3(0.78, 0.6, 0.62), uDark);
vec3 lipC = mix(lipN, pow(uLip, vec3(1.1)) * 0.85, uLipAmt * 0.92);
float lipM = smoothstep(0.15, 0.75, lip);
#ifdef SKIN_FACE
vec3 hl = (vRest - uHeadO) / uHeadS;            // head-local metres: origin between the eyes, +z out of the face, x to the person's left
{
  // the vermilion border, per pixel: a crisp line with the Cupid's bow, whatever the mesh's resolution
  float mY = uLipP.x, mw = uLipP.y, ax = abs(hl.x);
  float xr = clamp(1.0 - (hl.x / mw) * (hl.x / mw), 0.0, 1.0);
  float hU = 0.0068 * uLipP.z * pow(xr, 0.5) * (1.0 + 0.16 * exp(-pow((ax - 0.0046) / 0.0032, 2.0)) - 0.1 * exp(-pow(hl.x / 0.0022, 2.0)));
  float hL = 0.0086 * uLipP.w * pow(xr, 0.62);
  float dy = hl.y - mY, aa = max(0.00025, fwidth(dy) * 0.8);
  float inU = dy >= 0.0 ? smoothstep(hU + aa, hU - aa, dy) : 0.0;
  float inL = dy < 0.0 ? smoothstep(hL + aa, hL - aa, -dy) : 0.0;
  float lipA = clamp((inU + inL) * smoothstep(0.004, 0.011, hl.z) * smoothstep(mw + 0.0008, mw - 0.0015, ax), 0.0, 1.0);
  if (uLipP.x > -0.5) lipM = lipA;
}
#endif
c = mix(c, lipC, lipM);
// blush
c = mix(c, c * vec3(1.08, 0.86, 0.84), blush * uBlush * (1.0 - uDark * 0.5));
// eyes: a touch of shadow and liner close to the lids; under-eye shadow with age
c *= 1.0 - eyeA * (0.17 + 0.12 * uAge + 0.22 * uLiner * (1.0 - uMale));   // lids are more pigmented than the cheek
c = mix(c, c * vec3(0.97, 0.92, 0.93), eyeA * 0.6);
c = mix(c, vec3(0.035, 0.026, 0.024), lashL);   // the lash line along each lid margin: what makes an eye read at a distance
// stubble and beard shadow
float stub = 0.0;
#ifdef SKIN_FACE
{
  vec2 sc = cells(hp * 2.2);
  float dots = smoothstep(0.32, 0.1, sc.x);
  stub = beard * uBeard * (0.45 + 0.55 * dots * mid);
  c = mix(c, mix(c * 0.62, uBeardCol * 0.6, 0.55), clamp(stub, 0.0, 1.0) * 0.8);
}
#endif
// scalp under the hair: the hair's colour, with strands
{
  float strand = 0.65 + 0.35 * vnoise(hp * vec3(1.6, 0.25, 1.6));
  // a broken, soft hairline: noise along the edge, fine hairs thinning out onto the skin
  float scE = scalp + 0.32 * (vnoise(hp * vec3(0.9, 0.35, 0.9)) - 0.5) + 0.18 * (vnoise(hp * vec3(3.0, 0.6, 3.0)) - 0.5);
  c = mix(c, uHair * 0.55 * strand, smoothstep(0.3, 0.95, scE));
}
// freckles; age spots (a few flat brown marks 2-3 mm across on lighter skin)
#ifdef SKIN_FACE
{
  vec2 fr = cells(hp * 0.55); c *= 1.0 - uFreckles * fz * 0.28 * smoothstep(0.24, 0.08, fr.x) * step(0.55, hh13(floor(hp * 0.55) + 2.0));
  vec2 sp = cells(hp * 0.11 + 4.0);
  float spot = uAge * (1.0 - uDark * 0.7) * smoothstep(0.34, 0.16, sp.x) * step(0.87, hh13(floor(hp * 0.11 + 4.0) + 9.0)) * mid3;
  c = mix(c, c * vec3(0.84, 0.74, 0.66), spot * 0.6);
}
#endif
// tattoos: our own line work (waves, leaves, a rose-like spiral), in the rest frame of the arm
if (tat > 0.01) {
  vec3 q = hp * 0.045;
  float w1 = abs(sin(q.y * 2.2 + 2.0 * sin(q.x * 1.3 + q.z * 1.1)));
  float w2 = abs(sin(length(q.xz - floor(q.xz / 2.6) * 2.6 - 1.3) * 5.0 - q.y * 0.6));
  float lines = smoothstep(0.16, 0.05, min(w1, w2 + 0.1));
  float fill = smoothstep(0.55, 0.62, vnoise(q * 1.7)) * 0.6;
  float ink = clamp(lines + fill, 0.0, 1.0) * tat;
  c = mix(c, uInk * (0.6 + 0.4 * c), ink * 0.85);
}
// ---- age in the face, per pixel in the head's frame (the mesh is too coarse to carry a 2 mm groove): the nasolabial
// folds, marionette and glabellar lines, the bag and tear trough under each eye. Never on the lips or the lids.
float fold = 0.0, bag = 0.0, trough = 0.0, bulge = 0.0;
#ifdef SKIN_FACE
{
  vec2 q = vec2(abs(hl.x), hl.y);
  float mY = uLipP.x, mw = uLipP.y, ex = uFaceP.x, nY = uFaceP.y;
  float front = smoothstep(0.0, 0.008, hl.z) * (1.0 - lipM) * (1.0 - eyeA);
  // the nasolabial fold: from the alar crease, bowing out across the cheek, to beyond the mouth corner; faint when young
  vec2 a0 = vec2(0.016, nY - 0.003), a1 = vec2(mw + 0.004, mY + 0.013), a2 = vec2(mw + 0.008, mY - 0.007);
  float s1 = segS2(q, a0, a1), s2 = segS2(q, a1, a2);
  float sd = abs(s1) < abs(s2) ? s1 : s2;      // signed: positive on the cheek's side
  float nAmt = 0.15 + 0.85 * uAge;
  float naso = exp(-pow(sd / 0.003, 2.0)) * nAmt;
  bulge = exp(-pow((sd - 0.0045) / 0.0032, 2.0)) * nAmt * smoothstep(mY - 0.01, mY + 0.004, q.y);   // the cheek overhangs the groove
  // marionette lines: from the mouth corner down beside the chin, fading out
  float dm = segD2(q, vec2(mw + 0.004, mY - 0.007), vec2(mw + 0.009, mY - 0.03));
  float mari = exp(-pow(dm / 0.0028, 2.0)) * uAge * smoothstep(mY - 0.032, mY - 0.018, q.y);
  // the glabellar lines between the brows
  float dg = segD2(q, vec2(0.0078, 0.014), vec2(0.0062, 0.029));
  float glab = exp(-pow(dg / 0.0022, 2.0)) * uAge * 0.8;
  fold = clamp(naso + mari + glab, 0.0, 1.0) * front;
  bulge *= front;
  // under each eye: a soft pillow below the lower lid, the tear trough beneath it
  float bx = (q.x - ex) / 0.013, by = (q.y + 0.0135) / 0.006;
  bag = exp(-(bx * bx + by * by)) * uAge * front;
  float tx = (q.x - ex) / 0.015, ty = (q.y + 0.0215) / 0.003;
  trough = exp(-(tx * tx + ty * ty)) * uAge * front;
}
#endif
// forehead lines, crow's feet and neck rings: furrows about 8 mm apart that wander and break up, deeper and darker with age
float crease = wrink * uAge * pow(0.5 + 0.5 * sin(hp.y * 0.78 + 2.0 * vnoise(hp * 0.08)), 4.0) * (0.55 + 0.45 * vnoise(hp * vec3(0.12, 0.4, 0.12) + 2.0)) * mid * (1.0 - lipM) * (1.0 - eyeA);
c *= 1.0 - 0.18 * crease - 0.13 * fold - 0.1 * trough - 0.05 * bag;
c = mix(c, c * vec3(0.92, 0.86, 0.9), (trough + 0.4 * bag) * 0.5);   // the shadowed, bluer skin under the eye
// mouth interior
c = mix(c, vec3(0.2, 0.045, 0.05) * (0.4 + 0.6 * ao), smoothstep(0.2, 0.8, mouth));
diffuseColor.rgb = c;
// ---- relief (mm)
float H = 0.0;
float poreS = 1.0 + red * 0.6;
// the mid frequency, 3 mm and 1.4 mm: pore clusters, follicles and the unevenness that reads as skin at 1-3 px/mm
float r1 = vnoise(hp * 0.35 + 5.0) - 0.5, r2 = vnoise(hp * 0.7 + 8.0) - 0.5;
H += (0.12 * r1 + 0.05 * r2 * smoothstep(1.6, 0.5, pix)) * mid3 * (0.7 + 0.5 * uAge) * (1.0 - lipM * 0.7) * (1.0 - eyeA * 0.5);
#ifdef SKIN_HIGH
vec2 cl = cells(hp * 1.0 + vec3(0.0, m2, 0.0));
H -= 0.02 * smoothstep(0.2, 0.0, cl.y) * fine * (1.0 - lipM);
vec2 po = cells(hp * 1.4 / poreS);
H -= 0.03 * poreS * smoothstep(0.3, 0.06, po.x) * fine * (1.0 - lipM);
H += 0.015 * (vnoise(hp * 2.7) - 0.5) * fine;
#else
H += 0.035 * (vnoise(hp * 1.5) - 0.5) * fine;   // gated fine: at 2 px/mm this was per-pixel speckle
#endif
// vertical lip lines
H -= 0.06 * lipM * pow(0.5 + 0.5 * sin(hp.x * 2.6 + vnoise(hp * 0.6) * 3.0), 3.0) * mid;
// age: the furrows, folds, troughs and bags, plus a finer creasing across the cheeks
H -= 0.5 * crease + 0.55 * fold + 0.35 * trough - 0.55 * bag - 0.35 * bulge;
H -= uAge * 0.06 * smoothstep(0.42, 0.5, vnoise(hp * vec3(0.3, 0.8, 0.3))) * mid3;
H += stub * 0.03 * fine;
float rough = 0.52 - 0.12 * red * (1.0 - uDark * 0.3) + 0.05 * (1.0 - fine) + 0.03 * m3 + 0.03 * m4 * mid3;
rough -= 0.07 * (crease + fold);   // sebum sits in the folds
rough = mix(rough, mix(0.42, 0.3, uLipAmt), lipM);
rough = mix(rough, 0.22, smoothstep(0.2, 0.8, mouth));
rough += 0.12 * eyeA;   // a matte lid: no env sheen turning a closed lid into a pale disc
rough = mix(rough, 0.62, clamp(stub, 0.0, 1.0) * 0.6);
rough = mix(rough, 0.85, smoothstep(0.1, 0.8, scalp));   // a buzz cut is matte, never a polished dome
gThin = thin * (1.0 - uDark * 0.5);
gSss = mix(vec3(1.0, 0.36, 0.24), vec3(0.78, 0.34, 0.24), uDark);
gAoD = mix(1.0, ao, 0.5);
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(rough, 0.2, 0.85);')
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

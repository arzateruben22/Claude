// Fabric shading for the clothes shells: MeshPhysicalMaterial with its shader extended.
//  - per fabric: satin (low roughness, a strong coloured sheen), cotton jersey, denim (twill, slubs, lighter wear on
//    the thighs and knees), leather (grain, a light clearcoat), knit (ribs), wool (fuzz), linen (slubs, more creasing)
//  - creases near the joints and the waist (bands across the limb axis, broken by noise), baked AO, a darker inside
//    (the shells are drawn double-sided), the hem band with a stitch line, an accent colour (soles, trim)
// Everything is in the rest pose's frame, so the weave and the creases stick to the cloth as it moves.
import * as THREE from 'three';
import { Fabric, Quality } from './params';
import { NOISE } from './skin';

export const FABRIC_ID: Record<Fabric, number> = { satin: 0, cotton: 1, denim: 2, leather: 3, knit: 4, wool: 5, linen: 6 };

export interface ClothMaterial extends THREE.MeshPhysicalMaterial { uniformsRef: Record<string, THREE.IUniform> }

export function clothMaterial(color: number, fabric: Fabric, quality: Quality, accent = 0xf2f2f0): ClothMaterial {
  const high = quality === 'high';
  const f = FABRIC_ID[fabric];
  const P: Record<Fabric, Partial<THREE.MeshPhysicalMaterialParameters>> = {
    satin: { roughness: 0.42, sheen: 0.9, sheenRoughness: 0.35, specularIntensity: 0.55, clearcoat: 0, envMapIntensity: 0.45 },
    cotton: { roughness: 0.86, sheen: 0.55, sheenRoughness: 0.75, specularIntensity: 0.3 },
    denim: { roughness: 0.9, sheen: 0.35, sheenRoughness: 0.8, specularIntensity: 0.25 },
    leather: { roughness: 0.42, sheen: 0, specularIntensity: 0.6, clearcoat: high ? 0.35 : 0, clearcoatRoughness: 0.45 },
    knit: { roughness: 0.95, sheen: 0.8, sheenRoughness: 0.85, specularIntensity: 0.2 },
    wool: { roughness: 0.92, sheen: 0.7, sheenRoughness: 0.85, specularIntensity: 0.25 },
    linen: { roughness: 0.84, sheen: 0.4, sheenRoughness: 0.8, specularIntensity: 0.3 },
  };
  const base = new THREE.Color(color);
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, envMapIntensity: 0.7, side: THREE.DoubleSide, ...P[fabric] }) as ClothMaterial;
  if (fabric === 'satin') base.multiplyScalar(0.8);
  if (m.sheen > 0) m.sheenColor = base.clone().lerp(new THREE.Color(1, 1, 1), fabric === 'satin' ? 0.35 : 0.5).multiplyScalar(fabric === 'satin' ? 1 : 0.6);
  if (!high) { m.sheen *= 0.6; m.clearcoat = 0; }
  // drawn double-sided, but only the back faces go into shadow maps (front faces there make shadow acne stripes)
  m.shadowSide = THREE.BackSide;
  const u: Record<string, THREE.IUniform> = { uCol: { value: base }, uAcc: { value: new THREE.Color(accent) } };
  m.uniformsRef = u;
  m.customProgramCacheKey = () => `cloth-${f}-${quality}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    const dbg = (globalThis as { __clothDbg?: number }).__clothDbg;
    sh.defines = { ...(sh.defines ?? {}), FABRIC: f, ...(high ? { CLOTH_HIGH: 1 } : {}), ...(dbg ? { CLOTH_DBG: dbg } : {}) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec4 aCloth; attribute vec4 aFold;\nvarying vec3 vRest; varying vec4 vCloth; varying vec4 vFold;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vCloth = aCloth; vFold = aFold;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRest; varying vec4 vCloth; varying vec4 vFold;\nuniform vec3 uCol; uniform vec3 uAcc;\n${NOISE}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
vec3 hp = vRest * 1000.0;
float pix = length(fwidth(hp));
float fine = smoothstep(1.2, 0.35, pix), mid = smoothstep(5.0, 1.2, pix);
float acc = vCloth.x, edge = vCloth.y * 1000.0, ao = vCloth.z, wear = vCloth.w;
vec3 c = pow(uCol, vec3(1.0));
float n1 = vnoise(hp * 0.02) - 0.5, n2 = vnoise(hp * 0.11 + 3.0) - 0.5;
c *= 1.0 + 0.06 * n1 + 0.03 * n2;
float H = 0.0, rough = -1.0;
// creases: bands across the limb axis, broken up by noise
float fw = length(vFold.xyz);
if (fw > 0.01) {
  vec3 ax = vFold.xyz / fw;
  float along = dot(hp, ax), wob = vnoise(hp * 0.035) * 6.0 + vnoise(hp * 0.09) * 2.0;
  float band = 0.5 + 0.5 * sin(along * 0.24 + wob);
  float br = smoothstep(0.25, 0.75, vnoise(hp * vec3(0.05, 0.05, 0.05) + ax * along * 0.01));
  float cr = pow(band, 3.0) * br * min(fw, 1.0);
  H -= cr * 1.6 * mid;
  c *= 1.0 - 0.18 * cr;
}
#if FABRIC == 0
  // satin: smooth, a faint crinkle that breaks the reflections
  H += (vnoise(hp * 0.25) - 0.5) * 0.12 * mid;
  rough = 0.36 + 0.1 * vnoise(hp * 0.05);
#elif FABRIC == 1
  // cotton jersey: a fine knit
  H += (vnoise(hp * vec3(2.4, 1.2, 2.4)) - 0.5) * 0.05 * fine;
#elif FABRIC == 2
  // denim: twill diagonals, vertical slubs, lighter where it wears
  float tw = 0.5 + 0.5 * sin((hp.x + hp.z + hp.y * 1.4) * 4.2);
  float slub = vnoise(hp * vec3(1.5, 0.04, 1.5));
  c *= 0.86 + 0.22 * slub;
  c = mix(c, c * vec3(1.55, 1.6, 1.5) + vec3(0.04, 0.05, 0.07), wear * (0.45 + 0.4 * vnoise(hp * 0.06)));
  c = mix(c * 0.9, c * 1.08 + 0.015, tw * fine);
  H += tw * 0.03 * fine;
#elif FABRIC == 3
  // leather: pebbled grain
  vec2 gr = cells(hp * 0.9);
  H -= smoothstep(0.12, 0.0, gr.y) * 0.06 * fine;
  c *= 0.94 + 0.12 * vnoise(hp * 0.3);
  rough = 0.38 + 0.15 * vnoise(hp * 0.08) + 0.08 * smoothstep(0.12, 0.0, gr.y);
#elif FABRIC == 4
  // knit: ribs
  float rib = 0.5 + 0.5 * sin(hp.x * 2.2 + hp.z * 2.2);
  H += rib * 0.18 * mid;
  c *= 0.92 + 0.12 * rib * mid;
#elif FABRIC == 5
  H += (vnoise(hp * 1.3) - 0.5) * 0.08 * fine;
  c *= 0.95 + 0.1 * vnoise(hp * 0.5);
#else
  // linen: slubs both ways, more creasing
  float sl = vnoise(hp * vec3(0.05, 1.8, 0.05)) + vnoise(hp * vec3(1.8, 0.05, 1.8));
  c *= 0.9 + 0.1 * sl;
  H -= pow(0.5 + 0.5 * sin(vnoise(hp * 0.04) * 18.0), 6.0) * 0.5 * mid;
#endif
// the hem band and its stitch line
if (edge < 10.0) {
  float st = smoothstep(0.55, 0.0, abs(edge - 6.0)) * step(0.45, fract((hp.x + hp.y + hp.z) * 0.35));
  c = mix(c, c * 1.25 + 0.02, st * mid * 0.6);
  H += smoothstep(9.0, 2.0, edge) * 0.25 * mid;
  c *= 0.9 + 0.1 * smoothstep(0.0, 3.0, edge);
}
c = mix(c, pow(uAcc, vec3(1.0)) * (0.92 + 0.08 * vnoise(hp * 0.2)), acc);
if (acc > 0.5) rough = 0.75;
c *= mix(1.0, ao, 0.7);
if (!gl_FrontFacing) c *= 0.3;
diffuseColor.rgb = c;
#ifdef CLOTH_DBG
diffuseColor.rgb = CLOTH_DBG == 1 ? vec3(ao) : CLOTH_DBG == 2 ? vec3(fw) : vec3(0.5 + H);
#endif
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (rough >= 0.0) roughnessFactor = rough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#if !defined(CLOTH_DBG) || CLOTH_DBG != 4\nnormal = bumpNormal(-vViewPosition, normal, H * 0.001, faceDirection);\n#endif')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= ao;
reflectedLight.indirectSpecular *= ao;`);
  };
  return m;
}

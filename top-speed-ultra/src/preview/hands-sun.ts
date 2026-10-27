// The sun on the driver's arms, without the shadow map.
//
// From the seat the sun's shadow map is far too coarse for a hand: its texels are 2.7 cm (High) to 4.3 cm (Medium)
// across, wider than a finger, so the cabin's shadow crossed the hands and sleeves as soft blocks and stripes that
// slid as the car turned, and Low (the phone's default) has no shadow map at all, which lit the hands in full sun
// under the roof. The arms take no shadow map instead (receiveShadow off). The car works out how much of the sun
// reaches each arm at three points (the knuckles, the wrist, the elbow) by casting a few rays through the cabin's
// glass (PlayerCar.sunBlocked, the same test as the lens flare) and eases it over time; the vertex shader blends
// those along each arm, and the fragment shader scales the directional light (the sun, or the moon at night) by
// it. The contact shading next to the rim and between the fingers stays the hands' own baked occlusion.
//
//   sunUniform()                a shared uniform: 6 vec4s (right knuckles, wrist, elbow, then the left's), xyz in the
//                               arms' group frame, w the sun's visibility there (0 shade .. 1 full sun)
//   withSunShade(m, u)          patch one of the arms' materials (skinned) to use it
import * as THREE from 'three';
import { patch } from './car-kit';

export const SUN_PTS = 6;
/** the share of the sun kept in the cabin's full shade (the bounce and sky fill a shaded arm still gets) */
export const SUN_FILL = 0.3;
export type SunUniform = { value: THREE.Vector4[] };
export function sunUniform(): SunUniform { return { value: Array.from({ length: SUN_PTS }, () => new THREE.Vector4(0, 0, 0, 1)) }; }

// the vertex: the nearer arm (the distance to its knuckles-wrist-elbow line), and the visibility along it
const VERT = /* glsl */ `
float sunSeg(vec3 p, vec4 a, vec4 b, out float vis) {
  vec3 ab = b.xyz - a.xyz; float t = clamp(dot(p - a.xyz, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vis = mix(a.w, b.w, t);
  return length(p - a.xyz - ab * t);
}
float sunArm(vec3 p, int o, out float vis) {
  float v0, v1;
  float d0 = sunSeg(p, uSunPts[o], uSunPts[o + 1], v0), d1 = sunSeg(p, uSunPts[o + 1], uSunPts[o + 2], v1);
  vis = d0 < d1 ? v0 : v1;
  return min(d0, d1);
}`;

const LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getDirectionalLightInfo( directionalLight, directLight );',
  'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vSunVis;',
);

export function withSunShade<M extends THREE.Material>(m: M, u: SunUniform): M {
  patch(m, 'sunvis', (sh) => {
    sh.uniforms.uSunPts = u;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uSunPts[${SUN_PTS}];\nvarying float vSunVis;\n${VERT}`)
      .replace('#include <skinning_vertex>', /* glsl */ `#include <skinning_vertex>
{
  float vr, vl;
  float dr = sunArm(transformed, 0, vr), dl = sunArm(transformed, 3, vl);
  // in the cabin's shade the sky through the glass and the light off the dash and the lap still reach the arms: a
  // share of the sun is kept as that fill, so a shaded hand stays its own tone and keeps its modelling
  vSunVis = mix(${SUN_FILL.toFixed(2)}, 1.0, dr < dl ? vr : vl);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSunVis;')
      .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN);
  });
  return m;
}

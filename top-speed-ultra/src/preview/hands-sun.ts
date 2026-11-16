// The light on the driver's arms inside the cabin, without the shadow map.
//
// From the seat the sun's shadow map is far too coarse for an arm: its texels are 2.7 cm (High) to 4.3 cm (Medium)
// across, wider than a finger, so the cabin's shadow crossed the hands and sleeves as soft blocks and stripes that slid
// as the car turned ("the hands look weird in the shadows overlayed", owner, 2026-10-27), and Low (the phone's
// default) has no shadow map at all, so the arms sat in full sun under the roof: a white sleeve lit evenly from the
// cuff to the elbow read as one flat white slab (owner, 2026-11-16). Two terms replace it:
//
// - The sun. The car works out how much of the sun reaches each arm at three points (the knuckles, the wrist, the
//   elbow) by casting a few rays through the cabin's glass (PlayerCar.sunBlocked, the same test as the lens flare) and
//   eases it over time; the vertex shader blends those along each arm, and the fragment shader scales the directional
//   light (the sun, or the moon at night) by it. A share (SUN_FILL) is kept as the bounce a shaded arm still gets.
// - The sky. Inside the cabin the sky's light comes in through the windscreen and the side glass, ahead of and above
//   the driver. The sky's share (the environment map's diffuse and specular) on the forearms and upper arms falls off
//   the deeper they sit in the cabin (toward the seat back, under the roof), on the sides that face down toward the lap
//   and away from the glass, and on the sides that face the driver's own body. It is worked out per pixel with the
//   shading normal (so a sleeve's creases (hands-acc.ts) shade in the shade too). The hands, at the wheel by the glass,
//   keep theirs: the term fades in behind the wrists (CABIN_Z).
//
//   sunUniform()                a shared uniform: 6 vec4s (right knuckles, wrist, elbow, then the left's), xyz in the
//                               arms' group frame, w the sun's visibility there (0 shade .. 1 full sun)
//   armRotUniform()             a shared uniform: the arms' group's rotation in the world (mat3), for the sky term
//   withSunShade(m, u, rot)     patch one of the arms' materials (skinned) to use both terms
import * as THREE from 'three';
import { patch } from './car-kit';
import { EYE } from './spec';

export const SUN_PTS = 6;
/** the share of the sun kept in the cabin's full shade (the bounce and sky fill a shaded arm still gets) */
export const SUN_FILL = 0.3;
/** the cabin's sky term fades in from this depth (z, group frame: the wheel's hub is at -0.42) to the next */
export const CABIN_Z: [number, number] = [-0.36, -0.2];
export type SunUniform = { value: THREE.Vector4[] };
export function sunUniform(): SunUniform { return { value: Array.from({ length: SUN_PTS }, () => new THREE.Vector4(0, 0, 0, 1)) }; }
export type RotUniform = { value: THREE.Matrix3 };
export function armRotUniform(): RotUniform { return { value: new THREE.Matrix3() }; }

// the torso's middle (the chest, between the shoulders, a little below them) and the windscreen's direction from the
// seat (forward and up), group frame
const TORSO = new THREE.Vector3(EYE.x, 0.86, 0.3), GLASS = new THREE.Vector3(0, 0.5, -1).normalize();
const f3 = (v: THREE.Vector3) => `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;

// the vertex: the nearer arm (the distance to its knuckles-wrist-elbow line) and the sun's visibility along it
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

// the fragment: the cabin's sky term at p with the normal n, both in the group's frame
const FRAG = /* glsl */ `
float cabinSky(vec3 p, vec3 n) {
  float depth = 1.0 - 0.55 * smoothstep(-0.4, 0.25, p.z);
  float down = 0.32 + 0.68 * smoothstep(-0.75, 0.55, n.y);
  float glass = 0.62 + 0.38 * max(0.0, dot(n, ${f3(GLASS)}));
  vec3 tv = ${f3(TORSO)} - p; float td = length(tv);
  float body = 1.0 - 0.55 * max(0.0, dot(n, tv / max(td, 1e-4))) * (1.0 - smoothstep(0.12, 0.42, td));
  float k = clamp(depth * down * glass * body, 0.18, 1.0);
  return mix(1.0, k, smoothstep(${CABIN_Z[0].toFixed(3)}, ${CABIN_Z[1].toFixed(3)}, p.z));
}`;

const LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getDirectionalLightInfo( directionalLight, directLight );',
  'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vSunVis;',
);

export function withSunShade<M extends THREE.Material>(m: M, u: SunUniform, rot: RotUniform): M {
  patch(m, 'sunvis2', (sh) => {
    sh.uniforms.uSunPts = u; sh.uniforms.uArmRot = rot;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uSunPts[${SUN_PTS}];\nvarying float vSunVis;\nvarying vec3 vGp;\n${VERT}`)
      .replace('#include <skinning_vertex>', /* glsl */ `#include <skinning_vertex>
{
  float vr, vl;
  float dr = sunArm(transformed, 0, vr), dl = sunArm(transformed, 3, vl);
  // in the cabin's shade the sky through the glass and the light off the dash and the lap still reach the arms: a
  // share of the sun is kept as that fill, so a shaded hand stays its own tone and keeps its modelling
  vSunVis = mix(${SUN_FILL.toFixed(2)}, 1.0, dr < dl ? vr : vl);
  vGp = transformed;     // the skinned position, the group's frame, for the sky term per fragment
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vSunVis;\nvarying vec3 vGp;\nuniform mat3 uArmRot;\n${FRAG}`)
      .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN)
      .replace('#include <aomap_fragment>', /* glsl */ `#include <aomap_fragment>
{
  // the shading normal from view space to the world, then to the group's frame (the inverse of its rotation)
  float cab = cabinSky(vGp, normalize(inverseTransformDirection(normal, viewMatrix) * uArmRot));
  reflectedLight.indirectDiffuse *= cab;
  reflectedLight.indirectSpecular *= cab;
}`);
  });
  return m;
}

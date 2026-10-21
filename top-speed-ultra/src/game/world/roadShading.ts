// Small patches to the road materials' shaders. They add no meshes, draw calls or textures.
// - Concrete lanes: every slab a little lighter or darker, warmer or greyer (each one cured on its own), now and then a
//   replaced slab (whiter and cleaner), and on High and Ultra a mid-slab crack in about one slab in six. The lanes' u
//   is the lane's index and v counts slabs along the road, so floor(uv) names the slab.
// - Asphalt: each lane's stretch of eight tiles (about 58 m) a shade darker or more faded (overlays paved at different
//   times, with a seam where they meet), and on High and Ultra a patch in about one tile in five: a fresh black one or
//   an old faded one, with a sealed seam round it.
// - Paint: the raised markers. A Botts' dot (u 4..5, v 4..5 across the quad) is cut round and shaded as a dome; a
//   raised reflective marker (u 2..3) is cut square and, while the headlights are on (uBeam), shines back like the
//   real retroreflectors do: a bright point anywhere in a narrow cone ahead of the car, fading over a couple of hundred
//   metres. Lines (u 0..1) keep the wear texture and, with the dots, light up in the low beams' pool (the car's own
//   pool is an additive strip that the paint's stronger polygon offset keeps it from reaching).
import * as THREE from 'three';

const HASH = /* glsl */ `
float rsHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// a thin line dist uv units off its centre, w its half width; it fades out as it narrows below a pixel instead of
// breaking into crawling dashes
float rsLine(float dist, float w, float px) { return (1.0 - smoothstep(w, w + 1.5 * px, dist)) * clamp(2.0 * w / max(px, 1e-6), 0.0, 1.0); }
`;

export function slabVariety(m: THREE.MeshStandardMaterial, detail: boolean) {
  m.customProgramCacheKey = () => `rs-slab-${detail ? 1 : 0}`;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HASH)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 rsCell = floor(vMapUv), rsF = fract(vMapUv), rsPx = fwidth(vMapUv);
  float h = rsHash(rsCell), h2 = rsHash(rsCell + 17.31), h3 = rsHash(rsCell + 41.7);
  vec3 tint = vec3(1.0 + (h - 0.5) * 0.11) * vec3(1.0 + (h2 - 0.5) * 0.03, 1.0, 1.0 - (h2 - 0.5) * 0.05);
  if (h2 > 0.965) tint *= vec3(1.07, 1.08, 1.1);
  diffuseColor.rgb *= tint;
  ${detail ? `if (h3 > 0.83) {
    // a transverse crack part way along the slab, or (one in three) a longitudinal one, wandering
    float c;
    if (h3 > 0.95) c = rsLine(abs(rsF.x - 0.25 - 0.5 * h - 0.02 * sin(rsF.y * 7.0 + h2 * 40.0) - 0.008 * sin(rsF.y * 23.0 + h * 9.0)), 0.0016, rsPx.x);
    else c = rsLine(abs(rsF.y - 0.3 - 0.4 * h - 0.025 * sin(rsF.x * 6.0 + h2 * 50.0) - 0.01 * sin(rsF.x * 19.0 + h * 7.0)), 0.0012, rsPx.y);
    diffuseColor.rgb *= 1.0 - 0.42 * c;
  }` : ''}
}`);
  };
}

export function asphaltVariety(m: THREE.MeshStandardMaterial, detail: boolean) {
  m.customProgramCacheKey = () => `rs-asphalt-${detail ? 1 : 0}`;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HASH)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 rsCell = floor(vMapUv), rsF = fract(vMapUv), rsPx = fwidth(vMapUv);
  float o = rsHash(vec2(rsCell.x, floor(rsCell.y / 8.0)) + 3.7);
  diffuseColor.rgb *= 1.0 + (o - 0.5) * 0.13;
  ${detail ? `float h = rsHash(rsCell + 9.1);
  if (h > 0.8) {
    vec2 a = vec2(0.06 + 0.5 * rsHash(rsCell + 1.3), 0.05 + 0.55 * rsHash(rsCell + 2.9));
    vec2 b = min(a + vec2(0.22 + 0.35 * rsHash(rsCell + 4.1), 0.1 + 0.3 * rsHash(rsCell + 5.3)), vec2(0.97));
    vec2 e = min(rsF - a, b - rsF);
    float inside = smoothstep(-rsPx.x, rsPx.x, e.x) * smoothstep(-rsPx.y, rsPx.y, e.y);
    float seam = inside * max(rsLine(e.x, 0.004, rsPx.x), rsLine(e.y, 0.002, rsPx.y));
    diffuseColor.rgb *= mix(1.0, h > 0.9 ? 0.74 : 1.13, inside) * (1.0 - 0.4 * seam);
  }` : ''}
}`);
  };
}

// beam: the headlights' level (0 off, 1 full); pos and dir: the car's position and its heading on the ground, in the
// world (the rebased frame the chunks are placed in), so the return follows the car, not the camera (the mirrors and
// the chase camera see the same lit stretch the driver does)
export function markerShading(m: THREE.MeshStandardMaterial, beam: { value: number }, pos: { value: THREE.Vector3 }, dir: { value: THREE.Vector3 }) {
  m.customProgramCacheKey = () => 'rs-markers';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBeam = beam; sh.uniforms.uBeamPos = pos; sh.uniforms.uBeamDir = dir;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRsWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRsWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBeam;\nuniform vec3 uBeamPos, uBeamDir;\nvarying vec3 vRsWorld;')
      .replace('#include <map_fragment>', `
float rsKind = floor(vMapUv.x * 0.5 + 0.25);
vec2 rsQ = (fract(vMapUv) - 0.5) * 2.0;
if (rsKind > 1.5) {
  float r2 = dot(rsQ, rsQ);
  if (r2 > 1.0) discard;
  diffuseColor.rgb *= 0.7 + 0.3 * sqrt(1.0 - r2);
} else if (rsKind > 0.5) {
  vec2 a = abs(rsQ);
  if (max(a.x, a.y) > 0.94) discard;
  diffuseColor.rgb *= 0.8 + 0.2 * smoothstep(0.94, 0.4, a.y);
} else {
  diffuseColor *= texture2D(map, vMapUv);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uBeam > 0.0) {
  // where the paint sits from the car: rsA metres ahead, rsS to the side
  vec2 rsT = vRsWorld.xz - uBeamPos.xz;
  float rsA = dot(rsT, uBeamDir.xz), rsS = abs(dot(rsT, vec2(-uBeamDir.z, uBeamDir.x)));
  if (rsKind > 0.5 && rsKind < 1.5) {
    // a raised reflective marker: a bright point back along the beams (they spread about 15 degrees either side before
    // fading), out to a couple of hundred metres
    float rsCone = smoothstep(1.0, 4.0, rsA) * (1.0 - smoothstep(0.25, 0.6, rsS / max(rsA, 1.0)));
    totalEmissiveRadiance += diffuseColor.rgb * uBeam * rsCone * 3.0 / (1.0 + rsA * rsA / 3600.0);
  } else {
    // the lines' glass beads (and the white ceramic dots) in the low beams: the pool the lamps lay on the road,
    // spreading as it goes, and the lines carry on past its cut-off, fading
    float rsW = 1.2 + 0.25 * max(rsA, 0.0);
    float rsPool = smoothstep(2.0, 6.5, rsA) * exp(-rsS * rsS / (2.0 * rsW * rsW)) / (1.0 + rsA * rsA / 1600.0);
    totalEmissiveRadiance += diffuseColor.rgb * uBeam * rsPool * (rsKind > 1.5 ? 0.3 : 0.55);
  }
}`);
  };
}

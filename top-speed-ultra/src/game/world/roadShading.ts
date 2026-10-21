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

// The mean colour of a road surface in linear light (its map's texels, linearised, times the material's colour), over
// the map's u from u0 to u1: what a mark laid over that surface (a skid) blends toward at its faint edges.
export function surfaceMean(m: THREE.MeshStandardMaterial, u0 = 0, u1 = 1): [number, number, number] {
  const c = m.map?.image as HTMLCanvasElement | undefined, g = c?.getContext?.('2d');
  if (!c || !g) return [m.color.r * 0.2, m.color.g * 0.2, m.color.b * 0.2];
  const w = c.width, h = c.height, d = g.getImageData(0, 0, w, h).data;
  // sRGB to linear (three 0.160 types declare SRGBToLinear but its build doesn't export it)
  const lin = (v: number) => { const x = v / 255; return x < 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  let r = 0, gg = 0, b = 0, n = 0;
  for (let y = 0; y < h; y += 4) for (let x = Math.floor(u0 * w); x < Math.min(w, u1 * w); x += 4) {
    const i = (y * w + x) * 4; r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); n++;
  }
  return [(r / n) * m.color.r, (gg / n) * m.color.g, (b / n) * m.color.b];
}

export interface MarkerUniforms {
  beam: { value: number };          // the headlights' level (0 off, 1 full)
  pos: { value: THREE.Vector3 };    // the car's position and its heading on the ground, in the world (the rebased frame
  dir: { value: THREE.Vector3 };    // the chunks are placed in), so the return follows the car, not the camera
  px: { value: number };            // the height in pixels of what's being drawn (the screen, or a mirror's target)
  wet: { value: number };           // the rain's wetness, as Roads.setWet darkens the surfaces
}

// Paint: lines (u 0..1, the wear texture), raised reflective markers (u 2..3), Botts' dots (u 4..5) and skid marks
// (u 6..7). The mirrors and the chase camera see the same lit stretch the driver does.
// - A raised reflective marker's v is 2..3 plus 8 x (its heading in whole degrees + 1), so the vertex shader can find
//   the quad's centre and which way its reflectors face. While the headlights are on, a marker facing the car within
//   the beams' cone more than 12 m ahead is drawn as a small upright quad facing the camera, about 1.8 pixels across,
//   standing where the marker is: a flat 10 cm quad is under a pixel tall beyond about 10 m and mostly falls between
//   the pixels, so the string of glints down the road broke up; now each one holds its place out to the draw distance.
// - A skid mark's v is 1000 x its length in metres, plus 500 for the second tyre, plus the metres along it; its vertex
//   colour is the mean colour of the surface under it (surfaceMean), which the paint (opaque) blends toward at the
//   mark's faint parts in place of transparency, so the marks cost no draw call of their own.
export function markerShading(m: THREE.MeshStandardMaterial, u: MarkerUniforms) {
  m.customProgramCacheKey = () => 'rs-markers-2';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBeam = u.beam; sh.uniforms.uBeamPos = u.pos; sh.uniforms.uBeamDir = u.dir; sh.uniforms.uRsPx = u.px; sh.uniforms.uRsWet = u.wet;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBeam, uRsPx;\nuniform vec3 uBeamPos, uBeamDir;\nvarying vec3 vRsWorld;\nvarying float vRsBill, vRsFace;')
      .replace('#include <project_vertex>', `#include <project_vertex>
vRsWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vRsBill = 0.0; vRsFace = 1.0;
if (uv.x > 1.99 && uv.x < 3.01 && uv.y >= 8.0) {
  float rsHi = floor(uv.y / 8.0), rsH = (rsHi - 1.0) * (6.2831853 / 360.0);
  vec2 rsF = vec2(sin(rsH), cos(rsH)), rsR = vec2(-cos(rsH), sin(rsH));
  float rsCu = uv.x - 2.5, rsCv = uv.y - 8.0 * rsHi - 2.5;
  vec3 rsC = transformed; rsC.xz -= (rsCu * rsR + rsCv * rsF) * 0.1;
  vec3 rsCw = (modelMatrix * vec4(rsC, 1.0)).xyz;
  vec2 rsT = rsCw.xz - uBeamPos.xz;
  float rsA = dot(rsT, uBeamDir.xz), rsS = abs(dot(rsT, vec2(-uBeamDir.z, uBeamDir.x)));
  vRsFace = step(0.3, dot(rsF, uBeamDir.xz));                 // one-way: its reflectors face the traffic on its own road
  if (uBeam > 0.01 && rsA > 12.0 && rsS < 0.5 * rsA && vRsFace > 0.5) {
    float rsSz = max(3.6 * distance(rsCw, cameraPosition) / (projectionMatrix[1][1] * max(uRsPx, 1.0)), 0.06);
    vec3 rsRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), rsUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 rsP = rsCw + (rsRight * rsCu + rsUp * (rsCv + 0.5)) * rsSz;
    vRsWorld = rsCw; vRsBill = 1.0;
    mvPosition = viewMatrix * vec4(rsP, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HASH + 'uniform float uBeam, uRsWet;\nuniform vec3 uBeamPos, uBeamDir;\nvarying vec3 vRsWorld;\nvarying float vRsBill, vRsFace;')
      .replace('#include <map_fragment>', `
float rsKind = floor(vMapUv.x * 0.5 + 0.25);
vec2 rsQ = (fract(vMapUv) - 0.5) * 2.0;
if (rsKind > 2.5) {
  // a skid: two tyres' rubber laid in pulses (ABS), faint where the tyres began to lock, ragged at its edges, a little
  // lighter down the tread's grooves; blended over the surface's mean colour (the vertex colour) as it thins
  float rsL = floor(vMapUv.y / 1000.0), rsR = vMapUv.y - 1000.0 * rsL, rsSide = step(500.0, rsR), rsM = rsR - 500.0 * rsSide;
  float rsT = rsM / max(rsL, 1.0), rsX = fract(vMapUv.x);
  float rsD = (rsM + 3.7 * rsSide) / 1.4, rsDh = rsHash(vec2(floor(rsD), rsL + 0.37 * rsSide)), rsDf = fract(rsD);
  float rsPulse = (0.55 + 0.45 * rsDh) * smoothstep(0.0, 0.1, rsDf) * (1.0 - smoothstep(0.72 + 0.22 * rsDh, 0.98, rsDf));
  float rsEnv = smoothstep(0.0, 0.3, rsT) * (1.0 - smoothstep(0.92, 1.0, rsT)) * (0.65 + 0.35 * rsT);
  float rsRag = 0.8 + 0.16 * rsHash(vec2(floor(rsM * 9.0), rsL + rsSide));
  float rsTw = clamp(1.0 - 3.0 * fwidth(rsX * 4.0), 0.0, 1.0);
  float rsInk = rsEnv * rsPulse * (1.0 - 0.18 * rsTw * step(0.6, fract(rsX * 4.0 + 0.2))) * (1.0 - smoothstep(rsRag - 0.14, rsRag, abs(rsX - 0.5) * 2.0));
  if (rsInk < 0.1) discard;
  #ifdef USE_COLOR
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.026, 0.025, 0.024) / max(vColor, vec3(0.003)), min(1.0, rsInk)) * (1.0 - 0.3 * uRsWet * (1.0 - min(1.0, rsInk)));
  #endif
} else if (rsKind > 1.5) {
  float r2 = dot(rsQ, rsQ);
  if (r2 > 1.0) discard;
  diffuseColor.rgb *= 0.7 + 0.3 * sqrt(1.0 - r2);
} else if (rsKind > 0.5) {
  if (vRsBill > 0.5) {
    // the marker at range, a camera-facing point (see above): round, its body barely lit, the return does the work
    if (dot(rsQ, rsQ) > 1.0) discard;
    diffuseColor.rgb *= 0.6;
  } else {
    vec2 a = abs(rsQ);
    if (max(a.x, a.y) > 0.94) discard;
    diffuseColor.rgb *= 0.8 + 0.2 * smoothstep(0.94, 0.4, a.y);
  }
} else {
  diffuseColor *= texture2D(map, vMapUv);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (rsKind > 2.5) roughnessFactor = 0.84;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uBeam > 0.0 && rsKind < 2.5) {
  // where the paint sits from the car: rsA metres ahead, rsS to the side
  vec2 rsT = vRsWorld.xz - uBeamPos.xz;
  float rsA = dot(rsT, uBeamDir.xz), rsS = abs(dot(rsT, vec2(-uBeamDir.z, uBeamDir.x)));
  if (rsKind > 0.5 && rsKind < 1.5) {
    // a raised reflective marker: a bright point back along the beams (they spread about 15 degrees either side before
    // fading), out to a couple of hundred metres
    float rsCone = smoothstep(1.0, 4.0, rsA) * (1.0 - smoothstep(0.25, 0.6, rsS / max(rsA, 1.0)));
    // (the points at range fall off a little faster, so a lane's string of them doesn't pile into a bright streak
    // where they crowd together near the vanishing point)
    totalEmissiveRadiance += diffuseColor.rgb * uBeam * rsCone * vRsFace * (vRsBill > 0.5 ? 5.0 / (1.0 + rsA * rsA / 2500.0) : 3.0 / (1.0 + rsA * rsA / 3600.0));
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

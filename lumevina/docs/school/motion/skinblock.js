// skinblock.js — the solid scenes' look since the hero's re-render: the toy blocks, with a touch of skin.
// render.mjs pastes this after studio3d.js (the default look; --look tissue pastes skin3d.js instead,
// --look cubes neither) and turns every `new THREE.InstancedMesh(` in a scene into `skinOrInstanced(`.
//
// The scenes build skin as a grid of rounded cubes (16 × 14 × 9, coloured by layer) and animate them
// one by one. skin3d.js melted that grid into one soft surface; it read as skin but went soft and
// stripy on a phone. Here the cubes stay cubes, crisp and countable, and only their surface changes:
// each cell's own material is taught, in its shader, to look a little like the layer it stands for.
//   epidermis (the pale cells)   the fine polygonal line network of skin, a few pores on the faces that
//                                point up, a dewy shine on those faces only
//   dermis (the rose cells)      a soft fibrous grain, low in contrast, never stripes
//   fat (the yellow cells)       round lobules
//   every cell                   a slight blotchy tone (no two cells quite alike), a bump that catches
//                                the key light, and a soft velvet rim, the way skin glows at its edge
// The layer comes from the cell's colour (the scenes' palette: pale #e9c4b4, rose #b77a80, yellow
// #e6d49a, and whatever they blend to), so a cell that reddens or browns is still textured as its
// layer. The pattern sits in the cube's own coordinates with the cell's instance number as its seed,
// so it moves with the cell and never swims. The scene's material is changed in place (its own code
// keeps working on it) and everything stays a pure function of position: no randomness, no time.
// The lens keeps more of the block in focus than the tissue look did (CINEMA.dofScale, half).

const SKINBLOCK = (window.SKINBLOCK = Object.assign({ lines: 1, pores: 1, bump: 1, rim: 1, dew: 1, focus: 0.5 }, window.SKINBLOCK_OPTS || {}));
// the blocks are meant to be read, so the lens keeps more of them sharp: half the film finish's focus blur
if (window.CINEMA) window.CINEMA.dofScale = SKINBLOCK.focus;
// and a frame where nothing moves more than a sample's worth is drawn once (with multisampling), not twice
if (window.CINEMA) window.CINEMA.kMin = 1;

const skinBlockSize = (geo) => {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
};

function skinOrInstanced(geo, mat, count) {
  const [w, h, d] = skinBlockSize(geo);
  const near = (a, b) => Math.abs(a - b) < 0.06;
  // the cells: a grid's worth of cubes (the skin block, its top row, the plug cells in 8-2)
  if (count >= 12 && near(w, h) && near(h, d) && w > 0.8 && w < 1.05 && mat && mat.isMeshStandardMaterial) skinBlockMaterial(mat);
  return new THREE.InstancedMesh(geo, mat, count);
}

// the noise both shaders share: hashes built from fract and dot only (no sin: far cheaper where the
// renderer is software, as in the frame engine), smooth value noise, and a cellular pattern
const SB_NOISE = `
  float sbH1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  vec2 sbH2(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float sbN(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(sbH1(n), sbH1(n + 1.0), f.x), mix(sbH1(n + 57.0), sbH1(n + 58.0), f.x), f.y),
               mix(mix(sbH1(n + 113.0), sbH1(n + 114.0), f.x), mix(sbH1(n + 170.0), sbH1(n + 171.0), f.x), f.y), f.z);
  }`;

function skinBlockMaterial(mat) {
  if (mat.userData.skinBlock) return;
  mat.userData.skinBlock = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.sbK = { value: new THREE.Vector4(SKINBLOCK.lines, SKINBLOCK.pores, SKINBLOCK.bump, SKINBLOCK.rim) };
    sh.uniforms.sbDew = { value: SKINBLOCK.dew };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSbLocal; varying vec3 vSbNormal; varying vec2 vSbTone; flat varying float vSbId;\n" + SB_NOISE)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vSbLocal = transformed; vSbNormal = objectNormal;
        #ifdef USE_INSTANCING
          vSbId = float(gl_InstanceID);
        #else
          vSbId = 0.0;
        #endif
        vec3 sbVp = transformed * 1.6 + vec3(sbH1(vSbId + 1.7), sbH1(vSbId + 9.3), sbH1(vSbId + 4.1)) * 40.0;
        vSbTone = vec2(sbN(sbVp) - 0.5, sbN(sbVp * 0.6 + 31.0) - 0.5);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vSbLocal; varying vec3 vSbNormal; varying vec2 vSbTone; flat varying float vSbId;
        uniform vec4 sbK; uniform float sbDew;
        ${SB_NOISE}
        // cellular: the distance to the nearest point (x) and how far from the edge between two cells (y)
        vec2 sbVor(vec2 p) {
          vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y)), o = 0.12 + 0.76 * sbH2(i + g), r = g + o - f; float dd = dot(r, r);
            if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
          }
          return vec2(sqrt(d1), sqrt(d2) - sqrt(d1));
        }
        vec3 sbBump(vec3 pos, vec3 n, float h) {
          vec3 sx = dFdx(pos), sy = dFdy(pos), r1 = cross(sy, n), r2 = cross(n, sx);
          float det = dot(sx, r1); vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
          return normalize(abs(det) * n - g);
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 sbC = diffuseColor.rgb; float sbL = max(max(sbC.r, sbC.g), 1e-3);
        float sbFat = smoothstep(0.25, 0.38, (sbC.g - sbC.b) / sbL);
        float sbDerm = (1.0 - smoothstep(0.48, 0.62, sbC.g / sbL)) * (1.0 - sbFat);
        float sbEpi = (1.0 - sbDerm) * (1.0 - sbFat);
        vec3 sbAn = abs(vSbNormal);
        float sbTop = smoothstep(0.55, 0.9, vSbNormal.y);
        vec2 sbUv = sbAn.y > max(sbAn.x, sbAn.z) ? vSbLocal.xz : (sbAn.x > sbAn.z ? vSbLocal.zy : vSbLocal.xy);
        vec2 sbO = vec2(sbH1(vSbId + 1.7), sbH1(vSbId + 9.3)) * 40.0;
        float sbLine = 0.0, sbPore = 0.0, sbFib = 0.0, sbLob = 0.0;
        if (sbEpi > 0.02) {
          // skin lines: a polygonal network, finer and deeper on the surface
          vec2 sbV = sbVor(sbUv * mix(3.6, 5.0, sbTop) + sbO);
          sbLine = (1.0 - smoothstep(0.01, 0.05, sbV.y)) * sbK.x * sbEpi * mix(0.3, 1.0, sbTop);
          // pores: a few, on the faces that point up
          if (sbTop > 0.02) {
            vec2 sbPq = sbUv * 2.3 + sbO.yx;
            float sbHasPore = step(0.72, sbH1(dot(floor(sbPq), vec2(7.0, 113.0)) + vSbId));
            sbPore = (1.0 - smoothstep(0.035, 0.07, sbVor(sbPq).x)) * sbHasPore * sbTop * sbEpi * sbK.y;
          }
        }
        // dermis grain: soft, crossing fibres
        if (sbDerm > 0.02) sbFib = sbN(vec3(sbUv.x * 3.2 + 0.8 * sbN(vSbLocal * 3.0 + sbO.x), sbUv.y * 5.5, sbO.y)) - 0.5;
        // fat: round lobules
        if (sbFat > 0.02) sbLob = smoothstep(0.0, 0.55, sbVor(sbUv * 3.1 + sbO).x);
        // tone: blotchy, warm and cool (from the corners), and a fine grain
        float sbMot = vSbTone.x, sbWarm = vSbTone.y, sbGrain = sbN(vSbLocal * 38.0 + sbO.xyx) - 0.5;
        diffuseColor.rgb *= 1.0 + 0.32 * sbMot - 0.075 * sbLine - 0.38 * sbPore + 0.09 * sbFib * sbDerm - 0.09 * sbLob * sbFat + 0.05 * sbGrain;
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.035, 0.975, 0.96), sbWarm * 2.0);
        float sbHt = -0.6 * sbLine - 1.6 * sbPore + 0.45 * sbFib * sbDerm - 0.4 * sbLob * sbFat + 0.12 * sbGrain;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(roughnessFactor, 0.4, 0.55 * sbEpi * sbTop * sbDew) + 0.12 * sbLine + 0.2 * sbPore, 0.05, 1.0);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        normal = sbBump(-vViewPosition, normal, sbHt * 0.012 * sbK.z);`)
      .replace("#include <opaque_fragment>", `
        float sbFr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
        outgoingLight += vec3(1.0, 0.78, 0.72) * sbFr * 0.075 * sbK.w * (0.6 + 0.4 * sbEpi);
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => "skinblock2";
  mat.needsUpdate = true;
}

// Lot 57's sky dressing (P1d repair), on the game's Environment without changing its code: the page re-dresses the
// layers Environment made, through their public meshes and materials.
//   - The mountain ring had one flat colour (Environment's haze): at golden hour a cream cardboard cut-out. It gets
//     form: three ranges one behind another (the far one keeps Environment's crest exactly, so the sun still sets
//     behind the same ridge), each with spurs and gullies down its face, lit by the sun's direction and colour and
//     the sky, and hazed by its distance and by height (the foot of each range sits deeper in the haze than its
//     crest). Environment still sets the material's colour each change: that is the haze it fades into. Kept out of
//     ambient occlusion by the page (look.ts noAO), and banded into a few flat steps in the retro look.
//   - The cloud deck in the retro look: crisp-edged cartoon clouds by day (a clean alpha cut instead of the soft
//     texture, which the sky's bands turned into blotches), and none at night (the bands made brown-grey smudges of
//     a faint night deck on the black sky).
//   - Golden hour: the visible sky warmed toward the horizon while the sun is low (the clear sky's colours alone
//     read grey-cyan looking away from the sun).
import * as THREE from 'three';

/** a smooth periodic noise round the ring (0..1): value noise on a circle of `cells` cells, two octaves */
function ringNoise(seed: number, cells: number) {
  let s = seed >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const A = Array.from({ length: cells }, r), B = Array.from({ length: cells * 3 }, r);
  const at = (T: number[], u: number) => {
    const n = T.length, x = ((u % 1) + 1) % 1 * n, i = Math.floor(x), f = x - i, k = f * f * (3 - 2 * f);
    return T[i % n] * (1 - k) + T[(i + 1) % n] * k;
  };
  return (u: number) => 0.72 * at(A, u) + 0.28 * at(B, u);
}

const ROWS = 6;
/** a ridged value noise for the mountains' faces (fragment shader) */
const RIDGES = /* glsl */ `
float mHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float mNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mHash( i ), mHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( mHash( i + vec2( 0.0, 1.0 ) ), mHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
float ridges( vec2 p ) {
  float s = 0.0, a = 0.55;
  for ( int i = 0; i < 4; i++ ) { float n = 1.0 - abs( mNoise( p ) * 2.0 - 1.0 ); s += a * n * n; p = p * 2.07 + vec2( 3.1, 7.7 ); a *= 0.5; }
  return s;
}
float ridgesAt( vec3 P ) {
  float w = P.x * P.x / max( P.x * P.x + P.z * P.z, 1.0 );
  return mix( ridges( P.xy / 300.0 ), ridges( P.zy / 300.0 + vec2( 17.0, 0.0 ) ), w );
}
`;
/**
 * The mountain ring rebuilt from Environment's: its crest (the top vertex of each of its columns) is the far range's
 * crest; two nearer ranges stay under it as seen from the centre (so Environment's ridge test for the sun holds).
 * Attributes: normal, aHaze (how far off: the haze it wears), aT (0 the foot .. 1 the crest).
 */
export function mountainGeometry(old: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = old.attributes.position, cols = p.count / 2;
  const crest: number[] = [];
  let R0 = 0;
  for (let i = 0; i < cols; i++) { crest.push(p.getY(i * 2 + 1)); R0 = Math.max(R0, Math.hypot(p.getX(i * 2 + 1), p.getZ(i * 2 + 1))); }
  const back = (u: number) => { const x = u * (cols - 1), i = Math.min(cols - 2, Math.floor(x)), f = x - i; return crest[i] * (1 - f) + crest[i + 1] * f; };
  const pos: number[] = [], haze: number[] = [], tt: number[] = [], spr: number[] = [], idx: number[] = [];
  // [radius as a share of the far ring's, columns, haze, the share of the far crest's angle it may reach, its own crest, seed]
  const layers: [number, number, number, number, (u: number) => number, number][] = [
    [1, cols - 1, 0.3, 1, back, 11],
    [0.84, 192, 0.19, 0.82, (u) => 70 + 330 * ringNoise(23, 14)(u) ** 1.4, 23],
    [0.7, 160, 0.09, 0.62, (u) => 30 + 170 * ringNoise(37, 22)(u) ** 1.2, 37],
  ];
  for (const [k, n, hz, cap, own, seed] of layers) {
    const R = R0 * k, spur = ringNoise(seed + 5, 70), side = ringNoise(seed + 13, 190), jag = ringNoise(seed + 9, 140);
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = u * Math.PI * 2;
      // the crest: the far range's own; a nearer range its own line, kept under the far crest's angle (and roughened)
      let top = k === 1 ? back(u) : Math.min(back(u) * k * cap, own(u) + 24 * (jag(u) - 0.5));
      top = Math.max(top, -20);
      for (let j = 0; j <= ROWS; j++) {
        const t = j / ROWS, y = -60 + (top + 60) * Math.pow(t, 0.9);
        // spurs that wander as they come down from the crest, and side gullies that cut across them (not straight
        // vertical ribs, which read as rain shafts)
        const sp = 0.65 * spur(u + 0.006 * (1 - t)) + 0.35 * side(u - 0.004 * (1 - t) + 0.002 * t);
        // the face comes toward you below the crest: spurs (sp high) reach out, gullies (sp low) cut back in
        const out = (1 - t) ** 1.2 * (top + 60) * (0.9 + 1.1 * sp * sp);
        const r = R - (k === 1 ? out : out * 0.8);
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        haze.push(hz); tt.push(t); spr.push(sp);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < ROWS; j++) {
      const a = base + i * (ROWS + 1) + j, b = a + ROWS + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(haze, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aSp', new THREE.Float32BufferAttribute(spr, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // normals toward the centre (you): the faces are seen from inside the ring
  const nn = g.attributes.normal as THREE.BufferAttribute, pp = g.attributes.position as THREE.BufferAttribute;
  let flip = 0;
  for (let i = 0; i < nn.count; i += 97) flip += nn.getX(i) * pp.getX(i) + nn.getZ(i) * pp.getZ(i) > 0 ? 1 : -1;
  if (flip > 0) for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
  g.computeBoundingSphere();
  return g;
}

/** the uniforms the mountains' and sky's patches read, set each frame by SkyDress.update */
const U = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) },
  uRetroSky: { value: 0 },
  uGoldSky: { value: 0 },
  uCrisp: { value: 0 },
};

export class SkyDress {
  private ready = false;
  constructor(private env: { sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; sky: THREE.Mesh; clouds: THREE.Mesh; mountains: THREE.Mesh }) {
    const m = env.mountains;
    const old = m.geometry;
    m.geometry = mountainGeometry(old);
    old.dispose();
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aHaze;\nattribute float aT;\nattribute float aSp;\nvarying float vHaze;\nvarying float vT;\nvarying vec3 vMN;\nvarying float vVar;\nvarying float vSp;')
        .replace('#include <common>', '#include <common>\nvarying vec3 vMP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHaze = aHaze; vT = aT; vSp = aSp; vMN = normalize( mat3( modelMatrix ) * normal );\nvVar = fract( sin( dot( position.xz, vec2( 0.0123, 0.0071 ) ) ) * 43758.5 );\nvMP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;\nuniform vec3 uSunCol;\nuniform vec3 uSkyCol;\nuniform float uRetroSky;\nvarying float vHaze;\nvarying float vT;\nvarying vec3 vMN;\nvarying float vVar;\nvarying float vSp;\nvarying vec3 vMP;\n' + RIDGES)
        .replace('#include <map_fragment>', `#include <map_fragment>
  {
    // chaparral and rock: an olive-tan, browner low down, the crests a little paler (linear albedo)
    // the faces' erosion: a ridged noise over (along the ring, up), about a ridge every 300 m, its slope tilting
    // the normal (ridges and gullies at a few scales, which the low sun picks out)
    // (on two upright planes blended by where on the ring you look, so there's no seam round the compass)
    vec3 tang = normalize( vec3( -vMP.z, 0.0, vMP.x ) );
    float h0 = ridgesAt( vMP ), e = 0.03;
    float hx = ( ridgesAt( vMP + tang * 9.0 ) - h0 ) / e, hy = ( ridgesAt( vMP + vec3( 0.0, 9.0, 0.0 ) ) - h0 ) / e;
    vec3 N = normalize( normalize( vMN ) - tang * hx * 0.32 - vec3( 0.0, 1.0, 0.0 ) * hy * 0.22 );
    vec3 rock = mix( vec3( 0.105, 0.098, 0.062 ), vec3( 0.16, 0.13, 0.085 ), clamp( vT * 0.8 + vVar * 0.3, 0.0, 1.0 ) );
    // the gullies darker (scrub in their shade), the ridges' bare rock paler
    rock *= mix( 0.55, 1.25, smoothstep( 0.25, 0.75, h0 ) ) * mix( 0.85, 1.1, smoothstep( 0.2, 0.8, vSp ) ) * mix( 0.8, 1.1, vT );
    float ndl = clamp( dot( N, uSunDir ) * 0.8 + 0.2, 0.0, 1.0 );
    float sky = 0.38 + 0.36 * N.y;
    if ( uRetroSky > 0.5 ) { ndl = ndl > 0.42 ? 1.0 : ndl > 0.12 ? 0.6 : 0.18; sky = sky > 0.8 ? 1.0 : 0.7; }
    vec3 lit = rock * ( uSunCol * ndl * mix( 0.8, 1.2, vT ) + uSkyCol * sky );
    // aerial perspective: the far range deepest in the haze, and the foot of each range more than its crest
    float hz = clamp( vHaze + ( 1.0 - vT ) * 0.2, 0.0, 0.9 );
    diffuseColor.rgb = mix( lit, diffuse, hz );
  }`);
    };
    mat.customProgramCacheKey = () => 'lot57-mountains';
    mat.needsUpdate = true;
    // the clouds: a crisp cut in the retro look
    const cm = env.clouds.material as THREE.MeshBasicMaterial;
    cm.onBeforeCompile = (sh) => {
      sh.uniforms.uCrisp = U.uCrisp; sh.uniforms.uGoldSky = U.uGoldSky;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCrisp;\nuniform float uGoldSky;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  // golden hour: the deck lit amber and rose from below
  diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.28, 0.98, 0.74 ), uGoldSky );
#ifdef USE_MAP
  if ( uCrisp > 0.5 ) {
    // (the deck's alpha read from a blurrier level of the texture, so the cut gives rounded cartoon shapes rather
    // than the noise's ragged edge)
    float ca = texture2D( map, vMapUv, 2.5 ).a;
    diffuseColor.a = opacity * smoothstep( 0.4, 0.46, ca );
    diffuseColor.rgb = diffuse * mix( 0.84, 1.0, smoothstep( 0.5, 0.75, ca ) );
  }
#endif`);
    };
    cm.customProgramCacheKey = () => 'lot57-clouds';
    cm.needsUpdate = true;
    // the visible sky: warmer toward the horizon at golden hour
    const sm = env.sky.material as THREE.ShaderMaterial;
    sm.uniforms.uGoldSky = U.uGoldSky;
    sm.fragmentShader = 'uniform float uGoldSky;\n' + sm.fragmentShader.replace(/gl_FragColor = vec4\( retColor \* skyGain, 1\.0 \);/,
      'retColor *= mix( vec3( 1.0 ), mix( vec3( 1.34, 1.02, 0.72 ), vec3( 1.0, 0.97, 0.97 ), smoothstep( 0.0, 0.32, direction.y ) ), uGoldSky );\n\t\t\tgl_FragColor = vec4( retColor * skyGain, 1.0 );');
    sm.needsUpdate = true;
    this.ready = true;
  }

  /** each frame: the sun's direction and light, the sky's, the style (retro: bands, crisp clouds), golden hour */
  update(retro: boolean, night: number, gold: number) {
    if (!this.ready) return;
    const e = this.env;
    U.uSunDir.value.copy(e.sun.position).sub(e.sun.target.position).normalize();
    // (a gain for an unlit material standing in for a lit one: the sun / pi and the sky's light round it)
    U.uSunCol.value.copy(e.sun.color).multiplyScalar(e.sun.intensity * 0.5);
    U.uSkyCol.value.copy(e.hemi.color).multiplyScalar(e.hemi.intensity * 0.9);
    U.uRetroSky.value = retro ? 1 : 0;
    U.uGoldSky.value = gold;
    U.uCrisp.value = retro ? 1 : 0;
    // the retro look: no cloud deck once it's dark (it only showed as smudges on the black sky)
    e.clouds.visible = !(retro && night > 0.35);
  }
}

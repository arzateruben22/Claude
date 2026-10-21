// The Retro render style: the Low tier's look (RS1). Full resolution and crisp, but drawn the way an early-2000s
// PC game looked: two-tone cel shading with a narrow mid band, flat or posterized colour, hard one-step shadows,
// clean dark outlines on silhouettes and convex edges, a limited palette with a fine ordered dither, and a sky of
// flat colour bands. No bloom, no ambient occlusion, no reflections. Everything here is built in code.
//
// One module, three parts, and one facade (RetroStyle) that a page drives:
//   Stylizer   swaps each mesh's physically based material for a cel-shaded MeshToonMaterial that keeps its colour,
//              map, emissive, transparency, vertex and instance colours, skinning and the material's own shader
//              patches where they make sense in a toon shader. Swapped once per built chunk or object, undone on
//              detach (the originals are kept on the mesh; every toon material and texture made here is disposed).
//   RetroSky   a sphere of flat bands from the horizon (the fog's colour, so the far road melts into it) to the
//              zenith, a hard sun disc with stepped rings at the ends of the day, a hard moon at night.
//   RetroPass  renders the scene into a half-float target with a depth texture, then one full-screen pass: the tone
//              map, a saturation lift, ink where the depth says an edge is (the second difference of 1/z, which is
//              zero across any plane, so roads and walls stay clean at any distance), and the palette with a 4x4
//              Bayer dither. The sky's pixels (nothing written to depth) are already display colours.
//
// The game applies it when the graphics are Low and Settings.style is 'retro' (Game.applyStyle); the on-foot pages
// can import RetroStyle and drive it the same way: attach(scene, roots), render(scene, camera, world), detach().

import * as THREE from 'three';

export interface RetroOptions {
  // surface textures: 'auto' turns near-uniform ones (asphalt, concrete, leather) into their average colour and keeps
  // the rest (signs, facades, gauges, anything cut out by its alpha) posterized; 'flat' and 'poster' force one way
  textures: 'auto' | 'flat' | 'poster';
  // levels per channel (red, green, blue) after the tone map: 32/64/32 is the 16-bit colour those PCs ran in, its
  // steps broken up by the ordered dither only where colour actually ramps (fog, the shade on a curved panel)
  palette: [number, number, number];
  saturation: number;      // the colour lift before the palette (a vibrance: greys stay grey, colours lift)
  ink: number;             // edge threshold: the relative second difference of 1/z where ink starts
  inkFar: number;          // metres: ink fades out toward this distance
  // the skylight's gain in the shade: a toon material has no environment map, which on the realistic tiers lights a
  // shaded wall to about half its sunlit side; 4.5 puts it near 40%, a clear two-tone step that still reads
  ambient: number;
}
export const RETRO_DEFAULTS: RetroOptions = { textures: 'auto', palette: [32, 64, 32], saturation: 0.5, ink: 0.04, inkFar: 420, ambient: 4.5 };

// what the sky needs from the world each frame (the game's Environment has all of it)
export interface RetroWorld {
  sunDir: THREE.Vector3;        // toward the sun by day, the moon by night
  daylight: number;             // 0 night .. 1 day
  saturation: number;           // 1 clear .. 0.85 overcast (the Environment's grade under cloud)
  sky?: THREE.Object3D | null;  // the realistic sky, hidden while this one shows
  hemi?: THREE.HemisphereLight | null;
  clouds?: THREE.Mesh | null;   // the cloud deck: cut out with hard edges while this style shows
  flare?: THREE.Object3D | null; // a lens flare drawn over the finished frame: a camera's artefact, kept off here
}

// ------------------------------------------------------------------------------------------------ shared GLSL
// every stylized material shares these uniforms (one object, so a change reaches them all)
const U = {
  uRetroAmbient: { value: RETRO_DEFAULTS.ambient },
  uRetroSky: { value: new THREE.Color(0.5, 0.6, 0.75) },
  uRetroGround: { value: new THREE.Color(0.2, 0.18, 0.15) },
  uRetroPoster: { value: 7 },
  uRetroFloor: { value: new THREE.Color(0, 0, 0) },    // a little light everywhere at night (a dark cabin still reads)
};
// the toon lighting with the shade lifted and a hard specular spot on glossy and metal parts; glass gets a stepped rim
// of sky at grazing angles, chrome and mirrors a banded sky-and-ground in place of the environment map's reflection
const LIGHTS_PARS = /* glsl */ `
varying vec3 vViewPosition;
uniform float uRetroAmbient;
uniform vec3 uRetroSky;
uniform vec3 uRetroGround;
uniform float uRetroPoster;
uniform vec3 uRetroFloor;
struct ToonMaterial { vec3 diffuseColor; };
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  #ifdef RETRO_SPEC
    float nh = dot( geometryNormal, normalize( directLight.direction + geometryViewDir ) );
    reflectedLight.directDiffuse += directLight.color * ( step( RETRO_SPEC, nh ) * step( 0.0, dot( geometryNormal, directLight.direction ) ) * 0.22 );
  #endif
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += ( irradiance * uRetroAmbient + uRetroFloor ) * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
// the albedo posterized (map x colour x vertex and instance colour), in display space; then the near-blacks lifted
// to a dark grey, as the realistic tiers' sky reflection lifts them (black leather and plastics hold their shapes)
const POSTER = /* glsl */ `
#ifdef RETRO_POSTER
  {
    vec3 pc = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
    pc = floor( pc * uRetroPoster + 0.5 ) / uRetroPoster;
    diffuseColor.rgb = pow( pc, vec3( 2.2 ) );
  }
#endif
diffuseColor.rgb += 0.04 * pow( clamp( 1.0 - diffuseColor.rgb, 0.0, 1.0 ), vec3( 8.0 ) );
#include <alphamap_fragment>`;
const RIM = /* glsl */ `#include <lights_fragment_end>
#ifdef RETRO_RIM
  {
    float rim = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
    reflectedLight.indirectDiffuse += uRetroSky * ( step( RETRO_RIM, rim ) * 0.16 + step( RETRO_RIM + 0.15, rim ) * 0.14 );
  }
#endif
#ifdef RETRO_CHROME
  {
    vec3 rw = inverseTransformDirection( reflect( - normalize( vViewPosition ), normal ), viewMatrix );
    vec3 band = rw.y > 0.3 ? uRetroSky : rw.y > 0.0 ? mix( uRetroSky, vec3( 1.0 ), 0.35 ) : uRetroGround;
    reflectedLight.indirectDiffuse += band * clamp( 0.25 + 2.5 * dot( diffuse, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.0, 1.0 );
  }
#endif`;
// hard shadows without the stair steps of a one-tap lookup: the four texels round the point compared and blended
// bilinearly, then cut at one half, so the edge is a clean line between texels (sub-texel, like a vector shape)
// instead of a row of square texels. Replaces the one-step (BasicShadowMap) lookup only.
const SHADOW_BASIC = 'shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );';
const SHADOW_PARS = THREE.ShaderChunk.shadowmap_pars_fragment.replace(SHADOW_BASIC, /* glsl */ `{
        vec2 rT = shadowCoord.xy * shadowMapSize - 0.5, rF = fract( rT ), rS = 1.0 / shadowMapSize;
        vec2 rB = ( floor( rT ) + 0.5 ) * rS;
        float r00 = texture2DCompare( shadowMap, rB, shadowCoord.z ), r10 = texture2DCompare( shadowMap, rB + vec2( rS.x, 0.0 ), shadowCoord.z );
        float r01 = texture2DCompare( shadowMap, rB + vec2( 0.0, rS.y ), shadowCoord.z ), r11 = texture2DCompare( shadowMap, rB + rS, shadowCoord.z );
        shadow = step( 0.5, mix( mix( r00, r10, rF.x ), mix( r01, r11, rF.x ), rF.y ) );
      }`);
// lamps (the headlight beams) fall off in bands, not a smooth ramp: their cone and their reach each in four steps
const LIGHTS_BEGIN = THREE.ShaderChunk.lights_pars_begin
  .replace('float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );',
    'float spotAttenuation = retroBand( getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos ) );')
  .replace(/light\.color \*= getDistanceAttenuation\( lightDistance, (\w+)\.distance, (\w+)\.decay \);/g,
    'light.color *= retroBand( getDistanceAttenuation( lightDistance, $1.distance, $2.decay ) );')
  .replace('float getDistanceAttenuation(', 'float retroBand( float x ) { return x >= 1.0 ? x : floor( x * 4.0 + 0.35 ) * 0.25; }\nfloat getDistanceAttenuation(');
// the fog in six flat bands like the sky's, an ordered dither across each band's edge (in screen pixels, so it holds
// still as the road moves)
const FOG = /* glsl */ `#ifdef USE_FOG
  {
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    vec2 rD = floor( mod( gl_FragCoord.xy, 4.0 ) );
    vec2 rD2 = floor( rD * 0.5 ), rD1 = rD - 2.0 * rD2;
    float rT = fract( dot( rD2, vec2( 0.5, rD2.y * 0.75 ) ) ) * 0.25 + fract( dot( rD1, vec2( 0.5, rD1.y * 0.75 ) ) );
    fogFactor = min( 1.0, floor( fogFactor * 6.0 + rT ) / 6.0 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  }
#endif`;
// identifiers a toon shader doesn't have: a material's own patch that writes one of these is left on its own
// (physically based) material rather than broken
const PBR_ONLY = /\b(roughnessFactor|metalnessFactor|specularIntensityFactor|specularColorFactor|sheenSpecular\w*|clearcoatSpecular\w*|iridescence\w*|computeSpecularOcclusion)\b|\bmaterial\.(?!diffuseColor\b)[A-Za-z_]+/;

// ------------------------------------------------------------------------------------------------ textures
// what a texture looks like on average: the mean colour (linear) and how much its luminance varies (display space)
interface TexStats { mean: THREE.Color; std: number; alphaVaries: boolean }
const statsCache = new WeakMap<THREE.Texture, TexStats | null>();
let probe: CanvasRenderingContext2D | null = null;
function texStats(t: THREE.Texture): TexStats | null {
  if (statsCache.has(t)) return statsCache.get(t)!;
  let out: TexStats | null = null;
  try {
    const img = t.image as { data?: ArrayLike<number>; width?: number; height?: number } | CanvasImageSource | undefined;
    const N = 16, px: number[] = [];
    if (img && (img as { data?: ArrayLike<number> }).data && (img as { width?: number }).width) {
      const d = (img as { data: ArrayLike<number> }).data, w = (img as { width: number }).width, h = (img as { height: number }).height;
      const scale = d instanceof Uint8Array || d instanceof Uint8ClampedArray ? 1 : 255;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = ((Math.floor(((y + 0.5) / N) * h) * w) + Math.floor(((x + 0.5) / N) * w)) * 4;
        px.push(d[i] * scale, d[i + 1] * scale, d[i + 2] * scale, d[i + 3] === undefined ? 255 : d[i + 3] * scale);
      }
    } else if (img && typeof document !== 'undefined') {
      if (!probe) { const c = document.createElement('canvas'); c.width = c.height = N; probe = c.getContext('2d', { willReadFrequently: true }); }
      if (probe) {
        probe.clearRect(0, 0, N, N); probe.imageSmoothingEnabled = true; probe.imageSmoothingQuality = 'high';
        probe.drawImage(img as CanvasImageSource, 0, 0, N, N);
        px.push(...probe.getImageData(0, 0, N, N).data);
      }
    }
    if (px.length) {
      const srgb = t.colorSpace === THREE.SRGBColorSpace, c = new THREE.Color();
      let r = 0, g = 0, b = 0, l = 0, l2 = 0, a0 = 255, a1 = 0;
      const n = px.length / 4;
      for (let i = 0; i < px.length; i += 4) {
        c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace);
        r += c.r; g += c.g; b += c.b;
        const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        l += lum; l2 += lum * lum; a0 = Math.min(a0, px[i + 3]); a1 = Math.max(a1, px[i + 3]);
      }
      const ml = l / n;
      out = { mean: new THREE.Color(r / n, g / n, b / n), std: Math.sqrt(Math.max(0, l2 / n - ml * ml)), alphaVaries: a1 - a0 > 24 };
    }
  } catch { out = null; }
  statsCache.set(t, out);
  return out;
}

// ------------------------------------------------------------------------------------------------ the stylizer
type Lit = THREE.MeshStandardMaterial & Partial<THREE.MeshPhysicalMaterial>;
interface Entry { orig: Lit; toon: THREE.MeshToonMaterial; tint: THREE.Color | null }
const DEFAULT_HOOK = THREE.Material.prototype.onBeforeCompile;

export class Stylizer {
  private cache = new Map<THREE.Material, Entry>();
  private mine = new WeakSet<THREE.Material>();
  private gradient: THREE.DataTexture;
  private disposing = false;
  readonly counts = { meshes: 0, materials: 0, flat: 0, poster: 0, kept: 0 };

  constructor(private renderer: THREE.WebGLRenderer, private o: RetroOptions = RETRO_DEFAULTS) {
    // the light's steps over dot(N, L) from -1 to 1, ten texels: unlit facing away, a narrow mid band past the
    // terminator, then full light
    const steps = new Uint8Array([0, 0, 0, 0, 0, 90, 204, 204, 204, 204]);
    this.gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
    this.gradient.minFilter = this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.generateMipmaps = false;
    this.gradient.needsUpdate = true;
  }

  isMine(m: THREE.Material) { return this.mine.has(m); }

  // swap every lit mesh under root (idempotent: a mesh already wearing a toon material is left as it is)
  style(root: THREE.Object3D) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.retroSkip) return;
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        if (mat.some((m) => this.mine.has(m))) return;
        const next = mat.map((m) => this.convert(m));
        if (next.every((m, i) => m === mat[i])) return;
        mesh.userData.retroOrig = mat; mesh.material = next;
      } else {
        if (!mat || this.mine.has(mat)) return;
        const next = this.convert(mat);
        if (next === mat) return;
        mesh.userData.retroOrig = mat; mesh.material = next;
      }
      this.counts.meshes++;
    });
  }
  // put the originals back under root (only where the mesh still wears what this put on it)
  unstyle(root: THREE.Object3D) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh, orig = mesh.userData?.retroOrig as THREE.Material | THREE.Material[] | undefined;
      if (!orig) return;
      const cur = mesh.material, ours = Array.isArray(cur) ? cur.some((m) => this.mine.has(m)) : this.mine.has(cur);
      if (ours) mesh.material = orig;
      delete mesh.userData.retroOrig;
    });
  }

  // the game changes some materials as it runs (wet asphalt, lamps at night, brake lights): follow them
  sync() {
    for (const e of this.cache.values()) {
      const o = e.orig, t = e.toon;
      if (e.tint) t.color.copy(o.color).multiply(e.tint); else t.color.copy(o.color);
      t.emissive.copy(o.emissive); t.emissiveIntensity = o.emissiveIntensity;
      t.opacity = o.opacity; t.visible = o.visible;
    }
  }

  private convert(m: THREE.Material): THREE.Material {
    const hit = this.cache.get(m);
    if (hit) return hit.toon;
    const s = m as Lit;
    // unlit, line, point and shader materials keep their own look (lights, the sky, stars, chevrons), but an additive
    // glow (the headlights' pool on the road) is cut into bands where it stands
    if (!s.isMeshStandardMaterial && !(m as THREE.MeshLambertMaterial).isMeshLambertMaterial && !(m as THREE.MeshPhongMaterial).isMeshPhongMaterial) { this.glow(m); return m; }
    const hooked = m.onBeforeCompile !== DEFAULT_HOOK;
    if (hooked && !this.hookFits(m)) return m;
    const t = new THREE.MeshToonMaterial();
    t.name = m.name; t.userData = { ...m.userData };
    t.gradientMap = this.gradient;
    t.color.copy(s.color);
    t.vertexColors = m.vertexColors;
    t.side = m.side; t.shadowSide = m.shadowSide;
    t.transparent = m.transparent; t.opacity = m.opacity; t.alphaTest = m.alphaTest; t.alphaHash = m.alphaHash;
    t.alphaMap = s.alphaMap ?? null;
    t.depthWrite = m.depthWrite; t.depthTest = m.depthTest; t.depthFunc = m.depthFunc; t.colorWrite = m.colorWrite;
    t.blending = m.blending; t.blendSrc = m.blendSrc; t.blendDst = m.blendDst; t.blendEquation = m.blendEquation; t.premultipliedAlpha = m.premultipliedAlpha;
    t.polygonOffset = m.polygonOffset; t.polygonOffsetFactor = m.polygonOffsetFactor; t.polygonOffsetUnits = m.polygonOffsetUnits;
    t.visible = m.visible; t.fog = s.fog; t.toneMapped = m.toneMapped; t.wireframe = s.wireframe;
    t.clippingPlanes = m.clippingPlanes; t.clipIntersection = m.clipIntersection; t.clipShadows = m.clipShadows;
    t.emissive.copy(s.emissive); t.emissiveIntensity = s.emissiveIntensity; t.emissiveMap = s.emissiveMap ?? null;
    t.displacementMap = s.displacementMap ?? null; t.displacementScale = s.displacementScale ?? 1; t.displacementBias = s.displacementBias ?? 0;
    // the map: flat average colour, or kept and posterized
    let tint: THREE.Color | null = null;
    const defines: Record<string, string> = {};
    if (s.map) {
      const st = texStats(s.map);
      const cut = m.alphaTest > 0 || (m.transparent && !!st?.alphaVaries);
      const flat = !cut && !!st && (this.o.textures === 'flat' || (this.o.textures === 'auto' && st.std < 0.085));
      if (flat) { tint = st!.mean.clone(); t.color.multiply(tint); this.counts.flat++; }
      else { t.map = s.map; defines.RETRO_POSTER = ''; this.counts.poster++; }
    } else this.counts.kept++;
    // glossy and metal parts and glass: a hard specular spot; glass (see-through, keeping its blend and tint) a rim of
    // sky; polished metal (chrome, mirrors, dark tinted glass) banded sky and ground; other metal a shade darker,
    // having no reflection to brighten it
    const metal = s.metalness ?? 0, rough = s.roughness ?? 1, coat = s.clearcoat ?? 0, glass = /glass/i.test(m.name);
    const chrome = !glass && metal > 0.8 && rough < 0.25;
    if (glass || coat > 0.3 || rough < 0.3 || metal > 0.5) defines.RETRO_SPEC = glass || coat > 0.3 ? '0.985' : '0.96';
    if (glass) defines.RETRO_RIM = '0.5';
    if (chrome) defines.RETRO_CHROME = '';
    else if (metal > 0.5 && !glass) { tint = (tint ?? new THREE.Color(1, 1, 1)).multiplyScalar(0.82); t.color.copy(s.color).multiply(tint); }
    t.defines = defines;
    const own = hooked ? m.onBeforeCompile.bind(m) : null, ownKey = hooked ? m.customProgramCacheKey() : '';
    t.onBeforeCompile = (sh, r) => {
      own?.(sh, r);
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lights_pars_begin>', LIGHTS_BEGIN)
        .replace('#include <shadowmap_pars_fragment>', SHADOW_PARS)
        .replace('#include <lights_toon_pars_fragment>', LIGHTS_PARS)
        .replace('#include <alphamap_fragment>', POSTER)
        .replace('#include <lights_fragment_end>', RIM)
        .replace('#include <fog_fragment>', FOG);
    };
    t.customProgramCacheKey = () => 'retro|' + ownKey;
    const entry: Entry = { orig: s, toon: t, tint };
    this.cache.set(m, entry); this.mine.add(t); this.counts.materials++;
    // a chunk's own material (a sign face) is disposed with its chunk: it is the toon one the game sees, so take the
    // original with it
    t.addEventListener('dispose', () => { if (this.disposing) return; this.cache.delete(m); m.dispose(); });
    return t;
  }

  // run a material's own shader patch over the toon shader once, on a copy: a patch that only touches chunks the toon
  // shader has (or none it lacks would break) carries over; one written for the physical shader's lighting stays put
  private hookFits(m: THREE.Material) {
    try {
      const lib = THREE.ShaderLib.toon;
      const sh = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms), defines: {} } as unknown as THREE.WebGLProgramParametersWithUniforms;
      m.onBeforeCompile(sh, this.renderer);
      return !PBR_ONLY.test(sh.fragmentShader) && !PBR_ONLY.test(sh.vertexShader);
    } catch { return false; }
  }

  // an additive glow's alpha (its texture's shape, before its opacity) in four steps, patched on the material itself
  // (the game sets its opacity through the mesh) and put back on dispose
  private glows = new Map<THREE.Material, (() => string) | null>();
  private glow(m: THREE.Material) {
    const b = m as THREE.MeshBasicMaterial;
    if (this.glows.has(m) || !b.isMeshBasicMaterial || b.blending !== THREE.AdditiveBlending || !b.map || m.onBeforeCompile !== DEFAULT_HOOK) return;
    this.glows.set(m, Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null);
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <alphahash_fragment>',
        '#include <alphahash_fragment>\n\t{ float rO = max( opacity, 1e-3 ); diffuseColor.a = floor( diffuseColor.a / rO * 4.0 + 0.35 ) * 0.25 * rO; }');
    };
    m.customProgramCacheKey = () => 'retro-glow';
    m.needsUpdate = true;
  }

  dispose() {
    for (const [m, key] of this.glows) {
      delete (m as Partial<THREE.Material>).onBeforeCompile;
      if (key) m.customProgramCacheKey = key; else delete (m as Partial<THREE.Material>).customProgramCacheKey;
      m.needsUpdate = true;
    }
    this.glows.clear();
    this.disposing = true;
    for (const e of this.cache.values()) e.toon.dispose();
    this.cache.clear();
    this.gradient.dispose();
    this.disposing = false;
  }
}

// ------------------------------------------------------------------------------------------------ the sky
// display colours (sRGB), written straight to the screen: the pass leaves the sky's pixels out of the tone map
const SKY = {
  dayZenith: new THREE.Color(0x4a8ee0), dayHigh: new THREE.Color(0x8cc0ee),
  goldZenith: new THREE.Color(0x4a5fae), goldGlow: new THREE.Color(0xffb468), goldRing: new THREE.Color(0xf8d49a),
  nightZenith: new THREE.Color(0x060b1c), sun: new THREE.Color(0xfff6dc), moon: new THREE.Color(0xdfe6f2),
  grey: new THREE.Color(0x9aa3ad),
};
for (const c of Object.values(SKY)) c.convertSRGBToLinear();

export class RetroSky {
  readonly mesh: THREE.Mesh;
  private u = {
    uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uRing: { value: new THREE.Color() },
    uGold: { value: 0 }, uDisc: { value: 0.9995 }, uBands: { value: 7 },
  };
  constructor() {
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: /* glsl */ `
uniform vec3 uHorizon, uZenith, uHigh, uSunDir, uSun, uGlow, uRing;
uniform float uGold, uDisc, uBands;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  // flat bands, thin near the horizon and wider overhead
  float t = pow(h / 0.75, 0.6);
  float b = clamp(floor(t * uBands) / (uBands - 1.0), 0.0, 1.0);
  vec3 c = b < 0.5 ? mix(uHorizon, uHigh, b * 2.0) : mix(uHigh, uZenith, b * 2.0 - 1.0);
  // the ends of the day: warm bands along the horizon toward the sun and two stepped rings round it, each a flat
  // colour that is on or off (half-mixed into the blue, warm light goes pink)
  vec3 sd = normalize(uSunDir);
  float g = dot(d, sd);
  float toward = dot(normalize(d.xz + 1e-5), normalize(sd.xz + 1e-5));
  float gold = step(0.25, uGold);
  c = mix(c, uRing, gold * step(h, 0.05 + 0.05 * uGold) * step(0.5, toward));
  c = mix(c, uGlow, gold * step(h, 0.025 + 0.02 * uGold) * step(0.8, toward));
  c = mix(c, uRing, gold * step(0.9945, g));        // six degrees round the sun
  c = mix(c, uGlow, gold * step(0.9981, g));        // three and a half
  c = mix(c, uSun, step(uDisc, g));
  gl_FragColor = vec4(c, 1.0);
}`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m);
    this.mesh.renderOrder = -3; this.mesh.frustumCulled = false; this.mesh.name = 'retro-sky';
    this.mesh.userData.retroSkip = true;
  }
  // horizon: the fog's colour as it will reach the screen, so far things fade into the bottom band
  update(camera: THREE.Camera, w: RetroWorld, horizon: THREE.Color) {
    const u = this.u, day = w.daylight, overcast = Math.max(0, Math.min(1, (1 - w.saturation) / 0.15));
    const sunY = w.sunDir.y, gold = day > 0.3 ? Math.min(1, 1.5 * Math.max(0, 1 - Math.max(0, sunY) / 0.3)) * day * (1 - overcast) : 0;
    u.uHorizon.value.copy(horizon);
    u.uZenith.value.copy(SKY.nightZenith).lerp(SKY.dayZenith, day).lerp(SKY.goldZenith, gold * 0.6).lerp(SKY.grey, overcast * 0.8);
    u.uHigh.value.copy(horizon).lerp(SKY.dayHigh, day * 0.7).lerp(u.uZenith.value, 0.25 + 0.4 * (1 - day)).lerp(SKY.grey, overcast * 0.7);
    u.uSunDir.value.copy(w.sunDir);
    if (day > 0.5) u.uSun.value.copy(SKY.sun).lerp(SKY.goldRing, gold * 0.35).multiplyScalar(1 - 0.85 * overcast);
    else u.uSun.value.copy(SKY.moon).multiplyScalar(0.9);
    u.uDisc.value = day > 0.5 ? 0.99965 : 0.99985;
    u.uGlow.value.copy(SKY.goldGlow); u.uRing.value.copy(SKY.goldRing);
    u.uGold.value = gold;
    const far = (camera as THREE.PerspectiveCamera).far ?? 1000;
    this.mesh.position.copy(camera.position); this.mesh.scale.setScalar(far * 0.9);
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

// ------------------------------------------------------------------------------------------------ the pass
const PASS_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uStep, uNear, uFar, uSat, uInk, uInkFar;
uniform vec3 uLevels;
varying vec2 vUv;
// 1/z from the depth buffer: affine across the screen on any plane, so its second difference finds only edges
float wAt(vec2 uv) { return 1.0 / uNear + texture2D(tDepth, uv).x * (1.0 / uFar - 1.0 / uNear); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float d = texture2D(tDepth, vUv).x;
  if (d < 1.0) {
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    c = linearToOutputTexel(vec4(c, 1.0)).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = clamp(mix(vec3(l), c, 1.0 + uSat * chroma), 0.0, 1.0);
  } else c = linearToOutputTexel(vec4(clamp(c, 0.0, 1.0), 1.0)).rgb;    // the sky: display colours already, as authored
  // ink on silhouettes and convex edges, on the nearer side, a CSS pixel wide, fading out with distance. An edge is a
  // jump or a kink in 1/z, so its second difference is large next to its first; a curved panel seen edge-on (the
  // headliner, a pillar's trim) bends 1/z smoothly, its second difference small next to its slope, and gets none
  vec2 o = uTexel * uStep;
  float wc = wAt(vUv);
  float wl = wAt(vUv - vec2(o.x, 0.0)), wr = wAt(vUv + vec2(o.x, 0.0)), wd = wAt(vUv - vec2(0.0, o.y)), wu = wAt(vUv + vec2(0.0, o.y));
  float lx = wl + wr - 2.0 * wc, ly = wd + wu - 2.0 * wc;
  float kx = smoothstep(0.35, 0.8, -lx / (abs(wr - wl) * 0.5 + wc * 1e-4));
  float ky = smoothstep(0.35, 0.8, -ly / (abs(wu - wd) * 0.5 + wc * 1e-4));
  float e = max(-lx * kx, -ly * ky) / wc;
  float ink = smoothstep(uInk, uInk * 2.5, e) * (1.0 - smoothstep(uInkFar * 0.4, uInkFar, 1.0 / wc));
  c = mix(c, c * 0.16 + vec3(0.012, 0.012, 0.02), ink * 0.92);
  // the palette, with a 4x4 ordered dither
  float t = bayer4(gl_FragCoord.xy);
  c = floor(c * (uLevels - 1.0) + t) / (uLevels - 1.0);
  gl_FragColor = vec4(c, 1.0);
}`;

export class RetroPass {
  readonly target: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private size = new THREE.Vector2();
  readonly mat: THREE.ShaderMaterial;
  calls = 0; tris = 0;      // the last scene render's draw calls and triangles (the pass itself adds one call)

  constructor(o: RetroOptions = RETRO_DEFAULTS) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    this.target.texture.minFilter = this.target.texture.magFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture }, tDepth: { value: this.target.depthTexture }, uTexel: { value: new THREE.Vector2(1, 1) },
        uStep: { value: 1 }, uNear: { value: 0.05 }, uFar: { value: 1000 }, uLevels: { value: new THREE.Vector3(...o.palette) }, uSat: { value: o.saturation },
        uInk: { value: o.ink }, uInkFar: { value: o.inkFar },
      },
      vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: PASS_FRAG, depthTest: false, depthWrite: false, toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, this.size.x), h = Math.max(1, this.size.y);
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
    const u = this.mat.uniforms;
    u.uTexel.value.set(1 / w, 1 / h); u.uStep.value = Math.max(1, Math.round(renderer.getPixelRatio()));
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    this.calls = renderer.info.render.calls; this.tris = renderer.info.render.triangles;
    renderer.setRenderTarget(prev);
    // the pass adds to the scene's counts rather than replacing them, so the frame's numbers stay readable
    const auto = renderer.info.autoReset;
    renderer.info.autoReset = false;
    renderer.render(this.scene, this.cam);
    renderer.info.autoReset = auto;
  }

  dispose() { this.target.depthTexture?.dispose(); this.target.dispose(); this.quad.geometry.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------------------------------------ the facade
// the colour the fog reaches on screen: three's ACES fit at the renderer's exposure, then sRGB (linear out)
const ACES_IN = [0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777];
const ACES_OUT = [1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602];
function acesDisplay(c: THREE.Color, exposure: number, out: THREE.Color) {
  const k = exposure / 0.6, v = [c.r * k, c.g * k, c.b * k];
  const a = [0, 1, 2].map((i) => ACES_IN[i * 3] * v[0] + ACES_IN[i * 3 + 1] * v[1] + ACES_IN[i * 3 + 2] * v[2]);
  const f = a.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));
  const o = [0, 1, 2].map((i) => Math.min(1, Math.max(0, ACES_OUT[i * 3] * f[0] + ACES_OUT[i * 3 + 1] * f[1] + ACES_OUT[i * 3 + 2] * f[2])));
  return out.setRGB(o[0], o[1], o[2]);
}

export class RetroStyle {
  readonly stylizer: Stylizer;
  readonly sky = new RetroSky();
  readonly pass: RetroPass;
  private roots: THREE.Object3D[] = [];
  private scene: THREE.Scene | null = null;
  private hidden: THREE.Object3D | null = null;
  private shadowType: THREE.ShadowMapType;
  private epoch = Math.random();
  private horizon = new THREE.Color();
  private clouds: THREE.Mesh | null = null;
  private cloudCut = 0;
  // the cloud deck with hard edges (its texture's alpha cut at a level), put back as it was on detach
  private cut() { const m = this.clouds?.material as THREE.Material | undefined; if (!m) return; this.cloudCut = m.alphaTest; m.alphaTest = 0.32; m.needsUpdate = true; }
  private uncut() { const m = this.clouds?.material as THREE.Material | undefined; if (!m) return; m.alphaTest = this.cloudCut; m.needsUpdate = true; this.clouds = null; }

  constructor(private renderer: THREE.WebGLRenderer, readonly options: RetroOptions = RETRO_DEFAULTS) {
    this.stylizer = new Stylizer(renderer, options);
    this.pass = new RetroPass(options);
    this.shadowType = renderer.shadowMap.type;
    U.uRetroAmbient.value = options.ambient;
  }

  // roots: groups whose children are built and dropped as you move (a chunk of road, a tile of terrain): each child
  // is styled once, when it first shows up. The scene's own children are watched the same way.
  attach(scene: THREE.Scene, roots: THREE.Object3D[] = []) {
    this.scene = scene;
    this.watch(roots);
    scene.add(this.sky.mesh);
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.stylizer.style(scene);
  }
  watch(roots: THREE.Object3D[]) { this.roots = roots; }
  // a subtree that changed under a watched object (a rebuilt car): style it again
  restyle(o: THREE.Object3D) { this.stylizer.style(o); }
  unstyle(o: THREE.Object3D) { this.stylizer.unstyle(o); }

  private styleNew() {
    const s = this.scene!;
    for (const list of [s.children, ...this.roots.map((r) => r.children)]) for (const c of list) {
      if (c.userData.retroEpoch === this.epoch) continue;
      c.userData.retroEpoch = this.epoch;
      this.stylizer.style(c);
    }
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: RetroWorld) {
    if (this.scene !== scene) this.attach(scene, this.roots);
    this.styleNew();
    this.stylizer.sync();
    if (world.sky && world.sky !== this.hidden) { if (this.hidden) this.hidden.visible = true; this.hidden = world.sky; }
    if (this.hidden) this.hidden.visible = false;
    if (world.hemi) {
      U.uRetroSky.value.copy(world.hemi.color).multiplyScalar(world.hemi.intensity * 1.6);
      U.uRetroGround.value.copy(world.hemi.groundColor).multiplyScalar(world.hemi.intensity * 0.8);
    }
    // what the realistic tiers' sky reflection lends the shade at night (their cabin never goes black): a cool floor
    U.uRetroFloor.value.setRGB(0.16, 0.18, 0.25).multiplyScalar(1 - world.daylight);
    if (world.clouds && world.clouds !== this.clouds) { this.uncut(); this.clouds = world.clouds; this.cut(); }
    if (world.flare) world.flare.visible = false;     // the world shows it again each frame it wants it
    const fog = scene.fog as THREE.Fog | null;
    acesDisplay(fog ? fog.color : (scene.background as THREE.Color) ?? new THREE.Color(0.5, 0.6, 0.7), this.renderer.toneMappingExposure, this.horizon);
    this.sky.update(camera, world, this.horizon);
    this.pass.render(this.renderer, scene, camera);
  }

  detach() {
    if (this.scene) { this.stylizer.unstyle(this.scene); this.scene.remove(this.sky.mesh); }
    const clear = (o: THREE.Object3D) => { delete o.userData.retroEpoch; };
    if (this.scene) for (const c of this.scene.children) clear(c);
    for (const r of this.roots) for (const c of r.children) clear(c);
    if (this.hidden) this.hidden.visible = true;
    this.uncut();
    this.renderer.shadowMap.type = this.shadowType;
    this.stylizer.dispose(); this.sky.dispose(); this.pass.dispose();
    this.scene = null; this.roots = []; this.hidden = null;
  }
}

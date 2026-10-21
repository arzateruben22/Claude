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
  levels: number;          // palette levels per channel, after the tone map (the dither hides the steps)
  saturation: number;      // the lift before the palette
  ink: number;             // edge threshold: the relative second difference of 1/z where ink starts
  inkFar: number;          // metres: ink fades out toward this distance
  ambient: number;         // the skylight's share in the shade (a toon material has no environment map to fill it)
}
export const RETRO_DEFAULTS: RetroOptions = { textures: 'auto', levels: 20, saturation: 1.22, ink: 0.04, inkFar: 420, ambient: 2.1 };

// what the sky needs from the world each frame (the game's Environment has all of it)
export interface RetroWorld {
  sunDir: THREE.Vector3;        // toward the sun by day, the moon by night
  daylight: number;             // 0 night .. 1 day
  saturation: number;           // 1 clear .. 0.85 overcast (the Environment's grade under cloud)
  sky?: THREE.Object3D | null;  // the realistic sky, hidden while this one shows
  hemi?: THREE.HemisphereLight | null;
}

// ------------------------------------------------------------------------------------------------ shared GLSL
// every stylized material shares these uniforms (one object, so a change reaches them all)
const U = {
  uRetroAmbient: { value: RETRO_DEFAULTS.ambient },
  uRetroSky: { value: new THREE.Color(0.5, 0.6, 0.75) },
  uRetroPoster: { value: 7 },
};
// the toon lighting with the shade lifted, a hard specular spot on glossy and metal parts, and a stepped rim of sky
// on them at grazing angles (the reflection the realistic tiers get from the environment map, as a cel band)
const LIGHTS_PARS = /* glsl */ `
varying vec3 vViewPosition;
uniform float uRetroAmbient;
uniform vec3 uRetroSky;
uniform float uRetroPoster;
struct ToonMaterial { vec3 diffuseColor; };
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  #ifdef RETRO_SPEC
    float nh = dot( geometryNormal, normalize( directLight.direction + geometryViewDir ) );
    reflectedLight.directDiffuse += directLight.color * ( step( RETRO_SPEC, nh ) * step( 0.0, dot( geometryNormal, directLight.direction ) ) * 0.3 );
  #endif
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * uRetroAmbient;
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
// the albedo posterized (map x colour x vertex and instance colour), in display space
const POSTER = /* glsl */ `
#ifdef RETRO_POSTER
  {
    vec3 pc = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
    pc = floor( pc * uRetroPoster + 0.5 ) / uRetroPoster;
    diffuseColor.rgb = pow( pc, vec3( 2.2 ) );
  }
#endif
#include <alphamap_fragment>`;
const RIM = /* glsl */ `#include <lights_fragment_end>
#ifdef RETRO_RIM
  {
    float rim = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
    reflectedLight.indirectDiffuse += uRetroSky * ( step( RETRO_RIM, rim ) * 0.22 + step( RETRO_RIM + 0.12, rim ) * 0.18 );
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
    const steps = new Uint8Array([0, 0, 0, 0, 0, 120, 255, 255, 255, 255]);
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
    // unlit, line, point and shader materials keep their own look (lights, the sky, stars, the flare, chevrons)
    if (!s.isMeshStandardMaterial && !(m as THREE.MeshLambertMaterial).isMeshLambertMaterial && !(m as THREE.MeshPhongMaterial).isMeshPhongMaterial) return m;
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
    // glossy and metal parts and glass: a hard specular spot and a rim of sky; metal a shade darker, having no
    // reflection to brighten it; glass (see-through) keeps its blend and tint
    const metal = s.metalness ?? 0, rough = s.roughness ?? 1, coat = s.clearcoat ?? 0, glass = /glass/i.test(m.name);
    if (glass || coat > 0.3 || rough < 0.3 || metal > 0.5) { defines.RETRO_SPEC = glass || coat > 0.3 ? '0.985' : '0.96'; defines.RETRO_RIM = glass ? '0.55' : '0.62'; }
    if (metal > 0.5 && !glass) { tint = (tint ?? new THREE.Color(1, 1, 1)).multiplyScalar(0.82); t.color.copy(s.color).multiply(tint); }
    t.defines = defines;
    const own = hooked ? m.onBeforeCompile.bind(m) : null, ownKey = hooked ? m.customProgramCacheKey() : '';
    t.onBeforeCompile = (sh, r) => {
      own?.(sh, r);
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lights_toon_pars_fragment>', LIGHTS_PARS)
        .replace('#include <alphamap_fragment>', POSTER)
        .replace('#include <lights_fragment_end>', RIM);
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

  dispose() {
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
  dayZenith: new THREE.Color(0x3f7fe0), dayHigh: new THREE.Color(0x6aa6ee),
  goldZenith: new THREE.Color(0x4a5fae), goldGlow: new THREE.Color(0xffa04a), goldRing: new THREE.Color(0xf6c47a),
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
  // the ends of the day: stepped rings of warm light round the sun, strongest on the horizon
  float g = dot(d, normalize(uSunDir));
  float ring = step(0.80, g) * 0.5 + step(0.93, g) * 0.5;
  float low = 1.0 - smoothstep(0.0, 0.35, h);
  c = mix(c, mix(uRing, uGlow, step(0.93, g)), ring * uGold * mix(0.55, 1.0, low));
  c = mix(c, uGlow, uGold * step(h, 0.06) * 0.5);
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
    const sunY = w.sunDir.y, gold = day > 0.3 ? Math.max(0, 1 - Math.max(0, sunY) / 0.3) * day * (1 - overcast) : 0;
    u.uHorizon.value.copy(horizon);
    u.uZenith.value.copy(SKY.nightZenith).lerp(SKY.dayZenith, day).lerp(SKY.goldZenith, gold * 0.6).lerp(SKY.grey, overcast * 0.8);
    u.uHigh.value.copy(horizon).lerp(SKY.dayHigh, day * 0.7).lerp(u.uZenith.value, 0.25 + 0.4 * (1 - day)).lerp(SKY.grey, overcast * 0.7);
    u.uSunDir.value.copy(w.sunDir);
    u.uSun.value.copy(day > 0.5 ? SKY.sun : SKY.moon).multiplyScalar(day > 0.5 ? 1 - 0.85 * overcast : 0.9);
    u.uDisc.value = day > 0.5 ? 0.99965 : 0.99985;
    u.uGlow.value.copy(SKY.goldGlow); u.uRing.value.copy(SKY.goldRing).lerp(u.uZenith.value, 0.3);
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
uniform float uStep, uNear, uFar, uLevels, uSat, uInk, uInkFar;
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
  } else c = linearToOutputTexel(vec4(clamp(c, 0.0, 1.0), 1.0)).rgb;    // the sky: display colours already
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, uSat), 0.0, 1.0);
  // ink on silhouettes and convex edges, on the nearer side, a CSS pixel wide, fading out with distance
  vec2 o = uTexel * uStep;
  float wc = wAt(vUv);
  float lx = wAt(vUv - vec2(o.x, 0.0)) + wAt(vUv + vec2(o.x, 0.0)) - 2.0 * wc;
  float ly = wAt(vUv - vec2(0.0, o.y)) + wAt(vUv + vec2(0.0, o.y)) - 2.0 * wc;
  float e = max(-lx, -ly) / wc;
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
        uStep: { value: 1 }, uNear: { value: 0.05 }, uFar: { value: 1000 }, uLevels: { value: o.levels }, uSat: { value: o.saturation },
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
    if (world.hemi) U.uRetroSky.value.copy(world.hemi.color).multiplyScalar(world.hemi.intensity * 1.6);
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
    this.renderer.shadowMap.type = this.shadowType;
    this.stylizer.dispose(); this.sky.dispose(); this.pass.dispose();
    this.scene = null; this.roots = []; this.hidden = null;
  }
}

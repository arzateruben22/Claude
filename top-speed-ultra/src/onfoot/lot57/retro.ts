// Lot 57's Low preset: the Retro look. Full resolution and crisp, drawn the way an early-2000s PC life sim looked:
// cel-shaded surfaces (a lit side, a narrow mid band, a shade side), saturated and simplified colour, hard one-step
// shadows, clean dark outlines round silhouettes and creases, a limited palette with a fine ordered dither, and a
// sky in flat bands. No bloom, no ambient occlusion, no reflections. Everything is built in code.
//
// Modelled on the driving game's Retro style (src/game/render/style.ts on the retro/port branch, not on this one,
// and the game's code stays unchanged in Phase 1): the same two parts, cut down to what this page needs.
//   Toon       swaps each physically based material under the given roots for a MeshToonMaterial that keeps its
//              colour, map (posterized), vertex and instance colours, emissive, transparency and the page's own small
//              shader patches (the baked night glow, the people's lamp fill), when those fit a toon shader. The
//              originals stay on the mesh and come back when Low is left. Kept in step every frame (the clock
//              changes emissive levels and opacities on the originals).
//   RetroPass  renders the scene into a half-float target with a depth texture, then one full-screen pass: the
//              exposure and tone map, a colour lift, ink where the depth bends (the second difference of 1/z, zero
//              across any plane, so walls and paving stay clean), the sky in flat luminance bands, and the palette
//              (16-bit colour, 5-6-5) with a 4x4 Bayer dither.
import * as THREE from 'three';

const PBR_ONLY = /\b(roughnessFactor|metalnessFactor|specularIntensityFactor|specularColorFactor|sheenSpecular\w*|clearcoatSpecular\w*|iridescence\w*|computeSpecularOcclusion)\b|\bmaterial\.(?!diffuseColor\b)[A-Za-z_]+/;
const DEFAULT_HOOK = THREE.Material.prototype.onBeforeCompile;

/** shared by every toon material: the shade side's skylight gain, the albedo's posterize levels */
const U = {
  uRetroAmbient: { value: 3.6 },
  uRetroPoster: { value: 9 },
};
// the toon light: the gradient's steps for the sun, and the skylight lifted (a toon material has no environment map,
// which on HD lights a shaded wall to about half its sunlit side)
const LIGHTS_PARS = /* glsl */ `
varying vec3 vViewPosition;
uniform float uRetroAmbient;
uniform float uRetroPoster;
struct ToonMaterial { vec3 diffuseColor; };
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * uRetroAmbient * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
// the albedo (map x colour x vertex colour) posterized in display space: flat, simplified colour
const POSTER = /* glsl */ `
#ifdef RETRO_POSTER
  {
    // (in display space, by brightness only, so a colour keeps its hue: buff pavers stay buff, not pink and olive)
    vec3 pc = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
    float pl = max( pc.r, max( pc.g, pc.b ) ), ql = ( floor( pl * uRetroPoster ) + 0.5 ) / uRetroPoster;
    pc *= ql / max( pl, 1e-3 );
    diffuseColor.rgb = pow( pc, vec3( 2.2 ) );
  }
#endif
#include <alphamap_fragment>`;
// point lights (the string lights near you on HD and Ultra; none on Low today, but a toon pool should step, not ramp)
const LIGHTS_BEGIN = THREE.ShaderChunk.lights_pars_begin
  .replace(/light\.color \*= getDistanceAttenuation\( lightDistance, (\w+)\.distance, (\w+)\.decay \);/g,
    'light.color *= retroBand( getDistanceAttenuation( lightDistance, $1.distance, $2.decay ) );')
  .replace('float getDistanceAttenuation(', 'float retroBand( float x ) { return x >= 1.0 ? x : floor( x * 4.0 + 0.35 ) * 0.25; }\nfloat getDistanceAttenuation(');

// Low's tiling surfaces (the pavers, the wood, the gravel, the asphalt, the brick...) sampled from shared atlas pages
// instead of a texture each (the plan's Low budget: 12 canvas textures at 512 px). Each page is 512 px with four 256
// px tiles; a tile is the surface's own canvas drawn at 240 px with an 8 px border wrapped round from its opposite
// edges, so filtering never reaches a neighbour. The shader repeats the tile itself (fract of the surface's own uv,
// with its own repeat and offset) and samples with the unwrapped uv's gradients, capped at a few mip levels so the
// far ground doesn't blend tiles.
const ATLAS_FRAG = /* glsl */ `
#ifdef RETRO_ATLAS
  {
    vec2 uvT = ( uRetroUV * vec3( vMapUv, 1.0 ) ).xy;
    vec2 f = fract( uvT ); f.y = mix( f.y, 1.0 - f.y, uRetroRect.w );
    vec2 gx = dFdx( uvT ) * uRetroRect.z, gy = dFdy( uvT ) * uRetroRect.z;
    float gm = max( length( gx ), length( gy ) ), cap = 6.0 / 512.0;
    if ( gm > cap ) { gx *= cap / gm; gy *= cap / gm; }
    vec4 sampledDiffuseColor = textureGrad( map, uRetroRect.xy + f * uRetroRect.z, gx, gy );
    diffuseColor *= sampledDiffuseColor;
  }
#else
#include <map_fragment>
#endif`;
class SurfaceAtlas {
  static readonly P = 512; static readonly T = 256; static readonly PAD = 8;
  readonly pages: THREE.CanvasTexture[] = [];
  private used = 0;
  private slots = new Map<THREE.Texture, { tex: THREE.CanvasTexture; rect: THREE.Vector4 }>();
  /** a surface's tile (made the first time it's asked for), or null if it isn't one to pack */
  get(src: THREE.Texture | null | undefined, mat: THREE.Material) {
    if (!src || typeof HTMLCanvasElement === 'undefined' || !(src.image instanceof HTMLCanvasElement)) return null;
    if (src.wrapS !== THREE.RepeatWrapping && src.wrapT !== THREE.RepeatWrapping) return null;     // a tiling surface
    if (src.colorSpace !== THREE.SRGBColorSpace || mat.alphaTest > 0 || mat.transparent) return null;   // colour, not a cut-out
    const hit = this.slots.get(src); if (hit) return hit;
    const { P, T, PAD } = SurfaceAtlas, I = T - 2 * PAD, per = (P / T) ** 2;
    if (this.used % per === 0) {
      const c = document.createElement('canvas'); c.width = c.height = P;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 2;
      t.name = `lot57-low-atlas-${this.pages.length}`;
      this.pages.push(t);
    }
    const page = this.pages[this.pages.length - 1], k = this.used++ % per, cols = P / T;
    const cx = (k % cols) * T, cy = Math.floor(k / cols) * T, g = (page.image as HTMLCanvasElement).getContext('2d')!;
    g.save(); g.beginPath(); g.rect(cx, cy, T, T); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.drawImage(src.image as HTMLCanvasElement, cx + PAD + dx * I, cy + PAD + dy * I, I, I);
    g.restore();
    page.needsUpdate = true;
    const slot = { tex: page, rect: new THREE.Vector4((cx + PAD) / P, 1 - (cy + PAD + I) / P, I / P, src.flipY ? 0 : 1) };
    this.slots.set(src, slot);
    return slot;
  }
}

type Lit = THREE.MeshStandardMaterial & Partial<THREE.MeshPhysicalMaterial>;
interface Entry { orig: Lit; toon: THREE.MeshToonMaterial; atlas: boolean }

export class Toon {
  private cache = new Map<THREE.Material, Entry>();
  /** the same entries as a plain array, so sync() walks it each frame without an iterator */
  private entries: Entry[] = [];
  private mine = new WeakSet<THREE.Material>();
  /** what each styled mesh wore before (kept here, not in userData, which a clone would copy as JSON) */
  private orig = new WeakMap<THREE.Mesh, THREE.Material>();
  /** a material found unconvertible on a mesh (tried again only if the mesh is given another one) */
  private skip = new WeakMap<THREE.Mesh, THREE.Material>();
  private styled = new Set<THREE.Mesh>();
  private gradient: THREE.DataTexture;
  readonly atlas = new SurfaceAtlas();
  readonly counts = { meshes: 0, materials: 0, kept: 0, caught: 0, atlased: 0 };
  constructor(private renderer: THREE.WebGLRenderer) {
    // the sun's steps over dot(N, L) from -1 to 1: shade, a narrow mid band past the terminator, then full light
    const steps = new Uint8Array([0, 0, 0, 0, 0, 96, 210, 210, 210, 210]);
    this.gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
    this.gradient.minFilter = this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.generateMipmaps = false;
    this.gradient.needsUpdate = true;
  }
  /**
   * give one mesh the look; true if its material changed. A mesh is converted again whenever it wears something
   * that is neither the toon this put on it nor a material already found unconvertible on it (a material the page
   * swapped in later: a parked car's lamps, a person's level of detail).
   */
  one(mesh: THREE.Mesh): boolean {
    const mat = mesh.material;
    if (Array.isArray(mat) || !mat || this.mine.has(mat) || this.skip.get(mesh) === mat) return false;
    const next = this.convert(mat);
    if (next === mat) { this.skip.set(mesh, mat); return false; }
    this.orig.set(mesh, mat); mesh.material = next; this.styled.add(mesh);
    this.counts.meshes = this.styled.size;
    return true;
  }
  /** swap every lit mesh under root (idempotent); returns how many were swapped this time */
  style(root: THREE.Object3D) {
    let n = 0;
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh && this.one(o as THREE.Mesh)) n++; });
    return n;
  }
  /**
   * the meshes the last frame drew that don't wear the look yet (a person's body or a held cup arriving, a parked car
   * rebuilt): found in the renderer's own list of what it drew, so nothing walks the scene; they're drawn styled from
   * the next frame. `fresh` is told about each (Low's sun-shadow rule).
   */
  catchUp(list: { opaque: { object: THREE.Object3D }[]; transparent: { object: THREE.Object3D }[] }, fresh: (m: THREE.Mesh) => void) {
    let n = 0;
    for (let i = 0; i < list.opaque.length; i++) { const m = list.opaque[i].object as THREE.Mesh; if (m.isMesh && this.one(m)) { fresh(m); n++; } }
    for (let i = 0; i < list.transparent.length; i++) { const m = list.transparent[i].object as THREE.Mesh; if (m.isMesh && this.one(m)) { fresh(m); n++; } }
    this.counts.caught += n;
    return n;
  }
  /** put the originals back on every mesh styled (where it still wears what this put on it) */
  unstyle() {
    for (const mesh of this.styled) {
      const orig = this.orig.get(mesh);
      if (orig && this.mine.has(mesh.material as THREE.Material)) mesh.material = orig;
      this.orig.delete(mesh); this.skip.delete(mesh);
    }
    this.styled.clear(); this.counts.meshes = 0;
  }
  /** follow what the page changes on the originals as it runs (the night lights, the neon, opacities) */
  sync() {
    const E = this.entries;
    for (let i = 0; i < E.length; i++) {
      const o = E[i].orig, t = E[i].toon;
      t.color.copy(o.color); t.emissive.copy(o.emissive); t.emissiveIntensity = o.emissiveIntensity;
      t.opacity = o.opacity; t.visible = o.visible;
      if (!E[i].atlas && t.map !== (o.map ?? null)) { t.map = o.map ?? null; t.needsUpdate = true; }
    }
  }
  private convert(m: THREE.Material): THREE.Material {
    const hit = this.cache.get(m);
    if (hit) return hit.toon;
    const s = m as Lit;
    if (!s.isMeshStandardMaterial) return m;
    const hooked = m.onBeforeCompile !== DEFAULT_HOOK;
    if (hooked && !this.hookFits(m)) { this.counts.kept++; return m; }
    const t = new THREE.MeshToonMaterial();
    t.name = m.name; t.userData = { ...m.userData };
    t.gradientMap = this.gradient;
    t.color.copy(s.color); t.vertexColors = m.vertexColors;
    t.side = m.side; t.shadowSide = m.shadowSide;
    t.transparent = m.transparent; t.opacity = m.opacity; t.alphaTest = m.alphaTest; t.alphaHash = m.alphaHash;
    t.alphaMap = s.alphaMap ?? null;
    t.depthWrite = m.depthWrite; t.depthTest = m.depthTest; t.blending = m.blending;
    t.polygonOffset = m.polygonOffset; t.polygonOffsetFactor = m.polygonOffsetFactor; t.polygonOffsetUnits = m.polygonOffsetUnits;
    t.visible = m.visible; t.fog = s.fog; t.toneMapped = m.toneMapped;
    t.emissive.copy(s.emissive); t.emissiveIntensity = s.emissiveIntensity; t.emissiveMap = s.emissiveMap ?? null;
    t.map = s.map ?? null;
    // glass stays see-through and flat; everything else is posterized
    const defines: Record<string, string> = {};
    if (!(m.transparent && m.opacity < 0.5)) defines.RETRO_POSTER = '';
    // a tiling surface: its tile in the shared atlas
    const slot = this.atlas.get(s.map, m);
    let atlasU: { uRetroUV: { value: THREE.Matrix3 }; uRetroRect: { value: THREE.Vector4 } } | null = null;
    if (slot && s.map) {
      s.map.updateMatrix();
      t.map = slot.tex; defines.RETRO_ATLAS = '';
      atlasU = { uRetroUV: { value: s.map.matrix }, uRetroRect: { value: slot.rect } };
      this.counts.atlased++;
    }
    t.defines = defines;
    const own = hooked ? m.onBeforeCompile.bind(m) : null, ownKey = hooked ? m.customProgramCacheKey() : '';
    t.onBeforeCompile = (sh, r) => {
      own?.(sh, r);
      Object.assign(sh.uniforms, U);
      if (atlasU) Object.assign(sh.uniforms, atlasU);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lights_pars_begin>', LIGHTS_BEGIN)
        .replace('#include <lights_toon_pars_fragment>', LIGHTS_PARS)
        .replace('#include <alphamap_fragment>', POSTER)
        .replace('#include <map_fragment>', ATLAS_FRAG)
        .replace('uniform float uRetroPoster;', 'uniform float uRetroPoster;\n#ifdef RETRO_ATLAS\nuniform mat3 uRetroUV;\nuniform vec4 uRetroRect;\n#endif');
    };
    t.customProgramCacheKey = () => 'lot57-retro|' + ownKey + '|' + Object.keys(defines).join(',');
    const entry: Entry = { orig: s, toon: t, atlas: !!atlasU };
    this.cache.set(m, entry); this.entries.push(entry); this.mine.add(t); this.counts.materials++;
    m.addEventListener('dispose', () => {
      const e = this.cache.get(m); if (!e) return;
      this.cache.delete(m); const k = this.entries.indexOf(e); if (k >= 0) this.entries.splice(k, 1); e.toon.dispose();
    });
    return t;
  }
  /** a material's own patch carries over only if it touches nothing a toon shader lacks */
  private hookFits(m: THREE.Material) {
    try {
      const lib = THREE.ShaderLib.toon;
      const sh = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms), defines: {} } as unknown as THREE.WebGLProgramParametersWithUniforms;
      m.onBeforeCompile(sh, this.renderer);
      return !PBR_ONLY.test(sh.fragmentShader) && !PBR_ONLY.test(sh.vertexShader);
    } catch { return false; }
  }
  dispose() {
    this.unstyle();
    for (const e of this.entries) e.toon.dispose();
    this.cache.clear(); this.entries.length = 0; this.counts.materials = 0;
  }
}

/** the retro frame: the scene into a target with depth, then tone map, ink, bands, palette and dither to the screen */
export class RetroPass {
  private rt: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  gold = 0;
  readonly options = { ink: 0.022, inkFar: 140, saturation: 0.18, levels: [32, 64, 32] as [number, number, number], skyBands: 12, dither: 1 };
  constructor(private renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType) });
    this.rt.texture.name = 'lot57-retro';
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        uRes: { value: new THREE.Vector2(size.x, size.y) }, uNear: { value: 0.05 }, uFar: { value: 2600 },
        uExposure: { value: 1 }, uSat: { value: this.options.saturation }, uInk: { value: this.options.ink }, uInkFar: { value: this.options.inkFar },
        uInkColor: { value: new THREE.Color(0x1d1612) }, uLevels: { value: new THREE.Vector3(...this.options.levels) }, uBands: { value: this.options.skyBands },
        uStep: { value: 1 }, uDither: { value: this.options.dither }, uGold: { value: 0 },
      },
      depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uExposure, uSat, uInk, uInkFar, uBands, uStep, uDither, uGold;
uniform vec3 uInkColor, uLevels;
varying vec2 vUv;
// three's ACES fit (as the renderer's own tone map on HD and Ultra)
vec3 RRTAndODTFit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
vec3 aces( vec3 color ) {
  const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  color *= uExposure / 0.6;
  color = ACESInputMat * color; color = RRTAndODTFit( color ); color = ACESOutputMat * color;
  return clamp( color, 0.0, 1.0 );
}
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) ); }
// 1/z (view depth) from the depth buffer: linear across any plane on screen
float invZ( vec2 uv ) { float d = texture2D( tDepth, uv ).x; float z = ( uNear * uFar ) / ( uFar - d * ( uFar - uNear ) ); return 1.0 / z; }
float bayer( vec2 p ) {
  vec2 a = floor( mod( p, 4.0 ) ), b = floor( a * 0.5 ), c = a - 2.0 * b;
  return ( fract( dot( b, vec2( 0.5, b.y * 0.75 ) ) ) * 0.25 + fract( dot( c, vec2( 0.5, c.y * 0.75 ) ) ) ) - 0.46875;
}
void main() {
  vec3 hdr = texture2D( tColor, vUv ).rgb;
  float d0 = texture2D( tDepth, vUv ).x;
  bool sky = d0 >= 0.9999999;
  vec3 c = toSRGB( aces( hdr ) );
  // golden hour: the whole frame warmer while the sun is low (as HD's grade does)
  c *= mix( vec3( 1.0 ), vec3( 1.1, 0.98, 0.8 ), uGold * smoothstep( 0.15, 0.7, dot( c, vec3( 0.333 ) ) ) );
  // saturated, simplified colour: a vibrance lift (greys stay grey)
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  float sat = max( c.r, max( c.g, c.b ) ) - min( c.r, min( c.g, c.b ) );
  c = clamp( mix( vec3( l ), c, 1.0 + uSat * ( 1.0 - sat ) ), 0.0, 1.0 );
  if ( sky ) {
    // the sky in flat bands of luminance, keeping its hue
    float lq = ( floor( l * uBands ) + 0.5 ) / uBands;
    c = clamp( c * ( lq / max( l, 1e-3 ) ), 0.0, 1.0 );
  } else {
    // ink: the depth's second difference (relative), across and down, a pixel or two out; fades with distance
    vec2 px = uStep / uRes;
    float z0 = invZ( vUv );
    float zl = invZ( vUv - vec2( px.x, 0.0 ) ), zr = invZ( vUv + vec2( px.x, 0.0 ) );
    float zd = invZ( vUv - vec2( 0.0, px.y ) ), zu = invZ( vUv + vec2( 0.0, px.y ) );
    float e = max( abs( zl + zr - 2.0 * z0 ), abs( zd + zu - 2.0 * z0 ) ) / max( z0, 1e-6 );
    // a step outward (the far side of a silhouette): ink on the near side only, so lines are one pixel and sharp
    float near = max( max( zl, zr ), max( zd, zu ) );
    float edge = smoothstep( uInk, uInk * 1.8, e ) * step( near, z0 * 1.002 );
    // sky behind a silhouette counts as an edge too
    float sk = max( max( step( 0.9999999, texture2D( tDepth, vUv - vec2( px.x, 0.0 ) ).x ), step( 0.9999999, texture2D( tDepth, vUv + vec2( px.x, 0.0 ) ).x ) ),
                    max( step( 0.9999999, texture2D( tDepth, vUv - vec2( 0.0, px.y ) ).x ), step( 0.9999999, texture2D( tDepth, vUv + vec2( 0.0, px.y ) ).x ) ) );
    edge = max( edge, sk );
    float far = 1.0 / z0;
    edge *= 1.0 - smoothstep( uInkFar * 0.5, uInkFar, far );
    c = mix( c, uInkColor, edge * 0.9 );
  }
  // the palette: 16-bit colour with a fine ordered dither (only where colour actually ramps)
  vec3 dz = vec3( bayer( gl_FragCoord.xy ) * uDither );
  c = floor( c * ( uLevels - 1.0 ) + 0.5 + dz ) / ( uLevels - 1.0 );
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
  }
  setSize(w: number, h: number) {
    this.rt.setSize(w, h);
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w, h);
    // a line about one CSS pixel wide at any pixel ratio
    this.mat.uniforms.uStep.value = Math.max(1, Math.round(this.renderer.getPixelRatio()));
  }
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const r = this.renderer, u = this.mat.uniforms;
    u.uNear.value = camera.near; u.uFar.value = camera.far; u.uExposure.value = r.toneMappingExposure; u.uGold.value = this.gold;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(prev);
    r.render(this.quad as unknown as THREE.Object3D, this.cam);
  }
  dispose() { this.rt.depthTexture?.dispose(); this.rt.dispose(); this.mat.dispose(); this.quad.geometry.dispose(); }
}

// S4: how Stoppage Time is drawn at each graphics mode (PROJECT_OC_SPORTS_BAR.md, "Graphics: Low, HD, Ultra" and
// "### S4"), on the standard Lot 57's P1d set (lot57/look.ts), in the bar's own look:
//   Low    the Retro look at full resolution: toon materials (a lit side, a narrow mid band, a shade side), ink where
//          the depth bends, the sky in flat bands, a limited palette with a 4x4 Bayer dither, through one full-screen
//          pass. It's Lot 57's P1d module (engine/retro.ts, lot57/retro.ts), so the two venues share one Retro look;
//          the game's RS1 module (src/game/render/style.ts) hasn't merged into claude/sports-bar (O15). No relief, no
//          reflections, no grade, no composer.
//   HD     realistic: the surfaces' relief (normal maps from code-made height fields, surfaces.ts), a reflection cube
//          baked from the interior for the wood, the brass and steel, the glass and the polished floor, 8x anisotropy,
//          a rim and fill on the people, and a photographer's grade (vignette, split tone, the golden hour's warmth).
//   Ultra  the maximum: the relief at twice the size, clearcoat on the bar top, the tables and the pool tables' rails,
//          sheen on the booths' vinyl and the pool cloth, 16x anisotropy, a stronger rim (1.2: at 1.6 the room's warm
//          rim after dark washed dark clothes near the camera to a flat grey, S4's night shots), a deeper grade.
// On every mode: the dance-night lights over the dance spot on game nights (the floor's light down to 60% and three
// coloured pools moving over it; still under reduced motion).
// The page keeps its PRESET (quality.ts: shadows, the composer, bloom, GTAO, lights, people); this owns the materials'
// upgrades, the grade pass and the dance lights. Nothing here allocates per frame.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { glowify } from '../../engine/mats';
import type { Quality } from '../../engine/mats';
import type { Frame } from '../../engine/frame';
import type { BarMats } from './mats';
import { makeRelief, disposeRelief, type BarRelief } from './surfaces';
import { Toon, RetroPass } from '../../engine/retro';
import { UNIT } from './layout';

/** Lot 57's toon materials, honouring the bar's `retroSkip` (a LOD 0 body's hair cap and hair cards, whose hooks don't
 *  fit a toon shader: the plan's O16): a mesh marked so keeps its own material at Low */
class BarToon extends Toon {
  override one(mesh: THREE.Mesh): boolean { return mesh.userData.retroSkip ? false : super.one(mesh); }
}

/** the rim on the people's bodies (the sky's cool edge by day, the room's warm edge after dark) and its gain at this
 *  mode (0 at Low: the plan's rim and fill are HD's and Ultra's; Low keeps the crowd's fill only) */
export const RIM = { value: new THREE.Color(0, 0, 0) };
export const RIM_GAIN = { value: 0 };

/** a person's LOD material with its fill (the room's light where they stand) and the rim, once each. The builder's
 *  material is wrapped, not changed: its own shader edits run first (S3a's fill, moved here from crowd.ts) */
export function withFillRim(mat: THREE.Material, fill: { value: THREE.Color }) {
  const ud = mat.userData as { filled?: boolean };
  if (ud.filled) return;
  ud.filled = true;
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before.call(mat, sh, r);
    sh.uniforms.uFill = fill; sh.uniforms.uRim = RIM; sh.uniforms.uRimGain = RIM_GAIN;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFill;\nuniform vec3 uRim;\nuniform float uRimGain;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uFill;\n'
        + '{ float rimK = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ); totalEmissiveRadiance += uRim * uRimGain * ( 0.3 + diffuseColor.rgb ) * rimK * rimK * rimK; }');
  };
  mat.customProgramCacheKey = () => 'person-lod-fill-rim';
  mat.needsUpdate = true;
}

interface Pipe { retro: boolean; relief: number; aniso: number; rim: number; grade: number; cube: number; clearcoat: number; sheen: number; floorRough: number }
const PIPE: Record<Quality, Pipe> = {
  low: { retro: true, relief: 0, aniso: 4, rim: 0, grade: 0, cube: 0, clearcoat: 0, sheen: 0, floorRough: 0.3 },
  hd: { retro: false, relief: 256, aniso: 8, rim: 1, grade: 1, cube: 128, clearcoat: 0, sheen: 0, floorRough: 0.26 },
  ultra: { retro: false, relief: 512, aniso: 16, rim: 1.2, grade: 1.35, cube: 256, clearcoat: 1, sheen: 1, floorRough: 0.22 },
};

// display space, after the output pass: a soft vignette, a touch of contrast, warm highlights and cool shadows, and
// the golden hour's warmth through the frame (strongest in the light)
const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uVig: { value: 0.2 }, uSplit: { value: 0.035 }, uAspect: { value: 1 }, uGold: { value: 0 }, uPunch: { value: 0 } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uVig, uSplit, uAspect, uGold, uPunch; varying vec2 vUv;
void main() {
  vec4 c = texture2D( tDiffuse, vUv );
  float l = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  c.rgb *= mix( vec3( 1.0 ), mix( vec3( 1.02, 0.97, 0.9 ), vec3( 1.12, 0.97, 0.78 ), smoothstep( 0.2, 0.8, l ) ), uGold );
  c.rgb += uSplit * ( vec3( 1.0, 0.55, 0.1 ) * smoothstep( 0.45, 1.0, l ) - vec3( 0.2, 0.05, -0.3 ) * ( 1.0 - smoothstep( 0.0, 0.45, l ) ) );
  c.rgb = mix( c.rgb, c.rgb * c.rgb * ( 3.0 - 2.0 * c.rgb ), 0.16 + 0.12 * uPunch );
  { float lm = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ); c.rgb = mix( vec3( lm ), c.rgb, 1.0 + 0.08 * uPunch ); }
  vec2 p = ( vUv - 0.5 ) * vec2( uAspect, 1.0 );
  c.rgb *= 1.0 - uVig * smoothstep( 0.35, 1.1, length( p ) * 1.25 );
  gl_FragColor = c;
}`,
};

// the dance spot's lights: the floor's light down to 60% under the spot, and three coloured pools moving over it.
// One quad, one draw: out = src.rgb + dst.rgb * src.a (src.a the dimming), so it darkens and colours only what lies
// under it on the floor (people stand in front of it in depth)
const DanceShader = {
  uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
uniform float uT, uOn; varying vec2 vUv;
vec3 pool( vec2 c, vec3 col, float r ) { float d = length( ( vUv - c ) * vec2( 1.0, 1.333 ) ); return col * smoothstep( r, r * 0.25, d ); }
void main() {
  float edge = smoothstep( 0.0, 0.14, vUv.x ) * smoothstep( 1.0, 0.86, vUv.x ) * smoothstep( 0.0, 0.12, vUv.y ) * smoothstep( 1.0, 0.88, vUv.y );
  vec3 c = pool( vec2( 0.5 + 0.28 * sin( uT * 0.71 ), 0.5 + 0.3 * cos( uT * 0.53 ) ), vec3( 0.55, 0.85, 0.12 ), 0.32 )
         + pool( vec2( 0.5 + 0.3 * cos( uT * 0.47 + 1.7 ), 0.5 + 0.26 * sin( uT * 0.83 + 0.4 ) ), vec3( 0.95, 0.32, 0.2 ), 0.3 )
         + pool( vec2( 0.5 + 0.25 * sin( uT * 0.61 + 3.1 ), 0.5 + 0.32 * sin( uT * 0.39 + 2.2 ) ), vec3( 0.35, 0.3, 0.95 ), 0.34 );
  float k = uOn * edge;
  gl_FragColor = vec4( c * 0.55 * k, 1.0 - 0.4 * k );
}`,
};

const noop = () => {};

export class BarLook {
  quality: Quality = 'low';
  readonly grade: ShaderPass;
  readonly dance: THREE.Mesh;
  private relief: BarRelief | null = null;
  private reliefSize = 0;
  private cubeRT: THREE.WebGLCubeRenderTarget | null = null;
  private cubeCam: THREE.CubeCamera | null = null;
  private bakedNight = -1;
  /** the HD and Ultra versions of the oak, the vinyl and the pool cloth (physical: clearcoat and sheen at Ultra) */
  private hi: { oak: THREE.MeshPhysicalMaterial; patioOak: THREE.MeshPhysicalMaterial; vinyl: THREE.MeshPhysicalMaterial; cloth: THREE.MeshPhysicalMaterial };
  private swaps: { mesh: THREE.Mesh; low: THREE.Material; hi: THREE.Material }[] = [];
  private danceT = 0;
  danceOn = 0;
  /** the golden hour's warmth this frame (0 none .. 1 the sun a few degrees up) */
  gold = 0;
  bakes = 0; lastBakeMs = 0;
  /** Low's Retro look: the toon materials (made once a material, kept) and the full-screen pass (made on entering Low) */
  readonly toon: BarToon;
  private retro: RetroPass | null = null;
  private readonly bufSize = new THREE.Vector2();

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private mats: BarMats, F: Frame) {
    this.grade = new ShaderPass(GradeShader);
    this.grade.enabled = false;
    this.toon = new BarToon(renderer);
    // the HD and Ultra materials: physical versions of the low ones, sharing their maps; each keeps the baked night
    // light (glowify). The pool cloth's rails are lacquered oak in the same mesh: its clearcoat is masked to the
    // vertex colours that read as wood (warm), its sheen to the rest (the cloth), so the table stays one draw
    const phys = (src: THREE.MeshStandardMaterial, o: THREE.MeshPhysicalMaterialParameters) => glowify(new THREE.MeshPhysicalMaterial({ vertexColors: true, map: src.map, color: src.color, roughness: src.roughness, metalness: src.metalness, ...o }));
    this.hi = {
      oak: phys(mats.oak, { clearcoatRoughness: 0.14 }),
      patioOak: phys(mats.oak, { roughness: 0.62 }),
      vinyl: phys(mats.vinyl, { sheenColor: new THREE.Color(1.0, 0.72, 0.62), sheenRoughness: 0.45 }),
      cloth: phys(mats.cloth, { sheenColor: new THREE.Color(0.62, 0.55, 1.0), sheenRoughness: 0.7, clearcoatRoughness: 0.18 }),
    };
    const cloth = this.hi.cloth, glowHook = cloth.onBeforeCompile;
    cloth.onBeforeCompile = (sh, r) => {
      glowHook.call(cloth, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  { float woodK = smoothstep( 0.03, 0.12, vColor.r - vColor.b );
  #ifdef USE_CLEARCOAT
    material.clearcoat *= woodK;
  #endif
  #ifdef USE_SHEEN
    material.sheenColor *= 1.0 - woodK;
  #endif
  }`);
    };
    cloth.customProgramCacheKey = () => 'bar-pool-cloth';
    // the dance spot: frame (34.0, 4.1), 2.7 m x 3.6 m (objects.ts), drawn a little wider with soft edges
    const [u0, u1, v0, v1] = [32.35, 35.5, 2.0, 6.2];
    const P = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => F.fromFrame(u, v));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x, UNIT.floor + 0.012, z]), 3));     // on the 0.15 m slab
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    // wound to face up whichever way the frame turns (the frame can mirror three.js's x and z)
    const up = (P[1][0] - P[0][0]) * (P[3][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[3][0] - P[0][0]);
    g.setIndex(up < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    g.computeBoundingSphere();
    const dm = new THREE.ShaderMaterial({ ...DanceShader, uniforms: THREE.UniformsUtils.clone(DanceShader.uniforms), transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, toneMapped: false });
    this.dance = new THREE.Mesh(g, dm); this.dance.name = 'dance-lights'; this.dance.renderOrder = 4; this.dance.visible = false;
    this.dance.userData.group = 'venue';
    scene.add(this.dance);
  }

  /** the meshes whose material the mode swaps: the oak batches, the booths and the pool tables (by name) */
  bind(meshes: THREE.Mesh[]) {
    const pick = (name: string, hi: THREE.Material) => { for (const m of meshes) if (m.name === name || (name === 'pool-table' && /^pool-\d-table$/.test(m.name))) this.swaps.push({ mesh: m, low: m.material as THREE.Material, hi }); };
    pick('bar-oak', this.hi.oak); pick('patio-wood', this.hi.patioOak); pick('bar-vinyl', this.hi.vinyl); pick('pool-table', this.hi.cloth);
  }

  /** a change of mode: the materials, the relief, anisotropy, the rim, the grade (the composer is the page's) */
  setQuality(q: Quality) {
    this.quality = q;
    const P = PIPE[q], hiOn = q !== 'low';
    // leaving Low: the originals back on every styled mesh first (before the mode's own swaps)
    if (!P.retro) { this.toon.unstyle(); this.retro?.dispose(); this.retro = null; }
    for (const s of this.swaps) s.mesh.material = hiOn ? s.hi : s.low;
    // the relief at the mode's size (made once a size; Low none)
    if (P.relief && P.relief !== this.reliefSize) { disposeRelief(this.relief); this.relief = makeRelief(P.relief); this.reliefSize = P.relief; }
    if (!P.relief && this.relief) { disposeRelief(this.relief); this.relief = null; this.reliefSize = 0; }
    const R = this.relief, m = this.mats, h = this.hi;
    const setN = (mt: THREE.MeshStandardMaterial, t: THREE.Texture | null, s: number) => { if ((mt.normalMap === null) !== (t === null)) mt.needsUpdate = true; mt.normalMap = t; mt.normalScale.set(s, s); };
    setN(h.oak, R?.oak ?? null, 0.5); setN(h.patioOak, R?.oak ?? null, 0.7); setN(h.vinyl, R?.vinyl ?? null, 0.9); setN(h.cloth, R?.cloth ?? null, 0.6);
    setN(m.floor, R?.floor ?? null, 0.35); setN(m.steel, R?.metal ?? null, 0.25);
    h.oak.clearcoat = P.clearcoat; h.cloth.clearcoat = P.clearcoat * 0.9;
    h.vinyl.sheen = P.sheen * 0.6; h.cloth.sheen = P.sheen;
    m.floor.roughness = P.floorRough;
    // anisotropy on the bar's own textures (the game's are set by configureTextures)
    const max = this.renderer.capabilities.getMaxAnisotropy(), an = Math.max(1, Math.min(P.aniso, max));
    for (const mt of [m.floor, m.oak, m.concrete, m.asphalt, m.tilt, m.walls, m.facade, m.landuse, h.oak, h.patioOak, m.signs, m.signsLit, m.screen, m.wordmark]) {
      for (const t of [mt.map, mt.normalMap]) if (t && t.anisotropy !== an) { t.anisotropy = an; t.needsUpdate = true; }
    }
    RIM_GAIN.value = P.rim;
    this.grade.enabled = P.grade > 0;
    this.grade.uniforms.uPunch.value = Math.max(0, P.grade - 1) / 0.35;
    this.grade.uniforms.uVig.value = 0.18 + 0.06 * (P.grade - 1);
    // the reflection cube: HD and Ultra only (Low's materials take the sky's environment, as before)
    if (!P.cube) this.applyCube(false);
    // entering Low: the toon materials on everything drawn so far, and the pass at the drawing buffer's size
    if (P.retro) {
      if (!this.retro) { this.retro = new RetroPass(this.renderer); this.renderer.getDrawingBufferSize(this.bufSize); this.retro.setSize(this.bufSize.x, this.bufSize.y); }
      this.toon.style(this.scene);
    }
  }
  /** Low draws through the Retro pass (the page's render() asks) */
  get retroOn() { return this.retro !== null; }
  /** the drawing buffer changed size (a resize or a new pixel ratio) */
  resize() { if (this.retro) { this.renderer.getDrawingBufferSize(this.bufSize); this.retro.setSize(this.bufSize.x, this.bufSize.y); } }
  /** Low's frame: the toon materials follow the originals (the night lights, the neon, opacities), the scene into the
   *  pass's target, then the one full-screen draw (tone map, ink, sky bands, palette, dither) */
  renderRetro(camera: THREE.PerspectiveCamera) {
    this.toon.sync();
    this.retro!.gold = this.gold;
    this.retro!.render(this.scene, camera);
  }
  /** after Low's frame: anything that frame drew without the look yet (a body, a held item, a parked car rebuilt) is
   *  styled from the next frame, found in the renderer's own list of what it drew (no scene walk) */
  catchUp() { if (this.retro) this.toon.catchUp(this.renderer.renderLists.get(this.scene, 0), noop); }

  /** the reflection cube, baked from the interior at the room's centre (people, cards, items and overlays left out,
   *  the maps not updating), once at load and again only when the night has moved by a third since the last bake (a
   *  set clock or the live clock's hours): six renders of the scene */
  bake(at: THREE.Vector3, night: number, force = false) {
    const P = PIPE[this.quality];
    if (!P.cube) return false;
    if (!force && this.cubeRT && this.cubeRT.width === P.cube && Math.abs(night - this.bakedNight) < 0.33) { this.applyCube(true); return false; }
    const t0 = performance.now();
    if (!this.cubeRT || this.cubeRT.width !== P.cube) {
      this.cubeRT?.dispose();
      this.cubeRT = new THREE.WebGLCubeRenderTarget(P.cube, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      this.cubeRT.texture.name = 'interior-cube';
      this.cubeCam = new THREE.CubeCamera(0.1, 80, this.cubeRT);
    }
    // leave out what moves or overlays: skinned bodies, instanced meshes that move (cards, blobs, items, dots) and
    // anything that writes no depth (glass, light pools, the dance lights)
    const hidden: THREE.Object3D[] = [];
    this.scene.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mt = m.material as THREE.Material;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh || ((m as THREE.InstancedMesh).isInstancedMesh && !m.frustumCulled) || (!Array.isArray(mt) && !mt.depthWrite)) hidden.push(m);
    });
    for (const o of hidden) o.visible = false;
    const cubeMats = this.cubeMats();
    for (const mt of cubeMats) mt.envMap = null;
    const sm = this.renderer.shadowMap.needsUpdate;
    this.renderer.shadowMap.needsUpdate = false;
    this.cubeCam!.position.copy(at);
    this.cubeCam!.update(this.renderer, this.scene);
    this.renderer.shadowMap.needsUpdate = sm;
    for (const o of hidden) o.visible = true;
    this.bakedNight = night; this.bakes++; this.lastBakeMs = performance.now() - t0;
    this.applyCube(true);
    return true;
  }
  private cubeMats() { const m = this.mats, h = this.hi; return [h.oak, h.vinyl, h.cloth, m.steel, m.glass, m.doorLeaf, m.floor] as THREE.MeshStandardMaterial[]; }
  private applyCube(on: boolean) {
    const tex = on && this.cubeRT ? this.cubeRT.texture : null;
    const k: Record<string, number> = { oak: 0.55, vinyl: 0.35, cloth: 0.2, steel: 0.9, glass: 1.0, doorLeaf: 0.9, floor: 0.7 };
    const names = ['oak', 'vinyl', 'cloth', 'steel', 'glass', 'doorLeaf', 'floor'];
    this.cubeMats().forEach((mt, i) => { if ((mt.envMap === null) !== (tex === null)) mt.needsUpdate = true; mt.envMap = tex; if (tex) mt.envMapIntensity = k[names[i]]; });
  }

  /** the time of day: the rim's colour (a cool sky edge by day, the room's warm one after dark) and the golden hour */
  setNight(night: number, open: boolean, sunY: number, daylight: number) {
    RIM.value.setRGB(0.1, 0.12, 0.15).multiplyScalar(1 - night);
    RIM.value.r += (open ? 0.4 : 0.12) * night; RIM.value.g += (open ? 0.27 : 0.1) * night; RIM.value.b += (open ? 0.2 : 0.12) * night;
    const s = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    this.gold = daylight > 0.2 ? s(0.36, 0.06, sunY) * s(-0.03, 0.03, sunY) : 0;
    this.grade.uniforms.uGold.value = this.gold * 0.85;
    this.grade.uniforms.uSplit.value = 0.03 + 0.03 * night;
  }

  /** each frame: the grade's aspect and the dance lights (on game nights while open, after dark) */
  update(dt: number, aspect: number, dance: boolean, reduced: boolean) {
    this.grade.uniforms.uAspect.value = aspect;
    const want = dance ? 1 : 0;
    this.danceOn += Math.sign(want - this.danceOn) * Math.min(Math.abs(want - this.danceOn), dt * 0.8);
    if (reduced) this.danceOn = want;
    this.dance.visible = this.danceOn > 0.001;
    if (!reduced) this.danceT += dt;
    const u = (this.dance.material as THREE.ShaderMaterial).uniforms;
    u.uT.value = this.danceT; u.uOn.value = this.danceOn;
  }

  report() {
    const h = this.hi;
    return {
      quality: this.quality, retro: { attached: this.retroOn, toon: { ...this.toon.counts } }, relief: this.reliefSize, rimGain: RIM_GAIN.value, grade: this.grade.enabled, gold: +this.gold.toFixed(3),
      cube: this.cubeRT && this.mats.floor.envMap ? this.cubeRT.width : 0, bakes: this.bakes, lastBakeMs: Math.round(this.lastBakeMs),
      clearcoat: h.oak.clearcoat, sheen: h.cloth.sheen, swapped: this.swaps.map((s) => ({ mesh: s.mesh.name, hi: s.mesh.material === s.hi })),
      aniso: this.mats.floor.map?.anisotropy ?? null, dance: +this.danceOn.toFixed(3),
    };
  }
}

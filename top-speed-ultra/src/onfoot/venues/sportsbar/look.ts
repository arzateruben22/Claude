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
// coloured pools moving over it; still under reduced motion), and the I-5's light streams (streaks along the road that
// keep their size far off: engine/streets.ts), longest and brightest at Ultra.
// S4's repair (after review): the screens drawn unlit at HD and Ultra (a glossy lit screen caught the TV-wall fill's
// highlight as a white hotspot over the pitch); the wordmark kept lime at night at HD and Ultra (bloom had blown the
// chalk letters to white); the graphics table's Details row: soft light cones under the pool pendants at HD and Ultra
// and dust turning in them at Ultra (still under reduced motion; neither at Low); the dance pools brighter and wider;
// the dartboards' sisal at HD and Ultra (surfaces.ts).
// The page keeps its PRESET (quality.ts: shadows, the composer, bloom, GTAO, lights, people); this owns the materials'
// upgrades, the grade pass and the dance lights. Nothing here allocates per frame.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { glowify } from '../../engine/mats';
import type { Quality } from '../../engine/mats';
import type { Frame } from '../../engine/frame';
import type { BarMats } from './mats';
import { makeRelief, disposeRelief, makeSisal, type BarRelief } from './surfaces';
import { Toon, RetroPass } from '../../engine/retro';
import type { StreamLook } from '../../engine/streets';
import { UNIT, POOL_TABLES } from './layout';

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

/** the streams at a mode: the streak (engine/streets.ts) and the lamps' brightness (over 1 at HD and Ultra, so bloom
 *  catches them after dark; Low has no bloom and its pass tone maps) */
interface Streams extends StreamLook { head: number; tail: number }
interface Pipe {
  retro: boolean; relief: number; aniso: number; rim: number; grade: number; cube: number; clearcoat: number; sheen: number; floorRough: number;
  streams: Streams; cones: boolean; dust: boolean; sisal: number;
}
const PIPE: Record<Quality, Pipe> = {
  low: { retro: true, relief: 0, aniso: 4, rim: 0, grade: 0, cube: 0, clearcoat: 0, sheen: 0, floorRough: 0.3, streams: { stretch: 3.6, grow: 60, lift: 0.12, head: 1.3, tail: 1.7 }, cones: false, dust: false, sisal: 0 },
  hd: { retro: false, relief: 256, aniso: 8, rim: 1, grade: 1, cube: 128, clearcoat: 0, sheen: 0, floorRough: 0.26, streams: { stretch: 3.0, grow: 55, lift: 0.12, head: 2.4, tail: 3.4 }, cones: true, dust: false, sisal: 512 },
  ultra: { retro: false, relief: 512, aniso: 16, rim: 1.2, grade: 1.35, cube: 256, clearcoat: 1, sheen: 1, floorRough: 0.22, streams: { stretch: 3.6, grow: 50, lift: 0.12, head: 2.8, tail: 4.0 }, cones: true, dust: true, sisal: 1024 },
};
/** the wordmark's emissive tint at HD and Ultra after dark: lime over the chalk letters, so tone mapping and bloom keep
 *  the hue (white emissive on chalk at 1.68 went to near white under bloom); Low keeps white (its pass lifts colour) */
const WORD_LIME = new THREE.Color(0.62, 1.0, 0.3);

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
// under it on the floor (people stand in front of it in depth). S4's repair: the review saw only a faint smudge, so
// the quad now covers the floor from the standing area to the TV wall, the dimmed area has a firmer edge, and the
// pools are wider, harder-edged and stronger (lime, coral and a violet blue: the identity's colours)
const DanceShader = {
  uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
uniform float uT, uOn; varying vec2 vUv;
vec3 pool( vec2 c, vec3 col, float r ) { float d = length( ( vUv - c ) * vec2( 1.0, 1.333 ) ); return col * smoothstep( r, r * 0.55, d ); }
void main() {
  float edge = smoothstep( 0.0, 0.07, vUv.x ) * smoothstep( 1.0, 0.93, vUv.x ) * smoothstep( 0.0, 0.06, vUv.y ) * smoothstep( 1.0, 0.94, vUv.y );
  vec3 c = pool( vec2( 0.5 + 0.26 * sin( uT * 0.71 ), 0.5 + 0.26 * cos( uT * 0.53 ) ), vec3( 0.62, 1.0, 0.1 ), 0.3 )
         + pool( vec2( 0.5 + 0.27 * cos( uT * 0.47 + 1.7 ), 0.5 + 0.24 * sin( uT * 0.83 + 0.4 ) ), vec3( 1.0, 0.3, 0.16 ), 0.28 )
         + pool( vec2( 0.5 + 0.24 * sin( uT * 0.61 + 3.1 ), 0.5 + 0.27 * sin( uT * 0.39 + 2.2 ) ), vec3( 0.4, 0.3, 1.0 ), 0.3 );
  float k = uOn * edge;
  gl_FragColor = vec4( c * 1.15 * k, 1.0 - 0.4 * k );
}`,
};

// the graphics table's Details row (S4's repair): a soft additive cone of light under each pool pendant (HD and Ultra),
// brightest by the shade and through the volume's middle, fading at its edges and toward the table; one mesh for both
// tables, one draw. It writes no depth, so the reflection cube's bake and GTAO's normal pass leave it out
const ConeShader = {
  uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.76, 0.48) } },
  vertexShader: /* glsl */ `
attribute float aH; attribute float aS; varying float vH; varying float vS; varying vec3 vN; varying vec3 vV;
void main() { vH = aH; vS = aS; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vN = normalize( normalMatrix * normal ); vV = normalize( -mv.xyz ); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */ `
uniform float uOn; uniform vec3 uCol; varying float vH; varying float vS; varying vec3 vN; varying vec3 vV;
void main() {
  float face = abs( dot( normalize( vN ), normalize( vV ) ) );
  float edge = smoothstep( 0.0, 0.35, vS ) * smoothstep( 1.0, 0.65, vS );
  float fall = pow( 1.0 - vH, 1.4 ) * smoothstep( 0.0, 0.06, vH );
  gl_FragColor = vec4( uCol * ( uOn * edge * fall * ( 0.3 + 0.7 * face * face ) ), 1.0 );
}`,
};
// Ultra's dust turning slowly in the cones: one point each, one draw for both tables; their drift and twinkle stop
// under reduced motion (the time stands still)
const DustShader = {
  uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uPx: { value: 720 }, uCol: { value: new THREE.Color(1.0, 0.86, 0.66) } },
  vertexShader: /* glsl */ `
attribute float aSeed; attribute float aH; uniform float uT; uniform float uPx; varying float vA;
void main() {
  vec3 p = position + vec3( sin( uT * 0.21 + aSeed * 37.0 ), 1.3 * sin( uT * 0.13 + aSeed * 91.0 ), cos( uT * 0.17 + aSeed * 53.0 ) ) * 0.05;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp( uPx * 0.0055 / max( 0.1, -mv.z ), 1.5, 3.5 );
  vA = ( 0.5 + 0.5 * sin( uT * 0.7 + aSeed * 23.0 ) ) * ( 1.0 - aH * 0.75 );
}`,
  fragmentShader: /* glsl */ `
uniform float uOn; uniform vec3 uCol; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float r = dot( c, c ); if ( r > 0.25 ) discard; gl_FragColor = vec4( uCol * ( uOn * vA * ( 1.0 - 4.0 * r ) ), 1.0 ); }`,
};
/** a pool pendant's cone: the shade's lit underside (u +-0.2, v +-0.78 at 2.05 m) down to the table's apron (u +-0.62,
 *  v +-1.12 at 0.95 m); the dust's points inside it */
const CONE_TOP = { y: 2.05, hu: 0.2, hv: 0.78 }, CONE_FOOT = { y: 0.95, hu: 0.62, hv: 1.12 };

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
  /** HD's and Ultra's screens: unlit (the picture alone), so no real light leaves a highlight on the glass */
  readonly screenHi: THREE.MeshBasicMaterial;
  /** the Details row: the pendants' cones (HD, Ultra) and the dust in them (Ultra) */
  readonly cones: THREE.Mesh;
  readonly dust: THREE.Points;
  private dustT = 0;
  private sisal: THREE.Texture | null = null;
  private sisalSize = 0;
  private night = 0;
  private open = false;

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
    // the screens at HD and Ultra: the broadcast picture unlit (the page's mats.screen stays the one Low draws and the
    // one life.ts gives each new picture; update() follows its map and brightness)
    this.screenHi = new THREE.MeshBasicMaterial({ map: mats.screen.map, color: 0xffffff });
    this.screenHi.name = 'screen-hd';
    // the pendants' cones: four sides a table (no top or bottom), each face with its own vertices (its normal, its
    // height down the cone and its place across the face for the soft edges)
    const cp: number[] = [], cn: number[] = [], ch: number[] = [], cs: number[] = [];
    const corner = (cu: number, cv: number, top: boolean, su: number, sv: number): [number, number, number] => {
      const c = top ? CONE_TOP : CONE_FOOT, [x, z] = F.fromFrame(cu + su * c.hu, cv + sv * c.hv); return [x, c.y, z];
    };
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3();
    for (const [cu, cv] of POOL_TABLES) {
      const ring: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let f = 0; f < 4; f++) {
        const [a, b] = [ring[f], ring[(f + 1) % 4]];
        const t0 = corner(cu, cv, true, a[0], a[1]), t1 = corner(cu, cv, true, b[0], b[1]), b0 = corner(cu, cv, false, a[0], a[1]), b1 = corner(cu, cv, false, b[0], b[1]);
        tmpA.set(t1[0] - t0[0], t1[1] - t0[1], t1[2] - t0[2]); tmpB.set(b0[0] - t0[0], b0[1] - t0[1], b0[2] - t0[2]);
        tmpN.crossVectors(tmpA, tmpB).normalize();
        for (const [v, h, sx] of [[t0, 0, 0], [b0, 1, 0], [b1, 1, 1], [t0, 0, 0], [b1, 1, 1], [t1, 0, 1]] as [[number, number, number], number, number][]) {
          cp.push(...v); cn.push(tmpN.x, tmpN.y, tmpN.z); ch.push(h); cs.push(sx);
        }
      }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3));
    cg.setAttribute('aH', new THREE.Float32BufferAttribute(ch, 1)); cg.setAttribute('aS', new THREE.Float32BufferAttribute(cs, 1));
    cg.computeBoundingSphere();
    const coneMat = new THREE.ShaderMaterial({ ...ConeShader, uniforms: THREE.UniformsUtils.clone(ConeShader.uniforms), transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
    this.cones = new THREE.Mesh(cg, coneMat); this.cones.name = 'pendant-cones'; this.cones.renderOrder = 5; this.cones.visible = false;
    this.cones.userData.group = 'venue'; this.cones.castShadow = false; this.cones.receiveShadow = false;
    scene.add(this.cones);
    // the dust: 160 motes a cone, spread through its volume (more near the shade), fixed by a seed
    const dp: number[] = [], ds: number[] = [], dh: number[] = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (const [cu, cv] of POOL_TABLES) for (let i = 0; i < 160; i++) {
      const h = Math.pow(rnd(), 1.3) * 0.92, hu = CONE_TOP.hu + (CONE_FOOT.hu - CONE_TOP.hu) * h, hv = CONE_TOP.hv + (CONE_FOOT.hv - CONE_TOP.hv) * h;
      const [x, z] = F.fromFrame(cu + (rnd() * 2 - 1) * hu * 0.85, cv + (rnd() * 2 - 1) * hv * 0.85);
      dp.push(x, CONE_TOP.y + (CONE_FOOT.y - CONE_TOP.y) * h, z); ds.push(rnd()); dh.push(h);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ds, 1)); dg.setAttribute('aH', new THREE.Float32BufferAttribute(dh, 1));
    dg.computeBoundingSphere();
    const dustMat = new THREE.ShaderMaterial({ ...DustShader, uniforms: THREE.UniformsUtils.clone(DustShader.uniforms), transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false });
    this.dust = new THREE.Points(dg, dustMat); this.dust.name = 'pendant-dust'; this.dust.renderOrder = 6; this.dust.visible = false;
    this.dust.userData.group = 'venue';
    scene.add(this.dust);
  }

  /** the meshes whose material the mode swaps: the oak batches, the booths and the pool tables (by name) */
  bind(meshes: THREE.Mesh[]) {
    const pick = (name: string, hi: THREE.Material) => { for (const m of meshes) if (m.name === name || (name === 'pool-table' && /^pool-\d-table$/.test(m.name))) this.swaps.push({ mesh: m, low: m.material as THREE.Material, hi }); };
    pick('bar-oak', this.hi.oak); pick('patio-wood', this.hi.patioOak); pick('bar-vinyl', this.hi.vinyl); pick('pool-table', this.hi.cloth);
    pick('bar-screens', this.screenHi);
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
    // the dartboards' sisal (the signs' atlas carries the boards; their relief map is flat everywhere else)
    if (P.sisal && P.sisal !== this.sisalSize) { this.sisal?.dispose(); this.sisal = makeSisal(P.sisal); this.sisalSize = P.sisal; }
    if (!P.sisal && this.sisal) { this.sisal.dispose(); this.sisal = null; this.sisalSize = 0; }
    setN(m.signs, this.sisal, 1);
    // the streams' lamps at this mode (their streak is engine/streets.ts's, read by the page through streamLook)
    m.streamHead.color.setRGB(1.0, 0.95, 0.84).multiplyScalar(P.streams.head);
    m.streamTail.color.setRGB(1.0, 0.19, 0.12).multiplyScalar(P.streams.tail);
    this.signs();
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
  /** how the I-5's streams are drawn at this mode (engine/streets.ts's update) */
  get streamLook(): StreamLook { return PIPE[this.quality].streams; }
  /** the wordmark after dark: Low as mats.ts sets it (white on the chalk, its pass lifts the colour); HD and Ultra
   *  lime over the chalk at a lower level, so the letters stay lime under tone mapping and bloom spreads a lime halo */
  private signs() {
    const w = this.mats.wordmark;
    if (this.quality === 'low') { w.emissive.setRGB(1, 1, 1); w.emissiveIntensity = 0.08 + this.night * 1.6; return; }
    w.emissive.setRGB(1, 1, 1).lerp(WORD_LIME, Math.min(1, this.night * 1.4));
    w.emissiveIntensity = 0.08 + this.night * 1.05;
  }
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
      if ((o as THREE.Points).isPoints) { hidden.push(o); return; }        // Ultra's dust (and any points)
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
    this.night = night; this.open = open; this.signs();
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
    // the screens at HD and Ultra follow the picture life.ts gives mats.screen, and its brightness (open or not)
    const sc = this.mats.screen, sh = this.screenHi;
    if (sh.map !== sc.map) { sh.map = sc.map; sh.needsUpdate = true; }
    sh.color.setScalar(this.open ? 0.92 + 0.22 * this.night : 0.03);
    // the pendants' cones (HD, Ultra) and their dust (Ultra) while the room is open: brighter after dark
    const P = PIPE[this.quality], lit = this.open ? 0.45 + 0.55 * this.night : 0;
    this.cones.visible = P.cones && lit > 0;
    (this.cones.material as THREE.ShaderMaterial).uniforms.uOn.value = 0.17 * lit;
    this.dust.visible = P.dust && lit > 0;
    if (!reduced) this.dustT += dt;
    const du = (this.dust.material as THREE.ShaderMaterial).uniforms;
    du.uT.value = this.dustT; du.uOn.value = 0.9 * lit;
    this.renderer.getDrawingBufferSize(this.bufSize); du.uPx.value = this.bufSize.y;
  }

  report() {
    const h = this.hi;
    return {
      quality: this.quality, retro: { attached: this.retroOn, toon: { ...this.toon.counts } }, relief: this.reliefSize, rimGain: RIM_GAIN.value, grade: this.grade.enabled, gold: +this.gold.toFixed(3),
      cube: this.cubeRT && this.mats.floor.envMap ? this.cubeRT.width : 0, bakes: this.bakes, lastBakeMs: Math.round(this.lastBakeMs),
      clearcoat: h.oak.clearcoat, sheen: h.cloth.sheen, swapped: this.swaps.map((s) => ({ mesh: s.mesh.name, hi: s.mesh.material === s.hi })),
      aniso: this.mats.floor.map?.anisotropy ?? null, dance: +this.danceOn.toFixed(3),
      screen: this.quality === 'low' ? 'lit (Low)' : 'unlit', cones: this.cones.visible, dust: this.dust.visible, sisal: this.sisalSize,
      streams: { ...PIPE[this.quality].streams }, wordmark: { emissive: '#' + this.mats.wordmark.emissive.getHexString(), intensity: +this.mats.wordmark.emissiveIntensity.toFixed(3) },
    };
  }
}

// The page's materials, made once. Surfaces use the code-painted textures in tex.ts; most props are vertex-coloured
// so a family of them is one draw call. Night light is baked into each batch's "glow" attribute (geom.ts) and added
// to the emissive term by glowify(); setNight() sets the three channels' levels: the venue's own lights (string
// lights, heaters, truck windows: on when it's dark and Lot 57 is open), the street and lot lights (on when it's
// dark), and the Shed's interior lights (on while it's open, brighter after dark).
import * as THREE from 'three';
import * as T from './tex';
import * as P from '../../game/road/props';
import { ground } from '../../game/textures';
import { leafAtlas, barkTex, leafShading } from './trees';
import * as S from './surfaces';

export type Quality = 'low' | 'hd' | 'ultra';

/** a rim of light on the people's bodies (lot57/crowdview.ts withFill): the sky's by day, the string lights' after
 *  dark, so a figure stands out of the scene instead of sitting flat in it (set by setNight) */
export const RIM = { value: new THREE.Color(0, 0, 0) };
/** the rim's and the fill's gain on the people at each preset (x rim, y fill; look.ts sets it: Ultra the strongest) */
export const RIM_GAIN = { value: new THREE.Vector2(1, 1) };
/** the light under the umbrellas' canopies (look.ts sets it each frame): the sun through the canvas and its bounce
 *  off the sunlit paving by day, the strings' and heaters' warm fill after dark */
export const CANOPY = { value: new THREE.Color(0, 0, 0) };
/** a canopy's underside (its back faces) takes CANOPY's light as well as what lights it from below; its outside a
 *  little of it too (canvas is translucent: a valance in shade still glows with the light through it) */
function underside<M extends THREE.Material>(m: M): M {
  const before = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r);
    sh.uniforms.uCanopy = CANOPY;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCanopy;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uCanopy * ( gl_FrontFacing ? 0.3 : 1.0 );');
  };
  m.customProgramCacheKey = () => 'lot57-glow-canopy';
  return m;
}
/** things that move every frame (the fire tables' flames): called by the page's renderer (lot57/look.ts) */
export const TICKS: ((t: number) => void)[] = [];

/** the night-light channels every glowing material reads (colour x level, set by setNight) */
export const GLOW = {
  a: { value: new THREE.Color(0, 0, 0) },
  b: { value: new THREE.Color(0, 0, 0) },
  c: { value: new THREE.Color(0, 0, 0) },
};
const WARM_A = new THREE.Color(1.0, 0.66, 0.36);      // tungsten-look string lights, about 2200 K
const WARM_B = new THREE.Color(1.0, 0.86, 0.68);      // 3000 K LED street and lot heads
const WARM_C = new THREE.Color(1.0, 0.78, 0.55);      // the Shed's pendants

export function glowify<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlowA = GLOW.a; sh.uniforms.uGlowB = GLOW.b; sh.uniforms.uGlowC = GLOW.c;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowA;\nuniform vec3 uGlowB;\nuniform vec3 uGlowC;\nvarying vec3 vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (vGlow.x * uGlowA + vGlow.y * uGlowB + vGlow.z * uGlowC);');
  };
  m.customProgramCacheKey = () => 'lot57-glow';
  return m;
}

export function makeMats(board: Parameters<typeof T.labelsAtlas>[0]) {
  const std = (o: THREE.MeshStandardMaterialParameters) => glowify(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
  const g = ground();
  const atlas = T.labelsAtlas(board);
  const reader = T.readerTex();
  const glowTex = T.glowTex(), blob = T.blobTex(), door = T.rollDoorTex();
  const poolMap = T.poolTex();                    // (one texture for both kinds of pool: P1d repair, the texture budget)
  const concreteMap = T.concreteTex(), turfMap = T.turfTex();          // each shared by two materials
  const brickMap = T.brickTex();
  // the business park's lit windows at night (the facade texture's window grid, a fifth of them lit)
  const facadeLit = T.facadeLitTex(); facadeLit.repeat.set(0.25, 0.25);
  const storefront = T.storefrontLitTex();
  const offset = <M extends THREE.Material>(m: M, f: number): M => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
  const m = {
    ground: new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, color: 0xa8a27e, roughness: 1 }),
    asphalt: offset(std({ map: T.asphaltTex(), roughness: 0.9 }), -1),
    concrete: std({ map: concreteMap, roughness: 0.86 }),
    pavers: offset(std({ map: T.paverTex(), roughness: 0.8 }), -2),
    turf: offset(std({ map: turfMap, roughness: 0.97 }), -2),
    grass: offset(std({ map: turfMap, roughness: 1 }), -1),
    // the block's landscaped setbacks: the same turf, under everything else (a weaker offset than the paving's), over
    // the ground plane (whose two 3.2 km triangles lose depth precision far off)
    parkway: offset(std({ map: turfMap, roughness: 1 }), -0.5),
    dirt: offset(std({ map: T.dirtTex(), roughness: 1 }), -1),
    marking: offset(std({ roughness: 0.65 }), -4),
    facade: std({ map: (P.mats as unknown as { facade?: (k: 0) => THREE.MeshStandardMaterial }).facade?.(0).map ?? T.tiltupTex(), roughness: 0.85, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 0 }),
    roof: std({ map: S.corrugatedTex(), roughness: 0.48, metalness: 0.55, envMapIntensity: 0.9 }),
    // the Shed: painted brick walls (P1d; the tilt-up panels before) and a corrugated, galvanised roof
    tilt: std({ map: S.paintedBrickTex(), roughness: 0.86 }),
    shedFloor: offset(std({ map: T.polishedTex(), roughness: 0.3, metalness: 0.0, envMapIntensity: 0.8 }), -2),
    deck: std({ map: T.deckTex(), roughness: 0.62, metalness: 0.35 }),
    block: std({ map: T.blockTex(), roughness: 0.9 }),
    // the Shed's inside: exposed brick behind the bar (the same brick as the planter wall, a little darker and warmer)
    brickInside: std({ map: brickMap, roughness: 0.88 }),
    // a painted wainscot and trim inside (patina green), gloss enamel
    enamel: std({ roughness: 0.35, metalness: 0.05 }),
    mural: std({ map: T.muralTex(), roughness: 0.82 }),
    wood: std({ map: T.woodTex(), roughness: 0.7 }),
    brick: std({ map: brickMap, roughness: 0.9 }),
    paint: std({ roughness: 0.42, metalness: 0.1 }),
    steel: std({ roughness: 0.5, metalness: 0.55 }),
    stainless: std({ roughness: 0.22, metalness: 0.92, envMapIntensity: 0.75 }),
    rubber: std({ roughness: 0.9 }),
    canvas: underside(std({ map: S.canvasWeaveTex(), roughness: 0.95, side: THREE.DoubleSide })),
    // P1d: gravel round the fire tables, brushed steel kegs, the corrugated awning over the roll-up doors
    gravel: offset(std({ map: S.gravelTex(), roughness: 1 }), -3),
    keg: std({ map: S.brushedTex(), roughness: 0.32, metalness: 0.85, envMapIntensity: 0.9 }),
    // the fire tables' flames: additive cards, lit when Lot 57 is open after dark (setNight), flickering (TICKS)
    fire: new THREE.MeshBasicMaterial({ map: S.flameTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }),
    // pools of light on the ground under the string lights, the heaters and the fire tables (the venue's own, so
    // only when it's open after dark), and oil stains on the lot's stalls
    poolVenue: new THREE.MeshBasicMaterial({ map: poolMap, color: 0xffc489, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    stain: new THREE.MeshBasicMaterial({ color: 0x0b0a09, alphaMap: S.stainTex(), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
    plant: std({ roughness: 0.85, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb6c0, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    doorGlass: new THREE.MeshStandardMaterial({ map: door, transparent: true, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    glazing: new THREE.MeshStandardMaterial({ color: 0x24323a, roughness: 0.1, metalness: 0.55, emissive: 0xffc98a, emissiveIntensity: 0 }),
    skylight: new THREE.MeshBasicMaterial({ color: 0xdfe8f0, fog: false }),
    bldGlass: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.1 })),
    // storefronts lit after dark (offices working late, a lobby): dark glass by day, a room's light at night
    litWarm: new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: 0.12, metalness: 0.55, emissive: 0xf2c48a, emissiveMap: storefront, emissiveIntensity: 0 }),
    litCool: new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: 0.12, metalness: 0.55, emissive: 0xb9cde6, emissiveMap: storefront, emissiveIntensity: 0 }),
    // the trucks' cab glass: tinted, opaque (nobody's in the cab), reflecting the sky
    cabGlass: new THREE.MeshStandardMaterial({ color: 0x121a20, roughness: 0.06, metalness: 0.7, envMapIntensity: 1.3 }),
    // the trucks' wheels (instanced by the page): tyres and polished rims
    tyre: new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }),
    rim: new THREE.MeshStandardMaterial({ color: 0xd9dbde, roughness: 0.22, metalness: 0.9, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    // our neon: a cream tube and a red one (behind the bar), lit whenever the taproom is open
    neonCream: new THREE.MeshBasicMaterial({ color: 0xfff1d0 }),
    neonRed: new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
    bulb: new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xffb664, emissiveIntensity: 0.4 }),
    flame: new THREE.MeshStandardMaterial({ color: 0x30140a, emissive: 0xff7a2a, emissiveIntensity: 0 }),
    lampHead: new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.4, metalness: 0.4, emissive: 0xffe6c4, emissiveIntensity: 0 }),
    window: new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.6, emissive: 0xffd2a0, emissiveIntensity: 0 }),
    sign: new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.45 }),
    // the corner pylon's cabinet: the same artwork, lit brighter (it has to carry across Orangewood at night)
    pylon: new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.4 }),
    screen: new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 }),
    labels: glowify(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6 })),
    labelsAlpha: glowify(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.75, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
    readerBoard: new THREE.MeshStandardMaterial({ map: reader.tex, emissiveMap: reader.tex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.5 }),
    chain: new THREE.MeshStandardMaterial({ map: T.chainTex(), alphaTest: 0.5, color: 0x9da2a6, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide }),
    wire: new THREE.LineBasicMaterial({ color: 0x17181a, transparent: true, opacity: 0.85 }),
    glow: new THREE.PointsMaterial({ map: glowTex, size: 0.9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffcf96, opacity: 0, fog: true }),
    lampGlow: new THREE.PointsMaterial({ map: glowTex, size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d8, opacity: 0 }),
    dots: new THREE.MeshBasicMaterial({ color: 0xf3e6c4, transparent: true, opacity: 0.7, depthWrite: false }),
    // the pool of light under each street and lot head after dark, laid on the asphalt (whose dark albedo swallows the
    // baked light): a soft additive disc, brightest under the head
    pool: new THREE.MeshBasicMaterial({ map: poolMap, color: 0xffe0b4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    blob: new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blob, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
    // the venue's olive and shade trees (trees.ts): painted sprigs on cut-out cards, and a fissured grey bark
    leaves: leafShading(glowify(new THREE.MeshStandardMaterial({ map: leafAtlas(), vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, envMapIntensity: 0.5 }))),
    bark: std({ map: barkTex(), roughness: 0.95 }),
    palmTrunk: P.mats.bark(),
    palmCrown: P.mats.frond(),
    foliage: P.mats.foliage(),
    trunk: P.mats.trunk(),
  };
  return { ...m, readerTex: reader, atlas, ultraMaps: null as null | Record<string, THREE.Texture>, detailMaps: null as null | Record<string, THREE.Texture> };
}

/**
 * Surface relief: normal maps painted in code from height fields. HD and Ultra put them on the yard's pavers, the
 * brick, the Shed's painted brick and block, its corrugated roof, the wood, the concrete, the asphalt, the gravel
 * and the umbrellas' canvas (Ultra a little stronger); Low (the retro look) has none. Made the first time they're
 * wanted. `on` is HD or Ultra; `ultra` the stronger relief.
 */
export function setUltraMaps(m: Mats, on: boolean, ultra = on) {
  if (on && !m.ultraMaps) m.ultraMaps = { pavers: T.paverNormal(), brick: T.brickNormal(), block: T.blockNormal() };
  if (on && !m.detailMaps) m.detailMaps = { painted: S.paintedBrickNormal(), corrugated: S.corrugatedNormal(), gravel: S.gravelNormal(), wood: S.woodNormal(), concrete: S.concreteNormal(), asphalt: S.asphaltNormal(), weave: S.canvasWeaveNormal() };
  const set = (mat: THREE.MeshStandardMaterial, tex: THREE.Texture | undefined, scale: number, repeat: THREE.Vector2) => {
    const want = on && tex ? tex : null, k = ultra ? scale : scale * 0.75;
    if (mat.normalMap === want && (!want || mat.normalScale.x === k)) return;
    mat.normalMap = want;
    if (want) { want.repeat.copy(repeat); mat.normalScale.set(k, k); }
    mat.needsUpdate = true;
  };
  const u = m.ultraMaps ?? {}, d = m.detailMaps ?? {};
  set(m.pavers, u.pavers, 0.9, m.pavers.map!.repeat);
  set(m.brick, u.brick, 0.8, m.brick.map!.repeat);
  set(m.brickInside, u.brick, 0.8, m.brickInside.map!.repeat);
  set(m.block, u.block, 0.6, m.block.map!.repeat);
  set(m.tilt, d.painted, 0.7, m.tilt.map!.repeat);
  set(m.roof, d.corrugated, 1.0, m.roof.map!.repeat);
  set(m.gravel, d.gravel, 1.0, m.gravel.map!.repeat);
  set(m.wood, d.wood, 0.5, m.wood.map!.repeat);
  set(m.concrete, d.concrete, 0.6, m.concrete.map!.repeat);
  set(m.asphalt, d.asphalt, 0.7, m.asphalt.map!.repeat);
  set(m.canvas, d.weave, 0.35, m.canvas.map!.repeat);
}
export type Mats = ReturnType<typeof makeMats>;

/** turn the night lighting up (k = 0 day .. 1 full night); open = the venue is open */
export function setNight(m: Mats, k: number, open: boolean) {
  const lit = open ? k : 0;
  GLOW.a.value.copy(WARM_A).multiplyScalar(lit * 0.42);
  GLOW.b.value.copy(WARM_B).multiplyScalar(k * 0.5);
  GLOW.c.value.copy(WARM_C).multiplyScalar(open ? 0.16 + k * 0.42 : k * 0.03);
  m.bulb.emissiveIntensity = 0.25 + lit * 7.5;
  m.glow.opacity = lit * 0.9;
  m.flame.emissiveIntensity = lit * 3.2;
  m.glazing.emissiveIntensity = open ? k * 1.1 : 0;
  m.skylight.color.setRGB(0.86, 0.9, 0.95).multiplyScalar(Math.max(0.035, 1 - k * 0.97));
  m.window.emissiveIntensity = open ? 0.6 + k * 1.6 : 0;
  m.sign.emissiveIntensity = 0.1 + k * 1.25;
  m.pylon.emissiveIntensity = 0.2 + k * 1.15;          // (P1d repair: 1.9 washed the cabinet's art out under bloom)
  m.readerBoard.emissiveIntensity = 0.2 + k * 1.6;
  // the business park after dark: a scattering of offices still lit, a few lobbies and storefronts
  m.facade.emissiveIntensity = k * 1.15;
  m.litWarm.emissiveIntensity = k * 1.1;
  m.litCool.emissiveIntensity = k * 0.9;
  m.rim.envMapIntensity = 1.1 - 0.6 * k;
  const neon = open ? 1 : 0.06;
  m.neonCream.color.setRGB(1, 0.945, 0.816).multiplyScalar(neon * (1.4 + k * 1.2));
  m.neonRed.color.setRGB(1, 0.35, 0.235).multiplyScalar(neon * (1.4 + k * 1.2));
  m.lampHead.emissiveIntensity = k * 5;
  m.lampGlow.opacity = k * 0.6;
  m.pool.opacity = k * 0.3;
  m.screen.emissiveIntensity = open ? 0.6 + k * 0.5 : 0.04;
  // P1d: the fire tables, the pools under the strings and heaters, the rim on the people
  m.fire.opacity = lit * 0.95;
  m.poolVenue.opacity = lit * 0.32;
  FIRE.lit = lit;
  // the rim: a cool sky edge by day, the strings' warm edge after dark (a little even when closed: the street lamps)
  RIM.value.setRGB(0.1, 0.12, 0.15).multiplyScalar(1 - k).add(_rim.setRGB(0.42, 0.26, 0.13).multiplyScalar(open ? k : k * 0.25));
}
const _rim = new THREE.Color();
/** the fire tables' flicker (the page's renderer calls TICKS each frame) */
const FIRE = { lit: 0, mat: null as THREE.MeshBasicMaterial | null };
export function flicker(m: Mats) {
  if (FIRE.mat === m.fire) return;           // (once per set of materials, however often the venue is built)
  FIRE.mat = m.fire;
  const tex = m.fire.map!;
  TICKS.push((t) => {
    if (FIRE.lit <= 0) return;
    // (reduced motion: a steady flame)
    if (typeof document !== 'undefined' && document.body.classList.contains('rm')) { m.fire.opacity = FIRE.lit * 0.9; tex.offset.x = 0; return; }
    const f = 0.82 + 0.1 * Math.sin(t * 13.1) + 0.06 * Math.sin(t * 23.7 + 1.3) + 0.04 * Math.sin(t * 41.9);
    m.fire.opacity = FIRE.lit * 0.95 * f;
    tex.offset.x = 0.012 * Math.sin(t * 7.3);
  });
}

// The page's materials, made once. Surfaces use the code-painted textures in tex.ts; most props are vertex-coloured
// so a family of them is one draw call. Night light is baked into each batch's "glow" attribute (geom.ts) and added
// to the emissive term by glowify(); setNight() sets the three channels' levels: the venue's own lights (string
// lights, heaters, truck windows: on when it's dark and Lot 57 is open), the street and lot lights (on when it's
// dark), and the Shed's interior lights (on while it's open, brighter after dark).
import * as THREE from 'three';
import * as T from './tex';
import * as P from '../../game/road/props';
import { ground } from '../../game/textures';

export type Quality = 'low' | 'high' | 'ultra';

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
  const concreteMap = T.concreteTex(), turfMap = T.turfTex();          // each shared by two materials
  const brickMap = T.brickTex();
  // the business park's lit windows at night (the facade texture's window grid, a fifth of them lit)
  const facadeLit = T.facadeLitTex(); facadeLit.repeat.set(0.25, 0.25);
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
    facade: std({ map: P.mats.facade(0).map, roughness: 0.85, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 0 }),
    roof: std({ roughness: 0.92 }),
    tilt: std({ map: T.tiltupTex(), roughness: 0.88 }),
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
    canvas: std({ roughness: 0.95, side: THREE.DoubleSide }),
    plant: std({ roughness: 0.85, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb6c0, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    doorGlass: new THREE.MeshStandardMaterial({ map: door, transparent: true, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    glazing: new THREE.MeshStandardMaterial({ color: 0x24323a, roughness: 0.1, metalness: 0.55, emissive: 0xffc98a, emissiveIntensity: 0 }),
    skylight: new THREE.MeshBasicMaterial({ color: 0xdfe8f0, fog: false }),
    bldGlass: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.1 })),
    // storefronts lit after dark (offices working late, a lobby): dark glass by day, a room's light at night
    litWarm: new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: 0.12, metalness: 0.55, emissive: 0xffd9a0, emissiveIntensity: 0 }),
    litCool: new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: 0.12, metalness: 0.55, emissive: 0xd6e6ff, emissiveIntensity: 0 }),
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
    blob: new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blob, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
    palmTrunk: P.mats.bark(),
    palmCrown: P.mats.frond(),
    foliage: P.mats.foliage(),
    trunk: P.mats.trunk(),
  };
  return { ...m, readerTex: reader, atlas, ultraMaps: null as null | Record<string, THREE.Texture> };
}

/**
 * Ultra's extra surface detail: normal maps (painted in code from height fields) on the yard's pavers, the brick and
 * the Shed's block, made the first time Ultra is chosen; off on the other presets.
 */
export function setUltraMaps(m: Mats, on: boolean) {
  if (on && !m.ultraMaps) m.ultraMaps = { pavers: T.paverNormal(), brick: T.brickNormal(), block: T.blockNormal() };
  const set = (mat: THREE.MeshStandardMaterial, tex: THREE.Texture | undefined, scale: number, repeat: THREE.Vector2) => {
    const want = on && tex ? tex : null;
    if (mat.normalMap === want) return;
    mat.normalMap = want;
    if (want) { want.repeat.copy(repeat); mat.normalScale.set(scale, scale); }
    mat.needsUpdate = true;
  };
  const u = m.ultraMaps ?? {};
  set(m.pavers, u.pavers, 0.9, m.pavers.map!.repeat);
  set(m.brick, u.brick, 0.8, m.brick.map!.repeat);
  set(m.brickInside, u.brick, 0.8, m.brickInside.map!.repeat);
  set(m.block, u.block, 0.6, m.block.map!.repeat);
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
  m.pylon.emissiveIntensity = 0.2 + k * 2.6;
  m.readerBoard.emissiveIntensity = 0.2 + k * 1.6;
  // the business park after dark: a scattering of offices still lit, a few lobbies and storefronts
  m.facade.emissiveIntensity = k * 1.15;
  m.litWarm.emissiveIntensity = k * 1.5;
  m.litCool.emissiveIntensity = k * 1.25;
  const neon = open ? 1 : 0.06;
  m.neonCream.color.setRGB(1, 0.945, 0.816).multiplyScalar(neon * (1.4 + k * 1.2));
  m.neonRed.color.setRGB(1, 0.35, 0.235).multiplyScalar(neon * (1.4 + k * 1.2));
  m.lampHead.emissiveIntensity = k * 5;
  m.lampGlow.opacity = k * 0.6;
  m.screen.emissiveIntensity = open ? 0.6 + k * 0.5 : 0.04;
}

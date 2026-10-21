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
  const offset = <M extends THREE.Material>(m: M, f: number): M => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
  const m = {
    ground: new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, color: 0xa8a27e, roughness: 1 }),
    asphalt: offset(std({ map: T.asphaltTex(), roughness: 0.9 }), -1),
    concrete: std({ map: T.concreteTex(), roughness: 0.86 }),
    pavers: offset(std({ map: T.paverTex(), roughness: 0.8 }), -2),
    turf: offset(std({ map: T.turfTex(), roughness: 0.97 }), -2),
    grass: offset(std({ map: T.turfTex(), roughness: 1 }), -1),
    dirt: offset(std({ map: T.dirtTex(), roughness: 1 }), -1),
    marking: offset(std({ roughness: 0.65 }), -4),
    facade: std({ map: P.mats.facade(0).map, roughness: 0.85 }),
    roof: std({ roughness: 0.92 }),
    tilt: std({ map: T.tiltupTex(), roughness: 0.88 }),
    shedFloor: offset(std({ map: T.concreteTex(), roughness: 0.28, metalness: 0.0 }), -2),
    wood: std({ map: T.woodTex(), roughness: 0.7 }),
    brick: std({ map: T.brickTex(), roughness: 0.9 }),
    paint: std({ roughness: 0.42, metalness: 0.1 }),
    steel: std({ roughness: 0.5, metalness: 0.55 }),
    stainless: std({ roughness: 0.22, metalness: 0.92, envMapIntensity: 0.75 }),
    rubber: std({ roughness: 0.9 }),
    canvas: std({ roughness: 0.95, side: THREE.DoubleSide }),
    plant: std({ roughness: 0.85, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb6c0, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    doorGlass: new THREE.MeshStandardMaterial({ map: door, transparent: true, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    glazing: new THREE.MeshStandardMaterial({ color: 0x24323a, roughness: 0.1, metalness: 0.55, emissive: 0xffc98a, emissiveIntensity: 0 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xffb664, emissiveIntensity: 0.4 }),
    flame: new THREE.MeshStandardMaterial({ color: 0x30140a, emissive: 0xff7a2a, emissiveIntensity: 0 }),
    lampHead: new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.4, metalness: 0.4, emissive: 0xffe6c4, emissiveIntensity: 0 }),
    window: new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.6, emissive: 0xffd2a0, emissiveIntensity: 0 }),
    sign: new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.45 }),
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
  return { ...m, readerTex: reader, atlas };
}
export type Mats = ReturnType<typeof makeMats>;

/** turn the night lighting up (k = 0 day .. 1 full night); open = the venue is open */
export function setNight(m: Mats, k: number, open: boolean) {
  const lit = open ? k : 0;
  GLOW.a.value.copy(WARM_A).multiplyScalar(lit * 0.42);
  GLOW.b.value.copy(WARM_B).multiplyScalar(k * 0.5);
  GLOW.c.value.copy(WARM_C).multiplyScalar(open ? 0.12 + k * 0.32 : k * 0.03);
  m.bulb.emissiveIntensity = 0.25 + lit * 7.5;
  m.glow.opacity = lit * 0.9;
  m.flame.emissiveIntensity = lit * 3.2;
  m.glazing.emissiveIntensity = open ? 0.15 + k * 1.1 : 0;
  m.window.emissiveIntensity = open ? 0.6 + k * 2.4 : 0;
  m.sign.emissiveIntensity = 0.1 + k * 1.25;
  m.readerBoard.emissiveIntensity = 0.15 + k * 1.1;
  m.lampHead.emissiveIntensity = k * 5;
  m.lampGlow.opacity = k * 0.6;
  m.screen.emissiveIntensity = open ? 0.6 + k * 0.5 : 0.04;
}

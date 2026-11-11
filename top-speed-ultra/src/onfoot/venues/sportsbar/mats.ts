// Stoppage Time's materials, made once (the module map's mats.ts row: the bar never calls Lot 57's makeMats, which
// would build Lot 57's sign atlas and reader board). Surfaces use Lot 57's generic code-painted textures; props are
// vertex-coloured so a family of them is one draw call. Night light is baked per vertex (engine/geom.ts) on three
// channels: a the venue's own lights (the pergola, the facade's halo, the blade sign), b the street and lot lights,
// c the interior; setBarNight() sets their levels.
import * as THREE from 'three';
import * as T from '../../engine/tex';
import { GLOW, glowify } from '../../engine/mats';
import * as Props from '../../../game/road/props';
import { ground } from '../../../game/textures';
import { wordmarkTex, bladeTex, testCardTex, signsAtlas, barFloorTex, barConcreteTex } from './tex';
import { streakTex, type StreetMats } from '../../engine/streets';

const WARM_A = new THREE.Color(1.0, 0.7, 0.42);      // the pergola's warm linear lights, about 2400 K
const WARM_B = new THREE.Color(1.0, 0.86, 0.68);     // 3000 K LED street and lot heads
const WARM_C = new THREE.Color(1.0, 0.8, 0.6);       // 2700 K pendants inside

export function makeBarMats() {
  const std = (o: THREE.MeshStandardMaterialParameters) => glowify(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
  const offset = <M extends THREE.Material>(m: M, f: number): M => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
  const g = ground();
  const concreteMap = barConcreteTex();                // (S4's second repair: the bar's own, finer grain)
  const blade = bladeTex(), card = testCardTex(), atlas = signsAtlas(), word = wordmarkTex();
  const m = {
    // the ground plane under everything (one 3200 m quad) is pushed back in depth: the lot's asphalt lies 4.2 cm over
    // it, and a triangle that large rasterises with depth error enough, at some views, to draw the ground over the
    // asphalt (seen at 844x390 on Low, S1)
    ground: offset(new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, color: 0xa29c84, roughness: 1 }), 4),
    asphalt: offset(std({ map: T.asphaltTex(), roughness: 0.9 }), -1),
    concrete: std({ map: concreteMap, roughness: 0.86 }),
    marking: offset(std({ roughness: 0.65 }), -4),
    tilt: std({ map: T.tiltupTex(), roughness: 0.88 }),
    plainWall: std({ roughness: 0.9 }),
    roofs: std({ roughness: 0.92 }),
    bldGlass: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.1 })),
    steel: std({ roughness: 0.5, metalness: 0.55 }),
    lampHead: new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.4, metalness: 0.4, emissive: 0xffe6c4, emissiveIntensity: 0, vertexColors: true }),
    farGlow: new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.4, metalness: 0.4, emissive: 0xffe6c4, emissiveIntensity: 0 }),
    chain: new THREE.MeshStandardMaterial({ map: T.chainTex(), alphaTest: 0.5, color: 0x9da2a6, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide }),
    wire: new THREE.LineBasicMaterial({ color: 0x17181a, transparent: true, opacity: 0.85 }),
    rail: std({ roughness: 0.8 }),
    landuse: offset(std({ map: T.turfTex(), roughness: 1 }), -0.5),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.2 }),
    walls: std({ map: T.blockTex(), roughness: 0.9 }),
    far: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    // the bar
    floor: offset(std({ map: barFloorTex(), roughness: 0.3, envMapIntensity: 0.8, color: 0xb9b4ac }), -2),          // (S4's second repair: the bar's own, cleaner floor map)
    inlay: offset(new THREE.MeshStandardMaterial({ color: 0xf1efe7, roughness: 0.5 }), -6),
    oak: std({ map: T.woodTex(), roughness: 0.55 }),
    vinyl: std({ roughness: 0.42, metalness: 0.0 }),
    cloth: std({ roughness: 0.95 }),
    paint: std({ roughness: 0.62, metalness: 0.05 }),
    // the ceiling (S4's second repair: matte and less lit by the sky's environment, so it sits below the lights)
    interior: std({ roughness: 0.95, envMapIntensity: 0.35 }),
    facade: std({ map: concreteMap, roughness: 0.82 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8fa8b8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    doorLeaf: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.15, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide }),
    screen: new THREE.MeshStandardMaterial({ map: card, emissiveMap: card, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.3 }),
    signs: glowify(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.7 })),
    signsLit: new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5 }),
    exitSign: new THREE.MeshBasicMaterial({ map: atlas, color: 0xffffff }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff }),
    wordmark: new THREE.MeshStandardMaterial({ map: word, emissiveMap: word, emissive: 0xffffff, emissiveIntensity: 0.1, transparent: true, alphaTest: 0.05, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    blade: new THREE.MeshStandardMaterial({ map: blade.tex, emissiveMap: blade.tex, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.5 }),
    plant: std({ roughness: 0.85, side: THREE.DoubleSide }),
    flame: new THREE.MeshStandardMaterial({ color: 0x30140a, emissive: 0xff7a2a, emissiveIntensity: 0 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x2a2833, roughness: 0.4, metalness: 0.5, emissive: 0xffd9a8, emissiveIntensity: 0, vertexColors: true }),
    window: new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.2, metalness: 0.5, emissive: 0xffd2a0, emissiveIntensity: 0, vertexColors: true }),
    glow: new THREE.PointsMaterial({ map: T.glowTex(), size: 2.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d8, opacity: 0 }),
    pool: new THREE.MeshBasicMaterial({ map: T.poolTex(), color: 0xffe0b4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    blob: new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: T.blobTex(), transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
    dots: new THREE.MeshBasicMaterial({ color: 0xc3f23a, transparent: true, opacity: 0.7, depthWrite: false }),
    // the I-5's lamps: soft streaks (S4's repair; their brightness by mode is look.ts's)
    streamHead: new THREE.MeshBasicMaterial({ color: 0xfff4dc, alphaMap: streakTex(), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    streamTail: new THREE.MeshBasicMaterial({ color: 0xff3020, alphaMap: streakTex(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    standin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }),
    palmTrunk: Props.mats.bark(), palmCrown: Props.mats.frond(), foliage: Props.mats.foliage(), trunk: Props.mats.trunk(),
  };
  m.glass.envMapIntensity = 1.2;
  // three.js draws a double-sided transparent material in two passes (back faces, then front) unless told not to: one
  // pass is enough for thin glass, and it halves these meshes' calls
  m.glass.forceSinglePass = true; m.doorLeaf.forceSinglePass = true;
  return { ...m, bladeSign: blade };
}
export type BarMats = ReturnType<typeof makeBarMats>;

export function streetMats(m: BarMats): StreetMats {
  return { roads: m.asphalt, walk: m.concrete, markings: m.marking, tilt: m.tilt, glass: m.bldGlass, roofs: m.roofs, plain: m.plainWall, steel: m.steel, lampHeads: m.lampHead, chain: m.chain, wires: m.wire, rail: m.rail, landuse: m.landuse, water: m.water, walls: m.walls, far: m.far, farGlow: m.farGlow };
}

/** the night lighting (k = 0 day .. 1 full night); open = the bar is open. Closed, the bar is dark but the exit signs */
export function setBarNight(m: BarMats, k: number, open: boolean) {
  // the venue's own lights (S4's repair: the pergola up from 0.5, so the patio at night reads past the rail)
  GLOW.a.value.copy(WARM_A).multiplyScalar(open ? k * 0.78 : 0);
  GLOW.b.value.copy(WARM_B).multiplyScalar(k * 0.5);
  GLOW.c.value.copy(WARM_C).multiplyScalar(open ? 0.26 + k * 0.42 : 0);
  m.lampHead.emissiveIntensity = k * 5; m.farGlow.emissiveIntensity = k * 5;
  m.lamp.emissiveIntensity = open ? 2.2 + k * 2 : 0;
  m.screen.emissiveIntensity = open ? 0.75 + k * 0.25 : 0;
  m.screen.color.setScalar(open ? 1 : 0.04);
  m.signsLit.emissiveIntensity = open ? 0.35 + k * 0.5 : 0.02;
  m.neon.color.setScalar(open ? 1.3 + k * 1.2 : 0.05);
  m.wordmark.emissiveIntensity = 0.08 + k * 1.6;
  m.blade.emissiveIntensity = 0.3 + k * 1.4;
  m.flame.emissiveIntensity = open ? k * 3.2 : 0;
  m.window.emissiveIntensity = k * 0.9;
  m.glow.opacity = k * 0.55;
  m.pool.opacity = k * 0.42;
}

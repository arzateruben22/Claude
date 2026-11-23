// buildPerson: one adult, skinned to a skeleton, with level-of-detail meshes built on demand.
//   LOD 0 (conversation): body 12 mm, head 2.5 mm (3.5 on 'phone'), hands 3.5 mm, eyelids, eyeballs, lashes, brows,
//         teeth, clothes shells, hair cards. LOD 1 (patio): one combined mesh ~22 mm with the head at 6 mm, vertex
//         colours, plus hair cards. LOD 2 (far): one combined mesh ~45 mm.
import * as THREE from 'three';
import { buildRig, Rig, B } from './body';
import { makeSkeleton } from './skeleton';
import { aabbBox, fieldBounds, meshPart, skinWeights, skinWeightsF, bakeAO, buildGeometry, side, dropTris, clipByRegion } from './geo';
import { buildGarments, GarmentBuild, isShoe, isBottom, lightSole } from './garments';
import { clothMaterial } from './cloth';
import { buildHairVolume, HairBuild, growCards, hairCapMaterial, buildBeardVolume, capBandY, hairSpec } from './hair';
import { LodField, Look2, Cover, Extra, reduced, paint, lodMaterial, splitLooks } from './lod';
import { Field } from './field';
import { buildAccessories } from './acc';
import { cardMaterial, hairTexture } from './cards';
import { skinMaterial, SkinMaterial } from './skin';
import { Animator, AnimName } from './anim';
import { PersonOptions, Quality } from './params';
import { V3, clamp, DEG, lerp, smooth } from './math';
import { faceMasks, softScalp } from './masks';
import { MORPHS, MI, FaceController, buildLids, buildLashes, buildBrows, buildTeeth, buildEyes, morphDeltas, EyeParts } from './face';

export interface Person {
  group: THREE.Group;
  options: PersonOptions;
  rig: Rig;
  setExpression(name: string, weight?: number): void;
  say(line: string, seconds: number): void;
  lookAt(target: THREE.Vector3 | null): void;
  play(anim: AnimName): void;
  update(dt: number): void;
  setLod(n: 0 | 1 | 2): void;
  /** world position of a point between the eyes (for cameras) */
  eyes(out?: THREE.Vector3): THREE.Vector3;
  stats(): { lod: number; tris: number; calls: number; buildMs: Record<string, number> };
  dispose(): void;
}

interface FaceMesh { mesh: THREE.SkinnedMesh; map: number[] }

/** a skinned mesh whose every vertex follows one bone */
function rigidSkinned(pos: ArrayLike<number>, idx: ArrayLike<number>, bone: number, mat: THREE.Material, extra: (g: THREE.BufferGeometry) => void = () => {}) {
  const g = new THREE.BufferGeometry();
  const n = pos.length / 3;
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { si[v * 4] = bone; sw[v * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(Array.from(idx));
  extra(g);
  if (!g.attributes.normal) g.computeVertexNormals();
  return new THREE.SkinnedMesh(g, mat);
}

/** attach morph targets (body-frame deltas), keeping only the non-zero ones */
function setMorphs(g: THREE.BufferGeometry, deltas: Float32Array[], normals = false): number[] {
  const map: number[] = [], attrs: THREE.BufferAttribute[] = [];
  deltas.forEach((d, e) => {
    let nz = false;
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 1e-7) { nz = true; break; }
    if (!nz) return;
    map.push(e); attrs.push(new THREE.BufferAttribute(d, 3));
  });
  if (attrs.length) { g.morphAttributes.position = attrs; g.morphTargetsRelative = true; }
  // morph normals (relative): a closed lid or a smiling cheek is shaded as its new shape, not its rest shape
  if (normals && attrs.length && g.index) {
    const base = g.attributes.position.array as Float32Array, tmp = new THREE.BufferGeometry();
    tmp.setIndex(g.index);
    const triN = (p: Float32Array) => { tmp.setAttribute('position', new THREE.BufferAttribute(p, 3)); tmp.deleteAttribute('normal'); tmp.computeVertexNormals(); return tmp.attributes.normal.array as Float32Array; };
    const n0 = Float32Array.from(triN(Float32Array.from(base)));
    g.morphAttributes.normal = attrs.map((a) => {
      const p = new Float32Array(base.length), d = a.array as Float32Array;
      for (let i = 0; i < p.length; i++) p[i] = base[i] + d[i];
      const n1 = triN(p), o2 = new Float32Array(p.length);
      for (let i = 0; i < p.length; i++) o2[i] = n1[i] - n0[i];
      return new THREE.BufferAttribute(o2, 3);
    });
    tmp.dispose();
  }
  return map;
}

export function buildPerson(o: PersonOptions): Person {
  const quality: Quality = o.quality ?? 'high';
  const t0 = performance.now();
  const shoes = o.outfit.find((g) => isShoe(g.kind));
  // (the cast's low heels lift 4.5 cm; every other shoe as before)
  // (the pack's stilettos lift 9.5 cm; its lace-up shoes have a 2 cm heel)
  const heel = shoes?.kind === 'heels' ? 0.07 * (o.body.height / 1.65) : shoes?.kind === 'lowHeels' ? 0.045 * (o.body.height / 1.65) : shoes?.kind === 'stilettos' ? 0.095 * (o.body.height / 1.65) : shoes?.kind === 'oxfords' ? 0.02 * (o.body.height / 1.75) : 0;
  // (graphics pass) the pack's stilettos and the cast's low heels: the toes flat on the ground, the foot bent at its ball
  const rig = buildRig(o.body, o.face, heel, shoes?.kind === 'stilettos' || shoes?.kind === 'lowHeels');
  const sk = makeSkeleton(rig);
  const group = new THREE.Group();
  group.name = o.name ?? `person-${o.seed}`;
  group.add(sk.root);
  const buildMs: Record<string, number> = { rig: Math.round(performance.now() - t0) };
  const anim = new Animator(rig, o.body, o.seed);
  const face = new FaceController(o.seed);
  const lods: (THREE.Group | null)[] = [null, null, null];
  const faceMeshes: FaceMesh[][] = [[], [], []];
  let eyes: EyeParts | null = null;
  let lod = -1;
  const hf = rig.head;
  const male = o.body.sex === 'm';
  const fh = o.look.facialHair;
  const beardAmt = !male ? 0 : fh === 'beard' || fh === 'fullBeard' ? 1 : fh === 'goatee' || fh === 'moustache' ? 0.9 : fh === 'stubble' ? Math.min(0.84, o.look.stubbleAmt ?? 0.75) : fh === 'lightStubble' ? 0.42 : 0.22 * (o.look.beardShadow ?? 1);
  const skinLook = { tone: o.look.skin, lipstick: o.look.lipstick, blush: o.look.blush, beard: beardAmt, beardColor: o.look.hairColor, liner: o.look.liner, hairColor: o.look.hairColor, freckles: o.look.freckles, age: o.body.age, male, soft: o.look.softShade ?? 0, softHair: (() => { const sp = hairSpec(o.look.hair, male); return !!sp?.soft && !sp.ring; })() };   // (cast fx5 r1: a feathered style's soft hairline on the skin)
  let bodyMat: SkinMaterial | null = null, faceMat: SkinMaterial | null = null;
  const mats: THREE.Material[] = [];
  const getBodyMat = () => (bodyMat ??= skinMaterial(skinLook, quality, 'body'));
  const getFaceMat = () => {
    if (!faceMat) {
      faceMat = skinMaterial(skinLook, quality, 'face');
      const u = faceMat.uniformsRef;
      (u.uHeadO.value as THREE.Vector3).set(hf.o[0], hf.o[1], hf.o[2]);
      (u.uHeadS.value as THREE.Vector3).set(hf.sx, hf.sy, hf.sz);
      (u.uLipP.value as THREE.Vector4).set(hf.mouth.y, 0.026 * o.face.mouthW, o.face.lipUpper, o.face.lipLower);
      // (w: the scar through the right brow, Look.scar 'browR'; 0 for everyone else, as before)
      (u.uFaceP.value as THREE.Vector4).set(hf.eye.x, hf.nose.tip[1], hf.old, o.look.scar === 'browR' ? 1 : 0);   // for the per-pixel folds and under-eye bags
    }
    return faceMat;
  };
  const tattooOf = (si: Uint16Array, sw: Float32Array, v: number) => {
    const t = o.look.tattoo;
    if (t === 'none') return 0;
    const bones = t === 'sleeveL' ? [B.armL, B.foreL] : t === 'forearmR' ? [B.foreR] : [B.foreL];
    let w = 0;
    for (let k = 0; k < 4; k++) if (bones.includes(si[v * 4 + k])) w += sw[v * 4 + k];
    return clamp((w - 0.5) * 2.5);
  };

  // ---------------------------------------------------------------- clothes
  let garments: GarmentBuild[] | null = null;
  const getGarments = () => (garments ??= buildGarments(rig, o.body, o.outfit));
  /** body vertices hidden under an opaque garment (more than `margin` inside its region, on a bone it covers) */
  const covered = (pos: Float32Array, si: Uint16Array, margin = 0.022) => {
    const nv = pos.length / 3, gone = new Uint8Array(nv), gs = getGarments();
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], b = si[v * 4];
      for (const gb of gs) if (gb.g.kind !== 'sandals' && gb.bones.has(b) && gb.keep(x, y, z) < -(isShoe(gb.g.kind) ? 0.012 : margin)) { gone[v] = 1; break; }   // (a sandal hides none of the foot: with the footbed kept whole, the skin cut away inside it left a gap round the toes)
    }
    return gone;
  };
  const clothMesh = (gb: GarmentBuild) => {
    const h = gb.h * (quality === 'high' ? 1 : 1.6);
    const sdf = gb.sdf, A = sdf.A, X = sdf.X;
    const { mesh } = meshPart(sdf, aabbBox(gb.box[0], gb.box[1], h), h);
    // clip the shell to the garment's region: exact edges along the hems, sleeves, necklines and straps
    const cl = clipByRegion(mesh.pos, mesh.nrm, mesh.idx, gb.keep);
    // the cut edge turned in toward the body: a band as deep as the shell's ease, so every hem has a thickness
    const band = isShoe(gb.g.kind) ? 0 : sdf.t * 0.85;
    let P = cl.pos, NR = cl.nrm, idx = cl.idx, SRC = cl.src;
    if (band > 0 && cl.edges.length) {
      const nv0 = P.length / 3, ne = cl.edges.length / 2;
      const P2 = new Float32Array((nv0 + ne * 2) * 3), N2 = new Float32Array((nv0 + ne * 2) * 3), S2 = new Int32Array(nv0 + ne * 2);
      P2.set(P); N2.set(NR); S2.set(SRC);
      const I2: number[] = Array.from(idx);
      const e = 0.0015, rg = gb.keep;
      for (let k = 0; k < ne; k++) {
        const a = cl.edges[k * 2], b = cl.edges[k * 2 + 1], a2 = nv0 + k * 2, b2 = a2 + 1;
        for (const [src, dst] of [[a, a2], [b, b2]]) {
          const x = P[src * 3], y = P[src * 3 + 1], z = P[src * 3 + 2];
          P2[dst * 3] = x - NR[src * 3] * band; P2[dst * 3 + 1] = y - NR[src * 3 + 1] * band; P2[dst * 3 + 2] = z - NR[src * 3 + 2] * band;
          const r0 = rg(x, y, z), g: V3 = [rg(x + e, y, z) - r0, rg(x, y + e, z) - r0, rg(x, y, z + e) - r0];
          const gl = Math.hypot(g[0], g[1], g[2]) || 1;
          for (let c = 0; c < 3; c++) { N2[dst * 3 + c] = g[c] / gl; N2[src * 3 + c] = N2[src * 3 + c]; }
          S2[dst] = SRC[src];
        }
        I2.push(b, a, a2, b, a2, b2);
      }
      P = P2; NR = N2; SRC = S2; idx = Uint32Array.from(I2);
    }
    // weights against the body parts it was made from (and the collar band)
    const cache = new Map<number, Int32Array[]>();
    const actOf = (v: number, fi: number) => {
      const bl = mesh.vblock[SRC[v]];
      let e = cache.get(bl);
      if (!e) {
        const a = mesh.act[bl];
        const la: number[] = [], lx: number[] = [];
        if (a) for (const i of a) { if (i < A.n) la.push(i); else if (X && i < A.n + X.n) lx.push(i - A.n); }
        e = [Int32Array.from(la), Int32Array.from(lx)];
        cache.set(bl, e);
      }
      return e[fi];
    };
    const legless = gb.g.kind === 'dress' || gb.g.kind === 'skirt' ? new Set([B.shinL, B.shinR, B.footL, B.footR]) : undefined;
    const blk = (v: number) => mesh.vblock[SRC[v]];
    const { si, sw } = skinWeightsF(rig, X ? [A, X] : [A], P, (v, fi) => (mesh.act[blk(v)] ? actOf(v, fi) : null), gb.sigma, legless);
    const act = (v: number) => mesh.act[blk(v)];
    const ao = bakeAO(sdf, P, NR, act, 0.012, 0.035);
    const nv = P.length / 3, aCloth = new Float32Array(nv * 4), aFold = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      aCloth[v * 4] = gb.accent ? gb.accent(x, y, z) : 0;
      aCloth[v * 4 + 1] = clamp(-gb.keep(x, y, z), 0, 0.05);
      aCloth[v * 4 + 2] = ao[v];
      aCloth[v * 4 + 3] = gb.wear ? gb.wear([x, y, z]) : 0;
      for (const f of gb.folds) {
        if (f.w <= 0) continue;
        const d2 = (x - f.c[0]) ** 2 + (y - f.c[1]) ** 2 + (z - f.c[2]) ** 2, w = f.w * Math.exp(-d2 / (f.r * f.r));
        aFold[v * 4] += f.ax[0] * w; aFold[v * 4 + 1] += f.ax[1] * w; aFold[v * 4 + 2] += f.ax[2] * w;
      }
    }
    // (pack, 2026-11-12) under a closed suit jacket: the shirt's triangles well inside the jacket's region are left
    // out. Two shells 7 mm apart, each meshed at about a centimetre, cross in the armpit's crease, and the shirt showed
    // through the jacket there; what the jacket's openings show (the collar, the cuffs, the hem) stays
    if (gb.layer < 3 && !isShoe(gb.g.kind) && !isBottom(gb.g.kind)) {
      const over = getGarments().find((x) => x.g.kind === 'suitJacket' || (x.layer === 3 && !!x.g.tailored && x !== gb));   // (and any tailored outer layer, graphics pass)
      if (over) {
        const gone = new Uint8Array(nv);
        const mIn = over.g.open && o.look.cleanLod ? -0.007 : -0.018;   // (repair 2026-11-16: under an open overshirt the tee is cut 7 mm inside its edge; at 18 mm the tee's chest came through the shirt's fronts beside the collar as white patches)
        // (and where the top stands outside the outer layer's own surface, inside its region, it is hidden: the tee's shoulders came through an open shirt's fronts beside the collar)
        const poke = !!o.look.cleanLod && over.g.kind !== 'suitJacket';
        const collarY = rig.joints[B.neck][1] - 0.08 * rig.s;
        for (let v = 0; v < nv; v++) { const kv = over.keep(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); gone[v] = kv < mIn || (poke && kv < -0.0015 && (over.sdf.eval(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], null, 0) > -0.002 || (!!over.g.open && P[v * 3 + 1] > collarY))) ? 1 : 0; }   // (and round the collar, where the collar's leaves lie over the fronts, nothing of the top inside the shirt's region shows)
        idx = dropTris(idx, gone);
      }
    }
    const geo = buildGeometry(P, NR, idx, si, sw, { aCloth: { a: aCloth, n: 4 }, aFold: { a: aFold, n: 4 } });
    const sole = lightSole(gb.g.kind) ? (gb.g.accent ?? 0xf2f2f0) : new THREE.Color(gb.g.color).multiplyScalar(0.55).getHex();
    const mat = clothMaterial(gb.g.color, gb.g.fabric, quality, isShoe(gb.g.kind) ? sole : (gb.g.accent ?? gb.g.color));
    mats.push(mat);
    const m = new THREE.SkinnedMesh(geo.geo, mat);
    m.name = 'cloth-' + gb.g.kind;
    return m;
  };
  const collarMesh = (gb: GarmentBuild, mat: THREE.Material) => {
    const c = gb.collar!, nv = c.pos.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3));
    g.setAttribute('aRest', new THREE.BufferAttribute(c.pos.slice(), 3));
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), aCloth = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      si[v * 4] = B.neck; sw[v * 4] = c.neckW[v]; si[v * 4 + 1] = B.chest; sw[v * 4 + 1] = 1 - c.neckW[v];
      aCloth[v * 4 + 1] = c.edge[v]; aCloth[v * 4 + 2] = 0.9;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setAttribute('aCloth', new THREE.BufferAttribute(aCloth, 4));
    g.setAttribute('aFold', new THREE.BufferAttribute(new Float32Array(nv * 4), 4));
    g.setIndex(c.idx);
    g.computeVertexNormals();
    const m = new THREE.SkinnedMesh(g, mat);
    m.name = 'collar';
    return m;
  };

  // ---------------------------------------------------------------- hair
  let hairVol: HairBuild | null | undefined;
  const getHair = () => (hairVol === undefined ? (hairVol = buildHairVolume(rig, o.look)) : hairVol);
  const hairWeights = (hb: HairBuild, P: Float32Array) => {
    const nv = P.length / 3, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const w = hb.headW([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
      si[v * 4] = B.head; sw[v * 4] = w[0]; si[v * 4 + 1] = B.neck; sw[v * 4 + 1] = w[1]; si[v * 4 + 2] = B.chest; sw[v * 4 + 2] = w[2];
    }
    return { si, sw };
  };
  const hairMeshes = (): THREE.Mesh[] => {
    const hb = getHair();
    if (!hb) return [];
    const th = performance.now();
    const h = (quality === 'high' ? 0.0042 : 0.0068) * (hb.sp.meshK ?? 1);
    const { mesh } = meshPart(hb.sdf, aabbBox(hb.box[0], hb.box[1], h), h);
    const cl = clipByRegion(mesh.pos, mesh.nrm, mesh.idx, (x, y, z) => hb.sdf.keep(x, y, z));
    const act = (v: number) => mesh.act[mesh.vblock[cl.src[v]]];
    const ao = bakeAO(hb.sdf, cl.pos, cl.nrm, act, 0.006, 0.02);
    const nv = cl.pos.length / 3, flow = new Float32Array(nv * 3), edge = new Float32Array(nv);
    const roots: V3[] = [], edgeRoots: V3[] = [];
    for (let v = 0; v < nv; v++) {
      const p: V3 = [cl.pos[v * 3], cl.pos[v * 3 + 1], cl.pos[v * 3 + 2]];
      flow.set(hb.flow(p), v * 3);
      edge[v] = clamp(-hb.sdf.keep(p[0], p[1], p[2]) / 0.013);   // 0 at the hairline (and a curtain's edges and ends), 1 well inside
      if (hb.sdf.keep(p[0], p[1], p[2]) < -0.005) roots.push(p);
      if (edge[v] > 0.12 && edge[v] < 0.5) edgeRoots.push(p);
      // (big curls, graphics pass) how far out on its clump the vertex is, carried in the occlusion attribute's whole part
      // (ao stays under 2 in its fraction; the cap's shader splits them), so no other hair mesh needs a new attribute
      const tip = hb.sdf.tipAt(p[0], p[1], p[2]);
      if (hb.sp.soft && !hb.sp.ring) ao[v] = 0.45 + 0.55 * ao[v];   // (repair 2026-11-16, smooth feathered hair: a floor under the baked shade, so the creases where the fall meets the scalp's hair are soft folds and not black cracks)
      if (tip > 0) ao[v] = Math.min(ao[v], 0.999) + 2 * Math.round(tip * 100);
    }
    const { si, sw } = hairWeights(hb, cl.pos);
    // (fifth pass, ringlet clumps) each vertex's offset from its clump's axis, for the cap shader to wind the strands round
    const capAttr: Record<string, { a: Float32Array; n: number }> = { aFlow: { a: flow, n: 3 }, aAo: { a: ao, n: 1 }, aEdge: { a: edge, n: 1 } };
    if (hb.sp.ring) {
      const ring = new Float32Array(nv * 4);
      for (let v = 0; v < nv; v++) ring.set(hb.sdf.ringAt(cl.pos[v * 3], cl.pos[v * 3 + 1], cl.pos[v * 3 + 2]), v * 4);
      capAttr.aRing = { a: ring, n: 4 };
    }
    const geo = buildGeometry(cl.pos, cl.nrm, cl.idx, si, sw, capAttr);
    // (a feathered edge: the cap dissolves into strands over the last centimetre above its hairline, not over 3 mm)
    if (hb.sp.soft) { const e = geo.geo.getAttribute('aEdge') as THREE.BufferAttribute, P = geo.geo.getAttribute('position') as THREE.BufferAttribute; const A = geo.geo.getAttribute('aAo') as THREE.BufferAttribute; for (let v = 0; v < e.count; v++) { let se = hb.sdf.softEdge(P.getX(v), P.getY(v), P.getZ(v), hb.sp.ring ? 0.028 : 0.018);
      // (flowing hair: feathered across the forehead only. Beside the temples the hair stands off the head, and a feathered cut there let the background through in holes)
      const sideK = hb.sp.flowing ? smooth(0.04, 0.058, Math.abs(hf.toLocal([P.getX(v), P.getY(v), P.getZ(v)])[0])) : 0; se = Math.max(se, sideK);
      e.setX(v, Math.max(Math.min(e.getX(v), se), 0.8 * sideK)); if (!hb.sp.ring) A.setX(v, Math.min(A.getX(v), 0.999) + 2 * Math.round(se * 100)); } }   // (repair: the hairline's own ramp rides in the occlusion attribute's whole part, as the curls' tips do, so the ends of hanging hair and tails keep the hair's colour)
    const capMat = hairCapMaterial(o.look, quality, hb.sp, hb.sp.ring || hb.sp.soft ? hf.toBody([0, 0.02, -0.05]) : undefined, hb.sp.soft && hb.sp.tie ? hf.toBody(hb.sp.tie) : undefined, hb.sp.layers ? hf.toBody([hb.sp.part, 0.09, 0]) : undefined);
    mats.push(capMat);
    const cap = new THREE.SkinnedMesh(geo.geo, capMat);
    cap.name = 'hair-cap';
    // (cast r2, layered flowing hair) the cap takes no shadow: the fall's own shadow on the hair above it was cut by the shadow
    // map's texels into black jagged blotches beside the ear. It still throws its shadow on the body
    if (hb.sp.layers) cap.userData.noRecv = true;
    buildMs.hairCap = Math.round(performance.now() - th);
    const tc = performance.now();
    const cards = growCards(hb, roots, quality, o.seed, edgeRoots);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(cards.pos, 3));
    cg.setAttribute('uv', new THREE.BufferAttribute(cards.uv, 2));
    cg.setIndex(cards.idx);
    cg.computeVertexNormals();
    const cw = hairWeights(hb, cards.pos);
    cg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(cw.si, 4));
    cg.setAttribute('skinWeight', new THREE.BufferAttribute(cw.sw, 4));
    const cmat = cardMaterial(o.look.hairColor, hairTexture(hb.sp.tex), quality, { grey: o.look.grey, kk: true, alphaTest: 0.4, sheen: hb.sp.tex === 'curl' ? 0.3 : hb.sp.soft && !hb.sp.ring ? 0.6 : 1, tips: o.look.hairTips ?? null, sharp: !!hb.sp.soft, even: hb.sp.soft && !hb.sp.ring ? (hb.sp.layers ? 1.5 : 0.92) : undefined });   // (cast r2, the feathered styles: an anti-aliased cut with no coverage dither, an even tone and a softer sheen; the bright stripes down Jas's tail and the speckle over Chad's forehead by day. Was sheen 1.3)
    mats.push(cmat);
    const cm = new THREE.SkinnedMesh(cg, cmat);
    cm.name = 'hair-cards';
    // (repair 2026-11-16, a feathered style) the strand cards lie on the cap's surface: taking its shadow (and throwing
    // their own on it) drew them as hard black strings down the lit side of the hair. They are lit as the cap is, unshadowed
    if (hb.sp.soft && !hb.sp.ring) cm.userData.noShadow = true;
    buildMs.hairCards = Math.round(performance.now() - tc);
    return [cap, cm];
  };

  // ---------------------------------------------------------------- (cast) a full beard's shell, LOD 0 only
  const beardMeshes = (): THREE.Mesh[] => {
    const bb = buildBeardVolume(rig, o.look);
    if (!bb) return [];
    const th = performance.now();
    const h = quality === 'high' ? 0.0032 : 0.005;
    const { mesh } = meshPart(bb.sdf, aabbBox(bb.box[0], bb.box[1], h), h);
    const cl = clipByRegion(mesh.pos, mesh.nrm, mesh.idx, (x, y, z) => bb.sdf.keep(x, y, z));
    const act = (v: number) => mesh.act[mesh.vblock[cl.src[v]]];
    const ao = bakeAO(bb.sdf, cl.pos, cl.nrm, act, 0.004, 0.012);
    const nv = cl.pos.length / 3, flow = new Float32Array(nv * 3), edge = new Float32Array(nv);
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const p: V3 = [cl.pos[v * 3], cl.pos[v * 3 + 1], cl.pos[v * 3 + 2]];
      flow.set(bb.flow(p), v * 3);
      edge[v] = clamp(-bb.sdf.keep(p[0], p[1], p[2]) / 0.008);
      const w = bb.headW(p);
      si[v * 4] = B.head; sw[v * 4] = w[0]; si[v * 4 + 1] = B.neck; sw[v * 4 + 1] = w[1];
    }
    const geo = buildGeometry(cl.pos, cl.nrm, cl.idx, si, sw, { aFlow: { a: flow, n: 3 }, aAo: { a: ao, n: 1 }, aEdge: { a: edge, n: 1 } });
    const mat = hairCapMaterial({ ...o.look, hair: 'short' }, quality);
    mats.push(mat);
    const m = new THREE.SkinnedMesh(geo.geo, mat);
    m.name = 'beard';
    buildMs.beard = Math.round(performance.now() - th);
    return [m];
  };

  // ---------------------------------------------------------------- parts
  const skinPart = (h: number, keep: ((x: number, y: number, z: number) => boolean) | undefined, filter: ((c: V3, r: number, i: number) => boolean) | undefined, isFace: boolean, aoD: [number, number], clampLo?: V3) => {
    const [lo, hi] = fieldBounds(rig.field, filter);
    if (clampLo) for (let k = 0; k < 3; k++) lo[k] = Math.max(lo[k], clampLo[k]);
    const { mesh, idx } = meshPart(rig.field, aabbBox(lo, hi, h), h, keep);
    const act = (v: number) => mesh.act[mesh.vblock[v]];
    const { si, sw } = skinWeights(rig, mesh.pos, act);
    const ao = bakeAO(rig.field, mesh.pos, mesh.nrm, act, aoD[0], aoD[1]);
    const nv = mesh.pos.length / 3;
    const aSkin = new Float32Array(nv * 4), aFace = new Float32Array(nv * 4), aMisc = new Float32Array(nv * 4);
    const softHairline = !!getHair()?.sp.soft, softSdf = softHairline ? getHair()!.sdf : null;
    for (let v = 0; v < nv; v++) {
      aSkin[v * 4 + 2] = ao[v];
      aMisc[v * 4] = tattooOf(si, sw, v);
      if (isFace || mesh.pos[v * 3 + 1] > rig.neckSeam - 0.03) {
        const l = hf.toLocal([mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]]);
        const m = faceMasks(l, hf, o.look);
        aSkin[v * 4] = m.red; aSkin[v * 4 + 1] = m.lip; aSkin[v * 4 + 3] = m.thin;
        aFace[v * 4] = m.blush; aFace[v * 4 + 1] = m.beard; aFace[v * 4 + 2] = m.eyeA; aFace[v * 4 + 3] = m.mouth;
        aMisc[v * 4 + 1] = softHairline ? softScalp(o.look.hair, l, 35 + 40 * hf.old, hf.male, softSdf!.fr(l)) : m.scalp; aMisc[v * 4 + 2] = m.wrink; aMisc[v * 4 + 3] = m.freck;   // (fifth pass: a soft style's hairline thins out onto the skin)
      }
    }
    return { mesh, idx, si, sw, aSkin, aFace, aMisc, nv };
  };

  const buildLod0 = () => {
    const G = new THREE.Group();
    const tb = performance.now();
    const hBody = quality === 'high' ? 0.012 : 0.018, hHead = quality === 'high' ? 0.0027 : 0.0041, hHand = quality === 'high' ? 0.0052 : 0.0068;
    const wr = rig.wrist;
    // ---- the body, minus the head and hands
    // the wrist seams are planes across the forearm: they only apply within a cylinder round the forearm's axis
    const handSide = (p: V3, i: number) => {
      const W = wr[i], sd = side(p, W.p, W.n);
      const lx = p[0] - W.p[0] - W.n[0] * sd, ly = p[1] - W.p[1] - W.n[1] * sd, lz = p[2] - W.p[2] - W.n[2] * sd;
      return Math.hypot(lx, ly, lz) < 0.075 * rig.s ? sd : -1;
    };
    const body = skinPart(hBody, (x, y, z) => y < rig.neckSeam + 0.004 && handSide([x, y, z], 0) < 0.002 && handSide([x, y, z], 1) < 0.002, undefined, false, [0.015, 0.04]);
    for (let v = 0; v < body.nv; v++) {
      const P = body.mesh.pos, x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const near = Math.max(clamp((y - (rig.neckSeam - 0.03)) / 0.02), clamp((handSide([x, y, z], 0) + 0.03) / 0.02), clamp((handSide([x, y, z], 1) + 0.03) / 0.02));
      for (let k = 0; k < 3; k++) P[v * 3 + k] -= body.mesh.nrm[v * 3 + k] * 0.0016 * near;
    }
    body.idx = dropTris(body.idx, covered(body.mesh.pos, body.si));
    const bg = buildGeometry(body.mesh.pos, body.mesh.nrm, body.idx, body.si, body.sw, { aSkin: { a: body.aSkin, n: 4 }, aFace: { a: body.aFace, n: 4 }, aMisc: { a: body.aMisc, n: 4 } });
    const bodyMesh = new THREE.SkinnedMesh(bg.geo, getBodyMat());
    G.add(bodyMesh);
    buildMs.body0 = Math.round(performance.now() - tb);
    const tc = performance.now();
    for (const gb of getGarments()) {
      const m = clothMesh(gb);
      G.add(m);
      if (gb.collar && gb.g.kind === 'suitJacket') {
        // (pack) the lapels in the jacket's own cloth, a shade lighter: black on black they did not read at all
        const lm = clothMaterial(new THREE.Color(gb.g.color).lerp(new THREE.Color(0xffffff), 0.028).getHex(), gb.g.fabric, quality, gb.g.color);
        mats.push(lm);
        G.add(collarMesh(gb, lm));
      } else if (gb.collar) G.add(collarMesh(gb, m.material as THREE.Material));
    }
    buildMs.clothes0 = Math.round(performance.now() - tc);
    // ---- hands
    const th = performance.now();
    const handBones = [[B.handL, B.fingL, B.thumbL, B.foreL], [B.handR, B.fingR, B.thumbR, B.foreR]];
    for (let s = 0; s < 2; s++) {
      const W = wr[s];
      const hand = skinPart(hHand, (x, y, z) => side([x, y, z], W.p, W.n) > -0.012, (_c, _r, i) => handBones[s].includes(rig.field.bone[i]), false, [0.004, 0.012]);
      const hg = buildGeometry(hand.mesh.pos, hand.mesh.nrm, hand.idx, hand.si, hand.sw, { aSkin: { a: hand.aSkin, n: 4 }, aFace: { a: hand.aFace, n: 4 }, aMisc: { a: hand.aMisc, n: 4 } });
      G.add(new THREE.SkinnedMesh(hg.geo, getBodyMat()));
    }
    buildMs.hands0 = Math.round(performance.now() - th);
    // ---- the head with its lids
    const thd = performance.now();
    const seam = rig.neckSeam;
    // the face, ears and jaw fine; the cranium, the back of the head and the neck coarser (hair covers most of it)
    const fineAt = (x: number, y: number, z: number) => { const l = hf.toLocal([x, y, z]); return l[1] > -0.15 && ((l[2] > -0.115 && l[1] < 0.045) || l[2] > -0.03); };
    const head = skinPart(hHead, (x, y, z) => y > seam - 0.012 && fineAt(x, y, z), (_c, _r, i) => rig.field.bone[i] === B.head, true, [0.004, 0.012], [-1, hf.toBody([0, -0.165, 0])[1], hf.toBody([0, 0, -0.13])[2]]);
    // the cranium, the back of the head and the neck coarser (hair covers most of it), pulled in a hair so the fine
    // face always wins where they overlap
    const hC = hHead * 2.1;
    const headC = skinPart(hC, (x, y, z) => { if (y < seam - 0.012) return false; const l = hf.toLocal([x, y, z]); return !(l[1] > -0.142 && ((l[2] > -0.107 && l[1] < 0.038) || l[2] > -0.022)); }, (_c, _r, i) => rig.field.bone[i] === B.head || rig.field.bone[i] === B.neck, true, [0.005, 0.014], [-1, seam - 0.03, -1]);
    for (let v = 0; v < headC.nv; v++) for (let k = 0; k < 3; k++) headC.mesh.pos[v * 3 + k] -= headC.mesh.nrm[v * 3 + k] * 0.0007;
    const cg = buildGeometry(headC.mesh.pos, headC.mesh.nrm, headC.idx, headC.si, headC.sw, { aSkin: { a: headC.aSkin, n: 4 }, aFace: { a: headC.aFace, n: 4 }, aMisc: { a: headC.aMisc, n: 4 } });
    const coarseMat = getFaceMat().clone() as SkinMaterial;
    coarseMat.onBeforeCompile = getFaceMat().onBeforeCompile; coarseMat.customProgramCacheKey = getFaceMat().customProgramCacheKey;
    coarseMat.polygonOffset = true; coarseMat.polygonOffsetFactor = 1; coarseMat.polygonOffsetUnits = 1;
    mats.push(coarseMat);
    G.add(new THREE.SkinnedMesh(cg.geo, coarseMat));
    buildMs.headMesh = Math.round(performance.now() - thd);
    const lids = buildLids(hf);
    const nl = lids.pos.length, nh = head.nv;
    const N = nh + nl;
    const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
    const aSkin = new Float32Array(N * 4), aFace = new Float32Array(N * 4), aMisc = new Float32Array(N * 4);
    pos.set(head.mesh.pos); nrm.set(head.mesh.nrm); si.set(head.si); sw.set(head.sw); aSkin.set(head.aSkin); aFace.set(head.aFace); aMisc.set(head.aMisc);
    // lid normals from their own triangles
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(lids.pos.flatMap((p) => hf.toBody(p))), 3));
    lg.setIndex(lids.idx); lg.computeVertexNormals();
    for (let i = 0; i < nl; i++) {
      const v = nh + i, b = hf.toBody(lids.pos[i]);
      pos[v * 3] = b[0]; pos[v * 3 + 1] = b[1]; pos[v * 3 + 2] = b[2];
      nrm[v * 3] = lg.attributes.normal.getX(i); nrm[v * 3 + 1] = lg.attributes.normal.getY(i); nrm[v * 3 + 2] = lg.attributes.normal.getZ(i);
      si[v * 4] = B.head; sw[v * 4] = 1;
      // the lid takes the skin masks of where it sits (a fixed redness and thinness made a closed lid a pale pink disc)
      const lm = faceMasks(lids.pos[i], hf, o.look);
      aSkin[v * 4] = lm.red; aSkin[v * 4 + 2] = lids.ao[i]; aSkin[v * 4 + 3] = Math.min(lm.thin, 0.08);
      aFace[v * 4] = lm.blush; aFace[v * 4 + 2] = lids.liner[i] > 1 ? lids.liner[i] : 0.6 + 0.4 * lids.liner[i];   // >1 = the dark lash line aMisc[v * 4 + 2] = lm.wrink;
    }
    const idx = new Uint32Array(head.idx.length + lids.idx.length);
    idx.set(head.idx); idx.set(lids.idx.map((v) => v + nh), head.idx.length);
    const deltas = morphDeltas(pos, hf, { extra: (v, e) => (v >= nh && lids.deltas[e] ? lids.deltas[e]![v - nh] : null) });
    const hgeo = buildGeometry(pos, nrm, idx, si, sw, { aSkin: { a: aSkin, n: 4 }, aFace: { a: aFace, n: 4 }, aMisc: { a: aMisc, n: 4 } });
    // morphs follow the same vertex compaction
    const used = hgeo.map, kept = hgeo.count;
    const compact = (d: Float32Array) => { const out = new Float32Array(kept * 3); for (let v = 0; v < N; v++) { const u = used[v]; if (u >= 0) { out[u * 3] = d[v * 3]; out[u * 3 + 1] = d[v * 3 + 1]; out[u * 3 + 2] = d[v * 3 + 2]; } } return out; };
    const hmap = setMorphs(hgeo.geo, deltas.map(compact), true);
    const headMesh = new THREE.SkinnedMesh(hgeo.geo, getFaceMat());
    G.add(headMesh);
    faceMeshes[0].push({ mesh: headMesh, map: hmap });
    buildMs.head0 = Math.round(performance.now() - thd);
    // ---- lashes, brows, teeth
    const tf = performance.now();
    const lash = buildLashes(hf, quality);
    const lashMesh = rigidSkinned(lash.pos.map(() => 0), lash.idx, B.head, lash.mat, (g) => {
      const P = new Float32Array(lash.pos.length);
      for (let v = 0; v < lash.pos.length / 3; v++) { const b = hf.toBody([lash.pos[v * 3], lash.pos[v * 3 + 1], lash.pos[v * 3 + 2]]); P.set(b, v * 3); }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(lash.uvs), 2));
      const D = lash.deltas.map((d) => { const out = new Float32Array(d.length); for (let i = 0; i < d.length; i += 3) { out[i] = d[i] * hf.sx; out[i + 1] = d[i + 1] * hf.sy; out[i + 2] = d[i + 2] * hf.sz; } return out; });
      // the field's deltas too (brow and squint skin moves the lash line a little)
      const F = morphDeltas(P, hf);
      faceMeshes[0].push({ mesh: null as unknown as THREE.SkinnedMesh, map: setMorphs(g, D.map((d, e) => { const o2 = new Float32Array(d.length); for (let i = 0; i < d.length; i++) o2[i] = d[i] + F[e][i]; return o2; })) });
    });
    faceMeshes[0][faceMeshes[0].length - 1].mesh = lashMesh;
    G.add(lashMesh);
    const brow = buildBrows(hf, rig.field, o.look, quality);
    const browMesh = rigidSkinned([], brow.idx, B.head, brow.mat, (g) => {
      const P = new Float32Array(brow.pos.length);
      for (let v = 0; v < brow.pos.length / 3; v++) { const b = hf.toBody([brow.pos[v * 3], brow.pos[v * 3 + 1], brow.pos[v * 3 + 2]]); P.set(b, v * 3); }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(brow.uvs), 2));
      const si2 = new Uint16Array(P.length / 3 * 4), sw2 = new Float32Array(P.length / 3 * 4);
      for (let v = 0; v < P.length / 3; v++) { si2[v * 4] = B.head; sw2[v * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si2, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw2, 4));
      faceMeshes[0].push({ mesh: null as unknown as THREE.SkinnedMesh, map: setMorphs(g, morphDeltas(P, hf)) });
    });
    faceMeshes[0][faceMeshes[0].length - 1].mesh = browMesh;
    G.add(browMesh);
    const teeth = buildTeeth(hf, quality);
    const teethMesh = rigidSkinned(teeth.pos, teeth.idx, B.head, teeth.mat, (g) => {
      g.setAttribute('normal', new THREE.BufferAttribute(teeth.nrm, 3));
      g.setAttribute('color', new THREE.BufferAttribute(teeth.col, 3));
    });
    faceMeshes[0].push({ mesh: teethMesh, map: setMorphs(teethMesh.geometry, teeth.deltas) });
    teethMesh.updateMorphTargets();
    G.add(teethMesh);
    mats.push(lash.mat, brow.mat, teeth.mat);
    // ---- eyeballs on the head bone
    eyes = buildEyes(hf, o.look, quality, rig.joints[B.head]);
    for (const s of eyes.sockets) sk.bones[B.head].add(s);
    mats.push(...eyes.mats);
    buildMs.faceParts = Math.round(performance.now() - tf);
    for (const m of hairMeshes()) G.add(m);
    for (const m of beardMeshes()) G.add(m);
    const ta = performance.now();
    const ac = buildAccessories(rig, o.acc, o.look, quality, outer);
    for (const m of ac.meshes) G.add(m);
    mats.push(...ac.mats);
    buildMs.acc0 = Math.round(performance.now() - ta);
    for (const m of G.children) { m.castShadow = !m.userData.noShadow; m.receiveShadow = !m.userData.noShadow && !m.userData.noRecv; (m as THREE.Mesh).frustumCulled = false; }
    lashMesh.castShadow = false; browMesh.castShadow = false;
    return G;
  };

  // ---------------------------------------------------------------- the outer surface as coverings (coarse LODs, laying chains)
  const lodParts = () => {
    const gs = getGarments(), hb = getHair();
    const looks: Look2[] = [], covers: Cover[] = [], extras: Extra[] = [];
    const neckTop = rig.neckSeam + 0.01;
    const closedOver = gs.some((x) => x.layer === 3 && !x.g.open && (x.g.kind === 'suitJacket' || !!x.g.tailored));
    for (const gb of gs) {
      const shoe = isShoe(gb.g.kind), bottom = isBottom(gb.g.kind);
      const id = looks.push({ kind: 'cloth', color: gb.g.color, accent: gb.accent, accentColor: shoe ? (lightSole(gb.g.kind) ? (gb.g.accent ?? 0xf2f2f0) : new THREE.Color(gb.g.color).multiplyScalar(0.55).getHex()) : gb.g.accent, wear: gb.wear, rough: gb.g.fabric === 'satin' ? 0.4 : gb.g.fabric === 'leather' ? 0.45 : 0.85 }) - 1;
      const reg = gb.sdf.region;
      covers.push({ t: gb.sdf.t + (gb.layer >= 3 ? 0.004 : 0), keep: (x, y, z) => Math.max(reg(x, y, z), y - neckTop), noArms: bottom, id });
      // (2026-11-16) under a closed suit jacket or a closed tailored outer layer the top's own hanging profile is left
      // out of the coarse levels: the two profiles lie millimetres apart there, and the top's showed through the jacket
      // as white patches at the patio distance. The top still shows where the jacket's region is open (the V, the cuffs)
      if (gb.sdf.drape && !(closedOver && gb.layer === 2)) { const dr = gb.sdf.drape; extras.push({ d: (x, y, z) => dr.d(x, y, z), region: gb.keep, id }); }
      if (gb.sdf.extra) extras.push({ d: gb.sdf.extra, region: null, id });
    }
    let hairId = -2;
    if (hb) {
      const hs = hb.sdf;
      hairId = looks.push({ kind: 'hair', color: o.look.hairColor, rough: 0.6 }) - 1;
      covers.push({ t: (x, y, z) => hs.thick(hf.toLocal([x, y, z])), keep: (x, y, z) => hs.capKeep(x, y, z), noArms: false, id: hairId });
      if (hs.hang || hb.sp.bun || hb.sp.tail) extras.push({ d: (x, y, z) => hs.extraAt(x, y, z), region: (x, y, z) => hs.keep(x, y, z), id: hairId });
    }
    const D = rig.dims, ax = [D.chestHalf + 0.004, D.shoulderY - 0.1 * rig.s], c21 = Math.cos(21 * DEG), s21 = Math.sin(21 * DEG);
    const armZone = (x: number, y: number) => (Math.abs(x) - ax[0]) * c21 + (y - ax[1]) * s21 > 0;
    return { looks, covers, extras, hairId, armZone };
  };
  let outerF: LodField | null = null;
  const outer = (x: number, y: number, z: number) => {
    if (!outerF) { const lp = lodParts(); outerF = new LodField(rig.field, lp.covers, lp.extras, lp.armZone); }
    return outerF.eval(x, y, z, null, 0);
  };

  /** (fifth pass) the cap of acc.ts in a few dozen triangles, for the coarse levels' one mesh */
  const coarseCap = (n: number) => {
    const pos: number[] = [], nrm: number[] = [], col: number[] = [], lod: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [];
    const C: V3 = [0, 0.028, -0.066], R: V3 = [0.0865 + 0.007, 0.097 + 0.006, 0.1065 + 0.007], top = C[1] + R[1];
    const kAt = (y: number) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y - C[1]) / R[1], 2.7)), 1 / 2.7);
    const cr = (az: number, y: number, off = 0): V3 => { const k = y < C[1] ? 1 : kAt(y); return [(R[0] * k + off) * Math.sin(az), y, C[2] + (R[2] * k + off) * Math.cos(az)]; };
    const band = (az: number) => capBandY(C[2] + R[2] * Math.cos(az)) - 0.004;
    let cc = new THREE.Color(o.acc.cap!);
    const v = (l: V3, nl: V3) => { const p = hf.toBody(l), k = Math.hypot(nl[0], nl[1], nl[2]) || 1; pos.push(p[0], p[1], p[2]); nrm.push(nl[0] / k, nl[1] / k, nl[2] / k); col.push(cc.r, cc.g, cc.b); lod.push(0.95, 0); si.push(B.head, 0, 0, 0); sw.push(1, 0, 0, 0); return pos.length / 3 - 1; };
    const NS = n === 1 ? 16 : 10, NR = n === 1 ? 4 : 3;
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NS; j++) {
      const az = (j / NS) * Math.PI * 2 - Math.PI, y = lerp(band(az), top, Math.sin((i / NR) * Math.PI / 2));
      v(cr(az, y), [Math.sin(az) * kAt(y) / R[0], (y - C[1]) / (R[1] * R[1]) * 0.9 + (i === NR ? 1 : 0), Math.cos(az) * kAt(y) / R[2]]);
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + 1, c2 = a + NS + 1, d = c2 + 1; idx.push(a, b, d, a, d, c2); }
    const NU = n === 1 ? 8 : 4, NV = n === 1 ? 2 : 1, azM = 64 * DEG, L = 0.07;
    const brim = (u: number, w: number, under: boolean): V3 => {
      const az = u * azM, i0 = cr(az, band(az) + 0.003, 0.001), len = L * (1 - 0.72 * Math.pow(Math.abs(u), 2.6)) * w;
      return [i0[0] + 0.18 * Math.sin(az) * len, i0[1] - 0.13 * len - 0.013 * u * u * w - (under ? 0.004 : 0), i0[2] + len];
    };
    for (const under of [false, true]) {
      cc = new THREE.Color(under ? (o.acc.capUnder ?? 0x808286) : o.acc.cap!);
      const b0 = pos.length / 3;
      for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) v(brim((j / NU) * 2 - 1, i / NV, under), [0, under ? -1 : 1, under ? 0.1 : 0.15]);
      for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) { const a = b0 + i * (NU + 1) + j, b = a + 1, c2 = a + NU + 1, d = c2 + 1; if (under) idx.push(a, c2, d, a, d, b); else idx.push(a, d, c2, a, b, d); }
    }
    if (o.acc.capMark != null) {
      // our own OC mark as two flat strokes on the front panel: an O and a C, a slanted hand
      cc = new THREE.Color(o.acc.capMark);
      const yM = 0.083, on = (a: number, b: number): V3 => cr((a + 0.22 * b) / R[2], yM + b, 0.0035);
      const stroke = (cx: number, a0: number, a1: number, m: number) => {
        const b0 = pos.length / 3;
        for (let i = 0; i <= m; i++) { const a = (a0 + (i / m) * (a1 - a0)) * DEG; for (const k of [0.62, 1.3]) v(on(cx + 0.0064 * k * Math.cos(a), 0.0092 * k * Math.sin(a)), [0, 0.2, 1]); }
        for (let i = 0; i < m; i++) { const a = b0 + i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2, a, a + 3, a + 1, a, a + 2, a + 3); }
      };
      stroke(-0.0095, 0, 360, n === 1 ? 8 : 6);
      stroke(0.0105, 48, 312, n === 1 ? 6 : 4);
    }
    return { pos, nrm, col, lod, si, sw, idx };
  };

  /** (repair 2026-11-16, Look.cleanLod) a face a coarse level can show: the eyes (the white, the iris and pupil, the lash line), the
   *  brows and the mouth as a few dozen flat triangles laid on the level's own mesh, in the same mesh (no draw call). Vertex
   *  colours on a 5 mm mesh blurred them into smudges a few metres away, and at 6 cm there was no face at all */
  const coarseFace = (n: number, mp: Float32Array, mi: Uint32Array, ml: Float32Array) => {
    const pos: number[] = [], nrm: number[] = [], col: number[] = [], lod: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [];
    const F = o.face, o0 = hf.toBody([0, 0, 0]), zMin = hf.toBody([0, 0, -0.03])[2];
    // the level's triangles over the face, for laying the decals on (a ray from the front, down the head's z)
    const tris: number[] = [];
    for (let t = 0; t < mi.length; t += 3) {
      const a = mi[t] * 3, b = mi[t + 1] * 3, c = mi[t + 2] * 3;
      // (skin only, aLod.y: a lock of hair in front of the cheek at the far level took the mouth's corner with it)
      if (ml[(a / 3) * 2 + 1] + ml[(b / 3) * 2 + 1] + ml[(c / 3) * 2 + 1] < 1.5) continue;
      if (Math.max(mp[a + 2], mp[b + 2], mp[c + 2]) < zMin || Math.min(Math.abs(mp[a] - o0[0]), Math.abs(mp[b] - o0[0]), Math.abs(mp[c] - o0[0])) > 0.1 || Math.min(mp[a + 1], mp[b + 1], mp[c + 1]) > o0[1] + 0.09 || Math.max(mp[a + 1], mp[b + 1], mp[c + 1]) < o0[1] - 0.15) continue;
      tris.push(a, b, c);
    }
    const zAt = (x: number, y: number) => {
      let best = -1e9;
      for (let t = 0; t < tris.length; t += 3) {
        const a = tris[t], b = tris[t + 1], c = tris[t + 2];
        const x0 = mp[a], y0 = mp[a + 1], x1 = mp[b], y1 = mp[b + 1], x2 = mp[c], y2 = mp[c + 1];
        const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (Math.abs(den) < 1e-12) continue;
        const u = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / den, w = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / den, q = 1 - u - w;
        if (u < -1e-4 || w < -1e-4 || q < -1e-4) continue;
        const z = u * mp[a + 2] + w * mp[b + 2] + q * mp[c + 2];
        if (z > best) best = z;
      }
      return best;
    };
    const off = n === 1 ? 0.0016 : 0.0045;
    let cc = new THREE.Color(0xffffff), lift = 0;
    const v = (lx: number, ly: number) => { const p = hf.toBody([lx, ly, 0]); let z = zAt(p[0], p[1]); if (z < -1e8) z = hf.toBody([0, 0, 0.02])[2]; pos.push(p[0], p[1], z + off + lift); nrm.push(0, -0.25, 0.968); col.push(cc.r, cc.g, cc.b); lod.push(1, 0); si.push(B.head, 0, 0, 0); sw.push(1, 0, 0, 0); return pos.length / 3 - 1; };
    const fan = (pts: [number, number][], cx: number, cy: number) => { const c0 = v(cx, cy), b0 = pos.length / 3; for (const q of pts) v(q[0], q[1]); for (let i = 0; i < pts.length; i++) { const p0 = b0 + i, p1 = b0 + (i + 1) % pts.length; idx.push(c0, p0, p1, c0, p1, p0); } };   // (both windings: the level's material is one-sided)
    const strip = (lo: [number, number][], hi: [number, number][]) => { const b0 = pos.length / 3; for (let i = 0; i < lo.length; i++) { v(lo[i][0], lo[i][1]); v(hi[i][0], hi[i][1]); } for (let i = 0; i < lo.length - 1; i++) { const a = b0 + i * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1, a, a + 3, a + 2, a, a + 1, a + 3); } };
    const skinC = new THREE.Color(o.look.skin), hairC = new THREE.Color(o.look.hairColor), dark = new THREE.Color(0x1b1512);
    const es = F.eyeSize ?? 1, ex = hf.eye.x, ey = hf.eye.y, aE = 0.0128 * es, bE = 0.0052 * es, tilt = 0.14 * (F.eyeTilt ?? 0);
    for (const sg of [1, -1]) {
      // (the person's left eye is at +x: seen from the front the winding below faces the viewer for both, the strips being double-checked by the fans' order)
      const E = (u: number, w: number): [number, number] => [sg * (ex + u * aE), ey + w + tilt * u * aE];
      const up = (u: number) => bE * Math.pow(Math.max(0, 1 - u * u), 0.7), lo = (u: number) => -0.8 * bE * Math.pow(Math.max(0, 1 - u * u), 0.8);
      const US = n === 1 ? [-1, -0.55, 0, 0.55, 1] : [-1, 0, 1];
      const ring: [number, number][] = [...US.map((u) => E(u, up(u))), ...US.slice(1, -1).reverse().map((u) => E(u, lo(u)))];
      if (sg < 0) ring.reverse();
      if (n === 1) {
        lift = 0; cc = new THREE.Color(0xddd6ce); fan(ring, sg * ex, ey);
        const rI = 0.0058 * es, hex = (r: number): [number, number][] => { const q: [number, number][] = []; for (let i = 0; i < 6; i++) { const a = (sg > 0 ? 1 : -1) * (i / 6) * Math.PI * 2; q.push([sg * ex + r * Math.cos(a), ey + Math.max(lo(0) * 0.95, Math.min(up(0) * 0.92, r * Math.sin(a)))]); } return q; };
        lift = 0.0004; cc = new THREE.Color(o.look.iris).multiplyScalar(0.8); fan(hex(rI), sg * ex, ey);
        lift = 0.0008; cc = new THREE.Color(0x0c0a09); fan(hex(rI * 0.42), sg * ex, ey);
        // the lash line along the upper lid (heavier with liner)
        lift = 0.0008; cc = dark.clone();
        const th = 0.0014 + 0.0012 * (o.look.liner ?? 0), a = US.map((u) => E(u, up(u) - 0.0004)), b = US.map((u) => E(u, up(u) + th * (0.5 + 0.5 * (1 - u * u))));
        if (sg > 0) strip(a, b); else strip(b, a);
      } else { lift = 0; cc = new THREE.Color(o.look.iris).multiplyScalar(0.35).lerp(dark, 0.5); fan(ring, sg * ex, ey); }
      // the brow
      lift = 0; cc = hairC.clone().multiplyScalar(0.8).lerp(skinC, 0.12);
      const bt = 0.0026 * (o.look.browThick ?? 1) * (F.brow ?? 1) ** 0.5, BS = n === 1 ? [0, 0.3, 0.6, 0.85, 1] : [0, 0.6, 1];
      const yB = (u: number) => ey + 0.0185 * es + 0.004 * Math.sin(Math.min(1, u * 1.35) * Math.PI) - 0.004 * u * u + tilt * 0.4 * u * 0.03;
      const bl = BS.map((u): [number, number] => [sg * (ex - 0.0175 + 0.04 * u), yB(u) - bt * (1 - 0.6 * u)]), bh = BS.map((u): [number, number] => [sg * (ex - 0.0175 + 0.04 * u), yB(u) + bt * (1 - 0.6 * u)]);
      if (sg > 0) strip(bl, bh); else strip(bh, bl);
    }
    // the mouth: the lips and the line between them
    const mY = hf.mouth.y, mw = hf.mouth.w * 1.04, lipC = o.look.lipstick != null ? new THREE.Color(o.look.lipstick) : skinC.clone().lerp(new THREE.Color(0x7c3a36), 0.42).multiplyScalar(0.92);
    const MS = n === 1 ? [-1, -0.6, -0.2, 0.2, 0.6, 1] : [-1, 0, 1];
    const upL = (u: number) => (hf.mouth.upY - mY) * Math.pow(Math.max(0, 1 - u * u), 0.55) * (1 - 0.18 * Math.exp(-((u / 0.16) ** 2))), loL = (u: number) => (hf.mouth.loY - mY) * Math.pow(Math.max(0, 1 - u * u), 0.6);
    const mid = MS.map((u): [number, number] => [-u * mw, mY]);   // (from the person's left to their right: counter-clockwise strips seen from the front)
    lift = 0; cc = lipC.clone().multiplyScalar(0.84); strip(mid.slice().reverse(), MS.map((u): [number, number] => [-u * mw, mY + upL(u)]).reverse());
    cc = lipC.clone(); strip(MS.map((u): [number, number] => [-u * mw, mY + loL(u)]).reverse(), mid.slice().reverse());
    if (n === 1) { lift = 0.0005; cc = new THREE.Color(0x3a1c1a); strip(MS.map((u): [number, number] => [-u * mw * 0.97, mY - 0.0009 * (1 - 0.6 * u * u)]).reverse(), MS.map((u): [number, number] => [-u * mw * 0.97, mY + 0.0009 * (1 - 0.6 * u * u)]).reverse()); }
    return { pos, nrm, col, lod, si, sw, idx };
  };

  const buildCoarse = (n: number) => {
    const G = new THREE.Group();
    const tb = performance.now();
    const hb = getHair();
    const { looks, covers, extras, hairId, armZone } = lodParts();
    const seam = rig.neckSeam, H = rig.H;
    const parts: { pos: Float32Array; nrm: Float32Array; idx: Uint32Array; act: (Int32Array | null)[]; vb: Int32Array; f: Field }[] = [];
    const meshIn = (lo: V3, hi: V3, h: number, keep?: (x: number, y: number, z: number) => boolean) => {
      const f = reduced(rig.field, h, !!o.look.cleanLod), lf = new LodField(f, covers, extras, armZone);
      lf.outerWins = !!o.look.cleanLod;
      const { mesh, idx } = meshPart(lf, aabbBox(lo, hi, h), h, keep);
      parts.push({ pos: mesh.pos, nrm: mesh.nrm, idx, act: mesh.act, vb: mesh.vblock, f });
      buildMs['mesh' + n + '_' + parts.length] = Math.round(mesh.stats.ms);
      return lf;
    };
    const hq = quality === 'high';
    let lf: LodField;
    if (n === 1) {
      lf = meshIn([-0.85, -rig.heel - 0.03, -0.55], [0.85, seam + 0.02, 0.55], hq ? 0.028 : 0.034, (_x, y) => y < seam + 0.006);
      if (o.look.cleanLod) {
        // (fifth pass) the face itself at half the head's step: at 1 cm an eye is one vertex wide and a face a few metres
        // away is a smear; the rest of the head stays coarse. The two overlap by a few millimetres round the face
        const inFace = (x: number, y: number, z: number, m: number) => { const l = hf.toLocal([x, y, z]); return l[2] > -0.012 + m && l[1] > -0.128 + m && l[1] < 0.058 - m; };
        meshIn(hf.toBody([-0.14, -0.2, -0.26]), hf.toBody([0.14, 0.17, 0.13]), hq ? 0.0105 : 0.013, (x, y, z) => y > seam - 0.014 && !inFace(x, y, z, 0.006));
        meshIn(hf.toBody([-0.1, -0.14, -0.03]), hf.toBody([0.1, 0.075, 0.13]), hq ? 0.0052 : 0.0064, (x, y, z) => y > seam - 0.014 && inFace(x, y, z, 0));
      } else
      meshIn(hf.toBody([-0.14, -0.2, -0.26]), hf.toBody([0.14, 0.17, 0.13]), hq ? 0.0105 : 0.013, (_x, y) => y > seam - 0.014);
    } else lf = meshIn([-0.85, -rig.heel - 0.03, -0.55], [0.85, H + 0.12, 0.55], 0.06);
    // one buffer
    let nvT = 0, niT = 0;
    for (const p of parts) { nvT += p.pos.length / 3; niT += p.idx.length; }
    const pos = new Float32Array(nvT * 3), nrm = new Float32Array(nvT * 3), idx = new Uint32Array(niT);
    let ov = 0, oi = 0;
    const vPart: number[] = [], vAct: (Int32Array | null)[] = [];
    parts.forEach((p, pi) => {
      pos.set(p.pos, ov * 3); nrm.set(p.nrm, ov * 3);
      for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov;
      for (let v = 0; v < p.pos.length / 3; v++) { vPart.push(pi); const a = p.act[p.vb[v]]; vAct.push(a ? a.filter((i) => i < p.f.n) : null); }
      ov += p.pos.length / 3; oi += p.idx.length;
    });
    const tp = performance.now();
    const pt = paint(lf, looks, pos, hf, o.look, male, !!o.look.cleanLod, o.look.cleanLod && n === 2 ? nrm : null);
    buildMs['paint' + n] = Math.round(performance.now() - tp);
    const tw = performance.now();
    // weights per part against the field it was meshed from
    const si = new Uint16Array(nvT * 4), sw = new Float32Array(nvT * 4);
    let base = 0;
    parts.forEach((p) => {
      const nv = p.pos.length / 3, b0 = base;
      const w = skinWeightsF(rig, [p.f], p.pos, (v) => vAct[b0 + v], 1.6);
      si.set(w.si, b0 * 4); sw.set(w.sw, b0 * 4);
      base += nv;
    });
    if (hb) for (let v = 0; v < nvT; v++) if (pt.comp[v] === hairId) {
      const w = hb.headW([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]);
      si[v * 4] = B.head; sw[v * 4] = w[0]; si[v * 4 + 1] = B.neck; sw[v * 4 + 1] = w[1]; si[v * 4 + 2] = B.chest; sw[v * 4 + 2] = w[2]; si[v * 4 + 3] = 0; sw[v * 4 + 3] = 0;
    }
    buildMs['weights' + n] = Math.round(performance.now() - tw);
    void vPart;
    // (fifth pass, Look.cleanLod) the lines where one look meets another cut clean, inside the level's triangle budget
    const cut = o.look.cleanLod ? splitLooks(lf, { pos, nrm, idx, col: pt.col, lod: pt.lod, si, sw, comp: pt.comp }, (n === 1 ? (hq ? 20000 : 13600) : 2440) - (o.acc.cap != null ? (n === 1 ? 230 : 110) : 0) - (n === 1 ? 215 : 36) - idx.length / 3, hairId) : { pos, nrm, idx, col: pt.col, lod: pt.lod, si, sw };
    // (fifth pass) a fitted cap at the coarse levels, in the same mesh: a crown, a brim with its under-colour and our OC mark
    // (acc.ts builds the cap for LOD 0 only; without it the far levels showed the bare crown, a black bowl)
    const cap = o.look.cleanLod && o.acc.cap != null ? coarseCap(n) : null;
    const merge = <T extends Float32Array | Uint16Array>(a: T, b: number[], Ctor: new (n: number) => T) => { const out = new Ctor(a.length + b.length); out.set(a); out.set(b, a.length); return out; };
    type Extra = ReturnType<typeof coarseCap>;
    const join = (m0: typeof cut, e: Extra | null): typeof cut => e ? { ...m0, pos: merge(m0.pos, e.pos, Float32Array), nrm: merge(m0.nrm, e.nrm, Float32Array), col: merge(m0.col, e.col, Float32Array), lod: merge(m0.lod, e.lod, Float32Array), si: merge(m0.si, e.si, Uint16Array), sw: merge(m0.sw, e.sw, Float32Array),
      idx: (() => { const b = m0.pos.length / 3, out = new Uint32Array(m0.idx.length + e.idx.length); out.set(m0.idx); for (let i = 0; i < e.idx.length; i++) out[m0.idx.length + i] = e.idx[i] + b; return out; })() } : m0;
    // (repair 2026-11-16) the face's features as flat triangles on the level's own mesh (laid on it before the cap joins)
    const faceX = o.look.cleanLod ? coarseFace(n, cut.pos, cut.idx, cut.lod) : null;
    const fin = join(join(cut, faceX), cap);
    const g = buildGeometry(fin.pos, fin.nrm, fin.idx, fin.si, fin.sw, { color: { a: fin.col, n: 3 }, aLod: { a: fin.lod, n: 2 } });
    const mat = lodMaterial();
    mats.push(mat);
    const m = new THREE.SkinnedMesh(g.geo, mat);
    m.name = 'lod' + n;
    m.userData.faceTris = faceX ? faceX.idx.length / 3 : 0;   // (the regression check reads it: the face's features are in the level's mesh)
    m.frustumCulled = false; m.castShadow = n === 1; m.receiveShadow = true;
    G.add(m);
    buildMs['coarse' + n] = Math.round(performance.now() - tb);
    return G;
  };

  const buildLod = (n: number) => {
    const t1 = performance.now();
    const G = n === 0 ? buildLod0() : buildCoarse(n);
    group.add(G);
    group.updateMatrixWorld(true);
    G.traverse((m) => { if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).bind(sk.skeleton, new THREE.Matrix4()); });
    buildMs[`lod${n}`] = Math.round(performance.now() - t1);
    return G;
  };

  // the skeleton's inverses come from the rest pose: compute them once, before any animation
  group.updateMatrixWorld(true);
  sk.skeleton.calculateInverses();

  const applyFace = () => {
    const cur = face.cur;
    for (const fm of faceMeshes[lod] ?? []) {
      const inf = fm.mesh.morphTargetInfluences;
      if (!inf) continue;
      for (let i = 0; i < fm.map.length; i++) inf[i] = cur[fm.map[i]];
    }
    if (eyes && lod === 0) for (const b of eyes.balls) b.rotation.set(-face.gaze.y, face.gaze.x, 0, 'YXZ');
  };

  const p: Person = {
    group, options: o, rig,
    setExpression(name, w = 1) { face.setExpression(name, w); if (name === 'laugh') anim.play('laugh'); },
    say(line, seconds) { face.say(line, seconds); },
    lookAt(target) { anim.lookTarget = target ? target.clone() : null; },
    play(a) { anim.play(a); },
    update(dt) {
      const aim = anim.update(dt, sk.bones, sk.rest, (out) => sk.bones[B.head].getWorldPosition(out), group);
      face.update(dt, anim.lookTarget ? aim : null);
      anim.talkAmount += ((face.speaking) - anim.talkAmount) * Math.min(1, dt * 4);
      applyFace();
    },
    setLod(n) {
      if (n === lod) return;
      if (!lods[n]) lods[n] = buildLod(n);
      lods.forEach((m, i) => { if (m) m.visible = i === n; });
      if (eyes) for (const s of eyes.sockets) s.visible = n === 0;
      lod = n;
      applyFace();
    },
    eyes(out = new THREE.Vector3()) {
      const c = hf.toBody([0, 0, 0.01]);
      const hb = sk.bones[B.head];
      hb.updateWorldMatrix(true, false);
      const J = rig.joints[B.head];
      return out.set(c[0] - J[0], c[1] - J[1], c[2] - J[2]).applyMatrix4(hb.matrixWorld);
    },
    stats() {
      let tris = 0, calls = 0;
      const g = lods[lod];
      g?.traverse((m) => { if ((m as THREE.Mesh).isMesh && m.visible) { const ge = (m as THREE.Mesh).geometry; tris += (ge.index ? ge.index.count : ge.attributes.position.count) / 3; calls++; } });
      if (lod === 0 && eyes) for (const m of eyes.meshes) { tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; calls++; }
      return { lod, tris: Math.round(tris), calls, buildMs };
    },
    dispose() {
      group.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).geometry.dispose(); });
      bodyMat?.dispose(); faceMat?.dispose(); for (const m of mats) m.dispose();
    },
  };
  void MORPHS; void MI;
  p.setLod(o.lod ?? 1);
  p.update(0);
  return p;
}

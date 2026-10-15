// buildPerson: one adult, skinned to a skeleton, with level-of-detail meshes built on demand.
//   LOD 0 (conversation): body 12 mm, head 2.5 mm (3.5 on 'phone'), hands 3.5 mm, eyelids, eyeballs, lashes, brows,
//         teeth, clothes shells, hair cards. LOD 1 (patio): one combined mesh ~22 mm with the head at 6 mm, vertex
//         colours, plus hair cards. LOD 2 (far): one combined mesh ~45 mm.
import * as THREE from 'three';
import { buildRig, Rig, B } from './body';
import { makeSkeleton } from './skeleton';
import { aabbBox, fieldBounds, meshPart, skinWeights, skinWeightsF, bakeAO, buildGeometry, side, dropTris, clipByRegion } from './geo';
import { buildGarments, GarmentBuild, isShoe } from './garments';
import { clothMaterial } from './cloth';
import { buildHairVolume, HairBuild, growCards, hairCapMaterial } from './hair';
import { LodField, Look2, Cover, Extra, reduced, paint, lodMaterial } from './lod';
import { Field } from './field';
import { buildAccessories } from './acc';
import { cardMaterial, hairTexture } from './cards';
import { skinMaterial, SkinMaterial } from './skin';
import { Animator, AnimName } from './anim';
import { PersonOptions, Quality } from './params';
import { V3, clamp, DEG } from './math';
import { faceMasks } from './masks';
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
  const shoes = o.outfit.find((g) => ['heels', 'boots', 'sneakers', 'loafers', 'flats'].includes(g.kind));
  const heel = shoes?.kind === 'heels' ? 0.07 * (o.body.height / 1.65) : 0;
  const rig = buildRig(o.body, o.face, heel);
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
  const beardAmt = !male ? 0 : fh === 'beard' ? 1 : fh === 'goatee' || fh === 'moustache' ? 0.9 : fh === 'stubble' ? 0.75 : 0.22;
  const skinLook = { tone: o.look.skin, lipstick: o.look.lipstick, blush: o.look.blush, beard: beardAmt, beardColor: o.look.hairColor, liner: o.look.liner, hairColor: o.look.hairColor, freckles: o.look.freckles, age: o.body.age, male };
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
      for (const gb of gs) if (gb.bones.has(b) && gb.keep(x, y, z) < -(isShoe(gb.g.kind) ? 0.012 : margin)) { gone[v] = 1; break; }
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
    const geo = buildGeometry(P, NR, idx, si, sw, { aCloth: { a: aCloth, n: 4 }, aFold: { a: aFold, n: 4 } });
    const sole = gb.g.kind === 'sneakers' ? (gb.g.accent ?? 0xf2f2f0) : new THREE.Color(gb.g.color).multiplyScalar(0.55).getHex();
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
    const h = quality === 'high' ? 0.0042 : 0.0068;
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
    }
    const { si, sw } = hairWeights(hb, cl.pos);
    const geo = buildGeometry(cl.pos, cl.nrm, cl.idx, si, sw, { aFlow: { a: flow, n: 3 }, aAo: { a: ao, n: 1 }, aEdge: { a: edge, n: 1 } });
    const capMat = hairCapMaterial(o.look, quality);
    mats.push(capMat);
    const cap = new THREE.SkinnedMesh(geo.geo, capMat);
    cap.name = 'hair-cap';
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
    const cmat = cardMaterial(o.look.hairColor, hairTexture(hb.sp.tex), quality, { grey: o.look.grey, kk: true, alphaTest: 0.4, sheen: hb.sp.tex === 'curl' ? 0.3 : 1 });
    mats.push(cmat);
    const cm = new THREE.SkinnedMesh(cg, cmat);
    cm.name = 'hair-cards';
    buildMs.hairCards = Math.round(performance.now() - tc);
    return [cap, cm];
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
    for (let v = 0; v < nv; v++) {
      aSkin[v * 4 + 2] = ao[v];
      aMisc[v * 4] = tattooOf(si, sw, v);
      if (isFace || mesh.pos[v * 3 + 1] > rig.neckSeam - 0.03) {
        const l = hf.toLocal([mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]]);
        const m = faceMasks(l, hf, o.look);
        aSkin[v * 4] = m.red; aSkin[v * 4 + 1] = m.lip; aSkin[v * 4 + 3] = m.thin;
        aFace[v * 4] = m.blush; aFace[v * 4 + 1] = m.beard; aFace[v * 4 + 2] = m.eyeA; aFace[v * 4 + 3] = m.mouth;
        aMisc[v * 4 + 1] = m.scalp; aMisc[v * 4 + 2] = m.wrink; aMisc[v * 4 + 3] = m.freck;
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
      if (gb.collar) G.add(collarMesh(gb, m.material as THREE.Material));
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
    const ta = performance.now();
    const ac = buildAccessories(rig, o.acc, o.look, quality, outer);
    for (const m of ac.meshes) G.add(m);
    mats.push(...ac.mats);
    buildMs.acc0 = Math.round(performance.now() - ta);
    for (const m of G.children) { m.castShadow = true; m.receiveShadow = true; (m as THREE.Mesh).frustumCulled = false; }
    lashMesh.castShadow = false; browMesh.castShadow = false;
    return G;
  };

  // ---------------------------------------------------------------- the outer surface as coverings (coarse LODs, laying chains)
  const lodParts = () => {
    const gs = getGarments(), hb = getHair();
    const looks: Look2[] = [], covers: Cover[] = [], extras: Extra[] = [];
    const neckTop = rig.neckSeam + 0.01;
    for (const gb of gs) {
      const shoe = isShoe(gb.g.kind), bottom = ['jeans', 'trousers', 'skirt', 'shorts'].includes(gb.g.kind);
      const id = looks.push({ kind: 'cloth', color: gb.g.color, accent: gb.accent, accentColor: shoe ? (gb.g.kind === 'sneakers' ? (gb.g.accent ?? 0xf2f2f0) : new THREE.Color(gb.g.color).multiplyScalar(0.55).getHex()) : gb.g.accent, wear: gb.wear, rough: gb.g.fabric === 'satin' ? 0.4 : gb.g.fabric === 'leather' ? 0.45 : 0.85 }) - 1;
      const reg = gb.sdf.region;
      covers.push({ t: gb.sdf.t + (gb.layer >= 3 ? 0.004 : 0), keep: (x, y, z) => Math.max(reg(x, y, z), y - neckTop), noArms: bottom, id });
      if (gb.sdf.drape) { const dr = gb.sdf.drape; extras.push({ d: (x, y, z) => dr.d(x, y, z), region: gb.keep, id }); }
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

  const buildCoarse = (n: number) => {
    const G = new THREE.Group();
    const tb = performance.now();
    const hb = getHair();
    const { looks, covers, extras, hairId, armZone } = lodParts();
    const seam = rig.neckSeam, H = rig.H;
    const parts: { pos: Float32Array; nrm: Float32Array; idx: Uint32Array; act: (Int32Array | null)[]; vb: Int32Array; f: Field }[] = [];
    const meshIn = (lo: V3, hi: V3, h: number, keep?: (x: number, y: number, z: number) => boolean) => {
      const f = reduced(rig.field, h), lf = new LodField(f, covers, extras, armZone);
      const { mesh, idx } = meshPart(lf, aabbBox(lo, hi, h), h, keep);
      parts.push({ pos: mesh.pos, nrm: mesh.nrm, idx, act: mesh.act, vb: mesh.vblock, f });
      buildMs['mesh' + n + '_' + parts.length] = Math.round(mesh.stats.ms);
      return lf;
    };
    const hq = quality === 'high';
    let lf: LodField;
    if (n === 1) {
      lf = meshIn([-0.85, -rig.heel - 0.03, -0.55], [0.85, seam + 0.02, 0.55], hq ? 0.028 : 0.034, (_x, y) => y < seam + 0.006);
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
    const pt = paint(lf, looks, pos, hf, o.look, male);
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
    const g = buildGeometry(pos, nrm, idx, si, sw, { color: { a: pt.col, n: 3 }, aLod: { a: pt.lod, n: 2 } });
    const mat = lodMaterial();
    mats.push(mat);
    const m = new THREE.SkinnedMesh(g.geo, mat);
    m.name = 'lod' + n;
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

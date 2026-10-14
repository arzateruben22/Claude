// buildPerson: one adult, skinned to a skeleton, with level-of-detail meshes built on demand.
//   LOD 0 (conversation): body 12 mm, head 2.5 mm (3.5 on 'phone'), hands 3.5 mm, eyelids, eyeballs, lashes, brows,
//         teeth, clothes shells, hair cards. LOD 1 (patio): one combined mesh ~22 mm with the head at 6 mm, vertex
//         colours, plus hair cards. LOD 2 (far): one combined mesh ~45 mm.
import * as THREE from 'three';
import { buildRig, Rig, B } from './body';
import { makeSkeleton } from './skeleton';
import { aabbBox, fieldBounds, meshPart, skinWeights, bakeAO, buildGeometry, side } from './geo';
import { skinMaterial, SkinMaterial } from './skin';
import { Animator, AnimName } from './anim';
import { PersonOptions, Quality } from './params';
import { V3, clamp } from './math';
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
function setMorphs(g: THREE.BufferGeometry, deltas: Float32Array[]): number[] {
  const map: number[] = [], attrs: THREE.BufferAttribute[] = [];
  deltas.forEach((d, e) => {
    let nz = false;
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 1e-7) { nz = true; break; }
    if (!nz) return;
    map.push(e); attrs.push(new THREE.BufferAttribute(d, 3));
  });
  if (attrs.length) { g.morphAttributes.position = attrs; g.morphTargetsRelative = true; }
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
    if (!faceMat) { faceMat = skinMaterial(skinLook, quality, 'face'); faceMat.polygonOffset = true; faceMat.polygonOffsetFactor = -1; faceMat.polygonOffsetUnits = -1; }
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

  type SkinPart = ReturnType<typeof skinPart>;
  const mergeParts = (a: SkinPart, b: SkinPart) => {
    const nv = a.nv + b.nv;
    const cat = (x: Float32Array, y: Float32Array) => { const o2 = new Float32Array(x.length + y.length); o2.set(x); o2.set(y, x.length); return o2; };
    const si = new Uint16Array(a.si.length + b.si.length); si.set(a.si); si.set(b.si, a.si.length);
    const idx = new Uint32Array(a.idx.length + b.idx.length); idx.set(a.idx); for (let i = 0; i < b.idx.length; i++) idx[a.idx.length + i] = b.idx[i] + a.nv;
    return { mesh: { pos: cat(a.mesh.pos, b.mesh.pos), nrm: cat(a.mesh.nrm, b.mesh.nrm) }, idx, si, sw: cat(a.sw, b.sw), aSkin: cat(a.aSkin, b.aSkin), aFace: cat(a.aFace, b.aFace), aMisc: cat(a.aMisc, b.aMisc), nv };
  };

  const buildLod0 = () => {
    const G = new THREE.Group();
    const tb = performance.now();
    const hBody = quality === 'high' ? 0.012 : 0.016, hHead = quality === 'high' ? 0.0027 : 0.0038, hHand = quality === 'high' ? 0.0052 : 0.0068;
    const wr = rig.wrist;
    // ---- the body, minus the head and hands
    const body = skinPart(hBody, (x, y, z) => y < rig.neckSeam + 0.004 && side([x, y, z], wr[0].p, wr[0].n) < 0.002 && side([x, y, z], wr[1].p, wr[1].n) < 0.002, undefined, false, [0.015, 0.04]);
    for (let v = 0; v < body.nv; v++) {
      const P = body.mesh.pos, x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const near = Math.max(clamp((y - (rig.neckSeam - 0.03)) / 0.02), clamp((side([x, y, z], wr[0].p, wr[0].n) + 0.03) / 0.02), clamp((side([x, y, z], wr[1].p, wr[1].n) + 0.03) / 0.02));
      for (let k = 0; k < 3; k++) P[v * 3 + k] -= body.mesh.nrm[v * 3 + k] * 0.0016 * near;
    }
    const bg = buildGeometry(body.mesh.pos, body.mesh.nrm, body.idx, body.si, body.sw, { aSkin: { a: body.aSkin, n: 4 }, aFace: { a: body.aFace, n: 4 }, aMisc: { a: body.aMisc, n: 4 } });
    const bodyMesh = new THREE.SkinnedMesh(bg.geo, getBodyMat());
    G.add(bodyMesh);
    buildMs.body0 = Math.round(performance.now() - tb);
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
    coarseMat.polygonOffset = true; coarseMat.polygonOffsetFactor = -0.5; coarseMat.polygonOffsetUnits = -0.5;
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
      aSkin[v * 4] = 0.35; aSkin[v * 4 + 2] = lids.ao[i]; aSkin[v * 4 + 3] = 0.2;
      aFace[v * 4 + 2] = 0.6 + 0.4 * lids.liner[i];
    }
    const idx = new Uint32Array(head.idx.length + lids.idx.length);
    idx.set(head.idx); idx.set(lids.idx.map((v) => v + nh), head.idx.length);
    const deltas = morphDeltas(pos, hf, { extra: (v, e) => (v >= nh && lids.deltas[e] ? lids.deltas[e]![v - nh] : null) });
    const hgeo = buildGeometry(pos, nrm, idx, si, sw, { aSkin: { a: aSkin, n: 4 }, aFace: { a: aFace, n: 4 }, aMisc: { a: aMisc, n: 4 } });
    // morphs follow the same vertex compaction
    const used = hgeo.map, kept = hgeo.count;
    const compact = (d: Float32Array) => { const out = new Float32Array(kept * 3); for (let v = 0; v < N; v++) { const u = used[v]; if (u >= 0) { out[u * 3] = d[v * 3]; out[u * 3 + 1] = d[v * 3 + 1]; out[u * 3 + 2] = d[v * 3 + 2]; } } return out; };
    const hmap = setMorphs(hgeo.geo, deltas.map(compact));
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
    for (const m of G.children) { m.castShadow = true; m.receiveShadow = true; (m as THREE.Mesh).frustumCulled = false; }
    lashMesh.castShadow = false; browMesh.castShadow = false;
    return G;
  };

  const buildCoarse = (n: number) => {
    const G = new THREE.Group();
    const h = n === 1 ? 0.022 : 0.045;
    const part = skinPart(h, undefined, undefined, false, [0.02, 0.05]);
    const g = buildGeometry(part.mesh.pos, part.mesh.nrm, part.idx, part.si, part.sw, { aSkin: { a: part.aSkin, n: 4 }, aFace: { a: part.aFace, n: 4 }, aMisc: { a: part.aMisc, n: 4 } });
    const m = new THREE.SkinnedMesh(g.geo, getBodyMat());
    m.frustumCulled = false; m.castShadow = n === 1; m.receiveShadow = true;
    G.add(m);
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

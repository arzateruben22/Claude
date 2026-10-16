// R4 palms up close: the game's own palms (Terrain's instanced trunk and crown from props.ts, lit by the game sky) on
// the preview's stretch of the 405, so a crown can be judged at 15 m rather than 80 m from the car.
// ?view=whole|crown (default whole), ?q=high|low (the quality preset, which sets the frond count), ?i=0 (the i-th
// nearest palm to the driver's view at ?s=metres from the stretch start), ?time=day|sunset|night
import * as THREE from 'three';
import { makeStage } from './stage';
import * as P from '../game/road/props';

const q = new URLSearchParams(location.search);
if (q.get('view') === 'texture') {
  // ?view=texture: the frond texture (over a checkerboard, so its alpha shows) and the bark, at 1:1, no 3D; it logs
  // how much of each frond passes the alpha test at each mip level (box-filtered, as the GPU builds them) as a share
  // of mip 0 (a far frond that keeps much less than 1 thins out), and the colour kept under a transparent texel
  const T = await import('../game/textures');
  const tx = T.frond(), img = tx.image as ImageData, bk = T.bark().image as HTMLCanvasElement;
  const fr = document.createElement('canvas'); fr.width = img.width; fr.height = img.height; fr.getContext('2d')!.putImageData(img, 0, 0);
  document.body.style.cssText = 'margin:0;background:repeating-conic-gradient(#c9c9c9 0 25%,#8a8a8a 0 50%) 0 0/16px 16px;display:flex;gap:8px';
  document.body.append(fr, bk);
  const mt = (P.mats.frond() as THREE.MeshStandardMaterial).alphaTest * 255;
  let w = img.width, h = img.height, a = Float32Array.from({ length: w * h }, (_, i) => img.data[i * 4 + 3]);
  const cover = (lv: Float32Array, lw: number, lh: number) => [0, 1].map((half) => {
    let k = 0, nn = 0;
    for (let y = Math.ceil(lh * 40 / 512); y < lh; y++) for (let x = half * lw / 2; x < (half + 1) * lw / 2; x++) { nn++; if (lv[y * lw + x] > mt) k++; }
    return k / nn;
  });
  const rows: string[] = [], c0 = cover(a, w, h);
  for (let lvl = 0; w >= 4; lvl++) {
    const c = cover(a, w, h);
    rows.push(`mip ${lvl} (${w}): live ${(c[0] / c0[0]).toFixed(2)}, dead ${(c[1] / c0[1]).toFixed(2)}`);
    const nw = w / 2, nh = h / 2, b = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) b[y * nw + x] = (a[2 * y * w + 2 * x] + a[2 * y * w + 2 * x + 1] + a[(2 * y + 1) * w + 2 * x] + a[(2 * y + 1) * w + 2 * x + 1]) / 4;
    a = b; w = nw; h = nh;
  }
  const i0 = (300 * img.width + 4) * 4;
  console.warn(`coverage ${rows.join('; ')}; texel (4, 300), outside the frond: rgba ${[...img.data.slice(i0, i0 + 4)].join(',')}`);
  window.__previewReady = true;
  await new Promise(() => {});
}
const stage = await makeStage();
const st = stage.stretch!;
const s = st.s0 + Number(q.get('s') ?? 1500);
stage.useGameSky((q.get('time') as 'day') ?? 'day');
stage.driverView(s);
stage.addGameWorld((q.get('q') as 'high') ?? 'high');

// every palm crown the terrain built, nearest to the driver's view first (a crown instance sits at the trunk's top)
const crownMat = P.mats.frond(), here = stage.camera.position.clone();
const palms: { p: THREE.Vector3; d: number }[] = [];
const m = new THREE.Matrix4(), v = new THREE.Vector3();
stage.scene.updateMatrixWorld(true);
stage.scene.traverse((o) => {
  const im = o as THREE.InstancedMesh;
  if (!im.isInstancedMesh || im.material !== crownMat) return;
  for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); m.premultiply(im.matrixWorld); v.setFromMatrixPosition(m); palms.push({ p: v.clone(), d: v.distanceTo(here) }); }
});
palms.sort((a, b) => a.d - b.d);
const pick = palms[Math.min(palms.length - 1, Number(q.get('i') ?? 0))];
if (!pick) throw new Error(`no palms built near s=${s}`);
const top = pick.p;
// stand between the palm and the road, so the ground and the road are behind it
const toRoad = here.clone().sub(top).setY(0).normalize();
const cam = stage.camera;
if (q.get('view') === 'crown') {
  cam.position.copy(top).addScaledVector(toRoad, 13).add(new THREE.Vector3(0, 0.5, 0));
  cam.lookAt(top.x, top.y + 1.2, top.z);
} else if (q.get('view') === 'shadow') {
  // ?view=shadow: looking down on the ground where the crown's shadow falls (the sun's shadow box follows the camera)
  const sun = stage.env!.sunDir, gy = st.net.ground(top.x + stage.origin.x, top.z + stage.origin.z);
  const at = top.clone().addScaledVector(sun, -(top.y - gy) / Math.max(0.2, sun.y));
  cam.position.copy(at).addScaledVector(toRoad, 7).add(new THREE.Vector3(0, 16, 0));
  cam.lookAt(at.x, at.y, at.z);
  console.log(`shadow centre ${at.x.toFixed(1)}, ${at.y.toFixed(1)}, ${at.z.toFixed(1)}; sun ${sun.toArray().map((v) => v.toFixed(2))}`);
} else {
  cam.position.copy(top).addScaledVector(toRoad, 34).add(new THREE.Vector3(0, -8, 0));
  cam.lookAt(top.x, top.y - 6, top.z);
}
console.log(`palm ${q.get('i') ?? 0} of ${palms.length}: top at ${top.x.toFixed(1)}, ${top.y.toFixed(1)}, ${top.z.toFixed(1)}, ${pick.d.toFixed(0)} m from the driver's view`);
await stage.ready(6);

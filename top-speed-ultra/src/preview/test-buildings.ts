// W1 buildings up close: the game's own houses and offices (Terrain's instanced plans and office types, over the
// stucco and facade atlases) on the preview's stretch of the 405, lit by the game sky.
// ?view=texture (both atlases at half size, &mask=1 over a checkerboard so the tint mask's alpha shows; &atlas=stucco|facade
// &y0=px shows 1024 x 1024 of one at 1:1 from that row), ?view=house&plan=0..3 (the nearest house of that plan,
// seen from &dist metres in front), ?view=office&type=0..2, ?view=street (the driver's view); ?q=high|low,
// ?s=metres from the stretch start, ?time=day|sunset|night
import * as THREE from 'three';
import { makeStage } from './stage';

const q = new URLSearchParams(location.search);
if (q.get('view') === 'texture') {
  // after the page's load event (painting both atlases takes a while in software)
  await new Promise((res) => setTimeout(res, 50));
  const T = await import('../game/textures');
  T.configureTextures(1024, 1);
  const show = (img: ImageData, scale: number, y0 = 0) => {
    const c = document.createElement('canvas'), full = document.createElement('canvas');
    // the colour as it is under the mask (alpha 255), unless &mask=1 asks for the tint mask itself
    const shown = q.get('mask') ? img : new ImageData(Uint8ClampedArray.from(img.data, (v, i) => (i % 4 === 3 ? 255 : v)), img.width, img.height);
    full.width = img.width; full.height = img.height; full.getContext('2d')!.putImageData(shown, 0, 0);
    if (scale === 1) { c.width = img.width; c.height = Math.min(1024, img.height - y0); c.getContext('2d')!.drawImage(full, 0, y0, c.width, c.height, 0, 0, c.width, c.height); }
    else { c.width = img.width * scale; c.height = img.height * scale; c.getContext('2d')!.drawImage(full, 0, 0, c.width, c.height); }
    return c;
  };
  document.body.style.cssText = 'margin:0;background:repeating-conic-gradient(#c9c9c9 0 25%,#8a8a8a 0 50%) 0 0/16px 16px;display:flex;gap:8px';
  const one = q.get('atlas');
  if (one) document.body.append(show((one === 'facade' ? T.facade(true) : T.stucco(true)).map.image as ImageData, 1, Number(q.get('y0') ?? 0)));
  else document.body.append(show(T.stucco(true).map.image as ImageData, 0.5), show(T.facade(true).map.image as ImageData, 0.5));
  window.__previewReady = true;
  await new Promise(() => {});
}
const stage = await makeStage();
const st = stage.stretch!;
const s = st.s0 + Number(q.get('s') ?? 1500);
stage.useGameSky((q.get('time') as 'day') ?? 'day');
stage.driverView(s);
stage.addGameWorld((q.get('q') as 'high') ?? 'high');
const view = q.get('view') ?? 'street';
if (view !== 'street') {
  // every instance whose geometry is named for the plan or the office type, nearest to the driver's view first
  const want = view === 'office' ? `office-${[2, 3, 8][Number(q.get('type') ?? 0)]}` : `house-${q.get('plan') ?? 0}`;
  const here = stage.camera.position.clone(), m = new THREE.Matrix4(), list: { m: THREE.Matrix4; d: number }[] = [];
  stage.scene.updateMatrixWorld(true);
  stage.scene.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || im.geometry.name !== want) return;
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); const w = m.clone().premultiply(im.matrixWorld); list.push({ m: w, d: new THREE.Vector3().setFromMatrixPosition(w).distanceTo(here) }); }
  });
  list.sort((a, b) => a.d - b.d);
  const pick = list[Math.min(list.length - 1, Number(q.get('i') ?? 0))];
  if (!pick) throw new Error(`no ${want} built near s=${s}`);
  const at = new THREE.Vector3().setFromMatrixPosition(pick.m), e = pick.m.elements;
  const front = new THREE.Vector3(e[8], 0, e[10]).normalize(), side = new THREE.Vector3(front.z, 0, -front.x);
  const dist = Number(q.get('dist') ?? (view === 'office' ? 75 : 26)), cam = stage.camera;
  // a three-quarter view from in front, at eye height (or from &h metres up)
  cam.position.copy(at).addScaledVector(front, dist).addScaledVector(side, dist * 0.45).add(new THREE.Vector3(0, Number(q.get('h') ?? 1.6), 0));
  cam.lookAt(at.x, at.y + (view === 'office' ? 8 : 2.5), at.z);
  console.log(`${want} ${q.get('i') ?? 0} of ${list.length} at ${at.x.toFixed(1)}, ${at.y.toFixed(1)}, ${at.z.toFixed(1)}`);
}
await stage.ready(6);

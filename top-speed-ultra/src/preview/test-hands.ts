// Test page for the driver's hands (hands.ts). A stand-in steering wheel (rim swept with spec.ts rimAt/rimA/rimB in
// dark leather, three spokes and a hub) and a dark dash, the game's sky, and the hands gripping the rim.
//   ?view=seat     from the driver's eye (spec EYE), as the game frames it, sky 'day'
//   ?view=fingers  the right hand's grip in three panels: from the driver's eye (zoomed), from above, from the dash
//   ?view=close    the right hand from about 25 cm: knuckles, skin, the thumbnail
//   ?view=female   the female presentation: painted nails, ring, bracelet, the gold watch
//   ?view=tones    the five skin tones (drivers.ts SKINS) side by side, the right hand in each
//   ?view=gloves   the Ace's leather driving gloves
//   ?view=wrench   rolled sleeves and the smart watch
//   ?view=watch    the left wrist close up
//   ?driver=closer|ace|wrench &pres=m|f &skin=0..4 &quality=phone|high &wheel=rad &time=day|sunset &hud=1
import * as THREE from 'three';
import { makeStage } from './stage';
import { buildDriverArms } from './hands';
import { lookFor, SKINS, DriverId, Presentation } from '../game/drivers';
import { EYE, WHEEL_AT, WHEEL_TILT, rimAt, rimA, rimB } from './spec';
import * as T from '../game/textures';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'seat';
const preset: Record<string, { driver: DriverId; pres: Presentation; skin: number; fov: number }> = {
  seat: { driver: 'closer', pres: 'm', skin: 1, fov: 60 },
  fingers: { driver: 'wrench', pres: 'm', skin: 1, fov: 30 },
  close: { driver: 'wrench', pres: 'm', skin: 1, fov: 40 },
  female: { driver: 'closer', pres: 'f', skin: 1, fov: 36 },
  tones: { driver: 'wrench', pres: 'm', skin: 0, fov: 34 },
  gloves: { driver: 'ace', pres: 'm', skin: 2, fov: 38 },
  wrench: { driver: 'wrench', pres: 'm', skin: 3, fov: 38 },
  watch: { driver: 'closer', pres: 'm', skin: 2, fov: 34 },
};
const P = preset[view] ?? preset.seat;
const driver = (q.get('driver') as DriverId) ?? P.driver;
const pres = (q.get('pres') as Presentation) ?? P.pres;
const skinIdx = Number(q.get('skin') ?? P.skin);
const quality = (q.get('quality') as 'phone' | 'high') ?? 'high';

const stage = await makeStage({ stretch: false, fov: P.fov, near: 0.02, far: 3000 });
const env = stage.useGameSky((q.get('time') as 'day' | 'sunset') ?? 'day');
// a shadow box sized for the cabin, so the rim and the fingers shade each other (the scene's own shadows are the
// atmosphere part's job; this is only for the test page)
{
  const s = env.sun.shadow, cam = s.camera as THREE.OrthographicCamera;
  s.mapSize.set(2048, 2048); cam.left = -0.8; cam.right = 0.8; cam.top = 0.8; cam.bottom = -0.8; cam.updateProjectionMatrix();
  s.bias = -0.00015; s.normalBias = 0.0012; s.radius = 2;
  if (s.map) { s.map.dispose(); (s as unknown as { map: THREE.WebGLRenderTarget | null }).map = null; }
}
const scene = stage.scene;
const car = new THREE.Group();
scene.add(car);

// ---- the stand-in wheel
const wheel = new THREE.Group(); wheel.position.copy(WHEEL_AT); wheel.rotation.x = WHEEL_TILT; car.add(wheel);
const spin = new THREE.Group(); wheel.add(spin);
{
  const lea = T.leather();
  const map = lea.map.clone(), nmap = lea.normalMap.clone();
  map.repeat.set(40, 3); nmap.repeat.set(40, 3); map.needsUpdate = nmap.needsUpdate = true;
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1715, map, normalMap: nmap, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0x3a3430), sheenRoughness: 0.5, envMapIntensity: 0.6 });
  const nA = 256, nB = 40, pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nA; i++) {
    const a = (i / nA) * Math.PI * 2, p = rimAt(a), t = rimAt(a + 0.002).sub(rimAt(a - 0.002)).normalize();
    const out = new THREE.Vector3(t.y, -t.x, 0).normalize();
    if (out.dot(p) < 0) out.negate();
    const A = rimA(a), B = rimB(a);
    for (let j = 0; j <= nB; j++) {
      const th = (j / nB) * Math.PI * 2;
      pos.push(p.x + out.x * A * Math.cos(th), p.y + out.y * A * Math.cos(th), B * Math.sin(th));
      const n = new THREE.Vector3(out.x * Math.cos(th) / A, out.y * Math.cos(th) / A, Math.sin(th) / B).normalize();
      nrm.push(n.x, n.y, n.z); uv.push(i / nA, j / nB);
    }
  }
  for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
    const a = i * (nB + 1) + j, b = a + nB + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const rim = new THREE.Mesh(g, rimMat); rim.castShadow = rim.receiveShadow = true; spin.add(rim);
  const dark = new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.45, metalness: 0.2 });
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const L = 0.16, sp = new THREE.Mesh(new THREE.BoxGeometry(L, 0.034, 0.02), dark);
    sp.position.set(Math.cos(a) * L / 2, Math.sin(a) * L / 2, -0.01); sp.rotation.z = a; sp.castShadow = true; spin.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 40), dark); hub.rotation.x = Math.PI / 2; hub.position.z = -0.02; hub.castShadow = true; spin.add(hub);
  // a dark, matte dash behind the wheel
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 0.6), new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.85 }));
  dash.position.set(-0.05, 0.72, -1.08); dash.receiveShadow = true; car.add(dash);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3b3c3e, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.3, 24), dark); col.rotation.x = Math.PI / 2; col.position.set(0, 0, -0.17); wheel.add(col);
}

// ---- the hands
const build = (skin: number, drv = driver, pr = pres) => {
  const t0 = performance.now();
  const look = lookFor(drv, pr, skin);
  const nails = q.has('nails') ? (q.get('nails') === 'none' ? null : parseInt(q.get('nails')!, 16)) : undefined;
  const arms = buildDriverArms({ look, presentation: pr, quality, nails });
  return { arms, ms: performance.now() - t0 };
};
const first = build(skinIdx);
const arms = first.arms;
car.add(arms.group);
const second = build(skinIdx);                      // the cached path
second.arms.dispose();
const wheelA = Number(q.get('wheel') ?? 0);
arms.setWheelAngle(wheelA); spin.rotation.z = wheelA;

// ---- camera
const cam = stage.camera;
const handR = new THREE.Vector3(-0.222, 0.905, -0.452);   // the right hand's grip, between knuckles and fingertips
const look = (from: THREE.Vector3, at: THREE.Vector3) => { cam.position.copy(from); cam.up.set(0, 1, 0); cam.lookAt(at); };
if (view === 'seat') look(EYE, new THREE.Vector3(EYE.x, EYE.y - 0.06, EYE.z - 10));
else if (view === 'close') { const at = handR.clone().add(new THREE.Vector3(0.006, 0.004, 0.012)); look(at.clone().add(EYE.clone().sub(at).normalize().multiplyScalar(0.25)).add(new THREE.Vector3(0.05, 0.0, 0.0)), at); }
else if (view === 'tones') { const at = handR.clone().add(new THREE.Vector3(-0.012, 0.012, 0.02)); look(at.clone().add(new THREE.Vector3(-0.12, 0.16, 0.2).normalize().multiplyScalar(0.36)), at); }
else if (view === 'female') look(new THREE.Vector3(-0.3, 1.12, -0.06), new THREE.Vector3(-0.3, 0.88, -0.42));
else if (view === 'gloves' || view === 'wrench') look(new THREE.Vector3(-0.37, 1.13, -0.03), new THREE.Vector3(-0.37, 0.86, -0.42));
else if (view === 'watch') look(new THREE.Vector3(-0.66, 1.02, -0.25), new THREE.Vector3(-0.555, 0.865, -0.375));   // the left wrist's back, from above and outside

// ---- the grip in three panels: the driver's eye, above, the dash side
if (view === 'fingers') {
  const r = stage.renderer;
  const shots: [THREE.Vector3, THREE.Vector3, number][] = [
    [EYE.clone(), handR.clone(), 12],
    [handR.clone().add(new THREE.Vector3(0.02, 0.24, 0.06)), handR.clone(), 30],
    [handR.clone().add(new THREE.Vector3(0.06, 0.07, -0.23)), handR.clone(), 30],
  ];
  stage.setRender(() => {
    const w = r.domElement.width / r.getPixelRatio(), h = r.domElement.height / r.getPixelRatio(), cw = w / 3;
    r.setScissorTest(true);
    cam.aspect = cw / h;
    shots.forEach(([from, at, fov], i) => {
      cam.fov = fov; cam.updateProjectionMatrix(); look(from, at);
      r.setViewport(i * cw, 0, cw, h); r.setScissor(i * cw, 0, cw, h);
      r.render(scene, cam);
    });
    r.setScissorTest(false);
  });
}

// ---- the five tones side by side: one viewport each
if (view === 'tones') {
  const r = stage.renderer;
  stage.setRender(() => {
    const w = r.domElement.width / r.getPixelRatio(), h = r.domElement.height / r.getPixelRatio(), cw = w / 5;
    r.setScissorTest(true);
    cam.aspect = cw / h; cam.updateProjectionMatrix();
    SKINS.forEach((hex, i) => {
      arms.setTone(hex);
      r.setViewport(i * cw, 0, cw, h); r.setScissor(i * cw, 0, cw, h);
      r.render(scene, cam);
    });
    r.setScissorTest(false);
  });
}

// stats for the report: the hands alone (their own draw calls and triangles) and the build time
const hud = q.get('hud') === '1';
const div = document.createElement('div');
div.style.cssText = 'position:fixed;left:8px;bottom:6px;font:12px/1.3 monospace;color:#fff;text-shadow:0 1px 2px #000;white-space:pre';
if (hud) document.body.appendChild(div);
await stage.ready(2);
window.__previewReady = false;
const all = stage.info();
arms.group.visible = false;
await stage.ready(1);
window.__previewReady = false;
const without = stage.info();
arms.group.visible = true;
const line = `[hands] view=${view} driver=${driver}/${pres} skin=${skinIdx} quality=${quality} build=${first.ms.toFixed(0)}ms cached=${second.ms.toFixed(1)}ms meshes=${arms.stats.calls} tris=${arms.stats.tris} | frame calls ${all.calls} (without hands ${without.calls}) tris ${all.tris} (without ${without.tris})`;
console.warn(line);
div.textContent = line.replace(' | ', '\n');
await stage.ready(2);

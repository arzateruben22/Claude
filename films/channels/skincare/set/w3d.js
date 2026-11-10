// w3d.js — the shared base for Skin Sense's 3-D episodes (extracted from goose3d.js, which stays as ep07's scene): an ivory studio
// (soft environment, warm key, cool rim), a finished frame (depth of field, bloom, ACES with the ivory ground exempt), a keyed camera
// spline, tube/glow/texture helpers, painting hero overlays and a skin texture sampled from the owner's painting.
// An episode scene calls world(args) and then builds its own set; it returns { seek(t), anchor(name, t) } for the ss3 engine.
import * as THREE from "three";
export { THREE };
export const D2R = Math.PI / 180, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (t, a, b) => clamp((t - a) / (b - a)), sm = (x) => x * x * (3 - 2 * x), eo = (x) => 1 - Math.pow(1 - x, 3), eio = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const lerp = (a, b, k) => a + (b - a) * k;
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const IVORY = 0xf7efe3;

export async function world({ W, H, u, AW, BH, BTOP, artbox, R, EP }) {
  const T = EP.three || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(AW, BH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement; cv.style.cssText = `position:absolute;left:0;top:0;width:${AW}px;height:${BH}px`; artbox.appendChild(cv);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(IVORY); scene.fog = null;
  const camera = new THREE.PerspectiveCamera(30, AW / BH, 0.1, 200);

  // ── light: an ivory studio (soft environment, warm key, cool-white rim) ──────────────────────────────
  { const es = new THREE.Scene(); es.background = new THREE.Color(0xf3e9db);
    const box = (w, h, c, k, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); es.add(m); };
    box(8, 5, 0xfff4e6, 5, [-7, 8, 7]); box(3, 9, 0xeef4ff, 3, [9, 3, -6]); box(14, 3, 0xf6d8c4, 1.6, [0, -7, 3]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; scene.environmentIntensity = 0.4; }
  const key = new THREE.DirectionalLight(0xffe0bd, 2.1); key.position.set(-14, 9, 10); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 }); key.shadow.bias = -0.0006; key.shadow.radius = 5; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffefdc, 1.6); rim.position.set(8, 5, -14); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0xe0a890, 0.4));
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const tex = (c, rep = [1, 1]) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t; };
  const fibres = (g, w, h, n, cols, len, wd, vertical = 0.0) => { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, L = len * (0.4 + rnd()), a = (rnd() - 0.5) * 0.9 + (vertical ? Math.PI / 2 : 0), c = cols[(rnd() * cols.length) | 0];
    g.strokeStyle = c; g.lineWidth = wd * (0.5 + rnd()); g.globalAlpha = 0.14 + rnd() * 0.22; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + Math.cos(a) * L * 0.3, y + Math.sin(a) * L * 0.3 + (rnd() - 0.5) * 40, x + Math.cos(a) * L * 0.7, y + Math.sin(a) * L * 0.7 + (rnd() - 0.5) * 40, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); } g.globalAlpha = 1; };
  // the cut face: rose-peach dermis, a lighter epidermis band on top, butter-yellow fat below (Y from 0 at the top to 1 at the bottom)

  // the skin of an episode: the painting's colour and fine detail (mirrored crop, low-frequency shading removed) as a tiling map and bump map
  const skinFrom = async (src, crop = [0.45, 0.26], detail = 1.6) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); if (!im) return null;
    const iw = im.naturalWidth, ih = im.naturalHeight, cy = Math.round(ih * crop[0]), ch = Math.round(ih * crop[1]);
    const m2 = mkCanvas(iw * 2, ch * 2), g2 = m2.getContext("2d");
    g2.drawImage(im, 0, cy, iw, ch, 0, 0, iw, ch); g2.save(); g2.translate(iw * 2, 0); g2.scale(-1, 1); g2.drawImage(im, 0, cy, iw, ch, 0, 0, iw, ch); g2.restore();
    g2.save(); g2.translate(0, ch * 2); g2.scale(1, -1); g2.drawImage(m2, 0, 0, iw * 2, ch, 0, 0, iw * 2, ch); g2.restore();
    const bl = mkCanvas(m2.width, m2.height), bg = bl.getContext("2d"), s0 = mkCanvas(Math.ceil(m2.width / 14), Math.ceil(m2.height / 14)), sg = s0.getContext("2d"); sg.imageSmoothingQuality = "high"; sg.drawImage(m2, 0, 0, s0.width, s0.height); bg.imageSmoothingQuality = "high"; bg.drawImage(s0, 0, 0, m2.width, m2.height);
    const a1 = g2.getImageData(0, 0, m2.width, m2.height), a2 = bg.getImageData(0, 0, m2.width, m2.height); let mr = 0, mg = 0, mb = 0, n = 0;
    for (let i = 0; i < a2.data.length; i += 4 * 97) { mr += a2.data[i]; mg += a2.data[i + 1]; mb += a2.data[i + 2]; n++; } mr /= n; mg /= n; mb /= n;
    for (let i = 0; i < a1.data.length; i += 4) { a1.data[i] = clamp(mr + (a1.data[i] - a2.data[i]) * detail, 0, 255); a1.data[i + 1] = clamp(mg + (a1.data[i + 1] - a2.data[i + 1]) * detail, 0, 255); a1.data[i + 2] = clamp(mb + (a1.data[i + 2] - a2.data[i + 2]) * detail, 0, 255); }
    g2.putImageData(a1, 0, 0); return { canvas: m2, mean: [mr, mg, mb] }; };

  // a lathe-free tube we rewrite each frame (planar curves; z is the binormal)
  const makeTube = (nS, nR, mt, shadow = true) => { const g = new THREE.BufferGeometry(), pos = new Float32Array((nS + 1) * (nR + 1) * 3), nor = new Float32Array(pos.length), uv = new Float32Array((nS + 1) * (nR + 1) * 2), idx = [];
    for (let i = 0; i <= nS; i++) for (let j = 0; j <= nR; j++) { uv[(i * (nR + 1) + j) * 2] = j / nR; uv[(i * (nR + 1) + j) * 2 + 1] = i / nS; }
    for (let i = 0; i < nS; i++) for (let j = 0; j < nR; j++) { const a = i * (nR + 1) + j, b = a + nR + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mt); m.castShadow = shadow; m.frustumCulled = false; scene.add(m);
    return { mesh: m, set(pts, rad, zc = 0) { const n = pts.length; for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const nx = -ty, ny = tx;
      for (let j = 0; j <= nR; j++) { const th = (j / nR) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), k = (i * (nR + 1) + j) * 3; pos[k] = pts[i][0] + nx * c * rad[i]; pos[k + 1] = pts[i][1] + ny * c * rad[i]; pos[k + 2] = (pts[i][2] ?? zc) + s * rad[i]; nor[k] = nx * c; nor[k + 1] = ny * c; nor[k + 2] = s; } }
      g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true; } }; };
  // the nerve: a gold branching fibre (static curves), signals travel along it
  const NV = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const glowTex = (() => { const c = mkCanvas(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,190,1)"); gr.addColorStop(0.25, "rgba(255,214,120,.7)"); gr.addColorStop(1, "rgba(255,200,90,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mkGlow = (n, col) => Array.from({ length: n }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); scene.add(s); return s; });
  const sig = mkGlow(14, 0xffd77a), cold = null;
  // ── paintings as hero shots: the owner's picture, drawn over the 3-D view (DOM image, slow push) and dissolved to/from its 3-D twin ──
  const PL = (T.paintings || []).map((p) => { const el = new Image(); el.src = p.src; el.style.cssText = `position:absolute;left:0;top:0;width:${AW}px;max-width:none;transform-origin:50% 50%;opacity:0;pointer-events:none`; artbox.appendChild(el); return { ...p, el }; });
  await Promise.all(PL.map((p) => new Promise((res) => { if (p.el.complete) res(); else { p.el.onload = res; p.el.onerror = res; } })));
  const paintSet = (t) => { for (const p of PL) { const t0 = R(p.t0), t1 = R(p.t1), op = Math.min(sm(seg(t, t0, t0 + (p.fin ?? 0.5))), 1 - sm(seg(t, t1 - (p.fout ?? 0.8), t1))) * (t >= t0 && t <= t1 ? 1 : 0), el = p.el, h = AW * el.naturalHeight / el.naturalWidth, f = p.focus || [0.5, 0.6], life = seg(t, t0, t1), sc = (p.s0 || 1) + ((p.s1 || 1.08) - (p.s0 || 1)) * life;
    el.style.height = h + "px"; el.style.transformOrigin = `${f[0] * AW}px ${f[1] * h}px`; el.style.transform = `translate(${-(f[0] * AW - AW / 2) + (p.dx || 0) * life * AW * 0.04}px,${-(f[1] * h - BH / 2)}px) scale(${sc})`; el.style.opacity = op.toFixed(3); } };

  // ── the finish: depth of field (focus on the subject), a gentle bloom, ACES on the way out ────────────────────────
  const sceneRT = new THREE.WebGLRenderTarget(AW, BH, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(AW, BH) });
  const bw = Math.ceil(AW / 4), bh = Math.ceil(BH / 4), bloomA = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType }), bloomB = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const brightMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, px: { value: new THREE.Vector2(1 / bw, 1 / bh) }, dir: { value: new THREE.Vector2(1, 0) }, thr: { value: 0.0 } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tex; uniform vec2 px, dir; uniform float thr; varying vec2 vUv;
      vec3 f(vec2 uv){ vec3 c = texture2D(tex, uv).rgb; return thr > 0.0 ? max(c - vec3(thr), 0.0) : c; }
      void main(){ vec3 s = f(vUv) * 0.2270270; for (int i = 1; i < 5; i++) { float w = i == 1 ? 0.3162162 : i == 2 ? 0.0702703 : i == 3 ? 0.0 : 0.0; float o = i == 1 ? 1.3846154 : i == 2 ? 3.2307692 : 0.0; if (w > 0.0) { s += f(vUv + dir * px * o * 1.6) * w + f(vUv - dir * px * o * 1.6) * w; } } gl_FragColor = vec4(s, 1.0); }` });
  const compMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, tDepth: { value: null }, bloom: { value: null }, focus: { value: 12 }, coc: { value: T.coc ?? 0.012 }, near: { value: 0.1 }, far: { value: 200 }, bk: { value: T.bloom ?? 0.35 }, asp: { value: AW / BH }, ex: { value: T.exposure ?? 1.0 } }, vertexShader: VS, depthTest: false, depthWrite: false, toneMapped: false,
    fragmentShader: `uniform sampler2D tex, tDepth, bloom; uniform float focus, coc, near, far, bk, asp, ex; varying vec2 vUv;
      float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
      float cocAt(vec2 uv){ float L = lin(uv); return clamp(abs(L - focus) / max(focus * 0.55, 0.001), 0.0, 1.0) * coc; }
      const mat3 AIn = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 AOut = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){ c *= ex / 0.6; c = AIn * c; c = rrt(c); c = AOut * c; return clamp(c, 0.0, 1.0); }
      vec3 tap(vec2 uv){ return texture2D(tDepth, uv).x > 0.99999 ? vec3(0.9302, 0.8588, 0.7673) : aces(texture2D(tex, uv).rgb); }   // the ivory ground stays the page's ivory: only the picture goes through ACES
      void main(){ float c0 = cocAt(vUv); vec3 acc = tap(vUv); float wsum = 1.0;
        for (int i = 0; i < 20; i++) { float fi = float(i) + 0.5, r = sqrt(fi / 20.0), a = fi * 2.39996; vec2 o = vec2(cos(a) * r / asp, sin(a) * r) * c0; vec2 uv = vUv + o; float ci = cocAt(uv); float w = (ci >= r * c0 * 0.6 || lin(uv) > lin(vUv)) ? 1.0 : 0.2; acc += tap(uv) * w; wsum += w; }
        vec3 col = acc / wsum + aces(texture2D(bloom, vUv).rgb) * bk; gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        #include <colorspace_fragment>
      }` });
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };
  const finish = (sc, cam, focusDist) => {
    renderer.setRenderTarget(sceneRT); renderer.render(sc, cam);
    brightMat.uniforms.tex.value = sceneRT.texture; brightMat.uniforms.thr.value = 0.9; brightMat.uniforms.dir.value.set(1, 0); pass(brightMat, bloomA);
    brightMat.uniforms.tex.value = bloomA.texture; brightMat.uniforms.thr.value = 0.0; brightMat.uniforms.dir.value.set(0, 1); pass(brightMat, bloomB);
    brightMat.uniforms.tex.value = bloomB.texture; brightMat.uniforms.dir.value.set(1, 0); pass(brightMat, bloomA);
    compMat.uniforms.tex.value = sceneRT.texture; compMat.uniforms.tDepth.value = sceneRT.depthTexture; compMat.uniforms.bloom.value = bloomA.texture; compMat.uniforms.focus.value = focusDist; compMat.uniforms.near.value = cam.near; compMat.uniforms.far.value = cam.far;
    pass(compMat, null); };

  // ── the camera: one continuous flight, keyed ──────────────────────────────────────────────────────────
  const CAM = (T.camera || []).map((k) => ({ ...k, t: R(k.t) }));
  const catmull = (p0, p1, p2, p3, k) => 0.5 * ((2 * p1) + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k * k + (-p0 + 3 * p1 - 3 * p2 + p3) * k * k * k);
  const camAt = (t) => { let i = 0; while (i < CAM.length - 2 && t >= CAM[i + 1].t) i++; const a = CAM[i], b = CAM[i + 1];
    if (a.sc !== b.sc) { const c = t >= b.t - 0.02 ? b : a; return { pos: c.pos, look: c.look, fov: c.fov, roll: c.roll || 0, sc: c.sc }; }   // a hard cut between scenes
    const k = sm(seg(t, a.t, b.t)), p0 = CAM[Math.max(0, i - 1)].sc === a.sc ? CAM[Math.max(0, i - 1)] : a, p3 = CAM[Math.min(CAM.length - 1, i + 2)].sc === a.sc ? CAM[Math.min(CAM.length - 1, i + 2)] : b;
    const f = (key) => a[key].map((_, c) => catmull(p0[key][c], a[key][c], b[key][c], p3[key][c], k));
    return { pos: f("pos"), look: f("look"), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll || 0, b.roll || 0, k), sc: a.sc }; };
  const ph = { camAt };
  const camPose = (t, over) => { const c = over || camAt(t); camera.position.set(...c.pos); camera.fov = c.fov; camera.up.set(Math.sin((c.roll || 0) * D2R), Math.cos((c.roll || 0) * D2R), 0); camera.lookAt(...c.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); return c; };
  const render = (c, focusOverride) => { const fp = new THREE.Vector3(...c.look); finish(scene, camera, Math.max(2, focusOverride ?? fp.distanceTo(camera.position))); };
  return { THREE, T, R, EP, renderer, scene, camera, key, rim, mkCanvas, rnd, tex, fibres, makeTube, NV, glowTex, mkGlow, paintSet, finish, camAt, camPose, render, skinFrom, compMat, AW, BH, BTOP, artbox };
}

// look.js — "surgical green" in three.js: Meanwhile, Inside's palette, light rig, backdrop and material
// patches (films/channels/body/set, the channel's reusable set; bible §5 with the cross-check's fixes).
//
//   import { look } from "../set/look.js";
//   const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H });     // FILM.look = theme.json "scene"
//   scene.add(L.lights, L.backdrop);  scene.fog = L.fog;
//   L.patch(material, { fresnel: 0.35 });   // backdrop-matched fog + a fresnel rim (faked translucency)
//   window.seek = (t) => { ...camera...; L.place(camera, focusPoint); ... };
//
// The backdrop. The finish (cinema3d.js) blurs by depth, and on a transparent canvas the empty background
// reads as the far plane, so every silhouette got a dark rim (kits/cinema/film/README.md). The set therefore
// draws its own opaque backdrop: a sphere around the camera, far behind everything (finite depth), whose
// shader paints the channel's stage gradient in screen space (theme.json cssText: radial-gradient(120vmax
// 80vmax at 50% 30%, bg-hi 0%, bg 62%)). Its colours are ACES-inverted, so after the finish's tone map
// (ACES, as three's) the screen shows the tokens exactly, and a hashed dither keeps the dark gradient from
// banding. Fog fades every patched material to the backdrop's colour at its own pixel, not to one flat
// colour, so distance always melts into the stage.
//
// Lights (theme.json "scene"): hemisphere #DDF3EC / #0A1F1C at 0.5; a warm key #FFF1E6 at 2.2 from the
// top right; a mint rim #CFF5E6 at 1.4 from behind (mint, not pink: the cross-check moved it away from Skin
// School's rose). They are placed relative to the camera on every seek (L.place), a studio rig that
// travels with the lens, so the cells read the same in every shot. No shadow maps (render budget).
//
// acesInv(hex, exposure) → [r, g, b] linear scene values that the finish's ACES maps back to hex.

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexRgb = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255); };
// the finish's tone map (cinema3d.js cinAces = three's ACESFilmicToneMapping): exposure / 0.6, the input and
// output matrices (column-major in GLSL), the RRT + ODT fit, clamp
const IN = [[0.59719, 0.35458, 0.04823], [0.076, 0.90834, 0.01566], [0.0284, 0.13383, 0.83777]];
const OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const mul = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const rrt = (v) => v.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));
export const aces = (c, exposure = 1) => mul(OUT, rrt(mul(IN, c.map((x) => (x * exposure) / 0.6)))).map((x) => Math.min(1, Math.max(0, x)));
export const acesInv = (hex, exposure = 1) => {
  const want = hexRgb(hex).map(srgbToLin);
  // start from a grey guess: started at `want`, Newton can land where ACES clips a channel to 0 (its Jacobian row
  // vanishes there) and stay; #123A33 came back as #002A22
  const m = Math.max(1e-4, (want[0] + want[1] + want[2]) / 3);
  let c = [m, m, m];
  for (let it = 0; it < 60; it++) {                 // Newton with a numerical Jacobian (3×3), damped
    const f = aces(c, exposure), r = [f[0] - want[0], f[1] - want[1], f[2] - want[2]];
    if (Math.max(...r.map(Math.abs)) < 1e-7) break;
    const J = [0, 1, 2].map((j) => { const h = Math.max(1e-6, c[j] * 1e-4), d = c.slice(); d[j] += h; const g = aces(d, exposure); return [0, 1, 2].map((i) => (g[i] - f[i]) / h); });
    // solve J^T columns: J[j][i] = ∂f_i/∂c_j → A[i][j]
    const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => J[j][i]));
    const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const inv = [
      [(A[1][1] * A[2][2] - A[1][2] * A[2][1]) / det, (A[0][2] * A[2][1] - A[0][1] * A[2][2]) / det, (A[0][1] * A[1][2] - A[0][2] * A[1][1]) / det],
      [(A[1][2] * A[2][0] - A[1][0] * A[2][2]) / det, (A[0][0] * A[2][2] - A[0][2] * A[2][0]) / det, (A[0][2] * A[1][0] - A[0][0] * A[1][2]) / det],
      [(A[1][0] * A[2][1] - A[1][1] * A[2][0]) / det, (A[0][1] * A[2][0] - A[0][0] * A[2][1]) / det, (A[0][0] * A[1][1] - A[0][1] * A[1][0]) / det],
    ];
    const dc = mul(inv, r);
    c = c.map((x, i) => Math.max(1e-6, x - 0.8 * dc[i]));
  }
  return c;
};

export const look = (THREE, o) => {
  const tok = o.tokens || {}, sc = o.scene || {}, W = o.W, H = o.H;
  const lin = (hex) => new THREE.Color().setRGB(...hexRgb(hex).map(srgbToLin), THREE.LinearSRGBColorSpace);
  const exposure = o.exposure ?? 1;

  // ── the backdrop: the stage gradient, in screen space, ACES-inverted (9 stops along the CSS gradient) ──
  const bg = hexRgb(tok.bg || "#0A1F1C"), hi = hexRgb(tok["bg-hi"] || "#123A33");
  const STOPS = 9, table = [];
  for (let k = 0; k < STOPS; k++) {
    const u = k / (STOPS - 1), s = [0, 1, 2].map((i) => hi[i] + (bg[i] - hi[i]) * u);   // CSS mixes in sRGB
    const hex = "#" + s.map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
    const c = acesInv(hex, exposure), back = aces(c, exposure), want = hexRgb(hex).map(srgbToLin);
    if (Math.max(...back.map((x, i) => Math.abs(x - want[i]))) > 0.5 / 255) throw new Error(`look.js: the backdrop stop ${hex} does not round-trip through ACES`);
    table.push(new THREE.Vector3(...c));
  }
  const GRAD = `
    uniform vec3 uBgTable[${STOPS}]; uniform vec2 uRes;
    vec3 innerBg(vec2 fc) {
      // radial-gradient(120vmax 80vmax at 50% 30%, bg-hi 0%, bg 62%), y down as in CSS
      float vmax = max(uRes.x, uRes.y) / 100.0;
      vec2 d = vec2(fc.x - 0.5 * uRes.x, (uRes.y - fc.y) - 0.30 * uRes.y) / vec2(120.0 * vmax, 80.0 * vmax);
      float u = clamp(length(d) / 0.62, 0.0, 1.0) * ${(STOPS - 1).toFixed(1)};
      int i = int(floor(min(u, ${(STOPS - 1.001).toFixed(3)})));
      float f = u - float(i);
      vec3 a = uBgTable[0], b = uBgTable[0];
      for (int k = 0; k < ${STOPS}; k++) { if (k == i) a = uBgTable[k]; if (k == i + 1) b = uBgTable[k]; }
      if (i >= ${STOPS - 1}) b = a;
      return mix(a, b, f);
    }
    float bgDither(vec2 fc) { return fract(sin(dot(floor(fc), vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }`;
  const uniforms = { uBgTable: { value: table }, uRes: { value: new THREE.Vector2(W, H) }, uFogStart: { value: 0 } };
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(o.backdropRadius ?? 1500, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: true, fog: false,
    vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: GRAD + `
      void main(){
        vec3 c = innerBg(gl_FragCoord.xy);
        c *= 1.0 + bgDither(gl_FragCoord.xy) * 0.035;      // about ±0.5 of an 8-bit level after the tone map
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  backdrop.frustumCulled = false; backdrop.renderOrder = -10; backdrop.userData.noProbe = true;

  // ── lights: a rig that travels with the camera ──
  const lights = new THREE.Group();
  const hemi = new THREE.HemisphereLight(lin(sc["light-hemi-sky"] || "#DDF3EC"), lin(sc["light-hemi-ground"] || "#0A1F1C"), o.hemi ?? 0.35);
  const key = new THREE.DirectionalLight(lin(sc["light-key"] || "#FFF1E6"), 2.2);
  const rim = new THREE.DirectionalLight(lin(sc["light-rim"] || "#CFF5E6"), o.rim ?? 2.6);
  // a soft fill from below the lens: the cells' undersides (the parachute's inside) otherwise went near-black
  const fill = new THREE.DirectionalLight(lin(sc["light-fill"] || "#F3DDD3"), 0.9);
  lights.add(hemi, key, key.target, rim, rim.target, fill, fill.target);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const place = (camera, focus) => {
    camera.updateMatrixWorld();
    const f = focus ? vA.set(focus[0], focus[1], focus[2]) : camera.localToWorld(vA.set(0, 0, -30));
    key.target.position.copy(f); rim.target.position.copy(f); fill.target.position.copy(f);
    fill.position.copy(f).add(vB.set(-0.2, -0.85, 0.75).applyQuaternion(camera.quaternion).multiplyScalar(50));   // below, in front
    key.position.copy(f).add(vB.set(1.0, 1.25, 0.9).applyQuaternion(camera.quaternion).multiplyScalar(50));    // top right, in front
    rim.position.copy(f).add(vB.set(-0.35, 0.55, -1.0).applyQuaternion(camera.quaternion).multiplyScalar(50)); // behind the subject
    hemi.position.set(0, 1, 0);
    backdrop.position.copy(camera.position);
  };

  // ── fog to the backdrop, and a fresnel rim, patched into any built-in lit material ──
  const fog = new THREE.FogExp2(lin(tok.bg || "#0A1F1C"), o.fogDensity ?? 0.006);
  const rimCol = lin(sc["light-rim"] || "#CFF5E6");
  const patch = (m, p = {}) => {
    const fres = p.fresnel ?? 0, fresPow = p.fresnelPower ?? 3, prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      Object.assign(sh.uniforms, uniforms, { uFres: { value: fres }, uFresCol: { value: rimCol }, uFresPow: { value: fresPow } });
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + GRAD + "\nuniform float uFres, uFresPow, uFogStart; uniform vec3 uFresCol;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += uFresCol * uFres * pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uFresPow);")
        .replace("#include <fog_fragment>", `#ifdef USE_FOG
          float fogD = max(0.0, vFogDepth - uFogStart), fogF = 1.0 - exp(-fogDensity * fogDensity * fogD * fogD);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, innerBg(gl_FragCoord.xy), fogF);
        #endif`);
    };
    m.customProgramCacheKey = () => `mi-look-${fres}-${fresPow}-${p.key || ""}`;
    return m;
  };
  // live scan finish (3 Nov): film grain (deterministic in t) and a soft vignette, DOM layers over the frame; L.finish(root).set(t)
  const finish = (root, { grain = 0.012, vignette = 0.5 } = {}) => {
    const v = document.createElement("div");
    Object.assign(v.style, { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, background: `radial-gradient(130% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,4,5,${vignette}) 100%)` });
    const c = document.createElement("canvas"), N = 256; c.width = c.height = N;
    Object.assign(c.style, { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "overlay", opacity: String(grain * 8), zIndex: 1 });
    root.append(v, c);   // into .stage, after the canvas (z 1) and under #hud (z 3), so the grain blends with the picture
    const k = c.getContext("2d"), img = k.createImageData(N, N);
    return { set(t) { let x = (1 + Math.floor(t * 30)) * 2654435761 >>> 0; for (let i = 0; i < img.data.length; i += 4) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; const g = 128 + ((x & 255) - 128); img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255; } k.putImageData(img, 0, 0); } };
  };
  // an HDR studio for reflections (clearcoat, sheen): a warm key softbox, a cool rim strip, the teal bounce, a faint chartreuse kicker
  const studio = (renderer, scene, k = 0.6) => {
    const env = new THREE.Scene(); env.background = new THREE.Color(0x020807);
    const box = (w, h, color, i, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i * k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m); };
    box(7, 4, 0xfff0e2, 5, [-6, 7, 6]); box(1.5, 9, 0xe8fff4, 4, [7, 2, -7]); box(10, 2, 0x0f3a33, 1.5, [0, -6, 3]); box(2, 2, 0xd6f25f, 0.6, [8, -1, 5]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.03).texture;   // r160: no scene.environmentIntensity, so k scales the boxes
  };
  // atmosphere: motes riding with the camera at fixed depths (the finish's depth of field turns the near ones into bokeh).
  // Positions are a pure function of t; hidden from the finish's probe (they are not what moves in the shot).
  const motes = (camera, { n = 160, zNear = 3, zFar = 300, size = 5, color = "#FFF1E6", op = 0.45 } = {}) => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"), g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64);
    const pos = new Float32Array(n * 3), seed = [];
    let x = 2463534242; const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
    for (let i = 0; i < n; i++) seed.push([rnd() * 2 - 1, rnd() * 2 - 1, rnd(), rnd() * 6.283]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size, sizeAttenuation: false, color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.userData.noProbe = true; camera.add(pts);
    return { points: pts, set(t, o = 1) {
      pts.visible = o > 0.002; m.opacity = op * o;
      const cam = camera, th = Math.tan((cam.fov * Math.PI) / 360);
      seed.forEach(([sx, sy, sz, ph], i) => { const z = -(zNear + (zFar - zNear) * sz * sz), hh = -z * th, ww = hh * cam.aspect;   // more of them near the lens
        pos[3 * i] = (sx + 0.06 * Math.sin(t * 0.23 + ph)) * ww; pos[3 * i + 1] = (((sy + 1 + 0.03 * t + 0.05 * Math.sin(t * 0.31 + ph * 2)) % 2) - 1) * hh; pos[3 * i + 2] = z; });
      geo.attributes.position.needsUpdate = true; } };
  };
  return { lights, backdrop, fog, place, patch, lin, acesInv: (h) => acesInv(h, exposure), uniforms, hemi, key, rim, finish, studio, motes };
};

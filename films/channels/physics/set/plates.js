// plates.js: photographic PLATES behind the code-animated physics subjects (the way One More Orbit uses its paintings).
//
//   const plates = createPlates({ scene, camera, W, H, FILM, canvas });     // FILM.plates = [ plate, ... ] (film.json)
//   window.SCENE_READY = plates.ready;                                // resolves when every plate image is loaded (or has failed: never rejects)
//   if (plates.apply(t)) { /* a plate is on screen: hide the code kitchen */ }
//   const c = plates.cam(t);                                          // the plate's own camera ({look, fitW, yaw, pitch}) or null
//   const a = plates.anchor(t);                                       // where the subject goes for this plate (world position, scale, tint, shadow, focus), or null
//
// plate: { id, t0, t1, file, file9, push, parallax, fade, cam, anchor, layers }
//   file / file9   the 16:9 and the 9:16 image (paths relative to this file's folder, e.g. "../lf01/art/plates/kitchen-wide_16x9.png")
//   push           the slow push across the shot: the picture scales 1 -> 1 + push (default 0.05)
//   parallax       a sideways drift of the picture across the shot, as a fraction of the frame width (default 0.02)
//   layers         [{ file, file9, depth }]: depth slices cut from the plate (PNG with alpha), nearest last; each drifts by its own amount (2.5D)
//   fade           seconds of cross-fade at the ends of the shot (default 0.35)
//   cam            { look, fitW, yaw, pitch }: pins the code camera for the shot so the subjects line up with the plate
//   cam3           { pos: [x, y, z], target: [x, y, z], fov }: a pinhole camera that matches the plate (the vertical field of view in degrees); the push is a zoom of that field, so the proxy room stays aligned
//   anchor         { pos: [x, y, z], scale, tint: "#rrggbb", shadow: 0..1, focus: [x, y, z], fstop }: where the code subject sits, its light tint, its contact shadow and the depth of field
// The plate is a DOM image BEHIND the 3-D canvas (the canvas is transparent where nothing is drawn), so the cinema finish (ACES, bloom, grade) never touches it:
// its pixels reach the screen exactly as the source file has them. Only the code subjects and the shell go through the finish.
// Missing or unreadable images switch that plate off, and the code kitchen is drawn instead (the fallback).


// A night plate shows the picture with the lamp's light taken out (the DOM image) and reveals the original pixels where the light front has been.
// A small WebGL2 canvas does the mix, in display colours, so the finish never touches it. The distance of every plate pixel from the lamp is solved once, by casting each pixel's ray into the plate's room box.
const nightGL = (it, off, orig) => {
  const n = it.p.night, cam = it.p.cam3, room = n.room, mw = 836, mh = 470, cv = document.createElement("canvas"); cv.width = it.W; cv.height = it.H;
  const gl = cv.getContext("webgl2", { alpha: false, preserveDrawingBuffer: true, antialias: false }); if (!gl) return null;
  const ppm = 470.5 / Math.tan((cam.fov * Math.PI) / 360), dist = new Float32Array(mw * mh), P = cam.pos, L = n.lamp;
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    const dx = ((i + 0.5) * 2 - 836) / ppm, dy = -(((j + 0.5) * 2) - 470.5) / ppm, dz = -1; let best = 1e9;
    const hit = (t, ok) => { if (t > 0 && t < best && ok(P[0] + dx * t, P[1] + dy * t, P[2] + dz * t)) best = t; };
    hit((room.x0 - P[0]) / dx, (x, y, z) => y > 0 && y < room.h && z > room.z0); hit((room.x1 - P[0]) / dx, (x, y, z) => y > 0 && y < room.h && z > room.z0);
    hit((0 - P[1]) / dy, (x, y, z) => x > room.x0 && x < room.x1 && z > room.z0); hit((room.h - P[1]) / dy, (x, y, z) => x > room.x0 && x < room.x1 && z > room.z0);
    hit((room.z0 - P[2]) / dz, (x, y, z) => x > room.x0 && x < room.x1 && y > 0 && y < room.h);
    if (room.table) { const T = room.table; hit((T.y - P[1]) / dy, (x, y, z) => x > T.x0 && x < T.x1 && z > T.z0 && z < T.z1); }
    const x = P[0] + dx * best, y = P[1] + dy * best, z = P[2] + dz * best; dist[j * mw + i] = Math.hypot(x - L[0], y - L[1], z - L[2]);
  }
  const mkTex = (unit, fn) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); fn(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  mkTex(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off)); mkTex(1, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, orig));
  mkTex(2, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, mw, mh, 0, gl.RED, gl.FLOAT, dist));
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; }, pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, "#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; uniform sampler2D tOff, tOrig, tDist; uniform vec2 uRes, uPlate; uniform float uCs, uShift, uR, uW; out vec4 o;
void main(){ vec2 f = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); vec2 p = vec2(836.0 + (f.x - uRes.x * 0.5 - uShift) / uCs, 470.5 + (f.y - uRes.y * 0.5) / uCs); vec2 uv = p / uPlate;
  vec3 a = texture(tOff, uv).rgb, b = texture(tOrig, uv).rgb; float d = texture(tDist, uv).r;
  float m = uR > 0.0 ? smoothstep(uR + 0.5 * uW, uR - 0.5 * uW, d) : 0.0, e = uR > 0.0 ? exp(-pow((d - uR) / (0.22 * uW + 0.012), 2.0)) : 0.0, g = uR > 0.0 ? 0.3 * exp(-pow((d - uR) / (1.6 * uW), 2.0)) : 0.0;
  vec3 c = mix(a, b, m); vec3 lin = pow(c, vec3(2.2)); float lu = dot(b, vec3(0.3, 0.55, 0.15));
  lin += vec3(1.0, 0.76, 0.34) * (e * (0.35 + 0.9 * lu) * 0.9 + g * (0.1 + 0.4 * lu)) * step(0.0, uR);
  o = vec4(pow(min(lin, vec3(1.0)), vec3(1.0 / 2.2)), 1.0); }`));
  gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (k) => gl.getUniformLocation(pr, k); gl.uniform1i(U("tOff"), 0); gl.uniform1i(U("tOrig"), 1); gl.uniform1i(U("tDist"), 2);
  gl.uniform2f(U("uRes"), it.W, it.H); gl.uniform2f(U("uPlate"), 1672, 941); gl.uniform1f(U("uCs"), Math.max(it.W / 1672, it.H / 941)); gl.viewport(0, 0, it.W, it.H);
  return { cv, draw: (R, w, shiftPx) => { gl.uniform1f(U("uR"), R); gl.uniform1f(U("uW"), w); gl.uniform1f(U("uShift"), shiftPx || 0); gl.drawArrays(gl.TRIANGLES, 0, 3); } };
};
export const createPlates = ({ scene, camera, W, H, FILM, canvas }) => {
  const nine = H > W, list = (FILM.plates || []).filter(Boolean);
  const load = (file) => new Promise((res) => {
    if (!file) return res(null);
    const im = new Image(); im.decoding = "sync";
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => res(im)); }; im.onerror = () => res(null);
    im.src = new URL(file, import.meta.url).href;
  });
  const mk = (im, z) => {
    im.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;object-fit:cover;display:none;transform-origin:50% 50%;will-change:transform;pointer-events:none;`;
    canvas.parentNode.insertBefore(im, canvas); im.dataset.z = z; return im;
  };
  const items = list.map((p) => ({ p, imgs: [], ok: false, W, H }));
  const ready = Promise.all(items.map(async (it) => {
    const layers = it.p.layers && it.p.layers.length ? it.p.layers : [{ file: it.p.file, file9: it.p.file9, depth: 0 }];
    if (it.p.swap) { const sw = await load(nine ? it.p.swap.file9 || it.p.swap.file : it.p.swap.file); if (sw) { mk(sw, 0); sw.dataset.depth = 0; it.swapImg = sw; } }
    const ims = await Promise.all(layers.map((l) => load(nine ? l.file9 || l.file : l.file)));
    if (it.p.night) { const og = await load(it.p.night.orig); if (!og) { it.ok = false; return; } it.nightOrig = og; }
    if (ims.some((m) => !m)) { it.ok = false; return; }
    it.imgs = ims.map((im, i) => { mk(im, i); im.dataset.depth = layers[i].depth || 0; return im; });
    if (it.p.night) { it.night = nightGL(it, ims[0], it.nightOrig); if (!it.night) { it.ok = false; return; } mk(it.night.cv, 9); it.night.cv.dataset.depth = 0; it.imgs = [it.night.cv]; }
    it.ok = true;
  })).catch(() => {});
  const active = (t) => { for (const it of items) if (it.ok && t >= it.p.t0 && t < it.p.t1) return it; return null; };
  // where the picture is moved so its subject sits at the frame's centre (metres at 1 m, the camera aims the same way): 9:16 uses shift9 at once, a push-in ramps its shift with the push so the picture's edge never shows
  const shiftAt = (it, t) => { const p = it.p, d = Math.max(0, Math.min(1, (t - p.t0) / (p.t1 - p.t0))), sh = nine && p.shift9 ? p.shift9 : p.shift; if (!sh) return { x: 0, y: 0, ppm: 1 }; const k = nine && p.shift9 ? 1 : d; return { x: sh.x * k, y: (sh.y || 0) * d, ppm: sh.ppm }; };
  const apply = (t) => {
    for (const it of items) { for (const im of it.imgs) im.style.display = "none"; if (it.swapImg) it.swapImg.style.display = "none"; }
    const it = active(t); if (!it) return false;
    const p = it.p, d = Math.max(0, Math.min(1, (t - p.t0) / (p.t1 - p.t0))), f = p.fade ?? 0.35;
    const a = Math.min(1, (t - p.t0) / f, (p.t1 - t) / f), push = p.push ?? 0.05, par = p.parallax ?? 0.02;
    const swapped = it.swapImg && t >= it.p.swap.t;
    (swapped ? [it.swapImg] : it.imgs).forEach((im) => {
      const dep = +im.dataset.depth || 0, s = 1 + push * d * (p.cam3 ? 1 : 1 + 0.6 * dep), shift = par * (d - 0.5) * W * (1 + dep), over = p.over ?? (p.cam3 ? 1 : 1.04);
      const cs = im.naturalWidth ? Math.max(W / im.naturalWidth, H / im.naturalHeight) : 1, sf = shiftAt(it, t), sh9 = -sf.x * sf.ppm * cs, shy = sf.y * sf.ppm * cs;   // 9:16: the crop is moved so the subject sits at the centre (the camera yaws the same amount)
      im.style.display = "block"; if (im.tagName === "IMG") im.style.objectPosition = `calc(50% + ${sh9.toFixed(2)}px) calc(50% + ${shy.toFixed(2)}px)`; im.style.opacity = String(Math.max(0, Math.min(1, a))); im.style.transform = `translate(${shift.toFixed(2)}px,0) scale(${(s * over).toFixed(5)})`;
    });
    return true;
  };
  const cam = (t) => { const it = active(t); return it && it.p.cam ? it.p.cam : null; };
  const zoom = (t) => { const it = active(t); if (!it) return 1; const p = it.p; return 1 + (p.push ?? 0.05) * Math.max(0, Math.min(1, (t - p.t0) / (p.t1 - p.t0))); };
  const cam3 = (t) => { const it = active(t); if (!it || !it.p.cam3) return null; const c = it.p.cam3; const sf = shiftAt(it, t); return sf.x || sf.y ? { ...c, target: [c.target[0] + sf.x, c.target[1] + sf.y, c.target[2]] } : c; };
  const anchor = (t) => { const it = active(t); return it && it.p.anchor ? it.p.anchor : null; };
  const drawNight = (t, R, w) => { const it = active(t); if (!it || !it.night) return false; const sf = shiftAt(it, t), sh9 = -sf.x * sf.ppm * Math.max(W / 1672, H / 941); it.night.draw(R, w, sh9); return true; };
  const imageOf = (id) => { const it = items.find((q) => q.p.id === id); return it && it.ok ? it.imgs[0] : null; };
  return { ready, apply, cam, cam3, zoom, anchor, active, items, imageOf, drawNight };
};

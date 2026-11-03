// uvcam.js — Outer Layer's signature reveal (films/channels/skincare/set): skin seen through a 365 nm camera.
//   createUVSkin(o): a domed skin surface shaded in the fragment shader as a UV photograph. Uniforms set from t:
//     set({ damage, damageR, screen, screenR, split, focus: [u, v, r, k], glow, seam, opacity, bump, spotRed })   (bump, spotRed: 0 = off)
//       damage / damageR: 0 … 1, sun freckles on the left / right half (split 0 → one surface, damage everywhere)
//       screen / screenR: 0 … 1, sunscreen (absorbs UV: the surface reads dark) on the left / right half
//       split: 0 … 1, the cyan seam down the middle (and the halves' independent values)
//       focus: a cyan-lit disc at (u, v) of radius r, strength k (the thing the episode is about: a follicle, a spot)
//       glow: overall UV brightness; opacity: fades the whole surface (an oval vignette is built in)
//   createViewfinder(o): DOM corner brackets, "● REC  UV 365 nm" and two half labels, as fractions of W × H;
//     set({ op, left, right }) shows it and writes the half labels.
//   createDaylight(o): the daylight strip, three tone discs on a plate (light · medium · deep); set({ op }).
// Colours are the theme's: the glow is lilac-violet, the instrument cyan; never under text.
import * as THREE from "three";

export const createUVSkin = ({ width = 7.2, height = 5.0, dome = 1.7, seed = 1.0, segs = [300, 220] } = {}) => {
  const geo = new THREE.PlaneGeometry(width, height, segs[0], segs[1]);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, dome * Math.exp(-(x * x) / (width * 1.4) - (y * y) / (height * 1.2))); }
  geo.computeVertexNormals();
  const U = { uDamage: { value: 0 }, uDamageR: { value: 0 }, uScreen: { value: 0 }, uScreenR: { value: 0 }, uSplit: { value: 0 },
    uFocus: { value: new THREE.Vector4(0.5, 0.5, 0.0, 0.0) }, uGlow: { value: 1 }, uOpacity: { value: 1 }, uSeed: { value: seed }, uPorph: { value: 0 }, uRings: { value: 0 }, uSpot: { value: 0 }, uDay: { value: 0 }, uSkin: { value: new THREE.Vector3(0.62, 0.42, 0.3) }, uRed: { value: 0 }, uScar: { value: 0 }, uBump: { value: 0 }, uSpotRed: { value: 0 }, uRingR: { value: 0 }, uWipe: { value: -1 }, uForm: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    // uBump (default 0): the spot raised as a bump at the focus point (No. 001); the normal is tilted to match
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP; uniform vec4 uFocus; uniform float uBump;
      void main(){ vUv = uv; vec3 q = position; vec3 nn = normal;
        if (uBump > 0.0) { vec2 d = (uv - uFocus.xy) * vec2(1.44, 1.0); float r = max(uFocus.z, 1e-3); float b = uBump * exp(-dot(d, d) / (r * r * 0.45));
          q.z += b; nn = normalize(nn + vec3(-d.x, -d.y, 0.0) * b * 6.0 / (r * r)); }
        vN = normalize(normalMatrix * nn); vec4 p = modelViewMatrix * vec4(q,1.); vP = p.xyz; gl_Position = projectionMatrix * p; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      uniform float uDamage, uDamageR, uScreen, uScreenR, uSplit, uGlow, uOpacity, uSeed, uPorph, uRings, uSpot, uDay, uRed, uScar, uSpotRed, uRingR, uWipe, uForm; uniform vec4 uFocus; uniform vec3 uSkin;
      float h(vec2 p){ return fract(sin(dot(p + uSeed, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      float cells(vec2 p){ vec2 i=floor(p), f=fract(p); float d=9.; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(h(i+g),h(i+g+7.3)); d=min(d,length(g+o-f)); } return d; }
      void main(){
        vec2 uv = vUv;
        float right = mix(1.0, smoothstep(0.495, 0.505, uv.x), uSplit);       // with no split, the "right" values apply everywhere
        float dmg = mix(uDamage, uDamageR, right), scr = mix(uScreen, uScreenR, right);
        float pores = smoothstep(0.05, 0.16, cells(uv*vec2(70.,49.)));
        float grain = fbm(uv*vec2(18.,13.));
        float f1 = smoothstep(0.55, 0.72, fbm(uv*vec2(9.,6.5)+3.1)) * smoothstep(0.38,0.10,cells(uv*vec2(36.,25.)+1.7));
        float f2 = smoothstep(0.30,0.08,cells(uv*vec2(64.,44.)+9.2)) * step(0.62, h(floor(uv*vec2(64.,44.)+9.2)));
        // a scar band across the middle (No. 003): no pores, no pigment pattern, a smooth seam that glows evenly
        float scar = uScar * smoothstep(0.075, 0.045, abs(uv.y - 0.5 - 0.03 * sin(uv.x * 9.0)));
        pores = mix(pores, 1.0, scar); grain = mix(grain, 0.55, scar);
        float spots = dmg * (0.95*f1 + 0.75*f2) * (1.0 - scar);
        float lum = (0.48 + 0.22*grain) * uGlow;
        lum *= mix(1.0, 0.32, scr);
        lum *= mix(0.72, 1.0, pores);
        lum *= 1.0 - 0.82*spots;
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.0);
        vec3 glow = mix(vec3(0.22,0.12,0.62), vec3(0.62,0.48,1.0), lum);
        vec3 col = glow * lum * 0.95 + vec3(0.25,0.85,0.95) * rim * 0.25;
        // follicles (one in about six pore cells): orange-red porphyrin glow, and faint cyan rings (immune cells)
        vec2 fc = uv*vec2(26.,18.); vec2 fi = floor(fc); float fsel = step(0.62, h(fi + 3.3));
        float fdist = length(fract(fc) - 0.5 - (vec2(h(fi+1.1), h(fi+2.2)) - 0.5) * 0.5);
        col = mix(col, vec3(1.0,0.38,0.2) * 1.25, uPorph * fsel * smoothstep(0.16, 0.05, fdist));
        // uRingR (default 0 = everywhere): only the follicles within that radius of the focus point ring
        float near = uRingR > 0.0 ? smoothstep(uRingR, uRingR * 0.55, length((uv - uFocus.xy) * vec2(1.44, 1.0))) : 1.0;
        col = mix(col, vec3(0.37,0.95,0.91), clamp(uRings * near * fsel * 0.55 * smoothstep(0.03, 0.0, abs(fdist - 0.19)), 0.0, 1.0));
        // the spot: a raised inflamed blob at the focus point, dark under UV (blood absorbs it)
        float sd = length((uv - uFocus.xy) * vec2(1.44, 1.0));
        col *= 1.0 - uSpot * 0.75 * smoothstep(uFocus.z * 0.7, 0.0, sd);
        float fd = length((uv - uFocus.xy) * vec2(1.44, 1.0));
        float fo = uFocus.w * (smoothstep(uFocus.z, uFocus.z * 0.55, fd) * 0.55 + smoothstep(uFocus.z * 1.08, uFocus.z, fd) * smoothstep(uFocus.z * 0.9, uFocus.z, fd) * 0.9);
        col = mix(col, vec3(0.37,0.95,0.91), clamp(fo, 0.0, 1.0));
        // uSpotRed (default 0): a wine-red inflamed core inside the cyan ring, so the spot reads as a red spot (No. 001)
        col = mix(col, vec3(0.66, 0.1, 0.16) * (0.75 + 0.6 * pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 0.5)), uSpotRed * uSpot * smoothstep(uFocus.z * 0.8, uFocus.z * 0.25, sd));
        // daylight mode (uDay): the same skin in visible light, warm side light, more blood colour with uRed
        float ndl = clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.5, 0.8))), 0.0, 1.0);
        vec3 day = uSkin * (0.72 + 0.28 * grain) * mix(0.86, 1.0, pores) * (0.55 + 0.6 * ndl);
        day = mix(day, day * vec3(1.18, 0.82, 0.8), uRed);
        // the red spot shows in daylight too (No. 001)
        day = mix(day, vec3(0.72, 0.2, 0.2) * (0.6 + 0.5 * ndl), uSpotRed * uSpot * smoothstep(uFocus.z * 0.8, uFocus.z * 0.25, sd));
        // uWipe (default -1 = off; 0 … 1): the UV switch as a wipe from the top: above the line UV, below it daylight, the line cyan
        float wl = 1.0 - uWipe;
        float dayK = uWipe < 0.0 ? uDay : uDay * (1.0 - smoothstep(wl - 0.004, wl + 0.004, uv.y));
        col = mix(col, day, dayK);
        if (uWipe > 0.0 && uWipe < 1.0) col = mix(col, vec3(0.37,0.95,0.91), smoothstep(0.006, 0.0, abs(uv.y - wl)));
        // uForm (default 0 = as before; 0 … 1, Skin Sense look v2): the skin given form: micro relief from its own pore and
        // grain pattern, a key from the upper left, a rim (cyan under UV, warm in daylight), a small oily highlight
        if (uForm > 0.0) {
          float hh = 0.55 * fbm(uv * vec2(36., 26.)) - 0.35 * (1.0 - pores) - 0.2 * spots;
          vec3 Nn = normalize(vN); vec3 Np = normalize(Nn + uForm * 18.0 * vec3(-dFdx(hh), -dFdy(hh), 0.0));
          vec3 V = normalize(-vP), L = normalize(vec3(-0.45, 0.6, 0.65)); float kd = clamp(dot(Np, L), 0.0, 1.0);
          float rimF = pow(1.0 - clamp(dot(Np, V), 0.0, 1.0), 2.5), sp = pow(clamp(dot(Np, normalize(L + V)), 0.0, 1.0), 40.0);
          vec3 lit = col * (0.22 + 1.1 * kd) + rimF * mix(vec3(0.35, 0.75, 0.95), vec3(1.0, 0.6, 0.5), dayK) * 0.35 + sp * 0.16 * vec3(1.0, 0.95, 0.9);
          col = mix(col, lit, uForm);
        }
        float seam = uSplit * (1.0 - smoothstep(0.0, 0.0025, abs(uv.x - 0.5)));
        col = mix(col, vec3(0.37,0.95,0.91), seam);
        vec2 e = (uv - 0.5) * 2.0; float edge = smoothstep(1.0, 0.82, length(e * vec2(1.04, 1.0)));
        float edgeSoft = smoothstep(1.05, 0.5, length(e * vec2(1.04, 1.0)));   // with form: the surface falls away into the dark, not a cut-out card
        col *= mix(1.0, 0.5 + 0.5 * edgeSoft, uForm); edge = mix(edge, edgeSoft, uForm);
        gl_FragColor = vec4(col, edge * uOpacity);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh, uniforms: U,
    // porph: follicle bacteria glowing orange-red; rings: faint cyan immune rings at the same follicles; spot: the focus point as an inflamed blob
    // day: 0 UV … 1 daylight; skin: the daylight tone (rgb); red: more blood colour (a flush)
    set({ damage = 0, damageR = null, screen = 0, screenR = null, split = 0, focus = null, glow = 1, opacity = 1, porph = 0, rings = 0, spot = 0, day = 0, skin = null, red = 0, scar = 0, bump = 0, spotRed = 0, ringR = 0, wipe = -1, form = 0 } = {}) {
      U.uForm.value = form; U.uScar.value = scar; U.uBump.value = bump; U.uSpotRed.value = spotRed; U.uRingR.value = ringR; U.uWipe.value = wipe;
      U.uPorph.value = porph; U.uRings.value = rings; U.uSpot.value = spot; U.uDay.value = day; U.uRed.value = red; if (skin) U.uSkin.value.set(...skin);
      U.uDamage.value = damage; U.uDamageR.value = damageR ?? damage; U.uScreen.value = screen; U.uScreenR.value = screenR ?? screen;
      U.uSplit.value = split; U.uGlow.value = glow; U.uOpacity.value = opacity; mesh.visible = opacity > 0.002;
      if (focus) U.uFocus.value.set(...focus); else U.uFocus.value.w = 0;
    },
    // a point on the surface at (u, v) in the mesh's local frame (for labels)
    at: (u, v) => { const x = (u - 0.5) * width, y = (v - 0.5) * height; return [x, y, dome * Math.exp(-(x * x) / (width * 1.4) - (y * y) / (height * 1.2))]; },
  };
};

const STYLE = `.ol-vf{position:absolute;z-index:2;pointer-events:none;font-family:var(--font-mono);color:var(--water);font-size:2.5vmin}
.ol-vf .c{position:absolute;width:5vmin;height:5vmin;border:.45vmin solid var(--water)}
.ol-vf .tl{left:0;top:0;border-right:0;border-bottom:0}.ol-vf .tr{right:0;top:0;border-left:0;border-bottom:0}
.ol-vf .bl{left:0;bottom:0;border-right:0;border-top:0}.ol-vf .br{right:0;bottom:0;border-left:0;border-top:0}
.ol-vf .rec{position:absolute;right:6.5vmin;top:1.6vmin;letter-spacing:.08em;font-size:var(--ol-rec-size,2.5vmin);font-weight:var(--ol-rec-weight,400)}
.ol-vf .hl,.ol-vf .hr{position:absolute;bottom:1.6vmin;color:var(--text);letter-spacing:.06em;text-transform:uppercase}
.ol-vf .hl{left:6.5vmin}.ol-vf .hr{right:6.5vmin}
.ol-day{position:absolute;z-index:4;pointer-events:none;transform:translateX(-50%);display:flex;align-items:center;gap:2.4vmin;padding:1.1vmin 2.4vmin;border-radius:2.4vmin;background:var(--hud-plate);box-shadow:var(--hud-shadow);font-family:var(--font-mono);color:var(--text-2);font-size:2.6vmin}
.ol-day .k{letter-spacing:.08em;text-transform:uppercase}.ol-day .s{display:flex;align-items:center;gap:1vmin;color:var(--text)}
.ol-day i{display:block;width:5.4vmin;height:5.4vmin;border-radius:50%}`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = STYLE; document.head.appendChild(s); };

// the viewfinder: x, y, w, h as fractions of the frame (inside the safe box)
export const createViewfinder = ({ root, W, H, x = 0.1, y = 0.27, w = 0.8, h = 0.33 } = {}) => {
  style();
  const el = document.createElement("div");
  el.className = "ol-vf";
  el.innerHTML = `<b class="c tl"></b><b class="c tr"></b><b class="c bl"></b><b class="c br"></b><span class="rec">● REC  UV 365 nm</span><span class="hl"></span><span class="hr"></span>`;
  Object.assign(el.style, { left: `${x * W}px`, top: `${y * H}px`, width: `${w * W}px`, height: `${h * H}px`, opacity: "0" });
  root.appendChild(el);
  const hl = el.querySelector(".hl"), hr = el.querySelector(".hr"), rec = el.querySelector(".rec");
  return {
    el,
    set({ op = 1, left = "", right = "", blink = 1 } = {}) {
      el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden";
      hl.textContent = left; hr.textContent = right; rec.style.opacity = blink.toFixed(2);
    },
  };
};

export const TONES = [["#F1C9A9", "light"], ["#B9825C", "medium"], ["#6B4129", "deep"]];
export const createDaylight = ({ root, W, H, y = 0.655, label = "in daylight" } = {}) => {
  style();
  const el = document.createElement("div");
  el.className = "ol-day";
  el.innerHTML = `<div class="k">${label}</div>${TONES.map(([c, n]) => `<div class="s"><i style="background:radial-gradient(circle at 35% 30%, #ffffff33, transparent 60%), ${c}"></i><span>${n}</span></div>`).join("")}`;
  Object.assign(el.style, { left: "50%", top: `${y * H}px`, opacity: "0" });
  root.appendChild(el);
  return { el, set({ op = 1 } = {}) { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; } };
};

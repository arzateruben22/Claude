import * as THREE from "three";
// Look concept A, "UV camera": one face-sized patch of skin, seen through a 365 nm camera. Left half: ten years of daily
// sunscreen (model). Right half: ten years without (model). Through UV, sunscreen absorbs and reads dark; pigment that
// the sun has laid down unevenly shows as freckles the eye can't see. A daylight strip below shows three tones as the
// eye sees them. A still for the owner's pick, not an episode.
import { createHud } from "cinema/sci/hud.js";

const FILM = window.FILM, W = window.W, H = window.H;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 6, threshold: 0.88, bloom: 0.35, exposure: 1.0 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 1, 100);
camera.position.set(0, -1.9, 30); camera.lookAt(0, -1.35, 0);   // the skin sits high (y ≈ 0.42 H), clear of the captions

// the skin: a gently domed sheet (a cheek), shaded in the fragment shader as a UV photograph
const geo = new THREE.PlaneGeometry(7.2, 5.0, 300, 220);
const pos = geo.attributes.position;
for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, 1.7 * Math.exp(-(x * x) / 10 - (y * y) / 6)); }
geo.computeVertexNormals();
const mat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position,1.); vP = p.xyz; gl_Position = projectionMatrix * p; }`,
  fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
    float cells(vec2 p){ vec2 i=floor(p), f=fract(p); float d=9.; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(h(i+g),h(i+g+7.3)); d=min(d,length(g+o-f)); } return d; }
    void main(){
      vec2 uv = vUv;
      float right = smoothstep(0.495, 0.505, uv.x);                    // the seam: left daily SPF, right none
      float pores = smoothstep(0.05, 0.16, cells(uv*vec2(70.,49.)));    // pores: small dark pits
      float grain = fbm(uv*vec2(18.,21.));
      // freckles: sun-laid pigment, clustered; dense on the unprotected half, sparse on the protected one
      float f1 = smoothstep(0.55, 0.72, fbm(uv*vec2(9.,6.5)+3.1)) * smoothstep(0.38,0.10,cells(uv*vec2(36.,25.)+1.7));
      float f2 = smoothstep(0.30,0.08,cells(uv*vec2(64.,44.)+9.2)) * step(0.62, h(floor(uv*vec2(64.,44.)+9.2)));
      float spots = mix(0.18*f1 + 0.10*f2, 0.95*f1 + 0.75*f2, right);
      // UV luminance: skin glows violet-blue; sunscreen absorbs and reads dark (left half, with a glossy edge)
      float lum = 0.48 + 0.22*grain;
      lum *= mix(0.32, 1.0, right);
      lum *= mix(0.72, 1.0, pores);
      lum *= 1.0 - 0.82*spots;
      float rim = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.0);
      vec3 glow = mix(vec3(0.22,0.12,0.62), vec3(0.62,0.48,1.0), lum);
      vec3 col = glow * lum * 0.95 + vec3(0.25,0.85,0.95) * rim * 0.25;
      float seam = 1.0 - smoothstep(0.0, 0.0025, abs(uv.x - 0.5));        // the cyan split line
      col = mix(col, vec3(0.37,0.95,0.91), seam);
      vec2 e = (uv - 0.5) * vec2(2.0, 2.0); float edge = smoothstep(1.0, 0.82, length(e * vec2(1.04, 1.0)));   // a soft oval: a cheek in the viewfinder
      gl_FragColor = vec4(col, edge);
    }`,
  transparent: true,
});
const skin = new THREE.Mesh(geo, mat); skin.position.y = 0.0; skin.rotation.x = -0.18;
scene.add(skin);

// the overlay
const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions);
const at = (p) => () => p;
hud.label("l-spf", { text: "sunscreen: dark in UV", glyph: "◆", mark: "none", color: "water", at: at([-1.6, 1.7, 1.0]), t0: 0, t1: 9, side: -1, v: "above", fixed: true });
hud.label("l-dmg", { text: "hidden sun damage", glyph: "◆", mark: "none", color: "uv", at: at([1.7, -1.6, 1.0]), t0: 0, t1: 9, side: 1, v: "below", fixed: true });
hud.badge("b-model", { text: "model, not a photo", t0: 0, t1: 9, slot: "tl" });
const c = hud.counter("c-yrs", { label: "SPF daily  |  none", t0: 0, t1: 9, at: [0.5, 0.215], value: () => 0, fmt: () => "10 years", lit: () => true });
Object.assign(c.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "2.4vmin", boxShadow: "var(--hud-shadow)" });

// the daylight strip: three tones as the eye sees the same unprotected skin (the spots barely show)
const strip = document.createElement("div");
strip.innerHTML = `<div class="k">in daylight</div><div class="row">${[["#F1C9A9", "light"], ["#B9825C", "medium"], ["#6B4129", "deep"]].map(([c, n]) => `<div class="s"><i style="background:radial-gradient(circle at 35% 30%, #ffffff33, transparent 60%), ${c}"></i><span>${n}</span></div>`).join("")}</div>`;
Object.assign(strip.style, { position: "absolute", left: "50%", top: `${0.655 * H}px`, transform: "translateX(-50%)", display: "flex", flexDirection: "row", alignItems: "center", gap: "2.4vmin",
  padding: "1.1vmin 2.4vmin", borderRadius: "2.4vmin", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", fontFamily: "var(--font-mono)", color: "var(--text-2)", fontSize: "2.6vmin", zIndex: 4 });
const css = document.createElement("style");
css.textContent = `.row{display:flex;gap:3vmin}.s{display:flex;flex-direction:column;align-items:center;gap:.6vmin;color:var(--text)}.s i{display:block;width:5.4vmin;height:5.4vmin;border-radius:50%}.s{flex-direction:row!important;gap:1vmin!important}.k{letter-spacing:.08em;text-transform:uppercase}`;
document.head.appendChild(css);
document.getElementById("hud").appendChild(strip);

// the viewfinder: corner brackets, REC and the band, so the frame reads as camera footage
const vf = document.createElement("div");
vf.innerHTML = `<b class="c tl"></b><b class="c tr"></b><b class="c bl"></b><b class="c br"></b><span class="rec">● REC  UV 365 nm</span><span class="sp">SPF daily</span><span class="np">none</span>`;
Object.assign(vf.style, { position: "absolute", left: `${0.1 * W}px`, top: `${0.27 * H}px`, width: `${0.8 * W}px`, height: `${0.33 * H}px`, zIndex: 2, fontFamily: "var(--font-mono)", color: "var(--water)", fontSize: "2.5vmin" });
css.textContent += `.c{position:absolute;width:5vmin;height:5vmin;border:.45vmin solid var(--water)}.c.tl{left:0;top:0;border-right:0;border-bottom:0}.c.tr{right:0;top:0;border-left:0;border-bottom:0}.c.bl{left:0;bottom:0;border-right:0;border-top:0}.c.br{right:0;bottom:0;border-left:0;border-top:0}
.rec{position:absolute;right:6.5vmin;top:1.6vmin;letter-spacing:.08em}.sp,.np{position:absolute;bottom:1.6vmin;color:var(--text);letter-spacing:.06em;text-transform:uppercase}.sp{left:6.5vmin}.np{right:6.5vmin}`;
document.getElementById("hud").appendChild(vf);

window.seek = function (t) {
  mat.uniforms.uTime.value = t;
  hud.update(t);
  renderer.render(scene, camera);
};

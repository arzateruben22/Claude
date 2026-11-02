import * as THREE from "three";
// Look concept C, "bold editorial": a beauty-magazine spread. Cobalt and acid-lime colour blocks, giant kinetic type,
// a hard-cut feel; the 3D skin moment is two cut sections of the same skin side by side: ten years of daily sunscreen
// (model) and ten years without (model), the second buckled with fine lines. A still for the owner's pick.
import { createHud } from "cinema/sci/hud.js";
import { createSection } from "../../set/section.js";

const FILM = window.FILM, W = window.W, H = window.H;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 6, threshold: 0.95, bloom: 0.15, exposure: 1.05 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 2, 4000);
camera.position.set(-60, 260, 1600); camera.lookAt(0, -200, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8ff3c, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-200, 300, 260); scene.add(key);
const rim = new THREE.DirectionalLight(0xd8ff3c, 1.2); rim.position.set(200, 80, -300); scene.add(rim);

const LAY = { sc: 17, gran: 10, spin: 48, basal: 10 };
const A = createSection({ width: 110, depth: 70, ...LAY, seed: 41, x: -66 }), B = createSection({ width: 110, depth: 70, ...LAY, seed: 42, x: 66 });
A.group.position.x = -66; B.group.position.x = 66;
A.group.rotation.y = 0.18; B.group.rotation.y = -0.18;
scene.add(A.group, B.group);
A.set({ tone: 0.5, dimDead: 0, dimLiving: 0.2 }); B.set({ tone: 0.5, dimDead: 0, dimLiving: 0.2 });
B.wrinkle(4, 30, 22);   // ten years without: the surface buckled into fine lines (model)

// the spread: colour blocks and giant type, drawn as the page behind the 3D
const page = document.createElement("div");
page.innerHTML = `<div class="blk lime"></div><div class="big b1">10 <em>YEARS</em></div><div class="big b2">LATER</div>
  <div class="tag t1">DAILY<br>SPF</div><div class="tag t2">NO<br>SPF</div>
  <div class="tones"><span>EVERY SKIN TONE</span>${["#F1C9A9", "#B9825C", "#6B4129"].map((c) => `<i style="background:${c}"></i>`).join("")}</div>`;
Object.assign(page.style, { position: "absolute", inset: "0", zIndex: "0", pointerEvents: "none", fontFamily: "var(--font-display)" });
const css = document.createElement("style");
css.textContent = `
.blk.lime{position:absolute;left:0;right:0;top:${0.47 * H}px;bottom:0;background:var(--lime)}
.big{position:absolute;left:${0.07 * W}px;color:#fff;font-weight:800;line-height:.82;letter-spacing:-.04em;font-variation-settings:"wdth" 75,"opsz" 96}
.b1{top:${0.14 * H}px;font-size:19vmin}.b1 em{font-style:normal;color:var(--lime)}.b2{top:${0.22 * H}px;font-size:9vmin;opacity:.9;letter-spacing:.02em}
.tag{position:absolute;top:${0.5 * H}px;font-weight:800;font-size:5.4vmin;line-height:.95;color:var(--ink);letter-spacing:-.01em;padding:1.2vmin 2vmin;background:#fff;border-radius:1vmin}
.t1{left:${0.25 * W}px}.t2{right:${0.25 * W}px;background:var(--ink);color:#fff}
.tones{position:absolute;left:50%;transform:translateX(-50%);top:${0.705 * H}px;display:flex;align-items:center;gap:1.6vmin;font-weight:800;font-size:2.8vmin;color:var(--ink);letter-spacing:.06em}
.tones i{display:block;width:5vmin;height:5vmin;border-radius:50%;border:.4vmin solid #fff}`;
document.head.appendChild(css);
canvas.parentNode.insertBefore(page, canvas);   // the page sits under the 3D, the HUD over both

const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions);
hud.badge("b-model", { text: "model, not a photo · 10 years", t0: 0, t1: 9, slot: "bl" });

window.seek = function (t) {
  hud.update(t);
  renderer.render(scene, camera);
};

// The film kit's demo episode (kits/cinema/film/demo): 6 s, a lit planet orbiting a star with a moon,
// to exercise the runtime once end to end. It shows how an episode's scene is written:
//   - the first line imports three.js as "three" (the renderer splices cinema3d.js in right after it);
//   - kit modules come in by absolute URL through the page's import map ("cinema/...");
//   - window.seek(t) sets everything from t alone: stage(t), the camera, the clock, the objects, the
//     HUD, then exactly one renderer.render(scene, camera).
// Everything timed comes from film.json (window.FILM); the look comes from theme.json (CSS variables).
import * as THREE from "three";
import { stage } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { placeCamera } from "cinema/keys.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);

// the set: a star (emissive, brighter than white so the finish blooms it), a planet and its moon lit by it
const R = 2.1, PERIOD = 4.0, MOON_R = 0.62, MOON_P = 1.3;
const star = new THREE.Mesh(new THREE.SphereGeometry(0.44, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.92).multiplyScalar(2.2) }));
const planet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.82, metalness: 0 }));
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 20), new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.9, metalness: 0 }));
const sun = new THREE.PointLight(0xfff4e8, 3.2, 0, 0);       // decay 0: the same light at every distance (a diagram, not to scale)
scene.add(star, planet, moon, sun, new THREE.HemisphereLight(0xc8ccd2, 0x121417, 0.45));
// the orbit, drawn as a faint line (lines are not motion-probed; it never moves)
const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos((i / 160) * Math.PI * 2) * R, 0, Math.sin((i / 160) * Math.PI * 2) * R))),
  new THREE.LineBasicMaterial({ color: 0x8a9099, transparent: true, opacity: 0.45 }));
scene.add(ring);

// the clock: real time, then slowed ×4 while the caption says so, then real time again (film.json "clock")
const clk = clock(FILM.clock, { words: { slow: "slowed ×{n}" } });
const TH0 = 0.35;                                             // the planet's angle at τ = 0 (composes frame 0)
const planetAt = (t) => { const a = TH0 + (2 * Math.PI * clk.tau(t)) / PERIOD; return [Math.cos(a) * R, 0, Math.sin(a) * R]; };
const moonAt = (t) => { const p = planetAt(t), b = (2 * Math.PI * clk.tau(t)) / MOON_P; return [p[0] + Math.cos(b) * MOON_R, 0.08, p[2] + Math.sin(b) * MOON_R]; };

// the overlay
const hud = createHud({ camera });
hud.captions(FILM.captions);
hud.title(FILM.title);
hud.label("planet", { text: "planet", glyph: "●", mark: "none", color: "text", at: planetAt, t0: CUE.planet, t1: FILM.endCard, side: 1 });
hud.label("moon", { text: "moon", mark: "ring", color: "mid", at: moonAt, t0: CUE.moon, t1: FILM.endCard, side: -1 });
hud.badge("warp", { from: clk, slot: "tl" });
hud.badge("nts", { text: "not to scale", t0: CUE.nts, t1: FILM.endCard, slot: "tl" });
hud.counter("tau", { label: "scene time", value: (t) => clk.tau(t), fmt: (v) => v.toFixed(2), unit: "s", t0: CUE.tau, t1: FILM.endCard, at: [0.68, 0.19], minCh: 4 });
// the scale pill's bar is the orbit radius as it measures on screen at t (a pure function of the camera at t)
const radiusPx = () => { const a = hud.project([0, 0, 0]), b = hud.project([R, 0, 0]); return Math.hypot(b.x - a.x, b.y - a.y); };
hud.scale("radius", { text: "orbit radius", bar: radiusPx, t0: CUE.scale, t1: FILM.endCard });
hud.end({ t0: FILM.endCard, ...FILM.end });

// focus on the planet (cinema3d.js calls this with window.M.t, which stage(t) sets). fstop 0: no depth of
// field. Nothing stands behind the system to defocus, and on a transparent canvas the empty background
// reads as the far plane (the largest blur), so at any fstop > 0 the finish draws a dark, aliased 1–2 px
// rim around every silhouette against empty space (measured on this demo: kits/cinema/film/README.md).
window.CINEMA_FOCUS = (t) => ({ point: planetAt(t), fstop: 0 });

window.seek = function (t) {
  stage(t);
  placeCamera(camera, FILM.cam, t, { handheld: 0 });
  const tau = clk.tau(t);
  planet.position.fromArray(planetAt(t)); planet.rotation.y = tau * 1.6;
  moon.position.fromArray(moonAt(t));
  hud.update(t);
  renderer.render(scene, camera);
};

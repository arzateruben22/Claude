// The caption overlay pass (no 3-D): just the channel's word-lit captions on a flat black or white page, rendered twice (black, white) and composited with a
// difference matte by part1_overlay.py, so the finished picture never has to be rendered again when the voice arrives.  film.json "overlay": "black" | "white".
import * as THREE from "three";
import { createHud } from "cinema/sci/hud.js";
const FILM = window.FILM, W = window.W, H = window.H;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.setClearColor(new THREE.Color(FILM.overlay === "white" ? 0xffffff : 0x000000), 1);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 100);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 1, threshold: 2, bloom: 0 });
document.documentElement.style.setProperty("--hud-plate", "rgba(8, 9, 11, .88)");           // the same dark plate as the picture's captions
const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions, FILM.captionOpts || {});
const BGC = FILM.overlay === "white" ? "#ffffff" : "#000000"; document.documentElement.style.background = BGC; document.body.style.background = BGC; canvas.style.display = "none"; { const st = document.querySelector(".stage"); if (st) st.style.background = BGC; }
window.seek = function (t) { window.__t = t; hud.update(t); renderer.render(scene, camera); };

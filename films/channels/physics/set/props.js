// props.js — B3 Props and the light rig for "the Bench" (films/channels/physics/set), in centimetres.
// Primitives only, each ≤ 1.5k triangles; lit props keep albedo ≤ 0.7 (cross-check: bright props would
// compress toward white under the finish's ACES); the meter stick is unlit and lands on its colours
// through the ACES inverse, like the cyc. Reused by every episode that drops or throws something.
//
//   import { createProps } from "../set/props.js";
//   const P = createProps({ tokens: THEME.tokens });    // P.ready: a promise (the stick's numbers wait for the fonts)
//   scene.add(P.group);
//   const b = P.ball();                                  // a tennis ball (a Mesh), as many as needed
//   P.rig.place({ x0: -8, x1: 2 });                      // the release rail spanning the balls' release points
//   P.rig.release(tauLocal)                              // the release gates swing down (closed form in τ)
//
// Parts:
//   ball()        a tennis ball, r = 3.35 cm: optic-yellow felt with its seam (a seeded canvas texture)
//   rig           the release rail at the balls' centre height (100 cm + r), its post at x = −40 and one
//                 small gate under each release point that swings down at release
//   stick         a 100 cm birch meter stick standing in the balls' plane (z = 0) at x = stickX, front face
//                 ruled every 1 cm, numbered every 10 cm in IBM Plex Mono (the channel's number face)
//   lights        key (above-front-left), hemisphere fill, a cool rim from behind; no shadow maps (the
//                 cyc draws blob shadows itself)
//   ghostColor    the strobe ghosts' albedo: the felt pulled toward the cyc, still ≤ 0.7
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { ACES_INV_GLSL, albedo } from "./aces.js";
import { R_BALL, DROP } from "./bench.js";

const FELT = "#C2CE3E", SEAM = "#D9D6C9";

const feltTexture = () => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d"), r = rng(20261022);
  g.fillStyle = FELT; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) {                     // felt fuzz: faint light and dark flecks, seeded
    const x = r() * 512, y = r() * 256, l = r() < 0.5;
    g.fillStyle = l ? "rgba(236, 240, 170, .10)" : "rgba(90, 100, 20, .10)";
    g.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
  }
  // the seam: one closed curve, latitude ≈ 40° · sin(2 · longitude), drawn on the equirectangular map
  g.strokeStyle = SEAM; g.lineWidth = 9; g.lineCap = "round"; g.beginPath();
  for (let i = 0; i <= 512; i += 2) { const u = (i / 512) * Math.PI * 2, lat = 0.7 * Math.sin(2 * u); const y = 128 - (lat / (Math.PI / 2)) * 128; i ? g.lineTo(i, y) : g.moveTo(i, y); }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};

const STICK_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STICK_FS = `
uniform sampler2D map; uniform vec3 uTint; uniform float uExposure, uFace; varying vec2 vUv;
${ACES_INV_GLSL}
void main() {
  vec3 c = uFace > 0.5 ? texture2D(map, vUv).rgb : uTint;          // the texture is sRGB: sampled as linear display light
  gl_FragColor = vec4(acesInv(clamp(c, 0.0, 1.0), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createProps = (o = {}) => {
  const group = new THREE.Group();
  const felt = feltTexture();
  const ballGeo = new THREE.SphereGeometry(R_BALL, 32, 22);
  const ballMat = new THREE.MeshStandardMaterial({ map: felt, roughness: 0.92, metalness: 0 });
  const ball = () => { const m = new THREE.Mesh(ballGeo, ballMat); m.rotation.set(0.35, 0.6, 0.1); return m; };
  const ghostColor = albedo("#D3D1A6");                // pale felt, tinted toward the cyc (linear ≈ 0.64 max)

  // ── the release rig ──
  const steel = new THREE.MeshStandardMaterial({ color: albedo("#3B3E45"), roughness: 0.45, metalness: 0.35 });
  const rig = new THREE.Group();
  const yC = DROP + R_BALL;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 2.2), steel);
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, yC + 1.1, 2.6), steel);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 14), steel);
  rig.add(rail, post, foot);
  const gates = [];
  const gateGeo = new THREE.BoxGeometry(5.6, 0.5, 6.2); gateGeo.translate(0, -0.25, 3.1);   // hinged along its back edge
  const placeRig = ({ x0 = -8, x1 = 0, postX = -40, z = -6, gatesAt = [x0, x1] } = {}) => {
    const len = x1 + 3 - postX;
    rail.scale.x = len; rail.position.set(postX + len / 2, yC, z);
    post.position.set(postX, (yC + 1.1) / 2, z); foot.position.set(postX, 0.6, z);
    while (gates.length < gatesAt.length) { const gm = new THREE.Mesh(gateGeo, steel); rig.add(gm); gates.push(gm); }
    gates.forEach((gm, i) => { gm.visible = i < gatesAt.length; if (i < gatesAt.length) gm.position.set(gatesAt[i], DROP, z + 2.8); });
  };
  // the gates drop away 90° over 0.02 s of scene time (an eased swing): pure in τ
  const release = (tau) => { const u = Math.min(1, Math.max(0, tau / 0.02)), a = (Math.PI / 2) * (u * u * (3 - 2 * u)); gates.forEach((gm) => (gm.rotation.x = a)); };
  placeRig();
  group.add(rig);

  // ── the meter stick ──
  const stickW = 4.6, stickT = 0.7, stickX = o.stickX ?? -24;
  const sc = document.createElement("canvas"); sc.width = 160; sc.height = 3200;   // 32 px per cm along its 100 cm
  const stickTex = new THREE.CanvasTexture(sc); stickTex.colorSpace = THREE.SRGBColorSpace; stickTex.anisotropy = 8;
  const drawStick = () => {
    const g = sc.getContext("2d"), pc = 32;
    g.fillStyle = "#D7C29A"; g.fillRect(0, 0, 160, 3200);
    const r = rng(7);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(150, 110, 60, ${0.05 + r() * 0.06})`; g.fillRect(0, r() * 3200, 160, 1 + r() * 5); }   // grain
    g.fillStyle = "#24252A";
    for (let cm = 0; cm <= 100; cm++) {
      const y = 3200 - cm * pc, len = cm % 10 === 0 ? 70 : cm % 5 === 0 ? 46 : 26;
      g.fillRect(0, Math.max(0, Math.min(3200 - 4, y - 2)), len, 4);
    }
    g.font = '600 46px "IBM Plex Mono", "DejaVu Sans Mono", monospace'; g.textAlign = "right"; g.textBaseline = "middle";
    for (let cm = 10; cm <= 100; cm += 10) g.fillText(String(cm), 154, 3200 - cm * pc + (cm === 100 ? 24 : 0));
    stickTex.needsUpdate = true;
  };
  const stickMat = (face) => new THREE.ShaderMaterial({ uniforms: { map: { value: stickTex }, uTint: { value: new THREE.Vector3(0.70, 0.60, 0.43) }, uExposure: { value: 1 }, uFace: { value: face } },
    vertexShader: STICK_VS, fragmentShader: STICK_FS });
  const side = stickMat(0), front = stickMat(1);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(stickW, 100, stickT), [side, side, side, side, front, side]);
  stick.position.set(stickX, 50, 0);
  group.add(stick);

  // ── lights ──
  const key = new THREE.DirectionalLight(0xfff3e2, o.key ?? 2.5); key.position.set(-55, 85, 75);
  const fill = new THREE.HemisphereLight(0xfff6ea, 0x8f897e, o.fill ?? 1.15);
  const rim = new THREE.DirectionalLight(0xc8d8ff, o.rim ?? 1.3); rim.position.set(40, 50, -100);
  group.add(key, fill, rim);

  const ready = (window.FONTS_READY || Promise.resolve()).then(() => document.fonts.load('600 46px "IBM Plex Mono"')).then(drawStick, drawStick);
  return { group, ball, ballGeo, ballMat, ghostColor, rig: { group: rig, place: placeRig, release, gates }, stick, stickX, lights: { key, fill, rim }, ready };
};

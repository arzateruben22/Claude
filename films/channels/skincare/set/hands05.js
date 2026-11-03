// hands05.js — No. 005's two hands (films/channels/skincare/set): two neighbours' hands, backs to the camera,
// side by side, so "which hand aged?" points at hands. A simple model (a flattened palm, four fingers, a thumb,
// knuckle bumps), badged as one. Two looks: daylight (the episode's tone, the same to the eye) and UV (glowing lilac,
// sun damage as dark spots: an illustration of what a UV camera shows, never trial data).
//
//   const HS = createHands({ x: 8000, tone: [r, g, b] });   scene.add(HS.group);
//   HS.set({ uv: 0 … 1, dmgL, dmgR })   uv crossfades daylight → UV; dmgL, dmgR: 0 … 1 the spots on each hand
//   HS.at.left() · HS.at.right() → points for labels
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

const uvTexture = (seed) => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const k = c.getContext("2d"), R = rng(seed);
  const g = k.createRadialGradient(128, 110, 20, 128, 128, 180); g.addColorStop(0, "#c9b2ff"); g.addColorStop(1, "#7b55d8");
  k.fillStyle = g; k.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(255,255,255,${0.04 + R() * 0.06})`; k.fillRect(R() * 256, R() * 256, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const spotTexture = (seed, n) => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const k = c.getContext("2d"), R = rng(seed);
  k.clearRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) { const r = 1.5 + R() * 4.5; k.fillStyle = `rgba(30,12,74,${0.55 + R() * 0.4})`; k.beginPath(); k.arc(R() * 256, R() * 256, r, 0, Math.PI * 2); k.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

const makeHand = (side, dayMat, uvMat, spotMat) => {
  const h = new THREE.Group(), parts = [];
  const add = (geo, pos, rot = [0, 0, 0], sc = [1, 1, 1]) => {
    for (const m of [dayMat, uvMat, spotMat]) {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.scale.set(...sc); h.add(mesh); parts.push(mesh);
    }
  };
  add(new THREE.SphereGeometry(1, 40, 28), [0, 0.2, 0], [0, 0, 0], [2.15, 2.5, 0.6]);                    // the back of the hand
  [[-1.45, 2.1, 1.7, 0.1], [-0.5, 2.4, 2.1, 0.03], [0.5, 2.35, 2.0, -0.03], [1.4, 2.0, 1.5, -0.1]].forEach(([fx, fy, len, a]) => {
    add(new THREE.CapsuleGeometry(0.47, len, 8, 16), [fx - Math.sin(a) * len / 2, fy + len / 2 + 0.3, 0.05], [0, 0, a]);   // fingers
    add(new THREE.SphereGeometry(0.5, 20, 14), [fx, fy, 0.34], [0, 0, 0], [1, 0.75, 0.6]);               // knuckles
  });
  add(new THREE.CapsuleGeometry(0.52, 1.5, 8, 16), [side * 2.25, -0.2, 0.15], [0, 0, side * 0.75]);       // the thumb
  add(new THREE.CapsuleGeometry(1.35, 0.5, 8, 20), [0, -2.6, -0.1], [0, 0, 0], [1, 1, 0.45]);            // the wrist
  return { group: h, parts };
};

export const createHands = ({ x = 8000, tone = [0.55, 0.36, 0.25], gap = 6.2, seed = 51 } = {}) => {
  const g = new THREE.Group(); g.position.x = x;
  const dayMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...tone), roughness: 0.55, transparent: true });
  const H = [-1, 1].map((s, i) => {
    const uvMat = new THREE.MeshBasicMaterial({ map: uvTexture(seed + i), transparent: true, opacity: 0, toneMapped: false });
    const spotMat = new THREE.MeshBasicMaterial({ map: spotTexture(seed + 10 + i, 260), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const hand = makeHand(-s, dayMat, uvMat, spotMat);   // the thumbs point inward, two right hands' backs mirrored to face each other
    hand.group.position.set(s * gap / 2, 0, 0); hand.group.scale.x = s;
    g.add(hand.group);
    return { ...hand, uvMat, spotMat };
  });
  return {
    group: g,
    set({ uv = 0, dmgL = 0, dmgR = 0 } = {}) {
      dayMat.opacity = 1 - uv; dayMat.depthWrite = uv < 0.5;
      H.forEach((h, i) => { h.uvMat.opacity = uv; h.spotMat.opacity = uv * (i ? dmgR : dmgL); });
    },
    at: { left: () => [x - gap / 2, 2.6, 0.6], right: () => [x + gap / 2, 2.6, 0.6] },
  };
};

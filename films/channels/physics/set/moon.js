// moon.js — the Bench's Moon dressing and the Apollo 15 props (films/channels/physics/set; bible §5 B1 "Moon"
// dressing), in centimetres. The cyc stays the channel's warm paper (the look is the daylight lab, on the Moon or not);
// the floor takes a layer of grey regolith with small craters, faded in by `moon.set(k)`. Lit props, albedo ≤ 0.7.
//
//   import { createMoonFloor, createHammer, createFeather } from "../set/moon.js";
//   const moon = createMoonFloor({ size: 400 }); scene.add(moon.group); moon.set(k)    // k 0–1
//   const hammer = createHammer();   // a geological hammer: the head's centre at the origin, handle along −y
//   const feather = createFeather(); // a falcon flight feather: the quill's base at the origin, the vane along +y
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { albedo } from "./aces.js";

const regolith = (o = {}) => {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
  const g = c.getContext("2d"), r = rng(19710802);
  g.fillStyle = "#A8A49B"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26000; i++) { const l = r(); g.fillStyle = l < 0.5 ? `rgba(60, 58, 55, ${0.08 + r() * 0.1})` : `rgba(200, 196, 188, ${0.06 + r() * 0.1})`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 70; i++) {                                    // small craters: a dark rim on one side, light on the other
    const x = r() * 1024, y = r() * 1024, rad = 4 + r() ** 2 * 34;
    g.lineWidth = Math.max(1.2, rad * 0.16);
    g.strokeStyle = "rgba(55, 53, 50, .35)"; g.beginPath(); g.arc(x, y, rad, Math.PI * 0.95, Math.PI * 1.95); g.stroke();
    g.strokeStyle = "rgba(215, 210, 200, .35)"; g.beginPath(); g.arc(x, y, rad, Math.PI * -0.05, Math.PI * 0.95); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 1; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat ?? 3, o.repeat ?? 3);
  return t;
};

export const createMoonFloor = (o = {}) => {
  const size = o.size ?? 400, mat = new THREE.MeshStandardMaterial({ map: regolith({ repeat: Math.max(3, Math.round(size / 140)) }), color: albedo("#FFFFFF"), roughness: 1, metalness: 0, transparent: true, opacity: 0, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 64), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(o.x ?? 0, 0.05, o.z ?? -10);
  const group = new THREE.Group(); group.add(m);
  const set = (k) => { mat.opacity = Math.max(0, Math.min(1, k)); m.visible = k > 0.001; };
  set(0);
  return { group, set, mesh: m };
};

export const createHammer = () => {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: albedo("#9DA2A8"), roughness: 0.42, metalness: 0.6 });
  const grip = new THREE.MeshStandardMaterial({ color: albedo("#2F3238"), roughness: 0.8, metalness: 0 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 2.6), alu);                 // the head: flat face one end, pick the other
  const pick = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5, 4), alu); pick.rotation.z = -Math.PI / 2; pick.position.x = 9.4;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 28, 16), alu); handle.position.y = -15;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 10, 16), grip); wrap.position.y = -23;
  g.add(head, pick, handle, wrap);
  return g;
};

export const createFeather = () => {
  const g = new THREE.Group();
  const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 22, 8), new THREE.MeshStandardMaterial({ color: albedo("#D9D1C0"), roughness: 0.6 }));
  quill.position.y = 11;
  const sh = new THREE.Shape();                                      // the vane: narrow at the base, widest two-thirds up, a rounded tip
  sh.moveTo(0, 3); sh.bezierCurveTo(-1.8, 8, -2.6, 15, -1.6, 21); sh.quadraticCurveTo(-0.6, 23.5, 0.3, 22.5);
  sh.bezierCurveTo(1.2, 18, 1.3, 9, 0, 3);
  const vtex = (() => {                                              // barbs: dark bands on brown-grey, a falcon's barring
    const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d");
    x.fillStyle = "#6E5E4C"; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 9; i++) { x.fillStyle = "rgba(40, 32, 26, .55)"; x.fillRect(0, 18 + i * 26, 64, 9); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 1; return t;
  })();
  const vg = new THREE.ShapeGeometry(sh, 24);
  const pos = vg.attributes.position, uv = vg.attributes.uv;                 // map the vane's own y to the texture's bands
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 3) / 6, pos.getY(i) / 24);
  const vane = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ map: vtex, color: albedo("#FFFFFF"), roughness: 0.9, side: THREE.DoubleSide }));
  g.add(quill, vane);
  return g;
};

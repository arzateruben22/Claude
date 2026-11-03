// neuron.js — B6, the nerve fibre (films/channels/body/set, bible §5): an axon along a straight line, an
// optional myelin sheath in segments with bare gaps between them (the nodes of Ranvier), and the signal
// as a chartreuse glow: continuous along a bare axon, or lit node by node along a myelinated one.
// Episode 2's tease, episode 3 ("The jump") and episode 4 ("The gap", the terminal) build on it.
//
//   import { fibre } from "../set/neuron.js";
//   const F = fibre(THREE, L, { length: 400, axonR: 1.0, myelin: { r: 3.2, internode: 60, node: 2 } });
//   scene.add(F.group);
//   window.seek = (t) => { F.set({ front: 120, mode: "jump", tail: 40 }); ... F.at(x) → world [x, y, z] };
//
// Geometry along local +x from 0 to `length`; the group is placed and turned by the caller. Units are the
// caller's (episode 3 uses 1 = 1 µm; the picture compresses internodes and is badged "not to scale").
//   myelin: { r, internode (length of one sheath), node (bare gap), start = node } → sheaths at
//     [start + k (internode + node), … + internode]; nodes at the gaps between them (F.nodes, their centres)
// The signal: set({ front, mode, tail = 30, glow = 1 }).
//   mode "flow": a band of light whose head is at `front`, fading over `tail` behind it (a bare axon).
//   mode "jump": every node at or behind `front` is lit, the newest brightest, older ones fading over
//     `tail` (in length units behind the front); the axon under the sheath stays dark, so the light leaps
//     from gap to gap (saltatory conduction: the action potential is regenerated only at the nodes).
//   front < 0 means nothing is lit. Lit parts bloom (signal is one of the two colours that may).
//
// fibre(THREE, L, o) → { group, nodes: [x…], sheaths: [[x0, x1]…], set(s), at(x, lift = 0) → world point
//   on the axon's top surface lifted by `lift`, axonMat, sheathMat }
const SIGNAL = "#D6F25F";

export const fibre = (THREE, L, o = {}) => {
  const len = o.length ?? 400, ar = o.axonR ?? 1.0, M = o.myelin || null, group = new THREE.Group();
  const axonMat = L.patch(new THREE.MeshPhysicalMaterial({ color: L.lin(o.axonColor || "#C9A9B6"), roughness: 0.5, emissive: L.lin(SIGNAL), emissiveIntensity: 0 }), { fresnel: 0.3, key: "axon" });
  // the axon carries the glow in its own shader: a band [x0, x1] along local x, brightness by distance to
  // the head (flow), or a list of lit node windows (jump)
  const U = { uHead: { value: -1e6 }, uTail: { value: 30 }, uMode: { value: 0 }, uNodes: { value: new Float32Array(64) }, uLit: { value: new Float32Array(64) }, uNodeW: { value: (M?.node ?? 2) * 0.5 + 0.6 }, uSig: { value: L.lin(SIGNAL) }, uGlow: { value: 1 } };
  const prev = axonMat.onBeforeCompile;
  axonMat.onBeforeCompile = (sh, r) => {
    prev(sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vAx;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvAx = position.x;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vAx; uniform float uHead, uTail, uMode, uNodeW, uGlow; uniform float uNodes[64]; uniform float uLit[64]; uniform vec3 uSig;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  float g = 0.0;
  if (uMode < 0.5) { float d = uHead - vAx; g = d >= 0.0 ? exp(-d / max(1e-3, uTail)) * (1.0 - smoothstep(0.0, 1.2, -d)) : 1.0 - smoothstep(0.0, 1.2, -d); g *= step(-1.2, d); }
  else { for (int k = 0; k < 64; k++) { if (uLit[k] > 0.0) g = max(g, uLit[k] * (1.0 - smoothstep(uNodeW * 0.6, uNodeW, abs(vAx - uNodes[k])))); } }
  totalEmissiveRadiance += uSig * g * 2.4 * uGlow;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSig, 0.55 * g);`);
  };
  axonMat.customProgramCacheKey = () => "mi-axon";
  const axon = new THREE.Mesh(new THREE.CylinderGeometry(ar, ar, len, 24, Math.max(8, Math.round(len / 2)), true), axonMat);
  axon.geometry.rotateZ(-Math.PI / 2); axon.geometry.translate(len / 2, 0, 0);
  group.add(axon);
  const sheaths = [], nodes = [];
  const sheathMat = L.patch(new THREE.MeshPhysicalMaterial({ color: L.lin(o.myelinColor || "#F1E6D2"), roughness: 0.62, emissive: L.lin("#F6EEDC"), emissiveIntensity: 0.05 }), { fresnel: 0.35, fresnelPower: 2.2, key: "myelin" });
  if (M) {
    const g = M.node ?? 2, il = M.internode ?? 60, start = M.start ?? g;
    // one sheath: a lathe that tapers into the axon at both ends (the paranode), so the gap reads as a waist
    const prof = [];
    // half the samples in the two tapers, so the paranode ends are smooth curves, not cones
    const xs = [];
    for (let i = 0; i <= 24; i++) xs.push((i / 24) * il * 0.12);
    for (let i = 1; i < 24; i++) xs.push(il * 0.12 + (i / 24) * il * 0.76);
    for (let i = 24; i >= 0; i--) xs.push(il - (i / 24) * il * 0.12);
    for (const x of xs) { const e = Math.min(1, Math.min(x, il - x) / (il * 0.12)), s = Math.sin((e * Math.PI) / 2); prof.push(new THREE.Vector2(ar + (M.r - ar) * Math.pow(s, 0.7), x)); }
    const sg = new THREE.LatheGeometry(prof, 64); sg.rotateZ(-Math.PI / 2);
    // live scan (review r1): myelin is a sheath wrapped round and round the axon, so it carries fine spiral lamellae
    // (a bump map along the sheath) and a pearly sheen, never a smooth pill
    if (!sheathMat.bumpMap) {
      const c = document.createElement("canvas"); c.width = 64; c.height = 512; const k = c.getContext("2d");
      k.fillStyle = "#808080"; k.fillRect(0, 0, 64, 512);
      for (let y = 0; y < 512; y += 16) { k.strokeStyle = (y / 16) % 2 ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)"; k.lineWidth = 5; k.beginPath(); k.moveTo(0, y); k.lineTo(64, y + 6); k.stroke(); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, Math.max(2, il / 4));
      sheathMat.bumpMap = t; sheathMat.bumpScale = 3.0; sheathMat.normalMap = null;
      sheathMat.sheen = 0.7; sheathMat.sheenRoughness = 0.35; sheathMat.sheenColor = new THREE.Color(1.0, 0.92, 0.75);
      sheathMat.clearcoat = 0.7; sheathMat.clearcoatRoughness = 0.15; sheathMat.roughness = 0.38; sheathMat.needsUpdate = true;
    }
    for (let x = start; x + il <= len; x += il + g) {
      const m = new THREE.Mesh(sg, sheathMat); m.position.x = x; group.add(m); sheaths.push([x, x + il]);
      if (sheaths.length > 1) nodes.push(x - g / 2);
    }
    if (sheaths.length) nodes.unshift(start - g / 2);
  }
  if (nodes.length > 64) throw new Error("neuron.js: at most 64 nodes");
  // the spark at each node: a short glowing band around the bare axon, shown only while that node is lit (it reads
  // at any distance, where the axon's own glow is a few pixels wide)
  const bandG = new THREE.CylinderGeometry(ar * 1.75, ar * 1.75, (M?.node ?? 2) * 1.25, 28, 1, false); bandG.rotateZ(-Math.PI / 2);
  // live scan (review r1): the spark is light, not a painted band: a soft additive glow that always faces the lens
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const k = c.getContext("2d"), g = k.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.18, "rgba(240,255,170,.85)"); g.addColorStop(0.5, "rgba(214,242,95,.25)"); g.addColorStop(1, "rgba(214,242,95,0)"); k.fillStyle = g; k.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c); })();
  const bands = nodes.map((x) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1, 1, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
    m.scale.setScalar(ar * 9); m.position.x = x; m.visible = false; group.add(m); return m;
  });
  for (let k = 0; k < 64; k++) U.uNodes.value[k] = nodes[k] ?? -1e6;
  const set = (s = {}) => {
    const front = s.front ?? -1, tail = s.tail ?? 30;
    U.uGlow.value = s.glow ?? 1; U.uTail.value = tail;
    if ((s.mode || "flow") === "flow" || !M) { U.uMode.value = 0; U.uHead.value = front < 0 ? -1e6 : front; bands.forEach((b) => { b.visible = false; }); }
    else {
      U.uMode.value = 1;
      for (let k = 0; k < 64; k++) { const x = nodes[k]; U.uLit.value[k] = front >= 0 && x !== undefined && x <= front + 1e-6 ? Math.exp(-(front - x) / tail) : 0; }
      bands.forEach((b, k) => { const g = U.uLit.value[k] * (s.glow ?? 1); b.visible = g > 0.03; b.material.emissiveIntensity = 0.85 * g; b.material.opacity = Math.min(1, 0.35 + g); });
    }
  };
  const vA = new THREE.Vector3();
  const at = (x, lift = 0) => { group.updateMatrixWorld(true); const r = M && sheaths.some(([a, b]) => x > a + 2 && x < b - 2) ? M.r : ar; return group.localToWorld(vA.set(x, r + lift, 0)).toArray(); };
  return { group, nodes, sheaths, bands, set, at, axonMat, sheathMat, length: len };
};

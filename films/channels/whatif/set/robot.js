// The Possibility Lab mascot: the little visor robot (art/character/ref-robot.png, CHARACTER.md). Soft white vinyl (clearcoat), a glossy black visor with an
// environment reflection and a specular highlight, two emissive white oval eyes with expression states (no mouth), mitten hands, boots with a black sole band, a simple rig.
//
//   import { createRobot, makeEnv } from "../set/robot.js";
//   const bot = createRobot({ height: 1 });  scene.add(bot.group);
//   bot.set({ expr: "happy", head: { x: 0, y: 0, z: 0 }, armL: { z: 1.2, e: 0.2 }, armR: {...}, legL: {...}, legR: {...}, tilt: 0, lean: 0, at: [x, y, z], yaw: 0 })
//   scene.environment = makeEnv(renderer);           // the visor and the clearcoat reflect this
// Expressions: neutral | happy | wide | blink | squint | awe | worried | sad (eyes only; the head tilt and the pose do the rest).
import * as THREE from "three";

export const EXPRESSIONS = ["neutral", "happy", "wide", "blink", "squint", "awe"];

// a small procedural studio / space environment for the reflections (PMREM-filtered)
export const makeEnv = (renderer, o = {}) => {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uTop: { value: new THREE.Color(o.top || "#0a1222") }, uBot: { value: new THREE.Color(o.bot || "#222a38") } },
    vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 p; uniform vec3 uTop, uBot; void main(){ gl_FragColor = vec4(mix(uBot, uTop, smoothstep(-0.4, 0.8, p.y)), 1.0); }" }));
  env.add(sky);
  const panel = (c, w, h, pos, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
  panel(o.key || "#ffffff", 14, 10, [18, 16, 14], 5);          // the big softbox top-right (the highlight in the visor)
  panel(o.rim || "#5aa0ff", 8, 20, [-22, 4, -10], 3);           // a blue strip from behind-left
  panel(o.warm || "#ffb36a", 6, 14, [14, 2, -18], o.warmK ?? 1.5);
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(env, 0.02).texture; pm.dispose(); return tex;
};

export const createRobot = (o = {}) => {
  const H = o.height ?? 1;
  const white = new THREE.MeshPhysicalMaterial({ color: o.body || "#f4f5f7", roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.8 });
  const seam = new THREE.MeshPhysicalMaterial({ color: "#c3c7ce", roughness: 0.6, clearcoat: 0.0 });
  const sole = new THREE.MeshPhysicalMaterial({ color: "#0e0f12", roughness: 0.55, clearcoat: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#020304", roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, reflectivity: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const ell = (r, sx, sy, sz, m = white, seg = [40, 28]) => { const g = new THREE.Mesh(new THREE.SphereGeometry(r, seg[0], seg[1]), m); g.scale.set(sx, sy, sz); return g; };
  // a tapered soft tube: radius r0 at the bottom end, r1 at the top end, `len` between the two end-sphere centres (a lathe, so the ends are smooth domes)
  const tube = (r0, r1, len, m = white) => { const pts = []; const N = 10;
    for (let k = 0; k <= N; k++) { const a = -Math.PI / 2 + (Math.PI / 2) * (k / N); pts.push(new THREE.Vector2(Math.max(0.0001, r0 * Math.cos(a)), -len / 2 + r0 * Math.sin(a))); }
    for (let k = 0; k <= N; k++) { const a = (Math.PI / 2) * (k / N); pts.push(new THREE.Vector2(Math.max(0.0001, r1 * Math.cos(a)), len / 2 + r1 * Math.sin(a))); }
    return new THREE.Mesh(new THREE.LatheGeometry(pts, 40), m); };
  const ring = (r, t, y, m = seam) => { const g = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 40), m); g.rotation.x = Math.PI / 2; g.position.y = y; return g; };   // a thin seam line
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);

  // torso: one soft pear, fullest at the chest, tapering to the hips (a lathe through a smooth profile)
  const prof = [[0.0, 0.44], [0.1, 0.445], [0.15, 0.48], [0.185, 0.55], [0.212, 0.64], [0.222, 0.73], [0.2, 0.81], [0.15, 0.875], [0.09, 0.91], [0.0, 0.925]];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y))); const tp = curve.getPoints(48).map((v) => new THREE.Vector2(Math.max(0.0001, v.x), v.y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(tp, 56), white); torso.scale.set(1.12, 1, 1.1); body.add(torso);

  // head: a hood, a tilted egg swept back, with a thick bezel round a large visor
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.0); head.scale.setScalar(1.3); body.add(head);
  const helmet = ell(1, 0.35, 0.3, 0.33, white, [56, 40]);
  const back = ell(1, 0.27, 0.27, 0.27, white, [48, 32]); back.position.set(0, 0.075, -0.15);
  const back2 = ell(1, 0.2, 0.2, 0.22, white, [40, 28]); back2.position.set(0, 0.15, -0.24);
  const visor = ell(1, 0.265, 0.205, 0.19, glass, [64, 44]); visor.position.set(0, -0.015, 0.165);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.052, 18, 96), white); bezel.scale.set(0.283, 0.226, 0.3); bezel.position.set(0, -0.015, 0.205);
  head.add(helmet, back, back2, visor, bezel); head.rotation.x = 0;
  const eyes = [];
  const VA = 0.265, VB = 0.205, VC = 0.19, VZ = 0.165, VY = -0.015;
  const onVisor = (x, y) => VZ + VC * Math.sqrt(Math.max(0.0, 1 - (x / VA) ** 2 - (y / VB) ** 2)) + 0.003;
  [-1, 1].forEach((s) => {
    const g = new THREE.Group(); const x = s * 0.092, y = 0.02; g.position.set(x, VY + y, onVisor(x, y)); head.add(g);
    const oval = ell(1, 1, 1, 0.008, eyeMat, [20, 14]);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1, 0.42, 8, 24, Math.PI), eyeMat); arc.visible = false;
    g.add(oval, arc); eyes.push({ g, oval, arc, s, x, y });
  });
  const hl = ell(1, 0.055, 0.036, 0.006, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, toneMapped: false })); { const x = 0.175, y = 0.13; hl.position.set(x, VY + y, onVisor(x, y) + 0.001); hl.rotation.z = 0.5; head.add(hl); }

  // arms: thick soft tubes with thin seam lines at the shoulder and elbow, big rounded mittens
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.245, 0.8, 0); body.add(sh);
    const up = tube(0.088, 0.095, 0.1); up.position.y = -0.095; sh.add(up); const r1 = ring(0.092, 0.004, -0.02); sh.add(r1);
    const el = new THREE.Group(); el.position.y = -0.2; sh.add(el); el.add(ring(0.086, 0.004, 0.0));
    const lo = tube(0.086, 0.084, 0.09); lo.position.y = -0.09; el.add(lo);
    const hand = ell(1, 0.12, 0.11, 0.105); hand.position.y = -0.225; el.add(hand);
    const thumb = ell(1, 0.036, 0.05, 0.034); thumb.position.set(-s * 0.06, -0.225, 0.065); thumb.rotation.z = s * 0.5; el.add(thumb);
    return { sh, el };
  };
  const armL = arm(-1), armR = arm(1);
  // legs: one long, slightly tapered smooth leg (thigh + shin, same radius at the knee, a seam line there), big rounded boots with thick black soles
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(s * 0.125, 0.5, 0); body.add(hp);
    const th = tube(0.112, 0.128, 0.1); th.position.y = -0.1; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.21; hp.add(kn); kn.add(ring(0.104, 0.004, 0.0));
    const sh = tube(0.09, 0.104, 0.1); sh.position.y = -0.1; kn.add(sh);
    const boot = ell(1, 0.175, 0.115, 0.245); boot.position.set(0, -0.225, 0.06); kn.add(boot);
    const so = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 40), sole); so.scale.set(0.175, 1, 0.245); so.position.set(0, -0.31, 0.06); kn.add(so);
    return { hp, kn };
  };
  const legL = leg(-1), legR = leg(1);
  body.position.y = 0.31; root.scale.setScalar(H / 1.75); const group = new THREE.Group(); group.add(root);

  const lerp = (a, b, k) => a + (b - a) * k;
  const setEyes = (expr) => {
    for (const e of eyes) {
      const s = e.s; e.oval.visible = true; e.arc.visible = false; e.g.rotation.set(0, 0, 0);
      const sc = (x, y) => e.oval.scale.set(x, y, 0.008);
      if (expr === "happy") { e.oval.visible = false; e.arc.visible = true; e.arc.scale.set(0.04, 0.04, 0.04); e.g.position.y = VY + e.y - 0.01; }
      else { e.g.position.y = VY + e.y; }
      if (expr === "neutral") sc(0.027, 0.04);
      else if (expr === "wide") sc(0.037, 0.055);
      else if (expr === "blink") sc(0.034, 0.006);
      else if (expr === "squint") { sc(0.036, 0.013); e.g.rotation.z = -s * 0.22; }
      else if (expr === "awe") { sc(0.029, 0.066); }
      else if (expr === "worried") { sc(0.03, 0.042); e.g.rotation.z = s * 0.35; }
      else if (expr === "sad") { sc(0.028, 0.036); e.g.rotation.z = s * 0.5; }
    }
  };
  const set = (p = {}) => {
    if (p.at) group.position.set(...p.at);
    root.rotation.set(p.lean ?? 0, p.yaw ?? 0, p.tilt ?? 0);
    const hd = p.head || {}; head.rotation.set(hd.x ?? 0, hd.y ?? 0, hd.z ?? 0);
    const A = (a, v = {}, sg) => { a.sh.rotation.set(v.x ?? 0, v.y ?? 0, sg * (v.z ?? 0.14)); a.el.rotation.set(v.ex ?? 0, 0, -sg * (v.e ?? 0)); };      // z: outward from the body, e: the elbow bends toward the body
    A(armL, p.armL, -1); A(armR, p.armR, 1);
    const L = (l, v = {}) => { l.hp.rotation.set(v.x ?? 0, 0, v.z ?? 0); l.kn.rotation.set(v.k ?? 0, 0, 0); };
    L(legL, p.legL); L(legR, p.legR);
    root.position.y = p.rise ?? 0;
    setEyes(p.expr || "neutral");
  };
  set();
  return { group, set, head, parts: { body, armL, armR, legL, legR, eyes }, height: H, footY: 0 };
};

// named poses: arm / leg / head / body numbers in one place (radians). z rotates the arm outward from the body (about 1.5 = straight out), x swings it forward.
export const POSES = {
  stand: { armL: { z: 0.16 }, armR: { z: 0.16 }, expr: "neutral" },
  hips: { armL: { z: 0.5, e: 1.75 }, armR: { z: 0.5, e: 1.75 }, head: { z: 0.06 }, expr: "neutral" },
  heroHips: { armL: { z: 0.55, e: 1.8 }, armR: { z: 0.5, e: 1.8 }, head: { z: 0.1, y: 0.1 }, tilt: 0.0, legL: { z: 0.1, x: 0 }, legR: { z: -0.12, x: -0.1, k: 0.35 }, expr: "neutral", yaw: 0 },
  armsOut: { armL: { z: 1.4 }, armR: { z: 1.4 }, head: { x: -0.05 }, expr: "happy" },
  armsUp: { armL: { z: 2.6 }, armR: { z: 2.6 }, head: { x: -0.1 }, expr: "wide" },
  lean: { armL: { z: 0.5, x: 0.7, e: 0.6 }, armR: { z: 0.9, x: -0.8, e: 0.6 }, lean: 0.3, legL: { x: -0.4, k: 0.55 }, legR: { x: 0.4, k: 0.0 }, head: { x: 0.12 }, expr: "squint" },
  lookUp: { armL: { z: 0.16 }, armR: { z: 0.16 }, head: { x: -0.5 }, expr: "awe" },
  float: { armL: { z: 1.2, e: 0.3 }, armR: { z: 1.2, e: 0.3 }, legL: { x: 0.2, k: 0.5 }, legR: { x: -0.15, k: 0.35 }, head: { x: -0.1, z: 0.05 }, expr: "happy" },
};

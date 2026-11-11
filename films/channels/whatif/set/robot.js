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
  const white = new THREE.MeshPhysicalMaterial({ color: o.body || "#f1f2f4", roughness: 0.45, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9 });
  const seam = new THREE.MeshPhysicalMaterial({ color: "#c9ccd2", roughness: 0.55, clearcoat: 0.1 });
  const sole = new THREE.MeshPhysicalMaterial({ color: "#101114", roughness: 0.5, clearcoat: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#020304", roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, reflectivity: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const ell = (r, sx, sy, sz, m = white, seg = [40, 28]) => { const g = new THREE.Mesh(new THREE.SphereGeometry(r, seg[0], seg[1]), m); g.scale.set(sx, sy, sz); return g; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);

  // torso: a pear (a belly and a smaller chest)
  const belly = ell(1, 0.235, 0.255, 0.22); belly.position.set(0, 0.55, 0.0);
  const chest = ell(1, 0.18, 0.2, 0.17); chest.position.set(0, 0.71, -0.005);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 28), seam); neck.position.set(0, 0.84, 0);
  body.add(belly, chest, neck);

  // head: a rounded helmet with a swept-back hood, the visor set into the front
  const head = new THREE.Group(); head.position.set(0, 1.0, 0.02); head.scale.setScalar(1.17); body.add(head);
  const helmet = ell(1, 0.31, 0.255, 0.285); const hood = ell(1, 0.225, 0.19, 0.2); hood.position.set(0, 0.04, -0.11); const hood2 = ell(1, 0.17, 0.14, 0.15); hood2.position.set(0, 0.07, -0.19);
  const visor = ell(1, 0.245, 0.185, 0.17, glass, [56, 40]); visor.position.set(0, -0.005, 0.15);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 14, 72), white); rim.scale.set(0.252, 0.19, 0.3); rim.position.set(0, -0.005, 0.2); rim.rotation.x = 0;
  head.add(helmet, hood, hood2, visor, rim);
  // eyes live on the visor surface
  const eyes = [];
  const VA = 0.245, VB = 0.185, VC = 0.17, VZ = 0.15, VY = -0.005;
  const onVisor = (x, y) => VZ + VC * Math.sqrt(Math.max(0.0, 1 - (x / VA) ** 2 - (y / VB) ** 2)) + 0.003;
  [-1, 1].forEach((s) => {
    const g = new THREE.Group(); const x = s * 0.085, y = 0.02; g.position.set(x, VY + y, onVisor(x, y)); head.add(g);
    const oval = ell(1, 1, 1, 0.008, eyeMat, [20, 14]);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 8, 24, Math.PI), eyeMat); arc.visible = false;
    g.add(oval, arc); eyes.push({ g, oval, arc, s, x, y });
  });
  // a soft specular blob on the visor, upper right (as in the reference)
  const hl = ell(1, 0.05, 0.034, 0.006, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, toneMapped: false })); { const x = 0.165, y = 0.125; hl.position.set(x, VY + y, onVisor(x, y) + 0.001); hl.rotation.z = 0.5; head.add(hl); }

  // arms: shoulder pivot, upper arm, elbow pivot, forearm, mitten
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.215, 0.74, 0); body.add(sh);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.1, 8, 18), white); up.position.y = -0.09; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.18; sh.add(el);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.08, 8, 18), white); lo.position.y = -0.075; el.add(lo);
    const hand = ell(1, 0.08, 0.075, 0.07); hand.position.y = -0.185; el.add(hand);
    const thumb = ell(1, 0.03, 0.045, 0.03); thumb.position.set(-s * 0.035, -0.18, 0.045); thumb.rotation.z = s * 0.4; el.add(thumb);
    return { sh, el };
  };
  const armL = arm(-1), armR = arm(1);
  // legs: hip pivot, thigh, knee pivot, shin, boot with a black sole
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(s * 0.125, 0.4, 0); body.add(hp);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.07, 8, 18), white); th.position.y = -0.075; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.16; hp.add(kn);
    const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.06, 8, 18), white); sh.position.y = -0.07; kn.add(sh);
    const boot = ell(1, 0.105, 0.075, 0.155); boot.position.set(0, -0.165, 0.045); kn.add(boot);
    const so = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 32), sole); so.scale.set(0.104, 1, 0.152); so.position.set(0, -0.228, 0.05); kn.add(so);
    return { hp, kn };
  };
  const legL = leg(-1), legR = leg(1);
  const FOOT = 0.4 + 0.16 + 0.228 + 0.015;              // hip height + knee + sole bottom: the group's origin is the sole
  body.position.y = 0; root.scale.setScalar(H / 1.24); const group = new THREE.Group(); group.add(root);

  const lerp = (a, b, k) => a + (b - a) * k;
  const setEyes = (expr) => {
    for (const e of eyes) {
      const s = e.s; e.oval.visible = true; e.arc.visible = false; e.g.rotation.set(0, 0, 0);
      const sc = (x, y) => e.oval.scale.set(x, y, 0.008);
      if (expr === "happy") { e.oval.visible = false; e.arc.visible = true; e.arc.scale.set(0.034, 0.034, 0.034); e.g.position.y = VY + e.y - 0.01; }
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
  stand: { armL: { z: 0.14 }, armR: { z: 0.14 }, expr: "neutral" },
  hips: { armL: { z: 0.55, e: 1.6 }, armR: { z: 0.55, e: 1.6 }, head: { z: 0.08 }, expr: "neutral" },
  armsOut: { armL: { z: 1.4 }, armR: { z: 1.4 }, head: { x: -0.05 }, expr: "happy" },
  armsUp: { armL: { z: 2.6 }, armR: { z: 2.6 }, head: { x: -0.1 }, expr: "wide" },
  lean: { armL: { z: 0.5, x: 0.7, e: 0.6 }, armR: { z: 0.9, x: -0.8, e: 0.6 }, lean: 0.3, legL: { x: -0.4, k: 0.55 }, legR: { x: 0.4, k: 0.0 }, head: { x: 0.12 }, expr: "squint" },
  lookUp: { armL: { z: 0.14 }, armR: { z: 0.14 }, head: { x: -0.5 }, expr: "awe" },
  float: { armL: { z: 1.2, e: 0.3 }, armR: { z: 1.2, e: 0.3 }, legL: { x: 0.2, k: 0.5 }, legR: { x: -0.15, k: 0.35 }, head: { x: -0.1, z: 0.05 }, expr: "happy" },
};

// keys.js — keyed camera and focus for code-rendered films (kits/cinema). A plain ES module with no
// imports: it returns plain [x, y, z] arrays, and placeCamera() only calls camera.position.set(),
// camera.lookAt(x, y, z) and camera.updateProjectionMatrix(), so it works with whatever three.js
// version the scene brings. Everything is a pure function of t (no clock, no random).
//
// films/skin-school-pilot/motion/scenes3d.mjs inlines the same logic (its CAM keys + place(), and its
// FOC keys + window.CINEMA_FOCUS). With the default options these functions reproduce it exactly.
// The rel / aim options follow films/made-with-claude/src/main.js (keyAbs / camAt).
//
// EASE                 easing table, x in [0, 1] → [0, 1]. The pilot's short names (sine, p2, p3, out)
//                      and the GSAP-style names made-with-claude's timeline.json uses (power2.inOut, …).
// ease(name, fb)       the easing function for a name; an unknown or missing name falls back to fb ("p2").
//
// camAt(keys, t, opts) → { pos, look, fov, a, b, e }: the camera at t, between the two keys around it.
//   A key is { t, pos: [x,y,z], look: [x,y,z], fov, ease? } plus optional fields:
//     ease   the curve INTO this key from the previous one (default opts.ease, "p2" = power2.inOut)
//     pl     portrait-only look target (a tall frame often wants to look lower or higher)
//     ps     portrait distance scale for this key (default opts.portraitScale)
//     pfov   portrait degrees added to fov for this key (default opts.portraitFov)
//     rel    true: pos and look are offsets from opts.track(t), a subject's smoothed ground track,
//            so a tracking shot cannot lose its subject
//     aim    0..1: tilt the look target that far toward opts.subject(t) (keeps big jumps in frame)
//   opts: { portrait: false, portraitScale: 1.32, portraitFov: 12, ease: "p2", track: null, subject: null }
//   Portrait frames the same move from further back about the look target (pos − look) × scale, with a
//   wider lens. Before the first key it holds the first key; after the last key it holds the last.
//
// handheld(t, amp = 1) → { pos: [dx, dy, 0], look: [dx, dy, 0] }: a hand on the camera. Tiny, slow,
//   deterministic sums of sines: at amp 1 at most 0.07 scene units sideways and 0.04 up, and the look
//   target 0.03 (tuned for a set about 16 units wide; scale amp with the set). 0 = locked off.
//
// placeCamera(camera, keys, t, opts) → the camAt() result. Puts a PerspectiveCamera there: position +
//   handheld, fov (+ the portrait fov), updateProjectionMatrix(), lookAt(look + handheld look).
//   opts as camAt, plus handheld: 1 (amplitude; 0 turns it off).
//
// focusAt(keys, t, opts) → { point: [x,y,z], fstop }: the focus pull at t.
//   A key is { t, at, f }: at is [x,y,z] or the name of a live target in opts.targets; f is the f-stop
//   (fstop works too). At each key the focus racks from the previous key's point and f-stop to this
//   one's over opts.rack seconds, then holds. Key the pulls on whatever the caption or label names.
//   opts: { rack: 0.45, rackEase: "p2", portrait: false, portraitFstop: 0.8, targets: {} }
//   A target is [x,y,z], anything with x/y/z (a THREE.Vector3 the scene moves during seek), or a
//   function of t returning either; it is read when focusAt runs, so a falling drop can be followed.
//   Portrait multiplies the f-stop by portraitFstop: cinema3d.js scales blur with frame height, so a
//   tall frame needs less (made-with-claude's 9:16 uses the same 0.8).
//
// focusTrack(keys, opts) → (t) => focusAt(keys, t, opts), ready to assign to window.CINEMA_FOCUS.
//   cinema3d.js calls CINEMA_FOCUS with window.M.t (0 when window.M is missing) from inside the seek at
//   the frame's own moment, when seek calls renderer.render, so targets seek moved before that are current.
//   A scene without the Skin School runtime (whose M.stage sets M.t) sets it at the top of seek:
//   (window.M ||= {}).t = t;
//
// Example (a scene module):
//   import { placeCamera, focusTrack } from "./keys.js";   // a copy next to the scene, as with cinema3d.js
//   const CAM = [{ t: 0, pos: [4, 17, 12], look: [0, 14, 3], fov: 30 }, { t: 2.3, pos: [9, 12, 25], look: [0.6, 10.6, 3.2], fov: 32, ease: "p3" }];
//   const FOC = [{ t: 0, at: [0, 13.6, 3.5], f: 0.55 }, { t: 1.6, at: "drop", f: 0.32 }];
//   const portrait = H > W, drop = new THREE.Vector3();
//   window.CINEMA_FOCUS = focusTrack(FOC, { portrait, targets: { drop } });
//   window.seek = (t) => { (window.M ||= {}).t = t; placeCamera(camera, CAM, t, { portrait }); /* … */ renderer.render(scene, camera); };

export const EASE = {
  linear: (x) => x,
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  p2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  p3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  p4: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  out2: (x) => 1 - (1 - x) * (1 - x),
  sineOut: (x) => Math.sin((x * Math.PI) / 2),
  sineIn: (x) => 1 - Math.cos((x * Math.PI) / 2)
};
Object.assign(EASE, {
  none: EASE.linear, "sine.inOut": EASE.sine, "sine.out": EASE.sineOut, "sine.in": EASE.sineIn,
  "power2.inOut": EASE.p2, "power3.inOut": EASE.p3, "power4.inOut": EASE.p4,
  "power2.out": EASE.out2, "power3.out": EASE.out
});

export const ease = (name, fb = "p2") => EASE[name] || EASE[fb] || EASE.p2;

const kClamp01 = (x) => Math.min(1, Math.max(0, x));
const kLerp3 = (a, b, e) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
// [x,y,z], {x,y,z} or a function of t returning either → [x,y,z] (null stays null)
const kVec = (p, t) => {
  const q = typeof p === "function" ? p(t) : p;
  if (q == null) return null;
  return Array.isArray(q) ? [q[0], q[1], q[2]] : [q.x, q.y, q.z];
};

// one key's pos and look at time t (rel and aim are evaluated at t, not at the key's own time)
const kResolve = (k, t, o) => {
  let pos = k.pos, look = o.portrait && k.pl ? k.pl : k.look;
  if (k.rel && o.track) { const g = kVec(o.track, t); pos = [pos[0] + g[0], pos[1] + g[1], pos[2] + g[2]]; look = [look[0] + g[0], look[1] + g[1], look[2] + g[2]]; }
  if (k.aim && o.subject) { const s = kVec(o.subject, t); if (s) look = kLerp3(look, s, k.aim); }
  return { pos, look };
};

export function camAt(keys, t, opts = {}) {
  const o = { portrait: false, portraitScale: 1.32, portraitFov: 12, ease: "p2", ...opts };
  let i = keys.findIndex((k) => k.t > t); if (i < 0) i = keys.length - 1; if (i < 1) i = 1;
  const a = keys[Math.min(i - 1, keys.length - 1)], b = keys[Math.min(i, keys.length - 1)];
  const e = a === b ? 1 : ease(b.ease, o.ease)(kClamp01((t - a.t) / (b.t - a.t)));
  const A = kResolve(a, t, o), B = kResolve(b, t, o);
  const look = kLerp3(A.look, B.look, e);
  const sa = a.ps ?? o.portraitScale, sb = b.ps ?? o.portraitScale, sc = o.portrait ? sa + (sb - sa) * e : 1;
  const P = kLerp3(A.pos, B.pos, e);
  const pos = [(P[0] - look[0]) * sc + look[0], (P[1] - look[1]) * sc + look[1], (P[2] - look[2]) * sc + look[2]];
  let fov = a.fov + (b.fov - a.fov) * e;
  if (o.portrait) { const fa = a.pfov ?? o.portraitFov, fb = b.pfov ?? o.portraitFov; fov = fov + (fa + (fb - fa) * e); }
  return { pos, look, fov, a, b, e };
}

export function handheld(t, amp = 1) {
  return {
    pos: [(Math.sin(t * 0.9) * 0.05 + Math.sin(t * 2.3 + 1) * 0.02) * amp, Math.sin(t * 1.1 + 2) * 0.04 * amp, 0],
    look: [Math.sin(t * 0.7) * 0.03 * amp, Math.sin(t * 0.8 + 1) * 0.03 * amp, 0]
  };
}

export function placeCamera(camera, keys, t, opts = {}) {
  const C = camAt(keys, t, opts), amp = opts.handheld ?? 1, h = handheld(t, amp);
  if (amp) camera.position.set(C.pos[0] + h.pos[0], C.pos[1] + h.pos[1], C.pos[2]);
  else camera.position.set(C.pos[0], C.pos[1], C.pos[2]);
  camera.fov = C.fov; camera.updateProjectionMatrix();
  if (amp) camera.lookAt(C.look[0] + h.look[0], C.look[1] + h.look[1], C.look[2]);
  else camera.lookAt(C.look[0], C.look[1], C.look[2]);
  return C;
}

export function focusAt(keys, t, opts = {}) {
  const o = { rack: 0.45, rackEase: "p2", portrait: false, portraitFstop: 0.8, targets: {}, ...opts };
  let i = 0; for (let k = 0; k < keys.length; k++) if (t >= keys[k].t) i = k;
  const cur = keys[i], prev = keys[Math.max(0, i - 1)];
  const w = i === 0 ? 1 : ease(o.rackEase)(Math.min(1, (t - cur.t) / o.rack));
  const at = (k) => kVec(typeof k.at === "string" ? o.targets[k.at] : k.at, t);
  const fs = (k) => k.f ?? k.fstop;
  const pa = at(prev), pb = at(cur);
  return { point: kLerp3(pa, pb, w), fstop: (fs(prev) + (fs(cur) - fs(prev)) * w) * (o.portrait ? o.portraitFstop : 1) };
}

export const focusTrack = (keys, opts = {}) => (t) => focusAt(keys, t, opts);

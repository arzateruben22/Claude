// The shaken jar of ep09 ("The nut that rises"): a 2D simulation of soft discs, run once and stored in sim.json.
//   node films/channels/physics/ep09/sim.mjs            (writes sim.json next to it; deterministic: seeded)
// 71 discs: one big (radius 3.8 cm) and 70 small (radius 1.0 cm); the discs' mass is proportional to their area. Soft
// contacts (spring plus damping), walls 14 cm apart, the floor moves y = A sin(2π f t) with A = 1.0 cm and f = 9 Hz, gravity
// 981 cm/s². It starts with the big disc on the floor and the small ones stacked above it. Frames every 1/30 s for 40 s.
// This is our model of the Brazil nut effect, not a measurement; the film badges it as a simulation.
import { writeFileSync } from "node:fs";
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function run({ top = false, mb = 1, N = 70, rs = 1.0, rb = 3.8, Wc = 14, A = 1.0, f = 9, T = 40, seed = 2, k = 8e5, gam = 200, dt = 1e-4, fps = 30 } = {}) {
  const R = rng(seed), g = 981, P = [];
  P.push({ x: Wc / 2, y: top ? 40 : rb + 0.1, vx: 0, vy: 0, r: rb, m: rb * rb / (rs * rs) * mb });
  let y = top ? 0.1 + rs : 2 * rb + 0.5, x = rs + 0.1;
  for (let i = 0; i < N; i++) { if (x > Wc - rs - 0.1) { x = rs + 0.1 + R() * 0.3; y += 2 * rs * 0.95; } P.push({ x, y, vx: 0, vy: 0, r: rs, m: 1 }); x += 2 * rs * 1.01; }
  const frames = [], steps = Math.round(T / dt), every = Math.round(1 / fps / dt);
  let t = 0;
  for (let s = 0; s <= steps; s++) {
    if (s % every === 0) frames.push({ t: +t.toFixed(4), floor: +(A * Math.sin(2 * Math.PI * f * t)).toFixed(3), xy: P.flatMap((p) => [+p.x.toFixed(2), +p.y.toFixed(2)]) });
    const fl = A * Math.sin(2 * Math.PI * f * t), fv = A * 2 * Math.PI * f * Math.cos(2 * Math.PI * f * t);
    const F = P.map((p) => [0, -g * p.m]);
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      let o = p.r - p.x; if (o > 0) F[i][0] += k * p.m * o - gam * p.m * p.vx * 0.5;
      o = p.x + p.r - Wc; if (o > 0) F[i][0] -= k * p.m * o + gam * p.m * p.vx * 0.5;
      o = fl + p.r - p.y; if (o > 0) F[i][1] += k * p.m * o + gam * p.m * (fv - p.vy);
    }
    const grid = new Map();
    for (let i = 0; i < P.length; i++) { const key = Math.floor(P[i].x / (2 * rb)) + "," + Math.floor(P[i].y / (2 * rb)); (grid.get(key) || grid.set(key, []).get(key)).push(i); }
    for (const [key, list] of grid) {
      const [cx, cy] = key.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const l2 = grid.get((cx + dx) + "," + (cy + dy)); if (!l2) continue;
        for (const i of list) for (const j of l2) {
          if (j <= i) continue; const a = P[i], b = P[j];
          const ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy), ov = a.r + b.r - d; if (ov <= 0 || d < 1e-9) continue;
          const nx = ddx / d, ny = ddy / d, rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny, mu = a.m * b.m / (a.m + b.m);
          const fn = k * mu * ov - gam * mu * rvn;
          F[i][0] -= fn * nx; F[i][1] -= fn * ny; F[j][0] += fn * nx; F[j][1] += fn * ny;
        }
      }
    }
    for (let i = 0; i < P.length; i++) { const p = P[i]; p.vx += F[i][0] / p.m * dt; p.vy += F[i][1] / p.m * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    t += dt;
  }
  return { params: { N, rs, rb, Wc, A, f, T, seed, k, gam, dt, fps }, frames };
}
if (process.argv[1] && process.argv[1].endsWith("sim.mjs")) {
  const out = run();
  const dir = new URL(".", import.meta.url).pathname;
  writeFileSync(dir + "sim.json", JSON.stringify(out));
  const big = out.frames.filter((_, i) => i % 60 === 0).map((fr) => fr.xy[1].toFixed(1)).join(" ");
  console.log(`sim.json: ${out.frames.length} frames; big disc centre height every 2 s: ${big}`);
}

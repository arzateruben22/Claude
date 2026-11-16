// Runs the scene's own ball integration (extracted from scene.mjs) and checks it against the physics: same launch speed every hour,
// peak = h0 / (g / g0), time to the top = v0 / g.   node films/channels/whatif/longform/gravity-doubles/physics_check.mjs
import fs from "node:fs";
const dir = new URL(".", import.meta.url).pathname, film = JSON.parse(fs.readFileSync(dir + "part1/film.json", "utf8")), src = fs.readFileSync(dir + "scene_tail.mjs", "utf8");
const a = src.indexOf("const GR = FILM.grav"), b = src.indexOf("window.__ball");
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x), E = { inout2: (u) => u * u * (3 - 2 * u) };
const FILM = film;
const mod = new Function("FILM", "E", "clamp01", src.slice(a, b) + "; return { ballY, gAt, hourAt, PHYS, BS };")(FILM, E, clamp01);
const { ballY, gAt, hourAt, PHYS, BS } = mod;
const dt = 1 / BS, out = [];
let prev = ballY(0), up = true, bounceStart = 0;
for (let t = dt; t < film.dur; t += dt) { const y = ballY(t); if (up && y < prev) { out.push({ kind: "apex", t, y: prev, g: gAt(t) }); up = false; } if (!up && y > prev) { up = true; out.push({ kind: "bounce", t }); } prev = y; }
const ap = out.filter((o) => o.kind === "apex"), bn = out.filter((o) => o.kind === "bounce");
const h0 = film.grav.ball.h0, steady = (lo, hi, label, gExp) => { const s = ap.filter((o) => o.t > lo && o.t < hi && Math.abs(o.g - gExp) < 1e-3); if (!s.length) return console.log(label, "no steady apex"); const y = s[s.length - 1].y; let ok = Math.abs(y - h0 / gExp) < 0.01 * h0;
  // time to the top: from the bounce before the last steady apex
  const b0 = bn.filter((o) => o.t < s[s.length - 1].t).pop(); const tt = s[s.length - 1].t - (b0 ? b0.t : 0), ttExp = PHYS.v0 / (PHYS.g0 * gExp);
  console.log(`${label}: g x${gExp}  peak ${y.toFixed(4)} (expected h0/g = ${(h0 / gExp).toFixed(4)})  time to top ${tt.toFixed(3)} s (expected v0/g = ${ttExp.toFixed(3)})  ${ok && Math.abs(tt - ttExp) < 0.02 ? "OK" : "MISMATCH"}`); };
const w = Object.fromEntries(JSON.parse(fs.readFileSync(dir + "part1/windows.json", "utf8")).lines.map((l) => [l.id, l]));
steady(w.l03.t0, w.l04.t0 + 0.5, "hour 0", 1);
steady(w.l06.t0, w.l07.t0, "hour 1", 2);
steady(film.grav.pin.t1 + 0.3, film.grav.hours[film.grav.hours.length - 2][0], "hour 1 (after the teaser)", 2);
steady(film.grav.hours[film.grav.hours.length - 1][0] - 0.0, film.dur, "hour 2", 4);
console.log("launch speed", PHYS.v0.toFixed(4), "u/s (the same every bounce: e = 1)  ·  g0", PHYS.g0.toFixed(4), "u/s²  ·  peaks ratio hour1/hour0 =", (ap.filter((o) => o.t > w.l06.t0 && o.t < w.l07.t0 && Math.abs(o.g - 2) < 1e-3).pop().y / ap.filter((o) => o.t > w.l03.t0 && o.t < w.l04.t0 + 0.5 && Math.abs(o.g - 1) < 1e-3).pop().y).toFixed(4));

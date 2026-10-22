// compile.py's clock (a Python port of kits/cinema/sci/clock.js) against clock.js itself: every ghost stamp of
// every take in film.json, recomputed in Node.   node qa/clockcheck.mjs film.json
import fs from "node:fs";
import { clock } from "../../../../../kits/cinema/sci/clock.js";
import { ballAt, landTime } from "../../set/bench.js";
const F = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const c = clock(F.clock);
let worst = 0, n = 0;
for (const [name, tk] of Object.entries(F.takes)) {
  tk.stamps.forEach((s, k) => {
    const js = c.tOf(tk.tauR + k * F.bench.dt);
    if (s === null) { if (Number.isFinite(js)) console.log("mismatch inf", name, k, js); return; }
    worst = Math.max(worst, Math.abs(js - s)); n++;
  });
  // tau at the release and landing
  const land = c.tOf(tk.tauR + landTime());
  console.log(name, "release", tk.R.toFixed(4), "tau(R)-tauR", (c.tau(tk.R) - tk.tauR).toExponential(2), "landing film t", land.toFixed(4));
}
console.log(`stamps: ${n} compared, worst |js - py| = ${worst.toExponential(2)} s`);
console.log("ball at landing:", ballAt(landTime(), { x0: 0, vx: 133 }).map((v) => v.toFixed(3)).join(", "), "(x = 60.05 cm, y = r)");

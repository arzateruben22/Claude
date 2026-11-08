// Skin Sense No. 004 SAMPLE, "The Message Behind a Frown": the approved art direction (../ART-DIRECTION.md) built in code.
// Pure DOM/SVG (no three.js): ivory ground, navy editorial serif headline, sans supporting text, ivory label pills with
// thin leader lines pinned to anchors in the art, a restrained push-in, labels drawn on with the narration.
// The art is a SLOT (art.json): artwork must be text-free. Until clean art exists it is a PLACEHOLDER crop of the reference.
import { stage } from "cinema/film/runtime.js";

const FILM = window.FILM, W = window.W, H = window.H, u = W / 1080, CUE = FILM.cue;
const ART = await (await fetch("art.json")).json();
const NAVY = "#0E1B3D", IVORY = "#F8F2E7", TEAL = "#2F8F86", GOLD = "#B8862B";
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (x) => x * x * (3 - 2 * x), eo = (x) => 1 - Math.pow(1 - x, 3);
const px = (v) => `${(v * u).toFixed(2)}px`;

const stageEl = document.getElementById("stage");
const css = document.createElement("style");
css.textContent = `
.ss{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 38%,#FBF6EC 0%,${IVORY} 60%,#F1E8D8 100%);color:${NAVY};font-family:"Red Hat Text",sans-serif;overflow:hidden}
.ss .eyebrow{position:absolute;left:0;right:0;top:${px(92)};text-align:center;font:600 ${px(30)}/1 "Red Hat Text";letter-spacing:.34em}
.ss .h1{position:absolute;left:${px(40)};right:${px(40)};top:${px(160)};text-align:center;font:600 ${px(94)}/${px(104)} "Newsreader",serif;letter-spacing:.005em;text-transform:uppercase}
.ss .sup{position:absolute;left:${px(60)};right:${px(60)};top:${px(420)};text-align:center;font:400 ${px(48)}/${px(60)} "Red Hat Text"}
.ss .artbox{position:absolute;left:0;width:${px(1080)};top:${px(560)};height:${px(1060)};overflow:hidden;
 -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 12%,#000 82%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 12%,#000 82%,transparent 100%)}
.ss .artbox img{position:absolute;left:0;transform-origin:0 0;max-width:none}
.ss .pill{position:absolute;left:0;top:0;padding:${px(12)} ${px(26)};border-radius:${px(40)};background:${IVORY};border:${px(2)} solid rgba(14,27,61,.18);
 box-shadow:0 ${px(6)} ${px(18)} rgba(14,27,61,.16);font:700 ${px(30)}/1 "Red Hat Text";letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;color:${NAVY}}
.ss .cap{position:absolute;left:0;right:0;top:${px(1620)};text-align:center}
.ss .cap span.pg{display:inline-block;background:rgba(248,242,231,.94);border:${px(2)} solid rgba(14,27,61,.14);border-radius:${px(22)};padding:${px(14)} ${px(30)};font:600 ${px(54)}/1.1 "Red Hat Text";box-shadow:0 ${px(6)} ${px(18)} rgba(14,27,61,.12)}
.ss .cap .on{box-shadow:inset 0 ${px(-8)} 0 ${TEAL}}
.ss .ph{position:absolute;left:${px(40)};top:${px(1540)};font:600 ${px(22)}/1 "Red Hat Mono";letter-spacing:.08em;padding:${px(8)} ${px(14)};border:${px(2)} dashed ${GOLD};border-radius:${px(8)};background:rgba(248,242,231,.9);color:#6E4C0A;text-transform:uppercase}
.ss .foot{position:absolute;left:0;right:0;text-align:center;color:${NAVY}}
.ss .foot.a{top:${px(1776)};font:400 ${px(30)}/1 "Red Hat Text";letter-spacing:.03em}
.ss .foot.b{top:${px(1828)};font:400 ${px(27)}/1 "Red Hat Text";letter-spacing:.03em;opacity:.85}
.ss .rule{position:absolute;top:${px(1790)};height:${px(2)};background:rgba(14,27,61,.4);width:${px(190)}}
svg.lead{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}
`;
document.head.appendChild(css);

const root = document.createElement("div"); root.className = "ss";
root.innerHTML = `
<div class="eyebrow">SKIN SENSE · EPISODE 04</div>
<div class="h1">The message<br>behind a frown</div>
<div class="sup" id="sup"></div>
<div class="artbox" id="artbox"><img id="art" src="${ART.src}"></div>
${ART.placeholder ? `<div class="ph" id="ph">Placeholder art · reference crop</div>` : ""}
<svg class="lead" id="lead"></svg>
<div id="pills"></div>
<div class="cap" id="cap"></div>
<div class="rule" style="left:${px(80)}"></div><div class="rule" style="right:${px(80)}"></div>
<div class="foot a">Conceptual illustration · not to scale</div>
<div class="foot b">Education, not medical advice</div>`;
stageEl.insertBefore(root, stageEl.firstChild);
const artbox = root.querySelector("#artbox"), art = root.querySelector("#art"), lead = root.querySelector("#lead"), pills = root.querySelector("#pills");
const supEl = root.querySelector("#sup"), capEl = root.querySelector("#cap");

// the art: full width, its height by its own aspect, centred in the box
const AW = 1080 * u, AH = AW * ART.h / ART.w, BH = 1060 * u, BTOP = 560 * u, TOP0 = (BH - AH) / 2;
art.style.width = `${AW}px`; art.style.height = `${AH}px`; art.style.top = `${TOP0}px`;
// camera: a close-up per line (focus in art coordinates 0-1, scale), each reached by a short eased move, then a slow drift
const LN = CUE.lines, S = (id) => LN[id][0];
const KF = [
  { t: 0, id: "vo01", s: 1.55, f: [0.40, 0.36] }, { t: S("vo02"), s: 1.6, f: [0.37, 0.31] }, { t: S("vo03"), s: 1.8, f: [0.56, 0.50] },
  { t: S("vo04"), s: 1.45, f: [0.62, 0.72] }, { t: S("vo05"), s: 1.0, f: [0.5, 0.5] }, { t: S("vo06"), s: 2.05, f: [0.50, 0.49] },
  { t: S("vo07"), s: 1.7, f: [0.57, 0.53] }, { t: S("vo08"), s: 1.05, f: [0.5, 0.5] },
];
const camAt = (t) => {
  let i = 0; for (let k = 0; k < KF.length; k++) if (t >= KF[k].t - 0.05) i = k;
  const a = KF[Math.max(0, i - 1)], b = KF[i], m = i ? ease(seg(t, b.t - 0.05, b.t + 0.85)) : 1, drift = 1 + 0.025 * seg(t, b.t, b.t + 4);
  return { s: (a.s + (b.s - a.s) * m) * drift, fx: a.f[0] + (b.f[0] - a.f[0]) * m, fy: a.f[1] + (b.f[1] - a.f[1]) * m };
};
const toScreen = (nx, ny, c) => [AW / 2 + (nx - c.fx) * AW * c.s, BTOP + BH / 2 + (ny - c.fy) * AH * c.s];
const ANCH = { ...ART.anchors, toxin: null };
const toxinPos = (t) => { const p = ease(seg(t, CUE.toxin + 0.1, CUE.toxin + 2.6)); return [0.16 + (ART.anchors.snap[0] - 0.16) * p, 0.1 + (ART.anchors.snap[1] - 0.1) * p]; };
const anchorAt = (name, t) => { const c = camAt(t), [ax, ay] = name === "toxin" ? toxinPos(t) : ART.anchors[name]; return toScreen(ax, ay, c); };

// labels: a pill at an offset from its anchor (rigid, so it stays attached), kept inside the frame; drawn on with the narration
const L_ = (id) => LN[id];
const LABELS = [
  { id: "nerve", text: "Nerve ending", a: "nerve", off: [-6, -165], t0: L_("vo02")[0], t1: L_("vo03")[1] },
  { id: "ach", text: "Acetylcholine", a: "ach", off: [48, 92], t0: CUE.ach - 0.3, t1: L_("vo04")[1] - 0.2 },
  { id: "fibre", text: "Muscle fibre", a: "fibre", off: [-56, 96], t0: L_("vo04")[0] + 0.2, t1: L_("vo05")[0] - 0.1 },
  { id: "toxin", text: "Botulinum toxin", a: "toxin", off: [60, -90], t0: CUE.toxin + 0.15, t1: L_("vo06")[0] - 0.1, dot: true },
  { id: "snap", text: "SNAP-25 · blocked", a: "snap", off: [-60, 150], t0: CUE.cuts - 0.1, t1: L_("vo07")[1] },
  { id: "blocked", text: "Message blocked", a: "ach", off: [48, 92], t0: L_("vo07")[0] + 0.35, t1: L_("vo08")[0] - 0.1 },
];
const NS = "http://www.w3.org/2000/svg";
await document.fonts.ready;
for (const L of LABELS) {
  L.pill = document.createElement("div"); L.pill.className = "pill"; L.pill.textContent = L.text; pills.appendChild(L.pill); L.pw = L.pill.getBoundingClientRect().width; L.ph = L.pill.getBoundingClientRect().height;
  L.line = document.createElementNS(NS, "path"); L.line.setAttribute("stroke", NAVY); L.line.setAttribute("stroke-width", 2.4 * u); L.line.setAttribute("fill", "none"); lead.appendChild(L.line);
  L.dot = document.createElementNS(NS, "circle"); L.dot.setAttribute("r", (L.dot === true ? 8 : 8) * u); L.dot.setAttribute("fill", IVORY); L.dot.setAttribute("stroke", NAVY); L.dot.setAttribute("stroke-width", 2.4 * u); lead.appendChild(L.dot);
}
// the toxin: a navy particle with a soft halo travelling to the protein (a simplified picture, not a molecule model)
const halo = document.createElementNS(NS, "circle"), core = document.createElementNS(NS, "circle");
halo.setAttribute("fill", "rgba(14,27,61,.22)"); core.setAttribute("fill", NAVY); lead.insertBefore(core, lead.firstChild); lead.insertBefore(halo, lead.firstChild);
// the cut: a ring and a slash at the protein, on "cuts"
const ring = document.createElementNS(NS, "circle"), slash = document.createElementNS(NS, "path");
for (const e of [ring, slash]) { e.setAttribute("fill", "none"); e.setAttribute("stroke", TEAL); e.setAttribute("stroke-width", 5 * u); e.setAttribute("stroke-linecap", "round"); lead.appendChild(e); }

const SUP = [
  [0, "A nerve sends a signal.<br>A muscle responds."],
  [L_("vo05")[0] - 0.2, "A key step is blocked.<br>No message sent."],
  [L_("vo08")[0] - 0.2, "Movement starts<br>with a message."],
];
// captions: pages of up to 3 words, broken at phrase ends
const pages = []; let cur = [];
for (const w of FILM.captions) {
  cur.push(w);
  if (cur.length >= 3 || /[,.?]$/.test(w.w) || (cur.length >= 2 && cur[0].line !== w.line)) { pages.push(cur); cur = []; }
}
if (cur.length) pages.push(cur);

window.seek = function (t) {
  stage(t);
  const c = camAt(t), fi = eo(seg(t, 0, 0.5)), F = [c.fx * AW, TOP0 + c.fy * AH];
  art.style.transform = `translate(${AW / 2 - F[0] * c.s}px,${BH / 2 - F[1] * c.s}px) scale(${c.s})`;
  artbox.style.opacity = fi.toFixed(3);
  root.querySelector(".h1").style.opacity = root.querySelector(".eyebrow").style.opacity = eo(seg(t, 0, 0.4)).toFixed(3);
  let k = 0; for (let i = 0; i < SUP.length; i++) if (t >= SUP[i][0]) k = i;
  if (supEl.dataset.k !== String(k)) { supEl.innerHTML = SUP[k][1]; supEl.dataset.k = String(k); }
  supEl.style.opacity = (eo(seg(t, SUP[k][0], SUP[k][0] + 0.35)) * eo(seg(t, 0.1, 0.6))).toFixed(3);
  // the toxin particle
  const [tx, ty] = anchorAt("toxin", t), tv = eo(seg(t, CUE.toxin, CUE.toxin + 0.3)) * (1 - eo(seg(t, CUE.cuts + 0.5, CUE.cuts + 0.9)));
  halo.setAttribute("cx", tx); halo.setAttribute("cy", ty); halo.setAttribute("r", 26 * u * c.s ** 0.3); halo.setAttribute("opacity", tv.toFixed(3));
  core.setAttribute("cx", tx); core.setAttribute("cy", ty); core.setAttribute("r", 11 * u * c.s ** 0.3); core.setAttribute("opacity", tv.toFixed(3));
  for (const L of LABELS) {
    const [ax, ay] = anchorAt(L.a, t);
    const inside = eo(seg(ay, BTOP + 10 * u, BTOP + 90 * u)) * (1 - eo(seg(ay, BTOP + BH - 150 * u, BTOP + BH - 80 * u))) * eo(seg(ax, -10 * u, 60 * u)) * (1 - eo(seg(ax, W - 60 * u, W + 10 * u)));
    const p = eo(seg(t, L.t0, L.t0 + 0.5)), out = (1 - eo(seg(t, L.t1, L.t1 + 0.3))) * inside, vis = p * out;
    const pw = L.pw, ph = L.ph;
    let px0 = ax + L.off[0] * u, py0 = ay + L.off[1] * u;
    const left = L.off[0] >= 0;
    // keep the pill inside the frame (the leader still reaches its anchor)
    px0 = left ? Math.min(Math.max(px0, 34 * u), W - 34 * u - pw) : Math.min(Math.max(px0, 34 * u + pw), W - 34 * u);
    py0 = Math.min(Math.max(py0, BTOP + 30 * u + ph / 2), BTOP + BH - 90 * u);
    L.pill.style.opacity = vis.toFixed(3);
    L.pill.style.transform = `translate(${left ? px0 : px0 - pw}px,${py0 - ph / 2}px)`;
    const mx = ax + (px0 - ax) * p, my = ay + (py0 - ay) * p;
    L.line.setAttribute("d", `M${ax},${ay} L${mx},${my}`); L.line.setAttribute("opacity", out.toFixed(3));
    L.dot.setAttribute("cx", ax); L.dot.setAttribute("cy", ay); L.dot.setAttribute("opacity", (p * out).toFixed(3));
  }
  const [sx, sy] = anchorAt("snap", t), q = seg(t, CUE.cuts, CUE.cuts + 0.5), hold = 1 - eo(seg(t, LN.vo07[1], LN.vo07[1] + 0.4));
  ring.setAttribute("cx", sx); ring.setAttribute("cy", sy); ring.setAttribute("r", (22 + 26 * eo(q)) * u * c.s ** 0.4); ring.setAttribute("opacity", (q > 0 ? (1 - 0.35 * q) * hold : 0).toFixed(3));
  const d = 40 * u * c.s ** 0.4 * eo(seg(t, CUE.cuts + 0.1, CUE.cuts + 0.45));
  slash.setAttribute("d", `M${sx - d},${sy + d} L${sx + d},${sy - d}`); slash.setAttribute("opacity", (q > 0 ? hold : 0).toFixed(3));
  let pg = null; for (const g of pages) if (t >= g[0].t0 - 0.05 && t <= g[g.length - 1].t1 + 0.3) pg = g;
  if (!pg) capEl.innerHTML = "";
  else capEl.innerHTML = `<span class="pg">${pg.map((w) => `<span class="${t >= w.t0 && t < w.t1 ? "on" : ""}">${w.w}</span>`).join(" ")}</span>`;
};

// Skin Sense No. 004, "The Message Behind a Frown" (full episode): the approved art direction (../ART-DIRECTION.md) built in code.
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
.ss .plate{position:absolute;left:${px(90)};right:${px(90)};top:${px(700)};padding:${px(54)} ${px(50)};border:${px(2)} solid rgba(14,27,61,.22);border-radius:${px(26)};background:rgba(251,247,238,.96);box-shadow:0 ${px(10)} ${px(34)} rgba(14,27,61,.14);text-align:center;opacity:0}
.ss .plate .pn{font:600 ${px(84)}/${px(94)} "Newsreader",serif}
.ss .plate .pr{margin-top:${px(18)};font:500 ${px(34)}/1.3 "Red Hat Text";letter-spacing:.04em;opacity:0}
.ss .plate .pl{margin-top:${px(38)};padding-top:${px(30)};border-top:${px(2)} solid rgba(14,27,61,.25);font:italic 400 ${px(54)}/1.25 "Newsreader",serif;opacity:0}
.ss .plate .pl2{margin-top:${px(16)};padding-top:0;border-top:none;font-size:${px(46)}}
.ss .badge{position:absolute;left:${px(40)};top:${px(590)};padding:${px(8)} ${px(16)};border-radius:${px(30)};background:rgba(248,242,231,.92);border:${px(2)} solid rgba(14,27,61,.2);font:600 ${px(24)}/1 "Red Hat Text";letter-spacing:.05em;text-transform:uppercase;opacity:0}
.ss .endc{position:absolute;inset:0;background:rgba(248,242,231,.9);text-align:center;opacity:0;pointer-events:none}
.ss .endc .e1{position:absolute;left:0;right:0;top:${px(560)};font:600 ${px(104)}/${px(114)} "Newsreader",serif}
.ss .endc .e2{position:absolute;left:0;right:0;top:${px(850)};font:400 ${px(66)}/1.2 "Red Hat Text"}
.ss .endc .e2 span{box-shadow:inset 0 ${px(-12)} 0 ${TEAL}}
.ss .endc .chip{position:absolute;left:50%;top:${px(1020)};transform:translateX(-50%);padding:${px(14)} ${px(36)};border:${px(2.5)} solid ${NAVY};border-radius:${px(50)};font:600 ${px(36)}/1 "Red Hat Text";letter-spacing:.04em;white-space:nowrap}
.ss .endc .e3{position:absolute;left:0;right:0;top:${px(1130)};font:400 ${px(28)}/1 "Red Hat Text";opacity:.8}
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
<div class="plate" id="plate"><div class="pn">Justinus Kerner</div><div class="pr">physician, Württemberg · 1820s</div><div class="pl" id="pl1">“Sausage poison” described</div><div class="pl pl2" id="pl2">…and the paralysis it caused</div></div>
<div class="badge" id="badge"></div>
<div class="endc" id="endc"><div class="e1">Next: same sun,<br>one experiment.</div><div class="e2">Which hand <span>aged</span>?</div><div class="chip">Skin Sense · No. 005</div><div class="e3">Narration: synthetic voice (AI).</div></div>
<div class="rule" style="left:${px(80)}"></div><div class="rule" style="right:${px(80)}"></div>
<div class="foot a">Conceptual illustration · not to scale</div>
<div class="foot b">Education, not medical advice</div>`;
stageEl.insertBefore(root, stageEl.firstChild);
const artbox = root.querySelector("#artbox"), art = root.querySelector("#art"), lead = root.querySelector("#lead"), pills = root.querySelector("#pills");
const supEl = root.querySelector("#sup"), capEl = root.querySelector("#cap");

// the art: full width, its height by its own aspect, centred in the box
const AW = 1080 * u, AH = AW * ART.h / ART.w, BH = 1060 * u, BTOP = 560 * u, TOP0 = (BH - AH) / 2;
art.style.width = `${AW}px`; art.style.height = `${AH}px`; art.style.top = `${TOP0}px`;
const LN = FILM.lines, CAPS = FILM.captions, PL = (m) => m;
// the time a spoken word starts: (line, word, n-th match); punctuation and case ignored
const tw = (id, w, n = 0) => { const k = (x) => x.toLowerCase().replace(/[^a-z0-9-]/g, ""); const hit = CAPS.filter((c) => c.line === id && k(c.w) === k(w)); if (!hit[n]) throw new Error(`no word ${w} in ${id}`); return hit[n].t0; };
const twe = (id, w, n = 0) => { const k = (x) => x.toLowerCase().replace(/[^a-z0-9-]/g, ""); return CAPS.filter((c) => c.line === id && k(c.w) === k(w))[n].t1; };
const S = (id) => LN[id][0], E_ = (id) => LN[id][1];
const T = {
  nerve: tw("vo02", "Every"), release: tw("vo02", "The"), ach: tw("vo02", "acetylcholine"), fibre: tw("vo02", "It"), muscle: tw("vo02", "muscle"),
  toxin: tw("vo03", "Botulinum"), inside: tw("vo03", "inside"), there: tw("vo03", "There"), cuts: tw("vo03", "cuts"), stays: tw("vo03", "stays"), so: tw("vo03", "so"), no: tw("vo03", "no"),
  german: tw("vo04", "German"), poison: tw("vo04", "poison"), paralysis: tw("vo04", "paralysis"), he: tw("vo04", "He"), guessed: tw("vo04", "guessed"),
  twist: S("vo05"), nerve2: tw("vo05", "The", 1), grows: tw("vo05", "grows"), three: tw("vo05", "three"), later: tw("vo05", "later"), flows: tw("vo05", "flows"),
  nerveEnd: tw("vo06", "nerve"), next: S("vo07"),
};
// camera: a close-up per sentence (focus in art coordinates 0-1, scale), each reached by a short eased move, then a slow drift
const KF = [
  { t: 0, s: 1.55, f: [0.40, 0.36] }, { t: tw("vo01", "It"), s: 1.7, f: [0.46, 0.45] }, { t: T.nerve, s: 1.55, f: [0.37, 0.31] },
  { t: T.release, s: 1.8, f: [0.56, 0.50] }, { t: tw("vo02", "chemical"), s: 2.05, f: [0.50, 0.46] }, { t: T.ach, s: 1.8, f: [0.58, 0.53] }, { t: T.fibre, s: 1.45, f: [0.62, 0.72] }, { t: tw("vo02", "pulls"), s: 1.65, f: [0.66, 0.77] },
  { t: T.toxin, s: 1.0, f: [0.5, 0.5] }, { t: T.inside, s: 1.25, f: [0.45, 0.40] }, { t: T.there, s: 2.05, f: [0.50, 0.49] }, { t: tw("vo03", "SNAP-25"), s: 2.4, f: [0.50, 0.49] }, { t: T.stays, s: 1.7, f: [0.57, 0.53] }, { t: T.so, s: 1.45, f: [0.62, 0.70] },
  { t: T.he, s: 1.12, f: [0.5, 0.5] }, { t: T.twist, s: 1.2, f: [0.5, 0.5] }, { t: T.nerve2, s: 1.6, f: [0.50, 0.55] }, { t: T.flows, s: 1.4, f: [0.58, 0.58] },
  { t: E_("vo05") + 0.4, s: 1.05, f: [0.5, 0.5] }, { t: S("vo06"), s: 1.1, f: [0.5, 0.5] }, { t: tw("vo06", "blocks"), s: 1.45, f: [0.52, 0.5] }, { t: tw("vo06", "The"), s: 1.15, f: [0.5, 0.52] }, { t: tw("vo06", "The", 1), s: 1.55, f: [0.40, 0.34] },
];
const camAt = (t) => {
  let i = 0; for (let k = 0; k < KF.length; k++) if (t >= KF[k].t - 0.05) i = k;
  const a = KF[Math.max(0, i - 1)], b = KF[i], m = i ? ease(seg(t, b.t - 0.05, b.t + 0.9)) : 1, drift = 1 + 0.025 * seg(t, b.t, b.t + 4);
  return { s: (a.s + (b.s - a.s) * m) * drift, fx: a.f[0] + (b.f[0] - a.f[0]) * m, fy: a.f[1] + (b.f[1] - a.f[1]) * m };
};
const toScreen = (nx, ny, c) => [AW / 2 + (nx - c.fx) * AW * c.s, BTOP + BH / 2 + (ny - c.fy) * AH * c.s];
// the toxin: a navy particle with a soft halo travelling to the protein (a simplified picture, not a molecule model)
const toxinPos = (t) => { const p = ease(seg(t, T.toxin + 0.1, T.cuts)); return [0.16 + (ART.anchors.snap[0] - 0.16) * p, 0.1 + (ART.anchors.snap[1] - 0.1) * p]; };
const SPROUT = [[0.36, 0.55, 0.34, 0.62, 0.40, 0.68, 0.46, 0.71], [0.45, 0.56, 0.47, 0.64, 0.52, 0.69, 0.56, 0.73], [0.52, 0.54, 0.56, 0.60, 0.60, 0.65, 0.66, 0.67]];
const bez = (q, p) => { const [x0, y0, x1, y1, x2, y2, x3, y3] = q, m = 1 - p; return [m ** 3 * x0 + 3 * m * m * p * x1 + 3 * m * p * p * x2 + p ** 3 * x3, m ** 3 * y0 + 3 * m * m * p * y1 + 3 * m * p * p * y2 + p ** 3 * y3]; };
const anchorAt = (name, t) => { const c = camAt(t); let p; if (name === "toxin") p = toxinPos(t); else if (name === "sprout") p = bez(SPROUT[2], 1); else p = ART.anchors[name]; return toScreen(p[0], p[1], c); };

// labels: a pill at an offset from its anchor (rigid, so it stays attached), kept inside the frame; drawn on with the narration
const LABELS = [
  { text: "Nerve ending", a: "nerve", off: [-6, -165], t0: T.nerve, t1: T.fibre - 0.2 },
  { text: "Acetylcholine", a: "ach", off: [48, 92], t0: T.ach - 0.3, t1: T.fibre - 0.2 },
  { text: "Muscle fibre", a: "fibre", off: [-56, 96], t0: T.muscle - 0.1, t1: T.toxin - 0.15 },
  { text: "Botulinum toxin", a: "toxin", off: [60, -90], t0: T.toxin + 0.15, t1: T.there - 0.1 },
  { text: "SNAP-25 · cut", a: "snap", off: [-60, 150], t0: T.cuts - 0.1, t1: T.so },
  { text: "Message stuck inside", a: "ach", off: [48, 92], t0: T.stays, t1: T.so + 0.2 },
  { text: "No signal", a: "fibre", off: [-56, 96], t0: T.no, t1: E_("vo03") + 0.3 },
  { text: "Kerner's guess: a medicine", a: "nerve", off: [150, -140], t0: T.guessed, t1: T.guessed + 3.0 },
  { text: "New endings", a: "sprout", off: [40, 110], t0: T.grows + 0.3, t1: E_("vo05") + 3.2 },
  { text: "Message flows again", a: "ach", off: [48, 92], t0: T.flows, t1: E_("vo05") + 3.2 },
  { text: "Nerve ending", a: "nerve", off: [-6, -165], t0: T.nerveEnd, t1: S("vo07") - 0.3 },
];
const NS = "http://www.w3.org/2000/svg";
await document.fonts.ready;
for (const L of LABELS) {
  L.pill = document.createElement("div"); L.pill.className = "pill"; L.pill.textContent = L.text; pills.appendChild(L.pill); const r = L.pill.getBoundingClientRect(); L.pw = r.width; L.ph = r.height;
  L.line = document.createElementNS(NS, "path"); L.line.setAttribute("stroke", NAVY); L.line.setAttribute("stroke-width", 2.4 * u); L.line.setAttribute("fill", "none"); lead.appendChild(L.line);
  L.dot = document.createElementNS(NS, "circle"); L.dot.setAttribute("r", 8 * u); L.dot.setAttribute("fill", IVORY); L.dot.setAttribute("stroke", NAVY); L.dot.setAttribute("stroke-width", 2.4 * u); lead.appendChild(L.dot);
}
const mk = (tag, attrs, parent = lead, first = false) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); first ? parent.insertBefore(e, parent.firstChild) : parent.appendChild(e); return e; };
const halo = mk("circle", { fill: "rgba(14,27,61,.22)" }, lead, true), core = mk("circle", { fill: NAVY }, lead, true);
const ring = mk("circle", { fill: "none", stroke: TEAL, "stroke-width": 5 * u, "stroke-linecap": "round" }), slash = mk("path", { fill: "none", stroke: TEAL, "stroke-width": 5 * u, "stroke-linecap": "round" });
const sprouts = SPROUT.map(() => mk("path", { fill: "none", stroke: "#C98F25", "stroke-width": 7 * u, "stroke-linecap": "round", opacity: 0 }, lead, true));
const tips = SPROUT.map(() => mk("circle", { fill: "#E3AE45", stroke: "#9A6A12", "stroke-width": 2 * u, opacity: 0 }, lead, true));
const DOTS = Array.from({ length: 12 }, (_, i) => mk("circle", { fill: TEAL, opacity: 0 }, lead, true));

const SUP = [
  [0, "A nerve sends a signal.<br>A muscle responds."],
  [T.toxin - 0.2, "One protein cut.<br>No message sent."],
  [T.he, "Poison first,<br>medicine later."],
  [T.twist, "The block wears off.<br>The nerve rebuilds."],
  [S("vo06"), "Movement starts<br>with a message."],
  [tw("vo06", "The"), "The skin was never<br>the target."],
  [tw("vo06", "The", 1), "The nerve was."],
];
const BADGES = [[0, T.german, "Simplified · not to scale"], [T.he, T.three, "Illustration"], [T.three, S("vo06"), "About 3 months · time compressed"]];
// captions: pages of up to 3 words, broken at phrase ends
const pages = []; let cur = [];
for (const w of CAPS) {
  cur.push(w);
  if (cur.length >= 3 || /[,.?:]$/.test(w.w) || (cur.length >= 2 && cur[0].line !== w.line)) { pages.push(cur); cur = []; }
}
if (cur.length) pages.push(cur);
const plate = root.querySelector("#plate"), endc = root.querySelector("#endc"), badge = root.querySelector("#badge");
const pn = plate.querySelector(".pn"), pr = plate.querySelector(".pr"), pl1 = plate.querySelector("#pl1"), pl2 = plate.querySelector("#pl2");
const KERNER = [S("vo04") - 0.2, T.he - 0.15];

window.seek = function (t) {
  stage(t);
  const c = camAt(t), F = [c.fx * AW, TOP0 + c.fy * AH];
  const kv = Math.min(eo(seg(t, KERNER[0], KERNER[0] + 0.5)), 1 - eo(seg(t, KERNER[1] - 0.4, KERNER[1])));   // the Kerner plate, over a quieter art
  art.style.transform = `translate(${AW / 2 - F[0] * c.s}px,${BH / 2 - F[1] * c.s}px) scale(${c.s})`;
  artbox.style.opacity = (1 - 0.92 * kv).toFixed(3);
  supEl.style.opacity = "0";
  let k = 0; for (let i = 0; i < SUP.length; i++) if (t >= SUP[i][0]) k = i;
  if (supEl.dataset.k !== String(k)) { supEl.innerHTML = SUP[k][1]; supEl.dataset.k = String(k); }
  supEl.style.opacity = (eo(seg(t, SUP[k][0], SUP[k][0] + 0.35)) * (1 - kv) * (1 - eo(seg(t, T.next - 0.3, T.next + 0.2)))).toFixed(3);
  // plate
  plate.style.opacity = kv.toFixed(3); pr.style.opacity = eo(seg(t, T.german, T.german + 0.4)).toFixed(3); pl1.style.opacity = eo(seg(t, T.poison, T.poison + 0.4)).toFixed(3); pl2.style.opacity = eo(seg(t, T.paralysis, T.paralysis + 0.4)).toFixed(3);
  // badge
  const b = BADGES.find(([a, z]) => t >= a && t < z); if (b) badge.textContent = b[2];
  badge.style.opacity = b ? (eo(seg(t, b[0], b[0] + 0.3)) * (1 - eo(seg(t, b[1] - 0.3, b[1])))).toFixed(3) : "0";
  // the toxin particle
  const [tx, ty] = anchorAt("toxin", t), tv = eo(seg(t, T.toxin, T.toxin + 0.3)) * (1 - eo(seg(t, T.cuts + 0.5, T.cuts + 0.9)));
  halo.setAttribute("cx", tx); halo.setAttribute("cy", ty); halo.setAttribute("r", 26 * u * c.s ** 0.3); halo.setAttribute("opacity", tv.toFixed(3));
  core.setAttribute("cx", tx); core.setAttribute("cy", ty); core.setAttribute("r", 11 * u * c.s ** 0.3); core.setAttribute("opacity", tv.toFixed(3));
  for (const L of LABELS) {
    const [ax, ay] = anchorAt(L.a, t);
    const inside = eo(seg(ay, BTOP + 10 * u, BTOP + 90 * u)) * (1 - eo(seg(ay, BTOP + BH - 150 * u, BTOP + BH - 80 * u))) * eo(seg(ax, -10 * u, 60 * u)) * (1 - eo(seg(ax, W - 60 * u, W + 10 * u)));
    const p = eo(seg(t, L.t0, L.t0 + 0.5)), out = (1 - eo(seg(t, L.t1, L.t1 + 0.3))) * inside * (1 - 0.9 * (L.text.startsWith("Kerner") ? 0 : kv)), vis = p * out;
    const pw = L.pw, ph = L.ph; let px0 = ax + L.off[0] * u, py0 = ay + L.off[1] * u; const left = L.off[0] >= 0;
    px0 = left ? Math.min(Math.max(px0, 34 * u), W - 34 * u - pw) : Math.min(Math.max(px0, 34 * u + pw), W - 34 * u);
    py0 = Math.min(Math.max(py0, BTOP + 30 * u + ph / 2), BTOP + BH - 90 * u);
    L.pill.style.opacity = vis.toFixed(3); L.pill.style.transform = `translate(${left ? px0 : px0 - pw}px,${py0 - ph / 2}px)`;
    const mx = ax + (px0 - ax) * p, my = ay + (py0 - ay) * p;
    L.line.setAttribute("d", `M${ax},${ay} L${mx},${my}`); L.line.setAttribute("opacity", out.toFixed(3));
    L.dot.setAttribute("cx", ax); L.dot.setAttribute("cy", ay); L.dot.setAttribute("opacity", (p * out).toFixed(3));
  }
  // the cut
  const [sx, sy] = anchorAt("snap", t), q = seg(t, T.cuts, T.cuts + 0.5), hold = 1 - eo(seg(t, T.so, T.so + 0.5));
  ring.setAttribute("cx", sx); ring.setAttribute("cy", sy); ring.setAttribute("r", (22 + 26 * eo(q)) * u * c.s ** 0.4); ring.setAttribute("opacity", (q > 0 ? (1 - 0.35 * q) * hold : 0).toFixed(3));
  const d = 40 * u * c.s ** 0.4 * eo(seg(t, T.cuts + 0.1, T.cuts + 0.45));
  slash.setAttribute("d", `M${sx - d},${sy + d} L${sx + d},${sy - d}`); slash.setAttribute("opacity", (q > 0 ? hold : 0).toFixed(3));
  // new endings: three branches grow from the nerve ending toward the muscle (drawn, not part of the art), then the messenger dots flow again
  const gp = seg(t, T.grows - 0.1, T.later), sv = (1 - eo(seg(t, S("vo06") + 1.0, S("vo06") + 1.8)));
  SPROUT.forEach((q2, i) => {
    const pp = ease(Math.min(1, Math.max(0, (gp - i * 0.12) / 0.76))), pts = [], n = 18;
    for (let j = 0; j <= n; j++) { const [bx, by] = bez(q2, (j / n) * pp); const [qx, qy] = toScreen(bx, by, c); pts.push(`${j ? "L" : "M"}${qx.toFixed(1)},${qy.toFixed(1)}`); }
    sprouts[i].setAttribute("d", pts.join(" ")); sprouts[i].setAttribute("opacity", (pp > 0 ? sv : 0).toFixed(3));
    const [ex, ey] = toScreen(...bez(q2, pp), c); tips[i].setAttribute("cx", ex); tips[i].setAttribute("cy", ey); tips[i].setAttribute("r", 9 * u * c.s ** 0.3); tips[i].setAttribute("opacity", (pp > 0.05 ? sv : 0).toFixed(3));
  });
  const fv = eo(seg(t, T.flows, T.flows + 0.5)) * sv;
  DOTS.forEach((dEl, i) => {
    const ph = ((t * 0.55 + i / DOTS.length) % 1), [bx, by] = bez([0.50, 0.53, 0.53, 0.56, 0.58, 0.58, 0.62, 0.62], ph), jit = Math.sin(i * 7.3) * 0.012;
    const [qx, qy] = toScreen(bx + jit, by - jit, c); dEl.setAttribute("cx", qx); dEl.setAttribute("cy", qy); dEl.setAttribute("r", (8 + 3 * Math.sin(i)) * u * c.s ** 0.3); dEl.setAttribute("opacity", (fv * (0.35 + 0.65 * Math.sin(Math.PI * ph))).toFixed(3));
  });
  // captions and the end card
  const ev = eo(seg(t, T.next - 0.3, T.next + 0.2));
  let pg = null; for (const g of pages) if (t >= g[0].t0 - 0.05 && t <= g[g.length - 1].t1 + 0.3) pg = g;
  capEl.innerHTML = !pg || ev > 0.2 ? "" : `<span class="pg">${pg.map((w) => `<span class="${t >= w.t0 && t < w.t1 ? "on" : ""}">${w.w}</span>`).join(" ")}</span>`;
  endc.style.opacity = ev.toFixed(3);
  const hh = root.querySelector(".h1"), ey = root.querySelector(".eyebrow"); hh.style.opacity = ey.style.opacity = (1 - ev).toFixed(3);
};

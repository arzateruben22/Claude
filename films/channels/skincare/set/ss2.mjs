// Skin Sense, new art direction: the shared composition engine (ivory ground, navy serif headline, sans text, ivory pills with pinned
// leaders, close-up camera moves on a still, plates/charts drawn in code, word-lit captions, end card). An episode brings
// episode.json (its cues, labels and plates; times are words: "vo02:Every", "vo02:The#1+0.3", "start:vo03", "end:vo03+0.4")
// and art (text-free stills with common 0-1 coordinates). Art is a SLOT: replace the images, keep the anchors.
export async function run({ stage, FILM, W, H, EP }) {
  const u = W / 1080, NAVY = "#0E1B3D", IVORY = "#F8F2E7", TEAL = "#2F8F86", GOLD = "#B8862B";
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a))), ease = (x) => x * x * (3 - 2 * x), eo = (x) => 1 - Math.pow(1 - x, 3);
  const px = (v) => `${(v * u).toFixed(2)}px`, CAPS = FILM.captions, LN = FILM.lines;
  const nk = (x) => x.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const R = (spec) => {   // time spec -> seconds
    if (typeof spec === "number") return spec;
    const m = spec.match(/^(?:(start|end|hold):)?([a-z0-9]+)(?::([^#+]+))?(?:#(\d+))?(?:\+(-?[\d.]+))?$/i) || spec.match(/^([a-z0-9]+):([^#+]+)(?:#(\d+))?(?:([+-][\d.]+))?$/i);
    const mm = spec.match(/^(?:(start|end|hold):)?(vo\d+)(?::([^#+]*))?(?:#(\d+))?(?:([+-][\d.]+))?$/);
    if (!mm) throw new Error("bad time spec " + spec);
    const [, kind, id, word, n, off] = mm, o = Number(off || 0);
    if (kind === "start") return LN[id][0] + o; if (kind === "end") return LN[id][1] + o; if (kind === "hold") return LN[id][1] + 0.4 + o;
    const hit = CAPS.filter((c) => c.line === id && nk(c.w) === nk(word)); if (!hit[Number(n || 0)]) throw new Error(`no word ${word} in ${id}`);
    return hit[Number(n || 0)].t0 + o;
  };
  const stageEl = document.getElementById("stage"), css = document.createElement("style");
  css.textContent = `
.ss{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 38%,#FBF6EC 0%,${IVORY} 60%,#F1E8D8 100%);color:${NAVY};font-family:"Red Hat Text",sans-serif;overflow:hidden}
.ss .eyebrow{position:absolute;left:0;right:0;top:${px(92)};text-align:center;font:600 ${px(30)}/1 "Red Hat Text";letter-spacing:.34em}
.ss .h1{position:absolute;left:${px(40)};right:${px(40)};top:${px(160)};text-align:center;font:600 ${px(EP.titleSize || 94)}/${px(104)} "Newsreader",serif;text-transform:uppercase}
.ss .sup{position:absolute;left:${px(60)};right:${px(60)};top:${px(420)};text-align:center;font:400 ${px(48)}/${px(60)} "Red Hat Text"}
.ss .artbox{position:absolute;left:0;width:${px(1080)};top:${px(560)};height:${px(1060)};overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 12%,#000 82%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 12%,#000 82%,transparent 100%)}
.ss .artbox img{position:absolute;left:0;top:0;transform-origin:0 0;max-width:none}
.ss .pill{position:absolute;left:0;top:0;padding:${px(12)} ${px(26)};border-radius:${px(40)};background:${IVORY};border:${px(2)} solid rgba(14,27,61,.18);box-shadow:0 ${px(6)} ${px(18)} rgba(14,27,61,.16);font:700 ${px(30)}/1 "Red Hat Text";letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.ss .cap{position:absolute;left:0;right:0;top:${px(1620)};text-align:center}
.ss .cap span.pg{display:inline-block;background:rgba(248,242,231,.94);border:${px(2)} solid rgba(14,27,61,.14);border-radius:${px(22)};padding:${px(14)} ${px(30)};font:600 ${px(54)}/1.1 "Red Hat Text";box-shadow:0 ${px(6)} ${px(18)} rgba(14,27,61,.12)}
.ss .cap .on{box-shadow:inset 0 ${px(-8)} 0 ${TEAL}}
.ss .ph{position:absolute;left:${px(40)};top:${px(1540)};font:600 ${px(22)}/1 "Red Hat Mono";letter-spacing:.08em;padding:${px(8)} ${px(14)};border:${px(2)} dashed ${GOLD};border-radius:${px(8)};background:rgba(248,242,231,.9);color:#6E4C0A;text-transform:uppercase}
.ss .foot{position:absolute;left:0;right:0;text-align:center}
.ss .foot.a{top:${px(1776)};font:400 ${px(30)}/1 "Red Hat Text";letter-spacing:.03em}.ss .foot.b{top:${px(1828)};font:400 ${px(27)}/1 "Red Hat Text";letter-spacing:.03em;opacity:.85}
.ss .rule{position:absolute;top:${px(1790)};height:${px(2)};background:rgba(14,27,61,.4);width:${px(190)}}
.ss .badge{position:absolute;left:${px(40)};top:${px(590)};padding:${px(8)} ${px(16)};border-radius:${px(30)};background:rgba(248,242,231,.92);border:${px(2)} solid rgba(14,27,61,.2);font:600 ${px(24)}/1 "Red Hat Text";letter-spacing:.05em;text-transform:uppercase;opacity:0}
.ss .plate{position:absolute;left:${px(70)};right:${px(70)};top:${px(640)};padding:${px(46)} ${px(46)};border:${px(2)} solid rgba(14,27,61,.22);border-radius:${px(26)};background:rgba(251,247,238,.97);box-shadow:0 ${px(10)} ${px(34)} rgba(14,27,61,.14);opacity:0}
.ss .plate .pt{font:600 ${px(46)}/1.15 "Newsreader",serif;margin-bottom:${px(26)}}
.ss .plate .row{display:flex;justify-content:space-between;align-items:baseline;gap:${px(24)};padding:${px(18)} 0;border-top:${px(2)} solid rgba(14,27,61,.16);font:500 ${px(44)}/1.15 "Red Hat Text";opacity:0}
.ss .plate .row small{font:400 ${px(28)}/1.2 "Red Hat Text";opacity:.8;text-align:right}
.ss .plate .bar{height:${px(54)};border-radius:${px(10)};background:${NAVY};width:0}
.ss .plate .bl{font:500 ${px(34)}/1.2 "Red Hat Text";margin:${px(18)} 0 ${px(8)};opacity:0}
.ss .plate .tag{display:inline-block;margin:0 ${px(10)} ${px(14)} 0;padding:${px(8)} ${px(18)};border-radius:${px(30)};background:rgba(47,143,134,.14);border:${px(2)} solid ${TEAL};font:600 ${px(28)}/1 "Red Hat Text";opacity:0}
.ss .plate .note{margin-top:${px(24)};font:italic 400 ${px(34)}/1.25 "Newsreader",serif;opacity:0}
.ss .endc{position:absolute;inset:0;background:rgba(248,242,231,.92);text-align:center;opacity:0;pointer-events:none}
.ss .endc .e1{position:absolute;left:0;right:0;top:${px(560)};font:600 ${px(100)}/${px(112)} "Newsreader",serif}.ss .endc .e2{position:absolute;left:${px(80)};right:${px(80)};top:${px(880)};font:400 ${px(60)}/1.2 "Red Hat Text"}
.ss .endc .chip{position:absolute;left:50%;top:${px(1040)};transform:translateX(-50%);padding:${px(14)} ${px(36)};border:${px(2.5)} solid ${NAVY};border-radius:${px(50)};font:600 ${px(36)}/1 "Red Hat Text";white-space:nowrap}
.ss .endc .e3{position:absolute;left:0;right:0;top:${px(1150)};font:400 ${px(28)}/1 "Red Hat Text";opacity:.8}
svg.lead{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}`;
  document.head.appendChild(css);
  const root = document.createElement("div"); root.className = "ss";
  root.innerHTML = `<div class="eyebrow">SKIN SENSE · EPISODE ${EP.num}</div><div class="h1">${EP.title}</div><div class="sup" id="sup"></div>
<div class="artbox" id="artbox"></div>${EP.placeholder ? `<div class="ph">${EP.placeholder}</div>` : ""}<svg class="lead" id="lead"></svg><div id="pills"></div><div class="badge" id="badge"></div><div id="plates"></div>
<div class="cap" id="cap"></div><div class="rule" style="left:${px(80)}"></div><div class="rule" style="right:${px(80)}"></div>
<div class="foot a">Conceptual illustration · not to scale</div><div class="foot b">Education, not medical advice</div>
<div class="endc" id="endc"><div class="e1">${EP.end.e1}</div><div class="e2">${EP.end.e2}</div><div class="chip">${EP.end.chip}</div><div class="e3">Narration: synthetic voice (AI).</div></div>`;
  stageEl.insertBefore(root, stageEl.firstChild);
  const $ = (s) => root.querySelector(s), artbox = $("#artbox"), lead = $("#lead"), pills = $("#pills"), supEl = $("#sup"), capEl = $("#cap"), badge = $("#badge"), endc = $("#endc");
  // art: every image is the same size and coordinates (0-1); the active one cross-fades
  const AW = 1080 * u, BH = 1060 * u, BTOP = 560 * u, imgs = {};
  let AH = 0;
  for (const [k, im] of Object.entries(EP.images)) { const el = document.createElement("img"); el.src = im.src; AH = AW * im.h / im.w; el.style.width = `${AW}px`; el.style.height = `${AH}px`; el.style.opacity = "0"; artbox.appendChild(el); imgs[k] = el; }
  const TOP0 = (BH - AH) / 2; for (const el of Object.values(imgs)) el.style.top = `${TOP0}px`;
  await Promise.all(Object.values(imgs).map((el) => el.decode ? el.decode().catch(() => {}) : null));
  const KF = EP.camera.map((k) => ({ ...k, t: R(k.t) }));
  const camAt = (t) => {
    let i = 0; for (let k = 0; k < KF.length; k++) if (t >= KF[k].t - 0.05) i = k;
    const a = KF[Math.max(0, i - 1)], b = KF[i], m = i ? ease(seg(t, b.t - 0.05, b.t + 0.9)) : 1, drift = 1 + 0.025 * seg(t, b.t, b.t + 4);
    return { s: (a.s + (b.s - a.s) * m) * drift, fx: a.f[0] + (b.f[0] - a.f[0]) * m, fy: a.f[1] + (b.f[1] - a.f[1]) * m, a: a.img, b: b.img, m };
  };
  const toScreen = (nx, ny, c) => [AW / 2 + (nx - c.fx) * AW * c.s, BTOP + BH / 2 + (ny - c.fy) * AH * c.s];
  const NS = "http://www.w3.org/2000/svg", mk = (tag, at, first) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); first ? lead.insertBefore(e, lead.firstChild) : lead.appendChild(e); return e; };
  await document.fonts.ready;
  const LABELS = EP.labels.map((L) => ({ ...L, t0: R(L.t0), t1: R(L.t1) }));
  for (const L of LABELS) {
    L.pill = document.createElement("div"); L.pill.className = "pill"; L.pill.textContent = L.text; pills.appendChild(L.pill); const r = L.pill.getBoundingClientRect(); L.pw = r.width; L.ph = r.height;
    L.line = mk("path", { stroke: NAVY, "stroke-width": 2.4 * u, fill: "none" }); L.dot = mk("circle", { r: 8 * u, fill: IVORY, stroke: NAVY, "stroke-width": 2.4 * u });
  }
  const PLATES = (EP.plates || []).map((P) => ({ ...P, t0: R(P.t0), t1: R(P.t1), rows: (P.rows || []).map((r) => ({ ...r, t: R(r.t) })), tags: (P.tags || []).map((g) => ({ ...g, t: R(g.t) })), bars: (P.bars || []).map((b) => ({ ...b, t: R(b.t) })), noteT: P.note ? R(P.noteT) : 0 }));
  const plEls = PLATES.map((P) => { const d = document.createElement("div"); d.className = "plate"; d.style.top = px(P.top || 640);
    d.innerHTML = `<div class="pt">${P.title}</div>` + (P.tags.length ? `<div>${P.tags.map((g) => `<span class="tag">${g.text}</span>`).join("")}</div>` : "") + P.rows.map((r) => `<div class="row"><span>${r.text}</span><small>${r.small || ""}</small></div>`).join("") + P.bars.map((b) => `<div class="bl">${b.label}</div><div class="bar" style="background:${b.color || NAVY}"></div>`).join("") + (P.note ? `<div class="note">${P.note}</div>` : "");
    $("#plates").appendChild(d); return d; });
  const SUP = EP.sup.map(([t, h]) => [R(t), h]), BADGES = EP.badges.map(([a, z, tx]) => [R(a), R(z), tx]), QUIET = (EP.quiet || []).map(([a, z]) => [R(a), R(z)]);
  const SCAN = (EP.scan || []).map(([a, z]) => [R(a), R(z)]), scanEl = mk("rect", { x: 0, width: W, height: 6 * u, fill: TEAL, opacity: 0 });
  const NEXT = R(EP.end.t), pages = []; let cur = [];
  for (const w of CAPS) { cur.push(w); if (cur.length >= 3 || /[,.?:]$/.test(w.w) || (cur.length >= 2 && cur[0].line !== w.line)) { pages.push(cur); cur = []; } } if (cur.length) pages.push(cur);
  window.seek = function (t) {
    stage(t);
    const c = camAt(t), F = [c.fx * AW, TOP0 + c.fy * AH];
    let q = 0; for (const [a, z] of QUIET) q = Math.max(q, Math.min(eo(seg(t, a, a + 0.5)), 1 - eo(seg(t, z - 0.4, z))));
    for (const [k, el] of Object.entries(imgs)) { el.style.transform = `translate(${AW / 2 - F[0] * c.s}px,${BH / 2 - F[1] * c.s}px) scale(${c.s})`; el.style.opacity = (c.a === c.b ? (k === c.b ? 1 : 0) : (k === c.b ? c.m : k === c.a ? 1 - c.m : 0)).toFixed(3); }
    artbox.style.opacity = (1 - 0.94 * q).toFixed(3);
    const ev = eo(seg(t, NEXT - 0.3, NEXT + 0.2));
    let k = 0; for (let i = 0; i < SUP.length; i++) if (t >= SUP[i][0]) k = i;
    if (supEl.dataset.k !== String(k)) { supEl.innerHTML = SUP[k][1]; supEl.dataset.k = String(k); }
    supEl.style.opacity = (eo(seg(t, SUP[k][0], SUP[k][0] + 0.35)) * (1 - q) * (1 - ev)).toFixed(3);
    const b = BADGES.find(([a, z]) => t >= a && t < z); if (b) badge.textContent = b[2];
    badge.style.opacity = b ? (eo(seg(t, b[0], b[0] + 0.3)) * (1 - eo(seg(t, b[1] - 0.3, b[1]))) * (1 - q)).toFixed(3) : "0";
    PLATES.forEach((P, i) => { const d = plEls[i]; d.style.opacity = (Math.min(P.t0 <= 0.1 ? 1 : eo(seg(t, P.t0, P.t0 + 0.45)), 1 - eo(seg(t, P.t1 - 0.4, P.t1)))).toFixed(3);
      const tg = d.querySelectorAll(".tag"); P.tags.forEach((g, j) => { tg[j].style.opacity = eo(seg(t, g.t, g.t + 0.4)).toFixed(3); });
      const rows = d.querySelectorAll(".row"), bl = d.querySelectorAll(".bl"), bars = d.querySelectorAll(".bar");
      P.rows.forEach((r, j) => { rows[j].style.opacity = (0.18 + 0.82 * eo(seg(t, r.t, r.t + 0.4))).toFixed(3); rows[j].style.fontWeight = t >= r.t ? "700" : "500"; });
      P.bars.forEach((bb, j) => { const p = eo(seg(t, bb.t, bb.t + 0.9)); bl[j].style.opacity = eo(seg(t, bb.t - 0.1, bb.t + 0.3)).toFixed(3); bars[j].style.width = `${(bb.value / bb.max * 100 * p).toFixed(1)}%`; });
      const nt = d.querySelector(".note"); if (nt) nt.style.opacity = eo(seg(t, P.noteT, P.noteT + 0.4)).toFixed(3); });
    for (const L of LABELS) {
      const [nx, ny] = L.a; const [ax, ay] = toScreen(nx, ny, c);
      const inside = eo(seg(ay, BTOP + 10 * u, BTOP + 90 * u)) * (1 - eo(seg(ay, BTOP + BH - 150 * u, BTOP + BH - 80 * u))) * eo(seg(ax, -10 * u, 60 * u)) * (1 - eo(seg(ax, W - 60 * u, W + 10 * u)));
      const p = eo(seg(t, L.t0, L.t0 + 0.5)), out = (1 - eo(seg(t, L.t1, L.t1 + 0.3))) * inside * (1 - 0.95 * q), vis = p * out, pw = L.pw, ph = L.ph, left = L.off[0] >= 0;
      let px0 = ax + L.off[0] * u, py0 = ay + L.off[1] * u;
      px0 = left ? Math.min(Math.max(px0, 34 * u), W - 34 * u - pw) : Math.min(Math.max(px0, 34 * u + pw), W - 34 * u); py0 = Math.min(Math.max(py0, BTOP + 30 * u + ph / 2), BTOP + BH - 90 * u);
      L.pill.style.opacity = vis.toFixed(3); L.pill.style.transform = `translate(${left ? px0 : px0 - pw}px,${py0 - ph / 2}px)`;
      L.line.setAttribute("d", `M${ax},${ay} L${ax + (px0 - ax) * p},${ay + (py0 - ay) * p}`); L.line.setAttribute("opacity", out.toFixed(3));
      L.dot.setAttribute("cx", ax); L.dot.setAttribute("cy", ay); L.dot.setAttribute("opacity", (p * out).toFixed(3));
    }
    let sc = 0, sy = 0; for (const [a, z] of SCAN) if (t >= a && t <= z) { const p = (t - a) / (z - a); sc = Math.sin(Math.PI * p) ** 0.5; sy = BTOP + 60 * u + p * (BH - 160 * u); }
    scanEl.setAttribute("y", sy); scanEl.setAttribute("opacity", (0.85 * sc * (1 - q)).toFixed(3));
    let pg = null; for (const g of pages) if (t >= g[0].t0 - 0.05 && t <= g[g.length - 1].t1 + 0.3) pg = g;
    capEl.innerHTML = !pg || ev > 0.2 ? "" : `<span class="pg">${pg.map((w) => `<span class="${t >= w.t0 && t < w.t1 ? "on" : ""}">${w.w}</span>`).join(" ")}</span>`;
    endc.style.opacity = ev.toFixed(3); $(".h1").style.opacity = $(".eyebrow").style.opacity = (1 - ev).toFixed(3);
  };
}

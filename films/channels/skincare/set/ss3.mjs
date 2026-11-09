// Skin Sense, new art direction, engine v3 (per-shot pictures with fallbacks, animated overlays, engraved plate): the shared composition engine (ivory ground, navy serif headline, sans text, ivory pills with pinned
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
.ss .foot,.ss .rule{z-index:6}.ss .endc{z-index:5}.ss .rule{position:absolute;top:${px(1790)};height:${px(2)};background:rgba(14,27,61,.4);width:${px(190)}}
.ss .badge{position:absolute;left:${px(40)};top:${px(590)};padding:${px(8)} ${px(16)};border-radius:${px(30)};background:rgba(248,242,231,.92);border:${px(2)} solid rgba(14,27,61,.2);font:600 ${px(24)}/1 "Red Hat Text";letter-spacing:.05em;text-transform:uppercase;opacity:0}
.ss .plate{position:absolute;left:${px(70)};right:${px(70)};top:${px(640)};padding:${px(46)} ${px(46)};border:${px(2)} solid rgba(14,27,61,.22);border-radius:${px(26)};background:rgba(251,247,238,.97);box-shadow:0 ${px(10)} ${px(34)} rgba(14,27,61,.14);opacity:0}
.ss .plate .pt{font:600 ${px(46)}/1.15 "Newsreader",serif;margin-bottom:${px(26)}}
.ss .plate .row{display:flex;justify-content:space-between;align-items:baseline;gap:${px(24)};padding:${px(18)} 0;border-top:${px(2)} solid rgba(14,27,61,.16);font:500 ${px(44)}/1.15 "Red Hat Text";opacity:0}
.ss .plate .row small{font:400 ${px(28)}/1.2 "Red Hat Text";opacity:.8;text-align:right}
.ss .plate .bar{height:${px(54)};border-radius:${px(10)};background:${NAVY};width:0}
.ss .plate .bl{font:500 ${px(34)}/1.2 "Red Hat Text";margin:${px(18)} 0 ${px(8)};opacity:0}
.ss .plate .tag{display:inline-block;margin:0 ${px(10)} ${px(14)} 0;padding:${px(8)} ${px(18)};border-radius:${px(30)};background:rgba(47,143,134,.14);border:${px(2)} solid ${TEAL};font:600 ${px(28)}/1 "Red Hat Text";opacity:0}
.ss .plate .note{margin-top:${px(24)};font:italic 400 ${px(34)}/1.25 "Newsreader",serif;opacity:0}
.ss .endc{position:absolute;inset:0;background:rgba(248,242,231,1);text-align:center;opacity:0;pointer-events:none}
.ss .endc .e1{position:absolute;left:0;right:0;top:${px(560)};font:600 ${px(100)}/${px(112)} "Newsreader",serif}.ss .endc .e2{position:absolute;left:${px(80)};right:${px(80)};top:${px(880)};font:400 ${px(60)}/1.2 "Red Hat Text"}
.ss .endc .chip{position:absolute;left:50%;top:${px(1040)};transform:translateX(-50%);padding:${px(14)} ${px(36)};border:${px(2.5)} solid ${NAVY};border-radius:${px(50)};font:600 ${px(36)}/1 "Red Hat Text";white-space:nowrap}
.ss .endc .e3{position:absolute;left:0;right:0;top:${px(1150)};font:400 ${px(28)}/1 "Red Hat Text";opacity:.8}
.ss .engr{position:absolute;left:${px(70)};right:${px(70)};top:${px(590)};height:${px(980)};border-radius:${px(20)};opacity:0;background:
 radial-gradient(ellipse at 50% 46%,rgba(14,27,61,0) 0,rgba(14,27,61,0) 52%,rgba(14,27,61,.10) 100%),
 repeating-linear-gradient(115deg,rgba(14,27,61,.20) 0,rgba(14,27,61,.20) ${px(1.6)},transparent ${px(1.6)},transparent ${px(7)}),
 repeating-linear-gradient(25deg,rgba(14,27,61,.10) 0,rgba(14,27,61,.10) ${px(1.2)},transparent ${px(1.2)},transparent ${px(9)}),#F4EAD3;
 box-shadow:inset 0 0 0 ${px(8)} #F4EAD3,inset 0 0 0 ${px(11)} rgba(14,27,61,.65),inset 0 0 0 ${px(15)} #F4EAD3,inset 0 0 0 ${px(17)} rgba(14,27,61,.4),0 ${px(10)} ${px(34)} rgba(14,27,61,.18)}
svg.lead{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}`;
  document.head.appendChild(css);
  const root = document.createElement("div"); root.className = "ss";
  root.innerHTML = `<div class="eyebrow">${EP.eyebrow || "SKIN SENSE · EPISODE " + EP.num}</div><div class="h1">${EP.title}</div><div class="sup" id="sup"></div>
<div class="engr" id="engr"></div><div class="artbox" id="artbox"></div><div class="ph" id="ph" style="display:none">${EP.placeholder || ""}</div><svg class="lead" id="fxs"></svg><svg class="lead" id="lead"></svg><div id="pills"></div><div class="badge" id="badge"></div><div id="plates"></div>
<div class="cap" id="cap"></div><div class="rule" style="left:${px(80)}"></div><div class="rule" style="right:${px(80)}"></div>
<div class="foot a">Conceptual illustration · not to scale</div><div class="foot b">Education, not medical advice</div>
<div class="endc" id="endc"><div class="e1">${EP.end.e1}</div><div class="e2">${EP.end.e2}</div><div class="chip">${EP.end.chip}</div><div class="e3">${EP.end.e3 || "Narration: synthetic voice (AI)."}</div></div>`;
  stageEl.insertBefore(root, stageEl.firstChild);
  const $ = (s) => root.querySelector(s), artbox = $("#artbox"), lead = $("#lead"), fxs = $("#fxs"), pills = $("#pills"), supEl = $("#sup"), capEl = $("#cap"), badge = $("#badge"), endc = $("#endc"), engr = $("#engr");
  const AW = 1080 * u, BH = 1060 * u, BTOP = 560 * u, IM = {};
  let HAVE = []; try { HAVE = await (await fetch(EP.artIndex || "art/index.json")).json(); } catch (e) { HAVE = []; }
  const loadImg = (srcs) => new Promise((res) => { let i = 0; const nx = () => { while (i < srcs.length && !HAVE.includes(srcs[i].split("/").pop())) i++; if (i >= srcs.length) return res(null); const j = i++, el = new Image(); el.onload = () => res({ el, idx: j }); el.onerror = nx; el.src = srcs[j]; }; nx(); });
  for (const [k, im] of Object.entries(EP.images)) {
    const r = await loadImg([].concat(im.src)); if (!r) throw new Error("no picture for " + k);
    const el = r.el, h = AW * el.naturalHeight / el.naturalWidth; el.style.cssText = `${im.filter ? "filter:" + im.filter + ";" : ""}position:absolute;left:0;transform-origin:0 0;max-width:none;width:${AW}px;height:${h}px;top:0;opacity:0`; artbox.appendChild(el);
    IM[k] = { el, AH: h, TOP0: (BH - h) / 2, fb: r.idx >= (im.real || 2) };
    // motion control (kits/cinema/motion): three depth layers in one wrapper; the wrapper takes the camera, each layer its own parallax
    if (im.layers) { const ls = await Promise.all(im.layers.map((x) => loadImg([x]))); if (ls.every(Boolean)) {
      const w = document.createElement("div"); w.style.cssText = `${im.filter ? "filter:" + im.filter + ";" : ""}position:absolute;left:0;top:0;transform-origin:0 0;width:${AW}px;height:${h}px;opacity:0`;
      el.remove(); ls.forEach((x) => { x.el.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;max-width:none"; w.appendChild(x.el); }); artbox.appendChild(w);
      Object.assign(IM[k], { el: w, lay: ls.map((x) => x.el), par: im.par || [0, 0.55, 1], blur: im.blur || 9 }); } }
  }
  if (EP.placeholder && Object.values(IM).some((g) => g.fb)) $("#ph").style.display = "block";
  const KF = EP.camera.map((k) => { const fbk = IM[k.img].fb; const u2 = fbk && k.fb ? k.fb : k; return { ...k, s: u2.s, f: u2.f, t: R(k.t), anchors: (fbk && k.fbAnchors) ? k.fbAnchors : (k.anchors || EP.anchors || {}) }; });
  const CH = KF.filter((k, i) => i && KF[i - 1].img !== k.img).map((k) => k.t);
  const drift = (t, b) => 1 + 0.025 * seg(t, b.t, b.t + 4);
  const camAt = (t) => {
    let i = 0; for (let k = 0; k < KF.length; k++) if (t >= KF[k].t - 0.05) i = k;
    const a = KF[Math.max(0, i - 1)], b = KF[i], m = i ? ease(seg(t, b.t - 0.05, b.t - 0.05 + (b.d || 0.95))) : 1, P = {};
    if (!(!i || a.img === b.img)) { /* roles set below */ }
    if (!i || a.img === b.img) P[b.img] = { s: (a.s + (b.s - a.s) * m) * drift(t, b), fx: a.f[0] + (b.f[0] - a.f[0]) * m, fy: a.f[1] + (b.f[1] - a.f[1]) * m, op: 1 };
    else { P[a.img] = { s: a.s * drift(t, b) * (1 + (b.zout || 0) * m), fx: a.f[0], fy: a.f[1], op: 1 - m }; P[b.img] = { s: b.s * (1 + (b.zin === undefined ? 0.05 : b.zin) * (1 - m)) * drift(t, b), fx: b.f[0], fy: b.f[1], op: m }; }
    if (i && a.img !== b.img) { P[a.img].role = -1; P[a.img].xm = m; P[b.img].role = 1; P[b.img].xm = m; }
    const iv = (x, y) => x + (y - x) * m;
    for (const n in P) { const A = n === b.img && a.img === b.img ? a : b, B2 = b; P[n].trk = [iv(A.trk ? A.trk[0] : 0, B2.trk ? B2.trk[0] : 0), iv(A.trk ? A.trk[1] : 0, B2.trk ? B2.trk[1] : 0)]; P[n].dolly = iv(A.dolly || 0, B2.dolly || 0); P[n].rack = B2.rack === undefined ? null : (A.rack === undefined ? B2.rack : iv(A.rack, B2.rack)); }
    return { b, m, P, img: b.img, t };
  };
  const layerX = (p, g, i, t) => { const par = g.par[i]; return { tx: p.trk[0] * AW * par + Math.sin(t * 0.9 + i * 1.7) * 1.5 * u * i, ty: p.trk[1] * g.AH * par + Math.cos(t * 0.7 + i) * 1.3 * u * i, sc: 1 + p.dolly * par + 0.002 * Math.sin(t * 0.5 + i) }; };
  const scr = (name, nx, ny, c, layer) => { const p = c.P[name], g = IM[name]; let X = nx * AW, Y = ny * g.AH; const FX = p.fx * AW, FY = p.fy * g.AH;
    if (layer != null && g.lay) { const q = layerX(p, g, layer, c.t); X = FX + (X - FX) * q.sc + q.tx; Y = FY + (Y - FY) * q.sc + q.ty; }
    return [AW / 2 + (X - FX) * p.s, BTOP + BH / 2 + (Y - FY) * p.s]; };
  const NS = "http://www.w3.org/2000/svg", mk = (tag, at, par = lead, first) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); first ? par.insertBefore(e, par.firstChild) : par.appendChild(e); return e; };
  await document.fonts.ready;
  const defs = mk("defs", {}, fxs); defs.innerHTML = `<radialGradient id="gT"><stop offset="0" stop-color="#48BFB0" stop-opacity=".95"/><stop offset=".55" stop-color="#48BFB0" stop-opacity=".45"/><stop offset="1" stop-color="#48BFB0" stop-opacity="0"/></radialGradient>
<radialGradient id="gD"><stop offset="0" stop-color="#2A2060" stop-opacity=".95"/><stop offset=".6" stop-color="#2A2060" stop-opacity=".6"/><stop offset="1" stop-color="#3B2F72" stop-opacity="0"/></radialGradient>
<radialGradient id="gB" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFF4E8" stop-opacity=".9"/><stop offset=".5" stop-color="#F6D9C6" stop-opacity=".35"/><stop offset="1" stop-color="#9A5A48" stop-opacity=".38"/></radialGradient><radialGradient id="gW"><stop offset="0" stop-color="#EAF8FF" stop-opacity="1"/><stop offset=".45" stop-color="#8CCBE4" stop-opacity=".55"/><stop offset="1" stop-color="#8CCBE4" stop-opacity="0"/></radialGradient><radialGradient id="gG"><stop offset="0" stop-color="#FFF3C4" stop-opacity="1"/><stop offset=".45" stop-color="#F2C45A" stop-opacity=".55"/><stop offset="1" stop-color="#F2C45A" stop-opacity="0"/></radialGradient><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(1.3 * u).toFixed(2)}"/></filter><filter id="soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(3 * u).toFixed(2)}"/></filter>`;
  const XF = (EP.xforms || []).map((x) => ({ ...x, t0: R(x.t0), t1: R(x.t1) }));
  const SWEEPS = (EP.sweeps || []).map((w) => { const d = document.createElement("div"); d.style.cssText = `position:absolute;left:-30%;top:-10%;width:160%;height:120%;pointer-events:none;mix-blend-mode:soft-light;opacity:0;background:linear-gradient(${w.ang || 105}deg,rgba(255,250,238,0) ${50 - 100 * (w.w || 0.12)}%,rgba(255,252,242,1) 50%,rgba(255,250,238,0) ${50 + 100 * (w.w || 0.12)}%)`; artbox.appendChild(d); return { ...w, t0: R(w.t0), t1: R(w.t1), d }; });
  const PART = (EP.particles || []).map((g) => { const els = Array.from({ length: g.n || 14 }, (_, i) => { const e = document.createElement("div"), fr = (x) => { const v = Math.sin(x) * 43758.5453; return v - Math.floor(v); }; e.dataset.k = JSON.stringify([fr(i * 91.7), fr(i * 17.3), 0.5 + fr(i * 5.1), 2 + 5 * fr(i * 3.3)]); e.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;background:rgba(244,214,150,.75);filter:blur(${(0.6 + 1.4 * fr(i * 7.7)).toFixed(1)}px)`; artbox.appendChild(e); return e; }); return { ...g, els }; });
  const LABELS = EP.labels.map((L) => ({ ...L, t0: R(L.t0), t1: R(L.t1) }));
  for (const L of LABELS) { L.pill = document.createElement("div"); L.pill.className = "pill"; L.pill.innerHTML = L.text.replace(/µm/g, '<span style="text-transform:none">µm</span>'); pills.appendChild(L.pill); const r = L.pill.getBoundingClientRect(); L.pw = r.width; L.ph = r.height;
    L.line = mk("path", { stroke: NAVY, "stroke-width": 2 * u, fill: "none", "stroke-linecap": "round" }); L.dot = mk("circle", { r: 7 * u, fill: IVORY, stroke: NAVY, "stroke-width": 2 * u }); }
  // animated overlays (soft, translucent): spray (messenger molecules), toxin (soft dark particles on a path), snap (a strand that parts), sprouts (new endings)
  const FX = (EP.fx || []).map((f0) => { const f = { ...f0, ...(f0.img && IM[f0.img].fb && f0.fb ? f0.fb : {}) }; return { ...f, t0: R(f.t0), t1: R(f.t1), cut: f.cut ? R(f.cut) : 0 }; }).filter((f) => !(f.fbOnly && !(f.img && IM[f.img].fb)));
  const gFx = mk("g", { filter: "url(#soft)" }, fxs);
  for (const f of FX) {
    f.els = [];
    if (f.type === "spray") for (let i = 0; i < f.n; i++) f.els.push(mk("circle", { fill: "url(#gT)", opacity: 0 }, gFx));
    if (f.type === "toxin") for (let i = 0; i < f.n; i++) f.els.push(mk("circle", { fill: "url(#gD)", opacity: 0 }, gFx));
    if (f.type === "snap") { f.els = [mk("path", { fill: "none", stroke: "#D9F2EE", "stroke-width": 7 * u, "stroke-linecap": "round", opacity: 0 }, gFx), mk("path", { fill: "none", stroke: "#D9F2EE", "stroke-width": 7 * u, "stroke-linecap": "round", opacity: 0 }, gFx), mk("circle", { fill: "url(#gT)", opacity: 0 }, gFx)]; }
    if (f.type === "ink") f.els = f.paths.map(() => mk("path", { fill: "none", stroke: f.color || "#D8505F", "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }, gFx));
    if (f.type === "stream") f.els = Array.from({ length: f.n || 12 }, () => mk("circle", { fill: f.color || "#F7D9D9", opacity: 0 }, gFx));
    if (f.type === "pulse") f.els = [mk("path", { fill: "none", stroke: "#8FE6DA", "stroke-width": 8 * u, "stroke-linecap": "round", opacity: 0 }, gFx), mk("circle", { fill: "url(#gT)", opacity: 0 }, gFx), mk("circle", { fill: "#F4FFFC", opacity: 0 }, gFx)];
    if (f.type === "flow") f.els = Array.from({ length: f.n || 9 }, () => mk("path", { fill: "none", stroke: "#D4E8F4", "stroke-width": 2.4 * u, "stroke-linecap": "round", opacity: 0 }, gFx));
    if (f.type === "strand") f.els = [mk("path", { fill: "none", stroke: f.color || "#D8707F", "stroke-width": 10 * u, "stroke-linecap": "round", opacity: 0 }, gFx), mk("path", { fill: "none", stroke: "#FFD9D9", "stroke-width": 3 * u, "stroke-linecap": "round", opacity: 0 }, gFx)];
    if (f.type === "bumps") f.els = Array.from({ length: (f.n || 24) * 2 }, (_, i) => mk("circle", i % 2 ? { fill: "url(#gB)", opacity: 0 } : { fill: "rgba(120,62,44,.5)", filter: "url(#soft2)", opacity: 0 }, gFx));
    if (f.type === "dome") f.els = [mk("path", { fill: f.fill || "#EDB69C", opacity: 0 }, gFx), mk("path", { fill: "none", stroke: "#FFF1E4", "stroke-width": 3 * u, "stroke-linecap": "round", opacity: 0 }, gFx)];
    if (f.type === "glow") f.els = Array.from({ length: f.pts.length + (f.split || []).length }, () => mk("circle", { fill: `url(#${f.grad || "gG"})`, opacity: 0 }, gFx));
    if (f.type === "chips") { f.box = document.createElement("div"); f.box.style.cssText = `position:absolute;left:0;right:0;top:${(f.y || 1480) * u}px;display:flex;justify-content:center;gap:${12 * u}px;align-items:center;opacity:0;pointer-events:none`; f.chipEls = f.items.map((it, i) => { const c = document.createElement("div"); c.style.cssText = `font:700 ${34 * u}px "Red Hat Text",sans-serif;padding:${13 * u}px ${24 * u}px;border-radius:${40 * u}px;border:${3 * u}px solid ${NAVY};box-shadow:0 ${6 * u}px ${18 * u}px rgba(14,27,61,.18);background:${IVORY};color:${NAVY};opacity:.45;white-space:nowrap`; c.textContent = it.text; f.box.appendChild(c); if (i < f.items.length - 1) { const a = document.createElement("div"); a.textContent = "→"; a.style.cssText = `font:700 ${34 * u}px sans-serif;color:${NAVY};opacity:.5`; f.box.appendChild(a); } return c; }); pills.appendChild(f.box); f.items.forEach((it) => { it.t = R(it.t); }); f.tr = mk("path", { fill: "none", stroke: TEAL, "stroke-width": 3 * u, "stroke-linejoin": "round", opacity: 0 }, fxs); if (f.spike) f.spike = R(f.spike); }
    if (f.type === "sprouts") f.els = f.branches.flatMap(() => [mk("path", { fill: "none", stroke: "#E3A92F", "stroke-width": 10 * u, "stroke-linecap": "round", opacity: 0 }, gFx), mk("circle", { fill: "#F0C36A", opacity: 0 }, gFx)]);
  }
  const bez = (q, p) => { const [x0, y0, x1, y1, x2, y2, x3, y3] = q, m = 1 - p; return [m ** 3 * x0 + 3 * m * m * p * x1 + 3 * m * p * p * x2 + p ** 3 * x3, m ** 3 * y0 + 3 * m * m * p * y1 + 3 * m * p * p * y2 + p ** 3 * y3]; };
  const polyAt = (pts, p) => { const n = pts.length - 1, x = Math.min(0.9999, p) * n, i = Math.floor(x), f = ease(x - i); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; };
  const drawFx = (t, c) => {
    for (const f of FX) {
      const on = c.P[f.img] ? c.P[f.img].op : 0, w = Math.min(eo(seg(t, f.t0, f.t0 + 0.4)), 1 - eo(seg(t, f.t1 - 0.5, f.t1))) * on, S = (x, y) => c.P[f.img] ? scr(f.img, x, y, c) : [0, 0], sc = c.P[f.img] ? c.P[f.img].s ** 0.35 : 1;
      if (f.type === "spray") f.els.forEach((el, i) => { const ph = (t * (f.rate || 0.5) + i / f.n) % 1, jx = Math.sin(i * 12.9) * 0.5 + 0.5, x0 = f.from[0] + (f.from[2] - f.from[0]) * jx, y0 = f.from[1];
        const [sx, sy] = S(x0 + Math.sin(ph * 6 + i) * 0.012, y0 + (f.to[1] - y0) * ph), r = (f.r || 8) * u * sc * (0.8 + 0.5 * Math.sin(i * 3.1)); el.setAttribute("cx", sx); el.setAttribute("cy", sy); el.setAttribute("r", r * 1.8); el.setAttribute("opacity", (w * Math.sin(Math.PI * ph) ** 0.8).toFixed(3)); });
      if (f.type === "toxin") f.els.forEach((el, i) => { const p = seg(t, f.t0 + i * 0.35, f.t1 - 0.2 + i * 0.1), [sx, sy] = S(...polyAt(f.path, p)); el.setAttribute("cx", sx); el.setAttribute("cy", sy); el.setAttribute("r", (f.r || 20) * u * sc * (1 - 0.18 * i)); el.setAttribute("opacity", (w * eo(seg(p, 0, 0.1)) * (1 - 0.7 * seg(p, 0.92, 1))).toFixed(3)); });
      if (f.type === "snap") { const [cx, cy] = S(...f.at), L2 = (f.len || 0.07) * AW * (c.P[f.img] ? c.P[f.img].s : 1), k = eo(seg(t, f.cut, f.cut + 0.7)), gap = 16 * u * k * sc, wob = Math.sin(t * 9) * 1.6 * u * k;
        f.els[0].setAttribute("d", `M${cx - L2},${cy + L2 * 0.45} Q${cx - L2 * 0.5},${cy - L2 * 0.2} ${cx - gap},${cy - wob}`); f.els[1].setAttribute("d", `M${cx + gap},${cy + wob} Q${cx + L2 * 0.5},${cy + L2 * 0.2} ${cx + L2},${cy - L2 * 0.45}`);
        f.els[0].setAttribute("opacity", (0.78 * w).toFixed(3)); f.els[1].setAttribute("opacity", (0.78 * w).toFixed(3)); const fl = Math.max(0, 1 - Math.abs(t - f.cut - 0.1) / 0.35); f.els[2].setAttribute("cx", cx); f.els[2].setAttribute("cy", cy); f.els[2].setAttribute("r", 40 * u * sc); f.els[2].setAttribute("opacity", (w * fl).toFixed(3)); }
      const S2 = (x, y) => c.P[f.img] ? scr(f.img, x, y, c, f.layer) : [0, 0];
      if (f.type === "ink") f.els.forEach((el, i) => { const k = eo(seg(t, (f.cut || f.t0), ((f.cut || f.t0)) + (f.dur || 1)) ), pts = f.paths[i].map((q) => S2(...q)), d = "M" + pts.map((q) => q.join(",")).join(" L"); el.setAttribute("d", d); el.setAttribute("stroke-width", ((f.w0 || 8) + ((f.w1 === undefined ? f.w0 || 8 : f.w1) - (f.w0 || 8)) * k) * u * sc);
        if (f.reveal) { const L = el.getTotalLength ? el.getTotalLength() : 1000; el.setAttribute("stroke-dasharray", L); el.setAttribute("stroke-dashoffset", (L * (1 - k)).toFixed(1)); } el.setAttribute("opacity", ((f.a || 0.8) * w * (f.reveal ? Math.min(1, k * 3) : 1)).toFixed(3)); });
      if (f.type === "stream") f.els.forEach((el, i) => { const sp = f.rate || 0.25, ph = (t * sp + i / f.els.length) % 1, [sx, sy] = S2(...polyAt(f.path, ph)); el.setAttribute("cx", sx); el.setAttribute("cy", sy); el.setAttribute("r", (f.r || 6) * u * (0.8 + 0.4 * Math.sin(i * 2.3)) * sc); el.setAttribute("opacity", (0.85 * w * Math.sin(Math.PI * ph) ** 0.5).toFixed(3)); });
      if (f.type === "pulse") { const lp = f.loop ? Math.min(1, ((t - f.t0) % f.loop) / (f.loop * 0.8)) : 0, p = f.loop ? ease(Math.max(0, lp)) : ease(seg(t, f.t0, f.t1)), n = 14, pts = []; for (let j = 0; j <= n; j++) { const q = Math.max(0, p - 0.22) + (p - Math.max(0, p - 0.22)) * j / n; pts.push(S2(...polyAt(f.path, q)).join(",")); } const [hx, hy] = S2(...polyAt(f.path, p)), vis = w * (f.loop ? (lp >= 1 ? 0 : 1) : 1 - eo(seg(t, f.t1, f.t1 + 0.3))) * (t >= f.t0 ? 1 : 0), pl = 1 + 0.15 * Math.sin(t * 24);
        f.els[0].setAttribute("d", "M" + pts.join(" L")); f.els[0].setAttribute("opacity", (0.8 * vis).toFixed(3)); f.els[1].setAttribute("cx", hx); f.els[1].setAttribute("cy", hy); f.els[1].setAttribute("r", 34 * u * pl); f.els[1].setAttribute("opacity", vis.toFixed(3)); f.els[2].setAttribute("cx", hx); f.els[2].setAttribute("cy", hy); f.els[2].setAttribute("r", 7.5 * u); f.els[2].setAttribute("opacity", vis.toFixed(3)); }
      if (f.type === "flow") f.els.forEach((el, i) => { const ph = (t * (f.rate || 0.35) + i / f.els.length) % 1, y0 = f.region[1] + (f.region[3] - f.region[1]) * ((i * 0.618) % 1), x0 = f.region[0] + (f.region[2] - f.region[0]) * ph * (f.dir || 1) + (f.dir < 0 ? (f.region[2] - f.region[0]) : 0), L2 = 0.16 * (0.7 + 0.5 * ((i * 0.37) % 1)), a = S2(x0, y0), b = S2(x0 + L2 * (f.dir || 1), y0 + Math.sin(i * 2 + t) * 0.01), m2 = S2(x0 + L2 * 0.5 * (f.dir || 1), y0 - 0.015 + Math.sin(i + t * 1.3) * 0.012);
        el.setAttribute("d", `M${a[0]},${a[1]} Q${m2[0]},${m2[1]} ${b[0]},${b[1]}`); el.setAttribute("opacity", (0.65 * w * Math.sin(Math.PI * ph)).toFixed(3)); });
      if (f.type === "strand") { const kk0 = seg(t, f.cut, f.cut + (f.dur || 0.9)), k = (f.ov ? 1 + 2.4 * (kk0 - 1) ** 3 + 1.4 * (kk0 - 1) ** 2 : eo(kk0)) + (kk0 >= 1 && f.breath ? f.breath * Math.sin((t - f.cut) * 3.2) : 0), B0 = [f.a[0] + (f.b[0] - f.a[0]) * (1 - (f.k || 0.2) * k), f.a[1] + (f.b[1] - f.a[1]) * (1 - (f.k || 0.2) * k)], rotp = (q) => { let ang = 0, pv = null; for (const x of XF) if (x.img === f.img && x.layer === f.layer) { ang = x.from + (x.to - x.from) * eo(seg(t, x.t0, x.t1)); pv = x.pivot; } if (!pv) return q; const AHh = IM[f.img].AH, r = ang * Math.PI / 180, dx = (q[0] - pv[0]) * AW, dy = (q[1] - pv[1]) * AHh; return [pv[0] + (dx * Math.cos(r) - dy * Math.sin(r)) / AW, pv[1] + (dx * Math.sin(r) + dy * Math.cos(r)) / AHh]; }, [ax, ay] = S2(...rotp(f.a)), [bx, by] = S2(...rotp(B0)), sag = (1 - k) * 0 + k * 6 * u; const d = `M${ax},${ay} Q${(ax + bx) / 2},${(ay + by) / 2 - sag * 3} ${bx},${by}`, vis = w * (t >= f.cut - 0.3 ? 1 : 0);
        f.els[0].setAttribute("d", d); f.els[0].setAttribute("stroke-width", (8 + 9 * k) * u * sc); f.els[0].setAttribute("opacity", (0.85 * vis).toFixed(3)); f.els[1].setAttribute("d", d); f.els[1].setAttribute("opacity", (0.8 * vis).toFixed(3)); }
      if (f.type === "bumps") for (let i = 0; i < f.els.length / 2; i++) { const fx = (Math.sin(i * 12.9898) * 43758.5453) % 1, fy = (Math.sin(i * 78.233) * 12345.678) % 1, rx = f.region[0] + (f.region[2] - f.region[0]) * ((i + 0.5) / (f.els.length / 2)), ry = f.region[1] + (f.region[3] - f.region[1]) * (0.5 + 0.5 * Math.abs(fy)), tp = f.t0 + (f.dur || 2) * (rx - f.region[0]) / (f.region[2] - f.region[0]) + Math.abs(fx) * 0.25, k = seg(t, tp, tp + 0.7), pop = eo(k) * (1 + 0.12 * Math.sin(Math.PI * k)), [sx, sy] = S2(rx, ry), rr = (f.r || 30) * u * (0.8 + 0.5 * Math.abs(fx)) * pop * sc, vis = w * Math.min(1, pop * 1.4);
        const sh = f.els[i * 2], bd = f.els[i * 2 + 1]; sh.setAttribute("cx", sx + rr * 0.12); sh.setAttribute("cy", sy + rr * 0.55); sh.setAttribute("r", rr * 0.95); sh.setAttribute("opacity", (0.55 * vis).toFixed(3)); bd.setAttribute("cx", sx); bd.setAttribute("cy", sy); bd.setAttribute("r", rr); bd.setAttribute("opacity", (0.9 * vis).toFixed(3)); }
      if (f.type === "dome") { const k = eo(seg(t, f.t0, f.t0 + (f.dur || 0.9))), [cx, cy] = S2(...f.at), W2 = (f.w || 0.1) * AW * (c.P[f.img] ? c.P[f.img].s : 1), h = (f.h || 14) * u * k * sc, d = `M${cx - W2},${cy} Q${cx},${cy - h * 2} ${cx + W2},${cy} Z`;
        f.els[0].setAttribute("d", d); f.els[0].setAttribute("opacity", (0.92 * w * (k > 0 ? 1 : 0)).toFixed(3)); f.els[1].setAttribute("d", `M${cx - W2 * 0.8},${cy - h * 0.25} Q${cx},${cy - h * 1.8} ${cx + W2 * 0.6},${cy - h * 0.4}`); f.els[1].setAttribute("opacity", (0.7 * w * (k > 0 ? 1 : 0)).toFixed(3)); }
      if (f.type === "glow") f.els.forEach((el, i) => { const base = i < f.pts.length ? f.pts[i] : f.pts[f.split[i - f.pts.length].i], sp = i < f.pts.length ? null : f.split[i - f.pts.length], k = sp ? eo(seg(t, R(sp.t), R(sp.t) + 1.0)) : 0, [gx, gy] = S2(base[0] + (sp ? 0.03 * k : 0), base[1] + (sp ? -0.02 * k : 0)), pul = 1 + 0.22 * Math.sin(t * 5 + i * 1.7); el.setAttribute("cx", gx); el.setAttribute("cy", gy); el.setAttribute("r", (f.r || 26) * u * pul * (sp ? Math.min(1, k * 1.4) : 1) * sc); el.setAttribute("opacity", (w * (sp ? k : 1) * (0.7 + 0.3 * Math.sin(t * 3 + i))).toFixed(3)); });
      if (f.type === "chips") { const wv = Math.min(eo(seg(t, f.t0, f.t0 + 0.4)), 1 - eo(seg(t, f.t1 - 0.5, f.t1))); f.box.style.opacity = wv.toFixed(3); f.chipEls.forEach((ce, i) => { const lit = t >= f.items[i].t; ce.style.opacity = lit ? "1" : "0.55"; ce.style.background = lit ? TEAL : IVORY; ce.style.color = lit ? "#fff" : NAVY; ce.style.transform = lit ? `scale(${(1 + 0.08 * Math.max(0, 1 - (t - f.items[i].t) / 0.5)).toFixed(3)})` : "none"; ce.style.boxShadow = lit ? `0 0 ${24 * u}px rgba(47,143,134,.65)` : `0 ${6 * u}px ${18 * u}px rgba(14,27,61,.18)`; });
        if (f.spike) { const x0 = W / 2 - 220 * u, y0 = (f.y + 78) * u, ww = 440 * u, k = seg(t, f.spike, f.spike + 1.4), pts = []; for (let j = 0; j <= 60; j++) { const q = j / 60, d2 = q - k, y = y0 - (Math.abs(d2) < 0.05 ? Math.sin((d2 / 0.05 + 1) * Math.PI) * 18 * u : 0); if (q <= Math.min(1, k + 0.05)) pts.push(`${x0 + ww * q},${y}`); } f.tr.setAttribute("d", pts.length > 1 ? "M" + pts.join(" L") : ""); f.tr.setAttribute("opacity", (0.9 * wv).toFixed(3)); } }
      if (f.type === "sprouts") f.branches.forEach((q, i) => { const p = ease(Math.min(1, Math.max(0, (seg(t, f.t0, f.t1 - 1.0) - i * 0.12) / 0.76))), pts = []; for (let j = 0; j <= 16; j++) { const [bx, by] = bez(q, (j / 16) * p), [qx, qy] = S(bx, by); pts.push(`${j ? "L" : "M"}${qx.toFixed(1)},${qy.toFixed(1)}`); }
        const [ex, ey] = S(...bez(q, p)); f.els[i * 2].setAttribute("d", pts.join(" ")); f.els[i * 2].setAttribute("opacity", (p > 0 ? 0.95 * on * (1 - eo(seg(t, f.t1 - 0.6, f.t1))) : 0).toFixed(3)); f.els[i * 2 + 1].setAttribute("cx", ex); f.els[i * 2 + 1].setAttribute("cy", ey); f.els[i * 2 + 1].setAttribute("r", 11 * u * sc); f.els[i * 2 + 1].setAttribute("opacity", (p > 0.05 ? 0.85 * on * (1 - eo(seg(t, f.t1 - 0.6, f.t1))) : 0).toFixed(3)); });
    }
  };
  const PLATES = (EP.plates || []).map((P) => ({ ...P, t0: R(P.t0), t1: R(P.t1), rows: (P.rows || []).map((r) => ({ ...r, t: R(r.t), hl: R(r.hl === undefined ? r.t : r.hl) })), notes: (P.notes || []).map((n) => ({ ...n, t: R(n.t) })), tags: (P.tags || []).map((g) => ({ ...g, t: R(g.t) })), bars: (P.bars || []).map((b) => ({ ...b, t: R(b.t), t2: b.t2 ? R(b.t2) : 0 })), noteT: P.note ? R(P.noteT) : 0, lines: (P.lines || []).map((l) => ({ ...l, t: R(l.t) })) }));
  const plEls = PLATES.map((P) => { const d = document.createElement("div"); d.className = "plate"; d.style.top = px(P.top || 640); if (P.fill) d.style.background = P.fill;
    d.innerHTML = `<div class="pt">${P.title}</div>` + (P.tags.length ? `<div>${P.tags.map((g) => `<span class="tag">${g.text}</span>`).join("")}</div>` : "") + P.lines.map((l) => `<div class="row" style="${l.style || ""}"><span>${l.text}</span></div>`).join("") + P.rows.map((r) => `<div class="row"><span>${r.text}</span><small>${r.small || ""}</small></div>`).join("") + P.bars.map((b) => `<div class="bl">${b.label}</div><div class="bar" style="background:${b.color || NAVY}"></div>`).join("") + (P.note ? `<div class="note">${P.note}</div>` : "") + P.notes.map((n) => `<div class="note">${n.text}</div>`).join("");
    $("#plates").appendChild(d); return d; });
  if (EP.engraving) engr.innerHTML = `<svg viewBox="0 0 940 560" width="100%" height="${560 * u * (940 * u / 940) / u * 0 + 560 * (W - 140 * u) / 940}" style="position:absolute;left:0;top:0"><defs><pattern id="hA" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="9" stroke="#0E1B3D" stroke-width="2.2"/></pattern><pattern id="hB" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="7" stroke="#0E1B3D" stroke-width="1.4"/></pattern></defs>
<g fill="none" stroke="#0E1B3D" stroke-linecap="round" stroke-linejoin="round"><path d="M70 70 Q470 120 870 70" stroke-width="3"/><path d="M70 70 q-20 -4 -30 -22 M870 70 q20 -4 30 -22" stroke-width="3"/><path d="M450 110 l20 -12 l20 12 l-20 12 z" fill="#0E1B3D" stroke-width="2"/>
<path d="M70 130 Q470 190 870 130" stroke-width="5"/>
${[0, 1, 2, 3].map((i) => { const x = 150 + i * 200, y = 150 + 28 * Math.sin((x - 70) / 800 * Math.PI) + 8; return `<path d="M${x} ${y} q-6 22 0 40" stroke-width="3"/><g transform="rotate(${[-4, 3, -3, 4][i]} ${x} ${y + 60})"><rect x="${x - 56}" y="${y + 38}" width="112" height="250" rx="52" fill="url(#hA)" stroke-width="3.5"/><path d="M${x - 40} ${y + 70} q-6 100 4 190" stroke-width="2" opacity=".55"/><path d="M${x - 14} ${y + 38} q-8 -14 0 -22 M${x + 14} ${y + 38} q8 -14 0 -22" stroke-width="3"/></g>`; }).join("")}
<g transform="rotate(-7 470 470)"><path d="M180 430 L600 410 Q650 430 600 458 L180 462 Z" fill="url(#hB)" stroke-width="3.5"/><rect x="600" y="418" width="190" height="34" rx="14" fill="url(#hA)" stroke-width="3.5"/><circle cx="640" cy="435" r="3.5" fill="#0E1B3D"/><circle cx="700" cy="435" r="3.5" fill="#0E1B3D"/><circle cx="755" cy="435" r="3.5" fill="#0E1B3D"/></g>
<path d="M120 540 Q470 560 820 540" stroke-width="2.5"/></g></svg>`;
  const SUP = EP.sup.map(([t, h]) => [R(t), h]), BADGES = EP.badges.map(([a, z, tx]) => [R(a), R(z), tx]), QUIET = (EP.quiet || []).map(([a, z]) => [R(a), R(z)]), ENGR = (EP.engraved || []).map(([a, z]) => [R(a), R(z)]);
  const SCAN = (EP.scan || []).map(([a, z]) => [R(a), R(z)]), scanEl = mk("rect", { x: 0, width: W, height: 6 * u, fill: TEAL, opacity: 0 }, lead);
  const NEXT = R(EP.end.t), pages = []; let cur = [];
  for (const w of CAPS) { cur.push(w); if (cur.length >= 3 || /[,.?:]$/.test(w.w) || (cur.length >= 2 && cur[0].line !== w.line)) { pages.push(cur); cur = []; } } if (cur.length) pages.push(cur);
  window.seek = function (t) {
    stage(t);
    const c = camAt(t);
    let q = 0; for (const [a, z] of QUIET) q = Math.max(q, Math.min(a <= 0.1 ? 1 : eo(seg(t, a, a + 0.5)), 1 - eo(seg(t, z - 0.4, z))));
    let eg = 0; for (const [a, z] of ENGR) eg = Math.max(eg, Math.min(eo(seg(t, a, a + 0.5)), 1 - eo(seg(t, z - 0.4, z)))); engr.style.opacity = eg.toFixed(3);
    for (const [k, g] of Object.entries(IM)) { const p = c.P[k]; if (!p) { g.el.style.opacity = "0"; continue; } const FX0 = p.fx * AW, FY0 = p.fy * g.AH;
      g.el.style.transform = `translate(${AW / 2 - FX0 * p.s}px,${BH / 2 - FY0 * p.s}px) scale(${p.s})`; g.el.style.opacity = p.op.toFixed(3);
      if (g.lay) g.lay[2].style.opacity = p.role ? (p.role < 0 ? 1 - eo(seg(p.xm, 0, 0.45)) : eo(seg(p.xm, 0.55, 1))).toFixed(3) : "1";   // in a dissolve the foreground (hair, muscle) goes out before the next one comes in: no double hair
      if (g.lay) g.lay.forEach((le, i) => { const q = layerX(p, g, i, t); le.style.transformOrigin = `${FX0}px ${FY0}px`; let rt = ""; for (const x of XF) if (x.img === k && x.layer === i) { const kk = seg(t, x.t0, x.t1), a = x.from + (x.to - x.from) * (x.ov ? 1 + 2.4 * (kk - 1) ** 3 + 1.4 * (kk - 1) ** 2 : eo(kk)), px = x.pivot[0] * AW, py = x.pivot[1] * g.AH; rt = ` translate(${px - FX0}px,${py - FY0}px) rotate(${a.toFixed(3)}deg) translate(${FX0 - px}px,${FY0 - py}px)`; } le.style.transform = `translate(${q.tx}px,${q.ty}px) scale(${q.sc})` + rt; le.style.filter = p.rack == null ? "none" : `blur(${(g.blur * u * Math.min(1, Math.max(0, Math.abs(i - p.rack) - 0.4))).toFixed(2)}px)`; }); }
    artbox.style.opacity = ((1 - q) * (1 - eo(seg(t, NEXT - 0.5, NEXT)))).toFixed(3);
    drawFx(t, c);
    const ev = eo(seg(t, NEXT - 0.1, NEXT + 0.4)), ev2 = eo(seg(t, NEXT - 0.5, NEXT - 0.1));
    let k = 0; for (let i = 0; i < SUP.length; i++) if (t >= SUP[i][0]) k = i;
    if (supEl.dataset.k !== String(k)) { supEl.innerHTML = SUP[k][1]; supEl.dataset.k = String(k); }
    supEl.style.opacity = (eo(seg(t, SUP[k][0], SUP[k][0] + 0.35)) * (1 - q) * (1 - eg) * (1 - ev2)).toFixed(3);
    const b = BADGES.find(([a, z]) => t >= a && t < z); if (b) badge.innerHTML = b[2].replace(/µm/g, '<span style="text-transform:none">µm</span>');
    badge.style.opacity = b ? (eo(seg(t, b[0], b[0] + 0.3)) * (1 - eo(seg(t, b[1] - 0.3, b[1]))) * (1 - q) * (1 - eg) * (1 - ev2)).toFixed(3) : "0";
    PLATES.forEach((P, i) => { const d = plEls[i]; d.style.opacity = (Math.min(P.t0 <= 0.1 ? 1 : eo(seg(t, P.t0 + 0.4, P.t0 + 0.85)), 1 - eo(seg(t, P.t1 - 0.85, P.t1 - 0.4)))).toFixed(3);
      const life = seg(t, P.t0, P.t1), dr = P.drift || 1; d.style.transform = `translateY(${(-14 * dr * life * u).toFixed(2)}px) scale(${(1 + 0.035 * dr * life).toFixed(4)})`;
      const tg = d.querySelectorAll(".tag"); P.tags.forEach((g, j) => { tg[j].style.opacity = eo(seg(t, g.t, g.t + 0.4)).toFixed(3); });
      const rows = d.querySelectorAll(".row"), bl = d.querySelectorAll(".bl"), bars = d.querySelectorAll(".bar"), nl = P.lines.length;
      P.lines.forEach((l, j) => { rows[j].style.opacity = eo(seg(t, l.t, l.t + 0.4)).toFixed(3); });
      P.rows.forEach((r, j) => { rows[nl + j].style.opacity = ((P.ghost === undefined ? 0.18 : P.ghost) + (1 - (P.ghost === undefined ? 0.18 : P.ghost)) * eo(seg(t, r.t, r.t + 0.5))).toFixed(3); rows[nl + j].style.fontWeight = t >= r.hl ? "700" : "500"; });
      P.bars.forEach((bb, j) => { const p = eo(seg(t, bb.t, bb.t + 0.9)); bl[j].style.opacity = eo(seg(t, bb.t - 0.1, bb.t + 0.3)).toFixed(3); const vv = bb.v2 ? bb.value + (bb.v2 - bb.value) * eo(seg(t, bb.t2, bb.t2 + 1.0)) : bb.value; bars[j].style.width = `${(vv / bb.max * 100 * p).toFixed(1)}%`; });
      const ns = d.querySelectorAll(".note"); let ni = 0; if (P.note) { ns[0].style.opacity = eo(seg(t, P.noteT, P.noteT + 0.4)).toFixed(3); ni = 1; } P.notes.forEach((n, j) => { ns[ni + j].style.opacity = eo(seg(t, n.t, n.t + 0.5)).toFixed(3); }); });
    for (const w of SWEEPS) { const k = seg(t, w.t0, w.t1), on = c.P[w.img] ? c.P[w.img].op : 0; w.d.style.opacity = (Math.sin(Math.PI * k) * (w.a || 0.5) * on).toFixed(3); w.d.style.transform = `translateX(${((k - 0.5) * 70).toFixed(1)}%)`; }
    for (const g of PART) { const pp = c.P[g.img], on = pp ? pp.op : 0, tr = pp ? pp.trk[0] : 0; g.els.forEach((e) => { const [fx, fy, sp, sz] = JSON.parse(e.dataset.k), y = ((fy * BH - t * (14 + 22 * sp) * u) % BH + BH) % BH; e.style.width = e.style.height = (sz * u).toFixed(1) + "px"; e.style.transform = `translate(${(fx * AW + tr * AW * 1.4 + Math.sin(t * 0.6 + fx * 9) * 14 * u).toFixed(1)}px,${y.toFixed(1)}px)`; e.style.opacity = (on * (g.a || 0.45) * Math.min(1, y / (BH * 0.15)) * Math.min(1, (BH - y) / (BH * 0.15))).toFixed(3); }); }
    let chg = 1; for (const cc of CH) chg *= t < cc ? 1 - eo(seg(t, cc - 0.35, cc)) : eo(seg(t, cc + 0.35, cc + 0.95));
    for (const L of LABELS) {
      const an = c.b.anchors[L.a]; if (!an || (L.img && L.img !== c.img)) { L.pill.style.opacity = "0"; L.line.setAttribute("opacity", "0"); L.dot.setAttribute("opacity", "0"); continue; }
      const [ax, ay] = scr(c.img, an[0], an[1], c, L.layer);
      const inside = eo(seg(ay, BTOP + 10 * u, BTOP + 90 * u)) * (1 - eo(seg(ay, BTOP + BH - 150 * u, BTOP + BH - 80 * u))) * eo(seg(ax, -10 * u, 60 * u)) * (1 - eo(seg(ax, W - 60 * u, W + 10 * u)));
      const p = eo(seg(t, L.t0, L.t0 + 0.5)), out = (1 - eo(seg(t, L.t1, L.t1 + 0.3))) * inside * chg * (1 - 0.95 * Math.max(q, eg)), vis = p * out, pw = L.pw, ph = L.ph, left = L.off[0] >= 0;
      let px0 = ax + L.off[0] * u, py0 = ay + L.off[1] * u;
      px0 = left ? Math.min(Math.max(px0, 34 * u), W - 34 * u - pw) : Math.min(Math.max(px0, 34 * u + pw), W - 34 * u); py0 = Math.min(Math.max(py0, BTOP + 30 * u + ph / 2), BTOP + BH - 90 * u);
      L.pill.style.opacity = vis.toFixed(3); L.pill.style.transform = `translate(${left ? px0 : px0 - pw}px,${py0 - ph / 2}px)`;
      L.line.setAttribute("d", `M${ax},${ay} L${ax + (px0 - ax) * p},${ay + (py0 - ay) * p}`); L.line.setAttribute("opacity", (0.8 * out).toFixed(3));
      L.dot.setAttribute("cx", ax); L.dot.setAttribute("cy", ay); L.dot.setAttribute("opacity", (p * out).toFixed(3));
    }
    let sc = 0, sy = 0; for (const [a, z] of SCAN) if (t >= a && t <= z) { const p = (t - a) / (z - a); sc = Math.sin(Math.PI * p) ** 0.5; sy = BTOP + 60 * u + p * (BH - 160 * u); }
    scanEl.setAttribute("y", sy); scanEl.setAttribute("opacity", (0.85 * sc * (1 - q)).toFixed(3));
    let pg = null; for (const g of pages) if (t >= g[0].t0 - 0.05 && t <= g[g.length - 1].t1 + 0.3) pg = g;
    capEl.innerHTML = !pg || ev2 > 0.2 ? "" : `<span class="pg">${pg.map((w) => `<span class="${t >= w.t0 && t < w.t1 ? "on" : ""}">${w.w}</span>`).join(" ")}</span>`;
    endc.style.opacity = ev.toFixed(3); $(".h1").style.opacity = $(".eyebrow").style.opacity = (1 - ev2).toFixed(3);
  };
}

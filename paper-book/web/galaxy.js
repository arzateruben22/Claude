/* Paper Galaxy: the paper book drawn as a universe. Data: window.PAPER_GALAXY, built by galaxy.py. */
(() => {
  "use strict";
  let G = window.PAPER_GALAXY;
  if (!G) return;
  const $ = (id) => document.getElementById(id);
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(document.documentElement);
  const tok = (n, d) => css.getPropertyValue(n).trim() || d;
  const HUES = [tok("--meme", "#6f9bff"), tok("--major", "#f2c45c"), tok("--stock", "#c895f5"), "#7fe3e0", "#ff9de2", "#9ef07a"];
  const WIN = tok("--win", "#5fe0a0"), LOSS = tok("--loss", "#ff6f61"), INK = tok("--ink", "#e9ecff"), DIM = tok("--dim", "#a7add0");
  const WARM = "#fff3cf";
  const CORE = 26, ARM = 34, TILT = 0.72;
  const deskColor = (i) => HUES[i % HUES.length];

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
  const when = (ts, withTime) => {
    try {
      return new Date(ts * 1000).toLocaleString("en-US", { timeZone: G.meta.tz, month: "short", day: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}) });
    } catch (e) { return new Date(ts * 1000).toISOString().slice(0, withTime ? 16 : 10).replace("T", " "); }
  };
  function hash(str) {                  // stable 0..1 from a string, so stars keep their place
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  function rgba(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // -- the world: where every galaxy, star and speck of dust sits ---------------------------------
  let W = null;
  const radiusFor = (k) => CORE + ARM * Math.sqrt(k);
  function build() {
    const D = G.desks.length;
    const lists = G.desks.map(() => []);
    G.symbols.forEach((s, i) => lists[s.d].push(i));
    lists.forEach((l) => l.sort((a, b) => G.symbols[a].born - G.symbols[b].born));
    const spread = lists.map((l) => Math.max(1, 2.2 - Math.log10(l.length + 1)));   // small galaxies get room to breathe
    const galR = lists.map((l, i) => radiusFor(Math.max(1, l.length)) * spread[i]);
    const maxR = Math.max(110, ...galR);
    const ring = D <= 1 ? 0 : (2 * maxR + 170) / (2 * Math.sin(Math.PI / D));
    const gals = G.desks.map((d, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, D);
      const g = { i, key: d.key, label: d.label, color: deskColor(i), x: Math.cos(a) * ring, y: Math.sin(a) * ring * 0.86,
        R: galR[i], spread: spread[i], spin: hash(d.key) * Math.PI * 2, list: lists[i], dust: [] };
      const rand = rng(Math.floor(hash(d.key + "dust") * 1e9));
      for (let j = 0; j < 1100; j++) {
        const u = Math.pow(rand(), 0.7);
        const r = 6 + (g.R + 36) * u;
        const th = g.spin + (j % 2) * Math.PI + r / 95 + (rand() - 0.5) * (1.0 - 0.55 * u);
        const off = (rand() - 0.5) * 12;
        g.dust.push([g.x + Math.cos(th) * (r + off), g.y + Math.sin(th) * (r + off) * TILT, r, 0.2 + rand() * 0.8]);
      }
      return g;
    });
    const pos = new Array(G.symbols.length);
    gals.forEach((g) => g.list.forEach((si, k) => {
      const s = G.symbols[si];
      const r = radiusFor(k) * g.spread + (hash(s.s + g.key) - 0.5) * 14;
      const th = g.spin + (k % 2) * Math.PI + r / 95 + (hash(s.s) - 0.5) * 0.5;
      pos[si] = { x: g.x + Math.cos(th) * r, y: g.y + Math.sin(th) * r * TILT };
    }));
    const bySym = G.symbols.map(() => []);
    G.trades.forEach((t, idx) => bySym[t[0]].push(idx));
    const heldBySym = new Map();
    G.held.forEach((h) => heldBySym.set(h[0], h));
    let t0 = Infinity;
    for (const t of G.trades) t0 = Math.min(t0, t[1] - (t[5] || 0) * 60);
    for (const s of G.symbols) t0 = Math.min(t0, s.born);
    for (const h of G.held) t0 = Math.min(t0, h[1]);
    if (!isFinite(t0)) t0 = G.meta.now - 86400;
    t0 -= 3600;
    const t1 = Math.max(G.meta.now, t0 + 7200);
    G.patterns.forEach((p) => {
      p.di = G.desks.findIndex((d) => d.key === p.desk);
      if (!p.unlocked) { p.at = Infinity; return; }
      if (p.desk === "*") { p.at = t1; return; }
      const mine = G.trades.filter((t) => G.symbols[t[0]].d === p.di);
      p.at = mine.length >= p.need ? mine[p.need - 1][1] : t1;
    });
    const big = G.trades.map((t) => Math.abs(t[3])).sort((a, b) => a - b);
    const nova = big.length >= 20 ? big[Math.floor(big.length * 0.97)] : Infinity;
    W = { gals, pos, bySym, heldBySym, t0, t1, nova };
  }

  // -- the universe at one moment -----------------------------------------------------------------
  let S = null;
  function stateAt(T) {
    const n = G.symbols.length, D = G.desks.length;
    const s = { T, cnt: new Int32Array(n), won: new Int32Array(n), net: new Float64Array(n), born: new Uint8Array(n),
      deskN: new Array(D).fill(0), deskNet: new Array(D).fill(0), deskWon: new Array(D).fill(0), deskBorn: new Array(D).fill(0),
      planets: 0, total: 0, stars: 0 };
    for (const t of G.trades) {
      if (t[1] > T) break;                     // trades come sorted by the time they closed
      const d = G.symbols[t[0]].d;
      s.cnt[t[0]]++; s.net[t[0]] += t[2]; if (t[2] > 0) { s.won[t[0]]++; s.deskWon[d]++; }
      s.deskN[d]++; s.deskNet[d] += t[2]; s.planets++; s.total += t[2];
    }
    G.symbols.forEach((sym, i) => {
      if (sym.born <= T) { s.born[i] = 1; s.deskBorn[sym.d]++; s.stars++; }
    });
    return s;
  }

  // -- the camera ---------------------------------------------------------------------------------------
  const cv = $("sky"), ctx = cv.getContext("2d");
  let VW = 0, VH = 0, dpr = 1;
  const cam = { x: 0, y: 0, z: 0.3, tx: 0, ty: 0, tz: 0.3, ux: 0, uy: 0, uz: 1, focus: -1, ready: false };
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    VW = Math.max(1, r.width); VH = Math.max(1, r.height);
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    dirty = true;
  }
  const galRadiusNow = (g) => (S.deskBorn[g.i] ? radiusFor(S.deskBorn[g.i]) * g.spread : 60);
  function fit() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    W.gals.forEach((g) => {
      if (cam.focus >= 0 && g.i !== cam.focus) return;
      const R = galRadiusNow(g) + 24;
      x0 = Math.min(x0, g.x - R); x1 = Math.max(x1, g.x + R);
      y0 = Math.min(y0, g.y - R * TILT); y1 = Math.max(y1, g.y + R * TILT + 70);
    });
    const top = VW < 700 ? 118 : 86, bottom = 70, side = 24, label = 95;   // label: half a galaxy name's width, in pixels
    let z = Math.min((VW - 2 * side) / (x1 - x0), (VH - top - bottom) / (y1 - y0));
    z = Math.min((VW - 2 * side) / (x1 - x0 + (2 * label) / z), (VH - top - bottom) / (y1 - y0));
    cam.tx = (x0 + x1) / 2; cam.ty = (y0 + y1) / 2 - (top - bottom) / 2 / Math.max(z, 1e-3);
    cam.tz = Math.max(0.04, Math.min(2.4, z));
    if (!cam.ready || REDUCE) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; cam.ready = true; }
  }
  const Z = () => cam.z * cam.uz;
  const sx = (x) => (x - cam.x) * Z() + VW / 2 + cam.ux;
  const sy = (y) => (y - cam.y) * Z() + VH / 2 + cam.uy;

  // -- sprites for glows (drawn once, stamped many times) -------------------------------------------------
  const sprites = new Map();
  function glow(color) {
    if (sprites.has(color)) return sprites.get(color);
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, rgba(color, 0.9)); grd.addColorStop(0.22, rgba(color, 0.45));
    grd.addColorStop(0.55, rgba(color, 0.12)); grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
    return c;
  }
  const field = (() => {                  // far-away stars behind everything
    const r = rng(99), out = [];
    for (let i = 0; i < 420; i++) out.push([r(), r(), 0.3 + r() * 1.1, r() * 6.28, 0.25 + r() * 0.6]);
    return out;
  })();

  // -- drawing ---------------------------------------------------------------------------------------------
  let novas = [], highlight = null, hover = -1, dirty = true;
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    const z = Z(), clock = REDUCE ? 0 : now / 1000;

    for (const f of field) {
      const px = ((f[0] * VW - cam.x * 0.02 * cam.z + cam.ux * 0.05) % VW + VW) % VW;
      const py = ((f[1] * VH - cam.y * 0.02 * cam.z + cam.uy * 0.05) % VH + VH) % VH;
      ctx.globalAlpha = f[4] * (REDUCE ? 1 : 0.75 + 0.25 * Math.sin(clock * 1.3 + f[3]));
      ctx.fillStyle = "#cfd6ff";
      ctx.fillRect(px, py, f[2], f[2]);
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "lighter";
    for (const g of W.gals) {
      const has = S.deskBorn[g.i] > 0, Rn = galRadiusNow(g);
      const cx = sx(g.x), cy = sy(g.y);
      const bank = G.desks[g.i].bank || 1000;
      const mood = Math.max(-1, Math.min(1, S.deskNet[g.i] / (bank * 0.25)));
      const core = has && mood < -0.15 ? LOSS : g.color;
      const cr = (has ? Rn * 0.5 + 34 : 64) * z;
      ctx.globalAlpha = has ? 0.55 + 0.3 * Math.max(0, mood) : 0.22;
      ctx.drawImage(glow(core), cx - cr, cy - cr * TILT * 1.2, cr * 2, cr * 2 * TILT * 1.2);
      ctx.fillStyle = g.color;
      const size = Math.max(0.7, 1.3 * z);
      for (const d of g.dust) {
        if (d[2] > Rn + 26) continue;
        ctx.globalAlpha = d[3] * (has ? 0.5 : 0.16);
        ctx.fillRect(sx(d[0]), sy(d[1]), size, size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // constellations: patterns found in the trades
    for (const p of G.patterns) {
      if (!p.unlocked || p.at > S.T) continue;
      const on = highlight === p.id;
      if (p.desk === "*") {
        const [a, b] = p.desks.map((k) => W.gals.find((g) => g.key === k));
        if (!a || !b || !S.deskBorn[a.i] || !S.deskBorn[b.i]) continue;
        ctx.setLineDash([4, 7]);
        ctx.strokeStyle = rgba(INK, on ? 0.75 : 0.12);
        ctx.lineWidth = on ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        ctx.setLineDash([]);
        if (on) label(p.title, (sx(a.x) + sx(b.x)) / 2, (sy(a.y) + sy(b.y)) / 2 - 8, INK, true);
        continue;
      }
      const pts = p.symbols.map((name) => G.symbols.findIndex((s) => s.s === name && s.d === p.di))
        .filter((i) => i >= 0 && S.born[i]).map((i) => [sx(W.pos[i].x), sy(W.pos[i].y)]);
      if (pts.length < 2) continue;
      const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      pts.sort((a, b) => Math.atan2(a[1] - my, a[0] - mx) - Math.atan2(b[1] - my, b[0] - mx));
      const col = deskColor(p.di);
      ctx.strokeStyle = rgba(col, on ? 0.95 : 0.13);
      ctx.lineWidth = on ? 1.8 : 1;
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      if (pts.length > 2) ctx.closePath();
      ctx.stroke();
      if (on) label(p.title, mx, my - 10, col, true);
    }

    // stars, their planets, open positions
    const top = new Set();
    W.gals.forEach((g) => {
      g.list.filter((i) => S.born[i]).sort((a, b) => Math.abs(S.net[b]) - Math.abs(S.net[a])).slice(0, 3).forEach((i) => top.add(i));
    });
    for (let i = 0; i < G.symbols.length; i++) {
      if (!S.born[i]) continue;
      const p = W.pos[i], x = sx(p.x), y = sy(p.y);
      if (x < -60 || y < -60 || x > VW + 60 || y > VH + 60) continue;
      const g = W.gals[G.symbols[i].d], n = S.cnt[i], net = S.net[i];
      const r = Math.max(1.3, (2.6 + 2.2 * Math.sqrt(n)) * z);
      const coreCol = n === 0 ? g.color : net > 0 ? WARM : net < 0 ? LOSS : INK;
      const haloCol = net < 0 ? LOSS : g.color;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = n === 0 ? 0.35 : 0.7;
      ctx.drawImage(glow(haloCol), x - r * 4, y - r * 4, r * 8, r * 8);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = coreCol;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      if (i === hover) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 6.2832); ctx.stroke(); }
      if (z > 0.22 && n) {
        const list = W.bySym[i].slice(Math.max(0, n - 10), n);
        list.forEach((idx, j) => {
          const t = G.trades[idx];
          const orbit = r + (5 + j * 3.4) * z;
          const a = hash("p" + idx) * 6.2832 + clock * 0.9 / Math.sqrt(5 + j * 3.4);
          ctx.globalAlpha = 0.35 + 0.65 * ((j + 1) / list.length);
          ctx.fillStyle = t[2] > 0 ? WIN : LOSS;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * orbit, y + Math.sin(a) * orbit * 0.8, Math.max(0.9, 1.5 * z), 0, 6.2832); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      const h = W.heldBySym.get(i);
      if (h && h[1] <= S.T && S.T >= W.t1 - 60) {
        const pulse = REDUCE ? 0.5 : (Math.sin(clock * 3 + i) + 1) / 2;
        ctx.strokeStyle = rgba(g.color, 0.9 - pulse * 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r + (7 + pulse * 5) * Math.max(z, 0.5), 0, 6.2832); ctx.stroke();
      }
      if (z > 0.7 || top.has(i) || i === hover) label(G.symbols[i].s, x + r + 5, y - r - 2, DIM, false);
    }

    // galaxy names
    for (const g of W.gals) {
      const has = S.deskBorn[g.i] > 0;
      const y = sy(g.y + (galRadiusNow(g) + 20) * TILT) + 18, x = sx(g.x);
      ctx.textAlign = "center";
      ctx.fillStyle = g.color;
      ctx.font = `700 ${Math.round(Math.max(12, Math.min(18, 15 * Math.sqrt(z * 3))))}px Unbounded, "Arial Black", sans-serif`;
      ctx.fillText(g.label.toUpperCase(), x, y);
      ctx.font = `500 12px "IBM Plex Mono", monospace`;
      ctx.fillStyle = has ? (S.deskNet[g.i] >= 0 ? WIN : LOSS) : DIM;
      ctx.fillText(has ? `${usd(S.deskNet[g.i])} · ${S.deskN[g.i]} trades` : "waiting for its first trade", x, y + 17);
      ctx.textAlign = "left";
    }

    // supernovas: the biggest moves flash as they happen
    novas = novas.filter((v) => now - v.start < 1500);
    for (const v of novas) {
      const k = (now - v.start) / 1500, p = W.pos[v.si];
      ctx.strokeStyle = rgba(v.win ? WARM : LOSS, 1 - k);
      ctx.lineWidth = 2 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), (6 + k * 60) * Math.max(z, 0.4), 0, 6.2832); ctx.stroke();
    }
  }
  function label(text, x, y, color, bold) {
    ctx.font = bold ? `600 12.5px "IBM Plex Sans", sans-serif` : `500 11px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "rgba(5,6,13,0.7)";
    const w = ctx.measureText(text).width;
    if (bold) ctx.fillRect(x - w / 2 - 6, y - 13, w + 12, 18);
    ctx.fillStyle = color;
    ctx.textAlign = bold ? "center" : "left";
    ctx.fillText(text, x, y);
    ctx.textAlign = "left";
  }

  // -- time ---------------------------------------------------------------------------------------------------
  const slider = $("time");
  let playing = false, lastFrame = 0;
  const T = () => W.t0 + ((W.t1 - W.t0) * Number(slider.value)) / 1000;
  function setTime(v, fromPlay) {
    const before = S ? S.T : -Infinity;
    slider.value = String(Math.max(0, Math.min(1000, v)));
    S = stateAt(T());
    if (fromPlay && !REDUCE && S.T > before) {
      const t0 = performance.now();
      for (const t of G.trades) {
        if (t[1] <= before) continue;
        if (t[1] > S.T) break;
        if (Math.abs(t[3]) >= W.nova) novas.push({ si: t[0], start: t0, win: t[2] > 0 });
      }
      if (novas.length > 30) novas = novas.slice(-30);
    }
    hud();
    dirty = true;
  }
  function play() {
    if (Number(slider.value) >= 1000) setTime(0);
    playing = true;
    $("play").textContent = "Pause";
  }
  function pause() {
    playing = false;
    $("play").textContent = Number(slider.value) >= 1000 ? "Replay" : "Play";
  }
  $("play").addEventListener("click", () => (playing ? pause() : play()));
  slider.addEventListener("input", () => { pause(); setTime(Number(slider.value)); });
  $("fit").addEventListener("click", () => { cam.ux = cam.uy = 0; cam.uz = 1; cam.focus = -1; dirty = true; });

  function loop(now) {
    if (playing) {
      const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
      const v = Number(slider.value) + (dt * 1000) / 16000;      // the whole history in about 16 seconds
      setTime(v, true);
      if (v >= 1000) pause();
    }
    lastFrame = now;
    fit();
    const k = 0.08;
    const moving = Math.abs(cam.x - cam.tx) + Math.abs(cam.y - cam.ty) > 0.5 || Math.abs(cam.z - cam.tz) > 0.0005;
    if (moving && !REDUCE) { cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k; dirty = true; }
    if (!REDUCE || dirty) { draw(now); dirty = false; }
    requestAnimationFrame(loop);
  }

  // -- pan, zoom, hover ---------------------------------------------------------------------------------------
  const pointers = new Map();
  let pinch = 0, moved = false;
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); moved = false; cv.classList.add("dragging"); });
  cv.addEventListener("pointerup", (e) => { pointers.delete(e.pointerId); pinch = 0; cv.classList.remove("dragging"); });
  cv.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); pinch = 0; cv.classList.remove("dragging"); });
  cv.addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect();
    if (pointers.has(e.pointerId)) {
      const [px, py] = pointers.get(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, d / pinch);
        pinch = d;
      } else {
        cam.ux += e.clientX - px; cam.uy += e.clientY - py;
        moved = moved || Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 2;
      }
      dirty = true;
      hideTip();
      return;
    }
    pick(e.clientX - r.left, e.clientY - r.top);
  });
  cv.addEventListener("pointerleave", () => { hover = -1; hideTip(); dirty = true; });
  cv.addEventListener("click", (e) => { if (!moved) { const r = cv.getBoundingClientRect(); pick(e.clientX - r.left, e.clientY - r.top); } });
  cv.addEventListener("dblclick", () => { cam.ux = cam.uy = 0; cam.uz = 1; cam.focus = -1; dirty = true; });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  function zoomAt(px, py, f) {
    const z1 = Z(), uz = Math.max(0.3, Math.min(14, cam.uz * f)), z2 = cam.z * uz;
    const wx = (px - VW / 2 - cam.ux) / z1 + cam.x, wy = (py - VH / 2 - cam.uy) / z1 + cam.y;
    cam.uz = uz;
    cam.ux = px - VW / 2 - (wx - cam.x) * z2;
    cam.uy = py - VH / 2 - (wy - cam.y) * z2;
    dirty = true;
  }
  function pick(px, py) {
    let best = -1, bd = 18 * 18;
    for (let i = 0; i < G.symbols.length; i++) {
      if (!S.born[i]) continue;
      const dx = sx(W.pos[i].x) - px, dy = sy(W.pos[i].y) - py, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    if (best !== hover) { hover = best; dirty = true; }
    if (best < 0) return hideTip();
    const s = G.symbols[best], g = W.gals[s.d], n = S.cnt[best], net = S.net[best];
    const h = W.heldBySym.get(best);
    const open = h && h[1] <= S.T && S.T >= W.t1 - 60
      ? `<br>open now: ${h[3] == null ? "waiting for the open" : `<span class="${cls(h[3] - h[2])}">${usd(h[3] - h[2])}</span>`}` : "";
    const tip = $("tip");
    tip.innerHTML = `<b style="color:${g.color}">${esc(s.s)}</b>${esc(g.label)}<br>${n} trade${n === 1 ? "" : "s"}` +
      (n ? ` · won ${S.won[best]} · <span class="${cls(net)}">${usd(net)}</span>` : "") + open;
    tip.hidden = false;
    tip.style.left = Math.min(px, VW - 240) + "px";
    tip.style.top = Math.min(py, VH - 90) + "px";
  }
  function hideTip() { $("tip").hidden = true; }

  // -- the words around the picture -------------------------------------------------------------------------------
  function hud() {
    $("c-gal").textContent = S.deskN.filter((n, i) => n || S.deskBorn[i]).length + " / " + G.desks.length;
    $("c-stars").textContent = S.stars.toLocaleString("en-US");
    $("c-planets").textContent = S.planets.toLocaleString("en-US");
    const net = $("c-net");
    net.textContent = usd(S.total);
    net.className = cls(S.total);
    const end = Number(slider.value) >= 1000;
    $("when").textContent = end ? "now" : when(S.T, true);
    $("galaxies").innerHTML = G.desks.map((d, i) => {
      const n = S.deskN[i], won = S.deskWon[i];
      return `<li tabindex="0" data-g="${i}" style="--c:${deskColor(i)}"><span class="sw"></span>
        <span class="nm">${esc(d.label)}<small>${n ? `${n} trades · won ${Math.round((won / n) * 100)}% · ${S.deskBorn[i]} stars` : "waiting for its first trade"}</small></span>
        <span class="net ${cls(S.deskNet[i])}">${n ? usd(S.deskNet[i]) : "—"}</span></li>`;
    }).join("");
  }
  function panel() {
    const sub = $("sub");
    sub.innerHTML = (G.meta.demo ? "<b>DEMO MARKETS · invented prices</b> · " : "") +
      `paper money only · updated ${esc(G.meta.updated_local)}`;
    const pats = G.patterns.slice().sort((a, b) => (b.unlocked - a.unlocked) || (a.need - a.n) - (b.need - b.n));
    const lit = pats.filter((p) => p.unlocked).length;
    $("c-const").textContent = `${lit} of ${pats.length} lit`;
    $("patterns").innerHTML = pats.map((p) => {
      const col = p.desk === "*" ? INK : deskColor(p.di);
      const pct = Math.min(100, Math.round((p.n / p.need) * 100));
      return `<li class="${p.unlocked ? "lit" : "locked"}" ${p.unlocked ? `tabindex="0" data-p="${esc(p.id)}"` : ""} style="--c:${col}">
        <div class="pt">${esc(p.title)}</div><div class="pd">${esc(p.detail)}</div>
        ${p.unlocked ? "" : `<div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>`}</li>`;
    }).join("");
    $("milestones").innerHTML = G.milestones.map((m) => `<li class="${m.at ? "got" : ""}"><span>${esc(m.title)}
      <small>${m.at ? when(Date.parse(m.at) / 1000, false) : "not yet"}${m.detail ? " · " + esc(m.detail) : ""}</small></span></li>`).join("");
    $("ticks").innerHTML = G.milestones.filter((m) => m.at).map((m) => {
      const t = Date.parse(m.at) / 1000, x = ((t - W.t0) / (W.t1 - W.t0)) * 100;
      return x >= 0 && x <= 100 ? `<i style="left:calc(${x.toFixed(2)}% - 1px)" title="${esc(m.title)}"></i>` : "";
    }).join("");
  }
  $("patterns").addEventListener("mouseover", (e) => { const li = e.target.closest("li[data-p]"); if (li) { highlight = li.dataset.p; dirty = true; } });
  $("patterns").addEventListener("mouseout", () => { highlight = null; dirty = true; });
  $("patterns").addEventListener("focusin", (e) => { const li = e.target.closest("li[data-p]"); if (li) { highlight = li.dataset.p; dirty = true; } });
  $("patterns").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-p]");
    if (!li) return;
    document.querySelectorAll(".pats li.on").forEach((x) => x.classList.remove("on"));
    highlight = highlight === li.dataset.p && li.classList.contains("on") ? null : li.dataset.p;
    if (highlight) li.classList.add("on");
    dirty = true;
  });
  $("galaxies").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-g]");
    if (!li) return;
    const i = Number(li.dataset.g);
    cam.focus = cam.focus === i ? -1 : i;
    cam.ux = cam.uy = 0; cam.uz = 1; dirty = true;
  });
  $("galaxies").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.target.click(); } });

  // -- live: on the always-on machine, new trades arrive while the page is open ---------------------------------------
  async function refresh() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const r = await fetch("galaxy.json", { cache: "no-store" });
      if (!r.ok) return;
      const next = await r.json();
      if (!next.meta || next.meta.updated === G.meta.updated) return;
      const atEnd = Number(slider.value) >= 1000;
      G = next;
      build();
      panel();
      setTime(atEnd ? 1000 : Number(slider.value), atEnd);
    } catch (e) { /* not served next to galaxy.json: nothing to refresh */ }
  }

  build();
  resize();
  window.addEventListener("resize", resize);
  const autoplay = !REDUCE && G.trades.length > 0;
  setTime(autoplay ? 0 : 1000);
  S = stateAt(T());
  panel();
  hud();
  fit();
  if (autoplay) play(); else pause();
  if (!G.trades.length) $("play").disabled = true;
  requestAnimationFrame(loop);
  setInterval(refresh, 120000);
})();

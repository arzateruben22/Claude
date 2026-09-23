/* Lumevina Growth Blueprint — one animation per step.
 *
 *   Step 1  a week of chair time filling up: gaps fill, add-ons attach,
 *           members appear; hours booked, average visit and members count up
 *   Step 2  two artists' clients; some cross over to Evelyn; a meter climbs
 *           past the 15% go / no-go line
 *   Step 3  a floor plan of the Lumevina house: suites fill with artists,
 *           bookings ping, net profit climbs out of the lease dip
 *
 * Each scene is a pure function of time (render(t)), so the print build
 * freezes it on its final frame with window.STEPS_FREEZE = true. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var ROSE = "#eab9c8", ROSE_HI = "#f7d3de", GOLD = "#e3b48f", GREEN = "#32d74b", RED = "#ff7a6b";
  var GRAY = "#3a3a3c", DIM = "#86868b";

  var el = function (tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var ease = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var pop = function (x) { x = clamp(x); return 1 + 0.25 * Math.sin(x * Math.PI) * (1 - x) * 2; };
  var rng = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  var text = function (parent, x, y, str, cls, anchor) {
    var t = el("text", { x: x, y: y, "class": cls || "", "text-anchor": anchor || "start" }, parent);
    t.textContent = str;
    return t;
  };
  var money = function (v) {
    var s = Math.abs(Math.round(v)).toLocaleString("en-US");
    return (v < 0 ? "−$" : "$") + s;
  };

  /* ───────────── Step 1 · a week of chair time ───────────── */
  var step1 = function (svg) {
    var COLS = 6, ROWS = 8, W = 62, H = 28, G = 6, X0 = 76, Y0 = 40;
    var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var hours = ["10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p"];
    days.forEach(function (d, i) { text(svg, X0 + i * (W + G) + W / 2, 26, d, "s-lbl", "middle"); });
    hours.forEach(function (h, j) { text(svg, X0 - 12, Y0 + j * (H + G) + H / 2 + 4, h, "s-lbl", "end"); });
    var r = rng(11), cells = [], empties = [];
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var x = X0 + i * (W + G), y = Y0 + j * (H + G);
        el("rect", { x: x, y: y, width: W, height: H, rx: 7, fill: "none", stroke: "rgba(255,255,255,.07)" }, svg);
        var base = r() < 0.6;
        var c = { x: x, y: y, base: base };
        c.g = el("g", {}, svg);
        c.rect = el("rect", { x: x, y: y, width: W, height: H, rx: 7, fill: base ? GRAY : ROSE }, c.g);
        c.addon = el("rect", { x: x + W - 13, y: y + 5, width: 8, height: H - 10, rx: 3, fill: GOLD }, c.g);
        c.ring = el("rect", { x: x + 1, y: y + 1, width: W - 2, height: H - 2, rx: 6.5, fill: "none", stroke: ROSE_HI, "stroke-width": 1.6 }, c.g);
        c.dot = el("circle", { cx: x + 11, cy: y + H / 2, r: 3.2, fill: ROSE_HI }, c.g);
        c.tBase = 0.15 + (i + j * COLS) * 0.02;
        cells.push(c);
        if (!base) empties.push(c);
      }
    }
    /* most gaps get filled (flash openings, referrals); a few stay open */
    empties.forEach(function (c, k) { c.fill = r() < 0.88; c.tFill = 2.2 + r() * 3.0; });
    cells.forEach(function (c) {
      var booked = c.base || c.fill;
      c.hasAddon = booked && r() < 0.36; c.tAddon = 5.6 + r() * 2.0;
      c.member = c.base && r() < 0.34; c.tMember = 7.9 + r() * 1.8;
    });
    var legend = el("g", { transform: "translate(" + X0 + ",330)" }, svg);
    [[GRAY, "Booked"], [ROSE, "Filled gap"], [GOLD, "Add-on"], ["ring", "Member"]].forEach(function (L, k) {
      var gx = k * 104;
      if (L[0] === "ring") el("rect", { x: gx, y: -9, width: 12, height: 12, rx: 3, fill: "none", stroke: ROSE_HI, "stroke-width": 1.6 }, legend);
      else el("rect", { x: gx, y: -9, width: 12, height: 12, rx: 3, fill: L[0] }, legend);
      text(legend, gx + 18, 1, L[1], "s-lbl");
    });
    var stats = [
      { x: X0, label: "Hours booked", a: 62, b: 94, fmt: function (v) { return Math.round(v) + "%"; }, t0: 2.2, t1: 5.4 },
      { x: X0 + 140, label: "Average visit", a: 120, b: 152, fmt: function (v) { return "$" + Math.round(v); }, t0: 5.6, t1: 7.8 },
      { x: X0 + 280, label: "Members", a: 0, b: 30, fmt: function (v) { return String(Math.round(v)); }, t0: 7.9, t1: 9.9 }
    ];
    stats.forEach(function (s) {
      s.v = text(svg, s.x, 382, "", "s-big");
      text(svg, s.x, 400, s.label, "s-lbl");
    });
    return function (t) {
      cells.forEach(function (c) {
        var show = c.base ? ease(seg(t, c.tBase, c.tBase + 0.35)) : (c.fill ? ease(seg(t, c.tFill, c.tFill + 0.35)) : 0);
        var sc = c.base ? 1 : pop(seg(t, c.tFill, c.tFill + 0.45));
        c.rect.setAttribute("opacity", show);
        c.rect.setAttribute("transform", "translate(" + (c.x + W / 2) + "," + (c.y + H / 2) + ") scale(" + (show ? sc : 1) + ") translate(" + -(c.x + W / 2) + "," + -(c.y + H / 2) + ")");
        c.addon.setAttribute("opacity", c.hasAddon ? ease(seg(t, c.tAddon, c.tAddon + 0.4)) : 0);
        var m = c.member ? ease(seg(t, c.tMember, c.tMember + 0.4)) : 0;
        c.ring.setAttribute("opacity", m);
        c.dot.setAttribute("opacity", m);
      });
      stats.forEach(function (s) { s.v.textContent = s.fmt(s.a + (s.b - s.a) * ease(seg(t, s.t0, s.t1))); });
    };
  };

  /* ───────────── Step 2 · two artists, one question ───────────── */
  var step2 = function (svg) {
    var panels = [
      { x: 16, y: 16, w: 250, h: 128, label: "Lash artist" },
      { x: 16, y: 156, w: 250, h: 128, label: "Brow artist" }
    ];
    var ev = { x: 282, y: 16, w: 222, h: 268 };
    panels.concat([ev]).forEach(function (p) {
      el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, rx: 16, fill: "#161618", stroke: "rgba(255,255,255,.08)" }, svg);
    });
    var r = rng(29), dots = [], crossers = [];
    panels.forEach(function (p, pi) {
      text(svg, p.x + 16, p.y + 26, p.label, "s-h");
      p.count = text(svg, p.x + p.w - 16, p.y + 26, "", "s-lbl", "end");
      for (var k = 0; k < 40; k++) {
        var cx = p.x + 26 + (k % 10) * 22, cy = p.y + 52 + Math.floor(k / 10) * 20;
        var d = { cx: cx, cy: cy, t: 0.2 + pi * 1.1 + k * 0.025, p: p };
        d.c = el("circle", { cx: cx, cy: cy, r: 4.2, fill: "#636366" }, svg);
        dots.push(d);
      }
    });
    text(svg, ev.x + 16, ev.y + 26, "Evelyn · facials", "s-h");
    var evCount = text(svg, ev.x + ev.w - 16, ev.y + 26, "", "s-lbl", "end");
    /* 7 from each artist: 14 of 80 = 17.5% */
    [0, 1].forEach(function (pi) {
      var pool = dots.filter(function (d) { return d.p === panels[pi]; });
      for (var n = 0; n < 7; n++) {
        var pick = pool.splice(Math.floor(r() * pool.length), 1)[0];
        crossers.push(pick);
      }
    });
    crossers.sort(function () { return r() - 0.5; });
    crossers.forEach(function (d, k) {
      d.cross = true;
      d.tc = 3.2 + k * 0.38;
      d.tx = ev.x + 40 + (k % 4) * 48;
      d.ty = ev.y + 70 + Math.floor(k / 4) * 48;
      el("rect", { x: d.tx - 18, y: d.ty - 18, width: 36, height: 36, rx: 10, fill: "none", stroke: "rgba(255,255,255,.06)" }, svg);
      d.m = el("circle", { r: 5, fill: ROSE }, svg);
      d.halo = el("circle", { r: 14, fill: ROSE, opacity: 0 }, svg);
    });
    /* meter */
    var MX = 16, MW = 488, MY = 318;
    text(svg, MX, MY - 12, "Artist clients who also book Evelyn", "s-lbl");
    var pctT = text(svg, MX + MW, MY - 12, "", "s-h", "end");
    el("rect", { x: MX, y: MY, width: MW, height: 12, rx: 6, fill: "#1d1d20" }, svg);
    var fill = el("rect", { x: MX, y: MY, width: 0, height: 12, rx: 6, fill: ROSE }, svg);
    var gx = MX + MW * 0.5;
    el("line", { x1: gx, x2: gx, y1: MY - 4, y2: MY + 16, stroke: "#f5f5f7", "stroke-width": 1.5, "stroke-dasharray": "3 3" }, svg);
    text(svg, gx, MY + 30, "Go line · 15%", "s-lbl", "middle");
    var badge = el("g", { opacity: 0 }, svg);
    el("rect", { x: MX + MW - 212, y: MY + 44, width: 212, height: 30, rx: 15, fill: "rgba(50,215,75,.14)" }, badge);
    text(badge, MX + MW - 106, MY + 64, "✓ Pilot passes · go to Step 3", "s-go", "middle");
    return function (t) {
      var landed = 0;
      dots.forEach(function (d) {
        var a = ease(seg(t, d.t, d.t + 0.3));
        d.c.setAttribute("opacity", a);
        if (!d.cross) return;
        var u = ease(seg(t, d.tc, d.tc + 1.1));
        var on = t >= d.tc;
        d.c.setAttribute("fill", on ? "rgba(234,185,200,.45)" : "#636366");
        var mx = (d.cx + d.tx) / 2, my = Math.min(d.cy, d.ty) - 60;
        var x = (1 - u) * (1 - u) * d.cx + 2 * (1 - u) * u * mx + u * u * d.tx;
        var y = (1 - u) * (1 - u) * d.cy + 2 * (1 - u) * u * my + u * u * d.ty;
        d.m.setAttribute("cx", x); d.m.setAttribute("cy", y);
        d.m.setAttribute("opacity", on ? 1 : 0);
        d.m.setAttribute("r", 5 + 2.5 * u);
        d.halo.setAttribute("cx", d.tx); d.halo.setAttribute("cy", d.ty);
        var h = seg(t, d.tc + 1.1, d.tc + 1.8);
        d.halo.setAttribute("opacity", h > 0 && h < 1 ? 0.35 * (1 - h) : 0);
        d.halo.setAttribute("r", 8 + 16 * h);
        if (u >= 1) landed++;
      });
      panels.forEach(function (p) {
        var n = dots.filter(function (d) { return d.p === p && t >= d.t; }).length;
        p.count.textContent = n + " clients";
      });
      evCount.textContent = landed ? "+" + landed + " new" : "";
      var pct = landed / 80 * 100;
      fill.setAttribute("width", MW * Math.min(pct, 30) / 30);
      fill.setAttribute("fill", pct >= 15 ? GREEN : ROSE);
      pctT.textContent = (Math.round(pct * 10) / 10) + "%";
      badge.setAttribute("opacity", pct >= 15 ? ease(seg(t, 9.6, 10.2)) : 0);
    };
  };

  /* ───────────── Step 3 · the Lumevina house ───────────── */
  var step3 = function (svg) {
    el("rect", { x: 16, y: 16, width: 488, height: 262, rx: 20, fill: "#0d0d0f", stroke: "rgba(255,255,255,.14)" }, svg);
    var labels = ["Lash", "Brow", "Nails", "Lash", "Brow", "Nails", "Lash", "Academy"];
    var suites = [];
    for (var i = 0; i < 8; i++) {
      var top = i < 4, col = i % 4;
      var s = { x: 28 + col * 118, y: top ? 28 : 196, w: 108, h: 70, label: labels[i], t: 1.6 + i * 0.95 };
      s.box = el("rect", { x: s.x, y: s.y, width: s.w, height: s.h, rx: 12, fill: "rgba(255,255,255,.02)", stroke: "rgba(255,255,255,.14)", "stroke-dasharray": "4 4" }, svg);
      s.name = text(svg, s.x + 14, s.y + 28, "Open suite", "s-lbl");
      s.sub = text(svg, s.x + 14, s.y + 48, "", "s-sub");
      s.ping = el("circle", { cx: s.x + s.w - 20, cy: s.y + 22, r: 4, fill: ROSE, opacity: 0 }, svg);
      s.ring = el("circle", { cx: s.x + s.w - 20, cy: s.y + 22, r: 4, fill: "none", stroke: ROSE, opacity: 0 }, svg);
      suites.push(s);
    }
    el("rect", { x: 28, y: 110, width: 226, height: 74, rx: 12, fill: "rgba(255,255,255,.03)" }, svg);
    text(svg, 42, 138, "Lobby · front desk", "s-h");
    text(svg, 42, 158, "One brand, one welcome", "s-sub");
    var studio = el("rect", { x: 266, y: 110, width: 226, height: 74, rx: 12, fill: "rgba(234,185,200,.12)", stroke: ROSE }, svg);
    text(svg, 280, 138, "Evelyn’s studio", "s-h");
    var studioSub = text(svg, 280, 158, "", "s-sub");
    var comets = [];
    for (var c = 0; c < 10; c++) comets.push(el("circle", { r: 3.2, fill: ROSE_HI, opacity: 0 }, svg));
    /* stats */
    var artistsT = text(svg, 16, 330, "", "s-big");
    text(svg, 16, 348, "Artists in the house", "s-lbl");
    var netT = text(svg, 200, 330, "", "s-big");
    text(svg, 200, 348, "Net to Lumevina, per month", "s-lbl");
    var note = text(svg, 16, 378, "", "s-sub");
    return function (t) {
      var filled = 0;
      suites.forEach(function (s, i) {
        var a = ease(seg(t, s.t, s.t + 0.5));
        var on = a > 0;
        if (on && s.label !== "Academy") filled += a;
        s.box.setAttribute("fill", on ? "rgba(234,185,200," + (0.1 * a) + ")" : "rgba(255,255,255,.02)");
        s.box.setAttribute("stroke", on ? "rgba(234,185,200," + (0.25 + 0.5 * a) + ")" : "rgba(255,255,255,.14)");
        s.box.setAttribute("stroke-dasharray", on ? "0" : "4 4");
        s.name.textContent = on ? s.label : "Open suite";
        s.name.setAttribute("class", on ? "s-h" : "s-lbl");
        s.sub.textContent = on ? (s.label === "Academy" ? "Next artists" : "In the app") : "";
        /* a booking ping every ~1.6s once occupied */
        var ph = ((t - s.t - 0.6 + i * 0.37) % 1.6) / 1.6;
        var live = t > s.t + 0.6 && s.label !== "Academy";
        s.ping.setAttribute("opacity", live ? 1 : 0);
        s.ring.setAttribute("opacity", live ? 0.7 * (1 - ph) : 0);
        s.ring.setAttribute("r", 4 + 14 * ph);
      });
      /* clients crossing into Evelyn's studio */
      var occupied = suites.filter(function (s) { return t > s.t + 0.6 && s.label !== "Academy"; });
      comets.forEach(function (cm, k) {
        if (!occupied.length) { cm.setAttribute("opacity", 0); return; }
        var s = occupied[k % occupied.length];
        var ph = ((t * 0.55 + k * 0.29) % 1);
        var x0 = s.x + s.w / 2, y0 = s.y + (s.y < 100 ? s.h : 0);
        var x1 = 466 + (k % 3) * 9, y1 = 126 + (k % 4) * 13;
        var u = ease(ph);
        cm.setAttribute("cx", x0 + (x1 - x0) * u);
        cm.setAttribute("cy", y0 + (y1 - y0) * u);
        cm.setAttribute("opacity", Math.sin(ph * Math.PI) * 0.9);
      });
      var n = Math.min(7, filled);
      artistsT.textContent = Math.round(n) + " of 7";
      /* lease starts first (t≈1): −$2.2k, then each artist adds ~$1k */
      var lease = ease(seg(t, 0.6, 1.4));
      var net = -2200 * lease + (n / 7) * 7300;
      netT.textContent = (net >= 0 ? "+" : "") + money(net);
      netT.setAttribute("fill", net < 0 ? RED : ROSE_HI);
      studioSub.textContent = occupied.length ? "Their clients book facials" : "The center of the house";
      note.textContent = t > 9.6 ? "≈ +$105k a year with Step 1" : "";
      note.setAttribute("opacity", ease(seg(t, 9.6, 10.2)));
    };
  };

  var SCENES = { 1: [step1, 11.5], 2: [step2, 11.5], 3: [step3, 11.5] };
  var HOLD = 3;
  var frozen = window.STEPS_FREEZE === true;
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("svg[data-step]").forEach(function (svg) {
    var def = SCENES[svg.getAttribute("data-step")];
    if (!def) return;
    var render = def[0](svg), END = def[1], CYCLE = END + HOLD;
    if (frozen || rm) { render(END); return; }
    render(0);
    var raf = null, t0 = 0, vis = false;
    var loop = function (now) {
      var t = ((now - t0) / 1000) % CYCLE;
      render(Math.min(t, END));
      raf = requestAnimationFrame(loop);
    };
    var play = function () { if (raf === null && vis && !document.hidden) { t0 = performance.now(); raf = requestAnimationFrame(loop); } };
    var pause = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) play(); else pause(); }, { threshold: 0.25 }).observe(svg);
    } else { vis = true; play(); }
  });
})();

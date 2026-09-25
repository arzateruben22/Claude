/* Lumevina Skin School — one animation per level.
 *
 *   Level 1  the barrier as brick and mortar: gaps let water out and sun in;
 *            the three-step routine fills the gaps, the mortar glows, SPF
 *            turns the sun away; barrier strength climbs
 *   Level 2  eight weeks of retinoid, built up slowly: night by night the
 *            calendar fills, retinoid nights go from 2 to 6 a week, with an
 *            exfoliation night and recovery nights around them
 *   Level 3  twelve weeks on a plan: breakouts calm, marks fade, the glow
 *            comes through, milestones light up week by week
 *
 * Each scene is a pure function of time, render(t), like the Growth
 * Blueprint's steps; reduced motion shows the last frame. */
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
  var pop = function (x) { x = clamp(x); return 1 + 0.3 * Math.sin(x * Math.PI) * (1 - x) * 2; };
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

  /* ───────────── Level 1 · the barrier ───────────── */
  var level1 = function (svg) {
    var BW = 56, BH = 32, G = 6, X0 = 34, Y0 = 158, ROWS = 4, COLS = 7;
    text(svg, 34, 30, "Your skin barrier", "s-h");
    text(svg, 34, 48, "Skin cells are the bricks. Ceramides and fats are the mortar.", "s-sub");
    /* the three steps, lighting up in turn */
    var STEPS = [["1", "Gentle cleanser", 1.2], ["2", "Ceramide cream", 3.4], ["3", "Daily SPF 30", 5.8]];
    var chips = STEPS.map(function (s, i) {
      var g = el("g", { transform: "translate(" + (34 + i * 152) + ",70)" }, svg);
      var bg = el("rect", { width: 144, height: 34, rx: 17, fill: "#1c1c1f" }, g);
      var dot = el("circle", { cx: 17, cy: 17, r: 11, fill: GRAY }, g);
      var n = text(g, 17, 21.5, s[0], "s-lbl", "middle");
      var t = text(g, 34, 21.5, s[1], "s-lbl");
      return { bg: bg, dot: dot, n: n, t: t, at: s[2] };
    });
    /* the sun, top right, with rays aimed at the wall */
    var sun = el("g", {}, svg);
    el("circle", { cx: 486, cy: 128, r: 13, fill: GOLD, opacity: 0.9 }, sun);
    var rays = [0, 1, 2].map(function (i) {
      return el("line", { x1: 474, y1: 136 + i * 4, x2: 474, y2: 136, stroke: GOLD, "stroke-width": 2, "stroke-linecap": "round", opacity: 0 }, svg);
    });
    var shield = el("path", { d: "M 26 146 Q 250 112 474 146", fill: "none", stroke: ROSE_HI, "stroke-width": 3, "stroke-linecap": "round", opacity: 0 }, svg);
    var shieldT = text(svg, 250, 120, "SPF", "s-lbl", "middle"); shieldT.setAttribute("opacity", 0);
    /* the wall */
    var r = rng(5), bricks = [];
    for (var j = 0; j < ROWS; j++) {
      var off = j % 2 ? -BW / 2 : 0;
      for (var i = 0; i < COLS + (j % 2); i++) {
        var x = X0 + off + i * (BW + G), w = BW;
        if (x < X0) { w -= X0 - x; x = X0; }
        if (x + w > X0 + COLS * (BW + G) - G) w = X0 + COLS * (BW + G) - G - x;
        if (w < 12) continue;
        bricks.push({ x: x, y: Y0 + j * (BH + G), w: w, gap: false });
      }
    }
    var gaps = [2, 5, 9, 11, 14, 17, 20, 24, 27].filter(function (k) { return k < bricks.length; });
    gaps.forEach(function (k, n) { bricks[k].gap = true; bricks[k].fill = n < 3 ? 1.6 : 3.8 + (n - 3) * 0.25; });
    var mortar = el("rect", { x: X0 - 4, y: Y0 - 4, width: COLS * (BW + G) - G + 8, height: ROWS * (BH + G) - G + 8, rx: 10, fill: ROSE, opacity: 0.08 }, svg);
    bricks.forEach(function (b) {
      b.r = el("rect", { x: b.x, y: b.y, width: b.w, height: BH, rx: 6, fill: "#2a2226" }, svg);
    });
    /* water escaping through the gaps */
    var drops = [];
    for (var d = 0; d < 14; d++) drops.push({ c: el("circle", { r: 2.6, fill: "#bcd4ff", opacity: 0 }, svg), k: gaps[d % gaps.length], ph: r() });
    text(svg, X0, 330, "Barrier strength", "s-lbl");
    var bar = el("rect", { x: X0, y: 340, width: 300, height: 10, rx: 5, fill: "#1c1c1f" }, svg);
    var fill = el("rect", { x: X0, y: 340, width: 0, height: 10, rx: 5, fill: ROSE }, svg);
    var big = text(svg, 486, 352, "40%", "s-big", "end");
    var lossT = text(svg, 486, 374, "Water escaping", "s-sub", "end");
    text(svg, X0, 380, "Illustration", "s-sub");

    return function (t) {
      chips.forEach(function (c) {
        var on = ease(seg(t, c.at, c.at + 0.5));
        c.dot.setAttribute("fill", on > 0.5 ? ROSE : GRAY);
        c.n.setAttribute("fill", on > 0.5 ? "#000" : DIM);
        c.t.setAttribute("fill", on > 0.5 ? "#f5f5f7" : DIM);
        c.bg.setAttribute("fill", on > 0.5 ? "#2a1d23" : "#1c1c1f");
        c.dot.setAttribute("r", 11 * pop(seg(t, c.at, c.at + 0.5)));
      });
      var filled = 0;
      bricks.forEach(function (b) {
        if (!b.gap) { b.r.setAttribute("opacity", 1); return; }
        var u = ease(seg(t, b.fill, b.fill + 0.6));
        if (u >= 1) filled++;
        b.r.setAttribute("opacity", u);
        b.r.setAttribute("transform", "translate(0," + (-(1 - u) * 18) + ")");
        b.r.setAttribute("fill", u > 0 && u < 1 ? ROSE : "#2a2226");
      });
      var glow = ease(seg(t, 3.4, 5.5));
      mortar.setAttribute("opacity", 0.08 + glow * 0.22);
      /* water: escapes through open gaps only */
      drops.forEach(function (dp) {
        var b = bricks[dp.k], open = 1 - ease(seg(t, b.fill, b.fill + 0.4));
        var ph = (t * 0.45 + dp.ph) % 1;
        dp.c.setAttribute("cx", b.x + b.w / 2 + Math.sin(ph * 6 + dp.ph * 9) * 5);
        dp.c.setAttribute("cy", b.y + BH / 2 - ph * 60);
        dp.c.setAttribute("opacity", open * Math.sin(ph * Math.PI) * 0.9);
      });
      /* sun rays: straight into the wall, then turned away by SPF */
      var spf = ease(seg(t, 5.8, 6.6));
      shield.setAttribute("opacity", spf * 0.9);
      shieldT.setAttribute("opacity", spf);
      shieldT.setAttribute("fill", ROSE_HI);
      rays.forEach(function (ry, i) {
        var ph = (t * 0.7 + i / 3) % 1;
        var x2 = 474 - ph * 300 - i * 20, y2 = 136 + ph * 70 + i * 4;
        var stop = 142 - (x2 - 250) * (x2 - 250) / 7000;         /* where the shield arc is */
        if (spf > 0.5 && y2 > stop) {                             /* bounced: heads back up and out */
          var back = (y2 - stop) * 1.4;
          x2 = x2 - back * 0.3; y2 = stop - back * 0.8;
        }
        ry.setAttribute("x1", x2 + 22); ry.setAttribute("y1", y2 - 6);
        ry.setAttribute("x2", x2); ry.setAttribute("y2", y2);
        ry.setAttribute("opacity", Math.sin(ph * Math.PI) * 0.85);
      });
      var strength = 40 + (filled / gaps.length) * 45 + spf * 11;
      fill.setAttribute("width", 300 * strength / 100);
      fill.setAttribute("fill", strength > 80 ? ROSE_HI : ROSE);
      big.textContent = Math.round(strength) + "%";
      lossT.textContent = filled === gaps.length ? "Water held in" : "Water escaping";
      lossT.setAttribute("fill", filled === gaps.length ? GREEN : DIM);
    };
  };

  /* ───────────── Level 2 · eight weeks of retinoid ───────────── */
  var level2 = function (svg) {
    var X0 = 96, Y0 = 92, DX = 36, DY = 36, R = 11.5;
    text(svg, 34, 30, "Eight weeks of retinoid, the slow way", "s-h");
    text(svg, 34, 48, "Add a night every two weeks. Your skin keeps up, so you never have to stop.", "s-sub");
    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d, i) { text(svg, X0 + i * DX, Y0 - 22, d, "s-lbl", "middle"); });
    /* 0 recovery, 1 retinoid, 2 exfoliation (Saturday) */
    var PLAN = [
      [0, 1, 0, 0, 1, 0, 2], [0, 1, 0, 0, 1, 0, 2],
      [0, 1, 0, 1, 0, 1, 2], [0, 1, 0, 1, 0, 1, 2],
      [0, 1, 1, 0, 1, 1, 2], [0, 1, 1, 0, 1, 1, 2],
      [1, 1, 1, 1, 1, 1, 2], [1, 1, 1, 1, 1, 1, 2]
    ];
    var dots = [];
    PLAN.forEach(function (row, w) {
      text(svg, X0 - 26, Y0 + w * DY + 4, "Wk " + (w + 1), "s-lbl", "end");
      row.forEach(function (k, d) {
        var c = el("circle", { cx: X0 + d * DX, cy: Y0 + w * DY, r: R, fill: "none", stroke: GRAY, "stroke-width": 1.5 }, svg);
        dots.push({ c: c, k: k, at: 0.5 + w * 1.05 + d * 0.11 });
      });
    });
    /* the legend and the count */
    var LX = 372;
    [[ROSE, "Retinoid night"], [GOLD, "Exfoliation night"], [null, "Recovery: moisturizer only"]].forEach(function (l, i) {
      var y = 92 + i * 26;
      if (l[0]) el("circle", { cx: LX + 7, cy: y - 4, r: 7, fill: l[0] }, svg);
      else el("circle", { cx: LX + 7, cy: y - 4, r: 6.2, fill: "none", stroke: DIM, "stroke-width": 1.5 }, svg);
      text(svg, LX + 22, y, l[1], "s-sub");
    });
    text(svg, LX, 200, "Retinoid nights a week", "s-lbl");
    var big = text(svg, LX, 234, "0", "s-big");
    var sub = text(svg, LX, 254, "", "s-sub");
    /* comfort: slow keeps it calm; all at once spikes */
    text(svg, LX, 294, "Irritation", "s-lbl");
    el("line", { x1: LX, y1: 360, x2: 500, y2: 360, stroke: "rgba(255,255,255,.12)" }, svg);
    var fast = el("path", { d: "M" + LX + " 356 C " + (LX + 20) + " 300, " + (LX + 40) + " 300, " + (LX + 64) + " 330 S " + (LX + 110) + " 350, 500 352",
      fill: "none", stroke: RED, "stroke-width": 2, "stroke-dasharray": "4 4", opacity: 0.8 }, svg);
    var slow = el("path", { d: "M" + LX + " 356 C " + (LX + 40) + " 350, " + (LX + 80) + " 348, 500 352", fill: "none", stroke: GREEN, "stroke-width": 2.5,
      "stroke-linecap": "round" }, svg);
    var len = 140;
    slow.setAttribute("stroke-dasharray", len); fast.setAttribute("opacity", 0);
    text(svg, LX, 380, "Slow", "s-go");
    var fastT = text(svg, LX + 44, 380, "All at once", "s-sub"); fastT.setAttribute("fill", RED);

    return function (t) {
      var nights = 0, wk = 0;
      dots.forEach(function (d, i) {
        var u = seg(t, d.at, d.at + 0.35);
        if (u <= 0) { d.c.setAttribute("fill", "none"); d.c.setAttribute("stroke", GRAY); d.c.setAttribute("r", R); return; }
        var col = d.k === 1 ? ROSE : d.k === 2 ? GOLD : null;
        if (col) { d.c.setAttribute("fill", col); d.c.setAttribute("stroke", col); }
        else { d.c.setAttribute("fill", "none"); d.c.setAttribute("stroke", DIM); }
        d.c.setAttribute("r", R * (col ? pop(u) : 1));
        if (u >= 1) wk = Math.floor(i / 7);
      });
      var shown = Math.max(0, Math.min(7, Math.floor((t - 0.5) / 1.05)));
      if (t > 0.5) PLAN[Math.min(7, shown)].forEach(function (k) { if (k === 1) nights++; });
      big.textContent = t > 0.5 ? String(nights) : "0";
      sub.textContent = t > 0.5 ? "in week " + (Math.min(7, shown) + 1) : "";
      slow.setAttribute("stroke-dashoffset", len * (1 - ease(seg(t, 0.8, 8.6))));
      fast.setAttribute("opacity", 0.8 * ease(seg(t, 2, 3)));
      fastT.setAttribute("opacity", ease(seg(t, 2, 3)));
    };
  };

  /* ───────────── Level 3 · twelve weeks on a plan ───────────── */
  var level3 = function (svg) {
    var CX = 132, CY = 196, RAD = 104;
    text(svg, 34, 30, "Twelve weeks on your plan", "s-h");
    text(svg, 34, 48, "Calmer first, clearer next, even and glowing last.", "s-sub");
    var defs = el("defs", {}, svg);
    var clip = el("clipPath", { id: "l3-clip" }, defs);
    el("circle", { cx: CX, cy: CY, r: RAD }, clip);
    var grad = el("radialGradient", { id: "l3-skin", cx: "40%", cy: "35%", r: "75%" }, defs);
    el("stop", { offset: "0%", "stop-color": "#3a2a30" }, grad);
    el("stop", { offset: "100%", "stop-color": "#1e1619" }, grad);
    var glowG = el("radialGradient", { id: "l3-glow", cx: "38%", cy: "30%", r: "60%" }, defs);
    el("stop", { offset: "0%", "stop-color": ROSE_HI, "stop-opacity": 0.55 }, glowG);
    el("stop", { offset: "100%", "stop-color": ROSE_HI, "stop-opacity": 0 }, glowG);
    var g = el("g", { "clip-path": "url(#l3-clip)" }, svg);
    el("circle", { cx: CX, cy: CY, r: RAD, fill: "url(#l3-skin)" }, g);
    var redness = el("circle", { cx: CX + 10, cy: CY + 14, r: RAD * 0.8, fill: RED, opacity: 0.16 }, g);
    var r = rng(21), bumps = [], marks = [];
    for (var i = 0; i < 16; i++) {
      var a = r() * 6.28, d = Math.sqrt(r()) * RAD * 0.85;
      bumps.push({ x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, s: 3 + r() * 4, gone: 1.2 + r() * 4.8,
        o: el("circle", { r: 4, fill: "#e06c6c" }, g), h: el("circle", { r: 1.4, fill: "#ffd9cf" }, g) });
    }
    for (var m = 0; m < 12; m++) {
      var a2 = r() * 6.28, d2 = Math.sqrt(r()) * RAD * 0.85;
      marks.push({ x: CX + Math.cos(a2) * d2, y: CY + Math.sin(a2) * d2, s: 5 + r() * 7, gone: 4.5 + r() * 5.5,
        o: el("circle", { r: 6, fill: "#7a4e36" }, g) });
    }
    var glow = el("circle", { cx: CX, cy: CY, r: RAD, fill: "url(#l3-glow)", opacity: 0 }, g);
    var ring = el("circle", { cx: CX, cy: CY, r: RAD, fill: "none", stroke: "rgba(255,255,255,.12)", "stroke-width": 1.5 }, svg);
    /* the timeline */
    var TX = 282;
    text(svg, TX, 96, "Week", "s-lbl");
    var wk = text(svg, TX + 44, 98, "0", "s-big");
    el("rect", { x: TX, y: 112, width: 206, height: 6, rx: 3, fill: "#1c1c1f" }, svg);
    var pbar = el("rect", { x: TX, y: 112, width: 0, height: 6, rx: 3, fill: ROSE }, svg);
    var MILES = [[2, "Calmer, less red"], [4, "Fewer new breakouts"], [8, "Marks fading"], [12, "Clear, even, glowing"]];
    var miles = MILES.map(function (ms, i) {
      var y = 160 + i * 48;
      var c = el("circle", { cx: TX + 9, cy: y - 5, r: 9, fill: "none", stroke: GRAY, "stroke-width": 2 }, svg);
      var ck = el("path", { d: "M" + (TX + 5) + " " + (y - 5) + " l3 3 l6 -6", fill: "none", stroke: "#000", "stroke-width": 2, "stroke-linecap": "round", opacity: 0 }, svg);
      var w = text(svg, TX + 28, y - 8, "Week " + ms[0], "s-lbl");
      var tt = text(svg, TX + 28, y + 9, ms[1], "s-h");
      tt.setAttribute("fill", DIM);
      return { wk: ms[0], c: c, ck: ck, tt: tt };
    });
    text(svg, 34, 356, "Illustration. Every skin moves at its own pace.", "s-sub");
    var WEEK_T = 0.75;       /* seconds per week */

    return function (t) {
      var week = Math.min(12, Math.max(0, (t - 0.4) / WEEK_T));
      wk.textContent = String(Math.floor(week));
      pbar.setAttribute("width", 206 * week / 12);
      var wt = week * WEEK_T;
      redness.setAttribute("opacity", 0.16 * (1 - ease(seg(week, 0, 3))));
      bumps.forEach(function (b) {
        var gone = ease(seg(week, b.gone, b.gone + 1.2));
        var s = b.s * (1 - gone);
        b.o.setAttribute("cx", b.x); b.o.setAttribute("cy", b.y); b.o.setAttribute("r", Math.max(0, s));
        b.h.setAttribute("cx", b.x); b.h.setAttribute("cy", b.y); b.h.setAttribute("r", Math.max(0, s * 0.35));
        b.o.setAttribute("opacity", 0.85 * (1 - gone)); b.h.setAttribute("opacity", 0.9 * (1 - gone));
      });
      marks.forEach(function (mk) {
        var gone = ease(seg(week, mk.gone, mk.gone + 2.5));
        mk.o.setAttribute("cx", mk.x); mk.o.setAttribute("cy", mk.y); mk.o.setAttribute("r", mk.s);
        mk.o.setAttribute("opacity", 0.55 * (1 - gone));
      });
      glow.setAttribute("opacity", ease(seg(week, 8, 12)));
      ring.setAttribute("stroke", week >= 12 ? "rgba(247,211,222,.55)" : "rgba(255,255,255,.12)");
      miles.forEach(function (ms) {
        var on = week >= ms.wk;
        ms.c.setAttribute("fill", on ? ROSE : "none");
        ms.c.setAttribute("stroke", on ? ROSE : GRAY);
        ms.ck.setAttribute("opacity", on ? 1 : 0);
        ms.tt.setAttribute("fill", on ? "#f5f5f7" : DIM);
        ms.c.setAttribute("r", 9 * pop(seg(week, ms.wk, ms.wk + 0.6)));
      });
      return wt;
    };
  };

  var SCENES = { barrier: [level1, 9], week: [level2, 9.6], progress: [level3, 10] };
  var HOLD = 3;
  var frozen = window.SCENES_FREEZE === true;
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var start = function (svg) {
    if (svg.__scene) return;
    var def = SCENES[svg.getAttribute("data-scene")];
    if (!def) return;
    svg.__scene = true;
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
  };
  document.querySelectorAll("svg[data-scene]").forEach(start);
  window.SchoolScenes = { start: start };
})();

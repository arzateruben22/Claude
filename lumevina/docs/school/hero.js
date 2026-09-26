/* Lumevina Skin School — the opening animation.
 *
 * A living cross-section of skin, drawn close to the real thing (the way
 * skin looks under a microscope) in Lumevina's warm rose light:
 *   epidermis  packed cells, round with a nucleus at the base, flattening
 *              as they rise into the pale barrier layer, then shedding
 *   junction   the wavy line where epidermis meets dermis
 *   dermis     collagen bundles, fibroblasts, and capillary loops with
 *              blood moving through them
 * told in the course's three levels:
 *   Level 1  Know your skin   the cells rise and renew
 *   Level 2  Actives          glossy drops of vitamin C, a retinoid,
 *                             niacinamide and BHA land, ripple and sink in
 *   Level 3  Treat            pigment clusters fade, collagen thickens and
 *                             brightens, a glow sweeps the surface
 *
 * Every cell, nucleus and drop is drawn from high-resolution sprites made
 * once at load, and the canvas renders at the screen's full pixel density,
 * so it stays sharp on any phone. One loop is about 14 seconds; reduced
 * motion shows the finished skin. */
(function () {
  "use strict";
  var cv = document.getElementById("skin");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var capEl = document.querySelector(".skin-cap");
  var phaseEl = document.getElementById("skin-phase");
  var descEl = document.getElementById("skin-desc");
  var PH = [
    { t: 0, name: "Level 1 · Know your skin", desc: "New cells rise to the surface about every four weeks." },
    { t: 4.2, name: "Level 2 · Actives", desc: "The right active, in the right order, on the right night." },
    { t: 8.6, name: "Level 3 · Treat", desc: "Spots fade, collagen builds, and the glow comes through." }
  ];
  var CYCLE = 14.5, TURN = 11;        /* seconds for a cell to rise from the base to the surface */
  var seed = 11;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var ease = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var TAU = Math.PI * 2;

  /* ── sprites: drawn once, large, then scaled down so they stay crisp ── */
  var sprite = function (w, h, paint) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    return c;
  };
  var speckle = function (g, cx, cy, rx, ry, n, col, rMin, rMax) {
    for (var i = 0; i < n; i++) {
      var a = rnd() * TAU, d = Math.sqrt(rnd());
      g.fillStyle = col;
      g.beginPath(); g.arc(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rMin + rnd() * (rMax - rMin), 0, TAU); g.fill();
    }
  };
  /* a living cell: plump, peach-rose, a mauve nucleus with its nucleolus */
  var LIVE = sprite(192, 192, function (g, w, h) {
    var cx = w / 2, cy = h / 2, rx = w * 0.46, ry = h * 0.46;
    var gr = g.createRadialGradient(cx - rx * 0.32, cy - ry * 0.38, rx * 0.08, cx, cy, rx);
    gr.addColorStop(0, "#f8dcd2"); gr.addColorStop(0.55, "#e2a99b"); gr.addColorStop(0.9, "#b87774"); gr.addColorStop(1, "#95595d");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.save(); g.clip();
    speckle(g, cx, cy, rx * 0.9, ry * 0.9, 90, "rgba(255,240,236,.10)", 0.8, 2.2);      /* cytoplasm texture */
    g.restore();
    g.strokeStyle = "rgba(255,232,226,.55)"; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, rx - 1.5, ry - 1.5, 0, 0, TAU); g.stroke();
    var nx = cx + w * 0.03, ny = cy + h * 0.05, nr = w * 0.17;
    var ng = g.createRadialGradient(nx - nr * 0.35, ny - nr * 0.4, nr * 0.1, nx, ny, nr * 1.05);
    ng.addColorStop(0, "#b07d8f"); ng.addColorStop(0.6, "#7a4659"); ng.addColorStop(1, "#4a2435");
    g.fillStyle = ng; g.beginPath(); g.ellipse(nx, ny, nr, nr * 0.88, 0.35, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.ellipse(nx, ny, nr, nr * 0.88, 0.35, 0, TAU); g.clip();
    speckle(g, nx, ny, nr, nr, 26, "rgba(40,12,26,.35)", 1, 2.6);                   /* chromatin */
    g.restore();
    g.fillStyle = "rgba(52,16,34,.85)"; g.beginPath(); g.arc(nx + nr * 0.25, ny - nr * 0.1, nr * 0.2, 0, TAU); g.fill();
    var sg = g.createRadialGradient(cx - rx * 0.42, cy - ry * 0.48, 0, cx - rx * 0.42, cy - ry * 0.48, rx * 0.5);
    sg.addColorStop(0, "rgba(255,255,255,.6)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sg; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
  });
  /* a granular cell: flatter, paler, dotted with dark keratin granules */
  var GRAN = sprite(224, 128, function (g, w, h) {
    var cx = w / 2, cy = h / 2, rx = w * 0.47, ry = h * 0.44;
    var gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, rx * 0.05, cx, cy, rx);
    gr.addColorStop(0, "#fbe6dd"); gr.addColorStop(0.6, "#ebbfb3"); gr.addColorStop(1, "#b98683");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.save(); g.clip();
    speckle(g, cx, cy, rx * 0.85, ry * 0.8, 40, "rgba(92,38,62,.55)", 1.2, 3);
    g.fillStyle = "rgba(120,70,92,.35)"; g.beginPath(); g.ellipse(cx + 6, cy + 4, w * 0.12, h * 0.13, 0, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,238,232,.6)"; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy, rx - 1, ry - 1, 0, 0, TAU); g.stroke();
  });
  /* a corneocyte: the flat, pale, nucleus-free cells of the barrier */
  var CORN = sprite(256, 72, function (g, w, h) {
    var cx = w / 2, cy = h / 2, rx = w * 0.48, ry = h * 0.4;
    var gr = g.createLinearGradient(0, cy - ry, 0, cy + ry);
    gr.addColorStop(0, "#fff6f0"); gr.addColorStop(0.5, "#f1ddd2"); gr.addColorStop(1, "#cfb0a6");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy - 1, rx - 2, ry - 2, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  });
  /* melanin: a cluster of brown granules with a soft haze (the "dark spots") */
  var MELANIN = sprite(128, 128, function (g, w, h) {
    var hz = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    hz.addColorStop(0, "rgba(118,70,42,.55)"); hz.addColorStop(1, "rgba(118,70,42,0)");
    g.fillStyle = hz; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 70; i++) {
      var a = rnd() * TAU, d = Math.pow(rnd(), 0.8) * w * 0.36, r = 1.2 + rnd() * 2.6;
      var x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d * 0.8;
      var gg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      gg.addColorStop(0, "rgba(150,98,62,.95)"); gg.addColorStop(1, "rgba(70,38,22,.9)");
      g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  });
  /* a glossy drop, tinted per active (white here, tinted as it's drawn) */
  var dropSprite = function (col) {
    return sprite(96, 128, function (g, w, h) {
      var cx = w / 2, r = w * 0.34, cy = h - r - 6;
      g.beginPath();
      g.moveTo(cx, 6);
      g.bezierCurveTo(cx + r * 0.25, cy - r * 1.3, cx + r, cy - r * 0.6, cx + r, cy);
      g.arc(cx, cy, r, 0, Math.PI);
      g.bezierCurveTo(cx - r, cy - r * 0.6, cx - r * 0.25, cy - r * 1.3, cx, 6);
      var gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r * 1.3);
      gr.addColorStop(0, "rgba(" + col + ",.55)"); gr.addColorStop(0.7, "rgba(" + col + ",.85)"); gr.addColorStop(1, "rgba(" + col + ",1)");
      g.fillStyle = gr; g.fill();
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 2; g.stroke();
      g.fillStyle = "rgba(255,255,255,.85)";
      g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.25, r * 0.18, r * 0.3, -0.4, 0, TAU); g.fill();
    });
  };
  /* fine film grain, so the flat fills read like tissue, not plastic */
  var GRAIN = sprite(160, 160, function (g, w, h) {
    var img = g.createImageData(w, h);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 110 + rnd() * 145;
      img.data[i] = v; img.data[i + 1] = v * 0.94; img.data[i + 2] = v * 0.92; img.data[i + 3] = rnd() * 70;
    }
    g.putImageData(img, 0, 0);
  });

  var DROPS = [
    { x: 0.22, t: PH[1].t + 0.2, name: "Vitamin C", col: "240,184,110" },
    { x: 0.56, t: PH[1].t + 1.1, name: "Retinoid", col: "244,190,206" },
    { x: 0.78, t: PH[1].t + 2.0, name: "Niacinamide", col: "200,214,255" },
    { x: 0.38, t: PH[1].t + 2.9, name: "BHA", col: "190,236,214" }
  ];
  DROPS.forEach(function (d) { d.img = dropSprite(d.col); });

  /* ── the tissue ── */
  var W, H, dpr, SURF, BASE, COLS, colW, N = 9;
  var cells = [], fibers = [], blasts = [], loops = [], spots = [], flakes = [], builtW = 0;
  var build = function () {
    seed = 23;
    COLS = Math.max(9, Math.round(W / 34));
    colW = W / COLS;
    cells = [];
    for (var c = -1; c <= COLS; c++) {
      for (var k = 0; k < N; k++) {
        cells.push({ c: c, p: (k + (c & 1) * 0.5) / N, j: rnd() * 0.3 - 0.15, w: 0.92 + rnd() * 0.16 });
      }
    }
    fibers = [];
    for (var f = 0; f < 28; f++) {
      fibers.push({ y: 0.06 + rnd() * 0.9, a: rnd() * TAU, amp: 0.4 + rnd() * 0.9, k: 1.2 + rnd() * 2.4, k2: 3 + rnd() * 4,
        sp: 0.12 + rnd() * 0.2, wide: 3 + rnd() * 4, late: f >= 15, born: f >= 15 ? PH[2].t + (f - 15) * 0.2 : 0 });
    }
    blasts = [];
    for (var b = 0; b < 16; b++) blasts.push({ x: rnd(), y: 0.12 + rnd() * 0.8, r: rnd() * 0.6 - 0.3, s: 0.8 + rnd() * 0.6 });
    loops = [];
    /* each loop sits in a papilla, where the junction rises (its highest points) */
    for (var px = 0; px < 4; px++) {
      var ux = (Math.PI * 1.5 + px * TAU - 0.6) / (TAU * 2.4);
      if (ux > 0.04 && ux < 0.96) loops.push({ x: ux, w: 3.4 + rnd() * 1.4, depth: 0.1 + rnd() * 0.04, bend: (rnd() - 0.5) * 6, ph: rnd() });
    }
    spots = [];
    [0.16, 0.31, 0.47, 0.63, 0.79, 0.9].forEach(function (x, i) {
      spots.push({ x: x + (rnd() - 0.5) * 0.05, y: 0.62 + rnd() * 0.3, s: 0.8 + rnd() * 0.6, fade: PH[2].t + 0.3 + i * 0.35 });
    });
    flakes = [];
  };
  /* one overlay made per size: light from above, film grain over the tissue, and the
     left and right edges fading into the page's black (cheaper than three passes a frame) */
  var overlay = null;
  var makeOverlay = function () {
    overlay = sprite(Math.round(W * dpr), Math.round(H * dpr), function (g) {
      g.scale(dpr, dpr);
      var lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, "rgba(255,236,230,0)"); lg.addColorStop(0.22, "rgba(255,236,230,.05)"); lg.addColorStop(0.6, "rgba(255,236,230,0)");
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      g.save();
      g.globalAlpha = 0.28;
      g.fillStyle = g.createPattern(GRAIN, "repeat"); g.fillRect(0, SURF - 6, W, H);
      g.restore();
      g.globalCompositeOperation = "destination-out";           /* no grain above the surface */
      var tg = g.createLinearGradient(0, SURF - 20, 0, SURF + 4);
      tg.addColorStop(0, "rgba(0,0,0,1)"); tg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = tg; g.fillRect(0, 0, W, SURF + 4);
      g.globalCompositeOperation = "source-over";
      var mk = g.createLinearGradient(0, 0, W, 0);
      mk.addColorStop(0, "rgba(0,0,0,1)"); mk.addColorStop(0.08, "rgba(0,0,0,0)"); mk.addColorStop(0.94, "rgba(0,0,0,0)"); mk.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = mk; g.fillRect(0, 0, W, H);
    });
  };
  var maxDpr = Math.min(window.devicePixelRatio || 1, 3), useDpr = maxDpr;
  var size = function () {
    dpr = useDpr;
    var rc = cv.getBoundingClientRect();
    W = Math.max(1, rc.width); H = Math.max(1, rc.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    SURF = H * 0.2; BASE = H * 0.58;
    makeOverlay();
    if (W !== builtW) { builtW = W; build(); }     /* a phone's toolbar resizing the window keeps the tissue as is */
  };
  /* the surface: a soft swell with fine micro-relief */
  var surfY = function (x, t) {
    return SURF + Math.sin(x / W * TAU * 1.3 + t * 0.5) * H * 0.012 + Math.sin(x / W * 23 + 1) * H * 0.003 + Math.sin(x / W * 61) * H * 0.0012;
  };
  /* the junction: rete ridges dipping into the dermis, papillae rising between them */
  var baseY = function (x, t) {
    var u = x / W * TAU * 2.4 + 0.6;
    return BASE + Math.sin(u) * H * 0.03 + Math.sin(u * 2 + 1.1) * H * 0.008 + Math.sin(x / W * TAU * 0.8 + t * 0.25) * H * 0.01;
  };

  var phaseIdx = -1, frozen = false;
  var setPhase = function (t) {
    var idx = t >= PH[2].t ? 2 : t >= PH[1].t ? 1 : 0;
    if (idx === phaseIdx || !phaseEl) return;
    phaseIdx = idx;
    capEl.style.opacity = 0;
    setTimeout(function () { phaseEl.textContent = PH[idx].name; descEl.textContent = PH[idx].desc; capEl.style.opacity = 1; }, frozen ? 0 : 260);
  };

  /* time moves the tissue: cells rise, fibers sway, flakes drift */
  var step = function (t, dt) {
    for (var i = 0; i < cells.length; i++) {
      var cl = cells[i];
      cl.p += dt / TURN;
      if (cl.p >= 1) {
        cl.p -= 1;
        if (!frozen && flakes.length < 10 && cl.c >= 0 && cl.c < COLS && rnd() < 0.5) {
          var fx = (cl.c + 0.5) * colW;
          flakes.push({ x: fx, y: surfY(fx, t) - 2, vx: (rnd() - 0.5) * 8, vy: -4 - rnd() * 5, a: 0.6, w: colW * (0.45 + rnd() * 0.3), r: (rnd() - 0.5) * 0.2 });
        }
      }
    }
    for (var f = 0; f < fibers.length; f++) fibers[f].a += fibers[f].sp * dt;
    for (var q = flakes.length - 1; q >= 0; q--) {
      var fl = flakes[q];
      fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.a -= dt * 0.45; fl.r += dt * 0.15;
      if (fl.a <= 0) flakes.splice(q, 1);
    }
  };

  var tissuePath = function (fromY, toY, t) {        /* a band between two edge functions */
    ctx.beginPath();
    for (var x = -4; x <= W + 4; x += 6) ctx.lineTo(x, fromY(x, t));
    for (var x2 = W + 4; x2 >= -4; x2 -= 6) ctx.lineTo(x2, toY(x2, t));
    ctx.closePath();
  };
  var bottom = function () { return H + 4; };

  var loopPt = function (L, s, t) {                  /* a capillary loop: up one side, over, down the other */
    var x = L.x * W, apex = baseY(x, t) + 8, y0 = apex + H * L.depth;
    var sway = function (u) { return Math.sin(u * Math.PI) * L.bend; };  /* a gentle curve, not a straight pin */
    if (s < 0.42) { var u = s / 0.42; return [x - L.w + sway(u), y0 + (apex - y0) * u]; }
    if (s < 0.58) { var v = (s - 0.42) / 0.16 * Math.PI; return [x - L.w * Math.cos(v), apex - L.w * Math.sin(v)]; }
    var w = 1 - (s - 0.58) / 0.42; return [x + L.w + sway(w), apex + (y0 - apex) * (1 - w)];
  };
  var plexusY = function (x, t) { return BASE + H * 0.15 + Math.sin(x / W * TAU * 1.2 + 0.4) * H * 0.012; };

  var label = function (txt, y, al) {
    ctx.save();
    ctx.font = "500 11px InterV, -apple-system, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,.95)"; ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(214,206,208," + al + ")";
    ctx.fillText(txt, W - 4, y);
    ctx.restore();
  };

  var draw = function (t) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    var on = clamp(t / 0.8) * clamp((CYCLE - t) / 0.8);            /* fade in and out around the loop */
    var lv3 = ease(seg(t, PH[2].t, PH[2].t + 3));

    /* dermis: warm tissue fading into the page's black */
    tissuePath(baseY, bottom, t);
    var dg = ctx.createLinearGradient(0, BASE - H * 0.05, 0, H);
    dg.addColorStop(0, "rgba(96,52,56," + on + ")"); dg.addColorStop(0.35, "rgba(58,30,34," + on + ")"); dg.addColorStop(1, "rgba(0,0,0," + on + ")");
    ctx.fillStyle = dg; ctx.fill();

    /* collagen bundles: a soft body and a bright core, fuller in Level 3 */
    ctx.lineCap = "round";
    for (var i = 0; i < fibers.length; i++) {
      var fb = fibers[i];
      var al = (fb.late ? ease(seg(t, fb.born, fb.born + 1.2)) : 1) * on;
      if (al <= 0) continue;
      var y0 = BASE + H * 0.06 + fb.y * (H * 0.97 - BASE - H * 0.06);
      var depth = 1 - fb.y * 0.7;
      ctx.beginPath();
      for (var x = -12; x <= W + 12; x += 10) {
        var yy = y0 + Math.sin(x / W * TAU * fb.k + fb.a) * H * 0.016 * fb.amp + Math.sin(x / W * TAU * fb.k2 + fb.a * 1.7) * H * 0.004;
        if (x === -12) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = "rgba(236,176,170," + (0.07 + 0.05 * lv3) * al * depth + ")";
      ctx.lineWidth = fb.wide * (1 + 0.35 * lv3); ctx.stroke();
      ctx.strokeStyle = "rgba(252,222,212," + (0.22 + 0.22 * lv3) * al * depth + ")";
      ctx.lineWidth = 1 + 0.5 * lv3; ctx.stroke();
    }
    /* fibroblasts: the cells that make collagen */
    for (var b = 0; b < blasts.length; b++) {
      var bl = blasts[b], bx = bl.x * W, by = BASE + H * 0.06 + bl.y * (H * 0.9 - BASE);
      ctx.fillStyle = "rgba(128,64,84," + 0.55 * on * (1 - bl.y * 0.6) + ")";
      ctx.beginPath(); ctx.ellipse(bx, by, 5 * bl.s, 1.6 * bl.s, bl.r, 0, TAU); ctx.fill();
    }
    /* a small vessel running along the dermis, feeding the loops */
    ctx.beginPath();
    for (var xp = -8; xp <= W + 8; xp += 6) ctx.lineTo(xp, plexusY(xp, t));
    ctx.strokeStyle = "rgba(140,36,50," + 0.45 * on + ")"; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = "rgba(206,80,92," + 0.3 * on + ")"; ctx.lineWidth = 2.4; ctx.stroke();
    for (var kb = 0; kb < 16; kb++) {
      var bxp = ((t * 0.05 + kb / 16) % 1) * (W + 16) - 8;
      ctx.fillStyle = "rgba(232,90,98," + 0.8 * on + ")";
      ctx.beginPath(); ctx.arc(bxp, plexusY(bxp, t), 1.6, 0, TAU); ctx.fill();
    }
    /* capillary loops reaching up into the papillae, blood moving through */
    for (var l = 0; l < loops.length; l++) {
      var L = loops[l];
      ctx.beginPath();
      for (var s = 0; s <= 1.0001; s += 0.04) { var pt = loopPt(L, s, t); if (s === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); }
      ctx.strokeStyle = "rgba(150,40,54," + 0.45 * on + ")"; ctx.lineWidth = 4.5; ctx.stroke();
      ctx.strokeStyle = "rgba(214,86,96," + 0.35 * on + ")"; ctx.lineWidth = 1.8; ctx.stroke();
      for (var k = 0; k < 4; k++) {
        var rp = loopPt(L, (t * 0.22 + L.ph + k / 4) % 1, t);
        ctx.fillStyle = "rgba(236,92,98," + 0.95 * on + ")";
        ctx.beginPath(); ctx.arc(rp[0], rp[1], 1.8, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,190,190," + 0.7 * on + ")";
        ctx.beginPath(); ctx.arc(rp[0] - 0.5, rp[1] - 0.5, 0.6, 0, TAU); ctx.fill();
      }
    }

    /* epidermis: the tissue between the cells */
    tissuePath(surfY, baseY, t);
    var eg = ctx.createLinearGradient(0, SURF, 0, BASE);
    eg.addColorStop(0, "rgba(118,82,80," + on + ")"); eg.addColorStop(0.5, "rgba(96,54,58," + on + ")"); eg.addColorStop(1, "rgba(78,40,46," + on + ")");
    ctx.fillStyle = eg; ctx.fill();

    /* the cells: sized so each column stays packed from the base to the surface */
    ctx.save();
    tissuePath(surfY, baseY, t); ctx.clip();
    for (var n = 0; n < cells.length; n++) {
      var cl = cells[n], p = cl.p;
      var cx = (cl.c + 0.5 + cl.j * (1 - p)) * colW;
      var top = surfY(cx, t) + 1, bot = baseY(cx, t) + H * 0.03;     /* the basal row always sits on the junction */
      var D = bot - top;
      var cy = bot - D * (1 - Math.pow(1 - p, 1.7));
      var ch = Math.max(2.6, D * 1.7 * Math.pow(1 - p, 0.7) / N * 1.08);
      var cw = colW * (1.02 + 0.4 * p) * cl.w;
      var ca = on * clamp(p / 0.012) * (1 + 0.15 * lv3);
      var g1 = seg(p, 0.46, 0.62), g2 = seg(p, 0.74, 0.88), a1 = 1 - g1, a2 = g1 * (1 - g2), x0 = cx - cw / 2, y0c = cy - ch / 2;
      if (a1 > 0.01) { ctx.globalAlpha = Math.min(1, ca * a1); ctx.drawImage(LIVE, x0, y0c, cw, ch); }
      if (a2 > 0.01) { ctx.globalAlpha = Math.min(1, ca * a2); ctx.drawImage(GRAN, x0, y0c, cw, ch); }
      if (g2 > 0.01) { ctx.globalAlpha = Math.min(1, ca * g2); ctx.drawImage(CORN, x0, y0c, cw, ch); }
    }
    ctx.globalAlpha = 1;
    /* pigment clusters in the lower epidermis; Level 3 fades them */
    for (var sp = 0; sp < spots.length; sp++) {
      var S2 = spots[sp], sa = (1 - ease(seg(t, S2.fade, S2.fade + 1.6))) * on;
      if (sa <= 0.01) continue;
      var sx = S2.x * W, sy = surfY(sx, t) + (baseY(sx, t) - surfY(sx, t)) * S2.y, ss = 44 * S2.s;
      ctx.globalAlpha = sa * 0.9;
      ctx.drawImage(MELANIN, sx - ss / 2, sy - ss / 2, ss, ss);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* the basement membrane along the junction */
    ctx.beginPath();
    for (var x5 = -4; x5 <= W + 4; x5 += 5) ctx.lineTo(x5, baseY(x5, t));
    ctx.strokeStyle = "rgba(255,200,196," + 0.18 * on + ")"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "rgba(255,226,220," + 0.35 * on + ")"; ctx.lineWidth = 1; ctx.stroke();

    /* shed flakes drift off the surface */
    for (var q = 0; q < flakes.length; q++) {
      var fl = flakes[q];
      ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(fl.r);
      ctx.globalAlpha = fl.a * 0.6 * on;
      ctx.drawImage(CORN, -fl.w / 2, -1.6, fl.w, 3.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* the surface: a glossy line with a slow sheen, brighter in Level 3 */
    ctx.beginPath();
    for (var x4 = -4; x4 <= W + 4; x4 += 4) { var yv = surfY(x4, t); if (x4 === -4) ctx.moveTo(x4, yv); else ctx.lineTo(x4, yv); }
    ctx.strokeStyle = "rgba(255,214,222," + (0.14 + 0.12 * lv3) * on + ")"; ctx.lineWidth = 6 + 3 * lv3; ctx.stroke();
    ctx.strokeStyle = "rgba(255,240,240," + (0.6 + 0.35 * lv3) * on + ")"; ctx.lineWidth = 1.3 + 0.5 * lv3; ctx.stroke();
    var sweep = ((t * 0.09) % 1.4 - 0.2) * W, sy2 = surfY(sweep, t);
    var gl = ctx.createRadialGradient(sweep, sy2, 0, sweep, sy2, W * (0.16 + 0.1 * lv3));
    gl.addColorStop(0, "rgba(255,226,232," + (0.16 + 0.3 * lv3) * on + ")"); gl.addColorStop(1, "rgba(255,226,232,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sweep, sy2, W * (0.16 + 0.1 * lv3), 0, TAU); ctx.fill();

    /* Level 2: glossy drops land, ripple along the surface and sink in */
    for (var d = 0; d < DROPS.length; d++) {
      var dr = DROPS[d], u = t - dr.t;
      if (u < 0 || u > 4.2) continue;
      var dx = dr.x * W, land = surfY(dx, t), lblLeft = dr.x > 0.62;      /* near the right edge, the name goes on the left */
      if (u < 0.9) {
        var fall = ease(seg(u, 0, 0.9)), dy = H * 0.08 + (land - H * 0.08) * fall;
        var dw = 13, dh = 17 + 6 * Math.sin(fall * Math.PI);               /* it stretches as it falls */
        ctx.globalAlpha = on;
        ctx.drawImage(dr.img, dx - dw / 2, dy - dh, dw, dh);
        ctx.globalAlpha = 1;
        ctx.font = "600 12px InterV, -apple-system, system-ui, sans-serif"; ctx.textAlign = lblLeft ? "right" : "left";
        ctx.fillStyle = "rgba(245,245,247," + 0.92 * on + ")";
        ctx.fillText(dr.name, lblLeft ? dx - 11 : dx + 11, dy - 6);
      } else {
        var v = u - 0.9;
        for (var rr = 0; rr < 2; rr++) {
          var ring = ease(seg(v, rr * 0.22, 1.3 + rr * 0.22));
          if (ring <= 0 || ring >= 1) continue;
          ctx.strokeStyle = "rgba(" + dr.col + "," + (1 - ring) * 0.85 * on + ")";
          ctx.lineWidth = 1.5 - rr * 0.4;
          ctx.beginPath(); ctx.ellipse(dx, land, 5 + ring * W * 0.11, 1.5 + ring * 5, 0, 0, TAU); ctx.stroke();
        }
        var sink = ease(seg(v, 0.1, 3)), by2 = land + (BASE - land) * 0.85 * sink;
        var ba = Math.sin(clamp(v / 3.2) * Math.PI) * 0.75 * on;
        ctx.globalCompositeOperation = "lighter";
        var bg = ctx.createRadialGradient(dx, by2, 0, dx, by2, 44);
        bg.addColorStop(0, "rgba(" + dr.col + "," + ba * 0.55 + ")"); bg.addColorStop(1, "rgba(" + dr.col + ",0)");
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(dx, by2, 44, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        if (v < 0.7) {                     /* the name lingers briefly, gone before the next drop lands */
          ctx.font = "600 12px InterV, -apple-system, system-ui, sans-serif"; ctx.textAlign = lblLeft ? "right" : "left";
          ctx.fillStyle = "rgba(245,245,247," + (1 - v / 0.7) * 0.92 * on + ")";
          ctx.fillText(dr.name, lblLeft ? dx - 11 : dx + 11, land - 12 - v * 6);
        }
      }
    }

    /* light, grain and the edges fading into the page, in one pass */
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = on;
    ctx.drawImage(overlay, 0, 0);
    ctx.restore();

    /* the labels sit on the right, clear of the hub's side tab */
    var la = 0.9 * on;
    label("Surface", SURF - H * 0.04, la);
    label("Epidermis", (SURF + BASE) / 2 - H * 0.03, la * 0.85);
    label("Dermis", BASE + H * 0.13, la * 0.85);
    label(lv3 > 0.2 ? "Collagen, building" : "Collagen", H * 0.93, la * 0.7);
    setPhase(t);
  };

  frozen = window.SKIN_FREEZE === true;
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var T = 0;
  size();
  if (frozen || rm) {
    frozen = true;
    for (var s2 = 0; s2 < 12.8 * 20; s2++) { T = s2 / 20; step(T, 1 / 20); }
    draw(T);
    window.addEventListener("resize", function () { size(); draw(T); }, { passive: true });
    return;
  }
  var last = performance.now(), raf = null, vis = true;
  /* if a device can't keep a smooth frame rate at full density, step down (3x, then 2x, then 1.5x) */
  var slow = 0, frames = 0;
  var loop = function (now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    T += dt;
    if (T >= CYCLE) { T = 0; flakes = []; phaseIdx = -1; }
    step(T, dt);
    var c0 = performance.now();
    draw(T);
    var cost = performance.now() - c0;
    if (++frames > 20) {
      slow = cost > 11 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 24 && useDpr > 1.5) { useDpr = useDpr > 2 ? 2 : 1.5; slow = 0; frames = 0; size(); }
    }
    raf = requestAnimationFrame(loop);
  };
  var play = function () { if (raf === null && vis && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  var pause = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };
  window.addEventListener("resize", size, { passive: true });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) play(); else pause(); }).observe(cv);
  play();
})();

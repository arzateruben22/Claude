/* Lumevina Skin School — the opening animation.
 *
 * A block of real-looking skin, the way a medical illustration shows it:
 *   top      the skin's surface: warm skin tone, pores, fine skin lines,
 *            vellus hairs and a slow sheen, laid back in 3D (a real clip at
 *            media/skin-top.* replaces it when there is one)
 *   cut face epidermis  small packed cells rising from the base and
 *                       flattening into the pale barrier layer at the top
 *            dermis     dense collagen, capillary loops, an artery and a
 *                       vein, a hair follicle with its oil gland and the
 *                       hair out of the skin, a coiled sweat gland and its
 *                       duct to a pore
 *            fat        yellow fat lobules at the bottom
 * told in the course's three levels:
 *   Level 1  Know your skin   the cells rise and renew
 *   Level 2  Actives          drops of vitamin C, a retinoid, niacinamide and
 *                             BHA land on the surface, ripple and sink in
 *   Level 3  Treat            pigment fades, collagen thickens, the skin glows
 *
 * Everything that doesn't move (the tissue, the follicle, the glands, the
 * surface texture) is drawn once per size and reused; each frame only moves
 * the cells, the blood, the drops and the light. The canvas renders at the
 * screen's full pixel density, stepping down only if a device can't keep up.
 * One loop is about 14 seconds; reduced motion shows the finished skin. */
(function () {
  "use strict";
  var cv = document.getElementById("skin");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var wrap = cv.parentNode;
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
  var canvas = function (w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  var sprite = function (w, h, paint) { var c = canvas(w, h); paint(c.getContext("2d"), w, h); return c; };

  /* ── cell sprites: drawn once, large, then scaled down ── */
  var LIVE = sprite(160, 160, function (g, w, h) {             /* a keratinocyte: soft, tan-pink, small nucleus */
    var cx = w / 2, cy = h / 2, rx = w * 0.49, ry = h * 0.49;
    var gr = g.createRadialGradient(cx - rx * 0.25, cy - ry * 0.3, rx * 0.1, cx, cy, rx);
    gr.addColorStop(0, "#f3cdbd"); gr.addColorStop(0.7, "#e2ab98"); gr.addColorStop(1, "#c48878");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = "rgba(255,236,226,.45)"; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, TAU); g.stroke();
    var nr = w * 0.15, ng = g.createRadialGradient(cx - nr * 0.3, cy - nr * 0.3, 0, cx, cy, nr);
    ng.addColorStop(0, "#a8747f"); ng.addColorStop(1, "#6e4152");
    g.fillStyle = ng; g.beginPath(); g.ellipse(cx + 3, cy + 4, nr, nr * 0.85, 0.3, 0, TAU); g.fill();
  });
  var BASAL = sprite(120, 160, function (g, w, h) {           /* a basal cell: taller, darker nucleus */
    var cx = w / 2, cy = h / 2, rx = w * 0.48, ry = h * 0.49;
    var gr = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, rx * 0.1, cx, cy, ry);
    gr.addColorStop(0, "#e8b7a5"); gr.addColorStop(1, "#b77a6c");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    var ng = g.createRadialGradient(cx, cy + 6, 0, cx, cy + 6, w * 0.22);
    ng.addColorStop(0, "#8a5566"); ng.addColorStop(1, "#5c3244");
    g.fillStyle = ng; g.beginPath(); g.ellipse(cx, cy + 8, w * 0.2, h * 0.19, 0, 0, TAU); g.fill();
  });
  var GRAN = sprite(200, 110, function (g, w, h) {            /* a granular cell: flatter, dark keratin granules */
    var cx = w / 2, cy = h / 2, rx = w * 0.49, ry = h * 0.46;
    var gr = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, rx * 0.05, cx, cy, rx);
    gr.addColorStop(0, "#f6dccf"); gr.addColorStop(1, "#d2a393");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.save(); g.clip();
    for (var i = 0; i < 30; i++) { g.fillStyle = "rgba(96,46,64,.5)"; g.beginPath(); g.arc(cx + (rnd() - 0.5) * rx * 1.6, cy + (rnd() - 0.5) * ry * 1.4, 1.5 + rnd() * 2.5, 0, TAU); g.fill(); }
    g.restore();
  });
  var CORN = sprite(240, 60, function (g, w, h) {             /* a corneocyte: flat, pale, no nucleus */
    var cx = w / 2, cy = h / 2, rx = w * 0.49, ry = h * 0.42;
    var gr = g.createLinearGradient(0, cy - ry, 0, cy + ry);
    gr.addColorStop(0, "#fbeee6"); gr.addColorStop(0.6, "#efd8cb"); gr.addColorStop(1, "#d5b5a6");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
  });
  var MELANIN = sprite(96, 96, function (g, w, h) {           /* melanin: brown granules with a soft haze */
    var hz = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    hz.addColorStop(0, "rgba(112,62,36,.55)"); hz.addColorStop(1, "rgba(112,62,36,0)");
    g.fillStyle = hz; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 60; i++) {
      var a = rnd() * TAU, d = Math.pow(rnd(), 0.8) * w * 0.34, r = 1 + rnd() * 2.2;
      g.fillStyle = "rgba(" + (70 + (rnd() * 40 | 0)) + ",36,20,.85)";
      g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.7, r, 0, TAU); g.fill();
    }
  });
  var dropSprite = function (col) {                            /* a glossy drop, tinted per active */
    return sprite(96, 128, function (g, w, h) {
      var cx = w / 2, r = w * 0.34, cy = h - r - 6;
      g.beginPath(); g.moveTo(cx, 6);
      g.bezierCurveTo(cx + r * 0.25, cy - r * 1.3, cx + r, cy - r * 0.6, cx + r, cy);
      g.arc(cx, cy, r, 0, Math.PI);
      g.bezierCurveTo(cx - r, cy - r * 0.6, cx - r * 0.25, cy - r * 1.3, cx, 6);
      var gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r * 1.3);
      gr.addColorStop(0, "rgba(" + col + ",.55)"); gr.addColorStop(0.7, "rgba(" + col + ",.85)"); gr.addColorStop(1, "rgba(" + col + ",1)");
      g.fillStyle = gr; g.fill();
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 2; g.stroke();
      g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.25, r * 0.18, r * 0.3, -0.4, 0, TAU); g.fill();
    });
  };
  var DROPS = [
    { x: 0.2, t: PH[1].t + 0.2, name: "Vitamin C", col: "240,184,110" },
    { x: 0.5, t: PH[1].t + 1.1, name: "Retinoid", col: "244,190,206" },
    { x: 0.8, t: PH[1].t + 2.0, name: "Niacinamide", col: "200,214,255" },
    { x: 0.36, t: PH[1].t + 2.9, name: "BHA", col: "190,236,214" }
  ];
  DROPS.forEach(function (d) { d.img = dropSprite(d.col); });

  /* smooth noise: a small random image scaled up with smoothing */
  var noise = function (g, w, h, cell, alpha, c1, c2, comp) {
    var nw = Math.ceil(w / cell) + 3, nh = Math.ceil(h / cell) + 3, n = canvas(nw, nh), x = n.getContext("2d"), id = x.createImageData(nw, nh);
    for (var i = 0; i < id.data.length; i += 4) {
      var v = rnd();
      id.data[i] = c1[0] + (c2[0] - c1[0]) * v; id.data[i + 1] = c1[1] + (c2[1] - c1[1]) * v; id.data[i + 2] = c1[2] + (c2[2] - c1[2]) * v; id.data[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = comp || "source-over";
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(n, -cell * 1.5, -cell * 1.5, nw * cell, nh * cell);
    g.restore();
  };

  /* ── layout ── */
  var W, H, dpr, SURF, BASE, FAT, COLS, colW, N = 9;
  var cells = [], spots = [], flakes = [], loops = [], builtW = 0;
  var dermis = null, collagenPlus = null, front = null, overlay = null, topTex = null;
  var FOL = null, SWEAT = null;
  var surfY = function (x) { return SURF + Math.sin(x / W * 31 + 1) * H * 0.0018 + Math.sin(x / W * 83) * H * 0.0008; };
  var baseY = function (x) {                                    /* papillae rise between the rete ridges */
    var u = x / W * TAU * 2.6 + 0.6;
    return BASE + Math.sin(u) * H * 0.022 + Math.sin(u * 2 + 1.1) * H * 0.006;
  };
  var fatY = function (x) { return FAT + Math.sin(x / W * TAU * 1.7 + 2) * H * 0.012 + Math.sin(x / W * 19) * H * 0.004; };
  var arteryY = function (x) { return FAT - H * 0.028 + Math.sin(x / W * TAU * 1.1 + 0.4) * H * 0.01; };
  var veinY = function (x) { return FAT - H * 0.004 + Math.sin(x / W * TAU * 1.1 + 0.9) * H * 0.01; };
  var plexusY = function (x) { return BASE + H * 0.075 + Math.sin(x / W * TAU * 1.4 + 0.2) * H * 0.006; };

  var build = function () {
    seed = 23;
    COLS = Math.max(14, Math.round(W / 17));
    colW = W / COLS;
    cells = [];
    for (var c = -1; c <= COLS; c++) {
      for (var k = 0; k < N; k++) cells.push({ c: c, p: (k + (c & 1) * 0.5) / N, j: rnd() * 0.3 - 0.15, w: 0.94 + rnd() * 0.12 });
    }
    spots = [];
    [0.12, 0.27, 0.43, 0.56, 0.86].forEach(function (x, i) {
      spots.push({ x: x + (rnd() - 0.5) * 0.04, s: 0.8 + rnd() * 0.5, fade: PH[2].t + 0.3 + i * 0.35 });
    });
    loops = [];
    for (var px = 0; px < 4; px++) {
      var ux = (Math.PI * 1.5 + px * TAU - 0.6) / (TAU * 2.6);
      if (ux > 0.03 && ux < 0.97 && Math.abs(ux - 0.66) > 0.05) loops.push({ x: ux, w: 2.6 + rnd(), ph: rnd() });
    }
    flakes = [];
    /* the follicle: from the surface, slanting down into the fat, the hair out of the skin */
    FOL = { x0: W * 0.66, y0: SURF, x1: W * 0.75, y1: FAT + H * 0.07, r: Math.max(5, W * 0.016) };
    SWEAT = { x: W * 0.22, y: FAT - H * 0.07, r: Math.max(9, W * 0.03) };
  };

  /* the dermis and the fat below it, drawn once per size */
  var paintDermis = function () {
    dermis = canvas(W * dpr, H * dpr);
    var g = dermis.getContext("2d");
    g.scale(dpr, dpr);
    var band = function (fromY, toY) {
      g.beginPath();
      for (var x = -4; x <= W + 4; x += 5) g.lineTo(x, fromY(x));
      for (var x2 = W + 4; x2 >= -4; x2 -= 5) g.lineTo(x2, toY(x2));
      g.closePath();
    };
    /* collagen: fine and wavy near the top, thick bundles deeper */
    var fibers = function (count, y0, y1, width, colA, colB, alpha) {
      for (var i = 0; i < count; i++) {
        var yb = y0 + rnd() * (y1 - y0), amp = H * (0.004 + rnd() * 0.01), k = 2 + rnd() * 6, ph = rnd() * TAU;
        var xs = -20 + rnd() * W * 0.6, len = W * (0.25 + rnd() * 0.7);
        g.beginPath();
        for (var x = xs; x <= xs + len; x += 6) {
          var y = yb + Math.sin(x / W * TAU * k + ph) * amp;
          if (x === xs) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.lineCap = "round";
        g.strokeStyle = colA; g.globalAlpha = alpha * (0.5 + rnd() * 0.5); g.lineWidth = width * (0.6 + rnd() * 0.8); g.stroke();
        g.strokeStyle = colB; g.globalAlpha = alpha * 0.8; g.lineWidth = Math.max(0.6, width * 0.3); g.stroke();
      }
      g.globalAlpha = 1;
    };
    /* dermis: pink, lighter and looser just under the epidermis, denser below */
    band(baseY, fatY);
    var dg = g.createLinearGradient(0, BASE - H * 0.03, 0, FAT);
    dg.addColorStop(0, "#dc9e92"); dg.addColorStop(0.22, "#c98277"); dg.addColorStop(1, "#a95e5c");
    g.fillStyle = dg; g.fill();
    g.save(); band(baseY, fatY); g.clip();
    noise(g, W, H, 26, 0.25, [150, 70, 70], [236, 170, 158], "soft-light");
    noise(g, W, H, 6, 0.18, [120, 60, 60], [240, 190, 180], "soft-light");
    fibers(Math.round(W * 0.35), BASE, BASE + H * 0.1, 1.2, "rgba(250,214,204,1)", "rgba(255,236,230,1)", 0.35);
    fibers(Math.round(W * 0.55), BASE + H * 0.08, FAT, 3.2, "rgba(236,176,168,1)", "rgba(255,222,214,1)", 0.3);
    fibers(Math.round(W * 0.2), BASE + H * 0.1, FAT, 2.4, "rgba(120,48,56,1)", "rgba(120,48,56,1)", 0.14);
    for (var b = 0; b < W * 0.06; b++) {                         /* fibroblasts */
      g.fillStyle = "rgba(110,50,70,.6)";
      g.beginPath(); g.ellipse(rnd() * W, BASE + H * 0.04 + rnd() * (FAT - BASE - H * 0.06), 3.4, 1.1, rnd() - 0.5, 0, TAU); g.fill();
    }
    g.restore();
    /* the fat: yellow lobules in pale septa, fading into the page below */
    var below = function () { return H + 4; };
    band(fatY, below);
    g.fillStyle = "#b98458"; g.fill();
    g.save(); band(fatY, below); g.clip();
    var R = Math.max(7, W * 0.024);
    for (var fy = FAT - R; fy < H + R; fy += R * 1.55) {
      for (var fx = -R; fx < W + R; fx += R * 1.7) {
        var cx = fx + (Math.round(fy / (R * 1.55)) & 1) * R * 0.85 + (rnd() - 0.5) * R * 0.5, cy = fy + (rnd() - 0.5) * R * 0.5, rr = R * (0.82 + rnd() * 0.25);
        var fg = g.createRadialGradient(cx - rr * 0.3, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
        fg.addColorStop(0, "#fbeebf"); fg.addColorStop(0.6, "#efce85"); fg.addColorStop(1, "#cf9d52");
        g.fillStyle = fg; g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.9, rnd(), 0, TAU); g.fill();
        g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(cx - rr * 0.35, cy - rr * 0.4, rr * 0.22, rr * 0.14, -0.5, 0, TAU); g.fill();
      }
    }
    g.restore();
    /* the artery (red) and vein (blue) along the top of the fat */
    var tube = function (fy, w, dark, mid, light) {
      g.beginPath();
      for (var x = -6; x <= W + 6; x += 5) { var y = fy(x); if (x === -6) g.moveTo(x, y); else g.lineTo(x, y); }
      g.lineCap = "round";
      g.strokeStyle = dark; g.lineWidth = w; g.stroke();
      g.strokeStyle = mid; g.lineWidth = w * 0.7; g.stroke();
      g.save(); g.translate(0, -w * 0.18); g.strokeStyle = light; g.lineWidth = w * 0.18; g.stroke(); g.restore();
    };
    var aw = Math.max(5, H * 0.018);
    tube(veinY, aw * 1.15, "#3b2f6a", "#5a4b98", "rgba(190,180,240,.6)");
    tube(arteryY, aw, "#7e1622", "#c0303b", "rgba(255,180,180,.7)");
    /* the papillary plexus, and branches from the artery up to it */
    g.beginPath();
    for (var x3 = -6; x3 <= W + 6; x3 += 5) { var y3 = plexusY(x3); if (x3 === -6) g.moveTo(x3, y3); else g.lineTo(x3, y3); }
    g.strokeStyle = "rgba(150,36,48,.75)"; g.lineWidth = 3; g.stroke();
    g.strokeStyle = "rgba(222,92,100,.6)"; g.lineWidth = 1.2; g.stroke();
    [0.08, 0.45, 0.9].forEach(function (bx) {
      var x = bx * W;
      g.beginPath(); g.moveTo(x, arteryY(x)); g.bezierCurveTo(x + 8, arteryY(x) - H * 0.08, x - 8, plexusY(x) + H * 0.06, x + 4, plexusY(x + 4));
      g.strokeStyle = "rgba(150,36,48,.7)"; g.lineWidth = 2.6; g.stroke();
      g.strokeStyle = "rgba(222,92,100,.55)"; g.lineWidth = 1; g.stroke();
    });
    /* the edge where the dermis meets the epidermis */
    g.beginPath();
    for (var x5 = -4; x5 <= W + 4; x5 += 5) g.lineTo(x5, baseY(x5));
    g.strokeStyle = "rgba(255,212,204,.45)"; g.lineWidth = 1.2; g.stroke();
    /* the bottom fades into the page */
    var bf = g.createLinearGradient(0, H * 0.86, 0, H);
    bf.addColorStop(0, "rgba(0,0,0,0)"); bf.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = bf; g.fillRect(0, H * 0.86, W, H * 0.14);
    g.globalCompositeOperation = "source-over";

    /* Level 3: extra, brighter collagen that fades in */
    collagenPlus = canvas(W * dpr, H * dpr);
    g = collagenPlus.getContext("2d");
    g.scale(dpr, dpr);
    g.save(); band(baseY, fatY); g.clip();
    fibers(Math.round(W * 0.3), BASE + H * 0.04, FAT - H * 0.03, 2.6, "rgba(246,200,190,1)", "rgba(255,232,226,1)", 0.28);
    g.restore();
  };

  /* what sits in front of the cells: the follicle, the oil gland, the sweat gland and duct, the hair */
  var paintFront = function () {
    front = canvas(W * dpr, H * dpr);
    var g = front.getContext("2d");
    g.scale(dpr, dpr);
    var F = FOL, dx = F.x1 - F.x0, dy = F.y1 - F.y0, len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
    g.save(); g.translate(F.x0, F.y0); g.rotate(ang);
    /* the sheath around the root */
    var sh = g.createLinearGradient(0, -F.r, 0, F.r);
    sh.addColorStop(0, "#c78c7c"); sh.addColorStop(0.5, "#f0cbbb"); sh.addColorStop(1, "#b97e6f");
    g.fillStyle = sh;
    g.beginPath(); g.moveTo(0, -F.r * 1.25); g.lineTo(len - F.r * 1.6, -F.r); g.quadraticCurveTo(len + F.r * 0.6, -F.r * 1.9, len + F.r * 0.9, 0);
    g.quadraticCurveTo(len + F.r * 0.6, F.r * 1.9, len - F.r * 1.6, F.r); g.lineTo(0, F.r * 1.25); g.closePath(); g.fill();
    g.strokeStyle = "rgba(120,60,56,.5)"; g.lineWidth = 1; g.stroke();
    /* the bulb, and the dermal papilla feeding it */
    var bl = g.createRadialGradient(len - F.r * 0.2, 0, 0, len - F.r * 0.2, 0, F.r * 1.8);
    bl.addColorStop(0, "#8a4f47"); bl.addColorStop(1, "rgba(138,79,71,0)");
    g.fillStyle = bl; g.beginPath(); g.arc(len - F.r * 0.2, 0, F.r * 1.8, 0, TAU); g.fill();
    g.fillStyle = "#d98b86"; g.beginPath(); g.ellipse(len + F.r * 0.2, 0, F.r * 0.55, F.r * 0.45, 0, 0, TAU); g.fill();
    /* the hair shaft */
    var hs = g.createLinearGradient(0, -F.r * 0.35, 0, F.r * 0.35);
    hs.addColorStop(0, "#241510"); hs.addColorStop(0.45, "#6c4331"); hs.addColorStop(1, "#1d110c");
    g.fillStyle = hs; g.beginPath(); g.moveTo(-2, -F.r * 0.32); g.lineTo(len - F.r * 0.5, -F.r * 0.22); g.lineTo(len - F.r * 0.5, F.r * 0.22); g.lineTo(-2, F.r * 0.32); g.closePath(); g.fill();
    /* the oil (sebaceous) gland, a cluster of pale lobules off the follicle */
    var gx = len * 0.5;
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 - 0.9 + rnd() * 1.8, d = F.r * (1.6 + rnd() * 1.4), lx = gx + Math.cos(a) * d * 0.8 + (rnd() - 0.5) * F.r, ly = -F.r * 1.4 + Math.sin(a) * d * 0.55 - F.r * 0.6;
      var lr = F.r * (0.75 + rnd() * 0.45), lg = g.createRadialGradient(lx - lr * 0.3, ly - lr * 0.3, lr * 0.1, lx, ly, lr);
      lg.addColorStop(0, "#fffaf0"); lg.addColorStop(0.7, "#f3e1bd"); lg.addColorStop(1, "#d6b88a");
      g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, lr, 0, TAU); g.fill();
    }
    g.restore();
    /* the arrector pili muscle, from the follicle below the gland up to the base of the epidermis */
    var cA = Math.cos(ang), sA = Math.sin(ang), mx = F.x0 + cA * len * 0.64 + sA * F.r, my = F.y0 + sA * len * 0.64 - cA * F.r;
    var ex = mx + W * 0.07, ey = baseY(ex) + 4;
    g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx + W * 0.05, my - (my - ey) * 0.4, ex, ey);
    g.strokeStyle = "rgba(196,92,96,.7)"; g.lineWidth = F.r * 0.6; g.lineCap = "round"; g.stroke();
    g.strokeStyle = "rgba(236,150,150,.45)"; g.lineWidth = F.r * 0.2; g.stroke();
    /* the hair above the skin: continuing the follicle's angle, curving, tapering */
    var hx = F.x0, hy = F.y0, ux = -Math.cos(ang), uy = -Math.sin(ang), hl = H * 0.2;
    var hp = function (s) { return [hx + ux * hl * s - s * s * hl * 0.22, hy + uy * hl * s - s * s * hl * 0.05]; };
    for (var s = 0; s < 1; s += 0.02) {
      var p0 = hp(s), p1 = hp(s + 0.02);
      g.strokeStyle = "rgb(" + (36 + s * 60 | 0) + "," + (22 + s * 34 | 0) + "," + (16 + s * 22 | 0) + ")";
      g.lineWidth = F.r * 0.6 * (1 - s * 0.75); g.lineCap = "round";
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    }
    g.strokeStyle = "rgba(255,230,210,.35)"; g.lineWidth = 0.8;
    var q0 = hp(0.05), q1 = hp(0.6);
    g.beginPath(); g.moveTo(q0[0] - 1, q0[1] - 1); g.lineTo(q1[0] - 1, q1[1] - 1); g.stroke();
    /* the sweat gland: a coiled tube deep in the dermis, its duct spiralling up to a pore */
    var S = SWEAT;
    g.beginPath();
    for (var q = 0; q <= 1; q += 0.004) {
      var qa = q * TAU * 5, qr = S.r * (0.35 + 0.65 * Math.abs(Math.sin(q * 7.3)));
      var qx = S.x + Math.cos(qa) * qr + Math.sin(q * 11) * S.r * 0.25, qy = S.y + Math.sin(qa) * qr * 0.6;
      if (q === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
    }
    g.lineJoin = "round";
    g.strokeStyle = "rgba(170,110,110,.9)"; g.lineWidth = S.r * 0.34; g.stroke();
    g.strokeStyle = "rgba(250,222,214,.95)"; g.lineWidth = S.r * 0.22; g.stroke();
    g.strokeStyle = "rgba(160,90,96,.6)"; g.lineWidth = S.r * 0.06; g.stroke();
    g.beginPath(); g.moveTo(S.x + S.r * 0.3, S.y - S.r * 0.4);
    var topY = surfY(S.x), midY = baseY(S.x);
    for (var y = S.y - S.r * 0.4; y > topY; y -= 1.5) {
      var inEpi = y < midY, wig = inEpi ? Math.sin((midY - y) / (H * 0.018)) * S.r * 0.28 : Math.sin(y / (H * 0.06)) * S.r * 0.08;
      g.lineTo(S.x + S.r * 0.3 + wig, y);
    }
    g.strokeStyle = "rgba(170,110,110,.8)"; g.lineWidth = S.r * 0.22; g.stroke();
    g.strokeStyle = "rgba(250,222,214,.9)"; g.lineWidth = S.r * 0.12; g.stroke();
    g.fillStyle = "rgba(90,40,36,.7)"; g.beginPath(); g.ellipse(S.x + S.r * 0.3, topY, S.r * 0.18, S.r * 0.07, 0, 0, TAU); g.fill();
  };

  /* the top of the block: real-looking skin surface, drawn once per size */
  var paintTop = function (plane) {
    var ph = parseFloat(getComputedStyle(plane).height) || SURF * 2.1;
    var s = Math.min(dpr, 2.5), tw = Math.round(W * s), th = Math.round(ph * s);
    if (!topTex) { topTex = document.createElement("canvas"); topTex.className = "skin-top-tex"; plane.insertBefore(topTex, plane.firstChild); }
    topTex.width = tw; topTex.height = th;
    var g = topTex.getContext("2d");
    var base = g.createLinearGradient(0, 0, 0, th);
    base.addColorStop(0, "#9c6556"); base.addColorStop(0.5, "#cf9580"); base.addColorStop(1, "#e7b39c");
    g.fillStyle = base; g.fillRect(0, 0, tw, th);
    noise(g, tw, th, 120 * s, 0.45, [196, 128, 110], [238, 186, 164]);          /* mottling */
    noise(g, tw, th, 26 * s, 0.3, [180, 110, 96], [245, 200, 180], "soft-light");
    noise(g, tw, th, 4 * s, 0.35, [110, 70, 60], [255, 225, 210], "soft-light"); /* fine grain */
    /* the skin's micro-relief: a network of fine grooves (the diamond pattern real skin has),
       each with a soft shadow and a lit edge, and pores where the grooves cross */
    var gap = 17 * s, pts = [], cols = Math.ceil(tw / gap) + 2, rows = Math.ceil(th / (gap * 0.8)) + 2;
    for (var ry = 0; ry < rows; ry++) {
      pts.push([]);
      for (var rx = 0; rx < cols; rx++) pts[ry].push([(rx - 1 + (ry & 1) * 0.5 + (rnd() - 0.5) * 0.7) * gap, (ry - 1 + (rnd() - 0.5) * 0.6) * gap * 0.8]);
    }
    var groove = function (a, b, deep) {                      /* soft, bent a little, never a hard line */
      var mx = (a[0] + b[0]) / 2 + (rnd() - 0.5) * gap * 0.35, my = (a[1] + b[1]) / 2 + (rnd() - 0.5) * gap * 0.3;
      g.lineCap = "round";
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx, my, b[0], b[1]);
      g.strokeStyle = "rgba(128,64,54," + (0.035 + deep * 0.05) + ")"; g.lineWidth = (2.6 + deep * 2.4) * s; g.stroke();
      g.strokeStyle = "rgba(112,52,44," + (0.05 + deep * 0.11) + ")"; g.lineWidth = (0.7 + deep * 0.8) * s; g.stroke();
      g.beginPath(); g.moveTo(a[0], a[1] + 1.2 * s); g.quadraticCurveTo(mx, my + 1.2 * s, b[0], b[1] + 1.2 * s);
      g.strokeStyle = "rgba(255,234,222," + (0.05 + deep * 0.07) + ")"; g.lineWidth = 0.7 * s; g.stroke();
    };
    for (var y2 = 0; y2 < rows; y2++) {
      for (var x2 = 0; x2 < cols; x2++) {
        var P = pts[y2][x2], deep = rnd() < 0.12 ? 0.8 + rnd() * 0.2 : rnd() * 0.35;
        if (x2 + 1 < cols && rnd() < 0.75) groove(P, pts[y2][x2 + 1], deep);
        if (y2 + 1 < rows) {
          var nb = pts[y2 + 1][x2 + ((y2 & 1) ? 1 : 0)] || pts[y2 + 1][x2];
          if (rnd() < 0.7) groove(P, nb, deep * 0.8);
          var nb2 = pts[y2 + 1][x2 - ((y2 & 1) ? 0 : 1)];
          if (nb2 && rnd() < 0.45) groove(P, nb2, deep * 0.6);
        }
        if (rnd() < 0.3) {                                       /* a pore at the crossing */
          var pr = (0.6 + rnd() * 0.9) * s, pg = g.createRadialGradient(P[0], P[1], 0, P[0], P[1], pr * 2.4);
          pg.addColorStop(0, "rgba(84,36,30,.55)"); pg.addColorStop(0.5, "rgba(120,58,48,.22)"); pg.addColorStop(1, "rgba(120,58,48,0)");
          g.fillStyle = pg; g.beginPath(); g.arc(P[0], P[1], pr * 2.4, 0, TAU); g.fill();
          g.fillStyle = "rgba(255,232,220,.18)"; g.beginPath(); g.ellipse(P[0], P[1] + pr, pr, pr * 0.35, 0, 0, TAU); g.fill();
        }
      }
    }
    noise(g, tw, th, 60 * s, 0.22, [200, 110, 100], [240, 190, 170], "soft-light");  /* a little redness showing through */
    /* fine vellus hairs catching the light */
    for (var h2 = 0; h2 < tw * th / (9000 * s * s); h2++) {
      var hx = rnd() * tw, hy = rnd() * th, ha = -1.2 + rnd() * 0.8, hl = (6 + rnd() * 12) * s;
      g.strokeStyle = "rgba(246,214,192," + (0.3 + rnd() * 0.3) + ")"; g.lineWidth = 0.5 * s;
      g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(hx + Math.cos(ha) * hl * 0.5 + 2 * s, hy + Math.sin(ha) * hl * 0.5, hx + Math.cos(ha) * hl, hy + Math.sin(ha) * hl); g.stroke();
    }
    /* light from the left */
    var lt = g.createLinearGradient(0, 0, tw, 0);
    lt.addColorStop(0, "rgba(255,236,226,.12)"); lt.addColorStop(0.5, "rgba(255,236,226,0)"); lt.addColorStop(1, "rgba(0,0,0,.12)");
    g.fillStyle = lt; g.fillRect(0, 0, tw, th);
    /* the hair's opening at the front edge */
    g.fillStyle = "rgba(60,26,22,.8)";
    g.beginPath(); g.ellipse(FOL.x0 * s, th - 3 * s, 4 * s, 2 * s, 0, 0, TAU); g.fill();
  };

  /* one overlay made per size: grain on the cut face, and its sides fading into black */
  var GRAIN = sprite(160, 160, function (g, w, h) {
    var img = g.createImageData(w, h);
    for (var i = 0; i < img.data.length; i += 4) { var v = 110 + rnd() * 145; img.data[i] = v; img.data[i + 1] = v * 0.94; img.data[i + 2] = v * 0.92; img.data[i + 3] = rnd() * 60; }
    g.putImageData(img, 0, 0);
  });
  var makeOverlay = function () {
    overlay = sprite(Math.round(W * dpr), Math.round(H * dpr), function (g) {
      g.scale(dpr, dpr);
      g.save(); g.globalAlpha = 0.22;
      g.fillStyle = g.createPattern(GRAIN, "repeat"); g.fillRect(0, SURF, W, H);
      g.restore();
      var mk = g.createLinearGradient(0, 0, W, 0);
      mk.addColorStop(0, "rgba(0,0,0,1)"); mk.addColorStop(0.08, "rgba(0,0,0,0)"); mk.addColorStop(0.94, "rgba(0,0,0,0)"); mk.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = mk; g.fillRect(0, SURF - 2, W, H);
    });
  };

  var maxDpr = Math.min(window.devicePixelRatio || 1, 3), useDpr = maxDpr, paintedAt = "";
  var size = function () {
    dpr = useDpr;
    var rc = cv.getBoundingClientRect();
    W = Math.max(1, rc.width); H = Math.max(1, rc.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    SURF = H * 0.3; BASE = H * 0.52; FAT = H * 0.8;
    wrap.style.setProperty("--top-h", Math.round(SURF + H * 0.012) + "px");
    wrap.classList.add("has-top");
    if (W !== builtW) { builtW = W; build(); }
    var key = W + "x" + H + "@" + dpr;
    if (key !== paintedAt) {                   /* a phone's toolbar resizing the window keeps everything as is */
      paintedAt = key;
      paintDermis(); paintFront(); makeOverlay();
      var plane = wrap.querySelector(".skin-top-plane");
      if (plane) paintTop(plane);
    }
  };

  var phaseIdx = -1, frozen = false;
  var setPhase = function (t) {
    var idx = t >= PH[2].t ? 2 : t >= PH[1].t ? 1 : 0;
    if (idx === phaseIdx || !phaseEl) return;
    phaseIdx = idx;
    wrap.setAttribute("data-phase", String(idx));
    capEl.style.opacity = 0;
    setTimeout(function () { phaseEl.textContent = PH[idx].name; descEl.textContent = PH[idx].desc; capEl.style.opacity = 1; }, frozen ? 0 : 260);
  };

  var step = function (t, dt) {
    for (var i = 0; i < cells.length; i++) {
      var cl = cells[i];
      cl.p += dt / TURN;
      if (cl.p >= 1) {
        cl.p -= 1;
        if (!frozen && flakes.length < 8 && cl.c >= 0 && cl.c < COLS && rnd() < 0.35) {
          var fx = (cl.c + 0.5) * colW;
          flakes.push({ x: fx, y: surfY(fx) - 1, vx: (rnd() - 0.5) * 6, vy: -3 - rnd() * 4, a: 0.55, w: colW * (0.5 + rnd() * 0.3), r: (rnd() - 0.5) * 0.2 });
        }
      }
    }
    for (var q = flakes.length - 1; q >= 0; q--) {
      var fl = flakes[q];
      fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.a -= dt * 0.45; fl.r += dt * 0.15;
      if (fl.a <= 0) flakes.splice(q, 1);
    }
  };

  var loopPt = function (L, s) {                                /* a capillary loop from the plexus up into a papilla */
    var x = L.x * W, apex = baseY(x) + 6, y0 = plexusY(x);
    if (s < 0.42) { var u = s / 0.42; return [x - L.w, y0 + (apex - y0) * u]; }
    if (s < 0.58) { var v = (s - 0.42) / 0.16 * Math.PI; return [x - L.w * Math.cos(v), apex - L.w * Math.sin(v)]; }
    var w = (s - 0.58) / 0.42; return [x + L.w, apex + (y0 - apex) * w];
  };
  var label = function (txt, y, al) {
    ctx.save();
    ctx.font = "500 11px InterV, -apple-system, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,.95)"; ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(236,228,230," + al + ")";
    ctx.fillText(txt, W - 4, y);
    ctx.restore();
  };

  var draw = function (t) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    var on = clamp(t / 0.8) * clamp((CYCLE - t) / 0.8);
    var lv3 = ease(seg(t, PH[2].t, PH[2].t + 3));
    var full = function (img, a) { if (a <= 0.01) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(img, 0, 0); ctx.restore(); };

    /* the dermis and fat, then the Level 3 collagen fading in */
    full(dermis, on);
    full(collagenPlus, lv3 * on);

    /* blood moving through the artery, the plexus and the capillary loops */
    for (var kb = 0; kb < 14; kb++) {
      var bx = ((t * 0.06 + kb / 14) % 1) * (W + 20) - 10;
      ctx.fillStyle = "rgba(255,120,120," + 0.8 * on + ")";
      ctx.beginPath(); ctx.arc(bx, arteryY(bx), 1.5, 0, TAU); ctx.fill();
      var px2 = ((t * 0.04 + kb / 14 + 0.3) % 1) * (W + 20) - 10;
      ctx.fillStyle = "rgba(236,90,98," + 0.75 * on + ")";
      ctx.beginPath(); ctx.arc(px2, plexusY(px2), 1.1, 0, TAU); ctx.fill();
    }
    for (var l = 0; l < loops.length; l++) {
      var L = loops[l];
      ctx.beginPath();
      for (var s = 0; s <= 1.0001; s += 0.05) { var pt = loopPt(L, s); if (s === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); }
      ctx.strokeStyle = "rgba(150,36,50," + 0.7 * on + ")"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "rgba(226,96,104," + 0.55 * on + ")"; ctx.lineWidth = 1.2; ctx.stroke();
      for (var k = 0; k < 3; k++) {
        var rp = loopPt(L, (t * 0.25 + L.ph + k / 3) % 1);
        ctx.fillStyle = "rgba(240,96,102," + on + ")"; ctx.beginPath(); ctx.arc(rp[0], rp[1], 1.2, 0, TAU); ctx.fill();
      }
    }

    /* the epidermis: packed cells rising from the base, flattening into the barrier */
    ctx.save();
    ctx.beginPath();
    for (var x1 = -4; x1 <= W + 4; x1 += 5) ctx.lineTo(x1, surfY(x1));
    for (var x2 = W + 4; x2 >= -4; x2 -= 5) ctx.lineTo(x2, baseY(x2));
    ctx.closePath();
    var eg = ctx.createLinearGradient(0, SURF, 0, BASE);
    eg.addColorStop(0, "rgba(214,170,152," + on + ")"); eg.addColorStop(1, "rgba(160,104,94," + on + ")");
    ctx.fillStyle = eg; ctx.fill();
    ctx.clip();
    for (var n = 0; n < cells.length; n++) {
      var cl = cells[n], p = cl.p;
      var cx = (cl.c + 0.5 + cl.j * (1 - p)) * colW;
      var top = surfY(cx) + 0.5, bot = baseY(cx) + H * 0.02, D = bot - top;
      var cy = bot - D * (1 - Math.pow(1 - p, 1.7));
      var ch = Math.max(2, D * 1.7 * Math.pow(1 - p, 0.7) / N * 1.1);
      var cw = colW * (1.04 + 0.45 * p) * cl.w;
      var ca = on * clamp(p / 0.012) * (1 + 0.12 * lv3);
      var gb = seg(p, 0.06, 0.16), g1 = seg(p, 0.5, 0.64), g2 = seg(p, 0.76, 0.9), x0 = cx - cw / 2, y0 = cy - ch / 2;
      var aB = 1 - gb, aL = gb * (1 - g1), aG = g1 * (1 - g2);
      if (aB > 0.01) { ctx.globalAlpha = Math.min(1, ca * aB); ctx.drawImage(BASAL, x0 + cw * 0.08, y0, cw * 0.84, ch); }
      if (aL > 0.01) { ctx.globalAlpha = Math.min(1, ca * aL); ctx.drawImage(LIVE, x0, y0, cw, ch); }
      if (aG > 0.01) { ctx.globalAlpha = Math.min(1, ca * aG); ctx.drawImage(GRAN, x0, y0, cw, ch); }
      if (g2 > 0.01) { ctx.globalAlpha = Math.min(1, ca * g2); ctx.drawImage(CORN, x0, y0, cw, ch); }
    }
    /* melanin along the base: the dark spots Level 3 fades */
    for (var sp = 0; sp < spots.length; sp++) {
      var S2 = spots[sp], sa = (1 - ease(seg(t, S2.fade, S2.fade + 1.6))) * on;
      if (sa <= 0.01) continue;
      var sx = S2.x * W, sy = baseY(sx) - (baseY(sx) - surfY(sx)) * 0.2, ss = colW * 2.4 * S2.s;
      ctx.globalAlpha = sa * 0.9;
      ctx.drawImage(MELANIN, sx - ss / 2, sy - ss / 2, ss, ss * 0.8);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* the follicle, glands and hair */
    full(front, on);

    /* the cut edge at the surface catches the light; a glow sweeps it in Level 3 */
    ctx.beginPath();
    for (var x4 = -4; x4 <= W + 4; x4 += 4) { var yv = surfY(x4); if (x4 === -4) ctx.moveTo(x4, yv); else ctx.lineTo(x4, yv); }
    ctx.strokeStyle = "rgba(255,232,224," + (0.55 + 0.3 * lv3) * on + ")"; ctx.lineWidth = 1.2 + 0.4 * lv3; ctx.stroke();
    if (lv3 > 0) {
      var sweep = ((t - PH[2].t) * 0.3 % 1.4 - 0.2) * W, gy = surfY(sweep);
      var gl = ctx.createRadialGradient(sweep, gy, 0, sweep, gy, W * 0.22);
      gl.addColorStop(0, "rgba(255,226,232," + 0.4 * lv3 * on + ")"); gl.addColorStop(1, "rgba(255,226,232,0)");
      ctx.save(); ctx.beginPath(); ctx.rect(W * 0.04, SURF - 1, W * 0.92, BASE - SURF + H * 0.04); ctx.clip();   /* the glow stays on the skin */
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sweep, gy, W * 0.22, 0, TAU); ctx.fill();
      ctx.restore();
    }
    /* shed flakes drift off the surface */
    for (var q = 0; q < flakes.length; q++) {
      var fl = flakes[q];
      ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(fl.r);
      ctx.globalAlpha = fl.a * 0.6 * on;
      ctx.drawImage(CORN, -fl.w / 2, -1.4, fl.w, 2.8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* Level 2: glossy drops land on the skin, ripple and sink in */
    for (var d = 0; d < DROPS.length; d++) {
      var dr = DROPS[d], u = t - dr.t;
      if (u < 0 || u > 4.2) continue;
      var dx = dr.x * W, land = surfY(dx), lblLeft = dr.x > 0.62;
      if (u < 0.9) {
        var fall = ease(seg(u, 0, 0.9)), dy = H * 0.04 + (land - H * 0.04) * fall;
        var dw = 13, dh = 17 + 6 * Math.sin(fall * Math.PI);
        ctx.globalAlpha = on; ctx.drawImage(dr.img, dx - dw / 2, dy - dh, dw, dh); ctx.globalAlpha = 1;
        ctx.font = "600 12px InterV, -apple-system, system-ui, sans-serif"; ctx.textAlign = lblLeft ? "right" : "left";
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 6;
        ctx.fillStyle = "rgba(245,245,247," + 0.95 * on + ")";
        ctx.fillText(dr.name, lblLeft ? dx - 11 : dx + 11, dy - 6);
        ctx.restore();
      } else {
        var v = u - 0.9;
        for (var rr = 0; rr < 2; rr++) {
          var ring = ease(seg(v, rr * 0.22, 1.3 + rr * 0.22));
          if (ring <= 0 || ring >= 1) continue;
          ctx.strokeStyle = "rgba(" + dr.col + "," + (1 - ring) * 0.85 * on + ")";
          ctx.lineWidth = 1.5 - rr * 0.4;
          ctx.beginPath(); ctx.ellipse(dx, land - 2, 5 + ring * W * 0.1, 1.2 + ring * 4, 0, 0, TAU); ctx.stroke();
        }
        var sink = ease(seg(v, 0.1, 3)), by2 = land + (BASE + H * 0.04 - land) * sink;
        var ba = Math.sin(clamp(v / 3.2) * Math.PI) * 0.75 * on;
        ctx.globalCompositeOperation = "lighter";
        var bg = ctx.createRadialGradient(dx, by2, 0, dx, by2, 40);
        bg.addColorStop(0, "rgba(" + dr.col + "," + ba * 0.55 + ")"); bg.addColorStop(1, "rgba(" + dr.col + ",0)");
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(dx, by2, 40, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        if (v < 0.7) {
          ctx.font = "600 12px InterV, -apple-system, system-ui, sans-serif"; ctx.textAlign = lblLeft ? "right" : "left";
          ctx.save(); ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 6;
          ctx.fillStyle = "rgba(245,245,247," + (1 - v / 0.7) * 0.95 * on + ")";
          ctx.fillText(dr.name, lblLeft ? dx - 11 : dx + 11, land - 12 - v * 6);
          ctx.restore();
        }
      }
    }

    full(overlay, on);

    var la = 0.92 * on;
    label("Surface", SURF - H * 0.03, la);
    label("Epidermis", (SURF + BASE) / 2 + 4, la * 0.9);
    label(lv3 > 0.2 ? "Dermis · collagen building" : "Dermis · collagen", (BASE + FAT) / 2 + H * 0.02, la * 0.9);
    label("Fat", FAT + H * 0.09, la * 0.8);
    setPhase(t);
  };

  frozen = window.SKIN_FREEZE === true;
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var T = 0;
  size();

  /* real skin footage for the top, if there is one (a video, else a still); it covers the drawn surface.
     window.SKIN_TOP can point somewhere else (e.g. a preview). */
  var topMedia = null;
  (function () {
    var plane = wrap.querySelector(".skin-top-plane");
    if (!plane) return;
    var SRC = window.SKIN_TOP || { video: ["media/skin-top.webm", "media/skin-top.mp4"], image: "media/skin-top.jpg" };
    var show = function (el) {
      el.className = "skin-top-media";
      plane.appendChild(el); topMedia = el;
      if (!rm && !frozen && el.play) el.play().catch(function () {});
    };
    var tryImage = function () {
      if (!SRC.image) return;
      var im = new Image();
      im.alt = ""; im.decoding = "async";
      im.onload = function () { show(im); };
      im.src = SRC.image;
    };
    if (!SRC.video) { tryImage(); return; }
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.addEventListener("loadeddata", function () { show(v); }, { once: true });
    var list = [].concat(SRC.video).filter(function (u) { return !!v.canPlayType(/\.webm$/.test(u) ? "video/webm" : "video/mp4"); });
    var next = function () { if (!list.length) { tryImage(); return; } v.src = list.shift(); };
    v.addEventListener("error", next);
    next();
  })();

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
  var play = function () {
    if (raf === null && vis && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
    if (topMedia && topMedia.play && vis && !document.hidden) topMedia.play().catch(function () {});
  };
  var pause = function () {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    if (topMedia && topMedia.pause) topMedia.pause();
  };
  window.addEventListener("resize", size, { passive: true });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) play(); else pause(); }).observe(cv);
  play();
})();

/* Lumevina Skin School — the opening animation.
 *
 * A living cross-section of skin, told in the course's three levels:
 *   Level 1  Know your skin   new cells rise from the base and flatten into
 *                             the barrier at the surface, then shed
 *   Level 2  Actives          drops of vitamin C, a retinoid, niacinamide and
 *                             BHA land, ripple along the surface and sink in
 *   Level 3  Treat            dark spots fade, collagen below thickens and
 *                             brightens, and a glow sweeps the surface
 * One loop is about 14 seconds. Reduced motion shows the finished skin. */
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
  var CYCLE = 14.5;
  var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(11);
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var ease = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };

  var W, H, dpr, SURF, BASE, DEEP;
  var COLS = 11, ROWS = 7;
  /* each cell: its column, and how far along its trip to the surface it is */
  var cells = [];
  for (var c = 0; c < COLS; c++) {
    for (var r = 0; r < ROWS; r++) cells.push({ c: c, p: (r + (c % 2) * 0.5) / ROWS, j: rnd() * 0.6 - 0.3, w: 0.85 + rnd() * 0.3 });
  }
  var fibers = [];
  for (var f = 0; f < 26; f++) fibers.push({ y: rnd(), a: rnd() * 6.28, amp: 0.3 + rnd() * 0.7, k: 1.5 + rnd() * 2.5, sp: 0.15 + rnd() * 0.25,
    late: f >= 12, born: f >= 12 ? PH[2].t + (f - 12) * 0.22 : 0 });
  var spots = [];
  for (var s = 0; s < 7; s++) spots.push({ x: 0.12 + rnd() * 0.76, y: 0.25 + rnd() * 0.5, r: 5 + rnd() * 9, fade: PH[2].t + 0.4 + s * 0.35 });
  var DROPS = [
    { x: 0.22, t: PH[1].t + 0.2, name: "Vitamin C", col: [240, 190, 120] },
    { x: 0.58, t: PH[1].t + 1.1, name: "Retinoid", col: [244, 201, 214] },
    { x: 0.8, t: PH[1].t + 2.0, name: "Niacinamide", col: [214, 222, 255] },
    { x: 0.4, t: PH[1].t + 2.9, name: "BHA", col: [200, 240, 220] }
  ];
  var flakes = [];
  var T = 0;

  var size = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rc = cv.getBoundingClientRect();
    W = Math.max(1, rc.width); H = Math.max(1, rc.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SURF = H * 0.2; BASE = H * 0.58; DEEP = H * 0.99;
  };
  /* the surface isn't flat: a soft wave, gently breathing */
  var surfY = function (x, t) { return SURF + Math.sin(x / W * 6.28 * 1.5 + t * 0.6) * H * 0.012 + Math.sin(x / W * 17 + 1) * H * 0.004; };
  var baseY = function (x, t) { return BASE + Math.sin(x / W * 6.28 * 2.2 + 2 + t * 0.4) * H * 0.02; };

  var phaseIdx = -1, frozen = false;
  var setPhase = function (t) {
    var idx = t >= PH[2].t ? 2 : t >= PH[1].t ? 1 : 0;
    if (idx === phaseIdx || !phaseEl) return;
    phaseIdx = idx;
    capEl.style.opacity = 0;
    setTimeout(function () { phaseEl.textContent = PH[idx].name; descEl.textContent = PH[idx].desc; capEl.style.opacity = 1; }, frozen ? 0 : 260);
  };

  var label = function (txt, x, y, al, align) {
    ctx.save();
    ctx.font = "500 11px InterV, -apple-system, system-ui, sans-serif";
    ctx.textAlign = align || "left";
    ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 6;
    ctx.fillStyle = "rgba(190,188,192," + al + ")";
    ctx.fillText(txt, x, y);
    ctx.restore();
  };

  var draw = function (t, dt) {
    ctx.clearRect(0, 0, W, H);
    var restart = clamp(t / 0.8) * clamp((CYCLE - t) / 0.8);    /* fade in and out around the loop */
    var lv3 = ease(seg(t, PH[2].t, PH[2].t + 3));

    /* dermis: collagen strands, more of them and brighter in Level 3 */
    for (var i = 0; i < fibers.length; i++) {
      var fb = fibers[i];
      var al = fb.late ? ease(seg(t, fb.born, fb.born + 1.2)) : 1;
      if (al <= 0) continue;
      fb.a += fb.sp * dt;
      var y0 = BASE + H * 0.07 + fb.y * (DEEP - BASE - H * 0.1);
      ctx.beginPath();
      for (var x = -10; x <= W + 10; x += 12) {
        var yy = y0 + Math.sin(x / W * 6.28 * fb.k + fb.a) * H * 0.018 * fb.amp;
        if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      var depthFade = 1 - fb.y * 0.55;
      ctx.strokeStyle = "rgba(234,185,200," + ((0.1 + 0.16 * lv3) * al * depthFade * restart) + ")";
      ctx.lineWidth = 1.2 + lv3 * 0.6;
      ctx.stroke();
    }
    /* the dermis fades into the dark below */
    var g = ctx.createLinearGradient(0, BASE, 0, DEEP);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.85)");
    ctx.fillStyle = g; ctx.fillRect(0, BASE, W, DEEP - BASE);

    /* the epidermis band */
    ctx.beginPath();
    for (var x2 = 0; x2 <= W; x2 += 8) ctx.lineTo(x2, surfY(x2, t));
    for (var x3 = W; x3 >= 0; x3 -= 8) ctx.lineTo(x3, baseY(x3, t));
    ctx.closePath();
    var eg = ctx.createLinearGradient(0, SURF, 0, BASE);
    eg.addColorStop(0, "rgba(40,30,34," + restart + ")"); eg.addColorStop(1, "rgba(26,18,22," + restart + ")");
    ctx.fillStyle = eg; ctx.fill();

    /* cells rise from the base, flatten, and shed at the surface */
    var colW = W / COLS;
    for (var n = 0; n < cells.length; n++) {
      var cl = cells[n];
      cl.p += dt / 9;
      if (cl.p >= 1) {
        cl.p -= 1;
        if (!frozen && flakes.length < 40) flakes.push({ x: (cl.c + 0.5 + cl.j) * colW, y: surfY((cl.c + 0.5) * colW, t), vx: (rnd() - 0.5) * 8, vy: -6 - rnd() * 8, a: 0.6, w: colW * 0.7 });
      }
      var cx = (cl.c + 0.5 + cl.j * (1 - cl.p)) * colW;
      var top = surfY(cx, t) + 5, bot = baseY(cx, t) - 6;
      var cy = bot - (bot - top) * cl.p;
      var flat = cl.p;                                     /* round at the base, flat at the top */
      var rw = colW * (0.28 + 0.2 * flat) * cl.w, rh = colW * (0.26 - 0.17 * flat);
      var live = 1 - flat;
      var rr = Math.round(234 * live + 235 * flat), gg = Math.round(170 * live + 226 * flat), bb = Math.round(190 * live + 222 * flat);
      var ca = Math.min(1, (0.45 + 0.4 * flat) * restart * clamp(cl.p / 0.08) * (1 + 0.2 * lv3));
      ctx.fillStyle = "rgba(" + rr + "," + gg + "," + bb + "," + ca + ")";
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(cx, cy, rw, Math.max(1.6, rh), 0, 0, 6.283); else ctx.arc(cx, cy, rw, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = "rgba(255,245,248," + ca * (0.25 + 0.35 * flat) + ")";      /* a soft sheen on each cell */
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(cx - rw * 0.25, cy - rh * 0.3, rw * 0.45, Math.max(0.8, rh * 0.35), 0, 0, 6.283);
      ctx.fill();
      if (flat < 0.35) {    /* a nucleus while the cell is alive */
        ctx.fillStyle = "rgba(120,70,90," + 0.5 * ca + ")";
        ctx.beginPath(); ctx.arc(cx, cy, rh * 0.35, 0, 6.283); ctx.fill();
      }
    }
    /* shed flakes drift off the surface */
    for (var q = flakes.length - 1; q >= 0; q--) {
      var fl = flakes[q];
      fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.a -= dt * 0.4;
      if (fl.a <= 0) { flakes.splice(q, 1); continue; }
      ctx.fillStyle = "rgba(235,226,222," + fl.a * 0.5 * restart + ")";
      ctx.fillRect(fl.x - fl.w / 2, fl.y, fl.w, 1.6);
    }

    /* dark spots sit in the epidermis until Level 3 fades them */
    for (var k = 0; k < spots.length; k++) {
      var sp = spots[k], sa = (1 - ease(seg(t, sp.fade, sp.fade + 1.6))) * restart;
      if (sa <= 0.01) continue;
      var sx = sp.x * W, sy = SURF + (BASE - SURF) * sp.y;
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.r * 2);
      sg.addColorStop(0, "rgba(150,96,62," + 0.8 * sa + ")"); sg.addColorStop(1, "rgba(150,96,62,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sp.r * 2, 0, 6.283); ctx.fill();
    }

    /* the surface line, with a glow sweeping along it in Level 3 */
    ctx.beginPath();
    for (var x4 = 0; x4 <= W; x4 += 6) { var yv = surfY(x4, t); if (x4 === 0) ctx.moveTo(x4, yv); else ctx.lineTo(x4, yv); }
    ctx.strokeStyle = "rgba(247,211,222," + (0.45 + 0.4 * lv3) * restart + ")";
    ctx.lineWidth = 1.6 + lv3;
    ctx.stroke();
    if (lv3 > 0) {
      var sweep = ((t - PH[2].t) * 0.28) % 1.4 - 0.2;
      var gx = sweep * W, gy = surfY(gx, t);
      var gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.22);
      gl.addColorStop(0, "rgba(247,211,222," + 0.35 * lv3 * restart + ")"); gl.addColorStop(1, "rgba(247,211,222,0)");
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(gx, gy, W * 0.22, 0, 6.283); ctx.fill();
    }

    /* Level 2: drops of actives land, ripple and sink */
    for (var d = 0; d < DROPS.length; d++) {
      var dr = DROPS[d], u = t - dr.t;
      if (u < 0 || u > 4.2) continue;
      var dx = dr.x * W, land = surfY(dx, t), col = dr.col.join(",");
      var fall = ease(seg(u, 0, 0.9));
      if (u < 0.9) {
        var dy = H * 0.02 + (land - H * 0.02) * fall;
        ctx.fillStyle = "rgba(" + col + "," + 0.95 * restart + ")";
        ctx.beginPath(); ctx.arc(dx, dy - 4, 4.5, Math.PI, 0); ctx.lineTo(dx, dy - 13); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(dx, dy - 4, 4.5, 0, Math.PI); ctx.fill();
        ctx.font = "600 12px InterV, -apple-system, system-ui, sans-serif"; ctx.textAlign = "left";
        ctx.fillStyle = "rgba(245,245,247," + 0.9 * restart + ")";
        ctx.fillText(dr.name, dx + 10, dy - 4);
      } else {
        var v = u - 0.9;
        var ring = ease(seg(v, 0, 1.2));
        ctx.strokeStyle = "rgba(" + col + "," + (1 - ring) * 0.8 * restart + ")";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(dx, land, 6 + ring * W * 0.1, 2 + ring * 5, 0, 0, 6.283); ctx.stroke();
        var sink = ease(seg(v, 0.1, 3));
        var by = land + (BASE - land) * 0.8 * sink, ba = Math.sin(clamp(v / 3.2) * Math.PI) * 0.7 * restart;
        var bg = ctx.createRadialGradient(dx, by, 0, dx, by, 40);
        bg.addColorStop(0, "rgba(" + col + "," + ba + ")"); bg.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(dx, by, 40, 0, 6.283); ctx.fill();
        if (v < 1.4) {
          ctx.font = "600 12px InterV, -apple-system, system-ui, sans-serif"; ctx.textAlign = "left";
          ctx.fillStyle = "rgba(245,245,247," + (1 - v / 1.4) * 0.9 * restart + ")";
          ctx.fillText(dr.name, dx + 10, land - 10 - v * 6);
        }
      }
    }

    /* the cross-section floats: its left and right edges fade out */
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    var mk = ctx.createLinearGradient(0, 0, W, 0);
    mk.addColorStop(0, "rgba(0,0,0,0)"); mk.addColorStop(0.1, "rgba(0,0,0,1)"); mk.addColorStop(0.92, "rgba(0,0,0,1)"); mk.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = mk; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    /* the diagram labels */
    var la = 0.9 * restart;
    label("Surface", 2, SURF - H * 0.045, la);
    label("Epidermis", 2, (SURF + BASE) / 2 + 4 - H * 0.02, la * 0.8);
    label("Dermis", 2, BASE + H * 0.12, la * 0.8);
    label(lv3 > 0.2 ? "Collagen, building" : "Collagen", W - 2, DEEP - H * 0.08, la * 0.7, "right");
    setPhase(t);
  };

  frozen = window.SKIN_FREEZE === true;
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  size();
  if (frozen || rm) {
    frozen = true;
    for (var s2 = 0; s2 < 12.8 * 30; s2++) { T = s2 / 30; draw(T, 1 / 30); }
    window.addEventListener("resize", function () { size(); draw(T, 0); }, { passive: true });
    return;
  }
  var last = performance.now(), raf = null, vis = true;
  var loop = function (now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    T += dt;
    if (T >= CYCLE) { T = 0; flakes = []; phaseIdx = -1; }
    draw(T, dt);
    raf = requestAnimationFrame(loop);
  };
  var play = function () { if (raf === null && vis && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  var pause = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };
  window.addEventListener("resize", size, { passive: true });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) play(); else pause(); }).observe(cv);
  play();
})();

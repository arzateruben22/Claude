/* Lumevina — the water (Nov 15; the light redone and the fountain added Nov 16)
 *
 * The water through the page, drawn in code (nothing to download):
 *   - the front page: Evelyn's logo carved in stone, standing in a pool
 *     (img/hero/hero-stone.webp). Rings keep spreading from the statue's base,
 *     as if water were falling into the pool, now and then a drop lands
 *     somewhere else, and light plays on the water below
 *   - over the water pictures behind Book (the koi), FAQ and Contact: the
 *     same light on the water
 *   - at the top of the plainer sections (Shop, Services, Skin science): a
 *     soft band of water and light, fading out before the words
 *   - a ring wherever open water is tapped or clicked; never on a button, a
 *     link, a field or text
 *
 * The light is what sun does at the bottom of a pool: a few slow waves bend
 * it, and where they gather it, it draws bright wavy lines that thicken,
 * thin and wander. Worked out on a coarse grid (a point every 7 px), then
 * smoothed up to size. Each canvas draws only while it's on screen, about 25
 * times a second. With reduced motion everything stands still and taps leave
 * no ring. The pictures themselves are CSS backgrounds or the hero's image
 * (css/styles.css → "The water", "The moving background").
 */
(function () {
  "use strict";
  var still = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  /* where the water goes.
     "pool": the front page's statue in its pool. The canvas sits over the
       picture; `fit` says how the picture is laid in its box (its size and
       object-position), `water` where the pool starts (a fraction of the
       picture's height) and `source` the statue's base, where the rings start
     "water": over a water picture, the light from `from` (a fraction of the height) down
     "band": a strip at the top of a plain section */
  var SPOTS = [
    { sel: ".hero", mode: "water", from: 0.66, strength: 0.7, taps: false },   /* the water at the front page's foot, under the shelf */
    { sel: "#shop", mode: "band" },
    { sel: "#book", mode: "water", from: 0, strength: 0.3 },   /* the koi pond, seen from above: the clip has its own sparkle, so only a little light on top */
    { sel: "#services", mode: "band" },
    { sel: "#watch", mode: "band" },
    { sel: "#policies", mode: "water", from: 0.4 },
    { sel: "#contact", mode: "water", from: 0.1 }
  ];
  var BAND = 300;                 /* px: the strip at the top of a plain section */
  var FLAT = 0.42;                /* the water is seen at an angle: its light is flatter than it is wide */
  var TINT = "245, 213, 189";     /* the bands' water, the cream of the pictures */
  var STEP = 7;                   /* px between the points the light is worked out at */
  /* the waves that bend the light: wavelength (px), direction (degrees), speed (px/s), strength */
  var WAVES = [[270, 12, 16, 0.42], [200, 74, 12, 0.36], [160, 131, 19, 0.3], [340, 197, 9, 0.4], [130, 286, 14, 0.24], [220, 333, 11, 0.32]];
  /* taps here don't ripple: they're for reading or doing something */
  var SKIP = "a,button,input,select,textarea,label,summary,details,p,h1,h2,h3,h4,h5,h6,li,dt,dd,img:not(.hero-still),video,iframe,form,table,blockquote,figure,[role],[tabindex],[contenteditable]";

  var res = function () { return Math.min(window.devicePixelRatio || 1, 2) * 0.6; };
  var spots = [];

  /* the light for one spot at time t (ms), into its small grid canvas */
  var light = function (sp, t) {
    var gw = sp.gw, gh = sp.gh, n = WAVES.length, sec = t / 1000;
    var sB = sp.sB, cB = sp.cB;
    for (var w = 0; w < n; w++) {
      var wv = sp.waves[w], ph = -wv.om * sec + wv.phi;
      for (var j = 0; j < gh; j++) { var b = wv.ky * j * STEP + ph; sB[w * gh + j] = Math.sin(b); cB[w * gh + j] = Math.cos(b); }
    }
    var d = sp.img.data, sA = sp.sA, cA = sp.cA, o = 3;
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++, o += 4) {
        var hxx = 0, hyy = 0, hxy = 0;
        for (var k = 0; k < n; k++) {
          var s = sA[k * gw + x] * cB[k * gh + y] + cA[k * gw + x] * sB[k * gh + y], q = sp.waves[k];
          hxx += q.xx * s; hyy += q.yy * s; hxy += q.xy * s;
        }
        /* how much the surface gathers the light here: bright where it nearly focuses */
        var det = (1 - hxx) * (1 - hyy) - hxy * hxy;
        var i = 1 / (Math.abs(det) + 0.07);
        var a = (i - 1.6) / 7;
        a = a <= 0 ? 0 : a >= 1 ? 1 : Math.pow(a, 0.85);
        d[o] = a * 245 | 0;
      }
    }
    sp.gctx.putImageData(sp.img, 0, 0);
  };

  var paint = function (sp, now) {
    var c = sp.ctx, W = sp.cv.width, H = sp.cv.height, r = sp.r;
    if (!W || !H) return;
    c.clearRect(0, 0, W, H);
    var t = still.matches ? 0 : now;
    if (sp.mode === "band") { c.fillStyle = "rgba(" + TINT + ", 0.6)"; c.fillRect(0, 0, W, H); }
    light(sp, t);
    c.save();
    c.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in c) c.imageSmoothingQuality = "high";
    c.globalAlpha = (sp.mode === "band" ? 0.85 : 0.6) * sp.strength;
    c.drawImage(sp.grid, 0, 0, sp.gw * STEP * r, sp.gh * STEP * r);
    c.restore();
    /* where the light shows */
    var m = c.createLinearGradient(0, 0, 0, H);
    if (sp.mode === "band") { m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(0.35, "rgba(0,0,0,0.75)"); m.addColorStop(1, "rgba(0,0,0,0)"); }
    else {
      var from = sp.mode === "pool" ? Math.max(0, Math.min(0.95, sp.map(0, sp.water)[1] / (H / r))) : sp.from;
      m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(Math.min(0.95, from), "rgba(0,0,0,0)");
      m.addColorStop(Math.min(1, from + (sp.mode === "pool" ? 0.12 : 0.2)), "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,1)");
    }
    c.globalCompositeOperation = "destination-in";
    c.fillStyle = m;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    /* the rings: spreading and fading */
    var flat = sp.flat || FLAT;
    sp.ripples = sp.ripples.filter(function (rp) { return now - rp.t0 < (rp.big ? 3600 : 2000); });
    sp.ripples.forEach(function (rp) {
      var life = rp.big ? 3600 : 2000, reach = rp.big ? sp.reach : rp.small ? 55 : 170, count = rp.small ? 2 : 3;
      for (var k = 0; k < count; k++) {
        var a = (now - rp.t0) / life - k * 0.13;
        if (a <= 0 || a >= 1) continue;
        var e = 1 - Math.pow(1 - a, 3), rad = (rp.big ? 30 : 8) * r + reach * e * r, fade = Math.pow(1 - a, 2) * (rp.small ? 0.7 : 1);
        c.beginPath();
        c.ellipse(rp.x, rp.y + 2 * r, rad * 1.04, rad * flat * 1.04, 0, 0, Math.PI * 2);
        c.strokeStyle = "rgba(120, 92, 70, " + (fade * 0.3) + ")";
        c.lineWidth = Math.max(0.7, 2.6 * (1 - a)) * r;
        c.stroke();
        c.beginPath();
        c.ellipse(rp.x, rp.y, rad, rad * flat, 0, 0, Math.PI * 2);
        c.strokeStyle = "rgba(255, 252, 246, " + (fade * 0.95) + ")";
        c.lineWidth = Math.max(0.7, 2.8 * (1 - a)) * r;
        c.stroke();
      }
    });
  };

  var running = false, last = 0;
  var frame = function (now) {
    running = false;
    var go = false, due = now - last >= 40;
    if (due) last = now;
    spots.forEach(function (sp) {
      if (!sp.visible) return;
      var moving = !still.matches || sp.ripples.length > 0;
      if (due && (moving || sp.dirty)) { paint(sp, now); sp.dirty = false; }
      if (moving || sp.dirty) go = true;
    });
    if (go) { running = true; window.requestAnimationFrame(frame); }
  };
  var kick = function () { if (!running) { running = true; window.requestAnimationFrame(frame); } };

  /* the grid and the waves for a spot's size */
  var size = function (sp) {
    var w = sp.cv.clientWidth, h = sp.cv.clientHeight, r = res();
    sp.r = r;
    var W = Math.round(w * r), H = Math.round(h * r);
    if (W !== sp.cv.width || H !== sp.cv.height) { sp.cv.width = W; sp.cv.height = H; }
    var gw = Math.max(2, Math.ceil(w / STEP) + 1), gh = Math.max(2, Math.ceil(h / STEP) + 1), n = WAVES.length;
    if (gw !== sp.gw || gh !== sp.gh) {
      sp.gw = gw; sp.gh = gh;
      sp.grid.width = gw; sp.grid.height = gh;
      sp.img = sp.gctx.createImageData(gw, gh);
      for (var p = 0; p < sp.img.data.length; p += 4) { sp.img.data[p] = 255; sp.img.data[p + 1] = 251; sp.img.data[p + 2] = 244; }
      sp.sA = new Float32Array(n * gw); sp.cA = new Float32Array(n * gw);
      sp.sB = new Float32Array(n * gh); sp.cB = new Float32Array(n * gh);
      var flat = sp.flat || FLAT;
      sp.waves = WAVES.map(function (v, i) {
        var k = 2 * Math.PI / v[0], th = v[1] * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th) / flat;
        return { ky: k * uy, om: k * v[2], phi: i * 1.7, xx: v[3] * ux * ux, yy: v[3] * uy * uy * flat, xy: v[3] * ux * uy * Math.sqrt(flat), kx: k * ux };
      });
      sp.waves.forEach(function (wv, i) {
        for (var x = 0; x < gw; x++) { var a = wv.kx * x * STEP; sp.sA[i * gw + x] = Math.sin(a); sp.cA[i * gw + x] = Math.cos(a); }
      });
    }
    if (sp.mode === "pool") {
      /* where a point of the picture lands in the box (object-fit: cover) */
      var f = sp.fit, sc = Math.max(w / f.w, h / f.h), dw = f.w * sc, dh = f.h * sc, ox = (w - dw) * f.px, oy = (h - dh) * f.py;
      sp.map = function (u, v) { return [ox + u * dw, oy + v * dh]; };
      sp.reach = dw * 0.55;
    }
    sp.dirty = true;
    kick();
  };

  var find = function (el) { return spots.filter(function (s) { return s.host === el; })[0]; };
  var seen = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var sp = find(en.target);
      if (!sp) return;
      sp.visible = en.isIntersecting;
      if (sp.visible) { sp.dirty = true; kick(); }
    });
  }, { rootMargin: "80px 0px" }) : null;
  var resized = "ResizeObserver" in window ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) { var sp = find(en.target); if (sp) size(sp); });
  }) : null;

  SPOTS.forEach(function (s) {
    var host = document.querySelector(s.sel);
    if (!host) return;
    var cv = document.createElement("canvas");
    cv.className = "water-canvas water-" + s.mode;
    cv.setAttribute("aria-hidden", "true");
    if (s.mode !== "pool") {
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      /* the words stay above the water: in-flow children are lifted (no z-index,
         so nothing inside gets a new stacking order) */
      Array.prototype.forEach.call(host.children, function (ch) {
        if (getComputedStyle(ch).position === "static") ch.style.position = "relative";
      });
      /* above a background clip if the section has one, else under everything */
      var under = host.querySelector(":scope > .bg-media");
      if (under) host.insertBefore(cv, under.nextSibling); else host.insertBefore(cv, host.firstChild);
    } else {
      host.appendChild(cv);
    }
    var grid = document.createElement("canvas");
    var sp = { host: host, cv: cv, ctx: cv.getContext("2d"), grid: grid, gctx: grid.getContext("2d"), mode: s.mode,
      from: s.from || 0, strength: s.strength || 1, flat: s.flat, fit: s.fit, water: s.water || 0, source: s.source,
      ripples: [], visible: !seen, dirty: true, r: res(), nextRing: 0, nextDrop: 1200 };
    if (!sp.ctx || !sp.gctx) return;
    spots.push(sp);
    var tapHost = s.tapOn ? document.querySelector(s.tapOn) : host;
    if (s.taps !== false) tapHost.addEventListener("click", function (e) {
      if (still.matches || e.detail === 0) return;              /* keyboard "clicks" have no place */
      var hit = e.target.closest ? e.target.closest(SKIP) : null;
      if (hit && tapHost.contains(hit)) return;
      var b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      if (x < 0 || y < 0 || x > b.width || y > b.height) return;
      if (sp.mode === "pool" && y < sp.map(0, sp.water)[1]) return;   /* the statue isn't water */
      sp.ripples.push({ x: x * sp.r, y: y * sp.r, t0: performance.now() });
      if (sp.ripples.length > 8) sp.ripples.shift();
      kick();
    });
    if (seen) seen.observe(host);
    if (resized) resized.observe(host);
    size(sp);
  });
  if (still.addEventListener) still.addEventListener("change", function () { spots.forEach(function (sp) { sp.dirty = true; sp.ripples = []; }); kick(); });
})();

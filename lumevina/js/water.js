/* Lumevina — the water (Nov 15)
 *
 * The hero's water carried down the page, drawn in code (nothing to download):
 *   - over the water pictures behind Book (the koi), FAQ and Contact: light that
 *     shimmers and travels across the water, the way sun does on a pool
 *   - at the top of the plainer sections (Shop, Services, Skin science): a
 *     soft band of the same water and light, fading out before the words
 *   - a ring that spreads wherever open background is tapped or clicked, on
 *     those and on the hero; never on a button, a link, a field or text
 * One small tile of light is made once and drawn twice a frame, drifting two
 * ways. Each canvas draws only while it's on screen, about 30 times a second.
 * With reduced motion the light stands still and taps leave no ring.
 * The pictures themselves are CSS backgrounds (css/styles.css → "The water").
 */
(function () {
  "use strict";
  var still = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  /* where the water goes. mode "water": over a water picture, the light from
     `from` (a fraction of the height) down; "band": a strip at the top of a
     plain section; "ripple": rings only (the hero has its own moving water) */
  var SPOTS = [
    { sel: ".hero", mode: "ripple" },
    { sel: "#shop", mode: "band" },
    { sel: "#book", mode: "water", from: 0, strength: 0.45 },   /* the koi pond, seen from above: water everywhere, and its own sparkle, so less light on top */
    { sel: "#services", mode: "band" },
    { sel: "#watch", mode: "band" },
    { sel: "#policies", mode: "water", from: 0.4 },
    { sel: "#contact", mode: "water", from: 0.1 }
  ];
  var BAND = 300;          /* px: the strip at the top of a plain section */
  var SQUASH = 0.4;        /* the water is seen at an angle: its light is flatter than it is wide */
  var TINT = "245, 213, 189";   /* the water's cream, as in the pictures */
  /* taps here don't ripple: they're for reading or doing something */
  var SKIP = "a,button,input,select,textarea,label,summary,details,p,h1,h2,h3,h4,h5,h6,li,dt,dd,img,video,iframe,form,table,blockquote,figure,[role],[tabindex],[contenteditable]";

  var res = function () { return Math.min(window.devicePixelRatio || 1, 2) * 0.6; };

  /* the tile: a seamless net of light. Cellular noise, bright where two
     cells meet, which is the shape sunlight takes at the bottom of a pool */
  var tile = (function () {
    var S = 256, N = 6, c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    if (!g) return null;
    var im = g.createImageData(S, S), d = im.data;
    var seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var px = [], py = [];
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) { px.push((i + 0.1 + 0.8 * rnd()) / N); py.push((j + 0.1 + 0.8 * rnd()) / N); }
    for (var y = 0; y < S; y++) {
      var v = (y + 0.5) / S, cj = Math.floor(v * N);
      for (var x = 0; x < S; x++) {
        var u = (x + 0.5) / S, ci = Math.floor(u * N), f1 = 9, f2 = 9;
        for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
          var ii = ci + di, jj = cj + dj, ox = 0, oy = 0;
          if (ii < 0) { ii += N; ox = -1; } else if (ii >= N) { ii -= N; ox = 1; }
          if (jj < 0) { jj += N; oy = -1; } else if (jj >= N) { jj -= N; oy = 1; }
          var k = jj * N + ii, dx = px[k] + ox - u, dy = py[k] + oy - v, dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
        }
        var a = Math.max(0, 1 - (f2 - f1) * N / 0.11);
        a = a * a * (3 - 2 * a);
        var o = (y * S + x) * 4;
        d[o] = 255; d[o + 1] = 251; d[o + 2] = 244; d[o + 3] = Math.round(a * 235);
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  })();
  if (!tile) return;

  var spots = [];

  /* one layer of light: the tile, scaled, squashed and drifted */
  var layer = function (c, pat, W, H, s, ox, oy, alpha) {
    var tw = 256 * s, th = 256 * s * SQUASH;
    c.save();
    c.globalAlpha = alpha;
    c.translate(((ox % tw) + tw) % tw - tw, ((oy % th) + th) % th - th);
    c.scale(s, s * SQUASH);
    c.fillStyle = pat;
    c.fillRect(0, 0, W / s + 512, H / (s * SQUASH) + 512);
    c.restore();
  };

  var paint = function (sp, now) {
    var c = sp.ctx, W = sp.cv.width, H = sp.cv.height, r = sp.r;
    if (!W || !H) return;
    c.clearRect(0, 0, W, H);
    if (sp.mode !== "ripple") {
      var t = still.matches ? 0 : now;
      if (sp.mode === "band") { c.fillStyle = "rgba(" + TINT + ", 0.6)"; c.fillRect(0, 0, W, H); }
      /* two layers at different sizes, drifting different ways, with a slow sway, so
         the net never reads as a pattern: just light moving on water */
      var sway = Math.sin(t / 2600) * 14 * r;
      layer(c, sp.pat, W, H, 2.6 * r, t * 0.011 * r + sway, t * 0.004 * r, (sp.mode === "band" ? 0.42 : 0.22) * sp.strength);
      layer(c, sp.pat, W, H, 3.7 * r, -t * 0.007 * r, t * 0.006 * r - sway * 0.6, (sp.mode === "band" ? 0.3 : 0.15) * sp.strength);
      /* where the light shows: fades in from `from` (water) or out by the band's foot */
      var m = c.createLinearGradient(0, 0, 0, H);
      if (sp.mode === "band") { m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(0.35, "rgba(0,0,0,0.75)"); m.addColorStop(1, "rgba(0,0,0,0)"); }
      else { m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(Math.min(0.95, sp.from), "rgba(0,0,0,0)"); m.addColorStop(Math.min(1, sp.from + 0.2), "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,1)"); }
      c.globalCompositeOperation = "destination-in";
      c.fillStyle = m;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "source-over";
    }
    /* the rings: three, one after another, spreading and fading */
    sp.ripples = sp.ripples.filter(function (rp) { return now - rp.t0 < 2000; });
    sp.ripples.forEach(function (rp) {
      for (var k = 0; k < 3; k++) {
        var a = (now - rp.t0) / 2000 - k * 0.13;
        if (a <= 0 || a >= 1) continue;
        var e = 1 - Math.pow(1 - a, 3), rad = (12 + 170 * e) * r, fade = Math.pow(1 - a, 2);
        c.beginPath();
        c.ellipse(rp.x, rp.y + 2 * r, rad * 1.04, rad * SQUASH * 1.04, 0, 0, Math.PI * 2);
        c.strokeStyle = "rgba(150, 105, 78, " + (fade * 0.34) + ")";
        c.lineWidth = Math.max(0.7, 2.6 * (1 - a)) * r;
        c.stroke();
        c.beginPath();
        c.ellipse(rp.x, rp.y, rad, rad * SQUASH, 0, 0, Math.PI * 2);
        c.strokeStyle = "rgba(255, 252, 246, " + (fade * 0.95) + ")";
        c.lineWidth = Math.max(0.7, 2.8 * (1 - a)) * r;
        c.stroke();
      }
    });
  };

  var running = false, last = 0;
  var frame = function (now) {
    running = false;
    var go = false, due = now - last >= 32;
    if (due) last = now;
    spots.forEach(function (sp) {
      if (!sp.visible) return;
      var moving = (sp.mode !== "ripple" && !still.matches) || sp.ripples.length > 0;
      if (due && (moving || sp.dirty)) { paint(sp, now); sp.dirty = false; }
      if (moving || sp.dirty) go = true;
    });
    if (go) { running = true; window.requestAnimationFrame(frame); }
  };
  var kick = function () { if (!running) { running = true; window.requestAnimationFrame(frame); } };

  var size = function (sp) {
    var w = sp.cv.clientWidth, h = sp.cv.clientHeight, r = res();
    sp.r = r;
    var W = Math.round(w * r), H = Math.round(h * r);
    if (W !== sp.cv.width || H !== sp.cv.height) { sp.cv.width = W; sp.cv.height = H; }
    sp.dirty = true;
    kick();
  };

  var seen = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var sp = spots.filter(function (s) { return s.host === en.target; })[0];
      if (!sp) return;
      sp.visible = en.isIntersecting;
      if (sp.visible) { sp.dirty = true; kick(); }
    });
  }, { rootMargin: "80px 0px" }) : null;
  var resized = "ResizeObserver" in window ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) {
      var sp = spots.filter(function (s) { return s.host === en.target; })[0];
      if (sp) size(sp);
    });
  }) : null;

  SPOTS.forEach(function (s) {
    var host = document.querySelector(s.sel);
    if (!host) return;
    var cv = document.createElement("canvas");
    cv.className = "water-canvas water-" + s.mode;
    cv.setAttribute("aria-hidden", "true");
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    /* the words stay above the water: in-flow children are lifted (no z-index,
       so nothing inside gets a new stacking order) */
    Array.prototype.forEach.call(host.children, function (ch) {
      if (getComputedStyle(ch).position === "static") ch.style.position = "relative";
    });
    var scrim = host.querySelector(":scope > .hero-scrim");
    if (scrim) scrim.parentNode.insertBefore(cv, scrim.nextSibling);
    else host.insertBefore(cv, host.firstChild);
    var sp = { host: host, cv: cv, ctx: cv.getContext("2d"), mode: s.mode, from: s.from || 0, strength: s.strength || 1, ripples: [], visible: !seen, dirty: true, r: res() };
    sp.pat = sp.ctx.createPattern(tile, "repeat");
    spots.push(sp);
    host.addEventListener("click", function (e) {
      if (still.matches || e.detail === 0) return;              /* keyboard "clicks" have no place */
      var hit = e.target.closest ? e.target.closest(SKIP) : null;
      if (hit && host.contains(hit)) return;
      var b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      if (x < 0 || y < 0 || x > b.width || y > b.height) return;
      sp.ripples.push({ x: x * sp.r, y: y * sp.r, t0: performance.now() });
      if (sp.ripples.length > 5) sp.ripples.shift();
      kick();
    });
    if (seen) seen.observe(host);
    if (resized) resized.observe(host);
    size(sp);
  });
  if (still.addEventListener) still.addEventListener("change", function () { spots.forEach(function (sp) { sp.dirty = true; sp.ripples = []; }); kick(); });
})();

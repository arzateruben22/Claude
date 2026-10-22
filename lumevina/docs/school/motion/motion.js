/* Lumevina Skin School motion runtime (inlined into every scene page by render.mjs).
 *
 * The contract: a scene defines window.SCENE = { dur, poster, shots: [{ at, name, cap }] }
 * and window.seek(t). seek sets EVERYTHING on screen from t alone: no timers,
 * no CSS transitions, no requestAnimationFrame, no Date, no Math.random. The
 * renderer calls seek(i / fps) for every frame, so the same scene renders the
 * same bytes every time, on any machine.
 *
 * M.stage(t) runs the shot list: which <section class="shot"> is on screen,
 * the slide between shots, and the caption bar. The scene's seek then animates
 * the inside of the current shot from its local time. */
window.M = (function () {
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var E = {
    lin: function (x) { return x; },
    out: function (x) { return 1 - Math.pow(1 - x, 3); },
    in: function (x) { return x * x * x; },
    inout: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    back: function (x) { var c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    bounce: function (x) { var n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }
  };
  var tw = function (t, a, b, from, to, e) { return from + (to - from) * (e || E.out)(seg(t, a, b)); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var set = function (el, p) {
    if (!el) return;
    var x = p.x || 0, y = p.y || 0, s = p.s == null ? 1 : p.s, r = p.r || 0;
    el.style.transform = "translate(" + x + "px, " + y + "px) rotate(" + r + "deg) scale(" + s + ")";
    if (p.o != null) el.style.opacity = p.o;
  };
  // an element arriving at local time t0: slides from dy/dx, fades over the first part, optional scale-up with a little overshoot
  // soft focus while something moves in or out: a blur that clears as it lands (only ours: an
  // element's own inline filter is left alone once the entrance is over)
  var soft = function (el, amount) {
    if (!el || !el.style) return;
    if (amount > 0.01) { el.style.filter = "blur(" + amount.toFixed(2) + "vmin)"; el.dataset.soft = "1"; }
    else if (el.dataset && el.dataset.soft) { el.style.filter = ""; delete el.dataset.soft; }
  };
  var enter = function (el, lt, t0, o) {
    o = o || {};
    var d = o.d || 0.6, dy = o.y == null ? 28 : o.y, dx = o.x || 0, p = seg(lt, t0, t0 + d), q = E.out(p);
    set(el, { x: dx * (1 - q), y: dy * (1 - q), o: Math.min(1, p * 2.5), s: o.s ? tw(lt, t0, t0 + d, o.s, 1, E.back) : 0.965 + 0.035 * q });
    soft(el, (1 - q) * (o.blur == null ? 0.9 : o.blur));
    return p;
  };
  var leave = function (el, lt, t0, o) {
    o = o || {};
    var d = o.d || 0.5, p = seg(lt, t0, t0 + d), q = E.in(p);
    set(el, { x: (o.x || 0) * q, y: (o.y == null ? 40 : o.y) * q, o: 1 - p });
    soft(el, q * 0.9);
    return p;
  };
  var type = function (el, text, lt, t0, cps) {
    if (!el) return 0;
    var n = Math.max(0, Math.floor((lt - t0) * (cps || 30)));
    el.textContent = text.slice(0, n);
    return n >= text.length ? 1 : n / text.length;
  };
  var count = function (el, lt, a, b, from, to, fmt) { if (el) el.textContent = (fmt || Math.round)(tw(lt, a, b, from, to, E.out)); };
  var lerpColor = function (a, b, p) { return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * p) + "," + Math.round(a[1] + (b[1] - a[1]) * p) + "," + Math.round(a[2] + (b[2] - a[2]) * p) + ")"; };

  var SHOTS = [], shotEls = [], capWrap = null, capEl = null, room = null, solid = false;
  var init = function () { SHOTS = (window.SCENE && window.SCENE.shots) || []; shotEls = $$(".shot"); capEl = $("#cap"); capWrap = capEl && capEl.parentElement; room = $(".room"); solid = !!$("#gl"); dress(); };
  var hash = function (i) { var x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };
  // the flat scenes' cards and tiles as things on the table: once, every solid rounded element in
  // the canvas gets a soft contact shadow (unless it has a shadow of its own) and a touch of
  // light falling across its top (unless it paints its own gradient). Light-coloured ones get a
  // white edge instead of a warm one.
  var dress = function () {
    if (solid) return;
    $$(".canvas *").forEach(function (el) {
      if (!(el instanceof HTMLElement) || el.classList.contains("shot")) return;
      var cs = getComputedStyle(el), m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(cs.backgroundColor);
      if (!m || (m[4] != null && parseFloat(m[4]) < 0.9)) return;
      if ((parseFloat(cs.borderTopLeftRadius) || 0) < 3 || el.offsetWidth < 20 || el.offsetHeight < 20) return;
      if (cs.boxShadow === "none") el.classList.add("obj-sh");
      if (cs.backgroundImage === "none") el.classList.add("obj-lt");
      if ((0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 > 0.5) el.classList.add("lit");
    });
  };
  // the room the lesson sits in, drawn behind everything: a warm darkness, a pool of light on
  // the table (behind the set, in a solid scene: its floor carries its own pool), a few soft
  // bokeh discs far back, and fine dust rising through the light, like the particles in the
  // line art. All of it moves very slowly, all of it from t alone.
  var ambient = function (t) {
    if (!room || !room.getContext) return;
    var c = room.getContext("2d"), W = room.width, H = room.height, u = Math.min(W, H) / 720, k, g;
    g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#090606"); g.addColorStop(0.5, "#110b0a"); g.addColorStop(1, "#1a110e");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var px = W * (0.5 + 0.025 * Math.sin(t * 0.09)), py = H * (solid ? 0.5 : 0.74), sx = 1.45, sy = solid ? 0.5 : 0.78, R = Math.max(W, H) * 0.62;
    c.save(); c.translate(px, py); c.scale(sx, sy);
    g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, "rgba(158,104,74," + (solid ? 0.5 : 0.46) + ")"); g.addColorStop(0.3, "rgba(126,80,58,0.24)"); g.addColorStop(1, "rgba(90,56,40,0)");
    c.fillStyle = g; c.fillRect(-R, -R, 2 * R, 2 * R); c.restore();
    for (k = 0; k < 7; k++) {   // the bokeh: large, faint, warm, drifting
      var bx = (hash(k + 11) * 1.1 - 0.05) * W + Math.sin(t * 0.045 + k * 1.7) * u * 18, by = (0.24 + hash(k + 23) * 0.5) * H + Math.cos(t * 0.04 + k) * u * 12, br = (26 + hash(k + 37) * 46) * u, ba = (0.016 + hash(k + 41) * 0.026) * (solid ? 0.8 : 1);
      g = c.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, "rgba(246,220,198," + (ba * 0.6).toFixed(3) + ")"); g.addColorStop(0.78, "rgba(246,220,198," + ba.toFixed(3) + ")"); g.addColorStop(1, "rgba(246,220,198,0)");
      c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, 6.2832); c.fill();
    }
    for (k = 0; k < 64; k++) {   // the dust
      var sp = 0.006 + hash(k + 31) * 0.014, y = (((hash(k + 97) - t * sp) % 1) + 1) % 1;
      var x = hash(k) * W + Math.sin(t * 0.35 + k) * W * 0.012, big = k % 9 === 0;
      var a = (0.07 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.3 + k * 2.1))) * Math.min(1, y * 4, (1 - y) * 4) * (big ? 0.45 : 1);
      c.fillStyle = "rgba(246,218,196," + a.toFixed(3) + ")";
      c.beginPath(); c.arc(x, y * H, (big ? 2.6 + hash(k + 53) * 2.4 : 0.6 + hash(k + 53) * 1.5) * u, 0, 6.2832); c.fill();
    }
    if (!solid) {   // a vignette; a solid scene's lens does its own
      g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.5)");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
  };
  var stage = function (t) {
    if (!shotEls.length) init();
    if (window.M) window.M.t = t;
    ambient(t);
    var i = 0, k;
    for (k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].at) i = k;
    var at = SHOTS[i] ? SHOTS[i].at : 0, lt = t - at;
    shotEls.forEach(function (el, k) {
      if (k === i) { var p = E.out(seg(lt, 0, 0.5)); el.style.visibility = "visible"; set(el, { y: 24 * (1 - p), o: Math.min(1, p * 2) }); }
      else if (k === i - 1 && lt < 0.35) { var q = E.in(seg(lt, 0, 0.35)); el.style.visibility = "visible"; set(el, { y: -16 * q, o: 1 - q }); }
      else { el.style.visibility = "hidden"; set(el, { o: 0 }); }
    });
    var endAt = window.SCENE && window.SCENE.endAt, ec = endAt ? $("#endc") : null, eq = ec ? seg(t, endAt, endAt + 0.7) : 0;
    if (capEl) {
      capEl.textContent = (SHOTS[i] && SHOTS[i].cap) || "";
      var c = E.out(seg(lt, 0.1, 0.5)) * (1 - eq);
      set(capWrap, { y: 12 * (1 - c), o: c });
    }
    // a free lesson's closing card: the frame softens behind it, then the lines rise in one by one
    if (ec) {
      ec.style.visibility = eq > 0 ? "visible" : "hidden"; ec.style.opacity = E.out(eq);
      $$("#endc [data-i]").forEach(function (el, n) {
        var p = E.out(seg(t, endAt + 0.3 + n * 0.16, endAt + 0.95 + n * 0.16));
        if (el.classList.contains("ec-line")) { el.style.opacity = p; el.style.transform = "scaleX(" + p + ")"; return; }
        set(el, { y: 20 * (1 - p), o: p }); soft(el, (1 - p) * 0.8);
      });
    }
    return { i: i, lt: lt, at: at };
  };
  return { clamp: clamp, seg: seg, E: E, tw: tw, $: $, $$: $$, set: set, enter: enter, leave: leave, soft: soft, type: type, count: count, lerpColor: lerpColor, stage: stage, t: 0 };
})();

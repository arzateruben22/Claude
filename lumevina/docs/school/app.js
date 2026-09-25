/* Lumevina Skin School — the page and the course.
 *
 *   levels     three cards; each opens a panel that grows out of the card,
 *              with the level's animation, its modules and lessons
 *   quiz       five questions → skin type, first step, where to start
 *   inside     a live lesson (Sunscreen) cycling Watch · Learn · Try · Check
 *   tiers      The Course / + Kit / + Evelyn, and Skin Basics alone
 *   checkout   the site's payment engine (test card), members get Skin
 *              Basics free and 25% off; every sale goes to the books
 *   player     every lesson: notes, a try-this, a quick check with petals,
 *              progress, a party when a level is done, a certificate at 33
 *
 * DEMO: progress and purchases live in this browser (lumevina_school).
 * Sales go to lumevina_course_sales, which the owner dashboard reads.
 * LIVE: Stripe Checkout per tier, lessons and video behind the login
 * (server/README.md, Skin School). */
(function () {
  "use strict";
  var S = window.SCHOOL, pay = window.LumevinaPayments;
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm || !("IntersectionObserver" in window)) document.documentElement.classList.add("no-motion");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var money = function (n) { return "$" + (Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n))); };
  var EASE = "cubic-bezier(.2,.8,.2,1)";
  var ARIA = {
    barrier: "Animation: a wall of skin cells with gaps lets water out and sun in. A gentle cleanser, a ceramide moisturizer and SPF fill the gaps and turn the sun away, and barrier strength climbs from 40% to 96%.",
    week: "Animation: eight weeks of nights fill in. Retinoid nights grow from two a week to six, with a weekly exfoliation night and recovery nights, while irritation stays low.",
    progress: "Animation: over twelve weeks, breakouts calm, dark marks fade and the skin starts to glow as milestones light up."
  };

  /* ── the lessons, in order ── */
  var ALL = [], BY = {};
  S.levels.forEach(function (lv) {
    lv.modules.forEach(function (md) {
      md.lessons.forEach(function (ls) {
        var row = { ls: ls, lv: lv, md: md, i: ALL.length };
        ALL.push(row); BY[ls.id] = row;
      });
    });
  });
  var levelLessons = function (lv) { return ALL.filter(function (r) { return r.lv === lv; }); };
  var minsOf = function (rows) { return rows.reduce(function (s, r) { return s + r.ls.min; }, 0); };
  var hrs = function (m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + " hr" + (r ? " " + r + " min" : "") : r + " min"; };

  /* ── what this browser has ── */
  var KEY = "lumevina_school", SALES = "lumevina_course_sales";
  var st = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  st.done = st.done || {};
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode */ } };
  var owns = function (row) {
    if (row.ls.free) return true;
    if (!st.tier) return false;
    return st.tier === "basics" ? row.lv.n === 1 : true;
  };
  var doneCount = function () { return ALL.filter(function (r) { return st.done[r.ls.id]; }).length; };
  var pct = function () { return doneCount() / ALL.length; };

  /* ── little things: toast, petals, count-up ── */
  var toastEl = $("#toast"), toastT = 0;
  var toast = function (msg) {
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  };
  var PETAL = '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7h2C14 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z"/>';
  var petals = function (from, n) {
    if (rm || !from) return;
    var r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < (n || 16); i++) {
      var p = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      p.setAttribute("viewBox", "0 0 24 24"); p.setAttribute("class", "petal"); p.setAttribute("aria-hidden", "true");
      p.innerHTML = PETAL;
      var a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 140;
      p.style.left = (cx - 7) + "px"; p.style.top = (cy - 7) + "px";
      p.style.setProperty("--dx", Math.cos(a) * d + "px");
      p.style.setProperty("--dy", (Math.sin(a) * d - 60) + "px");
      p.style.setProperty("--r", (Math.random() * 120 - 60) + "deg");
      document.body.appendChild(p);
      setTimeout(function (el) { return function () { el.remove(); }; }(p), 1400);
    }
  };
  var countUp = function (el) {
    var target = Number(el.getAttribute("data-count")), suf = el.getAttribute("data-suf") || "";
    if (rm) { el.textContent = target + suf; return; }
    var t0 = performance.now(), dur = 1400;
    var tick = function (now) {
      var u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      el.textContent = Math.round(target * e) + suf;
      if (u < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ── the level cards ── */
  var PLUS = '<span class="plus" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>';
  $("#levels-grid").innerHTML = S.levels.map(function (lv, i) {
    var rows = levelLessons(lv);
    return '<button type="button" class="level reveal" data-level="' + i + '" aria-haspopup="dialog" aria-label="Open Level ' + lv.n + ': ' + esc(lv.name) + '">' +
      '<div class="n grad">' + lv.n + '</div><h3>' + esc(lv.name) + '</h3>' +
      '<p class="when">' + lv.tag + ' · ' + rows.length + ' lessons · ' + hrs(minsOf(rows)) + '</p>' +
      '<p class="b">' + esc(lv.blurb) + '</p>' + PLUS + '</button>';
  }).join("");

  /* ── the whole curriculum ── */
  var totalMin = minsOf(ALL);
  $("#totals").innerHTML =
    '<div class="tot"><div class="v num" data-count="' + ALL.length + '">0</div><div class="k">short lessons</div></div>' +
    '<div class="tot"><div class="v num" data-count="' + Math.floor(totalMin / 60) + '" data-suf="+">0</div><div class="k">hours of video</div></div>' +
    '<div class="tot"><div class="v num" data-count="' + S.levels.length + '">0</div><div class="k">levels, Beginner to Advanced</div></div>';
  var paintCur = function () {
    $("#cur").innerHTML = S.levels.map(function (lv) {
      var rows = levelLessons(lv);
      return '<div class="cur-l"><h3>Level ' + lv.n + ' · ' + esc(lv.name) + '</h3><p class="t">' + lv.tag + ' · ' + hrs(minsOf(rows)) + '</p>' +
        lv.modules.map(function (md) {
          return '<div class="cur-m"><b>' + esc(md.name) + '</b>' + md.lessons.map(function (ls) {
            var d = st.done[ls.id];
            return '<button type="button" class="cur-row" data-open-lesson="' + ls.id + '"><span class="ct">' + esc(ls.t) + '</span>' +
              '<span class="cm">' + (ls.free ? '<span class="free">Free</span>' : "") + (d ? '<span class="ok" aria-label="done">&#10003;</span>' : "") + ls.min + ' min</span></button>';
          }).join("") + '</div>';
        }).join("") + '</div>';
    }).join("");
  };
  paintCur();

  /* ── reveal on scroll ── */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
      e.target.querySelectorAll("[data-count]").forEach(countUp);
    });
  }, { threshold: 0.18 }) : null;
  var watch = function () { $$(".reveal:not(.in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); }); };
  watch();
  if (rm) $$("[data-count]").forEach(countUp);

  /* ── a level, opened from its card: the panel grows out of it ── */
  (function () {
    var ov = $(".lv-ov"), panel = $(".ov-panel", ov), backdrop = $(".ov-backdrop", ov), body = $("#lv-body");
    var closeBtn = $(".lv-x", ov), prev = $(".lv-prev", ov), next = $(".lv-next", ov), dots = $$(".dots i", ov);
    var cards = $$(".level[data-level]");
    var canAnimate = !!panel.animate && !rm;
    var cur = 0, busy = false;
    body.innerHTML = S.levels.map(function (lv, i) {
      var rows = levelLessons(lv);
      return '<article class="lv-step" hidden><div class="lv-grid">' +
        '<div class="lv-head"><p class="kicker">Level ' + lv.n + ' · ' + lv.tag + ' · ' + rows.length + ' lessons</p>' +
        '<h2 class="lv-h" id="lv-title-' + (i + 1) + '">' + esc(lv.h) + ' <span class="dim">' + esc(lv.dim) + '</span></h2></div>' +
        '<div class="art"><svg class="scene" data-scene="' + lv.art + '" viewBox="0 0 520 ' + (lv.art === "week" ? 400 : lv.art === "barrier" ? 392 : 370) + '" role="img" aria-label="' + esc(ARIA[lv.art]) + '"></svg></div>' +
        '<div class="mods">' + lv.modules.map(function (md) {
          return '<div class="mod"><b>' + esc(md.name) + '</b><ol>' + md.lessons.map(function (ls) {
            return '<li>' + esc(ls.t) + '<span>' + (ls.free ? "Free · " : "") + ls.min + ' min</span></li>';
          }).join("") + '</ol></div>';
        }).join("") + '<p class="lv-out">' + esc(lv.outcome) + '</p>' +
        '<button type="button" class="btn btn-grad lv-go" data-open-lesson="' + rows[0].ls.id + '">Start Level ' + lv.n + '</button></div>' +
        '</div></article>';
    }).join("");
    var steps = $$(".lv-step", body);
    $$("svg[data-scene]", body).forEach(function (svg) { window.SchoolScenes.start(svg); });
    var NAMES = S.levels.map(function (lv) { return "Level " + lv.n + " · " + lv.name; });
    var show = function (n) {
      steps.forEach(function (s, i) { s.hidden = i !== n; });
      dots.forEach(function (d, i) { d.className = i === n ? "on" : ""; });
      cur = n;
      prev.classList.toggle("gone", n === 0); next.classList.toggle("gone", n === steps.length - 1);
      $(".lbl", prev).textContent = n > 0 ? NAMES[n - 1] : "";
      $(".lbl", next).textContent = n < steps.length - 1 ? NAMES[n + 1] : "";
      panel.setAttribute("aria-labelledby", "lv-title-" + (n + 1));
      body.scrollTop = 0;
    };
    var insetFrom = function (card) {
      var c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
      var px = function (v) { return Math.max(0, Math.round(v)) + "px"; };
      return "inset(" + px(c.top - p.top) + " " + px(p.right - c.right) + " " + px(p.bottom - c.bottom) + " " + px(c.left - p.left) + " round 22px)";
    };
    var FULL = "inset(0px 0px 0px 0px round 28px)";
    var open = function (n) {
      if (busy) return;
      var card = cards[n];
      show(n);
      ov.hidden = false;
      document.documentElement.classList.add("lock");
      card.classList.add("is-origin");
      if (canAnimate) {
        busy = true;
        var a = panel.animate([{ clipPath: insetFrom(card) }, { clipPath: FULL }], { duration: 640, easing: EASE });
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease" });
        body.animate([{ opacity: 0, transform: "translateY(22px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 200, easing: EASE, fill: "backwards" });
        closeBtn.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 360, easing: EASE, fill: "backwards" });
        a.onfinish = function () { busy = false; };
      }
      closeBtn.focus({ preventScroll: true });
    };
    var close = function (then) {
      if (busy || ov.hidden) return;
      var card = cards[cur];
      var done = function () {
        ov.hidden = true;
        document.documentElement.classList.remove("lock");
        cards.forEach(function (c) { c.classList.remove("is-origin"); });
        busy = false;
        if (typeof then === "function") then(); else card.focus({ preventScroll: true });
      };
      if (!canAnimate || typeof then === "function") { done(); return; }
      busy = true;
      body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease", fill: "forwards" });
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "ease", fill: "forwards" });
      var a = panel.animate([{ clipPath: FULL }, { clipPath: insetFrom(card) }], { duration: 520, easing: EASE, fill: "forwards" });
      a.onfinish = function () {
        done();
        [panel, body, backdrop].forEach(function (x) { x.getAnimations().forEach(function (y) { y.cancel(); }); });
      };
    };
    var go = function (n) {
      if (busy || n < 0 || n >= steps.length || n === cur) return;
      var dir = n > cur ? 1 : -1;
      cards.forEach(function (c) { c.classList.remove("is-origin"); });
      cards[n].classList.add("is-origin");
      if (!canAnimate) { show(n); return; }
      busy = true;
      var out = body.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-40 * dir) + "px)" }], { duration: 200, easing: "ease-in", fill: "forwards" });
      out.onfinish = function () {
        show(n); out.cancel();
        var inn = body.animate([{ opacity: 0, transform: "translateX(" + (40 * dir) + "px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: EASE });
        inn.onfinish = function () { busy = false; };
      };
    };
    cards.forEach(function (c, i) { c.addEventListener("click", function () { open(i); }); });
    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });
    document.addEventListener("keydown", function (e) {
      if (ov.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight") go(cur + 1);
      else if (e.key === "ArrowLeft") go(cur - 1);
    });
    window.SchoolLevels = { close: close, isOpen: function () { return !ov.hidden; } };
  })();

  /* ── the skin quiz ── */
  (function () {
    var box = $("#quiz-card");
    var Q = [
      { q: "An hour after washing, with nothing on, your skin feels…", o: [["Tight, or a little flaky", { dry: 2 }], ["Comfortable, nothing special", { normal: 2 }],
        ["Shiny on the forehead and nose only", { combo: 2 }], ["Shiny almost everywhere", { oily: 2 }]] },
      { q: "By midday, your forehead and nose look…", o: [["Matte, maybe a bit dry", { dry: 1, normal: 0.5 }], ["A little shiny", { normal: 1, combo: 0.5 }], ["Very shiny", { oily: 1, combo: 1 }]] },
      { q: "Up close, your pores look…", o: [["Barely visible", { dry: 1, normal: 0.5 }], ["Visible on my nose", { combo: 1, normal: 0.5 }], ["Visible on my nose, forehead and cheeks", { oily: 1 }]] },
      { q: "When you try a new product, your skin usually…", o: [["Stings, burns or turns red", { sens: 1 }], ["Breaks out", { acne: 1 }], ["Is totally fine", {}]] },
      { q: "What bugs you most right now?", o: [["Breakouts", { c: "acne" }], ["Dark spots or uneven tone", { c: "pigment" }], ["Fine lines or firmness", { c: "aging" }],
        ["Dryness or redness", { c: "calm" }], ["Nothing, I just want a good routine", { c: "none" }]] }
    ];
    var TYPES = {
      dry: ["Dry", "Your skin makes little oil, so it needs help holding on to water. Gentle cleansing and a rich moisturizer do most of the work.", "A cream cleanser and a moisturizer with ceramides, morning and night."],
      normal: ["Normal", "Balanced skin: not much oil, not much dryness. Your job is to protect it and add actives only for what you want to change.", "A gentle cleanser, a light lotion and SPF 30 every single morning."],
      combo: ["Combination", "An oily T-zone with drier cheeks. The trick is treating the zones a little differently, not picking one side.", "A gel cleanser, a light lotion everywhere and a richer layer on the cheeks."],
      oily: ["Oily", "Your skin makes plenty of oil, which also means it ages slowly. Don't strip it: stripped skin makes even more oil.", "A gel cleanser, an oil-free moisturizer and a BHA twice a week."]
    };
    var START = { acne: ["Level 1, then Acne", "Level 3"], pigment: ["Level 1, then Dark spots", "Level 3"], aging: ["Level 1, then Aging well", "Level 3"],
      calm: ["Level 1, then Sensitive skin", "Level 3"], none: ["Level 1, then Actives", "Level 2"] };
    var WATCH = { acne: "Pore-clogging ingredients like coconut oil and isopropyl myristate. Lesson 8-2 has the list.",
      pigment: "Skipping sunscreen. One sunny afternoon can undo a month of fading.",
      aging: "Starting a retinoid too fast. Two nights a week first, then build.",
      calm: "Scrubs, strong acids and fragrance. Fewer products, not better ones.",
      none: "Adding too much at once. One new product every two weeks." };
    var k = 0, picks = [];
    var result = function () {
      var sc = { dry: 0, normal: 0, combo: 0, oily: 0, sens: 0, acne: 0 }, c = "none";
      picks.forEach(function (p, i) { var w = Q[i].o[p][1]; for (var key in w) { if (key === "c") c = w.c; else sc[key] += w[key]; } });
      var type = ["combo", "oily", "dry", "normal"].reduce(function (b, t) { return sc[t] > sc[b] ? t : b; }, "combo");
      return { type: type, sens: sc.sens > 0, acne: sc.acne > 0 || c === "acne", c: c };
    };
    var paint = function (dir) {
      if (k >= Q.length) {
        var r = result(), T = TYPES[r.type];
        st.quiz = r; save();
        box.innerHTML = '<div class="qz-res"><p class="kicker">Your skin</p><div class="qz-type grad">' + T[0] + '</div>' +
          '<div class="qz-tags">' + (r.sens ? '<span class="tag">Sensitive</span>' : "") + (r.acne ? '<span class="tag">Acne-prone</span>' : "") +
          '<span class="tag">Focus: ' + { acne: "breakouts", pigment: "even tone", aging: "aging well", calm: "calm skin", none: "a great routine" }[r.c] + '</span></div>' +
          '<p class="qz-desc">' + T[1] + '</p>' +
          '<div class="qz-plan"><div><b>Your first step</b><span>' + T[2] + '</span></div><div><b>Start here</b><span>' + START[r.c][0] + ' (' + START[r.c][1] + ')</span></div>' +
          '<div><b>Watch out for</b><span>' + WATCH[r.c] + '</span></div></div>' +
          '<div class="qz-acts"><button type="button" class="btn btn-grad" data-open-lesson="1-2">Take the free lesson on skin types</button>' +
          '<button type="button" class="btn btn-ghost" id="qz-again">Take it again</button></div></div>';
        petals($(".qz-type", box), 20);
        $("#qz-again").addEventListener("click", function () { k = 0; picks = []; paint(); });
        return;
      }
      var q = Q[k];
      box.innerHTML = '<div class="qz-top"><span class="qz-count">Question ' + (k + 1) + ' of ' + Q.length + '</span><span class="qz-bar"><i style="width:' + (k / Q.length * 100) + '%"></i></span></div>' +
        '<div class="qz-stage"' + (dir < 0 ? ' style="animation-name:none"' : "") + '><p class="qz-q">' + q.q + '</p><div class="qz-opts">' +
        q.o.map(function (o, i) {
          return '<button type="button" class="qz-opt' + (picks[k] === i ? " picked" : "") + '" data-o="' + i + '"><span class="k">' + "ABCDE"[i] + '</span>' + o[0] + '</button>';
        }).join("") + '</div>' + (k ? '<button type="button" class="qz-back">&larr; Back</button>' : "") + '</div>';
      requestAnimationFrame(function () { var bar = $(".qz-bar i", box); if (bar) bar.style.width = ((k + (picks[k] != null ? 1 : 0)) / Q.length * 100) + "%"; });
    };
    box.addEventListener("click", function (e) {
      var o = e.target.closest(".qz-opt"), back = e.target.closest(".qz-back");
      if (back) { k--; paint(-1); return; }
      if (!o) return;
      picks[k] = +o.getAttribute("data-o");
      o.classList.add("picked");
      $(".qz-bar i", box).style.width = ((k + 1) / Q.length * 100) + "%";
      setTimeout(function () { k++; paint(1); }, rm ? 0 : 280);
    });
    paint();
  })();

  /* ── lesson parts, shared by the preview and the player ── */
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var videoHtml = function (ls) {
    return '<div class="ls-video"><button type="button" class="ls-play" aria-label="Play the video">' + PLAY + '</button>' +
      '<div class="ls-vcap"><span>Video · Evelyn</span><span>' + ls.min + ' min</span></div></div>';
  };
  var learnHtml = function (ls, stagger) {
    return '<ul class="ls-learn' + (stagger ? " stagger" : "") + '">' + ls.learn.map(function (x, i) { return '<li style="--i:' + i + '">' + esc(x) + '</li>'; }).join("") + '</ul>';
  };
  var SPARK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg>';
  var tryHtml = function (ls) { return '<div class="ls-try"><b>' + SPARK + 'Try this at home</b><p>' + esc(ls.try) + '</p></div>'; };
  var checkHtml = function (ls) {
    return '<div class="ls-check" data-check="' + ls.id + '"><span class="lbl">Quick check</span><p class="qq">' + esc(ls.q.ask) + '</p><div class="ck-opts">' +
      ls.q.opts.map(function (o, i) { return '<button type="button" class="ck-opt" data-i="' + i + '">' + esc(o) + '</button>'; }).join("") +
      '</div><p class="ck-why" hidden></p></div>';
  };
  /* one handler for every quick check on the page or in the player */
  var onRight = null;
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".ck-opt");
    if (b && !b.disabled) {
      var box = b.closest("[data-check]"), row = BY[box.getAttribute("data-check")], i = +b.getAttribute("data-i"), why = $(".ck-why", box);
      if (i === row.ls.q.a) {
        $$(".ck-opt", box).forEach(function (x) { x.disabled = true; });
        b.classList.add("yes");
        why.hidden = false; why.className = "ck-why"; why.innerHTML = "<b>That&rsquo;s it.</b> " + esc(row.ls.q.why);
        petals(b, 14);
        if (onRight) onRight(row, box);
      } else {
        b.classList.remove("no"); void b.offsetWidth; b.classList.add("no"); b.disabled = true;
        why.hidden = false; why.className = "ck-why nope"; why.innerHTML = "<b>Not quite.</b> Try another one.";
      }
      return;
    }
    var p = e.target.closest(".ls-play");
    if (p) {
      var v = p.closest(".ls-video"), old = $(".ls-vnote", v);
      if (old) old.remove();
      var n = document.createElement("p");
      n.className = "ls-vnote"; n.textContent = "Evelyn records this video next. The lesson notes are right below.";
      v.appendChild(n);
      setTimeout(function () { n.remove(); }, 3200);
    }
  });

  /* ── inside a lesson: Sunscreen, part by part ── */
  (function () {
    var card = $("#demo-card"), parts = $$(".part"), row = BY["2-3"], ls = row.ls, auto = true, k = 0, timer = 0;
    var PANES = {
      watch: function () { return videoHtml(ls); },
      learn: function () { return learnHtml(ls, true); },
      try: function () { return tryHtml(ls); },
      check: function () { return checkHtml(ls); }
    };
    var show = function (i) {
      k = i;
      parts.forEach(function (p, j) { p.classList.toggle("on", j === i); p.classList.toggle("auto", j === i && auto); });
      var name = parts[i].getAttribute("data-part");
      card.innerHTML = '<p class="kicker">Level 1 · The core routine · Lesson ' + (row.i + 1) + '</p><h3 class="demo-h">' + esc(ls.t) + '</h3>' +
        '<div class="demo-pane">' + PANES[name]() + '</div>';
      clearTimeout(timer);
      if (auto) timer = setTimeout(function () { if (auto) show((k + 1) % parts.length); }, 4200);
    };
    parts.forEach(function (p, i) { p.addEventListener("click", function () { auto = false; show(i); }); });
    card.addEventListener("click", function () { auto = false; parts.forEach(function (p) { p.classList.remove("auto"); }); clearTimeout(timer); });
    var started = false;
    if ("IntersectionObserver" in window && !rm) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting && !started) { started = true; show(0); }
        else if (!es[0].isIntersecting && auto) { clearTimeout(timer); started = false; }
      }, { threshold: 0.4 }).observe(card);
      show(0); clearTimeout(timer);
    } else { auto = false; show(0); }
  })();

  /* ── tiers ── */
  $("#tier-grid").innerHTML = S.tiers.map(function (t) {
    return '<div class="tier reveal' + (t.hl ? " hl" : "") + '"><span class="t-tag">' + esc(t.tag) + '</span><h3 class="t-name">' + esc(t.name) + '</h3>' +
      '<div class="t-price">' + money(t.price) + '<small>once</small></div><p class="t-line">' + esc(t.line) + '</p>' +
      (t.id === "kit" ? '<div class="kit-row" aria-hidden="true"><i data-l="CLEANSER"></i><i data-l="SPF 30"></i><i data-l="LEVEL 1-3"></i></div>' : "") +
      (t.id === "evelyn" ? '<div class="call-row" aria-hidden="true"><span class="av">E</span><span class="cl"><b>Video call with Evelyn</b><span>45 min, then a 15-min check-in</span></span><span class="live"><i></i>Live</span></div>' : "") +
      '<ul class="t-list">' + t.has.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join("") + '</ul>' +
      '<button type="button" class="btn ' + (t.hl ? "btn-grad" : "btn-dark") + '" data-buy="' + t.id + '">Choose ' + esc(t.name) + '</button></div>';
  }).join("");
  $("#starter").innerHTML = '<p><b>Just starting?</b> ' + esc(S.starter.name) + ' (Level 1) on its own is ' + money(S.starter.price) + '. ' +
    esc(S.starter.line.replace(/^Just Level 1\. /, "")) + '</p><button type="button" class="btn btn-ghost" data-buy="basics">Start with ' + esc(S.starter.name) + '</button>';
  watch();

  /* ── checkout ── */
  (function () {
    var ov = $(".co-ov"), form = $("#co-form"), done = $("#co-done"), status = $("#co-status");
    var tier = null, ship = "ship";
    var TIER = {}; S.tiers.forEach(function (t) { TIER[t.id] = t; });
    TIER.basics = { id: "basics", name: S.starter.name, price: S.starter.price, line: "Level 1 · 9 lessons" };
    var norm = function (e) { return String(e || "").trim().toLowerCase(); };
    var isMember = function (email) {
      try {
        var r = (JSON.parse(localStorage.getItem("lumevina_memberships")) || {})[norm(email)];
        return !!r && (r.status === "active" || r.status === "cancelling");
      } catch (e) { return false; }
    };
    var credit = function () { return st.tier === "basics" ? S.starter.price : 0; };    /* Skin Basics counts toward an upgrade */
    var priceNow = function () {
      var member = isMember($("#co-email").value);
      var base = tier.price;
      if (member) base = tier.id === "basics" ? 0 : Math.round(base * 0.75);
      return { member: member, base: tier.price, due: Math.max(0, base - (tier.id !== "basics" ? credit() : 0)) };
    };
    var paintSum = function () {
      var p = priceNow(), kit = tier.id === "kit" || tier.id === "evelyn";
      $("#co-h").textContent = tier.name;
      $("#co-line").textContent = (p.member ? (tier.id === "basics" ? "Included with your membership" : "Member price, 25% off") :
        credit() && tier.id !== "basics" ? "Your $49 Skin Basics counts toward it" : (tier.line || tier.tag || ""));
      $("#co-total").innerHTML = (p.due !== p.base ? "<s>" + money(p.base) + "</s>" : "") + money(p.due);
      $("#co-kit").hidden = !kit;
      $("#co-addr-f").hidden = !kit || ship !== "ship";
      var free = p.due === 0;
      $$(".fld-row, .co-test", form).forEach(function (el) { el.hidden = free; });
      $("#co-pay").textContent = free ? "Start " + tier.name : "Pay " + money(p.due);
    };
    var open = function (id) {
      tier = TIER[id];
      if (!tier) return;
      if (st.tier && (st.tier === id || (st.tier !== "basics" && id === "basics"))) { toast("You already have this. Opening your course."); player.open(); return; }
      form.hidden = false; done.hidden = true; status.textContent = "";
      var acct = null; try { acct = JSON.parse(localStorage.getItem("lumevina_account")); } catch (e) { /* none */ }
      if (!$("#co-name").value) $("#co-name").value = st.name || (acct && acct.name) || "";
      if (!$("#co-email").value) $("#co-email").value = st.email || (acct && acct.email) || "";
      if (st.quiz && !$("#co-skin").value) {
        $("#co-skin").value = st.quiz.acne ? "Acne-prone" : st.quiz.sens ? "Sensitive" : { dry: "Dry", normal: "Normal", combo: "Combination", oily: "Oily" }[st.quiz.type];
      }
      paintSum();
      ov.hidden = false;
      document.documentElement.classList.add("lock");
      if (!rm && ov.animate) {
        $(".co-panel", ov).animate([{ opacity: 0, transform: "translateY(24px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: EASE });
        $(".ov-backdrop", ov).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      }
      setTimeout(function () { ($("#co-name").value ? $("#co-email").value ? $("#co-card") : $("#co-email") : $("#co-name")).focus({ preventScroll: true }); }, 50);
    };
    var close = function () {
      ov.hidden = true;
      if (!$(".pl-ov").hidden) return;
      document.documentElement.classList.remove("lock");
    };
    pay.bindCardFields($("#co-card"), $("#co-exp"), $("#co-cvc"));
    $("#co-email").addEventListener("input", paintSum);
    $$("[data-ship]", ov).forEach(function (b) {
      b.addEventListener("click", function () {
        ship = b.getAttribute("data-ship");
        $$("[data-ship]", ov).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        paintSum();
      });
    });
    $(".co-x", ov).addEventListener("click", close);
    $(".ov-backdrop", ov).addEventListener("click", close);
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    document.addEventListener("click", function (e) { var b = e.target.closest("[data-buy]"); if (b) open(b.getAttribute("data-buy")); });

    $("#co-pay").addEventListener("click", function () {
      var name = $("#co-name").value.trim(), email = $("#co-email").value.trim(), p = priceNow(), kit = tier.id === "kit" || tier.id === "evelyn";
      var problems = [];
      if (!name) problems.push("your name");
      if (!email || !$("#co-email").checkValidity()) problems.push("a valid email");
      if (kit && !$("#co-skin").value) problems.push("your skin type for the kit");
      if (kit && ship === "ship" && $("#co-addr").value.trim().length < 6) problems.push("a shipping address");
      if (p.due > 0) {
        if (!pay.cardValid($("#co-card").value)) problems.push("a valid card number");
        if (!pay.expiryValid($("#co-exp").value)) problems.push("a future expiry (MM/YY)");
        if (!pay.cvcValid($("#co-cvc").value)) problems.push("a 3–4 digit CVC");
      }
      if (problems.length) { status.textContent = "Please add " + problems.join(", ") + "."; return; }
      var btn = $("#co-pay"); btn.disabled = true; status.textContent = "";
      var finish = function (order) {
        btn.disabled = false;
        var now = new Date().toISOString();
        st.tier = tier.id; st.name = name; st.email = email; st.at = now; st.order = order;
        if (kit) st.kit = { skin: $("#co-skin").value, ship: ship };
        save();
        /* the books: what was paid, and what the kit cost (product + shipping, or the bag) */
        var log; try { log = JSON.parse(localStorage.getItem(SALES)) || []; } catch (e) { log = []; }
        log.push({ id: "skin-school-" + tier.id, name: "Skin School · " + tier.name, tier: tier.id, price: tier.price, paid: p.due,
          cost: kit ? 32 + (ship === "ship" ? 10 : 1) : 0, member: p.member, who: name, email: email, at: now, order: order,
          consult: tier.id === "evelyn" ? "to book" : null });
        try { localStorage.setItem(SALES, JSON.stringify(log)); } catch (e) { /* private mode */ }
        form.hidden = true; done.hidden = false;
        var first = name.split(" ")[0];
        done.innerHTML = '<p class="kicker">You&rsquo;re in</p><p class="big">Welcome to Skin School, <span class="grad">' + esc(first) + '.</span></p>' +
          '<p>' + (tier.id === "basics" ? "Level 1 is open: nine lessons, about an hour and a half." : "All three levels are open: 33 lessons.") +
          (kit ? " Your kit " + (ship === "ship" ? "ships this week, free." : "will be waiting at the front at your next visit.") : "") +
          (order ? " Order " + esc(order) + "." : "") + '</p>' +
          (tier.id === "evelyn" ? '<p><b>Pick a time for your call with Evelyn:</b></p><div class="slots" id="slots">' +
            ["Tue 6:30 PM", "Wed 7:00 PM", "Thu 6:30 PM", "Sat 9:00 AM"].map(function (s) { return '<button type="button" aria-pressed="false">' + s + '</button>'; }).join("") + '</div>' : "") +
          '<div class="qz-acts"><button type="button" class="btn btn-grad" id="co-start">Start Lesson 1</button></div>';
        petals($(".big", done), 22);
        var sl = $("#slots");
        if (sl) sl.addEventListener("click", function (e) {
          var b = e.target.closest("button"); if (!b) return;
          $$("button", sl).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          st.consult = b.textContent; save();
          try { var lg = JSON.parse(localStorage.getItem(SALES)) || []; if (lg.length) { lg[lg.length - 1].consult = b.textContent; localStorage.setItem(SALES, JSON.stringify(lg)); } } catch (err) { /* private mode */ }
          toast("Booked: " + b.textContent + ". Evelyn will send the video link by email.");
        });
        $("#co-start").addEventListener("click", function () { close(); player.open(firstOpen()); });
        paintAll();
      };
      if (p.due === 0) { finish(null); return; }
      pay.process({ amount: p.due, description: "Skin School — " + tier.name }, function (err, res) {
        if (err) { btn.disabled = false; status.textContent = "The payment didn't go through. Please try again."; return; }
        finish(res.id);
      });
    });
  })();

  /* ── routine builder (the last lesson) ── */
  var builderHtml = function () {
    var q = st.quiz || {}, b = st.plan || { type: q.type || "normal", c: q.c || "none", sens: !!q.sens, preg: false };
    var chip = function (key, val, label) { return '<button type="button" data-k="' + key + '" data-v="' + val + '" aria-pressed="' + (String(b[key]) === String(val)) + '">' + label + '</button>'; };
    return '<div class="builder" id="builder"><div class="bd-row"><span>Your skin</span><div class="chips">' +
      chip("type", "dry", "Dry") + chip("type", "normal", "Normal") + chip("type", "combo", "Combination") + chip("type", "oily", "Oily") + '</div></div>' +
      '<div class="bd-row"><span>Your main concern</span><div class="chips">' + chip("c", "acne", "Breakouts") + chip("c", "pigment", "Dark spots") +
      chip("c", "aging", "Aging") + chip("c", "calm", "Redness") + chip("c", "none", "Just a routine") + '</div></div>' +
      '<div class="bd-row"><span>Anything else</span><div class="chips">' + chip("sens", "true", "Sensitive skin") + chip("preg", "true", "Pregnant or breastfeeding") + '</div></div>' +
      '<div class="bd-out" id="bd-out"></div><p class="bd-note" id="bd-note"></p>' +
      '<div class="bd-acts"><button type="button" class="btn btn-dark" id="bd-copy">Copy my routine</button></div></div>';
  };
  var routine = function (b) {
    var sens = b.sens === true || b.sens === "true", preg = b.preg === true || b.preg === "true", c = b.c, t = b.type;
    var moist = { dry: "Rich cream with ceramides", oily: "Oil-free gel moisturizer", combo: "Light lotion, a little extra on the cheeks", normal: "Light lotion" }[t] +
      (c === "acne" ? " (non-clogging)" : "");
    var am = [
      sens || t === "dry" ? "Rinse with water, or a cream cleanser" : t === "normal" ? "Gentle cleanser" : "Gel cleanser",
      c === "pigment" || c === "aging" ? (sens ? "Niacinamide serum" : "Vitamin C serum") : c === "acne" || c === "calm" ? "Niacinamide serum" : "Vitamin C serum (optional)",
      moist,
      (c === "pigment" || preg || sens ? "Tinted mineral SPF 30+" : "Broad spectrum SPF 30+") + ", reapplied outdoors"
    ];
    var treat = {
      acne: preg ? "Azelaic acid" : "Benzoyl peroxide wash or mandelic serum, and adapalene 0.1% on 2–3 nights, building up",
      pigment: preg ? "Azelaic acid" : "Azelaic acid most nights, a retinoid on 2–3 nights, building up",
      aging: preg ? "Peptide serum (retinoids wait until after)" : "Retinoid on 2–3 nights, adding a night every two weeks",
      calm: "Azelaic acid or niacinamide. No scrubs or strong acids",
      none: preg ? "Hyaluronic acid serum on damp skin" : "Retinol on 2 nights a week, if you'd like to start"
    }[c];
    var exf = sens || c === "calm" ? "PHA once a week, only when skin is calm" :
      preg ? "Gentle lactic acid on 1 night" : t === "oily" || c === "acne" ? "Salicylic acid (BHA) on 1–2 other nights" : "Lactic or glycolic acid on 1–2 other nights";
    var pm = ["Double cleanse: a balm, then your cleanser", treat, exf, t === "dry" ? "Rich cream, a little more than the morning" : moist];
    return { am: am, pm: pm, note: (preg ? "Pregnant or breastfeeding: check every product with your doctor. " : "") +
      "One new product every two weeks. Bring this to your next visit and Evelyn will fine-tune it." };
  };
  var wireBuilder = function (root) {
    var box = $("#builder", root);
    if (!box) return;
    var b = st.plan || { type: (st.quiz && st.quiz.type) || "normal", c: (st.quiz && st.quiz.c) || "none", sens: !!(st.quiz && st.quiz.sens), preg: false };
    var paint = function () {
      var r = routine(b);
      $("#bd-out", box).innerHTML = '<div class="bd-col"><b>Morning</b><ol>' + r.am.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ol></div>' +
        '<div class="bd-col"><b>Night</b><ol>' + r.pm.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ol></div>';
      $("#bd-note", box).textContent = r.note;
      $$(".chips button", box).forEach(function (x) { x.setAttribute("aria-pressed", String(String(b[x.getAttribute("data-k")]) === x.getAttribute("data-v"))); });
    };
    box.addEventListener("click", function (e) {
      var x = e.target.closest(".chips button");
      if (x) {
        var k = x.getAttribute("data-k"), v = x.getAttribute("data-v");
        if (k === "sens" || k === "preg") b[k] = !(b[k] === true || b[k] === "true"); else b[k] = v;
        st.plan = b; save(); paint(); return;
      }
      if (e.target.closest("#bd-copy")) {
        var r = routine(b), txt = "My Lumevina routine\n\nMorning\n" + r.am.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") +
          "\n\nNight\n" + r.pm.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") + "\n\n" + r.note;
        var ok = function () { toast("Copied. Paste it into your notes."); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { toast("Couldn't copy here. Select the text instead."); });
        else toast("Couldn't copy here. Select the text instead.");
      }
    });
    paint();
  };

  /* ── the course player ── */
  var firstOpen = function () {
    var next = ALL.filter(function (r) { return owns(r) && !st.done[r.ls.id]; })[0];
    return (next || ALL[0]).ls.id;
  };
  var player = (function () {
    var ov = $(".pl-ov"), panel = $(".pl-panel", ov), rail = $("#pl-rail"), main = $("#pl-main"), cur = null;
    var paintRail = function () {
      rail.innerHTML = S.levels.map(function (lv) {
        var rows = levelLessons(lv), dn = rows.filter(function (r) { return st.done[r.ls.id]; }).length;
        return '<div class="pr-l"><div class="pr-lh"><b>Level ' + lv.n + ' · ' + esc(lv.name) + '</b><span>' + dn + '/' + rows.length + '</span></div>' +
          lv.modules.map(function (md) {
            return '<div class="pr-m">' + esc(md.name) + '</div>' + md.lessons.map(function (ls) {
              var row = BY[ls.id], cls = st.done[ls.id] ? " done" : !owns(row) ? " locked" : "";
              return '<button type="button" class="pr-row' + cls + (cur === ls.id ? " on" : "") + '" data-go="' + ls.id + '"><span class="st"></span><span>' + esc(ls.t) + '</span><span class="mn">' +
                (ls.free && !st.tier ? "Free" : ls.min + "m") + '</span></button>';
            }).join("");
          }).join("") + '</div>';
      }).join("");
      var n = doneCount();
      $("#pl-count").textContent = n + " of " + ALL.length;
      $("#pl-ring").setAttribute("stroke-dashoffset", String(56.55 * (1 - n / ALL.length)));
      $("#pl-who").textContent = st.name ? "· " + st.name.split(" ")[0] : "";
    };
    var show = function (id, first) {
      var row = BY[id] || ALL[0], ls = row.ls, lv = row.lv, md = row.md, has = owns(row);
      cur = ls.id; st.last = ls.id; save();
      var prev = ALL[row.i - 1], next = ALL[row.i + 1], done = !!st.done[ls.id];
      main.innerHTML = '<article class="lesson' + (first ? "" : " enter") + '">' +
        '<div><p class="kicker">Level ' + lv.n + ' · ' + esc(md.name) + ' · Lesson ' + (row.i + 1) + ' of ' + ALL.length + '</p>' +
        '<h2 class="ls-h">' + esc(ls.t) + '</h2><p class="ls-sum">' + esc(ls.sum) + '</p></div>' +
        (has ? videoHtml(ls) +
          '<div><p class="ls-sec">What you&rsquo;ll learn</p>' + learnHtml(ls, true) + '</div>' + tryHtml(ls) +
          (ls.builder ? '<div><p class="ls-sec">Your routine builder</p>' + builderHtml() + '</div>' : "") + checkHtml(ls) +
          '<div class="ls-nav">' + (prev ? '<button type="button" class="btn btn-ghost" data-go="' + prev.ls.id + '">&larr; Back</button>' : "<span></span>") +
          '<button type="button" class="btn btn-dark ls-done' + (done ? " is-done" : "") + '" id="ls-done">' + (done ? "&#10003; Completed" : "Mark complete") + '</button>' +
          (next ? '<button type="button" class="btn btn-grad" data-go="' + next.ls.id + '">Next lesson &rarr;</button>' : '<button type="button" class="btn btn-grad" id="ls-cert">See my certificate</button>') + '</div>'
        : '<div class="locked-card"><h3>This lesson is part of ' + (lv.n === 1 ? "Skin Basics" : "The Course") + '.</h3>' +
          '<p>' + (lv.n === 1 ? "Level 1 is $49 on its own, or included in every course." : "Unlock all three levels, the routine builder and lifetime access.") + '</p>' +
          '<button type="button" class="btn btn-grad" data-see-tiers>See the courses</button></div>' +
          '<div class="ls-ghost" aria-hidden="true">' + learnHtml(ls) + '</div>') +
        '</article>';
      main.scrollTop = 0;
      panel.classList.remove("pl-open"); $("#pl-menu").setAttribute("aria-expanded", "false");
      paintRail();
      wireBuilder(main);
      if (done) { var c = $("[data-check]", main); if (c) { $$(".ck-opt", c).forEach(function (x, i) { x.disabled = true; if (i === ls.q.a) x.classList.add("yes"); }); } }
    };
    var complete = function (row, fromEl) {
      if (st.done[row.ls.id]) return;
      st.done[row.ls.id] = new Date().toISOString(); save();
      var b = $("#ls-done"); if (b && cur === row.ls.id) { b.classList.add("is-done"); b.innerHTML = "&#10003; Completed"; }
      paintRail(); paintAll();
      var lvRows = levelLessons(row.lv);
      if (doneCount() === ALL.length) setTimeout(certificate, rm ? 0 : 700);
      else if (lvRows.every(function (r) { return st.done[r.ls.id]; })) setTimeout(function () { levelParty(row.lv); }, rm ? 0 : 700);
      else if (!fromEl) toast("Lesson complete. " + doneCount() + " of " + ALL.length + " done.");
    };
    onRight = function (row, box) { if (!ov.hidden && box.closest(".pl-ov") && owns(row)) complete(row, box); };
    var levelParty = function (lv) {
      var nextLv = S.levels[lv.n];
      party('<p class="kicker">Level ' + lv.n + ' complete</p><p class="big">' + esc(lv.name) + ', <span class="grad">done.</span></p>' +
        '<p>' + esc(lv.outcome) + '</p><div class="qz-acts">' +
        (nextLv ? '<button type="button" class="btn btn-grad" data-party-go="' + levelLessons(nextLv)[0].ls.id + '">Start Level ' + nextLv.n + '</button>' : "") +
        '<button type="button" class="btn btn-ghost" data-party-close>Keep going later</button></div>');
    };
    var certificate = function () {
      var d = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      party('<p class="kicker">All 33 lessons</p><p class="big">You finished <span class="grad">Skin School.</span></p>' +
        '<div class="cert"><p class="c-k">Lumevina Skin School · Certificate of completion</p><p class="c-n">' + esc(st.name || "Skin School student") + '</p>' +
        '<p class="c-t">completed all three levels: Skin Basics, Actives &amp; Routines, and Treat Your Concern.</p>' +
        '<div class="c-s"><span>Evelyn Romero, Licensed Esthetician</span><span>' + d + '</span></div></div>' +
        '<div class="qz-acts"><button type="button" class="btn btn-grad" data-print>Print it</button><button type="button" class="btn btn-ghost" data-party-close>Close</button></div>');
    };
    var party = function (html) {
      var p = document.createElement("div");
      p.className = "cele"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true");
      p.innerHTML = '<div class="cele-card">' + html + '</div>';
      document.body.appendChild(p);
      petals($(".big", p), 28);
      setTimeout(function () { petals($(".big", p), 18); }, 350);
      p.addEventListener("click", function (e) {
        var g = e.target.closest("[data-party-go]");
        if (g) { p.remove(); show(g.getAttribute("data-party-go")); return; }
        if (e.target.closest("[data-print]")) { window.print(); return; }
        if (e.target.closest("[data-party-close]") || e.target === p) p.remove();
      });
      var btn = $(".cele-card .btn", p); if (btn) btn.focus({ preventScroll: true });
    };
    var open = function (id) {
      var go = function () {
        ov.hidden = false;
        document.documentElement.classList.add("lock");
        show(id || st.last || firstOpen(), true);
        if (!rm && panel.animate) {
          panel.animate([{ opacity: 0, transform: "translateY(30px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: EASE });
          $(".ov-backdrop", ov).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360 });
        }
        $(".pl-x", ov).focus({ preventScroll: true });
      };
      if (window.SchoolLevels.isOpen()) window.SchoolLevels.close(go); else go();
    };
    var close = function () {
      if (ov.hidden) return;
      var end = function () { ov.hidden = true; document.documentElement.classList.remove("lock"); paintAll(); };
      if (rm || !panel.animate) { end(); return; }
      var a = panel.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(24px) scale(.98)" }], { duration: 260, easing: "ease-in", fill: "forwards" });
      a.onfinish = function () { end(); a.cancel(); };
    };
    $(".pl-x", ov).addEventListener("click", close);
    $("#pl-menu").addEventListener("click", function () {
      var o = panel.classList.toggle("pl-open");
      $("#pl-menu").setAttribute("aria-expanded", String(o));
    });
    ov.addEventListener("click", function (e) {
      var g = e.target.closest("[data-go]");
      if (g) { show(g.getAttribute("data-go")); return; }
      if (e.target.closest("#ls-done")) { var row = BY[cur]; if (!st.done[row.ls.id]) complete(row); return; }
      if (e.target.closest("#ls-cert")) { if (doneCount() === ALL.length) certificate(); else toast((ALL.length - doneCount()) + " lessons to go before your certificate."); return; }
      if (e.target.closest("[data-see-tiers]")) { close(); setTimeout(function () { $("#tiers").scrollIntoView({ behavior: rm ? "auto" : "smooth" }); }, 280); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || ov.hidden) return;
      if ($(".cele")) { $(".cele").remove(); return; }
      if (!$(".co-ov").hidden) return;
      close();
    });
    return { open: open, close: close };
  })();
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open-lesson]");
    if (b && !b.closest(".pl-ov")) player.open(b.getAttribute("data-open-lesson"));
  });
  $("#tb-me").addEventListener("click", function () { player.open(st.tier ? (st.last || firstOpen()) : "1-1"); });

  /* ── everything that shows progress ── */
  var paintAll = function () {
    var n = doneCount();
    $("#tb-me-l").textContent = st.tier ? "My course · " + Math.round(pct() * 100) + "%" : n ? "Keep learning" : "Free lesson";
    $(".topbar .mini-ring .fg").setAttribute("stroke-dashoffset", String(56.55 * (1 - pct())));
    paintCur();
  };
  paintAll();

  /* ── the preview's demo switches ── */
  $("#demo-all").addEventListener("click", function () {
    st.tier = "evelyn"; st.name = st.name || "Demo student"; save(); paintAll();
    toast("Everything is unlocked in this browser.");
  });
  $("#demo-reset").addEventListener("click", function () {
    st = { done: {} }; save(); paintAll();
    toast("Started over: no course, no progress.");
  });
  if (/^#learn/.test(location.hash)) player.open();
})();

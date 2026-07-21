/* SchFLR — nav, mobile menu, GSAP motion */

(function () {
  "use strict";

  /* ── Intro label — stacked-shadow wordmark, once per visit ── */
  var introActive = false;
  (function () {
    var introEl = document.getElementById("intro");
    if (!introEl) return;
    var reduceIntro = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var seen = false;
    try { seen = sessionStorage.getItem("schflr-intro") === "1"; } catch (e) {}
    if (reduceIntro || seen) {
      introEl.classList.add("is-done");
      return;
    }
    introActive = true;
    try { sessionStorage.setItem("schflr-intro", "1"); } catch (e) {}
    window.setTimeout(function () { introEl.classList.add("leaving"); }, 1200);
    window.setTimeout(function () { introEl.classList.add("is-done"); }, 1720);
  })();

  /* ── Mobile menu ─────────────────────────────────────────── */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("mobile-menu");

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      menu.hidden = open;
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        menu.hidden = true;
      }
    });
  }

  /* ── Footer year ─────────────────────────────────────────── */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Contact fallback inside sandboxed previews ──────────── */
  /* The artifact preview iframe blocks tel:/sms:/mailto: links.
     When embedded, show a copyable contact card instead. */
  var EMBEDDED = window.self !== window.top;
  if (EMBEDDED) {
    var card = null;
    function contactCard(number, message) {
      if (!card) {
        card = document.createElement("div");
        card.className = "contact-card";
        card.innerHTML =
          '<div class="contact-card-inner">' +
          '<p class="contact-card-title mono">Preview mode — copy &amp; send</p>' +
          '<p class="contact-card-num mono"></p>' +
          '<p class="contact-card-msg"></p>' +
          '<div class="contact-card-btns">' +
          '<button type="button" class="btn btn-solid" data-copy="num">Copy number</button>' +
          '<button type="button" class="btn btn-ghost" data-copy="msg">Copy message</button>' +
          '<button type="button" class="btn btn-ghost" data-copy="close">Close</button>' +
          "</div></div>";
        document.body.appendChild(card);
        card.addEventListener("click", function (e) {
          var b = e.target.closest("[data-copy]");
          if (!b && e.target === card) { card.hidden = true; return; }
          if (!b) return;
          if (b.dataset.copy === "close") { card.hidden = true; return; }
          var text = b.dataset.copy === "num"
            ? card.querySelector(".contact-card-num").textContent
            : card.querySelector(".contact-card-msg").textContent;
          if (navigator.clipboard) navigator.clipboard.writeText(text);
          b.textContent = "Copied!";
          window.setTimeout(function () {
            b.textContent = b.dataset.copy === "num" ? "Copy number" : "Copy message";
          }, 1200);
        });
      }
      card.querySelector(".contact-card-num").textContent = number;
      var msgEl = card.querySelector(".contact-card-msg");
      msgEl.textContent = message || "";
      msgEl.hidden = !message;
      card.querySelector('[data-copy="msg"]').hidden = !message;
      card.hidden = false;
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="tel:"], a[href^="sms:"], a[href^="mailto:"]');
      if (!a || a.classList.contains("is-disabled")) return;
      e.preventDefault();
      var href = a.getAttribute("href");
      if (href.indexOf("mailto:") === 0) {
        contactCard("arzateruben22@gmail.com", "");
        return;
      }
      var num = "(714) 353-3126";
      var m = href.match(/body=([^&]*)/);
      contactCard(num, m ? decodeURIComponent(m[1]) : "");
    });
  }

  /* ── Brand → smooth scroll home ──────────────────────────── */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href="#top"]');
    if (!a) return;
    e.preventDefault();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  /* ── Coach shader — drifting ember-dust field (WebGL) ────── */
  /* Fragment shader by Matthias Hurrle (@atzedent), ported from a
     React shader-hero component. Follows the cursor with a slow
     parallax drift; renders at half resolution and pauses offscreen. */
  (function () {
    var section = document.getElementById("coach");
    if (!section) return;
    var canvas = document.createElement("canvas");
    canvas.className = "coach-shader";
    section.prepend(canvas);
    var gl = canvas.getContext("webgl2");
    if (!gl) { canvas.remove(); return; }

    var FRAG = "#version 300 es\n" +
      "precision highp float;\n" +
      "out vec4 O;uniform vec2 resolution;uniform float time;uniform vec2 touch;\n" +
      "#define FC gl_FragCoord.xy\n#define T time\n#define R resolution\n" +
      "#define MN min(R.x,R.y)\n" +
      "float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}\n" +
      "float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}\n" +
      "float fbm(vec2 p){float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}return t;}\n" +
      "float clouds(vec2 p){float d=1.,t=.0;for(float i=.0;i<3.;i++){float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);t=mix(t,d,a);d=a;p*=2./(i+1.);}return t;}\n" +
      "void main(void){vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);vec3 col=vec3(0);\n" +
      "float bg=clouds(vec2(st.x+T*.5,-st.y));\n" +
      "uv*=1.-.3*(sin(T*.2)*.5+.5);uv+=.35*touch;\n" +
      "for(float i=1.;i<12.;i++){uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.5+.1*uv.x);\n" +
      "vec2 p=uv;float d=length(p);col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);\n" +
      "float b=noise(i+p+bg*1.731);col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));\n" +
      "col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);}O=vec4(col,1);}";

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = compile(gl.VERTEX_SHADER,
      "#version 300 es\nprecision highp float;in vec4 position;void main(){gl_Position=position;}");
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.remove(); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, "resolution");
    var uTime = gl.getUniformLocation(prog, "time");
    var uTouch = gl.getUniformLocation(prog, "touch");

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var SCALE = 0.5;
    var touch = [0, 0];
    var target = [0, 0];
    var visible = true;
    var rafId = null;

    function resize() {
      canvas.width = Math.max(1, section.clientWidth * SCALE);
      canvas.height = Math.max(1, section.clientHeight * SCALE);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    section.addEventListener("pointermove", function (e) {
      var r = section.getBoundingClientRect();
      target = [
        (e.clientX - r.left) / r.width - 0.5,
        0.5 - (e.clientY - r.top) / r.height
      ];
    });

    function draw(t) {
      touch[0] += (target[0] - touch[0]) * 0.04;
      touch[1] += (target[1] - touch[1]) * 0.04;
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uTouch, touch[0], touch[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now) {
      draw(now * 0.001);
      rafId = window.requestAnimationFrame(frame);
    }
    function start() {
      if (rafId === null && visible) rafId = window.requestAnimationFrame(frame);
    }
    function stop() {
      if (rafId !== null) { window.cancelAnimationFrame(rafId); rafId = null; }
    }

    if (reduce) {
      draw(20); // one calm, still frame
    } else {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start(); else stop();
        }).observe(section);
      }
      start();
    }
  })();

  /* ── Plans: tap to select, pay-in-full / split toggle ────── */
  /* Ported from a React pricing component: animated selection
     ring, sliding toggle thumb, and rolling price numbers. */
  (function () {
    var grid = document.querySelector(".plans-grid");
    var toggle = document.querySelector(".pay-toggle");
    if (!grid || !toggle) return;

    /* TODO(Stripe): paste your Payment Link URLs here. Create them at
       dashboard.stripe.com → Payment Links (see fitness/README.md for the
       5-minute walkthrough). Leave "" and the button falls back to a call. */
    var STRIPE_LINKS = window.STRIPE_LINKS || {
      "Foundation": { full: "", split: "" },
      "Momentum":   { full: "", split: "" },
      "All-Access": { full: "", split: "" }
    };
    var PHONE_HREF = "tel:+17143533126";

    function bookHref(name, mode) {
      var links = STRIPE_LINKS[name] || {};
      /* no Stripe link yet → send them to the scheduler section */
      return links[mode] || "#book";
    }

    var plans = [].slice.call(grid.querySelectorAll(".plan"));
    var bar = document.querySelector(".plan-bar");
    var barName = bar && bar.querySelector(".plan-bar-name");
    var barAmount = bar && bar.querySelector(".plan-bar-amount");
    var barPer = bar && bar.querySelector(".plan-bar-per");
    var barCta = bar && bar.querySelector(".plan-bar-cta");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var mode = "full";
    var selected = grid.querySelector(".plan-featured") || plans[0];

    function fmt(n) {
      return "$" + Number(n).toLocaleString("en-US");
    }

    function roll(el, text) {
      if (!el || el.textContent === text) return;
      if (reduce) { el.textContent = text; return; }
      el.classList.remove("roll-in");
      el.classList.add("roll-out");
      window.setTimeout(function () {
        el.textContent = text;
        el.classList.remove("roll-out");
        el.classList.add("roll-in");
      }, 130);
    }

    function apply() {
      grid.classList.toggle("split", mode === "split");
      plans.forEach(function (p) {
        roll(p.querySelector(".plan-amount"), fmt(p.dataset[mode]));
        p.querySelector(".plan-per").textContent =
          mode === "split" ? "today" : "/ month";
        var cta = p.querySelector(".plan-cta");
        if (cta) cta.href = bookHref(p.dataset.name, mode);
        var on = p === selected;
        p.classList.toggle("is-selected", on);
        p.setAttribute("aria-checked", String(on));
      });
      if (bar) {
        barName.textContent = selected.dataset.name;
        roll(barAmount, fmt(selected.dataset[mode]));
        barPer.textContent = mode === "split" ? "today" : "/ month";
        barCta.textContent = "Book " + selected.dataset.name;
        barCta.href = bookHref(selected.dataset.name, mode);
      }
      /* let the scheduler read the current choice */
      window.__planState = {
        name: selected.dataset.name,
        mode: mode,
        price: fmt(selected.dataset[mode]) + (mode === "split" ? " today" : "/mo")
      };
      document.dispatchEvent(new CustomEvent("planchange"));
    }

    plans.forEach(function (p) {
      p.addEventListener("click", function () {
        selected = p;
        apply();
      });
      p.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selected = p;
          apply();
        }
      });
    });

    function setMode(newMode) {
      mode = newMode;
      toggle.classList.toggle("split", mode === "split");
      [].forEach.call(toggle.querySelectorAll(".pt-btn"), function (b) {
        var on = b.dataset.mode === mode;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      apply();
    }

    toggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".pt-btn");
      if (btn) setMode(btn.dataset.mode);
    });

    /* shared hooks for the scheduler */
    window.__setPlan = function (name, newMode) {
      var match = plans.filter(function (p) { return p.dataset.name === name; })[0];
      if (match) selected = match;
      setMode(newMode || mode);
    };
    window.__stripeLink = function (name, m) {
      return (STRIPE_LINKS[name] || {})[m] || "";
    };
    window.__planData = function (name, m) {
      var match = plans.filter(function (p) { return p.dataset.name === name; })[0];
      return match ? fmt(match.dataset[m]) + (m === "split" ? " today" : "/mo") : "";
    };

    apply();
  })();

  /* ── Scheduler — configure, pay, then text the slot ──────── */
  (function () {
    var daysEl = document.querySelector(".book-days");
    var slotsEl = document.querySelector(".book-slots");
    if (!daysEl || !slotsEl) return;

    /* TODO: edit your real availability here. 90-minute sessions;
       one session per week, so the calendar shows a rolling 7 days. */
    var OPEN_DAYS = [1, 2, 3, 4, 5, 6];          // Mon–Sat (0 = Sunday off)
    var SLOTS_BY_DAY = {
      weekday: ["6:00 – 7:30 PM", "7:30 – 9:00 PM", "9:00 – 10:30 PM"],
      saturday: ["10:00 – 11:30 AM", "11:30 AM – 1:00 PM", "1:00 – 2:30 PM",
                 "2:30 – 4:00 PM", "4:00 – 5:30 PM", "5:30 – 7:00 PM"]
    };
    var DAYS_AHEAD = 7;
    var PHONE = "+17143533126";

    var summary = document.querySelector(".book-summary");
    var payBtn = document.querySelector(".book-pay-btn");
    var confirmBox = document.querySelector(".book-confirm");
    var sendPaid = confirmBox.querySelector(".book-send");
    var sendFallback = document.querySelector(".book-send-fallback");
    var tiersEl = document.querySelector(".book-tiers");
    var payEl = document.querySelector(".book-pay");
    var demoBtn = document.querySelector(".book-demo-btn");
    var cardBox = document.querySelector(".book-card");
    var successBox = document.querySelector(".book-success");
    var skipLine = document.querySelector(".book-skip");
    var linesEl = cardBox.querySelector(".book-lines");
    var payNow = cardBox.querySelector(".book-pay-now");
    var payStatus = cardBox.querySelector(".book-pay-status");
    var cardName = document.getElementById("bk-card-name");
    var cardNum = document.getElementById("bk-card-num");
    var cardExp = document.getElementById("bk-exp");
    var cardCvc = document.getElementById("bk-cvc");
    var sendDone = successBox.querySelector(".book-send-done");
    var picked = { day: null, label: "", time: "", key: "" };
    var paymentOpened = false;
    var flow = "idle"; // idle | card | done

    function resetFlow() {
      if (flow === "idle") return;
      flow = "idle";
      payStatus.textContent = "";
      payNow.disabled = false;
      payNow.textContent = "Pay";
    }

    var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (var i = 1; i <= DAYS_AHEAD; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      if (OPEN_DAYS.indexOf(d.getDay()) === -1) continue;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip-day";
      b.setAttribute("role", "option");
      b.innerHTML = '<span class="mono">' + WD[d.getDay()].toUpperCase() +
        "</span>" + d.getDate() + '<span class="chip-mo mono">' +
        MO[d.getMonth()] + "</span>";
      b.dataset.label = WD[d.getDay()] + " " + MO[d.getMonth()] + " " + d.getDate();
      b.dataset.dow = String(d.getDay());
      b.dataset.key = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
      daysEl.appendChild(b);
    }

    /* time slots depend on the chosen day (weeknights vs Saturday) */
    function renderSlots(dow) {
      slotsEl.innerHTML = "";
      if (dow === null) {
        var hint = document.createElement("p");
        hint.className = "book-slots-hint mono";
        hint.textContent = "Pick a day first";
        slotsEl.appendChild(hint);
        return;
      }
      var times = dow === 6 ? SLOTS_BY_DAY.saturday : SLOTS_BY_DAY.weekday;
      times.forEach(function (t) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip-slot mono";
        b.setAttribute("role", "option");
        b.textContent = t;
        slotsEl.appendChild(b);
      });
    }
    renderSlots(null);

    /* keep the panel's tier / pay chips in sync with the plans section */
    function refreshPlan() {
      var p = window.__planState || { name: "Momentum", mode: "full", price: "" };
      [].forEach.call(tiersEl.children, function (c) {
        var on = c.dataset.name === p.name;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", String(on));
        var priceEl = c.querySelector(".chip-tier-price");
        if (priceEl && window.__planData) {
          priceEl.textContent = window.__planData(c.dataset.name, p.mode);
        }
      });
      [].forEach.call(payEl.children, function (c) {
        var on = c.dataset.mode === p.mode;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", String(on));
      });
      paymentOpened = false;
      resetFlow();
      update();
    }
    document.addEventListener("planchange", refreshPlan);

    tiersEl.addEventListener("click", function (e) {
      var b = e.target.closest(".chip-tier");
      if (b && window.__setPlan) window.__setPlan(b.dataset.name);
    });
    payEl.addEventListener("click", function (e) {
      var b = e.target.closest(".chip-pay");
      if (b && window.__setPlan) {
        var p = window.__planState || { name: "Momentum" };
        window.__setPlan(p.name, b.dataset.mode);
      }
    });

    function update() {
      var p = window.__planState || { name: "Momentum", mode: "full", price: "" };
      var ready = picked.label && picked.time;
      var link = window.__stripeLink ? window.__stripeLink(p.name, p.mode) : "";
      var stripeMode = !!link;

      /* real Stripe flow when links exist; demo card checkout until then */
      payBtn.hidden = !stripeMode;
      confirmBox.hidden = !stripeMode || !paymentOpened;
      demoBtn.hidden = stripeMode || flow !== "idle";
      cardBox.hidden = stripeMode || flow !== "card";
      successBox.hidden = stripeMode || flow !== "done";
      skipLine.hidden = stripeMode || flow === "done";

      payBtn.classList.toggle("is-disabled", !ready);
      sendPaid.classList.toggle("is-disabled", !ready);
      demoBtn.classList.toggle("is-disabled", !ready);

      if (!ready) {
        summary.textContent = "Choose a day and time above.";
        return;
      }
      summary.textContent = p.name + " · " + p.price + " · " +
        picked.label + " · " + picked.time;

      if (stripeMode) {
        payBtn.href = link;
        payBtn.textContent = paymentOpened
          ? "Reopen payment — " + p.price
          : "Continue to payment — " + p.price;
        var paidMsg = "Hi Ruben — I just paid on Stripe for the " + p.name +
          " plan (" + p.price + "). My first session: " + picked.label +
          ", " + picked.time + ".";
        sendPaid.href = "sms:" + PHONE + "?&body=" + encodeURIComponent(paidMsg);
      } else {
        demoBtn.textContent = "Continue to payment — " + p.price;
        var msg = "Hi Ruben — I want the " + p.name + " plan (" + p.price +
          "). Can we do my first session " + picked.label + ", " + picked.time + "?";
        /* the "?&" form works on both iOS and Android */
        sendFallback.href = "sms:" + PHONE + "?&body=" + encodeURIComponent(msg);
      }
    }

    /* ── Demo card checkout (Lumevina's deposit flow, SchFLR style) ── */
    function luhn(s) {
      var sum = 0, alt = false;
      for (var i = s.length - 1; i >= 0; i--) {
        var n = +s[i];
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
      }
      return s.length >= 15 && sum % 10 === 0;
    }
    function expiryOk(v) {
      var m = v.match(/^(0[1-9]|1[0-2])\/(\d\d)$/);
      if (!m) return false;
      var now = new Date();
      return (2000 + +m[2]) * 12 + (+m[1] - 1) >=
             now.getFullYear() * 12 + now.getMonth();
    }
    cardNum.addEventListener("input", function () {
      var d = cardNum.value.replace(/\D/g, "").slice(0, 16);
      cardNum.value = d.replace(/(.{4})/g, "$1 ").trim();
    });
    cardExp.addEventListener("input", function () {
      var d = cardExp.value.replace(/\D/g, "").slice(0, 4);
      cardExp.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
    });
    cardCvc.addEventListener("input", function () {
      cardCvc.value = cardCvc.value.replace(/\D/g, "").slice(0, 4);
    });

    demoBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (demoBtn.classList.contains("is-disabled")) {
        summary.textContent = "Pick a day and a time first — then pay.";
        return;
      }
      var p = window.__planState;
      var splitNote = p.mode === "split"
        ? '<li><span>Then 2 weekly payments</span><span>auto-reminder</span></li>' : "";
      linesEl.innerHTML =
        "<li><span>" + p.name + " — first month</span><span>" + p.price + "</span></li>" +
        "<li><span>First session</span><span>" + picked.label + " · " + picked.time + "</span></li>" +
        splitNote +
        '<li class="book-line-total"><span>Due now</span><span>' + p.price + "</span></li>";
      flow = "card";
      update();
      cardBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    cardBox.querySelector(".book-back").addEventListener("click", function () {
      resetFlow();
      update();
    });

    payNow.addEventListener("click", function () {
      var digits = cardNum.value.replace(/\s/g, "");
      var fail =
        !cardName.value.trim() ? "Add the name on the card." :
        !luhn(digits) ? "That card number doesn't check out." :
        !expiryOk(cardExp.value) ? "Check the expiry date." :
        cardCvc.value.length < 3 ? "Check the CVC." : "";
      if (fail) { payStatus.textContent = fail; return; }
      payStatus.textContent = "";
      payNow.disabled = true;
      payNow.textContent = "Processing…";
      window.setTimeout(function () {
        var p = window.__planState;
        var order = "SCHFLR-" +
          Math.random().toString(36).slice(2, 6).toUpperCase();
        successBox.querySelector(".book-success-sum").textContent =
          p.name + " · " + picked.label + " · " + picked.time;
        successBox.querySelector(".book-success-order").textContent =
          "Order " + order + " · " + p.price + " (demo — not charged)";
        var doneMsg = "Hi Ruben — I booked the " + p.name + " plan (" + p.price +
          "). First session: " + picked.label + ", " + picked.time +
          ". Order " + order + ".";
        sendDone.href = "sms:" + PHONE + "?&body=" + encodeURIComponent(doneMsg);
        if (window.__bookingLive && picked.key) {
          window.__bookingLive.record({
            day: picked.key, slot: picked.time, plan: p.name, mode: p.mode
          });
        }
        flow = "done";
        payNow.disabled = false;
        payNow.textContent = "Pay";
        update();
      }, 900);
    });

    payBtn.addEventListener("click", function (e) {
      if (payBtn.classList.contains("is-disabled")) {
        e.preventDefault();
        summary.textContent = "Pick a day and a time first — then pay.";
        return;
      }
      paymentOpened = true;
      update();
    });

    daysEl.addEventListener("click", function (e) {
      var b = e.target.closest(".chip-day");
      if (!b) return;
      [].forEach.call(daysEl.children, function (c) {
        c.classList.toggle("is-on", c === b);
        c.setAttribute("aria-selected", String(c === b));
      });
      picked.label = b.dataset.label;
      picked.key = b.dataset.key;
      picked.time = "";
      renderSlots(Number(b.dataset.dow));
      if (window.__bookingLive) window.__bookingLive.markTaken(picked.key, slotsEl);
      resetFlow();
      update();
    });
    slotsEl.addEventListener("click", function (e) {
      var b = e.target.closest(".chip-slot");
      if (!b || b.classList.contains("is-taken")) return;
      [].forEach.call(slotsEl.children, function (c) {
        c.classList.toggle("is-on", c === b);
        c.setAttribute("aria-selected", String(c === b));
      });
      picked.time = b.textContent;
      resetFlow();
      update();
    });
    [sendPaid, sendFallback].forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (btn.classList.contains("is-disabled")) {
          e.preventDefault();
          summary.textContent = "Pick a day and a time first — then send.";
          return;
        }
        /* live mode: close the slot for everyone the moment they commit */
        if (btn === sendPaid && window.__bookingLive && picked.key) {
          var p = window.__planState || { name: "Momentum", mode: "full" };
          window.__bookingLive.record({
            day: picked.key, slot: picked.time, plan: p.name, mode: p.mode
          });
        }
      });
    });

    refreshPlan();
  })();

  /* ── Proof ring — 3D photo carousel ──────────────────────── */
  /* Ported from a React/framer-motion 3D carousel: photos on a
     cylinder, drag to spin with inertia, tap to enlarge. */
  (function () {
    var ring = document.getElementById("proof-ring");
    var stage = ring && ring.parentElement;
    var lightbox = document.getElementById("lightbox");
    if (!ring || !stage) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var faces = [].slice.call(ring.querySelectorAll(".ring-face"));
    var rot = 0;
    var vel = 0;
    var IDLE = reduce ? 0 : -0.012;   // slow ambient spin, deg per ms
    var dragging = false;
    var lastX = 0;
    var lastT = 0;
    var moved = 0;
    var lastFrame = 0;

    function live() {
      return faces.filter(function (f) { return !f.classList.contains("gone"); });
    }

    function layout() {
      var l = live();
      if (!l.length) {
        var section = document.getElementById("proof");
        if (section) section.style.display = "none";
        return;
      }
      var fw = window.innerWidth < 640 ? 180 : 240;
      var radius = Math.round((fw * l.length) / (2 * Math.PI) * 1.18);
      l.forEach(function (f, i) {
        f.style.width = fw + "px";
        f.style.marginLeft = -(fw / 2) + "px";
        f.style.marginTop = -(fw * 4 / 3 / 2) + "px";
        f.style.transform =
          "rotateY(" + (i * 360 / l.length) + "deg) translateZ(" + radius + "px)";
      });
    }
    window.__ringLayout = layout;
    layout();
    window.addEventListener("resize", layout);

    function frame(t) {
      var dt = lastFrame ? Math.min(t - lastFrame, 48) : 16;
      lastFrame = t;
      if (!dragging && (lightbox === null || lightbox.hidden)) {
        vel += (IDLE - vel) * 0.02;
        rot += vel * dt;
      }
      ring.style.transform = "rotateY(" + rot + "deg)";
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);

    stage.addEventListener("pointerdown", function (e) {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastT = performance.now();
      stage.classList.add("dragging");
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var now = performance.now();
      moved += Math.abs(dx);
      rot += dx * 0.28;
      vel = (dx * 0.28) / Math.max(now - lastT, 1);
      lastX = e.clientX;
      lastT = now;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("dragging");
      /* a tap (not a drag) on a face opens the lightbox */
      if (moved < 8 && lightbox) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var face = el && el.closest(".ring-face");
        if (face) {
          var img = face.querySelector("img");
          lightbox.querySelector("img").src = img.currentSrc || img.src;
          lightbox.hidden = false;
        }
      }
    }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", function () {
      dragging = false;
      stage.classList.remove("dragging");
    });

    if (lightbox) {
      lightbox.addEventListener("click", function () { lightbox.hidden = true; });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") lightbox.hidden = true;
      });
    }
  })();

  /* ── Reactive glow waves ─────────────────────────────────── */
  /* Orange/gold light trails across the hero that ease toward the
     cursor. Ported from a canvas wave hero into plain JS. */
  (function () {
    var hero = document.querySelector(".hero");
    var canvas = document.querySelector(".hero-waves");
    if (!hero || !canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var mouse = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    var time = 0;
    var rafId = null;
    var visible = true;

    var waves = [
      { offset: 0,             amp: 26, freq: 0.0032, rgb: "249,115,22",  alpha: 0.5 },
      { offset: Math.PI / 2,   amp: 36, freq: 0.0023, rgb: "249,115,22",  alpha: 0.26 },
      { offset: Math.PI,       amp: 20, freq: 0.0041, rgb: "201,162,39",  alpha: 0.3 },
      { offset: Math.PI * 1.5, amp: 30, freq: 0.0019, rgb: "236,234,228", alpha: 0.12 }
    ];

    function resize() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mouse.x = target.x = W / 2;
      mouse.y = target.y = H * 0.78;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var base = H * 0.78;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i];
        ctx.beginPath();
        for (var x = 0; x <= W; x += 4) {
          var dx = x - mouse.x;
          var dy = base - mouse.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var influence = Math.max(0, 1 - dist / 320);
          var mouseEffect = influence * 46 *
            Math.sin(time * 0.001 + x * 0.01 + w.offset);
          var y = base +
            Math.sin(x * w.freq + time * 0.002 + w.offset) * w.amp +
            Math.sin(x * w.freq * 0.4 + time * 0.003) * w.amp * 0.45 +
            mouseEffect;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(" + w.rgb + "," + w.alpha + ")";
        ctx.shadowBlur = 26;
        ctx.shadowColor = "rgba(" + w.rgb + ",0.9)";
        ctx.stroke();
      }
    }

    function frame() {
      time += 16;
      mouse.x += (target.x - mouse.x) * 0.1;
      mouse.y += (target.y - mouse.y) * 0.1;
      draw();
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (rafId === null && visible && !reduce) {
        rafId = window.requestAnimationFrame(frame);
      }
    }
    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    });
    window.addEventListener("mouseout", function () {
      target.x = W / 2;
      target.y = H * 0.78;
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(hero);
    }

    if (reduce) {
      draw(); // one calm, static frame
    } else {
      start();
    }
  })();

  /* ── Motion ──────────────────────────────────────────────── */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof gsap === "undefined") return;

  document.documentElement.classList.add("js-motion");
  gsap.registerPlugin(ScrollTrigger);

  /* Page-load sequence: headline rises, copy fades, then the
     month calendars fill in — session squares landing last. */
  /* if the intro label is playing, the hero reveal waits for the handoff */
  var intro = gsap.timeline({
    delay: introActive ? 1.05 : 0,
    defaults: { ease: "power3.out" }
  });

  intro
    .fromTo(".hero-title .w",
      { y: 26, opacity: 0, scale: 0.9, filter: "blur(10px)" },
      { y: 0, opacity: 1, scale: 1, filter: "blur(0px)",
        duration: 0.7, stagger: 0.12, ease: "power2.out" }, 0.1)
    .fromTo("[data-load]",
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 }, 0.5)
    .fromTo(".month-grid span:not(.on)",
      { opacity: 0 },
      { opacity: 1, duration: 0.35, stagger: 0.004 }, 0.6)
    .fromTo(".month-grid span.on",
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1, duration: 0.3, stagger: 0.05, ease: "back.out(2)" }, 1.0);

  /* Tap ripple — a quick orange ring wherever the page is clicked */
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var r = document.createElement("span");
    r.className = "tap-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    window.setTimeout(function () { r.remove(); }, 700);
  });

  /* Scroll reveals */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.fromTo(el,
      { y: 28, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%" }
      });
  });

  /* Zoom parallax on the coach mosaic (ported from a scroll-zoom
     component): the grid zooms into focus as the section arrives,
     while each frame drifts at its own depth speed. */
  gsap.fromTo(".mosaic",
    { scale: 0.9, transformOrigin: "50% 30%" },
    {
      scale: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "#coach",
        start: "top 92%",
        end: "center 55%",
        scrub: true
      }
    });
  [[".cell-a", 34], [".cell-b", -26], [".cell-c", 52], [".cell-d", -20]]
    .forEach(function (pair) {
      gsap.fromTo(pair[0],
        { y: pair[1] },
        {
          y: -pair[1] * 0.7,
          ease: "none",
          scrollTrigger: {
            trigger: "#coach",
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        });
    });
})();

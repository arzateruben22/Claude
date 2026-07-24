/* Taqueria Los Güeros — interactions & motion
   All entrance states are set from JS so the page is fully
   readable with JavaScript disabled. */

/* ── Intro landing: charred-ember curtain; refresh returns to the top ── */
(function () {
  "use strict";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  var intro = document.getElementById("intro");
  if (!intro) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("intro-lock");

  /* Pin the page to the top for the whole intro, so the browser can't
     restore an old scroll position and cause a snap when the curtain
     lifts. The listener is removed once the intro finishes. */
  var pinTop = function () { window.scrollTo(0, 0); };
  window.addEventListener("scroll", pinTop, { passive: true });
  window.addEventListener("load", pinTop);

  /* Glowing embers drifting up over the charcoal */
  var canvas = intro.querySelector(".intro-embers");
  var ctx = canvas.getContext("2d");
  var embers = [];
  var raf = null, running = true;
  var resize = function () { canvas.width = intro.clientWidth; canvas.height = intro.clientHeight; };
  resize();
  window.addEventListener("resize", resize);
  for (var i = 0; i < 80; i++) {
    embers.push({
      x: Math.random(), y: 0.4 + Math.random() * 0.8,
      r: 0.5 + Math.random() * 1.6,
      v: 0.0005 + Math.random() * 0.0016,
      a: 0.2 + Math.random() * 0.6,
      tw: Math.random() * Math.PI * 2
    });
  }
  var draw = function () {
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (var g = 0; g < embers.length; g++) {
      var e = embers[g];
      e.y -= e.v; e.tw += 0.05;
      if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
      var flick = 0.55 + 0.45 * Math.sin(e.tw);
      var px = e.x * w, py = e.y * h, rad = e.r * 6;
      var grd = ctx.createRadialGradient(px, py, 0, px, py, rad);
      grd.addColorStop(0, "rgba(255,184,96," + (e.a * flick).toFixed(3) + ")");
      grd.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
    }
    if (running) raf = requestAnimationFrame(draw);
  };
  if (!reduce) raf = requestAnimationFrame(draw);

  var finish = function () {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", pinTop);
    window.removeEventListener("load", pinTop);
    window.scrollTo(0, 0);
    intro.style.display = "none";
    intro.classList.add("done");
    document.documentElement.classList.remove("intro-lock");
    window.scrollTo(0, 0);
  };

  var start = function () {
    if (reduce || typeof gsap === "undefined") {
      intro.style.transition = "opacity 500ms ease";
      setTimeout(function () {
        intro.style.opacity = "0";
        setTimeout(finish, 520);
      }, reduce ? 250 : 1200);
      return;
    }
    var tl = gsap.timeline();
    tl.from(".intro-eyebrow", { opacity: 0, y: 12, duration: 0.7, ease: "power2.out" }, 0.2)
      .from(".intro-word span", { opacity: 0, y: 44, duration: 1.0, stagger: 0.13, ease: "power3.out" }, 0.35)
      .from(".intro-tag", { opacity: 0, duration: 0.8, ease: "power2.out" }, 0.95)
      .to(".intro-inner", { opacity: 0, y: -16, duration: 0.55, ease: "power2.in" }, 2.35)
      .to(intro, { yPercent: -100, duration: 1.0, ease: "power4.inOut", onComplete: finish }, 2.55);
    var skip = function () { tl.progress(1); };
    intro.addEventListener("click", skip);
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") skip(); }, { once: true });
  };

  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 800); })]).then(start);
  } else {
    start();
  }
})();

(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ── Nav ── */
  var nav = document.querySelector(".nav");
  var onScroll = function () {
    nav.classList.toggle("scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Brand mark scrolls smoothly back to the top */
  document.querySelector(".nav-brand").addEventListener("click", function (e) {
    e.preventDefault();
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  });

  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  var setMenu = function (open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  };
  setMenu(false);
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  mobileMenu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mobileMenu.hidden) setMenu(false);
  });

  /* ── Catering form → prefilled email ── */
  /* TODO: swap the address below for the taqueria's real inbox, or wire
     the form to a service like Formspree for direct submissions. */
  var CATERING_EMAIL = "hola@losguerosanaheim.com";
  var form = document.querySelector(".catering-form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = form.querySelector(".form-status");
    if (!form.reportValidity()) return;
    var v = function (name) { return (form.elements[name].value || "").trim(); };
    var subject = "Catering request — " + v("name") + (v("date") ? " (" + v("date") + ")" : "");
    var body = [
      "Name: " + v("name"),
      "Phone: " + v("phone"),
      "Event date: " + v("date"),
      "Guests: " + v("guests"),
      "",
      v("notes")
    ].join("\n");
    window.location.href = "mailto:" + CATERING_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    status.textContent = "Opening your email app… If nothing happens, write to " + CATERING_EMAIL + ".";
  });

  /* ── Hero video: pause for reduced motion or data saver ── */
  var video = document.querySelector(".hero-video");
  if (video) {
    var rmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var applyMotionPref = function () {
      if (rmQuery.matches || (navigator.connection && navigator.connection.saveData)) {
        video.pause();
      } else {
        video.play().catch(function () {});
      }
    };
    applyMotionPref();
    if (rmQuery.addEventListener) rmQuery.addEventListener("change", applyMotionPref);
  }

  /* ── Motion (GSAP + ScrollTrigger) ── */
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", function () {
    /* Hero entrance */
    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".hero-media", { opacity: 0, duration: 1.8, ease: "power2.out" }, 0)
      .from(".hero-glow", { opacity: 0, scale: 0.85, duration: 1.6, ease: "power2.out" }, 0)
      .from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.7 }, 0.25)
      .from(".hero-title .line-inner", { yPercent: 115, duration: 1.0, stagger: 0.14 }, 0.35)
      .from(".hero-sub", { opacity: 0, y: 18, duration: 0.8 }, 0.85)
      .from(".hero-actions .btn", { opacity: 0, y: 14, duration: 0.6, stagger: 0.1 }, 1.0)
      .from(".hero-rating", { opacity: 0, y: 12, duration: 0.6 }, 1.2)
      .from(".hero-scroll", { opacity: 0, duration: 0.8 }, 1.3)
      .from(".nav", { opacity: 0, y: -12, duration: 0.7 }, 0.5);

    /* Glow drifts up slightly as you leave the hero */
    gsap.to(".hero-glow", {
      yPercent: -14,
      opacity: 0.5,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    /* Section reveals */
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.from(el, {
        opacity: 0,
        y: 28,
        duration: 0.9,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 82%" }
      });
    });

    /* Menu rows drift in with a stagger, group by group */
    gsap.utils.toArray(".carta-group").forEach(function (group) {
      gsap.from(group.querySelectorAll(".carta-row"), {
        opacity: 0,
        y: 16,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.06,
        scrollTrigger: { trigger: group, start: "top 78%" }
      });
    });

    return function () {};
  });
})();

/* ── Ordering: cart, salsa add-ons, pickup scheduling, delivery gate ──
   Orders are composed client-side and sent as a prefilled email.
   TODO before launch: set ORDER_EMAIL to the taqueria's inbox, or wire
   sendOrder() to a POS/payment provider (Square, Stripe, Toast) for
   real card payments. Keep OPEN_HOURS in sync with the hours shown
   in the Visit Us section. */

(function () {
  "use strict";

  var ORDER_EMAIL = "hola@losguerosanaheim.com";
  /* TODO: fill in any of these to enable online prepayment — the option
     appears automatically with the exact order total prefilled.
     paypalMe: your paypal.me handle, e.g. "losgueros"
     venmo: your Venmo username, e.g. "losgueros-anaheim"
     stripe: a Stripe Payment Link URL (customer enters the amount) */
  var PAYMENT_LINKS = { paypalMe: "", venmo: "", stripe: "" };
  var DELIVERY_MIN = 50;            /* dollars, delivery unlocks here */
  var PICKUP_LEAD_MIN = 20;         /* minutes until earliest pickup */
  var DELIVERY_LEAD_MIN = 45;       /* minutes until earliest delivery */
  var LAST_ORDER_BEFORE_CLOSE = 30; /* minutes before closing */
  var MAX_SALSA = 3;                /* salsa cups per menu item */
  /* Open hours by weekday, 0 = Sunday, in 24h numbers */
  var OPEN_HOURS = [[9, 20], [9, 21], [9, 21], [9, 21], [9, 21], [9, 22], [9, 22]];

  var panel = document.querySelector(".order-panel");
  if (!panel) return;

  var overlay = document.querySelector(".order-overlay");
  var fab = document.querySelector(".order-fab");
  var toast = document.querySelector(".add-toast");
  var itemsEl = panel.querySelector(".order-items");
  var emptyEl = panel.querySelector(".order-empty");
  var filledEl = panel.querySelector(".order-filled");
  var subtotalEl = panel.querySelector(".order-subtotal");
  var countEl = panel.querySelector(".order-count");
  var gateFill = panel.querySelector(".gate-fill");
  var gateText = panel.querySelector(".gate-text");
  var daySel = document.getElementById("order-day");
  var timeSel = document.getElementById("order-time");
  var addressField = panel.querySelector(".order-address-field");
  var statusEl = panel.querySelector(".order-status");
  var deliveryRadio = panel.querySelector('input[value="delivery"]');
  var pickupRadio = panel.querySelector('input[value="pickup"]');
  var addonPop = document.querySelector(".addon-pop");
  var addonOverlay = document.querySelector(".addon-overlay");

  /* Cart lines are keyed by item + salsa combo, so "Asada taco, 2 roja"
     and "Asada taco, 3 verde" stay separate lines. */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem("lg-order") || "{}"); } catch (e) { cart = {}; }
  Object.keys(cart).forEach(function (k) {
    var it = cart[k] || {};
    if (typeof it.price !== "number" || typeof it.qty !== "number" || it.qty < 1) {
      delete cart[k];
      return;
    }
    it.name = it.name || k;
    it.r = it.r || 0;
    it.g = it.g || 0;
    it.removed = Array.isArray(it.removed) ? it.removed : [];
  });

  var keyOf = function (name, r, g, removed) {
    var k = name;
    if (r || g) k += "|" + r + "r" + g + "g";
    if (removed && removed.length) k += "|no:" + removed.slice().sort().join(",");
    return k;
  };
  var lineNote = function (it) {
    var parts = [];
    if (it.r) parts.push(it.r + " roja");
    if (it.g) parts.push(it.g + " verde");
    (it.removed || []).forEach(function (x) { parts.push("no " + x); });
    return parts.join(", ");
  };
  var money = function (n) { return "$" + n.toFixed(2); };
  var subtotal = function () {
    return Object.keys(cart).reduce(function (sum, k) {
      return sum + cart[k].price * cart[k].qty;
    }, 0);
  };
  var count = function () {
    return Object.keys(cart).reduce(function (sum, k) { return sum + cart[k].qty; }, 0);
  };
  var mode = function () { return deliveryRadio.checked ? "delivery" : "pickup"; };

  /* ── Payment methods (selection is mandatory before sending) ── */

  var payOptions = panel.querySelector(".pay-options");
  var selectedPay = null;

  /* Every order is prepaid online; delivery may also pay the driver by
     card. There is deliberately no pay-at-counter option.
     The built-in card form runs in TEST MODE (accepts only the 4242
     test card, transmits nothing) until PAYMENT_LINKS.stripe is set —
     then it is replaced by the real Stripe checkout option. */
  var payMethods = function () {
    var m = [];
    if (PAYMENT_LINKS.stripe) {
      m.push({ id: "card-online", label: "Card online", hint: "secure checkout, pay now" });
    } else {
      m.push({ id: "card-form", label: "Card", hint: "test mode — no real charge yet" });
    }
    if (PAYMENT_LINKS.paypalMe) {
      m.push({ id: "paypal", label: "PayPal", hint: "pay now, exact total" });
    }
    if (PAYMENT_LINKS.venmo) {
      m.push({ id: "venmo", label: "Venmo", hint: "pay now, exact total" });
    }
    if (mode() === "delivery") {
      m.push({ id: "card-door", label: "Card at the door", hint: "our driver brings a reader" });
    }
    return m;
  };

  var payLink = function (id) {
    var amt = subtotal().toFixed(2);
    if (id === "paypal") return "https://paypal.me/" + PAYMENT_LINKS.paypalMe + "/" + amt;
    if (id === "venmo") return "https://venmo.com/" + PAYMENT_LINKS.venmo + "?txn=pay&amount=" + amt;
    if (id === "card-online") return PAYMENT_LINKS.stripe;
    return null;
  };

  var cardFields = panel.querySelector(".card-fields");
  var cardNumber = document.getElementById("card-number");
  var cardExp = document.getElementById("card-exp");
  var cardCvc = document.getElementById("card-cvc");
  var TEST_CARD = "4242424242424242";

  /* Format as you type: 4-digit groups, auto slash in expiry */
  cardNumber.addEventListener("input", function () {
    var d = cardNumber.value.replace(/\D/g, "").slice(0, 16);
    cardNumber.value = d.replace(/(\d{4})(?=\d)/g, "$1 ");
  });
  cardExp.addEventListener("input", function () {
    var d = cardExp.value.replace(/\D/g, "").slice(0, 4);
    cardExp.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  });
  cardCvc.addEventListener("input", function () {
    cardCvc.value = cardCvc.value.replace(/\D/g, "").slice(0, 4);
  });

  /* Card data is validated locally and never stored or transmitted. */
  var validateCard = function () {
    var num = cardNumber.value.replace(/\D/g, "");
    if (num !== TEST_CARD) {
      return "Test mode: only test card 4242 4242 4242 4242 works until our card processor is connected.";
    }
    var m = cardExp.value.match(/^(\d{2})\/(\d{2})$/);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return "Enter the card expiry as MM/YY.";
    var now = new Date();
    var expEnd = new Date(2000 + Number(m[2]), Number(m[1]), 1);
    if (expEnd <= now) return "That card expiry is in the past.";
    if (!/^\d{3,4}$/.test(cardCvc.value)) return "Enter the 3-digit CVC.";
    return null;
  };

  var renderPayment = function () {
    var methods = payMethods();
    if (!methods.some(function (m) { return m.id === selectedPay; })) selectedPay = null;
    cardFields.hidden = selectedPay !== "card-form";
    payOptions.innerHTML = "";
    if (!methods.length) {
      var note = document.createElement("p");
      note.className = "pay-note";
      note.textContent = "Online payment is being connected — pickup ordering opens the moment it's live. Call us to order today.";
      payOptions.appendChild(note);
      return;
    }
    methods.forEach(function (m) {
      var label = document.createElement("label");
      label.className = "pay-opt";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "payment";
      input.value = m.id;
      input.checked = m.id === selectedPay;
      input.addEventListener("change", function () {
        selectedPay = m.id;
        payOptions.classList.remove("pay-missing");
        cardFields.hidden = selectedPay !== "card-form";
      });
      var text = document.createElement("span");
      text.className = "pay-opt-text";
      var title = document.createElement("strong");
      title.textContent = m.label;
      var hint = document.createElement("small");
      hint.textContent = m.hint;
      text.appendChild(title);
      text.appendChild(hint);
      label.appendChild(input);
      label.appendChild(text);
      payOptions.appendChild(label);
    });
  };

  /* ── Quick-add menu inside the drawer, built from the page's menu ── */

  var quickGroups = panel.querySelector(".quick-groups");
  document.querySelectorAll(".carta-group").forEach(function (group, i) {
    var details = document.createElement("details");
    if (i === 0) details.open = true;
    var summary = document.createElement("summary");
    summary.textContent = group.querySelector(".carta-group-title").childNodes[0].textContent.trim();
    details.appendChild(summary);
    group.querySelectorAll(".carta-row").forEach(function (row) {
      var src = row.querySelector(".add-btn");
      var div = document.createElement("div");
      div.className = "quick-row";
      var name = document.createElement("span");
      name.className = "quick-name";
      name.textContent = src.getAttribute("data-name");
      var price = document.createElement("span");
      price.className = "quick-price";
      price.textContent = money(Number(src.getAttribute("data-price")));
      var btn = src.cloneNode(true);
      div.appendChild(name);
      div.appendChild(price);
      div.appendChild(btn);
      details.appendChild(div);
    });
    quickGroups.appendChild(details);
  });

  /* ── Time slots ── */

  var fmtTime = function (h, m) {
    var am = h < 12;
    var hr = h % 12 === 0 ? 12 : h % 12;
    return hr + ":" + (m < 10 ? "0" : "") + m + " " + (am ? "am" : "pm");
  };

  var slotsFor = function (dayOffset) {
    var now = new Date();
    var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    var hours = OPEN_HOURS[day.getDay()];
    var lead = mode() === "delivery" ? DELIVERY_LEAD_MIN : PICKUP_LEAD_MIN;
    var startMin = hours[0] * 60;
    var endMin = hours[1] * 60 - LAST_ORDER_BEFORE_CLOSE;
    if (dayOffset === 0) {
      var nowMin = now.getHours() * 60 + now.getMinutes() + lead;
      startMin = Math.max(startMin, Math.ceil(nowMin / 15) * 15);
    }
    var slots = [];
    for (var m = startMin; m <= endMin; m += 15) {
      slots.push({ value: dayOffset + ":" + m, label: fmtTime(Math.floor(m / 60), m % 60) });
    }
    return slots;
  };

  var renderSlots = function () {
    var dayOffset = Number(daySel.value || 0);
    var todaySlots = slotsFor(0);
    daySel.innerHTML = "";
    var dayNames = ["Today", "Tomorrow"];
    [0, 1, 2].forEach(function (off) {
      if (off === 0 && !todaySlots.length) return;
      var d = new Date();
      d.setDate(d.getDate() + off);
      var opt = document.createElement("option");
      opt.value = String(off);
      opt.textContent = off < 2 ? dayNames[off]
        : d.toLocaleDateString("en-US", { weekday: "long" });
      daySel.appendChild(opt);
    });
    if (![].slice.call(daySel.options).some(function (o) { return Number(o.value) === dayOffset; })) {
      dayOffset = Number(daySel.options[0].value);
    }
    daySel.value = String(dayOffset);

    timeSel.innerHTML = "";
    if (dayOffset === 0 && mode() === "pickup" && todaySlots.length) {
      var asap = document.createElement("option");
      asap.value = "asap";
      asap.textContent = "ASAP — about " + PICKUP_LEAD_MIN + " min";
      timeSel.appendChild(asap);
    }
    slotsFor(dayOffset).forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      timeSel.appendChild(opt);
    });
  };

  /* ── Rendering ── */

  var render = function () {
    var n = count();
    var sub = subtotal();

    fab.hidden = n === 0;
    fab.querySelector(".order-fab-count").textContent = n;
    emptyEl.hidden = n > 0;
    filledEl.hidden = n === 0;
    subtotalEl.textContent = money(sub);
    countEl.textContent = "· " + n + (n === 1 ? " item" : " items");

    itemsEl.innerHTML = "";
    Object.keys(cart).forEach(function (k) {
      var it = cart[k];
      var li = document.createElement("li");
      li.className = "order-item";

      var mk = function (delta, label) {
        var b = document.createElement("button");
        b.className = "qty-btn";
        b.type = "button";
        b.dataset.key = k;
        b.dataset.delta = String(delta);
        b.setAttribute("aria-label", label + " " + it.name);
        b.textContent = delta > 0 ? "+" : "−";
        return b;
      };
      li.appendChild(mk(-1, "Remove one"));
      var qty = document.createElement("span");
      qty.className = "order-item-qty";
      qty.textContent = it.qty;
      li.appendChild(qty);
      li.appendChild(mk(1, "Add one"));

      var nameWrap = document.createElement("span");
      nameWrap.className = "order-item-name";
      nameWrap.textContent = it.name;
      var noteText = lineNote(it);
      if (noteText) {
        var note = document.createElement("span");
        note.className = "order-item-salsa";
        note.textContent = noteText;
        nameWrap.appendChild(note);
      }
      li.appendChild(nameWrap);

      var price = document.createElement("span");
      price.className = "order-item-price";
      price.textContent = money(it.price * it.qty);
      li.appendChild(price);

      itemsEl.appendChild(li);
    });

    /* Delivery gate */
    var unlocked = sub >= DELIVERY_MIN;
    deliveryRadio.disabled = !unlocked;
    if (!unlocked && deliveryRadio.checked) {
      pickupRadio.checked = true;
    }
    gateFill.style.width = Math.min(100, (sub / DELIVERY_MIN) * 100) + "%";
    if (unlocked) {
      gateText.innerHTML = "Delivery unlocked. <strong>Card payment only.</strong>";
    } else {
      gateText.innerHTML = "Delivery unlocks at " + money(DELIVERY_MIN) +
        " — <strong>" + money(DELIVERY_MIN - sub) + " to go.</strong> Card only.";
    }

    addressField.hidden = mode() !== "delivery";

    /* "This order earns +X puntos" preview */
    var earnEl = panel.querySelector(".order-earn");
    if (earnEl) {
      var willEarn = Math.floor(sub * PUNTOS_PER_DOLLAR * (isTuesday ? TUESDAY_MULTIPLIER : 1));
      earnEl.hidden = n === 0;
      earnEl.querySelector(".order-earn-pts").textContent = "+" + willEarn + " puntos";
      earnEl.querySelector(".order-earn-tues").hidden = !isTuesday;
    }

    renderSlots();
    renderPayment();
    renderRewards();
    renderMember();

    /* members get their checkout details prefilled */
    var m = getMember();
    if (m) {
      var nameInput = document.getElementById("order-name");
      var phoneInput = document.getElementById("order-phone");
      if (nameInput && !nameInput.value) nameInput.value = m.name;
      if (phoneInput && !phoneInput.value) phoneInput.value = m.phone;
    }
    try { localStorage.setItem("lg-order", JSON.stringify(cart)); } catch (e) {}
  };

  /* ── Toast ── */

  var toastTimer;
  var showToast = function (msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  };

  var addLine = function (name, price, r, g, removed, qty) {
    removed = removed || [];
    qty = qty || 1;
    var k = keyOf(name, r, g, removed);
    if (!cart[k]) cart[k] = { name: name, price: price, qty: 0, r: r, g: g, removed: removed };
    cart[k].qty += qty;
    render();
    var note = lineNote(cart[k]);
    showToast("Added " + (qty > 1 ? qty + "× " : "") + name + (note ? " · " + note : ""));
  };

  /* ── Add-on popover: quantity, salsas, remove-ingredients ── */

  var addonState = { name: "", price: 0, qty: 1, r: 0, g: 0 };
  var removeList = addonPop.querySelector(".addon-remove-list");
  var removeDetails = addonPop.querySelector(".addon-remove");

  var renderAddon = function () {
    var total = addonState.r + addonState.g;
    addonPop.querySelector('[data-count="qty"]').textContent = addonState.qty;
    addonPop.querySelector('[data-count="r"]').textContent = addonState.r;
    addonPop.querySelector('[data-count="g"]').textContent = addonState.g;
    addonPop.querySelector(".addon-meter").textContent =
      total === 0 ? "No salsa — that's okay too" : total + " of " + MAX_SALSA + " cups each";
    addonPop.querySelectorAll(".stepper .qty-btn[data-salsa]").forEach(function (b) {
      var s = b.dataset.salsa;
      var step = Number(b.dataset.step);
      b.disabled = step > 0 ? total >= MAX_SALSA : addonState[s] <= 0;
    });
    addonPop.querySelector('[data-qty-step="-1"]').disabled = addonState.qty <= 1;
    addonPop.querySelector(".addon-add").textContent =
      "Add" + (addonState.qty > 1 ? " " + addonState.qty : "") +
      " — " + money(addonState.price * addonState.qty);
  };

  var openAddon = function (name, price, ingredients) {
    addonState = { name: name, price: price, qty: 1, r: 0, g: 0 };
    addonPop.querySelector(".addon-title").textContent = name;

    removeList.innerHTML = "";
    removeDetails.hidden = !ingredients.length;
    removeDetails.open = false;
    ingredients.forEach(function (ing) {
      var label = document.createElement("label");
      label.className = "remove-opt";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.value = ing;
      var text = document.createElement("span");
      text.textContent = "No " + ing;
      label.appendChild(box);
      label.appendChild(text);
      removeList.appendChild(label);
    });

    addonPop.hidden = false;
    addonOverlay.hidden = false;
    requestAnimationFrame(function () {
      addonPop.classList.add("open");
      addonOverlay.classList.add("open");
    });
    renderAddon();
    addonPop.querySelector(".addon-add").focus();
  };

  var closeAddon = function () {
    addonPop.classList.remove("open");
    addonOverlay.classList.remove("open");
    setTimeout(function () { addonPop.hidden = true; addonOverlay.hidden = true; }, 250);
  };

  addonPop.addEventListener("click", function (e) {
    var qtyStep = e.target.closest("[data-qty-step]");
    if (qtyStep) {
      addonState.qty = Math.max(1, Math.min(20, addonState.qty + Number(qtyStep.dataset.qtyStep)));
      renderAddon();
      return;
    }
    var step = e.target.closest(".stepper .qty-btn[data-salsa]");
    if (step) {
      var s = step.dataset.salsa;
      var next = addonState[s] + Number(step.dataset.step);
      var other = s === "r" ? addonState.g : addonState.r;
      addonState[s] = Math.max(0, Math.min(MAX_SALSA - other, next));
      renderAddon();
      return;
    }
    if (e.target.closest(".addon-add")) {
      var removed = [].map.call(removeList.querySelectorAll("input:checked"), function (b) {
        return b.value;
      });
      addLine(addonState.name, addonState.price, addonState.r, addonState.g, removed, addonState.qty);
      closeAddon();
      return;
    }
    if (e.target.closest(".addon-close")) closeAddon();
  });
  addonOverlay.addEventListener("click", closeAddon);

  /* ── Connect dropdown: close when clicking elsewhere ── */

  document.addEventListener("click", function (e) {
    document.querySelectorAll(".nav-drop[open]").forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute("open");
    });
  });

  /* ── Cart actions (page menu + quick-add rows share .add-btn) ── */

  document.addEventListener("click", function (e) {
    var add = e.target.closest(".add-btn");
    if (add) {
      var name = add.getAttribute("data-name");
      var price = Number(add.getAttribute("data-price"));
      if (add.getAttribute("data-addons") === "no") {
        addLine(name, price, 0, 0, [], 1);
      } else {
        var ingredients = (add.getAttribute("data-ingredients") || "")
          .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        openAddon(name, price, ingredients);
      }
      return;
    }
    var qty = e.target.closest(".order-items .qty-btn");
    if (qty) {
      var k = qty.dataset.key;
      if (cart[k]) {
        /* reward lines are one per order — they can be removed, not stacked */
        if (cart[k].rewardCost && Number(qty.dataset.delta) > 0) return;
        cart[k].qty += Number(qty.dataset.delta);
        if (cart[k].qty <= 0) delete cart[k];
        render();
      }
    }
  });

  /* ── Puntos Güeros: points, rewards, installable app ──
     Points are stored on this device (punch-card style) until a
     backend/POS integration exists. Earn 1 punto per $1, double on
     Tuesdays. Rewards drop into the cart as $0 lines and deduct
     puntos when the order is sent. */

  var PUNTOS_PER_DOLLAR = 1;
  var TUESDAY_MULTIPLIER = 2;
  var INSTALL_BONUS = 25;
  var SIGNUP_BONUS = 50;
  var REWARDS = [
    { id: "agua", name: "Agua fresca, on us", cost: 50, item: "Reward: Agua Fresca" },
    { id: "taco", name: "Free taco — any kind", cost: 100, item: "Reward: Taco" },
    { id: "mulita", name: "Free mulita", cost: 150, item: "Reward: Mulita" },
    { id: "burrito", name: "Free burrito", cost: 250, item: "Reward: Burrito" }
  ];

  var isTuesday = new Date().getDay() === 2;
  var getPts = function () { return Number(localStorage.getItem("lg-puntos") || 0) || 0; };
  var setPts = function (n) {
    try { localStorage.setItem("lg-puntos", String(Math.max(0, Math.round(n)))); } catch (e) {}
    renderRewards();
  };
  var cartRewardCost = function () {
    return Object.keys(cart).reduce(function (sum, k) {
      return sum + (cart[k].rewardCost || 0);
    }, 0);
  };
  var hasReward = function () { return cartRewardCost() > 0; };

  /* ── Membership (on-device until a backend exists) ──
     Sign up = name + phone saved locally with a one-time welcome bonus.
     Log in = matches the member saved on this device; cross-device
     accounts require the future backend (Supabase/POS) integration. */

  /* The account stays on the device; logging out only ends the session. */
  var getAccount = function () {
    try { return JSON.parse(localStorage.getItem("lg-member") || "null"); } catch (e) { return null; }
  };
  var getMember = function () {
    var a = getAccount();
    return a && localStorage.getItem("lg-member-in") === "1" ? a : null;
  };
  var memberPop = document.querySelector(".member-pop");
  var memberOverlay = document.querySelector(".member-overlay");
  var memberTab = "login";
  var normPhone = function (s) { return (s || "").replace(/\D/g, ""); };

  var renderMember = function () {
    var m = getMember();
    var hello = document.querySelector(".member-hello");
    var cta = document.querySelector(".member-cta");
    if (hello) {
      hello.hidden = !m;
      if (m) hello.querySelector(".member-hello-name").textContent = m.name.split(" ")[0];
    }
    if (cta) cta.hidden = !!m;
    document.querySelectorAll(".order-member-line").forEach(function (el) {
      el.hidden = !!m;
    });
  };

  var setMemberTab = function (tab) {
    memberTab = tab;
    memberPop.querySelectorAll(".member-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    memberPop.querySelector(".member-name-field").hidden = tab !== "signup";
    memberPop.querySelector(".member-signup-help").hidden = tab !== "signup";
    memberPop.querySelector(".member-submit").textContent =
      tab === "signup" ? "Sign up — +" + SIGNUP_BONUS + " puntos" : "Log in";
    memberPop.querySelector(".member-status").textContent = "";
  };

  var openMember = function (tab) {
    setMemberTab(tab);
    memberPop.hidden = false;
    memberOverlay.hidden = false;
    requestAnimationFrame(function () {
      memberPop.classList.add("open");
      memberOverlay.classList.add("open");
    });
    document.getElementById(tab === "signup" ? "member-name" : "member-phone").focus();
  };

  var closeMember = function () {
    memberPop.classList.remove("open");
    memberOverlay.classList.remove("open");
    setTimeout(function () { memberPop.hidden = true; memberOverlay.hidden = true; }, 250);
  };

  document.addEventListener("click", function (e) {
    if (e.target.closest(".member-open-login")) { openMember("login"); return; }
    if (e.target.closest(".member-open-signup")) { openMember("signup"); return; }
    if (e.target.closest(".member-logout")) {
      try { localStorage.removeItem("lg-member-in"); } catch (err) {}
      renderMember();
      showToast("Logged out — your puntos stay safe on this phone");
    }
  });
  memberPop.querySelectorAll(".member-tab").forEach(function (b) {
    b.addEventListener("click", function () { setMemberTab(b.dataset.tab); });
  });
  memberPop.querySelector(".member-close").addEventListener("click", closeMember);
  memberOverlay.addEventListener("click", closeMember);

  memberPop.querySelector(".member-submit").addEventListener("click", function () {
    var status = memberPop.querySelector(".member-status");
    var name = document.getElementById("member-name").value.trim();
    var phone = normPhone(document.getElementById("member-phone").value);
    status.classList.remove("error");
    if (phone.length < 10) {
      status.classList.add("error");
      status.textContent = "Enter a 10-digit phone number.";
      return;
    }
    var existing = getAccount();
    if (memberTab === "signup") {
      if (!name) {
        status.classList.add("error");
        status.textContent = "Add your name so we know who the tacos are for.";
        return;
      }
      if (existing && normPhone(existing.phone) !== phone) {
        status.classList.add("error");
        status.textContent = "This phone already has a member (" + existing.name + "). Log out first.";
        return;
      }
      var isNew = !existing;
      try {
        localStorage.setItem("lg-member", JSON.stringify({ name: name, phone: phone }));
        localStorage.setItem("lg-member-in", "1");
      } catch (e) {}
      if (isNew && !localStorage.getItem("lg-signup-bonus")) {
        try { localStorage.setItem("lg-signup-bonus", "1"); } catch (e) {}
        setPts(getPts() + SIGNUP_BONUS);
        showToast("+" + SIGNUP_BONUS + " puntos de bienvenida, " + name.split(" ")[0]);
      } else {
        showToast("Welcome back, " + name.split(" ")[0]);
      }
      renderMember();
      closeMember();
    } else {
      if (existing && normPhone(existing.phone) === phone) {
        try { localStorage.setItem("lg-member-in", "1"); } catch (e) {}
        showToast("Welcome back, " + existing.name.split(" ")[0]);
        renderMember();
        closeMember();
      } else {
        status.classList.add("error");
        status.textContent = "No membership found on this device. Accounts sync across devices once the app is live — sign up here to start earning on this phone.";
      }
    }
  });

  /* ── Order history (stored on this device) ── */

  var getHistory = function () {
    try { return JSON.parse(localStorage.getItem("lg-history") || "[]"); } catch (e) { return []; }
  };
  var addHistory = function (entry) {
    var h = getHistory();
    h.unshift(entry);
    try { localStorage.setItem("lg-history", JSON.stringify(h.slice(0, 20))); } catch (e) {}
    renderHistory();
  };
  var historyList = document.querySelector(".history-list");
  var renderHistory = function () {
    if (!historyList) return;
    var h = getHistory();
    document.querySelector(".history-empty").hidden = h.length > 0;
    historyList.innerHTML = "";
    h.slice(0, 10).forEach(function (o) {
      var li = document.createElement("li");
      li.className = "history-row";
      var top = document.createElement("span");
      top.className = "history-top";
      var dt = new Date(o.d);
      top.textContent = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " · " + o.mode + " · " + money(o.total);
      var pts = document.createElement("span");
      pts.className = "history-pts";
      pts.textContent = "+" + o.earned + " pts";
      var items = document.createElement("span");
      items.className = "history-items";
      items.textContent = o.items;
      li.appendChild(top);
      li.appendChild(pts);
      li.appendChild(items);
      historyList.appendChild(li);
    });
  };

  var rewardsRows = document.querySelector(".rewards-rows");
  var renderRewards = function () {
    if (!rewardsRows) return;
    document.querySelectorAll(".puntos-count").forEach(function (el) {
      el.textContent = getPts();
    });
    var tb = document.querySelector(".tuesday-badge");
    if (tb) tb.hidden = !isTuesday;
    rewardsRows.innerHTML = "";
    REWARDS.forEach(function (r) {
      var li = document.createElement("li");
      li.className = "rewards-row";
      var name = document.createElement("span");
      name.className = "rewards-row-name";
      name.textContent = r.name;
      var cost = document.createElement("span");
      cost.className = "rewards-row-cost";
      cost.textContent = r.cost + " pts";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rewards-claim";
      btn.textContent = "Claim";
      btn.disabled = getPts() < r.cost || hasReward();
      btn.addEventListener("click", function () {
        if (getPts() < r.cost || hasReward()) return;
        cart["reward:" + r.id] = {
          name: r.item, price: 0, qty: 1, r: 0, g: 0, removed: [],
          rewardCost: r.cost, rewardId: r.id
        };
        render();
        showToast("Reward added to your order");
        openPanel();
      });
      li.appendChild(name);
      li.appendChild(cost);
      li.appendChild(btn);
      rewardsRows.appendChild(li);
    });
  };

  /* ── Installable app (PWA) ── */

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  /* Home-screen installs still earn the welcome bonus; the App Store
     listing is announced as coming soon in the rewards section. */
  var grantInstallBonus = function () {
    if (localStorage.getItem("lg-install-bonus")) return;
    try { localStorage.setItem("lg-install-bonus", "1"); } catch (e) {}
    setPts(getPts() + INSTALL_BONUS);
    showToast("+" + INSTALL_BONUS + " welcome puntos");
  };
  var standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (standalone) grantInstallBonus();
  window.addEventListener("appinstalled", grantInstallBonus);

  /* ── Clear all (two taps: arm, then confirm) ── */

  var clearBtn = panel.querySelector(".order-clear");
  var clearTimer = null;
  var resetClear = function () {
    clearTimeout(clearTimer);
    clearTimer = null;
    clearBtn.classList.remove("armed");
    clearBtn.innerHTML = 'Clear all <span lang="es">· vaciar orden</span>';
  };
  clearBtn.addEventListener("click", function () {
    if (!clearTimer) {
      clearBtn.classList.add("armed");
      clearBtn.textContent = "Tap again to clear everything";
      clearTimer = setTimeout(resetClear, 3500);
    } else {
      cart = {};
      resetClear();
      render();
      showToast("Order cleared");
    }
  });

  /* ── Panel open/close ── */

  var lastFocus = null;
  var openPanel = function () {
    lastFocus = document.activeElement;
    panel.hidden = false;
    overlay.hidden = false;
    requestAnimationFrame(function () {
      panel.classList.add("open");
      overlay.classList.add("open");
    });
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    render();
    panel.querySelector(".order-close").focus();
  };

  var closePanel = function () {
    panel.classList.remove("open");
    overlay.classList.remove("open");
    setTimeout(function () { panel.hidden = true; overlay.hidden = true; }, 320);
    if (lastFocus) lastFocus.focus();
  };

  fab.addEventListener("click", openPanel);
  overlay.addEventListener("click", closePanel);
  panel.querySelector(".order-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!memberPop.hidden) { closeMember(); return; }
    if (!addonPop.hidden) { closeAddon(); return; }
    if (!panel.hidden) closePanel();
  });
  document.querySelectorAll(".js-open-order").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openPanel();
    });
  });

  daySel.addEventListener("change", renderSlots);
  panel.querySelectorAll('input[name="fulfill"]').forEach(function (r) {
    r.addEventListener("change", render);
  });

  /* ── Send order ── */

  panel.querySelector(".order-send").addEventListener("click", function () {
    var name = document.getElementById("order-name").value.trim();
    var phone = document.getElementById("order-phone").value.trim();
    var address = document.getElementById("order-address").value.trim();
    var isDelivery = mode() === "delivery";

    statusEl.classList.remove("error");
    if (!name || !phone || (isDelivery && !address)) {
      statusEl.classList.add("error");
      statusEl.textContent = isDelivery
        ? "Add your name, phone, and delivery address first."
        : "Add your name and phone number first.";
      return;
    }
    if (isDelivery && subtotal() < DELIVERY_MIN) {
      statusEl.classList.add("error");
      statusEl.textContent = "Delivery needs a " + money(DELIVERY_MIN) + " minimum — add a bit more.";
      return;
    }
    if (!selectedPay) {
      payOptions.classList.add("pay-missing");
      statusEl.classList.add("error");
      statusEl.textContent = payMethods().length
        ? "Choose how you're paying before sending your order."
        : "Online payment isn't connected yet — call us to place your order.";
      return;
    }

    var when;
    if (timeSel.value === "asap") {
      when = "ASAP (about " + PICKUP_LEAD_MIN + " min)";
    } else {
      when = daySel.options[daySel.selectedIndex].textContent + " at " +
             timeSel.options[timeSel.selectedIndex].textContent;
    }

    var lines = [(isDelivery ? "DELIVERY" : "PICKUP") + " order — " + name, "When: " + when, ""];
    Object.keys(cart).forEach(function (k) {
      var it = cart[k];
      var note = lineNote(it);
      lines.push(it.qty + "x " + it.name + (note ? " (" + note + ")" : "") +
        " — " + money(it.price * it.qty));
    });
    if (selectedPay === "card-form") {
      var cardError = validateCard();
      if (cardError) {
        statusEl.classList.add("error");
        statusEl.textContent = cardError;
        return;
      }
    }
    if (cartRewardCost() > getPts()) {
      statusEl.classList.add("error");
      statusEl.textContent = "Not enough puntos for that reward — remove it or keep earning.";
      return;
    }

    var payMethod = payMethods().filter(function (m) { return m.id === selectedPay; })[0];
    var link = payLink(selectedPay);

    lines.push("", "Total items: " + count(),
      "Subtotal: " + money(subtotal()) + " (plus tax)", "Phone: " + phone);
    if (isDelivery) lines.push("Address: " + address);
    lines.push("Payment: " + payMethod.label.toUpperCase() +
      (link ? " — customer opened the payment page for " + money(subtotal()) + ", confirm receipt" : "") +
      (selectedPay === "card-form" ? " — TEST MODE, no charge processed" : ""));

    var redeemed = cartRewardCost();
    var earned = Math.floor(subtotal() * PUNTOS_PER_DOLLAR * (isTuesday ? TUESDAY_MULTIPLIER : 1));
    lines.push("Puntos: " + (redeemed ? "-" + redeemed + " redeemed, " : "") +
      "+" + earned + " earned" + (isTuesday ? " (double Tuesday)" : ""));

    if (link) window.open(link, "_blank", "noopener");
    window.location.href = "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent((isDelivery ? "Delivery" : "Pickup") + " order — " + name) +
      "&body=" + encodeURIComponent(lines.join("\n"));
    setPts(getPts() - redeemed + earned);
    addHistory({
      d: Date.now(),
      mode: isDelivery ? "Delivery" : "Pickup",
      total: subtotal(),
      earned: earned,
      items: Object.keys(cart).map(function (k) {
        return cart[k].qty + "× " + cart[k].name;
      }).join(", ")
    });
    statusEl.textContent = link
      ? "Payment page opened in a new tab — finish paying there, and send the order email so we can confirm."
      : "Opening your email app to send the order — we'll text you to confirm.";
  });

  render();
  renderHistory();
})();

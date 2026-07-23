/* Shawarma Queen — interactions & motion
   All entrance states are set from JS so the page is fully
   readable with JavaScript disabled. */

/* ── Shared form delivery ──────────────────────────────────────────
   Order + catering submissions land in the shop's real email inbox via
   Web3Forms (no backend, no build step). Paste the free access key below
   — get one in ~30 seconds at https://web3forms.com by entering the
   destination email; submissions are then delivered to that address.
   Until a key is set, SQForms.hasInbox() is false and the forms fall
   back to a prefilled mailto so nothing breaks. */
window.SQForms = (function () {
  var WEB3FORMS_KEY = ""; /* TODO: paste the Web3Forms access key here to go live */
  return {
    hasInbox: function () { return !!WEB3FORMS_KEY; },
    send: function (subject, fields) {
      var payload = { access_key: WEB3FORMS_KEY, subject: subject };
      for (var k in fields) if (fields.hasOwnProperty(k)) payload[k] = fields[k];
      return fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    }
  };
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

  /* ── Eased, header-aware in-page navigation ──
     Native CSS smooth-scroll stutters here (the canvas globe, ScrollTrigger
     scrubs and the orbit all run while it animates), so we drive a short
     fixed-duration ease ourselves and land each section just below the fixed
     nav. One delegated listener covers every in-page link — brand, nav dock,
     mobile menu and CTAs — while drawer-opening links (.js-open-order) keep
     their own behavior. Reduced-motion jumps instantly. */
  var navEl = document.querySelector(".nav");
  var scrollRaf = null;
  var easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var smoothScrollTo = function (targetY) {
    targetY = Math.max(0, Math.round(targetY));
    if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var startY = window.pageYOffset;
    var dist = targetY - startY;
    if (reduced || Math.abs(dist) < 2) { window.scrollTo(0, targetY); return; }
    var dur = Math.min(700, Math.max(300, Math.abs(dist) * 0.42));
    var t0 = null;
    var step = function (ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      window.scrollTo(0, startY + dist * easeInOutCubic(p));
      scrollRaf = p < 1 ? requestAnimationFrame(step) : null;
    };
    scrollRaf = requestAnimationFrame(step);
  };
  var scrollToHash = function (hash) {
    if (hash === "#top" || hash === "#" || hash === "") { smoothScrollTo(0); return; }
    var el = document.getElementById(hash.slice(1));
    if (!el) return;
    var navH = navEl ? navEl.getBoundingClientRect().height : 0;
    smoothScrollTo(el.getBoundingClientRect().top + window.pageYOffset - navH - 12);
  };
  /* Any user gesture on the page cancels an in-flight animated scroll,
     so wheel/touch never fights the ease. */
  ["wheel", "touchstart"].forEach(function (evt) {
    window.addEventListener(evt, function () {
      if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
    }, { passive: true });
  });
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || link.classList.contains("js-open-order")) return;
    var hash = link.getAttribute("href");
    if (!hash || hash.charAt(0) !== "#") return;
    if (hash !== "#top" && hash.length > 1 && !document.getElementById(hash.slice(1))) return;
    e.preventDefault();
    scrollToHash(hash);
    if (history.pushState) {
      history.pushState(null, "", hash === "#top" ? location.pathname + location.search : hash);
    }
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

  /* ── Catering form → real inbox (Web3Forms) with mailto fallback ── */
  /* TODO: this is the address used only for the mailto fallback before a
     Web3Forms key is set — swap it for Shawarma Queen's real inbox. */
  var CATERING_EMAIL = "hello@shawarmaqueen.example";
  var form = document.querySelector(".catering-form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = form.querySelector(".form-status");
    if (!form.reportValidity()) return;
    var v = function (name) { return (form.elements[name].value || "").trim(); };
    var subject = "Catering request — " + v("name") + (v("date") ? " (" + v("date") + ")" : "");
    var fields = {
      name: v("name"), phone: v("phone"), date: v("date"),
      guests: v("guests"), notes: v("notes")
    };
    var mailtoBody = [
      "Name: " + v("name"), "Phone: " + v("phone"),
      "Event date: " + v("date"), "Guests: " + v("guests"),
      "", v("notes")
    ].join("\n");
    var toMailto = function () {
      window.location.href = "mailto:" + CATERING_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(mailtoBody);
      status.textContent = "Opening your email app… If nothing happens, write to " + CATERING_EMAIL + ".";
    };
    if (!window.SQForms || !window.SQForms.hasInbox()) { toMailto(); return; }
    status.textContent = "Sending your request…";
    window.SQForms.send(subject, fields).then(function (ok) {
      if (ok) {
        form.reset();
        status.textContent = "Request sent! We'll get back to you with a quote within a day.";
      } else { toMailto(); }
    });
  });

  /* ── Motion (GSAP + ScrollTrigger) ── */
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", function () {
    /* Hero entrance */
    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".hero-glow", { opacity: 0, scale: 0.85, duration: 1.6, ease: "power2.out" }, 0)
      .from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.7 }, 0.2)
      .from(".hero-title .line-inner", { yPercent: 115, duration: 1.0, stagger: 0.14 }, 0.3)
      .from(".hero-sub", { opacity: 0, y: 18, duration: 0.8 }, 0.8)
      .from(".hero-actions .btn", { opacity: 0, y: 14, duration: 0.6, stagger: 0.1 }, 0.95)
      .from(".hero-rating", { opacity: 0, y: 12, duration: 0.6 }, 1.15)
      .from(".hero-figure", { opacity: 0, scale: 0.9, duration: 1.2, ease: "power2.out" }, 0.4)
      .from(".hero-scroll", { opacity: 0, duration: 0.8 }, 1.3)
      .from(".nav", { opacity: 0, y: -12, duration: 0.7 }, 0.4);

    /* Glow drifts as you leave the hero */
    gsap.to(".hero-glow", {
      yPercent: -14,
      opacity: 0.5,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
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
        scrollTrigger: { trigger: group, start: "top 82%" }
      });
    });

    return function () {};
  });
})();

/* ── Ordering: cart, sauce picker, pickup scheduling, delivery gate ──
   Orders are composed client-side and sent as a prefilled email.
   TODO before launch: set ORDER_EMAIL to Shawarma Queen's inbox, or wire
   sendOrder() to a POS/payment provider (Square, Stripe, Toast) for
   real card payments. Keep OPEN_HOURS in sync with the posted hours. */

(function () {
  "use strict";

  var ORDER_EMAIL = "orders@shawarmaqueen.example";
  /* TODO: fill in any of these to enable online prepayment — the option
     appears automatically with the exact order total prefilled.
     paypalMe: your paypal.me handle
     venmo: your Venmo username
     stripe: a Stripe Payment Link URL (customer enters the amount) */
  var PAYMENT_LINKS = { paypalMe: "", venmo: "", stripe: "" };
  var CURRENCY = "$";
  var DELIVERY_MIN = 25;            /* dollars, delivery unlocks here */
  var PICKUP_LEAD_MIN = 20;         /* minutes until earliest pickup */
  var DELIVERY_LEAD_MIN = 45;       /* minutes until earliest delivery */
  var LAST_ORDER_BEFORE_CLOSE = 30; /* minutes before closing */
  /* Open hours by weekday, 0 = Sunday, in 24h numbers. Shawarma Queen is
     open 11:00 am – 3:30 am the next day, every day (end = 27.5 = 3:30 am). */
  var OPEN_HOURS = [
    [11, 27.5], [11, 27.5], [11, 27.5], [11, 27.5], [11, 27.5], [11, 27.5], [11, 27.5]
  ];

  /* Pick-your-sauce, straight off the board. Garlic is included; the
     premium sauces add $1 each. */
  var SAUCES = [
    { id: "Garlic", price: 0 },
    { id: "Boom", price: 0.5 },
    { id: "Queen", price: 0.5 },
    { id: "Tzatziki", price: 0.5 }
  ];
  var saucePrice = function (id) {
    for (var i = 0; i < SAUCES.length; i++) if (SAUCES[i].id === id) return SAUCES[i].price;
    return 0;
  };

  /* Per-item photos, keyed by data-name — shown in the add-to-cart popover
     and injected as menu-row thumbnails. Items without an entry simply show
     no photo (graceful). */
  var ITEM_IMAGES = {
    /* Shawarma */
    "Chicken Shawarma": "media/items/chicken-shawarma.jpg",
    "Beef Shawarma": "media/items/beef-shawarma.jpg",
    "Falafel Shawarma": "media/items/falafel-shawarma.jpg",
    "Makali Shawarma": "media/items/makali-shawarma.jpg",
    "Queen Vegan Shawarma": "media/items/queen-vegan-shawarma.jpg",
    /* (Simple Bowl photos removed — the board crops caught neighbouring bowls) */
    /* Sandwiches & Quesadillas */
    "Chicken Spicy Sandwich": "media/items/sandwich.jpg",
    "Chicken Shawarma Quesadilla": "media/items/quesadilla.jpg",
    /* Sides */
    "Hummus": "media/items/hummus.jpg",
    "Hummus with Chicken Shawarma": "media/items/hummus-shawarma.jpg",
    "Hummus with Beef Shawarma": "media/items/hummus-shawarma.jpg",
    "Tabbouleh": "media/items/tabbouleh.jpg",
    "Fattoush": "media/items/fattoush.jpg",
    "French Fries": "media/items/french-fries.jpg",
    "Batata Harra": "media/items/batata-harra.jpg",
    "Motabal": "media/items/motabal.jpg",
    "Grape Leaves (5 pcs)": "media/items/grape-leaves.jpg",
    "Falafel (6 pcs)": "media/items/falafel-side.jpg",
    /* Sauces & Extras */
    "Garlic Sauce": "media/garlic.jpg",
    "Queen Sauce": "media/queen.jpg",
    "Boom Sauce": "media/boom.jpg",
    "Tzatziki": "media/items/tzatziki.jpg",
    "Mix Pickles": "media/pickles.jpg",
    "Grape Leaves (1 pc)": "media/items/grape-leaves.jpg",
    "Falafel (1 pc)": "media/items/falafel-side.jpg",
    /* Desserts */
    "Cheese Knafeh": "media/items/cheese-knafeh.jpg",
    "Nutella Knafeh": "media/items/nutella-knafeh.jpg",
    "Pistachio Cup": "media/items/pistachio-cup.jpg",
    "Pistachio Croissant": "media/items/pistachio-croissant.jpg",
    "Dubai Pistachio Chocolate Bar": "media/items/dubai-chocolate-bar.jpg",
    /* Drinks & Slushies */
    "Boom Boom Cocktail": "media/items/boom-boom-cocktail.jpg",
    "Boom Boom Avocado": "media/items/boom-boom-avocado.jpg",
    "Queen Slushie": "media/items/slushie.jpg",
    /* Pancakes */
    "Nutella Pancakes with Fruit": "media/items/nutella-pancakes-fruit.jpg",
    "Nutella Pancakes": "media/items/nutella-pancakes.jpg",
    "Plain Pancakes": "media/items/plain-pancakes.jpg"
  };

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

  /* Cart lines are keyed by item + sauce + holds, so the same wrap with
     Garlic vs Boom stays on separate lines. `price` is the unit price
     including any sauce upcharge. */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem("sq-order") || "{}"); } catch (e) { cart = {}; }
  Object.keys(cart).forEach(function (k) {
    var it = cart[k] || {};
    if (typeof it.price !== "number" || typeof it.qty !== "number" || it.qty < 1) {
      delete cart[k];
      return;
    }
    it.name = it.name || k;
    it.sauce = it.sauce || "";
    it.removed = Array.isArray(it.removed) ? it.removed : [];
  });

  var keyOf = function (name, sauce, removed, opts) {
    var k = name;
    if (opts && opts.length) k += "|" + opts.slice().join(",");
    if (sauce) k += "|" + sauce;
    if (removed && removed.length) k += "|no:" + removed.slice().sort().join(",");
    return k;
  };
  var lineNote = function (it) {
    var parts = [];
    (it.opts || []).forEach(function (o) { parts.push(o); });
    if (it.sauce) parts.push(it.sauce + " sauce");
    (it.removed || []).forEach(function (x) { parts.push("no " + x); });
    return parts.join(", ");
  };
  var money = function (n) { return CURRENCY + n.toFixed(2); };
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
    var hh = ((h % 24) + 24) % 24;   /* wrap past-midnight hours (24 -> 0, 25 -> 1 am) */
    var am = hh < 12;
    var hr = hh % 12 === 0 ? 12 : hh % 12;
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

    /* "This order earns +X crowns" preview */
    var earnEl = panel.querySelector(".order-earn");
    if (earnEl) {
      var willEarn = Math.floor(sub * PUNTOS_PER_DOLLAR * (isTuesday ? TUESDAY_MULTIPLIER : 1));
      earnEl.hidden = n === 0;
      earnEl.querySelector(".order-earn-pts").textContent = "+" + willEarn + " crowns";
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
    try { localStorage.setItem("sq-order", JSON.stringify(cart)); } catch (e) {}
  };

  /* ── Toast ── */

  var toastTimer;
  var showToast = function (msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  };

  var addLine = function (name, unitPrice, sauce, removed, qty, opts) {
    removed = removed || [];
    qty = qty || 1;
    opts = opts || [];
    var k = keyOf(name, sauce, removed, opts);
    if (!cart[k]) cart[k] = { name: name, price: unitPrice, qty: 0, sauce: sauce, removed: removed, opts: opts };
    cart[k].qty += qty;
    render();
    var note = lineNote(cart[k]);
    showToast("Added " + (qty > 1 ? qty + "× " : "") + name + (note ? " · " + note : ""));
  };

  /* ── Add-on popover: quantity, pick-your-sauce, hold-ingredients ── */

  var removeList = addonPop.querySelector(".addon-remove-list");
  var removeDetails = addonPop.querySelector(".addon-remove");
  var sauceRadios = addonPop.querySelectorAll('input[name="sq-sauce"]');
  var sauceBlock = addonPop.querySelector(".addon-sauce-block");
  var dynamic = addonPop.querySelector(".addon-dynamic");
  var imgWrap = addonPop.querySelector(".addon-img-wrap");
  var imgEl = addonPop.querySelector(".addon-img");

  /* addonState carries a full option set so any item can offer size, a
     single pick (bread/style/flavor), price-adding extras, a sauce and
     hold-ingredients — all optional. Chosen options ride along on the
     cart line as an `opts` list so they show in the order and price. */
  var addonState = { name: "", base: 0, qty: 1, hasSauce: false, sauce: "Garlic",
    size: null, pick: "", extras: {} };

  /* ── small DSL parsers for the add buttons ──
     data-size / data-extras: "Label=price|Label=price"  (price optional)
     data-pick / data-bread / data-flavor: "A|B|C"  */
  var splitPipes = function (s) {
    return (s || "").split("|").map(function (x) { return x.trim(); }).filter(Boolean);
  };
  var parsePriced = function (s) {
    return splitPipes(s).map(function (p) {
      var i = p.lastIndexOf("=");
      return i < 0 ? { label: p, price: 0 }
                   : { label: p.slice(0, i).trim(), price: Number(p.slice(i + 1)) };
    });
  };
  var cfgFromEl = function (el) {
    var pickVals = splitPipes(el.getAttribute("data-pick") ||
      el.getAttribute("data-bread") || el.getAttribute("data-flavor"));
    return {
      ingredients: (el.getAttribute("data-ingredients") || "")
        .split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      sauce: el.getAttribute("data-sauce") === "yes",
      size: parsePriced(el.getAttribute("data-size")),
      pickLabel: el.getAttribute("data-pick-label") ||
        (el.getAttribute("data-bread") ? "Bread" : el.getAttribute("data-flavor") ? "Flavor" : "Choice"),
      pick: pickVals,
      extras: parsePriced(el.getAttribute("data-extras"))
    };
  };

  var addonUnit = function () {
    var u = addonState.base;
    if (addonState.hasSauce) u += saucePrice(addonState.sauce);
    for (var k in addonState.extras) if (addonState.extras.hasOwnProperty(k)) u += addonState.extras[k];
    return u;
  };
  var buildOpts = function () {
    var o = [];
    if (addonState.size) o.push(addonState.size.label);
    if (addonState.pick) o.push(addonState.pick);
    for (var k in addonState.extras) if (addonState.extras.hasOwnProperty(k)) o.push(k);
    return o;
  };

  /* build a titled option group in the dynamic area */
  var groupEl = function (title) {
    var g = document.createElement("div");
    g.className = "addon-group";
    var h = document.createElement("p");
    h.className = "addon-sub";
    h.textContent = title;
    g.appendChild(h);
    return g;
  };
  var choiceEl = function (nm, value, checked, tag, type) {
    var lab = document.createElement("label");
    lab.className = "sauce-opt opt-choice";
    var input = document.createElement("input");
    input.type = type; input.name = nm; input.value = value; input.checked = !!checked;
    var text = document.createElement("span");
    text.className = "addon-name"; text.textContent = value;
    lab.appendChild(input); lab.appendChild(text);
    if (tag) { var t = document.createElement("span"); t.className = "sauce-up"; t.textContent = tag; lab.appendChild(t); }
    return lab;
  };

  var renderAddon = function () {
    addonPop.querySelector('[data-count="qty"]').textContent = addonState.qty;
    addonPop.querySelector('[data-qty-step="-1"]').disabled = addonState.qty <= 1;
    addonPop.querySelector(".addon-add").textContent =
      "Add" + (addonState.qty > 1 ? " " + addonState.qty : "") + " — " + money(addonUnit() * addonState.qty);
  };

  var openAddon = function (name, base, cfg) {
    cfg = cfg || {};
    addonState = { name: name, base: Number(base), qty: 1,
      hasSauce: !!cfg.sauce, sauce: "Garlic", size: null, pick: "", extras: {} };
    addonPop.querySelector(".addon-title").textContent = name;

    /* item photo */
    var imgSrc = cfg.img || ITEM_IMAGES[name];
    if (imgSrc) { imgEl.src = imgSrc; imgEl.alt = name; imgWrap.hidden = false; }
    else { imgWrap.hidden = true; imgEl.removeAttribute("src"); }

    dynamic.innerHTML = "";

    /* SIZE — radio that sets the base price */
    if (cfg.size && cfg.size.length) {
      addonState.size = cfg.size[0];
      addonState.base = cfg.size[0].price;
      var gs = groupEl("Size");
      cfg.size.forEach(function (s, i) {
        var lab = choiceEl("sq-size", s.label, i === 0, money(s.price), "radio");
        lab.querySelector("input").addEventListener("change", function () {
          addonState.size = s; addonState.base = s.price; renderAddon();
        });
        gs.appendChild(lab);
      });
      dynamic.appendChild(gs);
    }

    /* PICK — a single no-cost choice (bread / style / flavor) */
    if (cfg.pick && cfg.pick.length) {
      addonState.pick = cfg.pick[0];
      var gp = groupEl(cfg.pickLabel || "Choice");
      cfg.pick.forEach(function (opt, i) {
        var lab = choiceEl("sq-pick", opt, i === 0, "", "radio");
        lab.querySelector("input").addEventListener("change", function () {
          addonState.pick = opt; renderAddon();
        });
        gp.appendChild(lab);
      });
      dynamic.appendChild(gp);
    }

    /* EXTRAS — price-adding checkboxes (double protein, combo, topping) */
    if (cfg.extras && cfg.extras.length) {
      var ge = groupEl("Add-ons");
      cfg.extras.forEach(function (ex) {
        var lab = choiceEl("sq-extra", ex.label, false, ex.price ? "+" + money(ex.price) : "free", "checkbox");
        lab.querySelector("input").addEventListener("change", function (e) {
          if (e.target.checked) addonState.extras[ex.label] = ex.price;
          else delete addonState.extras[ex.label];
          renderAddon();
        });
        ge.appendChild(lab);
      });
      dynamic.appendChild(ge);
    }

    /* SAUCE — only for items that carry a sauce */
    sauceBlock.hidden = !cfg.sauce;
    if (cfg.sauce) sauceRadios.forEach(function (r) { r.checked = r.value === "Garlic"; });

    /* HOLD INGREDIENTS */
    var ingredients = cfg.ingredients || [];
    removeList.innerHTML = "";
    removeDetails.hidden = !ingredients.length;
    removeDetails.open = false;
    ingredients.forEach(function (ing) {
      var label = document.createElement("label");
      label.className = "remove-opt";
      var box = document.createElement("input");
      box.type = "checkbox"; box.value = ing;
      var text = document.createElement("span");
      text.textContent = "No " + ing;
      label.appendChild(box); label.appendChild(text);
      removeList.appendChild(label);
    });

    addonPop.hidden = false;
    addonOverlay.hidden = false;
    document.body.classList.add("sq-noscroll");
    addonPop.scrollTop = 0;
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
    document.body.classList.remove("sq-noscroll");
    setTimeout(function () { addonPop.hidden = true; addonOverlay.hidden = true; }, 250);
  };

  sauceRadios.forEach(function (r) {
    r.addEventListener("change", function () {
      if (r.checked) { addonState.sauce = r.value; renderAddon(); }
    });
  });

  addonPop.addEventListener("click", function (e) {
    var qtyStep = e.target.closest("[data-qty-step]");
    if (qtyStep) {
      addonState.qty = Math.max(1, Math.min(20, addonState.qty + Number(qtyStep.dataset.qtyStep)));
      renderAddon();
      return;
    }
    if (e.target.closest(".addon-add")) {
      var removed = [].map.call(removeList.querySelectorAll("input:checked"), function (b) {
        return b.value;
      });
      addLine(addonState.name, addonUnit(), addonState.hasSauce ? addonState.sauce : "",
        removed, addonState.qty, buildOpts());
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
        addLine(name, price, "", [], 1);
      } else {
        openAddon(name, price, cfgFromEl(add));
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

  /* ── Crown Rewards: points, rewards, installable app ──
     Crowns are stored on this device (loyalty-card style) until a
     backend/POS integration exists. Earn 1 crown per $1, double on
     Tuesdays. Rewards drop into the cart as $0 lines and deduct
     crowns when the order is sent. */

  var PUNTOS_PER_DOLLAR = 1;
  var TUESDAY_MULTIPLIER = 2;
  var INSTALL_BONUS = 25;
  var SIGNUP_BONUS = 50;
  var REWARDS = [
    { id: "sauce", name: "Premium Sauce", cost: 20, item: "Reward: Premium Sauce",
      desc: "Upgrade any wrap to Boom or Queen sauce — the good stuff, on the house.",
      colors: ["#F0AE3A", "#D5421F", "#FFC257"] },
    { id: "chicken", name: "Chicken Wrap", cost: 130, item: "Reward: Chicken Wrap",
      desc: "A full 12″ chicken shawarma wrap — juicy, garlicky, rolled to order. Free.",
      colors: ["#F0AE3A", "#C4863A", "#FFC257"] },
    { id: "beef", name: "Beef Wrap", cost: 140, item: "Reward: Beef Wrap",
      desc: "A full 12″ beef shawarma wrap — charred, shaved thin, rolled tight. Free.",
      colors: ["#D5421F", "#F0AE3A", "#8C2E24"] },
    { id: "combo", name: "Chicken Combo", cost: 180, item: "Reward: Chicken Combo",
      desc: "The whole 12″ chicken combo — wrap, fries, coleslaw & a drink. On us.",
      colors: ["#C4863A", "#F0AE3A", "#B5702A"] }
  ];

  var isTuesday = new Date().getDay() === 2;
  var getPts = function () { return Number(localStorage.getItem("sq-crowns") || 0) || 0; };
  var setPts = function (n) {
    try { localStorage.setItem("sq-crowns", String(Math.max(0, Math.round(n)))); } catch (e) {}
    renderRewards();
  };
  var cartRewardCost = function () {
    return Object.keys(cart).reduce(function (sum, k) {
      return sum + (cart[k].rewardCost || 0);
    }, 0);
  };
  var hasReward = function () { return cartRewardCost() > 0; };

  /* ── Membership (on-device until a backend exists) ── */

  var getAccount = function () {
    try { return JSON.parse(localStorage.getItem("sq-member") || "null"); } catch (e) { return null; }
  };
  var getMember = function () {
    var a = getAccount();
    return a && localStorage.getItem("sq-member-in") === "1" ? a : null;
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
      tab === "signup" ? "Sign up — +" + SIGNUP_BONUS + " crowns" : "Log in";
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
      try { localStorage.removeItem("sq-member-in"); } catch (err) {}
      renderMember();
      showToast("Logged out — your crowns stay safe on this phone");
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
        status.textContent = "Add your name so we know who the shawarma is for.";
        return;
      }
      if (existing && normPhone(existing.phone) !== phone) {
        status.classList.add("error");
        status.textContent = "This phone already has a member (" + existing.name + "). Log out first.";
        return;
      }
      var isNew = !existing;
      try {
        localStorage.setItem("sq-member", JSON.stringify({ name: name, phone: phone }));
        localStorage.setItem("sq-member-in", "1");
      } catch (e) {}
      if (isNew && !localStorage.getItem("sq-signup-bonus")) {
        try { localStorage.setItem("sq-signup-bonus", "1"); } catch (e) {}
        setPts(getPts() + SIGNUP_BONUS);
        showToast("+" + SIGNUP_BONUS + " welcome crowns, " + name.split(" ")[0]);
      } else {
        showToast("Welcome back, " + name.split(" ")[0]);
      }
      renderMember();
      closeMember();
    } else {
      if (existing && normPhone(existing.phone) === phone) {
        try { localStorage.setItem("sq-member-in", "1"); } catch (e) {}
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
    try { return JSON.parse(localStorage.getItem("sq-history") || "[]"); } catch (e) { return []; }
  };
  var addHistory = function (entry) {
    var h = getHistory();
    h.unshift(entry);
    try { localStorage.setItem("sq-history", JSON.stringify(h.slice(0, 20))); } catch (e) {}
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
      pts.textContent = "+" + o.earned + " crowns";
      var items = document.createElement("span");
      items.className = "history-items";
      items.textContent = o.items;
      li.appendChild(top);
      li.appendChild(pts);
      li.appendChild(items);
      historyList.appendChild(li);
    });
  };

  /* Drop a claimed reward into the cart (shared by the tile popup). */
  var claimReward = function (r) {
    if (getPts() < r.cost || hasReward()) return false;
    cart["reward:" + r.id] = {
      name: r.item, price: 0, qty: 1, sauce: "", removed: [],
      rewardCost: r.cost, rewardId: r.id
    };
    render();
    showToast("Reward added to your order");
    openPanel();
    return true;
  };

  /* Paint a few drifting blurred blobs — the AnimatedGradient look, native. */
  var paintGradient = function (host, colors) {
    host.innerHTML = "";
    host.style.setProperty("--gs", (11 + Math.random() * 8).toFixed(1) + "s");
    colors.forEach(function (c, i) {
      var s = document.createElement("span");
      s.style.background = c;
      s.style.top = (Math.random() * 40) + "%";
      s.style.left = (Math.random() * 40) + "%";
      ["--tx1", "--ty1", "--tx2", "--ty2", "--tx3", "--ty3"].forEach(function (v) {
        s.style.setProperty(v, (Math.random() - 0.5).toFixed(3));
      });
      s.style.animationDelay = (-i * 2.5) + "s";
      host.appendChild(s);
    });
  };

  /* ── Reward detail popup ── */

  var rewardBento = document.querySelector(".reward-bento");
  var rewardPop = document.querySelector(".reward-pop");
  var rewardOverlay = document.querySelector(".reward-overlay");
  var rewardCurrent = null;

  var refreshRewardPop = function () {
    if (!rewardPop || rewardPop.hidden || !rewardCurrent) return;
    var r = rewardCurrent, pts = getPts();
    var claim = rewardPop.querySelector(".reward-pop-claim");
    var bal = rewardPop.querySelector(".reward-pop-balance");
    rewardPop.querySelector(".reward-pop-fill").style.width = Math.min(100, (pts / r.cost) * 100) + "%";
    if (hasReward() && !cart["reward:" + r.id]) {
      bal.innerHTML = "You already have a reward in this order — one per order.";
      claim.disabled = true; claim.textContent = "One reward per order";
    } else if (pts >= r.cost) {
      bal.innerHTML = "You have <strong>" + pts + " crowns</strong> — enough to claim this.";
      claim.disabled = false; claim.textContent = "Claim for " + r.cost + " crowns";
    } else {
      bal.innerHTML = "You have <strong>" + pts + " crowns</strong> — " + (r.cost - pts) + " more to go.";
      claim.disabled = true; claim.textContent = "Need " + r.cost + " crowns";
    }
  };

  var openReward = function (r) {
    if (!rewardPop) return;
    rewardCurrent = r;
    rewardPop.querySelector(".addon-title").textContent = r.name;
    rewardPop.querySelector(".reward-pop-cost").textContent = r.cost + " crowns";
    rewardPop.querySelector(".reward-pop-desc").textContent = r.desc;
    paintGradient(rewardPop.querySelector(".reward-pop-grad"), r.colors);
    refreshRewardPop();
    rewardPop.hidden = false;
    rewardOverlay.hidden = false;
    requestAnimationFrame(function () { rewardPop.classList.add("open"); rewardOverlay.classList.add("open"); });
    rewardPop.querySelector(".reward-pop-claim").focus();
  };
  var closeReward = function () {
    if (!rewardPop) return;
    rewardPop.classList.remove("open");
    rewardOverlay.classList.remove("open");
    setTimeout(function () { rewardPop.hidden = true; rewardOverlay.hidden = true; }, 250);
    rewardCurrent = null;
  };

  if (rewardPop) {
    rewardPop.querySelector(".reward-close").addEventListener("click", closeReward);
    rewardOverlay.addEventListener("click", closeReward);
    rewardPop.querySelector(".reward-pop-claim").addEventListener("click", function () {
      if (rewardCurrent && claimReward(rewardCurrent)) closeReward();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !rewardPop.hidden) closeReward();
    });
  }

  var buildRewardTiles = function () {
    rewardBento.innerHTML = "";
    REWARDS.forEach(function (r) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "reward-tile";
      tile.setAttribute("aria-label", r.name + ", " + r.cost + " crowns — tap for details");
      var grad = document.createElement("div");
      grad.className = "reward-grad";
      paintGradient(grad, r.colors);
      var cost = document.createElement("span");
      cost.className = "reward-tile-cost";
      cost.textContent = r.cost + " crowns";
      var name = document.createElement("span");
      name.className = "reward-tile-name";
      name.textContent = r.name;
      var cta = document.createElement("span");
      cta.className = "reward-tile-cta";
      tile.appendChild(grad);
      tile.appendChild(cost);
      tile.appendChild(name);
      tile.appendChild(cta);
      tile.addEventListener("click", function () { openReward(r); });
      rewardBento.appendChild(tile);
    });
  };

  /* Rebuilds state cheaply (tiles + their gradients are built once). */
  var renderRewards = function () {
    document.querySelectorAll(".puntos-count").forEach(function (el) { el.textContent = getPts(); });
    var tb = document.querySelector(".tuesday-badge");
    if (tb) tb.hidden = !isTuesday;
    if (rewardBento) {
      if (!rewardBento.children.length) buildRewardTiles();
      var pts = getPts();
      [].forEach.call(rewardBento.children, function (tile, idx) {
        var r = REWARDS[idx];
        var aff = pts >= r.cost;
        tile.classList.toggle("affordable", aff);
        tile.classList.toggle("locked", !aff);
        tile.querySelector(".reward-tile-cta").textContent = aff ? "Ready to claim →" : (r.cost - pts) + " crowns to go";
      });
    }
    refreshRewardPop();
  };

  /* ── Installable app (PWA) ── */

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  var grantInstallBonus = function () {
    if (localStorage.getItem("sq-install-bonus")) return;
    try { localStorage.setItem("sq-install-bonus", "1"); } catch (e) {}
    setPts(getPts() + INSTALL_BONUS);
    showToast("+" + INSTALL_BONUS + " welcome crowns");
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
    clearBtn.innerHTML = 'Clear all <span class="tl">· ifragh</span>';
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
      statusEl.textContent = "Not enough crowns for that reward — remove it or keep earning.";
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
    lines.push("Crowns: " + (redeemed ? "-" + redeemed + " redeemed, " : "") +
      "+" + earned + " earned" + (isTuesday ? " (double Tuesday)" : ""));

    if (link) window.open(link, "_blank", "noopener");

    var orderSubject = (isDelivery ? "Delivery" : "Pickup") + " order — " + name;
    var orderBody = lines.join("\n");
    var toMailtoOrder = function () {
      window.location.href = "mailto:" + ORDER_EMAIL +
        "?subject=" + encodeURIComponent(orderSubject) +
        "&body=" + encodeURIComponent(orderBody);
    };

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

    if (window.SQForms && window.SQForms.hasInbox()) {
      statusEl.textContent = "Sending your order…";
      window.SQForms.send(orderSubject, { name: name, phone: phone, order: orderBody })
        .then(function (ok) {
          if (ok) {
            statusEl.textContent = link
              ? "Order sent! Finish paying in the tab we opened — we'll text you to confirm."
              : "Order sent! We'll text you at " + phone + " to confirm. 👑";
          } else { toMailtoOrder(); }
        });
    } else {
      toMailtoOrder();
      statusEl.textContent = link
        ? "Payment page opened in a new tab — finish paying there, and send the order email so we can confirm."
        : "Opening your email app to send the order — we'll text you to confirm.";
    }
  });

  /* Tiny public hook so other UI (the radial menu) can drop items into the
     cart through the same flow the menu buttons use. */
  window.SQOrder = {
    add: function (name, price, ingredients, addons) {
      if (addons === false) addLine(name, Number(price), "", [], 1);
      else openAddon(name, Number(price), { ingredients: ingredients || [], sauce: true });
    },
    /* drop an item into the cart straight from a DOM node's data-* config */
    addEl: function (el) {
      if (!el) return;
      var name = el.getAttribute("data-name");
      var price = Number(el.getAttribute("data-price"));
      if (el.getAttribute("data-addons") === "no") addLine(name, price, "", [], 1);
      else openAddon(name, price, cfgFromEl(el));
    },
    open: openPanel
  };

  render();
  renderHistory();

  /* Drop a photo thumbnail into every menu row that has a mapped image. */
  document.querySelectorAll("#carta .carta-row").forEach(function (row) {
    var btn = row.querySelector(".add-btn");
    if (!btn) return;
    var src = ITEM_IMAGES[btn.getAttribute("data-name")];
    if (!src || row.querySelector(".carta-thumb")) return;
    var thumb = document.createElement("span");
    thumb.className = "carta-thumb";
    var im = document.createElement("img");
    im.src = src; im.alt = ""; im.loading = "lazy";
    thumb.appendChild(im);
    row.insertBefore(thumb, row.firstChild);
  });
})();

/* ── Open-late band: WebGL ember fluid ──
   Procedural-noise fluid with warm chromatic glints (pomegranate / gold /
   cream) over a plum-black ground — charcoal-glow atmosphere for the
   "open till 3:30 am" section. Ported to plain WebGL; runs only while the
   band is on screen, and stands down for prefers-reduced-motion (the CSS
   ember gradient shows instead). */

(function () {
  "use strict";

  var host = document.querySelector(".latenight");
  var canvas = document.querySelector(".latenight-canvas");
  if (!host || !canvas) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var gl = canvas.getContext("webgl", { antialias: true });
  if (!gl) return;

  var VS = [
    "attribute vec2 position;",
    "varying vec2 vUv;",
    "void main(){ vUv=(position+1.0)*0.5; gl_Position=vec4(position,0.0,1.0); }"
  ].join("\n");

  var FS = [
    "precision highp float;",
    "uniform vec2 u_resolution;",
    "uniform float u_time;",
    "uniform float u_flowStrength;",
    "uniform float u_grain;",
    "uniform float u_contrast;",
    "uniform float u_speed;",
    "varying vec2 vUv;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }",
    "float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y); }",
    "float fbm(vec2 p){ float v=0.0; float a=0.5; mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));",
    "  for(int i=0;i<4;i++){ v+=a*noise(p); p=rot*p*2.0; a*=0.5; } return v; }",
    "void main(){",
    "  vec2 uv=vUv; float t=u_time*u_speed;",
    "  vec2 p=(uv-0.5)*vec2(u_resolution.x/u_resolution.y,1.0)*2.0;",
    "  float baseNoise=fbm(p*0.8+t*0.2);",
    "  float fluid=fbm(p*1.2+baseNoise*u_flowStrength+t*0.3);",
    "  float eps=0.01;",
    "  float nx=fbm(p+vec2(eps,0.0)+baseNoise*u_flowStrength+t*0.3)-fluid;",
    "  float ny=fbm(p+vec2(0.0,eps)+baseNoise*u_flowStrength+t*0.3)-fluid;",
    "  vec3 normal=normalize(vec3(nx,ny,eps*1.5));",
    "  vec3 lightDir=normalize(vec3(1.0,1.0,0.8)); vec3 viewDir=vec3(0.0,0.0,1.0);",
    "  vec3 halfVector=normalize(lightDir+viewDir);",
    "  vec3 color=vec3(0.0); float glintIntensity=64.0;",
    "  float specR=pow(max(dot(normalize(vec3(nx+0.005,ny,eps*1.5)),halfVector),0.0),glintIntensity);",
    "  float specG=pow(max(dot(normal,halfVector),0.0),glintIntensity);",
    "  float specB=pow(max(dot(normalize(vec3(nx-0.005,ny,eps*1.5)),halfVector),0.0),glintIntensity);",
    "  vec3 cPome=vec3(0.84,0.26,0.12); vec3 cGold=vec3(0.94,0.68,0.23); vec3 cCream=vec3(0.96,0.91,0.85);",
    "  vec3 specular=(specR*cPome + specG*cGold + specB*cCream)*1.7;",
    "  color+=specular;",
    "  color=mix(vec3(0.5),color,u_contrast);",
    "  color+=vec3(0.06,0.035,0.025);",  // plum-black ground instead of pure black
    "  float vig=smoothstep(1.8,0.2,length(uv-0.5)); color*=vig;",
    "  color+=(hash(uv+t)-0.5)*u_grain;",
    "  gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);",
    "}"
  ].join("\n");

  var compile = function (type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {
    res: gl.getUniformLocation(prog, "u_resolution"),
    time: gl.getUniformLocation(prog, "u_time"),
    flow: gl.getUniformLocation(prog, "u_flowStrength"),
    grain: gl.getUniformLocation(prog, "u_grain"),
    contrast: gl.getUniformLocation(prog, "u_contrast"),
    speed: gl.getUniformLocation(prog, "u_speed")
  };

  var resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
  };
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
  else window.addEventListener("resize", resize);

  var start = null, raf = null;
  var frame = function (now) {
    if (start === null) start = now;
    gl.uniform1f(U.time, (now - start) / 1000);
    gl.uniform1f(U.flow, 0.85);
    gl.uniform1f(U.grain, 0.05);
    gl.uniform1f(U.contrast, 1.06);
    gl.uniform1f(U.speed, 0.3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(frame);
  };
  var play = function () { if (raf === null) { raf = requestAnimationFrame(frame); canvas.classList.add("on"); } };
  var pause = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) play(); else pause(); });
    }, { threshold: 0.04 }).observe(host);
  } else {
    play();
  }
})();

/* ── Dock-style magnify on the top nav (pointer + desktop only) ── */

(function () {
  "use strict";
  var nav = document.querySelector(".nav-dock");
  if (!nav) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var items = [].slice.call(nav.querySelectorAll("a, .nav-drop summary"));
  var MAXS = 1.24, RANGE = 100;
  nav.addEventListener("mousemove", function (e) {
    items.forEach(function (it) {
      var r = it.getBoundingClientRect();
      var d = Math.abs(e.clientX - (r.left + r.width / 2));
      var s = 1 + (MAXS - 1) * Math.max(0, 1 - d / RANGE);
      it.style.setProperty("--scale", s.toFixed(3));
    });
  });
  nav.addEventListener("mouseleave", function () {
    items.forEach(function (it) { it.style.setProperty("--scale", "1"); });
  });
})();

/* ── The Court: interactive radial menu ──
   Nodes orbit the crown; tap one to load it into the center, then "Add to
   order" drops it into the cart through the shared SQOrder hook (which opens
   the pick-your-sauce step). Rotation pauses on selection and while off
   screen, and holds still for prefers-reduced-motion (still fully clickable). */

(function () {
  "use strict";
  var orbit = document.getElementById("court-orbit");
  if (!orbit) return;
  var nodes = [].slice.call(orbit.querySelectorAll(".court-node"));
  if (!nodes.length) return;

  var coreHint = orbit.querySelector(".court-core-hint");
  var detail = document.getElementById("court-detail");
  var elTag = detail.querySelector(".court-detail-tag");
  var elTitle = detail.querySelector(".court-detail-title");
  var elPrice = detail.querySelector(".court-detail-price");
  var elDesc = detail.querySelector(".court-detail-desc");
  var addBtn = detail.querySelector(".court-detail-add");
  var detailTimer = null;

  var N = nodes.length;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rotation = 0, selected = null, raf = null, last = 0;

  var place = function () {
    for (var i = 0; i < N; i++) {
      var node = nodes[i];
      var ang = ((i * 360 / N) + rotation) * Math.PI / 180;
      var oy = Math.sin(ang);
      node.style.setProperty("--ox", Math.cos(ang).toFixed(4));
      node.style.setProperty("--oy", oy.toFixed(4));
      var depth = (oy + 1) / 2;
      node.style.opacity = (node === selected ? 1 : (0.55 + 0.45 * depth)).toFixed(3);
      node.style.zIndex = String(node === selected ? 60 : Math.round(10 + 20 * depth));
    }
  };

  var frame = function (now) {
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (!selected) rotation = (rotation + dt * 6) % 360;
    place();
    raf = requestAnimationFrame(frame);
  };
  var start = function () { if (raf === null && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };
  var stop = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };

  var showItem = function (node) {
    selected = node;
    nodes.forEach(function (nn) { nn.classList.toggle("is-active", nn === node); });
    elTag.textContent = node.getAttribute("data-tag") || "";
    elTitle.textContent = node.getAttribute("data-name");
    elPrice.textContent = "$" + node.getAttribute("data-price");
    elDesc.textContent = node.getAttribute("data-desc") || "";
    if (coreHint) coreHint.textContent = "Selected";
    clearTimeout(detailTimer);
    detail.hidden = false;
    requestAnimationFrame(function () { detail.classList.add("open"); });
    place();
  };
  var clearItem = function () {
    selected = null;
    nodes.forEach(function (nn) { nn.classList.remove("is-active"); });
    if (coreHint) coreHint.textContent = "Tap a dish";
    detail.classList.remove("open");
    clearTimeout(detailTimer);
    detailTimer = setTimeout(function () { detail.hidden = true; }, 280);
  };

  nodes.forEach(function (node) {
    node.addEventListener("click", function (e) {
      e.stopPropagation();
      if (selected === node) clearItem();
      else showItem(node);
    });
  });

  addBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (!selected || !window.SQOrder) return;
    window.SQOrder.addEl(selected);
  });

  orbit.addEventListener("click", function (e) {
    if (e.target === orbit || (e.target.classList && e.target.classList.contains("court-ring"))) clearItem();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && selected) clearItem();
  });

  place();
  if (reduced) return;

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
    }, { threshold: 0.05 }).observe(orbit);
  } else {
    start();
  }
})();

/* ── Our Story: rotating gold dot-globe (Canvas 2D, no dependencies) ──
   A Fibonacci-sphere of gold dots that turns slowly behind the story copy.
   The React reference used Three.js/react-three-fiber; this is the same look
   without the WebGL/build weight. Pauses off-screen and for reduced motion. */

(function () {
  "use strict";
  var section = document.querySelector(".story-globe");
  var canvas = section && section.querySelector(".globe-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var N = 640, pts = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < N; i++) {
    var y = 1 - (i / (N - 1)) * 2;
    var r = Math.sqrt(1 - y * y);
    var th = ga * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }

  var dpr = 1, W = 0, H = 0, cx = 0, cy = 0, R = 0;
  var resize = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = section.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width * dpr));
    H = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = W; canvas.height = H;
    cx = W / 2; cy = H / 2;
    R = Math.min(W, H) * 0.42;
  };
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(section);
  else window.addEventListener("resize", resize);

  var ay = 0, ax = 0.42, raf = null, last = 0;
  var draw = function () {
    ctx.clearRect(0, 0, W, H);
    var cosY = Math.cos(ay), sinY = Math.sin(ay), cosX = Math.cos(ax), sinX = Math.sin(ax);
    for (var i = 0; i < N; i++) {
      var p = pts[i];
      var x1 = p[0] * cosY - p[2] * sinY;
      var z1 = p[0] * sinY + p[2] * cosY;
      var y2 = p[1] * cosX - z1 * sinX;
      var z2 = p[1] * sinX + z1 * cosX;
      var depth = (z2 + 1) / 2;                 // 0 back .. 1 front
      ctx.beginPath();
      ctx.arc(cx + x1 * R, cy - y2 * R, (0.6 + depth * 1.7) * dpr, 0, 6.2832);
      ctx.fillStyle = "rgba(240,174,58," + (0.12 + depth * 0.62).toFixed(3) + ")";
      ctx.fill();
    }
  };

  var frame = function (now) {
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    ay += dt * 0.28;
    ax += dt * 0.05;
    draw();
    raf = requestAnimationFrame(frame);
  };
  var start = function () { if (raf === null && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };
  var stop = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };

  draw();
  requestAnimationFrame(function () { canvas.classList.add("on"); });
  if (reduced) return;

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
    }, { threshold: 0.02 }).observe(section);
  } else {
    start();
  }
})();

/* ── Spotlight card: a radial glow that follows the pointer over the hero
   logo panel (vanilla port of the 21st.dev Spline/Spotlight card). ── */
(function () {
  "use strict";
  var card = document.querySelector("[data-spotlight]");
  if (!card) return;
  var spot = card.querySelector(".spotlight");
  if (!spot) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  card.addEventListener("pointermove", function (e) {
    var r = card.getBoundingClientRect();
    spot.style.left = (e.clientX - r.left) + "px";
    spot.style.top = (e.clientY - r.top) + "px";
  });
})();


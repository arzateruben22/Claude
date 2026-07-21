/* Shawarma Queen — interactions & motion
   All entrance states are set from JS so the page is fully
   readable with JavaScript disabled. */

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
  /* TODO: swap the address below for Shawarma Queen's real inbox, or wire
     the form to a service like Formspree for direct submissions. */
  var CATERING_EMAIL = "hello@shawarmaqueen.example";
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
    { id: "Boom", price: 1 },
    { id: "Queen", price: 1 }
  ];
  var saucePrice = function (id) {
    for (var i = 0; i < SAUCES.length; i++) if (SAUCES[i].id === id) return SAUCES[i].price;
    return 0;
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

  var keyOf = function (name, sauce, removed) {
    var k = name;
    if (sauce) k += "|" + sauce;
    if (removed && removed.length) k += "|no:" + removed.slice().sort().join(",");
    return k;
  };
  var lineNote = function (it) {
    var parts = [];
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

  var addLine = function (name, unitPrice, sauce, removed, qty) {
    removed = removed || [];
    qty = qty || 1;
    var k = keyOf(name, sauce, removed);
    if (!cart[k]) cart[k] = { name: name, price: unitPrice, qty: 0, sauce: sauce, removed: removed };
    cart[k].qty += qty;
    render();
    var note = lineNote(cart[k]);
    showToast("Added " + (qty > 1 ? qty + "× " : "") + name + (note ? " · " + note : ""));
  };

  /* ── Add-on popover: quantity, pick-your-sauce, hold-ingredients ── */

  var addonState = { name: "", base: 0, qty: 1, sauce: "Garlic" };
  var removeList = addonPop.querySelector(".addon-remove-list");
  var removeDetails = addonPop.querySelector(".addon-remove");
  var sauceRadios = addonPop.querySelectorAll('input[name="sq-sauce"]');

  var addonUnit = function () { return addonState.base + saucePrice(addonState.sauce); };

  var renderAddon = function () {
    addonPop.querySelector('[data-count="qty"]').textContent = addonState.qty;
    addonPop.querySelector('[data-qty-step="-1"]').disabled = addonState.qty <= 1;
    addonPop.querySelector(".addon-add").textContent =
      "Add" + (addonState.qty > 1 ? " " + addonState.qty : "") + " — " + money(addonUnit() * addonState.qty);
  };

  var openAddon = function (name, base, ingredients) {
    addonState = { name: name, base: base, qty: 1, sauce: "Garlic" };
    addonPop.querySelector(".addon-title").textContent = name;

    /* reset sauce to the included Garlic */
    sauceRadios.forEach(function (r) { r.checked = r.value === "Garlic"; });

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
      addLine(addonState.name, addonUnit(), addonState.sauce, removed, addonState.qty);
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
    { id: "sauce", name: "Premium sauce (Boom or Queen)", cost: 20, item: "Reward: Premium Sauce" },
    { id: "chicken", name: "12″ Chicken Shawarma Wrap", cost: 130, item: "Reward: Chicken Wrap" },
    { id: "beef", name: "12″ Beef Shawarma Wrap", cost: 140, item: "Reward: Beef Wrap" },
    { id: "combo", name: "12″ Chicken Combo", cost: 180, item: "Reward: Chicken Combo" }
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
      cost.textContent = r.cost + " crowns";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rewards-claim";
      btn.textContent = "Claim";
      btn.disabled = getPts() < r.cost || hasReward();
      btn.addEventListener("click", function () {
        if (getPts() < r.cost || hasReward()) return;
        cart["reward:" + r.id] = {
          name: r.item, price: 0, qty: 1, sauce: "", removed: [],
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
    "  vec3 cPome=vec3(0.93,0.26,0.40); vec3 cGold=vec3(0.96,0.71,0.24); vec3 cCream=vec3(0.97,0.93,0.87);",
    "  vec3 specular=(specR*cPome + specG*cGold + specB*cCream)*1.7;",
    "  color+=specular;",
    "  color=mix(vec3(0.5),color,u_contrast);",
    "  color+=vec3(0.055,0.02,0.09);",  // plum-black ground instead of pure black
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

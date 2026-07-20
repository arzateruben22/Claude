/* Taqueria Los Güeros — interactions & motion
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

  var payMethods = function () {
    var m = [];
    if (PAYMENT_LINKS.stripe) {
      m.push({ id: "card-online", label: "Card online", hint: "secure checkout, pay now" });
    }
    if (PAYMENT_LINKS.paypalMe) {
      m.push({ id: "paypal", label: "PayPal", hint: "pay now, exact total" });
    }
    if (PAYMENT_LINKS.venmo) {
      m.push({ id: "venmo", label: "Venmo", hint: "pay now, exact total" });
    }
    if (mode() === "delivery") {
      m.push({ id: "card-door", label: "Card at the door", hint: "our driver brings a reader" });
    } else {
      m.push({ id: "counter", label: "Card or cash at the counter", hint: "pay at pickup" });
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

  var renderPayment = function () {
    var methods = payMethods();
    if (!methods.some(function (m) { return m.id === selectedPay; })) selectedPay = null;
    payOptions.innerHTML = "";
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
    renderSlots();
    renderPayment();
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
        cart[k].qty += Number(qty.dataset.delta);
        if (cart[k].qty <= 0) delete cart[k];
        render();
      }
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
      statusEl.textContent = "Choose how you're paying before sending your order.";
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
    var payMethod = payMethods().filter(function (m) { return m.id === selectedPay; })[0];
    var link = payLink(selectedPay);

    lines.push("", "Total items: " + count(),
      "Subtotal: " + money(subtotal()) + " (plus tax)", "Phone: " + phone);
    if (isDelivery) lines.push("Address: " + address);
    lines.push("Payment: " + payMethod.label.toUpperCase() +
      (link ? " — customer opened the payment page for " + money(subtotal()) + ", confirm receipt" : ""));

    if (link) window.open(link, "_blank", "noopener");
    window.location.href = "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent((isDelivery ? "Delivery" : "Pickup") + " order — " + name) +
      "&body=" + encodeURIComponent(lines.join("\n"));
    statusEl.textContent = link
      ? "Payment page opened in a new tab — finish paying there, and send the order email so we can confirm."
      : "Opening your email app to send the order — we'll text you to confirm.";
  });

  render();
})();

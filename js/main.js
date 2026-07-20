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

/* ── Ordering: cart, pickup scheduling, delivery gate ──
   Orders are composed client-side and sent as a prefilled email.
   TODO before launch: set ORDER_EMAIL to the taqueria's inbox, or wire
   sendOrder() to a POS/payment provider (Square, Stripe, Toast) for
   real card payments. Keep OPEN_HOURS in sync with the hours shown
   in the Visit Us section. */

(function () {
  "use strict";

  var ORDER_EMAIL = "hola@losguerosanaheim.com";
  var DELIVERY_MIN = 50;            /* dollars, delivery unlocks here */
  var PICKUP_LEAD_MIN = 20;         /* minutes until earliest pickup */
  var DELIVERY_LEAD_MIN = 45;       /* minutes until earliest delivery */
  var LAST_ORDER_BEFORE_CLOSE = 30; /* minutes before closing */
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
  var gateFill = panel.querySelector(".gate-fill");
  var gateText = panel.querySelector(".gate-text");
  var daySel = document.getElementById("order-day");
  var timeSel = document.getElementById("order-time");
  var addressField = panel.querySelector(".order-address-field");
  var statusEl = panel.querySelector(".order-status");
  var deliveryRadio = panel.querySelector('input[value="delivery"]');
  var pickupRadio = panel.querySelector('input[value="pickup"]');

  var cart = {};
  try { cart = JSON.parse(localStorage.getItem("lg-order") || "{}"); } catch (e) { cart = {}; }

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
    /* Day options: today only if it still has slots */
    daySel.innerHTML = "";
    var dayNames = ["Today", "Tomorrow", "Day after tomorrow"];
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

    itemsEl.innerHTML = "";
    Object.keys(cart).forEach(function (k) {
      var it = cart[k];
      var li = document.createElement("li");
      li.className = "order-item";
      li.innerHTML =
        '<button class="qty-btn" type="button" data-name="' + k + '" data-delta="-1" aria-label="Remove one ' + k + '">−</button>' +
        '<span class="order-item-qty">' + it.qty + "</span>" +
        '<button class="qty-btn" type="button" data-name="' + k + '" data-delta="1" aria-label="Add one ' + k + '">+</button>' +
        '<span class="order-item-name">' + k + "</span>" +
        '<span class="order-item-price">' + money(it.price * it.qty) + "</span>";
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
    try { localStorage.setItem("lg-order", JSON.stringify(cart)); } catch (e) {}
  };

  /* ── Cart actions ── */

  var toastTimer;
  var showToast = function (msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  };

  document.addEventListener("click", function (e) {
    var add = e.target.closest(".add-btn");
    if (add) {
      var name = add.getAttribute("data-name");
      if (!cart[name]) cart[name] = { price: Number(add.getAttribute("data-price")), qty: 0 };
      cart[name].qty += 1;
      render();
      showToast("Added " + name);
      return;
    }
    var qty = e.target.closest(".qty-btn");
    if (qty) {
      var qName = qty.getAttribute("data-name");
      if (cart[qName]) {
        cart[qName].qty += Number(qty.getAttribute("data-delta"));
        if (cart[qName].qty <= 0) delete cart[qName];
        render();
        if (count() === 0) closePanel();
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
  panel.querySelector(".order-browse").addEventListener("click", function () {
    closePanel();
    document.getElementById("carta").scrollIntoView({ behavior: "smooth" });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) closePanel();
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

    var when;
    if (timeSel.value === "asap") {
      when = "ASAP (about " + PICKUP_LEAD_MIN + " min)";
    } else {
      when = daySel.options[daySel.selectedIndex].textContent + " at " +
             timeSel.options[timeSel.selectedIndex].textContent;
    }

    var lines = [(isDelivery ? "DELIVERY" : "PICKUP") + " order — " + name, "When: " + when, ""];
    Object.keys(cart).forEach(function (k) {
      lines.push(cart[k].qty + "x " + k + " — " + money(cart[k].price * cart[k].qty));
    });
    lines.push("", "Subtotal: " + money(subtotal()) + " (plus tax)", "Phone: " + phone);
    if (isDelivery) {
      lines.push("Address: " + address, "Payment: CARD ONLY at the door");
    } else {
      lines.push("Payment: at the counter (card or cash)");
    }

    window.location.href = "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent((isDelivery ? "Delivery" : "Pickup") + " order — " + name) +
      "&body=" + encodeURIComponent(lines.join("\n"));
    statusEl.textContent = "Opening your email app to send the order — we'll text you to confirm.";
  });

  render();
})();

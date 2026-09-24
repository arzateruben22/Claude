/* Lumevina — Glow Routine: the product membership
 *
 * From $75 a month, no facial included, so it takes none of Evelyn's hours.
 * Each focus is its own tier and price, like the memberships:
 *   Glow $75 · Clear $85 · Ageless $95 (the Le Mieux booster costs more)
 *   each month   refills from our shelf and a daily skin supplement,
 *                chosen by Evelyn for the client's focus
 *   each season  the routine updated as the skin changes
 *   each quarter a 15-minute video skin check
 *   always       10% off facials and first look at openings; skip a month
 *                or cancel anytime
 *
 * Demo: subscriptions live in this browser (lumevina_routines). Every charge
 * is written to the retail sales log with what the box cost (product at
 * about half the price, plus shipping or packaging), so the dashboard's
 * books count the income and the cost. Live, this is a Stripe subscription
 * like the Glow Membership (server/README.md).
 */
(function () {
  "use strict";

  var KEY = "lumevina_routines";
  var SALES_KEY = "lumevina_retail_sales";
  var PRICE = 75;                          /* the entry tier; each focus sets its own below */
  var PRODUCT_SHARE = 0.5;                 /* wholesale is usually about half the price */
  var SHIP_COST = 7, PICKUP_COST = 1;      /* shipping and packaging, or just the bag */

  var FOCUS = {
    glow: { name: "Glow", price: 75, tier: 1, line: "Brightness, tone and a healthy glow",
      box: "A cleanser or SPF refill as you need it, a brightening step, and a daily skin supplement" },
    clear: { name: "Clear", price: 85, tier: 2, line: "Breakouts, congestion and calm skin",
      box: "Acne-safe refills from Face Reality and GlyMed+, and a daily skin supplement" },
    ageless: { name: "Ageless", price: 95, tier: 3, line: "Firmness, fine lines and bounce",
      box: "A Le Mieux booster or SPF refill as you need it, and a daily skin supplement" }
  };

  var pay = window.LumevinaPayments;
  var card = document.querySelector(".routine-card");
  var modal = document.querySelector(".routine-modal");
  var overlay = document.querySelector(".routine-overlay");
  if (!card || !modal || !pay) return;

  var $ = function (sel) { return modal.querySelector(sel); };
  var money = function (n) { return "$" + Number(n).toFixed(Number(n) % 1 ? 2 : 0); };
  var norm = function (e) { return (e || "").trim().toLowerCase(); };
  var load = function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  var save = function (all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode */ } };
  var fmtDate = function (iso) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  var me = function () { var s = window.LumevinaAccount && window.LumevinaAccount.current(); return s ? load()[norm(s.email)] : null; };

  /* the next box goes out the first week of next month */
  var nextBox = function () {
    var d = new Date(); d.setMonth(d.getMonth() + 1, 3); d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  /* ── focus chips (the card and the window share one choice) ── */
  var focus = "glow";
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var shownPrice = FOCUS.glow.price;
  /* the price rolls to the new tier's, on the card and in the window */
  var rollPrice = function (to) {
    var els = document.querySelectorAll(".rt-amt, .routine-modal .mj-price");
    var put = function (v) { els.forEach(function (e) { e.textContent = "$" + Math.round(v); }); };
    if (calm || to === shownPrice) { put(to); shownPrice = to; return; }
    var from = shownPrice, t0 = performance.now(), dur = 320;
    var tick = function (now) {
      var u = Math.min(1, (now - t0) / dur);
      put(from + (to - from) * (1 - Math.pow(1 - u, 3)));
      if (u < 1) requestAnimationFrame(tick); else shownPrice = to;
    };
    requestAnimationFrame(tick);
  };
  var setFocus = function (f) {
    focus = FOCUS[f] ? f : "glow";
    var price = FOCUS[focus].price;
    card.setAttribute("data-tier", FOCUS[focus].tier);
    rollPrice(price);
    $(".rt-agree-price").textContent = "$" + price;
    $(".rt-pay .btn-mb-inner").textContent = "Start my routine · $" + price + "/month";
    document.querySelectorAll(".rt-focus [data-focus]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.getAttribute("data-focus") === focus));
    });
    $(".rt-focus-name").textContent = FOCUS[focus].name;
    $(".rt-focus-line").textContent = FOCUS[focus].line;
    $(".rt-box").textContent = FOCUS[focus].box + ", chosen by Evelyn";
  };
  document.querySelectorAll(".rt-focus").forEach(function (group) {
    group.addEventListener("click", function (e) {
      var b = e.target.closest("[data-focus]");
      if (b) setFocus(b.getAttribute("data-focus"));
    });
    /* arrow keys move between the chips, like any radio group */
    group.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var ids = Object.keys(FOCUS), i = ids.indexOf(focus);
      i = (i + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length;
      setFocus(ids[i]);
      var next = group.querySelector('[data-focus="' + ids[i] + '"]');
      if (next) next.focus();
      e.preventDefault();
    });
  });

  /* ── the card reflects a routine already running ── */
  var renderCard = function () {
    var r = me(), start = card.querySelector(".rt-start");
    if (r && r.status === "active") {
      start.textContent = "Your " + FOCUS[r.focus].name + " routine · next box " + fmtDate(r.nextBoxAt);
      start.classList.add("is-mine");
      setFocus(r.focus);
    } else {
      start.textContent = "Start my routine";
      start.classList.remove("is-mine");
    }
  };

  /* ── the sign-up window ── */
  var usingSaved = false, lastFocus = null;
  var delivery = function () { var c = modal.querySelector('input[name="rt-delivery"]:checked'); return c ? c.value : "ship"; };
  var syncDelivery = function () { $(".rt-address-field").hidden = delivery() !== "ship"; };
  var setupCard = function () {
    var saved = pay.getCard && pay.getCard($("#rt-email").value);
    usingSaved = !!saved;
    $(".rt-saved").hidden = !saved;
    $(".rt-card-fields").hidden = !!saved;
    if (saved) $(".rt-saved-info").textContent = "💳 " + saved.brand + " •••• " + saved.last4 + " on file";
  };

  var open = function () {
    var r = me();
    if (r && r.status === "active") {
      showDone("Your " + FOCUS[r.focus].name + " routine", "Next box: " + fmtDate(r.nextBoxAt) + ", " +
        (r.delivery === "ship" ? "shipped to you." : "waiting at the front.") +
        " Skip a month or change your focus any time from here, or with Evelyn at your next check-in.");
    } else {
      var s = window.LumevinaAccount && window.LumevinaAccount.current();
      $(".rt-form").hidden = false; $(".rt-done").hidden = true;
      $("#rt-name").value = s ? s.name : "";
      $("#rt-email").value = s ? s.email : "";
      $("#rt-agree").checked = false;
      $(".rt-status").textContent = "";
      setupCard(); syncDelivery();
    }
    lastFocus = document.activeElement;
    overlay.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modal.focus();
  };
  var close = function () {
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };
  var showDone = function (title, body) {
    $(".rt-form").hidden = true; $(".rt-done").hidden = false;
    $(".rt-done-title").textContent = title;
    $(".rt-done-body").textContent = body;
  };

  var submit = function () {
    var name = $("#rt-name").value.trim(), email = $("#rt-email").value.trim(), ship = delivery() === "ship";
    var problems = [];
    if (!name) problems.push("your name");
    if (!email || !$("#rt-email").checkValidity()) problems.push("a valid email");
    if (ship && $("#rt-address").value.trim().length < 6) problems.push("a shipping address");
    if (!usingSaved) {
      if (!pay.cardValid($("#rt-card").value)) problems.push("a valid card number");
      if (!pay.expiryValid($("#rt-expiry").value)) problems.push("a future expiry (MM/YY)");
      if (!pay.cvcValid($("#rt-cvc").value)) problems.push("a 3–4 digit CVC");
    }
    if (!$("#rt-agree").checked) problems.push("agreement to the monthly terms");
    if (problems.length) { $(".rt-status").textContent = "Please add " + problems.join(", ") + "."; return; }
    var all = load();
    if (all[norm(email)] && all[norm(email)].status === "active") {
      $(".rt-status").textContent = "That email already has a Glow Routine. Open it from the Shop to manage it.";
      return;
    }
    var btn = $(".rt-pay");
    btn.disabled = true;
    $(".rt-status").textContent = "Starting your routine…";
    var price = FOCUS[focus].price;
    pay.process({ amount: price, description: "Glow Routine (" + FOCUS[focus].name + ") — first month" }, function (err, res) {
      btn.disabled = false;
      if (err) { $(".rt-status").textContent = "Payment failed. Please try again."; return; }
      $(".rt-status").textContent = "";
      var saved = usingSaved ? pay.getCard(email) : pay.saveCard(email, $("#rt-card").value, $("#rt-expiry").value);
      var now = new Date().toISOString();
      var rec = { email: email, name: name, focus: focus, delivery: ship ? "ship" : "pickup",
        address: ship ? $("#rt-address").value.trim() : "", price: price, status: "active",
        startedAt: now, nextBoxAt: nextBox(), card: saved ? { brand: saved.brand, last4: saved.last4 } : null,
        history: [{ at: now, type: "joined", amount: price, order: res.id }] };
      all[norm(email)] = rec;
      save(all);
      /* the books: income at the price paid, cost = product + shipping or the bag */
      var log;
      try { log = JSON.parse(localStorage.getItem(SALES_KEY)) || []; } catch (e) { log = []; }
      log.push({ id: "glow-routine", name: "Glow Routine · " + FOCUS[focus].name, qty: 1, price: price, paid: price,
        cost: price * PRODUCT_SHARE + (ship ? SHIP_COST : PICKUP_COST), at: now, channel: "subscription", type: "sale",
        note: "First month" });
      try { localStorage.setItem(SALES_KEY, JSON.stringify(log)); } catch (e) { /* private mode */ }
      if (window.LumevinaAccount && window.LumevinaAccount.signIn) window.LumevinaAccount.signIn(name, email);
      showDone("Your " + FOCUS[focus].name + " routine is on, " + name.split(" ")[0] + ".",
        "Evelyn will choose your first box and send a note on what's in it and how to use it. It " +
        (ship ? "ships " : "is ready at the front ") + fmtDate(rec.nextBoxAt) + ". Your first video check-in comes next " +
        "season, and facials are 10% off from today. Order " + res.id + ".");
      renderCard();
    });
  };

  card.querySelector(".rt-start").addEventListener("click", open);
  $(".rt-close").addEventListener("click", close);
  $(".rt-finish").addEventListener("click", close);
  overlay.addEventListener("click", close);
  $(".rt-pay").addEventListener("click", submit);
  $("#rt-email").addEventListener("change", setupCard);
  $(".rt-saved-change").addEventListener("click", function () {
    usingSaved = false; $(".rt-saved").hidden = true; $(".rt-card-fields").hidden = false; $("#rt-card").focus();
  });
  modal.querySelectorAll('input[name="rt-delivery"]').forEach(function (i) { i.addEventListener("change", syncDelivery); });
  modal.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  pay.bindCardFields($("#rt-card"), $("#rt-expiry"), $("#rt-cvc"));

  document.addEventListener("lumevina:account-changed", renderCard);
  setFocus("glow");
  renderCard();

  window.LumevinaRoutine = { price: PRICE, prices: { glow: 75, clear: 85, ageless: 95 }, get: function (email) { return load()[norm(email)] || null; } };
})();

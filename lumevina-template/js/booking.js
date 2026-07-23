/* Lumevina — booking engine (template-native, catalog-driven)
   Opens a booking modal in response to `lumevina:book` (fired by the
   drawer / any [data-book]). Reads services from window.LumevinaCatalog,
   so there's one source of truth and no hidden product DOM.

   Model mirrors the live site: hours Tue–Sun 8:00–18:00, lunch
   12:00–12:30, a 30-minute cell grid; a service takes 30 or 60 min and
   can't straddle lunch. Availability is a labeled demo — a deterministic
   seed marks ~30% of cells busy so days look real, and the visitor's own
   bookings (localStorage) block their cells. A 50% deposit is taken via
   the shared payment engine (js/payments.js — its STRIPE INTEGRATION
   POINT); Glow Points (js/rewards.js) and gift certificates
   (js/giftcards.js) apply against it. One ⚡ flash opening per day is 10% off. */

(function () {
  "use strict";

  var catalog = window.LumevinaCatalog;
  var pay = window.LumevinaPayments;
  if (!catalog || !pay) return;
  var rw = window.LumevinaRewards || null;
  var gc = window.LumevinaGiftCards || null;

  var OPEN = 8 * 60, CLOSE = 18 * 60, LUNCH_S = 12 * 60, LUNCH_E = 12 * 60 + 30, CELL = 30;
  var DEPOSIT = 0.5, FLASH_OFF = 0.10, BOOKINGS_KEY = "lumevina_bookings";

  var byId = {};
  catalog.categories.forEach(function (c) { c.services.forEach(function (s) { byId[s.id] = s; }); });

  /* ── storage ── */
  var loadBookings = function () { try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || []; } catch (e) { return []; } };
  var saveBookings = function (l) { try { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(l)); } catch (e) {} };

  /* ── helpers ── */
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var toKey = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var fmtTime = function (min) {
    var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? "PM" : "AM", hh = h % 12 || 12;
    return hh + ":" + pad(m) + " " + ap;
  };
  var fmtDay = function (key) {
    var d = new Date(key + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };
  var money = function (n) { return "$" + Number(n).toFixed(n % 1 ? 2 : 0); };
  var seed = function (str) { var h = 2166136261; for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  var busySeeded = function (key, start) { return seed(key + ":" + start) % 10 < 3; };

  /* cells blocked by the visitor's own bookings */
  var userBlocked = function (key) {
    var set = {};
    loadBookings().forEach(function (b) {
      if (b.dayKey !== key) return;
      for (var t = b.start; t < b.start + b.dur; t += CELL) set[t] = true;
    });
    return set;
  };

  var crossesLunch = function (start, dur) { return start < LUNCH_E && start + dur > LUNCH_S; };

  /* bookable days: next 21 days from tomorrow, excluding Mondays */
  var bookableDays = function () {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = 1; i <= 21 && out.length < 14; i++) {
      var day = new Date(d.getTime() + i * 864e5);
      if (day.getDay() === 1) continue; /* Mon closed */
      out.push(toKey(day));
    }
    return out;
  };

  var slotsFor = function (key, dur) {
    var blocked = userBlocked(key), out = [], flash = null;
    for (var start = OPEN; start + dur <= CLOSE; start += CELL) {
      if (crossesLunch(start, dur)) continue;
      var free = true;
      for (var t = start; t < start + dur; t += CELL) {
        if (blocked[t] || busySeeded(key, t)) { free = false; break; }
      }
      if (!free) continue;
      if (flash === null && start >= 15 * 60) flash = start; /* first free afternoon slot = ⚡ */
      out.push(start);
    }
    return { slots: out, flash: flash };
  };

  /* ── state ── */
  var state = { svc: null, dayKey: null, start: null, flash: false, usePoints: false, giftCode: null, giftApplied: 0, giftIsService: false };

  /* ── modal DOM (built lazily) ── */
  var backdrop, modal, els = {};
  var build = function () {
    backdrop = document.createElement("div"); backdrop.className = "lm-backdrop"; backdrop.hidden = true;
    modal = document.createElement("div"); modal.className = "lm-modal bk-modal"; modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Book an appointment"); modal.setAttribute("aria-hidden", "true"); modal.hidden = true;
    modal.innerHTML =
      '<button class="lm-close" type="button" aria-label="Close">&#10005;</button>' +
      /* step 1 — when */
      '<div class="bk-step bk-when">' +
        '<p class="eyebrow">Book an appointment</p>' +
        '<h3 class="bk-svc-name"></h3><p class="bk-svc-meta"></p>' +
        '<p class="bk-label">Choose a day</p><div class="bk-days"></div>' +
        '<p class="bk-label">Choose a time <span class="bk-flash-key">⚡ = 10% off flash opening</span></p><div class="bk-slots"></div>' +
      '</div>' +
      /* step 2 — pay */
      '<div class="bk-step bk-pay" hidden>' +
        '<button class="bk-back" type="button">&#8592; Back</button>' +
        '<p class="eyebrow">Confirm &amp; deposit</p><h3 class="bk-summary-svc"></h3><p class="bk-summary-when"></p>' +
        '<div class="bk-field"><label for="bk-name">Name</label><input id="bk-name" type="text" autocomplete="name"></div>' +
        '<div class="bk-field"><label for="bk-email">Email</label><input id="bk-email" type="email" autocomplete="email"></div>' +
        '<div class="bk-extras">' +
          '<label class="bk-check bk-points-row" hidden><input type="checkbox" class="bk-use-points"><span class="bk-points-text"></span></label>' +
          '<div class="bk-gift-row"><input type="text" class="bk-gift-code" placeholder="Gift certificate code" aria-label="Gift certificate code"><button class="bk-gift-apply" type="button">Apply</button><span class="bk-gift-status"></span></div>' +
        '</div>' +
        '<div class="bk-breakdown"></div>' +
        '<div class="bk-card">' +
          '<div class="bk-field"><label for="bk-card-num">Card number</label><input id="bk-card-num" inputmode="numeric" placeholder="4242 4242 4242 4242"></div>' +
          '<div class="bk-card-row"><div class="bk-field"><label for="bk-exp">Expiry</label><input id="bk-exp" placeholder="MM/YY" inputmode="numeric"></div>' +
          '<div class="bk-field"><label for="bk-cvc">CVC</label><input id="bk-cvc" placeholder="123" inputmode="numeric"></div></div>' +
        '</div>' +
        '<button class="btn btn-honey bk-confirm" type="button">Pay deposit</button>' +
        '<p class="bk-status" role="status"></p>' +
      '</div>' +
      /* step 3 — done */
      '<div class="bk-step bk-done" hidden>' +
        '<div class="bk-done-mark">&#10003;</div><h3>You&rsquo;re booked!</h3><p class="bk-done-when"></p>' +
        '<div class="bk-done-detail"></div>' +
        '<button class="btn btn-honey bk-done-close" type="button">Done</button>' +
      '</div>';
    document.body.appendChild(backdrop); document.body.appendChild(modal);

    els.when = modal.querySelector(".bk-when"); els.payStep = modal.querySelector(".bk-pay"); els.done = modal.querySelector(".bk-done");
    els.svcName = modal.querySelector(".bk-svc-name"); els.svcMeta = modal.querySelector(".bk-svc-meta");
    els.days = modal.querySelector(".bk-days"); els.slots = modal.querySelector(".bk-slots");
    els.sumSvc = modal.querySelector(".bk-summary-svc"); els.sumWhen = modal.querySelector(".bk-summary-when");
    els.name = modal.querySelector("#bk-name"); els.email = modal.querySelector("#bk-email");
    els.pointsRow = modal.querySelector(".bk-points-row"); els.usePoints = modal.querySelector(".bk-use-points"); els.pointsText = modal.querySelector(".bk-points-text");
    els.giftCode = modal.querySelector(".bk-gift-code"); els.giftApply = modal.querySelector(".bk-gift-apply"); els.giftStatus = modal.querySelector(".bk-gift-status");
    els.breakdown = modal.querySelector(".bk-breakdown"); els.cardWrap = modal.querySelector(".bk-card");
    els.cardNum = modal.querySelector("#bk-card-num"); els.exp = modal.querySelector("#bk-exp"); els.cvc = modal.querySelector("#bk-cvc");
    els.confirm = modal.querySelector(".bk-confirm"); els.status = modal.querySelector(".bk-status");
    els.doneWhen = modal.querySelector(".bk-done-when"); els.doneDetail = modal.querySelector(".bk-done-detail");

    pay.bindCardFields(els.cardNum, els.exp, els.cvc);

    backdrop.addEventListener("click", close);
    modal.querySelector(".lm-close").addEventListener("click", close);
    modal.querySelector(".bk-back").addEventListener("click", function () { showStep("when"); });
    modal.querySelector(".bk-done-close").addEventListener("click", close);
    els.usePoints.addEventListener("change", function () { state.usePoints = els.usePoints.checked; renderBreakdown(); });
    els.giftApply.addEventListener("click", applyGift);
    els.confirm.addEventListener("click", confirm);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") close(); });
  };

  var showStep = function (which) {
    els.when.hidden = which !== "when"; els.payStep.hidden = which !== "pay"; els.done.hidden = which !== "done";
    modal.scrollTop = 0;
  };

  /* ── step 1 render ── */
  var renderWhen = function () {
    els.svcName.textContent = state.svc.name;
    els.svcMeta.textContent = money(state.svc.price) + " · " + state.svc.dur + " min";
    els.days.textContent = ""; els.slots.textContent = "";
    var days = bookableDays();
    days.forEach(function (key, i) {
      var b = document.createElement("button"); b.type = "button"; b.className = "bk-day";
      var d = new Date(key + "T00:00:00");
      b.innerHTML = "<span>" + d.toLocaleDateString(undefined, { weekday: "short" }) + "</span><strong>" + d.getDate() + "</strong>";
      b.addEventListener("click", function () {
        state.dayKey = key; state.start = null;
        modal.querySelectorAll(".bk-day").forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        renderSlots();
      });
      els.days.appendChild(b);
      if (i === 0) b.click();
    });
  };

  var renderSlots = function () {
    els.slots.textContent = "";
    var r = slotsFor(state.dayKey, state.svc.dur);
    if (!r.slots.length) { els.slots.innerHTML = '<p class="bk-none">No openings this day — try another.</p>'; return; }
    r.slots.forEach(function (start) {
      var b = document.createElement("button"); b.type = "button"; b.className = "bk-slot";
      var isFlash = start === r.flash;
      if (isFlash) b.classList.add("is-flash");
      b.innerHTML = (isFlash ? "⚡ " : "") + fmtTime(start);
      b.addEventListener("click", function () {
        state.start = start; state.flash = isFlash;
        goPay();
      });
      els.slots.appendChild(b);
    });
  };

  /* ── deposit math ── */
  var calc = function () {
    var total = state.svc.price * (state.flash ? (1 - FLASH_OFF) : 1);
    var depositBase = Math.round(total * DEPOSIT);
    var pointsCredit = 0, blocks = 0;
    if (state.usePoints && rw) { blocks = rw.redeemableBlocks(depositBase); pointsCredit = blocks * rw.blockValue; }
    var giftCredit = 0, fullyPrepaid = false;
    if (state.giftIsService && state.giftApplied) { fullyPrepaid = true; }
    else if (state.giftApplied) { giftCredit = Math.min(state.giftApplied, depositBase - pointsCredit); }
    var due = fullyPrepaid ? 0 : Math.max(0, depositBase - pointsCredit - giftCredit);
    return { total: total, depositBase: depositBase, pointsCredit: pointsCredit, blocks: blocks, giftCredit: giftCredit, fullyPrepaid: fullyPrepaid, due: due };
  };

  var renderBreakdown = function () {
    var c = calc();
    var rows = [];
    rows.push(["Treatment total", money(state.svc.price)]);
    if (state.flash) rows.push(["Flash opening (10% off)", "−" + money(state.svc.price * FLASH_OFF)]);
    rows.push(["Deposit (50% today)", money(c.depositBase)]);
    if (c.pointsCredit) rows.push(["Glow Points (" + c.blocks * (rw ? rw.blockPoints : 100) + " ✦)", "−" + money(c.pointsCredit)]);
    if (c.giftCredit) rows.push(["Gift certificate", "−" + money(c.giftCredit)]);
    if (c.fullyPrepaid) rows.push(["Gift certificate", "Covers this treatment"]);
    var html = rows.map(function (r) { return '<div class="bk-brow"><span>' + r[0] + "</span><span>" + r[1] + "</span></div>"; }).join("");
    html += '<div class="bk-brow bk-due"><span>Due now</span><span>' + money(c.due) + "</span></div>";
    if (!c.fullyPrepaid) html += '<p class="bk-remainder">' + money(c.total - c.depositBase) + " at your visit</p>";
    if (rw) {
      var q = rw.quote(c.due, { dayKey: state.dayKey, serviceIds: [state.svc.id] });
      if (q.points) html += '<p class="bk-earn">You&rsquo;ll earn <b>' + q.points + " ✦</b>" + (q.notes.length ? " · " + q.notes.join(" · ") : "") + "</p>";
    }
    els.breakdown.innerHTML = html;
    els.cardWrap.hidden = c.due <= 0;
    els.confirm.textContent = c.due > 0 ? "Pay " + money(c.due) + " deposit" : "Confirm booking";
  };

  var applyGift = function () {
    if (!gc) { els.giftStatus.textContent = "Gift codes unavailable."; return; }
    var code = (els.giftCode.value || "").trim();
    if (!code) return;
    var card = gc.lookup(code);
    if (!card || card.balance <= 0) { els.giftStatus.textContent = "Code not found or empty."; els.giftStatus.className = "bk-gift-status is-bad"; state.giftApplied = 0; state.giftCode = null; renderBreakdown(); return; }
    state.giftCode = card.code; state.giftIsService = card.kind === "service";
    if (card.kind === "service") {
      if (card.serviceId && card.serviceId !== state.svc.id) {
        els.giftStatus.textContent = "This gift is for " + (byId[card.serviceId] ? byId[card.serviceId].name : "another treatment") + ".";
        els.giftStatus.className = "bk-gift-status is-bad"; state.giftApplied = 0; state.giftCode = null; renderBreakdown(); return;
      }
      state.giftApplied = card.balance;
      els.giftStatus.textContent = "Applied — covers this treatment.";
    } else {
      state.giftApplied = card.balance;
      els.giftStatus.textContent = "Applied — " + money(card.balance) + " credit.";
    }
    els.giftStatus.className = "bk-gift-status is-good";
    renderBreakdown();
  };

  var goPay = function () {
    state.usePoints = false; state.giftCode = null; state.giftApplied = 0; state.giftIsService = false;
    els.sumSvc.textContent = state.svc.name;
    els.sumWhen.textContent = fmtDay(state.dayKey) + " · " + fmtTime(state.start) + (state.flash ? " · ⚡ flash 10% off" : "");
    els.giftCode.value = ""; els.giftStatus.textContent = ""; els.status.textContent = "";
    /* points row */
    if (rw) {
      var depositBase = Math.round(state.svc.price * (state.flash ? 0.9 : 1) * DEPOSIT);
      var blocks = rw.redeemableBlocks(depositBase);
      if (blocks > 0) {
        els.pointsRow.hidden = false; els.usePoints.checked = false;
        els.pointsText.textContent = "Use " + blocks * rw.blockPoints + " Glow Points (−" + money(blocks * rw.blockValue) + ")";
      } else els.pointsRow.hidden = true;
    } else els.pointsRow.hidden = true;
    renderBreakdown();
    showStep("pay");
    els.name.focus();
  };

  var confirm = function () {
    var c = calc();
    var name = (els.name.value || "").trim(), email = (els.email.value || "").trim();
    if (!name) { fail("Please enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail("Please enter a valid email."); return; }
    if (c.due > 0) {
      if (!pay.cardValid(els.cardNum.value)) { fail("Check the card number."); return; }
      if (!pay.expiryValid(els.exp.value)) { fail("Check the expiry date."); return; }
      if (!pay.cvcValid(els.cvc.value)) { fail("Check the CVC."); return; }
    }
    els.confirm.disabled = true; els.status.className = "bk-status"; els.status.textContent = "Processing…";
    pay.process({ amount: c.due, description: state.svc.name }, function (err, res) {
      els.confirm.disabled = false;
      if (err) { fail("Payment failed — please try again."); return; }
      finalize(c, name, email, res);
    });
  };

  var fail = function (msg) { els.status.className = "bk-status is-bad"; els.status.textContent = msg; };

  var finalize = function (c, name, email, res) {
    var ref = "LUM-" + Date.now().toString(36).toUpperCase();
    /* persist booking (blocks its cells) */
    var list = loadBookings();
    list.push({ ref: ref, serviceId: state.svc.id, serviceName: state.svc.name, price: state.svc.price,
      dur: state.svc.dur, dayKey: state.dayKey, start: state.start, deposit: c.due, flash: state.flash,
      name: name, email: email, ts: Date.now() });
    saveBookings(list);
    /* redeem gift + points, then award */
    if (state.giftCode && gc) gc.redeem(state.giftCode, c.giftCredit || undefined, { email: email });
    var earned = 0, petal = null;
    if (rw) {
      if (c.pointsCredit && c.blocks) rw.spend(c.blocks * rw.blockPoints, "Redeemed on deposit");
      var q = rw.award(c.due, { dayKey: state.dayKey, serviceIds: [state.svc.id] }, "Booking deposit · " + state.svc.name);
      earned = q.points;
      petal = rw.petalReveal();
    }
    /* success view */
    els.doneWhen.textContent = state.svc.name + " · " + fmtDay(state.dayKey) + " · " + fmtTime(state.start);
    var d = '<div class="bk-brow"><span>Deposit paid</span><span>' + money(c.due) + "</span></div>";
    d += '<div class="bk-brow"><span>At your visit</span><span>' + money(c.total - c.due) + "</span></div>";
    d += '<div class="bk-brow"><span>Confirmation</span><span>' + ref + "</span></div>";
    if (earned) d += '<p class="bk-earn">+' + earned + " ✦ earned" + (petal ? " · +" + petal.pts + " ✦ mystery petal 🌹" : "") + "</p>";
    d += '<p class="bk-remainder">A confirmation would be emailed to ' + email + ".</p>";
    els.doneDetail.innerHTML = d;
    showStep("done");
    document.dispatchEvent(new CustomEvent("lumevina:booked", { detail: { ref: ref, service: state.svc, dayKey: state.dayKey, start: state.start } }));
  };

  /* ── open / close ── */
  var lastFocus = null;
  var open = function (svc) {
    if (!svc) return;
    if (!modal) build();
    state.svc = svc; state.dayKey = null; state.start = null; state.flash = false;
    lastFocus = document.activeElement;
    renderWhen(); showStep("when");
    backdrop.hidden = false; modal.hidden = false;
    void modal.offsetWidth;
    backdrop.classList.add("is-open"); modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modal.querySelector(".lm-close").focus();
  };
  var close = function () {
    backdrop.classList.remove("is-open"); modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    setTimeout(function () { backdrop.hidden = true; modal.hidden = true; }, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  /* ── listen on the seam ── */
  document.addEventListener("lumevina:book", function (e) {
    var svc = (e.detail && e.detail.service) || (e.detail && byId[e.detail.id]);
    if (!svc) return;
    e.preventDefault();               /* silence the drawer's default toast */
    if (window.LumevinaDrawer) window.LumevinaDrawer.close();
    open(svc);
  });

  window.LumevinaBooking = { open: open };
})();

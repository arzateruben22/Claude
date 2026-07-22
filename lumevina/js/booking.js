/* Lumevina — appointment scheduler
   Client-side booking for every service except gift certificates,
   including MULTI-SERVICE sessions: add several services (say, a
   Brazilian wax + custom facial) and they book back-to-back as one
   block. Hours Tuesday–Sunday, 8:00 AM–6:00 PM, lunch 12:00–12:30.

   The day is a grid of 30-minute cells; each service occupies its
   rough duration (30 or 60 min) and a session needs consecutive
   free cells that never cross lunch. Capacity per day follows from
   the session length. A 50% deposit of the session total is
   collected in step two via the shared payment engine
   (js/payments.js — see its STRIPE INTEGRATION POINT).

   "Availability" is a labeled demo: a deterministic seed marks
   some cells busy so days look real, and the visitor's own
   bookings persist in localStorage and block those cells. */

(function () {
  "use strict";

  var STORAGE_KEY = "lumevina_bookings";

  var CELL = 30;
  var OPEN_MIN = 8 * 60;
  var CLOSE_MIN = 18 * 60;
  var LUNCH_START = 12 * 60;
  var LUNCH_END = 12 * 60 + 30;

  /* rough 30-minute services; everything else books at 60 */
  var DUR30 = {
    "virtual-consultation": 1, "in-person-consultation": 1,
    "brow-wax-tweeze": 1, "upper-lip-wax": 1, "full-face-wax": 1,
    "sideburn-wax": 1, "hairline-wax": 1, "nose-wax": 1, "nostril-wax": 1,
    "underarm-wax": 1, "half-arm-wax": 1, "full-arm-wax": 1,
    "half-back-wax": 1, "half-leg-wax": 1, "full-stomach-wax": 1,
    "stomach-strip-wax": 1, "full-butt-wax": 1,
    "bikini-line-wax": 1, "extended-bikini-line": 1,
    "inner-thigh-add-on": 1, "brazilian-wax": 1, "wax-wednesday": 1
  };

  /* ── Service list, derived from the page's own products ── */
  var services = [];
  var byId = {};
  document.querySelectorAll(".add-to-cart").forEach(function (btn) {
    var id = btn.dataset.id;
    if (!id || id === "gift-certificate-100" || byId[id]) return;
    var s = {
      id: id,
      name: btn.dataset.name,
      price: Number(btn.dataset.price),
      dur: DUR30[id] ? 30 : 60
    };
    byId[id] = s;
    services.push(s);
  });
  if (!services.length) return;
  services.sort(function (a, b) { return a.name.localeCompare(b.name); });

  /* ── Modal elements ── */
  var overlay = document.querySelector(".booking-overlay");
  var modal = document.querySelector(".booking-modal");
  if (!overlay || !modal) return;
  var formView = modal.querySelector(".booking-form-view");
  var successView = modal.querySelector(".booking-success");
  var chipsEl = modal.querySelector(".booking-chips");
  var metaEl = modal.querySelector(".booking-meta");
  var daysEl = modal.querySelector(".booking-days");
  var slotsEl = modal.querySelector(".booking-slots");
  var nameInput = modal.querySelector("#bk-name");
  var emailInput = modal.querySelector("#bk-email");
  var confirmBtn = modal.querySelector(".booking-confirm");
  var statusEl = modal.querySelector(".booking-status");
  var summaryEl = modal.querySelector(".booking-summary");
  var previewEl = modal.querySelector(".session-preview");
  var costsEl = modal.querySelector(".session-costs");

  var pay = window.LumevinaPayments;
  var payView = modal.querySelector(".booking-pay-view");
  var payLines = modal.querySelector(".booking-lines");
  var depositAmtEl = modal.querySelector(".booking-deposit-amt");
  var payBtn = modal.querySelector(".booking-pay");
  var payStatus = modal.querySelector(".booking-pay-status");
  var backBtn = modal.querySelector(".booking-back");
  var consentView = modal.querySelector(".booking-consent-view");
  var consentContinue = modal.querySelector(".booking-consent-continue");
  var consentBack = modal.querySelector(".consent-back");
  var consentTerms = modal.querySelector(".consent-terms");
  var consentCovid = modal.querySelector(".consent-covid");
  var consentSign = modal.querySelector("#bk-consent-sign");
  var consentStatus = modal.querySelector(".booking-consent-status");
  var cardNameInput = modal.querySelector("#bk-card-name");
  var cardInput = modal.querySelector("#bk-card");
  var expiryInput = modal.querySelector("#bk-expiry");
  var cvcInput = modal.querySelector("#bk-cvc");
  pay.bindCardFields(cardInput, expiryInput, cvcInput);

  /* Glow Rewards (js/rewards.js): earning, redemption, petal */
  var rw = window.LumevinaRewards;
  var redeemRow = modal.querySelector(".rw-redeem");
  var redeemCheck = modal.querySelector("#bk-use-points");
  var redeemText = modal.querySelector(".rw-redeem-text");
  var earnedEl = modal.querySelector(".rw-earned");
  var refNoteEl = modal.querySelector(".rw-ref-note");
  var refField = modal.querySelector(".rw-ref-field");
  var refInput = modal.querySelector("#bk-ref");
  var petalBtn = modal.querySelector(".petal-btn");
  var petalResult = modal.querySelector(".petal-result");
  var calBtn = modal.querySelector(".booking-cal");
  var intakeBtn = modal.querySelector(".booking-intake-open");
  var intakeStatusEl = modal.querySelector(".booking-intake-status");
  var pendingBlocks = 0;
  var lastBooking = null;
  var consentSignature = null;
  var rescheduleNote = modal.querySelector(".booking-reschedule-note");
  var repickView = modal.querySelector(".booking-repick");
  var repickList = modal.querySelector(".repick-list");
  var rescheduleMode = false;
  var rescheduleIndex = -1;
  var CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;

  /* gift certificate redemption (applied against the deposit) */
  var giftToggle = modal.querySelector(".gift-redeem-toggle");
  var giftBody = modal.querySelector(".gift-redeem-body");
  var giftInput = modal.querySelector(".gift-redeem-input");
  var giftApplyBtn = modal.querySelector(".gift-redeem-apply");
  var giftStatus = modal.querySelector(".gift-redeem-status");
  var giftCode = null;
  var giftApplied = 0;

  /* ── Session state ── */
  var state = {
    services: [byId["new-client-consultation"] || services[0]],
    dayKey: null,
    slot: null
  };

  var totalDur = function () {
    return state.services.reduce(function (a, s) { return a + s.dur; }, 0);
  };

  var totalPrice = function () {
    return state.services.reduce(function (a, s) { return a + s.price; }, 0);
  };

  /* ── Flash opening: one starred time per day at 10% off ──
     On the site it's the ⚡ slot below; in the app the same freed
     slots go out as push notifications (see Glow Rewards). */
  var FLASH_OFF = 0.10;

  var flashStart = function () {
    if (!state.dayKey || !state.services.length) return null;
    var dur = totalDur();
    var todayKey = dateKey(new Date());
    var nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    var userSet = userBusyCells(state.dayKey);
    var opts = candidateStarts(dur).filter(function (t) {
      if (state.dayKey === todayKey && t <= nowMins) return false;
      return blockFree(state.dayKey, t, dur, userSet);
    });
    if (!opts.length) return null;
    var str = state.dayKey + ":flash";
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return opts[h % opts.length];
  };

  var flashActive = function () {
    return state.slot !== null && state.slot === flashStart();
  };

  var flashDiscount = function () {
    return flashActive()
      ? Math.round(totalPrice() * FLASH_OFF * 100) / 100
      : 0;
  };

  var sessionTotal = function () { return totalPrice() - flashDiscount(); };

  var depositDue = function () { return sessionTotal() / 2; };

  /* ── Time helpers ── */
  var fmtTime = function (mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ampm = h >= 12 ? "PM" : "AM";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
  };

  var dateKey = function (d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  };

  /* deterministic pseudo-availability, per 30-minute cell */
  var cellSeedBusy = function (dayKey, cell) {
    var str = dayKey + ":c:" + cell;
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return (h % 100) < 22;
  };

  var loadBookings = function () {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (err) { return []; }
  };

  var saveBooking = function (b) {
    var all = loadBookings();
    all.push(b);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
    catch (err) { /* private mode */ }
  };

  /* cells occupied by the visitor's own bookings on a given day */
  var userBusyCells = function (dayKey) {
    var set = {};
    loadBookings().forEach(function (b) {
      if (b.date !== dayKey) return;
      var d = b.dur ||
        (byId[b.service] ? byId[b.service].dur : 60);
      for (var t = b.time; t < b.time + d; t += CELL) set[t] = true;
    });
    return set;
  };

  var overlapsLunch = function (start, dur) {
    return start < LUNCH_END && start + dur > LUNCH_START;
  };

  /* a session block fits if every cell is open and lunch is clear */
  var blockFree = function (dayKey, start, dur, userSet) {
    if (overlapsLunch(start, dur)) return false;
    for (var t = start; t < start + dur; t += CELL) {
      if (cellSeedBusy(dayKey, t) || userSet[t]) return false;
    }
    return true;
  };

  var candidateStarts = function (dur) {
    var out = [];
    for (var t = OPEN_MIN; t + dur <= CLOSE_MIN; t += CELL) {
      if (overlapsLunch(t, dur)) continue;
      out.push(t);
    }
    return out;
  };

  var dayCapacity = function (dur) {
    /* how many sessions of this length fit mathematically:
       morning block 8–12, afternoon block 12:30–6 */
    var morning = Math.floor((LUNCH_START - OPEN_MIN) / dur);
    var afternoon = Math.floor((CLOSE_MIN - LUNCH_END) / dur);
    return morning + afternoon;
  };

  /* ── Rendering ── */

  /* earliest bookable start for the current day & session length —
     it anchors the rail's clock times before a slot is chosen */
  var projectedStart = function () {
    if (!state.dayKey || !state.services.length) return OPEN_MIN;
    var dur = totalDur();
    var todayKey = dateKey(new Date());
    var nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    var userSet = userBusyCells(state.dayKey);
    var starts = candidateStarts(dur);
    for (var i = 0; i < starts.length; i++) {
      var t = starts[i];
      if (state.dayKey === todayKey && t <= nowMins) continue;
      if (blockFree(state.dayKey, t, dur, userSet)) return t;
    }
    return OPEN_MIN;
  };

  /* the session builder is a mini calendar: services stack as
     proportional back-to-back blocks with a clock start time beside
     each one — projected from the day's earliest opening while
     composing (1:00 PM, then 1:30 PM, then 2:30 PM…), locked to the
     chosen time once a slot is picked */
  var renderChips = function () {
    chipsEl.textContent = "";
    if (!state.services.length) {
      var none = document.createElement("p");
      none.className = "mini-empty";
      none.textContent = "No services yet — pick one above and tap + Add.";
      chipsEl.appendChild(none);
      return;
    }
    var projected = state.slot === null;
    var anchor = projected ? projectedStart() : state.slot;
    var offset = 0;
    state.services.forEach(function (s, i) {
      var row = document.createElement("div");
      row.className = "mini-row";
      var time = document.createElement("span");
      time.className = "mini-time" + (projected ? " mini-time-proj" : "");
      time.textContent = fmtTime(anchor + offset);
      var block = document.createElement("div");
      block.className = "mini-block tl-tint-" + ((i % 5) + 1);
      block.style.minHeight = (s.dur * 0.6 + 16) + "px";
      var info = document.createElement("span");
      info.className = "mini-info";
      var nm = document.createElement("strong");
      nm.textContent = s.name;
      var meta = document.createElement("span");
      meta.className = "mini-meta";
      meta.textContent = s.dur + " min · " + pay.money(s.price);
      info.appendChild(nm);
      info.appendChild(meta);
      var x = document.createElement("button");
      x.type = "button";
      x.className = "mini-x";
      x.textContent = "×";
      x.setAttribute("aria-label", "Remove " + s.name + " from this session");
      x.addEventListener("click", function () {
        state.services.splice(i, 1);
        state.slot = null;
        renderAll();
      });
      block.appendChild(info);
      block.appendChild(x);
      row.appendChild(time);
      row.appendChild(block);
      chipsEl.appendChild(row);
      offset += s.dur;
    });
    var endRow = document.createElement("div");
    endRow.className = "mini-row mini-end";
    var endTime = document.createElement("span");
    endTime.className = "mini-time" + (projected ? " mini-time-proj" : "");
    endTime.textContent = fmtTime(anchor + offset);
    var endLbl = document.createElement("span");
    endLbl.className = "mini-meta";
    endLbl.textContent = projected
      ? "session ends · earliest opening shown — pick your time below"
      : "session ends — you float out ✨";
    endRow.appendChild(endTime);
    endRow.appendChild(endLbl);
    chipsEl.appendChild(endRow);
  };

  var setConfirmLabel = function (withDeposit) {
    /* one button, two jobs: new booking → deposit · rescheduling → confirm move */
    confirmBtn.querySelector(".btn-mb-inner").textContent = rescheduleMode
      ? "Confirm new time"
      : (withDeposit ? "Continue to deposit · " + pay.money(depositDue())
                     : "Continue to deposit");
  };

  var renderMeta = function () {
    var n = state.services.length;
    if (!n) {
      metaEl.textContent = "Add at least one service to build your session.";
      setConfirmLabel(false);
      return;
    }
    var dur = totalDur();
    metaEl.textContent =
      (n > 1 ? n + " services, back to back · " : "") +
      dur + " min · " + pay.money(totalPrice()) +
      " · up to " + dayCapacity(dur) + " session" +
      (dayCapacity(dur) === 1 ? "" : "s") +
      " a day · Tue–Sun, 8:00 AM–6:00 PM · lunch 12:00–12:30";
    setConfirmLabel(true);
  };

  var renderDays = function () {
    daysEl.textContent = "";
    var today = new Date();
    var shown = 0;
    var firstKey = null;
    for (var i = 0; shown < 12 && i < 21; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (d.getDay() === 1) continue; /* closed Mondays */
      var key = dateKey(d);
      if (!firstKey) firstKey = key;
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "day-chip";
      chip.dataset.key = key;
      var wd = document.createElement("span");
      wd.className = "day-chip-wd";
      wd.textContent = d.toLocaleDateString("en-US", { weekday: "short" });
      var num = document.createElement("span");
      num.className = "day-chip-num";
      num.textContent = d.getDate();
      chip.appendChild(wd);
      chip.appendChild(num);
      chip.addEventListener("click", function () {
        state.dayKey = this.dataset.key;
        state.slot = null;
        renderDays();
        renderSlots();
        renderChips();
        renderPreview();
      });
      daysEl.appendChild(chip);
      shown++;
    }
    if (!state.dayKey) state.dayKey = firstKey;
    daysEl.querySelectorAll(".day-chip").forEach(function (c) {
      c.classList.toggle("selected", c.dataset.key === state.dayKey);
    });
  };

  var renderSlots = function () {
    slotsEl.textContent = "";
    if (!state.services.length) {
      var empty = document.createElement("p");
      empty.className = "booking-open-note";
      empty.textContent = "Pick a service above to see available times.";
      slotsEl.appendChild(empty);
      return;
    }
    var dur = totalDur();
    var todayKey = dateKey(new Date());
    var nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    var userSet = userBusyCells(state.dayKey);
    var fs = flashStart();
    var open = 0;
    candidateStarts(dur).forEach(function (mins) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = (mins === fs ? "⚡ " : "") + fmtTime(mins);
      var past = state.dayKey === todayKey && mins <= nowMins;
      var free = blockFree(state.dayKey, mins, dur, userSet);
      /* a chosen time holds its whole block: any start that would
         cross it greys out until the session ends */
      var heldBySelection = state.slot !== null && mins !== state.slot &&
        mins < state.slot + dur && state.slot < mins + dur;
      if (past || !free) {
        btn.disabled = true;
        btn.classList.add("taken");
      } else if (heldBySelection) {
        btn.disabled = true;
        btn.classList.add("held");
      } else {
        open++;
        btn.addEventListener("click", function () {
          /* tap the selected time again to release the block */
          state.slot = (state.slot === mins) ? null : mins;
          statusEl.textContent = "";
          renderChips();
          renderSlots();
          renderPreview();
        });
      }
      if (mins === fs && !btn.disabled) {
        btn.classList.add("flash");
        btn.title = "Flash opening — 10% off this session";
      }
      if (state.slot === mins && !btn.disabled) {
        btn.classList.add("selected");
        btn.title = "Tap again to unselect";
      }
      slotsEl.appendChild(btn);
    });
    var note = document.createElement("p");
    note.className = "booking-open-note";
    note.textContent = open + " opening" + (open === 1 ? "" : "s") +
      " for this " + dur + "-minute session" +
      (fs !== null ? " · ⚡ the starred time books at 10% off" : "");
    slotsEl.appendChild(note);
  };

  /* money summary once a time is chosen — the mini calendar above
     carries the timeline */
  var renderPreview = function () {
    if (state.slot === null || !state.services.length) {
      previewEl.hidden = true;
      return;
    }
    previewEl.hidden = false;

    costsEl.textContent = "";
    var addRow = function (label, value, cls) {
      var li = document.createElement("li");
      if (cls) li.className = cls;
      var l = document.createElement("span");
      l.textContent = label;
      var v = document.createElement("span");
      v.textContent = value;
      li.appendChild(l);
      li.appendChild(v);
      costsEl.appendChild(li);
    };
    state.services.forEach(function (s) {
      addRow(s.name, pay.money(s.price));
    });
    if (flashDiscount() > 0) {
      addRow("⚡ Flash opening — 10% off", "−" + pay.money(flashDiscount()), "sc-flash");
    }
    addRow("Total", pay.money(sessionTotal()), "sc-total");
    addRow("Due now — 50% deposit", pay.money(depositDue()), "sc-due");
    addRow("Due in person at your visit", pay.money(sessionTotal() - depositDue()), "sc-rest");
    if (rw) {
      var q = rw.quote(depositDue(), {
        dayKey: state.dayKey,
        serviceIds: state.services.map(function (s) { return s.id; })
      });
      addRow("✦ Glow Points on this deposit" +
        (q.notes.length ? " — " + q.notes.join(", ") : ""),
        "+" + q.points + " ✦", "sc-earn");
    }
  };

  var renderAll = function () {
    renderDays();      /* first — projected rail times need the day */
    renderChips();
    renderMeta();
    renderSlots();
    renderPreview();
  };

  /* ── Session building ── */
  var addService = function (id) {
    var s = byId[id];
    if (!s) return;
    var already = state.services.some(function (x) { return x.id === s.id; });
    if (already) {
      statusEl.textContent = s.name + " is already in this session.";
      return;
    }
    state.services.push(s);
    state.slot = null;
    statusEl.textContent = "";
    renderAll();
  };

  /* ── Floating action service picker (sectors → subsectors) ── */
  var SECTORS = [
    { name: "Facials", ids: ["new-client-consultation", "lumevina-custom-facial",
      "ageless-grace-facial", "custom-facial-dermaplaning", "couples-facial",
      "after-hours-facial"] },
    { name: "Peels", ids: ["light-chemical-peel", "medium-chemical-peel",
      "biorepeel-1", "biorepeel-3"] },
    { name: "Back Facials", ids: ["back-facial-full", "back-facial-half"] },
    { name: "Acne Program", ids: ["new-client-consultation-acne",
      "monthly-acne-treatment", "biweekly-acne-treatment"] },
    { name: "Consultations", ids: ["virtual-consultation", "in-person-consultation"] },
    { name: "Waxing", subs: [
      { name: "Face Wax", ids: ["brow-wax-tweeze", "upper-lip-wax", "full-face-wax",
        "full-face-wax-cooling-mask", "sideburn-wax", "hairline-wax", "nose-wax",
        "nostril-wax"] },
      { name: "Body Wax", ids: ["underarm-wax", "full-arm-wax", "half-arm-wax",
        "full-back-wax", "half-back-wax", "full-leg-wax", "half-leg-wax",
        "full-stomach-wax", "stomach-strip-wax", "full-butt-wax"] },
      { name: "Brazilian & Bikini", ids: ["bikini-line-wax", "extended-bikini-line",
        "brazilian-wax", "first-time-brazilian", "brazilian-wax-mini-vajacial",
        "inner-thigh-add-on", "wax-wednesday"] }
    ] }
  ];

  var famEl = modal.querySelector(".fam");
  var famTrigger = modal.querySelector(".fam-trigger");
  var famMenu = modal.querySelector(".fam-menu");
  var famPath = [];

  var famItem = function (i, label, sub, onClick, extraClass) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "fam-item" + (extraClass ? " " + extraClass : "");
    b.style.setProperty("--i", i);
    var l = document.createElement("span");
    l.className = "fam-item-label";
    l.textContent = label;
    b.appendChild(l);
    if (sub) {
      var s = document.createElement("span");
      s.className = "fam-item-sub";
      s.textContent = sub;
      b.appendChild(s);
    }
    b.addEventListener("click", onClick);
    return b;
  };

  var famLevel = function () {
    if (!famPath.length) return { nodes: SECTORS, services: null };
    var sector = SECTORS[famPath[0]];
    if (sector.subs) {
      if (famPath.length === 1) return { nodes: sector.subs, services: null };
      return { nodes: null, services: sector.subs[famPath[1]].ids };
    }
    return { nodes: null, services: sector.ids };
  };

  var renderFam = function () {
    famMenu.textContent = "";
    var level = famLevel();
    var i = 0;
    if (famPath.length) {
      famMenu.appendChild(famItem(i++, "← Back", null, function () {
        famPath.pop();
        renderFam();
      }, "fam-back"));
    }
    if (level.nodes) {
      level.nodes.forEach(function (node, idx) {
        var count = node.subs
          ? node.subs.reduce(function (a, s) { return a + s.ids.length; }, 0)
          : node.ids.length;
        famMenu.appendChild(famItem(i++, node.name,
          count + (count === 1 ? " option" : " options"), function () {
            famPath.push(idx);
            renderFam();
          }));
      });
    } else {
      level.services.forEach(function (id) {
        var s = byId[id];
        if (!s) return;
        famMenu.appendChild(famItem(i++, s.name,
          s.dur + " min · $" + s.price, function () {
            addService(id);
            closeFam();
          }, "fam-service"));
      });
    }
  };

  var openFam = function () {
    famPath = [];
    renderFam();
    famMenu.hidden = false;
    famEl.classList.add("open");
    famTrigger.setAttribute("aria-expanded", "true");
  };

  var closeFam = function () {
    famMenu.hidden = true;
    famEl.classList.remove("open");
    famTrigger.setAttribute("aria-expanded", "false");
  };

  famTrigger.addEventListener("click", function () {
    if (famEl.classList.contains("open")) closeFam(); else openFam();
  });

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function (serviceId) {
    lastFocus = document.activeElement;
    rescheduleMode = false;
    modal.classList.remove("rescheduling");
    rescheduleNote.hidden = true;
    resetGift();
    if (serviceId && byId[serviceId]) {
      state.services = [byId[serviceId]];
    }
    closeFam();
    state.slot = null;
    statusEl.textContent = "";
    payStatus.textContent = "";
    /* referral code: first visit only */
    refField.hidden = loadBookings().length > 0;
    /* signed-in clients skip retyping name & email */
    var acct = window.LumevinaAccount && window.LumevinaAccount.current();
    if (acct) {
      if (!nameInput.value) nameInput.value = acct.name || "";
      if (!emailInput.value) emailInput.value = acct.email || "";
    }
    formView.hidden = false;
    consentView.hidden = true;
    payView.hidden = true;
    successView.hidden = true;
    repickView.hidden = true;
    renderAll();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  /* ── Reschedule an existing booking ── deposit already paid & consent
     already given, so we only re-pick a day/time and move the record. */
  var openReschedule = function (booking, index) {
    lastFocus = document.activeElement;
    rescheduleMode = true;
    rescheduleIndex = index;
    var svcs = (booking.services || []).map(function (id) { return byId[id]; })
      .filter(Boolean);
    state.services = svcs.length ? svcs
      : [byId["new-client-consultation"] || services[0]];
    state.dayKey = null;
    state.slot = null;
    closeFam();
    statusEl.textContent = "";
    modal.classList.add("rescheduling");
    rescheduleNote.hidden = false;
    formView.hidden = false;
    consentView.hidden = true;
    payView.hidden = true;
    successView.hidden = true;
    repickView.hidden = true;
    renderAll();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  /* ── Reschedule entry point (from the "Reschedule it instead" link) ──
     Finds the client's upcoming appointment(s) on this device and routes:
     none → a gentle notice · one → straight into the move (48-hour rule
     enforced) · several → a small picker so they choose which to move. */
  var bookingStartOf = function (b) {
    var d = new Date(b.date + "T00:00:00");
    d.setMinutes(b.time);
    return d;
  };

  /* show a pop-up — prefer the shared styled notice, but never depend on it:
     if account.js hasn't loaded, fall back to a plain dialog so the link
     always responds instead of silently doing nothing. */
  var showNotice = function (title, body) {
    if (window.LumevinaNotice && window.LumevinaNotice.show) {
      window.LumevinaNotice.show(title, body);
    } else {
      window.alert(title + "\n\n" + body);
    }
  };

  var tooCloseNotice = function () {
    showNotice("Too close to reschedule online",
      "Appointments can't be moved online within 48 hours of your visit — this is " +
      "part of our cancellation policy, and the deposit is non-refundable inside " +
      "this window. Please call or DM us and we'll do our best to help.");
  };

  var beginReschedule = function (booking, index) {
    if (bookingStartOf(booking).getTime() - Date.now() <= CANCEL_WINDOW_MS) {
      tooCloseNotice();
      return;
    }
    openReschedule(booking, index);
  };

  var renderRepick = function (upcoming) {
    repickList.textContent = "";
    upcoming.forEach(function (x) {
      var b = x.b;
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "repick-item";
      var when = bookingStartOf(b).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric"
      });
      var svc = (b.services || []).map(function (id) {
        return byId[id] ? byId[id].name : id;
      }).join(" + ");
      btn.innerHTML = '<span class="repick-when">' + when + " · " +
        fmtTime(b.time) + '</span><span class="repick-what">' + svc + "</span>";
      btn.addEventListener("click", function () { beginReschedule(b, x.i); });
      li.appendChild(btn);
      repickList.appendChild(li);
    });
    formView.hidden = true;
    consentView.hidden = true;
    payView.hidden = true;
    successView.hidden = true;
    repickView.hidden = false;
  };

  var startReschedule = function () {
    var now = Date.now();
    var upcoming = loadBookings()
      .map(function (b, i) { return { b: b, i: i, start: bookingStartOf(b) }; })
      .filter(function (x) { return x.start.getTime() + (x.b.dur || 0) * 60000 > now; })
      .sort(function (a, c) { return a.start - c.start; });

    if (!upcoming.length) {
      showNotice("No upcoming appointment found",
        "We don't see an upcoming appointment saved on this device. If you booked on " +
        "another phone or computer, open “My Lumevina” there — or just reply to your " +
        "confirmation email (or DM us on Instagram) and we'll move it for you.");
      return;
    }
    if (modal.getAttribute("aria-hidden") !== "false") {
      lastFocus = document.activeElement;
      modal.setAttribute("aria-hidden", "false");
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
    }
    if (upcoming.length === 1) {
      beginReschedule(upcoming[0].b, upcoming[0].i);
    } else {
      modal.focus();
      renderRepick(upcoming);
    }
  };

  var closeModal = function () {
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };

  modal.querySelector(".booking-close").addEventListener("click", closeModal);
  modal.querySelector(".booking-done").addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);
  modal.querySelector(".booking-resched-start").addEventListener("click", startReschedule);
  /* Delegated so it works even for the cloned copy of this button that the
     desktop policies "shelf" renders into its detail card (that clone is
     built with innerHTML, so a directly-bound listener wouldn't survive). */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest(".policy-resched-start")) {
      e.preventDefault();
      startReschedule();
    }
  });
  modal.querySelector(".booking-repick-back").addEventListener("click", function () {
    repickView.hidden = true;
    formView.hidden = false;
    modal.focus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      if (famEl.classList.contains("open")) { closeFam(); return; }
      closeModal();
    }
  });

  /* ── Step 1 → 2: on to the 50% deposit ── */
  var whenText = function () {
    var d = new Date(state.dayKey + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric"
    });
  };

  var sessionName = function () {
    return state.services.map(function (s) { return s.name; }).join(" + ");
  };

  var rewardsOff = function () {
    return (rw && redeemCheck.checked) ? pendingBlocks * rw.blockValue : 0;
  };
  /* the gift covers whatever's left after points, up to its applied value */
  var giftOff = function () {
    return Math.min(giftApplied, Math.max(0, depositDue() - rewardsOff()));
  };

  var chargeNow = function () {
    return Math.max(0, depositDue() - rewardsOff() - giftOff());
  };

  var updatePayAmount = function () {
    depositAmtEl.textContent = pay.money(chargeNow());
    payBtn.querySelector(".btn-mb-inner").textContent =
      "Pay deposit · " + pay.money(chargeNow());
  };

  redeemCheck.addEventListener("change", updatePayAmount);

  /* ── Gift certificate redemption ── */
  var resetGift = function () {
    giftCode = null;
    giftApplied = 0;
    if (giftInput) giftInput.value = "";
    if (giftStatus) giftStatus.textContent = "";
    if (giftBody) giftBody.hidden = true;
  };

  if (giftToggle) {
    giftToggle.addEventListener("click", function () {
      giftBody.hidden = !giftBody.hidden;
      if (!giftBody.hidden) giftInput.focus();
    });
    giftApplyBtn.addEventListener("click", function () {
      var gc = window.LumevinaGiftCards;
      var code = giftInput.value.trim();
      if (!code) { giftStatus.textContent = "Enter your certificate code."; return; }
      if (!gc) { giftStatus.textContent = "Gift redemption isn't available right now."; return; }
      var card = gc.lookup(code);
      var dueBefore = Math.max(0, depositDue() - rewardsOff());
      var canCover = gc.quote(code, dueBefore);
      if (!card) {
        giftStatus.textContent = "We couldn't find that code — please check and try again.";
        giftCode = null; giftApplied = 0; updatePayAmount();
        return;
      }
      if (canCover <= 0) {
        giftStatus.textContent = "That certificate has no balance left.";
        giftCode = null; giftApplied = 0; updatePayAmount();
        return;
      }
      giftCode = card.code;
      giftApplied = card.balance; /* giftOff() caps it to what's due */
      var applied = giftOff();
      var remaining = Math.max(0, card.balance - applied);
      giftStatus.textContent = "✓ Applied −" + pay.money(applied) +
        " toward your deposit" +
        (remaining > 0 ? " · " + pay.money(remaining) + " stays on your certificate for the visit." : ".");
      updatePayAmount();
    });
  }

  petalBtn.addEventListener("click", function () {
    if (petalBtn.disabled || !rw) return;
    var pick = rw.petalReveal();
    petalBtn.disabled = true;
    petalResult.textContent = "🌹 " + pick.label + " — balance " +
      rw.points() + " ✦";
    petalResult.hidden = false;
  });

  /* reschedule: just move the existing booking to the new slot */
  /* move an existing booking to the newly picked slot (reschedule mode) */
  var doReschedule = function () {
    if (!state.slot) { statusEl.textContent = "Please pick a new time."; return; }
    var all = loadBookings();
    var b = all[rescheduleIndex];
    if (b) {
      b.date = state.dayKey;
      b.time = state.slot;
      b.dur = totalDur();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
      catch (err) { /* private mode */ }
      document.dispatchEvent(new CustomEvent("lumevina:booking-changed"));
    }
    closeModal();
    showNotice("Appointment moved",
      sessionName() + " is now " + whenText() + " at " + fmtTime(state.slot) +
      ". Your deposit carried over — nothing more to pay.");
  };

  confirmBtn.addEventListener("click", function () {
    /* the same button confirms a move when rescheduling */
    if (rescheduleMode) { doReschedule(); return; }

    var problems = [];
    if (!state.services.length) problems.push("at least one service");
    if (!state.slot) problems.push("a time slot");
    if (!nameInput.value.trim()) problems.push("your name");
    if (!emailInput.value.trim() || !emailInput.checkValidity()) {
      problems.push("a valid email");
    }
    if (problems.length) {
      statusEl.textContent = "Please choose: " + problems.join(", ") + ".";
      return;
    }

    var deposit = depositDue();
    payLines.textContent = "";
    var rows = state.services.map(function (s) {
      return [s.name + " (" + s.dur + " min)", pay.money(s.price)];
    });
    if (flashDiscount() > 0) {
      rows.push(["⚡ Flash opening — 10% off", "−" + pay.money(flashDiscount())]);
    }
    rows.push([whenText() + " · " + fmtTime(state.slot) + " – " +
      fmtTime(state.slot + totalDur()), ""]);
    rows.push(["Balance due at appointment", pay.money(sessionTotal() - deposit)]);
    rows.forEach(function (row) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = row[0];
      var amount = document.createElement("span");
      amount.textContent = row[1];
      li.appendChild(label);
      li.appendChild(amount);
      payLines.appendChild(li);
    });

    /* Glow Points may cover up to half the deposit */
    pendingBlocks = rw ? rw.redeemableBlocks(deposit) : 0;
    redeemCheck.checked = false;
    redeemRow.hidden = pendingBlocks < 1;
    if (pendingBlocks >= 1) {
      redeemText.textContent = "Use " + (pendingBlocks * rw.blockPoints) +
        " ✦ for " + pay.money(pendingBlocks * rw.blockValue) +
        " off this deposit (you have " + rw.points() + " ✦)";
    }
    updatePayAmount();
    if (!cardNameInput.value) cardNameInput.value = nameInput.value.trim();

    /* form → quick consent gate (then → deposit) */
    consentTerms.checked = false;
    consentCovid.checked = false;
    consentSign.value = "";
    consentStatus.textContent = "";
    formView.hidden = true;
    consentView.hidden = false;
    consentTerms.focus();
  });

  /* consent gate → deposit */
  consentContinue.addEventListener("click", function () {
    var problems = [];
    if (!consentTerms.checked) problems.push("agree to the treatment & policies");
    if (!consentCovid.checked) problems.push("confirm the health screening");
    var sig = consentSign.value.trim();
    if (!sig) problems.push("type your name to sign");
    else if (sig.toLowerCase() !== nameInput.value.trim().toLowerCase()) {
      problems.push("a signature matching your name");
    }
    if (problems.length) {
      consentStatus.textContent = "Please " + problems.join(", ") + ".";
      return;
    }
    consentSignature = sig;
    consentView.hidden = true;
    payView.hidden = false;
    payStatus.textContent = "";
    cardInput.focus();
  });

  consentBack.addEventListener("click", function () {
    consentView.hidden = true;
    formView.hidden = false;
  });

  backBtn.addEventListener("click", function () {
    payView.hidden = true;
    consentView.hidden = false;
  });

  /* ── Step 2: pay the deposit (shared engine, Stripe-ready) ── */
  payBtn.addEventListener("click", function () {
    var problems = [];
    if (!cardNameInput.value.trim()) problems.push("the name on the card");
    if (!pay.cardValid(cardInput.value)) problems.push("a valid card number");
    if (!pay.expiryValid(expiryInput.value)) problems.push("a future expiry (MM/YY)");
    if (!pay.cvcValid(cvcInput.value)) problems.push("a 3–4 digit CVC");
    if (problems.length) {
      payStatus.textContent = "Please check: " + problems.join(", ") + ".";
      return;
    }

    var deposit = depositDue();
    var redeemedPts = (rw && redeemCheck.checked)
      ? pendingBlocks * rw.blockPoints : 0;
    var giftUsed = giftOff();
    var charge = chargeNow();
    var firstVisit = !refField.hidden;
    payBtn.disabled = true;
    payStatus.textContent = "Processing…";
    pay.process({
      amount: charge,
      description: "50% deposit — " + sessionName() + " (" + state.dayKey + ")"
    }, function (err, result) {
      payBtn.disabled = false;
      if (err) {
        payStatus.textContent = "Payment failed — please try again.";
        return;
      }
      payStatus.textContent = "";
      saveBooking({
        date: state.dayKey,
        time: state.slot,
        dur: totalDur(),
        services: state.services.map(function (s) { return s.id; }),
        /* who booked — lets the owner CRM group bookings by client */
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        order: result.id,
        deposit: deposit,
        paid: charge,
        total: sessionTotal(),
        flash: flashActive(),
        /* stamp where the booking came from — 'app' inside the
           Capacitor shell, 'web' in a browser. Powers the app-vs-web
           split in the owner dashboard, captured from booking #1. */
        source: window.Capacitor ? "app" : "web",
        /* the pre-pay consent + signature (the binding sign-off; the
           full clinical intake is completed before the visit) */
        consent: { signature: consentSignature, signedAt: new Date().toISOString() }
      });
      summaryEl.textContent = sessionName() + " · " + whenText() + " · " +
        fmtTime(state.slot) + " – " + fmtTime(state.slot + totalDur());
      modal.querySelector(".booking-paid").textContent =
        "Deposit paid: " + pay.money(charge) +
        (redeemedPts ? " (" + redeemedPts + " ✦ applied)" : "") +
        (giftUsed > 0 ? " (gift −" + pay.money(giftUsed) + ")" : "") +
        " · Balance due: " + pay.money(sessionTotal() - deposit);
      modal.querySelector(".booking-order-id").textContent = result.id;

      /* commit the gift-certificate redemption (decrement its balance) */
      if (giftCode && giftUsed > 0 && window.LumevinaGiftCards) {
        window.LumevinaGiftCards.redeem(giftCode, giftUsed);
      }

      /* Glow Rewards: spend the redemption, earn on what was paid */
      if (rw) {
        if (redeemedPts) rw.spend(redeemedPts, "Redeemed on deposit");
        var q = rw.award(charge, {
          dayKey: state.dayKey,
          serviceIds: state.services.map(function (s) { return s.id; })
        }, "Deposit — " + sessionName());
        earnedEl.textContent = "✦ +" + q.points + " Glow Points earned" +
          (q.notes.length ? " (" + q.notes.join(", ") + ")" : "") +
          " · balance " + rw.points() + " ✦";
        earnedEl.hidden = false;
      }
      var code = refInput.value.trim().toUpperCase();
      if (firstVisit && code && rw && code !== rw.refCode()) {
        refNoteEl.textContent = "✉ Referral code " + code +
          " received — your friend earns " + rw.referralBonus +
          " ✦ ($15) once your visit is complete.";
        refNoteEl.hidden = false;
      } else {
        refNoteEl.hidden = true;
      }
      petalBtn.disabled = false;
      petalResult.hidden = true;
      petalResult.textContent = "";

      /* remember this booking for add-to-calendar + the pre-visit form */
      lastBooking = {
        title: "Lumevina — " + sessionName(),
        start: state.dayKey, startMin: state.slot, durMin: totalDur(),
        name: nameInput.value.trim(), email: emailInput.value.trim()
      };
      intakeStatusEl.hidden = true;
      if (window.LumevinaIntake &&
          window.LumevinaIntake.hasFormFor(lastBooking.email)) {
        intakeStatusEl.textContent = "✓ Pre-visit form on file — tap to update.";
        intakeStatusEl.hidden = false;
      }

      payView.hidden = true;
      successView.hidden = false;
      modal.querySelector(".booking-done").focus();
    });
  });

  /* ── Add to calendar (.ics) + pre-visit form, from the success view ── */
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  var icsStamp = function (dayKey, mins) {
    /* local wall-clock time, no timezone suffix (floating) */
    var d = new Date(dayKey + "T00:00:00");
    d.setMinutes(mins);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" +
      pad(d.getHours()) + pad(d.getMinutes()) + "00";
  };

  var downloadICS = function (b) {
    var uid = "lum-" + Date.now() + "@lumevina";
    var now = new Date();
    var dtstamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) +
      pad(now.getUTCDate()) + "T" + pad(now.getUTCHours()) +
      pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + "Z";
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lumevina//Booking//EN",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + dtstamp,
      "DTSTART:" + icsStamp(b.start, b.startMin),
      "DTEND:" + icsStamp(b.start, b.startMin + b.durMin),
      "SUMMARY:" + b.title,
      "DESCRIPTION:Your appointment at Lumevina Aesthetics Spa. A 50% deposit " +
        "has been paid; the balance is due at your visit.",
      "LOCATION:Lumevina Aesthetics Spa\\, Woodland Hills\\, CA",
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY",
      "DESCRIPTION:Lumevina appointment tomorrow", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ];
    var blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "lumevina-appointment.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  calBtn.addEventListener("click", function () {
    if (lastBooking) downloadICS(lastBooking);
  });

  intakeBtn.addEventListener("click", function () {
    if (window.LumevinaIntake) {
      window.LumevinaIntake.open(lastBooking
        ? { name: lastBooking.name, email: lastBooking.email } : {});
    }
  });

  document.addEventListener("lumevina:intake-saved", function () {
    intakeStatusEl.textContent = "✓ Pre-visit form received — thank you.";
    intakeStatusEl.hidden = false;
  });

  /* ── Book buttons, injected next to every add-to-cart ── */
  var CAL_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  /* Services are booked (pick a time + 50% deposit), not bought — so the
     card's primary action is Book. Only the gift certificate stays a cart
     purchase, keeping "book" and "buy" from reading as the same thing. */
  document.querySelectorAll(".product-foot .add-to-cart").forEach(function (btn) {
    if (btn.closest("#gift")) return;  // the gift card is a purchase, not a booking
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-solid book-btn";
    b.textContent = "Book";
    b.addEventListener("click", function () { openModal(btn.dataset.id); });
    btn.parentNode.insertBefore(b, btn);
    btn.remove();
  });

  document.querySelectorAll(".wax-add").forEach(function (btn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "wax-book";
    b.innerHTML = CAL_ICON + '<span class="wax-book-label">Book</span>';
    b.setAttribute("aria-label", "Book " + btn.dataset.name);
    b.addEventListener("click", function () { openModal(btn.dataset.id); });
    btn.parentNode.insertBefore(b, btn.nextSibling);
    btn.remove();
  });

  /* Site-wide Book links open this calendar instead of navigating */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest &&
      e.target.closest("[data-open-booking]");
    if (!el) return;
    e.preventDefault();
    openModal();
  });

  window.LumevinaBooking = {
    open: openModal,
    reschedule: openReschedule,
    startReschedule: startReschedule
  };
})();

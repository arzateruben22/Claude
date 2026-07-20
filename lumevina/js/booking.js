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
  var select = modal.querySelector("#bk-service");
  var addBtn = modal.querySelector(".booking-add");
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
  var cardNameInput = modal.querySelector("#bk-card-name");
  var cardInput = modal.querySelector("#bk-card");
  var expiryInput = modal.querySelector("#bk-expiry");
  var cvcInput = modal.querySelector("#bk-cvc");
  pay.bindCardFields(cardInput, expiryInput, cvcInput);

  services.forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name + " — $" + s.price;
    select.appendChild(opt);
  });

  /* ── Session state ── */
  var state = {
    services: [byId["new-client-consultation"] || services[0]],
    dayKey: null,
    slot: null
  };
  select.value = state.services[0].id;

  var totalDur = function () {
    return state.services.reduce(function (a, s) { return a + s.dur; }, 0);
  };

  var totalPrice = function () {
    return state.services.reduce(function (a, s) { return a + s.price; }, 0);
  };

  var depositDue = function () { return totalPrice() / 2; };

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
  var fmtDur = function (m) {
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  };

  /* the session builder is a mini calendar: services stack as
     proportional back-to-back blocks; labels show offsets while
     composing and flip to real clock times once a slot is picked */
  var renderChips = function () {
    chipsEl.textContent = "";
    if (!state.services.length) {
      var none = document.createElement("p");
      none.className = "mini-empty";
      none.textContent = "No services yet — pick one above and tap + Add.";
      chipsEl.appendChild(none);
      return;
    }
    var offset = 0;
    state.services.forEach(function (s, i) {
      var row = document.createElement("div");
      row.className = "mini-row";
      var time = document.createElement("span");
      time.className = "mini-time";
      time.textContent = state.slot !== null
        ? fmtTime(state.slot + offset)
        : (offset === 0 ? "start" : "+" + fmtDur(offset));
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
    endTime.className = "mini-time";
    endTime.textContent = state.slot !== null
      ? fmtTime(state.slot + offset)
      : "+" + fmtDur(offset);
    var endLbl = document.createElement("span");
    endLbl.className = "mini-meta";
    endLbl.textContent = state.slot !== null
      ? "session ends — you float out ✨"
      : "session ends · pick a day & time below";
    endRow.appendChild(endTime);
    endRow.appendChild(endLbl);
    chipsEl.appendChild(endRow);
  };

  var renderMeta = function () {
    var n = state.services.length;
    if (!n) {
      metaEl.textContent = "Add at least one service to build your session.";
      confirmBtn.querySelector(".btn-mb-inner").textContent = "Continue to deposit";
      return;
    }
    var dur = totalDur();
    metaEl.textContent =
      (n > 1 ? n + " services, back to back · " : "") +
      dur + " min · " + pay.money(totalPrice()) +
      " · up to " + dayCapacity(dur) + " session" +
      (dayCapacity(dur) === 1 ? "" : "s") +
      " a day · Tue–Sun, 8:00 AM–6:00 PM · lunch 12:00–12:30";
    confirmBtn.querySelector(".btn-mb-inner").textContent =
      "Continue to deposit · " + pay.money(depositDue());
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
    var open = 0;
    candidateStarts(dur).forEach(function (mins) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = fmtTime(mins);
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
      if (state.slot === mins && !btn.disabled) {
        btn.classList.add("selected");
        btn.title = "Tap again to unselect";
      }
      slotsEl.appendChild(btn);
    });
    var note = document.createElement("p");
    note.className = "booking-open-note";
    note.textContent = open + " opening" + (open === 1 ? "" : "s") +
      " for this " + dur + "-minute session";
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
    addRow("Total", pay.money(totalPrice()), "sc-total");
    addRow("Due now — 50% deposit", pay.money(depositDue()), "sc-due");
    addRow("Due in person at your visit", pay.money(totalPrice() - depositDue()), "sc-rest");
  };

  var renderAll = function () {
    renderChips();
    renderMeta();
    renderDays();
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

  addBtn.addEventListener("click", function () {
    addService(select.value);
  });

  /* the select is purely a picker — the chips are the session;
     + Add appends, × on a chip removes */

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function (serviceId) {
    lastFocus = document.activeElement;
    if (serviceId && byId[serviceId]) {
      state.services = [byId[serviceId]];
      select.value = serviceId;
    }
    state.slot = null;
    statusEl.textContent = "";
    payStatus.textContent = "";
    formView.hidden = false;
    payView.hidden = true;
    successView.hidden = true;
    renderAll();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
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

  confirmBtn.addEventListener("click", function () {
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
    rows.push([whenText() + " · " + fmtTime(state.slot) + " – " +
      fmtTime(state.slot + totalDur()), ""]);
    rows.push(["Balance due at appointment", pay.money(totalPrice() - deposit)]);
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
    depositAmtEl.textContent = pay.money(deposit);
    payBtn.querySelector(".btn-mb-inner").textContent =
      "Pay deposit · " + pay.money(deposit);
    if (!cardNameInput.value) cardNameInput.value = nameInput.value.trim();

    formView.hidden = true;
    payView.hidden = false;
    payStatus.textContent = "";
    cardInput.focus();
  });

  backBtn.addEventListener("click", function () {
    payView.hidden = true;
    formView.hidden = false;
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
    payBtn.disabled = true;
    payStatus.textContent = "Processing…";
    pay.process({
      amount: deposit,
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
        order: result.id,
        deposit: deposit
      });
      summaryEl.textContent = sessionName() + " · " + whenText() + " · " +
        fmtTime(state.slot) + " – " + fmtTime(state.slot + totalDur());
      modal.querySelector(".booking-paid").textContent =
        "Deposit paid: " + pay.money(deposit) + " · Balance due: " +
        pay.money(totalPrice() - deposit);
      modal.querySelector(".booking-order-id").textContent = result.id;
      payView.hidden = true;
      successView.hidden = false;
      modal.querySelector(".booking-done").focus();
    });
  });

  /* ── Book buttons, injected next to every add-to-cart ── */
  var CAL_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  document.querySelectorAll(".product-foot .add-to-cart").forEach(function (btn) {
    if (btn.dataset.id === "gift-certificate-100") return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-ghost book-btn";
    b.textContent = "Book";
    b.addEventListener("click", function () { openModal(btn.dataset.id); });
    btn.parentNode.insertBefore(b, btn);
  });

  document.querySelectorAll(".wax-add").forEach(function (btn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "wax-book";
    b.innerHTML = CAL_ICON;
    b.setAttribute("aria-label", "Book " + btn.dataset.name);
    b.addEventListener("click", function () { openModal(btn.dataset.id); });
    btn.parentNode.insertBefore(b, btn.nextSibling);
  });

  /* Site-wide Book links open this calendar instead of navigating */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest &&
      e.target.closest("[data-open-booking]");
    if (!el) return;
    e.preventDefault();
    openModal();
  });

  window.LumevinaBooking = { open: openModal };
})();

/* Lumevina — appointment scheduler
   A client-side booking calendar for every service except gift
   certificates. Hours: Tuesday–Sunday, 8:00 AM–6:00 PM, with a
   12:00–12:30 lunch break. Each service books in rough 30- or
   60-minute slots; the day's capacity is computed from that
   (60 min → 9 appointments, 30 min → 19).

   "Availability" is a DEMO: a deterministic seed marks some slots
   taken so days look real, and your own requests persist in
   localStorage — but no request leaves the browser. Confirmed,
   deposit-backed booking happens on the Acuity scheduler, which
   the modal links to.
   // TODO: for real availability, replace seededBooked/localStorage
   // with your scheduler's API. */

(function () {
  "use strict";

  var ACUITY = "https://app.acuityscheduling.com/catalog/d3692663";
  var STORAGE_KEY = "lumevina_bookings";

  var OPEN_MIN = 8 * 60;      /* 8:00 AM  */
  var CLOSE_MIN = 18 * 60;    /* 6:00 PM  */
  var LUNCH_START = 12 * 60;  /* 12:00    */
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
  var metaEl = modal.querySelector(".booking-meta");
  var daysEl = modal.querySelector(".booking-days");
  var slotsEl = modal.querySelector(".booking-slots");
  var nameInput = modal.querySelector("#bk-name");
  var emailInput = modal.querySelector("#bk-email");
  var confirmBtn = modal.querySelector(".booking-confirm");
  var statusEl = modal.querySelector(".booking-status");
  var summaryEl = modal.querySelector(".booking-summary");

  services.forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name + " — $" + s.price;
    select.appendChild(opt);
  });

  /* ── Slot math ── */
  var slotsFor = function (dur) {
    var out = [];
    var t = OPEN_MIN;
    while (t + dur <= CLOSE_MIN) {
      if (t < LUNCH_END && t + dur > LUNCH_START) { t = LUNCH_END; continue; }
      out.push(t);
      t += dur;
    }
    return out;
  };

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

  /* deterministic pseudo-availability so days look realistically busy */
  var seededBooked = function (dayKey, serviceDur, mins) {
    var str = dayKey + ":" + serviceDur + ":" + mins;
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return (h % 100) < 28;
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

  var isTaken = function (dayKey, mins) {
    return loadBookings().some(function (b) {
      return b.date === dayKey && b.time === mins;
    });
  };

  /* ── State + rendering ── */
  var state = { service: services[0], dayKey: null, slot: null };

  var renderMeta = function () {
    var n = slotsFor(state.service.dur).length;
    metaEl.textContent = state.service.dur + " min · up to " + n +
      " appointments a day · Tue–Sun, 8:00 AM–6:00 PM · lunch 12:00–12:30";
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
    var todayKey = dateKey(new Date());
    var nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    var open = 0;
    slotsFor(state.service.dur).forEach(function (mins) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = fmtTime(mins);
      var past = state.dayKey === todayKey && mins <= nowMins;
      var taken = seededBooked(state.dayKey, state.service.dur, mins) ||
        isTaken(state.dayKey, mins);
      if (past || taken) {
        btn.disabled = true;
        btn.classList.add("taken");
      } else {
        open++;
        btn.addEventListener("click", function () {
          state.slot = mins;
          slotsEl.querySelectorAll(".slot-btn").forEach(function (b) {
            b.classList.toggle("selected", b === btn);
          });
          statusEl.textContent = "";
        });
      }
      if (state.slot === mins && !btn.disabled) btn.classList.add("selected");
      slotsEl.appendChild(btn);
    });
    var note = document.createElement("p");
    note.className = "booking-open-note";
    note.textContent = open + " opening" + (open === 1 ? "" : "s") + " left this day";
    slotsEl.appendChild(note);
  };

  var renderAll = function () {
    renderMeta();
    renderDays();
    renderSlots();
  };

  select.addEventListener("change", function () {
    state.service = byId[select.value];
    state.slot = null;
    renderAll();
  });

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function (serviceId) {
    lastFocus = document.activeElement;
    if (serviceId && byId[serviceId]) {
      state.service = byId[serviceId];
      select.value = serviceId;
    }
    state.slot = null;
    statusEl.textContent = "";
    formView.hidden = false;
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

  /* ── Confirm ── */
  confirmBtn.addEventListener("click", function () {
    var problems = [];
    if (!state.slot) problems.push("a time slot");
    if (!nameInput.value.trim()) problems.push("your name");
    if (!emailInput.value.trim() || !emailInput.checkValidity()) {
      problems.push("a valid email");
    }
    if (problems.length) {
      statusEl.textContent = "Please choose: " + problems.join(", ") + ".";
      return;
    }
    saveBooking({ date: state.dayKey, time: state.slot, service: state.service.id });

    var d = new Date(state.dayKey + "T00:00:00");
    var when = d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric"
    });
    summaryEl.textContent = state.service.name + " · " + when + " · " +
      fmtTime(state.slot) + " (" + state.service.dur + " min)";
    formView.hidden = true;
    successView.hidden = false;
    modal.querySelector(".booking-done").focus();
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
})();

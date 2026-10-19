/* Lumevina — the Book section: every opening on one calendar
 *
 * Right on the page, nothing to open first: pick a treatment, and the
 * month shows which days are open, which have only a few times left,
 * and which are full or closed. Tap a day for its times, tap a time,
 * and the booking sheet (js/booking.js) opens on it for a name and the
 * deposit. Same rules as the sheet, from the same engine: Evelyn's
 * hours (js/hours.js), her days off and extra days, and what's booked.
 *
 * When booking runs on GlossGenius (js/site-config.js), the calendar
 * steps aside for a single link to her GlossGenius page.
 */
(function () {
  "use strict";

  var root = document.getElementById("book");
  var B = window.LumevinaBooking;
  var H = window.LumevinaHours || null;
  if (!root || !B) return;

  /* hours in the FAQ, from the same settings as the calendar */
  var faqHours = document.querySelector(".faq-hours");
  var paintFaq = function () { if (faqHours && H) faqHours.textContent = H.prose() + "."; };
  paintFaq();

  if (B.external) {
    var gg = root.querySelector(".bkl-gg-go");
    if (gg) gg.href = B.external;
    return;
  }

  var wrap = root.querySelector(".bkl");
  var select = root.querySelector("#bkl-svc");
  var metaEl = root.querySelector(".bkl-meta");
  var calEl = root.querySelector(".bkl-cal");
  var whenEl = root.querySelector(".bkl-when");
  var timesEl = root.querySelector(".bkl-times");
  var goBtn = root.querySelector(".bkl-go");
  wrap.classList.add("is-live");

  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var LONG = { weekday: "long", month: "long", day: "numeric" };
  var SHORT = { weekday: "short", month: "short", day: "numeric" };
  var money = function (n) { return "$" + (Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n))); };
  var startOfDay = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var keyOf = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var dateOf = function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var lastDay = function () { var t = startOfDay(new Date()); t.setDate(t.getDate() + B.ahead); return t; };

  /* ── the treatment list, grouped like the menu (Facials, Peels, …) ── */
  var buildSelect = function () {
    var seen = {};
    document.querySelectorAll(".sector-panel[data-sector]").forEach(function (panel) {
      var btn = document.querySelector('.sector-btn[data-sector="' + panel.getAttribute("data-sector") + '"] .sector-name');
      var group = document.createElement("optgroup");
      group.label = btn ? btn.textContent.trim() : "Services";
      panel.querySelectorAll(".add-to-cart[data-id]").forEach(function (b) {
        var id = b.getAttribute("data-id");
        var s = B.service(id);
        if (!s || seen[id]) return;
        seen[id] = true;
        var o = document.createElement("option");
        o.value = id;
        var row = b.closest(".wax-row");
        var label = row && row.querySelector(".wax-item strong");
        o.textContent = (label ? label.textContent.trim() : s.name) + " · " + money(s.price);
        group.appendChild(o);
      });
      if (group.children.length) select.appendChild(group);
    });
    /* anything bookable that isn't in a menu panel */
    B.list().forEach(function (s) {
      if (seen[s.id]) return;
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name + " · " + money(s.price);
      select.appendChild(o);
    });
  };
  buildSelect();

  var state = { svc: "new-client-consultation", day: null, slot: null, month: null };
  try { var saved = sessionStorage.getItem("lumevina_book_svc"); if (saved && B.service(saved)) state.svc = saved; } catch (e) { /* storage blocked */ }
  if (!B.service(state.svc) && select.options.length) state.svc = select.options[0].value;
  select.value = state.svc;

  var bookable = function (info) { return (info.state === "open" || info.state === "few") && !info.locked; };
  var firstOpen = function () {
    var d = startOfDay(new Date());
    for (var i = 0; i <= B.ahead; i++) {
      var info = B.day(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i), state.svc);
      if (bookable(info)) return info.key;
    }
    return null;
  };

  var paintMeta = function () {
    var s = B.service(state.svc);
    if (!s) { metaEl.textContent = ""; return; }
    metaEl.textContent = s.dur + " min · " + money(s.price) + " · " + money(s.price / 2) + " deposit to book";
  };

  var dayLabel = function (info) {
    var when = info.date.toLocaleDateString("en-US", LONG);
    if (info.state === "closed") return when + ", closed";
    if (info.state === "out") return when + ", not bookable yet";
    if (info.state === "full") return when + ", fully booked";
    if (info.locked) return when + ", members only for now";
    return when + ", " + info.count + (info.count === 1 ? " opening" : " openings") +
      (info.state === "few" ? " left" : "") + (info.extra ? ", an extra day" : "");
  };

  /* ── the month ── */
  var renderCal = function (focusKey) {
    var now = new Date();
    var firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    var endMonth = new Date(lastDay().getFullYear(), lastDay().getMonth(), 1);
    var todayKey = keyOf(now);
    var m = state.month;

    calEl.textContent = "";
    var cal = document.createElement("div");
    cal.className = "cal";
    var head = document.createElement("div");
    head.className = "cal-head";
    var nav = function (dir, label, on) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cal-nav";
      b.setAttribute("aria-label", label);
      b.innerHTML = dir < 0 ? "&#8249;" : "&#8250;";
      b.disabled = !on;
      b.addEventListener("click", function () { moveMonth(dir); });
      return b;
    };
    var title = document.createElement("p");
    title.className = "cal-title";
    title.id = "bkl-cal-title";
    title.setAttribute("aria-live", "polite");
    title.textContent = m.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    head.appendChild(nav(-1, "Previous month", m > firstMonth));
    head.appendChild(title);
    head.appendChild(nav(1, "Next month", m < endMonth));
    cal.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "cal-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-labelledby", "bkl-cal-title");
    WEEKDAYS.forEach(function (w) {
      var s = document.createElement("span");
      s.className = "cal-wd";
      s.setAttribute("aria-hidden", "true");
      s.textContent = w;
      grid.appendChild(s);
    });
    for (var g = 0; g < m.getDay(); g++) {
      var gap = document.createElement("span");
      gap.className = "cal-gap";
      grid.appendChild(gap);
    }
    var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var focusable = null;
    for (var n = 1; n <= days; n++) {
      var info = B.day(new Date(m.getFullYear(), m.getMonth(), n), state.svc);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cal-day is-" + info.state + (info.extra && info.state !== "out" ? " is-extra" : "") +
        (info.key === todayKey ? " is-today" : "") + (info.key === state.day ? " is-selected" : "");
      b.dataset.key = info.key;
      b.disabled = !bookable(info);
      b.tabIndex = -1;
      b.setAttribute("aria-label", dayLabel(info));
      b.setAttribute("aria-pressed", String(info.key === state.day));
      var num = document.createElement("span");
      num.className = "cal-num";
      num.textContent = n;
      var note = document.createElement("span");
      note.className = "cal-note";
      note.setAttribute("aria-hidden", "true");
      if (info.extra && bookable(info)) note.textContent = "Extra";
      else if (info.state === "few") note.textContent = info.count + " left";
      else if (info.state === "full") note.textContent = "Full";
      b.appendChild(num);
      b.appendChild(note);
      if (info.key === state.day) focusable = b;
      b.addEventListener("click", function () { pickDay(this.dataset.key, true); });
      grid.appendChild(b);
    }
    (focusable || grid.querySelector(".cal-day:not(:disabled)") || { tabIndex: 0 }).tabIndex = 0;

    grid.addEventListener("keydown", function (e) {
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      var from = e.target.closest && e.target.closest(".cal-day");
      if (!step || !from) return;
      e.preventDefault();
      var d = dateOf(from.dataset.key);
      for (var i = 0; i < 62; i++) {
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + step);
        if (d < startOfDay(new Date()) || d > lastDay()) return;
        if (!bookable(B.day(d, state.svc))) continue;
        var key = keyOf(d);
        if (d.getMonth() !== state.month.getMonth()) { moveMonth(d > state.month ? 1 : -1, key); return; }
        var t = grid.querySelector('.cal-day[data-key="' + key + '"]');
        if (t) { from.tabIndex = -1; t.tabIndex = 0; t.focus(); }
        return;
      }
    });
    cal.appendChild(grid);

    var legend = document.createElement("p");
    legend.className = "cal-legend";
    legend.innerHTML = '<span><i class="cal-dot"></i>Open</span><span><i class="cal-dot is-few"></i>A few left</span>';
    var closed = document.createElement("span");
    closed.textContent = B.closedLabel();
    legend.appendChild(closed);
    cal.appendChild(legend);
    calEl.appendChild(cal);

    if (focusKey) {
      var f = calEl.querySelector('.cal-day[data-key="' + focusKey + '"]:not(:disabled)');
      (f || calEl.querySelector('.cal-day[tabindex="0"]') || calEl.querySelector(".cal-nav")).focus();
    }
  };

  /* ── the chosen day's times: only the ones that can be booked ── */
  var renderTimes = function () {
    timesEl.textContent = "";
    if (!state.day) {
      whenEl.textContent = "No openings";
      var none = document.createElement("p");
      none.className = "booking-open-note";
      none.textContent = "Nothing open for this treatment in the next eight weeks. Ask Evelyn about an extra day.";
      timesEl.appendChild(none);
      paintGo();
      return;
    }
    whenEl.textContent = dateOf(state.day).toLocaleDateString("en-US", LONG);
    var free = B.times(state.day, state.svc).filter(function (t) { return t.free; });
    if (state.slot !== null && !free.some(function (t) { return t.slot === state.slot; })) state.slot = null;
    free.forEach(function (t) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn" + (t.flash ? " flash" : "") + (t.slot === state.slot ? " selected" : "");
      btn.textContent = (t.flash ? "⚡ " : "") + t.time;
      btn.setAttribute("aria-pressed", String(t.slot === state.slot));
      if (t.flash) btn.title = "Flash opening: 10% off this time";
      btn.addEventListener("click", function () {
        state.slot = state.slot === t.slot ? null : t.slot;
        renderTimes();
        var again = timesEl.querySelector('.slot-btn[aria-pressed="true"]');
        if (again) again.focus();
      });
      timesEl.appendChild(btn);
    });
    var note = document.createElement("p");
    note.className = "booking-open-note";
    note.textContent = free.length + (free.length === 1 ? " time" : " times") + " open" +
      (free.some(function (t) { return t.flash; }) ? " · ⚡ the starred time is 10% off" : "");
    timesEl.appendChild(note);
    paintGo();
  };

  var paintGo = function () {
    var inner = goBtn;
    if (state.day && state.slot !== null) {
      var t = B.times(state.day, state.svc).filter(function (x) { return x.slot === state.slot; })[0];
      goBtn.disabled = false;
      inner.textContent = "Book " + dateOf(state.day).toLocaleDateString("en-US", SHORT) + " at " + (t ? t.time : "");
    } else {
      goBtn.disabled = true;
      inner.textContent = state.day ? "Pick a time to continue" : "Pick a day to continue";
    }
  };

  var pickDay = function (key, keepFocus) {
    state.day = key;
    state.slot = null;
    renderCal(keepFocus ? key : null);
    renderTimes();
  };
  var moveMonth = function (dir, focusKey) {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + dir, 1);
    renderCal(focusKey || "-");
  };

  /* everything again: on load, a new treatment, a new booking, new hours */
  var renderAll = function () {
    paintMeta();
    if (state.day && !bookable(B.day(dateOf(state.day), state.svc))) state.day = null;
    if (!state.day) { state.day = firstOpen(); state.slot = null; }
    var sel = state.day ? dateOf(state.day) : new Date();
    if (!state.month) state.month = new Date(sel.getFullYear(), sel.getMonth(), 1);
    renderCal();
    renderTimes();
  };

  select.addEventListener("change", function () {
    state.svc = select.value;
    try { sessionStorage.setItem("lumevina_book_svc", state.svc); } catch (e) { /* storage blocked */ }
    state.month = null;
    renderAll();
  });

  goBtn.addEventListener("click", function () {
    if (!state.day || state.slot === null) return;
    B.open(state.svc, { dayKey: state.day, slot: state.slot });
  });

  document.addEventListener("lumevina:booked", renderAll);
  document.addEventListener("lumevina:booking-changed", renderAll);
  if (H) H.onChange(function () { paintFaq(); renderAll(); });

  renderAll();
})();

/* Lumevina — manage an appointment (v3, live)
 *
 * Every confirmation and reminder email has a "Cancel or move it" button:
 * it opens the site with ?manage=<token>, and this window shows that one
 * booking (functions/book → get), with what the policy allows right now:
 *
 *   48 hours or more ahead (not a Saturday): Move it (the booking calendar,
 *   js/booking.js → moveLive) or Cancel it, and the deposit carries over
 *   to a new date that month.
 *   Later than that, or a Saturday: Cancel it, keeping the deposit (a $43
 *   fee may apply). Moving is done with Evelyn.
 *
 * My Lumevina (js/account.js) opens the same window for a signed-in
 * client's appointments: LumevinaManage.open(token).
 */
(function () {
  "use strict";

  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  if (!LIVE) return;

  var api = function (body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/book", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  };
  var esc = function (t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; };
  var money = function (c) { return "$" + (c / 100).toFixed(c % 100 ? 2 : 0); };

  var overlay = document.createElement("div");
  overlay.className = "mg-overlay";
  overlay.hidden = true;
  var box = document.createElement("div");
  box.className = "mg-modal";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", "mg-title");
  box.hidden = true;
  box.tabIndex = -1;
  document.body.appendChild(overlay);
  document.body.appendChild(box);

  var lastFocus = null, current = null;
  var close = function () {
    box.hidden = true; overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) close(); });

  var STATUS = { held: "Booked", completed: "Done", cancelled: "Cancelled", no_show: "Missed", pending: "Finishing up" };
  var paint = function (v, note) {
    current = v;
    var held = v.status === "held";
    var paid = v.member ? "Your membership facial" : v.paid_cents ? "Deposit paid: " + money(v.paid_cents) + " (it goes toward your total)" : "";
    var rule = !held ? "" : v.saturday ? "Saturday appointments can't be moved, and cancelling one keeps the deposit."
      : v.free_change ? "You can move or cancel it up to 48 hours before, and your deposit comes with you."
      : "It's within 48 hours now: cancelling keeps the deposit, and a $43 late fee may apply. To move it, reply to your confirmation email and Evelyn will help.";
    box.innerHTML =
      '<button class="mg-x" type="button" aria-label="Close">&times;</button>' +
      '<p class="mg-pill is-' + esc(v.status) + '">' + esc(STATUS[v.status] || v.status) + '</p>' +
      '<h2 class="mg-title" id="mg-title">' + esc(v.names) + '</h2>' +
      '<p class="mg-when">' + esc(v.when) + '</p>' +
      (paid ? '<p class="mg-line">' + esc(paid) + '</p>' : "") +
      (v.card ? '<p class="mg-line">Card on file: ' + esc(v.card) + '</p>' : "") +
      (rule ? '<p class="mg-rule">' + esc(rule) + '</p>' : "") +
      (note ? '<p class="mg-note" role="status">' + esc(note) + '</p>' : "") +
      '<div class="mg-actions">' +
        (held && v.free_change && !v.saturday ? '<button type="button" class="btn btn-solid mg-move">Move it</button>' : "") +
        (held ? '<button type="button" class="btn btn-ghost mg-cancel">Cancel it</button>' : "") +
        (held ? '<a class="btn btn-ghost mg-gcal" target="_blank" rel="noopener">Add to Google Calendar</a>' : "") +
        (v.status === "cancelled" ? '<a class="btn btn-solid" href="#book" data-mg-close>Book another time</a>' : "") +
      '</div>';
    var gcal = box.querySelector(".mg-gcal");
    if (gcal) {
      var stamp = function (k, m) { return k.replace(/-/g, "") + "T" + ("0" + Math.floor(m / 60)).slice(-2) + ("0" + (m % 60)).slice(-2) + "00"; };
      gcal.href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Lumevina — " + v.names) +
        "&dates=" + stamp(v.date, v.start_min) + "/" + stamp(v.date, v.start_min + v.dur_min) + "&ctz=America/Los_Angeles" +
        "&location=" + encodeURIComponent("Lumevina Aesthetics Spa, Woodland Hills, CA");
    }
    box.querySelector(".mg-x").addEventListener("click", close);
    box.querySelectorAll("[data-mg-close]").forEach(function (a) { a.addEventListener("click", close); });
    var mv = box.querySelector(".mg-move");
    if (mv) mv.addEventListener("click", function () {
      if (!window.LumevinaBooking || !window.LumevinaBooking.moveLive) return;
      close();
      window.LumevinaBooking.moveLive(v, function (moved) { document.dispatchEvent(new CustomEvent("lumevina:booking-changed", { detail: moved })); });
    });
    var cx = box.querySelector(".mg-cancel");
    if (cx) cx.addEventListener("click", function () {
      if (cx.dataset.arm !== "1") {
        cx.dataset.arm = "1";
        cx.textContent = v.free_change && !v.saturday ? "Tap again to cancel (deposit carries over)" : "Tap again to cancel (deposit kept)";
        return;
      }
      cx.disabled = true;
      api({ action: "cancel", token: v.token }).then(function (r) {
        if (!r.booking) { paint(v, "It didn't cancel. Check your connection and try again."); return; }
        paint(r.booking, r.kind === "in_time"
          ? (v.paid_cents ? "Cancelled. Your " + money(v.paid_cents) + " deposit carries over: it comes off automatically when you book again this month with the same email." : "Cancelled. Nothing was charged.") + (v.member ? " Your membership facial is back on your account." : "")
          : "Cancelled. As the policy says, the deposit is kept.");
        document.dispatchEvent(new CustomEvent("lumevina:booking-changed", { detail: r.booking }));
      }, function () { paint(v, "It didn't cancel. Check your connection and try again."); });
    });
  };

  var open = function (token) {
    lastFocus = document.activeElement;
    box.innerHTML = '<p class="mg-when">Finding your appointment…</p>';
    box.hidden = false; overlay.hidden = false;
    document.body.style.overflow = "hidden";
    box.focus();
    api({ action: "get", token: token }).then(function (r) {
      if (r.booking) paint(r.booking);
      else box.innerHTML = '<button class="mg-x" type="button" aria-label="Close">&times;</button><h2 class="mg-title" id="mg-title">We couldn’t find that appointment</h2>' +
        '<p class="mg-rule">The link may be from an older email. Reply to any email from Evelyn and she’ll sort it out.</p>';
      var x = box.querySelector(".mg-x"); if (x) x.addEventListener("click", close);
    }, function () { box.innerHTML = '<p class="mg-rule">Couldn’t reach the booking server. Check your connection and reload.</p>'; });
  };

  window.LumevinaManage = { open: open };

  /* the link in the email */
  var q = /[?&]manage=([0-9a-f]{32})/.exec(location.search);
  if (q) {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* old browser */ }
    open(q[1]);
  }
})();

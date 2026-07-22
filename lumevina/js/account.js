/* Lumevina — My Lumevina account panel
   Demo-backed sign-in that gathers everything the site already
   tracks under one roof: Glow Points, upcoming appointments (with
   the 48-hour cancellation rule), and your referral code.

   The sign-in is a MAGIC-LINK mock: in production the "Send my
   sign-in link" button calls the server (Supabase auth — see
   server/README.md), which emails a one-tap link; here it signs
   straight in so the whole flow is testable. The panel API stays
   identical when the real backend lands. Guest booking always
   remains available — signing in is the rewards path, not a gate. */

(function () {
  "use strict";

  var STORAGE_KEY = "lumevina_account";
  var BOOKINGS_KEY = "lumevina_bookings";
  var CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;

  /* ── Session ── */
  var session = null;

  var load = function () {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && raw.email) session = raw;
    } catch (err) { /* corrupt storage: stay signed out */ }
  };

  var save = function () {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (err) { /* private mode */ }
  };

  /* ── Service names, from the page's own products ── */
  var serviceName = {};
  document.querySelectorAll(".add-to-cart").forEach(function (btn) {
    if (btn.dataset.id && !serviceName[btn.dataset.id]) {
      serviceName[btn.dataset.id] = btn.dataset.name;
    }
  });

  /* ── Bookings ── */
  var loadBookings = function () {
    try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || []; }
    catch (err) { return []; }
  };

  var saveBookings = function (all) {
    try { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all)); }
    catch (err) { /* private mode */ }
  };

  var bookingStart = function (b) {
    var d = new Date(b.date + "T00:00:00");
    d.setMinutes(b.time);
    return d;
  };

  var fmtTime = function (mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ampm = h >= 12 ? "PM" : "AM";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
  };

  /* ── Modal elements ── */
  var overlay = document.querySelector(".account-overlay");
  var modal = document.querySelector(".account-modal");
  if (!overlay || !modal) return;

  var outView = modal.querySelector(".acct-out");
  var inView = modal.querySelector(".acct-in");
  var nameInput = modal.querySelector("#acct-name");
  var emailInput = modal.querySelector("#acct-email");
  var signinBtn = modal.querySelector(".acct-signin");
  var statusEl = modal.querySelector(".acct-status");
  var greetEl = modal.querySelector(".acct-greeting");
  var sinceEl = modal.querySelector(".acct-since");
  var welcomeEl = modal.querySelector(".acct-welcome");
  var pointsEl = modal.querySelector(".acct-points");
  var refEl = modal.querySelector(".acct-ref-code");
  var listEl = modal.querySelector(".acct-bookings");

  var rw = function () { return window.LumevinaRewards; };

  /* ── Notice pop-up (shared: policy blocks, reschedule confirmations) ── */
  var noticeOverlay = document.querySelector(".notice-overlay");
  var noticeModal = document.querySelector(".notice-modal");
  var noticeReturn = null;
  var notice = function (title, body) {
    if (!noticeModal) { window.alert(title + "\n\n" + body); return; }
    noticeReturn = document.activeElement;
    noticeModal.querySelector("#notice-title").textContent = title;
    noticeModal.querySelector(".notice-body").textContent = body;
    noticeModal.setAttribute("aria-hidden", "false");
    noticeOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    noticeModal.querySelector(".notice-ok").focus();
  };
  var closeNotice = function () {
    if (!noticeModal) return;
    noticeModal.setAttribute("aria-hidden", "true");
    noticeOverlay.hidden = true;
    var mm = document.getElementById("mobile-menu");
    var anyOpen = document.querySelector(
      ".account-modal[aria-hidden='false'], .booking-modal[aria-hidden='false']");
    document.body.style.overflow = ((mm && !mm.hidden) || anyOpen) ? "hidden" : "";
    if (noticeReturn) noticeReturn.focus();
  };
  if (noticeModal) {
    noticeModal.querySelector(".notice-ok").addEventListener("click", closeNotice);
    noticeOverlay.addEventListener("click", closeNotice);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && noticeModal.getAttribute("aria-hidden") === "false") closeNotice();
    });
  }
  window.LumevinaNotice = { show: notice };

  /* re-render the account's bookings when one is moved elsewhere */
  document.addEventListener("lumevina:booking-changed", function () {
    if (session && modal.getAttribute("aria-hidden") === "false") renderBookings();
  });

  /* ── Rendering ── */
  var renderBookings = function () {
    listEl.textContent = "";
    var now = Date.now();
    var upcoming = loadBookings()
      .map(function (b, i) { return { b: b, i: i, start: bookingStart(b) }; })
      .filter(function (x) { return x.start.getTime() + x.b.dur * 60000 > now; })
      .sort(function (a, c) { return a.start - c.start; });

    if (!upcoming.length) {
      var none = document.createElement("li");
      none.className = "acct-none";
      none.textContent = "No upcoming appointments — the calendar is a tap away.";
      listEl.appendChild(none);
      return;
    }

    upcoming.forEach(function (x) {
      var b = x.b;
      var li = document.createElement("li");
      li.className = "acct-booking";

      var when = document.createElement("span");
      when.className = "acct-bk-when";
      when.textContent = x.start.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric"
      }) + " · " + fmtTime(b.time) + " – " + fmtTime(b.time + b.dur);

      var what = document.createElement("span");
      what.className = "acct-bk-what";
      what.textContent = (b.services || [])
        .map(function (id) { return serviceName[id] || id; })
        .join(" + ");

      var meta = document.createElement("span");
      meta.className = "acct-bk-meta";
      meta.textContent = "Order " + (b.order || "—") +
        " · deposit " + "$" + Number(b.deposit || 0).toFixed(2) + " paid";

      var actions = document.createElement("div");
      actions.className = "acct-bk-actions";

      /* Reschedule — allowed only outside the 48-hour window; inside it,
         a pop-up explains the policy instead of moving the booking. */
      var resched = document.createElement("button");
      resched.type = "button";
      resched.className = "acct-bk-resched";
      resched.textContent = "Reschedule";
      resched.addEventListener("click", function () {
        if (x.start.getTime() - Date.now() <= CANCEL_WINDOW_MS) {
          notice("Too close to reschedule online",
            "Appointments can't be moved online within 48 hours of your visit — this is " +
            "part of our cancellation policy, and the deposit is non-refundable inside " +
            "this window. Please call or DM us and we'll do our best to help.");
          return;
        }
        if (window.LumevinaBooking && window.LumevinaBooking.reschedule) {
          closeModal();
          window.LumevinaBooking.reschedule(x.b, x.i);
        }
      });

      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "acct-bk-cancel";
      var cancellable = x.start.getTime() - now > CANCEL_WINDOW_MS;
      if (cancellable) {
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", function () {
          if (cancel.dataset.arm !== "1") {
            cancel.dataset.arm = "1";
            cancel.textContent = "Tap again to confirm — deposit is non-refundable";
            return;
          }
          var all = loadBookings();
          all.splice(x.i, 1);
          saveBookings(all);
          renderBookings();
        });
      } else {
        cancel.textContent = "Within 48 hours — call or DM to cancel";
        cancel.disabled = true;
      }

      actions.appendChild(resched);
      actions.appendChild(cancel);
      li.appendChild(when);
      li.appendChild(what);
      li.appendChild(meta);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  };

  var render = function () {
    var signedIn = !!session;
    outView.hidden = signedIn;
    inView.hidden = !signedIn;
    welcomeEl.hidden = true;
    if (!signedIn) return;

    var first = (session.name || "").split(" ")[0] || "glow-getter";
    greetEl.textContent = "Welcome back, " + first + ".";
    sinceEl.textContent = session.email + " · member since " +
      new Date(session.since).toLocaleDateString("en-US", {
        month: "long", year: "numeric"
      });
    pointsEl.textContent = rw() ? String(rw().points()) : "0";
    refEl.textContent = rw() ? rw().refCode() : "—";
    renderBookings();
    renderIntake();
  };

  var renderIntake = function () {
    var intake = window.LumevinaIntake;
    var line = modal.querySelector(".acct-intake-status");
    var btn = modal.querySelector(".acct-intake");
    if (!line || !btn) return;
    var has = intake && session && intake.hasFormFor(session.email);
    line.textContent = has
      ? "✓ On file — you're all set. Tap to review or update."
      : "Not yet completed — please fill this out before your visit.";
    line.className = "acct-intake-status" + (has ? " done" : "");
    btn.textContent = has ? "Review pre-visit form" : "Complete pre-visit form";
  };

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function () {
    lastFocus = document.activeElement;
    statusEl.textContent = "";
    render();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var closeModal = function () {
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    var mm = document.getElementById("mobile-menu");
    document.body.style.overflow = (mm && !mm.hidden) ? "hidden" : "";
    if (lastFocus) lastFocus.focus();
  };

  modal.querySelector(".account-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      closeModal();
    }
  });

  document.querySelectorAll("[data-open-account]").forEach(function (el) {
    el.addEventListener("click", function () {
      var toggle = document.querySelector(".nav-toggle");
      if (toggle && toggle.getAttribute("aria-expanded") === "true") toggle.click();
      openModal();
    });
  });

  /* ── Sign in (magic-link mock — see header note) ── */
  signinBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    if (!name || !email || !emailInput.checkValidity()) {
      statusEl.textContent = "Please add your name and a valid email.";
      return;
    }
    signinBtn.disabled = true;
    statusEl.textContent = "Sending your sign-in link…";
    setTimeout(function () {
      signinBtn.disabled = false;
      statusEl.textContent = "";
      session = { name: name, email: email, since: Date.now() };
      save();
      render();
      /* first sign-in on this device claims the welcome bonus */
      var bonus = rw() ? rw().claimWelcome() : 0;
      if (bonus) {
        welcomeEl.textContent = "✦ " + bonus + " welcome points added — " +
          "you're halfway to your first $10 reward.";
        welcomeEl.hidden = false;
        pointsEl.textContent = String(rw().points());
      }
    }, 900);
  });

  modal.querySelector(".acct-signout").addEventListener("click", function () {
    session = null;
    save();
    render();
  });

  modal.querySelector(".acct-open-rewards").addEventListener("click", function () {
    closeModal();
    if (rw()) rw().open();
  });

  modal.querySelector(".acct-book").addEventListener("click", function () {
    closeModal();
    if (window.LumevinaBooking) window.LumevinaBooking.open();
  });

  modal.querySelector(".acct-intake").addEventListener("click", function () {
    if (window.LumevinaIntake) {
      window.LumevinaIntake.open(session
        ? { name: session.name, email: session.email } : {});
    }
  });

  document.addEventListener("lumevina:intake-saved", function () {
    if (session) renderIntake();
  });

  /* ── Boot ── */
  load();

  window.LumevinaAccount = {
    current: function () { return session; },
    open: openModal
  };
})();

/* Lumevina — Glow Rewards
   The loyalty layer: 1 Glow Point per $1 paid in-site (booking
   deposits and shop orders), double points on Wednesdays or any
   session with Wax Wednesday, +25 for rebooking within 5 weeks,
   +50 once a year during your birthday month, a referral code
   worth 150 points when a friend completes their first visit,
   and a mystery-petal bonus after each confirmed appointment.
   100 points = $10 off, redeemable against up to half a deposit.
   (Flash openings — the daily ⚡ starred time at 10% off — live
   in js/booking.js; in the app they become push notifications.)

   Everything persists in localStorage. When the site becomes the
   app, this same ledger moves server-side so points follow the
   client across devices — the API below stays the same. Referral
   completion credit (150 ✦ to the referrer) needs that server:
   the demo records the code and explains the credit. */

(function () {
  "use strict";

  var STORAGE_KEY = "lumevina_rewards";
  var BLOCK_POINTS = 100;  /* one reward block…    */
  var BLOCK_VALUE = 10;    /* …is worth $10 off    */
  var STREAK_DAYS = 35;    /* rebook within 5 weeks */
  var STREAK_BONUS = 25;
  var BIRTHDAY_BONUS = 50;
  var REFERRAL_BONUS = 150;
  var WELCOME_BONUS = 50;  /* first sign-in, once per ledger */

  var money = function (n) { return "$" + n.toFixed(2); };

  /* ── Ledger ── */
  var data = {
    points: 0, history: [], lastVisit: null,
    birthMonth: null, birthdayClaimed: null, refCode: null,
    welcomeClaimed: false
  };

  var load = function () {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw) {
        if (isFinite(raw.points) && raw.points >= 0) data.points = Math.floor(raw.points);
        if (Array.isArray(raw.history)) data.history = raw.history.slice(0, 40);
        if (typeof raw.lastVisit === "string") data.lastVisit = raw.lastVisit;
        if (isFinite(raw.birthMonth)) data.birthMonth = Number(raw.birthMonth);
        if (isFinite(raw.birthdayClaimed)) data.birthdayClaimed = Number(raw.birthdayClaimed);
        if (typeof raw.refCode === "string") data.refCode = raw.refCode;
      if (raw.welcomeClaimed) data.welcomeClaimed = true;
      }
    } catch (err) { /* corrupt storage: start fresh */ }
    if (!data.refCode) {
      var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      var code = "";
      for (var i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      data.refCode = "GLOW-" + code;
      save();
    }
  };

  var save = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (err) { /* private mode: points won't persist */ }
  };

  var record = function (delta, label) {
    data.points = Math.max(0, data.points + delta);
    data.history.unshift({ ts: Date.now(), label: label, delta: delta });
    if (data.history.length > 40) data.history.length = 40;
    save();
    refresh();
  };

  /* ── Earning rules ── */
  var isWednesday = function (dayKey) {
    return dayKey && new Date(dayKey + "T00:00:00").getDay() === 3;
  };

  var streakActive = function () {
    if (!data.lastVisit) return false;
    var last = new Date(data.lastVisit + "T00:00:00").getTime();
    return (Date.now() - last) <= STREAK_DAYS * 24 * 60 * 60 * 1000;
  };

  var birthdayEligible = function (dayKey) {
    if (data.birthMonth === null || !dayKey) return false;
    var d = new Date(dayKey + "T00:00:00");
    return d.getMonth() === data.birthMonth &&
      data.birthdayClaimed !== d.getFullYear();
  };

  /* what a payment would earn — used for previews and for awarding */
  var quote = function (amount, opts) {
    opts = opts || {};
    var base = Math.round(amount);
    var doubled = isWednesday(opts.dayKey) ||
      (opts.serviceIds || []).indexOf("wax-wednesday") !== -1;
    var streak = opts.dayKey && streakActive();
    var birthday = birthdayEligible(opts.dayKey);
    var pts = base * (doubled ? 2 : 1) +
      (streak ? STREAK_BONUS : 0) +
      (birthday ? BIRTHDAY_BONUS : 0);
    var notes = [];
    if (doubled) notes.push("double points — Wax Wednesday");
    if (streak) notes.push("+" + STREAK_BONUS + " rebooking streak");
    if (birthday) notes.push("+" + BIRTHDAY_BONUS + " birthday month 🎂");
    return { points: pts, doubled: doubled, streak: streak,
      birthday: birthday, notes: notes };
  };

  var award = function (amount, opts, label) {
    var q = quote(amount, opts);
    record(q.points, label || "Payment");
    if (opts && opts.dayKey) {
      data.lastVisit = opts.dayKey;
      if (q.birthday) {
        data.birthdayClaimed = new Date(opts.dayKey + "T00:00:00").getFullYear();
      }
    }
    save();
    return q;
  };

  /* redeemable blocks against a given deposit — points may cover
     up to half of it, so real money always changes hands */
  var redeemableBlocks = function (deposit) {
    var byPoints = Math.floor(data.points / BLOCK_POINTS);
    var byDeposit = Math.floor((deposit / 2) / BLOCK_VALUE);
    return Math.max(0, Math.min(byPoints, byDeposit));
  };

  /* ── Welcome bonus: claimed by the first sign-in ── */
  var claimWelcome = function () {
    if (data.welcomeClaimed) return 0;
    data.welcomeClaimed = true;
    record(WELCOME_BONUS, "Welcome to Glow Rewards");
    return WELCOME_BONUS;
  };

  /* ── Mystery petal ── */
  var PETALS = [
    { pts: 10, label: "10 bonus petals of glow" },
    { pts: 10, label: "10 bonus petals of glow" },
    { pts: 15, label: "15 bonus points — lucky bloom" },
    { pts: 15, label: "15 bonus points — lucky bloom" },
    { pts: 25, label: "25 bonus points — the roses like you" },
    { pts: 25, label: "25 bonus points — the roses like you" },
    { pts: 50, label: "50 bonus points — full bloom! 🌹" }
  ];

  var petalReveal = function () {
    var pick = PETALS[Math.floor(Math.random() * PETALS.length)];
    record(pick.pts, "Mystery petal");
    return pick;
  };

  /* ── Nav badge ── */
  var refresh = function () {
    document.querySelectorAll(".rw-count").forEach(function (el) {
      el.textContent = String(data.points);
    });
  };

  /* ── Rewards modal ── */
  var overlay = document.querySelector(".rewards-overlay");
  var modal = document.querySelector(".rewards-modal");
  var lastFocus = null;

  var renderModal = function () {
    if (!modal) return;
    modal.querySelector(".rw-balance-num").textContent = String(data.points);

    var toNext = BLOCK_POINTS - (data.points % BLOCK_POINTS);
    var blocks = Math.floor(data.points / BLOCK_POINTS);
    var note = modal.querySelector(".rw-progress-note");
    note.textContent = blocks > 0
      ? money(blocks * BLOCK_VALUE) + " in rewards ready — apply it to any deposit"
      : toNext + " points to your first $" + BLOCK_VALUE + " reward";
    modal.querySelector(".rw-bar-fill").style.width =
      ((data.points % BLOCK_POINTS) / BLOCK_POINTS * 100) + "%";

    modal.querySelector(".rw-ref-code").textContent = data.refCode;
    var bday = modal.querySelector("#rw-bmonth");
    bday.value = data.birthMonth === null ? "" : String(data.birthMonth);

    /* signed-out nudge: the welcome bonus, front and center */
    var acct = window.LumevinaAccount && window.LumevinaAccount.current();
    modal.querySelector(".rw-signup").hidden = !!acct || data.welcomeClaimed;

    var hist = modal.querySelector(".rw-history");
    hist.textContent = "";
    if (!data.history.length) {
      var li = document.createElement("li");
      li.className = "rw-history-empty";
      li.textContent = "No activity yet — book a visit or send a gift to start earning.";
      hist.appendChild(li);
    }
    data.history.slice(0, 8).forEach(function (h) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = h.label;
      var delta = document.createElement("span");
      delta.className = h.delta >= 0 ? "rw-plus" : "rw-minus";
      delta.textContent = (h.delta >= 0 ? "+" : "") + h.delta + " ✦";
      li.appendChild(label);
      li.appendChild(delta);
      hist.appendChild(li);
    });
  };

  var openModal = function () {
    if (!modal) return;
    lastFocus = document.activeElement;
    renderModal();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var closeModal = function () {
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    /* keep scroll locked if the mobile menu is still open underneath */
    var mm = document.getElementById("mobile-menu");
    document.body.style.overflow = (mm && !mm.hidden) ? "hidden" : "";
    if (lastFocus) lastFocus.focus();
  };

  if (modal) {
    modal.querySelector(".rw-signup-btn").addEventListener("click", function () {
      closeModal();
      if (window.LumevinaAccount) window.LumevinaAccount.open();
    });
    modal.querySelector("#rw-bmonth").addEventListener("change", function () {
      data.birthMonth = this.value === "" ? null : Number(this.value);
      data.birthdayClaimed = null;
      save();
    });
    modal.querySelector(".rw-copy").addEventListener("click", function () {
      var btn = this;
      var done = function (ok) {
        btn.textContent = ok ? "Copied ✓" : "Copy failed";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data.refCode)
          .then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
    modal.querySelector(".rewards-close").addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
    });
    document.querySelectorAll("[data-open-rewards]").forEach(function (el) {
      el.addEventListener("click", function () {
        /* close the mobile menu first so the modal isn't underneath it */
        var toggle = document.querySelector(".nav-toggle");
        if (toggle && toggle.getAttribute("aria-expanded") === "true") toggle.click();
        openModal();
      });
    });
  }

  /* ── Boot ── */
  load();
  refresh();

  window.LumevinaRewards = {
    points: function () { return data.points; },
    quote: quote,
    award: award,
    spend: function (pts, label) { record(-pts, label || "Reward redeemed"); },
    redeemableBlocks: redeemableBlocks,
    blockPoints: BLOCK_POINTS,
    blockValue: BLOCK_VALUE,
    referralBonus: REFERRAL_BONUS,
    welcomeBonus: WELCOME_BONUS,
    claimWelcome: claimWelcome,
    refCode: function () { return data.refCode; },
    petalReveal: petalReveal,
    open: openModal
  };
})();

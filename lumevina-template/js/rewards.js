/* Lumevina — Glow Rewards (template-native)
   The loyalty ledger: 1 Glow Point per $1 paid, double on Wednesdays
   or any Wax Wednesday session, +25 rebooking within 5 weeks, +50 in
   your birthday month; 100 points = $10 off, redeemable against up to
   half a deposit. Persists in localStorage; booking.js awards points on
   a confirmed deposit. Public API mirrors the live site's LumevinaRewards
   so the booking engine plugs in unchanged. Builds its own modal. */

(function () {
  "use strict";

  var KEY = "lumevina_rewards";
  var BLOCK_POINTS = 100, BLOCK_VALUE = 10;
  var STREAK_DAYS = 35, STREAK_BONUS = 25, BIRTHDAY_BONUS = 50;
  var money = function (n) { return "$" + Number(n).toFixed(n % 1 ? 2 : 0); };

  var data = { points: 0, history: [], lastVisit: null, birthMonth: null, birthdayClaimed: null, refCode: null };

  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  var load = function () {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw) {
        if (isFinite(raw.points) && raw.points >= 0) data.points = Math.floor(raw.points);
        if (Array.isArray(raw.history)) data.history = raw.history.slice(0, 40);
        if (typeof raw.lastVisit === "string") data.lastVisit = raw.lastVisit;
        if (isFinite(raw.birthMonth)) data.birthMonth = Number(raw.birthMonth);
        if (isFinite(raw.birthdayClaimed)) data.birthdayClaimed = Number(raw.birthdayClaimed);
        if (typeof raw.refCode === "string") data.refCode = raw.refCode;
      }
    } catch (e) {}
    if (!data.refCode) {
      var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", code = "";
      for (var i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      data.refCode = "GLOW-" + code; save();
    }
  };

  var refresh = function () {
    document.querySelectorAll(".rw-count").forEach(function (el) { el.textContent = String(data.points); });
    if (modal && modal.getAttribute("aria-hidden") === "false") render();
  };

  var record = function (delta, label) {
    data.points = Math.max(0, data.points + delta);
    data.history.unshift({ ts: Date.now(), label: label, delta: delta });
    if (data.history.length > 40) data.history.length = 40;
    save(); refresh();
  };

  var isWednesday = function (dayKey) { return dayKey && new Date(dayKey + "T00:00:00").getDay() === 3; };
  var streakActive = function () {
    if (!data.lastVisit) return false;
    return (Date.now() - new Date(data.lastVisit + "T00:00:00").getTime()) <= STREAK_DAYS * 864e5;
  };
  var birthdayEligible = function (dayKey) {
    if (data.birthMonth === null || !dayKey) return false;
    var d = new Date(dayKey + "T00:00:00");
    return d.getMonth() === data.birthMonth && data.birthdayClaimed !== d.getFullYear();
  };

  var quote = function (amount, opts) {
    opts = opts || {};
    var base = Math.round(amount);
    var doubled = isWednesday(opts.dayKey) || (opts.serviceIds || []).indexOf("wax-wednesday") !== -1;
    var streak = opts.dayKey && streakActive();
    var birthday = birthdayEligible(opts.dayKey);
    var pts = base * (doubled ? 2 : 1) + (streak ? STREAK_BONUS : 0) + (birthday ? BIRTHDAY_BONUS : 0);
    var notes = [];
    if (doubled) notes.push("double points — Wax Wednesday");
    if (streak) notes.push("+" + STREAK_BONUS + " rebooking streak");
    if (birthday) notes.push("+" + BIRTHDAY_BONUS + " birthday month");
    return { points: pts, doubled: doubled, streak: streak, birthday: birthday, notes: notes };
  };

  var award = function (amount, opts, label) {
    var q = quote(amount, opts);
    record(q.points, label || "Payment");
    if (opts && opts.dayKey) {
      data.lastVisit = opts.dayKey;
      if (q.birthday) data.birthdayClaimed = new Date(opts.dayKey + "T00:00:00").getFullYear();
      save();
    }
    return q;
  };

  var redeemableBlocks = function (deposit) {
    return Math.max(0, Math.min(Math.floor(data.points / BLOCK_POINTS), Math.floor((deposit / 2) / BLOCK_VALUE)));
  };

  var PETALS = [ {pts:10}, {pts:10}, {pts:15}, {pts:15}, {pts:25}, {pts:25}, {pts:50} ];
  var petalReveal = function () { var p = PETALS[Math.floor(Math.random() * PETALS.length)]; record(p.pts, "Mystery petal"); return p; };

  /* ── modal (built in JS) ── */
  var backdrop, modal, lastFocus;
  var build = function () {
    backdrop = document.createElement("div"); backdrop.className = "lm-backdrop"; backdrop.hidden = true;
    modal = document.createElement("div"); modal.className = "lm-modal rw-modal"; modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Glow Rewards"); modal.setAttribute("aria-hidden", "true"); modal.hidden = true;
    modal.innerHTML =
      '<button class="lm-close" type="button" aria-label="Close">&#10005;</button>' +
      '<p class="eyebrow">Glow Rewards</p>' +
      '<div class="rw-balance"><span class="rw-balance-num">0</span><span class="rw-balance-unit">Glow Points</span></div>' +
      '<div class="rw-bar"><span class="rw-bar-fill"></span></div><p class="rw-progress-note"></p>' +
      '<div class="rw-rules">' +
        '<div class="rw-rule"><b>Earn</b><span>1 point per $1 &middot; double on Wax Wednesday</span></div>' +
        '<div class="rw-rule"><b>Redeem</b><span>100 points = $10 off, up to half any deposit</span></div>' +
        '<div class="rw-rule"><b>Refer</b><span>150 points when a friend&rsquo;s first visit is done</span></div>' +
      '</div>' +
      '<div class="rw-ref"><span>Your referral code</span><code class="rw-ref-code"></code><button class="rw-copy" type="button">Copy</button></div>' +
      '<p class="rw-hist-title">Recent activity</p><ul class="rw-history"></ul>';
    document.body.appendChild(backdrop); document.body.appendChild(modal);
    backdrop.addEventListener("click", close);
    modal.querySelector(".lm-close").addEventListener("click", close);
    modal.querySelector(".rw-copy").addEventListener("click", function () {
      var btn = this;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(data.refCode).then(function () {
          btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = "Copy"; }, 1500);
        }, function () {});
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") close();
    });
  };

  var render = function () {
    modal.querySelector(".rw-balance-num").textContent = String(data.points);
    var blocks = Math.floor(data.points / BLOCK_POINTS), toNext = BLOCK_POINTS - (data.points % BLOCK_POINTS);
    modal.querySelector(".rw-progress-note").textContent = blocks > 0
      ? money(blocks * BLOCK_VALUE) + " in rewards ready — apply it to any deposit"
      : toNext + " points to your first $" + BLOCK_VALUE + " reward";
    modal.querySelector(".rw-bar-fill").style.width = ((data.points % BLOCK_POINTS) / BLOCK_POINTS * 100) + "%";
    modal.querySelector(".rw-ref-code").textContent = data.refCode;
    var hist = modal.querySelector(".rw-history"); hist.textContent = "";
    if (!data.history.length) {
      var li = document.createElement("li"); li.className = "rw-hist-empty";
      li.textContent = "No activity yet — book a visit to start earning."; hist.appendChild(li);
    }
    data.history.slice(0, 8).forEach(function (h) {
      var li = document.createElement("li");
      var l = document.createElement("span"); l.textContent = h.label;
      var d = document.createElement("span"); d.className = h.delta >= 0 ? "rw-plus" : "rw-minus";
      d.textContent = (h.delta >= 0 ? "+" : "") + h.delta + " ✦";
      li.appendChild(l); li.appendChild(d); hist.appendChild(li);
    });
  };

  var open = function () {
    if (!modal) build();
    lastFocus = document.activeElement;
    render();
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

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-open-rewards]")) { e.preventDefault(); open(); }
  });

  load(); refresh();

  window.LumevinaRewards = {
    points: function () { return data.points; },
    quote: quote, award: award,
    spend: function (pts, label) { record(-pts, label || "Reward redeemed"); },
    redeemableBlocks: redeemableBlocks, blockPoints: BLOCK_POINTS, blockValue: BLOCK_VALUE,
    refCode: function () { return data.refCode; }, petalReveal: petalReveal, open: open
  };
})();

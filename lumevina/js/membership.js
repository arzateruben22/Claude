/* Lumevina — Glow Membership
 *
 * A monthly skincare membership. Each billing month adds one facial to the
 * member's account; unused facials bank (up to 2) so a busy month is never
 * wasted, and a banked facial can be gifted to a friend.
 *
 *   Glow      $159/mo  Lumevina Custom Facial (or Custom + Dermaplaning)
 *   Clear     $169/mo  Monthly Acne Treatment, plus a between-visit check-in
 *   Ageless   $209/mo  Ageless Grace Facial, plus a finishing add-on every
 *                      other visit (added in the room)
 *
 * Every plan: 10% off skincare from our shelf, a home routine from Evelyn
 * refreshed each season, 15% off add-ons and anything else booked in the
 * same visit as a membership facial, first word on flash openings.
 *
 * Founding Five: the first five members, on any plan, get a welcome
 * skincare kit (GlyMed+ Glycolic Facial Cleanser + Face Reality Daily SPF
 * 30 Plus, set aside from shelf stock when they join) and a free LED or
 * dermaplaning add-on at their first member facial.
 *
 * Terms (California auto-renewal friendly): the price, billing date and
 * minimum are shown before joining and agreed to with a checkbox; after the
 * 3-month minimum a member can cancel online at any time; one month can be
 * paused per year; the price stays locked while the membership continues.
 *
 * DEMO: records live in localStorage and billing is simulated. LIVE: a
 * Stripe Billing subscription per member (server/README.md → Memberships),
 * with invoice.paid webhooks adding the month's facial on the server.
 */
(function () {
  "use strict";

  var KEY = "lumevina_memberships";
  var BANK_CAP = 2;
  var MIN_MONTHS = 3;
  var BANK_AFTER_CANCEL_DAYS = 60;
  var FOUNDING_CAP = 25;
  var FIVE_CAP = 5;
  var KIT = [{ id: "gm-cleanser", name: "GlyMed+ Glycolic Facial Cleanser" },
             { id: "spf-30", name: "Face Reality Daily SPF 30 Plus" }];
  var KIT_VALUE = 75;
  var ADDON_VALUE = 27;     /* what the free LED or dermaplaning add-on is worth; no product cost */
  var SALES_KEY = "lumevina_retail_sales";

  /* A ladder: each tier includes everything in the one below it. */
  var PLANS = [
    { id: "glow", name: "Glow", price: 159, value: 195, popular: true, retail: 0.10,
      primary: "lumevina-custom-facial",
      covers: ["lumevina-custom-facial", "custom-facial-dermaplaning"],
      facial: "Lumevina Custom Facial",
      line: "Your monthly Lumevina Custom Facial",
      perks: ["One Lumevina Custom Facial a month (or Custom + Dermaplaning)",
              "10% off skincare from our shelf",
              "A home routine from Evelyn, refreshed each season",
              "15% off add-ons and anything else booked the same visit",
              "First word on flash openings"] },
    { id: "clear", name: "Clear Skin", price: 169, value: 195, retail: 0.10, includes: "glow",
      primary: "monthly-acne-treatment",
      covers: ["monthly-acne-treatment", "lumevina-custom-facial", "custom-facial-dermaplaning"],
      facial: "Monthly Acne Treatment",
      line: "Everything in Glow, plus your acne program on schedule",
      perks: ["Choose the Monthly Acne Treatment any month",
              "A between-visit check-in on your home routine"] },
    { id: "ageless", name: "Ageless", price: 209, value: 245, retail: 0.15, includes: "clear",
      primary: "ageless-grace-facial",
      covers: ["ageless-grace-facial", "monthly-acne-treatment", "lumevina-custom-facial", "custom-facial-dermaplaning"],
      facial: "Ageless Grace Facial",
      line: "Everything in Clear Skin, plus the signature lifting facial",
      perks: ["Upgrade to the Ageless Grace Facial any month",
              "A finishing add-on every other visit: LED or dermaplaning",
              "15% off skincare from our shelf, up from 10%"] }
  ];
  var byId = {};
  PLANS.forEach(function (p) { byId[p.id] = p; });

  /* ── storage ── */
  var emailKey = function (e) { return String(e || "").trim().toLowerCase(); };
  var loadAll = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  };
  var saveAll = function (all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode */ }
  };
  var changed = function () {
    document.dispatchEvent(new CustomEvent("lumevina:membership-changed"));
  };

  /* ── dates ── */
  var addMonths = function (iso, n) {
    var d = new Date(iso);
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.toISOString();
  };
  var addDays = function (iso, n) { return new Date(new Date(iso).getTime() + n * 864e5).toISOString(); };
  var fmtDate = function (iso) {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  var money = function (n) { return "$" + Number(n).toFixed(2).replace(/\.00$/, ""); };

  /* ── billing: bring a record up to today ──
     Each billing date that has passed either bills the month (adding one
     facial, capped at BANK_CAP) or skips it when paused. A cancellation
     takes effect on its date; banked facials stay usable for 60 days. */
  var accrue = function (r) {
    var now = Date.now(), dirty = false;
    while ((r.status === "active" || r.status === "cancelling") &&
           new Date(r.nextBillAt).getTime() <= now) {
      if (r.status === "cancelling" && new Date(r.nextBillAt).getTime() >= new Date(r.cancelAt).getTime()) {
        r.status = "cancelled";
        r.history.push({ at: r.cancelAt, type: "cancelled" });
        dirty = true;
        break;
      }
      var plan = byId[r.plan];
      if (r.pausedMonth === r.nextBillAt) {
        r.history.push({ at: r.nextBillAt, type: "paused", note: "Month paused, not billed" });
        r.pausedMonth = null;
      } else {
        r.history.push({ at: r.nextBillAt, type: "billed", amount: r.price || plan.price });
        r.credits = Math.min(BANK_CAP, r.credits + 1);
      }
      r.nextBillAt = addMonths(r.nextBillAt, 1);
      dirty = true;
    }
    if (r.status === "cancelling" && new Date(r.cancelAt).getTime() <= now) {
      r.status = "cancelled";
      r.history.push({ at: r.cancelAt, type: "cancelled" });
      dirty = true;
    }
    return dirty;
  };

  var get = function (email) {
    var k = emailKey(email);
    if (!k) return null;
    var all = loadAll();
    var r = all[k];
    if (!r) return null;
    if (accrue(r)) { all[k] = r; saveAll(all); }
    return r;
  };

  var put = function (r) {
    var all = loadAll();
    all[emailKey(r.email)] = r;
    saveAll(all);
    changed();
    return r;
  };

  /* can this record's facials be used right now? */
  var usable = function (r) {
    if (!r || r.credits < 1) return false;
    if (r.status === "cancelled") {
      return Date.now() < new Date(addDays(r.cancelAt, BANK_AFTER_CANCEL_DAYS)).getTime();
    }
    return true;
  };

  var isMember = function (r) {
    return !!r && (r.status === "active" || r.status === "cancelling");
  };

  /* ── actions ── */
  var join = function (planId, who) {
    var plan = byId[planId];
    if (!plan || !who || !emailKey(who.email)) return { ok: false, reason: "invalid" };
    var existing = get(who.email);
    if (isMember(existing)) return { ok: false, reason: "already", record: existing };
    var now = new Date().toISOString();
    var r = {
      email: who.email.trim(), name: (who.name || "").trim(), plan: plan.id,
      price: plan.price,                     /* founding price, locked while it continues */
      status: "active", startedAt: now,
      minEndsAt: addMonths(now, MIN_MONTHS),
      nextBillAt: addMonths(now, 1),
      credits: 1, used: 0, pausedMonth: null, lastPauseAt: null, cancelAt: null,
      card: who.card || null, founding: true,
      history: [{ at: now, type: "joined", amount: plan.price, note: "First month billed" }]
    };
    /* the first five members, any plan: a welcome kit and a free add-on.
       A spot stays claimed once given, even if that member later leaves. */
    var claimed = fiveClaimed();
    if (claimed < FIVE_CAP) {
      r.five = { no: claimed + 1, kit: "ready", addon: "ready" };
      r.history.push({ at: now, type: "founding-five", note: "Founding Five #" + (claimed + 1) + ": welcome kit set aside" });
      /* set the kit aside from shelf stock so the shop never oversells it, and
         log it as a giveaway at cost so the books carry what it really cost */
      var inv = window.LumevinaInventory;
      var log = [];
      try { log = JSON.parse(localStorage.getItem(SALES_KEY)) || []; } catch (e) { log = []; }
      var kitCost = 0, kitValue = 0;
      KIT.forEach(function (k) {
        var p = inv && inv.get(k.id);
        var cost = p ? Number(p.cost || 0) : 0, price = p ? Number(p.price || 0) : 0;
        kitCost += cost; kitValue += price;
        log.push({ id: k.id, name: p ? p.name : k.name, qty: 1, price: price, paid: 0, cost: cost,
          at: now, channel: "founding-five", type: "promo", note: "Founding Five #" + (claimed + 1) + " welcome kit" });
        if (inv) inv.decrement(k.id, 1);
      });
      try { localStorage.setItem(SALES_KEY, JSON.stringify(log)); } catch (e) { /* private mode */ }
      r.five.kitCost = kitCost;
      r.five.kitValue = kitValue || KIT_VALUE;
    }
    put(r);
    return { ok: true, record: r };
  };

  var covers = function (r, serviceId) {
    return !!r && byId[r.plan] && byId[r.plan].covers.indexOf(serviceId) !== -1;
  };

  var useCredit = function (email, serviceId, meta) {
    var r = get(email);
    if (!usable(r) || !covers(r, serviceId)) return { ok: false };
    r.credits -= 1;
    r.used += 1;
    r.history.push({ at: new Date().toISOString(), type: "used", service: serviceId,
      order: meta && meta.order });
    put(r);
    return { ok: true, record: r };
  };

  /* a cancelled appointment gives its facial back (cap still applies) */
  var returnCredit = function (email) {
    var r = get(email);
    if (!r) return;
    r.credits = Math.min(BANK_CAP, r.credits + 1);
    r.used = Math.max(0, r.used - 1);
    r.history.push({ at: new Date().toISOString(), type: "returned" });
    put(r);
  };

  var canPause = function (r) {
    if (!r || r.status !== "active" || r.pausedMonth) return false;
    return !r.lastPauseAt || Date.now() - new Date(r.lastPauseAt).getTime() > 365 * 864e5;
  };
  var pause = function (email) {
    var r = get(email);
    if (!canPause(r)) return { ok: false };
    r.pausedMonth = r.nextBillAt;
    r.lastPauseAt = new Date().toISOString();
    r.history.push({ at: r.lastPauseAt, type: "pause-set", note: "Skipping " + fmtDate(r.nextBillAt) });
    put(r);
    return { ok: true, record: r };
  };
  var unpause = function (email) {
    var r = get(email);
    if (!r || !r.pausedMonth) return { ok: false };
    r.pausedMonth = null;
    r.lastPauseAt = null;
    put(r);
    return { ok: true, record: r };
  };

  /* cancel online, any time: it takes effect at the end of the minimum
     term or of the month already paid for, whichever is later */
  var cancel = function (email) {
    var r = get(email);
    if (!isMember(r)) return { ok: false };
    var end = new Date(r.minEndsAt) > new Date(r.nextBillAt) ? r.minEndsAt : r.nextBillAt;
    r.status = "cancelling";
    r.cancelAt = end;
    r.pausedMonth = null;
    r.history.push({ at: new Date().toISOString(), type: "cancel-requested", note: "Ends " + fmtDate(end) });
    put(r);
    return { ok: true, record: r };
  };
  var keep = function (email) {
    var r = get(email);
    if (!r || r.status !== "cancelling") return { ok: false };
    r.status = "active";
    r.cancelAt = null;
    r.history.push({ at: new Date().toISOString(), type: "kept" });
    put(r);
    return { ok: true, record: r };
  };

  /* gift a banked facial: it becomes a treatment gift certificate */
  var giftCredit = function (email, to) {
    var r = get(email);
    var gc = window.LumevinaGiftCards;
    if (!usable(r) || !gc) return { ok: false };
    var plan = byId[r.plan];
    var card = gc.create({
      amount: plan.value, serviceId: plan.primary, label: plan.facial,
      recipientName: (to && to.name) || "", recipientEmail: (to && to.email) || "",
      message: "A facial from " + (r.name || "a Lumevina member") + ", gifted from their membership.",
      boughtBy: r.email, source: "membership"
    });
    r.credits -= 1;
    r.history.push({ at: new Date().toISOString(), type: "gifted", code: card.code });
    put(r);
    document.dispatchEvent(new CustomEvent("lumevina:giftcards-changed"));
    return { ok: true, card: card, record: r };
  };

  /* demo only: jump to the next billing date so the monthly cycle can be shown */
  var demoAdvance = function (email) {
    var r = get(email);
    if (!r) return;
    var shift = new Date(r.nextBillAt).getTime() - Date.now() + 1000;
    ["startedAt", "minEndsAt", "nextBillAt", "cancelAt", "lastPauseAt", "pausedMonth"].forEach(function (k) {
      if (r[k]) r[k] = new Date(new Date(r[k]).getTime() - shift).toISOString();
    });
    r.history.forEach(function (h) { h.at = new Date(new Date(h.at).getTime() - shift).toISOString(); });
    accrue(r);
    put(r);
  };

  var retailRate = function (email) {
    var r = get(email);
    return isMember(r) ? byId[r.plan].retail : 0;
  };
  var extrasRate = 0.15;

  var all = function () {
    var a = loadAll(), out = [];
    Object.keys(a).forEach(function (k) { var r = get(k); if (r) out.push(r); });
    return out;
  };
  var fiveClaimed = function () {
    var a = loadAll();
    return Object.keys(a).filter(function (k) { return a[k].five; }).length;
  };
  var fiveLeft = function () { return Math.max(0, FIVE_CAP - fiveClaimed()); };
  /* the free add-on rides on the member's next membership facial */
  var fiveAddonReady = function (r) { return !!(r && r.five && r.five.addon === "ready"); };
  var useFiveAddon = function (email, meta) {
    var r = get(email);
    if (!fiveAddonReady(r)) return { ok: false };
    r.five.addon = "used";
    r.five.addonValue = ADDON_VALUE;
    r.history.push({ at: new Date().toISOString(), type: "five-addon", value: ADDON_VALUE, order: meta && meta.order });
    put(r);
    return { ok: true, record: r };
  };
  /* the owner marks the kit handed over (dashboard) */
  var giveKit = function (email) {
    var r = get(email);
    if (!r || !r.five || r.five.kit === "given") return { ok: false };
    r.five.kit = "given";
    r.history.push({ at: new Date().toISOString(), type: "five-kit" });
    put(r);
    return { ok: true, record: r };
  };
  var foundingLeft = function () {
    return Math.max(0, FOUNDING_CAP - all().filter(function (r) { return r.founding && r.status !== "cancelled"; }).length);
  };

  var api = {
    plans: PLANS, plan: function (id) { return byId[id] || null; },
    BANK_CAP: BANK_CAP, MIN_MONTHS: MIN_MONTHS, FOUNDING_CAP: FOUNDING_CAP,
    get: get, isMember: isMember, usable: usable, covers: covers,
    join: join, useCredit: useCredit, returnCredit: returnCredit,
    canPause: canPause, pause: pause, unpause: unpause, cancel: cancel, keep: keep,
    giftCredit: giftCredit, demoAdvance: demoAdvance,
    retailRate: retailRate, extrasRate: extrasRate,
    all: all, foundingLeft: foundingLeft, fmtDate: fmtDate, money: money,
    FIVE_CAP: FIVE_CAP, KIT: KIT, KIT_VALUE: KIT_VALUE, ADDON_VALUE: ADDON_VALUE,
    fiveLeft: fiveLeft, fiveAddonReady: fiveAddonReady, useFiveAddon: useFiveAddon, giveKit: giveKit
  };
  window.LumevinaMembership = api;

  /* ══════════════════ UI ══════════════════ */
  var pay = window.LumevinaPayments;
  var section = document.getElementById("membership");
  /* the Glow Routine window borrows these styles, so skip it */
  var overlay = document.querySelector(".member-overlay:not(.routine-overlay)");
  var modal = document.querySelector(".member-modal:not(.routine-modal)");

  var currentEmail = function () {
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    return s ? s.email : "";
  };

  /* ── the better the tier, the brighter the light (clearer skin) ──
     On phones the swipe position drives it (js/reel.js sets --reel-pos);
     where the plans sit side by side, hovering or focusing one does. */
  if (section) {
    var planGrid = section.querySelector(".mem-grid");
    var sideBySide = function () { return planGrid && planGrid.scrollWidth <= planGrid.clientWidth + 1; };
    var setHover = function (v) { section.style.setProperty("--mem-hover", v); };
    section.querySelectorAll(".mem-plan[data-tier]").forEach(function (plan) {
      var lvl = Number(plan.getAttribute("data-tier")) - 1;
      plan.addEventListener("pointerenter", function () { if (sideBySide()) setHover(lvl); });
      plan.addEventListener("focusin", function () { if (sideBySide()) setHover(lvl); });
    });
    if (planGrid) planGrid.addEventListener("pointerleave", function () { setHover(0); });
  }

  /* ── plan cards reflect the visitor's own membership ── */
  var renderSection = function () {
    if (!section) return;
    var r = get(currentEmail());
    section.querySelectorAll("[data-join]").forEach(function (btn) {
      var mine = isMember(r) && r.plan === btn.getAttribute("data-join");
      btn.textContent = mine ? "Your plan · manage" : "Join " + byId[btn.getAttribute("data-join")].name;
      btn.classList.toggle("is-mine", mine);
    });
    var five = section.querySelector(".mem-five");
    if (five) {
      var n = fiveLeft();
      five.classList.toggle("is-full", n === 0);
      five.querySelector(".mem-five-left").textContent = n === 0 ? "All five spots are taken"
        : n === 1 ? "1 spot left" : n + " of " + FIVE_CAP + " spots left";
    }
  };

  /* ── join modal ── */
  var chosen = null, usingSaved = false, lastFocus = null;
  var $ = function (sel) { return modal ? modal.querySelector(sel) : null; };

  var openJoin = function (planId) {
    if (!modal) return;
    var r = get(currentEmail());
    if (isMember(r) && window.LumevinaAccount) { window.LumevinaAccount.open(); return; }
    chosen = byId[planId];
    lastFocus = document.activeElement;
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    $(".mj-form").hidden = false;
    $(".mj-done").hidden = true;
    $(".mj-plan-name").textContent = chosen.name + " Membership";
    $(".mj-plan-line").textContent = chosen.line;
    $(".mj-price").textContent = money(chosen.price);
    var next = addMonths(new Date().toISOString(), 1);
    var terms = $(".mj-terms");
    terms.textContent = "";
    [["Today", money(chosen.price) + " · your first facial is ready to book"],
     ["Then", money(chosen.price) + " on the " + ordinal(new Date(next).getDate()) + " of each month"],
     ["Minimum", MIN_MONTHS + " months, then month to month"],
     ["Cancel", "Online, any time: it ends after your minimum or the month you've paid for"],
     ["Price", "Locked at " + money(chosen.price) + " for as long as you stay"]].forEach(function (row) {
      var li = document.createElement("li");
      var a = document.createElement("span"); a.textContent = row[0];
      var b = document.createElement("span"); b.textContent = row[1];
      li.appendChild(a); li.appendChild(b); terms.appendChild(li);
    });
    var fl = fiveLeft(), fiveEl = $(".mj-five");
    if (fiveEl) {
      fiveEl.hidden = fl === 0;
      if (fl > 0) fiveEl.querySelector(".mj-five-no").textContent = "#" + (FIVE_CAP - fl + 1) + " of " + FIVE_CAP;
    }
    $(".mj-agree-text").textContent = "I agree to be billed " + money(chosen.price) +
      " today and every month until I cancel. I can cancel online any time; a " + MIN_MONTHS +
      "-month minimum applies. Unused facials bank up to " + BANK_CAP + ".";
    $("#mj-name").value = s ? s.name : "";
    $("#mj-email").value = s ? s.email : "";
    $("#mj-agree").checked = false;
    $(".mj-status").textContent = "";
    $(".mj-pay .btn-mb-inner").textContent = "Start membership · " + money(chosen.price);
    setupCard();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var ordinal = function (n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  var setupCard = function () {
    var card = pay && pay.getCard && pay.getCard($("#mj-email").value);
    usingSaved = !!card;
    $(".mj-saved").hidden = !card;
    $(".mj-card-fields").hidden = !!card;
    if (card) $(".mj-saved-info").textContent = "💳 " + card.brand + " •••• " + card.last4 + " on file";
  };

  var closeJoin = function () {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };

  var submitJoin = function () {
    var name = $("#mj-name").value.trim(), email = $("#mj-email").value.trim();
    var problems = [];
    if (!name) problems.push("your name");
    if (!email || !$("#mj-email").checkValidity()) problems.push("a valid email");
    if (!usingSaved) {
      if (!pay.cardValid($("#mj-card").value)) problems.push("a valid card number");
      if (!pay.expiryValid($("#mj-expiry").value)) problems.push("a future expiry (MM/YY)");
      if (!pay.cvcValid($("#mj-cvc").value)) problems.push("a 3–4 digit CVC");
    }
    if (!$("#mj-agree").checked) problems.push("agreement to the monthly billing terms");
    if (problems.length) { $(".mj-status").textContent = "Please add " + problems.join(", ") + "."; return; }
    var existing = get(email);
    if (isMember(existing)) {
      $(".mj-status").textContent = "That email already has a " + byId[existing.plan].name +
        " membership. Open My Lumevina to manage it.";
      return;
    }
    var btn = $(".mj-pay");
    btn.disabled = true;
    $(".mj-status").textContent = "Starting your membership…";
    pay.process({ amount: chosen.price, description: chosen.name + " Membership — first month" }, function (err, res) {
      btn.disabled = false;
      if (err) { $(".mj-status").textContent = "Payment failed — please try again."; return; }
      $(".mj-status").textContent = "";
      /* the membership card goes on file: it pays each month and
         makes booking the member's facials a no-card-entry tap */
      var saved = usingSaved ? pay.getCard(email)
        : pay.saveCard(email, $("#mj-card").value, $("#mj-expiry").value);
      var out = join(chosen.id, { name: name, email: email,
        card: saved ? { brand: saved.brand, last4: saved.last4 } : null });
      if (window.LumevinaAccount && window.LumevinaAccount.signIn) window.LumevinaAccount.signIn(name, email);
      $(".mj-form").hidden = true;
      $(".mj-done").hidden = false;
      $(".mj-done-title").textContent = "Welcome to " + chosen.name + ", " + name.split(" ")[0] + ".";
      $(".mj-done-body").textContent = "Your first " + chosen.facial + " is on your account, ready to book. " +
        (out.record.five ? "You're Founding Five member #" + out.record.five.no + ": your welcome skincare kit is set aside " +
          "for pickup at your first visit, and your first facial includes a free LED or dermaplaning add-on. " : "") +
        "Next billing: " + fmtDate(out.record.nextBillAt) + ". Order " + res.id + ".";
      $(".mj-book").focus();
      renderSection();
    });
  };

  if (modal) {
    pay.bindCardFields($("#mj-card"), $("#mj-expiry"), $("#mj-cvc"));
    $(".mj-close").addEventListener("click", closeJoin);
    overlay.addEventListener("click", closeJoin);
    $(".mj-pay").addEventListener("click", submitJoin);
    $("#mj-email").addEventListener("change", setupCard);
    $(".mj-saved-change").addEventListener("click", function () {
      usingSaved = false; $(".mj-saved").hidden = true; $(".mj-card-fields").hidden = false; $("#mj-card").focus();
    });
    $(".mj-book").addEventListener("click", function () {
      closeJoin();
      if (window.LumevinaBooking) window.LumevinaBooking.open(chosen.primary);
    });
    $(".mj-finish").addEventListener("click", closeJoin);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeJoin();
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-join]");
    if (!b) return;
    openJoin(b.getAttribute("data-join"));
  });

  /* ── My Lumevina card ── */
  var renderAccount = function (el, email) {
    if (!el) return;
    el.textContent = "";
    var r = get(email);
    var h = function (tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    if (!r || (r.status === "cancelled" && !usable(r))) {
      el.appendChild(h("p", "mem-acct-empty",
        "A facial every month, banked if you're busy, from $159. Members also get 10% off skincare from our shelf." +
        (fiveLeft() > 0 ? " The first five members get a free welcome skincare kit." : "")));
      var see = h("a", "btn btn-ghost mem-acct-see", "See memberships");
      see.href = "#membership";
      see.addEventListener("click", function () {
        var c = document.querySelector(".account-close"); if (c) c.click();
      });
      el.appendChild(see);
      return;
    }
    var plan = byId[r.plan];
    var head = h("div", "mem-acct-head");
    head.appendChild(h("span", "mem-acct-plan", plan.name + " Membership"));
    if (r.five) head.appendChild(h("span", "mem-acct-five", "Founding Five · #" + r.five.no));
    var pill = r.status === "cancelling" ? "Ends " + fmtDate(r.cancelAt)
      : r.status === "cancelled" ? "Ended" : r.pausedMonth ? "Pausing next month" : "Active";
    head.appendChild(h("span", "mem-acct-pill" + (r.status === "active" && !r.pausedMonth ? " on" : ""), pill));
    el.appendChild(head);

    var big = h("div", "mem-acct-credits");
    var dots = h("span", "mem-acct-dots");
    for (var i = 0; i < BANK_CAP; i++) dots.appendChild(h("i", i < r.credits ? "on" : ""));
    big.appendChild(h("span", "mem-acct-num", String(r.credits)));
    big.appendChild(h("span", "mem-acct-lbl", (r.credits === 1 ? "facial" : "facials") + " ready to book"));
    big.appendChild(dots);
    el.appendChild(big);

    var facts = h("ul", "mem-acct-facts");
    var fact = function (a, b) { var li = h("li"); li.appendChild(h("span", "", a)); li.appendChild(h("span", "", b)); facts.appendChild(li); };
    if (r.status === "cancelling") fact("Last day", fmtDate(r.cancelAt) + " · no more billing");
    else if (r.status !== "cancelled") fact(r.pausedMonth ? "Skipping" : "Next billing",
      fmtDate(r.nextBillAt) + (r.pausedMonth ? " (paused)" : " · " + money(r.price)));
    fact("Member since", fmtDate(r.startedAt));
    if (Date.now() < new Date(r.minEndsAt).getTime()) fact("Minimum ends", fmtDate(r.minEndsAt));
    if (r.status === "cancelled") fact("Use banked facials by", fmtDate(addDays(r.cancelAt, BANK_AFTER_CANCEL_DAYS)));
    if (r.card) fact("Billing card", r.card.brand + " •••• " + r.card.last4);
    if (r.five) {
      fact("Welcome kit", r.five.kit === "given" ? "Picked up" : "Set aside · pick up at your next visit");
      fact("Free add-on", r.five.addon === "used" ? "Used" : "LED or dermaplaning at your next member facial");
    }
    el.appendChild(facts);

    var actions = h("div", "mem-acct-actions");
    var btn = function (label, cls, fn) {
      var b = h("button", "btn " + cls, label); b.type = "button"; b.addEventListener("click", fn); actions.appendChild(b); return b;
    };
    var note = h("p", "mem-acct-note");
    note.setAttribute("role", "status");
    if (usable(r)) btn("Book my " + (plan.id === "clear" ? "treatment" : "facial"), "btn-solid", function () {
      var c = document.querySelector(".account-close"); if (c) c.click();
      if (window.LumevinaBooking) window.LumevinaBooking.open(plan.primary);
    });
    if (usable(r)) btn("Gift a facial", "btn-ghost", function () { showGift(); });
    if (r.status === "active" && r.pausedMonth) btn("Undo pause", "btn-ghost", function () { unpause(r.email); renderAccount(el, email); });
    else if (canPause(r)) btn("Pause next month", "btn-ghost", function () {
      var out = pause(r.email);
      renderAccount(el, email);
      if (out.ok) el.querySelector(".mem-acct-note").textContent = "Paused: " + fmtDate(out.record.pausedMonth) + " won't be billed. One pause per year.";
    });
    if (r.status === "cancelling") btn("Keep my membership", "btn-ghost", function () { keep(r.email); renderAccount(el, email); });
    else if (r.status === "active") {
      var c = btn("Cancel membership", "btn-ghost mem-cancel", function () {
        if (c.dataset.arm !== "1") {
          c.dataset.arm = "1";
          var end = new Date(r.minEndsAt) > new Date(r.nextBillAt) ? r.minEndsAt : r.nextBillAt;
          c.textContent = "Tap again to confirm: ends " + fmtDate(end);
          return;
        }
        cancel(r.email);
        renderAccount(el, email);
      });
    }
    el.appendChild(actions);
    el.appendChild(note);

    /* gift a banked facial */
    var gift = h("form", "mem-gift");
    gift.hidden = true;
    gift.setAttribute("autocomplete", "off");
    gift.appendChild(h("p", "mem-gift-lead", "Send one of your banked facials as a gift certificate for the " + plan.facial + "."));
    var gn = h("input"); gn.type = "text"; gn.placeholder = "Friend's name"; gn.setAttribute("aria-label", "Friend's name");
    var ge = h("input"); ge.type = "email"; ge.placeholder = "Friend's email"; ge.setAttribute("aria-label", "Friend's email");
    var gb = h("button", "btn btn-solid", "Send gift"); gb.type = "submit";
    gift.appendChild(gn); gift.appendChild(ge); gift.appendChild(gb);
    el.appendChild(gift);
    var showGift = function () { gift.hidden = false; gn.focus(); };
    gift.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!gn.value.trim() || !ge.value.trim() || !ge.checkValidity()) {
        note.textContent = "Add your friend's name and a valid email."; return;
      }
      var out = giftCredit(r.email, { name: gn.value.trim(), email: ge.value.trim() });
      renderAccount(el, email);
      el.querySelector(".mem-acct-note").textContent = out.ok
        ? "✓ Gift sent to " + out.card.recipientName + " · code " + out.card.code
        : "That facial couldn't be gifted right now.";
    });

    /* demo: show the monthly cycle without waiting a month */
    var demo = h("button", "mem-demo", "Demo · skip to next billing date");
    demo.type = "button";
    demo.addEventListener("click", function () { demoAdvance(r.email); renderAccount(el, email); });
    el.appendChild(demo);
  };
  api.renderAccount = renderAccount;

  document.addEventListener("lumevina:membership-changed", renderSection);
  document.addEventListener("lumevina:account-changed", renderSection);
  renderSection();
})();

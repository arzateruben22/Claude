/* Lumevina — Glow Membership
 *
 * A monthly skincare membership. Each billing month adds one facial to the
 * member's account; unused facials bank (up to 2) so a busy month is never
 * wasted, and a banked facial can be gifted to a friend. With two facials
 * waiting, billing holds: that month isn't charged, and billing picks up
 * again once one is booked or gifted. Nobody pays for a facial they can't use.
 *
 *   Glow      $185/mo  Lumevina Custom Facial or the
 *                      Monthly Acne Treatment for clients on the acne program
 *   Ageless   $235/mo  Ageless Grace Facial, plus dermaplaning every
 *                      other visit (added in the room)
 *
 *   Founding rate: the first 25 members pay $175 / $225, locked for as
 *   long as their membership continues (priceNow()). Raised Oct 20 for v3:
 *   members now also book with no deposit (their card on file holds it).
 *
 * Two plans, not three: clear-skin clients join Glow and pick the acne
 * treatment. Records saved under the old "clear" plan read as Glow.
 *
 * Every plan: 10% off skincare from our shelf (free shipping on it), a home routine from Evelyn
 * refreshed each season, 15% off add-ons and anything else booked in the
 * same visit as a membership facial, no deposits (the card on file holds the
 * booking), Ask Evelyn any time (js/ask.js: her own reply within 24 hours),
 * first word on flash openings.
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
 * Stripe Billing subscription per member (functions/membership): joining
 * opens Stripe's page, each paid invoice adds the month's facial on the
 * server, and My Lumevina's buttons (pause, cancel, gift, change card) go
 * to the server. The signed-in member's record is fetched and kept here in
 * the same shape as the demo's, so the booking calendar reads it the same way.
 */
(function () {
  "use strict";

  /* held back on the website for now (js/site-config.js) */
  if (window.LumevinaFeatures && !window.LumevinaFeatures.on("membership")) return;

  var KEY = "lumevina_memberships";
  /* live (js/site-config.js → shop): Stripe Billing through functions/membership */
  var SHOPCFG = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOPCFG.supabase || "") && !!SHOPCFG.key;
  var liveFounding = null;   /* founding spots left, from the server */
  var BANK_CAP = 2;
  var MIN_MONTHS = 3;
  var BANK_AFTER_CANCEL_DAYS = 60;
  var FOUNDING_CAP = 25;
  var FIVE_CAP = 5;
  var KIT = [{ id: "gm-cleanser", name: "GlyMed+ Glycolic Facial Cleanser" },
             { id: "spf-30", name: "Face Reality Daily SPF 30 Plus" }];
  var KIT_VALUE = 75;
  var ADDON_VALUE = 40;     /* what the free dermaplaning add-on is worth (Ageless Grace + Dermaplaning is $40 more); no product cost */
  var SALES_KEY = "lumevina_retail_sales";

  /* Ageless includes everything in Glow. */
  var PLANS = [
    /* repriced Oct 19, 2026 for her current menu: the Custom Facial and the
       Monthly Acne Treatment are $200, the Ageless Grace $240, dermaplaning
       now its own option (+$30 to +$40), so it's a member add-on, not covered */
    { id: "glow", name: "Glow", price: 185, founding: 175, value: 200, popular: true, retail: 0.10,
      primary: "lumevina-custom-facial",
      covers: ["lumevina-custom-facial", "monthly-acne-treatment"],
      facial: "Lumevina Custom Facial",
      line: "Your monthly Lumevina Custom Facial, or your acne treatment",
      perks: ["One facial a month: the Lumevina Custom Facial or the Monthly Acne Treatment",
              "10% off skincare from our shelf, and free shipping",
              "A home routine from Evelyn, refreshed each season, with a check-in between visits",
              "15% off add-ons and anything else booked the same visit",
              "No deposits: your card on file holds each booking",
              "Ask Evelyn any time: instant answers, and her own reply within 24 hours",
              "First word on flash openings"] },
    { id: "ageless", name: "Ageless", price: 235, founding: 225, value: 240, retail: 0.15, includes: "glow",
      primary: "ageless-grace-facial",
      covers: ["ageless-grace-facial", "monthly-acne-treatment", "lumevina-custom-facial"],
      facial: "Ageless Grace Facial",
      line: "Everything in Glow, plus the signature lifting facial",
      perks: ["Upgrade to the Ageless Grace Facial any month",
              "A finishing add-on every other visit: LED or dermaplaning",
              "15% off skincare from our shelf, up from 10%"] }
  ];
  var byId = {};
  PLANS.forEach(function (p) { byId[p.id] = p; });
  byId.clear = byId.glow;   /* the retired Clear Skin plan: its members are on Glow */

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

  /* ── live: functions/membership ── */
  var liveCache = {};   /* email → the signed-in member's record, in the demo's shape */
  var signedToken = function () { return window.LumevinaAccount && window.LumevinaAccount.token ? window.LumevinaAccount.token() : ""; };
  var memberApi = function (body) {
    var tk = signedToken();
    return fetch(SHOPCFG.supabase.replace(/\/$/, "") + "/functions/v1/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOPCFG.key, Authorization: "Bearer " + (tk || SHOPCFG.key) },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; }); });
  };
  var fromServer = function (m, email) {
    var card = m.card ? /^(.*) •••• (\d{4})$/.exec(m.card) : null;
    return {
      email: email, name: "", plan: m.plan, price: m.price_cents / 100, status: m.status, credits: m.credits,
      startedAt: m.started_at, minEndsAt: m.min_ends_at, nextBillAt: m.next_bill_at, pausedMonth: m.paused_bill_at,
      lastPauseAt: m.last_pause_at, cancelAt: m.cancel_at, founding: m.founding, live: true, onHoldServer: !!m.on_hold,
      five: m.five_no ? { no: m.five_no, kit: m.five_kit, addon: m.five_addon } : null,
      card: card ? { brand: card[1], last4: card[2] } : null, history: []
    };
  };
  var refreshLive = function () {
    if (!LIVE) return Promise.resolve();
    memberApi({ action: "plans" }).then(function (j) { if (j._ok && typeof j.founding_left === "number") { liveFounding = j.founding_left; changed(); } });
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    if (!s || !signedToken()) { liveCache = {}; return Promise.resolve(); }
    return memberApi({ action: "status" }).then(function (j) {
      liveCache = {};
      if (j.member) liveCache[emailKey(s.email)] = fromServer(j.member, s.email);
      changed();
    }, function () { /* offline: keep what we had */ });
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
     Each billing date that has passed bills the month (adding one facial),
     skips it when paused, or holds it when BANK_CAP facials are already
     waiting: no charge and no new facial. A cancellation takes effect on
     its date; banked facials stay usable for 60 days. */
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
      } else if (r.credits >= BANK_CAP) {
        r.history.push({ at: r.nextBillAt, type: "held", note: r.credits + " facials waiting: month not billed" });
      } else {
        r.history.push({ at: r.nextBillAt, type: "billed", amount: r.price || plan.price });
        r.credits += 1;
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
    if (LIVE) return liveCache[k] || null;
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

  /* billing holds while BANK_CAP facials are waiting (a paused month skips anyway) */
  var onHold = function (r) {
    if (r && r.live) return isMember(r) && r.onHoldServer;
    return isMember(r) && !r.pausedMonth && r.credits >= BANK_CAP;
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
      price: priceNow(plan.id),              /* today's price, locked while it continues */
      status: "active", startedAt: now,
      minEndsAt: addMonths(now, MIN_MONTHS),
      nextBillAt: addMonths(now, 1),
      credits: 1, used: 0, pausedMonth: null, lastPauseAt: null, cancelAt: null,
      card: who.card || null, founding: foundingLeft() > 0,
      history: [{ at: now, type: "joined", amount: priceNow(plan.id), note: "First month billed" }]
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

  /* a cancelled appointment always gives its facial back, even past the cap:
     it was paid for. Billing simply holds until the count drops below it. */
  var returnCredit = function (email) {
    var r = get(email);
    if (!r) return;
    r.credits += 1;
    r.used = Math.max(0, r.used - 1);
    r.history.push({ at: new Date().toISOString(), type: "returned" });
    put(r);
  };

  var canPause = function (r) {
    /* on hold, the month isn't billed anyway: don't spend the year's pause on it */
    if (!r || r.status !== "active" || r.pausedMonth || onHold(r)) return false;
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
    if (LIVE && liveFounding != null) return liveFounding;
    return Math.max(0, FOUNDING_CAP - all().filter(function (r) { return r.founding && r.status !== "cancelled"; }).length);
  };
  /* what joining costs today: the founding rate while spots are left */
  var priceNow = function (planId) {
    var p = byId[planId];
    return p ? (foundingLeft() > 0 ? p.founding : p.price) : 0;
  };

  var api = {
    plans: PLANS, plan: function (id) { return byId[id] || null; },
    BANK_CAP: BANK_CAP, MIN_MONTHS: MIN_MONTHS, FOUNDING_CAP: FOUNDING_CAP,
    get: get, isMember: isMember, onHold: onHold, usable: usable, covers: covers,
    join: join, useCredit: useCredit, returnCredit: returnCredit,
    canPause: canPause, pause: pause, unpause: unpause, cancel: cancel, keep: keep,
    giftCredit: giftCredit, demoAdvance: demoAdvance, refresh: refreshLive, live: LIVE,
    retailRate: retailRate, extrasRate: extrasRate,
    all: all, foundingLeft: foundingLeft, priceNow: priceNow, fmtDate: fmtDate, money: money,
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
    var left = foundingLeft();
    PLANS.forEach(function (p) {
      var amt = section.querySelector('[data-price="' + p.id + '"]');
      if (amt) amt.textContent = money(isMember(r) && r.plan === p.id ? r.price : priceNow(p.id));
      var rate = section.querySelector('[data-rate="' + p.id + '"]');
      if (rate) rate.textContent = isMember(r) && r.plan === p.id ? "Your rate, locked while you stay"
        : left > 0 ? "Founding rate · regularly " + money(p.price) : "";
    });
    var fl = section.querySelector(".mem-founding");
    if (fl) {
      fl.hidden = left === 0;
      fl.querySelector(".mem-founding-left").textContent = left === 1 ? "1 spot left" : left + " of " + FOUNDING_CAP + " spots left";
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
    var price = priceNow(chosen.id);
    $(".mj-price").textContent = money(price);
    var next = addMonths(new Date().toISOString(), 1);
    var terms = $(".mj-terms");
    terms.textContent = "";
    [["Today", money(price) + " · your first facial is ready to book"],
     ["Then", money(price) + " on the " + ordinal(new Date(next).getDate()) + " of each month"],
     ["Minimum", MIN_MONTHS + " months, then month to month"],
     ["Cancel", "Online, any time: it ends after your minimum or the month you've paid for"],
     ["Price", "Locked at " + money(price) + " for as long as you stay" + (price < chosen.price ? " (founding rate)" : "")]].forEach(function (row) {
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
    $(".mj-agree-text").textContent = "I agree to be billed " + money(price) +
      " today and every month until I cancel. I can cancel online any time; a " + MIN_MONTHS +
      "-month minimum applies. Unused facials bank up to " + BANK_CAP + "; with " + BANK_CAP +
      " waiting, I'm not billed until I book one.";
    $("#mj-name").value = s ? s.name : "";
    $("#mj-email").value = s ? s.email : "";
    $("#mj-agree").checked = false;
    $(".mj-status").textContent = "";
    $(".mj-pay .btn-mb-inner").textContent = (LIVE ? "Continue to payment · " : "Start membership · ") + money(price);
    var fine = $(".mj-fine");
    if (fine && LIVE) fine.textContent = "Stripe's secure page takes the first month and keeps your card on file for the months after, and for booking your facials in one tap.";
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
    if (LIVE) { $(".mj-saved").hidden = true; $(".mj-card-fields").hidden = true; usingSaved = true; return; }
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
    if (LIVE) {
      btn.disabled = true;
      $(".mj-status").textContent = "Opening the secure payment page…";
      memberApi({ action: "join", plan: chosen.id, name: name, email: email, agreed: true, returnUrl: location.href.split(/[?#]/)[0] }).then(function (j) {
        btn.disabled = false;
        if (j.url) {
          var framed = true;
          try { framed = window.self !== window.top; } catch (e) { /* cross-origin */ }
          if (framed) { if (!window.open(j.url, "_blank", "noopener")) $(".mj-status").innerHTML = 'Tap to <a href="' + j.url.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">open the secure payment page</a>.'; }
          else location.assign(j.url);
          return;
        }
        $(".mj-status").textContent = j.reason === "already" ? "That email already has a membership. Sign in and open My Lumevina to manage it."
          : j.reason === "email" ? "Check your name and email." : "Payments aren't available right now. Please try again in a few minutes.";
      }, function () { btn.disabled = false; $(".mj-status").textContent = "Couldn't reach the payment page. Check your connection and try again."; });
      return;
    }
    btn.disabled = true;
    $(".mj-status").textContent = "Starting your membership…";
    pay.process({ amount: priceNow(chosen.id), description: chosen.name + " Membership — first month" }, function (err, res) {
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
        "A facial every month, banked if you're busy, from " + money(priceNow("glow")) + ". Members also get 10% off skincare from our shelf and book with no deposit." +
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
    var hold = onHold(r);
    var pill = r.status === "cancelling" ? "Ends " + fmtDate(r.cancelAt)
      : r.status === "cancelled" ? "Ended" : r.pausedMonth ? "Pausing next month" : hold ? "Billing on hold" : "Active";
    head.appendChild(h("span", "mem-acct-pill" + (r.status === "active" && !r.pausedMonth && !hold ? " on" : ""), pill));
    el.appendChild(head);

    var big = h("div", "mem-acct-credits");
    var dots = h("span", "mem-acct-dots");
    for (var i = 0; i < Math.max(BANK_CAP, r.credits); i++) dots.appendChild(h("i", i < r.credits ? "on" : ""));
    big.appendChild(h("span", "mem-acct-num", String(r.credits)));
    big.appendChild(h("span", "mem-acct-lbl", (r.credits === 1 ? "facial" : "facials") + " ready to book"));
    big.appendChild(dots);
    el.appendChild(big);
    if (hold) {
      el.appendChild(h("p", "mem-acct-hold", "You have " + r.credits + " facials waiting, so we won't bill you on " +
        fmtDate(r.nextBillAt) + ". Book one and your monthly facial picks up again. Nothing is lost."));
    }

    var facts = h("ul", "mem-acct-facts");
    var fact = function (a, b) { var li = h("li"); li.appendChild(h("span", "", a)); li.appendChild(h("span", "", b)); facts.appendChild(li); };
    if (r.status === "cancelling") fact("Last day", fmtDate(r.cancelAt) + " · no more billing");
    else if (r.status !== "cancelled") fact(r.pausedMonth ? "Skipping" : "Next billing",
      hold ? "On hold until you book" : fmtDate(r.nextBillAt) + (r.pausedMonth ? " (paused)" : " · " + money(r.price)));
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
    /* an action: the server's, live; this browser's, in the demo */
    var act = function (name, local, extra, after) {
      if (!r.live) { var out = local(); renderAccount(el, email); if (after) after(out); return; }
      note.textContent = "One moment…";
      memberApi(Object.assign({ action: name }, extra || {})).then(function (j) {
        if (!j._ok) { note.textContent = "That didn't go through. Try again in a moment."; return; }
        refreshLive().then(function () { renderAccount(el, email); if (after) after(j); });
      }, function () { note.textContent = "Couldn't reach the server. Check your connection."; });
    };
    if (usable(r)) btn("Book my facial", "btn-solid", function () {
      var c = document.querySelector(".account-close"); if (c) c.click();
      if (window.LumevinaBooking) window.LumevinaBooking.open(plan.primary);
    });
    if (usable(r)) btn("Gift a facial", "btn-ghost", function () { showGift(); });
    if (r.status === "active" && r.pausedMonth) btn("Undo pause", "btn-ghost", function () { act("unpause", function () { return unpause(r.email); }); });
    else if (canPause(r)) btn("Pause next month", "btn-ghost", function () {
      var skip = r.nextBillAt;
      act("pause", function () { return pause(r.email); }, null, function () {
        el.querySelector(".mem-acct-note").textContent = "Paused: " + fmtDate(skip) + " won't be billed. One pause per year.";
      });
    });
    if (r.status === "cancelling") btn("Keep my membership", "btn-ghost", function () { act("keep", function () { return keep(r.email); }); });
    else if (r.status === "active") {
      var c = btn("Cancel membership", "btn-ghost mem-cancel", function () {
        if (c.dataset.arm !== "1") {
          c.dataset.arm = "1";
          var end = new Date(r.minEndsAt) > new Date(r.nextBillAt) ? r.minEndsAt : r.nextBillAt;
          c.textContent = "Tap again to confirm: ends " + fmtDate(end);
          return;
        }
        act("cancel", function () { return cancel(r.email); });
      });
    }
    if (r.live && r.status !== "cancelled") btn("Change billing card", "btn-ghost", function () {
      memberApi({ action: "card", returnUrl: location.href.split(/[?#]/)[0] }).then(function (j) { if (j.url) location.assign(j.url); else note.textContent = "That isn't available right now."; });
    });
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
      var to = { name: gn.value.trim(), email: ge.value.trim() };
      act("gift", function () { return giftCredit(r.email, to); }, to, function (out) {
        el.querySelector(".mem-acct-note").textContent = out && (out.ok || out.sent_to)
          ? "✓ Gift sent to " + to.name + (out.card ? " · code " + out.card.code : ". It's on its way to their inbox.")
          : "That facial couldn't be gifted right now.";
      });
    });

    /* demo: show the monthly cycle without waiting a month */
    if (!r.live) {
      var demo = h("button", "mem-demo", "Demo · skip to next billing date");
      demo.type = "button";
      demo.addEventListener("click", function () { demoAdvance(r.email); renderAccount(el, email); });
      el.appendChild(demo);
    }
  };
  api.renderAccount = renderAccount;

  document.addEventListener("lumevina:membership-changed", renderSection);
  document.addEventListener("lumevina:account-changed", function () { renderSection(); refreshLive(); });
  document.addEventListener("lumevina:booked", function () { if (LIVE) refreshLive(); });
  renderSection();
  if (LIVE) refreshLive();

  /* back from Stripe: ?joined=<plan> (the webhook makes the membership a moment later) */
  var joined = /[?&]joined=(glow|ageless|cancelled)\b/.exec(location.search);
  if (joined && LIVE) {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* old browser */ }
    if (joined[1] !== "cancelled") {
      var N = window.LumevinaNotice;
      var plan = byId[joined[1]];
      if (N) N.show("Welcome to " + plan.name + ".", "Your membership is starting: your first " + plan.facial +
        " appears in My Lumevina in a moment (sign in with the email you used). Book it any time, with no deposit.");
      var tries = 0;
      var poll = function () { refreshLive().then(function () { var s0 = window.LumevinaAccount && window.LumevinaAccount.current(); if (!(s0 && get(s0.email)) && ++tries < 5) setTimeout(poll, 2000); }); };
      poll();
    }
  }
})();

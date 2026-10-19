/* Lumevina — gift-certificate store
 *
 * A tiny, backend-ready ledger for e-gift certificates. Today it runs on
 * localStorage so the whole buy → give → redeem → track flow works in the
 * demo; when Supabase is connected, swap the load/save bodies for a table
 * (code PK, amount, balance, status, recipient, buyer) and the rest stays.
 *
 * Two kinds, and they behave differently — the way people expect:
 *
 *   • service — a named treatment (e.g. "Ageless Grace Facial"). ALL-OR-NOTHING:
 *       it covers that whole treatment once, then it's spent. No partial balance.
 *   • value   — a dollar amount ("$100 toward any treatment"). It becomes CREDIT
 *       on the recipient's account and draws down across visits, so each account
 *       can see how much it has left.
 */
(function () {
  "use strict";

  var KEY = "lumevina_giftcards";

  var load = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  };
  var save = function (list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); }
    catch (e) { /* private mode */ }
  };

  /* Human-friendly, unambiguous code (no O/0/1/I): LUM-XXXX-XXXX */
  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var chunk = function (n) {
    var out = "";
    for (var i = 0; i < n; i++) {
      out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
  };
  var newCode = function () { return "LUM-" + chunk(4) + "-" + chunk(4); };

  var norm = function (code) { return (code || "").trim().toUpperCase(); };
  var emailKey = function (e) { return String(e || "").trim().toLowerCase(); };

  /* Issue a certificate. Returns the stored record (including its code). */
  var create = function (d) {
    var list = load();
    var code = newCode();
    while (list.some(function (g) { return g.code === code; })) code = newCode();
    var amount = Math.max(0, Number(d.amount) || 0);
    var serviceId = d.serviceId || null;
    var card = {
      code: code,
      amount: amount,
      balance: amount,
      /* a service gift is a named treatment; anything else is dollar value */
      kind: serviceId ? "service" : "value",
      label: d.label || "Any treatment",
      serviceId: serviceId,
      recipientName: d.recipientName || "",
      recipientEmail: d.recipientEmail || "",
      claimedByEmail: null,
      message: d.message || "",
      deliverToBuyer: !!d.deliverToBuyer,
      sendDate: d.sendDate || null,
      boughtBy: d.boughtBy || "",
      /* "sale" when paid for; "membership" when a member gifts a banked facial
         (already paid for through dues, so the books don't count it twice) */
      source: d.source || "sale",
      status: "active",
      purchasedAt: new Date().toISOString()
    };
    list.push(card);
    save(list);
    return card;
  };

  var lookup = function (code) {
    var c = norm(code);
    var found = load().filter(function (g) { return g.code === c; })[0];
    return found || null;
  };

  /* How much of `amount` this code could cover right now (0 if invalid). */
  var quote = function (code, amount) {
    var g = lookup(code);
    if (!g || g.status === "void" || g.balance <= 0) return 0;
    return Math.min(g.balance, Math.max(0, Number(amount) || 0));
  };

  /* Commit a redemption.
     - service gift: all-or-nothing — the whole thing is spent at once.
     - value gift:  decrement by `amount`, remainder rolls over; the first
                    time it's used we bind it to the account (opts.email) so
                    that account can track the balance left. */
  var redeem = function (code, amount, opts) {
    opts = opts || {};
    var list = load();
    var g = list.filter(function (x) { return x.code === norm(code); })[0];
    if (!g) return { ok: false, reason: "not_found" };
    if (g.status === "void") return { ok: false, reason: "void" };
    if (g.balance <= 0) return { ok: false, reason: "empty" };
    var applied;
    if (g.kind === "service") {
      applied = g.balance;                       /* used in full, always */
    } else {
      applied = Math.min(g.balance, Math.max(0, Number(amount) || 0));
      if (opts.email && !g.claimedByEmail) g.claimedByEmail = emailKey(opts.email);
    }
    g.balance = Math.round((g.balance - applied) * 100) / 100;
    g.status = g.balance <= 0 ? "redeemed" : "active";
    g.lastUsedAt = new Date().toISOString();
    save(list);
    return { ok: true, applied: applied, balance: g.balance, card: g };
  };

  /* Attach a value gift to an account without spending it — "add a gift card
     to my account" so its balance shows up as credit there. */
  var claim = function (code, email) {
    var list = load();
    var g = list.filter(function (x) { return x.code === norm(code); })[0];
    if (!g) return { ok: false, reason: "not_found" };
    if (g.status === "void") return { ok: false, reason: "void" };
    if (g.kind === "service") return { ok: false, reason: "service" };
    if (g.balance <= 0) return { ok: false, reason: "empty" };
    if (email) { g.claimedByEmail = emailKey(email); save(list); }
    return { ok: true, card: g };
  };

  /* The value gift cards that belong to an account (by recipient or claim). */
  var cardsForEmail = function (email) {
    var e = emailKey(email);
    if (!e) return [];
    return load().filter(function (g) {
      return g.kind === "value" &&
        (emailKey(g.recipientEmail) === e || emailKey(g.claimedByEmail) === e);
    });
  };

  /* How much gift credit this account has left, all cards summed. */
  var accountCredit = function (email) {
    return cardsForEmail(email).reduce(function (a, g) {
      return a + (Number(g.balance) || 0);
    }, 0);
  };

  /* ── Using a certificate against a bill, the way people expect ──
     A $100 certificate on a $50 visit covers $50 and keeps $50 for next
     time; on a $120 visit it covers its $100 and the client pays the $20
     difference. Every use is kept on the certificate (uses), so the
     dashboard can show the history.

     Once the site is connected (js/site-config.js → shop.supabase), these go
     to the gift-cards server function and its database ledger
     (server/schema.sql → gift_cards, redeem_gift), so a certificate bought
     on one phone works on Evelyn's dashboard and anywhere else. Until then
     they use this browser's storage, which is the demo. */
  var cfg = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(cfg.supabase || "") && !!cfg.key;
  var call = function (body, studioKey) {
    var headers = { "Content-Type": "application/json", apikey: cfg.key, Authorization: "Bearer " + cfg.key };
    if (studioKey) headers["x-studio-key"] = studioKey;
    return fetch(cfg.supabase.replace(/\/$/, "") + "/functions/v1/gift-cards", {
      method: "POST", headers: headers, body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.reason || j.error || "failed"); e.reason = j.reason || "failed"; throw e; }
        return j;
      });
    });
  };
  var cents = function (n) { return Math.round((Number(n) || 0) * 100); };

  /* What's on a certificate: { code, kind, label, amount, balance, status } or null */
  var check = function (code) {
    if (LIVE) return call({ action: "check", code: norm(code) }).catch(function (e) {
      if (e.reason === "not_found") return null;
      throw e;
    });
    var g = lookup(code);
    return Promise.resolve(g ? { code: g.code, kind: g.kind, label: g.label, amount: g.amount,
      balance: g.balance, status: g.status, uses: g.uses || [] } : null);
  };

  /* Work out a use without spending anything: what the certificate would
     cover on this bill, what the client pays, and what would be left. */
  var preview = function (card, bill) {
    bill = Math.max(0, Number(bill) || 0);
    if (!card || card.status === "void" || card.balance <= 0) return { applied: 0, pay: bill, left: card ? card.balance : 0 };
    var applied = card.kind === "service" ? card.balance : Math.min(card.balance, bill);
    return { applied: applied, pay: Math.max(0, Math.round((bill - applied) * 100) / 100), left: Math.round((card.balance - applied) * 100) / 100 };
  };

  /* Spend a certificate against a bill. Resolves { ok, applied, pay, balance,
     status } or { ok: false, reason: "not_found" | "void" | "empty" |
     "nothing_due" | "studio_key" }. Live, it needs Evelyn's studio key. */
  var spend = function (code, bill, opts) {
    opts = opts || {};
    if (!(Number(bill) > 0)) return Promise.resolve({ ok: false, reason: "nothing_due" });
    if (LIVE) {
      return call({ action: "redeem", code: norm(code), bill_cents: cents(bill), note: opts.note || null,
        where: opts.where || "studio" }, opts.studioKey)
        .then(function (r) { return { ok: true, applied: r.applied, pay: r.pay, balance: r.balance, status: r.status }; })
        .catch(function (e) { return { ok: false, reason: e.reason || "failed" }; });
    }
    var list = load();
    var g = list.filter(function (x) { return x.code === norm(code); })[0];
    if (!g) return Promise.resolve({ ok: false, reason: "not_found" });
    if (g.status === "void") return Promise.resolve({ ok: false, reason: "void" });
    if (g.balance <= 0) return Promise.resolve({ ok: false, reason: "empty" });
    var p = preview(g, bill);
    g.balance = p.left;
    g.status = g.balance <= 0 ? "redeemed" : "active";
    g.lastUsedAt = new Date().toISOString();
    (g.uses = g.uses || []).push({ at: g.lastUsedAt, bill: Number(bill), applied: p.applied, pay: p.pay,
      balanceAfter: g.balance, note: opts.note || "", where: opts.where || "studio" });
    save(list);
    return Promise.resolve({ ok: true, applied: p.applied, pay: p.pay, balance: g.balance, status: g.status });
  };

  /* Every certificate, for Evelyn's dashboard (live: needs her studio key). */
  var list = function (studioKey) {
    if (LIVE) return call({ action: "list" }, studioKey).then(function (r) { return r.cards || []; });
    return Promise.resolve(load());
  };

  window.LumevinaGiftCards = {
    create: create,
    lookup: lookup,
    quote: quote,
    redeem: redeem,
    claim: claim,
    cardsForEmail: cardsForEmail,
    accountCredit: accountCredit,
    all: load,
    live: LIVE,
    check: check,
    preview: preview,
    spend: spend,
    list: list
  };
})();

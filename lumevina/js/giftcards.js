/* Lumevina — gift-certificate store
 *
 * A tiny, backend-ready ledger for e-gift certificates. Today it runs on
 * localStorage so the whole buy → give → redeem → track flow works in the
 * demo; when Supabase is connected, swap the load/save bodies for a table
 * (code PK, amount, balance, status, recipient, buyer) and the rest stays.
 *
 * A certificate carries a VALUE. A "service" gift is just a value equal to
 * that service's price, with a friendly label. Redemption decrements the
 * balance, so partial values roll over to the next visit.
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

  /* Issue a certificate. Returns the stored record (including its code). */
  var create = function (d) {
    var list = load();
    var code = newCode();
    while (list.some(function (g) { return g.code === code; })) code = newCode();
    var amount = Math.max(0, Number(d.amount) || 0);
    var card = {
      code: code,
      amount: amount,
      balance: amount,
      label: d.label || "Any treatment",
      serviceId: d.serviceId || null,
      recipientName: d.recipientName || "",
      recipientEmail: d.recipientEmail || "",
      message: d.message || "",
      deliverToBuyer: !!d.deliverToBuyer,
      sendDate: d.sendDate || null,
      boughtBy: d.boughtBy || "",
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

  /* Commit a redemption: decrement balance, flip to redeemed when empty. */
  var redeem = function (code, amount) {
    var list = load();
    var g = list.filter(function (x) { return x.code === norm(code); })[0];
    if (!g) return { ok: false, reason: "not_found" };
    if (g.status === "void") return { ok: false, reason: "void" };
    if (g.balance <= 0) return { ok: false, reason: "empty" };
    var applied = Math.min(g.balance, Math.max(0, Number(amount) || 0));
    g.balance = Math.round((g.balance - applied) * 100) / 100;
    g.status = g.balance <= 0 ? "redeemed" : "active";
    g.lastUsedAt = new Date().toISOString();
    save(list);
    return { ok: true, applied: applied, balance: g.balance, card: g };
  };

  window.LumevinaGiftCards = {
    create: create,
    lookup: lookup,
    quote: quote,
    redeem: redeem,
    all: load
  };
})();

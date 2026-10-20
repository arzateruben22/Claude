/* Lumevina — the demo's card form
   Card formatting, validation and a simulated charge for the demo
   checkouts (the cart, booking deposits, the membership), so the site can
   be tried with Stripe's test card (4242 4242 4242 4242) before anything
   is connected. Nothing leaves the browser.

   Live (js/site-config.js → shop), card numbers never touch this page:
   the cart (functions/create-checkout), booking (functions/book) and the
   membership (functions/membership) each hand off to Stripe's own
   payment page, with Apple Pay and Google Pay, and the card on file is
   kept by Stripe. getCard() still answers for the demo's saved cards. */

(function () {
  "use strict";

  var luhnValid = function (digits) {
    var sum = 0;
    var dbl = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = Number(digits[i]);
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  };

  var cardValid = function (value) {
    var digits = String(value).replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 16 && luhnValid(digits);
  };

  var expiryValid = function (value) {
    var m = String(value).match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    var month = Number(m[1]);
    if (month < 1 || month > 12) return false;
    var year = 2000 + Number(m[2]);
    var now = new Date();
    return year > now.getFullYear() ||
      (year === now.getFullYear() && month >= now.getMonth() + 1);
  };

  var cvcValid = function (value) {
    return /^\d{3,4}$/.test(String(value));
  };

  var bindCardFields = function (cardEl, expiryEl, cvcEl) {
    cardEl.addEventListener("input", function () {
      var digits = cardEl.value.replace(/\D/g, "").slice(0, 16);
      cardEl.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    });
    expiryEl.addEventListener("input", function () {
      var digits = expiryEl.value.replace(/\D/g, "").slice(0, 4);
      expiryEl.value = digits.length > 2
        ? digits.slice(0, 2) + "/" + digits.slice(2)
        : digits;
    });
    cvcEl.addEventListener("input", function () {
      cvcEl.value = cvcEl.value.replace(/\D/g, "").slice(0, 4);
    });
  };

  var money = function (n) {
    return "$" + Number(n).toFixed(2);
  };

  var cardBrand = function (value) {
    var d = String(value).replace(/\D/g, "");
    if (/^4/.test(d)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
    if (/^3[47]/.test(d)) return "Amex";
    if (/^6(011|5)/.test(d)) return "Discover";
    return "Card";
  };

  /* ═══ SAVED CARD ON FILE ═══
     DEMO: stores only brand + last-4 + expiry locally, keyed by email —
     never a full card number. LIVE (Stripe): at deposit time confirm a
     SetupIntent to vault the card off-session, then store the returned
     payment_method id + last4 on the Stripe customer. Future deposits and
     no-show / late-cancel fees charge that saved method (with the client's
     up-front consent) — no re-entry. */
  var CARDS_KEY = "lumevina_cards";
  var loadCards = function () {
    try { return JSON.parse(localStorage.getItem(CARDS_KEY)) || {}; }
    catch (e) { return {}; }
  };
  var saveCards = function (o) {
    try { localStorage.setItem(CARDS_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
  };
  var normEmail = function (e) { return (e || "").trim().toLowerCase(); };

  var saveCard = function (email, cardValue, expiry) {
    var k = normEmail(email); if (!k) return null;
    var digits = String(cardValue).replace(/\D/g, "");
    var rec = { brand: cardBrand(cardValue), last4: digits.slice(-4),
      expiry: expiry || "", token: "pm_demo_" + Date.now().toString(36),
      savedAt: new Date().toISOString() };
    var all = loadCards(); all[k] = rec; saveCards(all);
    return rec;
  };
  var getCard = function (email) {
    var k = normEmail(email); if (!k) return null;
    return loadCards()[k] || null;
  };
  var forgetCard = function (email) {
    var k = normEmail(email); var all = loadCards();
    if (all[k]) { delete all[k]; saveCards(all); }
  };

  /* DEMO processor — see the Stripe notes at the top of this file */
  var process = function (payment, cb) {
    window.setTimeout(function () {
      cb(null, { id: "LUM-" + Date.now().toString(36).toUpperCase() });
    }, 650);
  };

  window.LumevinaPayments = {
    luhnValid: luhnValid,
    cardValid: cardValid,
    expiryValid: expiryValid,
    cvcValid: cvcValid,
    bindCardFields: bindCardFields,
    money: money,
    process: process,
    cardBrand: cardBrand,
    saveCard: saveCard,
    getCard: getCard,
    forgetCard: forgetCard
  };
})();

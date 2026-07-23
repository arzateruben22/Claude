/* Lumevina — shared payment engine
   One module owns card formatting, validation, and processing for
   BOTH checkouts (the cart and the booking deposit), so real
   payments plug in at exactly one point.

   ═══ STRIPE INTEGRATION POINT ═══
   To go live, replace process() below with the real flow:
     1. Server: create a PaymentIntent (secret key stays server-side)
          POST /create-payment-intent  { amount, currency: "usd", description }
          → returns { clientSecret }
     2. Client: confirm with Stripe.js Elements
          stripe.confirmCardPayment(clientSecret, { payment_method: {...} })
     3. On success, call cb(null, { id: paymentIntent.id })
   Stripe Elements also brings Apple Pay / Google Pay with no extra
   markup. Until then, process() simulates a successful charge and
   nothing leaves the browser. */

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

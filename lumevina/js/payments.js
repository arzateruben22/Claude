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
    process: process
  };
})();

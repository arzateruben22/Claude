/* Sensoria — cart & demo checkout
   Client-side only: the cart persists to localStorage and the
   checkout is a DEMO — it validates the card locally and never
   sends anything anywhere. For real payments, POST the cart to
   your server and create a Stripe PaymentIntent there.
   // TODO: POST to your server → Stripe PaymentIntent */

(function () {
  "use strict";

  var STORAGE_KEY = "sensoria_cart";

  /* cart: { [id]: { id, name, price, qty } } */
  var cart = {};

  /* ── Elements ── */
  var drawer = document.querySelector(".cart-drawer");
  var overlay = document.querySelector(".cart-overlay");
  var itemsList = drawer.querySelector(".cart-items");
  var emptyMsg = drawer.querySelector(".cart-empty");
  var subtotalEl = drawer.querySelector(".cart-subtotal-value");
  var checkoutBtn = drawer.querySelector(".cart-checkout");
  var countEls = document.querySelectorAll(".nav-cart-count");
  var navCart = document.querySelector(".nav-cart");
  var mobileCart = document.querySelector(".mobile-cart");

  var modal = document.querySelector(".checkout-modal");
  var modalOverlay = document.querySelector(".checkout-overlay");
  var formView = modal.querySelector(".checkout-form-view");
  var successView = modal.querySelector(".checkout-success");
  var linesList = modal.querySelector(".checkout-lines");
  var totalEl = modal.querySelector(".checkout-total-value");
  var checkoutForm = modal.querySelector(".checkout-form");
  var checkoutStatus = modal.querySelector(".checkout-status");
  var orderIdEl = modal.querySelector(".success-order-id");

  var money = function (n) {
    return "$" + n.toFixed(2);
  };

  /* ── Persistence ── */
  var save = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) { /* private mode: cart just won't persist */ }
  };

  var load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function (id) {
        var item = data[id];
        if (item && item.id && item.name &&
            isFinite(item.price) && item.qty > 0) {
          cart[id] = {
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price),
            qty: Math.floor(Number(item.qty))
          };
        }
      });
    } catch (err) { /* corrupt storage: start fresh */ }
  };

  /* ── Derived values ── */
  var itemCount = function () {
    return Object.keys(cart).reduce(function (sum, id) {
      return sum + cart[id].qty;
    }, 0);
  };

  var subtotal = function () {
    return Object.keys(cart).reduce(function (sum, id) {
      return sum + cart[id].price * cart[id].qty;
    }, 0);
  };

  /* ── Rendering ── */
  var render = function () {
    var ids = Object.keys(cart);
    var count = itemCount();

    countEls.forEach(function (el) { el.textContent = String(count); });
    navCart.setAttribute("aria-label",
      "Open cart, " + count + (count === 1 ? " item" : " items"));

    emptyMsg.hidden = ids.length > 0;
    subtotalEl.textContent = money(subtotal());
    checkoutBtn.disabled = ids.length === 0;

    itemsList.textContent = "";
    ids.forEach(function (id) {
      var item = cart[id];
      var li = document.createElement("li");
      li.className = "cart-item";

      var name = document.createElement("span");
      name.className = "cart-item-name";
      name.textContent = item.name;

      var unit = document.createElement("span");
      unit.className = "cart-item-unit";
      unit.textContent = money(item.price) + " each";

      var line = document.createElement("span");
      line.className = "cart-item-line";
      line.textContent = money(item.price * item.qty);

      var controls = document.createElement("div");
      controls.className = "cart-item-controls";

      var minus = document.createElement("button");
      minus.type = "button";
      minus.className = "qty-btn";
      minus.textContent = "−";
      minus.setAttribute("aria-label", "Decrease quantity of " + item.name);
      minus.addEventListener("click", function () { changeQty(id, -1); });

      var qty = document.createElement("span");
      qty.className = "cart-item-qty";
      qty.textContent = String(item.qty);
      qty.setAttribute("aria-label", item.qty + " in cart");

      var plus = document.createElement("button");
      plus.type = "button";
      plus.className = "qty-btn";
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Increase quantity of " + item.name);
      plus.addEventListener("click", function () { changeQty(id, 1); });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-item-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + item.name + " from cart");
      remove.addEventListener("click", function () { removeItem(id); });

      controls.appendChild(minus);
      controls.appendChild(qty);
      controls.appendChild(plus);
      controls.appendChild(remove);

      li.appendChild(name);
      li.appendChild(line);
      li.appendChild(unit);
      li.appendChild(controls);
      itemsList.appendChild(li);
    });
  };

  /* ── Mutations ── */
  var addItem = function (id, name, price) {
    if (cart[id]) {
      cart[id].qty += 1;
    } else {
      cart[id] = { id: id, name: name, price: price, qty: 1 };
    }
    save();
    render();
  };

  var changeQty = function (id, delta) {
    if (!cart[id]) return;
    cart[id].qty += delta;
    if (cart[id].qty <= 0) delete cart[id];
    save();
    render();
  };

  var removeItem = function (id) {
    delete cart[id];
    save();
    render();
  };

  var clearCart = function () {
    cart = {};
    save();
    render();
  };

  /* ── Drawer open/close ── */
  var lastFocus = null;

  var openDrawer = function () {
    lastFocus = document.activeElement;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    drawer.focus();
  };

  var closeDrawer = function () {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };

  var drawerOpen = function () {
    return drawer.classList.contains("open");
  };

  navCart.addEventListener("click", openDrawer);
  if (mobileCart) {
    mobileCart.addEventListener("click", function () {
      /* close the mobile menu first so the drawer isn't underneath it */
      var toggle = document.querySelector(".nav-toggle");
      if (toggle.getAttribute("aria-expanded") === "true") toggle.click();
      openDrawer();
    });
  }
  drawer.querySelector(".cart-close").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  emptyMsg.querySelector("a").addEventListener("click", closeDrawer);

  /* ── Add-to-cart buttons ── */
  document.querySelectorAll(".add-to-cart").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addItem(btn.dataset.id, btn.dataset.name, Number(btn.dataset.price));
      navCart.classList.remove("bump");
      /* restart the bump animation */
      void navCart.offsetWidth;
      navCart.classList.add("bump");
      openDrawer();
    });
  });

  /* ── Checkout modal ── */
  var openCheckout = function () {
    if (checkoutBtn.disabled) return;
    closeDrawer();

    linesList.textContent = "";
    Object.keys(cart).forEach(function (id) {
      var item = cart[id];
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = item.name + " × " + item.qty;
      var amount = document.createElement("span");
      amount.textContent = money(item.price * item.qty);
      li.appendChild(label);
      li.appendChild(amount);
      linesList.appendChild(li);
    });
    totalEl.textContent = money(subtotal());

    formView.hidden = false;
    successView.hidden = true;
    checkoutStatus.textContent = "";
    modal.setAttribute("aria-hidden", "false");
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var closeCheckout = function () {
    modal.setAttribute("aria-hidden", "true");
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };

  var checkoutOpen = function () {
    return modal.getAttribute("aria-hidden") === "false";
  };

  checkoutBtn.addEventListener("click", openCheckout);
  modal.querySelector(".checkout-close").addEventListener("click", closeCheckout);
  modal.querySelector(".checkout-done").addEventListener("click", closeCheckout);
  modalOverlay.addEventListener("click", closeCheckout);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (checkoutOpen()) closeCheckout();
    else if (drawerOpen()) closeDrawer();
  });

  /* ── Card field formatting ── */
  var cardInput = checkoutForm.elements.card;
  var expiryInput = checkoutForm.elements.expiry;
  var cvcInput = checkoutForm.elements.cvc;

  cardInput.addEventListener("input", function () {
    var digits = cardInput.value.replace(/\D/g, "").slice(0, 16);
    cardInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  });

  expiryInput.addEventListener("input", function () {
    var digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
    expiryInput.value = digits.length > 2
      ? digits.slice(0, 2) + "/" + digits.slice(2)
      : digits;
  });

  cvcInput.addEventListener("input", function () {
    cvcInput.value = cvcInput.value.replace(/\D/g, "").slice(0, 4);
  });

  /* ── Validation ── */
  var luhnValid = function (digits) {
    var sum = 0;
    var double = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = Number(digits[i]);
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    return sum % 10 === 0;
  };

  var expiryValid = function (value) {
    var m = value.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    var month = Number(m[1]);
    if (month < 1 || month > 12) return false;
    var year = 2000 + Number(m[2]);
    var now = new Date();
    return year > now.getFullYear() ||
      (year === now.getFullYear() && month >= now.getMonth() + 1);
  };

  var validateCheckout = function () {
    var problems = [];
    var mark = function (input, bad) {
      input.classList.toggle("invalid", bad);
    };

    var name = checkoutForm.elements.name.value.trim();
    mark(checkoutForm.elements.name, !name);
    if (!name) problems.push("your name");

    var emailInput = checkoutForm.elements.email;
    var emailOk = emailInput.value.trim() && emailInput.checkValidity();
    mark(emailInput, !emailOk);
    if (!emailOk) problems.push("a valid email");

    var cardDigits = cardInput.value.replace(/\D/g, "");
    var cardOk = cardDigits.length >= 13 && cardDigits.length <= 16 &&
      luhnValid(cardDigits);
    mark(cardInput, !cardOk);
    if (!cardOk) problems.push("a valid card number");

    var expOk = expiryValid(expiryInput.value);
    mark(expiryInput, !expOk);
    if (!expOk) problems.push("a future expiry (MM/YY)");

    var cvcOk = /^\d{3,4}$/.test(cvcInput.value);
    mark(cvcInput, !cvcOk);
    if (!cvcOk) problems.push("a 3–4 digit CVC");

    return problems;
  };

  /* ── Submit → demo success ── */
  checkoutForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var problems = validateCheckout();
    if (problems.length) {
      checkoutStatus.textContent = "Please check: " + problems.join(", ") + ".";
      return;
    }

    /* Demo only — a real store would POST the cart to a server here
       and confirm a Stripe PaymentIntent before showing success. */
    var orderId = "SEN-" + Date.now().toString(36).toUpperCase();
    orderIdEl.textContent = orderId;
    formView.hidden = true;
    successView.hidden = false;
    checkoutForm.reset();
    clearCart();
    modal.querySelector(".checkout-done").focus();
  });

  /* ── Boot ── */
  load();
  render();
})();

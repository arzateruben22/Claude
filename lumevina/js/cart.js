/* Lumevina Aesthetics Spa — cart & checkout
   The cart persists to localStorage.
   DEMO (js/site-config.js → shop empty): the checkout validates a test
   card locally and never sends anything anywhere.
   LIVE (shop filled in): the cart goes to the create-checkout function,
   which prices it on the server and opens Stripe's own payment page
   (card, Apple Pay / Google Pay, pay-over-time where switched on, sales
   tax). Stripe sends the buyer back with ?order=done; the Stripe webhook
   takes the stock off, issues gift certificates and emails the receipt. */

(function () {
  "use strict";

  var STORAGE_KEY = "lumevina_cart";
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;

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

  /* gift-delivery bits */
  var giftDetails = modal.querySelector(".gift-details");
  var giftToMe = modal.querySelector("#co-gift-tome");
  var giftRecipientFields = modal.querySelector(".gift-recipient-fields");
  var giftNameInput = modal.querySelector("#co-gift-name");
  var giftEmailInput = modal.querySelector("#co-gift-email");
  var giftCodesEl = modal.querySelector(".gift-codes");

  var isGiftId = function (id) { return id.indexOf("gift-") === 0; };
  var cartHasGift = function () {
    return Object.keys(cart).some(isGiftId);
  };

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

  /* Glow Membership: 10% off skincare products (retail items only —
     never gift certificates). Looked up by the signed-in account, or by
     the receipt email typed at checkout. */
  var memberEmail = function () {
    var acct = window.LumevinaAccount && window.LumevinaAccount.current();
    var typed = document.getElementById("co-email");
    return (typed && typed.value.trim()) || (acct && acct.email) || "";
  };
  var memberOff = function () {
    var LM = window.LumevinaMembership;
    var rate = LM ? LM.retailRate(memberEmail()) : 0;
    if (!rate) return 0;
    var retail = Object.keys(cart).reduce(function (sum, id) {
      return id.indexOf("retail-") === 0 ? sum + cart[id].price * cart[id].qty : sum;
    }, 0);
    return Math.round(retail * rate * 100) / 100;
  };
  /* Shipping for shelf products: free for members, otherwise $8 and free
     over $75 (after any member discount). Pickup at a visit is always free.
     SHIP_COST is what a small box really costs (postage + packaging), for the books. */
  var SHIP_FEE = 8, FREE_OVER = 75, SHIP_COST = 9;
  var retailSubtotal = function () {
    return Object.keys(cart).reduce(function (sum, id) {
      return id.indexOf("retail-") === 0 ? sum + cart[id].price * cart[id].qty : sum;
    }, 0);
  };
  /* shelf products need shipping or pickup; the online consult (retail-svc-…) doesn't */
  var cartHasRetail = function () { return Object.keys(cart).some(function (id) { return id.indexOf("retail-") === 0 && id.indexOf("retail-svc-") !== 0; }); };
  var shipDetails = modal.querySelector(".ship-details");
  var shipAddress = modal.querySelector(".ship-address");
  var delivery = function () {
    var c = modal.querySelector('input[name="delivery"]:checked');
    return c ? c.value : "ship";
  };
  var isMember = function () {
    var LM = window.LumevinaMembership;
    return !!(LM && LM.retailRate(memberEmail()));
  };
  var shipping = function () {
    if (!cartHasRetail() || delivery() !== "ship") return { fee: 0, why: delivery() === "pickup" ? "pickup" : "" };
    if (isMember()) return { fee: 0, why: "member" };
    if (retailSubtotal() - memberOff() >= FREE_OVER) return { fee: 0, why: "over" };
    return { fee: SHIP_FEE, why: "" };
  };
  var orderTotal = function () { return subtotal() - memberOff() + shipping().fee; };

  /* ── The shelf limit: a product can't go in the cart more times than
     Evelyn has it on the shelf (js/inventory.js). Unknown counts aren't
     limited; the shop asks clients to request those instead. ── */
  var INV = window.LumevinaInventory || null;
  var shelfMax = function (id) {
    if (!INV || id.indexOf("retail-") !== 0) return Infinity;
    var p = INV.get(id);
    return p && p.stock != null ? Math.max(0, Number(p.stock) || 0) : Infinity;
  };
  var limitNote = {};        /* id → a line shown under that item */
  var noticeEl = document.createElement("p");
  noticeEl.className = "cart-notice";
  noticeEl.setAttribute("role", "status");
  noticeEl.hidden = true;
  itemsList.parentNode.insertBefore(noticeEl, itemsList);
  /* stock can drop while something waits in the cart (a sale in the
     dashboard, an order in another tab): bring the cart back in line */
  var fitToShelf = function () {
    var gone = [], changed = false;
    Object.keys(cart).forEach(function (id) {
      var max = shelfMax(id);
      if (cart[id].qty <= max) return;
      changed = true;
      if (max === 0) { gone.push(cart[id].name); delete cart[id]; delete limitNote[id]; return; }
      cart[id].qty = max;
      limitNote[id] = "Only " + max + " left now, so we updated your cart.";
    });
    if (gone.length) {
      noticeEl.textContent = gone.join(" and ") + (gone.length === 1 ? " just sold out and was" : " just sold out and were") +
        " taken out of your cart. Request it from the shop and Evelyn will order it in.";
      noticeEl.hidden = false;
    }
    if (changed) save();
  };

  /* ── Rendering ── */
  var render = function () {
    fitToShelf();
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
      var max = shelfMax(id);
      if (item.qty >= max) {
        plus.disabled = true;
        plus.setAttribute("aria-label", "That's all on the shelf: " + max + " of " + item.name);
      }

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

      /* a product's photo beside it (js/shop.js), so the cart reads at a glance */
      var photo = window.LumevinaShop && window.LumevinaShop.photo(id);
      if (photo) {
        var thumb = document.createElement("img");
        thumb.className = "cart-thumb";
        thumb.src = photo;
        thumb.alt = "";
        thumb.width = 56; thumb.height = 56;
        li.classList.add("has-thumb");
        li.appendChild(thumb);
      }
      li.appendChild(name);
      li.appendChild(line);
      li.appendChild(unit);
      li.appendChild(controls);
      if (limitNote[id]) {
        var note = document.createElement("p");
        note.className = "cart-item-note";
        note.textContent = limitNote[id];
        li.appendChild(note);
      }
      itemsList.appendChild(li);
    });
  };

  /* ── Mutations ── */
  var addItem = function (id, name, price) {
    var max = shelfMax(id);
    var have = cart[id] ? cart[id].qty : 0;
    if (have + 1 > max) {
      limitNote[id] = max === 1 ? "Evelyn has just 1 on the shelf, and it's in your cart."
        : "Evelyn has " + max + " on the shelf, and they're all in your cart.";
      render();
      return false;
    }
    if (cart[id]) {
      cart[id].qty += 1;
    } else {
      cart[id] = { id: id, name: name, price: price, qty: 1 };
    }
    noticeEl.hidden = true;
    save();
    render();
    return true;
  };

  var changeQty = function (id, delta) {
    if (!cart[id]) return;
    if (delta > 0 && cart[id].qty + delta > shelfMax(id)) {
      limitNote[id] = "That's all Evelyn has on the shelf.";
      render();
      return;
    }
    cart[id].qty += delta;
    if (delta < 0) delete limitNote[id];
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
    /* keep scroll locked if the mobile menu is still open underneath */
    var mm = document.getElementById("mobile-menu");
    document.body.style.overflow = (mm && !mm.hidden) ? "hidden" : "";
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
  /* a second way out, at the bottom where a thumb is: inside an app's
     viewer the corner close button can sit under the app's own buttons */
  drawer.querySelector(".cart-keep").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  emptyMsg.querySelector("a").addEventListener("click", closeDrawer);

  /* ── Gift certificate: $50, $100, $200, $400 or a custom amount ── */
  var giftZone = document.getElementById("gift");
  var giftAddBtn = giftZone && giftZone.querySelector(".gift-add");
  if (giftAddBtn) {
    var amtBtns = Array.prototype.slice.call(giftZone.querySelectorAll(".gift-amt"));
    var customBox = giftZone.querySelector(".gift-custom");
    var customIn = giftZone.querySelector("#gift-custom-amt");
    var customHint = giftZone.querySelector(".gift-custom-hint");
    var GIFT_MIN = 25, GIFT_MAX = 1000;
    var whole = function (n) { return "$" + n.toLocaleString("en-US"); };
    var setGift = function (amount) {
      var ok = amount >= GIFT_MIN && amount <= GIFT_MAX && Math.round(amount) === amount;
      giftAddBtn.disabled = !ok;
      giftAddBtn.textContent = ok ? "Add " + whole(amount) + " gift to cart" : "Choose an amount";
      if (!ok) return;
      giftAddBtn.dataset.id = "gift-any-" + amount;
      giftAddBtn.dataset.price = String(amount);
      giftAddBtn.dataset.name = "Gift Card · " + whole(amount) + " value";
    };
    var readCustom = function () {
      var raw = customIn.value.trim();
      var n = raw === "" ? NaN : Number(raw);
      var bad = raw !== "" && !(n >= GIFT_MIN && n <= GIFT_MAX && Math.round(n) === n);
      customHint.classList.toggle("is-error", bad);
      customHint.textContent = bad ? "Choose a whole amount from $25 to $1,000" : "$25 to $1,000";
      setGift(n);
    };
    giftZone.addEventListener("click", function (e) {
      var b = e.target.closest(".gift-amt");
      if (!b) return;
      amtBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var custom = b.dataset.amount === "custom";
      customBox.hidden = !custom;
      if (custom) { readCustom(); customIn.focus(); }
      else setGift(Number(b.dataset.amount));
    });
    customIn.addEventListener("input", readCustom);
  }

  /* ── Check a gift balance (the recipient, any time) ── */
  var giftCheck = document.getElementById("gift-check");
  var giftCheckToggle = document.querySelector(".gift-check-toggle");
  if (giftCheck && giftCheckToggle && window.LumevinaGiftCards) {
    var gcIn = giftCheck.querySelector("input"), gcOut = giftCheck.querySelector(".gift-check-result");
    var dollars = function (n) { return "$" + Number(n || 0).toFixed(2); };
    giftCheckToggle.addEventListener("click", function () {
      var open = giftCheck.hidden;
      giftCheck.hidden = !open;
      giftCheckToggle.setAttribute("aria-expanded", String(open));
      if (open) gcIn.focus();
    });
    giftCheck.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = gcIn.value.trim().toUpperCase();
      if (!/^LUM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) { gcOut.textContent = "Codes look like LUM-XXXX-XXXX, from the certificate email."; return; }
      gcOut.textContent = "Checking…";
      window.LumevinaGiftCards.check(code).then(function (c) {
        if (!c) { gcOut.textContent = "We couldn't find that code. Check it against the certificate email."; return; }
        if (c.status === "void") { gcOut.textContent = "That certificate was cancelled. Please contact Evelyn."; return; }
        if (Number(c.balance) <= 0) { gcOut.textContent = c.code + " is used up (it was worth " + dollars(c.amount) + ")."; return; }
        gcOut.textContent = c.code + " has " + dollars(c.balance) + " left" +
          (Number(c.balance) < Number(c.amount) ? " of " + dollars(c.amount) : "") +
          ". Show it at your visit and Evelyn takes it off the bill; you pay only what's over.";
      }, function () { gcOut.textContent = "We couldn't check right now. Please try again in a moment."; });
    });
  }

  if (INV && INV.onChange) INV.onChange(render);

  /* ── For Ask Lumevina (js/ask.js): its Add to bag buttons. A shelf product
     by its catalog id → { ok, name, reason: "unknown" | "unavailable" | "max" } ── */
  var bump = function () { navCart.classList.remove("bump"); void navCart.offsetWidth; navCart.classList.add("bump"); };
  window.LumevinaCart = {
    add: function (productId) {
      var p = INV ? INV.get(productId) : null;
      if (!p) return { ok: false, reason: "unknown" };
      var s = INV.status(p);
      var name = p.brand + " " + p.name;
      if (p.hidden || p.draft || (s !== "in" && s !== "low")) return { ok: false, name: name, reason: "unavailable" };
      if (p.consult && window.LumevinaConsult && !window.LumevinaConsult.approved(p.id)) return { ok: false, name: name, reason: "consult" };
      if (!addItem("retail-" + p.id, name, Number(p.price))) return { ok: false, name: name, reason: "max" };
      bump();
      return { ok: true, name: name };
    },
    has: function (productId) { return !!cart["retail-" + String(productId).replace(/^retail-/, "")]; },
    count: function () { return itemCount(); },
    open: openDrawer
  };

  /* ── Add-to-cart (delegated, so JS-rendered retail buttons work too) ── */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".add-to-cart");
    if (!btn || btn.disabled) return;
    addItem(btn.dataset.id, btn.dataset.name, Number(btn.dataset.price));
    navCart.classList.remove("bump");
    /* restart the bump animation */
    void navCart.offsetWidth;
    navCart.classList.add("bump");
    openDrawer();
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
      label.className = "co-line-name";
      var coPhoto = window.LumevinaShop && window.LumevinaShop.photo(id);
      if (coPhoto) {
        var coThumb = document.createElement("img");
        coThumb.className = "co-thumb";
        coThumb.src = coPhoto;
        coThumb.alt = "";
        coThumb.width = 36; coThumb.height = 36;
        label.appendChild(coThumb);
      }
      label.appendChild(document.createTextNode(item.name + " × " + item.qty));
      var amount = document.createElement("span");
      amount.textContent = money(item.price * item.qty);
      li.appendChild(label);
      li.appendChild(amount);
      linesList.appendChild(li);
    });
    renderMemberLine();

    giftDetails.hidden = !cartHasGift();
    shipDetails.hidden = !cartHasRetail();
    if (shipDetails.hidden === false) { setupDelivery(); syncShip(); }
    /* one "Payment" heading: the last section shown carries it */
    var gp = giftDetails.querySelector(".checkout-subhead--pay");
    if (gp) gp.hidden = cartHasRetail();

    if (LIVE) {
      /* Stripe's page takes the card and the shipping address */
      modal.querySelectorAll("[data-card]").forEach(function (el) { el.hidden = true; });
      shipAddress.hidden = true;
      modal.querySelector(".co-live-note").hidden = false;
      modal.querySelectorAll(".checkout-demo-note").forEach(function (n) { n.hidden = true; });
      var nameLabel = modal.querySelector('label[for="co-name"]');
      if (nameLabel) nameLabel.textContent = "Your name";
      checkoutForm.elements.name.setAttribute("autocomplete", "name");
      modal.querySelector(".checkout-pay .btn-mb-inner").textContent = "Continue to payment";
    }

    formView.hidden = false;
    successView.hidden = true;
    checkoutStatus.textContent = "";
    modal.setAttribute("aria-hidden", "false");
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var addLine = function (cls, text, value) {
    var li = document.createElement("li");
    li.className = cls;
    var label = document.createElement("span");
    label.textContent = text;
    var amount = document.createElement("span");
    amount.textContent = value;
    li.appendChild(label);
    li.appendChild(amount);
    linesList.appendChild(li);
  };
  var renderMemberLine = function () {
    linesList.querySelectorAll(".co-member, .co-ship-line").forEach(function (el) { el.remove(); });
    var off = memberOff();
    if (off > 0) {
      var LM = window.LumevinaMembership;
      var rate = LM ? LM.retailRate(memberEmail()) : 0;
      addLine("co-member", "Member " + Math.round(rate * 100) + "% off skincare", "−" + money(off));
    }
    if (cartHasRetail()) {
      var sh = shipping();
      addLine("co-ship-line", delivery() === "pickup" ? "Pickup at your visit" :
        sh.why === "member" ? "Shipping · free for members" : sh.why === "over" ? "Shipping · free over $75" : "Shipping",
        sh.fee ? money(sh.fee) : "Free");
      /* the note under "Ship it to me" says what this cart gets */
      var note = modal.querySelector(".ship-note");
      var member = isMember(), over = retailSubtotal() - off >= FREE_OVER;
      note.textContent = member ? "Free: a member perk" : over ? "Free on orders over $75" :
        (window.LumevinaMembership ? "$8 · free over $75, or free for members" : "$8 · free on orders over $75");
      note.classList.toggle("is-free", member || over);
    }
    totalEl.textContent = money(orderTotal());
  };
  var syncShip = function () {
    shipAddress.hidden = delivery() !== "ship";
    renderMemberLine();
  };
  var deliveryPicked = false;
  modal.querySelectorAll('input[name="delivery"]').forEach(function (r) {
    r.addEventListener("change", function () { deliveryPicked = true; syncShip(); });
  });

  /* Already booked? Then picking it up at that visit is free for them and
     costs no postage, so it's the default (they can still choose shipping).
     A returning client's last address is filled in for them. */
  var setupDelivery = function () {
    var B = window.LumevinaBooking, next = B && B.next ? B.next() : null;
    var soon = next && next.getTime() - Date.now() < 45 * 864e5;
    var when = modal.querySelector(".pickup-when");
    if (when) when.textContent = soon ? " · your visit is " +
      next.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
    if (soon && !deliveryPicked) {
      var pick = modal.querySelector('input[name="delivery"][value="pickup"]');
      if (pick) pick.checked = true;
    }
    var SH = window.LumevinaShip, acct = window.LumevinaAccount && window.LumevinaAccount.current();
    if (SH) SH.fillAddress(modal, "co", SH.lastAddress(memberEmail() || (acct && acct.email)));
  };
  var coEmail = document.getElementById("co-email");
  /* a returning buyer who isn't signed in: their last shipping address
     fills in as soon as their email is in, if they haven't started typing one */
  var fillFromEmail = function () {
    var SH = window.LumevinaShip;
    var street = modal.querySelector("#co-street");
    if (!SH || !coEmail || !street || street.value.trim()) return;
    var email = coEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    var a = SH.lastAddress(email);
    if (!a) return;
    ["street", "apt", "city", "state", "zip"].forEach(function (f) {
      var e = modal.querySelector("#co-" + f);
      if (e && a[f] != null) e.value = a[f];
    });
    var note = modal.querySelector(".co-addr-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "co-addr-note";
      note.setAttribute("role", "status");
      street.closest(".field").parentNode.insertBefore(note, street.closest(".field"));
    }
    note.textContent = "Welcome back. We filled in the address you used last time. Change anything that's new.";
    if (typeof syncShip === "function") syncShip();
  };
  if (coEmail) {
    coEmail.addEventListener("change", fillFromEmail);
    coEmail.addEventListener("blur", fillFromEmail);
    coEmail.addEventListener("change", function () { renderMemberLine(); });
    coEmail.addEventListener("input", function () { renderMemberLine(); });
  }

  var closeCheckout = function () {
    modal.setAttribute("aria-hidden", "true");
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };

  var checkoutOpen = function () {
    return modal.getAttribute("aria-hidden") === "false";
  };

  /* "send it to me" hides the recipient fields (buyer gives it in person) */
  giftToMe.addEventListener("change", function () {
    giftRecipientFields.hidden = giftToMe.checked;
  });

  checkoutBtn.addEventListener("click", openCheckout);
  modal.querySelector(".checkout-close").addEventListener("click", closeCheckout);
  modal.querySelector(".checkout-done").addEventListener("click", closeCheckout);
  modalOverlay.addEventListener("click", closeCheckout);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (checkoutOpen()) closeCheckout();
    else if (drawerOpen()) closeDrawer();
  });

  /* ── Card fields (shared engine: js/payments.js) ── */
  var pay = window.LumevinaPayments;
  var cardInput = checkoutForm.elements.card;
  var expiryInput = checkoutForm.elements.expiry;
  var cvcInput = checkoutForm.elements.cvc;
  pay.bindCardFields(cardInput, expiryInput, cvcInput);

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

    if (!LIVE) {                      /* live: Stripe's page takes the card */
      var cardOk = pay.cardValid(cardInput.value);
      mark(cardInput, !cardOk);
      if (!cardOk) problems.push("a valid card number");

      var expOk = pay.expiryValid(expiryInput.value);
      mark(expiryInput, !expOk);
      if (!expOk) problems.push("a future expiry (MM/YY)");

      var cvcOk = pay.cvcValid(cvcInput.value);
      mark(cvcInput, !cvcOk);
      if (!cvcOk) problems.push("a 3–4 digit CVC");
    }

    /* shelf products being shipped need somewhere to go: street, city,
       state and ZIP each in their own field, the way a label needs them
       (live: Stripe's page collects the address) */
    if (!LIVE && cartHasRetail() && delivery() === "ship" && window.LumevinaShip) {
      var addr = window.LumevinaShip.readAddress(modal, "co");
      problems = problems.concat(addr.problems);
    }

    /* a gift going to someone else needs a name + email to deliver to */
    if (cartHasGift() && !giftToMe.checked) {
      var gName = giftNameInput.value.trim();
      mark(giftNameInput, !gName);
      if (!gName) problems.push("the recipient's name");
      var gEmailOk = giftEmailInput.value.trim() && giftEmailInput.checkValidity();
      mark(giftEmailInput, !gEmailOk);
      if (!gEmailOk) problems.push("the recipient's email");
    }

    return problems;
  };

  /* Issue a certificate per gift unit in the cart and show the codes.
     (Live: this happens server-side after Stripe confirms, and the code
     is emailed to the recipient or the buyer — see js/giftcards.js.) */
  var issueGiftCards = function () {
    if (!window.LumevinaGiftCards || !cartHasGift()) { giftCodesEl.hidden = true; return; }
    var toMe = giftToMe.checked;
    var buyer = checkoutForm.elements.email.value.trim();
    var codes = [];
    Object.keys(cart).forEach(function (id) {
      if (!isGiftId(id)) return;
      var item = cart[id];
      /* "gift-any-*" is a dollar-value gift (account credit); everything else
         is a specific treatment. Only real treatments carry a serviceId, which
         is what makes the certificate a service (all-or-nothing) gift. */
      var raw = id.replace(/^gift-/, "");
      var serviceId = /^any(-|$)/.test(raw) ? null : raw;
      for (var i = 0; i < item.qty; i++) {
        var card = window.LumevinaGiftCards.create({
          amount: item.price,
          label: item.name.replace(/^Gift Card · /, ""),
          serviceId: serviceId,
          recipientName: toMe ? "" : giftNameInput.value.trim(),
          recipientEmail: toMe ? "" : giftEmailInput.value.trim(),
          message: (modal.querySelector("#co-gift-msg").value || "").trim(),
          deliverToBuyer: toMe,
          sendDate: modal.querySelector("#co-gift-date").value || null,
          boughtBy: buyer
        });
        codes.push(card);
      }
    });
    if (!codes.length) { giftCodesEl.hidden = true; return; }
    var safe = function (t) { return String(t).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); };
    var who = toMe ? "You'll receive"
      : (safe(giftNameInput.value.trim()) + " will receive");
    var many = codes.length > 1;
    var html = '<p class="gift-codes-lead">' + who + ' the certificate' + (many ? "s" : "") + ' by email. ' +
      'Keep the code' + (many ? "s" : "") + ' safe and show ' + (many ? "them" : "it") + ' at the visit: Evelyn takes it off the bill. ' +
      'Anything left stays on the certificate for next time, and if the visit costs more, you pay only the difference.</p>';
    codes.forEach(function (c) {
      html += '<div class="gift-code-row"><span class="gift-code">' + c.code +
        '</span><span class="gift-code-for">' + c.label + " · " + money(c.amount) +
        "</span></div>";
    });
    giftCodesEl.innerHTML = html;
    giftCodesEl.hidden = false;
  };

  /* ── Live: the server prices the cart and opens Stripe's payment page ── */
  var liveCheckout = function () {
    var payBtn = checkoutForm.querySelector(".checkout-pay");
    var items = [], gifts = [];
    var toMe = giftToMe.checked;
    Object.keys(cart).forEach(function (id) {
      var item = cart[id];
      if (id.indexOf("retail-") === 0) items.push({ id: id.replace("retail-", ""), qty: item.qty });
      else if (isGiftId(id)) {
        for (var i = 0; i < item.qty; i++) gifts.push({
          amount: item.price, toBuyer: toMe,
          recipientName: toMe ? "" : giftNameInput.value.trim(),
          recipientEmail: toMe ? "" : giftEmailInput.value.trim(),
          message: (modal.querySelector("#co-gift-msg").value || "").trim(),
          sendDate: modal.querySelector("#co-gift-date").value || ""
        });
      }
    });
    payBtn.disabled = true;
    checkoutStatus.textContent = "Opening the secure payment page…";
    var url = SHOP.supabase.replace(/\/$/, "") + "/functions/v1/create-checkout";
    fetch(url, {
      method: "POST",
      /* signed in: a member's shelf discount and free shipping are applied by the server too */
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + ((window.LumevinaAccount && window.LumevinaAccount.token && window.LumevinaAccount.token()) || SHOP.key) },
      body: JSON.stringify({
        items: items, gifts: gifts, delivery: delivery(),
        email: checkoutForm.elements.email.value.trim(), name: checkoutForm.elements.name.value.trim(),
        returnUrl: location.href.split(/[?#]/)[0]
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; });
    }).then(function (r) {
      if (r.ok && r.j.url) {
        checkoutStatus.textContent = "Taking you to Stripe…";
        /* Stripe's page can't open inside a frame (an app's viewer): give it its own tab there */
        var framed = true;
        try { framed = window.self !== window.top; } catch (err) { /* cross-origin frame */ }
        if (framed) {
          var w = window.open(r.j.url, "_blank", "noopener");
          if (!w) checkoutStatus.innerHTML = 'Tap to <a href="' + r.j.url.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">open the secure payment page</a>.';
          payBtn.disabled = false;
        } else location.assign(r.j.url);
        return;
      }
      payBtn.disabled = false;
      var j = r.j || {};
      checkoutStatus.textContent =
        j.reason === "stock" ? (j.left ? "Only " + j.left + " of " + (j.name || "one item") + " left. Lower the amount in your cart and try again." : (j.name || "One item") + " just sold out. Take it out of your cart and try again.")
        : j.reason === "unavailable" ? "One item isn't available any more. Take it out of your cart and try again."
        : j.reason === "consult_needed" ? (j.name || "One item") + " needs a quick consult first. Tap \u201cNeeds a quick consult\u201d on it in the shop and Evelyn unlocks it for this email, usually within a day."
        : j.reason === "email" ? "Check your email address."
        : j.reason === "gift_email" ? "Check the recipient's email address."
        : "Payments aren't available right now. Please try again in a few minutes.";
    }, function () {
      payBtn.disabled = false;
      checkoutStatus.textContent = "Couldn't reach the payment page. Check your connection and try again.";
    });
  };

  /* the "running low?" email (functions/client-reminders): ?reorder=id,id puts
     those products back in the bag, the ones still on the shelf */
  var reorder = function () {
    var q = /[?&]reorder=([a-z0-9,-]+)/i.exec(location.search);
    if (!q) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* old browser */ }
    var added = q[1].split(",").slice(0, 12).filter(function (id) { return window.LumevinaCart.add(id).ok; });
    if (added.length) openDrawer();
  };

  /* back from Stripe: ?order=done (paid) or ?order=cancelled */
  var returned = function () {
    var q = /[?&]order=(done|cancelled)/.exec(location.search);
    if (!q) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* old browser */ }
    if (q[1] === "cancelled") { if (Object.keys(cart).length) openDrawer(); return; }
    clearCart();
    modal.querySelector(".checkout-success .checkout-title").textContent = "Thank you!";
    modal.querySelector(".success-sub").textContent = "Your payment went through. The receipt is on its way to your email, and any gift certificates go out to their recipients.";
    modal.querySelector(".success-order").hidden = true;
    modal.querySelectorAll(".checkout-demo-note").forEach(function (n) { n.hidden = true; });
    formView.hidden = true;
    successView.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".checkout-done").focus();
  };

  /* ── Submit → live checkout, or the demo's success ── */
  checkoutForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var problems = validateCheckout();
    if (problems.length) {
      checkoutStatus.textContent = "Please check: " + problems.join(", ") + ".";
      return;
    }
    if (LIVE) { liveCheckout(); return; }

    /* Processing runs through the shared engine — see the Stripe
       integration notes at the top of js/payments.js. */
    var payBtn = checkoutForm.querySelector(".checkout-pay");
    var total = orderTotal();
    payBtn.disabled = true;
    checkoutStatus.textContent = "Processing…";
    pay.process({ amount: total, description: "Lumevina order" },
      function (err, result) {
        payBtn.disabled = false;
        if (err) {
          checkoutStatus.textContent = "Payment failed — please try again.";
          return;
        }
        checkoutStatus.textContent = "";
        orderIdEl.textContent = result.id;
        /* this browser's orders, so Ask Lumevina can say where one is (live: the orders table) */
        try {
          var mine = JSON.parse(localStorage.getItem("lumevina_orders")) || [];
          mine.unshift({ id: result.id, at: new Date().toISOString(), email: checkoutForm.elements.email.value.trim().toLowerCase(),
            items: Object.keys(cart).filter(function (id) { return id.indexOf("retail-") === 0; })
              .map(function (id) { return { id: id, name: cart[id].name, qty: cart[id].qty }; }),
            gifts: Object.keys(cart).filter(isGiftId).length, delivery: cartHasRetail() ? delivery() : "none", total: total });
          localStorage.setItem("lumevina_orders", JSON.stringify(mine.slice(0, 30)));
        } catch (e) { /* private mode */ }

        /* Glow Rewards: gifts & orders earn 1 ✦ per $1 */
        var rw = window.LumevinaRewards;
        var earnedEl = modal.querySelector(".rw-earned-cart");
        if (rw && earnedEl) {
          var q = rw.award(total, {}, "Lumevina order");
          earnedEl.textContent = "✦ +" + q.points +
            " Glow Points earned · balance " + rw.points() + " ✦";
          earnedEl.hidden = false;
        }

        /* retail sold online → drop the shelf count + log the sale (live: the
           Stripe webhook does this server-side; same single source of truth) */
        if (window.LumevinaInventory) {
          var salesLog = [];
          try { salesLog = JSON.parse(localStorage.getItem("lumevina_retail_sales")) || []; }
          catch (e) { salesLog = []; }
          /* log what was actually paid (after any member discount) and the
             unit cost, so the books show real revenue and product cost */
          var LMr = window.LumevinaMembership;
          var rate = LMr ? LMr.retailRate(memberEmail()) : 0;
          Object.keys(cart).forEach(function (id) {
            if (id.indexOf("retail-") !== 0) return;
            var item = cart[id];
            var pid = id.replace("retail-", "");
            var stock = window.LumevinaInventory.get(pid);
            window.LumevinaInventory.decrement(pid, item.qty);
            salesLog.push({ id: pid, name: item.name, price: item.price, qty: item.qty,
              paid: Math.round(item.price * (1 - rate) * 100) / 100,
              cost: stock ? Number(stock.cost || 0) : 0,
              at: new Date().toISOString(), channel: "online", type: "sale" });
          });
          /* shipping: what the client paid (often nothing) and what postage
             costs us. The order goes on the dashboard's Shipping list
             (js/shipping.js), and its estimate is replaced by the real label
             price once it's marked shipped. */
          var shipNow = shipping();
          if (cartHasRetail() && delivery() === "ship") {
            var shipLabel = shipNow.why === "member" ? "Shipping · member, free" :
              shipNow.why === "over" ? "Shipping · free over $75" : "Shipping";
            var SH = window.LumevinaShip;
            if (SH) {
              var shipRec = SH.add({ source: "shop", order: result.id, name: checkoutForm.elements.name.value.trim(),
                email: checkoutForm.elements.email.value.trim(), address: SH.readAddress(modal, "co").address,
                charged: shipNow.fee,
                items: Object.keys(cart).filter(function (id) { return id.indexOf("retail-") === 0; })
                  .map(function (id) { return { id: id, name: cart[id].name, qty: cart[id].qty }; }) });
              salesLog.push(SH.bookEntry(shipRec, shipNow.fee, shipLabel));
            } else {
              salesLog.push({ id: "shipping", name: shipLabel, price: shipNow.fee, qty: 1, paid: shipNow.fee,
                cost: SHIP_COST, at: new Date().toISOString(), channel: "online", type: "shipping", order: result.id });
            }
          }
          try { localStorage.setItem("lumevina_retail_sales", JSON.stringify(salesLog)); }
          catch (e) { /* private mode */ }
        }

        var subEl = modal.querySelector(".success-sub");
        if (subEl) subEl.textContent = cartHasGift()
          ? "Your gift of glow is on its way ✨"
          : cartHasRetail() && delivery() === "pickup" ? "Your order will be waiting at the front ✨"
          : cartHasRetail() ? "Your order ships in 1–2 business days. The tracking number comes by email ✨"
          : "Your order is on its way ✨";

        issueGiftCards();

        formView.hidden = true;
        successView.hidden = false;
        /* React Bits effects (js/react-bits.js): a burst of sparks, and the points count in */
        if (window.LumevinaFX) {
          window.LumevinaFX.burst(successView.querySelector(".success-glyph"));
          if (rw && earnedEl) window.LumevinaFX.countUp(earnedEl);
        }
        checkoutForm.reset();
        deliveryPicked = false;
        giftRecipientFields.hidden = false;
        shipAddress.hidden = false;
        clearCart();
        modal.querySelector(".checkout-done").focus();
      });
  });

  /* ── Boot ── */
  load();
  render();
  if (LIVE) returned();
  reorder();
})();

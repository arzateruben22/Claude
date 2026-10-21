/* Lumevina — Buy again
 *
 * My Lumevina → "Buy again": what this client bought from the shelf before,
 * one tap back into the bag (STOREFRONT.md step 2.6). Products that have
 * sold out say so; an active Evelyn hasn't unlocked for them yet opens the
 * consult sheet instead (js/consult.js).
 *
 *   LIVE   the orders table, read as the signed-in client (the "clients read
 *          their own orders" policy in server/schema.sql)
 *   DEMO   this browser's orders (localStorage "lumevina_orders", written by
 *          the demo checkout in js/cart.js)
 *
 * The "running low?" email does the same thing from the inbox: its link
 * carries ?reorder=id,id (functions/client-reminders → js/cart.js). */
(function () {
  "use strict";

  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var box = document.querySelector(".acct-again"), card = document.querySelector(".acct-ag-card"), meta = document.querySelector(".acct-ag-meta");
  if (!box || !card) return;

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (e) { return String(e || "").trim().toLowerCase(); };
  var who = function () { var a = window.LumevinaAccount && window.LumevinaAccount.current && window.LumevinaAccount.current(); return a ? norm(a.email) : ""; };
  var token = function () { return window.LumevinaAccount && window.LumevinaAccount.token ? window.LumevinaAccount.token() : ""; };
  var price = function (n) { n = Number(n || 0); return "$" + (n % 1 ? n.toFixed(2) : String(n)); };

  /* orders, newest first → one row per product, in the order they last bought them */
  var bought = function (orders) {
    var seen = {}, out = [];
    orders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var id = String((it && it.id) || "").replace(/^retail-/, "");
        if (!id || seen[id]) return;
        seen[id] = true;
        out.push({ id: id, qty: Number(it.qty) || 1 });
      });
    });
    return out;
  };

  var load = function () {
    var e = who();
    if (!e) return Promise.resolve([]);
    if (LIVE && token()) {
      return fetch(SHOP.supabase.replace(/\/$/, "") + "/rest/v1/orders?select=items,paid_at&status=eq.paid&order=paid_at.desc&limit=12", {
        headers: { apikey: SHOP.key, Authorization: "Bearer " + token() }
      }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { return bought(rows || []); }, function () { return []; });
    }
    var mine = [];
    try { mine = JSON.parse(localStorage.getItem("lumevina_orders")) || []; } catch (x) { /* private mode */ }
    return Promise.resolve(bought(mine.filter(function (o) { return norm(o.email) === e; })));
  };

  var rows = [];
  var paint = function () {
    var INV = window.LumevinaInventory, CS = window.LumevinaConsult, CART = window.LumevinaCart;
    if (!INV || !who()) { box.hidden = true; return; }
    var list = rows.map(function (r) { return INV.get(r.id); })
      .filter(function (p) { return p && !p.hidden && !p.draft && p.kind !== "consult"; }).slice(0, 8);
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    var addable = list.filter(function (p) { return INV.status(p) !== "out" && !(p.consult && CS && !CS.approved(p.id)); });
    meta.textContent = list.length === 1 ? "from your last order" : "what you’ve bought before";
    card.innerHTML = '<ul class="acct-ag-list" role="list">' + list.map(function (p) {
      var s = INV.status(p), inBag = CART && CART.has(p.id);
      var btn = s === "out" ? '<span class="acct-ag-state">Sold out</span>'
        : p.consult && CS && !CS.approved(p.id)
          ? '<button type="button" class="linklike acct-ag-ask" data-id="' + esc(p.id) + '">' + (CS.waiting(p.id) ? "Waiting on Evelyn" : "Needs a quick consult") + '</button>'
          : '<button type="button" class="linklike acct-ag-add' + (inBag ? " is-in" : "") + '" data-id="' + esc(p.id) + '">' + (inBag ? "In your cart" : "Add to cart") + '</button>';
      return '<li class="acct-ag-item"><span class="acct-ag-name">' + esc(p.brand + " " + p.name) + '</span><span class="acct-ag-price">' + price(p.price) + '</span>' + btn + '</li>';
    }).join("") + '</ul>' +
      (addable.length > 1 ? '<button type="button" class="btn btn-ghost acct-ag-all">Add all ' + addable.length + ' to cart</button>' : "");
  };

  var refresh = function () { load().then(function (r) { rows = r; paint(); }); };

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".acct-ag-add, .acct-ag-ask, .acct-ag-all");
    if (!t) return;
    var INV = window.LumevinaInventory, CART = window.LumevinaCart, CS = window.LumevinaConsult;
    if (t.classList.contains("acct-ag-ask")) { if (CS && INV) CS.open(INV.get(t.dataset.id)); return; }
    if (!CART) return;
    if (t.classList.contains("acct-ag-add")) {
      var r = CART.add(t.dataset.id);
      t.textContent = r.ok || r.reason === "max" ? "In your cart" : r.reason === "consult" ? "Needs a quick consult" : "Not available right now";
      t.classList.toggle("is-in", r.ok || r.reason === "max");
      return;
    }
    var n = 0;
    card.querySelectorAll(".acct-ag-add").forEach(function (b) {
      var x = CART.add(b.dataset.id);
      if (x.ok || x.reason === "max") { n++; b.textContent = "In your cart"; b.classList.add("is-in"); }
    });
    t.textContent = n ? "Added " + n + " · in your cart" : "Nothing to add";
    t.disabled = true;
    if (n && CART.open) setTimeout(CART.open, 350);
  });

  document.addEventListener("lumevina:account-changed", refresh);
  document.addEventListener("lumevina:account-opened", refresh);
  document.addEventListener("lumevina:consult-changed", paint);
  if (who()) refresh();
})();

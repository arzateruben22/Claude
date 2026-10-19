/* Lumevina — the shelf: stock and prices for every product
 *
 * The products themselves come from js/catalog.js (Evelyn's product
 * guide). This file keeps what changes day to day: how many are on the
 * shelf, a price she edits, and which flagged drafts she has confirmed.
 *
 * Both ways a product sells take from the SAME count, so the shelf is
 * always right:
 *   • Online     the cart's checkout confirms → decrement here (js/cart.js)
 *   • In person  she taps Sell in the dashboard → decrement there
 *
 * DEMO: saved in this browser (lumevina_inventory), shared with the
 * dashboard when both are opened on the same device.
 * LIVE: a Supabase products table; the Stripe webhook takes stock off
 * server-side when an order is paid (server/README.md).
 */
(function () {
  "use strict";

  var KEY = "lumevina_inventory";
  var CAT = window.LUMEVINA_CATALOG || { products: [], brands: [], categories: [] };
  var LOW = 3;

  var num = function (n) { return Number(n || 0); };
  var read = function () {
    try { var s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : []; }
    catch (e) { return []; }
  };

  /* the catalog, with this shelf's saved stock, prices and confirmations
     laid over it. Saved rows from the old three-product shelf (no brand)
     are dropped: the guide replaced that list. */
  var inv = [];
  var build = function () {
    var saved = {};
    read().forEach(function (r) { if (r && r.id && r.brand) saved[r.id] = r; });
    inv = CAT.products.map(function (c) {
      var s = saved[c.id] || {};
      var p = {};
      Object.keys(c).forEach(function (k) { p[k] = c[k]; });
      if (s.stock !== undefined) p.stock = s.stock;
      if (s.price != null && s.priceSet) { p.price = s.price; p.priceSet = true; }
      if (s.cost != null) p.cost = s.cost;
      if (s.confirmed) { p.confirmed = true; p.draft = false; if (s.name) p.name = s.name; }
      if (s.hidden) p.hidden = true;
      return p;
    });
  };
  var persist = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(inv.map(function (p) {
        return { id: p.id, brand: p.brand, name: p.name, price: p.price, priceSet: !!p.priceSet,
          stock: p.stock, cost: p.cost, cat: p.cat, draft: !!p.draft, confirmed: !!p.confirmed,
          hidden: !!p.hidden, note: p.note || "" };
      })));
    } catch (e) { /* private mode */ }
    listeners.forEach(function (fn) { fn(); });
  };
  var listeners = [];
  build();
  /* the dashboard in another tab changed the shelf */
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { build(); listeners.forEach(function (fn) { fn(); }); }
  });

  var get = function (id) {
    id = String(id).replace(/^retail-/, "");
    return inv.filter(function (p) { return p.id === id; })[0] || null;
  };
  /* what clients see: confirmed, not hidden */
  var live = function () { return inv.filter(function (p) { return !p.draft && !p.hidden; }); };

  /* "in" (plenty), "low" (3 or fewer), "out", or "ask" (count unknown) */
  var status = function (p) {
    if (p.stock == null) return "ask";
    if (num(p.stock) <= 0) return "out";
    return num(p.stock) <= LOW ? "low" : "in";
  };

  var decrement = function (id, qty) {
    var p = get(id);
    if (!p || p.stock == null) return;
    p.stock = Math.max(0, num(p.stock) - num(qty || 1));
    persist();
  };
  var setStock = function (id, n) { var p = get(id); if (!p) return; p.stock = Math.max(0, Math.round(num(n))); persist(); };
  var setPrice = function (id, n) { var p = get(id); if (!p) return; p.price = Math.max(0, Math.round(num(n) * 100) / 100); p.priceSet = true; persist(); };
  /* a flagged draft, checked by Evelyn: optionally with its corrected name */
  var confirm = function (id, name) {
    var p = get(id);
    if (!p) return;
    p.draft = false; p.confirmed = true;
    if (name && name.trim()) p.name = name.trim();
    persist();
  };
  var setHidden = function (id, on) { var p = get(id); if (!p) return; p.hidden = !!on; persist(); };

  /* kept for older callers: the shop draws itself (js/shop.js) */
  var render = function () { listeners.forEach(function (fn) { fn(); }); };

  window.LumevinaInventory = {
    LOW: LOW,
    brands: CAT.brands, categories: CAT.categories, asOf: CAT.asOf,
    all: function () { return inv; },
    live: live, get: get, status: status,
    decrement: decrement, setStock: setStock, setPrice: setPrice,
    confirm: confirm, setHidden: setHidden,
    render: render,
    onChange: function (fn) { listeners.push(fn); }
  };
})();

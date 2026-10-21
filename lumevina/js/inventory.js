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
 * LIVE (js/site-config.js → shop.supabase and shop.key filled in): the
 * count lives in Supabase's products table, the one count every device
 * reads. A paid online order takes stock off in the Stripe webhook; Sell
 * in the dashboard takes it off through server/functions/shelf. This file
 * reads the live counts on load, when the page comes back into view, and
 * every minute, and lays them over the catalog. The dashboard's changes (a
 * recount, a price, Sell for an in-person sale) go to the server through
 * functions/studio with her studio key, so every device shows one count.
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
    /* products Evelyn added herself in the dashboard */
    Object.keys(saved).forEach(function (id) {
      var s = saved[id];
      if (!s.custom || inv.some(function (p) { return p.id === id; })) return;
      inv.push({ id: id, brand: s.brand, name: s.name, price: num(s.price), priceSet: true, stock: s.stock,
        cost: s.cost, cat: s.cat || "More", custom: true, hidden: !!s.hidden });
    });
    lay();
  };
  /* the live counts from the server, over whatever this browser saved */
  var LIVE = {};
  var lay = function () {
    inv.forEach(function (p) {
      var l = LIVE[p.id];
      if (!l) return;
      p.stock = l.stock;
      if (l.price != null) p.price = l.price;
      p.hidden = !!l.hidden;
    });
  };
  var persist = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(inv.map(function (p) {
        return { id: p.id, brand: p.brand, name: p.name, price: p.price, priceSet: !!p.priceSet,
          stock: p.stock, cost: p.cost, cat: p.cat, draft: !!p.draft, confirmed: !!p.confirmed,
          hidden: !!p.hidden, custom: !!p.custom, note: p.note || "" };
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
    if (p.kind === "consult") return "in";
    if (p.stock == null) return "ask";
    if (num(p.stock) <= 0) return "out";
    return num(p.stock) <= LOW ? "low" : "in";
  };

  /* live: a change from the dashboard goes to the server (functions/studio,
     with her studio key); the reply becomes this device's live count */
  var studioKey = function () { try { return localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { return ""; } };
  var remote = function (body) {
    if (!isLive) return Promise.resolve(null);
    var key = studioKey();
    if (!key) return Promise.reject({ reason: "studio_key" });
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": key },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; });
    }).then(function (row) {
      if (row && row.id) {
        var was = LIVE[row.id] || {};
        LIVE[row.id] = { stock: row.stock, price: row.price_cents == null ? was.price : row.price_cents / 100,
          hidden: row.hidden == null ? was.hidden : row.hidden };
        lay();
        listeners.forEach(function (fn) { fn(); });
      }
      return row;
    });
  };

  var decrement = function (id, qty) {
    var p = get(id);
    if (!p || p.stock == null) return;
    p.stock = Math.max(0, num(p.stock) - num(qty || 1));
    persist();
  };
  /* an in-person sale (the dashboard's Sell) */
  var sell = function (id, qty) { decrement(id, qty); var p = get(id); return p ? remote({ action: "sell", id: p.id, qty: num(qty || 1) }) : Promise.resolve(null); };
  var setStock = function (id, n) {
    var p = get(id); if (!p) return Promise.resolve(null);
    p.stock = n === null ? null : Math.max(0, Math.round(num(n))); persist();
    return remote({ action: "shelf_set", id: p.id, stock: p.stock });
  };
  var setPrice = function (id, n) {
    var p = get(id); if (!p) return Promise.resolve(null);
    p.price = Math.max(0, Math.round(num(n) * 100) / 100); p.priceSet = true; persist();
    return remote({ action: "shelf_set", id: p.id, price: p.price });
  };
  /* a flagged draft, checked by Evelyn: optionally with its corrected name */
  var confirm = function (id, name) {
    var p = get(id);
    if (!p) return;
    p.draft = false; p.confirmed = true;
    if (name && name.trim()) p.name = name.trim();
    persist();
  };
  var setHidden = function (id, on) {
    var p = get(id); if (!p) return Promise.resolve(null);
    p.hidden = !!on; persist();
    return remote({ action: "shelf_set", id: p.id, hidden: p.hidden });
  };
  var setCost = function (id, n) { var p = get(id); if (!p) return; p.cost = Math.max(0, Math.round(num(n) * 100) / 100); persist(); };
  /* a product she brings in that isn't in the guide yet */
  var add = function (o) {
    var id = String(o.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!id) return null;
    if (get(id)) id += "-" + Date.now().toString(36).slice(-3);
    var p = { id: id, brand: o.brand || "Lumevina", name: String(o.name).trim(), price: num(o.price), priceSet: true,
      stock: o.stock === "" || o.stock == null ? null : Math.max(0, Math.round(num(o.stock))), cost: num(o.cost),
      cat: o.cat || "More", custom: true };
    inv.push(p);
    persist();
    remote({ action: "shelf_add", id: p.id, name: p.name, brand: p.brand, category: p.cat, price: p.price, stock: p.stock })
      .catch(function () { /* the dashboard says so */ });
    return p;
  };

  /* ── live: one shared count on the server ── */
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var isLive = !!(SHOP.supabase && SHOP.key);
  var pull = function () {
    if (!isLive || !window.fetch) return;
    fetch(SHOP.supabase.replace(/\/$/, "") + "/rest/v1/shelf?select=id,stock,price_cents,hidden",
      { headers: { apikey: SHOP.key, Authorization: "Bearer " + SHOP.key } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        LIVE = {};
        rows.forEach(function (r) { LIVE[r.id] = { stock: r.stock, price: r.price_cents == null ? null : r.price_cents / 100, hidden: r.hidden }; });
        lay();
        listeners.forEach(function (fn) { fn(); });
      })
      .catch(function () { /* offline or not set up yet: the catalog's counts stand */ });
  };
  if (isLive) {
    pull();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) pull(); });
    setInterval(function () { if (!document.hidden) pull(); }, 60000);
  }

  /* kept for older callers: the shop draws itself (js/shop.js) */
  var render = function () { listeners.forEach(function (fn) { fn(); }); };

  window.LumevinaInventory = {
    LOW: LOW,
    brands: CAT.brands, categories: CAT.categories, asOf: CAT.asOf,
    all: function () { return inv; },
    live: live, get: get, status: status,
    decrement: decrement, sell: sell, setStock: setStock, setPrice: setPrice,
    confirm: confirm, setHidden: setHidden, setCost: setCost, add: add,
    isLive: isLive, refresh: pull,
    render: render,
    onChange: function (fn) { listeners.push(fn); }
  };
})();

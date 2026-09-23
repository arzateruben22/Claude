/* Lumevina — retail inventory (own products)
 *
 * One source of truth for the products Lumevina stocks and sells (as opposed
 * to the affiliate "Take It Home" links). Runs on localStorage now so the
 * whole loop works in the demo; live, this becomes a Supabase `products`
 * table and the Stripe webhook decrements stock server-side on paid orders.
 *
 * Both sale channels decrement the SAME store:
 *   • Online  — cart checkout confirms → decrement here (js/cart.js)
 *   • In person — the owner taps "Sell" in the dashboard → decrement there
 * so the shelf count is always right no matter where the sale happened.
 */
(function () {
  "use strict";

  var KEY = "lumevina_inventory";

  /* the shelf — matches the dashboard's Inventory card */
  var CATALOG = [
    { id: "gm-cleanser", name: "GlyMed+ Glycolic Facial Cleanser", cost: 18, price: 38, stock: 8,
      desc: "Step one, cleanse: 10% glycolic acid clears dull buildup and keeps skin smooth between facials." },
    { id: "lm-serum", name: "Le Mieux TGF-β Booster", cost: 32, price: 75, stock: 3,
      desc: "A concentrated dropper serum — a few drops under your moisturizer to boost your routine between facials." },
    { id: "spf-30", name: "Face Reality Daily SPF 30 Plus", cost: 14, price: 32, stock: 12,
      desc: "Broad-spectrum, acne-safe SPF 30 — the one daily step that protects every result." }
  ];

  /* product photos, by id (kept out of the saved stock so a photo can be
     added or swapped without resetting anyone's inventory) */
  var PHOTOS = {
    "gm-cleanser": "img/retail/glymed-cleanser.webp",
    "spf-30": "img/retail/daily-spf-30.webp",
    "lm-serum": "img/retail/le-mieux-tgf-booster.webp"
  };

  var num = function (n) { return Number(n || 0); };

  var load = function () {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      return (s && s.length) ? s : null;
    } catch (e) { return null; }
  };
  var persist = function () {
    try { localStorage.setItem(KEY, JSON.stringify(inv)); } catch (e) { /* private mode */ }
  };

  /* products taken off the shelf: dropped from saved lists too */
  var RETIRED = ["gua-sha"];

  var inv = load();
  if (!inv) { inv = JSON.parse(JSON.stringify(CATALOG)); persist(); }
  else {
    var dirty = false;
    /* products taken off the shelf leave saved lists too */
    if (inv.some(function (p) { return RETIRED.indexOf(p.id) !== -1; })) {
      inv = inv.filter(function (p) { return RETIRED.indexOf(p.id) === -1; });
      dirty = true;
    }
    /* names and descriptions follow the catalog (a product renamed to match
       its bottle updates everywhere); stock and price stay as saved */
    inv.forEach(function (p) {
      var c = CATALOG.filter(function (x) { return x.id === p.id; })[0];
      if (c && (p.name !== c.name || p.desc !== c.desc)) { p.name = c.name; p.desc = c.desc; dirty = true; }
    });
    if (dirty) persist();
  }

  var get = function (id) {
    return inv.filter(function (p) { return p.id === id; })[0] || null;
  };
  var decrement = function (id, qty) {
    var p = get(id);
    if (!p) return;
    p.stock = Math.max(0, num(p.stock) - num(qty || 1));
    persist();
    render();
  };

  var LOW = 3;
  var render = function () {
    var grid = document.getElementById("retail-grid");
    if (!grid) return;
    grid.innerHTML = "";
    inv.forEach(function (p, i) {
      var out = num(p.stock) <= 0;
      var low = !out && num(p.stock) <= LOW;
      var card = document.createElement("article");
      card.className = "retail-card" + (out ? " is-out" : "");
      card.setAttribute("data-reveal", "");
      card.setAttribute("data-spotlight", "");
      card.innerHTML =
        (PHOTOS[p.id]
          ? '<div class="retail-visual has-photo" aria-hidden="true"><img src="' + PHOTOS[p.id] +
            '" alt="" loading="lazy" decoding="async"></div>'
          : '<div class="retail-visual rt-tint-' + ((i % 4) + 1) + '" aria-hidden="true"></div>') +
        '<div class="retail-body">' +
        '<h3 class="retail-name">' + p.name + '</h3>' +
        (p.desc ? '<p class="retail-desc">' + p.desc + '</p>' : '') +
        '<div class="retail-foot"><p class="retail-price-line"><span class="product-price">$' + num(p.price) + '</span>' +
        '<span class="retail-stock' + (low ? ' is-low' : '') + '">' +
        (out ? "Sold out" : (low ? "Only " + num(p.stock) + " left" : "In stock")) + '</span></p>' +
        (out
          ? '<button class="btn btn-ghost" type="button" disabled>Sold out</button>'
          : '<button class="btn btn-solid add-to-cart retail-add" type="button" data-id="retail-' +
            p.id + '" data-name="' + p.name + '" data-price="' + num(p.price) + '" aria-label="Add ' +
            p.name + ' to cart">Add</button>') +
        '</div></div>';
      grid.appendChild(card);
    });
  };

  render();

  window.LumevinaInventory = {
    all: function () { return inv; },
    get: get,
    decrement: decrement,
    render: render
  };
})();

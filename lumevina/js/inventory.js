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
    { id: "gm-cleanser", name: "GlyMed Gentle Cleanser", cost: 18, price: 38, stock: 8,
      desc: "The daily gel cleanser we start most facials with — soothing, no tightness." },
    { id: "lm-serum", name: "Le Mieux Peptide Serum", cost: 32, price: 75, stock: 3,
      desc: "Peptide + marine hydration to keep skin plump and luminous between visits." },
    { id: "spf-30", name: "Daily Mineral SPF 30", cost: 14, price: 32, stock: 12,
      desc: "Weightless mineral sunscreen — the one step that protects every result." },
    { id: "gua-sha", name: "Rose Quartz Gua Sha", cost: 9, price: 28, stock: 2,
      desc: "The sculpting stone we use in studio — de-puff and lift at home." }
  ];

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

  var inv = load();
  if (!inv) { inv = JSON.parse(JSON.stringify(CATALOG)); persist(); }

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
      card.innerHTML =
        '<div class="retail-visual rt-tint-' + ((i % 4) + 1) + '" aria-hidden="true"></div>' +
        '<h3 class="retail-name">' + p.name + '</h3>' +
        (p.desc ? '<p class="retail-desc">' + p.desc + '</p>' : '') +
        '<div class="retail-foot"><span class="product-price">$' + num(p.price) + '</span>' +
        (out
          ? '<button class="btn btn-ghost" type="button" disabled>Sold out</button>'
          : '<button class="btn btn-solid add-to-cart retail-add" type="button" data-id="retail-' +
            p.id + '" data-name="' + p.name + '" data-price="' + num(p.price) + '">Add to cart</button>') +
        '</div>' +
        '<p class="retail-stock' + (low ? ' is-low' : '') + '">' +
        (out ? "Sold out" : (low ? "Only " + num(p.stock) + " left" : "In stock")) + '</p>';
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

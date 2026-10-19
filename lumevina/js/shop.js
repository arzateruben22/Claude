/* Lumevina — the shop
 *
 * The front of the website: Evelyn's professional skincare, from her
 * product guide (js/catalog.js) with the shelf's live stock
 * (js/inventory.js).
 *
 *   Hero shelf   what's on the shelf right now, one tap to add
 *   The shop     search, brand and category, "in stock now", and every
 *                product's price and availability at a glance
 *
 * Out of stock is never a dead end: "Request it" fills in the Contact
 * form with that product, so Evelyn can order it in.
 *
 * Product cards are labels, not photos, until Evelyn's photos arrive:
 * the brand, the name, and a strength like "11%" set large, which is how
 * clients tell the mandelic serums apart.
 */
(function () {
  "use strict";

  var INV = window.LumevinaInventory;
  if (!INV) return;

  var BRAND_KEY = { "Face Reality": "fr", "GlyMed Plus": "gm", "Mixi Skincare": "mx", "Circadia": "ci" };
  var STATUS_ORDER = { "in": 0, "low": 1, "ask": 2, "out": 3 };
  var FIRST_SHOWN = 12;

  var money = function (n) { return "$" + (Math.round(n * 100) % 100 ? Number(n).toFixed(2) : String(Math.round(n))); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  var stockText = function (p) {
    var s = INV.status(p);
    return s === "in" ? "In stock" : s === "low" ? "Only " + p.stock + " left"
      : s === "ask" ? "Ask about stock" : "Out of stock";
  };

  /* "11% Mandelic Serum" → { big: "11%", rest: "Mandelic Serum" } */
  var strength = function (name) {
    var m = /^(\d+(?:\.\d+)?%)\s+(.+)$/.exec(name);
    return m ? { big: m[1], rest: m[2] } : null;
  };

  /* the Contact form, filled in for this product */
  var request = function (p) {
    var form = document.querySelector(".contact-form");
    if (!form) { location.hash = "#contact"; return; }
    var topic = form.querySelector("#ct-topic");
    var msg = form.querySelector("#ct-msg");
    if (topic) topic.value = "order";
    if (msg) msg.value = p.price
      ? "I'd like to order the " + p.name + " (" + p.brand + ", " + money(p.price) + "). Could you let me know when it's in?"
      : "I'm looking for " + p.name + ". Do you carry it?";
    document.getElementById("contact").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setTimeout(function () {
      var name = form.querySelector("#ct-name");
      (name && !name.value ? name : msg).focus({ preventScroll: true });
    }, 450);
  };

  var buyButton = function (p, compact) {
    var s = INV.status(p);
    var b = el("button", "btn " + (s === "in" || s === "low" ? "btn-solid add-to-cart" : "btn-ghost sh-request"));
    b.type = "button";
    if (s === "in" || s === "low") {
      b.textContent = compact ? "Add" : "Add to cart";
      b.dataset.id = "retail-" + p.id;
      b.dataset.name = p.brand + " " + p.name;
      b.dataset.price = String(p.price);
      b.setAttribute("aria-label", "Add " + p.name + " to cart, " + money(p.price));
    } else {
      b.textContent = "Request it";
      b.setAttribute("aria-label", "Request " + p.name);
      b.addEventListener("click", function () { request(p); });
    }
    return b;
  };

  /* one product, as a label */
  var card = function (p, compact) {
    var s = INV.status(p);
    var c = el("article", "sh-card sh-" + (BRAND_KEY[p.brand] || "x") + (s === "out" ? " is-out" : "") + (compact ? " sh-card--compact" : ""));
    var label = el("div", "sh-label");
    label.setAttribute("aria-hidden", "true");
    if (p.photo && !compact) {
      c.classList.add("sh-card--photo");
      label.classList.add("has-photo");
      var img = el("img");
      img.src = p.photo; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      label.appendChild(img);
    }
    label.appendChild(el("span", "sh-brand", p.brand));
    var st = strength(p.name);
    if (st) label.appendChild(el("span", "sh-big", st.big));
    label.appendChild(el("span", "sh-label-name", st ? st.rest : p.name));
    c.appendChild(label);

    var body = el("div", "sh-body");
    var h = el("h3", "sh-name", p.name);
    body.appendChild(h);
    body.appendChild(el("p", "sh-meta", p.brand + " · " + p.cat));
    var foot = el("div", "sh-foot");
    foot.appendChild(el("span", "sh-price", money(p.price)));
    foot.appendChild(el("span", "sh-stock is-" + s, stockText(p)));
    body.appendChild(foot);
    body.appendChild(buyButton(p, compact));
    c.appendChild(body);
    return c;
  };

  var sorted = function (list) {
    var bi = function (b) { var i = INV.brands.indexOf(b); return i === -1 ? 99 : i; };
    return list.slice().sort(function (a, b) {
      return (STATUS_ORDER[INV.status(a)] - STATUS_ORDER[INV.status(b)]) ||
        (bi(a.brand) - bi(b.brand)) || a.name.localeCompare(b.name);
    });
  };

  /* ── hero: on the shelf now ── */
  var rail = document.querySelector(".hero-shelf-list");
  var paintRail = function () {
    if (!rail) return;
    rail.textContent = "";
    var now = sorted(INV.live()).filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }).slice(0, 8);
    now.forEach(function (p) { var li = el("li"); li.appendChild(card(p, true)); rail.appendChild(li); });
    var wrap = rail.closest(".hero-shelf");
    if (wrap) wrap.hidden = !now.length;
  };

  /* ── the shop ── */
  var grid = document.getElementById("retail-grid");
  var shop = document.getElementById("shop");
  var q = document.getElementById("sh-q");
  var brandsEl = shop && shop.querySelector(".sh-brands");
  var catsEl = shop && shop.querySelector(".sh-cats");
  var inStock = document.getElementById("sh-instock");
  var countEl = shop && shop.querySelector(".sh-count");
  var moreBtn = shop && shop.querySelector(".sh-more");
  var state = { brand: "", cat: "", q: "", inStock: false, all: false };

  var chip = function (label, value, key, count) {
    var b = el("button", "sh-chip");
    b.type = "button";
    b.dataset.key = key;
    b.dataset.value = value;
    b.appendChild(document.createTextNode(label));
    if (count != null) b.appendChild(el("span", "sh-chip-n", String(count)));
    return b;
  };
  var buildChips = function () {
    if (!brandsEl || !catsEl) return;
    var list = INV.live();
    brandsEl.textContent = "";
    brandsEl.appendChild(chip("All brands", "", "brand", list.length));
    INV.brands.forEach(function (b) {
      var n = list.filter(function (p) { return p.brand === b; }).length;
      if (n) brandsEl.appendChild(chip(b, b, "brand", n));
    });
    catsEl.textContent = "";
    catsEl.appendChild(chip("Everything", "", "cat"));
    INV.categories.forEach(function (c) {
      var n = list.filter(function (p) { return p.cat === c; }).length;
      if (n) catsEl.appendChild(chip(c, c, "cat", n));
    });
  };
  var paintChips = function () {
    [brandsEl, catsEl].forEach(function (g) {
      if (!g) return;
      g.querySelectorAll(".sh-chip").forEach(function (b) {
        b.setAttribute("aria-pressed", String(state[b.dataset.key] === b.dataset.value));
      });
    });
  };

  var matches = function (p) {
    if (state.brand && p.brand !== state.brand) return false;
    if (state.cat && p.cat !== state.cat) return false;
    if (state.inStock && !(INV.status(p) === "in" || INV.status(p) === "low")) return false;
    if (state.q) {
      var hay = (p.name + " " + p.brand + " " + p.cat).toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
    }
    return true;
  };

  var paintGrid = function () {
    if (!grid) return;
    var list = sorted(INV.live().filter(matches));
    var filtered = !!(state.brand || state.cat || state.q || state.inStock);
    var shown = (state.all || filtered) ? list : list.slice(0, FIRST_SHOWN);
    grid.textContent = "";
    shown.forEach(function (p) { grid.appendChild(card(p)); });
    if (!list.length) {
      var none = el("p", "sh-none");
      none.appendChild(document.createTextNode("Nothing matches that yet. "));
      var ask = el("button", "linklike", "Ask Evelyn for it");
      ask.type = "button";
      ask.addEventListener("click", function () {
        request({ name: state.q || "a product", brand: "", price: 0 });
      });
      none.appendChild(ask);
      grid.appendChild(none);
    }
    var inNow = list.filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }).length;
    if (countEl) countEl.textContent = list.length + (list.length === 1 ? " product" : " products") +
      " · " + inNow + " on the shelf now";
    if (moreBtn) {
      moreBtn.hidden = shown.length >= list.length;
      moreBtn.textContent = "Show all " + list.length + " products";
    }
  };

  if (brandsEl) {
    shop.addEventListener("click", function (e) {
      var b = e.target.closest(".sh-chip");
      if (!b) return;
      state[b.dataset.key] = b.dataset.value;
      paintChips();
      paintGrid();
    });
  }
  if (q) {
    var t = null;
    q.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = q.value.trim(); paintGrid(); }, 120);
    });
  }
  if (inStock) inStock.addEventListener("change", function () { state.inStock = inStock.checked; paintGrid(); });
  if (moreBtn) moreBtn.addEventListener("click", function () {
    state.all = true;
    paintGrid();
    var next = grid.children[FIRST_SHOWN];
    var btn = next && next.querySelector("button");
    if (btn) btn.focus();
  });

  /* "Shop Face Reality" style links: <a href="#shop" data-shop-brand="Face Reality"> */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-shop-brand], [data-shop-cat]");
    if (!a) return;
    state.brand = a.getAttribute("data-shop-brand") || "";
    state.cat = a.getAttribute("data-shop-cat") || "";
    paintChips();
    paintGrid();
  });

  var paintAll = function () { buildChips(); paintChips(); paintGrid(); paintRail(); };
  INV.onChange(paintAll);
  if (shop) shop.classList.add("is-live");
  paintAll();
})();

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

  /* the product's picture: its photo, or its label until a photo arrives */
  var picture = function (p, cls) {
    var box = el("span", cls + (p.photo ? " has-photo" : ""));
    if (p.photo) {
      var img = el("img");
      img.src = p.photo; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      img.width = 1000; img.height = 1000;
      box.appendChild(img);
    }
    box.appendChild(el("span", "sh-brand", p.brand));
    var st = strength(p.name);
    if (st) box.appendChild(el("span", "sh-big", st.big));
    box.appendChild(el("span", "sh-label-name", st ? st.rest : p.name));
    return box;
  };

  /* one product. Tapping its picture opens the detail view. */
  var card = function (p, compact) {
    var s = INV.status(p);
    var c = el("article", "sh-card sh-" + (BRAND_KEY[p.brand] || "x") + (s === "out" ? " is-out" : "") +
      (compact ? " sh-card--compact" : "") + (p.photo ? " sh-card--photo" : ""));
    var open = el("button", "sh-open");
    open.type = "button";
    open.setAttribute("aria-label", "See " + p.name + " details");
    open.appendChild(picture(p, "sh-label"));
    open.addEventListener("click", function () { showDetail(p, open); });
    c.appendChild(open);

    var body = el("div", "sh-body");
    body.appendChild(el(compact ? "h3" : "h4", "sh-name", p.name));
    body.appendChild(el("p", "sh-meta", p.size ? p.size : p.brand + " · " + p.cat));
    var foot = el("div", "sh-foot");
    foot.appendChild(el("span", "sh-price", money(p.price)));
    foot.appendChild(el("span", "sh-stock is-" + s, stockText(p)));
    body.appendChild(foot);
    body.appendChild(buyButton(p, compact));
    c.appendChild(body);
    return c;
  };

  /* ── the detail view: a sheet from the bottom on phones, a panel on desktop ── */
  var sheet = null, lastOpener = null;
  var buildSheet = function () {
    sheet = el("dialog", "pd");
    sheet.setAttribute("aria-labelledby", "pd-name");
    sheet.innerHTML =
      '<div class="pd-inner">' +
        '<button class="pd-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="pd-pic"></div>' +
        '<div class="pd-info">' +
          '<p class="pd-brand"></p>' +
          '<h2 class="pd-name" id="pd-name"></h2>' +
          '<p class="pd-size"></p>' +
          '<p class="pd-about"></p>' +
          '<div class="pd-buy"><span class="pd-price"></span><span class="pd-stock"></span></div>' +
          '<div class="pd-action"></div>' +
          '<ul class="pd-notes" role="list">' +
            '<li>Ships in a few days, or pick it up free at your next visit.</li>' +
            '<li>Not sure it suits your skin? <button class="linklike pd-ask" type="button">Ask Evelyn</button></li>' +
          '</ul>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.querySelector(".pd-close").addEventListener("click", function () { sheet.close(); });
    /* a tap on the dimmed backdrop closes it */
    sheet.addEventListener("click", function (e) { if (e.target === sheet) sheet.close(); });
    sheet.addEventListener("close", function () {
      document.documentElement.classList.remove("pd-open");
      if (lastOpener && document.contains(lastOpener)) lastOpener.focus();
    });
    /* adding to the cart opens the cart: the sheet steps aside */
    sheet.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".add-to-cart")) sheet.close();
    }, true);
  };
  var showDetail = function (p, opener) {
    if (!sheet) buildSheet();
    lastOpener = opener || null;
    var s = INV.status(p);
    var pic = sheet.querySelector(".pd-pic");
    pic.textContent = "";
    var big = picture(p, "sh-label pd-label sh-" + (BRAND_KEY[p.brand] || "x"));
    var bigImg = big.querySelector("img");
    if (bigImg) { bigImg.loading = "eager"; bigImg.alt = p.name + " by " + p.brand; }
    pic.appendChild(big);
    sheet.querySelector(".pd-brand").textContent = p.brand + " · " + p.cat;
    sheet.querySelector(".pd-name").textContent = p.name;
    var size = sheet.querySelector(".pd-size");
    size.textContent = p.size || "";
    size.hidden = !p.size;
    var about = sheet.querySelector(".pd-about");
    about.textContent = p.about || "";
    about.hidden = !p.about;
    sheet.querySelector(".pd-price").textContent = money(p.price);
    var st = sheet.querySelector(".pd-stock");
    st.textContent = stockText(p);
    st.className = "pd-stock sh-stock is-" + s;
    var act = sheet.querySelector(".pd-action");
    act.textContent = "";
    var b = buyButton(p, false);
    if (b.classList.contains("sh-request")) b.addEventListener("click", function () { sheet.close(); });
    act.appendChild(b);
    sheet.querySelector(".pd-ask").onclick = function () {
      sheet.close();
      var form = document.querySelector(".contact-form");
      var msg = form && form.querySelector("#ct-msg");
      var topic = form && form.querySelector("#ct-topic");
      if (topic) topic.value = "skin";
      if (msg) msg.value = "Is the " + p.name + " (" + p.brand + ") right for my skin? ";
      var target = document.getElementById("contact");
      if (target) target.scrollIntoView({ block: "start" });
      if (msg) setTimeout(function () { msg.focus({ preventScroll: true }); }, 200);
    };
    document.documentElement.classList.add("pd-open");
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
    sheet.querySelector(".pd-close").focus();
  };

  /* the cart and checkout show each product's photo (js/cart.js) */
  window.LumevinaShop = {
    photo: function (cartId) { var p = INV.get(cartId); return p && p.photo ? p.photo : null; },
    show: function (id) { var p = INV.get(id); if (p) showDetail(p); }
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

  /* ── the shop, in sections like a routine: cleanse, tone, treat,
     moisturize, protect. Type buttons jump to a section; brand, search
     and "in stock now" narrow every section at once. ── */
  var grid = document.getElementById("retail-grid");
  var shop = document.getElementById("shop");
  var q = document.getElementById("sh-q");
  var brandsEl = shop && shop.querySelector(".sh-brands");
  var catsEl = shop && shop.querySelector(".sh-cats");
  var inStock = document.getElementById("sh-instock");
  var countEl = shop && shop.querySelector(".sh-count");
  var state = { brand: "", q: "", inStock: false };
  var secId = function (c) { return "shop-" + c.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""); };

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
  };
  /* the type buttons: one per section that has something in it right now */
  var paintCats = function (groups) {
    if (!catsEl) return;
    catsEl.textContent = "";
    groups.forEach(function (g) {
      var b = chip(g.cat, g.cat, "jump", g.items.length);
      b.setAttribute("aria-controls", secId(g.cat));
      catsEl.appendChild(b);
    });
  };
  var paintChips = function () {
    if (!brandsEl) return;
    brandsEl.querySelectorAll(".sh-chip").forEach(function (b) {
      b.setAttribute("aria-pressed", String(state.brand === b.dataset.value));
    });
  };

  var matches = function (p) {
    if (state.brand && p.brand !== state.brand) return false;
    if (state.inStock && !(INV.status(p) === "in" || INV.status(p) === "low")) return false;
    if (state.q) {
      var hay = (p.name + " " + (p.inv || "") + " " + p.brand + " " + p.cat + " " + (p.about || "")).toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
    }
    return true;
  };

  var paintGrid = function () {
    if (!grid) return;
    var list = sorted(INV.live().filter(matches));
    var groups = INV.categories.map(function (c) {
      return { cat: c, items: list.filter(function (p) { return p.cat === c; }) };
    }).filter(function (g) { return g.items.length; });
    grid.textContent = "";
    groups.forEach(function (g) {
      var sec = el("section", "sh-sec");
      sec.id = secId(g.cat);
      sec.setAttribute("aria-labelledby", sec.id + "-h");
      var head = el("div", "sh-sec-head");
      var h = el("h3", "sh-sec-title", g.cat === "More" ? "More from the shelf" : g.cat);
      h.id = sec.id + "-h";
      head.appendChild(h);
      var inHere = g.items.filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }).length;
      head.appendChild(el("span", "sh-sec-n", g.items.length + (g.items.length === 1 ? " product" : " products") +
        (inHere ? " · " + inHere + " in stock" : "")));
      sec.appendChild(head);
      var row = el("ul", "sh-row");
      row.setAttribute("role", "list");
      g.items.forEach(function (p) { var li = el("li"); li.appendChild(card(p)); row.appendChild(li); });
      sec.appendChild(row);
      grid.appendChild(sec);
    });
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
    paintCats(groups);
    var inNow = list.filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }).length;
    if (countEl) countEl.textContent = list.length + (list.length === 1 ? " product" : " products") +
      " · " + inNow + " on the shelf now";
  };

  var calm = matchMedia("(prefers-reduced-motion: reduce)");
  var jump = function (cat) {
    var target = document.getElementById(secId(cat));
    if (!target) return;
    target.scrollIntoView({ behavior: calm.matches ? "auto" : "smooth", block: "start" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  if (shop) {
    shop.addEventListener("click", function (e) {
      var b = e.target.closest(".sh-chip");
      if (!b || !shop.contains(b) || b.closest(".bkl")) return;
      if (b.dataset.key === "jump") { jump(b.dataset.value); return; }
      if (b.dataset.key !== "brand") return;
      state.brand = b.dataset.value;
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

  /* links elsewhere on the page: <a href="#shop" data-shop-brand="Face Reality">
     or data-shop-cat="Sun care" */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-shop-brand], [data-shop-cat]");
    if (!a) return;
    state.brand = a.getAttribute("data-shop-brand") || "";
    paintChips();
    paintGrid();
    var cat = a.getAttribute("data-shop-cat");
    if (cat) { e.preventDefault(); setTimeout(function () { jump(cat); }, 0); }
  });

  var paintAll = function () { buildChips(); paintChips(); paintGrid(); paintRail(); };
  INV.onChange(paintAll);
  if (shop) shop.classList.add("is-live");
  paintAll();
})();

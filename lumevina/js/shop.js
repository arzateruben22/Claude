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
  var countEls = shop ? shop.querySelectorAll(".sh-count") : [];
  var state = { brand: "", q: "", inStock: false };
  var calm = matchMedia("(prefers-reduced-motion: reduce)");
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

  /* brands: one segmented control; a black thumb slides to the one chosen */
  var thumb = null;
  var buildChips = function () {
    if (!brandsEl) return;
    var list = INV.live();
    brandsEl.textContent = "";
    thumb = el("span", "sh-seg-thumb");
    thumb.setAttribute("aria-hidden", "true");
    brandsEl.appendChild(thumb);
    var tab = function (label, value, n) {
      var b = el("button", "sh-brand-tab");
      b.type = "button";
      b.dataset.key = "brand";
      b.dataset.value = value;
      b.appendChild(document.createTextNode(label));
      b.appendChild(el("span", "sh-brand-n", String(n)));
      return b;
    };
    brandsEl.appendChild(tab("All brands", "", list.length));
    INV.brands.forEach(function (b) {
      var n = list.filter(function (p) { return p.brand === b; }).length;
      if (n) brandsEl.appendChild(tab(b, b, n));
    });
  };
  var paintChips = function () {
    if (!brandsEl) return;
    var on = null;
    brandsEl.querySelectorAll(".sh-brand-tab").forEach(function (b) {
      var is = state.brand === b.dataset.value;
      b.setAttribute("aria-pressed", String(is));
      if (is) on = b;
    });
    slide(thumb, on, brandsEl);
  };
  /* move an indicator (the brand thumb, the type underline) under a button,
     and keep that button in view inside its row without moving the page */
  var slide = function (bar, on, row) {
    if (!bar || !on) return;
    bar.style.width = on.offsetWidth + "px";
    bar.style.transform = "translateX(" + on.offsetLeft + "px)";
    bar.classList.add("is-set");
    if (row.scrollWidth > row.clientWidth + 1) {
      var left = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: calm.matches ? "auto" : "smooth" });
    }
  };

  /* ── types of product: text tabs with a sliding underline, in routine
     order (cleanse → protect, then the extras). The section on screen is
     underlined as the shop scrolls by. ── */
  var EXTRAS = ["Masks", "Supplements", "More"];
  var activeCat = null, bar = null;
  var paintCats = function (groups) {
    if (!catsEl) return;
    catsEl.textContent = "";
    bar = el("span", "sh-tabs-bar");
    bar.setAttribute("aria-hidden", "true");
    var sep = false;
    groups.forEach(function (g) {
      if (!sep && EXTRAS.indexOf(g.cat) !== -1 && catsEl.children.length) {
        var line = el("span", "sh-tabs-sep");
        line.setAttribute("aria-hidden", "true");
        catsEl.appendChild(line);
        sep = true;
      }
      var b = el("button", "sh-tab");
      b.type = "button";
      b.dataset.key = "jump";
      b.dataset.value = g.cat;
      b.setAttribute("aria-controls", secId(g.cat));
      b.appendChild(document.createTextNode(g.cat === "More" ? "More" : g.cat));
      var n = el("span", "sh-tab-n", String(g.items.length));
      n.setAttribute("aria-label", g.items.length + (g.items.length === 1 ? " product" : " products"));
      b.appendChild(n);
      catsEl.appendChild(b);
    });
    catsEl.appendChild(bar);
    if (!groups.some(function (g) { return g.cat === activeCat; })) activeCat = groups.length ? groups[0].cat : null;
    paintActive(false);
    watchSections();
  };
  /* the open tab follows the section on screen */
  var paintActive = function (scrollBar) {
    if (!catsEl) return;
    var on = null;
    catsEl.querySelectorAll(".sh-tab").forEach(function (b) {
      var is = b.dataset.value === activeCat;
      b.classList.toggle("is-active", is);
      b.setAttribute("aria-current", is ? "true" : "false");
      if (is) on = b;
    });
    if (scrollBar === false) { if (bar && on) { bar.style.width = on.offsetWidth + "px"; bar.style.transform = "translateX(" + on.offsetLeft + "px)"; bar.classList.add("is-set"); } }
    else slide(bar, on, catsEl);
  };
  var spy = null, jumping = 0;
  var watchSections = function () {
    if (!window.IntersectionObserver || !grid) return;
    if (spy) spy.disconnect();
    spy = new IntersectionObserver(function (entries) {
      if (Date.now() < jumping) return;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var cat = en.target.getAttribute("data-cat");
        if (cat && cat !== activeCat) { activeCat = cat; paintActive(); }
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    grid.querySelectorAll(".sh-sec").forEach(function (sec) { spy.observe(sec); });
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
      sec.setAttribute("data-cat", g.cat);
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
    var line = list.length + (list.length === 1 ? " product" : " products") + " · " + inNow + " on the shelf now";
    for (var ci = 0; ci < countEls.length; ci++) countEls[ci].textContent = line;
  };

  var jump = function (cat) {
    var target = document.getElementById(secId(cat));
    if (!target) return;
    activeCat = cat;
    jumping = Date.now() + 900;
    paintActive();
    target.scrollIntoView({ behavior: calm.matches ? "auto" : "smooth", block: "start" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  if (shop) {
    shop.addEventListener("click", function (e) {
      var b = e.target.closest(".sh-brand-tab, .sh-tab");
      if (!b || !shop.contains(b)) return;
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
  /* the type bar gets its linen band only once it sticks under the header */
  var nav = shop && shop.querySelector(".sh-nav");
  if (nav) {
    var stuckTick = false;
    var checkStuck = function () {
      stuckTick = false;
      var top = parseFloat(getComputedStyle(nav).top) || 0;
      nav.classList.toggle("is-stuck", nav.getBoundingClientRect().top <= top + 1 && shop.getBoundingClientRect().bottom > top + nav.offsetHeight);
    };
    window.addEventListener("scroll", function () { if (!stuckTick) { stuckTick = true; requestAnimationFrame(checkStuck); } }, { passive: true });
    checkStuck();
  }
  /* the indicators follow their buttons when the width or the font changes */
  var reslide = function () { paintChips(); paintActive(false); };
  var rt = null;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(reslide, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reslide);

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

/* Lumevina — the shop
 *
 * The front of the website: Evelyn's professional skincare, from her
 * product guide (js/catalog.js) with the shelf's live stock
 * (js/inventory.js).
 *
 *   Hero shelf   what's on the shelf right now, one tap to add
 *   The shop     search, brand and category, "in stock now", and every
 *                type of product on its own floating shelf: the products
 *                stand on it (their photos cut out, js/shelf-art.js), with
 *                each one's name, price, stock and button under the shelf
 *   The page     tap a product and it leaves its place on the shelf for
 *                the left of its own page; drag it to tilt it under the
 *                light. "Shelf", Back or Escape puts it back in its spot.
 *
 * Out of stock is never a dead end: "Request it" fills in the Contact
 * form with that product, so Evelyn can order it in.
 *
 * A product without a photo shows its label instead: the brand, the name,
 * and a strength like "11%" set large, which is how clients tell the
 * mandelic serums apart.
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
    var CS = window.LumevinaConsult;
    /* an active Evelyn checks first: "Needs a quick consult" until she approves this client's email */
    if (p.consult && CS && !CS.approved(p.id) && (s === "in" || s === "low")) {
      var w = CS.waiting(p.id);
      var g = el("button", "btn btn-ghost sh-consult" + (w ? " is-waiting" : ""));
      g.type = "button";
      g.textContent = w ? "Waiting on Evelyn" : compact ? "Consult first" : "Needs a quick consult";
      g.setAttribute("aria-label", (w ? "Evelyn is reviewing " : "Ask Evelyn about ") + p.name);
      g.addEventListener("click", function () { CS.open(p); });
      return g;
    }
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

  /* the shelf pictures: each product photo cut out of its studio background
     (scripts/shelf-art.py → js/shelf-art.js), so the product stands on the shelf */
  var ART = window.LUMEVINA_SHELF_ART || {};
  var artOf = function (p) { return (p && p.photo && ART[p.photo]) || null; };
  var mlOf = function (p) {
    var ml = /([\d.]+)\s*ml/i.exec(p.size || ""), oz = /([\d.]+)\s*(?:fl\.?\s*)?oz/i.exec(p.size || "");
    return ml ? Number(ml[1]) : oz ? Number(oz[1]) * 29.57 : 0;
  };
  /* how tall it stands, from the size on its label: a 10 ml eye cream about
     two thirds as tall as an 8 fl oz cleanser; softgels and patches in between */
  var standK = function (p) {
    var ml = mlOf(p);
    if (!ml) return 0.86;
    return 0.64 + 0.36 * Math.max(0, Math.min(1, Math.log(ml / 10) / Math.log(236 / 10)));
  };
  /* the same product in another size (the 2 and 6 fl oz toner, the 2 and 6 fl oz gel cleanser):
     their photos differ only by the size at the end of the name */
  var sizeKey = function (p) { return p.photo ? p.photo.replace(/-\d+oz(?=\.webp$)/, "") : "id:" + p.id; };
  var sizesOf = function (p) {
    var k = sizeKey(p);
    var list = shelf().filter(function (x) { return x.brand === p.brand && sizeKey(x) === k; });
    return list.length > 1 ? list.sort(function (a, b) { return mlOf(a) - mlOf(b); }) : [];
  };

  /* the product's picture: its shelf picture or photo, or its label when there's no photo */
  var picture = function (p, cls) {
    var art = artOf(p);
    var box = el("span", cls + (p.photo ? " has-photo" : "") + (art ? " has-cut" : ""));
    if (p.photo) {
      var img = el("img");
      img.src = art ? art.src : p.photo; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      img.width = art ? art.w : 1000; img.height = art ? art.h : 1000;
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

  /* ── the product's page. The product leaves its place on the shelf for the
     left of the page (the spot on the shelf stays empty) and sways once under
     the light; drag it and it tilts with you, let go and it carries your speed
     back to facing front. "Shelf", Back or Escape flies it home. The motion is
     critically damped springs, the same both ways; with reduced motion, a
     cross-fade. A product opened from search, a link or the chat simply fades in. ── */
  var sheet = null, lastOpener = null, current = null, hidden = null, closing = false;
  var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  var tilt = { x: 0, raf: 0, drag: null };
  var q$ = function (s) { return sheet.querySelector(s); };
  /* the product on the shelf, if it's there to fly to or from */
  var onShelf = function (id) {
    var img = document.querySelector('.sf-prod[data-id="' + id + '"] .sf-art');
    if (!img) return null;
    var r = img.getBoundingClientRect();
    return r.width && r.bottom > 0 && r.top < window.innerHeight ? img : null;
  };
  var hideOnShelf = function (img) {
    if (hidden && hidden !== img) hidden.style.visibility = "";
    hidden = img || null;
    if (hidden) hidden.style.visibility = "hidden";
  };
  /* the picture as big as the stage allows, keeping its shape */
  var fitArt = function () {
    if (!sheet || !current || !current.art) return;
    var stand = q$(".pp-stand"), box = q$(".pp-art");
    var w = stand.clientWidth * 0.92, h = stand.clientHeight, ratio = current.art.w / current.art.h;
    var hh = Math.min(h, w / ratio);
    box.style.height = Math.round(hh) + "px";
    box.style.width = Math.round(hh * ratio) + "px";
  };
  var setTilt = function (x) {
    x = Math.max(-40, Math.min(40, x));
    tilt.x = x;
    q$(".pp-stand").style.transform = x ? "rotateY(" + x.toFixed(2) + "deg)" : "";
    var g = q$(".pp-gloss");
    g.style.setProperty("--g", (x / 30).toFixed(3));
    g.style.opacity = Math.min(1, Math.abs(x) / 12).toFixed(3);
  };
  /* a critically damped spring home to facing front, from where it is, at the speed it was given */
  var settle = function (v0) {
    cancelAnimationFrame(tilt.raf);
    var w = 7.5, x0 = tilt.x, v = v0 || 0, t0 = 0;
    var step = function (now) {
      if (!t0) t0 = now;
      var t = (now - t0) / 1000, x = (x0 + (v + w * x0) * t) * Math.exp(-w * t);
      if (t > 0.25 && Math.abs(x) < 0.04) { setTilt(0); return; }
      setTilt(x);
      tilt.raf = requestAnimationFrame(step);
    };
    tilt.raf = requestAnimationFrame(step);
  };
  var stopTilt = function () { cancelAnimationFrame(tilt.raf); tilt.drag = null; if (sheet) setTilt(0); };

  var buildSheet = function () {
    sheet = el("dialog", "pp");
    sheet.setAttribute("aria-labelledby", "pd-name");
    sheet.innerHTML =
      '<div class="pp-bg" aria-hidden="true"></div>' +
      '<div class="pp-page">' +
        '<div class="pp-stage">' +
          '<div class="pp-stand">' +
            '<div class="pp-art"><img class="pp-img" alt="" draggable="false"><span class="pp-gloss" aria-hidden="true"></span></div>' +
            '<div class="pp-label"></div>' +
          '</div>' +
          '<div class="pp-surface" aria-hidden="true"></div>' +
          '<p class="pp-hint" aria-hidden="true">Drag to tilt</p>' +
        '</div>' +
        '<div class="pp-info">' +
          '<button class="pp-back" type="button"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Shelf</button>' +
          '<p class="pd-brand"></p>' +
          '<h2 class="pd-name" id="pd-name"></h2>' +
          '<p class="pd-size"></p>' +
          '<div class="pp-sizes" role="group" aria-label="Size"></div>' +
          '<p class="pd-about"></p>' +
          '<div class="pd-buy"><span class="pd-price"></span><span class="pd-stock"></span></div>' +
          '<div class="pd-action"></div>' +
          '<ul class="pd-notes" role="list">' +
            '<li class="pd-consult" hidden>Evelyn checks this one with you first: a two-minute note about your skin, and she unlocks it for you, usually within a day.</li>' +
            '<li class="pd-lesson" hidden>From Skin School: <a class="inline-link pd-lesson-link" href="school.html"></a></li>' +
            '<li>Ships in a few days, or pick it up free at your next visit.</li>' +
            '<li>Not sure it suits your skin? <button class="linklike pd-ask" type="button">Ask Evelyn</button></li>' +
          '</ul>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sheet);
    q$(".pp-back").addEventListener("click", function () { closeDetail(); });
    /* Escape flies it home too */
    sheet.addEventListener("cancel", function (e) { e.preventDefault(); closeDetail(); });
    sheet.addEventListener("close", function () {
      closing = false;
      stopTilt();
      sheet.getAnimations ? sheet.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }) : 0;
      hideOnShelf(null);
      document.documentElement.classList.remove("pd-open");
      /* back to the product it came from, unless something else took focus (the cart, opened by Add to cart) */
      var a = document.activeElement;
      if (lastOpener && document.contains(lastOpener) && (!a || a === document.body || sheet.contains(a))) lastOpener.focus({ preventScroll: true });
    });
    /* adding to the cart opens the cart: the page steps aside at once */
    sheet.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".add-to-cart")) closeDetail(true);
    }, true);
    /* drag to tilt: 1:1 while held, then the release speed carries it home */
    var stand = q$(".pp-stand");
    stand.addEventListener("pointerdown", function (e) {
      if (!current || !current.art || calm.matches || e.button > 0) return;
      cancelAnimationFrame(tilt.raf);
      try { stand.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      tilt.drag = { x: e.clientX, from: tilt.x, samples: [{ x: e.clientX, t: e.timeStamp }] };
    });
    stand.addEventListener("pointermove", function (e) {
      var d = tilt.drag;
      if (!d) return;
      setTilt(d.from + (e.clientX - d.x) * 0.22);
      d.samples.push({ x: e.clientX, t: e.timeStamp });
      if (d.samples.length > 5) d.samples.shift();
    });
    var release = function () {
      var d = tilt.drag;
      tilt.drag = null;
      if (!d) return;
      var a = d.samples[0], b = d.samples[d.samples.length - 1];
      settle(b.t > a.t ? (b.x - a.x) / (b.t - a.t) * 1000 * 0.22 : 0);
    };
    stand.addEventListener("pointerup", release);
    stand.addEventListener("pointercancel", release);
    window.addEventListener("resize", function () { if (sheet.open) fitArt(); });
  };

  /* what the page says about p */
  var fill = function (p) {
    var s = INV.status(p), art = artOf(p);
    current = { p: p, art: art };
    var box = q$(".pp-art"), label = q$(".pp-label");
    box.hidden = !art;
    label.hidden = !!art;
    q$(".pp-hint").hidden = !art || calm.matches;
    if (art) {
      var img = q$(".pp-img");
      img.src = art.src; img.width = art.w; img.height = art.h;
      img.alt = p.name + " by " + p.brand;
      /* a full address: a relative one inside a custom property would resolve against the stylesheet */
      q$(".pp-gloss").style.setProperty("--art", 'url("' + new URL(art.src, document.baseURI).href + '")');
      fitArt();
    } else {
      label.textContent = "";
      label.appendChild(picture(p, "sh-label pd-label sh-" + (BRAND_KEY[p.brand] || "x")));
    }
    q$(".pd-brand").textContent = p.brand + " · " + p.cat;
    q$(".pd-name").textContent = p.name;
    /* two sizes of the same product: pick one here */
    var sizes = sizesOf(p), group = q$(".pp-sizes"), size = q$(".pd-size");
    group.textContent = "";
    group.hidden = !sizes.length;
    size.textContent = p.size || "";
    size.hidden = !p.size || sizes.length > 0;
    sizes.forEach(function (x) {
      var b = el("button", "pp-size");
      b.type = "button";
      b.setAttribute("aria-pressed", String(x.id === p.id));
      b.appendChild(el("span", "pp-size-k", (x.size || "").split(" / ")[0]));
      b.appendChild(el("span", "pp-size-p", money(x.price)));
      b.addEventListener("click", function () {
        if (x.id === current.p.id) return;
        fill(x);
        hideOnShelf(onShelf(x.id));
        if (!calm.matches && box.animate) box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
        q$('.pp-size[aria-pressed="true"]').focus();
      });
      group.appendChild(b);
    });
    var about = q$(".pd-about");
    about.textContent = p.about || "";
    about.hidden = !p.about;
    q$(".pd-price").textContent = money(p.price);
    var st = q$(".pd-stock");
    st.textContent = stockText(p);
    st.className = "pd-stock sh-stock is-" + s;
    var act = q$(".pd-action");
    act.textContent = "";
    var pc = q$(".pd-consult");
    if (pc) pc.hidden = !(p.consult && window.LumevinaConsult && !window.LumevinaConsult.approved(p.id));
    var b = buyButton(p, false);
    if (b.classList.contains("sh-request")) b.addEventListener("click", function () { closeDetail(true); }, true);
    act.appendChild(b);
    /* the lesson behind it (js/shop-lessons.js), only while Skin School is switched on */
    var pl = q$(".pd-lesson"), LS = window.LumevinaLessons, lesson = LS && LS.on() ? LS.for(p) : null;
    if (pl) { pl.hidden = !lesson; if (lesson) { var a = pl.querySelector(".pd-lesson-link"); a.textContent = lesson.title; a.href = lesson.href; } }
    q$(".pd-ask").onclick = function () {
      closeDetail(true);
      var form = document.querySelector(".contact-form");
      var msg = form && form.querySelector("#ct-msg");
      var topic = form && form.querySelector("#ct-topic");
      if (topic) topic.value = "skin";
      if (msg) msg.value = "Is the " + p.name + " (" + p.brand + ") right for my skin? ";
      var target = document.getElementById("contact");
      if (target) target.scrollIntoView({ block: "start" });
      if (msg) setTimeout(function () { msg.focus({ preventScroll: true }); }, 200);
    };
  };

  var showDetail = function (p, opener) {
    if (!sheet) buildSheet();
    if (sheet.open) { fill(p); hideOnShelf(onShelf(p.id)); return; }
    lastOpener = opener || null;
    closing = false;
    fill(p);
    document.documentElement.classList.add("pd-open");
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
    sheet.scrollTop = 0;
    fitArt();
    q$(".pp-back").focus({ preventScroll: true });
    if (calm.matches || !sheet.animate) return;
    var box = current.art ? q$(".pp-art") : q$(".pp-label");
    var from = current.art && opener && opener.classList && opener.classList.contains("sf-prod") ? onShelf(p.id) : null;
    q$(".pp-bg").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
    [q$(".pp-surface"), q$(".pp-hint")].forEach(function (n) { n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" }); });
    q$(".pp-info").animate([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }],
      { duration: 520, delay: 50, easing: EASE, fill: "backwards" });
    if (from) {
      var f = from.getBoundingClientRect(), t = box.getBoundingClientRect();
      hideOnShelf(from);
      box.animate([
        { transform: "translate(" + (f.left - t.left) + "px," + (f.top - t.top) + "px) scale(" + (f.width / t.width) + ")" },
        { transform: "none" }
      ], { duration: 560, easing: EASE });
    } else {
      box.animate([{ opacity: 0, transform: "translateY(16px) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 440, easing: EASE });
    }
    /* one sway as it lands, the light running across it */
    if (current.art) setTimeout(function () { if (sheet.open && !tilt.drag) { tilt.x = 0; settle(-260); } }, from ? 260 : 120);
  };

  /* back to its spot on the shelf; `now` (adding to the cart, asking Evelyn) skips the flight */
  var closeDetail = function (now) {
    if (!sheet || !sheet.open || closing) return;
    var to = !now && !calm.matches && sheet.animate && current && current.art ? onShelf(current.p.id) : null;
    if (!to) { sheet.close(); return; }
    closing = true;
    stopTilt();
    hideOnShelf(to);
    var box = q$(".pp-art"), f = box.getBoundingClientRect(), t = to.getBoundingClientRect();
    var fly = box.animate([
      { transform: "none" },
      { transform: "translate(" + (t.left - f.left) + "px," + (t.top - f.top) + "px) scale(" + (t.width / f.width) + ")" }
    ], { duration: 480, easing: EASE, fill: "forwards" });
    q$(".pp-bg").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease-in", fill: "forwards" });
    [q$(".pp-surface"), q$(".pp-hint")].forEach(function (n) { n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" }); });
    q$(".pp-info").animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }], { duration: 260, easing: "ease-in", fill: "forwards" });
    fly.onfinish = function () { if (sheet.open) sheet.close(); };
  };

  /* the cart and checkout show each product's photo (js/cart.js) */
  window.LumevinaShop = {
    photo: function (cartId) { var p = INV.get(cartId); return p && p.photo ? p.photo : null; },
    show: function (id) { var p = INV.get(id); if (p) showDetail(p); }
  };

  /* the shelf: every live product that is a product (the online consult is a service, shown above the shelf) */
  var shelf = function () { return INV.live().filter(function (p) { return p.kind !== "consult"; }); };

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
    var now = sorted(shelf()).filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }).slice(0, 8);
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
    var list = shelf();
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

  /* ── search in everyday words: "sunscreen" finds the SPFs, "pimple" the
     acne care, "wrinkles" the retinoids and peptides. Each group pairs the
     words clients type with words on her products (name, type, label). ── */
  var WORDS = [
    { say: ["sunscreen", "sun screen", "sunblock", "sun block", "sun", "spf", "uv", "uva", "uvb", "sunburn", "sun protection"], find: ["spf", "sunscreen", "sun care"], cat: "Sun care" },
    { say: ["cleanser", "cleanse", "cleansing", "face wash", "facewash", "wash", "soap", "makeup remover", "remover"], find: ["cleanser", "wash", "cleansing"], cat: "Cleansers" },
    { say: ["moisturizer", "moisturiser", "moisturize", "moisturizing", "lotion", "cream", "hydrate", "hydrating", "hydration", "dry", "dryness", "dehydrated"], find: ["moistur", "cream", "hydra", "balm"], cat: "Moisturizers" },
    { say: ["toner", "tonic", "mist", "spray", "essence"], find: ["toner", "mist", "essence"], cat: "Toners & mists" },
    { say: ["serum", "ampoule", "booster"], find: ["serum", "essence"], cat: "Serums" },
    { say: ["acne", "pimple", "breakout", "zit", "blemish", "whitehead", "blackhead", "clogged", "spot treatment", "clear skin"], find: ["acne", "breakout", "spot", "sulfur", "benzoyl", "mandelic", "patch", "clear"], cat: "Acne & spot care" },
    { say: ["patch", "pimple patch", "sticker", "hydrocolloid"], find: ["patch"] },
    { say: ["eye", "under eye", "undereye", "dark circles", "puffy", "puffiness", "eye bags", "crows feet"], find: ["eye"], cat: "Eye care" },
    { say: ["anti aging", "anti-aging", "antiaging", "aging", "wrinkle", "fine lines", "lines", "firm", "firming", "lift", "lifting", "sagging", "collagen", "mature"], find: ["retin", "peptide", "firming", "nad", "renews", "stem cells"] },
    { say: ["retinol", "retinal", "retinoid", "retin a", "vitamin a"], find: ["retin"] },
    { say: ["dark spots", "dark spot", "hyperpigmentation", "pigmentation", "discoloration", "brighten", "brightening", "glow", "dull", "uneven", "even tone"], find: ["bright", "discoloration", "glowtone", "vitamin c", "mandelic"] },
    { say: ["exfoliate", "exfoliant", "exfoliating", "exfoliation", "peel", "aha", "acid", "scrub", "texture", "resurface"], find: ["mandelic", "glycolic", "exfoliat", "acid"] },
    { say: ["vitamin c", "vit c", "vitc", "ascorbic"], find: ["vitamin c"] },
    { say: ["sensitive", "redness", "red", "calm", "calming", "soothe", "soothing", "irritated", "irritation", "barrier", "gentle"], find: ["calm", "sooth", "barrier", "recovery", "gentle"] },
    { say: ["oily", "oil control", "shine", "shiny", "matte", "mattifying", "greasy"], find: ["balances oil", "matte"] },
    { say: ["mask", "masque", "sheet mask"], find: ["mask"], cat: "Masks" },
    { say: ["supplement", "vitamin", "vitamins", "pill", "pills", "omega", "softgel", "capsule"], find: ["supplement", "softgel", "omega"], cat: "Supplements" },
    { say: ["travel", "travel size", "mini", "small", "trial"], find: ["travel"] },
    { say: ["body", "back", "chest", "bacne"], find: ["body"] }
  ];
  var norm = function (t) { return String(t || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9%+.\s-]/g, " ").replace(/\s+/g, " ").trim(); };
  var hayOf = function (p) {
    if (p._hay) return p._hay;
    /* "Acne-safe" on a label isn't an acne product; the 2 fl oz sizes are the travel sizes */
    var about = (p.about || "").replace(/acne-safe/gi, "");
    return (p._hay = norm(p.name + " " + (p.inv || "") + " " + p.brand + " " + p.cat + " " + about + " " + (p.size || "") +
      (/travel|\(2 fl oz\)/i.test(p.name) ? " travel" : "")));
  };
  /* the query as terms: known phrases kept whole ("dark spots"), then words */
  var PHRASES = [];
  WORDS.forEach(function (g) { g.say.forEach(function (w) { if (w.indexOf(" ") !== -1) PHRASES.push(w); }); });
  PHRASES.sort(function (a, b) { return b.length - a.length; });
  var termsOf = function (raw) {
    var t = " " + norm(raw) + " ", out = [];
    PHRASES.forEach(function (ph) {
      if (t.indexOf(" " + ph + " ") !== -1) { out.push(ph); t = t.replace(" " + ph + " ", " "); }
    });
    return out.concat(t.trim() ? t.trim().split(" ") : []);
  };
  /* what a term can match: itself, plus the product words of any group it
     belongs to, also while it's still being typed ("sunsc") or plural */
  var cats = function (term) { return groupsOf(term).map(function (g) { return g.cat; }).filter(Boolean); };
  var groupsOf = function (term) {
    /* the word as typed, and its singular: "wrinkles" → "wrinkle", "patches" → "patch" */
    var forms = [term];
    if (term.length > 3 && term.indexOf(" ") === -1) {
      if (/s$/.test(term)) forms.push(term.slice(0, -1));
      if (/es$/.test(term)) forms.push(term.slice(0, -2));
    }
    return WORDS.filter(function (g) {
      return g.say.some(function (w) {
        if (forms.indexOf(w) !== -1) return true;
        /* still typing: "sunsc" → "sunscreen" */
        if (term.length >= 3 && w.indexOf(term) === 0) return true;
        /* a longer form of one word: "moisturizers", "exfoliating" */
        return term.indexOf(" ") === -1 && w.indexOf(" ") === -1 && w.length >= 4 &&
          forms.some(function (f) { return f.indexOf(w) === 0 && f.length - w.length <= 3; });
      });
    });
  };
  var alts = function (term) {
    var out = [term];
    groupsOf(term).forEach(function (g) { out = out.concat(g.find); });
    if (/s$/.test(term) && term.length > 3) out.push(term.slice(0, -1));
    return out;
  };
  /* how well a product answers the search: 0 = not at all. Every term has to
     match something; a match in the name counts most. */
  var score = function (p, query) {
    var terms = termsOf(query);
    if (!terms.length) return 1;
    var hay = hayOf(p), name = norm(p.name), total = 0;
    for (var i = 0; i < terms.length; i++) {
      var a = alts(terms[i]), best = 0;
      /* the type of product the word means ("sunscreen" → Sun care) comes first */
      if (cats(terms[i]).indexOf(p.cat) !== -1) best = 5;
      for (var j = 0; j < a.length; j++) {
        if (name.indexOf(a[j]) !== -1) best = Math.max(best, j === 0 ? 4 : 3);
        else if (hay.indexOf(a[j]) !== -1) best = Math.max(best, j === 0 ? 2 : 1);
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  };

  var matches = function (p) {
    if (state.brand && p.brand !== state.brand) return false;
    if (state.inStock && !(INV.status(p) === "in" || INV.status(p) === "low")) return false;
    if (state.q) return score(p, state.q) > 0;
    return true;
  };

  /* ── the shelves: each type of product on its own floating shelf, the
     products standing on it, each one's name, price, stock and button under
     it. Phones: one long shelf per type to swipe along; wider: rows of 3 to 5. ── */
  var MQ_PHONE = matchMedia("(max-width: 600px)"), MQ_MID = matchMedia("(min-width: 800px)"), MQ_WIDE = matchMedia("(min-width: 1100px)");
  var perShelf = function () { return MQ_PHONE.matches ? 0 : MQ_WIDE.matches ? 5 : MQ_MID.matches ? 4 : 3; };
  var shelfItem = function (p) {
    var s = INV.status(p), art = artOf(p);
    var li = el("li", "sf-item sh-" + (BRAND_KEY[p.brand] || "x") + (s === "out" ? " is-out" : ""));
    var stage = el("div", "sf-stage");
    var b = el("button", "sf-prod");
    b.type = "button";
    b.dataset.id = p.id;
    b.setAttribute("aria-label", p.name + ", " + p.brand + ", " + money(p.price) + ". See details");
    if (art) {
      var img = el("img", "sf-art");
      img.src = art.src; img.width = art.w; img.height = art.h;
      img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.draggable = false;
      b.style.setProperty("--k", standK(p).toFixed(3));
      b.appendChild(img);
    } else {
      b.classList.add("sf-prod--label");
      b.appendChild(picture(p, "sh-label sf-label"));
    }
    b.addEventListener("click", function () { showDetail(p, b); });
    stage.appendChild(b);
    li.appendChild(stage);
    var tag = el("div", "sf-tag");
    tag.appendChild(el("h4", "sf-name", p.name));
    tag.appendChild(el("p", "sf-meta", p.size ? p.size.split(" / ")[0] : p.brand));
    var line = el("p", "sf-line");
    line.appendChild(el("span", "sh-price", money(p.price)));
    line.appendChild(el("span", "sh-stock is-" + s, stockText(p)));
    tag.appendChild(line);
    tag.appendChild(buyButton(p, true));
    li.appendChild(tag);
    return li;
  };
  var shelves = function (items) {
    var n = perShelf(), wrap = el("div", "sf" + (n ? "" : " sf--swipe")), rows = [];
    if (!n) rows.push(items);
    else for (var i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
    rows.forEach(function (row) {
      var ul = el("ul", "sf-shelf");
      ul.setAttribute("role", "list");
      if (n) ul.style.setProperty("--cols", n);
      row.forEach(function (p) { ul.appendChild(shelfItem(p)); });
      /* a short row: the shelf still runs the full width */
      for (var k = row.length; n && k < n; k++) {
        var gap = el("li", "sf-item sf-item--empty");
        gap.setAttribute("aria-hidden", "true");
        gap.appendChild(el("div", "sf-stage"));
        ul.appendChild(gap);
      }
      wrap.appendChild(ul);
    });
    return wrap;
  };

  var paintGrid = function () {
    if (!grid) return;
    var list = sorted(shelf().filter(matches));
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
      sec.appendChild(shelves(g.items));
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
    /* ── suggestions that pop up under the search bar as you type: the
       closest products (photo, name, price), tap one to open it; Enter
       shows them all in the shop below ── */
    var box = q.closest(".sh-search");
    var pop = el("div", "sh-suggest");
    pop.id = "sh-suggest";
    pop.setAttribute("role", "listbox");
    pop.setAttribute("aria-label", "Suggestions");
    pop.hidden = true;
    box.appendChild(pop);
    q.setAttribute("role", "combobox");
    q.setAttribute("aria-autocomplete", "list");
    q.setAttribute("aria-controls", "sh-suggest");
    q.setAttribute("aria-expanded", "false");
    var picks = [], active = -1;
    var closePop = function () { pop.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); active = -1; };
    var showAll = function () {
      closePop();
      state.q = q.value.trim(); paintGrid();
      var target = document.getElementById("retail-grid");
      if (target) target.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
    };
    var mark = function (i) {
      active = i;
      pop.querySelectorAll(".sh-sg-item").forEach(function (o, n) { o.setAttribute("aria-selected", String(n === i)); });
      if (i >= 0) q.setAttribute("aria-activedescendant", "sh-sg-" + i); else q.removeAttribute("aria-activedescendant");
    };
    var paintPop = function () {
      var query = q.value.trim();
      if (norm(query).length < 2) { closePop(); return; }
      var ranked = shelf().map(function (p) { return { p: p, s: score(p, query) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return (b.s - a.s) || (STATUS_ORDER[INV.status(a.p)] - STATUS_ORDER[INV.status(b.p)]) || a.p.name.localeCompare(b.p.name); });
      picks = ranked.slice(0, 6).map(function (x) { return x.p; });
      pop.textContent = "";
      var head = el("p", "sh-sg-head", ranked.length
        ? ranked.length + (ranked.length === 1 ? " product" : " products") + " for “" + query + "”"
        : "Nothing on the shelf for “" + query + "” yet.");
      pop.appendChild(head);
      picks.forEach(function (p, i) {
        var o = el("button", "sh-sg-item");
        o.type = "button"; o.id = "sh-sg-" + i; o.tabIndex = -1;
        o.setAttribute("role", "option"); o.setAttribute("aria-selected", "false");
        var th = el("span", "sh-sg-thumb");
        if (p.photo) { var im = el("img"); im.src = p.photo; im.alt = ""; im.width = 44; im.height = 44; th.appendChild(im); }
        o.appendChild(th);
        var tx = el("span", "sh-sg-text");
        tx.appendChild(el("span", "sh-sg-name", p.name));
        tx.appendChild(el("span", "sh-sg-meta", p.brand + " · " + p.cat));
        o.appendChild(tx);
        var right = el("span", "sh-sg-right");
        right.appendChild(el("span", "sh-sg-price", money(p.price)));
        right.appendChild(el("span", "sh-sg-stock sh-stock is-" + INV.status(p), stockText(p)));
        o.appendChild(right);
        o.addEventListener("mousedown", function (e) { e.preventDefault(); });
        o.addEventListener("click", function () { closePop(); showDetail(p, q); });
        pop.appendChild(o);
      });
      var foot = el("button", "sh-sg-all", ranked.length > picks.length ? "See all " + ranked.length + " in the shop" : ranked.length ? "Show them in the shop" : "Ask Evelyn for it");
      foot.type = "button"; foot.tabIndex = -1;
      foot.addEventListener("mousedown", function (e) { e.preventDefault(); });
      foot.addEventListener("click", function () {
        if (ranked.length) showAll(); else { closePop(); request({ name: query, brand: "", price: 0 }); }
      });
      pop.appendChild(foot);
      pop.hidden = false;
      q.setAttribute("aria-expanded", "true");
      mark(-1);
    };
    q.addEventListener("input", function () {
      clearTimeout(t);
      paintPop();
      t = setTimeout(function () { state.q = q.value.trim(); paintGrid(); }, 160);
    });
    q.addEventListener("focus", function () { if (q.value.trim()) paintPop(); });
    q.addEventListener("blur", function () { setTimeout(closePop, 120); });
    q.addEventListener("keydown", function (e) {
      if (pop.hidden) { if (e.key === "Enter") { e.preventDefault(); showAll(); } return; }
      if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(picks.length - 1, active + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(-1, active - 1)); }
      else if (e.key === "Escape") { closePop(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (active >= 0 && picks[active]) { var pk = picks[active]; closePop(); showDetail(pk, q); } else showAll();
      }
    });
  }
  if (inStock) inStock.addEventListener("change", function () { state.inStock = inStock.checked; paintGrid(); });
  /* the type bar gets its linen band only once it sticks under the header.
     On phones it tucks away while you scroll down through the products and
     comes back as soon as you scroll up (or tap a type and land on it). */
  var nav = shop && shop.querySelector(".sh-nav");
  if (nav) {
    var stuckTick = false, lastY = window.scrollY;
    var phone = window.matchMedia("(max-width: 760px)");
    var checkStuck = function () {
      stuckTick = false;
      var top = parseFloat(getComputedStyle(nav).top) || 0;
      var stuck = nav.getBoundingClientRect().top <= top + 1 && shop.getBoundingClientRect().bottom > top + nav.offsetHeight;
      nav.classList.toggle("is-stuck", stuck);
      var y = window.scrollY, dy = y - lastY;
      if (!stuck || !phone.matches || Date.now() < jumping || nav.contains(document.activeElement)) nav.classList.remove("is-tucked");
      else if (dy > 6) nav.classList.add("is-tucked");
      else if (dy < -6) nav.classList.remove("is-tucked");
      if (Math.abs(dy) > 6) lastY = y;
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
  /* a phone turned sideways, a window resized past a breakpoint: the shelves re-stack */
  [MQ_PHONE, MQ_MID, MQ_WIDE].forEach(function (m) {
    var again = function () { paintGrid(); };
    if (m.addEventListener) m.addEventListener("change", again); else if (m.addListener) m.addListener(again);
  });
  INV.onChange(paintAll);
  /* Evelyn approved an active for this client: its button turns into Add to cart */
  document.addEventListener("lumevina:consult-changed", function () { paintGrid(); paintRail(); });
  /* the online consult card above the shelf: one tap puts it in the bag */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-consult-add]");
    if (!b || !window.LumevinaCart) return;
    var r = window.LumevinaCart.add("svc-online-consult");
    if (r.ok || r.reason === "max") window.LumevinaCart.open();
  });
  if (shop) shop.classList.add("is-live");
  paintAll();

  /* a product's own link (?product=<id>, the one the Google and Instagram
     feeds use: scripts/build-feed.mjs) opens its detail view on arrival */
  var wanted = (function () { try { return new URLSearchParams(location.search).get("product") || ""; } catch (e) { return ""; } })();
  if (wanted) {
    var target = INV.get(wanted);
    if (target && !target.hidden && !target.draft) setTimeout(function () { showDetail(target, null); }, 400);
  }
})();

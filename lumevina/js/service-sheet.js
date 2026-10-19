/* Lumevina — a service, in full
 *
 * Tapping a service (a featured card, or a line in Explore Every Service)
 * opens its details: Evelyn's full description from her GlossGenius page,
 * the time, any deposit, its options, and the same Book control the page
 * shows for it. On phones it rises from the bottom as a sheet, clear of the
 * top corners where an app's own buttons sit; on wider screens it's a
 * centered card. Data: js/services.js; the cards and lines carry
 * data-service (scripts/build-services.mjs).
 */
(function () {
  "use strict";

  var S = window.LUMEVINA_SERVICES;
  if (!S) return;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* a bookable service, an option of one, or a service with options */
  var find = function (id) {
    var hit = null;
    S.menu.forEach(function (g) {
      (g.subs || [{ items: g.items }]).forEach(function (sg) {
        sg.items.forEach(function (s) {
          if (s.id === id) hit = s;
          (s.options || []).forEach(function (o) { if (o.id === id) hit = s; });
        });
      });
    });
    return hit;
  };
  var money = function (n) { return "$" + Number(n).toLocaleString("en-US"); };
  var mins = function (m) { return m ? (m >= 60 ? Math.floor(m / 60) + " hr" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min") : ""; };

  /* the Book control already on the page for a service: a link to her
     GlossGenius page, or a button that opens the calendar (js/booking.js) */
  var pageControl = function (id) {
    return document.querySelector('.wax-row[data-service="' + id + '"] .wax-book, .wax-row[data-service="' + id + '"] .wax-ask, ' +
      '.wax-row[data-service="' + id + '"] .add-to-cart, .product-card[data-service="' + id + '"] .book-btn, .product-card[data-service="' + id + '"] .add-to-cart');
  };
  var bookFor = function (id, label, solid) {
    var orig = pageControl(id), el;
    if (orig && orig.tagName === "A") {
      el = document.createElement("a");
      el.href = orig.href; el.target = "_blank"; el.rel = "noopener";
    } else {
      el = document.createElement("button");
      el.type = "button";
      el.addEventListener("click", function () { close(true); if (orig) orig.click(); });
    }
    el.className = "btn " + (solid ? "btn-solid" : "btn-ghost") + " svc-book";
    el.textContent = orig && orig.classList.contains("wax-ask") ? "Message Evelyn" : label;
    if (el.tagName === "A") el.addEventListener("click", function () { close(true); });
    return el;
  };

  /* ── the sheet ── */
  var overlay = document.createElement("div");
  overlay.className = "svc-overlay";
  overlay.hidden = true;
  var sheet = document.createElement("div");
  sheet.className = "svc-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "svc-title");
  sheet.tabIndex = -1;
  sheet.hidden = true;
  sheet.innerHTML =
    '<button class="svc-x" type="button" aria-label="Close">×</button>' +
    '<div class="svc-scroll">' +
      '<div class="svc-photo" hidden><img alt="" decoding="async"></div>' +
      '<p class="svc-k"></p>' +
      '<h3 class="svc-title" id="svc-title"></h3>' +
      '<p class="svc-meta"></p>' +
      '<div class="svc-about"></div>' +
      '<ul class="svc-options" role="list" hidden></ul>' +
    "</div>" +
    '<div class="svc-foot"></div>';
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  var $ = function (sel) { return sheet.querySelector(sel); };

  var lastFocus = null, openId = null;
  var open = function (id, from) {
    var s = find(id);
    if (!s) return;
    openId = id;
    lastFocus = from || document.activeElement;
    var opts = s.options || null;
    var photo = document.querySelector('.product-card[data-service="' + s.id + '"] .product-visual img');
    $(".svc-photo").hidden = !photo;
    if (photo) $(".svc-photo img").src = photo.currentSrc || photo.src;
    $(".svc-k").textContent = [s.sectorName, s.sub].filter(Boolean).join(" · ") + (s.note ? " · " + s.note : "");
    $(".svc-title").textContent = s.name;
    var meta = opts ? ["from " + money(Math.min.apply(null, opts.map(function (o) { return o.price; })))]
      : [(s.from ? "from " : "") + money(s.price), mins(s.min)];
    if (s.deposit) meta.push(money(s.deposit) + " deposit when you book");
    else if (!s.ask && !s.addon) meta.push("Nothing due until your visit");
    if (s.ask) meta.push("Message Evelyn first");
    if (s.addon) meta.push("Added to another service");
    $(".svc-meta").textContent = meta.filter(Boolean).join(" · ");
    var about = $(".svc-about");
    about.textContent = "";
    String(s.about || s.desc || "").split(/\n+/).filter(Boolean).forEach(function (para) {
      var p = document.createElement("p");
      p.textContent = para;
      about.appendChild(p);
    });
    var list = $(".svc-options"), foot = $(".svc-foot");
    list.textContent = ""; foot.textContent = "";
    list.hidden = !opts;
    if (opts) {
      opts.forEach(function (o) {
        var li = document.createElement("li");
        li.className = "svc-option" + (o.id === id ? " is-picked" : "");
        var t = document.createElement("span");
        t.className = "svc-option-t";
        t.innerHTML = "<strong></strong><small></small>";
        t.querySelector("strong").textContent = o.short || o.name;
        t.querySelector("small").textContent = [(o.from ? "from " : "") + money(o.price), mins(o.min)].filter(Boolean).join(" · ");
        li.appendChild(t);
        li.appendChild(bookFor(o.id, "Book", o.id === id || (id === s.id && o === opts[0])));
        list.appendChild(li);
      });
    } else {
      foot.appendChild(bookFor(s.id, "Book " + s.name, true));
    }
    var keep = document.createElement("button");
    keep.type = "button";
    keep.className = "svc-keep";
    keep.textContent = "Keep looking";
    keep.addEventListener("click", function () { close(); });
    foot.appendChild(keep);

    overlay.hidden = false;
    sheet.hidden = false;
    $(".svc-scroll").scrollTop = 0;
    document.documentElement.classList.add("svc-open");
    requestAnimationFrame(function () { sheet.classList.add("show"); overlay.classList.add("show"); });
    sheet.focus({ preventScroll: true });   /* Tab then moves through the sheet; Escape closes it */
  };
  var close = function (moving) {
    if (sheet.hidden) return;
    openId = null;
    sheet.classList.remove("show");
    overlay.classList.remove("show");
    document.documentElement.classList.remove("svc-open");
    setTimeout(function () { sheet.hidden = true; overlay.hidden = true; }, calm ? 0 : 280);
    if (!moving && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };

  $(".svc-x").addEventListener("click", function () { close(); });
  overlay.addEventListener("click", function () { close(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.hidden) close();
    if (e.key === "Tab" && !sheet.hidden) {            /* keep focus inside the sheet */
      var f = sheet.querySelectorAll("button, a[href]");
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* what opens it: a featured card (anywhere but its own controls), or a menu line's name */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest || t.closest(".svc-sheet")) return;
    var opener = t.closest(".svc-open");
    if (!opener) {
      if (t.closest("a, button, input, select, textarea")) return;
      opener = t.closest(".product-card[data-service], .wax-row[data-service] .wax-item");
    }
    var row = opener && opener.closest("[data-service]");
    if (!row) return;
    e.preventDefault();
    open(row.getAttribute("data-service"), opener);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("wax-item")) {
      e.preventDefault();
      open(e.target.closest("[data-service]").getAttribute("data-service"), e.target);
    }
  });

  window.LumevinaServiceSheet = { open: open, close: close };
})();

/* Lumevina — treatments drawer
   A slide-over panel that renders the whole service menu from
   js/catalog.js. Browse every category in-page (no navigation),
   and Book / Gift buttons fire `lumevina:book` / `lumevina:gift`
   CustomEvents on document — the seam the real booking engine
   (lumevina/js/booking.js) plugs into. Vanilla, accessible,
   reduced-motion safe. */

(function () {
  "use strict";

  var cat = window.LumevinaCatalog;
  if (!cat || !cat.categories) return;

  var CUR = cat.currency || "$";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* category tab icons (match the landing-page line-icons) */
  var ICONS = {
    facial: '<path d="M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11Z"/><path d="M14.5 15a2.6 2.6 0 0 1-2.5 2.4"/>',
    peel: '<path d="M4 11l8-4 8 4-8 4-8-4Z"/><path d="M4 15l8 4 8-4"/>',
    acne: '<circle cx="12" cy="12" r="7.5"/><path d="M8.5 12l2.2 2.2L15.5 9.5"/>',
    wax: '<path d="M3 9c3-3 5 3 8 0s5-3 8 0"/><path d="M3 15c3-3 5 3 8 0s5-3 8 0"/>',
    consult: '<path d="M20 14a3 3 0 0 1-3 3H9l-4 3V8a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3Z"/>',
    gift: '<rect x="4.5" y="9.5" width="15" height="10" rx="1.5"/><path d="M4.5 13h15M12 9.5v10M8.6 9.5C6.8 9.5 6.3 5.5 9 5.5s3 4 3 4M15.4 9.5C17.2 9.5 17.7 5.5 15 5.5s-3 4-3 4"/>'
  };
  var svgIcon = function (name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || ICONS.facial) + '</svg>';
  };

  /* ── build DOM once ── */
  var backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  backdrop.hidden = true;

  var panel = document.createElement("aside");
  panel.className = "drawer";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Treatments menu");
  panel.hidden = true;
  panel.innerHTML =
    '<div class="drawer-head">' +
      '<div><p class="drawer-eyebrow">The full menu</p><h2 class="drawer-title">Treatments</h2></div>' +
      '<button class="drawer-close" type="button" aria-label="Close menu">&#10005;</button>' +
    '</div>' +
    '<div class="drawer-tabs" role="tablist"></div>' +
    '<div class="drawer-body"></div>';

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  var tabsEl = panel.querySelector(".drawer-tabs");
  var bodyEl = panel.querySelector(".drawer-body");
  var closeBtn = panel.querySelector(".drawer-close");

  /* tabs */
  cat.categories.forEach(function (c, i) {
    var b = document.createElement("button");
    b.className = "drawer-tab";
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.key = c.key;
    b.innerHTML = svgIcon(c.icon) + "<span>" + c.label + "</span>";
    b.addEventListener("click", function () { showCategory(c.key); });
    tabsEl.appendChild(b);
  });

  var money = function (n) { return CUR + n; };

  var rowHTML = function (s, catKey) {
    var meta = money(s.price) + ' <span class="dr-dot">&middot;</span> ' + s.dur + " min";
    var feat = s.flag === "featured" ? ' <span class="dr-badge">Signature</span>' : "";
    var desc = s.desc ? '<span class="dr-desc">' + s.desc + "</span>" : "";
    var actions;
    if (catKey === "gifts" || s.flag === "gift") {
      actions = '<button class="btn btn-honey dr-btn" type="button" data-gift="' + s.id + '">Send gift</button>';
    } else {
      actions =
        '<button class="btn btn-honey dr-btn" type="button" data-book="' + s.id + '">Book</button>' +
        '<button class="dr-gift" type="button" data-gift="' + s.id + '">Gift</button>';
    }
    return '<div class="dr-row' + (s.flag === "featured" ? " is-featured" : "") + '">' +
      '<button class="dr-row-main" type="button" data-detail="' + s.id + '">' +
      '<span class="dr-row-top"><strong>' + s.name + "</strong>" + feat + "</span>" +
      '<span class="dr-meta">' + meta + "</span>" + desc +
      '<span class="dr-more">Details &#8594;</span></button>' +
      '<div class="dr-actions">' + actions + "</div></div>";
  };

  var categoryOf = function (id) {
    for (var i = 0; i < cat.categories.length; i++) {
      if (cat.categories[i].services.some(function (s) { return s.id === id; })) return cat.categories[i];
    }
    return null;
  };

  var showDetail = function (id) {
    var s = findService(id), c = categoryOf(id);
    if (!s || !c) return;
    var feat = s.flag === "featured" ? ' <span class="dr-badge">Signature</span>' : "";
    var isGift = c.key === "gifts" || s.flag === "gift";
    var cta = isGift
      ? '<button class="btn btn-honey" type="button" data-gift="' + s.id + '">Send this gift</button>'
      : '<button class="btn btn-honey" type="button" data-book="' + s.id + '">Book this treatment</button>' +
        '<button class="btn btn-ghost" type="button" data-gift="' + s.id + '">Send as a gift</button>';
    var points = isGift
      ? ["Emailed with a code — never expires", "A specific treatment, or a value toward any service"]
      : ["Personalized to your skin that day", "Medical-grade actives, gently applied",
         "50% deposit holds your time — the rest at your visit"];
    bodyEl.innerHTML =
      '<button class="dr-back" type="button">&#8592; ' + c.label + "</button>" +
      '<div class="dr-detail"><h3>' + s.name + feat + "</h3>" +
      '<p class="dr-detail-meta">' + money(s.price) + " &middot; " + s.dur + " min</p>" +
      '<p class="dr-detail-desc">' + (s.desc || c.blurb) + "</p>" +
      '<ul class="dr-detail-points">' +
      points.map(function (p) { return '<li><span class="dr-tick">&#10003;</span>' + p + "</li>"; }).join("") +
      "</ul><div class=\"dr-detail-cta\">" + cta + "</div></div>";
    bodyEl.scrollTop = 0;
  };

  var activeKey = null;
  var showCategory = function (key) {
    var c = cat.categories.filter(function (x) { return x.key === key; })[0] || cat.categories[0];
    activeKey = c.key;
    Array.prototype.forEach.call(tabsEl.children, function (t) {
      var on = t.dataset.key === c.key;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    var rows = c.services.map(function (s) { return rowHTML(s, c.key); }).join("");
    bodyEl.innerHTML =
      '<div class="dr-cat-head"><h3>' + c.label + "</h3>" +
      (c.blurb ? "<p>" + c.blurb + "</p>" : "") + "</div>" +
      '<div class="dr-rows">' + rows + "</div>";
    bodyEl.scrollTop = 0;
  };

  /* ── open / close with focus management ── */
  var lastFocus = null;
  var isOpen = false;

  var open = function (key, serviceId) {
    if (!isOpen) {
      lastFocus = document.activeElement;
      backdrop.hidden = false;
      panel.hidden = false;
      /* force reflow so the transition runs */
      void panel.offsetWidth;
      backdrop.classList.add("is-open");
      panel.classList.add("is-open");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
      isOpen = true;
    }
    showCategory(key || (cat.categories[0] && cat.categories[0].key));
    if (serviceId) {
      var row = bodyEl.querySelector('[data-book="' + serviceId + '"],[data-gift="' + serviceId + '"]');
      if (row) {
        var wrap = row.closest(".dr-row");
        if (wrap) { wrap.classList.add("is-flash"); wrap.scrollIntoView({ block: "nearest" }); }
      }
    }
    closeBtn.focus();
  };

  var close = function () {
    if (!isOpen) return;
    backdrop.classList.remove("is-open");
    panel.classList.remove("is-open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    isOpen = false;
    var finish = function () { backdrop.hidden = true; panel.hidden = true; };
    if (reduce.matches) finish();
    else setTimeout(finish, 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  var onKey = function (e) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") {
      var f = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      f = Array.prototype.filter.call(f, function (el) { return !el.hidden && el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  /* ── toast (temporary booking seam feedback) ── */
  var toastEl = null, toastTimer = null;
  var toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "dr-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    void toastEl.offsetWidth;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 3800);
  };

  /* ── event delegation for Book / Gift ── */
  var findService = function (id) {
    for (var i = 0; i < cat.categories.length; i++) {
      var m = cat.categories[i].services.filter(function (s) { return s.id === id; })[0];
      if (m) return m;
    }
    return null;
  };

  document.addEventListener("click", function (e) {
    var sdEl = e.target.closest("[data-service-detail]");
    if (sdEl) {
      e.preventDefault();
      var sid = sdEl.dataset.serviceDetail, sc = categoryOf(sid);
      open(sc ? sc.key : null);
      showDetail(sid);
      return;
    }
    var openEl = e.target.closest("[data-drawer]");
    if (openEl) { e.preventDefault(); open(openEl.dataset.category, openEl.dataset.service); return; }
    var detEl = e.target.closest("[data-detail]");
    if (detEl && isOpen) { e.preventDefault(); showDetail(detEl.dataset.detail); return; }
    var backEl = e.target.closest(".dr-back");
    if (backEl) { e.preventDefault(); showCategory(activeKey); return; }
    var bookEl = e.target.closest("[data-book]");
    if (bookEl) {
      e.preventDefault();
      var s = findService(bookEl.dataset.book);
      document.dispatchEvent(new CustomEvent("lumevina:book", { detail: { id: bookEl.dataset.book, service: s } }));
      return;
    }
    var giftEl = e.target.closest("[data-gift]");
    if (giftEl) {
      e.preventDefault();
      var g = findService(giftEl.dataset.gift);
      document.dispatchEvent(new CustomEvent("lumevina:gift", { detail: { id: giftEl.dataset.gift, service: g } }));
      return;
    }
  });

  /* ── default handler: acknowledges the seam until the real
        booking engine is wired in (installment 2). If a later
        script calls e.preventDefault() on these events, this
        fallback stays quiet. ── */
  document.addEventListener("lumevina:book", function (e) {
    if (e.defaultPrevented) return;
    var s = e.detail.service;
    toast(s ? s.name + " · " + money(s.price) + " — live booking connects next." : "Booking connects next.");
  });
  document.addEventListener("lumevina:gift", function (e) {
    if (e.defaultPrevented) return;
    var s = e.detail.service;
    toast(s ? "Gift: " + s.name + " — gift checkout connects next." : "Gifting connects next.");
  });

  /* expose a tiny API for other scripts */
  window.LumevinaDrawer = { open: open, close: close };
})();

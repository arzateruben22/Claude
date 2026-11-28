/* Lumevina Studio: Check out (checkout.html)
 *
 * Evelyn's own checkout, one task a screen, made for a phone held in one hand:
 *
 *   1. Who's waiting   today's guests (and any earlier visit still open), each with the balance left
 *                      after the deposit they already paid when they booked.
 *   2. A guest         the cart (the services done and products from her shelf, each line one tap to change:
 *                      how many, a discount, take it off), "Add more", promos (a discount for the whole cart,
 *                      a gift certificate, Glow Points), a tip, and how they pay (the card on file, tap to
 *                      pay on their own phone, a pay link, cash, other). The deposit comes off by itself;
 *                      what's left is the amount due. Products are counted against the inventory: only what
 *                      is in stock, never more than is on the shelf.
 *   3. Paid            the amount, what was sold, and a note when a product is running low.
 *
 * It does the same jobs as the Appointments card in the dashboard (js/studio-appointments.js) and talks to
 * the same server functions (studio-book: list, quote, checkout; the quote already takes a gift code, Glow
 * Points, a discount and a tip), so a visit checked out here is checked out there. That file only runs inside
 * the dashboard, so the few helpers it shares (the demo bookings and the demo quote) are written out here too:
 * change one, change the other.
 *
 * Tap to pay. A web page can't read a card tapped on Evelyn's phone: that needs Stripe Terminal's native iPhone
 * SDK inside an App Store app. What this does instead is the web version of it: it makes the payment page and
 * the guest pays on their own phone with Apple Pay or Google Pay (a QR code to scan when js/qrcode.js is on
 * the page, and Share / AirDrop / text / copy either way). It checks every few seconds and closes the visit by
 * itself when the payment arrives.
 *
 * LIVE (js/site-config.js → shop, and her studio key saved in the dashboard): the server works out the quote,
 * takes the payment, takes the stock off and sends the receipt. DEMO: this browser's bookings (with sample
 * guests until there are real ones); the sale is kept in this browser and the stock comes off the local shelf.
 * Booking on the website (v3, v4, or ?preview=v3) is what gives this page its guests; in v2 booking is on
 * GlossGenius and the dashboard's Clients list does the walk-in sale. */
(function () {
  "use strict";

  var root = document.getElementById("app");
  if (!root) return;
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var SV = window.LUMEVINA_SERVICES || { all: [], get: function () { return null; } };
  var INV = window.LumevinaInventory || null;
  var GC = window.LumevinaGiftCards || null;
  var ON = !!(window.LumevinaFeatures && /^v[34]$/.test(window.LumevinaFeatures.version));
  var MAX_SERVICES = 8;   /* what the server takes in one visit */

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (c) { c = Math.round(c || 0); return (c < 0 ? "−" : "") + "$" + (Math.abs(c) / 100).toFixed(Math.abs(c) % 100 ? 2 : 0); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var dayKey = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var keyDate = function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var fmtTime = function (m) { return ((Math.floor(m / 60) % 12) || 12) + ":" + pad(m % 60) + " " + (m >= 720 ? "PM" : "AM"); };
  var today = dayKey(new Date());
  var studioKey = function () { try { return localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { return ""; } };
  var lget = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var lset = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  var svcName = function (id) { var s = SV.get(id); return s ? s.name : id; };
  var svcCents = function (id) { var s = SV.get(id); return s ? Math.round(s.price * 100) : 0; };
  var initials = function (n) { var p = String(n || "?").replace(/@.*/, "").trim().split(/\s+/); return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase(); };
  var call = function (fn, body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": studioKey() },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; if (!r.ok) throw j; return j; }); });
  };

  var P = function (d, extra) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (extra || "") + ">" + d + "</svg>"; };
  var I = {
    chev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    go: '<svg class="go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ok: '<svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="#171717" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="36" cy="36" r="33"/><path d="M22 37l10 10 18-21"/></svg>',
    dash: P('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
    pay: P('<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9s.9 1.6 2.5 2.1 2.5.9 2.5 2.1-1 1.9-2.5 1.9c-1.1 0-2-.4-2.6-1.2M12 6.5V8M12 16v1.5"/>'),
    cal: P('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
    who: P('<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.8-3.7 3.6-5.6 7.2-5.6s6.4 1.9 7.2 5.6"/>'),
    more: P('<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'),
    q: P('<path d="M4 5.5h16v11H9.5L5.5 20v-3.5H4z"/>'),
    shelf: P('<path d="M9 3.5h6v3H9zM8 6.5h8l1 14H7z"/>'),
    books: P('<path d="M4 19.5h16M6.5 16V10M12 16V5M17.5 16v-4"/>'),
    gift: P('<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9C9 9 8 5.5 10 5s2 4 2 4zm0 0c3 0 4-3.5 2-4s-2 4-2 4z"/>'),
    cog: P('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/>'),
    site: P('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5z"/>'),
    svc: P('<path d="M12 3.5c-2.5 3-5.5 4.6-5.5 8.2a5.5 5.5 0 0 0 11 0C17.5 8.1 14.5 6.5 12 3.5z"/>'),
    card: P('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>'),
    tap: P('<rect x="7.5" y="3.5" width="9" height="17" rx="2.2"/><path d="M10.8 17.2h2.4M4 9.5c-1 1.6-1 3.4 0 5M20 9.5c1 1.6 1 3.4 0 5"/>'),
    link: P('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    cash: P('<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6.5 10v4M17.5 10v4"/>'),
    tag: P('<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.2"/>')
  };

  /* ── the tab bar and its "More" sheet ── */
  var MORE = [
    ["Today", "dashboard.html#today", "cal"], ["Clients", "dashboard.html#clients", "who"], ["Questions", "dashboard.html#questions", "q"],
    ["Shelf & shipping", "dashboard.html#shelf", "shelf"], ["Books", "dashboard.html#books", "books"], ["Members & gifts", "dashboard.html#growth", "gift"],
    ["Settings", "dashboard.html#settings", "cog"], ["Your website", "index.html", "site"]
  ];
  var tabsEl = document.getElementById("tabs");
  var tab = function (href, icon, label, cur, id) {
    var inner = I[icon] + "<span>" + label + "</span>";
    return "<li>" + (href ? '<a class="tab" href="' + href + '"' + (cur ? ' aria-current="page"' : "") + ">" + inner + "</a>"
      : '<button class="tab" type="button" id="' + id + '" aria-haspopup="dialog">' + inner + "</button>") + "</li>";
  };
  tabsEl.innerHTML = "<ul>" + tab("dashboard.html", "dash", "Dashboard") + tab("checkout.html", "pay", "Checkout", true) +
    tab("dashboard.html#today", "cal", "Calendar") + tab("dashboard.html#clients", "who", "Clients") + tab("", "more", "More", false, "tab-more") + "</ul>";

  /* ── data: live from the server, or this browser's demo bookings ── */
  var rows = [], sample = false, notice = null, loaded = false;
  var SETTLE = "lumevina_settlements";
  var demoCard = function (email) { var Pm = window.LumevinaPayments, c = Pm && Pm.getCard ? Pm.getCard(email) : null; return c ? c.brand + " •••• " + c.last4 : null; };
  var demoRows = function () {
    var settle = lget(SETTLE, {});
    var list = lget("lumevina_bookings", []).map(function (b, i) {
      var key = b.order || [b.date, b.time, b.email].join("|");
      var s = settle[key] || {};
      return {
        id: key, idx: i, date: b.date, start_min: b.time, dur_min: b.dur || 60, services: b.services || [],
        names: (b.services || []).map(svcName).join(" + "), name: b.name, email: b.email, phone: b.phone || "",
        status: b.cancelled ? "cancelled" : s.status === "paid" ? "completed" : s.status === "no-show" ? "no_show" : "held",
        paid_cents: Math.round((b.paid || 0) * 100), card: demoCard(b.email), membership_facial: !!b.memberCredit, member: b.memberCredit ? { plan: b.memberCredit } : null,
        balance_paid_cents: s.paid != null ? Math.round(s.paid * 100) : null, tip_cents: s.tip ? Math.round(s.tip * 100) : 0
      };
    });
    if (list.length) return list;
    sample = true;
    var d = function (n) { var x = new Date(); x.setDate(x.getDate() + n); return dayKey(x); };
    return [
      { id: "s1", date: d(0), start_min: 720, dur_min: 60, services: ["lumevina-custom-facial"], names: "Lumevina Custom Facial", name: "Maya Chen", email: "maya@example.com", status: "held", paid_cents: 0, card: "Visa •••• 4242", member: { plan: "Glow" }, membership_facial: true },
      { id: "s2", date: d(0), start_min: 870, dur_min: 60, services: ["brazilian-wax"], names: "Brazilian Wax", name: "Jordan Ellis", email: "jordan@example.com", status: "held", paid_cents: 3000, card: "Mastercard •••• 5555" },
      { id: "s3", date: d(-1), start_min: 660, dur_min: 90, services: ["ageless-grace-facial"], names: "Ageless Grace Facial", name: "Priya Shah", email: "priya@example.com", status: "held", paid_cents: 0, card: null }
    ].map(function (r) { r.sample = true; return r; });
  };
  var listCall = function () {
    var from = new Date(); from.setDate(from.getDate() - 14);
    var to = new Date(); to.setDate(to.getDate() + 1);
    return call("studio-book", { action: "list", from: dayKey(from), to: dayKey(to) });
  };
  var load = function () {
    if (!LIVE) { sample = false; rows = demoRows(); loaded = true; if (view === "list") paintList(); return; }
    if (!studioKey()) { rows = []; loaded = true; notice = { t: "Save your studio key in the dashboard (Settings), and your guests show up here." }; if (view === "list") paintList(); return; }
    listCall().then(function (j) { rows = j.bookings || []; notice = null; loaded = true; if (view === "list") paintList(); },
      function (e) { loaded = true; notice = { t: e && e.reason === "studio_key" ? "That studio key wasn’t accepted. Save it again in the dashboard (Settings)." : "Couldn’t load your guests. Check the connection.", bad: true }; if (view === "list") paintList(); });
  };

  /* ── 1 · who's waiting ── */
  var dayWord = function (k) {
    if (k === today) return "";
    var y = new Date(); y.setDate(y.getDate() - 1);
    return k === dayKey(y) ? "Yesterday" : keyDate(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  var estBalance = function (r) {
    var ids = r.services || [], due = 0;
    ids.forEach(function (id) { due += svcCents(id); });
    if (r.membership_facial && ids.length) due -= svcCents(ids[0]);
    return Math.max(0, due - (r.paid_cents || 0));
  };
  var guestHtml = function (r, done) {
    var meta = [];
    var dw = dayWord(r.date);
    meta.push(esc((dw ? dw + " · " : "") + fmtTime(r.start_min)));
    if (done) meta.push("checked out");
    else {
      if (r.paid_cents) meta.push('<span class="ok">Deposit ' + money(r.paid_cents) + " paid</span>");
      if (r.membership_facial) meta.push('<span class="ok">Membership facial</span>');
      if (!r.card) meta.push('<span class="no">No card on file</span>');
    }
    var right = done ? "<strong>" + (r.balance_paid_cents != null ? money(r.balance_paid_cents + (r.tip_cents || 0)) : "Paid") + "</strong><small>paid</small>"
      : "<strong>" + money(estBalance(r)) + "</strong><small>balance</small>";
    return '<li><button type="button" class="guest' + (done ? " is-done" : "") + '"' + (done ? " disabled" : ' data-open="' + esc(r.id) + '"') + ">" +
      '<span class="av" aria-hidden="true">' + esc(initials(r.name || r.email)) + "</span>" +
      '<span><span class="g-name">' + esc(r.name || r.email) + '</span><span class="g-what" style="display:block">' + esc(r.names || (r.services || []).map(svcName).join(" + ")) + "</span>" +
      '<span class="g-meta">' + meta.join(" · ") + "</span></span>" +
      '<span class="g-due num">' + right + "</span></button></li>";
  };
  var paintList = function () {
    view = "list"; cur = null; stopPoll();
    document.getElementById("paybar").hidden = true;
    tabsEl.hidden = false;
    var date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    var html = '<div class="view"><p class="kicker">' + esc(date) + '</p><h1 class="title">Check out</h1>';
    if (!ON) {
      html += '<p class="lede">Guests appear here once booking moves to Lumevina. Until then, sell to someone at the studio from your Clients list.</p>' +
        '<div class="empty" style="padding-top:2rem"><a class="btn btn-solid" href="dashboard.html#clients">Open your Clients</a></div></div>';
      root.innerHTML = html; return;
    }
    if (!loaded) { root.innerHTML = html + '<p class="lede">Getting today’s guests…</p></div>'; return; }
    var waiting = rows.filter(function (r) { return r.status === "held" && r.date <= today; })
      .sort(function (a, b) { return (a.date + pad(a.start_min / 30 | 0)).localeCompare(b.date + pad(b.start_min / 30 | 0)) || a.start_min - b.start_min; });
    var done = rows.filter(function (r) { return r.status === "completed" && r.date === today; });
    if (notice) html += '<p class="note' + (notice.bad ? " is-bad" : "") + '">' + esc(notice.t) + "</p>";
    if (waiting.length) {
      html += '<p class="lede">Tap a guest to close out their visit.</p><h2 class="sec"><span>Waiting</span><b class="num">' + waiting.length + '</b></h2><ul class="guests">' + waiting.map(function (r) { return guestHtml(r, false); }).join("") + "</ul>";
    } else if (!notice) {
      html += '<div class="empty"><h2>All checked out</h2><p>Nobody is waiting. Guests booked for today show up here when it’s time to close out their visit.</p>' +
        '<a class="btn btn-line" href="dashboard.html#clients">Sell to someone at the studio</a></div>';
    }
    if (done.length) html += '<h2 class="sec"><span>Done today</span><b class="num">' + done.length + '</b></h2><ul class="guests">' + done.map(function (r) { return guestHtml(r, true); }).join("") + "</ul>";
    if (sample && waiting.length) html += '<p class="demo">Sample guests, until real bookings arrive.</p>';
    root.innerHTML = html + "</div>";
  };

  /* ── 2 · a guest's checkout ──
     The cart is a list of lines: a service (the same service twice is a quantity of two) or a product. */
  var view = "list", cur = null, st = null, timer = 0, seq = 0, edit = null;
  var rowById = function (id) { for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i]; return null; };
  var itemOf = function (id) { return INV && INV.get(id); };
  var unitCents = function (kind, id) { if (kind === "s") return svcCents(id); var it = itemOf(id); return it ? Math.round(it.price * 100) : 0; };
  var stockOf = function (p) { return p && p.stock != null && isFinite(Number(p.stock)) ? Number(p.stock) : Infinity; };
  var qtyOf = function (id) { for (var i = 0; i < st.products.length; i++) if (st.products[i].id === id) return st.products[i].qty; return 0; };
  var svcGroups = function () {
    var order = [], cnt = {};
    st.services.forEach(function (id) { if (!cnt[id]) { cnt[id] = 0; order.push(id); } cnt[id]++; });
    return order.map(function (id) { return { id: id, qty: cnt[id] }; });
  };
  var svcQty = function (id) { return st.services.filter(function (x) { return x === id; }).length; };
  var setSvcQty = function (id, n) {
    var out = [], placed = false, i;
    st.services.forEach(function (x) { if (x === id) { if (!placed) { for (i = 0; i < n; i++) out.push(id); placed = true; } } else out.push(x); });
    if (!placed) for (i = 0; i < n; i++) out.push(id);
    st.services = out;
  };
  var setProdQty = function (id, n) {
    st.products = st.products.filter(function (p) { return p.id !== id; });
    if (n > 0) st.products.push({ id: id, qty: n });
  };
  var toast = function (t) {
    var old = document.querySelector(".toast"); if (old) old.remove();
    var el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  };

  /* discounts: one per item (dollars or percent off each), one for the whole cart; the server takes them as a single amount */
  var perItemDisc = function (kind, id) {
    var d = st.ldisc[kind + ":" + id]; if (!d || !(d.v > 0)) return 0;
    var u = unitCents(kind, id);
    return d.mode === "pct" ? Math.min(u, Math.round(u * Math.min(100, d.v) / 100)) : Math.min(u, Math.round(d.v * 100));
  };
  var lineDiscTotal = function () {
    var t = 0;
    svcGroups().forEach(function (g) { t += perItemDisc("s", g.id) * g.qty; });
    st.products.forEach(function (p) { t += perItemDisc("p", p.id) * p.qty; });
    return t;
  };
  var subtotal = function () {
    var t = 0;
    st.services.forEach(function (id) { t += svcCents(id); });
    st.products.forEach(function (p) { t += unitCents("p", p.id) * p.qty; });
    return t;
  };
  var cartDisc = function () {
    var g = st.gdisc; if (!g || !(g.v > 0)) return 0;
    var base = Math.max(0, subtotal() - lineDiscTotal());
    return Math.min(base, g.mode === "pct" ? Math.round(base * Math.min(100, g.v) / 100) : Math.round(g.v * 100));
  };
  var discountCents = function () { return lineDiscTotal() + cartDisc(); };

  var demoQuote = function (r, inp) {
    var lines = [], due = 0, gift = null;
    var ids = inp.services && inp.services.length ? inp.services : (r.services || []);   /* like the server: none chosen means the booked visit */
    ids.forEach(function (id) { lines.push({ label: svcName(id), cents: svcCents(id) }); due += svcCents(id); });
    if (r.membership_facial && ids.length) { var c = svcCents(ids[0]); lines.push({ label: "Membership facial", cents: -c }); due -= c; }
    (inp.products || []).forEach(function (p) { var it = itemOf(p.id); if (!it) return; var c2 = Math.round(it.price * 100) * p.qty; lines.push({ label: it.name + " × " + p.qty, cents: c2 }); due += c2; });
    var disc = Math.min(Math.max(0, due), Math.round(inp.discount_cents || 0));
    if (disc) { lines.push({ label: "Discount", cents: -disc }); due -= disc; }
    var dep = Math.min(Math.max(0, due), r.paid_cents || 0);
    if (dep) { lines.push({ label: "Deposit, paid when booking", cents: -dep }); due -= dep; }
    var code = String(inp.gift_code || "").trim().toUpperCase();
    if (code && GC && due > 0) {
      var cov = Math.round(GC.quote(code, due / 100) * 100);
      if (cov) { gift = { code: code, cents: cov }; lines.push({ label: "Gift certificate " + code.slice(-4), cents: -cov }); due -= cov; }
    }
    return { lines: lines, due_cents: Math.max(0, due), points_balance: 0, card: r.card, gift: gift };
  };
  var tipBase = function () {   /* a tip is on the whole bill, not just what's left after the deposit and any gift certificate */
    var q = st.quote; if (!q) return 0;
    var pre = 0; q.lines.forEach(function (l) { if (l.cents < 0 && /deposit|gift certificate/i.test(l.label)) pre += -l.cents; });
    return q.due_cents + pre;
  };
  var tipCents = function () {
    if (st.tipMode === "custom") return Math.round((st.tipCustom || 0) * 100);
    return Math.round(tipBase() * Number(st.tipMode) / 100);
  };
  var input = function (withTip) {
    return { services: st.services, products: st.products, discount_cents: discountCents(), points: st.points, gift_code: st.gift || undefined,
      tip_cents: withTip ? tipCents() : 0 };
  };
  var METHODS = {
    card: { name: "Card on file", icon: "card" },
    tap: { name: "Tap to pay", icon: "tap", sub: "They pay with Apple Pay or Google Pay on their phone" },
    link: { name: "Pay link", icon: "link", sub: "Text or show it. They enter the card on Stripe’s secure page" },
    cash: { name: "Cash", icon: "cash", sub: "Record it" },
    other: { name: "Other", icon: "tag", sub: "Zelle, Venmo, anything else" }
  };
  var totalNow = function () { return (st.quote ? st.quote.due_cents : 0) + tipCents(); };
  var goLabel = function () {
    var total = money(totalNow());
    return st.method === "card" ? "Charge " + total : st.method === "tap" ? "Tap to pay · " + total : st.method === "link" ? "Pay link · " + total : st.method === "cash" ? "Record " + total + " cash" : "Record " + total;
  };
  var openCheckout = function (id) {
    var r = rowById(id); if (!r) return;
    cur = r; view = "co"; seq++; stopPoll();
    st = { services: (r.services || []).slice(0, MAX_SERVICES), products: [], ldisc: {}, gdisc: { mode: "usd", v: 0 }, gift: "", giftTry: false, points: 0,
      tipMode: lget("lumevina_co_tip", "20"), tipCustom: 0, method: r.card ? "card" : "cash", quote: null, busy: false, msg: "", bad: false, url: "" };
    paintCo(); requote(); window.scrollTo(0, 0);
  };
  var chipsHtml = function (r) {
    var c = [];
    if (r.paid_cents) c.push('<span class="chip ok">Deposit ' + money(r.paid_cents) + " paid</span>");
    if (r.membership_facial) c.push('<span class="chip ok">Membership facial</span>');
    c.push(r.card ? '<span class="chip">' + esc(r.card) + "</span>" : '<span class="chip no">No card on file</span>');
    return '<div class="chips">' + c.join("") + "</div>";
  };
  /* what she sells most (her own checkouts here), then the rest of the shelf: one tap each, right on the screen */
  var shelf = function () { return INV ? INV.live().filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }) : []; };
  var quickHtml = function () {
    var counts = {};
    var tally = function (items) { (items || []).forEach(function (p) { if (p && p.id) counts[p.id] = (counts[p.id] || 0) + (p.qty || 1); }); };
    var s = lget(SETTLE, {}); Object.keys(s).forEach(function (k) { tally(s[k] && s[k].products); });
    lget("lumevina_sales", []).forEach(function (o) { tally(o && o.items); });
    var q = shelf().filter(function (p) { return !qtyOf(p.id); }).sort(function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0); }).slice(0, 8);
    if (!q.length) return "";
    return '<div class="quick" role="group" aria-label="Add from your shelf">' + q.map(function (p) {
      return '<button type="button" class="qa" data-padd="' + esc(p.id) + '"><span class="qa-n">' + esc(p.name) + '</span><span class="qa-p num">+ ' + money(Math.round(p.price * 100)) + "</span></button>";
    }).join("") + "</div>";
  };
  var lineHtml = function (kind, id, qty) {
    var it = kind === "p" ? itemOf(id) : null;
    var name = kind === "s" ? svcName(id) : (it ? it.name : id);
    var unit = unitCents(kind, id), off = perItemDisc(kind, id) * qty;
    var sub = (qty > 1 ? qty + " × " + money(unit) : "") + (it && it.brand ? (qty > 1 ? " · " : "") + esc(it.brand) : "") + (off ? (qty > 1 || it ? " · " : "") + "−" + money(off).replace("−", "") + " off" : "");
    var thumb = it && it.photo ? '<img src="' + esc(it.photo) + '" alt="" loading="lazy" width="48" height="48">' : I[kind === "s" ? "svc" : "shelf"];
    return '<li><button type="button" class="cl" data-edit="' + kind + ":" + esc(id) + '"><span class="thumb thumb-s">' + thumb + '</span><span class="cl-t"><span class="cl-n">' + esc(name) + "</span>" +
      (sub ? '<span class="cl-s">' + sub + "</span>" : "") + '</span><span class="cl-p num">' + money(unit * qty - off) + "</span>" + I.go + "</button></li>";
  };
  var promoSummary = function () {
    var bits = [], q = st.quote;
    var d = discountCents(); if (d) bits.push(money(d) + " off");
    if (q && q.gift) bits.push("Gift certificate " + money(q.gift.cents));
    if (st.points) bits.push(st.points + " points");
    return bits.length ? bits.join(" · ") : "";
  };
  var paintCo = function () {
    var r = cur; if (!r) return;
    tabsEl.hidden = true;
    var q = st.quote;
    var lines = svcGroups().map(function (g) { return lineHtml("s", g.id, g.qty); }).join("") + st.products.map(function (p) { return lineHtml("p", p.id, p.qty); }).join("");
    var sum = "";
    if (q) {
      sum = '<li><span>Subtotal</span><span>' + money(subtotal()) + "</span></li>" +
        q.lines.filter(function (l) { return l.cents < 0; }).map(function (l) { return '<li class="' + (/deposit/i.test(l.label) ? "dep" : "") + '"><span>' + esc(l.label) + "</span><span>" + money(l.cents) + "</span></li>"; }).join("");
      var tip = tipCents();
      if (tip) sum += '<li><span>Tip</span><span>' + money(tip) + "</span></li>";
      sum += '<li class="due"><span>Amount due</span><strong class="num">' + money(q.due_cents + tip) + "</strong></li>";
    } else sum = '<li class="due"><span>Amount due</span><strong class="num">…</strong></li>';
    var base = tipBase();
    var tips = ["0", "15", "20", "25"].map(function (t) {
      return '<button type="button" class="pill" data-tip="' + t + '" aria-pressed="' + (st.tipMode === t) + '">' + (t === "0" ? "No tip" : t + "%") + "<small>" + (t === "0" ? "Skip it" : money(Math.round(base * Number(t) / 100))) + "</small></button>";
    }).join("") + '<button type="button" class="pill" data-tip="custom" aria-pressed="' + (st.tipMode === "custom") + '">Other<small>Custom</small></button>';
    var M = METHODS[st.method] || METHODS.cash;
    var msg = st.msg ? esc(st.msg) : "";
    root.innerHTML = '<div class="view"><button type="button" class="back" data-back="1">' + I.chev + " Back</button>" +
      '<div class="who"><span class="av" aria-hidden="true">' + esc(initials(r.name || r.email)) + '</span><div><h1>' + esc(r.name || r.email) + "</h1><p>" + esc(fmtTime(r.start_min)) + (dayWord(r.date) ? " · " + esc(dayWord(r.date)) : "") + "</p></div></div>" + chipsHtml(r) +
      '<div class="sec cart-h"><span>Cart details</span><button type="button" class="addmore" data-sheet="addmore">' + I.plus + " Add more</button></div>" +
      '<ul class="lines">' + lines + "</ul>" + (INV ? quickHtml() : "") +
      '<button type="button" class="rowlink" data-sheet="promos"><span class="rl-i">' + I.tag + '</span><span class="rl-t">Promos, gift cards &amp; discounts' + (promoSummary() ? "<small>" + esc(promoSummary()) + "</small>" : "") + "</span>" + I.go + "</button>" +
      '<ul class="sum">' + sum + "</ul>" +
      '<h2 class="sec"><span>Tip</span></h2><div class="pills">' + tips + "</div>" +
      (st.tipMode === "custom" ? '<div class="tipc"><label class="sr" for="tipc">Tip in dollars</label><input id="tipc" type="number" inputmode="decimal" min="0" step="1" placeholder="Tip $" value="' + (st.tipCustom || "") + '"></div>' : "") +
      '<h2 class="sec"><span>Pay with</span></h2>' +
      '<button type="button" class="rowlink" data-sheet="paywith"><span class="rl-i">' + I[M.icon] + '</span><span class="rl-t">' + esc(M.name) + '</span><span class="rl-v">' + esc(st.method === "card" ? (r.card || "") : "Change") + "</span>" + I.go + "</button>" +
      '<p class="msg' + (st.bad ? " is-bad" : "") + '" role="status">' + msg + "</p></div>";
    var pb = document.getElementById("paybar");
    pb.hidden = false;
    pb.innerHTML = '<div class="paybar-in"><div class="tot"><span>Total</span><strong class="num">' + money(totalNow()) + '</strong></div><button type="button" class="btn btn-solid" data-go="1"' + (st.busy || !q ? " disabled" : "") + ">" + (st.busy ? "One moment…" : esc(goLabel())) + "</button></div>";
  };
  var requote = function () {
    clearTimeout(timer);
    var mine = seq;
    timer = setTimeout(function () {
      var got = LIVE && !cur.sample ? call("studio-book", Object.assign({ action: "quote", id: cur.id }, input(false))).then(function (j) { return j.quote; })
        : Promise.resolve(demoQuote(cur, input(false)));
      got.then(function (quote) {
        if (mine !== seq || view !== "co") return;
        st.quote = quote; st.bad = false; st.msg = "";
        keepScroll(paintCo); drawPromosMsg();
        if (edit && layer.querySelector("#edit-total")) drawEdit();
        if (layer.querySelector(".pm-amt")) layer.querySelector(".pm-amt").textContent = money(totalNow());
      }, function () { if (mine !== seq || view !== "co") return; st.msg = "Couldn’t work out the total. Check the connection."; st.bad = true; keepScroll(paintCo); });
    }, 120);
  };
  var keepScroll = function (fn) {
    var y = window.pageYOffset, a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
    fn(); window.scrollTo(0, y);
    if (id && !layer.firstChild) { var el = document.getElementById(id); if (el && el.focus) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* number inputs */ } } }
  };

  /* pay and record: live through the server; the demo records it in this browser's books */
  var finish = function (r, method, inp, confirmed) {
    if (LIVE && !r.sample) {
      return call("studio-book", Object.assign({ action: "checkout", id: r.id, method: method === "tap" ? "link" : method }, inp)).then(function (j) {
        if (j.url) return { url: j.url };
        if (INV && INV.refresh) INV.refresh();
        return { charged: j.quote ? j.quote.charge_cents : 0, tip: inp.tip_cents, points: j.points || 0 };
      });
    }
    /* demo: a pay code or link has no payment behind it, so it waits for "Mark as paid" */
    if ((method === "tap" || method === "link") && !confirmed) return Promise.resolve({ url: location.href.split("#")[0] + "#demo-pay" });
    var quote = demoQuote(r, inp);
    var tip = inp.tip_cents || 0;
    if (r.sample) { r.status = "completed"; r.balance_paid_cents = quote.due_cents; r.tip_cents = tip; }
    else {
      var settle = lget(SETTLE, {});
      settle[r.id] = { status: "paid", method: method === "card" ? "card" : method === "cash" ? "cash" : "other", at: new Date().toISOString(), paid: quote.due_cents / 100, tip: tip / 100, products: inp.products };
      lset(SETTLE, settle);
    }
    (inp.products || []).forEach(function (p) { if (INV && INV.sell) INV.sell(p.id, p.qty); });
    if (quote.gift && GC && GC.spend) GC.spend(quote.gift.code, quote.gift.cents / 100, { note: "At checkout, " + (r.name || r.email), where: "studio" });
    document.dispatchEvent(new Event("lumevina:books"));
    return Promise.resolve({ charged: quote.due_cents + tip, tip: tip });
  };
  var soldNow = function () {
    return st.products.map(function (p) { var it = itemOf(p.id); return { name: it ? it.name : p.id, qty: p.qty, left: it && stockOf(it) !== Infinity ? stockOf(it) - p.qty : null }; });
  };
  var pay = function () {
    if (st.busy || !st.quote) return;
    st.busy = true; st.msg = st.method === "card" ? "Charging the card…" : "Saving…"; st.bad = false; keepScroll(paintCo);
    var inp = input(true), r = cur, lines = st.quote.lines.slice(), sold = soldNow();
    finish(r, st.method, inp).then(function (res) {
      st.busy = false;
      if (res.url) { st.url = res.url; st.msg = ""; keepScroll(paintCo); linkSheet(res.url, inp, lines, sold); return; }
      if (st.tipMode !== "custom") lset("lumevina_co_tip", st.tipMode);   /* her usual tip is already chosen next time */
      paintDone(r, res, lines, sold);
      if (LIVE && !r.sample) load();
    }, function (err) {
      st.busy = false; st.bad = true;
      var reason = err && err.reason;
      st.msg = reason === "no_card" ? "There’s no card on file. Choose tap to pay, a pay link, cash, or ask them for a card."
        : /declin|insufficient|expired|authentication|card/.test(String(reason)) ? "The card didn’t go through (" + String(reason).replace(/_/g, " ") + "). Try tap to pay or a pay link: they pay on their phone."
        : "That didn’t go through. Check the connection and try again.";
      keepScroll(paintCo);
    });
  };

  /* ── 3 · paid ── */
  var paintDone = function (r, res, lines, sold) {
    view = "done"; seq++; stopPoll(); closeSheet();
    document.getElementById("paybar").hidden = true; tabsEl.hidden = false;
    var low = sold.filter(function (s) { return s.left != null && s.left <= (INV ? INV.LOW : 3); });
    root.innerHTML = '<div class="view done">' + I.ok + '<p class="kicker">Checked out</p><h1 class="title">' + esc(r.name || r.email) + '</h1><p class="amt num">' + money(res.charged) + "</p>" +
      '<p class="lede">' + (LIVE && !r.sample ? "The receipt is on its way." : "Demo: nothing was charged.") + (res.tip ? " Includes a " + money(res.tip) + " tip." : "") + (res.points ? " " + res.points + " Glow Points earned." : "") + "</p>" +
      "<ul>" + lines.map(function (l) { return "<li><span>" + esc(l.label) + "</span><span>" + money(l.cents) + "</span></li>"; }).join("") + "</ul>" +
      (low.length ? '<p class="stock-note">' + low.map(function (s) { return esc(s.name) + (s.left <= 0 ? " is sold out." : ": " + s.left + " left."); }).join(" ") + " Time to reorder.</p>" : "") +
      '<div class="acts"><button type="button" class="btn btn-solid btn-wide" data-next="1">Next guest</button></div></div>';
    window.scrollTo(0, 0);
  };

  /* ── tap to pay / pay link: the guest pays on their own phone; this page watches for it ── */
  var pollT = 0;
  var stopPoll = function () { if (pollT) { clearInterval(pollT); pollT = 0; } };
  var startPoll = function (r, lines, sold, inp) {
    stopPoll();
    if (!LIVE || r.sample) return;
    var until = Date.now() + 15 * 60 * 1000;
    pollT = setInterval(function () {
      if (Date.now() > until || view !== "co" || cur !== r) { stopPoll(); return; }
      listCall().then(function (j) {
        var row = (j.bookings || []).filter(function (b) { return String(b.id) === String(r.id); })[0];
        if (row && row.status === "completed") {
          rows = j.bookings || [];
          paintDone(r, { charged: (row.balance_paid_cents || 0) + (row.tip_cents || 0), tip: row.tip_cents || 0 }, lines, sold);
        }
      }, function () { /* try again next time */ });
    }, 3000);
  };
  var qrSvg = function (text) {
    try {
      if (typeof window.qrcode !== "function") return "";
      var q = window.qrcode(0, "M"); q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) { return ""; }
  };
  var linkSheet = function (url, inp, lines, sold) {
    var r = cur, demo = !LIVE || r.sample, total = money(totalNow());
    var qr = demo ? "" : qrSvg(url);
    var tapIt = st.method === "tap";
    openSheet('<div class="sheet-h"><h2>' + (tapIt ? "Tap to pay" : "Pay link") + '</h2><button type="button" class="done-btn" data-closeq="1">Close</button></div><div class="sheet-body">' +
      '<p class="pm-big num">' + total + "</p>" +
      '<p class="lede" style="text-align:center">' + (demo ? "Demo: nothing is charged." : tapIt ? "Hold the code up. They scan it and pay with Apple Pay, Google Pay or a card." : "Send it. They enter the card on Stripe’s secure page.") + "</p>" +
      (qr ? '<div class="qr" aria-label="Scan to pay">' + qr + "</div>" : "") +
      '<div class="linkacts">' +
      (navigator.share && !demo ? '<button type="button" class="btn btn-solid btn-wide" data-share="' + esc(url) + '">Share or AirDrop</button>' : "") +
      (r.phone && !demo ? '<a class="btn btn-line btn-wide" href="sms:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + "?&body=" + encodeURIComponent("Your Lumevina Aesthetics Spa visit: " + url) + '">Text it to ' + esc((r.name || "them").split(" ")[0]) + "</a>" : "") +
      (demo ? '<button type="button" class="btn btn-solid btn-wide" data-demopaid="1">Mark as paid (demo)</button>' : '<button type="button" class="btn btn-line btn-wide" data-copy="' + esc(url) + '">Copy the link</button>') +
      "</div>" + (demo ? "" : '<p class="pm-wait"><span class="dot" aria-hidden="true"></span> Waiting for the payment. This closes by itself when it arrives.</p>') + "</div>");
    paySheetCtx = { inp: inp, lines: lines, sold: sold };
    startPoll(r, lines, sold, inp);
  };
  var paySheetCtx = null;

  /* ── sheets ── */
  var layer = document.getElementById("layer");
  var lastFocus = null;
  var closeSheet = function () { layer.innerHTML = ""; document.body.style.overflow = ""; edit = null; if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) lastFocus.focus(); };
  var openSheet = function (html, focusSel) {
    if (!layer.firstChild) lastFocus = document.activeElement;
    layer.innerHTML = '<div class="scrim" data-close="1"></div><div class="sheet" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.style.overflow = "hidden";
    var f = focusSel && layer.querySelector(focusSel); if (f) f.focus();
  };
  var catSel = "", qSel = "";
  var drawProducts = function () {
    var box = layer.querySelector("#plist"); if (!box) return;
    var q = qSel.trim().toLowerCase();
    var list = shelf().filter(function (p) { return (!catSel || p.cat === catSel) && (!q || (p.brand + " " + p.name + " " + (p.cat || "")).toLowerCase().indexOf(q) > -1); });
    box.innerHTML = list.length ? list.slice(0, 80).map(function (p) {
      var have = stockOf(p), n = qtyOf(p.id), left = have === Infinity ? null : have - n;
      var sub = esc(p.brand) + (left == null ? "" : ' · <span class="' + (left <= (INV.LOW || 3) ? "low" : "") + '">' + left + " left</span>");
      var thumb = p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy" width="58" height="58">' : esc(p.brand);
      return '<li class="prod"><span class="thumb">' + thumb + '</span><span><span class="p-name">' + esc(p.name) + '</span><span class="p-sub" style="display:block">' + sub + '</span><span class="p-price num">' + money(Math.round(p.price * 100)) + "</span></span>" +
        (n ? '<span class="step"><button type="button" data-pdec="' + esc(p.id) + '" aria-label="One fewer">−</button><output class="num">' + n + '</output><button type="button" data-pinc="' + esc(p.id) + '" aria-label="One more">+</button></span>'
          : '<button type="button" class="addbtn" data-padd="' + esc(p.id) + '">Add</button>') + "</li>";
    }).join("") : '<li class="none">Nothing on the shelf matches.</li>';
  };
  var productsSheet = function () {
    catSel = ""; qSel = "";
    var cats = []; shelf().forEach(function (p) { if (p.cat && cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    openSheet('<div class="sheet-h"><h2>From your shelf</h2><button type="button" class="done-btn" data-close="1">Done</button></div>' +
      '<div class="sheet-tools"><label class="sr" for="pq">Search the shelf</label><input id="pq" type="search" placeholder="Search products" autocomplete="off">' +
      '<div class="cats" role="group" aria-label="Category"><button type="button" class="pill" data-cat="" aria-pressed="true">All</button>' + cats.map(function (c) { return '<button type="button" class="pill" data-cat="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>"; }).join("") + "</div></div>" +
      '<div class="sheet-body"><ul id="plist"></ul></div>');
    drawProducts();
  };
  var servicesSheet = function () {
    var list = SV.all.filter(function (s) { return !s.ask; });
    openSheet('<div class="sheet-h"><h2>Add a service</h2><button type="button" class="done-btn" data-close="1">Cancel</button></div><div class="sheet-body"><ul>' +
      list.map(function (s) { return '<li class="prod" style="grid-template-columns:1fr auto"><span><span class="p-name">' + esc(s.name) + '</span><span class="p-price num" style="display:block">' + money(Math.round(s.price * 100)) + '</span></span><button type="button" class="addbtn" data-svc="' + esc(s.id) + '">Add</button></li>'; }).join("") + "</ul></div>");
  };
  var addMoreSheet = function () {
    openSheet('<div class="sheet-h"><h2>Add more</h2><button type="button" class="done-btn" data-close="1">Close</button></div><div class="sheet-body"><ul class="menu">' +
      '<li><button type="button" class="menu-r" data-sheet="services"><span class="rl-i">' + I.svc + '</span><span class="rl-t">Services</span>' + I.go + "</button></li>" +
      (INV ? '<li><button type="button" class="menu-r" data-sheet="products"><span class="rl-i">' + I.shelf + '</span><span class="rl-t">Products</span>' + I.go + "</button></li>" : "") +
      "</ul></div>");
  };
  var moreSheet = function () {
    openSheet('<div class="sheet-h"><h2>More</h2><button type="button" class="done-btn" data-close="1">Close</button></div><div class="sheet-body"><div class="mgrid">' +
      MORE.map(function (m) { return '<a class="mtile" href="' + m[1] + '">' + I[m[2]] + "<span>" + esc(m[0]) + "</span></a>"; }).join("") + "</div></div>");
  };

  /* a line: how many, a discount on each, take it off */
  var segHtml = function (attr, mode) {
    return '<div class="seg" role="group"><button type="button" ' + attr + '="usd" aria-pressed="' + (mode === "usd") + '">$</button><button type="button" ' + attr + '="pct" aria-pressed="' + (mode === "pct") + '">%</button></div>';
  };
  var drawEdit = function () {
    if (!edit || !layer.querySelector("#edit-body")) return;
    var k = edit.kind, id = edit.id, it = k === "p" ? itemOf(id) : null;
    var qty = k === "s" ? svcQty(id) : qtyOf(id);
    if (!qty) { closeSheet(); return; }
    var d = st.ldisc[k + ":" + id] || { mode: "usd", v: 0 };
    var off = perItemDisc(k, id) * qty;
    var have = k === "p" ? stockOf(it) : Infinity;
    layer.querySelector("#edit-body").innerHTML =
      '<div class="field"><span class="f-l">' + (k === "s" ? "Service" : "Product") + '</span><span class="f-v">' + esc(k === "s" ? svcName(id) : (it ? it.name : id)) + "</span></div>" +
      '<div class="field"><span class="f-l">Price</span><span class="f-v num">' + money(unitCents(k, id)) + '</span><span class="f-n">Prices come from your menu. Use a discount to charge less.</span></div>' +
      '<div class="field row"><span><span class="f-l">Quantity</span><span class="f-v num" id="edit-qty">' + qty + (have !== Infinity ? ' <small class="f-s">of ' + have + " in stock</small>" : "") + '</span></span><span class="step"><button type="button" data-eq="-1" aria-label="One fewer">−</button><button type="button" data-eq="1" aria-label="One more">+</button></span></div>' +
      '<div class="field row"><span class="f-l" style="margin:0">Discount per item</span>' + segHtml("data-emode", d.mode) + "</div>" +
      '<div class="field"><label class="f-l" for="e-disc">' + (d.mode === "pct" ? "Percent off each" : "Dollars off each") + '</label><input id="e-disc" type="number" inputmode="decimal" min="0" step="' + (d.mode === "pct" ? "1" : "0.5") + '" placeholder="0" value="' + (d.v || "") + '"></div>' +
      '<p class="f-t" id="edit-total">Total discount: ' + money(off) + "</p>" +
      '<button type="button" class="del" data-edel="1">' + I.x + " Remove from cart</button>";
  };
  var editSheet = function (kind, id) {
    edit = { kind: kind, id: id };
    openSheet('<div class="sheet-h"><h2>Edit</h2><button type="button" class="done-btn" data-close="1">Done</button></div><div class="sheet-body"><div id="edit-body"></div></div>');
    drawEdit();
  };

  /* promos, gift cards and discounts */
  var giftNote = function () {
    var q = st.quote;
    if (!st.gift) return "";
    if (q && q.gift) return "Applied: " + money(q.gift.cents) + " off the amount due.";
    return st.giftTry && q ? "That code didn’t work, or it has no balance left." : "";
  };
  var drawPromosMsg = function () {
    var el = layer.querySelector("#gmsg"); if (el) { el.textContent = giftNote(); el.className = "f-t" + (st.gift && st.quote && !st.quote.gift && st.giftTry ? " is-bad" : ""); }
    var pts = layer.querySelector("#pts-row");
    if (pts && st.quote) { var bal = st.quote.points_balance || 0; pts.hidden = bal < 100 && !st.points; var t = pts.querySelector("span"); if (t) t.textContent = "Use " + (Math.floor(bal / 100) * 100) + " Glow Points ($" + Math.floor(bal / 100) * 10 + " off). They have " + bal + "."; }
  };
  var promosSheet = function () {
    var g = st.gdisc;
    openSheet('<div class="sheet-h"><h2>Promos &amp; discounts</h2><button type="button" class="done-btn" data-close="1">Done</button></div><div class="sheet-body">' +
      '<div class="field row"><span class="f-l" style="margin:0">Discount on the whole cart</span>' + segHtml("data-gmode", g.mode) + "</div>" +
      '<div class="field"><label class="f-l" for="g-disc">' + (g.mode === "pct" ? "Percent off" : "Dollars off") + '</label><input id="g-disc" type="number" inputmode="decimal" min="0" step="' + (g.mode === "pct" ? "1" : "0.5") + '" placeholder="0" value="' + (g.v || "") + '"></div>' +
      '<div class="field"><label class="f-l" for="g-code">Gift certificate</label><div class="inline"><input id="g-code" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="LUM-XXXX-XXXX" value="' + esc(st.gift) + '"><button type="button" class="btn btn-line" data-gapply="1">Apply</button></div></div>' +
      '<p class="f-t" id="gmsg">' + esc(giftNote()) + "</p>" +
      '<label class="field row" id="pts-row" hidden style="cursor:pointer"><span></span><input type="checkbox" data-pts="1"' + (st.points ? " checked" : "") + ' style="width:1.4rem;height:1.4rem"></label>' +
      "</div>");
    drawPromosMsg();
  };

  /* how they pay */
  var payWithSheet = function () {
    var r = cur;
    var row = function (key) {
      var M = METHODS[key], disabled = key === "card" && !r.card;
      var sub = key === "card" ? (r.card || "No card on file") : M.sub;
      return '<li><button type="button" class="menu-r pm" data-pm="' + key + '"' + (disabled ? " disabled" : "") + (st.method === key ? ' aria-current="true"' : "") + '><span class="rl-i">' + I[M.icon] + '</span><span class="rl-t">' + esc(M.name) + '<small>' + esc(sub) + "</small></span>" + (st.method === key ? '<span class="chip ok">Selected</span>' : I.go) + "</button></li>";
    };
    openSheet('<div class="sheet-h"><h2>Select payment method</h2><button type="button" class="done-btn" data-close="1">Close</button></div><div class="sheet-body"><p class="pm-big num pm-amt">' + money(totalNow()) + '</p><ul class="menu">' +
      ["card", "tap", "link", "cash", "other"].map(row).join("") + "</ul></div>");
  };
  var addProduct = function (id, by) {
    var it = itemOf(id); if (!it) return;
    var have = stockOf(it), n = qtyOf(id), next = n + by;
    if (next > have) { toast(have <= 0 ? "That one is out of stock." : "Only " + have + " in stock."); return; }
    if (next > 20) { toast("That’s the most for one sale."); return; }
    if (!n && st.products.length >= 12) { toast("That’s the most products for one sale."); return; }
    setProdQty(id, next);
    requote(); keepScroll(paintCo); drawProducts(); if (edit) drawEdit();
  };
  var changeQty = function (by) {
    if (!edit) return;
    var k = edit.kind, id = edit.id;
    if (k === "s") {
      var n = svcQty(id), next = n + by;
      if (next < 1) { toast("A visit needs at least one service. Use a discount if it’s on the house."); return; }
      if (st.services.length - n + next > MAX_SERVICES) { toast("That’s the most services for one visit."); return; }
      setSvcQty(id, next); requote(); keepScroll(paintCo); drawEdit();
    } else addProduct(id, by);
  };
  var removeLine = function () {
    if (!edit) return;
    var k = edit.kind, id = edit.id;
    if (k === "s") {
      var others = st.services.filter(function (x) { return x !== id; });
      if (!others.length) { toast("A visit needs at least one service. Use a discount if it’s on the house."); return; }
      setSvcQty(id, 0);
    } else setProdQty(id, 0);
    delete st.ldisc[k + ":" + id];
    closeSheet(); requote(); keepScroll(paintCo);
  };

  /* ── one listener for everything ── */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a, [data-close]"); if (!t) return;
    var d = t.dataset;
    if (d.close != null) { closeSheet(); return; }
    if (d.closeq) { closeSheet(); return; }
    if (t.id === "tab-more") { moreSheet(); return; }
    if (d.open) { openCheckout(d.open); return; }
    if (d.back) { paintList(); window.scrollTo(0, 0); return; }
    if (d.next) { paintList(); return; }
    if (d.sheet === "addmore") { addMoreSheet(); return; }
    if (d.sheet === "products") { productsSheet(); return; }
    if (d.sheet === "services") { servicesSheet(); return; }
    if (d.sheet === "promos") { promosSheet(); return; }
    if (d.sheet === "paywith") { payWithSheet(); return; }
    if (d.edit) { var p = d.edit.split(":"); editSheet(p[0], p.slice(1).join(":")); return; }
    if (d.eq) { changeQty(+d.eq); return; }
    if (d.edel) { removeLine(); return; }
    if (d.emode && edit) { var key = edit.kind + ":" + edit.id; var cur2 = st.ldisc[key] || { mode: "usd", v: 0 }; st.ldisc[key] = { mode: d.emode, v: cur2.v }; requote(); keepScroll(paintCo); drawEdit(); return; }
    if (d.gmode) { st.gdisc.mode = d.gmode; promosSheet(); requote(); keepScroll(paintCo); return; }
    if (d.gapply) { var gi = document.getElementById("g-code"); st.gift = gi ? gi.value.trim().toUpperCase() : ""; st.giftTry = !!st.gift; requote(); return; }
    if (d.svc) {
      if (st.services.length >= MAX_SERVICES) { toast("That’s the most services for one visit."); return; }
      st.services.push(d.svc); closeSheet(); requote(); keepScroll(paintCo); return;
    }
    if (d.pinc) { addProduct(d.pinc, 1); return; }
    if (d.padd) { addProduct(d.padd, 1); return; }
    if (d.pdec) { addProduct(d.pdec, -1); return; }
    if (d.cat != null && t.closest(".cats")) { catSel = d.cat; layer.querySelectorAll(".cats .pill").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); }); drawProducts(); return; }
    if (d.tip) { st.tipMode = d.tip; keepScroll(paintCo); if (d.tip === "custom") { var ti = document.getElementById("tipc"); if (ti) ti.focus(); } return; }
    if (d.pm) { st.method = d.pm; st.url = ""; st.msg = ""; stopPoll(); closeSheet(); keepScroll(paintCo); return; }
    if (d.go) { pay(); return; }
    if (d.demopaid && paySheetCtx) {
      var ctx = paySheetCtx, r0 = cur;
      finish(r0, "link", ctx.inp, true).then(function (res) { paintDone(r0, res, ctx.lines, ctx.sold); });
      return;
    }
    if (d.share) { try { navigator.share({ title: "Your Lumevina Aesthetics Spa visit", url: d.share }); } catch (x) { /* cancelled */ } return; }
    if (d.copy) { try { navigator.clipboard.writeText(d.copy); t.textContent = "Copied"; } catch (x2) { /* old browser */ } }
  });
  document.addEventListener("change", function (e) {
    if (e.target.dataset && e.target.dataset.pts) { st.points = e.target.checked && st.quote ? Math.floor(st.quote.points_balance / 100) * 100 : 0; requote(); }
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "tipc") { st.tipCustom = Math.max(0, Number(t.value) || 0); keepScroll(paintCo); }
    else if (t.id === "pq") { qSel = t.value; drawProducts(); }
    else if (t.id === "e-disc" && edit) { var key = edit.kind + ":" + edit.id; var d0 = st.ldisc[key] || { mode: "usd", v: 0 }; st.ldisc[key] = { mode: d0.mode, v: Math.max(0, Number(t.value) || 0) }; var tot = layer.querySelector("#edit-total"); if (tot) tot.textContent = "Total discount: " + money(perItemDisc(edit.kind, edit.id) * (edit.kind === "s" ? svcQty(edit.id) : qtyOf(edit.id))); requote(); }
    else if (t.id === "g-disc") { st.gdisc.v = Math.max(0, Number(t.value) || 0); requote(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && layer.firstChild) closeSheet(); });

  if (INV && INV.onChange) INV.onChange(function () { if (layer.querySelector("#plist")) drawProducts(); });
  if (location.hash === "#new") location.replace("dashboard.html#clients");
  paintList();
  load();
})();

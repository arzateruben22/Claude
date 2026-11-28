/* Lumevina Studio: Check out (checkout.html)
 *
 * Evelyn's own checkout, one task a screen, made for a phone held in one hand:
 *
 *   1. Who's waiting   today's guests (and any earlier visit still open), each with the balance left
 *                      after the deposit they already paid when they booked.
 *   2. A guest         the services done (change them), products from her shelf (counted against the
 *                      inventory: only what's in stock, never more than is on the shelf), a discount,
 *                      Glow Points, a tip, and how they pay: the card on file, cash, a pay link or other.
 *                      The deposit comes off by itself; what's left is the balance to collect.
 *   3. Paid            the amount, what was sold, and a note when a product is running low.
 *
 * It does the same jobs as the Appointments card in the dashboard (js/studio-appointments.js) and talks to
 * the same server functions (studio-book: list, quote, checkout), so a visit checked out here is checked out
 * there. That file only runs inside the dashboard, so the few helpers it shares (the demo bookings and the demo
 * quote) are written out here too: change one, change the other.
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
  var ON = !!(window.LumevinaFeatures && /^v[34]$/.test(window.LumevinaFeatures.version));

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

  var I = {
    chev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ok: '<svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="#171717" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="36" cy="36" r="33"/><path d="M22 37l10 10 18-21"/></svg>',
    dash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    pay: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9s.9 1.6 2.5 2.1 2.5.9 2.5 2.1-1 1.9-2.5 1.9c-1.1 0-2-.4-2.6-1.2M12 6.5V8M12 16v1.5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    who: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.8-3.7 3.6-5.6 7.2-5.6s6.4 1.9 7.2 5.6"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/></svg>',
    q: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9.5L5.5 20v-3.5H4z"/></svg>',
    shelf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5h6v3H9zM8 6.5h8l1 14H7z"/></svg>',
    books: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h16M6.5 16V10M12 16V5M17.5 16v-4"/></svg>',
    gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9C9 9 8 5.5 10 5s2 4 2 4zm0 0c3 0 4-3.5 2-4s-2 4-2 4z"/></svg>',
    cog: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/></svg>',
    site: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5z"/></svg>'
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
  var demoCard = function (email) { var P = window.LumevinaPayments, c = P && P.getCard ? P.getCard(email) : null; return c ? c.brand + " •••• " + c.last4 : null; };
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
  var load = function () {
    if (!LIVE) { sample = false; rows = demoRows(); loaded = true; paintList(); return; }
    if (!studioKey()) { rows = []; loaded = true; notice = { t: "Save your studio key in the dashboard (Settings), and your guests show up here." }; paintList(); return; }
    var from = new Date(); from.setDate(from.getDate() - 14);
    var to = new Date(); to.setDate(to.getDate() + 1);
    call("studio-book", { action: "list", from: dayKey(from), to: dayKey(to) }).then(function (j) { rows = j.bookings || []; notice = null; loaded = true; paintList(); },
      function (e) { loaded = true; notice = { t: e && e.reason === "studio_key" ? "That studio key wasn’t accepted. Save it again in the dashboard (Settings)." : "Couldn’t load your guests. Check the connection.", bad: true }; paintList(); });
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
    if (done) {
      meta.push("checked out");
    } else {
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
    view = "list"; cur = null;
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

  /* ── 2 · a guest's checkout ── */
  var view = "list", cur = null, st = null, timer = 0, seq = 0;
  var rowById = function (id) { for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i]; return null; };
  var demoQuote = function (r, input) {
    var lines = [], due = 0;
    var ids = input.services && input.services.length ? input.services : [];
    ids.forEach(function (id) { lines.push({ label: svcName(id), cents: svcCents(id) }); due += svcCents(id); });
    if (r.membership_facial && ids.length) { var c = svcCents(ids[0]); lines.push({ label: "Membership facial", cents: -c }); due -= c; }
    (input.products || []).forEach(function (p) { var it = INV && INV.get(p.id); if (!it) return; var c2 = Math.round(it.price * 100) * p.qty; lines.push({ label: it.name + " × " + p.qty, cents: c2 }); due += c2; });
    var disc = Math.min(Math.max(0, due), Math.round(input.discount_cents || 0));
    if (disc) { lines.push({ label: "Discount", cents: -disc }); due -= disc; }
    var dep = Math.min(Math.max(0, due), r.paid_cents || 0);
    if (dep) { lines.push({ label: "Deposit, paid when booking", cents: -dep }); due -= dep; }
    return { lines: lines, due_cents: Math.max(0, due), points_balance: 0, card: r.card };
  };
  var stockOf = function (p) { return p && p.stock != null && isFinite(Number(p.stock)) ? Number(p.stock) : Infinity; };
  var qtyOf = function (id) { for (var i = 0; i < st.products.length; i++) if (st.products[i].id === id) return st.products[i].qty; return 0; };
  var toast = function (t) {
    var old = document.querySelector(".toast"); if (old) old.remove();
    var el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  };
  var tipBase = function () {   /* a tip is on the whole bill, not just what's left after the deposit */
    var q = st.quote; if (!q) return 0;
    var dep = 0; q.lines.forEach(function (l) { if (l.cents < 0 && /deposit/i.test(l.label)) dep += -l.cents; });
    return q.due_cents + dep;
  };
  var tipCents = function () {
    if (st.tipMode === "custom") return Math.round((st.tipCustom || 0) * 100);
    return Math.round(tipBase() * Number(st.tipMode) / 100);
  };
  var input = function (withTip) {
    return { services: st.services, products: st.products, discount_cents: Math.round(st.discount * 100), points: st.points, tip_cents: withTip ? tipCents() : 0 };
  };
  var goLabel = function () {
    var total = money((st.quote ? st.quote.due_cents : 0) + tipCents());
    return st.method === "card" ? "Charge " + total : st.method === "cash" ? "Record " + total + " cash" : st.method === "link" ? "Pay link for " + total : "Record " + total;
  };
  var openCheckout = function (id) {
    var r = rowById(id); if (!r) return;
    cur = r; view = "co"; seq++;
    st = { services: (r.services || []).slice(), products: [], discount: 0, discOpen: false, tipMode: lget("lumevina_co_tip", "20"), tipCustom: 0, method: r.card ? "card" : "cash", points: 0, quote: null, busy: false, msg: "", url: "" };
    paintCo(); requote(); window.scrollTo(0, 0);
  };
  /* what she sells most (her own checkouts here), then the rest of the shelf: shown right on the screen, one tap each */
  var quickList = function () {
    var counts = {};
    var tally = function (items) { (items || []).forEach(function (p) { if (p && p.id) counts[p.id] = (counts[p.id] || 0) + (p.qty || 1); }); };
    var s = lget(SETTLE, {}); Object.keys(s).forEach(function (k) { tally(s[k] && s[k].products); });
    lget("lumevina_sales", []).forEach(function (o) { tally(o && o.items); });
    return shelf().filter(function (p) { return !qtyOf(p.id) && qtyOf !== null; })
      .sort(function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0); }).slice(0, 8);
  };
  var chipsHtml = function (r) {
    var c = [];
    if (r.paid_cents) c.push('<span class="chip ok">Deposit ' + money(r.paid_cents) + " paid</span>");
    if (r.membership_facial) c.push('<span class="chip ok">Membership facial</span>');
    c.push(r.card ? '<span class="chip">' + esc(r.card) + "</span>" : '<span class="chip no">No card on file</span>');
    return '<div class="chips">' + c.join("") + "</div>";
  };
  var quickHtml = function () {
    var q = quickList(); if (!q.length) return "";
    return '<div class="quick" role="group" aria-label="Add from your shelf">' + q.map(function (p) {
      return '<button type="button" class="qa" data-padd="' + esc(p.id) + '"><span class="qa-n">' + esc(p.name) + '</span><span class="qa-p num">+ ' + money(Math.round(p.price * 100)) + "</span></button>";
    }).join("") + "</div>";
  };
  var paintCo = function () {
    var r = cur; if (!r) return;
    tabsEl.hidden = true;
    var q = st.quote;
    var svcLines = st.services.length ? st.services.map(function (id, i) {
      return '<li class="line"><span class="nm">' + esc(svcName(id)) + '</span><span class="pr num">' + money(svcCents(id)) + '</span><button type="button" class="x" data-rmsvc="' + i + '" aria-label="Remove ' + esc(svcName(id)) + '">' + I.x + "</button></li>";
    }).join("") : '<li class="none">Nothing yet.</li>';
    var cart = st.products.length ? st.products.map(function (p, i) {
      var it = INV && INV.get(p.id);
      return '<li class="line cart-line"><span class="nm">' + esc(it ? it.name : p.id) + "<small>" + esc(it ? it.brand : "") + " · " + money(it ? Math.round(it.price * 100) : 0) + ' each</small></span><span class="right"><span class="pr num">' + money((it ? Math.round(it.price * 100) : 0) * p.qty) + "</span>" +
        '<span class="step"><button type="button" data-dec="' + esc(p.id) + '" aria-label="One fewer">−</button><output class="num">' + p.qty + '</output><button type="button" data-inc="' + esc(p.id) + '" aria-label="One more">+</button></span></span></li>';
    }).join("") : '<li class="none">Nothing from the shelf.</li>';
    var sum = "";
    if (q) {
      sum = q.lines.map(function (l) { return '<li class="' + (/deposit/i.test(l.label) ? "dep" : "") + '"><span>' + esc(l.label) + "</span><span>" + money(l.cents) + "</span></li>"; }).join("");
      if (!st.discount && !st.discOpen) sum += '<li><span></span><button type="button" data-disc="1">Add a discount</button></li>';
      if (st.discOpen) sum += '<li class="disc"><label class="sr" for="disc">Discount in dollars</label><input id="disc" type="number" inputmode="decimal" min="0" step="1" placeholder="Discount $" value="' + (st.discount || "") + '"></li>';
      if (q.points_balance >= 100) sum += '<li><label style="display:flex;gap:.6rem;align-items:center;min-height:2.5rem"><input type="checkbox" data-pts="1"' + (st.points ? " checked" : "") + ' style="width:1.2rem;height:1.2rem"> Use ' + (Math.floor(q.points_balance / 100) * 100) + " Glow Points ($" + Math.floor(q.points_balance / 100) * 10 + " off)</label><span></span></li>";
      var tip = tipCents();
      if (tip) sum += '<li><span>Tip</span><span>' + money(tip) + "</span></li>";
      sum += '<li class="due"><span>Balance due</span><strong class="num">' + money(q.due_cents + tip) + "</strong></li>";
    } else sum = '<li class="due"><span>Balance due</span><strong class="num">…</strong></li>';
    var base = tipBase();
    var tips = ["0", "15", "20", "25"].map(function (t) {
      return '<button type="button" class="pill" data-tip="' + t + '" aria-pressed="' + (st.tipMode === t) + '">' + (t === "0" ? "No tip" : t + "%") + "<small>" + (t === "0" ? "Skip it" : money(Math.round(base * Number(t) / 100))) + "</small></button>";
    }).join("") + '<button type="button" class="pill" data-tip="custom" aria-pressed="' + (st.tipMode === "custom") + '">Other<small>Custom</small></button>';
    var methods = (r.card ? '<button type="button" class="pill" data-m="card" aria-pressed="' + (st.method === "card") + '">Card on file<small>' + esc(r.card) + "</small></button>" : "") +
      '<button type="button" class="pill" data-m="cash" aria-pressed="' + (st.method === "cash") + '">Cash<small>In person</small></button>' +
      (LIVE ? '<button type="button" class="pill" data-m="link" aria-pressed="' + (st.method === "link") + '">Pay link<small>on their phone</small></button>' : "") +
      '<button type="button" class="pill" data-m="other" aria-pressed="' + (st.method === "other") + '">Other<small>Zelle, gift card</small></button>';
    root.innerHTML = '<div class="view"><button type="button" class="back" data-back="1">' + I.chev + " Back</button>" +
      '<div class="who"><span class="av" aria-hidden="true">' + esc(initials(r.name || r.email)) + '</span><div><h1>' + esc(r.name || r.email) + "</h1><p>" + esc(fmtTime(r.start_min)) + (dayWord(r.date) ? " · " + esc(dayWord(r.date)) : "") + "</p></div></div>" + chipsHtml(r) +
      '<h2 class="sec"><span>Services</span></h2><ul class="lines">' + svcLines + '</ul><button type="button" class="add" data-sheet="services">' + I.plus + " Add a service</button>" +
      '<h2 class="sec"><span>Products</span></h2><ul class="lines">' + cart + '</ul>' + (INV ? quickHtml() + '<button type="button" class="add" data-sheet="products">' + I.plus + " Browse your shelf</button>" : "") +
      '<ul class="sum">' + sum + "</ul>" +
      '<h2 class="sec"><span>Tip</span></h2><div class="pills">' + tips + "</div>" +
      (st.tipMode === "custom" ? '<div class="tipc"><label class="sr" for="tipc">Tip in dollars</label><input id="tipc" type="number" inputmode="decimal" min="0" step="1" placeholder="Tip $" value="' + (st.tipCustom || "") + '"></div>' : "") +
      '<h2 class="sec"><span>Pay with</span></h2><div class="pills wrap">' + methods + "</div>" +
      '<p class="msg' + (st.bad ? " is-bad" : "") + '" role="status">' + (st.url ? 'Pay link ready: <a href="' + esc(st.url) + '" target="_blank" rel="noopener">open it</a> · <button type="button" class="linkbtn" data-copy="' + esc(st.url) + '" style="text-decoration:underline">Copy</button>' +
        (r.phone ? ' · <a href="sms:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + "?&body=" + encodeURIComponent("Your Lumevina Aesthetics Spa visit: " + st.url) + '">Text it</a>' : "") + ". It’s checked out once they pay." : esc(st.msg || "")) + "</p></div>";
    var pb = document.getElementById("paybar");
    pb.hidden = false;
    var empty = !st.services.length && !st.products.length;
    pb.innerHTML = '<div class="paybar-in"><div class="tot"><span>Total</span><strong class="num">' + money((q ? q.due_cents : 0) + tipCents()) + '</strong></div><button type="button" class="btn btn-solid" data-go="1"' + (st.busy || empty || !q ? " disabled" : "") + ">" + (empty ? "Add what was done" : st.busy ? "One moment…" : esc(goLabel())) + "</button></div>";
  };
  var requote = function () {
    clearTimeout(timer);
    var mine = seq;
    timer = setTimeout(function () {
      var got = LIVE && !cur.sample ? call("studio-book", Object.assign({ action: "quote", id: cur.id }, input(false))).then(function (j) { return j.quote; })
        : Promise.resolve(demoQuote(cur, input(false)));
      got.then(function (quote) { if (mine !== seq || view !== "co") return; st.quote = quote; keepScroll(paintCo); },
        function () { if (mine !== seq || view !== "co") return; st.msg = "Couldn’t work out the total. Check the connection."; st.bad = true; keepScroll(paintCo); });
    }, 120);
  };
  var keepScroll = function (fn) {
    var y = window.pageYOffset, a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
    fn(); window.scrollTo(0, y);
    if (id) { var el = document.getElementById(id); if (el && el.focus) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* number inputs */ } } }
  };

  /* pay and record: live through the server; the demo records it in this browser's books */
  var finish = function (r, method, inp) {
    if (LIVE && !r.sample) {
      return call("studio-book", Object.assign({ action: "checkout", id: r.id, method: method }, inp)).then(function (j) {
        if (j.url) return { url: j.url };
        if (INV && INV.refresh) INV.refresh();
        return { charged: j.quote ? j.quote.charge_cents : 0, tip: inp.tip_cents, points: j.points || 0 };
      });
    }
    var quote = demoQuote(r, inp);
    var tip = inp.tip_cents || 0;
    if (r.sample) { r.status = "completed"; r.balance_paid_cents = quote.due_cents; r.tip_cents = tip; }
    else {
      var settle = lget(SETTLE, {});
      settle[r.id] = { status: "paid", method: method === "card" ? "card" : method === "cash" ? "cash" : "other", at: new Date().toISOString(), paid: quote.due_cents / 100, tip: tip / 100, products: inp.products };
      lset(SETTLE, settle);
    }
    (inp.products || []).forEach(function (p) { if (INV && INV.sell) INV.sell(p.id, p.qty); });
    document.dispatchEvent(new Event("lumevina:books"));
    return Promise.resolve({ charged: quote.due_cents + tip, tip: tip });
  };
  var pay = function () {
    if (st.busy || !st.quote) return;
    if (!st.services.length && !st.products.length) return;
    st.busy = true; st.msg = st.method === "card" ? "Charging the card…" : "Saving…"; st.bad = false; keepScroll(paintCo);
    var inp = input(true), r = cur;
    var sold = st.products.map(function (p) { var it = INV && INV.get(p.id); return { name: it ? it.name : p.id, qty: p.qty, left: it && stockOf(it) !== Infinity ? stockOf(it) - p.qty : null }; });
    var lines = st.quote.lines.slice();
    finish(r, st.method, inp).then(function (res) {
      st.busy = false;
      if (res.url) { st.url = res.url; st.msg = ""; keepScroll(paintCo); return; }
      if (st.tipMode !== "custom") lset("lumevina_co_tip", st.tipMode);   /* her usual tip is already chosen next time */
      paintDone(r, res, lines, sold);
      if (LIVE && !r.sample) load();
    }, function (err) {
      st.busy = false; st.bad = true;
      var reason = err && err.reason;
      st.msg = reason === "no_card" ? "There’s no card on file. Choose cash, a pay link, or ask them for a card."
        : /declin|insufficient|expired|authentication|card/.test(String(reason)) ? "The card didn’t go through (" + String(reason).replace(/_/g, " ") + "). Try a pay link: they pay on their phone."
        : "That didn’t go through. Check the connection and try again.";
      keepScroll(paintCo);
    });
  };

  /* ── 3 · paid ── */
  var paintDone = function (r, res, lines, sold) {
    view = "done"; seq++;
    document.getElementById("paybar").hidden = true; tabsEl.hidden = false;
    var low = sold.filter(function (s) { return s.left != null && s.left <= (INV ? INV.LOW : 3); });
    root.innerHTML = '<div class="view done">' + I.ok + '<p class="kicker">Checked out</p><h1 class="title">' + esc(r.name || r.email) + '</h1><p class="amt num">' + money(res.charged) + "</p>" +
      '<p class="lede">' + (LIVE && !r.sample ? "The receipt is on its way." : "Demo: nothing was charged.") + (res.tip ? " Includes a " + money(res.tip) + " tip." : "") + (res.points ? " " + res.points + " Glow Points earned." : "") + "</p>" +
      "<ul>" + lines.map(function (l) { return "<li><span>" + esc(l.label) + "</span><span>" + money(l.cents) + "</span></li>"; }).join("") + "</ul>" +
      (low.length ? '<p class="stock-note">' + low.map(function (s) { return esc(s.name) + (s.left <= 0 ? " is sold out." : ": " + s.left + " left."); }).join(" ") + " Time to reorder.</p>" : "") +
      '<div class="acts"><button type="button" class="btn btn-solid btn-wide" data-next="1">Next guest</button></div></div>';
    window.scrollTo(0, 0);
  };

  /* ── sheets: add a service, add from the shelf, More ── */
  var layer = document.getElementById("layer");
  var lastFocus = null;
  var closeSheet = function () { layer.innerHTML = ""; document.body.style.overflow = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); };
  var openSheet = function (html, focusSel) {
    lastFocus = document.activeElement;
    layer.innerHTML = '<div class="scrim" data-close="1"></div><div class="sheet" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.style.overflow = "hidden";
    var f = focusSel && layer.querySelector(focusSel); if (f) f.focus();
  };
  var catSel = "", qSel = "";
  var shelf = function () {
    return INV ? INV.live().filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; }) : [];
  };
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
  var moreSheet = function () {
    openSheet('<div class="sheet-h"><h2>More</h2><button type="button" class="done-btn" data-close="1">Close</button></div><div class="sheet-body"><div class="mgrid">' +
      MORE.map(function (m) { return '<a class="mtile" href="' + m[1] + '">' + I[m[2]] + "<span>" + esc(m[0]) + "</span></a>"; }).join("") + "</div></div>");
  };
  var addProduct = function (id, by) {
    var it = INV && INV.get(id); if (!it) return;
    var have = stockOf(it), n = qtyOf(id), next = n + by;
    if (next > have) { toast(have <= 0 ? "That one is out of stock." : "Only " + have + " in stock."); return; }
    st.products = st.products.filter(function (p) { return p.id !== id; });
    if (next > 0) st.products.push({ id: id, qty: next });
    st.quote = st.quote; requote(); keepScroll(paintCo); drawProducts();
  };

  /* ── one listener for everything ── */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a, [data-close]"); if (!t) return;
    var d = t.dataset;
    if (d.close != null) { closeSheet(); return; }
    if (t.id === "tab-more") { moreSheet(); return; }
    if (d.open) { openCheckout(d.open); return; }
    if (d.back) { paintList(); window.scrollTo(0, 0); return; }
    if (d.next) { paintList(); return; }
    if (d.sheet === "products") { productsSheet(); return; }
    if (d.sheet === "services") { servicesSheet(); return; }
    if (d.svc) { st.services.push(d.svc); closeSheet(); requote(); return; }
    if (d.rmsvc != null) { st.services.splice(+d.rmsvc, 1); requote(); keepScroll(paintCo); return; }
    if (d.inc) { addProduct(d.inc, 1); return; }
    if (d.dec) { addProduct(d.dec, -1); return; }
    if (d.padd || d.pinc) { addProduct(d.padd || d.pinc, 1); return; }
    if (d.pdec) { addProduct(d.pdec, -1); return; }
    if (d.cat != null && t.closest(".cats")) { catSel = d.cat; layer.querySelectorAll(".cats .pill").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); }); drawProducts(); return; }
    if (d.disc) { st.discOpen = true; keepScroll(paintCo); var di = document.getElementById("disc"); if (di) di.focus(); return; }
    if (d.tip) { st.tipMode = d.tip; keepScroll(paintCo); if (d.tip === "custom") { var ti = document.getElementById("tipc"); if (ti) ti.focus(); } return; }
    if (d.m) { st.method = d.m; st.url = ""; st.msg = ""; keepScroll(paintCo); return; }
    if (d.go) { pay(); return; }
    if (d.copy) { try { navigator.clipboard.writeText(d.copy); t.textContent = "Copied"; } catch (x) { /* old browser */ } }
  });
  document.addEventListener("change", function (e) {
    if (e.target.dataset && e.target.dataset.pts) { st.points = e.target.checked && st.quote ? Math.floor(st.quote.points_balance / 100) * 100 : 0; requote(); }
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "disc") { st.discount = Math.max(0, Number(t.value) || 0); requote(); }
    else if (t.id === "tipc") { st.tipCustom = Math.max(0, Number(t.value) || 0); keepScroll(paintCo); }
    else if (t.id === "pq") { qSel = t.value; drawProducts(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && layer.firstChild) closeSheet(); });

  if (INV && INV.onChange) INV.onChange(function () { if (view === "co" && !layer.firstChild) return; if (layer.querySelector("#plist")) drawProducts(); });
  if (location.hash === "#new") location.replace("dashboard.html#clients");
  paintList();
  load();
})();

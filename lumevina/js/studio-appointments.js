/* Lumevina — Evelyn's appointments, in her dashboard (v3)
 *
 * The GlossGenius jobs, done here:
 *   Appointments   today and what's coming, and visits still to check out.
 *                  Check out a visit: the services done (change them if
 *                  needed), products from her shelf, a discount, Glow Points,
 *                  a tip (15/20/25% or her own), then pay by the card on
 *                  file, cash, or a pay link the client opens on their phone.
 *                  A no-show or a late cancellation can be charged to the
 *                  card on file ($43). She can cancel (refunding the deposit)
 *                  or ask a client for a card.
 *   Book for a client   a phone or in-person booking, at any time (her hours
 *                  don't apply to her), with an email asking for a card.
 *   Waitlist       who's waiting for a full day.
 *   Clients        import the GlossGenius client list (its CSV export), and
 *                  invite them to book here (100 Glow Points on their first).
 *   Members        (live) every membership with its facials and billing.
 *
 * LIVE (js/site-config.js → shop, and her studio key saved under Lumevina
 * Studio): functions/studio-book and functions/studio. DEMO: this browser's
 * bookings (lumevina_bookings, shared with the website when both run from
 * the same place), with sample appointments until there are real ones.
 */
(function () {
  "use strict";

  var card = document.getElementById("appointments");
  if (!card) return;
  /* v3 only (js/site-config.js → version, or ?preview=v3): in v2 she books
     on GlossGenius, and Settle visits does the after-visit job */
  if (!(window.LumevinaFeatures && window.LumevinaFeatures.version === "v3")) return;
  card.hidden = false;
  var settleCard = document.getElementById("settle");
  if (settleCard) settleCard.hidden = true;
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var SV = window.LUMEVINA_SERVICES || { all: [], get: function () { return null; } };
  var INV = window.LumevinaInventory || null;

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (c) { return "$" + (Math.round(c) / 100).toFixed(c % 100 ? 2 : 0); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var dayKey = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var keyDate = function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var fmtTime = function (m) { return ((Math.floor(m / 60) % 12) || 12) + ":" + pad(m % 60) + " " + (m >= 720 ? "PM" : "AM"); };
  var today = dayKey(new Date());
  var studioKey = function () { try { return localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { return ""; } };
  var call = function (fn, body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": studioKey() },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; if (!r.ok) throw j; return j; }); });
  };
  /* the server keeps phones as +18185550134; show them the usual way */
  var fmtPhone = function (t) { var m = /^\+?1?(\d{3})(\d{3})(\d{4})$/.exec(String(t || "").replace(/[^\d+]/g, "")); return m ? "(" + m[1] + ") " + m[2] + "-" + m[3] : String(t || ""); };
  var svcName = function (id) { var s = SV.get(id); return s ? s.name : id; };
  var svcCents = function (id) { var s = SV.get(id); return s ? Math.round(s.price * 100) : 0; };
  var svcMin = function (id) { var s = SV.get(id); return s ? (s.block || 60) : 60; };
  /* her policy: a late cancellation is $43; a no-show is 50% of the service,
     with a deposit already kept counting toward it (functions/studio-book → fee) */
  var feeCents = function (r) {
    if (r.status !== "no_show") return 4300;
    return Math.max(0, Math.round(r.services.reduce(function (a, id) { return a + svcCents(id); }, 0) * 0.5) - (r.paid_cents || 0));
  };

  /* ── the card's frame ── */
  card.innerHTML =
    '<div class="crm-head"><div><h2>Appointments</h2>' +
    '<p class="sub">Today and what’s coming. Check out a visit with a tip (card on file, cash or a pay link), charge a late-cancel or no-show fee, or book for a client.</p></div>' +
    '<button class="bk-export" type="button" id="ap-new-open">Book for a client</button></div>' +
    '<p class="ap-msg" id="ap-msg" role="status"></p>' +
    '<form class="ap-new" id="ap-new" hidden autocomplete="off"></form>' +
    '<div class="bk-tiles" id="ap-tiles"></div>' +
    '<div id="ap-list"></div>' +
    '<h3 class="ap-h">Waitlist</h3><ul class="ap-wl" id="ap-wl"></ul>';
  var $ = function (id) { return document.getElementById(id); };
  var say = function (t, bad) { var m = $("ap-msg"); m.textContent = t || ""; m.classList.toggle("is-bad", !!bad); };

  /* ── data: live from the server, or this browser's demo bookings ── */
  var rows = [], waitlist = [], sample = false;
  var SETTLE = "lumevina_settlements";
  var lget = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var lset = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  var demoCard = function (email) {
    var P = window.LumevinaPayments, c = P && P.getCard ? P.getCard(email) : null;
    return c ? c.brand + " •••• " + c.last4 : null;
  };
  var demoRows = function () {
    var settle = lget(SETTLE, {});
    var list = lget("lumevina_bookings", []).map(function (b, i) {
      var key = b.order || [b.date, b.time, b.email].join("|");
      var s = settle[key] || {};
      return {
        id: key, idx: i, date: b.date, start_min: b.time, dur_min: b.dur || 60, services: b.services || [],
        names: (b.services || []).map(svcName).join(" + "), name: b.name, email: b.email, phone: b.phone || "",
        note: b.note || "", source: b.source || "web", status: b.cancelled ? "cancelled" : s.status === "paid" ? "completed" : s.status === "no-show" ? "no_show" : "held",
        deposit_cents: Math.round((b.deposit || 0) * 100), paid_cents: Math.round((b.paid || 0) * 100), total_cents: Math.round((b.total || 0) * 100),
        card: demoCard(b.email), membership_facial: !!b.memberCredit, member: b.memberCredit ? { plan: b.memberCredit } : null,
        intake: !!(lget("lumevina_intake", {})[String(b.email || "").toLowerCase()]), cancel_kind: b.cancelKind || null,
        fee_cents: s.fee ? Math.round(s.fee * 100) : null, balance_paid_cents: s.paid != null ? Math.round(s.paid * 100) : null, tip_cents: s.tip ? Math.round(s.tip * 100) : 0,
        checkout: s.status === "paid" ? { method: s.method } : null
      };
    });
    if (list.length) return list;
    /* samples, so the card shows how it works until real bookings arrive */
    sample = true;
    var d = function (n) { var x = new Date(); x.setDate(x.getDate() + n); return dayKey(x); };
    return [
      { id: "s1", date: d(0), start_min: 720, dur_min: 60, services: ["lumevina-custom-facial"], names: "Lumevina Custom Facial", name: "Maya Chen", email: "maya@example.com", phone: "(818) 555-0101",
        status: "held", deposit_cents: 0, paid_cents: 0, card: "Visa •••• 4242", member: { plan: "Glow" }, membership_facial: true, intake: true, note: "" },
      { id: "s2", date: d(0), start_min: 870, dur_min: 60, services: ["brazilian-wax"], names: "Brazilian Wax", name: "Jordan Ellis", email: "jordan@example.com", phone: "",
        status: "held", deposit_cents: 3000, paid_cents: 3000, card: "Mastercard •••• 5555", intake: false, from_glossgenius: true, note: "First time on the website" },
      { id: "s3", date: d(-1), start_min: 660, dur_min: 90, services: ["ageless-grace-facial"], names: "Ageless Grace Facial", name: "Priya Shah", email: "priya@example.com",
        status: "held", deposit_cents: 0, paid_cents: 0, card: null, intake: true, note: "" },
      { id: "s4", date: d(2), start_min: 600, dur_min: 60, services: ["brazilian-wax"], name: "Ana Ruiz", names: "Brazilian Wax", email: "ana@example.com",
        status: "cancelled", cancel_kind: "late", deposit_cents: 3000, paid_cents: 3000, card: "Visa •••• 4242", note: "" },
      { id: "s5", date: d(3), start_min: 960, dur_min: 60, services: ["monthly-acne-treatment"], names: "Monthly Acne Treatment", name: "Leo Park", email: "leo@example.com",
        status: "held", deposit_cents: 3000, paid_cents: 3000, card: "Visa •••• 1881", intake: true, note: "" }
    ].map(function (r) { r.sample = true; return r; });
  };

  var load = function () {
    if (!LIVE) {
      sample = false;
      rows = demoRows();
      waitlist = lget("lumevina_waitlist", []).filter(function (w) { return w.status !== "removed" && w.date >= today; });
      paint();
      return;
    }
    if (!studioKey()) { rows = []; waitlist = []; paint(); say("Save your studio key under Lumevina Studio above, and your appointments show up here."); return; }
    var from = new Date(); from.setDate(from.getDate() - 14);
    var to = new Date(); to.setDate(to.getDate() + 45);
    call("studio-book", { action: "list", from: dayKey(from), to: dayKey(to) }).then(function (j) {
      rows = j.bookings || [];
      return call("studio-book", { action: "waitlist" });
    }).then(function (j) {
      waitlist = j.waitlist || [];
      if ($("ap-msg").classList.contains("is-bad")) say("");   /* a success message stays */
      paint();
    }, function (e) {
      say(e && e.reason === "studio_key" ? "That studio key wasn’t accepted. Save it again under Lumevina Studio." : "Couldn’t load appointments. Check the connection.", true);
      paint();
    });
  };

  /* ── the list ── */
  var open = {};   /* row id → "checkout" | "more" */
  var dayTitle = function (k) {
    if (k === today) return "Today";
    var t = new Date(); t.setDate(t.getDate() + 1);
    if (k === dayKey(t)) return "Tomorrow";
    return keyDate(k).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };
  var rowHtml = function (r) {
    var badges = [];
    if (r.member) badges.push('<span class="cq-pill cq-pill--member">' + esc(r.member.plan || "Member") + "</span>");
    if (r.from_glossgenius) badges.push('<span class="cq-pill">From GlossGenius</span>');
    if (r.source === "admin") badges.push('<span class="cq-pill">You booked it</span>');
    var facts = [];
    facts.push(r.card ? "Card: " + esc(r.card) : '<span class="ap-warn">No card on file</span>');
    facts.push(r.intake ? "Form ✓" : '<span class="ap-warn">No pre-visit form</span>');
    if (r.membership_facial) facts.push("Membership facial");
    else if (r.paid_cents) facts.push("Deposit " + money(r.paid_cents));
    if (r.phone) facts.push('<a href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + '">' + esc(fmtPhone(r.phone)) + "</a>");
    var state = "", acts = [];
    if (r.status === "completed") state = "Done" + (r.balance_paid_cents != null ? " · " + money(r.balance_paid_cents) : "") + (r.tip_cents ? " + " + money(r.tip_cents) + " tip" : "") + (r.checkout && r.checkout.method ? " · " + r.checkout.method : "");
    else if (r.status === "no_show") state = "No-show" + (r.fee_cents ? " · fee " + money(r.fee_cents) + " charged" : "");
    else if (r.status === "cancelled") state = (r.cancel_kind === "late" ? "Late cancellation" : r.cancel_kind === "evelyn" ? "You cancelled it" : "Cancelled") + (r.fee_cents ? " · fee " + money(r.fee_cents) + " charged" : "");
    if (r.status === "held" && r.date <= today) acts.push('<button type="button" class="bk-export" data-ap="checkout">Check out</button>');
    if (r.status === "held" && r.date <= today) acts.push('<button type="button" class="settle-btn settle-btn--bad" data-ap="noshow">No-show</button>');
    var feeDue = (r.status === "no_show" || (r.status === "cancelled" && r.cancel_kind === "late")) && !r.fee_cents;
    if (feeDue && feeCents(r) < 100) state += " · the deposit kept covers the fee";
    else if (feeDue && r.card) acts.push('<button type="button" class="settle-btn" data-ap="fee">Charge the ' + money(feeCents(r)) + " fee</button>");
    if (r.status === "held" && !r.card) acts.push('<button type="button" class="settle-btn" data-ap="cardlink">Ask for a card</button>');
    if (r.status === "held") acts.push('<button type="button" class="settle-btn" data-ap="cancel">Cancel</button>');
    return '<li class="ap-row is-' + esc(r.status) + '" data-id="' + esc(r.id) + '">' +
      '<div class="ap-time">' + fmtTime(r.start_min) + '<small>' + r.dur_min + " min</small></div>" +
      '<div class="ap-main"><div class="ap-who"><strong>' + esc(r.name || r.email) + "</strong>" + badges.join("") + "</div>" +
      '<div class="ap-what">' + esc(r.names) + "</div>" +
      '<div class="ap-facts">' + facts.join(" · ") + "</div>" +
      (r.note ? '<div class="ap-note">“' + esc(r.note) + "”</div>" : "") +
      (state ? '<div class="ap-state">' + esc(state) + "</div>" : "") +
      (acts.length ? '<div class="ap-acts">' + acts.join("") + "</div>" : "") +
      '<div class="ap-panel" hidden></div></div></li>';
  };
  var paint = function () {
    var held = rows.filter(function (r) { return r.status === "held"; });
    var due = held.filter(function (r) { return r.date < today; });
    var week = new Date(); week.setDate(week.getDate() + 7);
    var tiles = [
      { l: "Today", v: String(rows.filter(function (r) { return r.date === today && r.status !== "cancelled"; }).length) },
      { l: "Next 7 days", v: String(held.filter(function (r) { return r.date >= today && r.date <= dayKey(week); }).length) },
      { l: "To check out", v: String(due.length), flag: due.length > 0 },
      { l: "Waitlist", v: String(waitlist.length) }
    ];
    $("ap-tiles").innerHTML = tiles.map(function (t) {
      return '<div class="bk-tile' + (t.flag ? " bk-tile--flag" : "") + '"><div class="bk-tv">' + t.v + '</div><div class="bk-tl">' + t.l + "</div></div>";
    }).join("");
    var groups = [];
    if (due.length) groups.push({ t: "Still to check out", list: due });
    var upcoming = rows.filter(function (r) { return r.date >= today; }).sort(function (a, b) { return (a.date + pad(a.start_min / 30)).localeCompare(b.date + pad(b.start_min / 30)) || a.start_min - b.start_min; });
    var by = {};
    upcoming.forEach(function (r) { (by[r.date] = by[r.date] || []).push(r); });
    Object.keys(by).sort().forEach(function (k) { groups.push({ t: dayTitle(k), list: by[k] }); });
    var recent = rows.filter(function (r) { return r.date < today && r.status !== "held"; }).slice(-6).reverse();
    $("ap-list").innerHTML = (groups.length ? groups.map(function (g) {
      return '<h3 class="ap-h">' + esc(g.t) + '</h3><ul class="ap-ul">' + g.list.map(rowHtml).join("") + "</ul>";
    }).join("") : '<p class="cq-empty">No appointments yet. Bookings from the website, and the ones you make here, show up in this list.</p>') +
      (recent.length ? '<details class="cq-done"><summary>Recent (' + recent.length + ")</summary><ul class=\"ap-ul\">" + recent.map(rowHtml).join("") + "</ul></details>" : "") +
      (sample ? '<p class="sub" style="margin-top:0.8rem">Sample appointments until real bookings arrive.</p>' : "");
    $("ap-wl").innerHTML = waitlist.length ? waitlist.map(function (w) {
      return '<li><span><strong>' + esc(dayTitle(w.date)) + "</strong> · " + esc(w.name) + (w.names || (w.services || []).length ? " · " + esc(w.names || w.services.map(svcName).join(" + ")) : "") +
        '</span><span class="ap-wl-c">' + esc(w.email) + (w.phone ? " · " + esc(fmtPhone(w.phone)) : "") + (w.status === "offered" ? " · offered a time" : "") +
        '</span><button type="button" class="settle-btn" data-wl="' + esc(w.id) + '">Remove</button></li>';
    }).join("") : '<li class="cq-empty">Nobody waiting. When a day is full, clients can join the waitlist; a cancellation emails them first.</li>';
    Object.keys(open).forEach(function (id) { var li = card.querySelector('.ap-row[data-id="' + id + '"]'); if (li && open[id] === "checkout") showCheckout(li); });
  };
  var rowOf = function (li) { var id = li.getAttribute("data-id"); for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === id) return rows[i]; return null; };

  /* ── checkout ── */
  var demoQuote = function (r, input) {
    var lines = [], due = 0;
    var ids = input.services && input.services.length ? input.services : r.services;
    ids.forEach(function (id) { lines.push({ label: svcName(id), cents: svcCents(id) }); due += svcCents(id); });
    if (r.membership_facial && ids.length) { var c = svcCents(ids[0]); lines.push({ label: "Membership facial", cents: -c }); due -= c; }
    (input.products || []).forEach(function (p) { var it = INV && INV.get(p.id); if (!it) return; var c = Math.round(it.price * 100) * p.qty; lines.push({ label: it.name + " × " + p.qty, cents: c }); due += c; });
    var disc = Math.min(Math.max(0, due), Math.round(input.discount_cents || 0));
    if (disc) { lines.push({ label: "Discount", cents: -disc }); due -= disc; }
    var dep = Math.min(Math.max(0, due), r.paid_cents || 0);
    if (dep) { lines.push({ label: "Deposit, paid when booking", cents: -dep }); due -= dep; }
    due = Math.max(0, due);
    var tip = Math.max(0, Math.round(input.tip_cents || 0));
    return { lines: lines, due_cents: due, tip_cents: tip, charge_cents: due + tip, points_balance: 0, card: r.card };
  };
  var showCheckout = function (li) {
    var r = rowOf(li);
    if (!r) return;
    var panel = li.querySelector(".ap-panel");
    open[r.id] = "checkout";
    var st = { services: r.services.slice(), products: [], discount: 0, tipMode: "20", tipCustom: 0, method: r.card ? "card" : "cash", points: 0, quote: null };
    var prodOpts = INV ? INV.live().filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; })
      .map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.brand + " " + p.name) + " · $" + p.price + "</option>"; }).join("") : "";
    var svcOpts = SV.all.filter(function (s) { return !s.ask; }).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + " · $" + s.price + "</option>"; }).join("");
    panel.hidden = false;
    panel.innerHTML =
      '<div class="ap-co">' +
      '<div class="ap-co-row"><span class="ap-k">Services</span><div class="ap-chips" data-co="svcs"></div>' +
      '<select data-co="addsvc" aria-label="Add a service"><option value="">+ Add a service</option>' + svcOpts + "</select></div>" +
      '<div class="ap-co-row"><span class="ap-k">Products</span><div class="ap-chips" data-co="prods"></div>' +
      (prodOpts ? '<select data-co="addprod" aria-label="Add a product"><option value="">+ Add from your shelf</option>' + prodOpts + "</select>" : "") + "</div>" +
      '<div class="ap-co-row"><label class="ap-k" for="co-disc-' + esc(r.id) + '">Discount</label><input id="co-disc-' + esc(r.id) + '" data-co="disc" type="number" min="0" step="1" placeholder="$0" inputmode="decimal"></div>' +
      '<div class="ap-co-row ap-pts" hidden><label><input type="checkbox" data-co="pts"> <span data-co="ptsl"></span></label></div>' +
      '<div class="ap-co-row"><span class="ap-k">Tip</span><div class="ap-seg" data-co="tip">' +
      ["0", "15", "20", "25", "custom"].map(function (t) { return '<button type="button" data-tip="' + t + '"' + (t === "20" ? ' class="on"' : "") + ">" + (t === "0" ? "No tip" : t === "custom" ? "Other" : t + "%") + "</button>"; }).join("") +
      '</div><input data-co="tipc" type="number" min="0" step="1" placeholder="$" hidden inputmode="decimal" aria-label="Tip in dollars"></div>' +
      '<div class="ap-co-row"><span class="ap-k">Pay with</span><div class="ap-seg" data-co="method">' +
      (r.card ? '<button type="button" data-m="card"' + (st.method === "card" ? ' class="on"' : "") + ">" + esc(r.card) + "</button>" : "") +
      '<button type="button" data-m="cash"' + (st.method === "cash" ? ' class="on"' : "") + ">Cash</button>" +
      (LIVE ? '<button type="button" data-m="link">Pay link</button>' : "") +
      '<button type="button" data-m="other">Other</button></div></div>' +
      '<ul class="ap-lines" data-co="lines"></ul>' +
      '<div class="ap-co-go"><button type="button" class="bk-export" data-co="go">…</button><button type="button" class="settle-btn" data-co="close">Close</button></div>' +
      '<p class="ap-co-msg" data-co="msg" role="status"></p></div>';
    var q = function (k) { return panel.querySelector('[data-co="' + k + '"]'); };
    var tipCents = function (due) {
      if (st.tipMode === "custom") return Math.round((st.tipCustom || 0) * 100);
      return Math.round(due * Number(st.tipMode) / 100);
    };
    var input = function (withTip) {
      return { services: st.services, products: st.products, discount_cents: Math.round(st.discount * 100), points: st.points,
        tip_cents: withTip ? tipCents(st.quote ? st.quote.due_cents : 0) : 0 };
    };
    var drawChips = function () {
      q("svcs").innerHTML = st.services.map(function (id, i) { return '<span class="ap-chip">' + esc(svcName(id)) + '<button type="button" data-rmsvc="' + i + '" aria-label="Remove ' + esc(svcName(id)) + '">&times;</button></span>'; }).join("");
      q("prods").innerHTML = st.products.map(function (p, i) { var it = INV && INV.get(p.id); return '<span class="ap-chip">' + esc((it ? it.name : p.id) + " × " + p.qty) + '<button type="button" data-rmprod="' + i + '" aria-label="Remove">&times;</button></span>'; }).join("");
    };
    var timer = null;
    var requote = function () {
      drawChips();
      clearTimeout(timer);
      timer = setTimeout(function () {
        var got = LIVE && !r.sample ? call("studio-book", Object.assign({ action: "quote", id: r.id }, input(false))).then(function (j) { return j.quote; })
          : Promise.resolve(demoQuote(r, input(false)));
        got.then(function (quote) {
          st.quote = quote;
          var tip = tipCents(quote.due_cents);
          q("lines").innerHTML = quote.lines.map(function (l) { return "<li><span>" + esc(l.label) + "</span><span>" + (l.cents < 0 ? "−" : "") + money(Math.abs(l.cents)) + "</span></li>"; }).join("") +
            '<li class="ap-sum"><span>Due</span><span>' + money(quote.due_cents) + "</span></li>" +
            (tip ? "<li><span>Tip</span><span>" + money(tip) + "</span></li>" : "") +
            '<li class="ap-total"><span>Total</span><span>' + money(quote.due_cents + tip) + "</span></li>";
          var pts = panel.querySelector(".ap-pts");
          var bal = quote.points_balance || 0;
          pts.hidden = bal < 100 && !st.points;
          q("ptsl").textContent = "Use " + (Math.floor(bal / 100) * 100) + " Glow Points ($" + Math.floor(bal / 100) * 10 + " off) · they have " + bal;
          var total = money(quote.due_cents + tip);
          q("go").textContent = st.method === "card" ? "Charge " + total + " to " + r.card : st.method === "cash" ? "Record " + total + " cash"
            : st.method === "link" ? "Make a pay link for " + total : "Record " + total + " paid";
        }, function () { q("msg").textContent = "Couldn’t work out the total. Check the connection."; });
      }, 200);
    };
    panel.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.co === "addsvc" && t.value) { st.services.push(t.value); t.value = ""; requote(); }
      if (t.dataset.co === "addprod" && t.value) {
        var had = st.products.filter(function (p) { return p.id === t.value; })[0];
        if (had) had.qty++; else st.products.push({ id: t.value, qty: 1 });
        t.value = ""; requote();
      }
      if (t.dataset.co === "pts") { st.points = t.checked && st.quote ? Math.floor(st.quote.points_balance / 100) * 100 : 0; requote(); }
    });
    panel.addEventListener("input", function (e) {
      var t = e.target;
      if (t.dataset.co === "disc") { st.discount = Math.max(0, Number(t.value) || 0); requote(); }
      if (t.dataset.co === "tipc") { st.tipCustom = Math.max(0, Number(t.value) || 0); requote(); }
    });
    panel.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.rmsvc != null) { st.services.splice(+t.dataset.rmsvc, 1); requote(); return; }
      if (t.dataset.rmprod != null) { st.products.splice(+t.dataset.rmprod, 1); requote(); return; }
      if (t.dataset.tip) {
        st.tipMode = t.dataset.tip;
        q("tip").querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === t); });
        q("tipc").hidden = st.tipMode !== "custom";
        if (st.tipMode === "custom") q("tipc").focus();
        requote(); return;
      }
      if (t.dataset.m) {
        st.method = t.dataset.m;
        q("method").querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === t); });
        requote(); return;
      }
      if (t.dataset.co === "close") { delete open[r.id]; panel.hidden = true; panel.innerHTML = ""; return; }
      if (t.dataset.co === "go") {
        if (!st.services.length && !st.products.length) { q("msg").textContent = "Add what was done first."; return; }
        t.disabled = true;
        q("msg").textContent = st.method === "card" ? "Charging the card…" : "Saving…";
        finish(r, st.method, input(true)).then(function (res) {
          t.disabled = false;
          if (res.url) {
            q("msg").innerHTML = 'Pay link ready: <a href="' + esc(res.url) + '" target="_blank" rel="noopener">open it</a> · <button type="button" class="settle-btn" data-copy="' + esc(res.url) + '">Copy</button>' +
              (r.phone ? ' · <a href="sms:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + "?&body=" + encodeURIComponent("Your Lumevina visit: " + res.url) + '">Text it to ' + esc(String(r.name || "").split(" ")[0]) + "</a>" : "") +
              ". It’s checked out once they pay.";
            return;
          }
          delete open[r.id];
          say("Checked out: " + (r.name || r.email) + ", " + money(res.charged) + (res.tip ? " (" + money(res.tip) + " tip)" : "") + (res.points ? ", " + res.points + " Glow Points earned" : "") + ". The receipt is on its way.");
          load();
        }, function (err) {
          t.disabled = false;
          var reason = err && err.reason;
          q("msg").textContent = reason === "no_card" ? "There’s no card on file. Choose cash, a pay link, or ask them for a card."
            : /declin|insufficient|expired|authentication|card/.test(String(reason)) ? "The card didn’t go through (" + String(reason).replace(/_/g, " ") + "). Try a pay link: they pay on their phone."
            : "That didn’t go through. Check the connection and try again.";
        });
      }
      if (t.dataset.copy) { try { navigator.clipboard.writeText(t.dataset.copy); t.textContent = "Copied"; } catch (e2) { /* old browser */ } }
    });
    requote();
  };

  /* pay and record: live through the server; the demo records it in this browser's books */
  var finish = function (r, method, input) {
    if (LIVE && !r.sample) {
      return call("studio-book", Object.assign({ action: "checkout", id: r.id, method: method }, input)).then(function (j) {
        if (j.url) return { url: j.url };
        return { charged: j.quote ? j.quote.charge_cents : 0, tip: input.tip_cents, points: j.points || 0 };
      });
    }
    var quote = demoQuote(r, input);
    if (r.sample) { r.status = "completed"; r.balance_paid_cents = quote.due_cents; r.tip_cents = quote.tip_cents; r.checkout = { method: method }; return Promise.resolve({ charged: quote.charge_cents, tip: quote.tip_cents }); }
    var settle = lget(SETTLE, {});
    settle[r.id] = { status: "paid", method: method === "card" ? "card" : method === "cash" ? "cash" : "other", at: new Date().toISOString(),
      paid: quote.due_cents / 100, tip: quote.tip_cents / 100, products: input.products };
    lset(SETTLE, settle);
    (input.products || []).forEach(function (p) { if (INV && INV.sell) INV.sell(p.id, p.qty); });
    document.dispatchEvent(new Event("lumevina:books"));
    return Promise.resolve({ charged: quote.charge_cents, tip: quote.tip_cents });
  };

  /* ── the other actions ── */
  card.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.id === "ap-new-open") { toggleNew(); return; }
    if (b.dataset.wl) {
      var id = b.dataset.wl;
      if (LIVE) call("studio-book", { action: "waitlist_remove", id: id }).then(load);
      else { var wl = lget("lumevina_waitlist", []); wl.forEach(function (w) { if (w.id === id) w.status = "removed"; }); lset("lumevina_waitlist", wl); load(); }
      return;
    }
    var li = b.closest(".ap-row");
    if (!li || !b.dataset.ap) return;
    var r = rowOf(li);
    if (!r) return;
    var act = b.dataset.ap;
    if (act === "checkout") { showCheckout(li); return; }
    var two = function (label, run) {
      if (b.dataset.arm !== "1") { b.dataset.arm = "1"; b.textContent = label; return; }
      b.disabled = true;
      run();
    };
    var done = function (msg) { say(msg); load(); };
    var fail = function (err) { b.disabled = false; say(err && err.reason === "no_card" ? "There’s no card on file for that." : err && err.reason === "covered" ? "The deposit kept already covers that fee." : "That didn’t go through" + (err && err.reason ? " (" + String(err.reason).replace(/_/g, " ") + ")" : "") + ".", true); };
    if (act === "noshow") two("Tap again: mark no-show", function () {
      if (LIVE && !r.sample) call("studio-book", { action: "no_show", id: r.id }).then(function () { done("Marked no-show. The fee is 50% of the service, less the deposit kept."); }, fail);
      else { if (r.sample) r.status = "no_show"; else { var s = lget(SETTLE, {}); s[r.id] = { status: "no-show", at: new Date().toISOString() }; lset(SETTLE, s); } if (r.sample) paint(); else done("Marked no-show."); }
    });
    var fee = feeCents(r);
    if (act === "fee") two("Tap again: charge " + money(fee) + " to " + r.card, function () {
      if (LIVE && !r.sample) call("studio-book", { action: "fee", id: r.id, kind: r.status === "no_show" ? "no_show" : "late_cancel" }).then(function (j) { done("Charged the " + money(j.cents || fee) + " fee to " + r.card + ". They’re emailed a receipt."); }, fail);
      else { r.fee_cents = fee; if (!r.sample) { var s2 = lget(SETTLE, {}); s2[r.id] = Object.assign(s2[r.id] || { status: "no-show" }, { fee: fee / 100 }); lset(SETTLE, s2); } paint(); say("Demo: the " + money(fee) + " fee would be charged to " + r.card + "."); }
    });
    if (act === "cancel") two(r.paid_cents ? "Tap again: cancel and refund " + money(r.paid_cents) : "Tap again: cancel it", function () {
      if (LIVE && !r.sample) call("studio-book", { action: "cancel", id: r.id }).then(function () { done("Cancelled. " + (r.name || "They") + " is emailed" + (r.paid_cents ? ", and the deposit is refunded" : "") + "."); }, fail);
      else {
        if (r.sample) { r.status = "cancelled"; r.cancel_kind = "evelyn"; paint(); return; }
        var all = lget("lumevina_bookings", []);
        if (all[r.idx]) { all[r.idx].cancelled = true; all[r.idx].cancelKind = "evelyn"; lset("lumevina_bookings", all); }
        done("Cancelled.");
      }
    });
    if (act === "cardlink") {
      b.disabled = true;
      if (LIVE && !r.sample) call("studio-book", { action: "card_link", id: r.id }).then(function () { done("Emailed " + r.email + " a link to add a card."); }, fail);
      else { b.disabled = false; say("Demo: " + r.email + " would get an email with a link to put a card on file."); }
    }
  });

  /* ── book for a client ── */
  var toggleNew = function () {
    var f = $("ap-new");
    if (!f.hidden) { f.hidden = true; return; }
    var t = new Date(); t.setDate(t.getDate() + 1);
    var opts = SV.all.filter(function (s) { return !s.addon; }).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + " · " + s.min + " min · $" + s.price + "</option>"; }).join("");
    f.innerHTML =
      '<div class="ap-grid">' +
      '<label>Name<input name="name" required autocomplete="off"></label>' +
      '<label>Email<input name="email" type="email" required autocomplete="off"></label>' +
      '<label>Mobile<input name="phone" type="tel" autocomplete="off" placeholder="(818) 555-0134"></label>' +
      '<label>Treatment<select name="svc" required>' + opts + "</select></label>" +
      '<label>And<select name="svc2"><option value="">(nothing else)</option>' + opts + "</select></label>" +
      '<label>Day<input name="date" type="date" required value="' + dayKey(t) + '"></label>' +
      '<label>Time<input name="time" type="time" required step="1800" value="12:00"></label>' +
      '<label class="ap-wide">Note (they see it in their confirmation)<input name="note" autocomplete="off" placeholder="Booked by phone"></label>' +
      "</div>" +
      '<label class="ap-check"><input type="checkbox" name="sms"> Text them a reminder the day before</label>' +
      '<label class="ap-check"><input type="checkbox" name="card" checked> Email them a link to put a card on file (if there isn’t one)</label>' +
      '<div class="ap-co-go"><button class="bk-export" type="submit">Book it</button><button type="button" class="settle-btn" data-close-new>Close</button></div>';
    f.hidden = false;
    f.querySelector("[name=name]").focus();
    f.querySelector("[data-close-new]").addEventListener("click", function () { f.hidden = true; });
  };
  $("ap-new").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, v = function (n) { return f.elements[n].value.trim(); };
    var services = [v("svc")].concat(v("svc2") ? [v("svc2")] : []);
    var hm = v("time").split(":"), start = (+hm[0]) * 60 + (+hm[1] || 0);
    if (!v("name") || !f.elements.email.checkValidity() || !v("email") || !v("date") || isNaN(start)) { say("Add their name, email, the day and the time.", true); return; }
    start = Math.round(start / 30) * 30;
    var btn = f.querySelector("[type=submit]");
    btn.disabled = true;
    var body = { action: "book", services: services, date: v("date"), start_min: start, name: v("name"), email: v("email"), phone: v("phone"),
      sms_ok: f.elements.sms.checked, note: v("note"), request_card: f.elements.card.checked };
    var ok = function (msg) { btn.disabled = false; f.hidden = true; say(msg); load(); };
    if (LIVE) {
      call("studio-book", body).then(function (j) {
        ok("Booked " + body.name + " for " + svcName(services[0]) + ", " + dayTitle(body.date) + " at " + fmtTime(start) + ". " +
          (j.card ? "Their " + j.card + " holds it." : j.card_link_sent ? "They’re emailed the confirmation and a link to add a card." : "They’re emailed the confirmation."));
      }, function (err) { btn.disabled = false; say(err && err.reason === "slot_taken" ? "That time overlaps another appointment (with your 30 minutes to clean). Pick another." : "That didn’t book. Check the details and try again.", true); });
      return;
    }
    /* demo: on this browser's calendar, so the website sees the time as taken */
    var all = lget("lumevina_bookings", []);
    var dur = services.reduce(function (a, id) { return a + svcMin(id); }, 0);
    var clash = all.some(function (b) { return !b.cancelled && b.date === body.date && start < b.time + b.dur + 30 && b.time < start + dur + 30; });
    if (clash) { btn.disabled = false; say("That time overlaps another appointment (with your 30 minutes to clean). Pick another.", true); return; }
    all.push({ order: "LUM-STUDIO-" + Date.now().toString(36).toUpperCase(), source: "admin", date: body.date, time: start, dur: dur, services: services,
      name: body.name, email: body.email, phone: body.phone, sms: body.sms_ok, note: body.note, deposit: 0, paid: 0,
      total: services.reduce(function (a, id) { return a + svcCents(id) / 100; }, 0) });
    lset("lumevina_bookings", all);
    ok("Booked " + body.name + " (demo: on this browser’s calendar; live, they get the confirmation" + (body.request_card ? " and a card link" : "") + ").");
  });

  window.addEventListener("storage", function (e) { if (!LIVE && /lumevina_(bookings|waitlist|settlements)/.test(e.key || "")) load(); });
  document.addEventListener("lumevina:studio-key", load);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && LIVE) load(); });
  load();

  /* ══ Clients: bring them over from GlossGenius, and invite them ══ */
  var imp = document.getElementById("clients-import");
  if (imp) {
    imp.hidden = false;
    imp.innerHTML =
      '<h3 class="ap-h">Bring your GlossGenius clients over</h3>' +
      '<p class="sub">In GlossGenius, export your client list (a CSV file), then choose it here. Names, emails, phones, birthdays, notes and visit history come across; nothing is sent to anyone yet.</p>' +
      '<div class="ap-co-go"><label class="bk-export ap-file">Choose the CSV<input type="file" accept=".csv,text/csv" id="imp-file"></label>' +
      '<button type="button" class="settle-btn" id="imp-go" hidden>Import</button></div>' +
      '<p class="ap-co-msg" id="imp-msg" role="status"></p>' +
      '<h3 class="ap-h">Invite them to book here</h3>' +
      '<p class="sub">One email to each imported client who hasn’t booked on the website yet: booking takes a minute here, and their first booking comes with 100 Glow Points. Anything already booked on GlossGenius stands. Each client gets it once, with a link to stop emails.</p>' +
      '<div class="ap-co-go"><button type="button" class="bk-export" id="invite-go" disabled>Invite</button><span class="ap-co-msg" id="invite-msg"></span></div>';
    var parsed = [];
    /* a small CSV reader: quoted fields, commas and line breaks inside quotes */
    var readCsv = function (text) {
      var out = [], row = [], cell = "", q = false;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
        if (ch === '"') q = true;
        else if (ch === ",") { row.push(cell); cell = ""; }
        else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
        else cell += ch;
      }
      if (cell || row.length) { row.push(cell); out.push(row); }
      return out.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
    };
    /* GlossGenius's column names vary a little; match them loosely */
    var col = function (head, tests) {
      for (var i = 0; i < head.length; i++) { var h = head[i].toLowerCase(); if (tests.some(function (t) { return t.test(h); })) return i; }
      return -1;
    };
    var toRows = function (table) {
      var head = table[0] || [], at = function (r, i) { return i === -1 ? "" : String(r[i] || "").trim(); };
      var ci = {
        first: col(head, [/^first/]), last: col(head, [/^last name|^last$|surname/]), name: col(head, [/^(client )?name$|full name/]),
        email: col(head, [/e-?mail/]), phone: col(head, [/phone|mobile|cell/]), birthday: col(head, [/birth/]),
        notes: col(head, [/note/]), last_visit: col(head, [/last (visit|appointment|appt|booked)/]), visits: col(head, [/(total|number of|#) ?(visits|appointments|appts)|^visits$|^appointments$/]),
        sms: col(head, [/sms|text/])
      };
      return table.slice(1).map(function (r) {
        var name = ci.name !== -1 ? at(r, ci.name) : (at(r, ci.first) + " " + at(r, ci.last)).trim();
        return { name: name, email: at(r, ci.email).toLowerCase(), phone: at(r, ci.phone), birthday: at(r, ci.birthday), notes: at(r, ci.notes),
          last_visit: at(r, ci.last_visit), visits: Number(at(r, ci.visits)) || 0, sms_ok: /^(y|yes|true|1|opted in)/i.test(at(r, ci.sms)) };
      });
    };
    $("imp-file").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      f.text().then(function (text) {
        var all = toRows(readCsv(text));
        parsed = all.filter(function (r) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email); });
        $("imp-msg").textContent = parsed.length
          ? "Found " + parsed.length + " clients with an email" + (all.length > parsed.length ? " (" + (all.length - parsed.length) + " without one are skipped)" : "") + ". Ready to import."
          : "No clients with an email in that file. Is it the client export?";
        $("imp-go").hidden = !parsed.length;
      });
    });
    /* how many are left to invite; after a send, `said` is the line to show */
    var countInvites = function (said) {
      var show = function (n, none) {
        $("invite-go").disabled = !n; $("invite-go").textContent = n ? "Invite " + n + " clients" : "Invite";
        $("invite-msg").textContent = said || (n ? "" : none);
      };
      if (LIVE) {
        if (!studioKey()) return;
        call("studio", { action: "invite", dry: true }).then(function (j) { show(j.count, "Nobody to invite right now."); },
          function () { /* the key message shows in Appointments */ });
        return;
      }
      var all = lget("lumevina_contacts", []);
      show(all.filter(function (c) { return !c.invited; }).length, all.length ? "Everyone you imported has been invited." : "Import your clients first.");
    };
    $("imp-go").addEventListener("click", function () {
      var btn = $("imp-go"); btn.disabled = true;
      $("imp-msg").textContent = "Importing…";
      if (LIVE) {
        var chunks = [], added = 0, updated = 0, skipped = 0;
        for (var i = 0; i < parsed.length; i += 500) chunks.push(parsed.slice(i, i + 500));
        chunks.reduce(function (p, chunk) {
          return p.then(function () { return call("studio", { action: "import_clients", rows: chunk }).then(function (j) { added += j.added; updated += j.updated; skipped += j.skipped; }); });
        }, Promise.resolve()).then(function () {
          btn.disabled = false; btn.hidden = true;
          $("imp-msg").textContent = "Imported: " + added + " new, " + updated + " already here (filled in)" + (skipped ? ", " + skipped + " skipped" : "") + ".";
          countInvites();
        }, function () { btn.disabled = false; $("imp-msg").textContent = "The import stopped partway. Choose Import again: it picks up where it left off."; });
        return;
      }
      var have = lget("lumevina_contacts", []), byEmail = {};
      have.forEach(function (c) { byEmail[c.email] = c; });
      var add = 0;
      parsed.forEach(function (r) { if (!byEmail[r.email]) { byEmail[r.email] = Object.assign({ source: "glossgenius", imported: new Date().toISOString() }, r); add++; } });
      lset("lumevina_contacts", Object.keys(byEmail).map(function (k) { return byEmail[k]; }));
      btn.disabled = false; btn.hidden = true;
      $("imp-msg").textContent = "Imported " + add + " clients into this browser (demo; live, they go to your client list on the server).";
      countInvites();
    });
    $("invite-go").addEventListener("click", function () {
      var btn = $("invite-go");
      if (btn.dataset.arm !== "1") { btn.dataset.arm = "1"; btn.textContent = "Tap again to send"; return; }
      btn.disabled = true; btn.dataset.arm = "";
      if (LIVE) {
        call("studio", { action: "invite", limit: 200 }).then(function (j) { countInvites("Sent " + j.sent + " invitations."); },
          function () { btn.disabled = false; $("invite-msg").textContent = "Couldn’t send. Check the connection."; });
        return;
      }
      var list = lget("lumevina_contacts", []), n = 0;
      list.forEach(function (c) { if (!c.invited) { c.invited = new Date().toISOString(); n++; } });
      lset("lumevina_contacts", list);
      countInvites("Demo: " + n + " clients would get the invitation by email.");
    });
    countInvites();
    document.addEventListener("lumevina:studio-key", function () { countInvites(); });
  }

  /* ══ Members (live): every membership from the server ══ */
  var mem = document.getElementById("members-live");
  if (mem && LIVE) {
    var drawMembers = function () {
      if (!studioKey()) return;
      call("studio", { action: "members" }).then(function (j) {
        var list = j.members || [];
        mem.hidden = false;
        mem.innerHTML = '<h3 class="ap-h">Members (live)</h3>' + (list.length ? '<div class="bk-table-wrap"><table class="bk-table"><thead><tr><th>Member</th><th>Plan</th><th>Facials waiting</th><th>Next billing</th><th>Card</th></tr></thead><tbody>' +
          list.map(function (m) {
            return "<tr><td>" + esc(m.name || m.email) + (m.five_no ? " · Founding Five #" + m.five_no + (m.five_kit === "given" ? "" : " (kit to give)") : "") + "</td><td>" + esc(m.plan) + " · " + money(m.price_cents) + (m.founding ? " founding" : "") +
              "</td><td>" + m.credits + "</td><td>" + esc(m.status === "cancelled" ? "Ended" : m.status === "cancelling" ? "Ends " + String(m.cancel_at).slice(0, 10) : m.on_hold ? "On hold (2 waiting)" : m.paused_bill_at ? "Paused" : String(m.next_bill_at).slice(0, 10)) +
              "</td><td>" + esc(m.card || "") + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="cq-empty">No members yet.</p>');
      }, function () { /* the key message shows in Appointments */ });
    };
    drawMembers();
    document.addEventListener("lumevina:studio-key", drawMembers);
  }
})();

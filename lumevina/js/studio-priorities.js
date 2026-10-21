/* Lumevina — Today: Evelyn's business priorities, ranked (dashboard)
 *
 * The first card after Lumevina Studio: what needs her, in order. The same
 * ranking as the server's (functions/_shared/priorities.ts; PRIORITIES.md in
 * plain words):
 *
 *   Right now      urgent or medical questions, questions past the promised
 *                  reply time, a failed membership payment, an order overdue
 *                  to ship, today's clients without a pre-visit form
 *   Today          today's appointments, orders to ship by today, pickups set
 *                  aside, questions due today, sold-out products
 *   This week      running low, members cancelling, the waitlist this week,
 *                  suggested chat answers to approve, regulars overdue to rebook
 *   Housekeeping   the shelf count, her Skin Playbook
 *
 * Her phone gets a notification the moment anything lands in Right now (the
 * server pushes as it happens, and client-reminders nudges once when a
 * question passes its reply time), and every morning for the day's list
 * (studio-digest).
 *
 * LIVE: functions/studio → priorities, with her studio key. DEMO: this
 * browser's data (questions, bookings, shipments, shelf, members, waitlist,
 * lessons), with a small sample when the browser has nothing yet.
 */
(function () {
  "use strict";

  var card = document.getElementById("priorities");
  if (!card) return;
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lget = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var studioKey = function () { try { return localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { return ""; } };
  var call = function (body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": studioKey() },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  };
  var TIERS = { 1: "Right now", 2: "Today", 3: "This week", 4: "Housekeeping" };
  var MEDICAL = { urgent: 1, reaction: 1, medication: 1, pregnancy: 1, condition: 1 };
  var DAY = 864e5;
  var first = function (s) { return String(s || "").trim().split(/\s+/)[0] || "a client"; };
  var names = function (rows, key, max) {
    key = key || "name"; max = max || 3;
    var list = rows.map(function (r) { return first(r[key]); });
    return list.length <= max ? list.join(", ") : list.slice(0, max).join(", ") + " and " + (list.length - max) + " more";
  };
  var plural = function (n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); };
  var clock = function (min) { var h = Math.floor(min / 60), m = min % 60; return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h >= 12 ? "PM" : "AM"); };
  var dayOf = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
  var PLAYBOOK = "https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ";

  /* ── demo: the same rules on this browser's data ── */
  var SAMPLE_BOOKINGS = function (today) {
    return [
      { date: today, start_min: 720, name: "Maya Chen", email: "maya@example.com", status: "held" },
      { date: today, start_min: 870, name: "Jordan Ellis", email: "jordan@example.com", status: "held" }
    ];
  };
  var demo = function () {
    var now = Date.now(), nowIso = new Date(now).toISOString(), today = dayOf(now), endOfToday = today + "T23:59:59.999Z";
    var out = [], sampled = false;
    var add = function (tier, kind, n, title, body, url) { if (n > 0) out.push({ tier: tier, kind: kind, n: n, title: title, body: body, url: url }); };
    var Q = "#client-questions";
    var questions = lget("lumevina_questions", []).filter(function (q) { return q.status === "waiting"; });
    var bookings = lget("lumevina_bookings", []).filter(function (b) { return b.status !== "cancelled" && b.status !== "no_show"; });
    var todayB = bookings.filter(function (b) { return b.date === today; });
    if (!bookings.length && !questions.length) { todayB = SAMPLE_BOOKINGS(today); sampled = true; }
    var intake = lget("lumevina_intake", {});
    var SH = window.LumevinaShip, ships = SH && SH.list ? SH.list() : [];
    var CAT = window.LUMEVINA_CATALOG, INV = window.LumevinaInventory;
    var products = CAT && INV ? CAT.products.filter(function (p) { return !p.draft && !p.hidden; }).map(function (p) { return INV.get(p.id) || p; }).filter(function (p) { return p.stock != null; }) : [];
    var LM = window.LumevinaMembership, members = LM && LM.all ? LM.all() : [];
    var lessons = lget("lumevina_lessons", []).filter(function (l) { return l.status === "suggested"; });
    var week = dayOf(now + 7 * DAY);
    var waitlist = lget("lumevina_waitlist", []).filter(function (w) { return w.status !== "removed" && w.status !== "booked" && w.date >= today && w.date <= week; });
    var contacts = lget("lumevina_contacts", []);

    var medical = questions.filter(function (q) { return MEDICAL[q.kind]; });
    add(1, "question_medical", medical.length, medical.length === 1 ? first(medical[0].name) + "’s question needs you" : medical.length + " medical questions need you",
      "A reaction, medication, pregnancy or a condition: the chat never answers these, and a client may be worried right now.", Q);
    var overdue = questions.filter(function (q) { return !MEDICAL[q.kind] && String(q.dueAt) < nowIso; });
    add(1, "question_overdue", overdue.length, "Past the promised reply time: " + names(overdue), "Members hear back within 24 hours, everyone else within 2 days. A short reply now keeps the promise.", Q);
    var failed = members.filter(function (m) { return m.billingFailed; });
    add(1, "billing_failed", failed.length, "Payment failed: " + names(failed), "Their membership card didn’t go through. A quick message about updating the card in My Lumevina keeps the membership going.", "#members");
    var lateShip = ships.filter(function (s) { return s.status === "to-ship" && String(s.due).slice(0, 10) < today; });
    add(1, "ship_overdue", lateShip.length, "Overdue to ship: " + names(lateShip), "Promised within two business days of the order. Pack it, buy the label, mark it shipped.", "#shipping");
    var noForm = todayB.filter(function (b) { return b.email && !intake[String(b.email).toLowerCase()]; });
    add(1, "intake_missing", noForm.length, "Pre-visit form missing today: " + names(noForm), "Send them the form link, or take it on the tablet when they arrive, before the treatment starts.", "#appointments");

    var sorted = todayB.slice().sort(function (a, b) { return a.start_min - b.start_min; });
    add(2, "appointments_today", sorted.length, plural(sorted.length, "appointment") + " today",
      sorted.length ? "First at " + clock(sorted[0].start_min) + ": " + sorted.map(function (b) { return first(b.name); }).join(", ") + "." : "", "#appointments");
    var dueShip = ships.filter(function (s) { return s.status === "to-ship" && String(s.due).slice(0, 10) === today; });
    add(2, "ship_today", dueShip.length, plural(dueShip.length, "order") + " to ship by today: " + names(dueShip), "Pack, label, mark shipped; the tracking email goes out by itself.", "#shipping");
    var dueToday = questions.filter(function (q) { return !MEDICAL[q.kind] && String(q.dueAt) >= nowIso && String(q.dueAt) <= endOfToday; });
    add(2, "question_today", dueToday.length, plural(dueToday.length, "question") + " to answer today: " + names(dueToday), "A reply is drafted for each; check it, make it yours, send.", Q);
    var soldOut = products.filter(function (p) { return Number(p.stock) === 0; });
    add(2, "sold_out", soldOut.length, "Sold out: " + soldOut.slice(0, 3).map(function (p) { return p.name; }).join(", ") + (soldOut.length > 3 ? " and " + (soldOut.length - 3) + " more" : ""),
      "Clients can request these from the shop. Restock, or hide them until you can.", "#inventory");

    var low = products.filter(function (p) { return Number(p.stock) > 0 && Number(p.stock) <= 3; });
    add(3, "low_stock", low.length, "Running low: " + low.slice(0, 3).map(function (p) { return p.name + " (" + p.stock + " left)"; }).join(", ") + (low.length > 3 ? " and " + (low.length - 3) + " more" : ""),
      "Reorder this week so they don’t sell out between visits.", "#inventory");
    var leaving = members.filter(function (m) { return m.status === "cancelling"; });
    add(3, "members_leaving", leaving.length, "Members leaving: " + names(leaving), "A personal message before their last facial keeps more members than any discount.", "#members");
    add(3, "waitlist", waitlist.length, plural(waitlist.length, "person", "people") + " on the waitlist this week", "When a day opens up, the first in line is emailed by itself; a text from you fills it faster.", "#appointments");
    add(3, "lessons", lessons.length, plural(lessons.length, "answer") + " to approve for the chat", "Your replies, made general. Approve them and the chat answers that question for everyone.", "#teach");
    var booked = {};
    bookings.forEach(function (b) { if (b.date >= today && b.email) booked[String(b.email).toLowerCase()] = true; });
    var regulars = contacts.filter(function (c) {
      var last = c.last_visit || c.lastVisit, visits = Number(c.visits || 0);
      return visits >= 2 && last && last <= dayOf(now - 35 * DAY) && last >= dayOf(now - 120 * DAY) && !booked[String(c.email || "").toLowerCase()];
    });
    add(3, "rebook", regulars.length, plural(regulars.length, "regular") + " haven’t rebooked in 5+ weeks: " + names(regulars), "The rebook email already went out; a personal text is what brings them back.", "#clients");
    return { items: out.sort(function (a, b) { return a.tier - b.tier; }), sampled: sampled };
  };

  /* the one thing only she can do for the chat, until it's done */
  var playbookItem = { tier: 4, kind: "playbook", n: 1, title: "Your Skin Playbook: Quick confirm", body: "Common answers drafted for you to confirm or fix, about 30 minutes in all. Every one you confirm is one the chat answers for you.", url: PLAYBOOK, ext: true };

  var HOW = [
    ["Right now", "a client may be waiting on you, or money is at risk: urgent or medical questions, questions past the promised reply time (24 hours for members, 2 days for everyone else), a failed membership payment, an order overdue to ship, today's clients without a pre-visit form."],
    ["Today", "today's appointments, orders to ship by today, pickups set aside, questions due today, sold-out products."],
    ["This week", "running low (3 or fewer), members cancelling, the waitlist for the next 7 days, suggested chat answers to approve, regulars who haven't rebooked in 5 weeks."],
    ["Housekeeping", "the shelf count when it's a month old, and your Skin Playbook."]
  ];
  var paint = function (items, note, sampled) {
    var groups = {};
    items.forEach(function (it) { (groups[it.tier] = groups[it.tier] || []).push(it); });
    card.innerHTML =
      '<div class="crm-head"><div><h2>Today' + (sampled ? ' <span class="pr-sample">sample</span>' : "") + "</h2>" +
      '<p class="sub">What needs you first. Your phone gets a notification the moment anything lands in Right now, and every morning for the day’s list.</p></div></div>' +
      (note ? '<p class="pr-msg">' + esc(note) + "</p>" : "") +
      (items.length ? '<div class="pr-groups">' + [1, 2, 3, 4].filter(function (t) { return groups[t]; }).map(function (t) {
        return '<section class="pr-group is-t' + t + '"><h3 class="pr-tier">' + TIERS[t] + '<span class="pr-n">' + groups[t].length + "</span></h3><ul>" +
          groups[t].map(function (it) {
            return '<li class="pr-item"><a href="' + esc(it.url) + '"' + (it.ext ? ' target="_blank" rel="noopener"' : "") + "><b>" + esc(it.title) + "</b>" + (it.body ? "<small>" + esc(it.body) + "</small>" : "") + "</a></li>";
          }).join("") + "</ul></section>";
      }).join("") + "</div>" : '<p class="pr-empty">Nothing is waiting on you. Enjoy it.</p>') +
      '<details class="pr-how"><summary>How this is ranked</summary><ol>' + HOW.map(function (h) { return "<li><b>" + esc(h[0]) + ":</b> " + esc(h[1]) + "</li>"; }).join("") + "</ol></details>";
  };
  var load = function () {
    if (!LIVE) { var d = demo(); paint(d.items.concat([playbookItem]), "", d.sampled); return; }
    if (!studioKey()) { paint([playbookItem], "Save your studio key under Lumevina Studio, and today’s list fills in from the server."); return; }
    call({ action: "priorities" }).then(function (j) { paint((j.items || []).map(function (it) { it.url = String(it.url || "").replace(/^dashboard\.html/, ""); return it; }).concat([playbookItem]), ""); },
      function () { paint([playbookItem], "Couldn’t load today’s list just now."); });
  };
  ["lumevina:studio-key", "lumevina:question-sent", "lumevina:lessons", "lumevina:bookings", "lumevina:stock"].forEach(function (ev) { document.addEventListener(ev, load); });
  window.addEventListener("storage", function (e) { if (/^lumevina_/.test(e.key || "")) load(); });
  load();
  window.LumevinaPriorities = { reload: load, demo: demo };
})();

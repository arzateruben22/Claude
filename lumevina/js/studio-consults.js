/* Lumevina — Consults (dashboard): the gate on the actives, and the online Skin Consult
 *
 * Waiting on you    a client tapped "Needs a quick consult" on an active and
 *                   wrote about their skin. Approve (that email buys it) or
 *                   decline, with a line she gets by email.
 * Online consults   paid Skin Consults ($35): set the call, then "Done" sends
 *                   the $35 back as a certificate code and unlocks every active
 *                   for that email.
 * Decided           the last 30 days.
 *
 * LIVE: functions/studio → consults, consult_decide, consult_done (her studio
 * key). DEMO: this browser's "lumevina_consults", the same list the website in
 * this browser writes to and reads from.
 */
(function () {
  "use strict";

  var card = document.getElementById("consults");
  if (!card) return;
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var KEY = "lumevina_consults";
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lget = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var lset = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  var studioKey = function () { try { return localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { return ""; } };
  var call = function (body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": studioKey() },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  };
  var ago = function (iso) {
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!isFinite(m) || m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.round(h / 24); return d + (d === 1 ? " day ago" : " days ago");
  };
  var CAT = window.LUMEVINA_CATALOG || { products: [] };
  var nameOf = function (id) { var p = CAT.products.filter(function (x) { return x.id === id; })[0]; return p ? p.brand + " " + p.name : id; };
  var SAMPLE = [
    { id: "demo-1", kind: "gate", status: "waiting", email: "maya@example.com", name: "Maya Chen", products: ["fr-5pct-adv-acne-med"], note: "Breakouts along my jaw for about a year. I use a gel cleanser and a light moisturizer, no actives. Not pregnant, nothing prescribed.", created_at: new Date(Date.now() - 50 * 60000).toISOString() },
    { id: "demo-2", kind: "online", status: "paid", email: "jordan@example.com", name: "Jordan Reyes", products: [], created_at: new Date(Date.now() - 5 * 3600000).toISOString() }
  ];

  var list = [];
  var load = function () {
    if (LIVE) return call({ action: "consults" }).then(function (j) { list = j.consults || []; render(); }, function () { card.innerHTML = '<h2>Consults</h2><p class="sub">Couldn’t load. Check the studio key above.</p>'; });
    var saved = lget(KEY, null);
    list = saved === null ? SAMPLE : saved;
    render();
    return Promise.resolve();
  };
  var persistDemo = function () { if (!LIVE) lset(KEY, list); };

  var decide = function (id, status, reply, products) {
    var row = list.filter(function (c) { return c.id === id; })[0];
    if (!row) return Promise.resolve();
    if (LIVE) return call({ action: "consult_decide", id: id, status: status, reply: reply, products: products }).then(load);
    row.status = status; row.reply = reply || null; row.decided_at = new Date().toISOString();
    if (products) row.products = products;
    persistDemo(); render();
    return Promise.resolve();
  };
  var done = function (id) {
    var row = list.filter(function (c) { return c.id === id; })[0];
    if (!row) return Promise.resolve();
    if (LIVE) return call({ action: "consult_done", id: id }).then(load);
    row.status = "done"; row.decided_at = new Date().toISOString(); row.products = []; row.credit_code = "LUM-DEMO-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    persistDemo(); render();
    return Promise.resolve();
  };

  var render = function () {
    var waiting = list.filter(function (c) { return c.kind === "gate" && c.status === "waiting"; });
    var paid = list.filter(function (c) { return c.kind === "online" && c.status === "paid"; });
    var decided = list.filter(function (c) { return c.status !== "waiting" && c.status !== "paid"; }).slice(0, 12);
    var names = function (c) { return (c.product_names || (c.products || []).map(nameOf)); };
    var h = '<h2>Consults</h2><p class="sub">The gate on the actives, and the online Skin Consult. ' + (LIVE ? "Decisions email the client." : "Demo: this browser’s requests; the website tab here sees your decision.") + '</p>';
    h += '<h3 class="cs-h">Waiting on you' + (waiting.length ? ' <span class="cs-n">' + waiting.length + '</span>' : "") + '</h3>';
    if (!waiting.length) h += '<p class="cs-empty">Nobody waiting.</p>';
    waiting.forEach(function (c) {
      h += '<div class="cs-row" data-id="' + esc(c.id) + '">' +
        '<div class="cs-who"><b>' + esc(c.name || c.email) + '</b> <span class="cs-when">' + esc(ago(c.created_at)) + '</span><br><span class="cs-mail">' + esc(c.email) + '</span></div>' +
        '<p class="cs-wants">Wants: <b>' + esc(names(c).join(", ") || "an active") + '</b></p>' +
        (c.note ? '<p class="cs-note">' + esc(c.note).replace(/\n/g, "<br>") + '</p>' : '<p class="cs-note cs-empty">No note.</p>') +
        (c.answers ? '<p class="cs-hint">They also sent their skin profile: ' + esc([c.answers.skinType, (c.answers.concerns || []).join(", "), c.answers.sensitivities && "sensitive to " + c.answers.sensitivities].filter(Boolean).join(" · ")) + '</p>' : "") +
        '<label class="cs-lab" for="cs-r-' + esc(c.id) + '">A line for them (optional)</label>' +
        '<textarea id="cs-r-' + esc(c.id) + '" class="cs-reply" rows="2" placeholder="Start three nights a week, moisturizer on top, and message me if it stings."></textarea>' +
        '<div class="cs-acts"><button type="button" class="btn btn-solid" data-decide="approved">Approve' + (names(c).length > 1 ? " all" : "") + '</button>' +
        '<button type="button" class="btn btn-ghost" data-decide="all">Approve every active</button>' +
        '<button type="button" class="btn btn-ghost cs-no" data-decide="declined">Decline</button></div>' +
      '</div>';
    });
    h += '<h3 class="cs-h">Online consults' + (paid.length ? ' <span class="cs-n">' + paid.length + '</span>' : "") + '</h3>';
    if (!paid.length) h += '<p class="cs-empty">None booked.</p>';
    paid.forEach(function (c) {
      h += '<div class="cs-row" data-id="' + esc(c.id) + '">' +
        '<div class="cs-who"><b>' + esc(c.name || c.email) + '</b> <span class="cs-when">paid ' + esc(ago(c.created_at)) + '</span><br><span class="cs-mail">' + esc(c.email) + '</span></div>' +
        '<p class="cs-note">Message them to set the 15-minute call (video or phone). After the call, tap Done: every active unlocks for this email and the $35 goes back as a certificate code.</p>' +
        '<div class="cs-acts"><a class="btn btn-ghost" href="mailto:' + esc(c.email) + '?subject=' + encodeURIComponent("Your Skin Consult with Evelyn") + '">Email them</a>' +
        '<button type="button" class="btn btn-solid" data-done="1">Done, send the $35</button></div>' +
      '</div>';
    });
    if (decided.length) {
      h += '<h3 class="cs-h">Decided</h3><ul class="cs-list">' + decided.map(function (c) {
        return '<li><b>' + esc(c.name || c.email) + '</b> · ' + esc(c.kind === "online" ? "online consult" : names(c).join(", ") || "every active") + ' · <span class="cs-st is-' + esc(c.status) + '">' + esc(c.status) + '</span>' +
          (c.credit_code ? ' · ' + esc(c.credit_code) : "") + (c.decided_at ? ' <span class="cs-when">' + esc(ago(c.decided_at)) + '</span>' : "") + '</li>';
      }).join("") + '</ul>';
    }
    card.innerHTML = h;
  };

  card.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-decide], [data-done]");
    if (!b) return;
    var row = b.closest(".cs-row"), id = row && row.dataset.id;
    if (!id) return;
    b.disabled = true;
    if (b.dataset.done) { done(id); return; }
    var reply = (row.querySelector(".cs-reply") || {}).value || "";
    var mode = b.dataset.decide;
    decide(id, mode === "declined" ? "declined" : "approved", reply.trim(), mode === "all" ? [] : null);
  });

  load();
  window.addEventListener("storage", function (e) { if (e.key === KEY && !LIVE) load(); });
  window.LumevinaStudioConsults = { reload: load };
})();

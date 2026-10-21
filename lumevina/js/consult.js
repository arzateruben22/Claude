/* Lumevina — the consult gate (the actives), from the client's side
 *
 * Some products need Evelyn's yes first: benzoyl peroxide, the stronger
 * mandelic serums, retinoids, Hydroxi (catalog.js → consult: true). On the
 * shelf they show "Needs a quick consult" instead of Add to cart. Tapping it
 * opens a short sheet: name, email, a few lines about their skin, and an
 * optional link to the full pre-visit form. Evelyn gets a notification,
 * approves or declines in her dashboard, and the client gets an email; once
 * approved, that email buys the product like any other (the server checks
 * the same approval at checkout, so the gate can't be skipped).
 *
 *   LIVE   functions/consult → request / status (approval is by email; a
 *          signed-in client's token wins over the typed address)
 *   DEMO   this browser: requests go to localStorage "lumevina_consults",
 *          which the dashboard in this browser reads and decides on; the
 *          decision comes back the same way
 *
 * window.LumevinaConsult: approved(id), waiting(id), open(product), refresh(), email() */
(function () {
  "use strict";

  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var KEY = "lumevina_consult", DEMO = "lumevina_consults";
  var lget = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var lset = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  var state = lget(KEY, {});
  var save = function () { lset(KEY, state); };
  var norm = function (e) { return String(e || "").trim().toLowerCase(); };
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var email = function () {
    var a = window.LumevinaAccount && window.LumevinaAccount.current && window.LumevinaAccount.current();
    return norm((a && a.email) || state.email || "");
  };
  var approved = function (id) { return state.approved === "all" || (state.approved || []).indexOf(id) !== -1; };
  var waiting = function (id) { return (state.waiting || []).indexOf(id) !== -1; };
  var changed = function () { paintAccount(); document.dispatchEvent(new CustomEvent("lumevina:consult-changed")); };

  /* My Lumevina → Your consults: what Evelyn is looking at, what she unlocked */
  var nameOf = function (id) {
    var C = window.LUMEVINA_CATALOG, p = C && C.products.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : id;
  };
  var paintAccount = function () {
    var box = document.querySelector(".acct-consults"), card = document.querySelector(".acct-cs-card"), meta = document.querySelector(".acct-cs-meta");
    if (!box || !card) return;
    var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var w = state.waiting || [], ap = state.approved === "all" ? "all" : (state.approved || []);
    if (!w.length && (ap === "all" ? false : !ap.length) && ap !== "all") { box.hidden = true; return; }
    box.hidden = false;
    meta.textContent = email() ? "for " + email() : "";
    var h = "";
    if (w.length) h += '<p class="acct-cs-line"><b>Evelyn is looking at:</b> ' + esc(w.map(nameOf).join(", ")) + '. She replies within a day, by email.</p>';
    if (ap === "all") h += '<p class="acct-cs-line"><b>Unlocked for you:</b> every active on the shelf. Use this email at checkout.</p>';
    else if (ap.length) h += '<p class="acct-cs-line"><b>Unlocked for you:</b></p><ul class="acct-cs-list">' + ap.map(function (id) {
      return '<li>' + esc(nameOf(id)) + ' <button type="button" class="linklike acct-cs-add" data-id="' + esc(id) + '">Add to cart</button></li>';
    }).join("") + '</ul>';
    card.innerHTML = h;
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".acct-cs-add");
    if (!b || !window.LumevinaCart) return;
    var r = window.LumevinaCart.add(b.dataset.id);
    b.textContent = r.ok ? "In your cart" : r.reason === "max" ? "In your cart" : "Not available right now";
  });

  var call = function (body) {
    var token = window.LumevinaAccount && window.LumevinaAccount.token && window.LumevinaAccount.token();
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/consult", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + (token || SHOP.key) },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  };

  /* what this client may buy without asking */
  var refresh = function () {
    var e = email();
    if (!e) return Promise.resolve();
    if (LIVE) {
      return call({ action: "status", email: e }).then(function (j) {
        state.approved = j.approved === "all" ? "all" : (j.approved || []);
        state.waiting = j.waiting || [];
        save(); changed();
      }, function () { /* offline: keep what we had */ });
    }
    var mine = lget(DEMO, []).filter(function (r) { return norm(r.email) === e; });
    var all = mine.some(function (r) { return r.status === "done" || (r.status === "approved" && !(r.products || []).length); });
    var ids = [];
    mine.forEach(function (r) { if (r.status === "approved") ids = ids.concat(r.products || []); });
    state.approved = all ? "all" : ids;
    state.waiting = [].concat.apply([], mine.filter(function (r) { return r.status === "waiting"; }).map(function (r) { return r.products || []; }));
    save(); changed();
    return Promise.resolve();
  };

  /* ── the sheet ── */
  var sheet = null, product = null;
  var build = function () {
    sheet = document.createElement("dialog");
    sheet.className = "pd cs";
    sheet.setAttribute("aria-labelledby", "cs-title");
    sheet.innerHTML =
      '<div class="pd-inner cs-inner">' +
        '<button class="pd-close" type="button" aria-label="Close">&times;</button>' +
        '<form class="cs-form" novalidate>' +
          '<p class="pd-brand cs-kicker">Needs a quick consult</p>' +
          '<h2 class="pd-name" id="cs-title">Evelyn checks this one with you first</h2>' +
          '<p class="cs-lead">Two minutes about your skin, and she unlocks <strong class="cs-product"></strong> for you, usually within a day. No charge.</p>' +
          '<label for="cs-name">Your name</label><input id="cs-name" name="name" type="text" autocomplete="name" required>' +
          '<label for="cs-email">Email</label><input id="cs-email" name="email" type="email" autocomplete="email" inputmode="email" required>' +
          '<label for="cs-note">What’s going on with your skin, and what you use now</label>' +
          '<textarea id="cs-note" name="note" rows="4" placeholder="Breakouts on my chin for a year, I use a foaming cleanser and a drugstore moisturizer, no actives yet. Not pregnant, no prescriptions."></textarea>' +
          '<p class="cs-hint">Pregnant or nursing, on prescriptions, or allergic to anything? Say so here. A photo in daylight helps: reply to the email you’ll get with one.</p>' +
          '<p class="cs-status" role="status"></p>' +
          '<div class="cs-actions"><button class="btn btn-solid cs-send" type="submit">Send to Evelyn</button>' +
          '<button class="btn btn-ghost cs-form-link" type="button">Fill the full skin form instead</button></div>' +
        '</form>' +
        '<div class="cs-done" hidden>' +
          '<p class="pd-brand cs-kicker">Sent</p>' +
          '<h2 class="pd-name">Evelyn will reply within a day</h2>' +
          '<p class="cs-lead">Usually sooner. If it’s right for your skin she unlocks <strong class="cs-product"></strong> for <strong class="cs-email"></strong>, and you’ll get a link straight to it. Keep browsing: everything else on the shelf is yours to add now.</p>' +
          '<div class="cs-actions"><button class="btn btn-solid cs-ok" type="button">Back to the shop</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sheet);
    var close = function () { sheet.close(); };
    sheet.querySelector(".pd-close").addEventListener("click", close);
    sheet.querySelector(".cs-ok").addEventListener("click", close);
    sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
    sheet.addEventListener("close", function () { document.documentElement.classList.remove("pd-open"); });
    sheet.querySelector(".cs-form-link").addEventListener("click", function () {
      close();
      if (window.LumevinaIntake) window.LumevinaIntake.open({ name: sheet.querySelector("#cs-name").value, email: sheet.querySelector("#cs-email").value });
    });
    sheet.querySelector(".cs-form").addEventListener("submit", function (e) { e.preventDefault(); send(); });
  };

  var open = function (p) {
    if (!sheet) build();
    product = p;
    var form = sheet.querySelector(".cs-form"), done = sheet.querySelector(".cs-done");
    form.hidden = false; done.hidden = true;
    sheet.querySelectorAll(".cs-product").forEach(function (el) { el.textContent = p.name; });
    var a = window.LumevinaAccount && window.LumevinaAccount.current && window.LumevinaAccount.current();
    var nameEl = form.querySelector("#cs-name"), emailEl = form.querySelector("#cs-email");
    if (!nameEl.value) nameEl.value = (a && a.name) || state.name || "";
    if (!emailEl.value) emailEl.value = (a && a.email) || state.email || "";
    form.querySelector(".cs-status").textContent = "";
    form.querySelector(".cs-send").disabled = false;
    document.documentElement.classList.add("pd-open");
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
    (nameEl.value ? (emailEl.value ? form.querySelector("#cs-note") : emailEl) : nameEl).focus();
  };

  var send = function () {
    var form = sheet.querySelector(".cs-form"), status = form.querySelector(".cs-status"), btn = form.querySelector(".cs-send");
    var name = form.querySelector("#cs-name").value.trim(), em = norm(form.querySelector("#cs-email").value), note = form.querySelector("#cs-note").value.trim();
    if (!name) { status.textContent = "Your name, please."; form.querySelector("#cs-name").focus(); return; }
    if (!EMAIL.test(em)) { status.textContent = "Check your email address: that’s where the yes arrives."; form.querySelector("#cs-email").focus(); return; }
    btn.disabled = true; status.textContent = "Sending…";
    var answers = null;
    try { var prof = window.LumevinaProfile && window.LumevinaProfile.current && window.LumevinaProfile.current(); if (prof) answers = prof; } catch (e) { /* none */ }
    var finish = function () {
      state.email = em; state.name = name;
      state.waiting = (state.waiting || []).concat(product.id).filter(function (x, i, a) { return a.indexOf(x) === i; });
      save(); changed();
      form.hidden = true;
      var done = sheet.querySelector(".cs-done");
      done.hidden = false;
      done.querySelector(".cs-email").textContent = em;
      done.querySelector(".cs-ok").focus();
    };
    if (LIVE) {
      call({ action: "request", email: em, name: name, note: note, products: [product.id], answers: answers }).then(finish, function (j) {
        btn.disabled = false;
        status.textContent = j && j.reason === "email" ? "Check your email address." : "Couldn’t send right now. Check your connection and try again.";
      });
      return;
    }
    var list = lget(DEMO, []);
    var mine = list.filter(function (r) { return norm(r.email) === em && r.kind === "gate" && r.status === "waiting"; })[0];
    if (mine) {
      if (mine.products.indexOf(product.id) === -1) { mine.products.push(product.id); mine.product_names.push(product.brand + " " + product.name); }
      mine.note = [mine.note, note].filter(Boolean).join("\n\n");
    } else {
      list.unshift({ id: "c-" + Date.now().toString(36), kind: "gate", status: "waiting", email: em, name: name, note: note,
        products: [product.id], product_names: [product.brand + " " + product.name], answers: answers, created_at: new Date().toISOString() });
    }
    lset(DEMO, list);
    setTimeout(finish, 400);
  };

  window.LumevinaConsult = { approved: approved, waiting: waiting, open: open, refresh: refresh, email: email };

  /* the link in Evelyn's email carries the email she approved, so a new phone knows who this is */
  try {
    var fromLink = norm(new URLSearchParams(location.search).get("consult") || "");
    if (EMAIL.test(fromLink)) { state.email = fromLink; save(); }
  } catch (e) { /* no URL API */ }
  /* the decision arrives: live, on load and when they sign in; demo, the dashboard's tab writes it */
  refresh();
  window.addEventListener("storage", function (e) { if (e.key === DEMO) refresh(); });
  document.addEventListener("lumevina:account-changed", refresh);
})();

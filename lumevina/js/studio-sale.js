/* Lumevina Studio — a sale at the studio
 *
 * The Check out button on a client (dashboard → Clients) and New sale at
 * the top of the list, for a client in front of Evelyn: what they're taking
 * from the shelf, any treatment done on the spot, a discount, a tip, and how
 * they paid. One tap records it: the server (functions/studio → sale,
 * _shared/sales.ts) writes it as an order like a web order, so the stock
 * comes off, the receipt goes out, the Glow Points land, the products show
 * under Buy again, and her books see it. Fewer taps than ringing it up
 * anywhere else, and nothing to copy between systems.
 *
 *   Card on file   charged now (clients who booked here with a card)
 *   Cash           recorded
 *   Pay link       Stripe's page on their phone; it finishes when they pay
 *   Other          recorded (Zelle, a gift, anything else)
 *
 * Demo (no server): the sale is kept in this browser (lumevina_sales) and the
 * stock comes off the local shelf, so the flow can be tried end to end. */
(function () {
  "use strict";

  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var SV = window.LUMEVINA_SERVICES || { all: [], get: function () { return null; } };
  var INV = window.LumevinaInventory || null;
  var KEY = "lumevina_sales";
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (c) { return "$" + (Math.round(c) / 100).toFixed(c % 100 ? 2 : 0); };
  var studioKey = function () { try { return localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { return ""; } };
  var call = function (body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": studioKey() },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  };
  var lget = function () { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  var lset = function (v) { try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 200))); } catch (e) { /* private mode */ } };
  var fmtDate = function (iso) { var d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  var svcName = function (id) { var s = SV.get(id); return s ? s.name : id; };
  var svcCents = function (id) { var s = SV.get(id); return s ? Math.round(s.price * 100) : 0; };

  /* ── the panel: who, what, how much, how paid ── */
  var open = function (host, client, opts) {
    opts = opts || {};
    var c = { name: (client && client.name) || "", email: ((client && client.email) || "").toLowerCase(), phone: (client && client.phone) || "", card: (client && (client.card_label || client.card)) || "" };
    var st = { items: [], services: [], discount: 0, tipMode: "0", tipCustom: 0, method: c.card ? "card" : "cash", busy: false };
    var prodOpts = INV ? INV.live().filter(function (p) { var s = INV.status(p); return s === "in" || s === "low"; })
      .map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.brand + " " + p.name) + " · $" + p.price + (INV.status(p) === "low" ? " · few left" : "") + "</option>"; }).join("") : "";
    var svcOpts = SV.all.filter(function (s) { return !s.ask; }).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + " · $" + s.price + "</option>"; }).join("");
    host.hidden = false;
    host.innerHTML =
      '<div class="ap-co sale-co">' +
      (opts.who
        ? '<div class="ap-co-row sale-who"><input data-sl="name" type="text" placeholder="Their name" autocomplete="off" value="' + esc(c.name) + '"><input data-sl="email" type="email" placeholder="Email for the receipt" autocomplete="off" value="' + esc(c.email) + '"><input data-sl="phone" type="tel" placeholder="Phone (optional)" autocomplete="off" value="' + esc(c.phone) + '"></div>'
        : '<p class="sale-client"><strong>' + esc(c.name || c.email) + '</strong>' + (c.name ? ' <small>' + esc(c.email) + '</small>' : "") + '</p>') +
      '<div class="ap-co-row"><span class="ap-k">Products</span><div class="ap-chips" data-sl="prods"></div>' +
      (prodOpts ? '<select data-sl="addprod" aria-label="Add a product"><option value="">+ From the shelf</option>' + prodOpts + "</select>" : '<span class="ap-k">Nothing in stock to sell.</span>') + "</div>" +
      '<div class="ap-co-row"><span class="ap-k">Treatment</span><div class="ap-chips" data-sl="svcs"></div>' +
      '<select data-sl="addsvc" aria-label="Add a treatment done today"><option value="">+ Done today, no booking</option>' + svcOpts + "</select></div>" +
      '<div class="ap-co-row"><label class="ap-k" for="sl-disc">Discount</label><input id="sl-disc" data-sl="disc" type="number" min="0" step="1" placeholder="$0" inputmode="decimal"></div>' +
      '<div class="ap-co-row"><span class="ap-k">Tip</span><div class="ap-seg" data-sl="tip">' +
      ["0", "15", "20", "custom"].map(function (t) { return '<button type="button" data-tip="' + t + '"' + (t === "0" ? ' class="on"' : "") + ">" + (t === "0" ? "No tip" : t === "custom" ? "Other" : t + "%") + "</button>"; }).join("") +
      '</div><input data-sl="tipc" type="number" min="0" step="1" placeholder="$" hidden inputmode="decimal" aria-label="Tip in dollars"></div>' +
      '<div class="ap-co-row"><span class="ap-k">Paid with</span><div class="ap-seg" data-sl="method">' +
      (c.card ? '<button type="button" data-m="card" class="on">' + esc(c.card) + "</button>" : "") +
      '<button type="button" data-m="cash"' + (c.card ? "" : ' class="on"') + ">Cash</button>" +
      (LIVE ? '<button type="button" data-m="link">Pay link</button>' : "") +
      '<button type="button" data-m="other">Other</button></div></div>' +
      '<ul class="ap-lines" data-sl="lines"></ul>' +
      '<div class="ap-co-go"><button type="button" class="bk-export" data-sl="go">Add something first</button><button type="button" class="settle-btn" data-sl="close">Close</button></div>' +
      '<p class="ap-co-msg" data-sl="msg" role="status"></p></div>';
    var q = function (k) { return host.querySelector('[data-sl="' + k + '"]'); };
    var who = function () {
      if (!opts.who) return c;
      return { name: q("name").value.trim(), email: q("email").value.trim().toLowerCase(), phone: q("phone").value.trim(), card: "" };
    };
    var lines = function () {
      var out = [], gross = 0;
      st.items.forEach(function (it) { var p = INV && INV.get(it.id); var cents = Math.round((p ? p.price : 0) * 100) * it.qty; gross += cents; out.push({ label: (p ? p.name : it.id) + (it.qty > 1 ? " × " + it.qty : ""), cents: cents }); });
      st.services.forEach(function (id) { var cents = svcCents(id); gross += cents; out.push({ label: svcName(id), cents: cents }); });
      var disc = Math.min(gross, Math.round((st.discount || 0) * 100));
      if (disc) out.push({ label: "Discount", cents: -disc });
      var due = gross - disc;
      var tip = st.tipMode === "custom" ? Math.round((st.tipCustom || 0) * 100) : Math.round(due * Number(st.tipMode) / 100);
      return { lines: out, due: due, tip: tip, total: due + tip, disc: disc };
    };
    var paint = function () {
      q("prods").innerHTML = st.items.map(function (it, i) { var p = INV && INV.get(it.id); return '<span class="ap-chip">' + esc((p ? p.name : it.id) + " × " + it.qty) + '<button type="button" data-rm="p' + i + '" aria-label="Remove">&times;</button></span>'; }).join("");
      q("svcs").innerHTML = st.services.map(function (id, i) { return '<span class="ap-chip">' + esc(svcName(id)) + '<button type="button" data-rm="s' + i + '" aria-label="Remove">&times;</button></span>'; }).join("");
      var L = lines();
      q("lines").innerHTML = L.lines.map(function (l) { return "<li><span>" + esc(l.label) + "</span><span>" + (l.cents < 0 ? "−" : "") + money(Math.abs(l.cents)) + "</span></li>"; }).join("") +
        (L.lines.length ? '<li class="ap-sum"><span>Due</span><span>' + money(L.due) + "</span></li>" + (L.tip ? "<li><span>Tip</span><span>" + money(L.tip) + "</span></li>" : "") +
          '<li class="ap-total"><span>Total</span><span>' + money(L.total) + "</span></li>" + (L.due > 0 ? '<li class="sale-pts"><span>Glow Points they earn</span><span>' + Math.round(L.due / 100) + "</span></li>" : "") : "");
      var go = q("go"), total = money(L.total);
      go.textContent = !L.lines.length ? "Add something first" : st.method === "card" ? "Charge " + total + " to " + c.card : st.method === "cash" ? "Record " + total + " cash"
        : st.method === "link" ? "Make a pay link for " + total : "Record " + total + " paid";
    };
    host.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.sl === "addprod" && t.value) { var had = st.items.filter(function (x) { return x.id === t.value; })[0]; if (had) had.qty++; else st.items.push({ id: t.value, qty: 1 }); t.value = ""; paint(); }
      if (t.dataset.sl === "addsvc" && t.value) { st.services.push(t.value); t.value = ""; paint(); }
    });
    host.addEventListener("input", function (e) {
      var t = e.target;
      if (t.dataset.sl === "disc") { st.discount = Number(t.value) || 0; paint(); }
      if (t.dataset.sl === "tipc") { st.tipCustom = Number(t.value) || 0; paint(); }
    });
    host.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.rm) { var k = t.dataset.rm; if (k[0] === "p") st.items.splice(+k.slice(1), 1); else st.services.splice(+k.slice(1), 1); paint(); return; }
      if (t.dataset.tip) { st.tipMode = t.dataset.tip; q("tip").querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === t); }); q("tipc").hidden = st.tipMode !== "custom"; paint(); return; }
      if (t.dataset.m) { st.method = t.dataset.m; q("method").querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === t); }); paint(); return; }
      if (t.dataset.sl === "close") { host.hidden = true; host.innerHTML = ""; if (opts.onClose) opts.onClose(); return; }
      if (t.dataset.sl === "go") finish(t);
      if (t.dataset.copy) { try { navigator.clipboard.writeText(t.dataset.copy); t.textContent = "Copied"; } catch (e2) { /* old browser */ } }
    });
    var finish = function (btn) {
      var L = lines(), w = who(), msg = q("msg");
      if (!L.lines.length) { msg.textContent = "Add what they're taking first."; return; }
      if (!EMAIL.test(w.email)) { msg.textContent = "Add the email the receipt goes to."; return; }
      if (st.busy) return;
      st.busy = true; btn.disabled = true;
      msg.textContent = st.method === "card" ? "Charging the card…" : st.method === "link" ? "Making the link…" : "Recording…";
      var body = { action: "sale", email: w.email, name: w.name, phone: w.phone, items: st.items, services: st.services, discount_cents: L.disc, tip_cents: L.tip, method: st.method, returnUrl: location.origin + location.pathname.replace(/[^/]*$/, "") };
      var done = function (res) {
        st.busy = false; btn.disabled = false;
        if (res.url) {
          msg.innerHTML = 'Pay link ready: <a href="' + esc(res.url) + '" target="_blank" rel="noopener">open it</a> · <button type="button" class="settle-btn" data-copy="' + esc(res.url) + '">Copy</button>' +
            (w.phone ? ' · <a href="sms:' + esc(String(w.phone).replace(/[^\d+]/g, "")) + "?&body=" + encodeURIComponent("Your Lumevina purchase: " + res.url) + '">Text it to ' + esc(w.name.split(" ")[0] || "them") + "</a>" : "") +
            ". Stock, the receipt and their points follow once they pay.";
          return;
        }
        st.items.forEach(function (it) { if (INV) { if (LIVE && INV.decrement) INV.decrement(it.id, it.qty); else if (INV.sell) INV.sell(it.id, it.qty); } });
        var pts = res.points != null ? res.points : Math.round(L.due / 100);
        host.innerHTML = '<div class="ap-co sale-done"><p><strong>Sold.</strong> ' + esc(w.name || w.email) + " paid " + money(L.total) + (L.tip ? " (" + money(L.tip) + " tip)" : "") + "." +
          (pts ? " " + pts + " Glow Points landed." : "") + " The receipt is on its way" + (LIVE ? "" : " (demo: nothing is emailed)") + ".</p>" +
          '<button type="button" class="settle-btn" data-sl="close">Done</button></div>';
        document.dispatchEvent(new CustomEvent("lumevina:sale", { detail: { email: w.email, name: w.name, total: L.total, order: res.order || null } }));
        document.dispatchEvent(new Event("lumevina:books"));
      };
      if (LIVE) {
        call(body).then(done, function (err) {
          st.busy = false; btn.disabled = false;
          var r = err && err.reason;
          msg.textContent = r === "no_card" ? "No card on file for them. Choose cash, a pay link, or other."
            : r === "stock" ? "Only " + err.left + " of " + (err.name || "that") + " left on the shelf." : r === "unavailable" ? "One item isn't on the shelf any more."
            : r === "email" ? "Check the email." : r === "studio_key" ? "Save your studio key under Lumevina Studio first."
            : /declin|insufficient|expired|authentication|card/.test(String(r)) ? "The card didn’t go through (" + String(r).replace(/_/g, " ") + "). Try a pay link."
            : "That didn’t go through. Check the connection and try again.";
        });
      } else {
        var all = lget();
        all.unshift({ id: "S-" + Date.now().toString(36).toUpperCase(), at: new Date().toISOString(), email: w.email, name: w.name,
          items: st.items.map(function (it) { var p = INV && INV.get(it.id); return { id: it.id, name: p ? p.name : it.id, qty: it.qty, price_cents: Math.round((p ? p.price : 0) * 100) }; })
            .concat(st.services.map(function (id) { return { id: id, name: svcName(id), qty: 1, price_cents: svcCents(id), kind: "service" }; })),
          total_cents: L.total, method: st.method, points: Math.round(L.due / 100) });
        lset(all);
        setTimeout(function () { done({ points: Math.round(L.due / 100) }); }, 350);
      }
    };
    paint();
    var first = host.querySelector(opts.who ? '[data-sl="name"]' : '[data-sl="addprod"], [data-sl="addsvc"]');
    if (first && first.focus) first.focus({ preventScroll: true });
  };

  /* what a client bought, under their row (live: the orders table; demo: this browser's sales) */
  var purchases = function (el, email) {
    email = String(email || "").toLowerCase();
    var paint = function (orders) {
      el.innerHTML = "<h3>Purchases</h3>" + (orders.length ? orders.slice(0, 12).map(function (o) {
        var what = (o.items || []).filter(function (i) { return i.kind !== "adjust"; }).map(function (i) { return (i.qty > 1 ? i.qty + " × " : "") + i.name; }).join(", ");
        return '<div class="crm-visit"><span>' + esc(fmtDate(o.paid_at || o.at || o.created_at)) + (o.source === "studio" || o.method ? " · at the studio" : " · online") + " · " + esc(what) + "</span><span>" + money(o.total_cents || 0) + "</span></div>";
      }).join("") : '<div class="crm-none">Nothing bought yet.</div>');
    };
    el.innerHTML = "<h3>Purchases</h3><div class=\"crm-none\">Loading…</div>";
    if (LIVE) call({ action: "client_orders", email: email }).then(function (j) { paint(j.orders || []); }, function () { el.innerHTML = "<h3>Purchases</h3><div class=\"crm-none\">Couldn’t load them.</div>"; });
    else paint(lget().filter(function (s) { return s.email === email; }));
  };

  window.LumevinaStudioSale = { open: open, purchases: purchases, all: lget };
})();

/* Lumevina — gift certificate checkout (template-native)
   Opens in response to `lumevina:gift`. Two kinds, matching the ledger
   (js/giftcards.js): a specific treatment (all-or-nothing) or a dollar
   value toward any service. Pays the full amount via the shared payment
   engine, issues a code, and shows it to copy/share. */

(function () {
  "use strict";

  var catalog = window.LumevinaCatalog, pay = window.LumevinaPayments, gc = window.LumevinaGiftCards;
  if (!catalog || !pay || !gc) return;

  var byId = {};
  catalog.categories.forEach(function (c) { c.services.forEach(function (s) { byId[s.id] = s; }); });
  var money = function (n) { return "$" + Number(n).toFixed(n % 1 ? 2 : 0); };
  var VALUES = [75, 100, 150, 250];

  var state = { svc: null, kind: "value", amount: 100 };
  var backdrop, modal, els = {}, lastFocus = null;

  var build = function () {
    backdrop = document.createElement("div"); backdrop.className = "lm-backdrop"; backdrop.hidden = true;
    modal = document.createElement("div"); modal.className = "lm-modal gift-modal"; modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Send a gift"); modal.setAttribute("aria-hidden", "true"); modal.hidden = true;
    modal.innerHTML =
      '<button class="lm-close" type="button" aria-label="Close">&#10005;</button>' +
      '<div class="gift-step gift-form">' +
        '<p class="eyebrow">Gift certificates</p><h3>Give the gift of glow</h3>' +
        '<div class="gift-type"><button class="gift-type-btn" type="button" data-kind="value">A value</button><button class="gift-type-btn" type="button" data-kind="service">A treatment</button></div>' +
        '<div class="gift-value-wrap"><p class="bk-label">Amount</p><div class="gift-values"></div></div>' +
        '<div class="gift-svc-wrap" hidden><p class="bk-label">Treatment</p><select class="gift-svc"></select></div>' +
        '<div class="bk-field"><label for="gf-rname">Recipient name</label><input id="gf-rname" type="text"></div>' +
        '<div class="bk-field"><label for="gf-remail">Recipient email</label><input id="gf-remail" type="email"></div>' +
        '<div class="bk-field"><label for="gf-msg">Message <span class="gf-opt">(optional)</span></label><input id="gf-msg" type="text" maxlength="140"></div>' +
        '<div class="bk-card">' +
          '<div class="bk-field"><label for="gf-card">Card number</label><input id="gf-card" inputmode="numeric" placeholder="4242 4242 4242 4242"></div>' +
          '<div class="bk-card-row"><div class="bk-field"><label for="gf-exp">Expiry</label><input id="gf-exp" placeholder="MM/YY" inputmode="numeric"></div>' +
          '<div class="bk-field"><label for="gf-cvc">CVC</label><input id="gf-cvc" placeholder="123" inputmode="numeric"></div></div>' +
        '</div>' +
        '<button class="btn btn-honey gift-pay" type="button">Purchase</button><p class="bk-status gift-status" role="status"></p>' +
      '</div>' +
      '<div class="gift-step gift-done" hidden>' +
        '<div class="bk-done-mark">&#10003;</div><h3>Gift sent!</h3><p class="gift-done-msg"></p>' +
        '<div class="gift-code-box"><span>Gift code</span><code class="gift-code"></code><button class="gift-copy" type="button">Copy</button></div>' +
        '<button class="btn btn-honey gift-done-close" type="button">Done</button>' +
      '</div>';
    document.body.appendChild(backdrop); document.body.appendChild(modal);

    els.valueWrap = modal.querySelector(".gift-value-wrap"); els.values = modal.querySelector(".gift-values");
    els.svcWrap = modal.querySelector(".gift-svc-wrap"); els.svcSel = modal.querySelector(".gift-svc");
    els.rname = modal.querySelector("#gf-rname"); els.remail = modal.querySelector("#gf-remail"); els.msg = modal.querySelector("#gf-msg");
    els.card = modal.querySelector("#gf-card"); els.exp = modal.querySelector("#gf-exp"); els.cvc = modal.querySelector("#gf-cvc");
    els.pay = modal.querySelector(".gift-pay"); els.status = modal.querySelector(".gift-status");
    els.form = modal.querySelector(".gift-form"); els.done = modal.querySelector(".gift-done");
    els.doneMsg = modal.querySelector(".gift-done-msg"); els.code = modal.querySelector(".gift-code");
    pay.bindCardFields(els.card, els.exp, els.cvc);

    VALUES.forEach(function (v) {
      var b = document.createElement("button"); b.type = "button"; b.className = "gift-val"; b.textContent = money(v); b.dataset.v = v;
      b.addEventListener("click", function () { state.amount = v; syncValues(); updatePay(); });
      els.values.appendChild(b);
    });
    /* build service options */
    catalog.categories.forEach(function (c) {
      if (c.key === "gifts") return;
      c.services.forEach(function (s) {
        var o = document.createElement("option"); o.value = s.id; o.textContent = s.name + " · " + money(s.price); els.svcSel.appendChild(o);
      });
    });
    els.svcSel.addEventListener("change", function () { state.svc = byId[els.svcSel.value]; state.amount = state.svc.price; updatePay(); });

    modal.querySelectorAll(".gift-type-btn").forEach(function (b) {
      b.addEventListener("click", function () { setKind(b.dataset.kind); });
    });
    backdrop.addEventListener("click", close);
    modal.querySelector(".lm-close").addEventListener("click", close);
    modal.querySelector(".gift-done-close").addEventListener("click", close);
    modal.querySelector(".gift-copy").addEventListener("click", function () {
      var btn = this;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(els.code.textContent).then(function () { btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = "Copy"; }, 1500); }, function () {});
    });
    els.pay.addEventListener("click", purchase);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") close(); });
  };

  var syncValues = function () {
    modal.querySelectorAll(".gift-val").forEach(function (b) { b.classList.toggle("is-active", Number(b.dataset.v) === state.amount); });
  };
  var setKind = function (kind) {
    state.kind = kind;
    modal.querySelectorAll(".gift-type-btn").forEach(function (b) { b.classList.toggle("is-active", b.dataset.kind === kind); });
    els.valueWrap.hidden = kind !== "value"; els.svcWrap.hidden = kind !== "service";
    if (kind === "service") { state.svc = byId[els.svcSel.value]; state.amount = state.svc.price; }
    else { state.svc = null; if (VALUES.indexOf(state.amount) === -1) state.amount = 100; syncValues(); }
    updatePay();
  };
  var updatePay = function () { els.pay.textContent = "Purchase · " + money(state.amount); };

  var purchase = function () {
    var rname = (els.rname.value || "").trim(), remail = (els.remail.value || "").trim();
    if (!rname) return fail("Add a recipient name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remail)) return fail("Add a valid recipient email.");
    if (!pay.cardValid(els.card.value)) return fail("Check the card number.");
    if (!pay.expiryValid(els.exp.value)) return fail("Check the expiry date.");
    if (!pay.cvcValid(els.cvc.value)) return fail("Check the CVC.");
    els.pay.disabled = true; els.status.className = "bk-status gift-status"; els.status.textContent = "Processing…";
    pay.process({ amount: state.amount, description: "Gift certificate" }, function (err) {
      els.pay.disabled = false;
      if (err) return fail("Payment failed — please try again.");
      var card = gc.create({
        amount: state.amount, serviceId: state.kind === "service" && state.svc ? state.svc.id : null,
        label: state.kind === "service" && state.svc ? state.svc.name : "Any treatment",
        recipientName: rname, recipientEmail: remail, message: els.msg.value || ""
      });
      els.doneMsg.textContent = (state.kind === "service" && state.svc ? state.svc.name : money(state.amount) + " toward any treatment") + " for " + rname + ".";
      els.code.textContent = card.code;
      els.form.hidden = true; els.done.hidden = false; modal.scrollTop = 0;
    });
  };
  var fail = function (msg) { els.status.className = "bk-status gift-status is-bad"; els.status.textContent = msg; };

  var open = function (svc) {
    if (!modal) build();
    lastFocus = document.activeElement;
    els.form.hidden = false; els.done.hidden = true; els.status.textContent = "";
    els.rname.value = ""; els.remail.value = ""; els.msg.value = "";
    if (svc && !(svc.flag === "gift")) { setKind("service"); els.svcSel.value = svc.id; state.svc = svc; state.amount = svc.price; updatePay(); }
    else { setKind("value"); }
    backdrop.hidden = false; modal.hidden = false;
    void modal.offsetWidth;
    backdrop.classList.add("is-open"); modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
    modal.querySelector(".lm-close").focus();
  };
  var close = function () {
    backdrop.classList.remove("is-open"); modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
    setTimeout(function () { backdrop.hidden = true; modal.hidden = true; }, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  document.addEventListener("lumevina:gift", function (e) {
    e.preventDefault();
    if (window.LumevinaDrawer) window.LumevinaDrawer.close();
    open((e.detail && e.detail.service) || null);
  });

  window.LumevinaGift = { open: open };
})();

/* Lumevina — pre-visit intake form
   The full clinical intake (Lumevina Facial Intake + acne consent).
   The binding pre-payment consent + signature lives in the booking
   flow (js/booking.js); this longer form gathers the medical/skin
   detail and is completed before the visit — never blocking the sale.

   Real, validated, stored per client (localStorage demo, Supabase-
   ready: one row in intake_forms with a jsonb `answers`). The owner
   reads it in My Lumevina / the dashboard. Opened via
   window.LumevinaIntake.open(prefill). */

(function () {
  "use strict";

  var STORAGE_KEY = "lumevina_intake";

  var overlay = document.querySelector(".intake-overlay");
  var modal = document.querySelector(".intake-modal");
  if (!overlay || !modal) return;

  var formView = modal.querySelector(".intake-form-view");
  var successView = modal.querySelector(".intake-success");
  var submitBtn = modal.querySelector(".intake-submit");
  var statusEl = modal.querySelector(".intake-status");
  var nameEl = modal.querySelector("#in-name");
  var emailEl = modal.querySelector("#in-email");
  var signEl = modal.querySelector("#in-sign");
  var guardianField = modal.querySelector(".in-guardian-field");

  /* ── Storage (keyed by lowercased email) ── */
  var loadAll = function () {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (err) { return {}; }
  };

  var save = function (record) {
    var all = loadAll();
    all[record.email.toLowerCase()] = record;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
    catch (err) { /* private mode */ }
  };

  var getFor = function (email) {
    if (!email) return null;
    return loadAll()[email.toLowerCase()] || null;
  };

  /* ── Serialize every named control into an answers object ──
     radios → chosen value · checkbox groups → array · lone
     checkbox → "value"/absent · text/textarea → string */
  var collect = function () {
    var out = {};
    var controls = formView.querySelectorAll("[name]");
    controls.forEach(function (el) {
      var n = el.name;
      if (el.type === "radio") {
        if (el.checked) out[n] = el.value;
      } else if (el.type === "checkbox") {
        var group = formView.querySelectorAll('[name="' + n + '"]');
        if (group.length > 1) {                 /* a checkbox group */
          if (!Array.isArray(out[n])) out[n] = [];
          if (el.checked) out[n].push(el.value);
        } else if (el.checked) {
          out[n] = el.value || true;
        }
      } else {
        var v = el.value.trim();
        if (v) out[n] = v;
      }
    });
    return out;
  };

  var setValue = function (name, value) {
    var els = formView.querySelectorAll('[name="' + name + '"]');
    els.forEach(function (el) {
      if (el.type === "radio") el.checked = (el.value === value);
      else if (el.type === "checkbox") {
        el.checked = Array.isArray(value)
          ? value.indexOf(el.value) !== -1 : !!value;
      } else if (value != null) el.value = value;
    });
  };

  var clearForm = function () {
    formView.querySelectorAll("[name]").forEach(function (el) {
      if (el.type === "radio" || el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
  };

  var syncGuardian = function () {
    var minor = formView.querySelector('[name="minor"]:checked');
    guardianField.hidden = !(minor && minor.value === "Yes");
  };

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function (prefill) {
    lastFocus = document.activeElement;
    statusEl.textContent = "";
    formView.hidden = false;
    successView.hidden = true;
    prefill = prefill || {};
    clearForm();

    var acct = window.LumevinaAccount && window.LumevinaAccount.current();
    var email = prefill.email || (acct && acct.email) || "";
    var prior = getFor(email);
    if (prior && prior.answers) {
      Object.keys(prior.answers).forEach(function (k) {
        setValue(k, prior.answers[k]);
      });
    }
    nameEl.value = prefill.name || (prior && prior.name) || (acct && acct.name) || "";
    emailEl.value = email;
    signEl.value = "";
    syncGuardian();

    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var closeModal = function () {
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    var mm = document.getElementById("mobile-menu");
    var bk = document.querySelector(".booking-modal");
    document.body.style.overflow =
      ((mm && !mm.hidden) || (bk && bk.getAttribute("aria-hidden") === "false"))
        ? "hidden" : "";
    if (lastFocus) lastFocus.focus();
  };

  modal.querySelector(".intake-close").addEventListener("click", closeModal);
  modal.querySelector(".intake-done").addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeModal();
  });
  formView.addEventListener("change", function (e) {
    if (e.target && e.target.name === "minor") syncGuardian();
  });

  /* ── Submit ── */
  submitBtn.addEventListener("click", function () {
    var name = nameEl.value.trim();
    var email = emailEl.value.trim();
    var sig = signEl.value.trim();
    var answers = collect();

    var problems = [];
    if (!name) problems.push("your name");
    if (!email || !emailEl.checkValidity()) problems.push("a valid email");
    if (!answers.terms) problems.push("agreement to the terms");
    if (!answers.covid_symptoms || !answers.covid_consent) problems.push("the health confirmations");
    if (!answers.photo_consent) problems.push("a photo-permission choice");
    if (!answers.minor) problems.push("whether you're under 18");
    if (answers.minor === "Yes" && !answers.guardian) problems.push("your guardian's name & phone");
    if (!sig) problems.push("your signature");
    else if (sig.toLowerCase() !== name.toLowerCase()) problems.push("a signature matching your name");

    if (problems.length) {
      statusEl.textContent = "Please add: " + problems.join(", ") + ".";
      var first = formView.querySelector(".intake-status");
      if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    var record = {
      name: name, email: email,
      answers: answers, signature: sig,
      signedAt: new Date().toISOString()
    };
    save(record);

    /* LIVE: upsert { email, name, answers, signature, signed_at } into
       Supabase intake_forms here (see server/README.md). */

    formView.hidden = true;
    successView.hidden = false;
    modal.querySelector(".intake-done").focus();
    document.dispatchEvent(new CustomEvent("lumevina:intake-saved",
      { detail: { email: email } }));
  });

  window.LumevinaIntake = {
    open: openModal,
    hasFormFor: function (email) { return !!getFor(email); },
    getFor: getFor
  };
})();

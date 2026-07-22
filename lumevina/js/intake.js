/* Lumevina — pre-visit intake form
   The digital consultation/consent form clients complete before a
   visit (GlossGenius parity). Real, validated, and stored — in the
   demo to localStorage keyed by email; live, it saves to Supabase
   alongside the booking (see server/README.md). The owner sees each
   client's latest form in My Lumevina / the dashboard.

   window.LumevinaIntake.open(prefill) opens it; booking.js calls this
   from the success screen, and account.js links to it. */

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

  var fields = {
    name: modal.querySelector("#in-name"),
    dob: modal.querySelector("#in-dob"),
    phone: modal.querySelector("#in-phone"),
    email: modal.querySelector("#in-email"),
    concerns: modal.querySelector("#in-concerns"),
    products: modal.querySelector("#in-products"),
    allergies: modal.querySelector("#in-allergies"),
    meds: modal.querySelector("#in-meds"),
    pregnant: modal.querySelector("#in-pregnant"),
    sun: modal.querySelector("#in-sun"),
    accutane: modal.querySelector("#in-accutane"),
    consent: modal.querySelector("#in-consent"),
    signature: modal.querySelector("#in-sign")
  };

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

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function (prefill) {
    lastFocus = document.activeElement;
    statusEl.textContent = "";
    formView.hidden = false;
    successView.hidden = true;
    prefill = prefill || {};

    /* pull known values: passed-in, signed-in account, or a prior form */
    var acct = window.LumevinaAccount && window.LumevinaAccount.current();
    var email = prefill.email || (acct && acct.email) || "";
    var prior = getFor(email);
    var src = prior || {};
    fields.name.value = prefill.name || src.name || (acct && acct.name) || "";
    fields.email.value = email || src.email || "";
    fields.dob.value = src.dob || "";
    fields.phone.value = src.phone || "";
    fields.concerns.value = src.concerns || "";
    fields.products.value = src.products || "";
    fields.allergies.value = src.allergies || "";
    fields.meds.value = src.meds || "";
    fields.pregnant.checked = !!src.pregnant;
    fields.sun.checked = !!src.sun;
    fields.accutane.checked = !!src.accutane;
    fields.consent.checked = false;
    fields.signature.value = "";

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
    /* keep scroll locked if the booking modal is still open under us */
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

  /* ── Submit ── */
  submitBtn.addEventListener("click", function () {
    var problems = [];
    if (!fields.name.value.trim()) problems.push("your name");
    if (!fields.email.value.trim() || !fields.email.checkValidity()) problems.push("a valid email");
    if (!fields.consent.checked) problems.push("your consent");
    var sig = fields.signature.value.trim();
    if (!sig) problems.push("your signature");
    else if (sig.toLowerCase() !== fields.name.value.trim().toLowerCase()) {
      problems.push("a signature matching your name");
    }
    if (problems.length) {
      statusEl.textContent = "Please add: " + problems.join(", ") + ".";
      return;
    }

    var record = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      dob: fields.dob.value,
      phone: fields.phone.value.trim(),
      concerns: fields.concerns.value.trim(),
      products: fields.products.value.trim(),
      allergies: fields.allergies.value.trim(),
      meds: fields.meds.value.trim(),
      pregnant: fields.pregnant.checked,
      sun: fields.sun.checked,
      accutane: fields.accutane.checked,
      signature: sig,
      signedAt: new Date().toISOString()
    };
    save(record);

    /* LIVE: POST record to Supabase (intake_forms table) here. */

    formView.hidden = true;
    successView.hidden = false;
    modal.querySelector(".intake-done").focus();
    document.dispatchEvent(new CustomEvent("lumevina:intake-saved",
      { detail: { email: record.email } }));
  });

  window.LumevinaIntake = {
    open: openModal,
    hasFormFor: function (email) { return !!getFor(email); },
    getFor: getFor
  };
})();

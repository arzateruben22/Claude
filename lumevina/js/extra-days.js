/* Lumevina — extra Mondays
 *
 * The spa is open Tuesday to Saturday. When banked facials build up (members
 * paid for them but haven't booked), Evelyn opens a Monday: every other week,
 * or every week. The owner dashboard sets it; the booking calendar reads it.
 *
 * Members book extra Mondays first, since those days exist to clear their
 * banked facials. Everyone else can book one from the Friday before.
 *
 * Demo: the choice lives in this browser (lumevina_extra_mondays), every
 * other Monday to start.
 * Live: one row in site_settings (key "extra_mondays"), off until she turns
 * it on; the dashboard saves it through functions/studio with her studio key,
 * every browser reads it, and functions/book checks the same rule
 * (server/functions/_shared/hours.ts).
 */
(function () {
  "use strict";

  var KEY = "lumevina_extra_mondays";
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var base = LIVE ? SHOP.supabase.replace(/\/$/, "") : "";
  var ANCHOR = new Date(2026, 8, 28);      /* Mon, Sep 28 2026: "every other week" counts from here */
  var DEFAULT_EVERY = LIVE ? 0 : 2;        /* demo: every other Monday, as in the 90-day plan; live: her choice */
  var OPEN_TO_ALL_DAYS = 3;                /* from the Friday before */

  var read = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  };
  var every = function () {
    var s = read();
    return (s.every === 0 || s.every === 1 || s.every === 2) ? s.every : DEFAULT_EVERY;
  };
  var saveStatus = null;   /* live: "saving", "saved", "failed", "no_key" */
  var keep = function (n) {
    try { localStorage.setItem(KEY, JSON.stringify({ every: n, at: new Date().toISOString() })); } catch (e) { /* private mode */ }
  };
  var set = function (n) {
    keep(n);
    if (!LIVE) return Promise.resolve();
    var key = "";
    try { key = localStorage.getItem("lumevina_studio_key") || ""; } catch (e) { /* private mode */ }
    if (!key) { saveStatus = "no_key"; return Promise.resolve(); }
    saveStatus = "saving";
    return fetch(base + "/functions/v1/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + SHOP.key, "x-studio-key": key },
      body: JSON.stringify({ action: "extra_mondays_set", every: n })
    }).then(function (r) { saveStatus = r.ok ? "saved" : "failed"; }, function () { saveStatus = "failed"; });
  };
  /* live: the choice everyone books against */
  if (LIVE && window.fetch) {
    fetch(base + "/rest/v1/site_settings?key=eq.extra_mondays&select=value", { headers: { apikey: SHOP.key, Authorization: "Bearer " + SHOP.key } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows) return;
        var v = rows[0] && rows[0].value;
        keep(v && (v.every === 1 || v.every === 2) ? v.every : 0);
        document.dispatchEvent(new CustomEvent("lumevina:extra-days"));
      }, function () { /* offline: the last copy stands */ });
  }

  var midnight = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

  /* is this date an extra Monday? */
  var isExtra = function (d) {
    var n = every();
    if (!n || d.getDay() !== 1) return false;
    var weeks = Math.round((midnight(d) - ANCHOR) / (7 * 864e5));
    return ((weeks % n) + n) % n === 0;
  };

  /* the day it opens to everyone, not just members */
  var openToAllFrom = function (d) {
    var f = midnight(d);
    f.setDate(f.getDate() - OPEN_TO_ALL_DAYS);
    return f;
  };
  var membersOnly = function (d, now) {
    return isExtra(d) && midnight(now || new Date()) < openToAllFrom(d);
  };

  /* the next few extra Mondays, for the dashboard */
  var upcoming = function (count) {
    var out = [], d = midnight(new Date());
    for (var i = 0; out.length < count && i < 120; i++, d.setDate(d.getDate() + 1)) {
      if (isExtra(d)) out.push(new Date(d));
    }
    return out;
  };

  var label = function () {
    var n = every();
    return n === 2 ? "every other Monday" : n === 1 ? "every Monday" : "";
  };

  window.LumevinaExtraDays = {
    every: every, set: set, isExtra: isExtra, membersOnly: membersOnly,
    openToAllFrom: openToAllFrom, upcoming: upcoming, label: label,
    live: LIVE, saveStatus: function () { return saveStatus; }
  };
})();

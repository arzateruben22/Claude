/* Lumevina — skin plans
 *
 * The routine Evelyn writes for each client in her dashboard (Clients →
 * Skin plan). The client sees it in My Lumevina, and Ask Lumevina answers
 * their "what do I use tonight?" questions from it, so they don't wait on
 * her for what she has already told them.
 *
 * DEMO: plans live in this browser (localStorage "lumevina_skin_plans",
 * keyed by email), shared with the dashboard when both run from the same
 * place. LIVE (js/site-config.js → shop): the client-plans function
 * (server/functions/client-plans). The client reads their own with their
 * sign-in; Evelyn's dashboard writes with the studio key.
 *
 * A plan: { skinType, concerns[], goal, phase, morning[], night[], weekly[],
 *           avoid, next, note, log[], updatedAt }
 *   morning / night / weekly: [{ id, name, how }]   id = a shelf product, or "" for one she names
 *   log: [{ at: "YYYY-MM-DD", text }]               her visit notes, newest first
 * (the same shape as server/functions/_shared/plans.ts)
 */
(function () {
  "use strict";

  var KEY = "lumevina_skin_plans";
  var CFG = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(CFG.supabase || "") && !!CFG.key;
  var SKIN_TYPES = ["Dry", "Normal", "Combination", "Oily", "Sensitive", "Acne-prone"];

  var read = function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  var write = function (all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode */ } };
  var norm = function (email) { return String(email || "").trim().toLowerCase(); };
  var str = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };

  /* her shelf (js/catalog.js), for product names */
  var shelf = function () {
    var C = window.LUMEVINA_CATALOG;
    return C ? C.products.filter(function (p) { return !p.draft; }) : [];
  };
  var product = function (id) {
    var list = shelf();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  var steps = function (v) {
    return (Array.isArray(v) ? v : []).slice(0, 12).map(function (x) {
      var p = x && x.id ? product(x.id) : null;
      return { id: p ? p.id : "", name: p ? p.name : str(x && x.name, 80), how: str(x && x.how, 300) };
    }).filter(function (x) { return x.name; });
  };
  /* every field bounded, products checked against the shelf */
  var clean = function (p) {
    p = p || {};
    return {
      skinType: SKIN_TYPES.indexOf(p.skinType) !== -1 ? p.skinType : "",
      concerns: (Array.isArray(p.concerns) ? p.concerns : []).slice(0, 8).map(function (c) { return str(c, 60); }).filter(Boolean),
      goal: str(p.goal, 400), phase: str(p.phase, 600),
      morning: steps(p.morning), night: steps(p.night), weekly: steps(p.weekly),
      avoid: str(p.avoid, 600), next: str(p.next, 400), note: str(p.note, 800),
      log: (Array.isArray(p.log) ? p.log : []).slice(0, 40).map(function (e) {
        return { at: /^\d{4}-\d{2}-\d{2}$/.test(String(e && e.at)) ? e.at : new Date().toISOString().slice(0, 10), text: str(e && e.text, 600) };
      }).filter(function (e) { return e.text; }),
      updatedAt: p.updatedAt || ""
    };
  };
  var empty = function (p) {
    return !p || !(p.skinType || p.concerns.length || p.goal || p.phase || p.morning.length || p.night.length ||
      p.weekly.length || p.avoid || p.next || p.note || p.log.length);
  };

  /* ── the server ── */
  var call = function (body, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json", apikey: CFG.key, Authorization: "Bearer " + (opts.token || CFG.key) };
    if (opts.studioKey) headers["x-studio-key"] = opts.studioKey;
    return fetch(CFG.supabase.replace(/\/$/, "") + "/functions/v1/client-plans", { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok) { var err = new Error(j.reason || "client-plans " + res.status); err.reason = j.reason || "failed"; throw err; }
          return j;
        });
      });
  };

  /* the signed-in client's plan, once fetched (live) */
  var mineCache = { email: "", plan: null };
  var changed = function (email) { document.dispatchEvent(new CustomEvent("lumevina:plan-changed", { detail: { email: email } })); };

  /** A plan by email, right away: this browser's copy, or the signed-in client's fetched one. */
  var get = function (email) {
    var k = norm(email);
    if (!k) return null;
    if (LIVE && mineCache.email === k) return mineCache.plan;
    var p = read()[k];
    return p ? clean(p) : null;
  };

  /** The signed-in client's plan (null when there's none). */
  var mine = function () {
    var A = window.LumevinaAccount, s = A && A.current();
    if (!s) return Promise.resolve(null);
    var token = A.token ? A.token() : "";
    if (!LIVE || !token) return Promise.resolve(get(s.email));
    return call({ action: "mine" }, { token: token }).then(function (r) {
      var p = r.plan ? clean(Object.assign({}, r.plan, { updatedAt: r.updatedAt })) : null;
      var was = JSON.stringify(mineCache.plan);
      mineCache = { email: norm(s.email), plan: p };
      if (JSON.stringify(p) !== was) changed(s.email);
      return p;
    }, function () { return get(s.email); });
  };

  /** Evelyn saves a plan (the dashboard). Live, the studio key is required. */
  var save = function (email, name, plan, studioKey) {
    var k = norm(email);
    var p = clean(plan);
    p.updatedAt = new Date().toISOString();
    var local = function () {
      var all = read();
      all[k] = Object.assign({ name: str(name, 120) }, p);
      write(all);
      changed(k);
      return p;
    };
    if (!LIVE) return Promise.resolve(local());
    if (!studioKey) return Promise.reject(Object.assign(new Error("studio key"), { reason: "studio_key" }));
    return call({ action: "save", email: k, name: name, plan: p }, { studioKey: studioKey }).then(function (r) {
      p.updatedAt = r.updatedAt || p.updatedAt;
      return local();
    });
  };

  /** Every plan, for the dashboard: { email: plan (with .name) }. */
  var all = function (studioKey) {
    var local = read(), out = {};
    Object.keys(local).forEach(function (k) { out[k] = Object.assign(clean(local[k]), { name: local[k].name || "" }); });
    if (!LIVE || !studioKey) return Promise.resolve(out);
    return call({ action: "list" }, { studioKey: studioKey }).then(function (r) {
      var mirror = {};
      (r.plans || []).forEach(function (row) {
        out[row.email] = Object.assign(clean(Object.assign({}, row.plan, { updatedAt: row.updatedAt })), { name: row.name || "" });
        mirror[row.email] = Object.assign({ name: row.name || "" }, out[row.email]);
      });
      write(Object.assign(read(), mirror));
      return out;
    }, function () { return out; });
  };

  /* ── words, for the account panel and the chat ── */
  var stepText = function (list) {
    return list.map(function (s, i) { return (i + 1) + ". " + s.name + (s.how ? " (" + s.how + ")" : ""); }).join(" ");
  };

  /* what a client asks about their own plan, and what it would change instead */
  var ASKS = [
    { part: "morning", k: /\b(morning|a\.?m\.? routine|when i wake|before work)\b/ },
    { part: "night", k: /\b(night|tonight|p\.?m\.? routine|before bed|bedtime|evening)\b/ },
    { part: "weekly", k: /\b(weekly|once a week|twice a week|each week|every week)\b/ },
    { part: "avoid", k: /\b(avoid|stay away|not supposed to|shouldn'?t (use|do)|can'?t use)\b/ },
    { part: "next", k: /\bnext (step|visit|appointment|treatment|facial)|when (do|should) i (come|book|go) (back|in)\b|when'?s my next/ },
    { part: "phase", k: /\bwhere am i\b|what (week|stage|phase)|my progress|how am i doing/ },
    { part: "all", k: /\bmy (routine|regimen|plan|skin ?care( routine)?|products)\b|what (do|should) i (use|put on|apply)|(which|what) order|what'?s my (routine|plan)/ }
  ];
  var CHANGES = /\b(add|adding|switch|swap|stop|stopping|change|replace|instead|combine|mix|layer .* with|start using|try|new|more often|increase|move up|stronger|higher)\b/;

  /** An answer from the plan, or null when the plan doesn't cover the question. */
  var answer = function (plan, text, firstName) {
    if (!plan || empty(plan)) return null;
    var t = String(text || "").toLowerCase();
    if (CHANGES.test(t)) return null;
    var ask = null;
    for (var i = 0; i < ASKS.length; i++) if (ASKS[i].k.test(t)) { ask = ASKS[i].part; break; }
    if (!ask) return null;
    var lead = "From the plan Evelyn wrote for you" + (firstName ? ", " + firstName : "") + ": ";
    var parts = [];
    if (ask === "morning" || ask === "all") if (plan.morning.length) parts.push("Morning: " + stepText(plan.morning));
    if (ask === "night" || ask === "all") if (plan.night.length) parts.push("Night: " + stepText(plan.night));
    if (ask === "weekly" || ask === "all") if (plan.weekly.length) parts.push("Once or twice a week: " + stepText(plan.weekly));
    if (ask === "avoid" || ask === "all") if (plan.avoid) parts.push("Avoid for now: " + plan.avoid);
    if (ask === "next") if (plan.next) parts.push("Next: " + plan.next);
    if (ask === "phase") if (plan.phase) parts.push("Where you are now: " + plan.phase);
    if (!parts.length) return null;
    var dot = function (x) { return /[.!?]$/.test(x) ? x : x + "."; };
    return lead + parts.map(dot).join(" ") + " Anything you'd like to change goes to Evelyn.";
  };

  window.LumevinaPlans = {
    live: LIVE,
    SKIN_TYPES: SKIN_TYPES,
    get: get,
    mine: mine,
    save: save,
    all: all,
    clean: clean,
    empty: empty,
    answer: answer,
    stepText: stepText,
    shelf: shelf
  };
})();

/* Lumevina — your skin profile, and what the chat remembers (My Lumevina)
 *
 * A signed-in client tells us about their skin in about two minutes, one
 * question at a time: skin type, what they're working on, what they use
 * morning and night (any brand), anything weekly, supplements, treatments
 * they've had here or elsewhere, what their skin reacts to, and their goal.
 * It's saved only with their yes. Ask Lumevina then answers from Evelyn's
 * playbook made specific to them, and keeps short notes of what they tell it
 * ("Uses CeraVe Hydrating Cleanser at night"), which they see here and can
 * delete one by one or all at once. Evelyn sees both on their client card.
 *
 * Medicines, prescriptions and health conditions aren't kept here: those go
 * on the pre-visit form, for Evelyn.
 *
 * LIVE (js/site-config.js → shop): functions/profile with the client's
 * sign-in; the chat's notes come from functions/ask. DEMO: this browser
 * (lumevina_profiles, lumevina_memory), and the chat notes simple "I use…",
 * "I take…" and "my skin reacts to…" sentences itself.
 */
(function () {
  "use strict";

  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
  var card = document.querySelector(".acct-pf-card");
  if (!card) return;
  var metaEl = document.querySelector(".acct-pf-meta");

  var SKIN = ["Dry", "Normal", "Combination", "Oily", "Sensitive", "Acne-prone"];
  var CONCERNS = ["Breakouts", "Dark spots", "Redness", "Dryness", "Oiliness", "Fine lines", "Texture", "Dullness", "Sensitivity", "Ingrown hairs"];
  /* the same line as the server (functions/_shared/profiles.ts): medicines and health stay with Evelyn */
  var HEALTH = /\b(accutane|isotretinoin|absorica|claravis|tretinoin|retin-?a|adapalene|differin|tazarotene|spironolactone|doxycycline|minocycline|antibiotic|prescri|birth control|the pill|medication|medicine|pregnan|breastfeed|nursing|diagnos|eczema|psoriasis|rosacea|dermatitis|lupus|diabet|thyroid|pcos|cancer|chemo)/i;
  var STEPS = [
    { key: "skinType", kind: "one", q: "What's your skin like most days?", options: SKIN },
    { key: "concerns", kind: "multi", q: "What are you working on?", hint: "Tap all that fit.", options: CONCERNS },
    { key: "morning", kind: "text", q: "What do you use in the morning?", hint: "Any brand, any order. A rough list is perfect.", ph: "Cleanser, vitamin C, moisturizer, SPF…", none: "Nothing yet" },
    { key: "night", kind: "text", q: "And at night?", ph: "Makeup remover, cleanser, retinol, moisturizer…", none: "Nothing yet" },
    { key: "weekly", kind: "text", q: "Anything once or twice a week?", hint: "Exfoliants, masks, at-home peels, tools.", ph: "A glycolic toner on Sundays…", none: "Nothing" },
    { key: "supplements", kind: "text", q: "Any supplements you take?", hint: "Vitamins, collagen, zinc, anything. Evelyn sees this; the chat won't advise on supplements. Prescriptions go on your pre-visit form instead.", ph: "Collagen, zinc…", none: "None" },
    { key: "treatments", kind: "text", q: "Treatments you've had, here or elsewhere?", hint: "Facials, peels, laser, microneedling, injectables, and roughly when.", ph: "A chemical peel in August, Botox in May…", none: "None" },
    { key: "sensitivities", kind: "text", q: "Anything your skin reacts to?", hint: "Ingredients, products, fragrance, waxing, the sun.", ph: "Fragrance makes me red…", none: "Nothing I know of" },
    { key: "goal", kind: "text", q: "What would you love your skin to do?", ph: "Clear up my chin, even out dark spots…" }
  ];
  var LABEL = { skinType: "Skin", concerns: "Working on", morning: "Morning", night: "Night", weekly: "Once or twice a week",
    supplements: "Supplements", treatments: "Treatments you've had", sensitivities: "Reacts to", goal: "Your goal" };

  var esc = function (t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; };
  var lget = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var lset = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  var session = function () { return window.LumevinaAccount && window.LumevinaAccount.current(); };
  var token = function () { return window.LumevinaAccount && window.LumevinaAccount.token ? window.LumevinaAccount.token() : ""; };
  var blank = function () { return { skinType: "", concerns: [], goal: "", morning: "", night: "", weekly: "", supplements: "", treatments: "", sensitivities: "" }; };
  var empty = function (p) { return !p || (!p.skinType && !(p.concerns || []).length && !STEPS.some(function (s) { return s.kind === "text" && p[s.key]; })); };
  var day = function (iso) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

  /* ── where it's kept: the server (live), or this browser (demo) ── */
  var cache = { email: null, profile: null, updated: null, memories: [] };
  var api = function (body) {
    return fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + (token() || SHOP.key) },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  };
  var fromServer = function (j, email) {
    cache = { email: email, profile: j.profile || null, updated: j.updated_at || null,
      memories: (j.memories || []).map(function (m) { return { id: m.id, fact: m.fact, kind: m.kind, at: m.at }; }) };
    return cache;
  };
  var demoRead = function (email) {
    var k = String(email).toLowerCase(), p = lget("lumevina_profiles")[k] || null, m = lget("lumevina_memory")[k] || [];
    cache = { email: email, profile: p ? p.profile : null, updated: p ? p.updated : null, memories: m.slice().reverse() };
    return cache;
  };
  var load = function () {
    var s = session();
    if (!s) { cache = { email: null, profile: null, updated: null, memories: [] }; return Promise.resolve(cache); }
    if (!LIVE) return Promise.resolve(demoRead(s.email));
    if (!token()) return Promise.resolve(cache);
    return api({ action: "get" }).then(function (j) { return fromServer(j, s.email); }, function () { return cache; });
  };
  var saveProfile = function (p) {
    var s = session();
    if (!s) return Promise.reject({ reason: "sign_in" });
    if (LIVE) return api({ action: "save", profile: p, consent: true }).then(function (j) { return fromServer(j, s.email); });
    var all = lget("lumevina_profiles"), k = s.email.toLowerCase(), now = new Date().toISOString();
    all[k] = { profile: p, consent_at: (all[k] && all[k].consent_at) || now, updated: now };
    lset("lumevina_profiles", all);
    return Promise.resolve(demoRead(s.email));
  };
  var change = function (body) {
    var s = session();
    if (!s) return Promise.resolve(cache);
    if (LIVE) return api(body).then(function (j) { return fromServer(j, s.email); });
    var k = s.email.toLowerCase(), mem = lget("lumevina_memory");
    if (body.action === "forget") mem[k] = (mem[k] || []).filter(function (m) { return m.id !== body.id; });
    if (body.action === "forget_all" || body.action === "delete") delete mem[k];
    lset("lumevina_memory", mem);
    if (body.action === "delete") { var all = lget("lumevina_profiles"); delete all[k]; lset("lumevina_profiles", all); }
    return Promise.resolve(demoRead(s.email));
  };

  /* demo only: the chat notes what a signed-in client says about their own skin or routine */
  var SAID = [
    [/\bI(?:'m| am)? (?:use|using|currently use)\s+(.+)/i, "Uses ", "product"],
    [/\bI(?:'m| am)? (?:take|taking)\s+(.+)/i, "Takes ", "supplement"],
    [/\bI (?:just )?started (?:using )?(.+)/i, "Started ", "product"],
    [/\b(?:my skin|I) reacts? to\s+(.+)/i, "Reacts to ", "sensitivity"],
    [/\bI(?:'m| am) allergic to\s+(.+)/i, "Allergic to ", "sensitivity"]
  ];
  var learn = function (text) {
    var s = session();
    if (LIVE || !s) return [];
    var out = [];
    String(text).split(/[.!?]+\s+/).forEach(function (sentence) {
      SAID.forEach(function (rule) {
        var m = rule[0].exec(sentence);
        if (!m) return;
        var what = m[1].split(/[,.;?!]|\s(?:and|but|so|can|could|should|is|will|would|do|does|because)\s/i)[0].trim();
        if (what.length < 3 || what.split(/\s+/).length > 9 || HEALTH.test(sentence)) return;
        var fact = rule[1] + what;
        var mem = lget("lumevina_memory"), k = s.email.toLowerCase(), list = mem[k] || [];
        if (list.some(function (x) { return x.fact.toLowerCase() === fact.toLowerCase(); })) return;
        list.push({ id: "m" + Date.now().toString(36) + out.length, fact: fact, kind: rule[2], at: new Date().toISOString() });
        mem[k] = list.slice(-60);
        lset("lumevina_memory", mem);
        out.push(fact);
      });
    });
    if (out.length) demoRead(s.email);
    return out;
  };

  /* ── the card in My Lumevina ── */
  var armed = null;
  var draw = function () {
    var s = session();
    if (!s) { card.innerHTML = ""; return; }
    var p = cache.profile;
    metaEl.textContent = p && cache.updated ? "In your words · updated " + day(cache.updated) : "";
    var html = "";
    if (empty(p)) {
      html += '<p class="acct-plan-empty">Tell us about your skin and what you use now, and the chat’s answers get specific to you. About two minutes; you can change it any time.</p>' +
        '<button class="btn btn-solid acct-pf-build" type="button">Build my skin profile</button>';
    } else {
      var about = [p.skinType ? p.skinType + " skin" : "", (p.concerns || []).length ? "working on " + p.concerns.join(", ").toLowerCase() : ""].filter(Boolean).join(" · ");
      html += (about ? '<p class="acct-plan-about">' + esc(about) + "</p>" : "") +
        ["morning", "night", "weekly", "supplements", "treatments", "sensitivities", "goal"].map(function (k) {
          return p[k] ? '<p class="acct-plan-k">' + esc(LABEL[k]) + '</p><p class="acct-plan-t">' + esc(p[k]) + "</p>" : "";
        }).join("") +
        '<button class="btn btn-ghost acct-pf-build" type="button">Edit my profile</button>';
    }
    var mem = cache.memories || [];
    html += '<p class="acct-plan-k acct-pf-mem-k">What the chat remembers</p>' + (mem.length
      ? '<ul class="acct-pf-mem" role="list">' + mem.map(function (m) {
          return '<li><span>' + esc(m.fact) + '<small>' + esc(day(m.at)) + '</small></span><button type="button" class="acct-pf-x" data-forget="' + esc(m.id) +
            '" aria-label="Forget: ' + esc(m.fact) + '">&times;</button></li>';
        }).join("") + "</ul>"
      : '<p class="acct-plan-empty">Nothing yet. When you tell the chat about your skin or routine, it keeps a short note here for next time.</p>');
    var links = [];
    if (mem.length) links.push('<button type="button" class="linklike acct-pf-forget-all">Forget everything the chat remembers</button>');
    if (!empty(p)) links.push('<button type="button" class="linklike acct-pf-delete">Delete my profile</button>');
    if (links.length) html += '<p class="acct-pf-links">' + links.join("") + "</p>";
    card.innerHTML = html;
  };
  var paint = function () { draw(); return load().then(function () { draw(); return cache; }); };

  card.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.classList.contains("acct-pf-build")) { open(b); return; }
    if (b.dataset.forget) { b.disabled = true; change({ action: "forget", id: b.dataset.forget }).then(draw, draw); return; }
    var two = function (label, body) {
      if (armed !== b) { armed = b; b.textContent = label; setTimeout(function () { if (armed === b) { armed = null; draw(); } }, 4000); return; }
      armed = null; b.disabled = true;
      change(body).then(draw, draw);
    };
    if (b.classList.contains("acct-pf-forget-all")) two("Tap again to forget everything", { action: "forget_all" });
    if (b.classList.contains("acct-pf-delete")) two("Tap again to delete your profile and the chat's notes", { action: "delete" });
  });

  /* ── the builder: one question at a time, then a look over it and their yes ── */
  var overlay = document.createElement("div");
  overlay.className = "pf-overlay"; overlay.hidden = true;
  var sheet = document.createElement("div");
  sheet.className = "pf-sheet"; sheet.hidden = true;
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "pf-q");
  sheet.tabIndex = -1;
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  var st = { step: 0, p: blank(), from: null, saving: false, err: "" };

  var stepHtml = function (i) {
    var s = STEPS[i], v = st.p[s.key];
    var head = '<div class="pf-progress" aria-hidden="true"><span style="width:' + Math.round(i / STEPS.length * 100) + '%"></span></div>' +
      '<p class="pf-k">Your skin profile · ' + (i + 1) + " of " + STEPS.length + "</p>" +
      '<h2 class="pf-q" id="pf-q">' + esc(s.q) + "</h2>" + (s.hint ? '<p class="pf-hint">' + esc(s.hint) + "</p>" : "");
    var body = "";
    if (s.kind === "one" || s.kind === "multi") {
      body = '<div class="pf-chips" role="group" aria-label="' + esc(s.q) + '">' + s.options.map(function (o) {
        var on = s.kind === "one" ? v === o : (v || []).indexOf(o) !== -1;
        return '<button type="button" class="sh-chip pf-chip" data-v="' + esc(o) + '" aria-pressed="' + on + '">' + esc(o) + "</button>";
      }).join("") + "</div>";
    } else {
      body = '<label class="sr-only" for="pf-in">' + esc(s.q) + '</label><textarea id="pf-in" class="pf-in" rows="3" placeholder="' + esc(s.ph || "") + '">' + esc(v || "") + "</textarea>" +
        (s.none ? '<button type="button" class="sh-chip pf-none" aria-pressed="' + (v === s.none) + '">' + esc(s.none) + "</button>" : "");
    }
    var answered = s.kind === "multi" ? (v || []).length : !!v;
    return head + '<div class="pf-answer">' + body + "</div>" +
      '<div class="pf-nav">' + (i ? '<button type="button" class="btn btn-ghost pf-back">Back</button>' : "") +
      '<button type="button" class="btn btn-solid pf-next">' + (answered ? "Next" : "Skip") + "</button></div>";
  };
  var reviewHtml = function () {
    var p = st.p;
    var rows = STEPS.map(function (s, i) {
      var v = s.kind === "multi" ? (p[s.key] || []).join(", ") : p[s.key];
      return '<li><span class="pf-r-k">' + esc(LABEL[s.key]) + '</span><span class="pf-r-v">' + (v ? esc(v) : '<em>Skipped</em>') +
        '</span><button type="button" class="linklike pf-goto" data-goto="' + i + '" aria-label="Change: ' + esc(LABEL[s.key]) + '">Change</button></li>';
    }).join("");
    return '<div class="pf-progress" aria-hidden="true"><span style="width:100%"></span></div>' +
      '<p class="pf-k">Your skin profile · all set</p><h2 class="pf-q" id="pf-q">Look it over</h2>' +
      '<ul class="pf-review" role="list">' + rows + "</ul>" +
      '<label class="pf-consent"><input type="checkbox" class="pf-ok"' + (st.consent ? " checked" : "") + '> <span>Save this to my Lumevina profile. Evelyn and the chat use it to answer my questions, and I can change or delete it any time.</span></label>' +
      '<p class="pf-err" role="alert">' + esc(st.err) + "</p>" +
      '<div class="pf-nav"><button type="button" class="btn btn-ghost pf-back">Back</button><button type="button" class="btn btn-solid pf-save"' + (st.saving ? " disabled" : "") + ">" +
      (st.saving ? "Saving…" : "Save my profile") + "</button></div>";
  };
  var show = function (focusFirst) {
    sheet.innerHTML = '<button type="button" class="pf-x" aria-label="Close">&times;</button>' + (st.step < STEPS.length ? stepHtml(st.step) : reviewHtml());
    if (!focusFirst) return;
    var f = sheet.querySelector(".pf-in, .pf-chip, .pf-ok");
    (f || sheet).focus();
  };
  var keepText = function () {
    var t = sheet.querySelector(".pf-in");
    if (t) st.p[STEPS[st.step].key] = t.value.trim();
  };
  var open = function (from) {
    st = { step: 0, p: Object.assign(blank(), cache.profile ? JSON.parse(JSON.stringify(cache.profile)) : {}), from: from || null, saving: false, err: "", consent: !empty(cache.profile) };
    overlay.hidden = false; sheet.hidden = false;
    show(true);
  };
  var close = function () {
    sheet.hidden = true; overlay.hidden = true;
    if (st.from && st.from.isConnected) st.from.focus();
    else { var b = card.querySelector(".acct-pf-build"); if (b) b.focus(); }
  };
  overlay.addEventListener("click", close);
  sheet.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Enter" && !e.shiftKey && e.target.classList && e.target.classList.contains("pf-in") && window.matchMedia("(hover: hover)").matches) {
      e.preventDefault(); var n = sheet.querySelector(".pf-next"); if (n) n.click();
    }
  });
  sheet.addEventListener("input", function (e) {
    if (!e.target.classList.contains("pf-in")) return;
    keepText();
    var none = sheet.querySelector(".pf-none");
    if (none) none.setAttribute("aria-pressed", String(e.target.value.trim() === STEPS[st.step].none));
    sheet.querySelector(".pf-next").textContent = e.target.value.trim() ? "Next" : "Skip";
  });
  sheet.addEventListener("change", function (e) { if (e.target.classList.contains("pf-ok")) { st.consent = e.target.checked; st.err = ""; } });
  sheet.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.classList.contains("pf-x")) return close();
    var s = STEPS[st.step];
    if (b.classList.contains("pf-chip")) {
      var v = b.dataset.v;
      if (s.kind === "one") st.p[s.key] = st.p[s.key] === v ? "" : v;
      else { var list = (st.p[s.key] || []).slice(), at = list.indexOf(v); if (at === -1) list.push(v); else list.splice(at, 1); st.p[s.key] = list; }
      show();
      var again = sheet.querySelector('.pf-chip[data-v="' + v.replace(/"/g, '\\"') + '"]');
      if (again) again.focus();
      /* one choice: on to the next question */
      if (s.kind === "one" && st.p[s.key]) setTimeout(function () { if (!sheet.hidden && st.step < STEPS.length && STEPS[st.step] === s) { st.step++; show(true); } }, 220);
      return;
    }
    if (b.classList.contains("pf-none")) { st.p[s.key] = st.p[s.key] === s.none ? "" : s.none; st.step++; return show(true); }
    if (b.classList.contains("pf-next")) { keepText(); st.step++; return show(true); }
    if (b.classList.contains("pf-back")) { keepText(); st.step = Math.max(0, st.step - 1); return show(true); }
    if (b.classList.contains("pf-goto")) { st.step = +b.dataset.goto; return show(true); }
    if (b.classList.contains("pf-save")) {
      if (!st.consent) { st.err = "Tick the box to save it, so it's your yes."; return show(); }
      if (empty(st.p)) { st.err = "Nothing to save yet: answer a question or two first."; return show(); }
      st.saving = true; st.err = ""; show();
      saveProfile(st.p).then(function () {
        close(); draw();
        document.dispatchEvent(new CustomEvent("lumevina:profile-changed"));
      }, function (err) {
        st.saving = false;
        st.err = err && err.reason === "sign_in" ? "Your sign-in has ended. Sign in again, then save." : "That didn't save. Check your connection and try again.";
        show();
      });
    }
  });

  document.addEventListener("lumevina:account-changed", function () { paint(); });

  window.LumevinaProfile = {
    paint: paint, open: open, learn: learn, live: LIVE,
    /* the chat: does this client have a profile, and note what the server remembered */
    has: function () { var s = session(); return !!s && cache.email === s.email && !empty(cache.profile); },
    remembered: function () { if (LIVE) load(); },
    refresh: load
  };
  load();
})();

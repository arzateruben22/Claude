/* Lumevina — Evelyn teaches the chat, and sees what clients told it (dashboard)
 *
 * Teach the chat (#teach): when she replies to a question the chat passed to
 * her (Client questions), Claude suggests a general version of her answer:
 * no names, nothing about that one client, in her words
 * (functions/_shared/learn.ts). She checks it, edits it, and approves it;
 * from then on the chat answers that question for every client. She can
 * also add one of her own, and remove any. Medical and personal questions
 * are never suggested.
 *
 * Their skin profile (Clients → each client's card): what the client told
 * us in My Lumevina (js/profile.js), and the short notes the chat kept from
 * what they said, loaded when she opens the card.
 *
 * LIVE: functions/studio (lessons, lesson_save, lesson_add, client_profile)
 * with her studio key. DEMO: this browser (lumevina_lessons; the profiles
 * and notes the website demo saves).
 */
(function () {
  "use strict";

  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var LIVE = /^https:\/\//.test(SHOP.supabase || "") && !!SHOP.key;
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
  var day = function (iso) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

  /* ══ Teach the chat ══ */
  var card = document.getElementById("teach");
  var lessons = [], note = "";
  var KEY = "lumevina_lessons";
  if (card) {
    card.innerHTML =
      '<div class="crm-head"><div><h2>Teach the chat</h2>' +
      '<p class="sub">When you answer a question the chat passed to you, Claude suggests a general version of your answer here. Check it, take out anything personal, and approve it: from then on the chat answers it for every client, in your words. Medical and personal questions are never suggested.</p></div></div>' +
      '<p class="tc-msg" role="status"></p>' +
      '<ul class="tc-list" id="tc-list"></ul>' +
      '<details class="tc-add"><summary>Add one of your own</summary><form class="tc-new" autocomplete="off">' +
        '<label>Question<input name="question" placeholder="Do you do lash extensions?" maxlength="300"></label>' +
        '<label>Your answer<textarea name="answer" rows="3" placeholder="As you would text it" maxlength="1500"></textarea></label>' +
        '<button class="bk-export" type="submit">Add it</button></form></details>' +
      '<details class="cq-done tc-known" hidden><summary></summary><ul class="tc-list" id="tc-known"></ul></details>';
  }
  var $ = function (sel) { return card.querySelector(sel); };
  var say = function (t, bad) { var m = $(".tc-msg"); m.textContent = t || ""; m.classList.toggle("is-bad", !!bad); };

  var paint = function () {
    if (!card) return;
    var waiting = lessons.filter(function (l) { return l.status === "suggested"; });
    var known = lessons.filter(function (l) { return l.status === "approved"; });
    $("#tc-list").innerHTML = note ? '<li class="cq-empty">' + esc(note) + "</li>" : waiting.length ? waiting.map(function (l) {
      return '<li class="tc" data-id="' + esc(l.id) + '">' +
        '<p class="tc-from">Suggested ' + esc(day(l.created_at)) + ' from your reply · edit out anything personal</p>' +
        '<label class="tc-k">Question<textarea class="tc-q" rows="2" maxlength="300">' + esc(l.question) + "</textarea></label>" +
        '<label class="tc-k">Answer<textarea class="tc-a" rows="3" maxlength="1500">' + esc(l.answer) + "</textarea></label>" +
        '<div class="ap-co-go"><button type="button" class="bk-export" data-tc="approve">Approve</button>' +
        '<button type="button" class="settle-btn" data-tc="dismiss">Not this one</button></div></li>';
    }).join("") : '<li class="cq-empty">Nothing to check. Suggestions appear here after you answer a client’s question above.</li>';
    var box = $(".tc-known");
    box.hidden = !known.length;
    box.querySelector("summary").textContent = "The chat knows (" + known.length + ")";
    $("#tc-known").innerHTML = known.map(function (l) {
      return '<li class="tc is-known" data-id="' + esc(l.id) + '"><p class="tc-kq">' + esc(l.question) + '</p><p class="tc-ka">' + esc(l.answer) + "</p>" +
        '<button type="button" class="settle-btn" data-tc="remove">Remove</button></li>';
    }).join("");
  };
  var load = function () {
    if (!card) return;
    if (!LIVE) { lessons = lget(KEY, []); note = ""; return paint(); }
    if (!studioKey()) { lessons = []; note = "Save your studio key under Lumevina Studio, and the chat’s suggested answers show up here."; return paint(); }
    call({ action: "lessons" }).then(function (j) { lessons = j.lessons || []; note = ""; paint(); },
      function () { note = "Couldn’t load the suggestions just now."; paint(); });
  };
  var saveLocal = function () { lset(KEY, lessons); };
  var update = function (id, patch) {
    if (LIVE) return call(Object.assign({ action: "lesson_save", id: id }, patch)).then(function (j) {
      lessons = lessons.map(function (l) { return l.id === id ? j.lesson : l; });
    });
    lessons = lessons.map(function (l) { return l.id === id ? Object.assign({}, l, patch, patch.status ? { decided_at: new Date().toISOString() } : {}) : l; });
    saveLocal();
    return Promise.resolve();
  };
  if (card) {
    card.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tc]");
      if (!b) return;
      var li = b.closest("[data-id]"), id = li.getAttribute("data-id"), act = b.getAttribute("data-tc");
      var patch = act === "approve" ? { status: "approved", question: li.querySelector(".tc-q").value.trim(), answer: li.querySelector(".tc-a").value.trim() }
        : { status: "dismissed" };
      if (act === "approve" && (!patch.question || !patch.answer)) { say("Add the question and the answer first.", true); return; }
      b.disabled = true;
      update(id, patch).then(function () {
        lessons = lessons.filter(function (l) { return l.status !== "dismissed"; });
        say(act === "approve" ? "Approved. The chat answers it from now on." : act === "remove" ? "Removed. The chat no longer uses it." : "Dismissed.");
        paint();
      }, function () { b.disabled = false; say("That didn’t save. Check the connection and try again.", true); });
    });
    $(".tc-new").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, q = f.elements.question.value.trim(), a = f.elements.answer.value.trim();
      if (!q || !a) { say("Add the question and your answer.", true); return; }
      var done = function (l) { lessons.unshift(l); f.reset(); say("Added. The chat answers it from now on."); paint(); };
      if (LIVE) { call({ action: "lesson_add", question: q, answer: a }).then(function (j) { done(j.lesson); }, function () { say("That didn’t save. Try again.", true); }); return; }
      var l = { id: "l" + Date.now().toString(36), question: q, answer: a, kind: "evelyn", status: "approved", created_at: new Date().toISOString(), decided_at: new Date().toISOString() };
      done(l); saveLocal();
    });
    document.addEventListener("lumevina:lessons", load);
    document.addEventListener("lumevina:studio-key", load);
    load();
  }

  /* demo: her reply becomes a suggestion as it is (live, Claude makes it general first) */
  var suggestFrom = function (q, reply) {
    if (LIVE || !card || !reply || ["skin", "other"].indexOf(q.kind) === -1) return;
    var answer = String(reply).split(/\n+/).filter(function (line) { return !/^(hi|hey|hello)\b.{0,30}[,!]?\s*$/i.test(line.trim()) && !/^[-—–]?\s*(xo,?\s*)?evelyn\.?$/i.test(line.trim()); }).join("\n").replace(/^(hi|hey|hello)\s+[^,!.\n]{0,30}[,!.]\s*/i, "").trim();
    lessons = lget(KEY, []);
    lessons.unshift({ id: "l" + Date.now().toString(36), question: q.text, answer: answer || reply, kind: q.kind, status: "suggested", created_at: new Date().toISOString() });
    saveLocal();
    paint();
  };

  /* ══ Their skin profile, on each client's card ══ */
  var LABEL = { morning: "Morning", night: "Night", weekly: "Once or twice a week", supplements: "Supplements", treatments: "Treatments they've had",
    sensitivities: "Reacts to", goal: "Their goal" };
  var drawProfile = function (box, email, p, updated, memories) {
    var has = p && (p.skinType || (p.concerns || []).length || Object.keys(LABEL).some(function (k) { return p[k]; }));
    var first = function () { return '<span class="k">' + arguments[0] + "</span>"; };
    box.innerHTML = '<div class="crm-plan-head"><h3>Their skin profile</h3>' + (has && updated ? '<span class="crm-plan-when">In their words · ' + esc(day(updated)) + "</span>" : "") + "</div>" +
      (has ? '<div class="crm-plan-view">' +
        ((p.skinType || (p.concerns || []).length) ? "<div>" + first("Skin") + esc([p.skinType, (p.concerns || []).join(", ")].filter(Boolean).join(" · ")) + "</div>" : "") +
        Object.keys(LABEL).map(function (k) { return p[k] ? "<div>" + first(LABEL[k]) + esc(p[k]) + "</div>" : ""; }).join("") + "</div>"
        : '<p class="crm-plan-empty">They haven’t filled in a skin profile yet. Clients build one in My Lumevina (about two minutes); the chat and you both see it here.</p>') +
      (memories.length ? '<div class="crm-plan-view"><div><span class="k">What they’ve told the chat</span><ul class="crm-mem">' + memories.map(function (m) {
        return "<li>" + esc(m.fact) + " <small>" + esc(day(m.at)) + "</small></li>";
      }).join("") + "</ul></div></div>" : "");
  };
  var attach = function (box, email) {
    email = String(email || "").toLowerCase();
    box.innerHTML = '<div class="crm-plan-head"><h3>Their skin profile</h3></div><p class="crm-plan-empty">Opens with their card.</p>';
    var loaded = false;
    box.load = function () {
      if (loaded) return;
      loaded = true;
      if (!LIVE) {
        var p = lget("lumevina_profiles", {})[email];
        drawProfile(box, email, p ? p.profile : null, p ? p.updated : null, (lget("lumevina_memory", {})[email] || []).slice().reverse());
        return;
      }
      if (!studioKey()) { box.querySelector(".crm-plan-empty").textContent = "Save your studio key under Lumevina Studio to see their profile."; loaded = false; return; }
      box.querySelector(".crm-plan-empty").textContent = "Loading…";
      call({ action: "client_profile", email: email }).then(function (j) {
        drawProfile(box, email, j.profile, j.updated_at, j.memories || []);
      }, function () { loaded = false; box.querySelector(".crm-plan-empty").textContent = "Couldn’t load it just now. Close and open the card again."; });
    };
  };

  window.LumevinaTeach = { suggestFrom: suggestFrom, reload: load };
  window.LumevinaStudioProfile = { attach: attach };
})();

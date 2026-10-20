/* Lumevina — My Lumevina account panel
   Demo-backed sign-in that gathers everything the site already
   tracks under one roof: Glow Points, upcoming appointments (with
   the 48-hour cancellation rule), and your referral code.

   The sign-in is a MAGIC LINK. Connected (js/site-config.js → shop),
   "Send my sign-in link" asks Supabase to email a one-tap link; it
   comes back to this page with the session, which is kept in this
   browser and refreshed before it runs out (token() hands it to the
   chat, so Ask Lumevina knows who's asking). In the demo it signs
   straight in so the whole flow is testable. Guest booking always
   remains available — signing in is the rewards path, not a gate.

   Signed in, the panel also shows the skin plan Evelyn wrote for the
   client (js/skin-plans.js), when there is one. */

(function () {
  "use strict";

  var STORAGE_KEY = "lumevina_account";
  var BOOKINGS_KEY = "lumevina_bookings";
  var CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;

  /* ── Session ── */
  var session = null;

  var load = function () {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && raw.email) session = raw;
    } catch (err) { /* corrupt storage: stay signed out */ }
  };

  var save = function () {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (err) { /* private mode */ }
  };

  /* ── Service names, from the page's own products ── */
  var serviceName = {};
  document.querySelectorAll(".add-to-cart").forEach(function (btn) {
    if (btn.dataset.id && !serviceName[btn.dataset.id]) {
      serviceName[btn.dataset.id] = btn.dataset.name;
    }
  });

  /* ── Bookings ── */
  var loadBookings = function () {
    try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || []; }
    catch (err) { return []; }
  };

  var saveBookings = function (all) {
    try { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all)); }
    catch (err) { /* private mode */ }
  };

  var bookingStart = function (b) {
    var d = new Date(b.date + "T00:00:00");
    d.setMinutes(b.time);
    return d;
  };

  var fmtTime = function (mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ampm = h >= 12 ? "PM" : "AM";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
  };

  /* ── Live sign-in: Supabase Auth's emailed link (no library: four calls) ── */
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var AUTH = /^https:\/\//.test(SHOP.supabase || "") && SHOP.key ? SHOP.supabase.replace(/\/$/, "") + "/auth/v1" : "";
  var AUTH_KEY = "lumevina_auth";          /* { access, refresh, expiresAt } */
  var NAME_KEY = "lumevina_auth_name";     /* the name typed before the link was sent */
  var auth = null, refreshTimer = null;
  var authCall = function (path, body, token) {
    var headers = { apikey: SHOP.key, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(AUTH + path, { method: body ? "POST" : "GET", headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { j.status = r.status; throw j; } return j; });
      });
  };
  var keepAuth = function (a) {
    auth = a;
    try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* private mode */ }
  };
  var tokensFrom = function (j) {
    return { access: j.access_token, refresh: j.refresh_token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  };
  var scheduleRefresh = function () {
    clearTimeout(refreshTimer);
    if (auth) refreshTimer = setTimeout(refresh, Math.max(5000, auth.expiresAt - Date.now() - 120000));
  };
  var refresh = function () {
    if (!auth || !auth.refresh) return Promise.resolve(null);
    return authCall("/token?grant_type=refresh_token", { refresh_token: auth.refresh }).then(function (j) {
      keepAuth(tokensFrom(j));
      scheduleRefresh();
      return auth;
    }, function (err) {
      /* offline: keep the session and try again later; refused: signed out */
      if (err instanceof TypeError) { refreshTimer = setTimeout(refresh, 60000); return null; }
      endSession();
      return null;
    });
  };
  var endSession = function () {
    keepAuth(null);
    session = null;
    save();
    if (typeof render === "function") render();
    document.dispatchEvent(new CustomEvent("lumevina:account-changed"));
  };
  /* the link lands here: #access_token=…&refresh_token=…&expires_in=… (or #error_description=…) */
  var linkError = "";
  var arrive = function () {
    if (!AUTH || !/access_token=|error_description=/.test(location.hash)) return null;
    var q = {};
    location.hash.slice(1).split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
    });
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* old browser */ }
    if (!q.access_token) { linkError = /expired/i.test(q.error_description || "") ? "That sign-in link has expired. Send yourself a new one." : "That sign-in link didn't work. Send yourself a new one."; return null; }
    keepAuth(tokensFrom(q));
    return authCall("/user", null, auth.access).then(function (u) {
      var typed = ""; try { typed = localStorage.getItem(NAME_KEY) || ""; localStorage.removeItem(NAME_KEY); } catch (e) { /* private mode */ }
      var meta = u.user_metadata || {};
      session = { name: meta.name || typed || String(u.email).split("@")[0], email: u.email, since: Date.parse(u.created_at) || Date.now() };
      save();
      scheduleRefresh();
      return true;
    }, function () { keepAuth(null); linkError = "That sign-in link didn't work. Send yourself a new one."; return null; });
  };

  /* ── Modal elements ── */
  var overlay = document.querySelector(".account-overlay");
  var modal = document.querySelector(".account-modal");
  if (!overlay || !modal) return;

  var outView = modal.querySelector(".acct-out");
  var inView = modal.querySelector(".acct-in");
  var nameInput = modal.querySelector("#acct-name");
  var emailInput = modal.querySelector("#acct-email");
  var signinBtn = modal.querySelector(".acct-signin");
  var statusEl = modal.querySelector(".acct-status");
  var greetEl = modal.querySelector(".acct-greeting");
  var sinceEl = modal.querySelector(".acct-since");
  var welcomeEl = modal.querySelector(".acct-welcome");
  var pointsEl = modal.querySelector(".acct-points");
  var refEl = modal.querySelector(".acct-ref-code");
  modal.querySelector(".acct-share").addEventListener("click", function () {
    if (window.LumevinaRewards) window.LumevinaRewards.share(modal.querySelector(".acct-share-status"));
  });
  var listEl = modal.querySelector(".acct-bookings");

  var rw = function () { return window.LumevinaRewards; };

  /* ── Notice pop-up (shared: policy blocks, reschedule confirmations) ── */
  var noticeOverlay = document.querySelector(".notice-overlay");
  var noticeModal = document.querySelector(".notice-modal");
  var noticeReturn = null;
  var notice = function (title, body) {
    if (!noticeModal) { window.alert(title + "\n\n" + body); return; }
    noticeReturn = document.activeElement;
    noticeModal.querySelector("#notice-title").textContent = title;
    noticeModal.querySelector(".notice-body").textContent = body;
    noticeModal.setAttribute("aria-hidden", "false");
    noticeOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    noticeModal.querySelector(".notice-ok").focus();
  };
  var closeNotice = function () {
    if (!noticeModal) return;
    noticeModal.setAttribute("aria-hidden", "true");
    noticeOverlay.hidden = true;
    var mm = document.getElementById("mobile-menu");
    var anyOpen = document.querySelector(
      ".account-modal[aria-hidden='false'], .booking-modal[aria-hidden='false']");
    document.body.style.overflow = ((mm && !mm.hidden) || anyOpen) ? "hidden" : "";
    if (noticeReturn) noticeReturn.focus();
  };
  if (noticeModal) {
    noticeModal.querySelector(".notice-ok").addEventListener("click", closeNotice);
    noticeOverlay.addEventListener("click", closeNotice);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && noticeModal.getAttribute("aria-hidden") === "false") closeNotice();
    });
  }
  window.LumevinaNotice = { show: notice };

  /* live points arrive after the panel opens (js/rewards.js → functions/rewards) */
  document.addEventListener("lumevina:points-changed", function () {
    if (!session || !rw()) return;
    pointsEl.textContent = String(rw().points());
    refEl.textContent = rw().refCode();
  });

  /* re-render the account's bookings when one is moved elsewhere */
  document.addEventListener("lumevina:booking-changed", function () {
    if (session && modal.getAttribute("aria-hidden") === "false") renderBookings();
  });

  /* live (v3): their appointments from the server, each with its own Change or cancel */
  var acctToken = function () { return window.LumevinaAccount && window.LumevinaAccount.token ? window.LumevinaAccount.token() : ""; };
  var liveBookings = function () {
    var B = window.LumevinaBooking;
    return !!(B && B.live && acctToken() && window.LumevinaManage);
  };
  var renderLiveBookings = function () {
    listEl.innerHTML = '<li class="acct-none">Finding your appointments…</li>';
    fetch(SHOP.supabase.replace(/\/$/, "") + "/functions/v1/book", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SHOP.key, Authorization: "Bearer " + acctToken() },
      body: JSON.stringify({ action: "mine" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      listEl.textContent = "";
      var today = new Date().toISOString().slice(0, 10);
      var up = (j.bookings || []).filter(function (b) { return b.status === "held" && b.date >= today; });
      if (j.credit_cents) {
        var cr = document.createElement("li");
        cr.className = "acct-none";
        cr.textContent = "$" + (j.credit_cents / 100) + " deposit carried over: it comes off your next booking this month.";
        listEl.appendChild(cr);
      }
      if (!up.length) {
        var none = document.createElement("li");
        none.className = "acct-none";
        none.textContent = "No upcoming appointments — the calendar is a tap away.";
        listEl.appendChild(none);
        return;
      }
      up.forEach(function (b) {
        var li = document.createElement("li");
        li.className = "acct-booking";
        li.innerHTML = '<span class="acct-bk-when"></span><span class="acct-bk-what"></span><span class="acct-bk-meta"></span><div class="acct-bk-actions"><button type="button" class="acct-bk-cancel">Change or cancel</button></div>';
        li.querySelector(".acct-bk-when").textContent = b.when;
        li.querySelector(".acct-bk-what").textContent = b.names;
        li.querySelector(".acct-bk-meta").textContent = b.member ? "Membership facial" : b.paid_cents ? "Deposit $" + (b.paid_cents / 100) + " paid" : (b.card ? "Held by " + b.card : "Booked");
        li.querySelector("button").addEventListener("click", function () { window.LumevinaManage.open(b.token); });
        listEl.appendChild(li);
      });
    }, function () { listEl.innerHTML = '<li class="acct-none">Couldn\u2019t load your appointments. Check your connection.</li>'; });
  };

  /* ── Rendering ── */
  var renderBookings = function () {
    if (liveBookings()) { renderLiveBookings(); return; }
    listEl.textContent = "";
    var now = Date.now();
    var upcoming = loadBookings()
      .map(function (b, i) { return { b: b, i: i, start: bookingStart(b) }; })
      .filter(function (x) { return x.start.getTime() + x.b.dur * 60000 > now; })
      .sort(function (a, c) { return a.start - c.start; });

    if (!upcoming.length) {
      var none = document.createElement("li");
      none.className = "acct-none";
      none.textContent = "No upcoming appointments — the calendar is a tap away.";
      listEl.appendChild(none);
      return;
    }

    upcoming.forEach(function (x) {
      var b = x.b;
      var li = document.createElement("li");
      li.className = "acct-booking";

      var when = document.createElement("span");
      when.className = "acct-bk-when";
      when.textContent = x.start.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric"
      }) + " · " + fmtTime(b.time) + " – " + fmtTime(b.time + b.dur);

      var what = document.createElement("span");
      what.className = "acct-bk-what";
      what.textContent = (b.services || [])
        .map(function (id) { return serviceName[id] || id; })
        .join(" + ");

      var meta = document.createElement("span");
      meta.className = "acct-bk-meta";
      meta.textContent = "Order " + (b.order || "—") +
        " · deposit " + "$" + Number(b.deposit || 0).toFixed(2) + " paid";

      var actions = document.createElement("div");
      actions.className = "acct-bk-actions";

      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "acct-bk-cancel";
      var cancellable = x.start.getTime() - now > CANCEL_WINDOW_MS;
      if (cancellable) {
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", function () {
          if (cancel.dataset.arm !== "1") {
            cancel.dataset.arm = "1";
            cancel.textContent = "Tap again to confirm: the deposit is non-refundable" +
              (b.points ? " and its " + b.points + " Glow Points go back" : "");
            return;
          }
          var all = loadBookings();
          var gone = all.splice(x.i, 1)[0];
          saveBookings(all);
          /* a membership facial comes back when its visit is cancelled in time */
          if (gone && gone.memberCredit && window.LumevinaMembership) {
            window.LumevinaMembership.returnCredit(gone.email || session.email);
          }
          /* the Glow Points this booking earned (rebooking bonus included) go back */
          var back = gone && window.LumevinaRewards ? window.LumevinaRewards.reverse(gone) : 0;
          renderBookings();
          if (back) {
            var note = document.createElement("li");
            note.className = "acct-none";
            note.setAttribute("role", "status");
            note.textContent = "Cancelled. The " + back + " Glow Points from that booking were returned.";
            listEl.insertBefore(note, listEl.firstChild);
          }
          renderMember();
        });
      } else {
        cancel.textContent = "Within 48 hours — call or DM to cancel";
        cancel.disabled = true;
      }

      actions.appendChild(cancel);
      li.appendChild(when);
      li.appendChild(what);
      li.appendChild(meta);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  };

  var render = function () {
    var signedIn = !!session;
    outView.hidden = signedIn;
    inView.hidden = !signedIn;
    welcomeEl.hidden = true;
    if (!signedIn) return;

    var first = (session.name || "").split(" ")[0] || "glow-getter";
    greetEl.textContent = "Welcome back, " + first + ".";
    sinceEl.textContent = session.email + " · member since " +
      new Date(session.since).toLocaleDateString("en-US", {
        month: "long", year: "numeric"
      });
    pointsEl.textContent = rw() ? String(rw().points()) : "0";
    refEl.textContent = rw() ? rw().refCode() : "—";
    renderBookings();
    renderIntake();
    renderCredit();
    renderMember();
    renderPlan();
  };

  /* ── Your skin plan, from Evelyn (js/skin-plans.js) ── */
  var planWrap = modal.querySelector(".acct-plan");
  var planBody = modal.querySelector(".acct-plan-body");
  var planMeta = modal.querySelector(".acct-plan-meta");
  var planAsk = modal.querySelector(".acct-plan-ask");
  var esc = function (t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; };
  var drawPlan = function (p) {
    var PL = window.LumevinaPlans;
    if (!planWrap) return;
    planWrap.hidden = !PL;
    if (!PL) return;
    if (!p || PL.empty(p)) {
      planMeta.textContent = "";
      planBody.innerHTML = '<p class="acct-plan-empty">After your visit, Evelyn writes your routine here: what to use morning and night, ' +
        "what to avoid for now, and what comes next. Ask Lumevina answers from it, any time.</p>";
      planAsk.hidden = true;
      return;
    }
    planMeta.textContent = "From Evelyn" + (p.updatedAt ? " · updated " + new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
    var steps = function (title, list) {
      if (!list.length) return "";
      return '<p class="acct-plan-k">' + title + '</p><ol class="acct-plan-steps">' + list.map(function (s) {
        return "<li><span>" + esc(s.name) + "</span>" + (s.how ? "<small>" + esc(s.how) + "</small>" : "") + "</li>";
      }).join("") + "</ol>";
    };
    var line = function (title, text) { return text ? '<p class="acct-plan-k">' + title + '</p><p class="acct-plan-t">' + esc(text) + "</p>" : ""; };
    var about = [p.skinType ? p.skinType + " skin" : "", p.concerns.length ? "working on " + p.concerns.join(", ").toLowerCase() : ""].filter(Boolean).join(" · ");
    planBody.innerHTML =
      (about ? '<p class="acct-plan-about">' + esc(about) + "</p>" : "") +
      line("Where you are now", p.phase) +
      steps("Morning", p.morning) + steps("Night", p.night) + steps("Once or twice a week", p.weekly) +
      line("Avoid for now", p.avoid) + line("Next step", p.next) +
      (p.note ? '<blockquote class="acct-plan-note">' + esc(p.note) + "<cite>Evelyn</cite></blockquote>" : "") +
      (p.log.length ? '<details class="acct-plan-log"><summary>Visit notes</summary><ul>' + p.log.slice(0, 6).map(function (e) {
        return "<li><b>" + esc(new Date(e.at + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) + "</b> " + esc(e.text) + "</li>";
      }).join("") + "</ul></details>" : "");
    planAsk.hidden = false;
  };
  var renderPlan = function () {
    var PL = window.LumevinaPlans;
    if (!session || !PL) return drawPlan(null);
    drawPlan(PL.get(session.email));
    if (PL.live) PL.mine().then(function (p) { if (session) drawPlan(p); });
  };
  if (planAsk) planAsk.addEventListener("click", function () {
    closeModal();
    if (window.LumevinaAsk) window.LumevinaAsk.open();
  });
  document.addEventListener("lumevina:plan-changed", function () {
    if (session && modal.getAttribute("aria-hidden") === "false" && window.LumevinaPlans) drawPlan(window.LumevinaPlans.get(session.email));
  });

  /* ── Membership card (drawn by js/membership.js) ── */
  var memberEl = modal.querySelector(".acct-member");
  var renderMember = function () {
    if (memberEl && session && window.LumevinaMembership) {
      window.LumevinaMembership.renderAccount(memberEl, session.email);
    }
  };
  document.addEventListener("lumevina:membership-changed", function () {
    if (session && modal.getAttribute("aria-hidden") === "false") renderMember();
  });

  /* ── Gift credit: value gift cards attached to this account ── */
  var creditAmtEl = modal.querySelector(".acct-credit-amt");
  var creditListEl = modal.querySelector(".acct-credit-list");
  var creditEmptyEl = modal.querySelector(".acct-credit-empty");
  var creditStatusEl = modal.querySelector(".acct-credit-status");
  var creditForm = modal.querySelector(".acct-credit-add");
  var creditInput = modal.querySelector(".acct-credit-input");

  var money = function (n) { return "$" + (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-US"); };

  var renderCredit = function () {
    var gc = window.LumevinaGiftCards;
    if (!creditAmtEl) return;
    var cards = (gc && session) ? gc.cardsForEmail(session.email) : [];
    var total = (gc && session) ? gc.accountCredit(session.email) : 0;
    creditAmtEl.textContent = money(total);
    creditListEl.textContent = "";
    cards.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "acct-credit-item";
      var left = document.createElement("span");
      var lab = document.createElement("span");
      lab.className = "cc-label";
      lab.textContent = c.label || "Gift card";
      var code = document.createElement("span");
      code.className = "cc-code";
      code.textContent = "  " + c.code;
      left.appendChild(lab);
      left.appendChild(code);
      var bal = document.createElement("span");
      bal.className = "cc-bal";
      bal.textContent = money(c.balance) + " left";
      li.appendChild(left);
      li.appendChild(bal);
      creditListEl.appendChild(li);
    });
    creditEmptyEl.hidden = cards.length > 0;
  };

  if (creditForm) {
    creditForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var gc = window.LumevinaGiftCards;
      creditStatusEl.className = "acct-credit-status";
      if (!gc || !session) { return; }
      var code = creditInput.value.trim();
      if (!code) { creditStatusEl.textContent = "Enter the code from your gift card."; return; }
      var res = gc.claim(code, session.email);
      if (!res.ok) {
        creditStatusEl.className = "acct-credit-status is-error";
        creditStatusEl.textContent =
          res.reason === "service"
            ? "That's a treatment gift — redeem it when you book that service, not here."
          : res.reason === "empty" ? "That card has no balance left."
          : "We couldn't find that code — please check and try again.";
        return;
      }
      creditInput.value = "";
      creditStatusEl.textContent = "✓ Added — " + money(res.card.balance) + " credit is on your account.";
      renderCredit();
    });
  }

  /* keep credit fresh when a gift is redeemed elsewhere (e.g. at booking) */
  document.addEventListener("lumevina:giftcards-changed", function () {
    if (session && modal.getAttribute("aria-hidden") === "false") renderCredit();
  });

  var renderIntake = function () {
    var intake = window.LumevinaIntake;
    var line = modal.querySelector(".acct-intake-status");
    var btn = modal.querySelector(".acct-intake");
    if (!line || !btn) return;
    var has = intake && session && intake.hasFormFor(session.email);
    line.textContent = has
      ? "✓ On file — you're all set. Tap to review or update."
      : "Not yet completed — please fill this out before your visit.";
    line.className = "acct-intake-status" + (has ? " done" : "");
    btn.textContent = has ? "Review pre-visit form" : "Complete pre-visit form";
  };

  /* ── Open / close ── */
  var lastFocus = null;

  var openModal = function () {
    lastFocus = document.activeElement;
    statusEl.textContent = "";
    render();
    modal.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modal.focus();
  };

  var closeModal = function () {
    modal.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    var mm = document.getElementById("mobile-menu");
    document.body.style.overflow = (mm && !mm.hidden) ? "hidden" : "";
    if (lastFocus) lastFocus.focus();
  };

  modal.querySelector(".account-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      closeModal();
    }
  });

  document.querySelectorAll("[data-open-account]").forEach(function (el) {
    el.addEventListener("click", function () {
      var toggle = document.querySelector(".nav-toggle");
      if (toggle && toggle.getAttribute("aria-expanded") === "true") toggle.click();
      openModal();
    });
  });

  /* ── Sign in (magic-link mock — see header note) ── */
  signinBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    if (!name || !email || !emailInput.checkValidity()) {
      statusEl.textContent = "Please add your name and a valid email.";
      return;
    }
    signinBtn.disabled = true;
    statusEl.classList.remove("is-ok");
    statusEl.textContent = "Sending your sign-in link…";
    if (AUTH) {
      try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* private mode */ }
      authCall("/otp?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: email, create_user: true, data: { name: name } })
        .then(function () {
          statusEl.classList.add("is-ok");
          statusEl.textContent = "Check your email: we sent a sign-in link to " + email + ". Open it on this phone or computer.";
        }, function (err) {
          statusEl.textContent = err && err.status === 429
            ? "A link was just sent. Check your email, or try again in a minute."
            : "Couldn't send the link just now. Try again in a minute.";
        })
        .then(function () { signinBtn.disabled = false; });
      return;
    }
    setTimeout(function () {
      signinBtn.disabled = false;
      statusEl.textContent = "";
      session = { name: name, email: email, since: Date.now() };
      save();
      render();
      document.dispatchEvent(new CustomEvent("lumevina:account-changed"));
      /* first sign-in on this device claims the welcome bonus */
      var bonus = rw() ? rw().claimWelcome() : 0;
      if (bonus) {
        welcomeEl.textContent = "✦ " + bonus + " welcome points added — " +
          "you're halfway to your first $10 reward.";
        welcomeEl.hidden = false;
        pointsEl.textContent = String(rw().points());
      }
    }, 900);
  });

  modal.querySelector(".acct-signout").addEventListener("click", function () {
    if (AUTH && auth) authCall("/logout", {}, auth.access).catch(function () { /* the session ends here either way */ });
    clearTimeout(refreshTimer);
    endSession();
  });

  modal.querySelector(".acct-open-rewards").addEventListener("click", function () {
    closeModal();
    if (rw()) rw().open();
  });

  modal.querySelector(".acct-book").addEventListener("click", function () {
    closeModal();
    if (window.LumevinaBooking) window.LumevinaBooking.open();
  });

  modal.querySelector(".acct-intake").addEventListener("click", function () {
    if (window.LumevinaIntake) {
      window.LumevinaIntake.open(session
        ? { name: session.name, email: session.email } : {});
    }
  });

  document.addEventListener("lumevina:intake-saved", function () {
    if (session) renderIntake();
  });

  /* ── Boot ── */
  load();
  if (AUTH) {
    var fine = modal.querySelector(".acct-fine");
    if (fine) fine.textContent = "We'll email you a one-tap sign-in link: no password to remember.";
    try { auth = JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { auth = null; }
    if (!auth) { session = null; save(); }                 /* a demo session isn't a real sign-in */
    else if (auth.expiresAt - Date.now() < 120000) refresh(); else scheduleRefresh();
    var landing = arrive();
    if (landing) landing.then(function (ok) {
      if (!ok) return;
      if (rw()) rw().claimWelcome();
      document.dispatchEvent(new CustomEvent("lumevina:account-changed"));
      openModal();
    });
    if (linkError) setTimeout(function () { openModal(); statusEl.textContent = linkError; }, 0);
  }

  /* sign in without the form, e.g. right after joining a membership */
  var signIn = function (name, email) {
    if (session && session.email.toLowerCase() === String(email).toLowerCase()) return;
    session = { name: name, email: email, since: Date.now() };
    save();
    if (rw()) rw().claimWelcome();
    document.dispatchEvent(new CustomEvent("lumevina:account-changed"));
  };

  window.LumevinaAccount = {
    current: function () { return session; },
    /* the live session for the server (Ask Lumevina, the skin plan); "" in the demo */
    token: function () { return auth && session && auth.expiresAt - Date.now() > 10000 ? auth.access : ""; },
    open: openModal,
    signIn: signIn
  };
})();

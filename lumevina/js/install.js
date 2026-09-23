/* Lumevina — "Add to Home Screen"
 *
 * Makes the site installable like an app (icon, full-screen, works offline)
 * without the App Store: registers the service worker, then offers the
 * install at a good moment — right after a booking, or on a return visit —
 * never on someone's first look at the site.
 *
 *   • iPhone Safari   — no install button exists, so we show the two taps
 *                       (Share → Add to Home Screen)
 *   • Instagram / FB  — their in-app browsers can't install; we say
 *                       "open in Safari first"
 *   • Android / Chrome — the real one-tap install prompt
 *
 * Skipped inside the Capacitor app and once installed. "Not now" snoozes
 * for two weeks; three "not now"s and it stops asking. */
(function () {
  "use strict";

  if (window.Capacitor) return;

  var KEY = "lumevina_install";
  var SNOOZE_DAYS = 14;
  var MAX_DISMISSALS = 3;

  var read = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  };
  var write = function (s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { /* private mode */ }
  };

  var secure = location.protocol === "https:" ||
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  if ("serviceWorker" in navigator && secure) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  var standalone = (window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  if (standalone) {
    document.documentElement.classList.add("is-installed");
    return;
  }

  var ua = navigator.userAgent || "";
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var inAppBrowser = /Instagram|FBAN|FBAV|TikTok/i.test(ua);

  var state = read();
  state.visits = (state.visits || 0) + 1;
  write(state);

  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener("appinstalled", function () {
    var s = read(); s.installed = true; write(s);
    hide();
  });

  var allowed = function () {
    var s = read();
    if (s.installed || (s.dismissals || 0) >= MAX_DISMISSALS) return false;
    if (s.snoozeUntil && Date.now() < s.snoozeUntil) return false;
    /* only where installing is actually possible */
    return isIOS || !!deferredPrompt;
  };

  var shareIcon =
    '<svg class="install-share" viewBox="0 0 20 24" aria-hidden="true">' +
    '<path d="M10 2v13M5.5 6.5 10 2l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M6.5 10H4.5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4.5 22h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 15.5 10h-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    "</svg>";

  var card = null;

  var body = function (reason) {
    var lead = reason === "booked"
      ? "Your visit is saved. Keep Lumevina one tap away for rebooking and your Glow Rewards."
      : "Book, rebook and check your Glow Rewards in one tap, right from your home screen.";
    if (inAppBrowser) {
      return '<p class="install-lead">' + lead + "</p>" +
        '<p class="install-steps">First open this page in Safari: tap <b>•••</b> ' +
        "at the top, then <b>Open in browser</b>.</p>";
    }
    if (isIOS) {
      return '<p class="install-lead">' + lead + "</p>" +
        '<ol class="install-steps">' +
        "<li>Tap " + shareIcon + " <b>Share</b> in Safari’s toolbar</li>" +
        "<li>Choose <b>Add to Home Screen</b></li>" +
        "</ol>";
    }
    return '<p class="install-lead">' + lead + "</p>";
  };

  var show = function (reason) {
    if (card || !allowed()) return;
    card = document.createElement("aside");
    card.className = "install-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Add Lumevina to your home screen");
    card.innerHTML =
      '<img class="install-icon" src="img/apple-touch-icon.png" alt="" width="52" height="52">' +
      '<div class="install-copy">' +
        '<p class="install-title">Add Lumevina to your home screen</p>' +
        body(reason) +
        '<div class="install-actions">' +
          (deferredPrompt && !isIOS
            ? '<button type="button" class="btn btn-solid install-go">Add to Home Screen</button>'
            : "") +
          '<button type="button" class="install-later">Not now</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(card);
    requestAnimationFrame(function () { card.classList.add("show"); });

    var go = card.querySelector(".install-go");
    if (go) {
      go.addEventListener("click", function () {
        var p = deferredPrompt;
        deferredPrompt = null;
        hide();
        p.prompt();
        p.userChoice.then(function (r) {
          if (r.outcome !== "accepted") snooze();
        });
      });
    }
    card.querySelector(".install-later").addEventListener("click", function () {
      snooze();
      hide();
    });
  };

  var hide = function () {
    if (!card) return;
    var c = card;
    card = null;
    c.classList.remove("show");
    setTimeout(function () { c.remove(); }, 400);
  };

  var snooze = function () {
    var s = read();
    s.dismissals = (s.dismissals || 0) + 1;
    s.snoozeUntil = Date.now() + SNOOZE_DAYS * 864e5;
    write(s);
  };

  /* the best moment: they just booked */
  document.addEventListener("lumevina:booked", function () {
    setTimeout(function () { show("booked"); }, 900);
  });

  /* otherwise, a returning visitor who's stayed a little while */
  if (state.visits >= 2) {
    setTimeout(function () { show("return"); }, 15000);
  }

  /* for testing / a future "Get the app" link: LumevinaInstall.show() */
  window.LumevinaInstall = { show: function () { show("return"); } };
})();

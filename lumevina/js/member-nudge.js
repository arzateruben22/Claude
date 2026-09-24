/* Lumevina — membership nudges
 *
 * Two quiet ways a browsing visitor meets the membership:
 *
 *   1. On the facial cards: "Or $159 a month as a member" under the price
 *      (members see what their plan already includes instead).
 *   2. A small card that slides up once someone has scrolled past the
 *      services: a facial every month from $159, the savings, and the
 *      Founding Five spots left. It stays out of the way: hidden while the
 *      membership section is on screen, behind any open window or the
 *      home-screen card, never shown to members, and gone for a week once
 *      closed (remembered in this browser only).
 */
(function () {
  "use strict";

  var LM = window.LumevinaMembership;
  if (!LM) return;

  var KEY = "lumevina_member_nudge";
  var SNOOZE_DAYS = 7;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var read = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  };
  var write = function (s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  };
  var me = function () {
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    return s ? LM.get(s.email) : null;
  };
  var isMember = function () { return LM.isMember(me()); };

  /* the plan that covers a service, cheapest first */
  var planFor = function (serviceId) {
    for (var i = 0; i < LM.plans.length; i++) {
      if (LM.plans[i].covers.indexOf(serviceId) !== -1) return LM.plans[i];
    }
    return null;
  };

  /* ── 1. the facial cards ── */
  var renderHints = function () {
    var r = me();
    var member = LM.isMember(r);
    document.querySelectorAll("[data-mem-hint]").forEach(function (a) {
      var id = a.getAttribute("data-mem-hint");
      var plan = planFor(id);
      if (!plan) { a.hidden = true; return; }
      a.hidden = false;
      if (member && LM.covers(r, id)) {
        a.textContent = "Included in your " + LM.plan(r.plan).name + " membership";
        a.classList.add("is-mine");
      } else if (member) {
        a.hidden = true;
      } else {
        /* the long line for full cards, a short one for the two-up phone cards */
        a.innerHTML = '<span class="mh-long">Or $' + plan.price + ' a month as a member</span>' +
          '<span class="mh-short">Members: $' + plan.price + '/mo</span>';
        a.classList.remove("is-mine");
      }
    });
  };

  /* ── 2. the card that slides up ── */
  var services = document.getElementById("services");
  var membership = document.getElementById("membership");
  if (!services || !membership) { renderHints(); return; }

  var card = document.createElement("aside");
  card.className = "mem-nudge";
  card.setAttribute("aria-label", "Glow Membership");
  card.hidden = true;
  card.innerHTML =
    '<button type="button" class="mem-nudge-x" aria-label="Close">' +
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
    '<p class="mem-nudge-chip"><span class="mem-founding-dot" aria-hidden="true"></span><span class="mem-nudge-five"></span></p>' +
    '<p class="mem-nudge-h">A facial every month, <span>from $159.</span></p>' +
    '<p class="mem-nudge-b"></p>' +
    '<a class="mem-nudge-go" href="#membership">See the plans <span aria-hidden="true">→</span></a>';
  document.body.appendChild(card);

  var paint = function () {
    var left = LM.fiveLeft();
    var chip = card.querySelector(".mem-nudge-chip");
    chip.hidden = left === 0;
    card.querySelector(".mem-nudge-five").textContent = "Founding Five · " + left + (left === 1 ? " spot" : " spots") + " left";
    card.querySelector(".mem-nudge-b").textContent = left > 0
      ? "Save up to $432 a year, bank a month you're busy, and the first five members get a free skincare kit."
      : "Save up to $432 a year, bank a month you're busy, and save on skincare from our shelf.";
  };

  var passedServices = false, seeingPlans = false, shown = false, gone = false;
  var snoozed = function () {
    var s = read();
    return s.snoozeUntil && Date.now() < s.snoozeUntil;
  };
  /* something else has the screen: a window, the menu, or the home-screen card */
  var busy = function () {
    return document.body.style.overflow === "hidden" ||
      !!document.querySelector(".install-card") ||
      !!document.querySelector("[aria-hidden='false'].booking-modal, [aria-hidden='false'].member-modal, .cart-drawer.open");
  };

  var update = function () {
    if (gone) return;
    if (isMember() || snoozed()) { hide(true); return; }
    var want = passedServices && !seeingPlans && !busy();
    if (want && !shown) show();
    else if (!want && shown) hide(false);
  };
  var show = function () {
    shown = true;
    paint();
    card.hidden = false;
    if (calm) { card.classList.add("show"); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add("show"); }); });
  };
  var hide = function (forGood) {
    if (forGood) gone = true;
    if (!shown && !forGood) return;
    shown = false;
    card.classList.remove("show");
    setTimeout(function () { if (!shown) card.hidden = true; }, calm ? 0 : 420);
  };

  /* visible once the visitor has scrolled past most of the services */
  var onScroll = function () {
    var r = services.getBoundingClientRect();
    passedServices = r.top + r.height * 0.55 < 0;
    update();
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      seeingPlans = es[0].isIntersecting;
      update();
    }, { threshold: 0.12 }).observe(membership);
  }

  /* windows opening and closing (they lock the page scroll) */
  if ("MutationObserver" in window) {
    new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["style"], childList: true });
  }

  card.querySelector(".mem-nudge-x").addEventListener("click", function () {
    var s = read();
    s.snoozeUntil = Date.now() + SNOOZE_DAYS * 864e5;
    write(s);
    hide(true);
  });
  card.querySelector(".mem-nudge-go").addEventListener("click", function (e) {
    e.preventDefault();
    hide(false);
    membership.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  });

  var refresh = function () { renderHints(); update(); if (shown) paint(); };
  document.addEventListener("lumevina:membership-changed", refresh);
  document.addEventListener("lumevina:account-changed", refresh);
  renderHints();
  onScroll();
})();

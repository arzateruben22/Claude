/* Lumevina — "New here? Start here"
   The hero card that turns Evelyn's first-visit instructions (her booking
   page says: non-acne skin books New Clients Start Here; acne books the
   Acne Program's New Client Consultation + Treatment) into one question,
   then shows the next three real openings for that visit. Tapping a time
   opens the booking sheet already on it (js/booking.js), so a new client
   goes from the homepage to their deposit in a couple of taps.

   Also: returning visitors get a "Welcome back" line, and a link ending
   in #book-new (for Instagram bios and stories) opens the booking sheet
   on the first visit straight away. */

(function () {
  "use strict";

  var card = document.getElementById("start");
  var B = window.LumevinaBooking;
  if (!card || !B) return;

  var PATHS = {
    glow: {
      id: "new-client-consultation",
      fallback: { name: "New Clients Start Here", price: 220 },
      from: true,
      mins: "60+ min",
      desc: "A consultation, a look at your current routine, and a facial built around what your skin needs.",
      includes: true,
      cta: "Book my first facial"
    },
    acne: {
      id: "new-client-consultation-acne",
      fallback: { name: "New Client Consultation + Treatment (Acne Program)", price: 225 },
      tag: "Acne Program",
      mins: "60 min",
      desc: "A personalized clear-skin plan with Face Reality, the #1 acne line. Best results with a visit every two weeks and home care.",
      includes: false,
      cta: "Start my acne plan"
    }
  };

  var pick = "glow";
  try { if (sessionStorage.getItem("lumevina_start") === "acne") pick = "acne"; } catch (e) { /* storage blocked */ }

  var $ = function (sel) { return card.querySelector(sel); };
  var money = function (n) { return "$" + (Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n))); };
  var DAY = { weekday: "short", month: "short", day: "numeric" };

  var dayLabel = function (d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return d.toLocaleDateString("en-US", DAY);
  };

  var paint = function () {
    var p = PATHS[pick];
    var svc = B.service(p.id) || p.fallback;
    card.querySelectorAll("[data-nc]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.getAttribute("data-nc") === pick));
    });
    var tag = $(".nc-tag");
    tag.hidden = !p.tag;
    tag.textContent = p.tag || "";
    $(".nc-name").textContent = svc.name.replace(/\s*\(Acne Program\)$/, "");
    $(".nc-price").textContent = (p.from ? "from " : "") + money(svc.price);
    $(".nc-mins").textContent = p.mins;
    $(".nc-desc").textContent = p.desc;
    $(".nc-inc").hidden = !p.includes;
    $(".nc-book").textContent = p.cta;

    var times = $(".nc-times");
    times.textContent = "";
    var list = B.openings(p.id, 3);
    $(".nc-label").hidden = !list.length;
    list.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "nc-time";
      var d = document.createElement("span");
      d.className = "nc-time-day";
      d.textContent = dayLabel(o.date);
      var at = document.createElement("span");
      at.className = "nc-time-at";
      at.textContent = o.time;
      b.appendChild(d);
      b.appendChild(at);
      if (o.flash) {
        var f = document.createElement("span");
        f.className = "nc-time-flash";
        f.textContent = "⚡ 10% off";
        b.appendChild(f);
      }
      b.setAttribute("aria-label", "Book " + svc.name + ", " +
        o.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + " at " + o.time +
        (o.flash ? ", a flash opening at 10% off" : ""));
      b.addEventListener("click", function () { B.open(p.id, { dayKey: o.dayKey, slot: o.slot }); });
      times.appendChild(b);
    });
  };

  card.querySelectorAll("[data-nc]").forEach(function (b) {
    b.addEventListener("click", function () {
      pick = b.getAttribute("data-nc");
      try { sessionStorage.setItem("lumevina_start", pick); } catch (e) { /* storage blocked */ }
      paint();
    });
  });

  /* arrow keys move between the two choices, like any radio group */
  $(".nc-pick").addEventListener("keydown", function (e) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) === -1) return;
    e.preventDefault();
    pick = pick === "glow" ? "acne" : "glow";
    paint();
    card.querySelector('[data-nc="' + pick + '"]').focus();
  });

  $(".nc-book").addEventListener("click", function (e) {
    e.preventDefault();
    B.open(PATHS[pick].id);
  });

  /* returning clients: a warmer line, and their usual facial one tap away */
  var back = function () {
    var acct = window.LumevinaAccount && window.LumevinaAccount.current && window.LumevinaAccount.current();
    if (!B.hasBooked() && !acct) return;
    var first = acct && acct.name ? String(acct.name).split(" ")[0] : "";
    card.parentNode.querySelector(".nc-back-text").textContent = "Welcome back" + (first ? ", " + first : "") + ".";
    var link = card.parentNode.querySelector(".nc-back-link");
    link.removeAttribute("data-open-booking");
    link.innerHTML = "Book your Custom Facial <span aria-hidden=\"true\">&rarr;</span>";
    link.onclick = function (e) { e.preventDefault(); B.open("lumevina-custom-facial"); };
  };

  paint();
  back();

  /* phones: the chat bubble steps aside while this card is on screen, so it
     never sits on top of a time or the Book button */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      document.documentElement.classList.toggle("nc-in-view", es[0].isIntersecting);
    }, { threshold: 0.15 }).observe(card);
  }

  /* openings change once someone books: refresh when the sheet closes */
  var overlay = document.querySelector(".booking-overlay");
  if (overlay && window.MutationObserver) {
    new MutationObserver(function () { if (overlay.hidden) { paint(); back(); } })
      .observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* lumevina.com/#book-new opens the first visit straight away */
  if (location.hash === "#book-new") {
    var go = function () { B.open(PATHS[pick].id); };
    if (document.body.classList.contains("intro-lock")) setTimeout(go, 1600); else setTimeout(go, 200);
  }
})();

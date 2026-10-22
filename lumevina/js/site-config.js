/* Lumevina — site switches
 *
 * The choices Evelyn makes about the website, in one place. Loaded first,
 * in the <head>, so the page never flashes a section that's off.
 *
 * 1. Which version runs: one switch.
 *      "v2"  products first. Booking stays on GlossGenius (her choice,
 *            Oct 19), and Glow Membership and Glow Points are held back.
 *      "v3"  everything moves home: booking on this website (deposits, a
 *            card on file, reminders, cancelling and moving online),
 *            Glow Membership and Glow Points. GlossGenius stays only as a
 *            link for appointments already booked there.
 *    Try v3 before switching: open the site with ?preview=v3 at the end of
 *    the address. Only that browser sees it (until the tab closes), with a
 *    small "Previewing v3" note to leave it. ?preview=v2 previews v2 the
 *    same way once v3 is on.
 *
 * 2. Extra sections, on top of the version (hidden, not deleted):
 *      "routine"     Glow Routine (the monthly product refill)
 *      "school"      Skin School (the online course)
 *      "partners"    links out to the brands' own websites (GlyMed Plus,
 *                    Le Mieux, Beautology Lab), off while the shop sells
 *                    those lines here
 *    (v3 brings "membership" and "rewards" with it.)
 *
 * 3. Where clients book, in v2 (v3 always books here).
 *      "glossgenius"  every Book button opens her GlossGenius page (now:
 *                     she keeps her calendar, deposits and checkout there;
 *                     soon: true adds "booking right here is coming soon")
 *      "both"         this website's calendar, plus a "Book there instead"
 *                     link to her GlossGenius page
 *      "site"         this website's calendar only
 *    With "both" (and in v3, while GlossGenius appointments are still on
 *    her calendar), the two calendars see each other's bookings through
 *    her Google Calendar (server/README.md → Running both calendars).
 */
(function () {
  "use strict";

  var CONFIG = window.LUMEVINA_CONFIG = {
    version: "v2",
    features: [],
    /* the assistant: Claude answers from Evelyn's playbook through the server
       (server/functions/ask). Empty = the keyword answers in js/ask.js. */
    ask: {
      endpoint: "",   /* e.g. https://<project>.supabase.co/functions/v1/ask */
      key: ""         /* the Supabase anon key (public), sent with each question */
    },
    /* the shop's live stock and checkout (server/: the products table and
       shelf view, the create-checkout and studio functions). Empty = demo:
       stock is kept in this browser and the card form is a test. Filled
       in = one shared count for the website and the dashboard, real
       payments through Stripe Checkout, and Lumevina Studio's notifications. */
    shop: {
      supabase: "",   /* e.g. https://<project>.supabase.co */
      key: ""         /* the Supabase anon key (public) */
    },
    /* Skin Intelligence (my-skin.html, studio-skin.html): the client's skin
       record and the studio's imaging. Off until "skin" is in features (on in
       the v4 preview). It uses shop.supabase/key above; empty = the demo.
       The capture screens load MediaPipe's runtime and face model from pinned
       public URLs; to self-host them, run node scripts/fetch-skin-vendor.mjs and
       set mediapipeWasm: "vendor/mediapipe", faceModel: "vendor/mediapipe/face_landmarker.task". */
    skin: {
      mediapipeWasm: "",
      faceModel: ""
    },
    booking: {
      /* new clients book here; clients who already book with Evelyn on
         GlossGenius can still use it for now, with a note that everything
         is moving here */
      /* Evelyn, Oct 19: hold off on booking through the website while she
         gets used to it. Every Book button opens her GlossGenius page, and
         the Book section says booking right here is coming soon. When she's
         ready: mode "both" (both places), later "site" (website only). */
      mode: "glossgenius",
      soon: true,
      glossgenius: "https://lumevina.glossgenius.com/",
      /* both calendars in sync: the server's availability function
         (website bookings + her Google Calendar, where GlossGenius writes
         its appointments). Empty = sample times. */
      availability: ""   /* e.g. https://<project>.supabase.co/functions/v1/availability */
    }
  };

  /* each version's sections and booking */
  var VERSIONS = {
    v2: { features: [], booking: null },
    v3: { features: ["membership", "rewards"], booking: "site" },
    /* everything at once: v3 plus Skin School, the preview that connects the site and the course */
    v4: { features: ["membership", "rewards", "school", "skin"], booking: "site" }
  };
  /* ?preview=v3 (or v2, v4): this browser only, until the tab closes */
  var preview = null;
  try {
    var asked = /[?&]preview=(v2|v3|v4|off)\b/.exec(location.search);
    if (asked) {
      if (asked[1] === "off") sessionStorage.removeItem("lumevina_preview");
      else sessionStorage.setItem("lumevina_preview", asked[1]);
    }
    preview = sessionStorage.getItem("lumevina_preview");
  } catch (e) { /* storage off: no preview */ }
  if (preview && VERSIONS[preview] && preview !== CONFIG.version) CONFIG.previewing = preview;
  CONFIG.running = CONFIG.previewing || (VERSIONS[CONFIG.version] ? CONFIG.version : "v2");
  var V = VERSIONS[CONFIG.running];
  V.features.forEach(function (f) { if (CONFIG.features.indexOf(f) === -1) CONFIG.features.push(f); });
  if (V.booking) { CONFIG.booking.mode = V.booking; CONFIG.booking.soon = false; }

  var root = document.documentElement;
  root.classList.add("is-" + CONFIG.running);
  CONFIG.features.forEach(function (f) { root.classList.add("has-" + f); });
  /* opened inside an app's viewer on a phone (the Claude app shows the site in
     a frame, with its own × and ⋯ floating over the top strip, and taps there
     never reach the page): the header moves down, clear of them (css: html.in-app) */
  var framed = true;
  try { framed = window.self !== window.top; } catch (e) { /* a cross-origin frame */ }
  if (framed && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) root.classList.add("in-app");
  var gg = /^https:\/\//.test(CONFIG.booking.glossgenius || "");
  root.classList.add(CONFIG.booking.mode === "glossgenius" && gg ? "book-glossgenius"
    : CONFIG.booking.mode === "both" && gg ? "book-both" : "book-site");
  if (CONFIG.booking.mode === "glossgenius" && gg && CONFIG.booking.soon) root.classList.add("book-soon");

  window.LumevinaFeatures = {
    on: function (f) { return CONFIG.features.indexOf(f) !== -1; },
    version: CONFIG.running
  };

  /* previewing: a small note to leave it */
  if (CONFIG.previewing) {
    var note = function () {
      if (document.querySelector(".preview-note")) return;
      var a = document.createElement("a");
      a.className = "preview-note";
      a.href = location.pathname + "?preview=off" + location.hash;
      a.innerHTML = "Previewing " + CONFIG.previewing + " <span>· leave</span>";
      a.setAttribute("aria-label", "Previewing " + CONFIG.previewing + ". Leave the preview");
      document.body.appendChild(a);
    };
    if (document.body) note(); else document.addEventListener("DOMContentLoaded", note);
  }
})();

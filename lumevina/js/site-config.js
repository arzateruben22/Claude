/* Lumevina — site switches
 *
 * The two choices Evelyn makes about the website, in one place. Loaded
 * first, in the <head>, so the page never flashes a section that's off.
 *
 * 1. Sections held back for now. They're hidden, not deleted: put a name
 *    in the list to bring one back.
 *      "membership"  Glow Membership (the monthly facial plans)
 *      "rewards"     Glow Rewards (points, referral codes, the magic mirror)
 *      "routine"     Glow Routine (the monthly product refill)
 *      "school"      Skin School (the online course)
 *
 *      "partners"    links out to the brands' own websites (GlyMed Plus,
 *                    Le Mieux, Beautology Lab), off while the shop sells
 *                    those lines here
 *
 * 2. Where clients book.
 *      "glossgenius"  every Book button opens her GlossGenius page (now:
 *                     she keeps her calendar, deposits and checkout there)
 *      "both"         this website's calendar, plus a "Book there instead"
 *                     link to her GlossGenius page
 *      "site"         this website's calendar only
 *    With "both", the two calendars have to see each other's bookings or
 *    the same time could be booked twice. Until the server reads her
 *    GlossGenius calendar link (server/README.md → Running both
 *    calendars), give each its own days in the dashboard.
 */
(function () {
  "use strict";

  var CONFIG = window.LUMEVINA_CONFIG = {
    features: [],
    booking: {
      /* Evelyn's answer: stay on GlossGenius for now */
      mode: "glossgenius",
      glossgenius: "https://lumevina.glossgenius.com/"
    }
  };

  var root = document.documentElement;
  CONFIG.features.forEach(function (f) { root.classList.add("has-" + f); });
  var gg = /^https:\/\//.test(CONFIG.booking.glossgenius || "");
  root.classList.add(CONFIG.booking.mode === "glossgenius" && gg ? "book-glossgenius"
    : CONFIG.booking.mode === "both" && gg ? "book-both" : "book-site");

  window.LumevinaFeatures = {
    on: function (f) { return CONFIG.features.indexOf(f) !== -1; }
  };
})();

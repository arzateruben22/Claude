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
 * 2. Where clients book.
 *      "site"         on this website's calendar, with a deposit
 *      "glossgenius"  every Book button opens Evelyn's GlossGenius page
 *    Use one or the other, not both: the two calendars can't see each
 *    other, so the same time could be booked twice.
 */
(function () {
  "use strict";

  var CONFIG = window.LUMEVINA_CONFIG = {
    features: [],
    booking: {
      mode: "site",
      glossgenius: ""   /* TODO: Evelyn's GlossGenius booking link, starting https:// */
    }
  };

  var root = document.documentElement;
  CONFIG.features.forEach(function (f) { root.classList.add("has-" + f); });
  root.classList.add(CONFIG.booking.mode === "glossgenius" && CONFIG.booking.glossgenius ? "book-glossgenius" : "book-site");

  window.LumevinaFeatures = {
    on: function (f) { return CONFIG.features.indexOf(f) !== -1; }
  };
})();

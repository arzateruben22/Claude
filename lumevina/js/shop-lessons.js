/* Lumevina — the lesson behind a product
 *
 * The product sheet (js/shop.js) shows one line, "From Skin School: <lesson>",
 * linking to the lesson that explains what the product does, when the course
 * is switched on (js/site-config.js → features: ["school"]). Lessons are
 * matched by the product's name first, then its category; the titles are the
 * curriculum's (docs/school/curriculum.js). Nothing here makes a claim about
 * a product: the lesson is general, the label is the label. */
(function () {
  "use strict";

  var L = {
    "2-1": "Cleansing, done right", "2-2": "Moisturizer, decoded", "2-3": "Sunscreen, the anti-aging step",
    "3-2": "Build your first routine", "4-1": "AHAs, BHAs and PHAs", "5-1": "Vitamin C", "5-2": "Retinoids, without the drama",
    "5-3": "The supporting cast", "7-1": "The Sunday ritual", "8-2": "The acne-safe routine", "8-3": "Food, hormones and habits",
    "9-2": "Brighteners that work", "10-2": "An anti-aging routine that works", "11-1": "Sensitive and rosacea-prone skin"
  };
  var BY_NAME = [
    [/mandelic|glycolic|lactic|salicylic|aha|bha|pha|exfoliat/i, "4-1"],
    [/vitamin c|ascorb/i, "5-1"],
    [/retin|peptide/i, "5-2"],
    [/acne med|benzoyl|sulfur|spot|hydroxi|clear/i, "8-2"],
    [/glowtone|brighten|tone|dark spot|pigment|niacinamide/i, "9-2"],
    [/barrier|calm|soothing|recovery|gentle|sensitive/i, "11-1"],
    [/hydra|hyaluronic|gel serum/i, "2-2"]
  ];
  /* a cleanser is about cleansing whatever its name says; serums and spot care are named by their active */
  var CAT_FIRST = { "Cleansers": "2-1", "Moisturizers": "2-2", "Sun care": "2-3", "Toners & mists": "3-2", "Eye care": "10-2", "Masks": "7-1", "Supplements": "8-3" };
  var CAT_LAST = { "Serums": "5-3", "Acne & spot care": "8-2" };

  var lessonFor = function (p) {
    if (!p || p.kind === "consult") return null;
    var id = CAT_FIRST[p.cat] || null;
    for (var i = 0; i < BY_NAME.length && !id; i++) if (BY_NAME[i][0].test(p.name)) id = BY_NAME[i][1];
    if (!id) id = CAT_LAST[p.cat] || null;
    return id && L[id] ? { id: id, title: L[id], href: "school.html#learn-" + id } : null;
  };
  var on = function () { return !!(window.LumevinaFeatures && window.LumevinaFeatures.on("school")); };

  window.LumevinaLessons = { for: lessonFor, on: on, titles: L };
})();

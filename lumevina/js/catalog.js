/* Lumevina — the product catalog
 *
 * Every product Evelyn sells, from her product guide (October 18, 2026),
 * which was transcribed from her GlossGenius inventory screenshots.
 * Prices and quantities are as shown there. One file, read by the
 * website's shop (js/inventory.js) and the owner dashboard.
 *
 *   draft: true   The guide flags this entry: the name was cut off or the
 *                 size is unclear. It keeps the name exactly as the
 *                 screenshot shows it, and clients don't see it until
 *                 Evelyn confirms it in the dashboard (Shop → Needs your OK).
 *   stock: null   The quantity wasn't visible in the screenshot.
 *   cat           Grouped by what the name says (a cleanser, a serum…);
 *                 anything the name doesn't make clear goes under "More".
 *
 * Not in the list on purpose: "Shipping Fee - $6.00" (a checkout setting,
 * not a product; see EVELYN-NOTES.md) and anything not in her inventory.
 *
 * TODO (Evelyn): photos, a short description and directions for each
 * product; which products need a consultation before purchase.
 */
(function () {
  "use strict";

  var FR = "Face Reality", GM = "GlyMed Plus", MX = "Mixi Skincare", CI = "Circadia";

  var P = function (brand, name, price, stock, cat, extra) {
    var p = { brand: brand, name: name, price: price, stock: stock, cat: cat };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    var pre = { "Face Reality": "fr", "GlyMed Plus": "gm", "Mixi Skincare": "mx", "Circadia": "ci" }[brand];
    p.id = pre + "-" + (extra && extra.slug || name).toLowerCase().replace(/%/g, "pct").replace(/\+/g, "plus")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return p;
  };

  var LIST = [
    /* ── Face Reality: 30 entries ── */
    P(FR, "11% Mandelic Serum", 46, 0, "Serums"),
    P(FR, "15% Mandelic Serum", 48, 0, "Serums"),
    P(FR, "2.5% ADV Acne Med", 29, 1, "Acne & spot care"),
    P(FR, "5% ADV Acne Med", 30, 0, "Acne & spot care"),
    P(FR, "5% Mandelic Serum", 42, 0, "Serums"),
    P(FR, "8% Mandelic Serum", 44, 1, "Serums"),
    P(FR, "Antioxidant Eye Gel", 48, 1, "Eye care"),
    P(FR, "Barrier Cream Cleanser", 37, 0, "Cleansers"),
    P(FR, "Barrier Gel Cream", 38, 0, "Moisturizers"),
    P(FR, "Brilliant Defense 50", 42, 0, "More"),
    P(FR, "Clear Skin Balance - SUP…", 44, 1, "More", { draft: true, slug: "clear-skin-balance", note: "Name cut off (\"Clear Skin Balance - SUP…\"): confirm the full title, the supplement format and the bottle count." }),
    P(FR, "Cran-Peptide Cream", 33, 0, "Moisturizers"),
    P(FR, "Daily SPF 30", 36, 0, "Sun protection", { photo: "img/retail/daily-spf-30.webp" }),
    P(FR, "Gentle Gel Cleanser - TR…", 14, 0, "Cleansers", { draft: true, slug: "gentle-gel-cleanser", note: "Name cut off (\"Gentle Gel Cleanser - TR…\"): probably a travel size. Confirm the name and the exact volume." }),
    P(FR, "Glowtone Corrective SE…", 64, 0, "Serums", { draft: true, slug: "glowtone-corrective", note: "Name cut off (\"Glowtone Corrective SE…\"): probably GlowTone Corrective Serum. Confirm the title and size." }),
    P(FR, "Hydrabalance Gel", 34, 0, "More"),
    P(FR, "HydraRemedy Gel Serum", 46, 0, "Serums"),
    P(FR, "Hydrcalm Mask", 42, 0, "Masks", { draft: true, note: "The inventory spells it \"HYDRCALM MASK\". Confirm whether it should read HydraCalm Mask." }),
    P(FR, "Invisiclear Hydrocoll…", 10, 0, "Acne & spot care", { draft: true, slug: "invisiclear", note: "Name cut off (\"Invisiclear Hydrocoll…\"): confirm the full title and the patch count. The $10 price was partly clipped." }),
    P(FR, "Mandelic Face and Body…", 38, 0, "More", { draft: true, slug: "mandelic-face-and-body", note: "Name cut off: confirm whether this is the wash, the scrub, or another product." }),
    P(FR, "Mineral Matte SPF 28", 36, 0, "Sun protection"),
    P(FR, "Moisture Balance Toner", 34, 2, "Toners & mists"),
    P(FR, "Moisture Balance Toner…", 14, 1, "Toners & mists", { draft: true, slug: "moisture-balance-toner-14", note: "A second Moisture Balance Toner at $14, name cut off. Confirm whether it's a smaller size, and its volume." }),
    P(FR, "Omni Clear Mist", 40, 4, "Toners & mists"),
    P(FR, "PowderMineral SPF 50", 42, 3, "Sun protection"),
    P(FR, "Retinal B3 Serum", 54, null, "Serums", { draft: true, note: "Row clipped in the screenshot: confirm the brand line, the $54 price and the quantity." }),
    P(FR, "Retinol Peptide Serum", 60, 0, "Serums"),
    P(FR, "Soothing Radiance Toner", 32, 0, "Toners & mists"),
    P(FR, "Sulfur Spot Treatment", 35, 0, "Acne & spot care"),
    P(FR, "Ultra Gentle Cleanser", 33, 0, "Cleansers"),

    /* ── GlyMed Plus: 9 entries ── */
    P(GM, "Barrier Repair Cream", 83.20, 0, "Moisturizers", { check: "Confirm the $83.20 price is intended." }),
    P(GM, "Cell Protection Balm", 34, 0, "Moisturizers"),
    P(GM, "Eye Calm", 48, 0, "Eye care"),
    P(GM, "Firming Eye Cream", 70, 0, "Eye care"),
    P(GM, "Firming Serum w/ Phyto…", 142, 0, "Serums", { draft: true, slug: "firming-serum", note: "Name cut off (\"Firming Serum w/ Phyto…\"): probably Firming Serum with Phyto Stem Cells. Confirm the title and size." }),
    P(GM, "Glycolic Cleanser", 41, 0, "Cleansers", { photo: "img/retail/glymed-cleanser.webp" }),
    P(GM, "Revitalizing Essence NAD+", 50, 0, "More"),
    P(GM, "Skin Recovery Mist", 46, 0, "Toners & mists"),
    P(GM, "Vitamin C Cleanser", 47, 0, "Cleansers"),

    /* ── Mixi Skincare: 3 entries ── */
    P(MX, "Dew Drops", 56, 0, "More"),
    P(MX, "Hydroxi", 40, 2, "More"),
    P(MX, "SPF 50 Mineral SPF", 65, 1, "Sun protection", { draft: true, note: "Confirm the name clients should see, the size, and any tint or shade." }),

    /* ── Circadia: 1 entry ── */
    P(CI, "Vitamin Veil Cleanser", 40, 1, "Cleansers")
  ];

  window.LUMEVINA_CATALOG = {
    asOf: "2026-10-18",
    brands: [FR, GM, MX, CI],
    categories: ["Cleansers", "Toners & mists", "Serums", "Moisturizers", "Eye care", "Sun protection", "Acne & spot care", "Masks", "More"],
    products: LIST
  };
})();

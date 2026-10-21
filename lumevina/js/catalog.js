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
 *   photo         The product shot, in img/products/, named after the
 *                 product (face-reality-11-mandelic-serum.webp). To add
 *                 one, drop the file there and add photo: "…" to its line.
 *   size, about   As printed on the product's own label in its photo.
 *   inv           The title in her GlossGenius inventory, when the label's
 *                 full name differs (the name clients see comes from the
 *                 label: "Brilliant Defense SPF 50", not "Brilliant Defense 50").
 *
 * Not in the list on purpose: "Shipping Fee - $6.00" (a checkout setting,
 * not a product; see EVELYN-NOTES.md) and anything not in her inventory.
 *
 *   consult: true An active that needs Evelyn's yes first (benzoyl peroxide,
 *                 the stronger mandelic serums, retinoids, Hydroxi): the shop
 *                 shows "Needs a quick consult" until she approves that email
 *                 (js/consult.js; server: functions/consult). The list follows
 *                 what the brands answer (STOREFRONT.md, step 0).
 *   kind: "consult"  The online Skin Consult: a service in the shop, not on
 *                 the shelf. Paid like a product; done = the actives unlock
 *                 and the $35 comes back as a certificate.
 *
 * TODO (Evelyn): photos, a short description and directions for each
 * product; the consult list, once the brands answer.
 */
(function () {
  "use strict";

  var FR = "Face Reality", GM = "GlyMed Plus", MX = "Mixi Skincare", CI = "Circadia";

  var P = function (brand, name, price, stock, cat, extra) {
    var p = { brand: brand, name: name, price: price, stock: stock, cat: cat };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    var pre = { "Face Reality": "fr", "GlyMed Plus": "gm", "Mixi Skincare": "mx", "Circadia": "ci", "Lumevina": "svc" }[brand];
    p.id = pre + "-" + (extra && extra.slug || name).toLowerCase().replace(/%/g, "pct").replace(/\+/g, "plus")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return p;
  };

  var LIST = [
    /* ── Face Reality: 30 entries ── */
    P(FR, "11% L-Mandelic Serum", 46, 0, "Serums", { consult: true, inv: "11% Mandelic Serum", slug: "11pct-mandelic-serum", photo: "img/products/face-reality-11-mandelic-serum.webp", size: "1 fl oz / 30 ml", about: "Exfoliates and brightens." }),
    P(FR, "15% L-Mandelic Serum", 48, 0, "Serums", { consult: true, inv: "15% Mandelic Serum", slug: "15pct-mandelic-serum", photo: "img/products/face-reality-15-mandelic-serum.webp", size: "1 fl oz / 30 ml", about: "Exfoliates and brightens." }),
    P(FR, "2.5% Advanced Acne Med", 29, 1, "Acne & spot care", { consult: true, inv: "2.5% ADV Acne Med", slug: "2-5pct-adv-acne-med", photo: "img/products/face-reality-2-5-adv-acne-med.webp", size: "1.5 fl oz / 44 ml", about: "Benzoyl peroxide acne medication." }),
    P(FR, "5% Advanced Acne Med", 30, 0, "Acne & spot care", { consult: true, inv: "5% ADV Acne Med", slug: "5pct-adv-acne-med", photo: "img/products/face-reality-5-adv-acne-med.webp", size: "1.5 fl oz / 44 ml", about: "Benzoyl peroxide acne medication." }),
    P(FR, "5% L-Mandelic Serum", 42, 0, "Serums", { inv: "5% Mandelic Serum", slug: "5pct-mandelic-serum", photo: "img/products/face-reality-5-mandelic-serum.webp", size: "1 fl oz / 30 ml", about: "Exfoliates and brightens." }),
    P(FR, "8% L-Mandelic Serum", 44, 1, "Serums", { inv: "8% Mandelic Serum", slug: "8pct-mandelic-serum", photo: "img/products/face-reality-8-mandelic-serum.webp", size: "1 fl oz / 30 ml", about: "Exfoliates and brightens." }),
    P(FR, "Antioxidant Peptide Eye Gel", 48, 1, "Eye care", { inv: "Antioxidant Eye Gel", slug: "antioxidant-eye-gel", photo: "img/products/face-reality-antioxidant-peptide-eye-gel.webp", size: "0.4 fl oz / 12 ml", about: "Smooths and visibly depuffs." }),
    P(FR, "Barrier Balance Creamy Cleanser", 37, 0, "Cleansers", { inv: "Barrier Cream Cleanser", slug: "barrier-cream-cleanser", photo: "img/products/face-reality-barrier-balance-creamy-cleanser.webp", size: "6 fl oz / 180 ml", about: "A daily calming wash. Acne-safe." }),
    P(FR, "Barrier Care Gel Cream", 38, 0, "Moisturizers", { inv: "Barrier Gel Cream", slug: "barrier-gel-cream", photo: "img/products/face-reality-barrier-care-gel-cream.webp", size: "2 fl oz / 60 ml", about: "Repairs, moisturizes and comforts, with Multi-Restore Complex. Acne-safe." }),
    P(FR, "Brilliant Defense SPF 50", 42, 0, "Sun care", { inv: "Brilliant Defense 50", slug: "brilliant-defense-50", photo: "img/products/face-reality-brilliant-defense-spf-50.webp", size: "2 fl oz / 60 ml", about: "Broad-spectrum SPF 50 sunscreen, with BrightShield Complex. Acne-safe." }),
    P(FR, "Clear Skin Balance", 44, 1, "Supplements", { inv: "Clear Skin Balance - SUP…", slug: "clear-skin-balance", photo: "img/products/face-reality-clear-skin-balance.webp", size: "60 softgels", about: "Omega-3 + antioxidants: a multifunctional dietary supplement for breakout-prone skin.", resolved: "Flag [1] answered by the label photo: Clear Skin Balance, softgel dietary supplement, 60 softgels." }),
    P(FR, "Cran-Peptide Cream", 33, 0, "Moisturizers", { photo: "img/products/face-reality-cran-peptide-cream.webp", size: "2 fl oz / 60 ml", about: "Rich and restorative. Acne-safe." }),
    P(FR, "Daily SPF 30 Plus", 36, 0, "Sun care", { inv: "Daily SPF 30", slug: "daily-spf-30", photo: "img/retail/daily-spf-30.webp", size: "2 fl oz / 60 ml", about: "Broad-spectrum SPF 30 sunscreen. Acne-safe." }),
    P(FR, "Ultra Gentle Gel Cleanser (travel size)", 14, 0, "Cleansers", { inv: "Gentle Gel Cleanser - TR…", slug: "gentle-gel-cleanser", photo: "img/products/face-reality-ultra-gentle-gel-cleanser-2oz.webp", size: "2 fl oz / 60 ml", about: "A daily antioxidant wash. Acne-safe.", resolved: "Flag [2] confirmed by Evelyn (Oct 19): the travel size of the Ultra Gentle Gel Cleanser, 2 fl oz / 60 ml." }),
    P(FR, "GlowTone Corrective Serum", 64, 0, "Serums", { inv: "Glowtone Corrective SE…", slug: "glowtone-corrective", photo: "img/products/face-reality-glowtone-corrective-serum.webp", size: "1 fl oz / 30 ml", about: "Targets discoloration, with Hexa-Bright Complex.", resolved: "Flag [3] answered by the label photo: GlowTone Corrective Serum, 1 fl oz / 30 ml." }),
    P(FR, "HydraBalance Gel", 34, 0, "Moisturizers", { inv: "Hydrabalance Gel", slug: "hydrabalance-gel", photo: "img/products/face-reality-hydrabalance-gel.webp", size: "1.7 fl oz / 50 ml", about: "Hydrates and balances oil. Acne-safe." }),
    P(FR, "HydraRemedy Gel Serum", 46, 0, "Serums", { photo: "img/products/face-reality-hydraremedy-gel-serum.webp", size: "1.7 fl oz / 50 ml", about: "Hydrates, repairs and soothes, with Tri-Recovery Complex. Acne-safe." }),
    P(FR, "HydraCalm Mask", 42, 0, "Masks", { inv: "Hydrcalm Mask", slug: "hydrcalm-mask", photo: "img/products/face-reality-hydracalm-mask.webp", size: "2.5 fl oz / 73 ml", about: "Soothes and boosts hydration.", resolved: "Flag [4] answered by the label photo: HydraCalm Mask, 2.5 fl oz / 73 ml." }),
    P(FR, "invisiClear Hydrocolloid Spot Patches", 10, 0, "Acne & spot care", { inv: "Invisiclear Hydrocoll…", slug: "invisiclear", photo: "img/products/face-reality-invisiclear-spot-patches.webp", size: "24 patches", about: "Professional-grade patches that visibly flatten and drain breakouts. They cover and protect, they're translucent, and they suit all skin types.", check: "Confirm the $10 price: that row was partly clipped in the screenshot.", resolved: "Flag [5] answered by the package photo: invisiClear hydrocolloid spot patches, 24 patches." }),
    P(FR, "L-Mandelic Face and Body Wash", 38, 0, "Cleansers", { inv: "Mandelic Face and Body…", slug: "mandelic-face-and-body", photo: "img/products/face-reality-l-mandelic-face-and-body-wash.webp", size: "6 fl oz / 180 ml", about: "Cleanses and brightens. Acne-safe.", resolved: "Flag [6] answered by the label photo: it's the L-Mandelic Face and Body Wash, 6 fl oz / 180 ml." }),
    P(FR, "Mineral Matte SPF 28", 36, 0, "Sun care", { photo: "img/products/face-reality-mineral-matte-spf-28.webp", size: "2 fl oz / 60 ml", about: "Broad-spectrum SPF 28 sunscreen. Acne-safe." }),
    P(FR, "Moisture Balance Toner", 34, 2, "Toners & mists", { photo: "img/products/face-reality-moisture-balance-toner-6oz.webp", size: "6 fl oz / 180 ml", about: "Hydrates and replenishes." }),
    P(FR, "Moisture Balance Toner (2 fl oz)", 14, 1, "Toners & mists", { inv: "Moisture Balance Toner…", slug: "moisture-balance-toner-14", photo: "img/products/face-reality-moisture-balance-toner-2oz.webp", size: "2 fl oz / 60 ml", about: "Hydrates and replenishes.", resolved: "Flag [7] answered by the label photo: the $14 entry is the 2 fl oz / 60 ml bottle." }),
    P(FR, "Omni Clear Mist", 40, 4, "Toners & mists", { photo: "img/products/face-reality-omni-clear-mist.webp", size: "3.4 fl oz / 100 ml", about: "Stabilized hypochlorous acid, with patented Microcyn technology. Professional grade, dermatologist tested." }),
    P(FR, "PowerMineral SPF 50", 42, 3, "Sun care", { inv: "PowderMineral SPF 50", slug: "powdermineral-spf-50", photo: "img/products/face-reality-powermineral-spf-50.webp", size: "2 fl oz / 60 ml", about: "Broad-spectrum SPF 50 sunscreen, with CalmShield Complex. Acne-safe." }),
    P(FR, "Retinal B3 Serum", 54, null, "Serums", { consult: true, photo: "img/products/face-reality-retinal-b3-serum.webp", size: "1 fl oz / 30 ml", about: "Gently corrects and renews. Acne-safe.", check: "Confirm the quantity on hand (not visible in the screenshot).", resolved: "Flag [8] answered by the label photo: a Face Reality serum, 1 fl oz / 30 ml." }),
    P(FR, "Retinol Peptide Serum", 60, 0, "Serums", { consult: true, photo: "img/products/face-reality-retinol-peptide-serum.webp", size: "1 fl oz / 30 ml", about: "Intensely corrects and renews." }),
    P(FR, "Soothing Radiance Toner", 32, 0, "Toners & mists", { photo: "img/products/face-reality-soothing-radiance-toner.webp", size: "6 fl oz / 180 ml", about: "Calms and nourishes." }),
    P(FR, "Sulfur Spot Treatment", 35, 0, "Acne & spot care", { photo: "img/products/face-reality-sulfur-spot-treatment.webp", size: "1.5 fl oz / 44 ml", about: "A 6% sulfur acne treatment." }),
    P(FR, "Ultra Gentle Gel Cleanser", 33, 0, "Cleansers", { inv: "Ultra Gentle Cleanser", slug: "ultra-gentle-cleanser", photo: "img/products/face-reality-ultra-gentle-gel-cleanser-6oz.webp", size: "6 fl oz / 180 ml", about: "A daily antioxidant wash. Acne-safe." }),

    /* ── GlyMed Plus: 9 entries ── */
    P(GM, "Barrier Repair Cream", 83.20, 0, "Moisturizers", { photo: "img/products/glymed-plus-barrier-repair-cream.webp", size: "4 fl oz / 118 ml", about: "With amino acids. Part of the GlyMed Plus Elite line; step 3 of its routine: balance.", check: "Confirm the $83.20 price is intended (it's the 4 fl oz Elite tube)." }),
    P(GM, "Cell Protection Balm", 34, 0, "Moisturizers", { photo: "img/products/glymed-plus-cell-protection-balm.webp", size: "2 fl oz / 59 ml", about: "Step 3 of the GlyMed Plus routine: balance." }),
    P(GM, "Eye Calm", 48, 0, "Eye care", { photo: "img/products/glymed-plus-eye-calm.webp", size: "0.3 fl oz / 10 ml", about: "Step 3 of the GlyMed Plus routine: balance." }),
    P(GM, "Firming Eye Cream", 70, 0, "Eye care", { photo: "img/products/glymed-plus-firming-eye-cream.webp", size: "0.3 oz / 10 ml", about: "Part of the GlyMed Plus Elite line; step 3 of its routine: balance." }),
    P(GM, "Firming Serum with Phyto-Stem Cells", 142, 0, "Serums", { inv: "Firming Serum w/ Phyto…", slug: "firming-serum", photo: "img/products/glymed-plus-firming-serum.webp", size: "1 oz / 30 ml", about: "Part of the GlyMed Plus Elite line; step 2 of its routine: treat.", resolved: "Flag [9] answered by the label photo: Firming Serum with Phyto-Stem Cells, 1 oz / 30 ml." }),
    P(GM, "Glycolic Facial Cleanser", 41, 0, "Cleansers", { inv: "Glycolic Cleanser", slug: "glycolic-cleanser", photo: "img/products/glymed-plus-glycolic-facial-cleanser.webp", size: "8 fl oz / 236 ml", about: "With 10% glycolic acid. Step 1 of the GlyMed Plus routine: cleanse." }),
    P(GM, "Revitalizing Essence with NAD+", 50, 0, "Serums", { inv: "Revitalizing Essence NAD+", slug: "revitalizing-essence-nadplus", photo: "img/products/glymed-plus-revitalizing-essence-nad.webp", size: "1.35 oz / 40 ml", about: "Part of the GlyMed Plus Elite line; step 2 of its routine: treat." }),
    P(GM, "Skin Recovery Mist", 46, 0, "Toners & mists", { photo: "img/products/glymed-plus-skin-recovery-mist.webp", size: "4 fl oz / 118 ml", about: "Step 2 of the GlyMed Plus routine: treat." }),
    P(GM, "Vitamin C Cleanser", 47, 0, "Cleansers", { photo: "img/products/glymed-plus-vitamin-c-cleanser.webp", size: "6.75 fl oz / 200 ml", about: "Step 1 of the GlyMed Plus routine: cleanse." }),

    /* ── Mixi Skincare: 3 entries ── */
    P(MX, "Dew Drop", 56, 0, "Serums", { inv: "Dew Drops", slug: "dew-drops", photo: "img/products/mixi-dew-drop.webp", size: "1 fl oz", about: "Silky smooth hydration with beta-glucan. Non-pore-clogging." }),
    P(MX, "Hydroxi", 40, 2, "Acne & spot care", { consult: true, photo: "img/products/mixi-hydroxi.webp", size: "1.7 fl oz", about: "Hydrogen peroxide acne cream." }),
    P(MX, "Mineral SPF 50", 65, 1, "Sun care", { inv: "SPF 50 Mineral SPF", slug: "spf-50-mineral-spf", photo: "img/products/mixi-mineral-spf-50.webp", size: "2 fl oz", about: "UVA/UVB protection. Medical-grade sunscreen.", resolved: "Flag [10] answered by the label photo: Mixi Skincare mineral SPF 50, 2 fl oz. No tint named on the tube." }),

    /* ── Circadia: 1 entry ── */
    P(CI, "Vitamin Veil Cleansing Oil", 40, 1, "Cleansers", { inv: "Vitamin Veil Cleanser", slug: "vitamin-veil-cleanser", photo: "img/products/circadia-vitamin-veil-cleansing-oil.webp", size: "6.7 fl oz / 198 ml", about: "A cleansing oil." }),

    /* ── Lumevina: the online Skin Consult (a service; the shop shows it above the shelf, not in it) ── */
    P("Lumevina", "Skin Consult, online", 35, null, "Consults", { slug: "online-consult", kind: "consult", size: "15 minutes, by video or phone", about: "Evelyn looks at your skin and what you use, builds the routine, and unlocks the actives you need. The $35 comes back as a code on your first order." }),
  ];

  window.LUMEVINA_CATALOG = {
    asOf: "2026-10-18",
    brands: [FR, GM, MX, CI],
    /* in routine order: cleanse, tone, treat, moisturize, protect */
    categories: ["Cleansers", "Toners & mists", "Serums", "Acne & spot care", "Moisturizers", "Eye care", "Sun care", "Masks", "Supplements", "More"],
    products: LIST
  };
})();

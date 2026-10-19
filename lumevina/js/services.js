/* Lumevina — Evelyn's menu: every service she offers, in one place
 *
 * Copied from her GlossGenius booking page (GLOSSGENIUS-SERVICES.md, Oct
 * 19, 2026): names, her own descriptions, prices, times and deposits.
 * The website's menu, the booking calendar, the gift certificates and the
 * server's price list are all generated from this file:
 *
 *   node scripts/build-services.mjs        (from lumevina/)
 *
 * Fields:
 *   id        stays the same forever (bookings and gift codes point at it)
 *   name      as on GlossGenius
 *   price     dollars; from: true when GlossGenius shows "2 options · $N+"
 *   min       her time on GlossGenius; the calendar books it in 30-minute
 *             steps (rounded up)
 *   deposit   dollars due when booking online (her GlossGenius deposit);
 *             0 = nothing due until the visit
 *   desc      short line for the menu; about = her full description
 *   ask       true = "message Evelyn first" instead of the calendar
 *   addon     true = only alongside another service
 *   note      a short tag shown beside the name
 *   options   GlossGenius's "2 options": each one books on its own, at its
 *             own price and time ({ id, name, short, price, min }); short is
 *             the line under the service in the menu
 *
 * Not offered any more (hidden, ids kept so old bookings still read):
 *   couples-facial, back-facial-half/full,
 *   light/medium-chemical-peel, biorepeel-1/3, first-time-brazilian,
 *   extended-bikini-line, half/full-leg-wax, nose-wax, sideburn-wax,
 *   hairline-wax, full-face-wax, full-face-wax-cooling-mask.
 */
(function (root) {
  "use strict";

  var MENU = [
    { group: "Facials", key: "facials", items: [
      { id: "new-client-menu", name: "New Clients Start Here", price: 220, from: true, min: 60, deposit: 0, note: "New clients",
        options: [
          { id: "new-client-consultation", name: "New Clients Start Here", short: "Consultation + custom facial", price: 220, min: 60 },
          { id: "new-client-dermaplaning", name: "New Client Treatment + Dermaplaning", short: "With dermaplaning", price: 260, from: true, min: 80 }
        ],
        desc: "Consultation, a review of your current routine, and a fully customized facial. For non-acne skin; for acne, start with the Acne Bootcamp.",
        about: "Ready to understand your skin and what truly works for you? This service includes a consultation, review of your current routine, and a fully customized facial based on your skin’s needs. All facials include a double cleanse, enzyme exfoliation, extractions, targeted mask, relaxing massage, LED, and cryo globes. This service is for non-acne clients. For acne concerns, select “Acne Program” or “New Client Consultation + Treatment.”" },
      { id: "custom-facial-menu", name: "Lumevina Custom Facial", price: 200, from: true, min: 60, deposit: 0, note: "Returning clients",
        options: [
          { id: "lumevina-custom-facial", name: "Lumevina Custom Facial", short: "Custom facial", price: 200, min: 60 },
          { id: "custom-facial-dermaplaning", name: "Custom Facial + Dermaplaning", short: "With dermaplaning", price: 230, from: true, min: 60 }
        ],
        desc: "Double cleanse, enzyme or gentle acid exfoliation, extractions as needed, targeted mask, massage, LED and cryo globes.",
        about: "A customized facial for returning clients that includes a double cleanse, enzyme or gentle acid exfoliation, extractions (as needed), targeted mask, facial massage, LED therapy, and cryo globes. Best for clients following a customized skincare routine for continued skin progress. New clients: please book New Clients Start Here. Acne concerns: please book the Acne Program. If you’re unsure what to book, feel free to reach out." },
      { id: "ageless-grace-menu", name: "Ageless Grace Facial", price: 240, from: true, min: 75, deposit: 0, note: "Signature",
        options: [
          { id: "ageless-grace-facial", name: "Ageless Grace Facial", short: "Ageless Grace", price: 240, min: 75 },
          { id: "ageless-grace-dermaplaning", name: "Ageless Grace Facial + Dermaplaning", short: "With dermaplaning", price: 280, min: 85 }
        ],
        desc: "Lift, firm and brighten: oxygen therapy and a professional Tightening Protein Booster. Add dermaplaning or a peel for more glow.",
        about: "Lift, firm, and brighten your skin with this advanced age-supporting facial. Featuring oxygen therapy and a professional Tightening Protein Booster, this treatment helps improve circulation, boost hydration, and leave your skin firmer, smoother, and more radiant. Suitable for all skin types. For enhanced results, add dermaplaning and/or a chemical peel to maximize exfoliation, hydration, and glow. I’ll help determine whether one or both add-ons are the best fit for your skin and goals." },
      { id: "after-hours-facial", name: "After-Hours Add-On", price: 50, min: 0, deposit: 0, ask: true, addon: true,
        desc: "A visit outside her hours, or on a closed day. Message Evelyn first and she’ll confirm the time." }
    ] },
    { group: "ProCell Microchanneling", key: "procell", items: [
      { id: "procell-microchanneling", name: "ProCell Microchanneling", price: 350, from: true, min: 70, deposit: 0, note: "New",
        desc: "Collagen induction with growth factors for acne scars, fine lines, pores and texture. Includes LED, post-care guidance and a recovery set.",
        about: "*Promo pricing is available for a limited time.* Advanced Collagen Induction Therapy: a powerful skin-renewing treatment designed to improve the appearance of acne scars, fine lines, enlarged pores, uneven texture, and overall skin quality. It works with your skin’s natural healing process to stimulate collagen production while infusing growth factors to support smoother, healthier-looking skin. Each treatment includes LED light therapy, personalized post-care guidance, and a recovery skincare set to help support your results. For best results, a minimum of 4 treatments is recommended; depending on your skin concerns and goals, a series of up to 8 sessions may be recommended. Package options are available and will be discussed during your consultation." },
      { id: "procell-package-menu", name: "ProCell Microchanneling Package · 4 treatments", price: 1100, min: 60, deposit: 0, note: "First 10 clients",
        options: [
          { id: "procell-package", name: "ProCell Package · 4 treatments", short: "Four sessions, paid in full", price: 1100, min: 60 },
          { id: "procell-package-rebook", name: "ProCell Package · next session", short: "Next session (package already paid)", price: 0, min: 60 }
        ],
        desc: "Four treatments for $1,100 (regularly $1,400), for the first 10 clients only. Payment plans available; just ask.",
        about: "Invest in your skin and save with this limited-time introductory package: 4 ProCell Microchanneling treatments (a $1,400 value) for $1,100, saving $300. Payment plans are available, just ask for details. This exclusive client offer is limited to the first 10 clients only. Once all spots have been claimed, this package will no longer be available and standard pricing will apply. ProCell Microchanneling is ideal for improving acne scars, uneven texture, fine lines, pigmentation, and overall skin rejuvenation by stimulating your skin’s natural collagen production." }
    ] },
    { group: "Peels", key: "peels", items: [
      { id: "refresh-peel-menu", name: "Refresh Peel", price: 230, from: true, min: 10, deposit: 0,
        options: [
          { id: "refresh-peel", name: "Refresh Peel", short: "No-downtime peel", price: 230, min: 10 },
          { id: "refresh-peel-dermaplaning", name: "Refresh Peel + Dermaplaning", short: "With dermaplaning", price: 270, min: 15 }
        ],
        desc: "Gentle renewal with minimal downtime; maybe 2–3 days of light flaking. A great first peel. Aftercare products required for a series.",
        about: "Perfect for new and existing clients, this peel gently exfoliates to renew and brighten the skin with minimal downtime. Some clients may experience 2–3 days of light flaking, while others may not visibly peel, and both are completely normal. Ideal as your first peel or for deeper exfoliation during the summer months. A series is recommended for optimal results. Required aftercare products must be purchased before beginning a peel series." },
      { id: "corrective-peel-menu", name: "Corrective Peel", price: 230, from: true, min: 60, deposit: 0, note: "Existing clients",
        options: [
          { id: "corrective-peel", name: "Corrective Peel", short: "Medium chemical peel", price: 230, min: 60 },
          { id: "corrective-peel-dermaplaning", name: "Corrective Peel + Dermaplaning", short: "With dermaplaning", price: 270, min: 60 }
        ],
        desc: "Medium depth, for sun damage, fine lines, wrinkles and acne scars. Peeling up to a week. Prep and a homecare routine come first.",
        about: "This is a medium-depth peel for existing clients only. Peeling may last up to one week; results and visible peeling may vary. This treatment helps improve sun damage, fine lines, wrinkles, and acne scars by deeply exfoliating and renewing the skin. A series is recommended for best results. Prep and a specific homecare routine are required before booking this service." }
    ] },
    { group: "Acne Bootcamp", key: "acne", items: [
      { id: "new-client-consultation-acne", name: "New Client Consultation + Treatment", price: 220, min: 80, deposit: 50, note: "Start here for acne",
        desc: "A personalized plan with Face Reality, voted the #1 acne line, and a regimen made for your skin. Visits every two weeks work best; monthly is fine.",
        about: "Struggling with acne and feel like nothing works? You’re not alone, and you’re not out of options. With a personalized plan and Face Reality, voted the #1 acne line, we’ll get your skin on track. There are different types of acne, and every skin is unique. I’ll create a regimen tailored to your skin type. For best results, clients typically come in every two weeks and use Face Reality products at home, but monthly visits are available if biweekly isn’t doable. Clear, healthy skin starts here." },
      { id: "monthly-acne-treatment", name: "Monthly Acne Treatment", price: 200, from: true, min: 70, deposit: 30, note: "Bootcamp clients",
        desc: "Double cleanse, enzyme or chemical exfoliation, extractions, high frequency, custom mask, LED and finishing products.",
        about: "This service is for clients already enrolled in the Acne Bootcamp Program. First-time clients must book the Consultation + Treatment. Includes double cleanse, enzyme/chemical exfoliation, extractions, high frequency, custom mask, LED therapy, and finishing products. If a peel is added, extra time will be needed." },
      { id: "biweekly-acne-treatment", name: "Bi-Weekly Acne Treatment", price: 115, min: 45, deposit: 30, note: "By Evelyn’s recommendation",
        desc: "Extra support in the first months or while purging. Customized each visit: a peel, hydration-focused care or other corrective care.",
        about: "Recommended for clients who need additional support during their acne journey, especially during the first few months or while purging. Bi-weekly treatments can help accelerate progress, minimize setbacks, and keep your skin on track. This service is by recommendation only and is not appropriate for everyone; I will determine if bi-weekly visits are beneficial based on your skin’s condition and severity. Treatments are customized at each visit and may include a peel, hydration-focused care, or other corrective treatments. First-time clients: please book Consultation + Treatment." }
    ] },
    { group: "Consultations", key: "consult", items: [
      { id: "in-person-consultation", name: "In-Person Consultation", price: 50, min: 45, deposit: 49,
        desc: "A deep dive into your skin type, concerns and goals, with a plan and at-home product picks. Start with products, treatments later.",
        about: "Have questions about your skin or not sure where to start? We’ll take a deep dive into your skin type, concerns, and goals. I’ll assess your skin in person and create a customized plan with at-home product recommendations. While starting with the New Client Consultation + Treatment is ideal, this option is great if you’d like to begin with products first and start treatments later when you’re ready." },
      { id: "virtual-consultation", name: "Virtual Consultation", price: 50, min: 45, deposit: 49, ask: true, note: "Mondays only",
        desc: "Your skin, concerns and long-term goals by video, with a treatment plan and at-home picks. Mondays only; message Evelyn first.",
        about: "Have more questions about your skin or not sure where to start? During this consultation, we’ll take a deep dive into your skin type, concerns, and long-term goals. I’ll assess your skin and create a customized treatment plan, including at-home product recommendations to support real, lasting results. Please note: this service is available on Mondays only. Be sure to reach out beforehand before booking." }
    ] },
    { group: "Waxing", key: "waxing", subs: [
      { group: "Brazilian & Bikini", items: [
        { id: "brazilian-wax", name: "Brazilian Wax", price: 75, min: 40, deposit: 30,
          desc: "Everything from the front, sides, labia and between the cheeks, completely smooth, or leave a small strip." },
        { id: "wax-wednesday", name: "Wax Wednesday", price: 65, min: 40, deposit: 30, note: "Wednesdays only",
          desc: "$10 off a Brazilian on any Wednesday. Please book it on a Wednesday only." },
        { id: "brazilian-wax-mini-vajacial", name: "Brazilian Wax + Mini Vajacial", price: 95, min: 50, deposit: 30,
          desc: "A full Brazilian, extractions if needed, ingrown hair removal and a cooling, hydrating mask to soothe and prevent ingrowns." },
        { id: "bikini-line-wax", name: "Bikini Line", price: 40, min: 40, deposit: 30,
          desc: "Just outside the underwear line, about four fingers out. Doesn’t include the butt strip." },
        { id: "inner-thigh-add-on", name: "Inner Thigh Add-On", price: 25, min: 15, deposit: 0, addon: true,
          desc: "All hair on the inner thigh, past the four fingers a Brazilian already covers." }
      ] },
      { group: "Body", items: [
        { id: "underarm-wax", name: "Underarm Wax", price: 20, min: 20, deposit: 0 },
        { id: "full-arm-wax", name: "Full Arm", price: 60, min: 40, deposit: 30, desc: "All hair on the arm." },
        { id: "half-arm-wax", name: "Half Arm", price: 30, min: 30, deposit: 20, desc: "Half of the arms; your choice of which half." },
        { id: "full-back-wax", name: "Full Back", price: 60, min: 45, deposit: 30 },
        { id: "half-back-wax", name: "Half Back", price: 30, min: 25, deposit: 20 },
        { id: "full-stomach-wax", name: "Full Stomach Wax", price: 35, min: 45, deposit: 0, desc: "All the hair on the abdomen and between the breasts." },
        { id: "stomach-strip-wax", name: "Stomach Strip Add-On", price: 10, min: 10, deposit: 0, addon: true, desc: "The line of hair under the belly button, toward the bikini." },
        { id: "full-butt-wax", name: "Full Butt", price: 40, min: 45, deposit: 20, desc: "The entire area, including the cheeks and between them." }
      ] },
      { group: "Face", items: [
        { id: "brow-menu", name: "Brows", price: 25, from: true, min: 30, deposit: 0,
          options: [
            { id: "brow-wax-tweeze", name: "Brow Wax + Tweeze", short: "Brow wax + tweeze", price: 25, min: 30 },
            { id: "brow-underarm-wax", name: "Brow Wax + Underarm Wax", short: "Brows + underarms", price: 45, min: 30 }
          ] },
        { id: "upper-lip-wax", name: "Upper Lip", price: 10, min: 10, deposit: 0 },
        { id: "nostril-wax", name: "Nostril Wax", price: 10, min: 15, deposit: 0, desc: "Hair removal from inside the nose." }
      ] }
    ] }
  ];

  /* flat list of what can be booked (each option on its own), with the
     calendar's 30-minute block for each */
  var block = function (min) { return min > 0 ? Math.ceil(min / 30) * 30 : 0; };
  var all = [];
  MENU.forEach(function (g) {
    (g.subs || [{ group: g.group, items: g.items }]).forEach(function (sg) {
      sg.items.forEach(function (s) {
        s.sector = g.key; s.sectorName = g.group; s.sub = g.subs ? sg.group : null;
        s.block = block(s.min);
        if (!s.options) { all.push(s); return; }
        s.options.forEach(function (o) {
          o.parent = s.id; o.deposit = s.deposit; o.desc = o.desc || s.desc; o.about = s.about;
          o.sector = s.sector; o.sectorName = s.sectorName; o.sub = s.sub; o.block = block(o.min);
          if (s.ask) o.ask = true;
          all.push(o);
        });
      });
    });
  });

  root.LUMEVINA_SERVICES = {
    asOf: "2026-10-19",
    menu: MENU,
    all: all,
    get: function (id) { for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  };
})(typeof window !== "undefined" ? window : globalThis);

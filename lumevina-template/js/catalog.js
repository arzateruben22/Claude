/* Lumevina — service catalog (single source of truth).
   Prices and durations mirror the live Lumevina site (lumevina/).
   Durations: 30 or 60 min, matching the booking engine's cell model. */

window.LumevinaCatalog = {
  currency: "$",
  categories: [
    {
      key: "facials", label: "Facials", tag: "Bespoke, results-driven", icon: "facial",
      blurb: "Custom facials built around your skin that day \u2014 cleanse, treat, and glow with medical-grade actives.",
      services: [
        { id:"lumevina-custom-facial", name:"Lumevina Custom Facial", price:180, dur:60, desc:"Our signature hour \u2014 consult, cleanse, treat, and glow, tailored every visit.", flag:"featured" },
        { id:"ageless-grace-facial", name:"Ageless Grace Facial", price:230, dur:60, desc:"A firming, replenishing ritual focused on mature and maturing skin." },
        { id:"custom-facial-dermaplaning", name:"Custom Facial + Dermaplaning", price:170, dur:60, desc:"The custom facial plus dermaplaning for instant smoothness and glow." },
        { id:"couples-facial", name:"Couples Facial", price:300, dur:60, desc:"Two side-by-side custom facials \u2014 a shared hour of calm." },
        { id:"back-facial-full", name:"Back Facial \u2014 Full", price:170, dur:60, desc:"A deep-cleansing treatment for the whole back." },
        { id:"back-facial-half", name:"Back Facial \u2014 Half", price:130, dur:60, desc:"Targeted back-facial for the upper or lower back." },
        { id:"after-hours-facial", name:"After Hours Facial Add-On", price:30, dur:60, desc:"Extend your appointment beyond regular hours." },
      ]
    },
    {
      key: "peels", label: "Peels & Advanced", tag: "Resurface & renew", icon: "peel",
      blurb: "Clinical resurfacing \u2014 chemical peels and BioRePeel to renew tone and texture.",
      services: [
        { id:"biorepeel-1", name:"BioRePeel \u2014 1 Treatment", price:250, dur:60, desc:"A TCA-based peel with minimal downtime for glow and clarity." },
        { id:"biorepeel-3", name:"BioRePeel \u2014 Course of 3", price:625, dur:60, desc:"Three BioRePeel treatments for compounding, longer-lasting results." },
        { id:"light-chemical-peel", name:"Light Chemical Peel", price:210, dur:60, desc:"A gentle resurfacing peel for brightness and smoother texture." },
        { id:"medium-chemical-peel", name:"Medium Chemical Peel", price:220, dur:60, desc:"A deeper peel for tone, texture, and visible renewal." },
      ]
    },
    {
      key: "acne", label: "Acne Program", tag: "Clear, calm skin", icon: "acne",
      blurb: "A guided program to calm breakouts and clear congestion \u2014 consult, then a treatment cadence.",
      services: [
        { id:"new-client-consultation-acne", name:"New Client Consult + Treatment (Acne)", price:210, dur:60, desc:"Your acne starting point \u2014 assessment plus a first treatment." },
        { id:"monthly-acne-treatment", name:"Monthly Acne Treatment", price:180, dur:60, desc:"Ongoing monthly care to keep skin clear and balanced." },
        { id:"biweekly-acne-treatment", name:"Bi-Weekly Acne Treatment", price:110, dur:60, desc:"A closer cadence for active breakouts and faster progress." },
      ]
    },
    {
      key: "waxing", label: "Waxing", tag: "Smooth & precise", icon: "wax",
      blurb: "Precise, gentle waxing \u2014 face and body, with a calming finish.",
      services: [
        { id:"brow-wax-tweeze", name:"Brow Wax + Tweeze", price:25, dur:30 },
        { id:"upper-lip-wax", name:"Upper Lip Wax", price:8, dur:30 },
        { id:"full-face-wax", name:"Full Face Wax", price:35, dur:30 },
        { id:"full-face-wax-cooling-mask", name:"Full Face Wax + Cooling Mask", price:50, dur:60 },
        { id:"sideburn-wax", name:"Sideburn Wax", price:20, dur:30 },
        { id:"hairline-wax", name:"Hairline Wax", price:40, dur:30 },
        { id:"nose-wax", name:"Nose Wax", price:8, dur:30 },
        { id:"nostril-wax", name:"Nostril Wax", price:10, dur:30 },
        { id:"underarm-wax", name:"Underarm Wax", price:20, dur:30 },
        { id:"full-arm-wax", name:"Full Arm Wax", price:55, dur:30 },
        { id:"half-arm-wax", name:"Half Arm Wax", price:30, dur:30 },
        { id:"full-back-wax", name:"Full Back Wax", price:85, dur:60 },
        { id:"half-back-wax", name:"Half Back Wax", price:45, dur:30 },
        { id:"full-leg-wax", name:"Full Leg Wax", price:100, dur:60 },
        { id:"half-leg-wax", name:"Half Leg Wax", price:50, dur:30 },
        { id:"full-stomach-wax", name:"Full Stomach Wax", price:35, dur:30 },
        { id:"stomach-strip-wax", name:"Stomach Strip Wax", price:10, dur:30 },
        { id:"full-butt-wax", name:"Full Butt Wax", price:40, dur:30 },
        { id:"bikini-line-wax", name:"Bikini Line Wax", price:30, dur:30 },
        { id:"extended-bikini-line", name:"Extended Bikini Line", price:50, dur:30 },
        { id:"brazilian-wax", name:"Brazilian Wax", price:75, dur:30 },
        { id:"first-time-brazilian", name:"First Time Brazilian", price:75, dur:60, desc:"A gentle, guided first Brazilian." },
        { id:"brazilian-wax-mini-vajacial", name:"Brazilian + Mini Vajacial", price:95, dur:60, desc:"Brazilian wax paired with a soothing mini vajacial." },
        { id:"inner-thigh-add-on", name:"Inner Thigh Add-On", price:25, dur:30 },
        { id:"wax-wednesday", name:"Wax Wednesday (Brazilian)", price:65, dur:30, desc:"Brazilian at a special Wednesday rate \u2014 double Glow Points." },
      ]
    },
    {
      key: "consults", label: "Consultations", tag: "Start here", icon: "consult",
      blurb: "New here, or not sure where to begin? Start with a consult.",
      services: [
        { id:"new-client-consultation", name:"New Client Consult + Treatment", price:200, dur:60, desc:"For first-time guests \u2014 full assessment plus a treatment." },
        { id:"in-person-consultation", name:"In-Person Consultation", price:50, dur:30, desc:"A focused, in-studio skin consultation." },
        { id:"virtual-consultation", name:"Virtual Consultation", price:50, dur:30, desc:"A remote consult to plan your skin journey." },
      ]
    },
    {
      key: "gifts", label: "Gift Certificates", tag: "Give the glow", icon: "gift",
      blurb: "A specific treatment, or a value toward any service \u2014 emailed with a code, never expires.",
      services: [
        { id:"gift-any-100", name:"Gift Card \u2014 Any treatment ($100)", price:100, dur:60, desc:"A $100 value toward any Lumevina service.", flag:"gift" },
      ]
    },
  ]
};

/* Lumevina — the hand-off rules for Ask Lumevina
 *
 * Plain code that runs before any AI, on the website and on the server
 * (server/functions/_shared/knowledge.ts carries a generated copy). A
 * question that matches goes to Evelyn with a drafted reply she checks;
 * nothing here depends on a model.
 *
 *   urgent      sounds like an emergency: told to call 911, then sent to her
 *   reaction    something went wrong on the skin
 *   pregnancy   pregnant, breastfeeding, trying
 *   medication  Accutane, prescriptions, procedures that change what's safe
 *   condition   a named skin condition
 *   skin        "my skin", "what should I use", "is this normal", "what's wrong" from a photo: personal
 *   personal    Evelyn's own hard lines (her Skin Playbook): supplements, results or guarantees,
 *               discounts or price exceptions, clients under 18
 *
 * Each rule is data (regex sources), so the same list is copied into the
 * server's TypeScript and the eval's JSON by knowledge/scripts/build-bundle.mjs.
 * A kind matches when any pattern in `any` matches, or every pattern in
 * `both` matches. Tests run on the text as typed and as the typo fixer reads it.
 */
(function () {
  "use strict";

  var URGENT = /(can'?t|cannot|hard to|trouble|struggling to) breathe|throat (is )?(closing|swelling|tight)|tongue.*swell|swell.*(lips?|tongue|throat)|(lips?|tongue|throat).*swell|anaphyla|faint|pass(ed|ing) out/i;

  var KINDS = [
    { kind: "reaction", any: [/react|rash|burn|swell|swollen|itch|hives|allerg|blister|bleed|infect|\bpus\b|ooz|scab|stinging|irritat|red(ness)? (won'?t|isn'?t|still)|peeling/i] },
    { kind: "pregnancy", any: [/pregnan|expecting|breastfeed|nursing|trying to conceive/i] },
    { kind: "medication", any: [/accutane|isotretinoin|tretinoin|retin-?a\b|prescri|medicat|antibiotic|spironolactone|birth control|chemo|radiation|laser|surgery|botox|filler/i] },
    { kind: "condition", any: [/eczema|psoriasis|rosacea|dermatitis|lupus|cold sore|herpes|melasma|mole\b|lump|cyst|fungal|perioral/i] },
    /* her own hard lines, from her Skin Playbook: before "skin", so "guarantee my acne will clear" is hers to answer */
    { kind: "personal", any: [/supplement|clear skin balance|softgels?|\bpills?\b|capsules?|probiotic|biotin/i,
      /guarantee|money.?back|promise (me|that|it|results?)|refund if/i,
      /discount|coupon|promo( code)?|cheaper|price (match|exception|break)|lower (the |your )?price|special price|sliding scale|any deals?\b/i,
      /\bunder ?18\b|\bminors?\b|\b(1[0-7]) ?(years? old|yrs? old|yo|y\/o)\b|\bi'?m (1[0-7])\b|\bmy (daughter|son|kid|child|teen|teenager)\b|\bteen(ager)?s?\b/i] },
    { kind: "skin",
      any: [/\bmy (skin|face|acne|breakouts?|pores|spots|scars?|pigment|dark spots|wrinkles|texture|cheeks|chin|forehead)\b|for my skin|purging|(breaking|broke|break) ?out after/i,
            /what('?s| is) (wrong|going on|this|that) (with|on) (my|this|her|his)|(look at|see) (this|my|the) (photo|pic|picture|selfie)|from (a|this|my|the) (photo|pic|picture)/i],
      both: [/\bi (have|got|keep getting|am getting|'m getting)\b|is (it|this) normal|should i\b|what should i use|right for me|recommend/i,
             /skin|face|acne|break ?out|breaking out|pimple|pore|spots?\b|scar|pigment|wrinkle|\bdry\b|oily|sensitive|redness|texture|serum|routine|product/i] }
  ];

  var hit = function (k, t) {
    if (k.any && k.any.some(function (re) { return re.test(t); })) return true;
    return !!(k.both && k.both.every(function (re) { return re.test(t); }));
  };

  /* the kind a question is handed off as, or null when it can be answered */
  var kind = function (raw, fixed) {
    var texts = [String(raw || "")].concat(fixed && fixed !== raw ? [String(fixed)] : []);
    for (var i = 0; i < texts.length; i++) if (URGENT.test(texts[i])) return "urgent";
    for (var j = 0; j < KINDS.length; j++) {
      for (var n = 0; n < texts.length; n++) if (hit(KINDS[j], texts[n])) return KINDS[j].kind;
    }
    return null;
  };

  window.LumevinaAskRules = { URGENT: URGENT, KINDS: KINDS, kind: kind };
})();

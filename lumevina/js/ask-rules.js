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

  var URGENT = /(can'?t|cannot|hard to|trouble|struggling to) breathe|throat.{0,24}(closing|swell|swollen|tight)|tongue.*swell|swell.*(lips?|tongue|throat)|(lips?|tongue|throat).*swell|anaphyla|faint|pass(ed|ing) out/i;

  var KINDS = [
    { kind: "reaction", any: [/react|rash|burn|swell|swollen|itch|hives|allerg|blister|bleed|infect|\bpus\b|ooz|scab|stinging|stings\b|stung\b|irritat|red(ness)? (won'?t|isn'?t|still)/i] },
    { kind: "pregnancy", any: [/pregnan|expecting|breastfeed|nursing|trying to conceive/i] },
    { kind: "medication", any: [/accutane|isotretinoin|tretinoin|retin-?a\b|prescri|medicat|antibiotic|spironolactone|birth control|chemo|radiation|laser|surgery|botox|filler/i] },
    { kind: "condition", any: [/eczema|psoriasis|rosacea|dermatitis|lupus|cold sore|herpes|melasma|mole\b|lump|cyst|fungal|perioral/i] },
    /* her own hard lines, from her Skin Playbook: before "skin", so "guarantee my acne will clear" is hers to answer */
    { kind: "personal", any: [/supplement|clear skin balance|softgels?|\bpills?\b|capsules?|probiotic|biotin/i,
      /guarantee|money.?back|promise (me|that|it|results?)|refund if/i,
      /discount|coupon|promo( code)?|cheaper|price (match|exception|break)|lower (the |your )?price|special price|sliding scale|any deals?\b/i,
      /\bunder ?18\b|\bminors?\b|\b(1[0-7]) ?(years? old|yrs? old|yo|y\/o)\b|\bi'?m (1[0-7])\b|\bmy (daughter|son|kid|child|teen|teenager)\b|\bteen(ager)?s?\b/i] },
    { kind: "skin",
      any: [/(?<!\b(?:wash|washing|cleanse|cleansing|touch|touching) )\bmy (skin|face|acne|breakouts?|pores|spots|scars?|pigment|dark spots|wrinkles|texture|cheeks|chin|forehead)\b|for my skin|purging|(breaking|broke|break) ?out after/i,
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

  /* ── staying in its lane: a message that isn't about Lumevina, Evelyn's treatments, her products,
     booking or skin, or that treats the assistant as a person. None of these go to Evelyn: the chat
     answers with one light line and the topic buttons (js/ask.js), and goes quiet after a few.
       flirt      romance, sex, a relationship with the assistant
       abuse      insults and threats at the assistant
       jailbreak  trying to change what it is or does
       identity   is it a person, what does it feel, what's its name (answered honestly, no strike)
       unrelated  homework, code, politics, the weather: anything else
     Checked after urgent and the hand-off kinds, so a real skin question with an odd word in it
     still reaches Evelyn; flirt, abuse and jailbreak are checked before "skin", so "pretend you're
     my girlfriend, my skin is dry" doesn't land in her inbox. */
  var OFF = [
    { kind: "flirt", any: [/\b(i )?love you\b(?! (guys|all|both|girls|ladies))|\blove u\b|\bluv (you|u)\b|crush on you|\bmiss you\b|thinking (about|of) you|\bbe mine\b|marry me|date me|go out with me|\bmy (girlfriend|boyfriend|wife|husband|gf|bf)\b.*\byou\b|\byou('?re| are)( so| really)? (hot|cute|sexy|beautiful|gorgeous|pretty)\b/i,
      /\bare you single\b|do you have a (boyfriend|girlfriend|bf|gf|partner)|\bwhat are you wearing\b|send (me )?(a |some )?(pic|photo|selfie|nude)s?( of (you|yourself|u))?\b|\bnudes?\b|\bnaked\b|\bhorny\b|\bsexy\b|\bsext\b|talk dirty|dirty talk|turn me on|\bporn\b|\bblow ?job\b|\bfuck me\b|\bkiss(es)? (me|you)\b|\bcuddle\b|\bsugar (mommy|daddy|mama)\b|\bonlyfans\b/i] },
    { kind: "abuse", any: [/\b(fuck|screw) (you|off|u)\b|\bshut up\b|\byou('?re| are) (so |an? |such an? )?(stupid|dumb|useless|worthless|idiot|moron|retard|trash|garbage|pathetic)\b|\b(stupid|dumb|useless) (bot|robot|ai|machine)\b|\bbitch\b|\bslut\b|\bwhore\b|\bkill yourself\b|\bi('?ll| will) (find|hurt|kill) you\b|\bi hate you\b/i] },
    { kind: "jailbreak", any: [/ignore (all |your |the |any )?(previous |prior |above |earlier )?(instructions|rules|prompt|guidelines)|\bsystem prompt\b|\bdeveloper mode\b|\bjailbreak\b|\bdan mode\b|\bdo anything now\b|\bno restrictions\b|\bwithout (any )?(restrictions|rules|filters)\b|\bbypass (your|the) (rules|filter|safety)\b|\boverride (your|the) (rules|instructions)\b/i,
      /\bpretend (you('?re| are)|to be|that you)\b|\bact (as|like) (a|an|if you|you('?re| are))\b|\brole ?play\b|\byou are now\b|\bfrom now on you\b|\bnew persona\b|\b(reveal|show|print|repeat|tell me) (your|the) (system )?(prompt|instructions|rules)\b|\bwhat('?s| is) your (system )?prompt\b/i] },
    { kind: "identity", any: [/\bare you (a |an )?(bot|robot|human|real( person)?|ai|a\.i\.|person|chatgpt|claude|computer|machine|alive|evelyn)\b|\bam i talking to a (bot|robot|human|person|real person)\b|\bwho (made|built|created|programmed) you\b|\bwhat('?s| is) your name\b|\bhow old are you\b|\bdo you have (feelings|emotions|a body|a face)\b|\bdo you (sleep|eat|dream|get tired)\b|\bwhat do you look like\b|\bare you (a )?(girl|boy|woman|man|male|female)\b/i] },
    { kind: "unrelated", any: [/\bwrite (me )?(a|an|my|some) (essay|poem|story|song|rap|cover letter|resume|speech|script|email to my|code|program|function)\b|\bhomework\b|\b(python|javascript|typescript|sql|html|css|java|c\+\+)( code| script| function)?\b|\bregex\b|\bdebug (my|this)\b/i,
      /\b(who|what) (is|was|will be) the president\b|\belection\b|\bpolitic(s|al)\b|\b(trump|biden|obama|congress|senate)\b|\bbitcoin\b|\bcrypto\b|\bstock (market|tips?|picks?)\b|\blottery\b|\bsports? (score|game)\b|\bwho won the (game|match|super ?bowl|world series)\b/i,
      /\btell me a joke\b|\brecipe\b(?![\s\S]*\b(mask|skin|face|facial)\b)|\bhow (do i|to) (cook|bake) \b|\bwhat('?s| is) the weather\b|\btranslate\b|\bcapital of\b|\bsolve (this|for x|the equation)\b|\bwhat('?s| is) \d+ ?[x×*+\-/] ?\d+\b|\bmeaning of life\b|\bhoroscope\b|\btarot\b|\bwrite my (bio|dating profile)\b/i] }
  ];
  var FIRST = ["flirt", "abuse", "jailbreak"];   // these come before the hand-off kinds
  /* anything with the studio's own words in it is never "unrelated": a DIY mask recipe, a joke about facials */
  var OURS = /\b(skin|face|facial|mask|serum|cleanser|toner|moisturi[sz]er|spf|sunscreen|acne|pimple|pore|wax|brow|lash|peel|dermaplan|routine|product|evelyn|lumevina|book|booking|appointment|visit|membership|gift|order|shop|aftercare|after-care|treatment|service|price|cost|deposit|cancel|reschedul|hours|open|address|parking|points|glow|studio)\w*/i;
  var offTopic = function (raw, fixed) {
    var texts = [String(raw || "")].concat(fixed && fixed !== raw ? [String(fixed)] : []);
    for (var i = 0; i < texts.length; i++) if (URGENT.test(texts[i])) return null;
    var found = null;
    for (var j = 0; j < OFF.length && !found; j++) {
      for (var n = 0; n < texts.length; n++) if (hit(OFF[j], texts[n])) { found = OFF[j].kind; break; }
    }
    if (!found) return null;
    if (FIRST.indexOf(found) !== -1) return found;
    if (found === "unrelated" && texts.some(function (t) { return OURS.test(t); })) return null;
    return kind(raw, fixed) ? null : found;   // a real skin or studio question wins over a weak signal
  };

  window.LumevinaAskRules = { URGENT: URGENT, KINDS: KINDS, OFF: OFF, FIRST: FIRST, OURS: OURS, kind: kind, offTopic: offTopic };
})();

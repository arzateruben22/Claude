/* Lumevina — typos and gibberish, for the Ask Lumevina chat
 *
 * Shared by the website chat (js/ask.js) and the app sample (built into
 * docs/app-sample/index.html by its build.py).
 *
 *   fix(text)       lower-cases and corrects misspelled words to the closest
 *                   word the chat knows ("facail" → "facial", "cancle" →
 *                   "cancel"). Common English words are never "corrected".
 *   gibberish(text) true when the message isn't readable words: keyboard
 *                   mashing, no vowels, a lone unknown word, only symbols.
 *                   A real sentence the chat can't answer is not gibberish:
 *                   that one still goes to Evelyn.
 */
(function () {
  "use strict";

  /* the words the chat's answers are keyed on */
  var VOCAB = ("price prices pricing cost costs facial facials book booking booked appointment appointments schedule " +
    "available availability opening openings slot slots cancel cancellation reschedule deposit refund late " +
    "membership memberships member members glow ageless grace custom dermaplaning peel peels acne treatment " +
    "treatments consultation consult wax waxing brazilian bikini eyebrow eyebrows brow brows underarm underarms " +
    "legs arms chin cheeks forehead stomach nose sideburns vajacial hours closed sunday monday tuesday wednesday " +
    "thursday friday saturday weekend address location located parking directions gift gifts certificate " +
    "certificates products product serum cleanser sunscreen moisturizer skincare routine points rewards " +
    "referral refer birthday pause banked payment cash venmo zelle makeup workout exercise sweat shave shaving " +
    "retinol retinoid botox filler fillers aftercare prepare pregnant pregnancy breastfeeding accutane rash " +
    "redness reaction breakout breakouts pimple pimples pores sensitive oily skin lashes nails evelyn lumevina " +
    "extractions hydrating ingredients allergic allergy swelling burning itchy course courses class classes lesson lessons school").split(" ");

  /* everyday words: known, so never treated as typos or gibberish */
  var COMMON = ("a i the and or but is are was were be been being am do does did done have has had can could would " +
    "should will shall may might must my me mine you your yours we our us it its this that these those there here " +
    "what when where which who whom whose why how much many more most some any all no not yes yeah yep ok okay " +
    "please thanks thank hi hey hello to of in on at for with about from by up down out off over under again if " +
    "then than so just also too very really get gets got go goes going gone come comes coming make makes need " +
    "needs want wants like know think see look looking use using used time times day days week weeks month months " +
    "year next last first one two three four five new good great best long before after during same other still " +
    "only today tomorrow tonight morning afternoon evening now soon later ever never always often usually its im " +
    "dont cant wont whats hows theres ive id youre work part back give find help tell ask say open free sure way " +
    "well lot bit little anything something someone anyone everyone people friend friends mom sister husband " +
    "boyfriend girlfriend wife kid kids daughter son take takes into much each every per both either while until " +
    "since because though right left long short hurt hurts feel feels felt normal okay safe start started stop " +
    "try tried again pay paid buy bought sell send sent get call text email phone number name come stay leave " +
    "bring wear wearing hair face body back chest neck lip lips arm leg feet hand hands eyes ear ears nose " +
    "love nice cool wait sorry maybe probably also another any else").split(" ");

  var KNOWN = {}, TOPIC = {};
  VOCAB.concat(COMMON).forEach(function (w) { KNOWN[w] = true; });
  VOCAB.forEach(function (w) { TOPIC[w] = true; });

  /* texting shorthand, read as the full word */
  var SHORT = { u: "you", ur: "your", r: "are", y: "why", wat: "what", wut: "what", wht: "what", wen: "when", whn: "when",
    wher: "where", whr: "where", pls: "please", plz: "please", thx: "thanks", ty: "thank you", tmrw: "tomorrow", tmr: "tomorrow",
    tmrrw: "tomorrow", appt: "appointment", appts: "appointments", bday: "birthday", mins: "minutes", hrs: "hours",
    rn: "right now", idk: "i don't know", b4: "before", "2day": "today", "2morrow": "tomorrow" };

  /* edit distance, counting a swapped pair of letters as one edit */
  var dist = function (a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  };

  /* the closest known word, if there's exactly one close enough */
  var closest = function (w) {
    if (w.length < 4 || KNOWN[w]) return null;
    var max = w.length >= 7 ? 2 : 1, best = null, bestD = max + 1, tie = false;
    for (var i = 0; i < VOCAB.length; i++) {
      var v = VOCAB[i];
      if (Math.abs(v.length - w.length) > max) continue;
      var dd = dist(w, v);
      if (dd < bestD) { best = v; bestD = dd; tie = false; }
      else if (dd === bestD && v !== best) tie = true;
    }
    return best && !tie ? best : null;
  };

  var fix = function (text) {
    return String(text || "").toLowerCase().replace(/[a-z0-9]+/g, function (w) {
      if (SHORT.hasOwnProperty(w)) return SHORT[w];
      return /^[a-z]+$/.test(w) ? (closest(w) || w) : w;
    });
  };

  var MASH = /qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm/;
  /* could this be a word? (known, or shaped like one) */
  var wordlike = function (w) {
    if (KNOWN[w] || closest(w)) return true;
    if (!/[aeiouy]/.test(w)) return false;                    /* "bcdfg" */
    if (/(.)\1\1/.test(w)) return false;                        /* "aaaa", "hmmm" */
    if (/[^aeiouy]{5,}/.test(w)) return false;                  /* "sdfgj" */
    if (MASH.test(w)) return false;                             /* keyboard rows */
    if (w.length >= 5) {                                        /* "jkkjkj": one or two letters over and over */
      var seen = {}, n = 0;
      for (var i = 0; i < w.length; i++) if (!seen[w[i]]) { seen[w[i]] = 1; n++; }
      if (n <= 2) return false;
    }
    var v = (w.match(/[aeiouy]/g) || []).length / w.length;
    return v >= 0.18 && v <= 0.8;
  };

  var gibberish = function (text) {
    var words = fix(String(text || "").replace(/'/g, "")).match(/[a-z]+/g) || [];
    if (!words.length) return true;                             /* "???", "..." or only emoji */
    /* one or two words and none of them a topic ("a", "blah", "the thing"): nothing to go on */
    if (words.length <= 2 && !words.some(function (w) { return TOPIC[w] || closest(w); })) return true;
    var odd = words.filter(function (w) { return !wordlike(w); }).length;
    return odd / words.length >= 0.5;
  };

  window.LumevinaTypos = { fix: fix, gibberish: gibberish, closest: closest };
})();

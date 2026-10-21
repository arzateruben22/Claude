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
    "extractions hydrating ingredients allergic allergy swelling burning itchy course courses class classes lesson lessons school workshop party parties bachelorette esthetician estheticians " +
    "microchanneling procell exfoliate exfoliating exfoliation ingrown ingrowns tretinoin retinal mandelic salicylic glycolic niacinamide " +
    "sunscreen peeling flaking purging dehydrated hyperpigmentation melasma rosacea eczema blackheads whiteheads cystic hormonal " +
    "supplements collagen vitamin moisturizing toner serums waxed waxes bleeding bruising tanning sunburn question questions").split(" ");

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
    "love nice cool wait sorry maybe probably also another any else run runs running ran low order orders ordered " +
    "reorder package packages ship ships shipped track tracking tracked deliver delivered delivery arrive arrived " +
    "pickup bag cart code balance").split(" ");

  var KNOWN = {}, TOPIC = {}, SMALL = {};
  VOCAB.concat(COMMON).forEach(function (w) { KNOWN[w] = true; });
  VOCAB.forEach(function (w) { TOPIC[w] = true; });
  /* small talk on its own is a real message, not gibberish ("thx!!", "heyyy", "k") */
  "hi hey hello helo heyo hiya yo sup thanks thank ok okay cool great perfect nice yes yeah no bye night later sorry please what huh why".split(" ").forEach(function (w) { SMALL[w] = true; });

  /* texting shorthand, read as the full words (never corrected back at the client) */
  var SHORT = { u: "you", ur: "your", urs: "yours", r: "are", y: "why", wat: "what", wut: "what", wht: "what", wen: "when", whn: "when",
    wher: "where", whr: "where", pls: "please", plz: "please", thx: "thanks", thnx: "thanks", thanx: "thanks", ty: "thank you",
    tysm: "thank you so much", tyvm: "thank you very much", tmrw: "tomorrow", tmr: "tomorrow", tmrrw: "tomorrow", "2moro": "tomorrow",
    "2morrow": "tomorrow", "2day": "today", "2nite": "tonight", tonite: "tonight", appt: "appointment", appts: "appointments",
    bday: "birthday", mins: "minutes", min: "minute", hrs: "hours", hr: "hour", wk: "week", wks: "weeks", yr: "year", yrs: "years",
    rn: "right now", atm: "right now", asap: "as soon as possible", idk: "i don't know", ik: "i know", ikr: "i know right",
    wdym: "what do you mean", wym: "what do you mean", wyd: "what are you doing", hbu: "how about you", lmk: "let me know",
    nvm: "never mind", nm: "never mind", np: "no problem", ofc: "of course", bc: "because", cuz: "because", cos: "because",
    coz: "because", tho: "though", thru: "through", til: "until", till: "until", b4: "before", nxt: "next", abt: "about",
    msg: "message", txt: "text", dm: "message", pic: "photo", pics: "photos", info: "information", avail: "available",
    sched: "schedule", convo: "conversation", q: "question", qs: "questions", ppl: "people", smth: "something", sth: "something",
    rly: "really", rlly: "really", srsly: "seriously", def: "definitely", prob: "probably", probs: "probably", sry: "sorry",
    srry: "sorry", gonna: "going to", wanna: "want to", gotta: "got to", kinda: "kind of", sorta: "sort of", ya: "yeah",
    yea: "yeah", yup: "yes", yep: "yes", nah: "no", nope: "no", k: "ok", kk: "ok", okie: "ok", oki: "ok", aight: "ok", ight: "ok",
    gotcha: "got it", tbh: "to be honest", imo: "in my opinion", fyi: "for your information", btw: "by the way", jk: "just kidding",
    omg: "oh my", omw: "on my way", ttyl: "talk to you later", cya: "see you", bf: "boyfriend", gf: "girlfriend", im: "i'm",
    ive: "i've", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't",
    couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", havent: "haven't", hasnt: "hasn't", whats: "what's",
    hows: "how's", wheres: "where's", theres: "there's", thats: "that's", youre: "you're", theyre: "they're", lemme: "let me",
    gimme: "give me", l8r: "later", gr8: "great", "4ever": "forever", esthe: "esthetician", derm: "dermatologist",
    dermplaning: "dermaplaning", brazillian: "brazilian", brazilan: "brazilian", brazilion: "brazilian" };
  /* symbols that stand for words */
  var SYMBOLS = [[/\bw\/o\b/g, " without "], [/\bw\/(?=\s|$)/g, " with "], [/\bb\/c\b/g, " because "], [/&/g, " and "], [/\+/g, " plus "]];

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
      if (dd > 1 && v[0] !== w[0]) continue;                  /* "running" isn't "burning": a new first letter takes a one-letter typo */
      if (dd < bestD) { best = v; bestD = dd; tie = false; }
      else if (dd === bestD && v !== best) tie = true;
    }
    return best && !tie ? best : null;
  };

  var fix = function (text) {
    var t = String(text || "").toLowerCase();
    SYMBOLS.forEach(function (sy) { t = t.replace(sy[0], sy[1]); });
    return t.replace(/[a-z0-9']+/g, function (w) {
      var bare = w.replace(/'/g, "");
      if (SHORT.hasOwnProperty(w)) return SHORT[w];
      if (w.indexOf("'") !== -1) return w;                      /* "i'm", "don't": already a word */
      if (SHORT.hasOwnProperty(bare)) return SHORT[bare];
      /* "heyyy", "sooo", "pleeease": a letter held down */
      var squeezed = w.replace(/([a-z])\1{2,}/g, "$1$1");
      if (squeezed !== w && (KNOWN[squeezed] || KNOWN[squeezed.replace(/(.)\1/g, "$1")])) return KNOWN[squeezed] ? squeezed : squeezed.replace(/(.)\1/g, "$1");
      return /^[a-z]+$/.test(w) ? (closest(w) || w) : w;
    }).replace(/\s{2,}/g, " ").trim();
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
    if (words.length <= 2 && !words.some(function (w) { return TOPIC[w] || SMALL[w] || closest(w); })) return true;
    var odd = words.filter(function (w) { return !wordlike(w); }).length;
    return odd / words.length >= 0.5;
  };

  window.LumevinaTypos = { fix: fix, gibberish: gibberish, closest: closest,
    /* the word lists, so the server (knowledge/scripts/build-bundle.mjs) reads the same shorthand before its rules */
    lists: { vocab: VOCAB, common: COMMON, short: SHORT } };
})();

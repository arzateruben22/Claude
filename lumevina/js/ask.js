/* Lumevina — Ask Lumevina
 *
 * A chat that answers everyday questions instantly and hands anything
 * personal to Evelyn.
 *
 *   Answers on its own: prices (read from the menu on this page, so they
 *   never drift), booking, hours, parking, deposits, cancelling, payment,
 *   prep before a facial, aftercare, memberships, gift certificates, the
 *   shelf, and what a treatment is.
 *
 *   Never answers on its own: reactions, rashes, swelling, pregnancy,
 *   medications (Accutane, retinoids, antibiotics), skin conditions, or
 *   "what should I use on my skin". Those go to Evelyn with a drafted
 *   reply she checks, edits and sends from the dashboard (Client
 *   questions). Anything that sounds like an emergency gets told to call
 *   911 first, then goes to her too.
 *
 *   Members hear back within 24 hours; everyone else within 2 days.
 *
 * DEMO: questions live in localStorage ("lumevina_questions"), shared with
 * the dashboard when both run from the same place, and matching is by
 * keywords. LIVE: the server's ask function (server/README.md → Ask
 * Lumevina) answers with Claude using the same facts and the same
 * hand-off rules, and saves hand-offs to the questions table.
 */
(function () {
  "use strict";

  var KEY = "lumevina_questions";          /* every question sent to Evelyn */
  var CHAT_KEY = "lumevina_ask_chat";      /* this browser's conversation */
  var MEMBER_HOURS = 24;
  var GUEST_HOURS = 48;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── storage ── */
  var read = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var write = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  var questions = function () { return read(KEY, []); };
  var chat = function () { return read(CHAT_KEY, { log: [], seen: {} }); };

  /* ── who's asking ── */
  var me = function () {
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    if (!s) return null;
    var LM = window.LumevinaMembership;
    var r = LM ? LM.get(s.email) : null;
    var member = !!(LM && LM.isMember(r));
    return { name: s.name, email: s.email, member: member, plan: member ? LM.plan(r.plan).name : "" };
  };

  /* ── prices, straight from the menu on this page ── */
  var price = function (name, fallback) {
    var el = document.querySelector('[data-name="' + name + '"][data-price]');
    return "$" + (el ? el.getAttribute("data-price") : fallback);
  };
  var TOPICS = [
    { k: /brazilian|vajacial/, a: function () {
      return "A Brazilian is " + price("Brazilian Wax", 80) + ", or " + price("Wax Wednesday (Brazilian)", 70) + " on Wax Wednesdays. With a mini vajacial it’s " +
        price("Brazilian Wax x Mini Vajacial Package", 100) + ", and first-timers are " + price("First Time Brazilian", 80) + "."; } },
    { k: /dermaplan/, a: function () {
      return "Dermaplaning gently lifts dead skin and peach fuzz so skin looks smoother and your products sink in. It comes with the Custom Facial for " +
        price("Lumevina Custom Facial + Dermaplaning", 185) + "."; } },
    { k: /biorepeel|bio repeel|bio-repeel/, a: function () {
      return "BioRePeel is a no-downtime peel that brightens and smooths. One treatment is " + price("BioRePeel - 1 Facial Treatment", 270) +
        ", or three for " + price("BioRePeel - 3 Facial Treatments", 670) + "."; } },
    { k: /\bpeels?\b|chemical/, a: function () {
      return "Peels: Light " + price("Light Chemical Peel", 225) + ", Medium " + price("Medium Chemical Peel", 235) + ", and BioRePeel " +
        price("BioRePeel - 1 Facial Treatment", 270) + " (three for " + price("BioRePeel - 3 Facial Treatments", 670) + "). Evelyn picks the right strength at your visit."; } },
    { k: /back facial|backne|facial for (my )?back/, a: function () {
      return "Back facials are " + price("Back Facial - Half", 140) + " for half and " + price("Back Facial - Full", 185) + " for the full back."; } },
    { k: /couple/, a: function () { return "The Couples Facial is " + price("Couples Facial", 325) + " for two, side by side."; } },
    { k: /ageless/, a: function () {
      return "The Ageless Grace Facial is Evelyn’s signature lifting facial, " + price("Ageless Grace Facial", 245) + ". It’s included in the Ageless membership."; } },
    { k: /acne/, a: function () {
      return "The Monthly Acne Treatment is " + price("Monthly Acne Treatment", 195) + " and the Bi-Weekly Acne Treatment " + price("Bi-Weekly Acne Treatment", 120) +
        ". New acne clients start with a consultation and treatment, " + price("New Client Consultation + Treatment (Acne Program)", 225) +
        ". The Glow membership covers the Monthly Acne Treatment."; } },
    { k: /consult/, a: function () {
      return "A consultation is " + price("In-Person Consultation", 55) + " in person or " + price("Virtual Consultation", 55) +
        " by video. New clients can also start with a consultation and treatment for " + price("New Client Consultation + Treatment", 215) + "."; } },
    { k: /underarm|armpit/, a: function () { return "An underarm wax is " + price("Underarm Wax", 22) + "."; } },
    { k: /\bbrows?\b|eyebrow/, a: function () { return "Brow wax and tweeze is " + price("Brow Wax + Tweeze", 27) + "."; } },
    { k: /\blip\b/, a: function () { return "An upper lip wax is " + price("Upper Lip Wax", 9) + "."; } },
    { k: /\blegs?\b/, a: function () { return "Leg waxing is " + price("Half Leg Wax", 55) + " for half and " + price("Full Leg Wax", 110) + " for full legs."; } },
    { k: /\barms?\b/, a: function () { return "Arm waxing is " + price("Half Arm Wax", 32) + " for half and " + price("Full Arm Wax", 60) + " for full arms."; } },
    { k: /bikini/, a: function () { return "A bikini line wax is " + price("Bikini Line Wax", 32) + ", extended " + price("Extended Bikini Line", 55) + "."; } },
    { k: /face wax|facial wax|full face/, a: function () { return "A full face wax is " + price("Full Face Wax", 38) + ", or " + price("Full Face Wax + Cooling Mask", 55) + " with a cooling mask."; } }
  ];

  /* ── everyday answers, in Evelyn's voice ── */
  var KB = [
    { id: "hi", k: /^(hi|hey|hello|good (morning|afternoon|evening))[\s!.,]*(there)?[\s!.]*$/, a: function () {
      return "Hi! I can help with prices, booking, prep, aftercare and memberships, any time. Anything about your own skin goes straight to Evelyn."; } },
    { id: "thanks", k: /thank|appreciate/, a: function () { return "Anytime! Anything else I can help with?"; } },
    { id: "ack", k: /^(ok|okay|k|kk|cool|great|got it|sounds good|perfect|nice|alright|all right|yes|yeah|yep|no|nope|nah)[\s!.]*$/, a: function () {
      return "Anything else I can help with?"; } },
    { id: "human", k: /real person|\bhuman\b|talk to (someone|a person|evelyn|you)|speak (to|with)|(message|ask|contact|text) evelyn/, handoff: "request" },
    { id: "new", node: "p-facials", k: /first time|new client|first visit|never been|haven'?t been/, a: function () {
      return "Welcome! Start with the New Client Consultation + Treatment, " + price("New Client Consultation + Treatment", 215) +
        ": Evelyn looks at your skin and your routine, then gives you a fully custom facial. On the acne program it’s " +
        price("New Client Consultation + Treatment (Acne Program)", 225) + "."; }, acts: [["Book it", "book"]] },
    /* membership questions a member asks about their own plan, before "book" and "cancel" catch them */
    { id: "bank", node: "member", k: /\bbank|roll ?over|unused facial|busy month|miss(ed)? (a|my) month|facials? (left|waiting|saved)|how many facials/, a: function () {
      var LM = window.LumevinaMembership, s = window.LumevinaAccount && window.LumevinaAccount.current();
      var r = LM && s ? LM.get(s.email) : null;
      var rule = "Up to two facials bank at a time, and with two waiting we don\u2019t bill you until you book one, so you never pay for a facial you can\u2019t use. You can also gift a banked facial to a friend.";
      if (!LM || !LM.isMember(r)) return "Busy month? Your facial waits. " + rule;
      if (LM.onHold(r)) return "You have " + r.credits + " facials banked, so billing is on hold until you book one: you never pay for a facial you can\u2019t use. You can also gift a banked facial to a friend.";
      return "You have " + r.credits + (r.credits === 1 ? " facial" : " facials") + " banked. " + rule; },
      acts: [["Book my facial", "book"]] },
    { id: "mpause", node: "member", k: /\bpause|freeze my|cancel (my )?(membership|plan)|(stop|end) my (membership|plan)/, a: function () {
      return "Pause one month a year at no charge, from My Lumevina. After the 3-month minimum, you can cancel online any time there too, and any banked facials stay yours for 60 days."; },
      acts: [["Open My Lumevina", "account"]] },
    { id: "cancel", node: "cancel", k: /cancel|reschedul|move my|change my (appointment|booking|time)|running late|\blate\b|no.?show/, a: function () {
      return "Cancel or reschedule at least 48 hours ahead with the link in your confirmation email, and your deposit moves with you (same month). Same-day changes keep the deposit and add a $43 fee. Saturdays can’t be moved. There’s a 10-minute grace period if you’re running late."; },
      acts: [["Move an appointment", "move"], ["All policies", "#policies"]] },
    { id: "book", node: "book", k: /\bbook|appointment|availab|opening|\bslots?\b|schedule (a|an|my)/, a: function () {
      return "You can book any time online: pick your treatment and time, and a deposit holds it. Evelyn works Tuesday to Saturday, 8 AM to 6 PM."; },
      acts: [["Book now", "book"]] },
    { id: "hours", k: /hours|what time|when (are|do) you|open (on|today|tomorrow)|closed|sunday|monday|weekend/, a: function () {
      return "Tuesday to Saturday, 8 AM to 6 PM. Closed Sundays and Mondays, except the extra Mondays Evelyn opens every other week, members first. Need a time outside that? Ask about the after-hours add-on."; },
      acts: [["Book", "book"]] },
    { id: "where", k: /where|address|locat|park|direction|arriv|get there/, a: function () {
      return "Lumevina is in Woodland Hills. The exact address comes in your confirmation email. There’s a free parking lot; when you arrive, wait in your car and send a text before coming up."; } },
    { id: "refer", k: /\brefer|referral|invite a friend|friend'?s code|code from (a|my) friend|share my code/, a: function () {
      return "Share your code from Glow Rewards: your friend gets $15 off their first visit, and you get 150 points ($15) once it’s done. Got a friend’s code? Enter it when you book your first visit."; },
      acts: [["Book", "book"]] },
    { id: "gift", node: "gift", k: /gift|certificate|present for/, a: function () {
      return "Gift certificates never expire and work for any treatment. Send one for a specific facial, or a " + price("Gift Card · Any treatment ($110 value)", 110) + " card for anything."; },
      acts: [["Send a gift", "#gift"]] },
    { id: "deposit", node: "cancel", k: /deposit|refund/, a: function () {
      return "Every booking takes a non-refundable deposit that goes toward your total. With 48 hours’ notice it moves to a new date in the same month. Services themselves are non-refundable, but if anything comes up after your visit, reach out within 24 hours."; } },
    { id: "pay", k: /\bpay\b|payment|cash|credit card|\bcard\b|venmo|zelle|apple pay/, a: function () {
      return "Cash is preferred at your visit; cards are accepted with a small fee. The deposit is paid online when you book."; } },
    { id: "prices", node: "prices", k: /price|cost|how much|menu|rates?\b|\$/, a: function () {
      return "The Lumevina Custom Facial is " + price("Lumevina Custom Facial", 195) + ", with dermaplaning " + price("Lumevina Custom Facial + Dermaplaning", 185) +
        ", the Ageless Grace " + price("Ageless Grace Facial", 245) + " and the Monthly Acne Treatment " + price("Monthly Acne Treatment", 195) +
        ". New clients start at " + price("New Client Consultation + Treatment", 215) + ". Waxing starts at " + price("Upper Lip Wax", 9) + "; a Brazilian is " + price("Brazilian Wax", 80) + "."; },
      acts: [["See the menu", "#services"], ["Book", "book"]] },
    { id: "before", node: "before", k: /before (my|the|a) (facial|appointment|visit|treatment)|prep|prepare|stop (using|taking)|botox|filler|shave|shaving|makeup (to|before)/, a: function () {
      return "Before your facial: stop retinol or prescription retinoids 5 to 7 days ahead, pause exfoliating acids 2 to 3 days ahead, and don’t wax or shave your face for 2 days. After Botox or fillers, wait 2 weeks (or book the facial the same day, before injections). Skip booking on the day of a big event."; },
      acts: [["All prep notes", "#policies"]] },
    { id: "after", node: "after", k: /after (my|the|a) (facial|appointment|visit|treatment)|aftercare|work ?out|exercise|gym|sweat|makeup after/, a: function () {
      return "After your facial: skip makeup for the rest of the day, avoid workouts and heavy sweating for 24 hours (a week after a body peel), and don’t wax or shave your face for 2 days. If anything feels off, message within 24 hours."; } },
    { id: "member", node: "member", k: /member|monthly plan|subscri|\bglow plan|join/, a: function () {
      return "Two plans. Glow, $159 a month: a Custom Facial, Custom + Dermaplaning or the Monthly Acne Treatment every month. Ageless, $209: everything in Glow plus the Ageless Grace Facial and a finishing add-on every other visit. Bank a facial you can’t use, pause once a year, save on the shelf, and ask Evelyn anything with a reply within 24 hours."; },
      acts: [["See memberships", "#membership"]] },
    { id: "shelf", k: /product|serum|cleanser|\bspf\b|sunscreen|moisturi|skincare|\bshop\b|glow routine/, a: function () {
      return "Evelyn’s shelf has the cleansers, serums and SPF she uses in the room, and the Glow Routine sends her picks every month from $75. For what’s right for your skin, she’ll want to choose it herself; ask her and she’ll reply."; },
      acts: [["Shop the shelf", "#shop"]] },
    { id: "lashes", k: /lash|nails?\b|manicure|pedicure|tint|lamination/, a: function () {
      return "Lumevina’s menu is facials, peels and waxing. For lashes, brows and nails, Evelyn is happy to point you to artists she trusts."; } }
  ];

  /* ── what goes to Evelyn ── */
  var URGENT = /(can'?t|cannot|hard to|trouble|struggling to) breathe|throat (is )?(closing|swelling|tight)|tongue.*swell|swell.*(lips?|tongue|throat)|(lips?|tongue|throat).*swell|anaphyla|faint|pass(ed|ing) out/;
  var KINDS = [
    { kind: "reaction", k: /react|rash|burn|swell|swollen|itch|hives|allerg|blister|bleed|infect|\bpus\b|ooz|scab|stinging|irritat|red(ness)? (won'?t|isn'?t|still)|peeling/ },
    { kind: "pregnancy", k: /pregnan|expecting|breastfeed|nursing|trying to conceive/ },
    { kind: "medication", k: /accutane|isotretinoin|tretinoin|retin-?a|prescri|medicat|antibiotic|spironolactone|birth control|chemo|radiation|laser|surgery/ },
    { kind: "condition", k: /eczema|psoriasis|rosacea|dermatitis|lupus|cold sore|herpes|melasma|mole|lump|cyst|fungal|perioral/ },
    { kind: "skin", k: {
      test: function (t) {
        if (/\bmy (skin|face|acne|breakouts?|pores|spots|scars?|pigment|dark spots|wrinkles|texture|cheeks|chin|forehead)\b|for my skin|purging|(breaking|broke|break) ?out after/.test(t)) return true;
        return /\bi (have|got|keep getting|am getting|'m getting)\b|is (it|this) normal|should i\b|what should i use|right for me|recommend/.test(t) &&
          /skin|face|acne|break ?out|breaking out|pimple|pore|spots?\b|scar|pigment|wrinkle|\bdry\b|oily|sensitive|redness|texture|serum|routine|product/.test(t);
      } } }
  ];
  /* a price or "what is" question, or a bare name like "brazilian?" */
  var ASKS_ABOUT = /how much|price|cost|\$|what('?s| is| are)|tell me about|do you (do|offer|have)|explain/;
  var DRAFTS = {
    reaction: "Hi {name}, thank you for telling me. Some redness for a day or two can be normal, but I want to see it. For now, pause any actives (retinol, acids, exfoliants) and use just a gentle cleanser and moisturizer; a cool compress can help. Could you send me a photo in daylight? If it spreads, gets worse, or you notice swelling around your eyes or lips, please see a doctor right away. — Evelyn",
    pregnancy: "Hi {name}, congratulations! Facials are still on the table. I switch to pregnancy-safe products and skip retinoids and some peels, and it’s always good to check with your doctor too. Let’s plan your next visit together and I’ll adjust everything for you. — Evelyn",
    medication: "Hi {name}, thank you for letting me know. Some medications change what I can safely do: after Accutane I usually wait 6 to 12 months or ask for your doctor’s OK, and prescription retinoids pause 5 to 7 days before a facial. Tell me what you’re taking and since when, and I’ll tell you exactly what we can do. — Evelyn",
    condition: "Hi {name}, thanks for asking. I’d love to help, and I want to see your skin before I recommend anything. Could you send a photo in natural light and tell me what you’re using now? If you’re seeing a dermatologist for it, let me know that too. — Evelyn",
    skin: "Hi {name}, great question. I’d love to see your skin before I recommend anything. Could you send me a photo in natural light and tell me what you use morning and night? I’ll tell you what I’d change. — Evelyn",
    urgent: "Hi {name}, I saw your message. I hope you were able to get care right away. Please tell me how you’re doing when you can, and I’ll call you. — Evelyn",
    request: "Hi {name}, thanks for reaching out! — Evelyn",
    other: "Hi {name}, thanks for your question! — Evelyn"
  };

  /* ── step-by-step menus: prices → facials → one facial → book it ── */
  var findService = function (name) {
    var els = document.querySelectorAll('[data-name="' + name + '"][data-price]'), best = null, desc = "";
    for (var i = 0; i < els.length; i++) {
      var card = els[i].closest(".product-card, .wax-row, li, article");
      var d = card && card.querySelector(".product-desc, .wax-desc");
      if (!best) best = els[i];
      if (d && d.textContent.trim()) { best = els[i]; desc = d.textContent.trim(); break; }
    }
    return best ? { id: best.getAttribute("data-id"), price: best.getAttribute("data-price"), desc: desc } : null;
  };
  var SHORT = { "Lumevina Custom Facial": "Custom Facial", "Lumevina Custom Facial + Dermaplaning": "Custom + Dermaplaning",
    "New Client Consultation + Treatment": "New client facial", "New Client Consultation + Treatment (Acne Program)": "New acne client",
    "BioRePeel - 1 Facial Treatment": "BioRePeel", "BioRePeel - 3 Facial Treatments": "BioRePeel · 3 treatments",
    "Back Facial - Half": "Half back", "Back Facial - Full": "Full back", "Wax Wednesday (Brazilian)": "Wax Wednesday Brazilian",
    "Brazilian Wax x Mini Vajacial Package": "Brazilian + mini vajacial", "Full Face Wax + Cooling Mask": "Full face + cooling mask",
    "In-Person Consultation": "In person", "Virtual Consultation": "Virtual" };
  var short = function (n) { return SHORT[n] || n.replace(/ Wax$/, ""); };
  var GROUPS = {
    "p-facials": { label: "Facials", ask: "Which facial?", items: ["Lumevina Custom Facial", "Lumevina Custom Facial + Dermaplaning", "Ageless Grace Facial",
      "New Client Consultation + Treatment", "Couples Facial"] },
    "p-peels": { label: "Peels", ask: "Which peel?", items: ["Light Chemical Peel", "Medium Chemical Peel", "BioRePeel - 1 Facial Treatment", "BioRePeel - 3 Facial Treatments"] },
    "p-acne": { label: "Acne program", ask: "Where are you in the acne program?", items: ["New Client Consultation + Treatment (Acne Program)",
      "Monthly Acne Treatment", "Bi-Weekly Acne Treatment"] },
    "p-back": { label: "Back facials", ask: "Half or full back?", items: ["Back Facial - Half", "Back Facial - Full"] },
    "p-wax-face": { label: "Face", ask: "Which area of the face?", items: ["Upper Lip Wax", "Brow Wax + Tweeze", "Nose Wax", "Nostril Wax", "Sideburn Wax",
      "Hairline Wax", "Full Face Wax", "Full Face Wax + Cooling Mask"] },
    "p-wax-body": { label: "Body", ask: "Which area?", items: ["Underarm Wax", "Half Arm Wax", "Full Arm Wax", "Half Leg Wax", "Full Leg Wax",
      "Half Back Wax", "Full Back Wax", "Stomach Strip Wax", "Full Stomach Wax", "Full Butt Wax"] },
    "p-wax-bikini": { label: "Bikini & Brazilian", ask: "Which one?", items: ["Bikini Line Wax", "Extended Bikini Line", "Brazilian Wax", "First Time Brazilian",
      "Wax Wednesday (Brazilian)", "Brazilian Wax x Mini Vajacial Package", "Inner Thigh Add-On"] },
    "p-consult": { label: "Consultations", ask: "In person or by video?", items: ["In-Person Consultation", "Virtual Consultation"] }
  };
  var groupOf = function (name) { for (var g in GROUPS) if (GROUPS[g].items.indexOf(name) !== -1) return g; return null; };
  var serviceAnswer = function (name) {
    var sv = findService(name);
    if (!sv) return { text: "I couldn’t find that one on the menu. Want me to ask Evelyn?", acts: [["Ask Evelyn", "skin"]] };
    var LM = window.LumevinaMembership, glow = LM && LM.plan("glow"), covered = glow && glow.covers.indexOf(sv.id) !== -1;
    var text = short(name) + " · $" + sv.price + "." + (sv.desc ? " " + sv.desc : "") +
      (covered ? " Or $" + glow.price + " a month with the Glow membership, a facial every month." : "");
    var g = groupOf(name);
    return { text: text, acts: [["Book this", "book:" + sv.id]].concat(g ? [["Other " + GROUPS[g].label.toLowerCase(), "n:" + g]] : [], [["All prices", "n:prices"]]) };
  };
  var info = function (text, acts) { return { say: text, opts: acts || [] }; };
  var NODES = {
    prices: info("Prices for which?", [["Facials", "n:p-facials"], ["Peels", "n:p-peels"], ["Acne program", "n:p-acne"], ["Back facials", "n:p-back"],
      ["Waxing", "n:p-wax"], ["Consultations", "n:p-consult"], ["Memberships", "n:member"], ["Gift certificates", "n:gift"]]),
    "p-wax": info("Which area?", [["Face", "n:p-wax-face"], ["Body", "n:p-wax-body"], ["Bikini & Brazilian", "n:p-wax-bikini"]]),
    book: info("What would you like to book? Pick one and I’ll open the times.", [["Facials", "n:p-facials"], ["Peels", "n:p-peels"], ["Acne program", "n:p-acne"],
      ["Back facials", "n:p-back"], ["Waxing", "n:p-wax"], ["Consultations", "n:p-consult"], ["Just show me times", "book"]]),
    cancel: info("What do you need?", [["Move my appointment", "n:c-move"], ["Cancel", "n:c-cancel"], ["A same-day change", "n:c-same"],
      ["Running late", "n:c-late"], ["A Saturday booking", "n:c-sat"], ["My deposit", "n:c-dep"]]),
    "c-move": info("Move it at least 48 hours ahead with the link in your confirmation email, and your deposit moves with you to a new date in the same month.", [["Move an appointment", "move"], ["Something else", "n:cancel"]]),
    "c-cancel": info("Cancel at least 48 hours ahead with the link in your confirmation email. The deposit can move to a new date in the same month; services themselves are non-refundable.", [["Move instead", "move"], ["Something else", "n:cancel"]]),
    "c-same": info("A same-day change counts as a late cancel: the deposit is kept, a $43 fee goes to the card on file, and rebooking takes a new deposit.", [["Something else", "n:cancel"]]),
    "c-late": info("There’s a 10-minute grace period. After that the appointment may be cancelled and the deposit lost, unless there’s still time to fit you in. Send a text as soon as you know.", [["Something else", "n:cancel"]]),
    "c-sat": info("Saturdays are in high demand, so they can’t be moved or cancelled. Moving one takes a new deposit, and cancelling forfeits the deposit plus a fee. Only book a Saturday if you’re sure.", [["Something else", "n:cancel"]]),
    "c-dep": info("Every booking takes a non-refundable deposit that goes toward your total. With 48 hours’ notice it moves to a new date in the same month.", [["Something else", "n:cancel"]]),
    before: info("Getting ready for your facial. Which part?", [["Retinol and acids", "n:b-ret"], ["Botox or fillers", "n:b-botox"], ["Waxing or shaving", "n:b-wax"],
      ["Permanent makeup", "n:b-pmu"], ["Accutane, laser or surgery", "n:b-med"], ["A big event", "n:b-event"], ["Sunburn or a cold sore", "n:b-sun"]]),
    "b-ret": info("Stop retinol or prescription retinoids 5 to 7 days before, and pause exfoliants (salicylic, benzoyl peroxide, glycolic and other acids) 2 to 3 days before.", [["Something else", "n:before"]]),
    "b-botox": info("Wait 2 weeks after Botox or fillers, or book your facial the same day, before your injections.", [["Something else", "n:before"]]),
    "b-wax": info("Don’t wax or shave your face for 2 days before your facial, or for 2 days after.", [["Something else", "n:before"]]),
    "b-pmu": info("After permanent makeup, wait 2 weeks before a facial. A facial is fine up to 1 week before your PMU appointment.", [["Something else", "n:before"]]),
    "b-med": info("After Accutane, recent laser, cosmetic surgery, radiation or chemotherapy, wait 6 to 12 months or bring your doctor’s clearance. Evelyn can look at your situation herself.", [["Ask Evelyn about mine", "skin"], ["Something else", "n:before"]]),
    "b-event": info("Don’t book your facial the same day as a big event: makeup isn’t recommended right after. A few days before is ideal.", [["Book", "n:book"], ["Something else", "n:before"]]),
    "b-sun": info("Sunburn, windburn, an open wound or an active cold sore means your skin needs to heal first. Let Evelyn know as soon as possible so you can move your appointment.", [["Move an appointment", "move"], ["Ask Evelyn", "skin"]]),
    after: info("After your facial. Which part?", [["Makeup", "n:a-makeup"], ["Working out", "n:a-work"], ["Waxing or shaving", "n:a-wax"], ["Something feels off", "skin"]]),
    "a-makeup": info("Skip makeup for the rest of the day so your skin can take in everything from the treatment.", [["Something else", "n:after"]]),
    "a-work": info("Give it 24 hours: no workouts or heavy sweating. After a body peel, give it a week.", [["Something else", "n:after"]]),
    "a-wax": info("No waxing or shaving your face for 2 days after your facial.", [["Something else", "n:after"]]),
    member: info("Two plans. What would you like to know?", [["Glow · $159", "n:m-glow"], ["Ageless · $209", "n:m-ageless"], ["Banking a facial", "n:m-bank"],
      ["Pausing or cancelling", "n:m-pause"], ["Ask Evelyn any time", "n:m-ask"], ["Join", "#membership"]]),
    "m-glow": info("Glow, $159 a month: one facial every month (the Custom Facial, Custom + Dermaplaning, or the Monthly Acne Treatment), 10% off the shelf, 15% off add-ons, a home routine from Evelyn, and first word on flash openings.", [["Join", "#membership"], ["Compare Ageless", "n:m-ageless"]]),
    "m-ageless": info("Ageless, $209 a month: everything in Glow, plus the Ageless Grace Facial any month, a finishing add-on every other visit, and 15% off the shelf.", [["Join", "#membership"], ["Compare Glow", "n:m-glow"]]),
    "m-bank": info("Busy month? Your facial waits. Up to two bank at a time, and with two waiting we don’t bill you until you book one, so you never pay for a facial you can’t use. You can also send a banked facial to a friend as a gift.", [["Something else", "n:member"]]),
    "m-pause": info("Pause one month a year at no charge. After the 3-month minimum, cancel online any time from My Lumevina.", [["Something else", "n:member"]]),
    "m-ask": info("Members can ask Evelyn anything, any time. Everyday questions are answered right here, and anything about your skin gets her own reply within 24 hours.", [["Join", "#membership"], ["Something else", "n:member"]]),
    gift: info("Gift certificates never expire. Which kind?", [["A specific treatment", "n:g-one"], ["Any treatment · $110", "n:g-any"], ["Using one", "n:g-use"]]),
    "g-one": info("Pick the treatment and send it: the certificate covers that facial or service in full.", [["Send a gift", "#gift"], ["Something else", "n:gift"]]),
    "g-any": info("A $110 certificate goes toward any treatment, and never expires.", [["Send a gift", "#gift"], ["Something else", "n:gift"]]),
    "g-use": info("Enter the code in My Lumevina or at checkout, and it applies to any treatment.", [["Book", "n:book"], ["Something else", "n:gift"]])
  };
  for (var gid in GROUPS) (function (gid) {
    NODES[gid] = { say: GROUPS[gid].ask, opts: function () {
      return GROUPS[gid].items.map(function (n) { var sv = findService(n); return [short(n) + (sv ? " · $" + sv.price : ""), "s:" + n]; });
    } };
  })(gid);
  var node = function (id) {
    var n = NODES[id];
    if (!n) return null;
    return { text: typeof n.say === "function" ? n.say() : n.say, acts: typeof n.opts === "function" ? n.opts() : n.opts };
  };

  var TY = window.LumevinaTypos;
  var classify = function (text) {
    var raw = text.toLowerCase();
    /* typos and texting shorthand read as the word they meant ("facail", "cancle", "appt") */
    var t = TY ? TY.fix(text) : raw;
    /* safety first, on what they typed and on what they meant */
    if (URGENT.test(raw) || URGENT.test(t)) return { handoff: "urgent" };
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].k.test(raw) || KINDS[i].k.test(t)) return { handoff: KINDS[i].kind };
    var topical = ASKS_ABOUT.test(t) || t.split(/\s+/).length <= 3;
    if (topical) for (var j = 0; j < TOPICS.length; j++) if (TOPICS[j].k.test(t)) return { answer: TOPICS[j].a(), acts: [["Book", "book"]] };
    for (var n = 0; n < KB.length; n++) {
      if (!KB[n].k.test(t)) continue;
      if (KB[n].handoff) return { handoff: KB[n].handoff };
      return { answer: KB[n].a(), acts: KB[n].acts || [], node: KB[n].node };
    }
    for (var m = 0; m < TOPICS.length; m++) if (TOPICS[m].k.test(t)) return { answer: TOPICS[m].a(), acts: [["Book", "book"]] };
    /* keyboard mashing or a lone unknown word: ask again instead of bothering Evelyn */
    if (TY && TY.gibberish(text)) return { unclear: true };
    return { handoff: "other", unsure: true };
  };

  /* ── times ── */
  var dueFor = function (member) { return new Date(Date.now() + (member ? MEMBER_HOURS : GUEST_HOURS) * 36e5).toISOString(); };
  var when = function (iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "long" }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };
  var promise = function (member) {
    return member ? "As a member, you’ll hear from Evelyn within 24 hours." : "Evelyn replies within 2 days. Members hear back within 24 hours.";
  };

  /* ══════════════════ UI ══════════════════ */
  var esc = function (t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; };
  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M9 12h.01M12 12h.01M15 12h.01"/></svg>';

  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "ask-fab";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = ICON + '<span class="ask-fab-t">Ask Lumevina</span><span class="ask-dot" hidden></span>';

  var panel = document.createElement("section");
  panel.className = "ask-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ask Lumevina");
  panel.hidden = true;
  panel.innerHTML =
    '<header class="ask-head"><div><p class="ask-title">Ask Lumevina</p>' +
    '<p class="ask-sub">Instant answers, any time. Anything about your skin goes to Evelyn.</p></div>' +
    '<button type="button" class="ask-x" aria-label="Close">&times;</button></header>' +
    '<div class="ask-log" aria-live="polite"></div>' +
    '<div class="ask-chips-wrap"><button type="button" class="ask-nav prev" aria-label="Scroll topics left" hidden>&lsaquo;</button>' +
    '<div class="ask-chips" role="group" aria-label="Common questions"></div>' +
    '<button type="button" class="ask-nav next" aria-label="Scroll topics right" hidden>&rsaquo;</button></div>' +
    '<form class="ask-form"><label class="sr-only" for="ask-in">Your question</label>' +
    '<input id="ask-in" type="text" autocomplete="off" placeholder="Ask about prices, prep, your skin…" maxlength="600">' +
    '<button type="submit" class="ask-send" aria-label="Send">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>' +
    '<p class="ask-fine">Not medical advice. In an emergency, call 911.</p>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var logEl = panel.querySelector(".ask-log");
  var chipsEl = panel.querySelector(".ask-chips");
  var form = panel.querySelector(".ask-form");
  var input = panel.querySelector("#ask-in");
  var CHIPS = [["Prices", "n:prices"], ["Book", "n:book"], ["Before my facial", "n:before"], ["After my facial", "n:after"],
    ["Cancel or reschedule", "n:cancel"], ["Memberships", "n:member"], ["Gift certificates", "n:gift"], ["Parking", "t:Where do I park?"],
    ["A question about my skin", "skin"]];

  var state = chat();
  var save = function () { write(CHAT_KEY, state); };
  var push = function (m) { state.log.push(m); if (state.log.length > 80) state.log = state.log.slice(-80); save(); };

  /* answers Evelyn has sent for this browser's questions */
  var replies = function () {
    var mine = {};
    state.log.forEach(function (m) { if (m.qid) mine[m.qid] = true; });
    return questions().filter(function (q) { return mine[q.id] && q.status === "answered" && q.reply; });
  };
  var unread = function () { return replies().filter(function (q) { return !state.seen[q.id]; }).length; };

  var bubble = function (who, html, extra) {
    var d = document.createElement("div");
    d.className = "ask-msg " + who + (extra ? " " + extra : "");
    d.innerHTML = html;
    logEl.appendChild(d);
    return d;
  };
  /* menu steps (n:, s:, t:, skin) only on the newest answer; actions (book, move, #…) stay */
  var isStep = function (t) { return /^(n:|s:|t:|skin$)/.test(t); };
  var actsHtml = function (acts, last) {
    acts = (acts || []).filter(function (a) { return last || !isStep(a[1]); });
    if (!acts.length) return "";
    return '<div class="ask-acts">' + acts.map(function (a) {
      var primary = /^book/.test(a[1]) && a[0] !== "Just show me times";
      return '<button type="button" class="ask-act' + (isStep(a[1]) ? " is-step" : "") + (primary ? " is-primary" : "") +
        '" data-act="' + esc(a[1]) + '">' + esc(a[0]) + '</button>';
    }).join("") + '</div>';
  };

  var render = function () {
    logEl.innerHTML = "";
    var who = me();
    bubble("bot", esc("Hi" + (who ? " " + who.name.split(" ")[0] : "") + "! Ask me about prices, booking, prep, aftercare or memberships. Anything about your own skin, I’ll pass to Evelyn."));
    var answered = {};
    replies().forEach(function (q) { answered[q.id] = q; });
    var lastBot = -1;
    state.log.forEach(function (m, i) { if (m.who === "bot") lastBot = i; });
    if (lastBot >= 0 && state.log.slice(lastBot + 1).some(function (m) { return m.who === "you"; })) lastBot = -1;
    state.log.forEach(function (m, i) {
      if (m.who === "you") bubble("you", esc(m.text));
      else if (m.who === "bot") bubble("bot", esc(m.text) + actsHtml(m.acts, i === lastBot && !state.pending), m.warn ? "warn" : "");
      else if (m.who === "sent") {
        bubble("bot", '<span class="ask-tag">Sent to Evelyn</span>' + esc(m.text));
        var q = answered[m.qid];
        if (q) bubble("evelyn", '<span class="ask-tag">Evelyn replied</span>' + esc(q.reply));
      }
    });
    var pending = state.pending;
    if (pending) {
      var box = bubble("bot", esc(pending.lead) + '<span class="ask-promise">' + esc(promise(pending.member)) + "</span>");
      var who2 = me();
      var f = document.createElement("div");
      f.className = "ask-handoff";
      f.innerHTML = (who2 ? "" :
        '<label class="sr-only" for="ask-name">Your name</label><input id="ask-name" type="text" placeholder="Your name" autocomplete="name">' +
        '<label class="sr-only" for="ask-email">Your email</label><input id="ask-email" type="email" placeholder="Email for Evelyn’s reply" autocomplete="email">') +
        '<div class="ask-acts"><button type="button" class="ask-act is-primary" data-act="send">Send to Evelyn</button>' +
        '<button type="button" class="ask-act" data-act="nevermind">Not now</button></div><p class="ask-err" role="alert"></p>';
      box.appendChild(f);
    }
    chipsEl.parentNode.hidden = state.log.length > 0 && !!pending;
    chipsEl.innerHTML = CHIPS.map(function (c) { return '<button type="button" class="ask-chip" data-go="' + esc(c[1]) + '">' + esc(c[0]) + "</button>"; }).join("");
    chipsEl.scrollLeft = 0;
    setTimeout(paintNav, 0);
    replies().forEach(function (q) { state.seen[q.id] = true; });
    save();
    paintFab();
    logEl.scrollTop = logEl.scrollHeight;
  };

  var paintFab = function () {
    var n = panel.hidden ? unread() : 0;
    fab.querySelector(".ask-dot").hidden = !n;
    fab.querySelector(".ask-fab-t").textContent = n ? "Evelyn replied" : "Ask Lumevina";
  };

  var UNCLEAR_ACTS = [["Prices", "n:prices"], ["Book", "n:book"], ["Cancel or move", "n:cancel"], ["Memberships", "n:member"]];
  var LEADS = {
    urgent: "That could be serious. If you’re having trouble breathing, or your lips, tongue or throat are swelling, call 911 now. I’m also sending this to Evelyn.",
    reaction: "I’m sorry you’re dealing with that. Evelyn should answer this one herself, not me.",
    pregnancy: "Good question to ask first. Evelyn will answer this one herself, since it depends on you.",
    medication: "Thanks for mentioning it. What’s safe depends on what you’re taking, so Evelyn will answer this one herself.",
    condition: "Evelyn will want to answer this one herself, since it depends on your skin.",
    skin: "That depends on your skin, so Evelyn will answer this one herself.",
    request: "Of course. I’ll send your message to Evelyn.",
    other: "I’m not sure I’ve got that one right. Want me to send it to Evelyn?",
    again: "Still not catching it, sorry. Want me to send your message to Evelyn as it is?"
  };

  var ask = function (text) {
    text = String(text || "").trim();
    if (!text) return;
    push({ who: "you", text: text });
    var r = classify(text);
    if (r.unclear) {
      state.unclear = (state.unclear || 0) + 1;
      if (state.unclear === 1) {
        state.pending = null;
        push({ who: "bot", text: "I didn’t quite catch that. Could you say it another way, or pick a topic?", acts: UNCLEAR_ACTS });
        return render();
      }
      /* twice in a row: maybe it's real and just unusual, so offer Evelyn */
      r = { handoff: "other" };
    } else state.unclear = 0;
    if (r.answer && r.node && text.split(/\s+/).length <= 4) {
      /* a bare topic like "prices" or "cancel": walk them through it */
      var nd = node(r.node);
      state.pending = null;
      push({ who: "bot", text: nd.text, acts: nd.acts });
    } else if (r.answer) {
      state.pending = null;
      push({ who: "bot", text: r.answer, acts: (r.acts || []).concat(r.node ? [["More on this", "n:" + r.node]] : []) });
    } else {
      var who = me();
      state.pending = { text: text, kind: r.handoff, lead: (state.unclear >= 2 ? LEADS.again : LEADS[r.handoff]) || LEADS.other, member: !!(who && who.member) };
      if (state.unclear >= 2) state.unclear = 0;
      if (r.handoff === "urgent") push({ who: "bot", text: LEADS.urgent, warn: true });
      if (r.handoff === "urgent") state.pending.lead = "Send your message to Evelyn too?";
      save();
    }
    render();
  };

  var send = function () {
    var p = state.pending;
    if (!p) return;
    var who = me();
    var err = panel.querySelector(".ask-err");
    var name = who ? who.name : (panel.querySelector("#ask-name").value || "").trim();
    var email = who ? who.email : (panel.querySelector("#ask-email").value || "").trim();
    if (!who && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      err.textContent = "Add your name and email so Evelyn can reply.";
      return;
    }
    var member = !!(who && who.member);
    var q = {
      id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: new Date().toISOString(), name: name, email: email, member: member, plan: who ? who.plan : "",
      text: p.text, kind: p.kind, status: "waiting", dueAt: dueFor(member),
      draft: (DRAFTS[p.kind] || DRAFTS.other).replace("{name}", name.split(" ")[0])
    };
    var all = questions(); all.push(q); write(KEY, all);
    state.pending = null;
    push({ who: "sent", qid: q.id, text: "“" + p.text + "” · Evelyn will reply by " + when(q.dueAt) + ", here and by email." });
    render();
    document.dispatchEvent(new CustomEvent("lumevina:question-sent", { detail: q }));
  };

  var open = function (prefill) {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("ask-open");
    render();
    requestAnimationFrame(function () { panel.classList.add("show"); });
    if (prefill) ask(prefill);
    setTimeout(function () { input.focus({ preventScroll: true }); }, calm ? 0 : 120);
  };
  var close = function () {
    panel.classList.remove("show");
    fab.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("ask-open");
    setTimeout(function () { panel.hidden = true; paintFab(); }, calm ? 0 : 220);
    fab.focus({ preventScroll: true });
  };

  fab.addEventListener("click", function () { if (panel.hidden) open(); else close(); });
  panel.querySelector(".ask-x").addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); var t = input.value; input.value = ""; ask(t); });
  /* one step of a menu: show what they picked, then the next step */
  var go = function (label, target) {
    if (target === "skin") {
      input.value = "About my skin: ";
      input.focus();
      return;
    }
    if (target.indexOf("t:") === 0) return ask(target.slice(2));
    var out = target.indexOf("n:") === 0 ? node(target.slice(2)) : target.indexOf("s:") === 0 ? serviceAnswer(target.slice(2)) : null;
    if (!out) return;
    state.pending = null;
    push({ who: "you", text: label.replace(/ · \$\d+$/, "") });
    push({ who: "bot", text: out.text, acts: out.acts });
    render();
  };
  chipsEl.addEventListener("click", function (e) {
    var c = e.target.closest(".ask-chip");
    if (c) go(c.textContent, c.getAttribute("data-go"));
  });

  /* the topic row slides: arrows on either side, the mouse wheel, or a drag */
  var prevBtn = panel.querySelector(".ask-nav.prev"), nextBtn = panel.querySelector(".ask-nav.next");
  var paintNav = function () {
    var max = chipsEl.scrollWidth - chipsEl.clientWidth;
    prevBtn.hidden = chipsEl.scrollLeft <= 2;
    nextBtn.hidden = chipsEl.scrollLeft >= max - 2;
    chipsEl.classList.toggle("fade-l", !prevBtn.hidden);
    chipsEl.classList.toggle("fade-r", !nextBtn.hidden);
  };
  var slide = function (dir) { chipsEl.scrollBy({ left: dir * chipsEl.clientWidth * 0.7, behavior: calm ? "auto" : "smooth" }); };
  prevBtn.addEventListener("click", function () { slide(-1); });
  nextBtn.addEventListener("click", function () { slide(1); });
  chipsEl.addEventListener("scroll", paintNav, { passive: true });
  window.addEventListener("resize", paintNav);
  chipsEl.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && chipsEl.scrollWidth > chipsEl.clientWidth) { chipsEl.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  var drag = null;
  chipsEl.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") drag = { x: e.clientX, left: chipsEl.scrollLeft, moved: false }; });
  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    chipsEl.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", function () { setTimeout(function () { drag = null; }, 0); });
  chipsEl.addEventListener("click", function (e) { if (drag && drag.moved) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

  logEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (isStep(act)) return go(b.textContent, act);
    if (act.indexOf("book:") === 0) { close(); if (window.LumevinaBooking) window.LumevinaBooking.open(act.slice(5)); return; }
    if (act === "send") return send();
    if (act === "nevermind") { state.pending = null; push({ who: "bot", text: "No problem. Anything else?" }); return render(); }
    if (act === "book") { close(); if (window.LumevinaBooking) window.LumevinaBooking.open(); return; }
    if (act === "move") { close(); if (window.LumevinaBooking) window.LumevinaBooking.startReschedule(); return; }
    if (act === "account") { close(); if (window.LumevinaAccount) window.LumevinaAccount.open(); return; }
    if (act.charAt(0) === "#") {
      close();
      var t = document.querySelector(act);
      if (t) t.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    }
  });
  /* "About my skin: " counts as a skin question even if the rest is short */
  var baseClassify = classify;
  classify = function (text) {
    if (/^about my skin:/i.test(text)) {
      var r = baseClassify(text.replace(/^about my skin:\s*/i, ""));
      return r.handoff ? r : { handoff: "skin" };
    }
    return baseClassify(text);
  };

  document.addEventListener("lumevina:account-changed", function () { if (!panel.hidden) render(); else paintFab(); });
  window.addEventListener("storage", function (e) { if (e.key === KEY) { if (!panel.hidden) render(); else paintFab(); } });
  document.querySelectorAll("[data-open-ask]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); open(); });
  });
  paintFab();

  window.LumevinaAsk = { open: open, ask: function (t) { open(t); }, classify: classify, questions: questions };
})();

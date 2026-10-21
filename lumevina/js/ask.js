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
 *   Signed in, with a skin plan from Evelyn (js/skin-plans.js): "what do I
 *   use tonight?", "what should I avoid?", "what's next?" are answered from
 *   that plan, with Add to bag buttons for its products. Changing it, or
 *   anything the rules above catch, still goes to her. Live, the server sees
 *   the same plan, plus the client's pre-visit form, visits and the
 *   questions she has answered for them.
 *
 *   Looks things up: where a shop order is (this browser's orders in the
 *   demo; live, the server's look_up_order), and what's left on a gift
 *   certificate when a code is typed (js/giftcards.js, both modes). Products
 *   it names get Add to bag buttons (js/cart.js → LumevinaCart).
 *
 *   Photos: a question going to Evelyn can carry up to three, shrunk to
 *   JPEGs here. Demo: small copies go in the question in this browser.
 *   Live: the server stores them privately and only Evelyn sees them.
 *
 * DEMO: questions live in localStorage ("lumevina_questions"), shared with
 * the dashboard when both run from the same place, and matching is by
 * keywords. LIVE: the server's ask function (server/README.md → Ask
 * Lumevina) answers with Claude using the same facts and the same
 * hand-off rules, and saves hand-offs to the questions table. PREVIEW (the
 * single-file page on claude.ai): Claude answers on the viewer's own account
 * from the same bundle, streaming, with the same rules first (see preview()).
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
  var write = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; /* private mode, or full */ } };
  var questions = function () { return read(KEY, []); };
  var chat = function () { return read(CHAT_KEY, { log: [], seen: {} }); };

  /* ── who's asking, and the plan Evelyn wrote for them ── */
  var PL = window.LumevinaPlans;
  var myProfile = function () { return !!(window.LumevinaProfile && window.LumevinaProfile.has()); };
  var myPlan = function () {
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    var p = s && PL ? PL.get(s.email) : null;
    return p && !PL.empty(p) ? p : null;
  };
  var fromPlan = function (text) {
    var p = myPlan(), who = me();
    var a = p ? PL.answer(p, text, who ? who.name.split(" ")[0] : "") : null;
    if (!a) return null;
    var ids = PL.products && PL.part ? PL.products(p, PL.part(text)) : [];
    return { answer: a, acts: bagActs(ids).concat([["See my plan", "account"], ["Ask Evelyn", "skin"]]), plan: true };
  };

  /* ── Add to bag (js/cart.js), for products on the shelf right now ── */
  var onShelf = function (id) {
    var INV = window.LumevinaInventory, p = INV ? INV.get(id) : null;
    if (!p || p.hidden || p.draft) return null;
    var st = INV.status(p);
    return st === "in" || st === "low" ? p : null;
  };
  var bagActs = function (ids) {
    if (!window.LumevinaCart) return [];
    var ps = (ids || []).map(onShelf).filter(Boolean);
    var acts = ps.length <= 3 ? ps.map(function (p) { return ["Add " + p.name + " · $" + p.price, "add:" + p.id]; }) : [];
    if (ps.length > 1) acts.push(["Add all " + ps.length + " to my bag", "addall:" + ps.map(function (p) { return p.id; }).join(",")]);
    return acts;
  };
  var me = function () {
    var s = window.LumevinaAccount && window.LumevinaAccount.current();
    if (!s) return null;
    var LM = window.LumevinaMembership;
    var r = LM ? LM.get(s.email) : null;
    var member = !!(LM && LM.isMember(r));
    return { name: s.name, email: s.email, member: member, plan: member ? LM.plan(r.plan).name : "" };
  };

  /* ── prices, straight from her menu (js/services.js) ── */
  var SV = window.LUMEVINA_SERVICES || { get: function () { return null; }, all: [], menu: [] };
  var price = function (id, fallback) {
    var s = SV.get(id);
    return (s && s.from ? "from " : "") + "$" + (s ? s.price.toLocaleString("en-US") : fallback);
  };
  var TOPICS = [
    { k: /brazilian|vajacial/, a: function () {
      return "A Brazilian is " + price("brazilian-wax", 75) + ", or " + price("wax-wednesday", 65) + " on Wax Wednesdays. With a mini vajacial (extractions, ingrown hair removal and a cooling mask) it’s " +
        price("brazilian-wax-mini-vajacial", 95) + ". Each takes a $30 deposit when you book."; } },
    { k: /dermaplan/, a: function () {
      return "Dermaplaning comes as an option with New Clients Start Here (" + price("new-client-dermaplaning", 260) + "), the Custom Facial (" + price("custom-facial-dermaplaning", 230) +
        "), the Ageless Grace Facial (" + price("ageless-grace-dermaplaning", 280) + ") and both peels (" + price("refresh-peel-dermaplaning", 270) + ")."; } },
    { k: /procell|pro cell|micro.?channel|microneedl|micro needl|collagen induction/, a: function () {
      return "ProCell Microchanneling is " + price("procell-microchanneling", 350) + " a session: collagen induction with growth factors for acne scars, fine lines, pores and texture, with LED, post-care guidance and a recovery set. Four sessions are the minimum she recommends. " +
        "Right now the first 10 clients can get four for " + price("procell-package", 1100) + " (regularly $1,400), with payment plans; just ask."; } },
    { k: /biorepeel|bio repeel|bio-repeel/, a: function () {
      return "BioRePeel isn’t on Evelyn’s menu right now. Her peels are the Refresh Peel (" + price("refresh-peel", 230) + ", no downtime) and the Corrective Peel (" + price("corrective-peel", 230) + ", existing clients)."; } },
    { k: /\bpeels?\b|chemical/, a: function () {
      return "Two peels: the Refresh Peel, " + price("refresh-peel", 230) + ", gentle with little or no flaking and a great first peel; and the Corrective Peel, " + price("corrective-peel", 230) +
        ", a medium-depth peel for existing clients (peeling up to a week, prep first). Either one with dermaplaning is " + price("refresh-peel-dermaplaning", 270) + ". A series works best."; } },
    { k: /back facial|backne|facial for (my )?back/, a: function () {
      return "Back facials aren’t on Evelyn’s menu right now. If breakouts on your back are the worry, ask her and she’ll tell you what she’d do."; } },
    { k: /couple/, a: function () { return "Couples facials aren’t on the menu right now; every facial is one on one with Evelyn."; } },
    { k: /ageless/, a: function () {
      return "The Ageless Grace Facial is Evelyn’s lifting facial with oxygen therapy and a Tightening Protein Booster, " + price("ageless-grace-facial", 240) +
        " (75 min), or " + price("ageless-grace-dermaplaning", 280) + " with dermaplaning."; } },
    { k: /acne|bootcamp/, a: function () {
      return "Acne starts with the New Client Consultation + Treatment, " + price("new-client-consultation-acne", 220) + " (80 min, $50 deposit). Then it’s the Acne Bootcamp: the Monthly Acne Treatment " +
        price("monthly-acne-treatment", 200) + ", and the Bi-Weekly Acne Treatment " + price("biweekly-acne-treatment", 115) + " when Evelyn recommends it."; } },
    { k: /consult/, a: function () {
      return "A consultation is " + price("in-person-consultation", 50) + " in person, or " + price("virtual-consultation", 50) + " by video on Mondays (message Evelyn first). Both take a $49 deposit. " +
        "Want a facial too? New clients start with New Clients Start Here, " + price("new-client-consultation", 220) + "."; } },
    { k: /underarm|armpit/, a: function () { return "An underarm wax is " + price("underarm-wax", 20) + ", or " + price("brow-underarm-wax", 45) + " with a brow wax."; } },
    { k: /\bbrows?\b|eyebrow/, a: function () { return "Brow wax and tweeze is " + price("brow-wax-tweeze", 25) + ", or " + price("brow-underarm-wax", 45) + " with an underarm wax."; } },
    { k: /\blip\b/, a: function () { return "An upper lip wax is " + price("upper-lip-wax", 10) + "."; } },
    { k: /\blegs?\b/, a: function () { return "Leg waxing isn’t on Evelyn’s menu right now. Her body waxing covers arms, back, stomach and underarms."; } },
    { k: /\barms?\b/, a: function () { return "Arm waxing is " + price("half-arm-wax", 30) + " for half (your choice which half) and " + price("full-arm-wax", 60) + " for full arms."; } },
    { k: /bikini/, a: function () { return "A bikini line wax is " + price("bikini-line-wax", 40) + ", just outside the underwear line. For everything, a Brazilian is " + price("brazilian-wax", 75) + "."; } },
    { k: /face wax|facial wax|full face|sideburn|hairline/, a: function () { return "Full face waxing isn’t on the menu right now. For the face, Evelyn does brows (" + price("brow-wax-tweeze", 25) + "), upper lip (" + price("upper-lip-wax", 10) + ") and nostrils (" + price("nostril-wax", 10) + ")."; } }
  ];

  /* membership prices: today's (the founding rate while it lasts, js/membership.js) */
  var memPrice = function (id) {
    var LM = window.LumevinaMembership, p = LM && LM.plan(id);
    return "$" + (p ? LM.priceNow(id) : id === "glow" ? 185 : 235);
  };
  var foundingNote = function () {
    var LM = window.LumevinaMembership, n = LM ? LM.foundingLeft() : 0;
    return n > 0 ? " That’s the founding rate, locked while you stay, for the first " + LM.FOUNDING_CAP + " members (" + n + " left)." : "";
  };

  /* ── everyday answers, in Evelyn's voice ── */
  var KB = [
    { id: "hi", k: /^(hi+|hey+|hello+|helo|heyo|hiya|yo|sup|what'?s up|good (morning|afternoon|evening))[\s!.,]*(there|evelyn|lumevina)?[\s!.?]*$/, a: function () {
      return "Hi! I can help with prices, booking, prep, aftercare and memberships, any time. Anything about your own skin goes straight to Evelyn."; } },
    { id: "thanks", k: /thank|appreciate|\bthanks\b|you'?re the best|life ?saver/, a: function () { return "Anytime. Anything else I can help with?"; } },
    { id: "bye", k: /^(bye+|see you|see ya|talk (later|soon)|talk to you later|good ?night|have a good (one|day|night)|ttyl|later)[\s!.]*$/, a: function () {
      return "See you at the studio. Evelyn’s here whenever you need her."; } },
    { id: "ack", k: /^(ok|okay|cool|great|got it|sounds good|perfect|nice|alright|all right|yes|yeah|no|sure|fine|bet|word|awesome|amazing|love it|same|true)[\s!.]*$/, a: function () {
      return "Anything else I can help with?"; } },
    /* "wdym?" after an answer: say it again, shorter, rather than start over */
    { id: "clarify", k: /^(what do you mean|what does that mean|huh|what|wait what|i don'?t (get|understand|follow)( it| that)?|i'?m (confused|lost)|say that again|come again|explain( that)?|in english|simpler|can you (explain|clarify)|meaning)[\s!?.]*$/, a: function () {
      var last = null;
      for (var i = state.log.length - 1; i >= 0; i--) if (state.log[i].who === "bot" && state.log[i].text) { last = state.log[i].text; break; }
      if (!last) return "Ask me anything about prices, booking, prep, aftercare or products, and I’ll keep it simple.";
      var first = (/^[\s\S]*?[.!?](?=\s|$)/.exec(last) || [last])[0];
      return "Let me put that more simply: " + (first.length > 170 ? first.slice(0, 168).replace(/\s\S*$/, "") + "…" : first) + " Want the rest, or should I send it to Evelyn?"; },
      acts: [["Ask Evelyn", "skin"]] },
    { id: "human", k: /real person|\bhuman\b|talk to (someone|a person|evelyn|you)|speak (to|with)|(message|ask|contact|text) evelyn/, handoff: "request" },
    { id: "live", k: /in[- ]person|group class|workshop|glow party|\bpart(y|ies)\b|girls'? night|bachelorette|pro night|skin school live|live class/, a: function () {
      return "Skin School Live is Evelyn’s in-person class: two hours at the studio with six people, a skin check under the lamp, your routine built on the spot and a kit to take home, for $129 ($109 for members). Want it just for your friends? A Glow Party is $690 for up to six, at the studio or at your place. Estheticians can join Pro Night for $249."; },
      acts: [["See class dates", "go:school.html#live"], ["Plan a Glow Party", "go:school.html#live"]] },
    { id: "new", node: "p-facials", k: /first time|new client|first visit|never been|haven'?t been/, a: function () {
      return "Welcome! New clients start with New Clients Start Here: a consultation, a look at your current routine, and a fully custom facial, " +
        price("new-client-consultation", 220) + " (or " + price("new-client-dermaplaning", 260) + " with dermaplaning). Every facial includes a double cleanse, enzyme exfoliation, extractions, a targeted mask, massage, LED and cryo globes. " +
        "If acne is your main concern, start with the Acne Bootcamp’s consultation and treatment instead, " + price("new-client-consultation-acne", 220) + "."; },
      acts: [["Book my first facial", "book:new-client-consultation"], ["Acne first visit", "book:new-client-consultation-acne"]] },
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
      var H = window.LumevinaHours;
      var gg = window.LumevinaBooking && window.LumevinaBooking.external;
      return (gg ? "For now, Evelyn takes every booking through GlossGenius (booking right here on the website is coming soon): pick your treatment and a time there, and some treatments take a small deposit to hold it."
        : "You can book any time online: pick your treatment and a time, and some treatments take a small deposit to hold it.") + " Evelyn’s hours: " +
        (H ? H.prose() + "." : "Tuesday to Saturday."); },
      acts: [["Book now", "book"]] },
    { id: "hours", k: /hours|what time|when (are|do) you|open (on|today|tomorrow)|closed|sunday|monday|weekend/, a: function () {
      var H = window.LumevinaHours;
      return (H ? H.prose() + ". " + H.closedLabel() + "." : "Tuesday to Saturday, 8 AM to 6 PM. Closed Sundays and Mondays.") +
        (window.LumevinaBooking && window.LumevinaBooking.external ? " Book through GlossGenius for now; booking right here is coming soon." : " The calendar on this site shows every opening up to a month ahead.") +
        " Outside those hours, or on a closed day, she takes after-hours visits for an extra $50; ask her first."; },
      acts: [["Book", "book"]] },
    { id: "where", k: /where|address|locat|park|direction|arriv|get there/, a: function () {
      return "Lumevina is in Woodland Hills. The exact address comes in your confirmation email. There’s a free parking lot; when you arrive, wait in your car and send a text before coming up."; } },
    { id: "refer", k: /\brefer|referral|invite a friend|friend'?s code|code from (a|my) friend|share my code/, a: function () {
      return "Share your code from Glow Rewards: your friend gets $15 off their first visit, and you get 150 points ($15) once it’s done. Got a friend’s code? Enter it when you book your first visit."; },
      acts: [["Book", "book"]] },
    { id: "school", k: /\bcourses?\b|\bclass(es)?\b|skin school|teach me|\blessons?\b|tutorial|masterclass/, a: function () {
      return "Evelyn’s Skin School is her online course: 33 short lessons in three levels, from your first routine to acne, dark spots and aging. The first two lessons are free. The full course is $149, with a starter kit $229, or $449 with a 1-on-1 video call with Evelyn. Members get Skin Basics free and 25% off. Prefer in person? Skin School Live is a two-hour class at the studio for $129."; },
      acts: [["Take the free lesson", "go:school.html#learn"], ["See the courses", "go:school.html#tiers"], ["Class dates", "go:school.html#live"]] },
    { id: "gift", node: "gift", k: /gift|certificate|present for/, a: function () {
      return "Gift certificates come in $50, $100, $200, $400 or any amount you choose, work toward any treatment and never expire. At the visit Evelyn takes it off the bill: anything left stays on it, and if the visit costs more you pay only the difference."; },
      acts: [["Send a gift", "#gift"]] },
    { id: "deposit", node: "cancel", k: /deposit|refund/, a: function () {
      return "Some treatments take a non-refundable deposit when you book: $50 for the acne consultation, $49 for a consultation, $20 or $30 for waxing and acne treatments; facials and peels have none. It goes toward your total, and with 48 hours’ notice it moves to a new date in the same month. If anything comes up after your visit, reach out within 24 hours."; } },
    { id: "pay", k: /\bpay\b|payment|cash|credit card|\bcard\b|venmo|zelle|apple pay/, a: function () {
      return "Cash is preferred at your visit; cards are accepted with a small fee. The deposit is paid online when you book."; } },
    { id: "prices", node: "prices", k: /price|cost|how much|menu|rates?\b|\$/, a: function () {
      return "New clients start with New Clients Start Here, " + price("new-client-consultation", 220) + ". The Lumevina Custom Facial is " + price("lumevina-custom-facial", 200) +
        ", the Ageless Grace " + price("ageless-grace-facial", 240) + ", ProCell Microchanneling " + price("procell-microchanneling", 350) + ", and either peel " + price("refresh-peel", 230) +
        ". Acne starts at " + price("new-client-consultation-acne", 220) + ". Waxing starts at " + price("upper-lip-wax", 10) + "; a Brazilian is " + price("brazilian-wax", 75) + "."; },
      acts: [["See the menu", "#services"], ["Book", "book"]] },
    { id: "before", node: "before", k: /before (my|the|a) (facial|appointment|visit|treatment)|prep|prepare|stop (using|taking)|botox|filler|shave|shaving|makeup (to|before)/, a: function () {
      return "Before your facial: stop retinol or prescription retinoids 5 to 7 days ahead, pause exfoliating acids 2 to 3 days ahead, and don’t wax or shave your face for 2 days. After Botox or fillers, wait 2 weeks (or book the facial the same day, before injections). Skip booking on the day of a big event."; },
      acts: [["All prep notes", "#policies"]] },
    { id: "after", node: "after", k: /after (my|the|a) (facial|appointment|visit|treatment)|aftercare|work ?out|exercise|gym|sweat|makeup after/, a: function () {
      return "After your facial: skip makeup for the rest of the day, avoid workouts and heavy sweating for 24 hours (a week after a body peel), and don’t wax or shave your face for 2 days. If anything feels off, message within 24 hours."; } },
    { id: "member", node: "member", k: /member|monthly plan|subscri|\bglow plan|join/, a: function () {
      return "Two plans. Glow, " + memPrice("glow") + " a month: a Custom Facial or the Monthly Acne Treatment every month. Ageless, " + memPrice("ageless") + ": everything in Glow plus the Ageless Grace Facial and dermaplaning every other visit. Members book with no deposit, bank a facial they can’t use, pause once a year, save on the shelf with free shipping, and ask Evelyn anything with a reply within 24 hours." + foundingNote(); },
      acts: [["See memberships", "#membership"]] },
    { id: "shelf", k: /product|serum|cleanser|\bspf\b|sunscreen|moisturi|skincare|\bshop\b|toner|mask|what do you sell/, a: function () {
      return "Evelyn’s shelf is on this site: Face Reality, GlyMed Plus, Mixi and Circadia, the lines she uses in the room. Shipping is $8, free over $75, or pick up free at your visit. Not sure what’s right for your skin? Ask her and she’ll reply."; },
      acts: [["See the shop", "#shop"], ["Ask Evelyn", "skin"]] },
    { id: "lashes", k: /lash|nails?\b|manicure|pedicure|tint|lamination/, a: function () {
      return "Lumevina’s menu is facials, peels and waxing. For lashes, brows and nails, Evelyn is happy to point you to artists she trusts."; } }
  ];

  /* ── what goes to Evelyn: the shared rules (js/ask-rules.js), the same on the server ── */
  var RULES = window.LumevinaAskRules || null;
  /* held-back parts of the site (js/site-config.js) get a short "paused" answer */
  var off = function (f) { return !!(window.LumevinaFeatures && !window.LumevinaFeatures.on(f)); };
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

  /* the demo's draft; with photos attached it thanks them instead of asking for one (live, the server writes it) */
  var draftFor = function (kind, first, n) {
    var d = (DRAFTS[kind] || DRAFTS.other).replace("{name}", first);
    if (!n) return d;
    var thanks = "Thank you for the photo" + (n > 1 ? "s" : "") + ".";
    if (!/Could you send (me )?a photo/.test(d)) return d.replace(/ — Evelyn$/, " " + thanks + " — Evelyn");
    return d.replace(/Could you send (me )?a photo in (natural light|daylight) and tell me/, thanks + " Could you tell me")
      .replace(/Could you send (me )?a photo in (natural light|daylight)\?/, thanks);
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
    if (!best) return null;
    var sv = SV.get(best.getAttribute("data-id"));
    return { id: best.getAttribute("data-id"), price: best.getAttribute("data-price"), from: !!(sv && sv.from), desc: (sv && sv.desc) || desc };
  };
  var short = function (n) { return n; };
  /* her groups (js/services.js): Facials, ProCell, Peels, Acne Bootcamp, Consultations, Waxing → Brazilian & Bikini, Body, Face */
  var ASK = { facials: "Which facial?", procell: "One session or the package?", peels: "Which peel?", acne: "Where are you in the Acne Bootcamp?",
    consult: "In person or by video?" };
  var GROUPS = {}, WAX = [];
  var bookables = function (items) {
    var out = [];
    items.forEach(function (it) { (it.options || [it]).forEach(function (o) { if (!o.ask) out.push(o.name); }); });
    return out;
  };
  SV.menu.forEach(function (g) {
    if (g.subs) g.subs.forEach(function (sg, i) {
      GROUPS["p-wax-" + i] = { label: sg.group, ask: "Which one?", items: bookables(sg.items) };
      WAX.push([sg.group, "n:p-wax-" + i]);
    });
    else GROUPS["p-" + g.key] = { label: g.group, ask: ASK[g.key] || "Which one?", items: bookables(g.items) };
  });
  var groupOf = function (name) { for (var g in GROUPS) if (GROUPS[g].items.indexOf(name) !== -1) return g; return null; };
  var serviceAnswer = function (name) {
    var sv = findService(name);
    if (!sv) return { text: "I couldn’t find that one on the menu. Want me to ask Evelyn?", acts: [["Ask Evelyn", "skin"]] };
    var full = SV.get(sv.id);
    var text = short(name) + " · " + (sv.from ? "from " : "") + "$" + Number(sv.price).toLocaleString("en-US") + "." + (sv.desc ? " " + sv.desc : "") +
      (full && full.deposit ? " A $" + full.deposit + " deposit holds the time." : "");
    var g = groupOf(name);
    return { text: text, acts: [["Book this", "book:" + sv.id]].concat(g ? [["Other " + GROUPS[g].label.toLowerCase(), "n:" + g]] : [], [["All prices", "n:prices"]]) };
  };
  var MENU_OPTS = SV.menu.map(function (g) { return [g.group, g.subs ? "n:p-wax" : "n:p-" + g.key]; });
  var info = function (text, acts) { return { say: text, opts: acts || [] }; };
  var NODES = {
    prices: info("Prices for which?", MENU_OPTS.concat([["Gift certificates", "n:gift"]])),
    "p-wax": info("Which area?", WAX),
    book: info("What would you like to book? Pick one and I’ll open the times.", MENU_OPTS.concat([["Just show me times", "book"]])),
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
    member: info("Two plans. What would you like to know?", function () { return [["Glow · " + memPrice("glow"), "n:m-glow"], ["Ageless · " + memPrice("ageless"), "n:m-ageless"], ["Banking a facial", "n:m-bank"],
      ["Pausing or cancelling", "n:m-pause"], ["Ask Evelyn any time", "n:m-ask"], ["Join", "#membership"]]; }),
    "m-glow": info(function () { return "Glow, " + memPrice("glow") + " a month: one facial every month (the Custom Facial or the Monthly Acne Treatment), no deposits, 10% off the shelf, 15% off add-ons, a home routine from Evelyn, and first word on flash openings." + foundingNote(); }, [["Join", "#membership"], ["Compare Ageless", "n:m-ageless"]]),
    "m-ageless": info(function () { return "Ageless, " + memPrice("ageless") + " a month: everything in Glow, plus the Ageless Grace Facial any month, dermaplaning every other visit, and 15% off the shelf." + foundingNote(); }, [["Join", "#membership"], ["Compare Glow", "n:m-glow"]]),
    "m-bank": info("Busy month? Your facial waits. Up to two bank at a time, and with two waiting we don’t bill you until you book one, so you never pay for a facial you can’t use. You can also send a banked facial to a friend as a gift.", [["Something else", "n:member"]]),
    "m-pause": info("Pause one month a year at no charge. After the 3-month minimum, cancel online any time from My Lumevina.", [["Something else", "n:member"]]),
    "m-ask": info("Members can ask Evelyn anything, any time. Everyday questions are answered right here, and anything about your skin gets her own reply within 24 hours.", [["Join", "#membership"], ["Something else", "n:member"]]),
    gift: info("Gift certificates never expire. What would you like to know?", [["Sending one", "n:g-any"], ["Using one", "n:g-use"], ["What's left on mine", "n:g-left"]]),
    "g-any": info("Choose $50, $100, $200, $400 or your own amount ($25 to $1,000). It's emailed with its own code and goes toward any treatment.", [["Send a gift", "#gift"], ["Something else", "n:gift"]]),
    "g-use": info("Show the code at your visit and Evelyn takes it off the bill. If it's worth more than the visit, the rest stays on it for next time; if the visit costs more, you pay only the difference.", [["Book", "n:book"], ["Something else", "n:gift"]]),
    "g-left": info("Type the code from the certificate email here (it looks like LUM-AB12-CD34) and I'll check what's left.", [["Something else", "n:gift"]])
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

  /* ── where an order is: this browser's orders in the demo (js/cart.js),
     with their shipping status (js/shipping.js). Live, the server looks it up. ── */
  var ORDER_NO = /\blum-([a-z0-9]{8})\b(?!-)/i;
  var ORDER_ASK = /where('?s| is) my (order|package|delivery|stuff)|order status|status of my order|track(ing)? (my |an |the )?(order|package)|tracking (number|info|link)|(has|did) my (order|package)|my (order|package) (ship|come|arrive|go out)|when (will|does) my (order|package)|(order|package) (hasn'?t|didn'?t|never|still hasn'?t) (come|arrive|show|ship)|haven'?t (got|gotten|received) my (order|package)/;
  var day = function (iso) { return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
  var orderAnswer = function (text) {
    if (ENDPOINT) return { answer: "I can’t look orders up right this moment. Your receipt email has the order number, and the tracking link comes by email once it ships. Want me to ask Evelyn?",
      acts: [["Ask Evelyn", "t:Ask Evelyn about my order"]] };
    var mine = read("lumevina_orders", []);
    var m = ORDER_NO.exec(text), who = me();
    var list = m ? mine.filter(function (o) { return o.id.toUpperCase() === "LUM-" + m[1].toUpperCase(); })
      : who ? mine.filter(function (o) { return o.email === who.email.toLowerCase(); }) : mine;
    if (!list.length) return m
      ? { answer: "I couldn’t find order LUM-" + m[1].toUpperCase() + ". Check the number at the top of your receipt email, or I can ask Evelyn.", acts: [["Ask Evelyn", "t:Ask Evelyn about my order"]] }
      : { answer: "Type your order number here (it’s at the top of your receipt email and starts with LUM-) and I’ll check where it is." };
    var SH = window.LumevinaShip, ships = SH ? SH.list() : [], acts = [];
    var lines = list.slice(0, 3).map(function (o) {
      var rec = ships.filter(function (r) { return r.order === o.id; })[0];
      var what = o.items.map(function (i) { return i.qty + " × " + i.name; }).join(", ") || (o.gifts ? "gift certificates" : "your order");
      var where = o.delivery === "pickup" ? "it’s waiting for you at your next visit."
        : rec && rec.status === "shipped" ? "it shipped " + day(rec.shippedAt) + (rec.carrier ? " by " + rec.carrier : "") + "."
        : rec ? "it’s being packed and ships by " + day(rec.due) + "."
        : o.gifts && !o.items.length ? "the certificates went out by email." : "it’s paid and being packed.";
      if (rec && rec.status === "shipped" && rec.tracking && SH) acts.push([list.length > 1 ? "Track " + o.id : "Track my package", "go:" + SH.trackUrl(rec.tracking)]);
      return o.id + " (" + day(o.at) + ", " + what + "): " + where;
    });
    return { answer: (lines.length > 1 ? "Your latest orders. " : "Order ") + lines.join(" ") + " Anything missing or damaged, Evelyn will sort it out.",
      acts: acts.concat([["Ask Evelyn", "t:Ask Evelyn about my order"]]) };
  };

  /* ── what's left on a gift certificate, when a code is typed (both modes) ── */
  var GIFT_CODE = /\blum-[a-z2-9]{4}-[a-z2-9]{4}\b/i;
  var GIFT_LEFT = /\b(balance|left|remaining)\b.*(gift|certificate)|(gift|certificate).*\b(balance|left on|remaining)\b/;
  var giftWords = function (c, code) {
    var end = code.slice(-4);
    if (!c) return { answer: "I couldn’t find a certificate with that code. Check it against the email it came in: LUM-, four characters, a dash, four more.", acts: [["Ask Evelyn", "t:Ask Evelyn about my gift certificate"]] };
    if (c.status === "void") return { answer: "The certificate ending " + end + " was cancelled. Evelyn can tell you more.", acts: [["Ask Evelyn", "t:Ask Evelyn about my gift certificate"]] };
    if (c.status === "redeemed" || !(c.balance > 0)) return { answer: "The certificate ending " + end + " has been used in full.", acts: [["Send a gift", "#gift"]] };
    var m = function (n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0 }); };
    return { answer: c.kind === "service"
      ? "The certificate ending " + end + " covers " + (c.label || "one treatment") + " and hasn’t been used yet. It never expires: show the code at your visit."
      : "The certificate ending " + end + " has " + m(c.balance) + " left" + (c.amount && c.amount !== c.balance ? " of " + m(c.amount) : "") +
        ", toward any treatment. It never expires: show the code at your visit and Evelyn takes it off the bill.", acts: [["Book", "book"]] };
  };
  var giftCheck = function (text) {
    var m = GIFT_CODE.exec(text), G = window.LumevinaGiftCards;
    if (!m || !G) return false;
    var code = m[0].toUpperCase();
    bubble("bot", "…", "thinking");
    logEl.scrollTop = logEl.scrollHeight;
    G.check(code).then(function (c) { settle(text, giftWords(c, code)); }, function () {
      settle(text, { answer: "I couldn’t check that code just now. Try again in a minute, or use Check a gift balance under the gift certificate.", acts: [["Check a balance", "#gift"]] });
    });
    return true;
  };

  var TY = window.LumevinaTypos;
  var classify = function (text) {
    var raw = text.toLowerCase();
    /* typos and texting shorthand read as the word they meant ("facail", "cancle", "appt") */
    var t = TY ? TY.fix(text) : raw;
    /* safety first, on what they typed and on what they meant */
    var rk = RULES ? RULES.kind(raw, t) : null;
    /* "my routine" from a client with a plan: her plan answers it; anything else the rules catch goes to her */
    if ((!rk || rk === "skin") && fromPlan(t)) return fromPlan(t);
    if (rk) return { handoff: rk };
    /* changing their plan ("can I add vitamin C to my routine?") is Evelyn's call */
    if (myPlan() && /\bmy (routine|regimen|plan|products|skin ?care)\b/.test(t)) return { handoff: "skin" };
    if (ORDER_ASK.test(t) || ORDER_NO.test(text)) return orderAnswer(text);
    if (GIFT_LEFT.test(t)) return { answer: NODES["g-left"].say, acts: [["Gift certificates", "n:gift"]] };
    if (off("membership") && /member|monthly plan|subscri|\bglow plan|join\b|\bbank/.test(t)) return { answer: "Memberships are paused right now. Facials book one at a time on the calendar here, and Evelyn’s shelf is open on this site.", acts: [["Book", "book"], ["See the shop", "#shop"]] };
    if (off("school") && /\bcourses?\b|\bclass(es)?\b|skin school|\blessons?\b|glow party|pro night|workshop/.test(t)) return { answer: "Skin School and classes are paused right now. Evelyn is happy to answer questions one on one.", acts: [["Ask Evelyn", "skin"]] };
    if (off("rewards") && /\brefer|referral|points\b|rewards?\b|friend'?s code/.test(t)) return { answer: "Glow Rewards is paused right now, so there are no points or referral codes at the moment.", acts: [["Book", "book"]] };
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
  var CHIPS = [["Prices", "n:prices"], ["Book", "n:book"], ["Products", "t:What products do you sell?"], ["Where’s my order?", "t:Where is my order?"], ["Before my facial", "n:before"],
    ["After my facial", "n:after"], ["Cancel or reschedule", "n:cancel"], ["Memberships", "n:member"], ["Gift certificates", "n:gift"],
    ["Parking", "t:Where do I park?"], ["A question about my skin", "skin"]]
    .filter(function (c) { return !(c[1] === "n:member" && off("membership")); });

  var state = chat();
  var save = function () { write(CHAT_KEY, state); };
  var push = function (m) { state.log.push(m); if (state.log.length > 80) state.log = state.log.slice(-80); save(); };

  /* answers Evelyn has sent for this browser's questions (live: fetched for a signed-in client, below) */
  var liveReplies = {};
  var replies = function () {
    var mine = {};
    state.log.forEach(function (m) { if (m.qid) mine[m.qid] = true; });
    return questions().filter(function (q) { return mine[q.id] && q.status === "answered" && q.reply; })
      .concat(Object.keys(liveReplies).filter(function (id) { return mine[id]; }).map(function (id) { return liveReplies[id]; }));
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

  /* ── photos for Evelyn: up to three, shrunk here; only she sees them ── */
  var MAX_SHOTS = 3;
  var shots = [];                    /* [{ full, small }] data URLs, for the question being written */
  var typed = { name: "", email: "" }, sending = false, sendErr = "";
  var shotsHtml = function () {
    return '<div class="ask-shots">' + shots.map(function (sh, i) {
      return '<span class="ask-shot"><img src="' + sh.small + '" alt="Photo ' + (i + 1) + '"><button type="button" class="ask-shot-x" data-act="unshot:' + i +
        '" aria-label="Remove photo ' + (i + 1) + '">&times;</button></span>';
    }).join("") + (shots.length < MAX_SHOTS ? '<label class="ask-shot-add"><input type="file" accept="image/*" multiple class="sr-only">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>' +
      (shots.length ? "Add another" : "Add a photo") + '</label>' : "") + '</div>' +
      '<p class="ask-shot-note">' + (shots.length ? "Only Evelyn sees your photos." : "A close-up in daylight helps Evelyn answer. Only she sees it.") + '</p>';
  };
  var shrink = function (file, max, quality) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        var g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error("photo")); };
      img.src = url;
    });
  };
  var addShots = function (files) {
    var list = Array.prototype.slice.call(files || [], 0, MAX_SHOTS - shots.length);
    if (!list.length) return;
    sendErr = "";
    Promise.all(list.map(function (f) {
      return shrink(f, 1568, 0.85).then(function (full) {
        return shrink(f, 480, 0.72).then(function (small) { return { full: full, small: small }; });
      }).catch(function () { return null; });
    })).then(function (got) {
      var bad = got.filter(function (x) { return !x; }).length;
      shots = shots.concat(got.filter(Boolean)).slice(0, MAX_SHOTS);
      if (bad) sendErr = bad === 1 ? "That photo didn’t open. Try a screenshot of it, or a JPEG." : "Some photos didn’t open. Try screenshots of them, or JPEGs.";
      render();
    });
  };
  var uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var r = Math.random() * 16 | 0; return (ch === "x" ? r : (r & 3 | 8)).toString(16);
    });
  };

  var render = function () {
    logEl.innerHTML = "";
    var who = me();
    bubble("bot", esc("Hi" + (who ? " " + who.name.split(" ")[0] : "") + "! " + (myPlan()
      ? "I have the skin plan Evelyn wrote for you, so ask me what to use morning or night, what to avoid, or what’s next. Prices, booking and aftercare too. Anything new about your skin, I’ll pass to Evelyn."
      : myProfile() ? "I have your skin profile, so ask me about prep, aftercare, products or booking and I’ll keep your routine in mind. Changes to your routine, I’ll pass to Evelyn."
      : "Ask me about prices, booking, prep, aftercare or products, or where your order is. Anything about your own skin, I’ll pass to Evelyn.")));
    var answered = {};
    replies().forEach(function (q) { answered[q.id] = q; });
    var lastBot = -1;
    state.log.forEach(function (m, i) { if (m.who === "bot") lastBot = i; });
    if (lastBot >= 0 && state.log.slice(lastBot + 1).some(function (m) { return m.who === "you"; })) lastBot = -1;
    state.log.forEach(function (m, i) {
      if (m.who === "you") bubble("you", esc(m.text));
      else if (m.who === "bot") bubble("bot", esc(m.text) + actsHtml(m.acts, i === lastBot && !state.pending), m.warn ? "warn" : "");
      else if (m.who === "note") bubble("note", '<span class="ask-tag">Noted in your skin profile</span>' + esc(m.text) +
        ' <button type="button" class="ask-note-see" data-act="account">See or change it</button>');
      else if (m.who === "sent") {
        bubble("bot", '<span class="ask-tag">Sent to Evelyn' + (m.photos ? " · " + m.photos + (m.photos === 1 ? " photo" : " photos") : "") + '</span>' + esc(m.text));
        var q = answered[m.qid];
        if (q) bubble("evelyn", '<span class="ask-tag">Evelyn replied</span>' + esc(q.reply));
      }
    });
    var pending = state.pending;
    if (pending) {
      /* the general rule behind the hand-off, when the assistant had one, then the lead */
      var box = bubble("bot", esc(pending.note ? pending.note + "\n\n" + pending.lead : pending.lead) + '<span class="ask-promise">' + esc(promise(pending.member)) + "</span>");
      var who2 = me();
      var f = document.createElement("div");
      f.className = "ask-handoff";
      f.innerHTML = (who2 ? "" :
        '<label class="sr-only" for="ask-name">Your name</label><input id="ask-name" type="text" placeholder="Your name" autocomplete="name" value="' + esc(typed.name) + '">' +
        '<label class="sr-only" for="ask-email">Your email</label><input id="ask-email" type="email" placeholder="Email for Evelyn’s reply" autocomplete="email" value="' + esc(typed.email) + '">') +
        shotsHtml() +
        '<div class="ask-acts"><button type="button" class="ask-act is-primary" data-act="send"' + (sending ? " disabled" : "") + '>' + (sending ? "Sending…" : "Send to Evelyn") + '</button>' +
        '<button type="button" class="ask-act" data-act="nevermind">Not now</button></div><p class="ask-err" role="alert">' + esc(sendErr) + '</p>';
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

  /* ── the server (js/site-config.js → ask.endpoint): Claude answers from Evelyn's
     playbook, in her voice (server/functions/ask), and looks up orders and gift
     balances. Without an endpoint, or when it can't be reached, the keyword
     answers above take over. Hand-offs never wait for the server: the shared
     rules decide those here, instantly, and nothing reaches Evelyn until the
     client taps Send. ── */
  var CFG = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.ask) || {};
  var ENDPOINT = /^https:\/\//.test(CFG.endpoint || "") ? CFG.endpoint : "";
  var token = function () { return window.LumevinaAccount && window.LumevinaAccount.token ? window.LumevinaAccount.token() : ""; };
  var post = function (body, ms) {
    var headers = { "Content-Type": "application/json" };
    if (CFG.key) { headers.apikey = CFG.key; headers.Authorization = "Bearer " + (token() || CFG.key); }
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 20000) : null;
    /* which version the website runs (v2: booking on GlossGenius; v3: here, with membership and points) */
    body.site = (window.LumevinaFeatures && window.LumevinaFeatures.version) || "v2";
    return fetch(ENDPOINT, { method: "POST", headers: headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error("ask " + res.status); return res.json(); })
      .finally(function () { if (timer) clearTimeout(timer); });
  };
  var history = function () {
    return state.log.filter(function (m) { return (m.who === "you" || m.who === "bot") && m.text; }).slice(-8)
      .map(function (m) { return { role: m.who === "you" ? "user" : "assistant", content: m.text }; });
  };
  var nextActs = function (answer, hasProducts) {
    var acts = [];
    if (/\bbook|facial|appointment|calendar/i.test(answer)) acts.push(["Book", "book"]);
    if (!hasProducts && /shelf|shop|cleanser|serum|\bspf\b|sunscreen|moisturi|toner|mask|patch/i.test(answer)) acts.push(["See the shop", "#shop"]);
    acts.push(["Ask Evelyn", "skin"]);
    return acts;
  };
  var remote = function (text) {
    if (!ENDPOINT || /^about my skin:/i.test(text)) return false;
    var raw = text.toLowerCase(), t = TY ? TY.fix(text) : raw;
    var rk = RULES ? RULES.kind(raw, t) : null;
    /* a "my skin" question still goes to the server when it can see this client's plan or skin profile */
    if (rk && !(rk === "skin" && token() && (myPlan() || myProfile()))) return false;
    var who = me();
    bubble("bot", "…", "thinking");
    logEl.scrollTop = logEl.scrollHeight;
    post({ message: text, history: history(), name: who ? who.name : "", email: who ? who.email : "" }).then(function (r) {
      if (r && r.answer) {
        var answer = String(r.answer), ids = Array.isArray(r.products) ? r.products.map(String) : [];
        var links = (Array.isArray(r.links) ? r.links : []).filter(function (l) { return l && /^https:\/\//.test(l.url); })
          .slice(0, 3).map(function (l) { return [String(l.label || "Track my package"), "go:" + l.url]; });
        settle(text, { answer: answer, acts: bagActs(ids).concat(links, nextActs(answer, ids.length > 0)) });
        noted(Array.isArray(r.remembered) ? r.remembered.map(String) : []);
        if (r.remembered && window.LumevinaProfile) window.LumevinaProfile.remembered();
      } else if (r && r.handoff) settle(text, { handoff: String(r.handoff), why: r.why ? String(r.why) : "", note: r.note ? String(r.note) : "" });
      else settle(text, classify(text));
    }, function () { settle(text, classify(text)); });
    return true;
  };

  /* ── the preview (the single-file page on claude.ai, with no server): Claude
     answers on the viewer's own Claude account (the page's "sample"
     capability), from the same bundle the server uses
     (knowledge/scripts/build-bundle.mjs; scripts/build-single-file.mjs puts it
     in the page as window.LUMEVINA_ASK_BUNDLE). The same rules decide hand-offs
     first, here, before Claude sees anything. Without Claude, the keyword
     answers stand, and her playbook answers in her own words when one clearly
     matches. ── */
  var BUNDLE = (!ENDPOINT && window.LUMEVINA_ASK_BUNDLE) || null;
  var sampler = null, asking = null;
  if (BUNDLE && window.claude && window.claude.use) {
    window.claude.use("sample").then(function (fn) { sampler = fn || null; }, function () { sampler = null; });
  }
  var PREVIEW_MODEL = "claude-fable-5-1";   /* the viewer's plan decides; otherwise the quick tier answers */
  var KINDS = ["urgent", "reaction", "pregnancy", "medication", "condition", "skin", "request", "other"];
  var MEM_KINDS = ["skin", "concern", "product", "supplement", "treatment", "sensitivity", "goal", "other"];
  var GONE = { not_granted: 1, sampling_disabled: 1, not_declared: 1, capability_disabled: 1, capability_removed: 1 };
  var stockNote = function (id) {
    var INV = window.LumevinaInventory, it = INV ? INV.get(id) : null, st = it ? INV.status(it) : "";
    return st === "out" ? " (out of stock; can be requested)" : st === "low" ? " (only a few left)" : "";
  };
  var PROFILE_LABELS = [["morning", "Morning"], ["night", "Night"], ["weekly", "Once or twice a week"], ["supplements", "Supplements"],
    ["treatments", "Treatments they've had"], ["sensitivities", "Reacts to"], ["goal", "Their goal"]];
  var clientBlock = function (who) {
    var LP = window.LumevinaProfile, snap = LP && LP.snapshot ? LP.snapshot() : null, p = snap && snap.profile, lines = [];
    if (p) {
      if (p.skinType) lines.push("Skin type: " + p.skinType);
      if ((p.concerns || []).length) lines.push("Working on: " + p.concerns.join(", "));
      PROFILE_LABELS.forEach(function (f) { if (p[f[0]]) lines.push(f[1] + ": " + p[f[0]]); });
    }
    var mem = ((snap && snap.memories) || []).slice(0, 30).map(function (m) { return "- " + m.fact; });
    return [
      "# The client you're talking to",
      who.name + " is signed in" + (who.member ? ", a " + who.plan + " member" : "") + ".",
      lines.length ? "Their skin profile, in their own words:\n" + lines.join("\n") : "They haven't filled in a skin profile yet.",
      mem.length ? "What they've told you before:\n" + mem.join("\n") : "",
      "Use their profile and what they've told you to make an answer from Evelyn's playbook specific to them (for example, which of the products they listed to pause before a facial). Don't recommend changes to their routine yourself: adding, stopping or swapping a product goes to Evelyn (kind \"skin\"). You may point out, in one sentence and as general information, a general rule that bears on what they listed (two exfoliants on the same night, a retinoid before a wax), and send the decision to Evelyn." +
        (p && p.supplements ? " They take supplements: never advise on supplements (whether to take, stop, mix or dose one); hand those to Evelyn (kind \"skin\")." : "") +
        " Use their first name now and then."
    ].filter(Boolean).join("\n\n");
  };
  var previewRules = function () {
    var v3 = window.LumevinaFeatures && window.LumevinaFeatures.version === "v3", who = me();
    return [
      BUNDLE.prompt,
      "# About the studio, FAQ and policies\n\n" + (v3 ? BUNDLE.factsV3 : BUNDLE.facts),
      "# Evelyn's Skin Playbook\n\n" + (BUNDLE.knowledgeEmpty
        ? "Evelyn hasn't filled her playbook in yet. So there is nothing here about skin concerns, aftercare details, routines or how to use her products: every question of that kind goes to her. You can still answer from the FAQ, the policies, her treatments and the shelf list."
        : BUNDLE.knowledge),
      BUNDLE.general || "",
      BUNDLE.hardLines ? "# Her hard lines\n\n" + BUNDLE.hardLines : "",
      BUNDLE.voice ? "# Her voice\n\n" + BUNDLE.voice : "",
      "# Her shelf (every product the website sells)\n\n" + BUNDLE.shelf.map(function (p) {
        return "- " + p.name + " (" + p.brand + ", " + p.type + (p.size ? ", " + p.size : "") + "): $" + p.price + stockNote(p.id) + (p.about ? ". " + p.about : "") + " [id: " + p.id + "]";
      }).join("\n"),
      who ? clientBlock(who) : "",
      [
        "# How to reply here",
        "- There are no tools in this chat: where the instructions above say to call hand_to_evelyn, show_products or remember, write the matching line below instead. Order look-ups and gift balances are answered by the website itself.",
        "- This is a chat bubble on her website: plain text, no Markdown (no headings, bold or tables). A short list with \"- \" is fine for steps.",
        "- To hand a question to Evelyn instead of answering (everything the instructions above send to her), reply with only this line: [[evelyn: <kind> | <one short line for Evelyn: what the client is asking> | <one or two general sentences the client sees while they wait: the general rule that applies and why it's her call; nothing about their own skin, never \"that's normal\"; leave it empty when there's nothing useful>]], kind being one of " + KINDS.join(", ") + ".",
        "- When you name shelf products the client can buy right now (they asked about one, want to reorder, or want what fits the routine Evelyn described), end with a line [[products: <id>, <id>]] using ids from her shelf list, so Add to bag buttons appear. Only products in stock or with a few left.",
        who ? "- When the client tells you something lasting about themselves that isn't already above (skin type, a concern, a product they use and when, a supplement they take, a treatment they've had and roughly when, something their skin reacts to, a goal), end with a line [[remember: <one short line in the third person, in their words> | <kind: " + MEM_KINDS.join(", ") + ">]]. Never medications, prescriptions, pregnancy or health conditions, anything about someone else, or guesses." : "",
        "- The website reads the [[...]] lines and never shows them; don't mention them."
      ].filter(Boolean).join("\n")
    ].filter(Boolean).join("\n\n");
  };
  var MARK = /\[\[\s*(evelyn|products|remember)\s*:([^\]]*)\]\]/gi;
  var shown = function (t) {
    return String(t).replace(/\[\[[\s\S]*?(\]\]|$)/g, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/gm, "")
      .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  };
  var marks = function (t) {
    var out = { handoff: null, why: "", note: "", ids: [], facts: [] }, m;
    MARK.lastIndex = 0;
    while ((m = MARK.exec(t))) {
      var parts = m[2].split("|").map(function (x) { return x.trim(); }), what = m[1].toLowerCase();
      if (what === "evelyn") { out.handoff = KINDS.indexOf(parts[0].toLowerCase()) !== -1 ? parts[0].toLowerCase() : "other"; out.why = parts[1] || ""; out.note = (parts[2] || "").slice(0, 400); }
      else if (what === "products") out.ids = out.ids.concat(parts[0].split(/[\s,]+/).filter(function (id) { return BUNDLE.shelf.some(function (p) { return p.id === id; }); }));
      else if (parts[0]) out.facts.push([parts[0], MEM_KINDS.indexOf((parts[1] || "").toLowerCase()) !== -1 ? parts[1].toLowerCase() : "other"]);
    }
    return out;
  };
  var CHITCHAT = /^(hi+|hey+|hello+|helo|heyo|hiya|yo|sup|thanks?|thank you( so much| very much)?|ok|okay|cool|great|got it|perfect|nice|yes|yeah|no|bye+|see you|good ?night)[\s!.]*$/;
  var preview = function (text) {
    if (!sampler || /^about my skin:/i.test(text)) return false;
    var raw = text.toLowerCase(), t = TY ? TY.fix(text) : raw;
    var rk = RULES ? RULES.kind(raw, t) : null;
    /* a "my skin" question still goes to Claude when it can see this client's skin profile */
    if (rk && !(rk === "skin" && myProfile())) return false;
    /* her plan, order look-ups and small talk answer here, instantly */
    if (fromPlan(t) || ORDER_ASK.test(t) || ORDER_NO.test(text) || GIFT_LEFT.test(t) || CHITCHAT.test(t)) return false;
    var who = me(), live = bubble("bot", "…", "thinking");
    logEl.scrollTop = logEl.scrollHeight;
    if (asking) asking.abort();
    var ctl = asking = new AbortController();
    sampler([{ role: "user", content: previewRules() }].concat(history()), {
      model: PREVIEW_MODEL, effort: "low", modelTier: "quick", cache: false, signal: ctl.signal,
      onText: function (u) {
        var now = shown(u.text);
        if (!now || !live.isConnected) return;
        live.classList.remove("thinking");
        live.textContent = now;
        logEl.scrollTop = logEl.scrollHeight;
      }
    }).then(function (r) {
      if (asking === ctl) asking = null;
      var mk = marks(r.text), answer = shown(r.text);
      if (mk.handoff) return settle(text, { handoff: mk.handoff, why: mk.why, note: mk.note });
      if (!answer) return settle(text, local(text));
      settle(text, { answer: answer, acts: bagActs(mk.ids).concat(nextActs(answer, mk.ids.length > 0)) });
      var LP = window.LumevinaProfile;
      if (who && LP && LP.note) noted(mk.facts.filter(function (f) { return LP.note(f[0], f[1]); }).map(function (f) { return f[0]; }));
    }, function (e) {
      if (asking === ctl) asking = null;
      if (e && e.code === "cancelled") return;
      if (e && GONE[e.code]) sampler = null;
      settle(text, local(text));
    });
    return true;
  };

  /* no Claude here: her playbook still answers in her own words when one of her answers clearly matches */
  var STOP = /^(the|a|an|and|or|to|of|in|on|for|my|me|i|is|it|its|do|does|did|can|could|what|whats|how|when|should|you|your|with|this|that|be|are|was|will|would|after|before|get|have|has|if|im|about|any|just|so|at|from|they|them|their)$/;
  var words = function (t) {
    return String(t).toLowerCase().replace(/[^a-z0-9%\s]/g, " ").split(/\s+/).filter(function (w) { return w.length > 2 && !STOP.test(w); })
      .map(function (w) { return w.replace(/(ing|ed|es|s)$/, ""); });
  };
  var CHUNKS = [];
  if (BUNDLE && !BUNDLE.knowledgeEmpty) {
    var topic = "";
    BUNDLE.knowledge.split(/\n(?=#{1,2} )/).forEach(function (part) {
      var m = /^(#{1,2}) ([^\n]+)\n?([\s\S]*)$/.exec(part.trim());
      if (!m) return;
      if (m[1] === "#") { if (!/in Evelyn's words$|^Her |^From her/.test(m[2])) topic = m[2]; return; }
      var a = m[3].replace(/\n---\s*$/, "").replace(/_\(How to read this:[^)]*\)_/g, "").trim();
      if (a) CHUNKS.push({ topic: topic, q: m[2], a: a, head: words(topic + " " + m[2]), body: words(a) });
    });
  }
  var NOT_PLAYBOOK = /price|cost|how much|\$|\bbook|appointment|hours|open|cancel|deposit|gift|order|ship|member/;
  var playbookHit = function (text) {
    var ws = words(text), best = null;
    if (!ws.length) return null;
    CHUNKS.forEach(function (c) {
      var score = 0, head = 0;
      ws.forEach(function (w) { if (c.head.indexOf(w) !== -1) { score += 2; head++; } else if (c.body.indexOf(w) !== -1) score += 1; });
      if (head && (!best || score > best.score)) best = { score: score, c: c };
    });
    if (!best || best.score < 3) return null;
    var a = best.c.a.length > 700 ? best.c.a.slice(0, 700).replace(/\s\S*$/, "") + "…" : best.c.a;
    return { score: best.score, answer: "From Evelyn, on " + best.c.topic.toLowerCase() + " (" + best.c.q.replace(/\?$/, "").toLowerCase() + "):\n\n" + a };
  };
  var local = function (text) {
    var r = classify(text);
    if (!CHUNKS.length || (r.handoff && !r.unsure) || r.plan || r.unclear) return r;
    var t = TY ? TY.fix(text) : text.toLowerCase();
    var hit = playbookHit(text);
    if (hit && (r.unsure || (hit.score >= 4 && !NOT_PLAYBOOK.test(t)))) return { answer: hit.answer, acts: [["Book", "book"], ["Ask Evelyn", "skin"]] };
    return r;
  };

  var ask = function (text) {
    text = String(text || "").trim();
    if (!text) return;
    push({ who: "you", text: text });
    if (giftCheck(text)) return;
    if (!remote(text) && !preview(text)) {
      settle(text, local(text));
      /* demo: what a signed-in client says about their own routine is noted in their skin profile */
      if (!ENDPOINT && window.LumevinaProfile) noted(window.LumevinaProfile.learn(text));
    }
  };
  /* a quiet line under the answer: what the chat kept for next time, and where to see it */
  var noted = function (facts) {
    if (!facts || !facts.length) return;
    push({ who: "note", text: facts.join(" · ") });
    render();
  };
  var settle = function (text, r) {
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
      state.pending = { id: uuid(), text: text, kind: r.handoff, why: r.why || "", note: r.note || "", lead: (state.unclear >= 2 ? LEADS.again : LEADS[r.handoff]) || LEADS.other, member: !!(who && who.member) };
      shots = []; sendErr = ""; sending = false;
      if (state.unclear >= 2) state.unclear = 0;
      if (r.handoff === "urgent") push({ who: "bot", text: LEADS.urgent, warn: true });
      if (r.handoff === "urgent") state.pending.lead = "Send your message to Evelyn too?";
      save();
    }
    render();
  };

  var send = function () {
    var p = state.pending;
    if (!p || sending) return;
    var who = me();
    var name = who ? who.name : typed.name.trim();
    var email = who ? who.email : typed.email.trim();
    if (!who && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      sendErr = "Add your name and email so Evelyn can reply.";
      return render();
    }
    var member = !!(who && who.member);
    var id = p.id || (p.id = uuid()), n = shots.length;    /* one id per question, so a retry saves it once */
    var done = function (dueAt, saved) {
      state.pending = null;
      shots = []; sending = false; sendErr = "";
      push({ who: "sent", qid: id, live: !!ENDPOINT, photos: saved, text: "“" + p.text + "” · Evelyn will reply by " + when(dueAt) + ", " + (ENDPOINT && !who ? "by email." : "here and by email.") });
      render();
    };
    var q = {
      id: id, at: new Date().toISOString(), name: name, email: email, member: member, plan: who ? who.plan : "",
      text: p.text, kind: p.kind, status: "waiting", dueAt: dueFor(member),
      draft: draftFor(p.kind, name.split(" ")[0], n),
      photos: shots.map(function (sh) { return sh.small; })
    };
    if (ENDPOINT) {
      /* live: the server saves it (photos stored privately), drafts a reply and tells Evelyn */
      sending = true; sendErr = ""; render();
      post({ id: id, message: p.text, handoff: p.kind, why: p.why || "", name: name, email: email,
        photos: shots.map(function (sh) { return sh.full; }) }, 60000).then(function (r) {
        if (r && r.needs_contact) { sending = false; sendErr = "Add your name and email so Evelyn can reply."; return render(); }
        document.dispatchEvent(new CustomEvent("lumevina:question-sent", { detail: q }));
        done(r && r.due_at ? r.due_at : q.dueAt, r && r.photos != null ? r.photos : n);
      }, function () {
        sending = false;
        sendErr = "It didn’t send. Check your connection and tap Send again.";
        render();
      });
      return;
    }
    /* demo: this browser keeps it, shared with the dashboard; photos as small copies */
    var all = questions(); all.push(q);
    if (!write(KEY, all)) { q.photos = []; n = 0; all[all.length - 1] = q; write(KEY, all); }
    document.dispatchEvent(new CustomEvent("lumevina:question-sent", { detail: q }));
    done(q.dueAt, n);
  };

  /* live: Evelyn's replies to a signed-in client's questions (the questions table, their own rows only) */
  var SHOP = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
  var fetchReplies = function () {
    var tk = token();
    if (!ENDPOINT || !tk || !/^https:\/\//.test(SHOP.supabase || "") || !SHOP.key) return;
    var ids = state.log.filter(function (m) { return m.who === "sent" && m.live && /^[0-9a-f-]{36}$/i.test(m.qid) && !liveReplies[m.qid]; })
      .map(function (m) { return m.qid; });
    if (!ids.length) return;
    fetch(SHOP.supabase.replace(/\/$/, "") + "/rest/v1/questions?select=id,status,reply&id=in.(" + ids.join(",") + ")",
      { headers: { apikey: SHOP.key, Authorization: "Bearer " + tk } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var got = 0;
        (rows || []).forEach(function (q) { if (q.status === "answered" && q.reply) { liveReplies[q.id] = { id: q.id, status: "answered", reply: q.reply }; got++; } });
        if (got) { if (!panel.hidden) render(); else paintFab(); }
      }, function () { /* offline: they still get the email */ });
  };

  var open = function (prefill) {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("ask-open");
    render();
    fetchReplies();
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
    if (target === "n:member" && off("membership")) return ask("memberships");
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
    if (act === "nevermind") { state.pending = null; shots = []; sendErr = ""; push({ who: "bot", text: "No problem. Anything else?" }); return render(); }
    if (act.indexOf("unshot:") === 0) { shots.splice(Number(act.slice(7)), 1); sendErr = ""; return render(); }
    if (act.indexOf("add:") === 0 || act.indexOf("addall:") === 0) return addToBag(act.slice(act.indexOf(":") + 1).split(","), act.indexOf("addall:") === 0);
    if (act === "bag") { close(); if (window.LumevinaCart) window.LumevinaCart.open(); return; }
    if (act === "book") { close(); if (window.LumevinaBooking) window.LumevinaBooking.open(); return; }
    if (act === "move") { close(); if (window.LumevinaBooking) window.LumevinaBooking.startReschedule(); return; }
    if (act === "account") { close(); if (window.LumevinaAccount) window.LumevinaAccount.open(); return; }
    if (act.indexOf("go:") === 0) {                 /* another page: the course, or its link in a preview */
      var to = act.slice(3);
      if (/^https?:/.test(to)) window.open(to, "_blank", "noopener"); else location.href = to;
      return;
    }
    if (act.charAt(0) === "#") {
      close();
      var t = document.querySelector(act);
      if (t) t.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    }
  });
  /* the photo picker, and the name and email a guest types (kept while the box redraws) */
  logEl.addEventListener("change", function (e) {
    if (e.target.closest && e.target.closest(".ask-shot-add")) { addShots(e.target.files); e.target.value = ""; }
  });
  logEl.addEventListener("input", function (e) {
    if (e.target.id === "ask-name") typed.name = e.target.value;
    if (e.target.id === "ask-email") typed.email = e.target.value;
  });

  /* Add to bag from an answer: one product, or all of them (skipping what's already in the bag) */
  var addToBag = function (ids, all) {
    var C = window.LumevinaCart;
    if (!C) return;
    var added = [], full = [], gone = [];
    ids.forEach(function (id) {
      if (all && C.has(id)) return;
      var r = C.add(id);
      (r.ok ? added : r.reason === "max" ? full : gone).push(r.name || "That product");
    });
    var words = function (l) { return l.length > 2 ? l.slice(0, -1).join(", ") + " and " + l[l.length - 1] : l.join(" and "); };
    var text = (added.length ? "Added " + words(added) + " to your bag." : all && !full.length && !gone.length ? "Those are already in your bag." : "") +
      (full.length ? " That’s all Evelyn has of " + words(full) + " on the shelf." : "") +
      (gone.length ? " " + words(gone) + " just sold out; you can request " + (gone.length === 1 ? "it" : "them") + " from the shop." : "");
    state.pending = null;
    push({ who: "bot", text: text.trim(), acts: C.count() ? [["Check out", "bag"]] : [] });
    render();
  };

  /* "About my skin: " counts as a skin question even if the rest is short */
  var baseClassify = classify;
  classify = function (text) {
    if (/^about my skin:/i.test(text)) {
      var r = baseClassify(text.replace(/^about my skin:\s*/i, ""));
      return r.handoff || r.plan ? r : { handoff: "skin" };
    }
    return baseClassify(text);
  };

  document.addEventListener("lumevina:account-changed", function () {
    if (PL && PL.live) PL.mine();             /* fetch the signed-in client's plan, so it's ready for their first question */
    fetchReplies();
    if (!panel.hidden) render(); else paintFab();
  });
  document.addEventListener("lumevina:plan-changed", function () { if (!panel.hidden) render(); });
  if (PL && PL.live && window.LumevinaAccount && window.LumevinaAccount.current()) PL.mine();
  window.addEventListener("storage", function (e) { if (e.key === KEY) { if (!panel.hidden) render(); else paintFab(); } });
  document.querySelectorAll("[data-open-ask]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); open(); });
  });
  paintFab();
  fetchReplies();

  window.LumevinaAsk = { open: open, ask: function (t) { open(t); }, classify: classify, questions: questions };
})();

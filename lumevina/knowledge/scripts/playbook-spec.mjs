// Evelyn's Skin Playbook: the questions, in one place.
//
// Everything else is generated from this file:
//   build-playbook.mjs   the questionnaire page she fills in (an artifact link)
//   build-playbook.mjs   PLAYBOOK-QUESTIONS.md, the same questions as a document
//   make-templates.mjs   the empty knowledge files her answers fill
//   import-playbook.mjs  her saved answers → knowledge/*.md
//
// Every card also takes screenshots (Add screenshots), and voice memos.
//
// Field kinds:  text (a box), one (pick one), multi (tap all that apply),
//               products (tap products from her shelf), treatments (tap from
//               her menu), list (numbered boxes). Every tap field also takes
//               free text. Nothing here states a medical or product claim:
//               the options are her own product and treatment names.

// her menu as of Oct 19, 2026 (js/services.js, from her GlossGenius page)
export const TREATMENTS = [
  "New Clients Start Here", "Lumevina Custom Facial", "Custom Facial + Dermaplaning",
  "Ageless Grace Facial", "ProCell Microchanneling", "Refresh Peel", "Corrective Peel",
  "Acne Bootcamp (New Client Consultation + Treatment)", "Monthly Acne Treatment",
  "Bi-Weekly Acne Treatment", "In-Person Consultation", "Virtual Consultation"
];

export const CONCERNS = [
  { id: "breakouts-and-acne", title: "Breakouts and acne" },
  { id: "purging-vs-breakout", title: "Purging vs. a breakout" },
  { id: "dark-spots", title: "Dark spots and post-acne marks" },
  { id: "redness-sensitivity", title: "Redness and sensitivity" },
  { id: "dryness-dehydration", title: "Dryness and dehydration" },
  { id: "oily-large-pores", title: "Oily skin and large pores" },
  { id: "fine-lines-firmness", title: "Fine lines and firmness" },
  { id: "texture", title: "Texture" },
  { id: "under-eyes", title: "Under-eyes" },
  { id: "back-body-breakouts", title: "Back and body breakouts" },
  { id: "ingrown-hairs", title: "Ingrown hairs after waxing" },
  { id: "blackheads-congestion", title: "Blackheads and congestion" },
  { id: "hormonal-breakouts", title: "Hormonal breakouts (jawline, around periods)" },
  { id: "melasma", title: "Melasma and sun spots" }
];

export const CONCERN_FIELDS = [
  { key: "first_questions", kind: "text", q: "What do you ask a client first?", hint: "The questions that tell you what's really going on." },
  { key: "morning", kind: "products", q: "Morning: what do you recommend from your shelf?", hint: "Tap products, then add how to use them." },
  { key: "night", kind: "products", q: "Night: what do you recommend from your shelf?" },
  { key: "avoid", kind: "text", q: "What should they avoid?", hint: "Products, habits, ingredients, mixing." },
  { key: "timeline", kind: "one", q: "How long until they see results?", options: ["About 2 weeks", "4 to 6 weeks", "2 to 3 months", "3 to 6 months", "It varies a lot"], text: "What to expect along the way" },
  { key: "facial", kind: "treatments", q: "When should they book a facial, and which one?", text: "When, and how often" },
  { key: "mistakes", kind: "text", q: "The most common mistakes clients make with this", hint: "Over-exfoliating, picking, switching products too fast: whatever you see most." },
  { key: "habits", kind: "text", q: "Habits and everyday tips you give", hint: "Pillowcases, phone screens, hair products, makeup, diet, sleep, workouts: only what you actually tell clients." },
  { key: "escalate", kind: "text", q: "When must this come to you, or to a doctor?", hint: "The signs that mean the assistant should stop and hand it to you." }
];

// What clients ask before they book each treatment. ids stay put when a
// treatment is renamed, so saved answers still show.
export const TREATMENT_DETAILS = [
  { id: "explain-new-client", title: "New Clients Start Here" },
  { id: "explain-custom-facial", title: "Lumevina Custom Facial" },
  { id: "explain-ageless-grace", title: "Ageless Grace Facial" },
  { id: "explain-procell", title: "ProCell Microchanneling" },
  { id: "explain-refresh-peel", title: "Refresh Peel" },
  { id: "explain-corrective-peel", title: "Corrective Peel" },
  { id: "explain-dermaplaning", title: "Dermaplaning (as an add-on)" },
  { id: "explain-acne-bootcamp", title: "Acne Bootcamp (consultation, monthly and bi-weekly)" },
  { id: "explain-consultations", title: "In-Person and Virtual Consultations" },
  { id: "explain-brazilian", title: "Brazilian, bikini and the mini vajacial" },
  { id: "explain-body-face-wax", title: "Body and face waxing" }
];

export const TREATMENT_DETAIL_FIELDS = [
  { key: "steps", kind: "text", q: "What happens, step by step", hint: "As you'd walk a nervous first-timer through it." },
  { key: "feel", kind: "text", q: "Does it hurt? How does it feel?" },
  { key: "downtime", kind: "text", q: "How they'll look after, and for how long", hint: "Pink for an hour, flaking on day 3, nothing at all: what to plan around." },
  { key: "how_often", kind: "one", q: "How often should they book it?", options: ["Every 2 weeks", "Every 3 to 4 weeks", "Every 4 to 6 weeks", "Every 6 to 8 weeks", "A series, then maintenance", "Once, or as needed"], text: "Anything that changes it" },
  { key: "results", kind: "text", q: "When will they see results, and how long do they last?" },
  { key: "best_for", kind: "text", q: "Who it's best for, and who should book something else", hint: "So the assistant can point people to the right treatment." },
  { key: "wait", kind: "text", q: "Who has to wait, or can't have it", hint: "Your own rules: recent procedures, products to stop, conditions you won't treat. The assistant still hands medical questions to you." },
  { key: "before", kind: "text", q: "Anything to do before this one, beyond your general list" },
  { key: "pairs", kind: "treatments", q: "Good add-ons or pairings", text: "When you'd suggest them" }
];

// ids stay put when a treatment is renamed, so answers she already saved still show
export const TREATMENT_AFTERCARE = [
  { id: "facials", title: "Facials" },
  { id: "procell", title: "ProCell Microchanneling" },
  { id: "light-peel", title: "Refresh Peel (no downtime)" },
  { id: "medium-peel", title: "Corrective Peel (medium depth)" },
  { id: "dermaplaning", title: "Dermaplaning" },
  { id: "waxing", title: "Waxing (brows, lip, underarms and body)" },
  { id: "brazilian", title: "Brazilian, bikini and the mini vajacial" }
];

export const AFTERCARE_FIELDS = [
  { key: "first24", kind: "text", q: "The first 24 hours", hint: "What to do and not do right after." },
  { key: "week", kind: "text", q: "The first week" },
  { key: "normal", kind: "text", q: "What's normal", hint: "Redness, flaking, bumps, tenderness: what you tell clients not to worry about." },
  { key: "not_normal", kind: "text", q: "What isn't normal", hint: "The signs that mean they should message you, or see a doctor." }
];

// The exact questions clients text her, so the assistant can answer them in
// her words. (Pregnancy, medications, reactions and named conditions are not
// here on purpose: those always go to her.)
export const CLIENT_QUESTION_GROUPS = [
  { id: "cq-before", title: "Before a visit", questions: [
    { key: "stop_products", q: "\"Do I need to stop my products before my facial? Which ones, and for how long?\"" },
    { key: "period", q: "\"Can I still come in if I'm on my period?\"" },
    { key: "breaking_out", q: "\"I'm breaking out right now. Should I still come in?\"" },
    { key: "hair_length", q: "\"How long does my hair need to be for a wax?\"" },
    { key: "shave_before", q: "\"Should I shave or trim before my wax?\"" },
    { key: "sun_before", q: "\"I'm going on vacation / I just got some sun. Can I still get my treatment?\"" },
    { key: "first_wax", q: "\"It's my first Brazilian. Any tips?\"" }
  ] },
  { id: "cq-after", title: "Right after a visit", questions: [
    { key: "makeup_after", q: "\"When can I wear makeup again?\"" },
    { key: "workout_after", q: "\"Can I work out, swim, sauna or do hot yoga after?\"" },
    { key: "wash_after", q: "\"When can I wash my face, and with what?\"" },
    { key: "breakout_after", q: "\"I broke out after my facial. Is that normal?\"" },
    { key: "peeling_after", q: "\"My skin is peeling after my peel. What do I do?\"" },
    { key: "actives_after", q: "\"When can I go back to my retinol or acids?\"" },
    { key: "bumps_after_wax", q: "\"I have little bumps after my wax. What should I do?\"" }
  ] },
  { id: "cq-routine", title: "Routines and products", questions: [
    { key: "own_products", q: "\"Can I keep using my own products with the ones you gave me?\"" },
    { key: "buy_everything", q: "\"Do I need everything you recommended, or what should I start with?\"" },
    { key: "sunscreen", q: "\"Which sunscreen should I use?\"" },
    { key: "run_out", q: "\"I'm running out before my next visit. What should I do?\"" },
    { key: "how_long_lasts", q: "\"How long does a bottle usually last?\"" },
    { key: "missed_days", q: "\"I skipped my routine for a few days. Do I start over?\"" },
    { key: "travel", q: "\"I'm traveling. What should I bring?\"" }
  ] },
  { id: "cq-results", title: "Results and how often", questions: [
    { key: "how_many_facials", q: "\"How many facials until I see a difference?\"" },
    { key: "how_often_facial", q: "\"How often should I get a facial?\"" },
    { key: "acne_how_long", q: "\"How long until my acne clears up?\"" },
    { key: "wax_how_often", q: "\"How often should I get waxed? How long does it last?\"" },
    { key: "wax_pain", q: "\"Does waxing hurt less over time?\"" },
    { key: "between_visits", q: "\"What can I do between visits to keep my results?\"" }
  ] },
  { id: "cq-booking", title: "Booking and the day itself", questions: [
    { key: "switch_treatment", q: "\"Can I switch to a different treatment when I get there?\"" },
    { key: "add_on_day", q: "\"Can I add something on the day, like dermaplaning?\"" },
    { key: "with_friend", q: "\"Can I book with a friend, back to back?\"" },
    { key: "which_facial", q: "\"I don't know which facial to book. Which one is for me?\"" }
  ] }
];

// Visits and the studio: the practical questions before someone walks in
export const VISIT_FIELDS = [
  { key: "wear_bring", kind: "text", q: "What should they wear or bring?" },
  { key: "makeup_arrive", kind: "one", q: "Can they arrive wearing makeup?", options: ["Yes, I'll remove it", "Please come bare-faced", "Light makeup is fine"], text: "Anything else" },
  { key: "guests", kind: "text", q: "Can they bring a friend, partner or child?" },
  { key: "first_visit", kind: "text", q: "What happens at a first visit, from the moment they arrive?" },
  { key: "teens", kind: "one", q: "Do you see clients under 18?", options: ["Yes, with a parent there", "Yes, with signed consent", "16 and up only", "No"], text: "What they need" },
  { key: "men", kind: "text", q: "Anything different for men?" },
  { key: "payment_other", kind: "text", q: "Ways to pay beyond cash and card", hint: "Zelle, Venmo, HSA/FSA cards, payment plans: only what you take." },
  { key: "product_returns", kind: "text", q: "Product returns and exchanges", hint: "Opened, unopened, a reaction, a wrong order." },
  { key: "reply_time", kind: "text", q: "How fast you usually reply, and the best way to reach you" },
  { key: "anything_else", kind: "text", q: "Anything else clients always ask before a visit" }
];

// Anything she already has written somewhere: screenshots teach the assistant too
export const MATERIALS_FIELDS = [
  { key: "what", kind: "text", q: "What are these, and when do you use them?", hint: "For example: my aftercare card for peels, the product guide I text new acne clients, my Instagram FAQ highlight." }
];

export const ROUTINE_FIELDS = [
  { key: "order", kind: "text", q: "The order of steps, morning and night", hint: "Cleanser, toner, serum, treatment, moisturizer, SPF: in your words, with anything that changes it." },
  { key: "mandelic", kind: "text", q: "Starting the mandelic serums", hint: "Which strength first (5%, 8%, 11%, 15%), how often, and when to move up." },
  { key: "acne_med", kind: "text", q: "Starting the Advanced Acne Med", hint: "2.5% vs. 5%, how much, how often, and how to build up." },
  { key: "retinal_vs_retinol", kind: "text", q: "Retinal B3 Serum vs. Retinol Peptide Serum", hint: "Who gets which, and how to start." },
  { key: "dont_mix", kind: "text", q: "What not to mix, or not on the same night" },
  { key: "sun", kind: "text", q: "Anything you always say about sunscreen" },
  { key: "stop_signs", kind: "text", q: "When should a client stop a product and message you?", hint: "Once, for every product: it goes on the first page of your product guide." }
];

export const HARD_LINE_OPTIONS = [
  "Pregnancy or breastfeeding", "Accutane, past or present", "Prescription retinoids or antibiotics", "Any other prescription",
  "A reaction, rash, burning or swelling", "Eczema, rosacea, psoriasis or another condition", "Cold sores", "Clients under 18",
  "Anything about results or guarantees", "Discounts or price exceptions"
];

export const HARD_LINE_FIELDS = [
  { key: "always_evelyn", kind: "multi", q: "The assistant must never answer these. It always hands them to you.", options: HARD_LINE_OPTIONS, text: "Anything else that should always come to you" },
  { key: "handoff_wording", kind: "text", q: "What should it say while handing a question to you?", hint: "One or two sentences, in your words. For example, that you'll answer personally and when." },
  { key: "never_say", kind: "text", q: "Anything it should never say or promise?", hint: "Words, claims, comparisons, brands." }
];

export const VOICE_FIELDS = [
  { key: "replies", kind: "list", count: 10, q: "Real replies you've sent clients", hint: "Paste 5 to 10, with names removed. These teach the assistant how you talk." },
  { key: "words_use", kind: "text", q: "Words and phrases you use a lot" },
  { key: "words_avoid", kind: "text", q: "Words you never use" },
  { key: "signoff", kind: "one", q: "How do you sign off?", options: ["— Evelyn", "xo, Evelyn", "Evelyn", "No sign-off"], text: "Or something else" },
  { key: "emoji", kind: "one", q: "Emoji?", options: ["Never", "Sometimes, one at most", "Often"] },
  { key: "greeting", kind: "one", q: "How do you open a reply?", options: ["Hi [name]!", "Hey [name],", "Hello [name],", "Straight to the answer"], text: "Or something else" }
];

// One card per product on her shelf. The answers feed the assistant, the
// lessons' "On Evelyn's shelf", and her take-home product guide (a PDF:
// knowledge/scripts/build-product-guide.mjs), so each card asks what a client
// needs at home: when, how, what's normal, when to stop. The options are
// timings and signs she picks from, never a claim about the product; a photo
// of the back of the bottle puts the label's own directions and warnings in
// the guide word for word. "Same as" lets the other strengths and sizes copy
// a product she has answered, so she only writes what's different.
export const PRODUCT_FIELDS = [
  { key: "like", kind: "products", q: "Same as another product?", hint: "For another strength or size of something you've answered: tap it, then fill in only what's different." },
  { key: "who", kind: "text", q: "Who is it for?", hint: "The skin and concern you reach for it with." },
  { key: "when", kind: "one", q: "When do they use it?", options: ["Morning", "Night", "Morning and night", "A few nights a week", "Once or twice a week", "As a spot treatment"], text: "Anything that changes it" },
  { key: "how", kind: "text", q: "How to use it", hint: "How much, where it goes in the routine, and how to start: the first week, and when they can use it more." },
  { key: "normal", kind: "text", q: "What's normal when they start", hint: "A tingle, a little dryness, purging: what you tell them not to worry about. Leave it empty if nothing." },
  { key: "stop", kind: "multi", q: "When should they stop using it and message you?", options: ["Burning or stinging that doesn't settle", "A rash or hives", "Swelling", "Peeling or cracking that keeps going", "Anything that feels wrong to them"], text: "In your words, or anything else" },
  { key: "pause", kind: "one", q: "Pause it before a treatment?", options: ["No need to pause", "2 to 3 days before", "3 to 5 days before", "A week before"], text: "Which treatments, and when they can start it again" },
  { key: "sun", kind: "one", q: "Sun care with this one", options: ["Their usual daily SPF", "SPF every morning is a must with this", "Night only, because of the sun"], text: "Anything else" },
  { key: "pregnancy", kind: "one", q: "Pregnant or breastfeeding?", options: ["Fine to keep using", "Pause it", "Check with their doctor first", "Ask me first"], text: "Anything else" },
  { key: "pairs", kind: "text", q: "Pairs well with, and what not to use it with" },
  { key: "tip", kind: "text", q: "Your tip", hint: "What you tell clients at the counter." },
  { key: "lasts", kind: "text", q: "How long it usually lasts" }
];

// Skin School: each module's lessons, as they read now (docs/school/curriculum.js).
// She says whether it's how she'd teach it, or what to change, and adds her
// own tip, which shows in the lesson as "Evelyn says" (build-course-notes.mjs).
// The cards are built from the curriculum at build time, one per module.
export const SCHOOL_FIELDS = (ls) => [
  { key: ls.id + "_ok", kind: "one", q: `Lesson ${ls.id}, ${ls.t}`, hint: ls.sum + " " + ls.learn.join(" ") + " Try this: " + ls.try,
    options: ["Yes, that's how I'd teach it", "Change something"], text: "What would you change?" },
  { key: ls.id + "_tip", kind: "text", q: `Your tip for lesson ${ls.id}`, hint: "Optional. What you tell clients about this, in your words.", rows: 2 }
];

export const SECTIONS = [
  { id: "client-questions", title: "Questions clients ask", intro: "The exact texts you get, answered once, in your words. Every one you answer is one the assistant can handle for you. Screenshots of your old replies work too." },
  { id: "concerns", title: "Skin concerns", intro: "One at a time. Skip any you don't see much; come back whenever you like." },
  { id: "treatments", title: "Treatments, explained", intro: "What clients ask before they book: how it feels, how they'll look after, how often to come back." },
  { id: "aftercare", title: "Aftercare", intro: "What you tell clients after each treatment." },
  { id: "visits", title: "Visits and the studio", intro: "The practical questions before someone walks in." },
  { id: "routine", title: "Your products, in order", intro: "How a routine fits together, and how clients start the stronger products." },
  { id: "products", title: "Your product guide", intro: "One card per product on your shelf. Your answers become the product guide clients take home (a PDF) and what the assistant says about each product: when to use it, how, what's normal, and when to stop. Start with the ones you sell most. Add a photo of the back of the bottle and its directions and warnings go in the guide word for word. For another strength or size, tap Same as and fill in only what's different." },
  { id: "school", title: "Skin School", intro: "Your course, lesson by lesson, as it reads now. Tap Yes if it's how you'd teach it, or say what to change. Add your own tip and it shows in the lesson as \"Evelyn says\"." },
  { id: "materials", title: "Your materials", intro: "Anything you already have written: aftercare cards, product guides, your GlossGenius descriptions, Instagram FAQ highlights, texts you send a lot. Add screenshots and the assistant learns from them." },
  { id: "hard-lines", title: "Hard lines", intro: "What the assistant must never answer for you." },
  { id: "voice", title: "Your voice", intro: "So it sounds like you, not a robot." }
];

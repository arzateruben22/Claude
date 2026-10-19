// Evelyn's Skin Playbook: the questions, in one place.
//
// Everything else is generated from this file:
//   build-playbook.mjs   the questionnaire page she fills in (an artifact link)
//   build-playbook.mjs   PLAYBOOK-QUESTIONS.md, the same questions as a document
//   make-templates.mjs   the empty knowledge files her answers fill
//   import-playbook.mjs  her saved answers → knowledge/*.md
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
  { id: "ingrown-hairs", title: "Ingrown hairs after waxing" }
];

export const CONCERN_FIELDS = [
  { key: "first_questions", kind: "text", q: "What do you ask a client first?", hint: "The questions that tell you what's really going on." },
  { key: "morning", kind: "products", q: "Morning: what do you recommend from your shelf?", hint: "Tap products, then add how to use them." },
  { key: "night", kind: "products", q: "Night: what do you recommend from your shelf?" },
  { key: "avoid", kind: "text", q: "What should they avoid?", hint: "Products, habits, ingredients, mixing." },
  { key: "timeline", kind: "one", q: "How long until they see results?", options: ["About 2 weeks", "4 to 6 weeks", "2 to 3 months", "3 to 6 months", "It varies a lot"], text: "What to expect along the way" },
  { key: "facial", kind: "treatments", q: "When should they book a facial, and which one?", text: "When, and how often" },
  { key: "escalate", kind: "text", q: "When must this come to you, or to a doctor?", hint: "The signs that mean the assistant should stop and hand it to you." }
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

export const ROUTINE_FIELDS = [
  { key: "order", kind: "text", q: "The order of steps, morning and night", hint: "Cleanser, toner, serum, treatment, moisturizer, SPF: in your words, with anything that changes it." },
  { key: "mandelic", kind: "text", q: "Starting the mandelic serums", hint: "Which strength first (5%, 8%, 11%, 15%), how often, and when to move up." },
  { key: "acne_med", kind: "text", q: "Starting the Advanced Acne Med", hint: "2.5% vs. 5%, how much, how often, and how to build up." },
  { key: "retinal_vs_retinol", kind: "text", q: "Retinal B3 Serum vs. Retinol Peptide Serum", hint: "Who gets which, and how to start." },
  { key: "dont_mix", kind: "text", q: "What not to mix, or not on the same night" },
  { key: "sun", kind: "text", q: "Anything you always say about sunscreen" }
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

export const PRODUCT_FIELDS = [
  { key: "who", kind: "text", q: "Who is it for?", hint: "The skin and concern you reach for it with." },
  { key: "how", kind: "text", q: "How to use it", hint: "Amount, when, how often, how to start." },
  { key: "tip", kind: "text", q: "Your tip", hint: "What you tell clients at the counter." }
];

export const SECTIONS = [
  { id: "concerns", title: "Skin concerns", intro: "One at a time. Skip any you don't see much; come back whenever you like." },
  { id: "aftercare", title: "Aftercare", intro: "What you tell clients after each treatment." },
  { id: "routine", title: "Your products, in order", intro: "How a routine fits together, and how clients start the stronger products." },
  { id: "products", title: "Product by product", intro: "Optional. A line or two per product, in your words. Label facts are already on the site." },
  { id: "hard-lines", title: "Hard lines", intro: "What the assistant must never answer for you." },
  { id: "voice", title: "Your voice", intro: "So it sounds like you, not a robot." }
];

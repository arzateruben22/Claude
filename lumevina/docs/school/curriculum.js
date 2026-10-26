/* Lumevina Skin School — the curriculum.
 *
 * Three levels, fourteen modules, forty lessons. Each lesson is what
 * Evelyn covers on camera (about 6 to 12 minutes), written out as notes:
 *   sum    what the lesson is about, in a sentence or two
 *   learn  the points it teaches
 *   try    something to do at home before the next lesson
 *   q      a one-question check: ask, three options, the answer's index, why
 *
 * Drafted from mainstream dermatology guidance (AAD, FDA) and the way
 * Lumevina already works (Face Reality for acne, GlyMed+ and Le Mieux on the
 * shelf, California esthetics scope). Under each lesson the player adds
 * notes.js (knowledge/scripts/build-course-notes.mjs): Evelyn's own playbook
 * answers where she has them, the general esthetics layer, and her shelf;
 * and a diagram from visuals.js where one exists. Evelyn reviews every
 * lesson before she records it: anything medical points to a dermatologist
 * or doctor.
 */
window.SCHOOL = {
  /* the five free lessons, in the order a new visitor takes them: each has a film-style explainer
     that ends on the next one, and the fifth on the rest of the course */
  free: ["8-2", "2-1", "11-1", "10-1", "9-3"],
  levels: [
    {
      n: 1, id: "basics", name: "Skin Basics", tag: "Beginner", art: "barrier",
      h: "Know your skin.", dim: "Then keep it simple.",
      blurb: "How skin works, your real skin type, and a three-step routine you can keep.",
      outcome: "You leave with a routine that fits your skin, and you know why each step is there.",
      modules: [
        {
          name: "How skin works", art: "layers",
          lessons: [
            { id: "1-1", t: "Your skin in ten minutes", min: 2,
              sum: "Skin keeps water in and the world out. Here's how.",
              learn: [
                "The epidermis on top is where home care works; the dermis below holds collagen, oil and blood.",
                "New cells reach the surface in about four weeks, slower with age.",
                "The surface is slightly acidic, about pH 5. Anything deeper is medical, not a facial."
              ],
              try: "Tomorrow morning, look at your bare skin in daylight.",
              q: { ask: "Roughly how long does it take a new skin cell to reach the surface in your twenties?", opts: ["About 4 days", "About 4 weeks", "About 4 months"], a: 1,
                why: "About four weeks, so judge a routine after a month." } },
            { id: "1-2", t: "Find your real skin type", min: 2,
              sum: "Type is how much oil you make; condition is what's happening now.",
              learn: [
                "Four types: dry, oily, combination (an oily T-zone) and normal.",
                "Conditions come and go: dehydrated, sensitive, acne-prone. Oily skin can be dehydrated.",
                "The test: cleanse, apply nothing, look at one hour. Check again every few months."
              ],
              try: "Do the bare-face test and note what you see.",
              q: { ask: "Your forehead and nose shine by noon but your cheeks feel tight. Your skin type is most likely:", opts: ["Oily", "Combination", "Dry"], a: 1,
                why: "An oily T-zone with drier cheeks is combination." } },
            { id: "1-3", t: "The barrier: why less is more", min: 2,
              sum: "Your barrier is bricks and mortar. Damage it and everything stings.",
              learn: [
                "Bricks are skin cells; mortar is ceramides, cholesterol and fatty acids.",
                "Damage shows as new stinging, tightness, redness, flaking or sudden breakouts.",
                "Repair: gentle cleanser, ceramide moisturizer and SPF, no actives, for two weeks."
              ],
              try: "Count your weekly acids, retinoids and scrubs. Over three? Cut back.",
              q: { ask: "Which of these is a sign of a damaged barrier?", opts: ["Your moisturizer suddenly stings", "Your skin looks dewy after SPF", "You have a few freckles"], a: 0,
                why: "Sudden stinging means the barrier is letting things through." } }
          ]
        },
        {
          name: "The core routine", art: "routine",
          lessons: [
            { id: "2-1", t: "Cleansing, done right", min: 2, free: true,
              sum: "Take off the day without stripping the skin.",
              learn: [
                "Gel or foam for oily skin; cream or milk for dry and sensitive.",
                "Lukewarm water and a full 60-second massage.",
                "Wore SPF or makeup? Oil or balm first, then your cleanser. Squeaky means too strong."
              ],
              try: "Time tonight's cleanse. Aim for 60 seconds.",
              q: { ask: "When does a double cleanse make the most sense?", opts: ["Every morning", "At night after sunscreen or makeup", "Only when you have a breakout"], a: 1,
                why: "The first cleanse melts sunscreen and makeup; the second cleans the skin." } },
            { id: "2-2", t: "Moisturizer, decoded", min: 2,
              sum: "Every moisturizer mixes three kinds of ingredients.",
              learn: [
                "Humectants pull water in: glycerin, hyaluronic acid, urea.",
                "Emollients soften (squalane, ceramides); occlusives seal (petrolatum, shea butter).",
                "Oily skin: a light gel. Dry skin: a richer cream. Everyone needs one."
              ],
              try: "Label your moisturizer's first five ingredients by type.",
              q: { ask: "Hyaluronic acid is a:", opts: ["Humectant", "Occlusive", "Exfoliant"], a: 0,
                why: "A humectant: it draws water in. It doesn't exfoliate." } },
            { id: "2-3", t: "Sunscreen, the anti-aging step", min: 2,
              sum: "Daily sunscreen does more for your skin than any serum.",
              learn: [
                "Broad spectrum SPF 30 or higher, every day. UVA passes through clouds and windows.",
                "A quarter teaspoon for the face; reapply every two hours outdoors.",
                "Mineral filters suit sensitive skin; tinted ones with iron oxides also help melasma."
              ],
              try: "Measure two finger-lengths tomorrow. It's likely double your usual.",
              q: { ask: "How often should you reapply sunscreen when you're outdoors?", opts: ["Once a day is enough", "About every two hours", "Only if you burn"], a: 1,
                why: "Sweat, touch and time wear it off: reapply every two hours outdoors." } }
          ]
        },
        {
          name: "Shopping smart", art: "label",
          lessons: [
            { id: "3-1", t: "How to read a label", min: 2,
              sum: "Skip the front of the bottle. Read the back.",
              learn: [
                "Ingredients run from most to least, down to 1%.",
                "The first five are most of the formula; anything after fragrance is a trace.",
                "\"Clean\", \"natural\" and \"hypoallergenic\" have no legal definition. Fragrance can hide dozens."
              ],
              try: "Find where your favorite product's star ingredient falls.",
              q: { ask: "The \"hero\" ingredient is listed after fragrance. That usually means:", opts: ["There's very little of it", "It's the main ingredient", "It's been tested more"], a: 0,
                why: "Fragrance is usually under 1%, so what follows it is tiny." } },
            { id: "3-2", t: "Build your first routine", min: 2,
              sum: "Three steps morning and night. Actives later, one at a time.",
              learn: [
                "Morning: cleanse (or just rinse), moisturize, sunscreen.",
                "Night: cleanse, treat once your skin is calm, moisturize.",
                "One new product every two weeks, patch tested on the jaw for 7 to 10 days."
              ],
              try: "Write your routine from what you own. Circle the extras.",
              q: { ask: "How long should you wait before adding a second new product?", opts: ["A day", "About two weeks", "Six months"], a: 1,
                why: "Long enough to see a reaction, short enough to keep going." } },
            { id: "3-3", t: "Habits that matter more than products", min: 2,
              sum: "Daily habits beat any single product.",
              learn: [
                "Change pillowcases twice a week and wipe your phone often.",
                "Keep hot showers short; wash your face at the sink.",
                "Hands off: picking turns a two-day pimple into a two-month mark."
              ],
              try: "Pick one habit and keep it seven days straight.",
              q: { ask: "Why does picking a pimple usually make things worse?", opts: ["It pushes bacteria deeper and can leave a dark mark", "It makes the pimple smaller", "It has no effect"], a: 0,
                why: "Squeezing pushes infection deeper and leaves marks for weeks." } }
          ]
        }
      ]
    },
    {
      n: 2, id: "actives", name: "Actives & Routines", tag: "Intermediate", art: "week",
      h: "Actives, in order.", dim: "The right one, the right night.",
      blurb: "Acids, vitamin C and retinoids: what each one does, how to layer them, and a weekly plan.",
      outcome: "You know which actives your skin needs, how to layer them, and how to build up without irritation.",
      modules: [
        {
          name: "Exfoliation", art: "acid",
          lessons: [
            { id: "4-1", t: "AHAs, BHAs and PHAs", min: 2,
              sum: "Chemical exfoliants loosen dead cells. Each family works differently.",
              learn: [
                "AHAs (glycolic, lactic, mandelic) work on the surface; glycolic is the strongest.",
                "BHA (salicylic acid) gets into oily pores: the one for blackheads.",
                "PHAs are the gentlest. Any acid means sunscreen every morning."
              ],
              try: "Spot the acids in your products: glycolic, lactic, mandelic, salicylic.",
              q: { ask: "Which exfoliant gets inside oily pores best?", opts: ["Glycolic acid", "Salicylic acid", "Hyaluronic acid"], a: 1,
                why: "Salicylic acid dissolves in oil, so it works inside the pore." } },
            { id: "4-2", t: "How often, and how much", min: 2,
              sum: "More exfoliation isn't better. It's the top way barriers break.",
              learn: [
                "Start with a few nights a week and build up only as your skin allows. Moving up is Evelyn's call.",
                "Burning, stinging, plastic-looking shine or flaking: back off and message Evelyn.",
                "Never an acid and a retinoid, or two exfoliants, on the same night; none the week around a peel."
              ],
              try: "Put your first exfoliating nights on your calendar, not back to back.",
              q: { ask: "Your skin looks tight and shiny like plastic after a week of daily acids. What should you do?", opts: ["Add a stronger acid", "Stop acids and focus on repair for a week or two", "Scrub harder"], a: 1,
                why: "Plastic shine means over-exfoliated. Rest with the basics." } },
            { id: "4-3", t: "Scrubs, brushes and dermaplaning", min: 2,
              sum: "Physical exfoliation is kind or harsh: it's the tool and the pressure.",
              learn: [
                "Skip jagged scrubs. A soft washcloth or enzyme mask polishes safely.",
                "Professional dermaplaning removes dead skin and peach fuzz.",
                "At home: clean dry skin, a fresh blade, light strokes, monthly at most, never on breakouts."
              ],
              try: "Sandy, sharp scrub? Swap it for an enzyme mask.",
              q: { ask: "When should you never dermaplane?", opts: ["Over active breakouts", "On clean, dry skin", "Once a month"], a: 0,
                why: "A blade over a breakout spreads bacteria and irritates it." } }
          ]
        },
        {
          name: "The power ingredients", art: "drops",
          lessons: [
            { id: "5-1", t: "Vitamin C", min: 2,
              sum: "Morning vitamin C brightens and backs up your sunscreen.",
              learn: [
                "L-ascorbic acid at 10 to 20% is the best studied.",
                "Apply it in the morning, before moisturizer and SPF.",
                "Brown means it has oxidized. A tingle is normal; burning is not."
              ],
              try: "Check the color: pale straw is good, brown means replace.",
              q: { ask: "When is vitamin C usually used?", opts: ["In the morning, under sunscreen", "Only at night", "Mixed into your cleanser"], a: 0,
                why: "In the morning it works with your sunscreen against the day." } },
            { id: "5-2", t: "Retinoids, without the drama", min: 2,
              sum: "The best-studied ingredient for aging and acne. Start slowly.",
              learn: [
                "Retinol and retinal over the counter, adapalene for acne, tretinoin by prescription.",
                "Pea-size, two or three nights a week; add a night every two weeks.",
                "Sandwich it between moisturizer. Pause if pregnant or breastfeeding."
              ],
              try: "Measure one pea-size amount tonight.",
              q: { ask: "What's the best way to start a retinoid?", opts: ["Every night from day one", "Two or three nights a week, a pea-size amount", "Twice a day for faster results"], a: 1,
                why: "A slow start lets skin adjust without peeling and redness." } },
            { id: "5-3", t: "The supporting cast", min: 2,
              sum: "The quiet ingredients that help everything else work.",
              learn: [
                "Niacinamide (2 to 5%) calms redness, balances oil and pairs with almost anything.",
                "Hyaluronic acid on damp skin, sealed in; azelaic acid fades marks gently.",
                "Benzoyl peroxide kills acne bacteria and bleaches fabric: use white towels."
              ],
              try: "Find one of these already in your routine.",
              q: { ask: "Where should hyaluronic acid go?", opts: ["On damp skin, sealed with moisturizer", "On bone-dry skin with nothing over it", "Mixed into sunscreen"], a: 0,
                why: "It needs water to hold, and moisturizer keeps that water in." } }
          ]
        },
        {
          name: "Layering and scheduling", art: "stack",
          lessons: [
            { id: "6-1", t: "The order of things", min: 2,
              sum: "Thinnest to thickest, water before oil, sunscreen last.",
              learn: [
                "Morning: cleanser, toner, vitamin C, serum, eye cream, moisturizer, SPF.",
                "Night: cleanser, toner, treatment, serum, eye cream, moisturizer, oil.",
                "Give actives a minute. Oils go last: nothing gets through them."
              ],
              try: "Line your products up in order tonight.",
              q: { ask: "In the morning, what goes last?", opts: ["Vitamin C", "Moisturizer", "Sunscreen"], a: 2,
                why: "Last in the morning, it forms an even layer on top." } },
            { id: "6-2", t: "What not to mix", min: 2,
              sum: "Most mixing rules are myths. A few are real.",
              learn: [
                "Real: a retinoid and an acid, or two exfoliants, never on the same night. Alternate them.",
                "Real: benzoyl peroxide and retinol, never on the same night either.",
                "Myth: vitamin C and niacinamide cancel out. Unsure? Split morning and night."
              ],
              try: "Find any acid-and-retinoid nights and split them.",
              q: { ask: "Vitamin C and niacinamide together:", opts: ["Cancel each other out", "Work fine together in modern formulas", "Always cause a rash"], a: 1,
                why: "An old pure-ingredient lab result; modern formulas pair fine." } },
            { id: "6-3", t: "Your weekly plan, and purging", min: 2,
              sum: "A four-night rhythm, and purging versus a bad reaction.",
              learn: [
                "The cycle: exfoliate, retinoid, then two recovery nights.",
                "Purging comes from actives, in your usual spots, and clears in four to six weeks.",
                "New spots, or no actives? A reaction. Judge any routine at 8 to 12 weeks."
              ],
              try: "Put this week's four-night cycle on your mirror.",
              q: { ask: "You started a new moisturizer with no actives and broke out on your cheeks, where you never break out. This is most likely:", opts: ["Purging, so keep going", "A reaction or clogging, so stop it", "Normal aging"], a: 1,
                why: "Purging only comes from actives, in your usual spots. This isn't it." } }
          ]
        },
        {
          name: "The at-home facial", art: "massage",
          lessons: [
            { id: "7-1", t: "The Sunday ritual", min: 2,
              sum: "A 20-minute facial at home, between visits.",
              learn: [
                "Double cleanse, then a minute of warm-towel steam (skip it with redness).",
                "Exfoliate unless it's an acid night, then a mask: clay for oily, cream for dry.",
                "Massage in your serum and moisturize. No extractions at home."
              ],
              try: "Block 20 minutes this Sunday.",
              q: { ask: "Which step should stay in the treatment room?", opts: ["Extractions", "Moisturizing", "A clay mask"], a: 0,
                why: "Extractions need training and clean tools, or they scar." } },
            { id: "7-2", t: "Facial massage and gua sha", min: 2,
              sum: "Gentle massage moves fluid and wakes the skin up.",
              learn: [
                "Always use slip, an oil or rich serum. Never drag dry skin.",
                "Work from the center outward, then down the neck to the lymph nodes.",
                "Light pressure, never marks. Skip breakouts, broken skin and fresh peels."
              ],
              try: "Two minutes tonight: forehead, cheeks, jaw, down the neck.",
              q: { ask: "Which direction do you usually move for lymphatic massage?", opts: ["Inward toward the nose", "Outward and down toward the neck", "In small hard circles"], a: 1,
                why: "Lymph drains to the nodes at the jaw and neck." } },
            { id: "7-3", t: "Skin through the seasons", min: 2,
              sum: "Your routine should change with the weather. The Valley has plenty.",
              learn: [
                "Summer: a gel moisturizer, sunscreen reapplied more, blotting papers.",
                "Santa Anas and winter: a richer cream, fewer acid nights, a humidifier.",
                "Travel: no new actives, pack the basics. A skin check every season."
              ],
              try: "Write one change you'll make this season.",
              q: { ask: "During dry Santa Ana winds, you'd usually:", opts: ["Add more acid nights", "Use a richer moisturizer and fewer acids", "Stop moisturizing"], a: 1,
                why: "Dry wind pulls water out: protect the barrier, ease off acids." } }
          ]
        }
      ]
    },
    {
      n: 3, id: "treat", name: "Treat Your Concern", tag: "Advanced", art: "progress",
      h: "Treat what bugs you.", dim: "Acne, spots and time.",
      blurb: "Acne, dark spots, aging and sensitive skin: what's really going on, and a plan that works.",
      outcome: "You have a plan for your main concern and you know when to see a dermatologist.",
      modules: [
        {
          name: "Acne", art: "acne",
          lessons: [
            { id: "8-1", t: "How acne really forms", min: 2,
              sum: "Acne is four things going wrong at once.",
              learn: [
                "Oil, dead cells clogging the pore, acne bacteria and inflammation.",
                "Blackheads and whiteheads are clogged; red and pus-filled bumps are inflamed.",
                "Cysts can scar: see a dermatologist. Results take two to three months."
              ],
              try: "Map a week of breakouts: where, and what kind.",
              q: { ask: "Deep, painful cysts along the jaw that keep coming back should be seen by:", opts: ["A dermatologist", "Nobody, they go away", "Just a stronger scrub"], a: 0,
                why: "Cysts can scar and often need prescription care." } },
            { id: "8-2", t: "The acne-safe routine", min: 2, free: true,
              sum: "Evelyn's Face Reality routine: clear the pores, stop re-clogging.",
              learn: [
                "Check every product for pore-cloggers like coconut oil and isopropyl myristate.",
                "Benzoyl peroxide or a mandelic or salicylic wash, raised slowly.",
                "Never skip a non-clogging moisturizer. Treatments every two weeks, then monthly."
              ],
              try: "Check your moisturizer, SPF and makeup against the list.",
              q: { ask: "Your skin is oily and breaking out. Should you skip moisturizer?", opts: ["Yes, it adds oil", "No, dry skin makes more oil and irritation", "Only on weekends"], a: 1,
                why: "Stripped skin makes more oil. Use a light, non-clogging one." } },
            { id: "8-3", t: "Food, hormones and habits", min: 2,
              sum: "Food, hormones and habits: what's actually proven.",
              learn: [
                "Sugar and dairy, especially skim milk, link to breakouts in some people.",
                "Hormonal acne flares along the jaw and chin with your cycle.",
                "Rinse after the gym. Helmets, phones and hair products can clog where they touch."
              ],
              try: "Track food, cycle and breakouts for two weeks.",
              q: { ask: "Breakouts mostly along the jaw that come and go with your cycle suggest:", opts: ["Hormonal acne", "A sunscreen allergy", "Dehydration only"], a: 0,
                why: "Jaw and chin flares with your cycle are classic hormonal acne." } }
          ]
        },
        {
          name: "Dark spots and even tone", art: "pigment",
          lessons: [
            { id: "9-1", t: "Three kinds of dark spots", min: 2,
              sum: "Three kinds of dark spots, three different plans.",
              learn: [
                "Sun spots come from years of UV, on the cheeks, forehead and hands.",
                "Post-breakout marks last longer in deeper skin tones; red marks are vessels and fade.",
                "Melasma: matching patches, set off by sun, heat, light and hormones."
              ],
              try: "In daylight: brown or red? Scattered or matching?",
              q: { ask: "Matching brown patches on both cheeks that get darker in summer are most likely:", opts: ["Melasma", "Blackheads", "A sunburn"], a: 0,
                why: "Matching patches that react to sun and heat are melasma." } },
            { id: "9-2", t: "Brighteners that work", min: 2,
              sum: "The brighteners with real evidence, and how to pair them.",
              learn: [
                "Vitamin C, niacinamide, azelaic and tranexamic acid: two work better than one.",
                "Retinoids speed turnover. Hydroquinone is prescription-only in the US since 2020.",
                "Without sunscreen, one afternoon undoes a month of fading."
              ],
              try: "Pick one brightener for morning and one for night.",
              q: { ask: "What undoes a month of fading fastest?", opts: ["Skipping sunscreen", "Drinking water", "A gentle cleanser"], a: 0,
                why: "UV restarts pigment right away. Sunscreen protects the progress." } },
            { id: "9-3", t: "Heat, light and patience", min: 2, free: true,
              sum: "Pigment is slow. Here's how to keep it from coming back.",
              learn: [
                "It fades in months: compare photos in the same light every four weeks.",
                "Heat darkens melasma too: hot yoga, saunas, the stove.",
                "Tinted mineral SPF blocks visible light. Peels only in expert hands."
              ],
              try: "Take a progress photo today. Check again in four weeks.",
              q: { ask: "Which sunscreen is best for melasma?", opts: ["A tinted mineral one with iron oxides", "Any SPF 15", "No sunscreen indoors"], a: 0,
                why: "Iron oxides block the visible light that darkens melasma." } }
          ]
        },
        {
          name: "Aging well", art: "age",
          lessons: [
            { id: "10-1", t: "What actually ages skin", min: 2, free: true,
              sum: "Time plays a part. Daily habits matter more.",
              learn: [
                "The sun causes most visible aging: lines, spots, sagging, texture.",
                "Collagen slows from the mid-twenties, faster after menopause.",
                "Smoking, poor sleep and sugar speed it up. Most of it is preventable."
              ],
              try: "Compare your inner arm with the back of your hand.",
              q: { ask: "What's the biggest outside cause of visible facial aging?", opts: ["The sun", "Drinking coffee", "Smiling"], a: 0,
                why: "UV breaks down collagen. Daily SPF is the best anti-aging step." } },
            { id: "10-2", t: "An anti-aging routine that works", min: 2,
              sum: "The short list with real evidence, used every day.",
              learn: [
                "Morning: vitamin C, moisturizer, sunscreen.",
                "Night: a retinoid built up slowly, peptides, a rich moisturizer.",
                "Include your neck, chest and hands. Consistency beats strength."
              ],
              try: "Take your skincare down to your neck tonight.",
              q: { ask: "Which is better for results?", opts: ["A gentle retinoid used consistently", "A strong retinoid once a month", "Switching products every week"], a: 0,
                why: "Retinoids work over months; irritation that makes you stop is the enemy." } },
            { id: "10-3", t: "Professional treatments, explained", min: 2,
              sum: "Who does which treatment, and what makes it work.",
              learn: [
                "An esthetician: facials, light peels, dermaplaning, LED, extractions.",
                "A nurse or doctor: microneedling, lasers, Botox, fillers. Ask who supervises.",
                "Most of the result comes from prep, aftercare and sunscreen."
              ],
              try: "Bring one treatment question to your next visit.",
              q: { ask: "In California, who performs Botox and fillers?", opts: ["Licensed medical providers such as nurses, PAs or doctors", "Any esthetician", "Anyone with a course certificate"], a: 0,
                why: "Injectables are medical, done by licensed providers." } }
          ]
        },
        {
          name: "Sensitive skin and special cases", art: "calm",
          lessons: [
            { id: "11-1", t: "Sensitive and rosacea-prone skin", min: 2, free: true,
              sum: "Reactive skin needs fewer products, not better ones.",
              learn: [
                "Rosacea flares with heat, sun, alcohol, spicy food and stress.",
                "Fragrance-free, short ingredient lists, and patch test everything.",
                "Azelaic acid and niacinamide calm it. Lasting redness: see a dermatologist."
              ],
              try: "Two weeks of cleanser, moisturizer and sunscreen only.",
              q: { ask: "Which is most likely to set off rosacea?", opts: ["A hot sauna", "A cool compress", "Fragrance-free moisturizer"], a: 0,
                why: "Heat is one of the most common triggers." } },
            { id: "11-2", t: "Pregnancy and breastfeeding", min: 2,
              sum: "What to pause in pregnancy, and the one rule: ask your doctor.",
              learn: [
                "Pause every retinoid and high-strength salicylic peels.",
                "Commonly fine: azelaic acid, vitamin C, niacinamide, gentle lactic, mineral SPF.",
                "Melasma is common, so wear tinted mineral SPF. Tell your esthetician."
              ],
              try: "Take your product list to your doctor.",
              q: { ask: "During pregnancy, which should you pause?", opts: ["Retinoids", "Mineral sunscreen", "A gentle cleanser"], a: 0,
                why: "Retinoids are avoided. Check the rest with your doctor." } },
            { id: "11-3", t: "Your skin plan for life", min: 4,
              sum: "Your type, your concern, and a routine you'll keep.",
              learn: [
                "A base plus one or two actives for your concern. Nothing more.",
                "Revisit every season, after life changes, or when it stops working.",
                "Changing moles or sores that won't heal: a dermatologist."
              ],
              try: "Build your plan below and bring it to your visit.",
              builder: true,
              q: { ask: "A mole that's changing shape or color needs:", opts: ["A dermatologist, soon", "A stronger serum", "Nothing"], a: 0,
                why: "Changing moles need a doctor, not a facial." } }
          ]        },
        {
          name: "Before and after a treatment", art: "calm",
          lessons: [
            { id: "12-1", t: "Before your facial, peel or wax", min: 2,
              sum: "A few days of prep make the treatment work.",
              learn: [
                "Pause retinol and acids 3 to 5 days before; a prescription retinoid about a week.",
                "No sunburned or freshly tanned skin, and no trip for two or three days after.",
                "Breakouts are fine; raw or infected skin waits. Tell Evelyn about meds or pregnancy."
              ],
              try: "List your acids and retinoids: that's your pause list.",
              q: { ask: "How long before a peel should you pause over-the-counter retinol?", opts: ["The morning of", "Three to five days", "A month"], a: 1,
                why: "3 to 5 days for retinol and acids, about a week for a prescription." } },
            { id: "12-2", t: "The first 24 hours, and the first week", min: 2,
              sum: "What you keep off treated skin decides the result.",
              learn: [
                "Day one: no makeup, touching, heat, sweat or sun. Gentle cleanse, moisturizer, SPF.",
                "No actives for 2 to 3 days after a facial, 3 to 5 after dermaplaning, a week after a peel or microchanneling.",
                "Let flakes fall. A clean pillowcase, and no waxing or new products for a week."
              ],
              try: "Book nothing sweaty for the day after your visit.",
              q: { ask: "Your skin is flaking on day three after a peel. You should:", opts: ["Exfoliate it off", "Moisturize and let it fall", "Skip sunscreen so it can breathe"], a: 1,
                why: "Pulling flakes leaves dark marks. Let them fall on their own." } },
            { id: "12-3", t: "What's normal, what isn't", min: 2,
              sum: "Pink, tight and flaky is normal. Spreading and heat are not.",
              learn: [
                "Normal: pink for hours, tight for a day or two, light flaking days two to five.",
                "Message Evelyn with a daylight photo: spreading redness, burning, pus.",
                "Swelling, hives or blisters: a doctor today. Trouble breathing: 911."
              ],
              try: "Save Evelyn's contact and the chat where you'll find them.",
              q: { ask: "Which of these means a doctor today, not a message?", opts: ["Pink skin an hour after a facial", "Swelling around the eyes and hives", "A few whiteheads after extractions"], a: 1,
                why: "Swelling and hives need a doctor the same day." } }
          ]
        },
        {
          name: "Waxing, done well", art: "routine",
          lessons: [
            { id: "13-1", t: "Before a wax: length, shaving, timing", min: 2,
              sum: "Most of a good wax happens before you arrive.",
              learn: [
                "A quarter inch, a grain of rice: two to three weeks after shaving.",
                "No shaving between waxes; exfoliate gently a few days before.",
                "Not on sunburned or broken skin, retinoid areas, or during or after Accutane."
              ],
              try: "Measure a grain of rice against your hair before booking.",
              q: { ask: "You shaved a week ago. Your wax should be:", opts: ["Tomorrow", "In one to two more weeks", "Never"], a: 1,
                why: "The wax needs a quarter inch to grip." } },
            { id: "13-2", t: "After a wax: bumps, ingrowns, how often", min: 2,
              sum: "Two calm days, then exfoliate to keep ingrowns away.",
              learn: [
                "For 24 to 48 hours: no heat, sweat, sun, tight clothes or scent.",
                "Small red bumps for a day are normal; spreading pus or a burn is not.",
                "Exfoliate from day three. Rebook every 4 to 6 weeks, no shaving between."
              ],
              try: "Leave an exfoliating mitt out for day three.",
              q: { ask: "The best way to prevent ingrown hairs after a wax is:", opts: ["Tweezing anything you see", "Gentle exfoliation from day two or three, and moisture", "Tight leggings to keep the area smooth"], a: 1,
                why: "Dead skin traps hair: exfoliate and avoid friction." } }
          ]
        },
        {
          name: "Your first visit at Lumevina", art: "layers",
          lessons: [
            { id: "14-1", t: "What happens, and which treatment to book", min: 2,
              sum: "Two questions decide which appointment to book.",
              learn: [
                "New, no acne concerns: New Clients Start Here, with a customized facial.",
                "New, with acne: the Acne Bootcamp, then monthly, or every two weeks if severe.",
                "Returning: the Custom Facial or the Monthly Acne Treatment. Parking is free."
              ],
              try: "Photograph every product you use, for Evelyn.",
              q: { ask: "You're new, with breakouts. You book:", opts: ["New Clients Start Here", "The Acne Bootcamp consultation + treatment", "A peel"], a: 1,
                why: "New clients with acne start with the Acne Bootcamp." } },
            { id: "14-2", t: "Her shelf: how the products fit together", min: 2,
              sum: "How a routine is built from Evelyn's shelf.",
              learn: [
                "The base: cleanser, moisturizer, SPF, plus one treatment for your main concern.",
                "Mandelic serums: the lowest strength first, a few nights a week.",
                "Gel for oily, cream for dry. Evelyn picks yours after a visit."
              ],
              try: "Read the label line on three products in the shop.",
              q: { ask: "The first product to add to a base routine is:", opts: ["Three serums at once", "One treatment product for your main concern", "A scrub"], a: 1,
                why: "One active at a time makes reactions and progress clear." } }
          ]
        }
      ]
    }
  ],

  /* how to take the course. Prices are proposals until Evelyn signs off. */
  tiers: [
    { id: "course", name: "The Course", price: 149, tag: "Self-paced",
      line: "All three levels, at your own pace.",
      has: ["All 40 lessons, Beginner to Advanced", "The routine builder and a printable plan", "Lifetime access, with new lessons as they're added", "$25 off your first visit at Lumevina"] },
    { id: "kit", name: "Course + Kit", price: 229, tag: "Most popular", hl: true,
      line: "The course, plus the products to start right away.",
      has: ["Everything in The Course", "A starter kit chosen for your skin: cleanser and SPF 30 from our shelf, a $75 value", "Ships free, or pick it up at your visit"] },
    { id: "evelyn", name: "Course + Evelyn", price: 449, tag: "6 spots a month",
      line: "The course, the kit, and Evelyn herself.",
      has: ["Everything in Course + Kit", "A 45-minute 1-on-1 video skin consult with Evelyn", "Your written routine, built for your skin", "A 15-minute check-in 30 days later"] }
  ],
  starter: { id: "basics", name: "Skin Basics", price: 49, line: "Just Level 1. Its $49 counts toward the full course if you upgrade." },

  /* Skin School Live: in-person group classes. They run on Sundays and Monday evenings, when the
     studio is closed, so they never take a facial slot. cost = what one seat or guest costs Evelyn in
     supplies (take-home kit, printed journal, drinks; card fees are counted separately in the books).
     See CLASSES.md for the margin math. */
  live: {
    classes: {
      live: { id: "live", name: "Skin School Live", tag: "Group class · 6 seats", seats: 6, price: 129, member: 109, cost: 22,
        line: "Two hours at the studio with Evelyn and a small group.",
        has: ["Your skin under the lamp: a one-on-one skin check", "Your routine, built with you on the spot",
              "A take-home kit: travel cleanser, SPF 30 and a printed skin journal",
              "Skin Basics online (Level 1), yours to keep", "Bubbly or tea, and 15% off a facial booked that night"],
        agenda: [["Welcome and skin check", 30], ["The routine, step by step", 45], ["Build yours", 30], ["Questions and your kit", 15]] },
      party: { id: "party", name: "Glow Party", tag: "Private group · 4 to 8", price: 690, base: 6, extra: 95, max: 8, min: 4,
        home: 75, deposit: 0.5, cost: 22, homeCost: 15,
        line: "Your own class for you and your friends, at the studio or at your place.",
        has: ["Everything in Skin School Live, just for your group", "Up to 6 guests, host included, then $95 a guest",
              "At the studio, or at your home nearby for $75", "Half now to hold the date, the rest on the day"] },
      pro: { id: "pro", name: "Pro Night", tag: "For estheticians · 8 seats", seats: 8, price: 249, cost: 28,
        line: "The business side of a studio, from someone running one.",
        has: ["Three hours on pricing, memberships, rebooking and your books",
              "The Esthetician Business Kit: forms, aftercare cards, menu, scripts and both spreadsheets",
              "A printed 90-day planner", "Dinner and a glass of wine"] }
    },
    /* upcoming sessions, counted from today: [class, days from now (rounded to the weekday), weekday, start, minutes] */
    plan: [["live", 14, 0, "14:00", 120], ["live", 29, 1, "18:30", 120], ["pro", 36, 1, "18:30", 180],
           ["live", 42, 0, "14:00", 120], ["live", 57, 1, "18:30", 120], ["live", 70, 0, "14:00", 120]],
    where: "Lumevina Aesthetics, Woodland Hills. The address comes with your confirmation."
  }
};

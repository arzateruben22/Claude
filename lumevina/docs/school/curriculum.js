/* Lumevina Skin School — the curriculum.
 *
 * Three levels, eleven modules, thirty-three lessons. Each lesson is what
 * Evelyn covers on camera (about 6 to 12 minutes), written out as notes:
 *   sum    what the lesson is about, in a sentence or two
 *   learn  the points it teaches
 *   try    something to do at home before the next lesson
 *   q      a one-question check: ask, three options, the answer's index, why
 *
 * Drafted from mainstream dermatology guidance (AAD, FDA) and the way
 * Lumevina already works (Face Reality for acne, GlyMed+ and Le Mieux on the
 * shelf, California esthetics scope). Evelyn reviews every lesson before she
 * records it: anything medical points to a dermatologist or doctor.
 */
window.SCHOOL = {
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
            { id: "1-1", t: "Your skin in ten minutes", min: 9, free: true,
              sum: "Skin is an organ with a job: keep water in and the world out. Once you see how it's built, every product decision gets easier.",
              learn: [
                "The epidermis is the thin outer layer you treat at home. Under it, the dermis holds collagen, elastin, oil glands and blood supply.",
                "New cells form at the bottom of the epidermis and rise to the surface. In your twenties the trip takes about four weeks, and it slows with age.",
                "The surface is slightly acidic, around pH 5. That acid mantle keeps the good bacteria happy and the bad ones out.",
                "Most home skincare works on the top layers. Anything that reaches living tissue is a medical treatment, not a facial."
              ],
              try: "Tonight, wash with lukewarm water and look at your bare skin in daylight tomorrow morning, before any product. That's your starting point.",
              q: { ask: "Roughly how long does it take a new skin cell to reach the surface in your twenties?", opts: ["About 4 days", "About 4 weeks", "About 4 months"], a: 1,
                why: "About four weeks, which is why you judge a new routine after a month, not a morning." } },
            { id: "1-2", t: "Find your real skin type", min: 8, free: true,
              sum: "Skin type is how much oil you make. Skin condition is what's happening right now. Mixing them up is why so many routines fail.",
              learn: [
                "The four types: dry (little oil), oily (a lot), combination (oily T-zone, drier cheeks) and normal (balanced).",
                "Conditions come and go: dehydrated, sensitive, acne-prone, sun-damaged. Oily skin can still be dehydrated.",
                "The bare-face test: cleanse, apply nothing, wait an hour, then look. Shine everywhere is oily, shine only in the T-zone is combination, tight and flaky is dry.",
                "Your type can shift with seasons, hormones and age, so check again every few months."
              ],
              try: "Do the bare-face test this week and write down what you see at one hour. Keep it: Lesson 3-2 builds your routine from it.",
              q: { ask: "Your forehead and nose shine by noon but your cheeks feel tight. Your skin type is most likely:", opts: ["Oily", "Combination", "Dry"], a: 1,
                why: "Oil in the T-zone with drier cheeks is combination skin." } },
            { id: "1-3", t: "The barrier: why less is more", min: 9,
              sum: "Your barrier is brick and mortar: skin cells held together by fats. When it's damaged, everything stings, flakes and breaks out.",
              learn: [
                "The bricks are flattened skin cells. The mortar is ceramides, cholesterol and fatty acids.",
                "Signs of a damaged barrier: stinging from products that never stung, tightness after washing, redness, flaking, sudden breakouts.",
                "The usual causes: too much exfoliating, harsh cleansers, hot water, too many actives at once, and dry weather.",
                "To repair it, cut back to a gentle cleanser, a moisturizer with ceramides and sunscreen for two weeks, with no acids or retinoids."
              ],
              try: "Count the products with acids, retinoids or scrubs you use in a week. If it's more than three, you'll learn how to cut back in Level 2.",
              q: { ask: "Which of these is a sign of a damaged barrier?", opts: ["Your moisturizer suddenly stings", "Your skin looks dewy after SPF", "You have a few freckles"], a: 0,
                why: "When a gentle product suddenly stings, the barrier is letting things through it shouldn't." } }
          ]
        },
        {
          name: "The core routine", art: "routine",
          lessons: [
            { id: "2-1", t: "Cleansing, done right", min: 7,
              sum: "A good cleanser removes the day without stripping the skin. The way you wash matters as much as what you wash with.",
              learn: [
                "Choose by type: a gel or foam for oily skin, a cream or milk for dry and sensitive skin.",
                "Use lukewarm water, not hot, and massage for a full 60 seconds so the cleanser has time to work.",
                "At night, cleanse twice if you wore sunscreen or makeup: an oil or balm first, then your regular cleanser.",
                "Tight and squeaky afterward means the cleanser is too strong."
              ],
              try: "Time your cleanse tonight. Most people stop at 15 seconds.",
              q: { ask: "When does a double cleanse make the most sense?", opts: ["Every morning", "At night after sunscreen or makeup", "Only when you have a breakout"], a: 1,
                why: "The first cleanse melts sunscreen and makeup, and the second one cleans the skin." } },
            { id: "2-2", t: "Moisturizer, decoded", min: 8,
              sum: "Every moisturizer is a mix of three kinds of ingredients. Once you know them, you can pick one for any skin in seconds.",
              learn: [
                "Humectants pull water in: glycerin, hyaluronic acid, urea.",
                "Emollients smooth and soften: squalane, ceramides, plant oils.",
                "Occlusives seal it all in: petrolatum, dimethicone, shea butter.",
                "Oily skin wants light humectants in a gel. Dry skin wants more emollients and occlusives in a cream. Everyone needs a moisturizer."
              ],
              try: "Read the first five ingredients on your moisturizer and label each one humectant, emollient or occlusive.",
              q: { ask: "Hyaluronic acid is a:", opts: ["Humectant", "Occlusive", "Exfoliant"], a: 0,
                why: "It's a humectant: it draws water into the skin. It's not an acid that exfoliates." } },
            { id: "2-3", t: "Sunscreen, the anti-aging step", min: 10,
              sum: "No serum does as much for your skin as daily sunscreen. It prevents dark spots, fine lines, and skin cancer.",
              learn: [
                "Use broad spectrum SPF 30 or higher every day, rain or shine. UVA passes through clouds and windows.",
                "Use enough: about a quarter teaspoon for the face, or two finger-lengths for face and neck.",
                "Reapply every two hours outdoors, and after swimming or sweating.",
                "Mineral filters (zinc oxide, titanium dioxide) suit sensitive skin. Tinted formulas with iron oxides also block the visible light that darkens melasma."
              ],
              try: "Squeeze out two finger-lengths of your sunscreen tomorrow morning. For most people it's twice what they usually use.",
              q: { ask: "How often should you reapply sunscreen when you're outdoors?", opts: ["Once a day is enough", "About every two hours", "Only if you burn"], a: 1,
                why: "Sunscreen wears off with sweat, touching and time, so reapply about every two hours outdoors." } }
          ]
        },
        {
          name: "Shopping smart", art: "label",
          lessons: [
            { id: "3-1", t: "How to read a label", min: 9,
              sum: "The front of the bottle is marketing. The ingredient list on the back tells you what's actually in it.",
              learn: [
                "Ingredients are listed from most to least, down to 1%. After that they can go in any order.",
                "The first five ingredients make up most of the formula. If the star ingredient comes after the fragrance, there's very little of it.",
                "Words like \"clean\", \"natural\", \"hypoallergenic\" and \"dermatologist tested\" have no legal definition for cosmetics.",
                "\"Fragrance\" or \"parfum\" can hide dozens of ingredients. Sensitive skin often does better without them."
              ],
              try: "Pick your favorite product and find where its star ingredient falls in the list.",
              q: { ask: "The \"hero\" ingredient is listed after fragrance. That usually means:", opts: ["There's very little of it", "It's the main ingredient", "It's been tested more"], a: 0,
                why: "Fragrance is usually under 1%, so anything listed after it is in very small amounts." } },
            { id: "3-2", t: "Build your first routine", min: 11,
              sum: "Three steps in the morning and three at night cover most skin. You add actives later, one at a time.",
              learn: [
                "Morning: cleanse (or just rinse, if you're dry), moisturize, sunscreen.",
                "Night: cleanse, treat (only once your skin is calm), moisturize.",
                "Add one new product at a time and wait two weeks before adding another, so you know what's working and what isn't.",
                "Patch test anything new: twice a day on a small spot along the jaw or inner arm for 7 to 10 days."
              ],
              try: "Write your three-step morning and night routine from what you already own. Circle anything you don't need.",
              q: { ask: "How long should you wait before adding a second new product?", opts: ["A day", "About two weeks", "Six months"], a: 1,
                why: "Two weeks is long enough to see a reaction and short enough to keep making progress." } },
            { id: "3-3", t: "Habits that matter more than products", min: 7,
              sum: "The small things you do every day add up to more than any one product.",
              learn: [
                "Change pillowcases twice a week, and wipe your phone screen often. Both touch your face for hours.",
                "Take hot showers short, and wash your face at the sink afterward, not under the hot stream.",
                "Hands off: picking turns a two-day pimple into a two-month mark.",
                "Sleep, water and stress all show on skin. None of them fix it alone, and none of them can be skipped."
              ],
              try: "Pick one habit from this lesson and do it for seven days in a row.",
              q: { ask: "Why does picking a pimple usually make things worse?", opts: ["It pushes bacteria deeper and can leave a dark mark", "It makes the pimple smaller", "It has no effect"], a: 0,
                why: "Squeezing pushes infection deeper and inflames the skin, which leaves marks that last for weeks." } }
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
            { id: "4-1", t: "AHAs, BHAs and PHAs", min: 10,
              sum: "Chemical exfoliants loosen dead cells so fresh skin shows. Each family works a little differently.",
              learn: [
                "AHAs (glycolic, lactic, mandelic) work on the surface for glow and even tone. Glycolic is the strongest, and mandelic and lactic are gentler.",
                "BHA (salicylic acid) dissolves in oil, so it gets inside pores. It's the one for blackheads and oily skin.",
                "PHAs (gluconolactone) are the gentlest and suit sensitive skin.",
                "Acids make skin more sensitive to the sun, so use sunscreen every morning."
              ],
              try: "Check your products for glycolic, lactic, mandelic, salicylic or gluconolactone. Now you know which ones exfoliate.",
              q: { ask: "Which exfoliant gets inside oily pores best?", opts: ["Glycolic acid", "Salicylic acid", "Hyaluronic acid"], a: 1,
                why: "Salicylic acid (BHA) is oil-soluble, so it can work inside the pore." } },
            { id: "4-2", t: "How often, and how much", min: 8,
              sum: "More exfoliation isn't better. Too much is the most common way people damage their barrier.",
              learn: [
                "Start with two nights a week. Most skin tops out at two or three.",
                "Stop and rest if you see shine that looks like plastic, stinging, redness or flaking.",
                "Don't use an acid on the same night as a retinoid until your skin has fully adjusted to both.",
                "In the week before and after a professional peel, stop home acids."
              ],
              try: "Put your exfoliating nights on your calendar: two a week, not back to back.",
              q: { ask: "Your skin looks tight and shiny like plastic after a week of daily acids. What should you do?", opts: ["Add a stronger acid", "Stop acids and focus on repair for a week or two", "Scrub harder"], a: 1,
                why: "Plastic-looking shine means you've over-exfoliated. Rest with a gentle cleanser, moisturizer and SPF." } },
            { id: "4-3", t: "Scrubs, brushes and dermaplaning", min: 8,
              sum: "Physical exfoliation can be kind or harsh. It depends on the tool and the pressure.",
              learn: [
                "Skip scrubs with jagged bits like crushed shells or pits. They can leave tiny tears in the skin.",
                "A soft washcloth or a gentle enzyme mask gives a physical polish without the damage.",
                "Dermaplaning removes dead skin and peach fuzz. Done professionally, it's smooth and safe, and makeup goes on flawlessly afterward.",
                "At home, use clean, dry skin, a fresh blade and light strokes, once a month at most, and never over active breakouts."
              ],
              try: "Check your scrub. If it feels like sand with sharp edges, swap it for an enzyme mask.",
              q: { ask: "When should you never dermaplane?", opts: ["Over active breakouts", "On clean, dry skin", "Once a month"], a: 0,
                why: "A blade over an active breakout spreads bacteria and irritates the skin." } }
          ]
        },
        {
          name: "The power ingredients", art: "drops",
          lessons: [
            { id: "5-1", t: "Vitamin C", min: 9,
              sum: "Vitamin C in the morning brightens, evens tone and helps your sunscreen protect you.",
              learn: [
                "L-ascorbic acid at 10 to 20% is the most studied form. Derivatives are gentler but usually weaker.",
                "Use it in the morning, before moisturizer and sunscreen.",
                "It oxidizes: if the serum turns dark orange or brown, it's past its best. Keep it cool, dark and closed.",
                "A slight tingle is normal. Burning is not, so switch to a gentler form."
              ],
              try: "Look at your vitamin C serum's color. Pale straw is good, and brown means replace it.",
              q: { ask: "When is vitamin C usually used?", opts: ["In the morning, under sunscreen", "Only at night", "Mixed into your cleanser"], a: 0,
                why: "In the morning it works with your sunscreen against the day's damage." } },
            { id: "5-2", t: "Retinoids, without the drama", min: 12,
              sum: "Retinoids are the best-studied ingredient for aging and acne. The trick is starting slowly.",
              learn: [
                "The family: retinol and retinal (over the counter), adapalene 0.1% (over the counter for acne), and tretinoin (prescription only, from a doctor).",
                "Start two or three nights a week with a pea-size amount for the whole face. Add a night every two weeks as your skin allows.",
                "The sandwich method: moisturizer, then the retinoid, then moisturizer. It softens irritation without stopping the results.",
                "Stop retinoids if you're pregnant, trying to get pregnant or breastfeeding, and ask your doctor."
              ],
              try: "If you use a retinoid, measure one pea-size amount tonight. Most people use three.",
              q: { ask: "What's the best way to start a retinoid?", opts: ["Every night from day one", "Two or three nights a week, a pea-size amount", "Twice a day for faster results"], a: 1,
                why: "Starting slowly lets your skin adjust, which is how you avoid peeling and redness." } },
            { id: "5-3", t: "The supporting cast", min: 10,
              sum: "The quieter ingredients that make everything else work better.",
              learn: [
                "Niacinamide (2 to 5%) calms redness, balances oil and strengthens the barrier. It works well with almost everything.",
                "Hyaluronic acid holds water. Apply it to damp skin and seal it with moisturizer.",
                "Azelaic acid calms redness and fades marks, and it's gentle enough for sensitive skin.",
                "Benzoyl peroxide kills acne bacteria. It bleaches towels and pillowcases, so use white ones."
              ],
              try: "Find one supporting ingredient already in your routine. Chances are you have niacinamide or hyaluronic acid.",
              q: { ask: "Where should hyaluronic acid go?", opts: ["On damp skin, sealed with moisturizer", "On bone-dry skin with nothing over it", "Mixed into sunscreen"], a: 0,
                why: "It needs water to hold on to. Moisturizer keeps that water in." } }
          ]
        },
        {
          name: "Layering and scheduling", art: "stack",
          lessons: [
            { id: "6-1", t: "The order of things", min: 8,
              sum: "Thinnest to thickest, water before oil, sunscreen last in the morning.",
              learn: [
                "Morning: cleanser, toner or essence, vitamin C, serum, eye cream, moisturizer, sunscreen.",
                "Night: cleanser, toner, treatment (acid or retinoid), serum, eye cream, moisturizer, oil if you use one.",
                "Give actives a minute to settle before the next layer.",
                "Face oils go last at night, since nothing gets through an oil."
              ],
              try: "Line up your products in order on the counter tonight, and put away anything that doesn't have a place in line.",
              q: { ask: "In the morning, what goes last?", opts: ["Vitamin C", "Moisturizer", "Sunscreen"], a: 2,
                why: "Sunscreen goes last in the morning so it can form an even layer on top." } },
            { id: "6-2", t: "What not to mix", min: 9,
              sum: "Most ingredient \"rules\" online are myths. A few are real.",
              learn: [
                "Real: retinoids and strong acids on the same night. They're usually too much together, so alternate nights.",
                "Real: benzoyl peroxide can break down some tretinoin formulas. Use them at different times of day. Adapalene is stable with it.",
                "Myth: vitamin C and niacinamide cancel each other out. Modern formulas work fine together.",
                "When in doubt, split them between morning and night."
              ],
              try: "Check your night routine for a retinoid and an acid on the same night. If you find one, split them.",
              q: { ask: "Vitamin C and niacinamide together:", opts: ["Cancel each other out", "Work fine together in modern formulas", "Always cause a rash"], a: 1,
                why: "That warning came from old lab tests with pure ingredients. Modern formulas pair them without trouble." } },
            { id: "6-3", t: "Your weekly plan, and purging", min: 11,
              sum: "A simple weekly rhythm: exfoliate, retinoid, recover, repeat. Plus how to tell purging from a bad reaction.",
              learn: [
                "A four-night cycle: an exfoliation night, a retinoid night, then two recovery nights with only moisturizer.",
                "Purging happens with ingredients that speed up cell turnover (retinoids, acids). It shows up where you usually break out and clears within four to six weeks.",
                "Breakouts in new places, or from a product with no actives, are a reaction or clogging, not purging. Stop that product.",
                "Give any routine eight to twelve weeks before you judge it."
              ],
              try: "Write this week's four-night cycle on a sticky note on your mirror.",
              q: { ask: "You started a new moisturizer with no actives and broke out on your cheeks, where you never break out. This is most likely:", opts: ["Purging, so keep going", "A reaction or clogging, so stop it", "Normal aging"], a: 1,
                why: "Purging only comes from actives, in your usual spots. This is the product disagreeing with you." } }
          ]
        },
        {
          name: "The at-home facial", art: "massage",
          lessons: [
            { id: "7-1", t: "The Sunday ritual", min: 12,
              sum: "A 20-minute facial at home that keeps your skin in shape between visits.",
              learn: [
                "Double cleanse, then steam gently with a warm towel for one minute. Skip the steam if you have redness or rosacea.",
                "Exfoliate (only if it isn't already an acid night), then a mask for your skin: clay for oily, cream or gel for dry.",
                "Massage while the serum goes on (Lesson 7-2), then moisturize.",
                "No extractions at home. That's what the treatment room is for."
              ],
              try: "Block 20 minutes this Sunday and do the full ritual.",
              q: { ask: "Which step should stay in the treatment room?", opts: ["Extractions", "Moisturizing", "A clay mask"], a: 0,
                why: "Extractions need training, clean tools and prepared skin, or they leave marks and scars." } },
            { id: "7-2", t: "Facial massage and gua sha", min: 10,
              sum: "Gentle massage moves fluid, eases tension and makes skin look instantly awake.",
              learn: [
                "Always use slip: a face oil or a rich serum. Never drag dry skin.",
                "Go from the center outward and downward along the neck, toward the lymph nodes.",
                "Use light pressure. It should feel good, never hurt, and never leave marks.",
                "Skip over active breakouts, broken skin or right after a peel."
              ],
              try: "Two minutes of massage with your serum tonight: forehead, cheeks, jaw, then down the neck.",
              q: { ask: "Which direction do you usually move for lymphatic massage?", opts: ["Inward toward the nose", "Outward and down toward the neck", "In small hard circles"], a: 1,
                why: "Lymph drains toward the nodes along the jaw and neck, so you work outward and down." } },
            { id: "7-3", t: "Skin through the seasons", min: 9,
              sum: "Your routine should change with the weather. The Valley has more weather than people think.",
              learn: [
                "Hot summers: lighter gel moisturizer, sunscreen reapplied more often, and blotting papers instead of more powder.",
                "Santa Ana winds and dry winters: richer moisturizer, fewer acid nights, and a humidifier by the bed.",
                "Travel and flights: skip new actives, and pack your barrier basics.",
                "Plan a skin check with Evelyn at every change of season."
              ],
              try: "Write down one change you'll make for the season we're in now.",
              q: { ask: "During dry Santa Ana winds, you'd usually:", opts: ["Add more acid nights", "Use a richer moisturizer and fewer acids", "Stop moisturizing"], a: 1,
                why: "Dry wind pulls water from the skin, so you protect the barrier and ease up on exfoliation." } }
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
            { id: "8-1", t: "How acne really forms", min: 10,
              sum: "Acne is four things going wrong at once. Treat all four and it calms down.",
              learn: [
                "The four causes: too much oil, dead cells clogging the pore, acne bacteria, and inflammation.",
                "Blackheads and whiteheads are clogged pores. Red bumps and pus-filled pimples are inflamed ones.",
                "Deep, painful cysts and nodules can scar. Those need a dermatologist, not just a facial.",
                "Acne starts forming weeks before you see it, which is why results take two to three months."
              ],
              try: "Map your breakouts for a week: where they are, and what kind.",
              q: { ask: "Deep, painful cysts along the jaw that keep coming back should be seen by:", opts: ["A dermatologist", "Nobody, they go away", "Just a stronger scrub"], a: 0,
                why: "Cystic acne can scar and often needs prescription treatment. A dermatologist and an esthetician can work together." } },
            { id: "8-2", t: "The acne-safe routine", min: 12,
              sum: "The routine Evelyn builds on the Face Reality program: clear the pores and stop re-clogging them.",
              learn: [
                "Check every product against a pore-clogging list: coconut oil, isopropyl myristate, algae extracts, some red dyes and lanolins are common offenders.",
                "Use benzoyl peroxide or a mandelic or salicylic wash, raised slowly as your skin allows.",
                "Choose an oil-free, non-clogging moisturizer and sunscreen. Skipping moisturizer makes acne worse.",
                "Get a treatment every two weeks at first, then monthly. Home care and treatments work as a team."
              ],
              try: "Check your moisturizer, sunscreen and makeup against the pore-clogging list. Ask Evelyn for the full Face Reality list.",
              q: { ask: "Your skin is oily and breaking out. Should you skip moisturizer?", opts: ["Yes, it adds oil", "No, dry skin makes more oil and irritation", "Only on weekends"], a: 1,
                why: "Stripped skin overproduces oil and gets irritated. Use a light, non-clogging moisturizer." } },
            { id: "8-3", t: "Food, hormones and habits", min: 9,
              sum: "What's proven, what isn't, and what to try.",
              learn: [
                "Some studies link high-sugar diets and dairy, especially skim milk, to more breakouts in some people.",
                "Hormonal acne usually shows up along the jaw and chin, around your cycle. A doctor can talk through options.",
                "Sweat is fine. Sitting in it isn't. Rinse after the gym.",
                "Helmets, masks, phones and hair products can all cause breakouts where they touch your skin."
              ],
              try: "Keep a two-week note of food, cycle and breakouts. Look for a pattern, not a single cause.",
              q: { ask: "Breakouts mostly along the jaw that come and go with your cycle suggest:", opts: ["Hormonal acne", "A sunscreen allergy", "Dehydration only"], a: 0,
                why: "Jaw and chin flares that follow your cycle are the classic hormonal pattern." } }
          ]
        },
        {
          name: "Dark spots and even tone", art: "pigment",
          lessons: [
            { id: "9-1", t: "Three kinds of dark spots", min: 10,
              sum: "Sun spots, post-breakout marks and melasma look alike but need different plans.",
              learn: [
                "Sun spots come from years of UV. They show up on the cheeks, forehead and hands.",
                "Post-inflammatory marks are the dark marks left behind after a pimple or irritation. They're more common and last longer in deeper skin tones.",
                "Melasma is patchy and symmetrical, often on the cheeks and upper lip, and triggered by sun, heat, visible light and hormones.",
                "Red marks after acne are different: they're blood vessels, not pigment, and fade on their own."
              ],
              try: "Look at your spots in daylight. Are they brown or red? Scattered or in matching patches?",
              q: { ask: "Matching brown patches on both cheeks that get darker in summer are most likely:", opts: ["Melasma", "Blackheads", "A sunburn"], a: 0,
                why: "Symmetrical patches that react to sun and heat are the melasma pattern." } },
            { id: "9-2", t: "Brighteners that work", min: 11,
              sum: "The ingredients with real evidence behind them, and how to combine them.",
              learn: [
                "Vitamin C, niacinamide, azelaic acid and tranexamic acid all fade spots in different ways. Two together often work better than one.",
                "Retinoids speed up turnover so pigment leaves faster.",
                "Hydroquinone is prescription-only in the US since 2020, so it's a conversation for your doctor.",
                "Nothing works without sunscreen. One unprotected afternoon can undo a month of fading."
              ],
              try: "Choose one brightener for the morning (vitamin C) and one for the night (azelaic acid or a retinoid).",
              q: { ask: "What undoes a month of fading fastest?", opts: ["Skipping sunscreen", "Drinking water", "A gentle cleanser"], a: 0,
                why: "UV restarts pigment production right away. Sunscreen protects the progress." } },
            { id: "9-3", t: "Heat, light and patience", min: 8,
              sum: "Why pigment is slow, and how to keep it from coming back.",
              learn: [
                "Pigment fades in months, not weeks. Take a photo in the same light every four weeks to see real progress.",
                "Heat can darken melasma too: hot yoga, saunas and cooking over a hot stove.",
                "Tinted mineral sunscreen with iron oxides blocks the visible light that plain sunscreen lets through.",
                "Professional peels can help, but only in expert hands, especially for deeper skin tones."
              ],
              try: "Take a progress photo today: same spot, same light, no makeup. Set a reminder for four weeks.",
              q: { ask: "Which sunscreen is best for melasma?", opts: ["A tinted mineral one with iron oxides", "Any SPF 15", "No sunscreen indoors"], a: 0,
                why: "Iron oxides block visible light, which also darkens melasma." } }
          ]
        },
        {
          name: "Aging well", art: "age",
          lessons: [
            { id: "10-1", t: "What actually ages skin", min: 9,
              sum: "Time plays a part, but daily habits make the biggest difference.",
              learn: [
                "Most visible aging on the face comes from the sun: lines, spots, sagging and texture.",
                "Collagen production slows every year from your mid-twenties, and it drops faster after menopause.",
                "Smoking, poor sleep and a high-sugar diet speed it up.",
                "The good news: most of it is preventable, and some of it is reversible."
              ],
              try: "Compare the skin on your inner arm with the back of your hand. The difference is mostly sun.",
              q: { ask: "What's the biggest outside cause of visible facial aging?", opts: ["The sun", "Drinking coffee", "Smiling"], a: 0,
                why: "UV breaks down collagen and causes spots. Daily sunscreen is the best anti-aging step." } },
            { id: "10-2", t: "An anti-aging routine that works", min: 12,
              sum: "The short list with real evidence behind it, used every day.",
              learn: [
                "Morning: vitamin C, moisturizer, sunscreen.",
                "Night: a retinoid (built up slowly), peptides, a rich moisturizer.",
                "Don't forget your neck, chest and hands. They show age early too.",
                "Consistency beats strength: a gentle retinoid every night beats a strong one once a week."
              ],
              try: "Take your skincare down to your neck and chest tonight.",
              q: { ask: "Which is better for results?", opts: ["A gentle retinoid used consistently", "A strong retinoid once a month", "Switching products every week"], a: 0,
                why: "Retinoids work over months of steady use. Irritation that makes you stop is the real enemy." } },
            { id: "10-3", t: "Professional treatments, explained", min: 11,
              sum: "What each treatment does, who does it, and what to expect.",
              learn: [
                "With an esthetician: facials, light peels, dermaplaning, LED and extractions. That's the surface of the skin, and it's Evelyn's room.",
                "With a nurse or doctor: microneedling, lasers, Botox and fillers. In California these are medical treatments.",
                "Ask anyone offering injectables who their supervising physician is, and look for a licensed nurse, PA or doctor.",
                "Most of what makes a treatment work comes before and after: prep, aftercare and sunscreen."
              ],
              try: "Write down one treatment you're curious about, and bring the question to your next visit.",
              q: { ask: "In California, who performs Botox and fillers?", opts: ["Licensed medical providers such as nurses, PAs or doctors", "Any esthetician", "Anyone with a course certificate"], a: 0,
                why: "Injectables are medical treatments, done by licensed medical providers under a physician." } }
          ]
        },
        {
          name: "Sensitive skin and special cases", art: "calm",
          lessons: [
            { id: "11-1", t: "Sensitive and rosacea-prone skin", min: 10,
              sum: "When skin reacts to everything, the answer is almost always fewer products, not better ones.",
              learn: [
                "Rosacea: flushing, redness and sometimes bumps, set off by heat, sun, alcohol, spicy food and stress.",
                "Use fragrance-free products with short ingredient lists. Patch test everything.",
                "Azelaic acid and niacinamide can calm redness. Strong acids and scrubs make it worse.",
                "Persistent redness, stinging or eye irritation is worth a dermatologist visit."
              ],
              try: "Cut your routine to cleanser, moisturizer and sunscreen for two weeks and see how your skin feels.",
              q: { ask: "Which is most likely to set off rosacea?", opts: ["A hot sauna", "A cool compress", "Fragrance-free moisturizer"], a: 0,
                why: "Heat is one of the most common rosacea triggers." } },
            { id: "11-2", t: "Pregnancy and breastfeeding", min: 9,
              sum: "What to pause, what's commonly considered fine, and the one rule: ask your doctor.",
              learn: [
                "Pause retinoids of every kind, including retinol, and skip high-strength salicylic peels.",
                "Commonly considered fine: azelaic acid, vitamin C, niacinamide, gentle lactic acid and mineral sunscreen.",
                "Melasma often shows up in pregnancy. Tinted mineral sunscreen is your best friend.",
                "Tell your esthetician every time. Some treatments change when you're pregnant."
              ],
              try: "If this applies to you, bring your product list to your doctor and ask about each one.",
              q: { ask: "During pregnancy, which should you pause?", opts: ["Retinoids", "Mineral sunscreen", "A gentle cleanser"], a: 0,
                why: "Retinoids are avoided during pregnancy. Always check the rest with your doctor." } },
            { id: "11-3", t: "Your skin plan for life", min: 12,
              sum: "Put it all together: your type, your concern, and a routine you'll keep.",
              learn: [
                "Your routine is a base plus one or two actives for your concern. Nothing more.",
                "Look again every season, after big life changes, or when something stops working.",
                "See a dermatologist for changing moles, cysts, sudden rashes, or anything that bleeds or won't heal.",
                "Book a skin check with Evelyn so she can fine-tune the plan with your skin in front of her."
              ],
              try: "Use the routine builder below to write your plan, then save it or bring it to your next visit.",
              builder: true,
              q: { ask: "A mole that's changing shape or color needs:", opts: ["A dermatologist, soon", "A stronger serum", "Nothing"], a: 0,
                why: "Changing moles need a doctor to look at them. That's outside any facial or course." } }
          ]
        }
      ]
    }
  ],

  /* how to take the course. Prices are proposals until Evelyn signs off. */
  tiers: [
    { id: "course", name: "The Course", price: 149, tag: "Self-paced",
      line: "All three levels, at your own pace.",
      has: ["All 33 lessons, Beginner to Advanced", "The routine builder and a printable plan", "Lifetime access, with new lessons as they're added", "$25 off your first visit at Lumevina"] },
    { id: "kit", name: "Course + Kit", price: 229, tag: "Most popular", hl: true,
      line: "The course, plus the products to start right away.",
      has: ["Everything in The Course", "A starter kit chosen for your skin: cleanser and SPF 30 from our shelf, a $75 value", "Ships free, or pick it up at your visit"] },
    { id: "evelyn", name: "Course + Evelyn", price: 449, tag: "6 spots a month",
      line: "The course, the kit, and Evelyn herself.",
      has: ["Everything in Course + Kit", "A 45-minute 1-on-1 video skin consult with Evelyn", "Your written routine, built for your skin", "A 15-minute check-in 30 days later"] }
  ],
  starter: { id: "basics", name: "Skin Basics", price: 49, line: "Just Level 1. Its $49 counts toward the full course if you upgrade." }
};

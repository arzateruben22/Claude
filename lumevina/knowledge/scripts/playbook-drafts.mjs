// Drafted answers for Evelyn's Skin Playbook: the common answer to each
// question, written the way she'd text it, from standard esthetics practice
// (knowledge/general/*.md) and her own menu descriptions (js/services.js).
//
// Nothing here reaches the website's assistant on its own. In the playbook's
// Quick confirm tab (and in Talk it through) each draft is offered to her:
// "Yes, that's what I say", edit it, or "Not this one". Only what she
// confirms is saved, as her answer, in her words. A draft never overrides
// an answer she has already given.
//
// Keys are "<section>/<card>.<question>" (playbook-spec.mjs). A value is the
// text of the answer, or { pick, text } for a tap question: pick is one of
// its options (or several, for a tap-all question), text goes in its box.
//
// Rules for a draft: hedged where practice varies ("usually", "I'll tell
// you"); no medical claims; no promise of results; no claim about a product
// beyond its label or her own words; anything personal or medical says
// "tell me first" or "ask your doctor".

export const DRAFTS = {
  /* ── Questions clients ask: before a visit ── */
  "client-questions/cq-before.stop_products": "Yes please. Pause retinol or any retinoid, acids (glycolic, lactic, salicylic, mandelic), scrubs and at-home peels for 3 to 5 days before your facial; a prescription retinoid like tretinoin, about a week, and tell me you're on it. Keep your cleanser, moisturizer and SPF as usual.",
  "client-questions/cq-before.period": "Yes, you can come in. Skin can be a little more sensitive around your period, so a facial may feel more reactive and a wax a bit more tender, but nothing about it is off limits. For a Brazilian, a tampon or cup is fine.",
  "client-questions/cq-before.breaking_out": "Please do. Breakouts are exactly what a treatment is for: I'll adjust what we do to calm them and clear what's ready. The only thing I won't work on is open, raw or infected skin, so if anything is weeping or very painful, send me a photo first.",
  "client-questions/cq-before.hair_length": "About a quarter inch, the length of a grain of rice: roughly 2 to 3 weeks after shaving, or 4 to 6 weeks after your last wax. Too short and the wax can't grip it.",
  "client-questions/cq-before.shave_before": "No shaving, please; it resets the growth and makes the next wax patchier and more uncomfortable. If it's very long you can trim, but not shorter than a quarter inch. Exfoliate gently 2 or 3 days before and come with clean, dry skin and no lotion.",
  "client-questions/cq-before.sun_before": "No treatment on sunburned or freshly tanned skin, and no sun or tanning for a day or two after a wax, peel or dermaplaning. For a trip, book at least 2 or 3 days before you leave, and I'll go gentler on the actives if you're going to be in the sun.",
  "client-questions/cq-before.first_wax": "Let the hair grow to a quarter inch, exfoliate a couple of days before, shower that day, and wear loose cotton. It takes about 30 to 40 minutes and the first one is the most sensitive; it gets easier every time. Tell me first about any medications, skin issues or pregnancy.",

  /* ── Right after a visit ── */
  "client-questions/cq-after.makeup_after": "Give your skin the rest of the day with nothing on it. Mineral makeup is fine the next morning after a facial; after a peel, dermaplaning or microchanneling, wait until it's no longer pink and tight, usually a day or two.",
  "client-questions/cq-after.workout_after": "Skip heat and sweat for 24 hours after a facial or wax, and 48 hours after a peel, dermaplaning or microchanneling: no gym, sauna, steam, hot yoga, hot tubs or swimming. Sweat and heat on freshly treated skin cause stinging and breakouts.",
  "client-questions/cq-after.wash_after": "Leave it alone until tonight or tomorrow morning, then a gentle cleanser with lukewarm water, fingertips only. Moisturize and SPF in the morning. No scrubs, acids or exfoliating cleansers for a few days.",
  "client-questions/cq-after.breakout_after": "A few small whiteheads a day or two after extractions is normal: what I loosened is surfacing. Don't pick, keep it simple and clean, and they settle within a few days. If it's spreading, painful or hot, send me a photo.",
  "client-questions/cq-after.peeling_after": "Peeling usually starts on day 2 or 3 and finishes by day 5 to 7. Let it come off on its own: no picking, no scrubbing, no acids. Moisturize, SPF every morning, stay out of the sun. If anything blisters or weeps, message me.",
  "client-questions/cq-after.actives_after": "After a facial, 2 or 3 days. After a peel, dermaplaning or microchanneling, about a week, once the skin has stopped flaking and feels normal again. Then start back at a few nights a week, not every night.",
  "client-questions/cq-after.bumps_after_wax": "Small red bumps for a few hours to a day are normal; it's the follicles reacting. Keep the area clean, cool and loose, no heat, sweat or tight clothes for a day or two, then exfoliate gently a few times a week to keep ingrowns away. If bumps turn into pus-filled spots or spread, message me.",

  /* ── Routines and products ── */
  "client-questions/cq-routine.own_products": "Usually yes; what matters is not doubling up: two exfoliants, two retinoids or several actives at once. Send me a photo of what you're using and I'll tell you what stays, what goes and what waits.",
  "client-questions/cq-routine.buy_everything": "No. Start with the base: cleanser, moisturizer and SPF, plus the one treatment product I gave you for your main concern. We add the rest step by step so we can tell what's working.",
  "client-questions/cq-routine.sunscreen": "Broad spectrum, SPF 30 or higher, every morning, enough of it (about a quarter teaspoon for your face), reapplied if you're outside. Mineral if your skin is sensitive, acne-prone or freshly treated. The ones I carry are the ones I trust; ask me which fits you.",
  "client-questions/cq-routine.run_out": "Don't stretch it or stop; message me and I'll set one aside for pickup, or order it from the shop with shipping. Running out of the treatment product for a week or two usually means starting back at a few nights a week.",
  "client-questions/cq-routine.how_long_lasts": "Roughly: a 1 oz serum, 2 to 3 months; a 2 oz moisturizer, 2 to 3 months; a 6 oz cleanser, 3 to 4 months; a 2 oz sunscreen used properly on the face, about a month. If something's lasting much longer, you may be using too little.",
  "client-questions/cq-routine.missed_days": "No, a few days doesn't undo anything. Pick it back up at the same strength. If it's been a week or more, go back to a few nights a week with your actives first, then build up again.",
  "client-questions/cq-routine.travel": "Cleanser, moisturizer, SPF and your main treatment product; leave the rest. Plane air is dry, so bring a hydrating mist or go heavier on moisturizer, and if you'll be in the sun, ease off the actives that week.",

  /* ── Results and how often ── */
  "client-questions/cq-results.how_many_facials": "You'll see a glow after one, but real change takes a series: most people notice a difference by the third visit, with consistent home care in between. The home routine does most of the work; the facials keep it on track.",
  "client-questions/cq-results.how_often_facial": "Every 4 to 6 weeks for maintenance, which is about one skin cycle. If we're working on acne or a corrective series, every 2 to 4 weeks until we're where we want to be.",
  "client-questions/cq-results.acne_how_long": "I tell everyone to give it 90 days to start seeing real results, and 3 to 6 months to be mostly clear. It depends on how severe it is, how consistent you are, and following the home care exactly. Some purging in the first few weeks is normal.",
  "client-questions/cq-results.wax_how_often": "Every 4 to 6 weeks for most areas; brows, lip and underarms often every 3 to 4. You'll be smooth for 2 to 3 weeks, and it lasts longer the more regular you are, because the hair grows back finer and sparser.",
  "client-questions/cq-results.wax_pain": "Yes, as long as you don't shave in between. The hair comes in finer and thinner each time, so every visit is quicker and less uncomfortable than the one before. The first is the hardest.",
  "client-questions/cq-results.between_visits": "Stick to the routine, SPF every day, hands off your face, clean pillowcases and phone screen, and don't start new products without checking with me. That's most of the result right there.",

  /* ── Booking and the day itself ── */
  "client-questions/cq-booking.switch_treatment": "Often yes, if the time allows and your skin is right for it; just tell me when you arrive or message me beforehand so I can plan. Switching to something longer isn't always possible on the day.",
  "client-questions/cq-booking.add_on_day": "Usually, if there's time in the slot and your skin is a fit that day. Message me before your visit if you can, and I'll add it so the time is blocked.",
  "client-questions/cq-booking.with_friend": "Yes, back to back works. Book two consecutive times on the calendar, or message me and I'll set them up together. Every treatment is one on one, so you'll go one after the other.",
  "client-questions/cq-booking.which_facial": "If you're new and don't have acne concerns, book New Clients Start Here. If you're new with acne concerns, book the Acne Bootcamp consultation + treatment. Returning clients: the Lumevina Custom Facial, or the Monthly Acne Treatment if we're working on acne. Not sure? Message me and I'll point you to the right one.",

  /* ── Aftercare: facials ── */
  "aftercare/facials.first24": "Nothing on your skin for the rest of the day: no makeup, no touching or picking. No workouts, sauna, steam, hot yoga, hot showers on your face or swimming for 24 hours. Tonight or tomorrow morning, a gentle cleanse, moisturizer and SPF.",
  "aftercare/facials.week": "Keep it simple: gentle cleanser, hydration, moisturizer, SPF every morning. No acids, retinol, scrubs or new products for 2 or 3 days. Fresh pillowcase, clean phone screen, and let anything from extractions settle on its own.",
  "aftercare/facials.normal": "A little pink or flushed for a few hours, slight tightness, mild tenderness where I did extractions, and maybe a few small whiteheads surfacing in the next day or two. All of that settles on its own.",
  "aftercare/facials.not_normal": "Redness that spreads or gets worse after the first day, swelling (especially around the eyes or lips), hives, blistering, burning that doesn't settle, or a spot that's hot, painful or full of pus. Message me with a photo, and for anything spreading fast or any trouble breathing, see a doctor or call 911.",

  /* ── Aftercare: ProCell Microchanneling ── */
  "aftercare/procell.first24": "Your skin will look and feel like a sunburn. Use only the recovery products from your visit, nothing else; no makeup for 24 hours; no sweat, heat or sun; no touching. Sleep on a clean pillowcase.",
  "aftercare/procell.week": "Hydration and SPF only for the first few days, then your gentle routine. No actives (acids, retinol, scrubs) for about a week, no sun or tanning, no waxing or other treatments on the area. Let any flaking fall on its own.",
  "aftercare/procell.normal": "Red and warm for 12 to 48 hours, tightness, pinpoint marks, and light flaking around day 3. Collagen keeps building for weeks, so the real result shows between sessions, not the next day.",
  "aftercare/procell.not_normal": "Swelling that grows, redness that spreads instead of fading, blistering, pus, heat or fever, or a cold sore starting. Message me right away; an infection or a cold sore needs a doctor quickly.",

  /* ── Aftercare: Refresh Peel ── */
  "aftercare/light-peel.first24": "No makeup today, no heat, sweat, sun or swimming for 24 to 48 hours, no touching. Tonight or tomorrow, a gentle cleanse, moisturizer and SPF. Nothing exfoliating.",
  "aftercare/light-peel.week": "Gentle cleanser, moisturizer, SPF every morning, hat if you're out. No acids, retinol, scrubs or waxing for about a week. If you flake, let it come off by itself.",
  "aftercare/light-peel.normal": "Pink for an hour or two, a little tightness, and maybe light flaking on day 2 or 3. Some skin barely flakes at all and still gets the benefit.",
  "aftercare/light-peel.not_normal": "Blistering, weeping, swelling, hives, spreading redness or burning that doesn't settle in a day. Send me a photo, and see a doctor if it's getting worse fast.",

  /* ── Aftercare: Corrective Peel ── */
  "aftercare/medium-peel.first24": "Leave your skin completely alone: no makeup, no touching, no heat, sweat, sun or swimming for 48 hours. Only the products I sent you home with. Sleep on a clean pillowcase and keep your face out of hot water.",
  "aftercare/medium-peel.week": "Peeling usually starts on day 2 or 3 and finishes by day 5 to 7. Don't pick, pull or exfoliate it off; it will leave marks. Moisturize often, SPF every morning, stay out of the sun, and no actives, waxing or other treatments for a week to ten days.",
  "aftercare/medium-peel.normal": "Pink to red for a day or two, tightness, and darker or blotchy-looking skin before it flakes; that's the old surface lifting, not the result. Visible peeling on days 2 to 5.",
  "aftercare/medium-peel.not_normal": "Blistering, weeping or crusting, swelling, hives, redness that spreads or gets worse after day two, severe pain, or a cold sore starting. Message me with a photo right away; some of those need a doctor the same day.",

  /* ── Aftercare: dermaplaning ── */
  "aftercare/dermaplaning.first24": "No makeup for the rest of the day, no heat, sweat or sun, no touching. Tonight, a gentle cleanse and moisturizer; SPF in the morning. Your skin is extra smooth and extra bare, so it burns easily.",
  "aftercare/dermaplaning.week": "Gentle cleanser, moisturizer and SPF daily; makeup glides on from the next day. No acids, retinol or scrubs for about 3 to 5 days, and no waxing or threading on the face for a week.",
  "aftercare/dermaplaning.normal": "A little pink for a few hours and very smooth. The fine hair grows back exactly as it was, in 3 to 5 weeks; it does not come back thicker or darker.",
  "aftercare/dermaplaning.not_normal": "Nicks that keep bleeding, a rash, hives, spreading redness or small pus-filled bumps. Message me with a photo.",

  /* ── Aftercare: waxing ── */
  "aftercare/waxing.first24": "For 24 to 48 hours: no heat or sweat (workouts, hot showers, saunas, hot tubs, pools), no sun or tanning, no tight clothes on the area, no scented lotions, oils or deodorant. A soothing, fragrance-free product or aloe is fine.",
  "aftercare/waxing.week": "From day 2 or 3, exfoliate the area gently 2 or 3 times a week and keep it moisturized; that's what prevents ingrowns. No shaving between waxes. Book your next one for 4 to 6 weeks out.",
  "aftercare/waxing.normal": "Redness, warmth and small red bumps for a few hours up to a day, longer on a first wax or sensitive skin, and a few tiny white bumps a day or two later as the follicles settle.",
  "aftercare/waxing.not_normal": "Bumps that turn into pus-filled spots, spread or hurt, lifted or torn skin, blistering or a burn. Message me, and see a doctor for anything that looks infected.",

  /* ── Aftercare: Brazilian, bikini and the mini vajacial ── */
  "aftercare/brazilian.first24": "Loose cotton underwear, no tight clothes, no sex, no heat or sweat (gym, hot showers, baths, hot tubs, pools) and no sun on the area for 24 hours. Nothing scented, and hands off.",
  "aftercare/brazilian.week": "Starting 2 or 3 days after, exfoliate gently a few times a week and keep the skin moisturized to prevent ingrowns. Don't dig at an ingrown; a warm compress and gentle exfoliation let it surface. No shaving in between, and book 4 to 6 weeks out.",
  "aftercare/brazilian.normal": "Red, warm and a little tender for a few hours to a day, small red bumps, and a few tiny white bumps a day or two later. The first time is always the most reactive.",
  "aftercare/brazilian.not_normal": "Pus-filled bumps that spread or hurt, lifted or torn skin, blistering, a rash with hives, or a painful ingrown that won't surface. Message me; anything infected should be seen by a doctor.",

  /* ── Your products, in order ── */
  "routine/routine.order": "Morning: cleanser, toner, serum, eye gel, moisturizer, SPF. Night: cleanse (double cleanse if you wore makeup or SPF), toner, your treatment product (your active or acne med), serum, eye gel, moisturizer. Thin to thick, and a spot treatment goes on last, only on the spot.",
  "routine/routine.mandelic": "Start with the strength I give you, usually the lowest, a few nights a week, and build up to nightly as your skin allows. Moving up a strength is my call, after a few weeks with no stinging or flaking. If it ever burns or your skin gets sensitive, back off and message me.",
  "routine/routine.acne_med": "Start with the 2.5%, a thin layer over the whole breakout area (not just spots), every other night, and build to nightly as your skin tolerates it. I move people to the 5% when their skin is ready, not before. It bleaches fabric, so use white pillowcases and towels.",
  "routine/routine.retinal_vs_retinol": "Retinol is the gentler, slower one and where most people start; retinal works faster and is for skin that's already used to a retinoid or wants more. Either way: a pea for the whole face, 2 or 3 nights a week at first, moisturizer over it, SPF every morning, and never alongside an acid on the same night.",
  "routine/routine.dont_mix": "Not on the same night: a retinoid with an acid; two exfoliants; benzoyl peroxide with retinol. Vitamin C goes in the morning, actives at night. Nothing active on skin that's freshly treated or waxed. Niacinamide and vitamin C are fine together.",
  "routine/routine.sun": "Every morning, rain or shine, SPF 30 or higher, enough of it, and reapplied when you're outside. It's the one product that protects everything else we're doing: every active makes you burn more easily, and sun is what brings dark spots back.",

  /* ── Visits and the studio ── */
  "visits/visits.wear_bring": "Just yourself. Come with a clean face if you can (I'll remove makeup if not), hair you don't mind getting a little damp at the hairline, and for a wax, loose comfortable clothing. Bring a list or photos of what you're using at home.",
  "visits/visits.makeup_arrive": { pick: "Yes, I'll remove it", text: "Bare-faced saves a little time, but don't worry about it; a double cleanse is the first step of every facial." },
  "visits/visits.guests": "It's a small, one-on-one studio, so the treatment room is just you and me. A friend can wait for you, and if you're under 18, a parent comes with you. Little ones can't be in the room during a treatment.",
  "visits/visits.first_visit": "We start by talking: your skin, what you're using now, what you want. I look at your skin up close, then we go into a fully customized facial: double cleanse, enzyme exfoliation, extractions, a targeted mask, massage, LED and cryo globes. You leave with a home routine and a plan for the next visit.",
  "visits/visits.men": "Nothing different except what your skin needs. Shaving in the morning before a facial is fine, but not right before a peel or dermaplaning. Same routines, same SPF.",
  "visits/visits.reply_time": "Message me through the website's contact form, email, or Instagram. I answer within two days, and members within 24 hours. If something looks like a reaction, say so and send a photo, and I'll get to it first.",

  /* ── Hard lines ── */
  "hard-lines/hard-lines.always_evelyn": { pick: ["Pregnancy or breastfeeding", "Accutane, past or present", "Prescription retinoids or antibiotics", "Any other prescription", "A reaction, rash, burning or swelling", "Eczema, rosacea, psoriasis or another condition", "Cold sores", "Clients under 18", "Anything about results or guarantees", "Discounts or price exceptions"], text: "Anything about supplements, and anything where someone asks what's wrong with their skin from a photo." },
  "hard-lines/hard-lines.handoff_wording": "That one's for me to answer personally, since it depends on you. I'll get back to you myself, usually within a day or two.",
  "hard-lines/hard-lines.never_say": "Never promise results or say something is \"guaranteed\" or \"cures\" anything. Never say what someone's skin condition is, never say a reaction is \"normal\", never recommend another brand or store, and never quote a price or policy that isn't on the website.",

  /* ── Treatments, explained: New Clients Start Here ── */
  "treatments/explain-new-client.steps": "We talk first: your concerns, your current routine, your goals. Then a fully customized facial: double cleanse, enzyme exfoliation, extractions, a targeted mask, massage, LED and cryo globes. We end with your home routine and the plan for next time.",
  "treatments/explain-new-client.feel": "Relaxing, mostly. Extractions can pinch a little for a minute, and the exfoliation can tingle; nothing that hurts. Tell me if anything stings and I adjust.",
  "treatments/explain-new-client.downtime": "None. A little pink for an hour or two, maybe a small bump or two surfacing in the next day where I did extractions. You can go about your day; just no makeup, heat or sweat until tomorrow.",
  "treatments/explain-new-client.how_often": { pick: "Every 4 to 6 weeks", text: "After your first visit you book the Lumevina Custom Facial as a returning client; every 2 to 4 weeks if we're working on something specific." },
  "treatments/explain-new-client.results": "A glow right away. Real change shows over a few visits with the home routine in between: usually a noticeable difference by the third visit.",
  "treatments/explain-new-client.best_for": "Anyone new to me without acne concerns: dullness, dryness, texture, fine lines, maintenance. New clients with acne concerns book the Acne Bootcamp consultation + treatment instead.",

  /* ── Lumevina Custom Facial ── */
  "treatments/explain-custom-facial.how_often": { pick: "Every 4 to 6 weeks", text: "Every 2 to 4 weeks during a corrective stretch." },
  "treatments/explain-custom-facial.best_for": "Returning clients who are on a routine with me and want to keep their skin on track. If you're new, book New Clients Start Here; if acne is the concern, the Monthly Acne Treatment includes more time for peels and extractions.",

  /* ── Ageless Grace Facial ── */
  "treatments/explain-ageless-grace.steps": "Double cleanse, exfoliation, extractions if needed, then the age-supporting part: oxygen therapy and a professional Tightening Protein Booster to lift, firm and brighten, with massage, LED and cryo globes. Add dermaplaning or a peel for more exfoliation and glow; I'll tell you whether one or both fit your skin.",
  "treatments/explain-ageless-grace.feel": "Cool, plumping and relaxing. The oxygen feels like a cool breeze; the booster is a warm, tightening mask. Nothing uncomfortable.",
  "treatments/explain-ageless-grace.downtime": "None. You leave glowing and can go straight to dinner; makeup the next morning. With a peel added, light flaking on day 2 or 3 is possible.",
  "treatments/explain-ageless-grace.how_often": { pick: "Every 4 to 6 weeks", text: "Monthly is where it shines; before an event, book it 3 to 5 days ahead." },
  "treatments/explain-ageless-grace.results": "Firmer, smoother, brighter skin the same day, lasting a week or two, and it builds with regular visits. For lasting firmness it pairs with a home routine (retinoid, peptides, SPF) and, for deeper change, ProCell.",
  "treatments/explain-ageless-grace.best_for": "Fine lines, loss of firmness, dullness, dehydration, or anyone who wants a glow before an event. Suitable for all skin types. Active breakouts are better served by the acne treatments first.",

  /* ── ProCell Microchanneling ── */
  "treatments/explain-procell.steps": "Cleanse and numb, then the microchanneling itself: tiny, controlled channels across the skin that trigger collagen, while growth-factor serums go in. Then LED to calm, and you go home with the recovery set and post-care instructions. About an hour and ten minutes.",
  "treatments/explain-procell.feel": "With numbing, mostly a vibration and light scratching; the forehead and jaw are the most sensitive spots. Afterwards your skin feels warm and tight, like a sunburn.",
  "treatments/explain-procell.downtime": "Red like a sunburn for 12 to 48 hours, tightness, sometimes pinpoint marks or light flaking by day 3. No makeup for 24 hours, no sweat or sun for 48. Plan it at least a week before anything important.",
  "treatments/explain-procell.how_often": { pick: "A series, then maintenance", text: "4 weeks apart. A minimum of 4 treatments; up to 8 depending on your concerns. Then a session every few months to maintain." },
  "treatments/explain-procell.results": "Collagen builds over weeks, so you see the change between sessions: smoother texture, softer scars and lines, smaller-looking pores, more even tone, with the biggest difference after the full series. Results last with maintenance and daily SPF.",
  "treatments/explain-procell.best_for": "Acne scars, uneven texture, enlarged pores, fine lines, pigmentation and overall skin quality. Not for active, inflamed acne (we clear that first), open skin, or active cold sores.",
  "treatments/explain-procell.wait": "If you're on Accutane or finished it in the last 6 to 12 months, have active breakouts or cold sores, are pregnant, scar with keloids, or take blood thinners, tell me first: some of those wait, some need your doctor's OK. Pause retinoids and acids for a week before.",
  "treatments/explain-procell.before": "No retinoids, acids, scrubs or dermaplaning for a week before, no sun or tanning, no waxing on the face that week, and come with clean skin and no makeup.",

  /* ── Refresh Peel ── */
  "treatments/explain-refresh-peel.steps": "Cleanse, prep, then the peel goes on for a few minutes while I watch your skin, then it's neutralized or removed and I finish with calming products and SPF. Quick, in and out.",
  "treatments/explain-refresh-peel.feel": "Warm and tingly for a few minutes, sometimes a little itchy, then it fades. I'm fanning you the whole time.",
  "treatments/explain-refresh-peel.downtime": "Pretty much none: pink for an hour or two, maybe light flaking on day 2 or 3. Makeup the next day. A lunchtime peel.",
  "treatments/explain-refresh-peel.how_often": { pick: "Every 3 to 4 weeks", text: "A series of 3 to 6 is where it makes a visible difference; then as a boost with your facials." },
  "treatments/explain-refresh-peel.results": "Brighter, smoother skin within days, and with a series, better texture, tone and fewer breakouts. Kept with your routine and SPF.",
  "treatments/explain-refresh-peel.best_for": "Dullness, mild texture, congestion, early dark marks, or a glow before an event with no time to peel. Sensitive or very reactive skin, and anything open or inflamed, waits.",
  "treatments/explain-refresh-peel.wait": "Accutane in the last 6 to 12 months, a prescription retinoid in the last week, a sunburn or tan, active cold sores, a recent laser or peel, pregnancy, or a named skin condition: tell me first, and some of those need your doctor's OK.",
  "treatments/explain-refresh-peel.before": "Pause retinoids and acids for 3 to 5 days (a prescription retinoid, about a week), no waxing or dermaplaning on the face that week, no sun, and come with clean skin.",

  /* ── Corrective Peel ── */
  "treatments/explain-corrective-peel.steps": "Cleanse and prep, then a stronger or layered peel applied in stages while I watch how your skin responds, then neutralized, calmed and protected. You go home with specific products and instructions for the week.",
  "treatments/explain-corrective-peel.feel": "Hot and stingy for several minutes, more than the Refresh Peel; it eases as it neutralizes. Your skin feels tight afterwards.",
  "treatments/explain-corrective-peel.downtime": "Plan a week. Pink to red for a day or two, tightness, then visible peeling on days 2 to 5, done by day 7. No makeup until the peeling is over, no sun, no heat. Not the week before an event.",
  "treatments/explain-corrective-peel.how_often": { pick: "Every 4 to 6 weeks", text: "A series of 3 to 4, then maintenance with facials or Refresh Peels." },
  "treatments/explain-corrective-peel.results": "Once the peeling is done: smoother texture, fewer dark marks, softer fine lines and clearer skin, improving with each one in the series. Daily SPF is what keeps it.",
  "treatments/explain-corrective-peel.best_for": "Texture, post-acne marks, sun damage, fine lines and stubborn congestion, on skin that's already used to actives. Sensitive, reactive or very dark-marking skin, and anything active or open, usually starts with the Refresh Peel.",
  "treatments/explain-corrective-peel.wait": "Accutane in the last 6 to 12 months, a prescription retinoid in the last week, a sunburn or tan, active cold sores or breakouts, a recent laser or peel, pregnancy or breastfeeding, a named skin condition, or a keloid history: tell me first; several of these need your doctor's OK.",
  "treatments/explain-corrective-peel.before": "Pause retinoids and acids for a week, no waxing or dermaplaning on the face for a week, no sun, and plan the week after to be a quiet one for your skin.",

  /* ── Dermaplaning ── */
  "treatments/explain-dermaplaning.steps": "Clean, dry skin, then a sterile blade glides over the face at an angle, lifting dead surface cells and the fine vellus hair. A few minutes per area, then calming products and SPF, or straight into your facial or peel.",
  "treatments/explain-dermaplaning.feel": "Painless; a light scraping sensation, like a soft brush. Most people find it relaxing.",
  "treatments/explain-dermaplaning.downtime": "None. A little pink for a few hours, smooth right away, makeup glides on from the next day. SPF matters more than usual for a few days.",
  "treatments/explain-dermaplaning.how_often": { pick: "Every 4 to 6 weeks", text: "As the fine hair returns, usually 3 to 5 weeks." },
  "treatments/explain-dermaplaning.results": "Instantly smoother, brighter skin and makeup that sits better; products and peels absorb better afterwards. The hair grows back exactly as it was, not thicker or darker.",
  "treatments/explain-dermaplaning.best_for": "Dullness, peach fuzz, dry flaky skin, makeup that cakes, or as an add-on to a facial or peel. Not for active breakouts, open skin, very reactive skin or active cold sores.",
  "treatments/explain-dermaplaning.wait": "Active or pustular breakouts, Accutane in the last 6 to 12 months, a prescription retinoid that week, a sunburn, cold sores, or a recent peel or laser on the face: tell me first.",

  /* ── Acne Bootcamp ── */
  "treatments/explain-acne-bootcamp.steps": "First visit: a consultation (your skin, routine, habits, what's driving it) and a treatment: double cleanse, exfoliation, extractions, calming and antibacterial steps, LED. You leave with a strict home routine we build up slowly. Then monthly treatments, or every two weeks for severe acne, with more time for peels and extractions.",
  "treatments/explain-acne-bootcamp.how_often": { pick: "Every 2 weeks", text: "Monthly for most; every two weeks for severe acne. Until we're clear, then maintenance monthly." },
  "treatments/explain-acne-bootcamp.results": "Give it 90 days to see real results and 3 to 6 months to be mostly clear. Consistency at home and following the aftercare exactly make the difference; some purging in the first weeks is normal.",
  "treatments/explain-acne-bootcamp.best_for": "Anyone with breakouts, from congestion to inflamed acne, who's ready to commit to a home routine. Cystic, scarring or clearly hormonal acne may need a doctor alongside me, and I'll say so.",

  /* ── Consultations ── */
  "treatments/explain-consultations.steps": "We go through your skin, your routine, your habits and your goals, I look at your skin (in person, or close-up photos in natural light for a virtual one), and you leave with a plan: which treatment, which products, in what order. The fee goes toward your products or first treatment.",
  "treatments/explain-consultations.best_for": "Anyone who wants a plan before committing to a treatment, or has a routine question that needs more than a text. Virtual works for routine questions; in person is better when I need to see your skin up close.",

  /* ── Brazilian, bikini and the mini vajacial ── */
  "treatments/explain-brazilian.steps": "You undress from the waist down and lie on the table; I cleanse and prep the skin, apply warm hard wax in sections and remove it without strips, working front to back, then tweeze any strays and finish with a soothing product. The mini vajacial adds extractions, ingrown removal and a cooling mask.",
  "treatments/explain-brazilian.feel": "A quick sting as each section comes off, then it fades. Hard wax is gentler than strip wax. Breathe out as I pull, and it's over in 30 to 40 minutes. The first is the most sensitive.",
  "treatments/explain-brazilian.downtime": "Red, warm and a little tender for a few hours; small bumps for up to a day. Loose clothes, no heat, sweat or sex for 24 hours, and you're fine.",
  "treatments/explain-brazilian.how_often": { pick: "Every 4 to 6 weeks", text: "Regular is easier: the hair grows back finer and each visit is quicker. No shaving in between." },
  "treatments/explain-brazilian.wait": "Accutane in the last 6 to 12 months, a prescription retinoid on the area, a sunburn, broken or irritated skin, or an active infection: tell me first. Pregnancy waxing is common but more sensitive; check with your doctor if you're unsure.",
  "treatments/explain-brazilian.before": "A quarter inch of hair (2 to 3 weeks after shaving), exfoliate 2 or 3 days before, shower that day, no lotion or oil on the area, loose cotton. An over-the-counter pain reliever 30 to 45 minutes before is your call.",

  /* ── Body and face waxing ── */
  "treatments/explain-body-face-wax.feel": "A quick sting per strip that fades right away; brows and lip are over in seconds. Underarms and the back are the most sensitive the first time.",
  "treatments/explain-body-face-wax.how_often": { pick: "Every 3 to 4 weeks", text: "Brows, lip and underarms every 3 to 4 weeks; arms, back and stomach every 4 to 6." },
  "treatments/explain-body-face-wax.wait": "No waxing on sunburned, broken or irritated skin, on an active cold sore (lip), over a prescription retinoid or acids used on that area that week, or during and for months after Accutane. Tell me first.",
  "treatments/explain-body-face-wax.before": "A quarter inch of hair, no shaving in between, gentle exfoliation 2 or 3 days before, and clean, dry skin with no lotion or deodorant on the day.",

  /* ── Skin concerns: a few general answers on the cards clients ask about most ── */
  "concerns/breakouts-and-acne.mistakes": "Over-exfoliating, picking and squeezing, switching products every two weeks, using too much acne med, skipping moisturizer and SPF because the skin is oily, and stopping the routine as soon as it clears.",
  "concerns/breakouts-and-acne.habits": "Hands off your face. Clean pillowcase twice a week, wipe your phone, keep hair products off the hairline, wash your face after sweating, white towels with the acne med, and don't let makeup brushes go unwashed.",
  "concerns/breakouts-and-acne.escalate": "Cystic, painful or scarring acne, acne that hasn't moved after months of doing the routine properly, breakouts that are clearly tied to your cycle, or anything that looks infected: that's when I bring in a dermatologist, and anything about medications is your doctor's.",
  "concerns/purging-vs-breakout.first_questions": "What did you start, and when? Where are the bumps: the places you usually break out, or somewhere new? Do they sting or itch? How long have they been there?",
  "concerns/purging-vs-breakout.timeline": { pick: "4 to 6 weeks", text: "Purging shows up in the first 2 to 6 weeks after starting an active, in the spots you usually break out, and clears fast. A reaction shows up in new places, with redness, itching or stinging, and keeps going: stop and message me." },
  "concerns/purging-vs-breakout.escalate": "Bumps that are spreading to new areas, stinging, itchy or hive-like, or any purge that's still going after 6 to 8 weeks. Send me a photo and we adjust.",
  "concerns/dark-spots.avoid": "Picking, sun without SPF, harsh scrubs, over-exfoliating, and lightening products from the internet. Dark marks fade with time, protection and gentle consistent care, not with force.",
  "concerns/dark-spots.habits": "SPF every single morning and reapplied outside, a hat in strong sun, hands off breakouts, and patience: marks take months to fade, faster on skin that isn't being irritated.",
  "concerns/dark-spots.escalate": "A dark patch that's new, growing, uneven or changing, or a spot that bleeds or itches, needs a doctor, not a product. Large symmetrical patches on the cheeks or upper lip can be melasma, which we manage together with a doctor.",
  "concerns/ingrown-hairs.avoid": "Tight clothes and friction on the area, shaving between waxes, digging at ingrowns with tweezers or nails, and skipping exfoliation after the first couple of days.",
  "concerns/ingrown-hairs.habits": "From day 2 or 3 after your wax, exfoliate the area gently 2 or 3 times a week and keep it moisturized. Loose cotton, especially after workouts. Regular waxing every 4 to 6 weeks, so the hair stays fine.",
  "concerns/ingrown-hairs.escalate": "An ingrown that's painful, hot, pus-filled or keeps coming back in the same spot, or bumps that spread: message me with a photo. Anything that looks infected should be seen by a doctor."
};

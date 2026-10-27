# Rest Frame ep06: script audit (26 Oct 2026)

## Verdict

The episode needs small fixes before voicing. Every number I could recompute is correct:
- 1 cm² of standard air = 101,325 Pa x 1e-4 m² / 9.80665 = 1.033 kg ("just over a kilogram").
- The full water column is 101,325/(998.2 x 9.81) = 10.35 m, shown as 10.3. At 1000 kg/m³ and standard g it is 10.33 m.
- With 20 °C vapor: (101,325 - 2,339)/(998.2 x 9.81) = 10.11 m ("near ten meters", "stops: 10.1 m").
- The sip lifts 19.3 cm = 18.9 hPa, so the spine reads 994 hPa ("about 20 cm up").
- Lungs: 100 cmH2O = 98.07 hPa, so 915 hPa and a 1.00 m column.
- The 10.3 m line weighs 1035 cm x 0.9982 g/cm³ = 1.033 kg per cm².
- The end card's 76 cm of mercury is correct.

The sources say what they're cited for (search excerpts only; page fetches are blocked here):
- APS: pumps limited to about 10 m, 1644, 76 cm, with a vacuum above.
- IPM: atmospheric pressure, not suction, and about 30 ft.
- The Southeast Missourian lid demo: 'You need the lid off.'
- BLSA: MIP of 101 and 72 cmH2O.
- 1644 instead of 1643 for Torricelli is defensible from APS, the Florence museum and the 11 June 1644 letter.

The story has all seven beats: hook over the payoff image, the sip, the lid that breaks the expectation, Torricelli and the ocean of air, the escalation to three stories with boiling at the top, the measure, the takeaway, and the ice tease. Each beat outside the hook has at most one question, there are no exclamation marks, and no Never-write phrases.

The real problems are four:
1. "Your lungs? About one meter" answers last episode's "could you still drink through it?" with an inspiratory-muscle figure. A mouth demonstrably sips far higher: 2.4 m per Scientific American, 6–7 m in Veritasium's test.
2. The change beat's 915 hPa "hardest sip" readout is that same lungs figure.
3. "Surprisingly, not suction" announces the surprise and contradicts the episode's own suction mechanism.
4. The takeaway repeats the why instead of reframing.

Housekeeping outside the voiced script:
- The c5 note in claims.json says the spine goes to 993 hPa, but the screen correctly shows 994 hPa for the 19.3 cm lift.
- The compile.py docstring still describes the dropped jar-pumped-to-100-hPa staging.

Files: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit-ep06/physics/ep06/script.md, /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit-ep06/physics/ep06/claims.json, /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit-ep06/physics/ep06/compile.py.

## Confirmed findings (2) — fix before the final render

### F1 · misleading

**Line:** `vo: Make the straw three stories tall. {-} Your lungs? {-} About one meter. {c8} (on screen: label "your lungs: about 1 m", spine "your lungs' best 1.00 m")`

**Problem.** This beat answers episode 5's tease ("a drinking straw, three stories tall. Could you still drink through it?"), so viewers will hear "about one meter" as the most they could sip. The source, c8, measures maximal inspiratory pressure, which is the breathing muscles. The claim note admits that a sip mostly uses the cheeks and tongue and that its sources don't cover that. A mouth working as a pump does much better than inhaling, and a well-known demonstration contradicts the implied answer. A physicist will object, and so will commenters.

**Evidence.** Search excerpts only (WebFetch failed on DNS, and curl got a 403 from the proxy CONNECT). Scientific American and Science Buddies, 'A Really Long Straw': 'some people struggle with a three-foot straw while others can drink standing eight feet above their drink' (2.4 m). Veritasium, 'World's Longest Straw' (2012), from several summaries: liquid sucked all the way up 6 m of tubing off a balcony, and to about 7 m in a 10.5 m tube. Calculation: 7 m x 998.2 kg/m3 x 9.81 m/s2 = 68.5 kPa below atmospheric, against MIP's 100 cmH2O = 9.8 kPa, about 7 times more. The c8 numbers themselves check out: BLSA means are 101 cmH2O (men) and 72 cmH2O (women) per the PubMed excerpt, and 100 cmH2O holds 9806.65/(998.2 x 9.81) = 1.00 m.

**Fix.**

vo: Make the straw three stories tall. {-} Lungs alone? {-} About one meter. {c8} Cheeks and tongue, pumping? {-} A few meters; one stunt reached seven. {c15} Labels: "lungs alone: about 1 m", then "mouth pump: up to ~7 m". Spine: "lungs alone". New c15 sources: Santander et al. 2013 (PMC3580144, median −278.9 mbar while drawing water in = 2.8 m) and Veritasium 2012 (drank up 6 m, lifted ~7 m). Lid beat: say "breathe in as hard as possible" or drop the 915 hPa figure. No new badge.

<details><summary>Verifier's check</summary>

The finding stands. Taken literally, the line is true: MIP is measured with a small leak in the mouthpiece so that the cheeks can't add pressure, which means it isolates the breathing muscles. The c8 arithmetic checks out (BLSA means are 101 and 72 cmH2O, and 100 cmH2O = 9.807 kPa, which holds 9806.65/(998.2 x 9.81) = 1.00 m). In context, though, it misleads. The beat answers ep05's "Could you still drink through it?", the spine labels the value "your lungs' best 1.00 m", and the claim note admits it chose "lungs" over "you" only because its sources leave out the cheeks and tongue. General viewers will hear that a person can only manage about a meter. That is wrong.

Evidence (search excerpts; PMC and Göttingen fetches failed on DNS and the proxy returned 403):
- Science Buddies/Sci Am: some people drink standing 8 ft (2.4 m, 23.5 kPa) above their drink, and the activity credits this to "lung power". That directly contradicts "your lungs' best 1.00 m".
- Veritasium (2012): Nigel drank up 6 m of tubing off a balcony (58.8 kPa). In a 10.5 m tube the liquid reached about 7 m (7 x 998.2 x 9.81 = 68.5 kPa, about 7 times MIP). That 7 m is how high the liquid rose, not a drink, so the citation should say "lift".
- A better peer-reviewed source the fact-checker missed: Santander, Engelke, Olthoff and Völter 2013, Eur Arch Otorhinolaryngol (PMC3580144). In 52 healthy adults drawing water in through an oral shield (an ordinary task, not a maximal effort), the median oral pressure was −278.9 mbar, equal to 2.85 m of water. That is already about 3 times MIP.

Problems with the proposed fix:
1. "Breathing in?" means the same thing as "Your lungs?". The narration still answers the tease with "about one meter", and a small badge then contradicts the voice.
2. The badge goes in slot tr at about 39–43 s, where it collides with the existing "Climb speed: illustration" badge (slot tr, 40.87–44.57 s).
3. It misses a knock-on error in the lid beat. "Then sip, as hard as possible" ramps the spine to 915 hPa, and 915 hPa is the lungs' MIP figure. Once the film admits that a mouth sip pulls harder, that number is wrong for "hardest sip".

</details>

### F2 · misleading

**Line:** `vo: Then sip, as hard as possible. {-} (on screen: spine "air in the straw" falls to about 915 hPa and lights on "possible.", described as "the hardest sip")`

**Problem.** The readout shows 915 hPa as the hardest possible sip. That value is 1013.25 - 98.07 hPa, the lungs' maximal inspiratory pressure (HARD_HPA = 98.0, cited to c8). It is not a sip. Its own source doesn't support it as "the hardest sip", and the mouth demonstrably goes much lower. The physics of the beat doesn't need a maximum anyway: under a rigid, airless lid, no sip of any strength lifts the drink.

**Evidence.** Calculation: 100 cmH2O = 98.07 hPa, so 1013.25 - 98.07 = 915.2 hPa. Veritasium's roughly 7 m lift needs the straw at 1013.25 - 685.5 = 328 hPa, and the 6 m lift needs 426 hPa (search excerpts, as in F1). The c2 reasoning stays valid at any mouth pressure above water's 23 hPa vapor pressure.

**Fix.**

vo: Then sip, as hard as you like. {-} Re-voice vo03 and move compile.py's HARD anchor from "vo03:possible." to "vo03:like."; the spine keeps 915 hPa as an example of a hard sip. Change "the hardest sip" to "a hard sip" in the script preamble, README's change row, HUMAN-REVIEW items 3 and 8, and the HARD_HPA comment.

<details><summary>Verifier's check</summary>

The finding stands. One detail is overstated: the words "the hardest sip" never appear on screen. They are only in the script preamble, README.md row 20, HUMAN-REVIEW.md items 3 and 8, and the compile.py comment on HARD_HPA. On screen the spine label just says "air in the straw". It still makes the claim, though. In compile.py the spine ramps from 1013.25 to P0 - HARD_HPA = 915.25 hPa between "sip," and "possible." and stays lit from "possible." (film.json keys 15.93 to 16.87 s). Together with the voice saying "as hard as possible", a viewer reads 915 hPa as the hardest sip a person can manage.

That number is unsupported. HARD_HPA = 98.0 comes from c8, and c8 is maximal inspiratory pressure, which measures the breathing muscles. c8's own note says "an ordinary sip mostly uses the cheeks and tongue, which these sources don't cover". The number is also contradicted by other sources. Scientific American's "A Really Long Straw" (search excerpt) says some people drink standing eight feet (2.4 m) above the glass. That needs the straw at about 1013 - 239 = 774 hPa. Summaries of Veritasium's "World's Longest Straw" (search excerpts) say someone lifted water 6 m by mouth, which needs about 426 hPa, and report a best of about 7 m, which needs about 328 hPa.

I redid the arithmetic: 100 cmH2O = 98.07 hPa, so 1013.25 - 98.07 = 915.2 hPa. At 998.2 kg/m³ and g = 9.81, 6 m takes 587.5 hPa and 7 m takes 685.5 hPa.

The physics of the beat (c2) doesn't need a maximum. With a full glass and an airless rigid lid, no mouth pressure above water's 23 hPa vapor pressure lifts the drink. Dissolved air could come out at very hard sips, but that is a negligible caveat at this level. So "as hard as you like" is accurate, and a 915 hPa example reading is fine.

The proposed fix is sound but leaves things out. Changing the voice line means re-voicing vo03. compile.py's HARD = (A("vo03:sip,"), A("vo03:possible.")) would then lose its anchor. README.md and the HARD_HPA comment also say "the hardest sip".

</details>

## Story and wording notes (2) — apply when cheap

### F3 · wording

**Line:** `vo: What lifts a drink up a *straw*? {-} Surprisingly, not suction. {c13}`

**Problem.** "Surprisingly" announces the wonder instead of earning it. That breaks WRITING.md rule 8, and the word is a softer form of the Never-write phrase "this will surprise you". "Not suction" also contradicts the episode itself. The why describes exactly what physics calls suction (lowering the pressure inside the straw), and c6 says "suction pumps". So a specialist will read the hook as a play on words. What the episode actually disproves is a pull, which the normal beat ("It feels like you're pulling it") and the takeaway ("Straws don't pull") already set up.

**Fix.** vo: What lifts a drink up a *straw*? {-} It's not a pull at all. {c13}

### F4 · story

**Line:** `vo: Straws don't pull. {c10} You thin the air inside, and the atmosphere *pushes*. {c11}`

**Problem.** The takeaway's second sentence repeats the why almost word for word ("A sip lowers the pressure inside the straw, and the air outside pushes the drink up"). That makes it a summary, which WRITING.md says a takeaway must not be. It also ignores the escalation, so it doesn't change how the viewer sees frame 0, the tall column stopped near ten meters. The spine during this line already reads "the air's push, at most" at 10.11 m. The line should say the same thing.

**Fix.** vo: Straws don't pull. {c10} The air *pushes*, and it runs out near ten meters. {c11,c6}

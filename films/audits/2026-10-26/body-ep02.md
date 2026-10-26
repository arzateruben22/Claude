# Meanwhile, Inside ep02: script audit (26 Oct 2026)

## Verdict

Every voiced fact checks out, and the numbers in the headings are right. The script's lint passes with 0 errors; the only warning is that pron.json is missing. The seven-beat shape works: a real hook, a wrong idea (blue blood), an escalation from one molecule to the whole body, a takeaway a viewer could repeat, and a specific tease. No 'Never write' phrases and no forced hype.

The five findings are small honesty and direction fixes. One wording change in the why beat (word count unchanged). Three badges the house rules require but the headings leave out: not to scale on the hook, illustration on the change, slowed ×10 on the whoa. One end-card fact the plan promises but the end card line omits.

Arithmetic, recomputed:
- 270M × 4 = 1.08 billion seats ('about a billion'; 250–300M per cell gives 1.0–1.2 billion).
- 5 L of blood ÷ 5 L/min cardiac output = about once a minute.
- 75 mL × 60 / 6000 mL/min = 0.75 s in a lung capillary; equilibration takes 0.25 s of it.
- 97 − 75 = 22 points of seats refilled per pass.
- Tally: 250/60 × 62 s = 258 mL when the line starts and about 280 mL at 67.25 s, against a US cup of 236.6 mL (+9% to +18%) or a metric cup of 250 mL. 'About a cup' holds.

Sources: WebFetch failed with DNS errors (ENOTFOUND), so every check used search excerpts. Confirmed:
- Merck: about 270 million hemoglobins per cell.
- OpenStax 39.4: four subunits, each heme binds one O₂.
- Cooperative binding: from OpenStax 39.4 and other excerpts; the exact UCSB wording was not found.
- Live Science: 'never a time when human blood is blue'.
- e-Learning Anaesthesia: about 250 mL/min at rest.
- Purves NBK10921 figures (150 vs 0.5–10 m/s): confirmed only through an excerpt that repeats the same numbers; the textbook text itself did not appear.
- Venous 75% and arterial 97% saturation: both standard values. The arterial 97% appears in an excerpt from Klabunde's page; the exact '75% at 40 mmHg' sentence appears in another physiology source, not in Klabunde's indexed text.

One ledger fix that does not touch the script: c11's source, NBK54473, is David B. Young, 'Control of Cardiac Output' (Morgan & Claypool, 2010), Chapter 1, Introduction. Its excerpt says normal blood volume roughly matches what the heart pumps each minute. Put that in source_title in place of 'title not seen'.

As planned, a person still opens each link and a physiologist signs off before the episode posts.

## Confirmed findings (3) — fix before the final render

### F1 · misleading

**Line:** `Your veins look *blue*, so it's easy to guess the blood inside them is. {c7}`

**Problem.** The line tells every viewer that their veins look blue. Under darker skin, veins often look green, or hardly show at all. Bible §9 lists this as a simplification that must be flagged, and c7's own note admits it, but nothing in the voice or on screen flags it.

**Evidence.** Live Science (search excerpt, the page c7 cites): 'under darker skin, veins often appear green, and they can appear blue or purplish under lighter skin tones'. Bible §9: 'Whether veins look blue depends on how deep they are and on skin tone.' I could not fetch pages in this sandbox (DNS ENOTFOUND), so this comes from search excerpts.

**Fix.**

Veins often look *blue*, so it's easy to guess the blood inside them is. {c7}   (Still 14 words, so the why beat keeps its 2.95 words/s. Update c7's "sentence" in claims.json to match, because lint wants the exact spoken text.)

<details><summary>Verifier's check</summary>

The finding stands. "Your veins look *blue*" tells every viewer something that is untrue for many of them. How a vein looks depends on how deep it sits, how wide it is, and how light scatters in the skin above it (Kienle et al. 1996, the model behind c10 and the Waterloo source). Under darker skin, veins often look green or olive, or hardly show at all. Bible §9 (line 305) names this exact simplification under "Flag the simplifications". c7's own note admits it, and c7's "claim" field already says "Veins under the skin *often* look blue". So the spoken line is stronger than the claim it cites. Nothing in the why beat flags it: the voice doesn't, and the on-screen direction only shows the badge "illustration".

The line is not fine just because the "veins look blue" framing is common. The channel's own bible sets a stricter rule, and "your" puts the generalisation on each viewer personally.

I could not re-check the Live Science wording. WebFetch failed (getaddrinfo ENOTFOUND www.livescience.com), and WebSearch refused because the shared search budget for this run was used up. The point rests on the bible's own rule, on the c7 note, and on well-established vein optics. None of it depends on that one excerpt.

The proposed fix works. "Veins often look *blue*, so it's easy to guess the blood inside them is." is still 14 words. It drops the universal "your", matches c7's claim field word for word in meaning, and still sets up the wrong idea for "It never is." I tested it on a copy in the scratchpad (verify_c7): I changed script.md and c7's "sentence" in claims.json, then ran lint.py with --segment meanwhile. Result: 0 errors (the only warning, missing pron.json, was there before). The why beat stays at 36 words, 2.95 words/s, inside the 2.2–3.0 window. c7's "sentence" must be updated together with the script, as the finding says.

Optional, not needed: §9 could be met more fully without changing the voice track. A small on-screen note in the why shot (e.g. "how blue: depends on skin tone and depth") would name skin tone directly. "Often" only hedges the claim.

</details>

### F2 · misleading

**Line:** `## change {shot: one hemoglobin fills, four O₂ boarding one by one, each sooner; garnet to crimson · label: O₂, white with its glyph and ring · energy: 0.55} (16–27.5 s)`

**Problem.** The picture shows each O₂ boarding sooner than the last, which reads as speed. The 24 Oct review cut 'land faster' from the voice because the sourced claim is about affinity. c5 says this staging is 'badged as an illustration', but this heading has no badge (the why heading does). The compiler builds from the heading, so the film would show the speed idea with no badge.

**Evidence.** c5 note: 'The film shows each boarding a little sooner as staging, badged as an illustration.' The why heading has 'badge: illustration' and the change heading does not. The sources describe affinity. OpenStax Biology 39.4 and the research summary in the same search (excerpts): 'allows the second molecule of oxygen to bind more readily'. ChemistryTalk: 'the remaining heme groups have a stronger affinity'. WRITING.md rule 9: 'Idealisations are said aloud or badged.'

**Fix.**

## change {shot: one hemoglobin fills, four O₂ boarding one by one, each sooner; garnet to crimson · badge: illustration · label: O₂, white with its glyph and ring · energy: 0.55} (16–27.5 s)

<details><summary>Verifier's check</summary>

The finding is correct. The script says "`{…}` in a heading is direction for the compiler", so a badge only shows up on screen if the heading asks for one. The change heading (16–27.5 s) has no badge key. Its direction "each sooner" stages the O₂ binding as getting faster. The c5 note says that staging is "badged as an illustration", but nothing in the heading makes that happen. Only the why heading, which covers the skin optics, has "badge: illustration". So c5 claims a badge the film would never render.

The staging also works against the 24 Oct review. That review cut "land faster" in favour of "easier" because the sourced claim is about affinity: c5's own excerpt reads "the easier it is for more oxygen to bind". Under WRITING.md rule 9 ("Idealisations are said aloud or badged"), speed staging that the voice deliberately avoids saying must carry a badge. It also has none of the "slowed ×N" note ep01 used for its slowed shot. Real O₂ binding takes far less time than the roughly 11 s shown.

The line is not defensible as written. A general audience would see the next O₂ arriving sooner and conclude that cooperativity speeds binding up, with nothing on screen to say it is staged. There is a small kinetic basis for "sooner": the R state has somewhat higher O₂ on-rates. But most of the effect is in affinity, through off-rates, and neither the sources nor the review support a speed claim.

The proposed fix adds "badge: illustration" to the change heading. That matches c5's note and rule 9. It is the same badge wording the why beat uses. It does not clash with the corner-note limits, because this badge ends at 27.5 s, just as the why badge begins.

A stronger option exists but is not required: restage the shot to show affinity instead of speed, for example "the first O₂ bounces off before it holds, each later one holds more readily", and keep the badge. That would also mean rewording c5's note.

I could not run a fresh web search because the per-turn search limit was already used up. This verdict rests on the script, claims.json, kits/cinema/script/WRITING.md, the ep01 heading conventions, and the source excerpts already quoted in claims.json.

</details>

### F4 · misleading

**Line:** `## hook {shot: macro; frame 0 is the hero cell cut open, packed with glowing hemoglobin, one O₂ boarding at the cut (labelled O₂) · title: "A billion passengers" · pre: 0.1 · energy: 0.7} (0–5 s)`

**Problem.** Frame 0 shows separate hemoglobin molecules and an O₂ molecule at the scale of a whole cell. That is a huge scale cheat. The heading carries no 'not to scale' badge, but the bible requires one and episode 1 badged every O₂-beside-a-cell shot.

**Evidence.** A red cell is about 7.5 µm across (ep01). BioNumbers 100936 (search excerpt) puts hemoglobin at about 5 nm. 7,500 nm / 5 nm = 1,500 hemoglobins across one cell, and O₂ (about 0.3 nm) is about 25,000× smaller than the cell. Anything you can see at this framing is enlarged by orders of magnitude. Bible §9: 'Shots that compress scale are labelled "not to scale"'. ep01 compile.py BADGES: nts-o2 and nts-in, both 'not to scale'.

**Fix.**

## hook {shot: macro; frame 0 is the hero cell cut open, packed with glowing hemoglobin, one O₂ boarding at the cut (labelled O₂) · title: "A billion passengers" · badge: "not to scale", held to the iris · pre: 0.1 · energy: 0.7} (0–5 s)

<details><summary>Verifier's check</summary>

The finding is correct. The ep02 hook heading in /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/body/ep02/script.md has no badge, yet frame 0 shows a whole red cell (about 7.5 µm) packed with visible hemoglobin and one labelled O₂. I redid the arithmetic: 7,500 nm / about 5–6 nm per hemoglobin is roughly 1,300–1,500 hemoglobins across the cell, and 7,500 / 0.3 nm is about 25,000× for O₂. In a 1080 px-wide 9:16 frame, a true-scale hemoglobin would be under 1 px wide and an O₂ about 0.04 px, so anything visible is enlarged hundreds to thousands of times. Bible §9 (/home/user/Claude/films/channels/body/bible.md, line 306) says: 'Shots that compress scale are labelled "not to scale"'. WRITING.md rule 9 says idealisations are said aloud or badged. Ep01 badged this exact image. In /home/user/Claude/films/channels/body/ep01/compile.py, lines 200–201, nts-o2 and nts-in both read 'not to scale', and nts-in runs on the cut-open cell with its 'passengers' through the end card. The ep01 README, line 170, says O₂ and the 'passengers' are 'drawn hugely oversized, hence "not to scale"'. Ep02 picks up that same frame as its hook, and it badges its own vein shot ('badge: illustration'). Leaving the hook unbadged is an omission, not a deliberate choice. The `badge:` field is valid heading syntax (the physics episodes use it in hook headings). The proposed fix works, with one small problem: written unquoted, '(until the iris)' could be rendered as part of the badge text. Quoting the badge text, as physics ep01/ep03 do for multi-word badges, keeps the timing note separate from what appears on screen.

</details>

## Story and wording notes (1) — apply when cheap

### F5 · story

**Line:** `end card: "Next: The jump" · "Meanwhile, Inside · No. 03"`

**Problem.** WRITING.md picture rule 6 says the end card carries one true-fact footnote. The script's own plan says this end card carries '270 million hemoglobins × 4 seats'. The end card line, which lint reads and the compiler builds from, leaves the fact out, so it will be dropped.

**Fix.** end card: "Next: The jump" · "Meanwhile, Inside · No. 03" · "One red cell: 270 million hemoglobins × 4 seats ≈ 1 billion O₂"


## Refuted (1) — no change

### F3

**Line:** `## whoa {shot: reveal pull from the vein to the body's loop, then a lung capillary: dark cells flush bright on contact with the air sac, slowed, a 0.25 s counter · picture-only 3.5 s · energy: 0.75} (42.5–55 s)`

**Why it stands as written.** The finding misreads what this line is. The heading is a direction to the compiler, and viewers never see it. Under the kit's own rules it already produces what the fix asks for.

(1) The badge is automatic. In kits/cinema/sci/clock.js, any key with a rate below 1 generates its own badge, worded from that rate. The text is "{n}× slower" by default, and ep01 sets it to "slowed ×{n}". The page draws it with hud.badge(id, { from: clk }), as described in kits/cinema/film/README.md. A badge appears only if someone turns it off on purpose with badge: null. So "no badge" is wrong: writing "slowed" already means a badged clock segment, and the badge shows whatever factor the build uses.

(2) The counter already runs in real seconds. clock.js's stopwatch(τ) reads scene time τ, meaning real seconds, not seconds of video. "A 0.25 s counter" over a slowed shot is the kit's standard honest readout, so it cannot contradict the picture.

(3) The phrasing matches the series. Ep04's whoa heading uses the same pattern: "the handoff, slowed: the readout counts to 0.001 s". WRITING.md rule 9 ("idealisations are said aloud or badged") is met by the automatic badge.

(4) Leaving out the factor is a timing choice, not a factual error. The factor has to fit the flush to the voice line "In about a quarter of a second" and to the 3.5 s picture-only hold. ×10 is one workable choice (0.25 s × 10 = 2.5 s), but nothing requires it. Writing it into the script would only lock that timing in early.

(5) The number itself is correct. c17 (Loyola Lumen) gives transit = 75 mL × 60 / 6000 mL/min = 0.75 s, and the exchange is complete in about 0.25 s. This is the standard textbook figure: equilibrium within about the first third of the transit. I could not search again because the shared web-search budget for this turn was used up. That does not matter here, since the finding itself accepts the 0.25 s value.

If the author wants the direction spelled out anyway, a no-risk tweak that keeps the length and leaves the factor open is: "slowed and badged, a 0.25 s counter in real seconds". This is optional; the line is defensible as written.

# Rest Frame ep03: script audit (26 Oct 2026)

## Verdict

Nearly clean: I found 5 small, fixable problems and no factual errors in the claims as voiced. All five are in /home/user/Claude/films/channels/physics/ep03/script.md, claims.json and compile.py (identical to the audit copies). The story follows all seven beats plus the measure segment. The hook question is spoken by about 1.7 s, and the why carries a person and a wrong idea (Joule against \"energy lost\"). The whoa turns the hook around (the ball now flies past your hand), the takeaway is a real reframe, and the tease is specific. No line from the \"Never write\" list appears, and no forced hype. lint.py reports 0 errors and 2 word-count warnings (normal 19 words, change 16), which fit WRITING.md's \"say less here\". Source checks used search excerpts only, because every WebFetch failed with a DNS error.

Recomputed and confirmed:
- Bounce tops with e = 0.75: 100 × 0.5625 = 56.25, then 31.64, then 17.80 cm.
- ITF test: 135–147 cm from 254 cm is 53–58%. The ITF 2023 technical booklet confirms this for Type 2 balls; Type 1 balls are 138–151 cm, and 56% falls inside both ranges.
- Missing height 43.75 cm. Energy: 0.057 × 9.81 × 0.4375 = 0.245 J.
- Stacked drop with perfect bounces: tennis ball (3M − m)/(M + m) = 2.65× its speed, so 2.65² = 7.04× the height. Basketball 0.65× its speed, so it keeps 43% and hands over 57% of its energy, which supports \"most\". The result stays between 6.9× and 7.2× across FIBA ball masses of 567–650 g. UNT's 9× / 3× is the limit for a very heavy lower ball, and is quoted correctly.
- 0.5 m × 7.04 = 3.5 m.
- Joule's paddle wheel: Cambridge British Association meeting 1845, Phil. Trans. 1850.
- End-card footnote: 772 ft·lbf, and 772 / 778.17 = 0.992, so it is within 1%.
- Apollo 15 hammer and feather: correct.

Fixes:
1. Change \"doesn't quite spring back\", which contradicts the picture of the ball springing fully back.
2. Remove the stale \"floor's shiver\" from the change heading; the review cut it.
3. The measure readout \"ball warms by, at most 0.0021 °C\" gives a false upper bound and false precision.
4. Add \"about\" to \"two thousandths of a degree\".
5. Give \"James Joule wouldn't\" a claim tag and a source (his 1843 postscript).

## Confirmed findings (5) — fix before the final render

### ep03-1 · misleading

**Line:** `vo: ... The ball squashes, and doesn't quite spring *back*. {c5}`

**Problem.** Taken literally, "doesn't quite spring back" means the ball stays dented. A tennis ball does get its round shape back after a bounce. What it loses is part of the push (hysteresis): it gives back less energy than went into the squash. The picture makes the literal reading worse. compile.py lets the frozen squash go on the word "spring" (U_c = A("vo03:spring")), and scene.mjs plays the squash as a symmetric sine, so the ball visibly springs fully back while the voice says it doesn't. A specialist would object, and a viewer sees the words and the picture disagree.

**Evidence.** Files checked: scene.mjs line 54, d = squash*sin(pi*(tau-land)/dc), which springs back fully; compile.py lines 81-82, the squash is held through "squashes" and released on "spring". Physics check against the Rod Cross / dynamic tennis-ball testing search excerpt: a ball dropped from 100 in. comes back to about 55 in. and loses about 45% of its energy, against about 15% in a slow compression test. So the loss is in how hard the ball pushes back, not in its shape. Sources were checked through search excerpts only; page fetches failed with a DNS error.

**Fix.**

vo: ... The ball squashes, and doesn't spring back as *hard*. {c5}  (Same syllable count. It keeps the compile.py anchors "squashes," and "spring". Also update c5's "sentence" field to match.)

<details><summary>Verifier's check</summary>

The finding stands. I checked the files, the anchors and the physics.

1. Physics. My own search found the same 2001 "Dynamic testing of tennis balls" abstract (sponet / lida.sport-iat.de record 4005426). A ball dropped from 100 in. comes back to about 55 in., so it loses about 45% of its energy in the bounce, against about 15% in a slow compression test. It measures the loss through a dynamic force-displacement hysteresis loop. The Illinois "Why do tennis balls lose their bounce" Q&A gives the same picture: internal friction in the rubber. A tennis ball does get its round shape back. What it loses is how hard it pushes back (hysteresis). c5's own claim says exactly this ("does not return all the energy of the deformation"). The spoken words don't.

2. Wording. The sentence puts "squashes" next to "doesn't quite spring back", so the natural reading is that the ball doesn't fully regain its shape, which is false. The script's own description reads the same way: "the squash that doesn't quite spring back". You can defend the line only by taking "spring back" to mean "bounce back up", and the first half of the sentence pushes listeners away from that reading.

3. Picture. I confirmed the mismatch:
- scene.mjs:54 plays the squash as a symmetric sine, d = squash*sin(pi*(tau-land)/dc), so the ball goes fully round again.
- compile.py:81-82 holds the deepest squash (F_c) and releases it on "spring" (U_c = A("vo03:spring")). At ×1/40 the rest of the squash undoes itself in about 0.1 s of film, while the voice says "doesn't quite spring back".
- The one cue that agrees with the energy reading is the slower take-off (ballAt with e = 0.75). A viewer can hardly notice it in the macro shot.

4. The proposed fix works. "doesn't spring back as *hard*" is correct physics (on the way out the ball pushes with less force at the same squash). It also makes the picture agree: the ball does spring back round on "spring", just with less push.
- The fix keeps all the anchors. norm() in kits/cinema/voice/scriptfile.py strips punctuation, so A("vo03:spring"), A("vo03:squashes,") and the "heat" label's A("vo03:back.") at compile.py:166 still resolve. That label now appears on "back", in the middle of the sentence.
- One small error in the finding: the fix is 11 syllables, not "the same" 10 (it drops "quite" and adds "as hard"). This doesn't matter, because f.layout re-flows the beats from the new vo03 length. An exact 10-syllable version is "...but won't spring back as *hard*." if wanted.
- Follow-through: re-voice vo03, re-run compile.py, update c5's "sentence" field, and change the script header bullet "the squash that doesn't quite spring back" to match.

</details>

### ep03-2 · misleading

**Line:** `## change {shot: macro push into one contact, slowed ×40 · events: sound rings, the squash, the floor's shiver · pre: 0.1 · energy: 0.5} (13.5–20.5 s)`

**Problem.** The heading still asks for "the floor's shiver". The episode's own review cut it because the floor's share of the energy is negligible on concrete (claims.json c5 note: "the floor's shiver is negligible on concrete; both were cut"). compile.py no longer renders it either: the change events are contact, freeze, spring, rings and heat. Anyone rebuilding from the script would put back a picture the fact-check removed, and would show a negligible energy sink as one of the three on-screen events.

**Evidence.** claims.json c5 note (quoted above). compile.py line 150: "change": {"contact", "freeze", "spring", "rings", "heat"}. scene.mjs line 174 draws the heat glow at the contact patch instead.

**Fix.**

## change {shot: macro push into one contact, slowed ×40 · events: sound rings, the squash, the heat glow · pre: 0.1 · energy: 0.5} (13.5–20.5 s)

<details><summary>Verifier's check</summary>

I checked the live repo and the finding holds. films/channels/physics/ep03/script.md is byte-identical to the audited copy, and its line 29 still lists "the floor's shiver" as one of the change beat's three events. The c5 note in claims.json records the review's cut: "the floor's shiver is negligible on concrete; both were cut". compile.py line 150 sets the change cues to contact, freeze, spring, rings and heat, with no floor event. compile.py lines 166 and 243 add a "heat" label and a heat event at "squashes,". scene.mjs lines 174-176 draw a glow at the contact patch from CUE.change.heat, and nothing for the floor.

The physics backs the cut too. A concrete slab is massive and stiff, so very little of a tennis ball's roughly 0.25 J goes into it as vibration. Most of the loss is hysteresis in the rubber, as c5 says.

The heading is written for the compiler, not the viewer. But this script is the source anyone would rebuild from, so leaving the shiver in brings back a picture the fact-check removed and shows a negligible sink as one of three main events. Saying "shaking" in the why voice-over and "vibration in the floor" in c8/c14 is still fine as a general statement. That does not justify a dedicated on-screen floor event in the change beat.

The proposed fix ("the heat glow") matches what compile.py and scene.mjs actually render and fits the script's own summary that most of the bounce goes to heat. It is correct as written, so no better fix is needed.

</details>

### ep03-3 · misleading

**Line:** `On-screen spine readout in the measure beat: "ball warms by, at most" 0.0021 °C (compile.py lines 139-140, dp 4)`

**Problem.** "At most" is wrong twice, and four decimal places claim a precision the estimate doesn't have. (a) The 0.0021 figure assumes pure natural rubber (2.0 J/(g·K)) for the whole 57 g ball. A real core is filled rubber (clay, silica, zinc oxide and other fillers, with a lower specific heat), and the felt is about 1.3 J/(g·K) (claims c12 already says this would raise the figure). So the realistic average is higher than the "maximum" on screen. (b) The c12 note says the contact patch heats "far more than the average", so the ball's warmest part goes well past the readout. The voiced line correctly gives a whole-ball average as an order of magnitude; the readout turns that into a hard upper bound.

**Evidence.** Calculation: 0.057 × 9.81 × 0.4375 = 0.2446 J. Pure natural rubber: 0.2446 / (57 × 2.0) = 0.00215 K. With a 47 g core at 1.6–2.0 J/(g·K) plus 10 g of felt at 1.3: average specific heat 1.55–1.88 J/(g·K), so ΔT = 0.0023–0.0028 K, above the "at most" value in every case. Search excerpts: NETZSCH lists natural rubber at 1.91–2.08 J/(g·K) (pure gum); tennis-core patents (US4592550, US5225258, US11492463) list clay, calcium carbonate, zinc oxide and silica as fillers; a generic textbook value for rubber is about 1.6 J/(g·K).

**Fix.**

label "average warming, about", dp 3, so the readout shows 0.002 °C. The label is 22 characters, the same width as today's nowrap label, it matches the voiced "two thousandths", and the "lit" timing is unchanged. Also add the filled-core figure (about 1.5 J/(g·K), about 0.003 °C) to the c12 note.

<details><summary>Verifier's check</summary>

The finding stands. In /home/user/Claude/films/channels/physics/ep03/compile.py, lines 139-140 put the label "ball warms by, at most" over 0.2446 J / (57 g × 2.0 J/(g·K)) = 0.002146 K, shown with dp 4 as "0.0021 °C". I checked this against scene.mjs line 189, where the value is rendered with toFixed(s.dp). The ball's mass cancels, so the result is just g·Δh/c = 9.81 × 0.4375 / c. Only the specific heat c matters, and 2.0 J/(g·K) is near the top of the range for rubber.

(1) "At most" fails even inside the range the film itself cites. NETZSCH lists pure natural rubber at 1.91 to 2.08 J/(g·K) (I confirmed this by search). At 1.91 the result is 0.00225, which displays as "0.0022", already above the claimed maximum.

(2) A real core is heavily filled. The ITF's own ball-manufacture document gives a sample pressurised-core recipe: natural rubber 72, butadiene rubber 28, clay 40, magnesium carbonate 8, calcium carbonate 20, zinc oxide 2.5, sulphur 3.5 (excerpt from m.itftennis.com/media/2167/balls-ball-manufacture.pdf). That makes the core about 43% minerals by mass, and those minerals hold only about 0.5 to 0.95 J/(g·K). The core works out to about 1.49 J/(g·K). Adding felt at 1.3 to 1.5 gives a whole-ball average of about 1.46 to 1.49 J/(g·K), so ΔT is about 0.0029 °C. That is roughly 35% above the "maximum" on screen, which is worse than the finding's own estimate of 0.0023 to 0.0028.

(3) The note on claim c12 already concedes that the contact patch heats far more than the average. So "the ball warms by at most" is also false for the ball's warmest part.

The only reading that defends "at most" is "at most, if all the energy stays in the ball". That bounds how much energy goes in, not how warm the ball gets, and a general viewer reads a 4-decimal readout as a hard limit. House rule 9 in kits/cinema/script/WRITING.md ("Honest, always... Use 'about'") also argues against it.

The proposed fix is a real improvement. It leaves the "lit" timing untouched and matches the voiced "two thousandths". But "on average, 0.002" is still a point estimate that the filled-core figure (about 0.0029) would round up to 0.003. Adding "about" turns it into the order-of-magnitude readout that the voice line actually gives.

</details>

### ep03-4 · math

**Line:** `vo: ... Even if it all stays in the ball, two thousandths of a *degree*. {c12}`

**Problem.** The figure is the lowest plausible value: it assumes the specific heat of pure natural rubber. With fillers and felt the estimate is 0.0023–0.0028 °C, which rounds to two or three thousandths. Rule 9 says to use "about" for estimates, and this one has no hedge. A colon also gives the elliptical clause something to hang on when spoken. (Without it, a listener is left supplying "it warms by".)

**Evidence.** Calculation as in ep03-3: 0.2446 J / (57 g × 1.55–2.0 J/(g·K)) = 0.0021–0.0028 K. claims.json c12 calls the figure "an order of magnitude" and notes that the felt raises it.

**Fix.**

vo: ... Even if it all stays in the ball: about three thousandths of a *degree*. {c12}  (One added word plus the colon, as in the proposed fix; the compile.py anchors "Even" and "degree." stay intact. With it: in compile.py line 140 change the divisor (57 * 2.0) to about (57 * 1.5) so the screen shows 0.0029 °C; update c12 in claims.json to cite the ITF core recipe, 57% rubber and 43% mineral filler, giving a core specific heat of about 1.44–1.56 J/(g·K) and ΔT = 0.245 / (57 × about 1.5) = 0.0028–0.0030 K; and change the summary line near the top of script.md to "about three thousandths".)

<details><summary>Verifier's check</summary>

The finding stands, and the line is off by more than the finding says. The proposed fix only adds a hedge to a figure that is too low.

1) The energy is right. 0.057 kg × 9.81 × 0.4375 m = 0.2446 J, so "a quarter of a joule" holds.

2) The temperature uses the wrong specific heat. c12 divides by 57 g × 2.0 J/(g·K), the value for pure natural rubber (NETZSCH: 1.91–2.08). A pressurised tennis-ball core is not pure rubber. The ITF's own ball-manufacture guide (https://m.itftennis.com/media/2167/balls-ball-manufacture.pdf, seen in a search excerpt) gives a core recipe in parts by weight: natural rubber 72, butadiene rubber 28, clay 40, magnesium carbonate 8, calcium carbonate 20, zinc oxide 2.5, sulphur 3.5. The guide says pressurised cores carry "a high loading of fine-particle filler". That makes the core only 57% rubber. Using standard values for the rest (clay about 0.9, carbonates about 0.83–0.9, ZnO 0.5, S 0.7, rubber 1.88–2.08), the core's specific heat comes to 1.44–1.56 J/(g·K). Adding 4–8 g of felt at 1.3–1.5 makes almost no difference. The whole ball holds 81–89 J/K, so ΔT = 0.0028–0.0030 °C.

3) The finding's range of 0.0021–0.0028 °C stretches down to pure rubber, which this ball is not. For a realistic ball the best estimate rounds to three thousandths. A version with less filler (about 30 parts) still gives about 0.0026. Only filler-free rubber, which a pressurised core cannot be, gets down to 0.0021.

4) As written, the line says "two thousandths" with no hedge. Rule 9 in kits/cinema/script/WRITING.md says to use "about" and "nearly". The line is also about 30% under the best estimate. The order of magnitude, and so the story point "too thin to see", is fine. The number a physicist reviewer would check is not.

5) The proposed "about two thousandths" fixes the hedge but keeps the low figure. The colon is fine, and the anchors "Even" and "degree." used at compile.py lines 138–140 and 262 still work.

Knock-on fixes:
- compile.py line 140 computes the on-screen figure as /(57 * 2.0), so the screen shows 0.0021 °C under the label "ball warms by, at most". That is the lowest plausible value, not the highest. Change the divisor to about 57 * 1.5, which shows 0.0029.
- Update the c12 claim and note in claims.json to cite the ITF recipe and this calculation.
- Update the summary line near the top of script.md, which says "about two thousandths of a degree".

If the team would rather not re-source the number, "Even if it all stays in the ball: a few thousandths of a *degree*." is the fallback. It is the same length and holds whatever the recipe.

Sources: ITF ball manufacture PDF (above); NETZSCH NR data sheet (https://analyzing-testing.netzsch.com/en/polymers-netzsch-com/elastomers/nr-natural-rubber); ITF ball approval tests, mass 56.0–59.4 g (https://m.itftennis.com/media/2100/balls-ball-approval-tests.pdf).

</details>

### ep03-5 · unsourced

**Line:** `vo: We call that energy *lost*. {-} James Joule wouldn't. {-}`

**Problem.** "James Joule wouldn't" is a historical claim about what Joule believed. That makes it an outside fact, but it is tagged {-} (nothing outside the film) and has no entry in claims.json. The statement is true and has a source; it just isn't tied to one, against rule 9 ("every factual sentence goes in claims.json"). A small caveat for the claim note: Joule wrote of "force" and the "grand agents of nature", not "energy", so the note should say "what we now call energy".

**Evidence.** Search excerpts: Joule's postscript to his August 1843 British Association paper (Cork; Phil. Mag. 1843, "On the calorific effects of magneto-electricity, and on the mechanical value of heat"): he was satisfied that "the grand agents of nature are, by the Creator's fiat, indestructible; and that wherever mechanical force is expended, an exact equivalent of heat is always obtained". Quoted in Scientific American Supplement No. 363 (1882), https://manybooks.net/titles/anonetext058036310.html, and in Nature's 1927 calendar note, https://www.nature.com/articles/120280b0. Checked through search excerpts only; fetches failed.

**Fix.**

vo: We call that energy *lost*. {-} James Joule wouldn't. {c20}  (Words unchanged. Add c20: "Joule held that the 'grand agents of nature' (what we now call energy) are indestructible: wherever mechanical force is expended, an exact equivalent of heat appears (postscript, British Association paper, 1843)", citing the Phil. Mag. 1843 paper or the Nature 1927 note.)

<details><summary>Verifier's check</summary>

The finding stands. The kit's own rules define `{-}` as "the sentence states nothing outside the film (framing, an instruction, or a description of the film's own picture)" (kits/cinema/script/README.md). WRITING.md rule 9 says "Every factual sentence goes in claims.json". "James Joule wouldn't." says what a real historical person believed, so it is an outside fact and the `{-}` tag is wrong. No other entry covers it. c6 describes the paddle-wheel experiment. c7 ("Energy doesn't vanish") cites OpenStax for conservation as physics, not as Joule's view. No claim in ep03/claims.json says what Joule held, and c20 is unused. The fact itself is true. I searched and confirmed the 1843 postscript wording ("the grand agents of nature are, by the Creator's fiat, indestructible; and that wherever mechanical force is expended, an exact equivalent of heat is always obtained"), read at the Cork British Association meeting on 21 Aug 1843. Two secondary reprints carry it: Scientific American Supplement No. 363 (1882) and Nature's 1927 calendar note (https://www.nature.com/articles/120280b0), whose OCR reads "groat" for "grand". A second source points the same way: the abstract of Joule's 1847 Manchester lecture "On Matter, Living Force, and Heat" says motion is not annihilated by friction, only turned into heat, and calls it absurd that living force could be destroyed. The finding's caveat is also right: Joule wrote of "force", "living force" and "grand agents", not "energy", so the note needs "what we now call energy". The proposed fix is sound and needs no replacement. The words stay the same, the tag changes to {c20}, and the claim correctly paraphrases the 1843 postscript with the anachronism caveat ("appears" stands in for "is always obtained", a harmless paraphrase). Two optional improvements for the c20 entry: use the Nature 1927 note as source_url, since it is the more authoritative of the two pages found, with verified_via "search excerpt"; and mention the 1847 lecture in the note as a cross-check.

</details>

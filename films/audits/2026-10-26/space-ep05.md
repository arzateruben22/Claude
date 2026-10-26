# Light Minute ep05: script audit (26 Oct 2026)

## Verdict

Nearly clean. Six real fixes, none of them structural. Three are misleading lines or labels: "He was right" sounds like it endorses the stone idea, "ordinary" is set against size, and the label "to scale" contradicts the "dot enlarged" badge. One is a soft number (the 8,000× factor). Two are bookkeeping: the 99.8% footnote has no claim of its own, and the hook is tagged {-}.

Checked and correct:
- 400× wider: 1,392,700 / 3,474.8 = 401. 400× farther: 149.6M / 384,400 = 389, covered by "about". Source: APOD 2008-08-01 excerpt.
- 109 across: 1,392,700 / 12,742 = 109.3, matching NASA Sun-Earth Day and Sky at Night excerpts.
- Sunspot: ESA's 2004 image gives the region as about 64,800 km, roughly 5 Earths. AR 3664 in 2024 was about 15 Earths.
- Anaxagoras: red-hot stone, larger than the Peloponnese, charged with impiety. SEP and Diogenes Laertius (Perseus) excerpts. The ancient accounts conflict and the trial is dated differently; stating only "charged" matches SEP, so it is acceptable as written.
- "Nearly twenty-five centuries": about 2,455–2,490 years.
- 1.3 million by volume: 1.302 million.
- Over 1,000× wider: VY CMa about 1,420 R☉.
- G2V means dwarf: Live Science excerpt.
- Light across the Sun: 1,392,700 / 299,792 = 4.65 s, so "5 s" and "about five seconds" are correct roundings.
- 8 min 20 s: Smithsonian excerpt.
- Tease: "two" is spoken at 69.6 s (66.97 + 2.64). 29.78 km/s × 69.6 = 2,073 km; the worst case (aphelion 29.29 km/s minus equatorial spin 0.465 km/s) gives 28.83 × 69.6 = 2,006 km, so "at least two thousand" holds.

Story: all seven beats are present and the order matches the other episodes. The hook is a real question (6 syllables, voiced by 1.87 s). The Moon-and-Sun twins picture breaks the expectation. The why has a person and stakes, the whoa escalates (fill it, then the giants), the takeaway reframes (a dwarf), and the tease is specific. Nothing from the Never-write list, no exclamation marks, no hype.

Lint: 0 errors. The recognizer did not hear "nine" (vo03) or "thousand" (vo04), so listen to both at T0.

Evidence came from search excerpts only. Page fetches failed: DNS ENOTFOUND for iep.utm.edu and penelope.uchicago.edu.

Applying F1, F2 and F4 means editing compile.py too (the c-8000 counter label and text, and the label anchor vo05:ordinary → vo05:giant), plus the matching c6, c9 and c15 claim sentences. F1 keeps the same length. F4 adds one syllable to the why beat: about 0.15 s off the 2.13 s left after the voice in that window, so the 2 s hold drops to about 1.98 s. Files: /home/user/Claude/films/channels/space/ep05/script.md, claims.json, compile.py and scene.mjs.

## Confirmed findings (6) — fix before the final render

### F1 · misleading

**Line:** `He was right. {c6}`

**Problem.** The sentence just before this one is about calling the Sun a stone ("Calling it a stone, not a god, got him charged with impiety."), so "He was right" sounds like it backs the stone idea. The Sun is a ball of hot plasma, not a stone. Claim c6 only supports the size part ("larger than the Peloponnese"). An expert reviewer would object to this, and the counter on screen at that moment ("he was right · by a factor of") repeats it.

**Evidence.** Search excerpt from the Stanford Encyclopedia of Philosophy (plato.stanford.edu/entries/anaxagoras/): Anaxagoras held that the Sun "is a red-hot stone". encyclopedia.pub: a "fiery mass larger than the Peloponnese". c6's own claim covers only "larger than". Word order in vo04: stone → impiety → "He was right", so the nearest thing he could be right about is the stone.

**Fix.**

Use the same voiceover as proposed: "Bigger, yes. {c6}" (3 syllables), and update c6's sentence to match. In compile.py, set the c-8000 label to "bigger, yes · wider by a factor of" rather than "bigger, yes · by a factor of". The 8,000 is a width ratio (c15), and "bigger by 8,000×" could be read as area, which is about 70 million×. Keep the c-8000 timing (it starts at vo04:By). Re-voice vo04 and re-check the anchors.

<details><summary>Verifier's check</summary>

The finding holds, though the problem is smaller than claimed. I couldn't run a web search because this turn's search budget was used up. So I relied on the excerpts already in claims.json (c4 and c5 say "red-hot mass (a stone or metal)") and on what is well known: Anaxagoras called the Sun a red-hot stone or metal, which is wrong, since it is plasma. What he said about size ("larger than the Peloponnese") is the only part c6 supports.

What softens it: in films/channels/space/ep05/compile.py, the screen during "He was right" does not show "he was right · by a factor of". That counter (c-8000) only starts at A("vo04:By"). Until then the c-guess counter is up ("Anaxagoras · the Sun is bigger than / southern Greece"), along with the size spine and the Peloponnese-to-scale overlay. "By a factor of about eight thousand" also settles the meaning about a second later, because a factor only fits a size.

Why it still counts: the script's own plan says "the stakes: what he risked for calling it a stone". So the story goes stone, then impiety, then "He was right", and that arc vindicates the stone/not-a-god idea. Audio is the main channel in a short. The nearest thing "He was right" can refer to is "Calling it a stone". Then the c-8000 label prints "he was right" right after it. Commenters with expertise will say "the Sun isn't a stone". The fix costs nothing, adds no syllables, and is more exact. "Bigger, yes." picks up "bigger than southern Greece" and quietly implies "stone, no". So the proposed fix is good.

One more risk, small: saying "bigger" out loud ties the 8,000 to "bigger", but c15 is a width ratio (1,392,700 / 166 km ≈ 8,400). Compared by area, the Sun's disc is about 1.52e12 km² against 21,550 km², roughly 70 million times. The screen label can fix this without touching the voiceover.

</details>

### F2 · misleading

**Line:** `Yet among the stars, it's ordinary. {c9}`

**Problem.** This line is set against size: the next line is "Some are more than a thousand times wider", and the pull-back shows the Sun as a dot beside the giants. Together they suggest the Sun is a typical size. It is not: it is bigger and heavier than about 90–95% of the Milky Way's stars, since about three quarters of stars are red dwarfs. "The Sun is an average or ordinary star" is a well-known popular myth, and swapping "average" for "ordinary" does not change what the line implies. c9's own note says the Sun outweighs about 90% of stars. The takeaway can keep "this is what ordinary looks like": it comes right after the dwarf (main-sequence) classification, and that is the normal state for stars.

**Evidence.** Search excerpts: Big Think (Ethan Siegel, "Is the Sun a typical star?") says it is more massive than 95% of stars. AMNH says "more massive than nearly 90% of stars". Discover ("Life among the dwarfs") says more than 90% of Milky Way stars are cooler and dimmer than the Sun and three fourths are red dwarfs. Measured largest stars: VY CMa about 1,420 R☉ and Stephenson 2-18 about 2,150 R☉ (uncertain), so "over 1,000× wider" holds.

**Fix.**

Yet among the stars, it's no giant. {c9}   (9 syllables instead of 10. Rewrite c9 as: the Sun is a main-sequence dwarf, not a giant, and the largest stars are over 1,000× wider. In compile.py, re-anchor the l-sun-d label from "vo05:ordinary" to "vo05:giant".)

<details><summary>Verifier's check</summary>

The finding stands, and it reads the script correctly. In the whoa beat, "Yet among the stars, it's ordinary" sits between "1.3 million Earths would fill it" and "Some are more than a thousand times wider". In compile.py at that moment, the l-sun-d label "the Sun" appears on a dot (anchor sundot, now cued at "vo05:ordinary"), the l-giant label "the largest known stars" appears beside it, and the camera pulls back x2,000. So "ordinary" is clearly a statement about size. By count, the Sun is not ordinary in size. Red dwarfs (M) are about three quarters of main-sequence stars, and K dwarfs plus white dwarfs are smaller still. G stars are about 7%, and F/A/B/O stars together are only a few percent. That puts the Sun above roughly 90-95% of stars in both mass and radius. This matches the figures the checker quoted (AMNH about 90%, Siegel 95%, Discover >90% dimmer with three quarters red dwarfs). My WebSearch budget for this turn was used up before I could run my own searches, so I checked these numbers against standard initial-mass-function star counts (M about 75%, G about 7%) rather than fresh excerpts. They agree. c9's own claim card contradicts the line: it says "most stars are smaller", and its note admits the Sun outweighs about 90% of stars and that "ordinary" was chosen only to dodge "average". The best defence is that NASA Space Place calls the Sun "average-sized", but that is the very popular simplification in question, and it does not make the line accurate. The proposed fix is sound. "It's no giant" is true in both its technical sense (luminosity class V, not III/I) and its everyday sense. It keeps the "Yet" pivot, leads naturally into "Some are more than a thousand times wider", and turns the next line ("even file the Sun under dwarf stars") into a clean step up. 9 vs 10 syllables is correct (Yet/a-mong/the/stars/it's/no/gi-ant). The re-anchor works with timeline.Film.at, which ignores punctuation: "vo05:giant" will match "giant." once the vo05 audio and words.json are regenerated. A minor point for whoever applies the fix: the summary paragraph near the top of script.md ("and among the stars it is ordinary") should be updated to match. The "8,000x wider" claim (c8) holds, since VY CMa is about 1,420 R_sun and Stephenson 2-18 about 2,150 R_sun.

</details>

### F3 · misleading

**Line:** `On-screen label (compile.py l-pelo): "southern Greece, to scale"`

**Problem.** This label appears in exactly the same window (t_pelo → t_melt0) as the badge "dot enlarged", so the screen says "to scale" and "enlarged" at once. The badge is the correct one: scene.mjs draws the Peloponnese as a 6 px beacon. At true scale it would be well under 1 px.

**Evidence.** compile.py: LABELS l-pelo text "southern Greece, to scale", and BADGES b-dot "dot enlarged", both running t_pelo → t_melt0. scene.mjs line 79: createBeacon({ px: 6 }). Calculation: camera at distance 500 from a Sun of radius 100 with a 24° vertical field of view. The Sun spans about 2 × 960 × tan(11.54°)/tan(12°) ≈ 1,840 px. The Peloponnese (about 215 km) is then 215 / 1,392,700 × 1,840 ≈ 0.3 px, so the dot is about 20× enlarged.

**Fix.**

southern Greece   (drop ", to scale" and keep the "dot enlarged" badge.)

<details><summary>Verifier's check</summary>

I could not refute the finding; it holds. In films/channels/space/ep05/compile.py, LABELS l-pelo ("southern Greece, to scale", line 91) and BADGES b-dot ("dot enlarged", line 98) both run from t_pelo to t_melt0. So the screen says "to scale" and "enlarged" about the same dot at the same moment. In scene.mjs line 79 the Peloponnese is createBeacon({ px: 6 }). In ../set/beacon.js a beacon is a glow that stays a fixed 6 px on screen however far away it is, so it is not drawn at true scale. I redid the calculation. In that window the camera moves from distance 500 to 490 from a Sun of radius 100, with a 24° field of view. The Sun spans about 0.96 to 0.98 of the frame height, about 1,844 to 1,883 px on a 1920 px frame. At that size the Peloponnese measures 0.22 px (166 km, its width as a circle of equal area, the c15 figure) to 0.32 px (240 km, its widest), so the 6 px dot is about 19 to 27 times too big. This ratio does not depend on the frame height, so it holds in every aspect. The words ", to scale" are attached to the dot itself. They cannot be read as describing the Sun, and they contradict the script's own rule of saying "not to scale" where something is not. The proposed fix is correct and needs no replacement. Changing the label to "southern Greece" matches the voiceover ("bigger than southern Greece"), and the "dot enlarged" badge already gives the honest note for that window.

</details>

### F4 · math

**Line:** `By a factor of about eight *thousand*. {c15}   (and the on-screen counter "8,000")`

**Problem.** The 8,000 figure compares the Sun with a circle that has the Peloponnese's area (166 km across). A viewer will hear "wider" as edge to edge, and the peninsula is about 215–220 km across (about 250 km on the diagonal). Measured that way the Sun is about 5,600–6,500× wider. So 8,000 sits at the top of any reasonable range, and anyone who checks gets about 6,500. About 7,000 sits inside both readings.

**Evidence.** Wikipedia, via search excerpt: area 21,549.6 km². ShowCaves, via search excerpt: about 220 km across in each direction. Coordinates: Cape Tainaron 36.39°N to Rio 38.31°N = 1.92° × 111 km = 214 km; Kyllini 21.12°E to Cape Skyllaion 23.55°E at 37.6°N = 2.43° × 88.2 km = 214 km. Ratios: 1,392,700 / 215 = 6,480; / 250 = 5,570; equal-area circle 2√(21,550/π) = 165.6 km → 1,392,700 / 165.6 = 8,410. The midpoint of that range is about 6,800 (geometric mean of 5,570 and 8,410).

**Fix.**

The vo line is the same as proposed: "By a factor of about seven *thousand*. {c15}". Also change the counter in compile.py and film.json: label "he was right · wider by a factor of", text "7,000". Rewrite c15's claim as "The Sun is about 7,000 times wider than the Peloponnese: about 5,600× edge to edge on the longest diagonal (about 250 km), about 6,300× across (about 221–223 km N–S and E–W), and about 8,400× against a circle of equal area (165.6 km)". Update the story paragraph in script.md, which still says "by a factor of about eight thousand". Update the vo text in lines.json, words.json and film.json, then re-render vo04.

<details><summary>Verifier's check</summary>

The finding stands, though it is a mild one. I could not run new web searches because the session's search budget was used up, so I checked the numbers from coordinates and the figures already in claims.json (area 21,549.6 km², Sun 1,392,700 km). I measured great-circle distances (haversine). Cape Tainaron to Rio is 223 km (6,255×). Cape Kyllini to Cape Skyllaion is 221 km (6,308×). Kyllini or Araxos to Cape Maleas, the longest diagonal, is 249–251 km (about 5,575×). The circle with the same area is 2√(21,549.6/π) = 165.6 km (8,408×). One small correction to the finding's evidence: its 214 km figures count only latitude or only longitude, so the true point-to-point widths are about 221–223 km (about 6,300×). That makes its conclusion stronger, not weaker. "About eight thousand" only works if the Peloponnese is 174 km wide. Only the equal-area circle gives that, and the viewer is never told that method. The script's own c15 note already admits 5,800–7,000× when measured by width. The on-screen counter shows a bare "8,000" right after four width comparisons ("400× wider", "109 across"). Anyone who checks will find the peninsula is about 220 km across and get about 6,300, which is 21% below the spoken figure. "About seven thousand" means a 199 km width. It sits close to the middle of the methods (geometric mean of 5,553 and 8,408 is about 6,830), and every method lands within about ±20% of it. So the proposed vo line and the change to the c-8000 text are correct. The extra syllable is harmless, since the counter stays up from 35.9 to 40.33 s. The fix is incomplete in one way: neither the spoken line nor the counter label ("he was right · by a factor of") says what is being compared. A viewer looking at the Peloponnese laid over the Sun's disc could read it as area, which is about 70.7 million×. Adding "wider" to the label settles that at no cost to the voice track.

</details>

### F5 · unsourced

**Line:** `End-card footnote (compile.py END.next): "The Sun holds about 99.8% of all the mass in the solar system."`

**Problem.** This number appears on screen but has no claim of its own in claims.json. It is mentioned only inside c8's note, and the script's end card line leaves it out. Because the post's source list is built from the claim ledger, the NASA source for this footnote will be missing from the post. Episode 4 gave its footnote its own claim (c17). The fact itself is correct.

**Evidence.** compile.py line 119: "next": "The Sun holds about 99.8% ..."  # footnote (c8 note; NASA). claims.json has no entry with this sentence. NASA, via search excerpt from "It's Surprisingly Hard to Go to the Sun" (nasa.gov/solar-system/its-surprisingly-hard-to-go-to-the-sun/): "the Sun accounts for 99.8 percent of the mass in the solar system".

**Fix.**

Add claim c18 with sentence "The Sun holds about 99.8% of all the mass in the solar system." and source_url https://www.nasa.gov/solar-system/its-surprisingly-hard-to-go-to-the-sun/ (bible §7 #4), with the note "end-card footnote, not spoken". Delete the 99.8% remark from c8's note. Change the comment in compile.py from "# footnote (c8 note; NASA)" to "# footnote (c18)". Add the footnote to the end card line: "...· "Light Minute · No. 006" · footnote "The Sun holds about 99.8% of all the mass in the solar system." {c18}". Then update scriptfile.script_beats so it reads the `{cN}` tags on the end-card line, and have lint.py count those tags as citations and include them in sources(). Without that change, c18 will warn as uncited and the NASA URL will still not reach the post.

<details><summary>Verifier's check</summary>

The finding stands. I couldn't recheck the source myself: my search budget was used up and science.nasa.gov didn't resolve. The fact is right anyway. NASA states the Sun holds 99.8% of the solar system's mass, which matches the excerpt in the finding and bible §7 #4. The sourcing gap is real. claims.json has no claim for the footnote: the 99.8% appears only in c8's note, and c8's source is the Wikipedia "Red supergiant" page. Running `lint.py films/channels/space/ep05 --sources` gives 11 sources, and the NASA "It's Surprisingly Hard to Go to the Sun" URL is not one of them. So the post would show a fact with no source behind it. Two parts of the finding are wrong, though. (1) It misreads episode 4. Ep04's c17 is not a separate footnote claim. It belongs to the spoken line "It's falling.", whose claim text happens to cover the footnote's 1.36 mm. Ep02 (c5) and ep03 (c7) work the same way: each footnote points to a claim on a spoken line, whose source covers it. Ep05 has no spoken line that says 99.8%, so it cannot follow that pattern. (2) The proposed fix would not work. kits/cinema/voice/scriptfile.py (script_beats) stores the `end card:` line as plain text and never reads `{…}` tags on it. Both the lint's citation check and sources() in kits/cinema/script/lint.py look only at vo sentences. With just a `{c18}` tag on the end-card line, lint would warn "c18 in claims.json but no sentence cites it", and the NASA URL would still be missing from the post. That was the whole point of the fix.

</details>

### F6 · unsourced

**Line:** `Which holds a million *Earths*? {-}`

**Problem.** This question takes for granted an outside fact: that one of the two holds a million Earths. So it should not carry {-}, which means "claims nothing outside the film". Lint lists it as a no-claim line. Separately, the note it should point to (c7) gets a packing figure wrong: it says "about 960,000 at random close packing". About 960,000 is the densest possible packing (about 74%). Random close packing (about 64%) gives about 830,000. The hook's round "a million" is still fine, because the whoa line clarifies with "melt down".

**Evidence.** Lint output: "{-} (no claim): Which holds a million Earths?". Volume ratio (695,700/6,371)³ = 1.302 million. × 0.7405 (densest, FCC) = 964,000. × 0.64 (random close packing) = 833,000. IFLScience, via search excerpt: 932,884 whole Earths at a 72% packing model.

**Fix.**

Which holds a million *Earths*? {c18}   (Add c18 to claims.json as a copy of c7, with sentence "Which holds a million Earths?" and the claim "By volume the Sun holds about 1.3 million Earths, more than a million." In c7's note, change "about 960,000 at random close packing" to "about 830,000 at random close packing, 960,000 at the densest packing".)

<details><summary>Verifier's check</summary>

The finding stands. The proposed fix would break lint, though. I could not search the web (this turn's search budget was used up), so this rests on the script, the ledger, the lint code and my own arithmetic.

(1) The c7 packing figure is wrong. The volume ratio is (695,700/6,371)³ = 1,302,097. At the densest packing (0.7405) that is 964,000, which is the "about 960,000" figure. At random close packing (about 0.64) it is about 833,000. So the note puts the densest-packing number under the random-close-packing label.

(2) The tag. The kit's README says {-} means a sentence "states nothing outside the film (framing, an instruction, or a description of the film's own picture)". "Which holds a million Earths?" assumes an outside, numerical fact: that one of the two bodies (the Sun) holds a million Earths. lint.py skips questions ("Questions are never claims"), so the author's {-} only shows up in the no-claim list. It is not something the linter required. Tying the line to a claim is the honest choice. The spoken line itself is fine for a general audience: by volume the Sun holds 1.3 million Earths, which is more than a million, and the whoa line says "melt down".

(3) The proposed {c7} tag fails lint. lint.py requires each ledger entry's "sentence" to match the script exactly. It errors with "claim c7: its sentence differs from the script" because c7's sentence is the whoa line. It also warns "cited by 2 sentences; a claim ties to one sentence". The episode already handles this case: c17 is a copy of c1 made for the hook's "They look like twins." The hook should get its own id the same way.

</details>

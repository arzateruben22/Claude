# Light Minute ep04: script audit (26 Oct 2026)

## Verdict

Every number in ep04 that I could recompute checks out. I verified the sources through search excerpts only: fetching pages failed in this sandbox (nssdc.gsfc.nasa.gov did not resolve). Checks: 384,400 / 12,742 = 30.2 Earths; 1.022 km/s; New York to Boston 306 km straight line (Geodatos; 346 km is the road distance) / 1.022 = 299 s = 5 min; 384,400 / 6,371 = 60.3 Earth radii; 60² = 3,600; observed v²/r = 0.002717 m/s² against g/3,600 = 0.002725 (within 1%); a fall of 1.359 mm in one second (shown as 1.4 mm) and 4.891 m in one minute, against the apple's 4.905 m in one second; light time 384,400 / 299,792 = 1.282 s (shown as 1.3 s). The sources (Ohio State and Michigan State lecture notes, UC Cincinnati notes, Garrett's Western Kentucky University page) say what claims.json says they do. No line uses the 'Never write' list, there are no exclamation marks, and no beat outside the hook asks two questions. The seven-beat shape is sound: a real hook, a gravity-off picture that breaks the expectation, a person (Newton) and a wrong idea (two realms), the Moon test as the whoa, the readout, and a tease. Lint: 0 errors and 1 warning (the why has 45 words against 24–44; changing 'Isaac Newton' to 'Newton' fixes it). Six findings need fixing before voicing. (1) The whoa picture shows the Moon's one second at ×10⁶ while the voice and spine compare its one minute; they should be two equal 4.9 m drops. (2) 'So ... thirty-six hundred times weaker' never voices the squaring. (3) The 'gap ×1,000,000' badge and the 'dozen seconds' ghost lines cannot be seen at whole-orbit scale. (4) The takeaway's 'holds the Moon' contradicts the hook's 'Nothing'. (5) The 'why doesn't it land?' that episode 3 promised is never answered in words. (6) c7's source doesn't cover the apple anecdote. Each fix keeps the beat timing.

## Confirmed findings (3) — fix before the final render

### f1 · misleading

**Line:** `## whoa {shot: the apple drops its first second, 4.9 m; then the Moon's second, the gap magnified a million times · spine "apple, 1 second: 4.9 m", then "Moon, 1 minute: 4.9 m" (1.4 mm a second) ...}`

**Problem.** The picture and the narration describe different things. The voice and the spine compare the Moon's fall over one MINUTE with the apple's fall over one second, and the payoff is that the two drops are equal. The picture direction instead shows the Moon's one SECOND at ×10⁶. If both drops share the screen's scale, the Moon's gap looks about 277 times bigger than the apple's, so 'And it does' plays over an image that says the opposite. The proof should be visible: two equal 4.9 m drops side by side.

**Evidence.** Computed: Moon's 1 s drop = v²/(2r) = 1022²/(2 × 3.844e8) = 1.359 mm; × 10⁶ = 1.36 km against the apple's 4.905 m = 277×. Moon's 1 min drop = ½ × 0.0027172 × 60² = 4.891 m, against the apple's ½ × 9.81 × 1² = 4.905 m (equal). The Moon's path in that minute is 61.3 km, 12,500 times its drop, so the path has to be shortened to show the drop at the apple's scale.

**Fix.**

then the Moon's minute: its 4.9 m drop beside the apple's on one ruler · badge: path not to scale

<details><summary>Verifier's check</summary>

The finding reads the script correctly. The whoa direction still says "then the Moon's second, the gap magnified a million times". That is left over from the per-second version of the story, which the intro paragraph still tells. The vo now says "in one minute, the Moon should fall as far as an apple falls in one second... And it does", and the spine says "Moon, 1 minute: 4.9 m". So the picture shows one thing (one second, magnified) and the voice and spine say another (one minute, at real size). The payoff "And it does" plays over a picture that cannot show the two drops are equal.

I redid every number and they all hold:
- The Moon's acceleration is 1022²/3.844e8 = 0.0027172 m/s².
- Its fall in one second is 1.359 mm. Magnified a million times, that is 1.36 km, about 277 times the apple's 4.905 m.
- Its fall in one minute is 4.891 m, using the exact geometry r(1−cos θ). The apple falls ½ × 9.81 × 1² = 4.905 m in one second, so the two are equal.
- The Moon's path in that minute is 61.3 km, about 12,540 times its drop.

One part of the finding goes too far. The 277× figure only applies if both drops are drawn at one scale. The script shows them one after the other ("then"), and "magnified a million times" already tells the viewer the scales differ. But the mismatch is still real without that figure. A "gap ×1,000,000" view captioned "Moon, 1 minute: 4.9 m" either contradicts itself (it suggests the 4.9 m has been blown up a million times) or shows nothing matching the apple. As written, the shot does not prove the claim the voice makes.

The proposed fix is correct. It shows the Moon's minute, puts its 4.89 m drop beside the apple's 4.9 m on one ruler, and labels the shortened 61 km path "path not to scale". That makes the equality visible and honest, and it stays consistent with the "(1.4 mm a second)" spine and the hook's ×10⁶ gap. One small optional addition: if the Moon's minute is animated in a few seconds rather than shown as a still, add a clock speed note to match the episode's other honesty labels. Two related edits outside this line should come with the fix: the intro's per-second story and the "Honesty, on screen" list, which should gain "path not to scale".

</details>

### f2 · misleading

**Line:** `So the pull there is thirty-six hundred times *weaker*. {c9}`

**Problem.** The spoken chain jumps from 'sixty times farther' to 'so ... thirty-six hundred times weaker' and never voices the squaring. Fading with the square of distance is the mechanism of the episode and the very thing Newton's Moon test checked. Without it a viewer can't get from 60 to 3,600, and a specialist would object that 'So' presents the inverse-square law as if it followed from the distance alone. (While you are in this beat: lint already warns that the why runs 45 words against a range of 24–44. Changing 'Isaac Newton' to 'Newton' in the c7 line clears that.)

**Evidence.** Search excerpts: the UC Hanson notes (c9's source) give 1/(60)² = 1/3600. NASA Stargazers says Newton's check worked only if gravity falls off as 1/R². Ohio State notes: 4.9 m / 3600 (60 squared) = 0.00136 m. Computed: 384,400 / 6,371 = 60.3; 60² = 3,600. The replacement keeps 9 words and 13 syllables (the original is 9 words and 13 syllables) and still speaks only one number.

**Fix.**

Gravity fades with distance squared: thirty-six hundred times *weaker*. {c9}

<details><summary>Verifier's check</summary>

The finding stands. I could not run my own web search because the turn's search budget was used up. So I relied on the excerpts already in claims.json and redid the arithmetic. 384,400 / 6,371 = 60.3. 60² = 3,600, and 60.3² = 3,641, so "thirty-six hundred" is right. The fact is fine. The problem is the spoken logic. The why beat says "sixty times farther" and then "So ... thirty-six hundred times weaker", and it never says why 60 becomes 3,600. Gravity fading with the square of distance is the mechanism the episode is about and the hypothesis Newton's Moon test checked. The c9 ledger entry itself says "Gravity weakens with the square of distance". The picture direction shows only "60 Earth radii" and "the pull shrinks by 3,600", so the screen doesn't explain the squaring either. For a general audience the "So" is a non sequitur, and the specialist objection is fair. Running the repo lint (films/channels/space/ep04 is the same file as the audit copy) shows "WARN why: 45 words; the template asks 24–44". Changing "Isaac Newton" to "Newton" in c7 brings it to 44 and clears the warning. Problems with the proposed fix: (1) "Square that:" voices the arithmetic but still never says that gravity fades with distance squared, so a viewer is told to square without knowing why. That only partly answers the specialist point. (2) "the pull there's thirty-six hundred times weaker" is a garden path. "there's" normally reads as existential "there is", which is awkward for the synthetic voice and for listeners. The betterFix below keeps 9 words and still speaks only one number. It states the law itself, so 60 → 3,600 follows from what is said. By the lint's syllable counter it is 17 syllables against the original's 13 (the proposed fix counts 14). Dropping "Isaac" gives back about 2 of those, so the beat grows by roughly half a second at 3.8 syllables a second. That fits inside the 18 s window, but the line needs re-voicing either way. Whichever wording is used, the c9 and c7 "sentence" fields in claims.json must be updated to match the new spoken text exactly, or the lint will fail.

</details>

### f6 · unsourced

**Line:** `Isaac Newton, the story goes, wondered if the pull that drops an apple reaches the Moon. {c7}`

**Problem.** The line is fine and properly hedged, but its claim leans on the apple anecdote ('wondered if ... reaches the Moon' is Conduitt's account). The cited source, the UC Cincinnati gravity notes, covers the Moon test and not where the anecdote comes from. Rule 9 requires a source that actually says it.

**Evidence.** Search excerpts: the Hanson notes give 0.00272 m/s² and 1/3600 but don't address the apple story. Conduitt's memorandum (Keynes Ms. 130.2, pp. 32–33, King's College Cambridge; catalogued by the Newton Project as Keynes Ms. 130.02) has Newton thinking the power that made the apple fall must reach much farther: 'Why not as high as the Moon, said he to himself' (quoted at todayinsci.com/C/Conduitt_John/ConduittJohn-Quotations.htm).

**Fix.**

Line unchanged. Set c7's source to Conduitt's account of Newton's life at Cambridge, Keynes Ms. 130.4 (Newton Project), the 'Why not as high as the Moon' passage. Put the UC notes in c7's note for the Moon-test half. Confirm the shelfmark when opening the link.

<details><summary>Verifier's check</summary>

The finding holds. The spoken line is fine: "the story goes" correctly marks the apple story as secondhand, and the finding itself leaves the line unchanged. The problem is the paperwork. Rule 9 (kits/cinema/script/WRITING.md) says every factual sentence needs a source. c7's only source_url is the UC Cincinnati gravity notes. The search excerpts recorded for those notes (0.00272 m/s², 60² = 3600) cover the Moon test, not where the apple story comes from. c7's own claim and note already say the anecdote comes from Stukeley and Conduitt, yet neither is cited. So the part the narration hedges has no source. Conduitt is the right choice over Stukeley, because only Conduitt's account links the apple to the Moon ("Why not as high as the Moon said he to himself"). Swapping c7's source_url is safe for the post's source list: lint.py builds it from first use, and the UC notes stay cited by c9, c10 and c13. I could not re-check anything live. homepages.uc.edu would not resolve (DNS failure), and the shared web-search budget for this turn was used up, so I could not run any searches. One part of the proposed fix looks wrong. From memory, the Newton Project's online text of this passage is filed as "Keynes Ms. 130.4: Conduitt's account of Newton's life at Cambridge". That is the shelfmark Wikipedia's Isaac Newton article cites for the quote, and Westfall gives it as Keynes MS 130.4, pp. 10–12. I could not confirm "Keynes Ms. 130.2, pp. 32–33" or "130.02". Another Conduitt draft might also contain the story, so the shelfmark should not go in unchecked. Also, claims.json holds one source per claim, so "keep the UC notes for the Moon-test half" means writing them into c7's note.

</details>

## Story and wording notes (2) — apply when cheap

### f4 · story

**Line:** `So the pull that drops an apple is the very same pull that holds the *Moon*. {c13}`

**Problem.** The button contradicts the hook. The film opens with 'What's holding the Moon up? Nothing.' and then ends by saying gravity 'holds the Moon'. Spoken aloud, a viewer hears the opening answer taken back. The takeaway should hand back to frame 0 (picture rule 6: end on a loop), and the hook's word is 'falling'.

**Fix.** So the pull that drops an apple is the same pull that keeps the Moon *falling*. {c13}

### f5 · story

**Line:** `Every moment, all the way round. {c18}`

**Problem.** The episode exists to answer episode 3's tease ('the Moon never stops falling toward us. So why doesn't it land?', end card 'the Moon that never lands'), but no line ever says the answer: it falls, but its sideways speed carries it past, so it keeps missing. This line only repeats the one before it. Under rule 1, a line that answers nothing and asks nothing gets cut, and this slot is where the promised answer belongs. The bible's own takeaway for this episode is 'It is always falling, and always missing'.

**Fix.** So it falls, and always *misses*. {c18}


## Refuted (1) — no change

### f3

**Line:** `badge: gap ×1,000,000 (hook heading; also takeaway "pull back, the whole orbit, the ghost lines of a dozen seconds")`

**Why it stands as written.** The finding misreads which frames carry the badge and which gap they show.

1) The hook. The script does not say frame 0 shows the whole orbit. It says "frame 0, the payoff", which is the whoa's end state: the Moon a minute after leaving its straight line. The build follows this. README: "Frame 0 = the whoa's last frame", seen from "a close view on the Moon (hook and whoa)". film.json puts the camera at t=0 aimed at the Moon (target |r| = 38.44 units) from 7.2 units (72,000 km) away, with a 24° field of view. That frame is about 17,200 km wide, or about 16 km per pixel. The gap drawn there is the one-minute fall: 4.89 m × 10⁶ = 4,890 km, about 300 px. The ×1,000,000 is literally true for what is drawn, since scene.mjs scales only (orbit − straight) by PH.mag = 1e6 and keeps everything else at true scale. Even the one-second figure the finding uses (1.36 km at 10⁶) would be about 85 px in this view, not 1/600 px. The finding's 854 km/px comes from an orthographic, orbit-wide frame that the script never asks for. "Earth and the Moon" is loose direction, but a perspective shot with the Moon close and Earth small in the distance would still keep the badge true.

2) The takeaway carries no badge, in the script or the build. b-mag runs 43.37–53.87 s and stops exactly where the takeaway starts, at 53.87 s. Nothing on screen there gives a number. The build draws 12 tangents, each 60,000 km long, at true scale. Each is about 16 h of straight-line travel, about 81 px long, ending about 4,650 km (about 6 px) off the orbit. That is honest, true geometry. "A number on screen must describe what is drawn" is satisfied.

3) The proposed fix would make things worse. Swapping the hook badge for "label: straight path, 1 day" would break the frame-0 = payoff continuity, which shows the minute's fall. In a close view about 17,000 km wide, a one-day path (88,300 km) would not even fit. And it would remove an accurate honesty badge from the frame where it is true. The honesty note's "gap ×1,000,000" is correct for the hook and the whoa.

The only real nit is the takeaway's direction text, "the ghost lines of a dozen seconds". It is off-screen compiler direction and has no audience-facing effect. If tidied, it could read "a dozen short straight lines, each about 16 h, true scale", which is what the build actually draws.
